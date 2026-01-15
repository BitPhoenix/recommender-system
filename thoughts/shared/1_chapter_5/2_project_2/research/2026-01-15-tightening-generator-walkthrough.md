---
date: 2026-01-15T15:15:00-08:00
researcher: Claude
git_commit: bec4c9da4a835087607d50f043e447e6ab47fb74
branch: project_2
repository: BitPhoenix/recommender-system
topic: "Tightening Generator System - Code Walkthrough"
tags: [research, codebase, constraint-advisor, tightening, walkthrough]
status: complete
---

# Tightening Generator System - Code Walkthrough

**Date**: 2026-01-15T15:15:00-08:00
**Researcher**: Claude
**Branch**: project_2

## Overview

When search results exceed the threshold (≥25 matches), the system suggests ways to **narrow down** results by adding or tightening constraints. This walkthrough covers the 4-file architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     TIGHTENING GENERATION FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  tightening-generator.service.ts                                        │
│  ├── Orchestrates all generators                                        │
│  ├── Uses type-safe registry: Record<TightenableField, Generator>       │
│  └── 5 field-specific generators (timezone, seniority, budget, etc.)    │
│           │                                                              │
│           ▼                                                              │
│  tightening-tester.service.ts                                           │
│  ├── testTightenedPropertyValue() - modify existing constraint          │
│  ├── testAddedPropertyConstraint() - add new constraint                 │
│  ├── testAddedSkillConstraint() - add skill requirement                 │
│  └── getBaselineCount() - current result count                          │
│           │                                                              │
│           ▼                                                              │
│  skill-extraction.utils.ts (SHARED)                                     │
│  ├── extractSkillConstraints() - single source of truth                 │
│  └── Separates user skills (proficiency) from derived (existence)       │
│           │                                                              │
│           ▼                                                              │
│  search-query.builder.ts                                                 │
│  ├── buildSkillFilterCountQuery() - count with skill filters            │
│  ├── buildSkillDistributionQuery() - find common skills                 │
│  └── buildProficiencyQualificationClause() - CASE pattern               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Entry Point: `tightening-generator.service.ts`

### 1.1 The Type-Safe Registry Pattern (Lines 52-82)

Start here - this is the architectural foundation:

```typescript
// Line 52: Derive field names from the TighteningSuggestion union
type TightenableField = TighteningSuggestion['field'];
// Results in: 'requiredTimezone' | 'requiredSeniorityLevel' | 'maxBudget' | ...

// Lines 76-82: Registry ensures completeness at compile time
const fieldToTighteningSuggestionGenerator: Record<TightenableField, TighteningSuggestionGenerator> = {
  requiredTimezone: generateTimezoneTighteningSuggestions,
  requiredSeniorityLevel: generateSeniorityTighteningSuggestions,
  maxBudget: generateBudgetTighteningSuggestions,
  requiredMaxStartTime: generateTimelineTighteningSuggestions,
  requiredSkills: generateSkillTighteningSuggestions,
};
```

**Key Insight:** Using `Record<TightenableField, ...>` means if you add a new `TighteningSuggestion` variant (like `DomainTightening`), TypeScript will error until you add a generator.

### 1.2 Main Orchestration Function (Lines 91-140)

```typescript
export async function generateTighteningSuggestions(
  session: Session,
  expandedSearchCriteria: ExpandedSearchCriteria,
  appliedFilters: AppliedFilter[],
  maxSuggestions: number = 5
): Promise<TighteningSuggestion[]>
```

**Read order:**
1. **Line 98:** Decompose filters into testable constraints
2. **Lines 101-110:** Get baseline count (current result count with all filters)
3. **Lines 122-134:** Loop through registry, call each generator
4. **Line 137:** Sort by effectiveness (lowest `resultingMatches` = most narrowing)
5. **Line 139:** Return top N suggestions

---

## 2. The Five Generators

Each generator follows the same pattern:
1. Check what user already has (skip redundant suggestions)
2. Query for distribution or test hypothetical values
3. Calculate `resultingMatches` and `distributionInfo`
4. Filter to only include **stricter** suggestions

### 2.1 Timezone Generator (Lines 148-185)

**Pattern: Add new constraint**

```typescript
async function generateTimezoneTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
): Promise<TimezoneTightening[]>
```

**Key logic:**
- Lines 160-163: Skip regions user already filters
- Lines 165-170: Test adding `timezone STARTS WITH 'America/'` via `testAddedPropertyConstraint()`
- Lines 172-181: Only suggest if `count > 0 && count < baselineCount`

**Strictness:** Excludes already-filtered regions using `expanded.timezonePrefixes`

### 2.2 Seniority Generator (Lines 196-259)

**Pattern: Modify OR add constraint**

**Key logic:**
- Lines 206-209: Find current seniority index in `SENIORITY_LEVEL_ORDER`
- Line 221: Loop starting from `currentIndex + 1` (only stricter levels)
- Lines 228-244: Two branches:
  - If experience constraint exists → `testTightenedPropertyValue()`
  - Otherwise → `testAddedPropertyConstraint()`

**Strictness:** Uses ordered array `SENIORITY_LEVEL_ORDER = ['junior', 'mid', 'senior', 'staff', 'principal']` to only suggest higher levels.

### 2.3 Budget Generator (Lines 269-321)

**Pattern: Modify existing constraint only**

```typescript
// Lines 277-280: Can't tighten if no budget exists
if (currentBudget === null) {
  return [];
}
```

**Key logic:**
- Lines 292-295: Calculate step-down thresholds (80%, 70%, 60% of current)
- Lines 299-305: Test each via `testTightenedPropertyValue()`

**Strictness:** Uses relative multipliers, so suggestions are always lower than current.

### 2.4 Timeline Generator (Lines 330-389)

**Pattern: Modify OR add constraint**

**Key logic:**
- Lines 340-343: Find current timeline index (lower = faster = stricter)
- Line 353: Loop `for (let i = 0; i < currentIndex; i++)` - only faster timelines
- Lines 356-357: Build `allowedTimelines` as array up to and including target

**Strictness:** Uses ordered array `START_TIMELINE_ORDER = ['immediate', 'two_weeks', 'one_month', ...]` to only suggest faster timelines.

### 2.5 Skill Generator (Lines 397-468)

**Pattern: Distribution query + add new constraints**

This is the most complex generator. **Read carefully:**

```typescript
// Lines 408-411: Get currently required skills from appliedFilters
const requiredSkillFilter = expanded.appliedFilters.find(
  (f): f is AppliedSkillFilter => f.kind === AppliedFilterKind.Skill && f.field === 'requiredSkills'
);
const currentSkillIds = requiredSkillFilter?.skills.map(s => s.skillId) ?? [];

// Line 414: Use shared utility to extract skills from decomposed
const { userRequiredSkills, derivedSkillIds } = extractSkillConstraints(decomposed);

// Lines 417-430: Build and run distribution query
const skillGroups = groupSkillsByProficiency(userRequiredSkills);
const { query, params } = buildSkillDistributionQuery(
  skillGroups,
  propertyConditions,
  derivedSkillIds
);
```

**Key logic:**
- Line 442: Skip if already required OR too rare (`percentage < 20`)
- Lines 449-454: Test adding skill via `testAddedSkillConstraint()`

**Strictness:** Excludes skills already in `currentSkillIds`.

---

## 3. The Testing Layer: `tightening-tester.service.ts`

This layer provides "what-if" testing - checking result counts with hypothetical constraints.

### 3.1 Four Public Functions

| Function | Use Case | When Used |
|----------|----------|-----------|
| `getBaselineCount()` | Current result count | Always first |
| `testTightenedPropertyValue()` | Modify existing constraint's value | Budget, Seniority (if exists), Timeline (if exists) |
| `testAddedPropertyConstraint()` | Add new property constraint | Timezone, Seniority (if none), Timeline (if none) |
| `testAddedSkillConstraint()` | Add new skill requirement | Skills |

### 3.2 The Unified Count Query Pattern

All four functions delegate to a shared `runCountQuery` helper via a `CountQueryContext`:

```typescript
// CountQueryContext interface (tightening-tester.service.ts)
interface CountQueryContext {
  propertyConditions: { whereClauses: string[]; params: Record<string, unknown> };
  userRequiredSkills: ResolvedSkillWithProficiency[];
  derivedSkillIds: string[];
  baseMatchClause: string;
}
```

Each public function prepares its specific context, then delegates:

| Function | What It Prepares |
|----------|-----------------|
| `getBaselineCount()` | Unmodified constraints |
| `testTightenedPropertyValue()` | Property conditions with modified param value |
| `testAddedPropertyConstraint()` | Property conditions with extra WHERE clause |
| `testAddedSkillConstraint()` | Skills array with new skill added |

The `runCountQuery` helper encapsulates the decision tree:
- If skills exist → `buildSkillFilterCountQuery` → skill-aware Cypher
- If no skills → simple property-only Cypher

**Why this matters:** The skill-aware vs property-only logic lives in ONE place, eliminating ~150 lines of duplicated code.

All four functions delegate query execution to `runCountQuery(session, context)` after preparing their specific `CountQueryContext`.

---

## 4. The Shared Utility: `skill-extraction.utils.ts`

This 68-line file is the **single source of truth** for extracting skills from `DecomposedConstraints`.

### 4.1 The Interface (Lines 15-20)

```typescript
export interface ExtractedSkillConstraints {
  /** User skills with proficiency requirements (checked via CASE pattern) */
  userRequiredSkills: ResolvedSkillWithProficiency[];
  /** Derived skills from inference rules (existence-only, no proficiency) */
  derivedSkillIds: string[];
}
```

**Key distinction:**
- **User skills:** Have proficiency requirements (`learning`, `proficient`, `expert`)
- **Derived skills:** Just need to exist (from inference rules like "scaling requires distributed")

### 4.2 The Extraction Logic (Lines 48-62)

```typescript
for (const constraint of constraints) {
  if (constraint.constraintType !== ConstraintType.SkillTraversal) continue;

  if (constraint.field === 'requiredSkills' && isUserSkillConstraint(constraint)) {
    // User skill: extract with proficiency
    const skillReq = constraint.value;
    userRequiredSkills.push({
      skillId: skillReq.skill,
      skillName: skillReq.skill,
      minProficiency: (skillReq.minProficiency ?? 'learning') as ProficiencyLevel,
      preferredMinProficiency: null,
    });
  } else if (constraint.field === 'derivedSkills' && isDerivedSkillConstraint(constraint)) {
    // Derived skill: just the IDs
    derivedSkillIds.push(...constraint.value);
  }
}
```

---

## 5. The Query Builders: `search-query.builder.ts`

### 5.1 The Proficiency CASE Pattern (Lines 126-134)

This is the **most critical piece** - the Cypher pattern that checks if an engineer meets proficiency requirements:

```typescript
function buildProficiencyQualificationClause(): string {
  return `COLLECT(DISTINCT CASE
  WHEN s.id IN $learningLevelSkillIds THEN s.id           // Any level OK
  WHEN s.id IN $proficientLevelSkillIds
   AND us.proficiencyLevel IN ['proficient', 'expert'] THEN s.id  // Must be proficient+
  WHEN s.id IN $expertLevelSkillIds
   AND us.proficiencyLevel = 'expert' THEN s.id           // Must be expert
END)`;
}
```

**How it works:** Collects skill IDs where the engineer meets the requirement. An engineer qualifies if the collected array has the same size as the required skills array.

### 5.2 Count Query (Lines 146-200)

`buildSkillFilterCountQuery()` - Returns count of engineers matching all constraints.

**Key Cypher (Lines 190-196):**
```cypher
MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
WHERE s.id IN $allSkillIds
  AND <property conditions>
WITH e, <proficiency CASE> AS qualifyingSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) >= SIZE($allSkillIds)
  <derived skill existence clause>
RETURN count(DISTINCT e) AS resultCount
```

### 5.3 Distribution Query (Lines 213-280)

`buildSkillDistributionQuery()` - Finds most common skills among matching engineers.

**Key difference from count query:** After filtering engineers, it does a second `MATCH` to get their other skills:

```cypher
-- First: find engineers matching all constraints
WITH e
-- Second: find what other skills these engineers have
MATCH (e)-[:HAS]->(us2:UserSkill)-[:FOR]->(s2:Skill)
WITH s2.name AS skillName, s2.id AS skillId, count(DISTINCT e) AS engineerCount
ORDER BY engineerCount DESC
LIMIT $distributionLimit
```

---

## 6. Data Flow Example

Let's trace a tightening request for a user searching for "Backend developers with ≤$180k budget":

```
1. generateTighteningSuggestions() called with 40 matches

2. getBaselineCount() → 40

3. For each generator in registry:

   a. generateTimezoneTighteningSuggestions()
      - Test "America/*" → testAddedPropertyConstraint() → 25 matches
      - Suggestion: "Filter to Americas timezone (25 of 40 = 63%)"

   b. generateSeniorityTighteningSuggestions()
      - No current seniority → test all levels
      - "mid" via testAddedPropertyConstraint() → 30 matches
      - "senior" → 18 matches
      - Suggestions for both

   c. generateBudgetTighteningSuggestions()
      - Current: $180k
      - Test $144k (80%) → testTightenedPropertyValue() → 28 matches
      - Test $126k (70%) → 20 matches
      - Suggestions for both

   d. generateTimelineTighteningSuggestions()
      - No current → test all
      - "immediate" → 15 matches
      - "two_weeks" → 22 matches

   e. generateSkillTighteningSuggestions()
      - Run distribution query → top skills in result set
      - "TypeScript" has 35 of 40 engineers (88%)
      - Test adding → testAddedSkillConstraint() → 35 matches
      - Suggestion: "Add TypeScript as required skill"

4. Sort all suggestions by resultingMatches (ascending)

5. Return top 5:
   - "Filter to immediate availability" (15 matches)
   - "Require senior level" (18 matches)
   - "Lower budget to $126k" (20 matches)
   - "Filter to two_weeks" (22 matches)
   - "Filter to Americas" (25 matches)
```

---

## 7. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Type-safe registry (`Record<TightenableField, ...>`) | Compiler catches missing generators when new fields added |
| Shared `skill-extraction.utils.ts` | Single source of truth, no duplicate extraction logic |
| Two-tier queries (count vs distribution) | Distribution for discovery, count for accurate testing |
| Strictness filtering in each generator | Never suggest redundant or weaker constraints |
| Sequential generator execution | Neo4j serializes queries anyway; clearer code |
| `baselineCount` passed to all generators | Enables percentage calculations without re-querying |

---

## 8. Code References

### Primary Files
- `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts` - Main orchestration and 5 generators
- `recommender_api/src/services/constraint-advisor/tightening-tester.service.ts` - What-if testing functions
- `recommender_api/src/services/constraint-advisor/skill-extraction.utils.ts` - Shared skill extraction
- `recommender_api/src/services/cypher-query-builder/search-query.builder.ts:126-280` - Query builders

### Supporting Files
- `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts` - `buildPropertyConditions()`
- `recommender_api/src/services/skill-resolution.service.ts` - `groupSkillsByProficiency()`
- `recommender_api/src/types/search.types.ts` - `TighteningSuggestion` union, `SENIORITY_LEVEL_ORDER`, `START_TIMELINE_ORDER`

### Test Files
- `recommender_api/src/services/constraint-advisor/tightening-generator.service.test.ts` (22 tests)
- `recommender_api/src/services/cypher-query-builder/search-query.builder.test.ts` (39 tests)

---

## 9. Learning Exercises

1. **Trace a budget suggestion:** Start at `generateBudgetTighteningSuggestions()`, follow through `testTightenedPropertyValue()`, into `buildSkillFilterCountQuery()`.

2. **Add a new field:** Imagine adding `requiredBusinessDomains` tightening. What would break at compile time? What new generator would you write?

3. **Understand the CASE pattern:** Run the proficiency CASE clause manually with sample data. What happens when an engineer has `proficient` level but the requirement is `expert`?

4. **Compare count vs distribution:** Look at `buildSkillFilterCountQuery()` vs `buildSkillDistributionQuery()`. What's the difference in the Cypher structure after the `WITH e` clause?
