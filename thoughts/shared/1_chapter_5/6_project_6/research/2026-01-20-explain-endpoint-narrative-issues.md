---
date: 2026-01-20T21:45:00-08:00
researcher: Claude
git_commit: 0d107c359a9d06625019ea2df3be0145e798f1b3
branch: project_6
repository: recommender_system
topic: "Explain Endpoint Narrative Issues: Experience Score and PreferredSkills Count Bugs"
tags: [research, codebase, explain-endpoint, scoring, tradeoffs, bugs]
status: complete
last_updated: 2026-01-20
last_updated_by: Claude
---

# Research: Explain Endpoint Narrative Issues

**Date**: 2026-01-20T21:45:00-08:00
**Researcher**: Claude
**Git Commit**: 0d107c359a9d06625019ea2df3be0145e798f1b3
**Branch**: project_6
**Repository**: recommender_system

## Research Question

Why does the explain endpoint show:
1. "Junior level experience (0 years)" for all engineers when they have 5-9 years of actual experience?
2. "Has 0 of 3 preferred skills" when only 1 skill was requested?

## Summary

### Issue 1: Experience Score Shows 0 Years

**Root Cause**: The `rawScore` passed to `generateExperienceExplanation()` is 0 (or very close to 0), causing the inverse logarithmic formula to compute 0 years.

The formula `Math.exp(rawScore * Math.log(21)) - 1` produces 0 when `rawScore = 0`:
- `Math.exp(0 * Math.log(21)) - 1 = Math.exp(0) - 1 = 1 - 1 = 0`

**Why rawScore might be 0**:
- The score breakdown filtering in `utility-calculator.ts` only includes non-zero scores
- If `yearsExperience` from the database is null/undefined, `toNumber()` defaults to 0
- This creates a 0 experience score that gets passed to explanation generation

### Issue 2: preferredSkills Count Shows Wrong Number

**Root Cause**: Skill hierarchy expansion inflates the count.

When user requests `preferredSkills: [{"skill": "Python"}]`:
1. Skill resolver expands "Python" to include descendants: `[python, django, flask]` (3 skills)
2. Constraint expander **flattens** all preferred skill groups into a single preference
3. Tradeoff detection counts the **expanded array length** (3) as "requested"
4. Result: "Has 0 of 3 preferred skills" instead of "Has 0 of 1 preferred skills"

## Detailed Findings

### Issue 1: Experience Score Calculation

#### Score Explanation Generation

**File**: `recommender_api/src/services/search-match-explanation/score-explanation.service.ts`

Lines 83-110 contain `generateExperienceExplanation()`:

```typescript
// Line 89 - Inverse logarithmic formula
const years = Math.round(Math.exp(rawScore * Math.log(21)) - 1);

// Lines 92-100 - Experience level classification
if (years >= 10) {
  explanation = `Staff+ level experience (${years}+ years)`;
} else if (years >= 6) {
  explanation = `Senior level experience (${years} years)`;
} else if (years >= 3) {
  explanation = `Mid-level experience (${years} years)`;
} else {
  explanation = `Junior level experience (${years} years)`;  // ← Line 99
}
```

The `Math.log(21)` is hardcoded assuming `maxYears = 20` from config, which should match:
- **Config**: `recommender_api/src/config/knowledge-base/utility.config.ts` line 131: `yearsExperienceMax: 20`

#### Forward Formula (Scoring)

**File**: `recommender_api/src/services/utility-calculator/scoring/core-scoring.ts` (Lines 65-72)

```typescript
export function calculateExperienceUtility(
  yearsExperience: number,
  maxYears: number
): number {
  const logYears = Math.log(1 + yearsExperience);
  const logMax = Math.log(1 + maxYears);
  return Math.min(logYears / logMax, 1);
}
```

#### Score Filtering

**File**: `recommender_api/src/services/utility-calculator/utility-calculator.ts` (Lines 157-163)

```typescript
// Filter core scores - only include non-zero values
const scores: Partial<CoreScores> = {};
for (const [key, value] of Object.entries(coreScores)) {
  if (value > 0) {
    scores[key as keyof CoreScores] = value;
  }
}
```

If experience score is 0, it gets filtered out. But if a non-zero value that represents 0 years makes it through, the explanation will show 0 years.

#### Data Extraction

**File**: `recommender_api/src/services/engineer-record-parser.ts` (Lines 86-98)

```typescript
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;  // ← DEFAULT TO 0 IF NULL/UNDEFINED
  }
  // ... other handling
}

// Line 189:
yearsExperience: toNumber(record.get("yearsExperience")),
```

If the Neo4j record doesn't have `yearsExperience` property, it defaults to 0.

### Issue 2: preferredSkills Tradeoff Count

#### Skill Hierarchy Expansion

**File**: `recommender_api/src/services/skill-resolver.service.ts` (Lines 121-162)

The skill resolver traverses CHILD_OF relationships:
```typescript
OPTIONAL MATCH (leafChildOf:Skill)-[:CHILD_OF*0..]->(rootSkill)
WHERE leafChildOf.isCategory = false
```

Result: "Python" expands to `["python", "django", "flask"]`

#### Constraint Expander Flattening

**File**: `recommender_api/src/services/constraint-expander.service.ts` (Lines 534-556)

**Problem**: Preferred skills are flattened into a single preference, losing grouping:

```typescript
const allPreferredSkills: ResolvedSkillConstraint[] = [];
for (const group of resolvedPreferredSkillGroups) {
  for (const skillId of group.expandedSkillIds) {
    allPreferredSkills.push({
      skillId,
      skillName: skillId,
      // ...
    });
  }
}
```

Creates a flat array of 3 skills instead of preserving the original 1-skill group.

#### Tradeoff Detection

**File**: `recommender_api/src/services/search-match-explanation/tradeoff-explanation.service.ts` (Lines 190-207)

```typescript
function detectMissingPreferredSkills(...): TradeoffExplanation | null {
  // ...
  return {
    attribute: 'preferredSkills',
    requested: preferredSkillIds.length,  // ← Counts ALL expanded skills (3)
    actual: preferredSkillIds.length - missingSkills.length,
    explanation: `Has ${...} of ${preferredSkillIds.length} preferred skills`,
  };
}
```

#### Data Flow Comparison

| Component | Required Skills | Preferred Skills |
|-----------|-----------------|------------------|
| constraint-expander.service.ts | Per-group filters (lines 508-528) | Flattened single preference (lines 534-556) |
| Grouping preserved? | ✓ Yes | ✗ No |
| HAS_ANY semantics | ✓ Per group | ✗ Entire flat array |

## Code References

### Issue 1: Experience Score

| File | Lines | Description |
|------|-------|-------------|
| `score-explanation.service.ts` | 89 | Inverse formula: `Math.exp(rawScore * Math.log(21)) - 1` |
| `score-explanation.service.ts` | 99 | "Junior level experience" message |
| `utility-calculator.ts` | 157-163 | Score filtering (only non-zero) |
| `engineer-record-parser.ts` | 86-98 | `toNumber()` defaults to 0 |
| `engineer-record-parser.ts` | 189 | `yearsExperience: toNumber(...)` |
| `core-scoring.ts` | 65-72 | Forward logarithmic formula |
| `utility.config.ts` | 131 | `yearsExperienceMax: 20` |

### Issue 2: preferredSkills Count

| File | Lines | Description |
|------|-------|-------------|
| `skill-resolver.service.ts` | 121-162 | CHILD_OF hierarchy expansion |
| `constraint-expander.service.ts` | 534-556 | Flattens preferred skill groups |
| `tradeoff-explanation.service.ts` | 190-207 | `detectMissingPreferredSkills()` |
| `tradeoff-explanation.service.ts` | 203-205 | Uses `preferredSkillIds.length` |
| `search-match-explanation.service.ts` | 115-122 | Extracts all skills from flattened preference |

## Architecture Insights

### Issue 1: Score Explanation Design Flaw

The score explanation system uses an inverse formula to convert raw scores back to human-readable values:
- Forward: `yearsExperience` → `rawScore` (logarithmic)
- Backward: `rawScore` → `years` (exponential)

The problem is the `rawScore` being passed is 0 for some engineers, which could mean:
1. Engineer has 0 years experience (unlikely given database shows 5-9 years)
2. The score was filtered out earlier and a default 0 is being used
3. The score calculation isn't receiving the correct `yearsExperience` value

### Issue 2: Inconsistent Skill Handling

The system has two conflicting patterns:

1. **Required Skills** (correct): Creates per-group HAS_ANY filters, preserving the original request structure
2. **Preferred Skills** (incorrect): Flattens all groups, losing the original request count

This architectural inconsistency causes confusing tradeoff messages where the "requested" count reflects expanded descendants rather than the user's actual request.

## Open Questions

### Issue 1

1. Why is `rawScore` for experience showing 0 when the EngineerMatch has non-zero `yearsExperience`?
2. Is the score breakdown being populated correctly before being passed to explanation generation?
3. Should we add defensive checks for 0 rawScore and use the engineer's actual yearsExperience directly?

### Issue 2

1. Should tradeoff detection count **original skill groups** (1) instead of **expanded skills** (3)?
2. Should the system distinguish between "user requested X skills" vs "system expanded to Y skills"?
3. Should preferred skills use the same per-group structure as required skills?

## Recommended Fixes

### Issue 1: Quick Fix

In `score-explanation.service.ts`, add a fallback to use `engineerMatch.yearsExperience` directly:

```typescript
function generateExperienceExplanation(
  rawScore: number,
  actualYearsExperience?: number  // Add this parameter
): ScoreExplanation {
  // Use actual years if available, fall back to inverse calculation
  const years = actualYearsExperience ?? Math.round(Math.exp(rawScore * Math.log(21)) - 1);
  // ...
}
```

### Issue 2: Quick Fix

In `tradeoff-explanation.service.ts`, track original group count:

```typescript
function detectMissingPreferredSkills(
  engineerSkills: string[],
  preferredSkillIds: string[],
  originalGroupCount: number  // Add this parameter
): TradeoffExplanation | null {
  return {
    attribute: 'preferredSkills',
    requested: originalGroupCount,  // Use original count, not expanded
    actual: matchedCount,
    explanation: `Has ${matchedCount} of ${originalGroupCount} preferred skill groups`,
  };
}
```

## Related Research

- `thoughts/shared/1_chapter_5/6_project_6/plans/2026-01-20-fix-skill-hierarchy-expansion-bug.md` - Documents the same preferred skills issue with a proposed fix
