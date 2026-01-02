# Graduated Linear Scoring for Preferred Skill Proficiency

## Overview

Change the preferred skill proficiency matching from **binary scoring** (meets/doesn't-meet) to **graduated linear scoring** that gives partial credit when an engineer has the skill but at a lower proficiency level than preferred.

## Current State Analysis

### Current Implementation
**File**: `recommender_api/src/services/utility-calculator.service.ts:399-427`

The current `calculatePreferredSkillProficiencyMatch` function uses binary logic:
- If engineer's proficiency >= preferred proficiency: **full credit (1.0)**
- If engineer's proficiency < preferred proficiency: **zero credit (0.0)**

```typescript
if (actualIndex >= preferredIndex) {
  skillsExceedingPreferred.push(skill.skillName);
}
// ...
const matchRatio = skillsExceedingPreferred.length / skillIdToPreferredProficiency.size;
```

### Problem
When a user prefers "React at expert level":

| Engineer Level | Current Score | Problem |
|----------------|---------------|---------|
| expert         | 100%          | Correct |
| proficient     | 0%            | Same as learning - unfair! |
| learning       | 0%            | Same as proficient |

A proficient engineer is clearly closer to the user's preference than a learning one, but they're scored identically.

## Desired End State

### Graduated Linear Scoring
Use the formula: `score = (actualLevel + 1) / (preferredLevel + 1)`, capped at 1.0

Where: learning=0, proficient=1, expert=2

This produces the following score table:

| Preferred | learning | proficient | expert |
|-----------|----------|------------|--------|
| expert    | 0.33     | 0.67       | 1.0    |
| proficient| 0.50     | 1.0        | 1.0    |
| learning  | 1.0      | 1.0        | 1.0    |

### Why Linear?

The function is **linear** with respect to the actual proficiency level. For a fixed preferred level, each proficiency step adds equal credit:
- Preferred expert: learning(0.33) -> proficient(0.67) -> expert(1.0) - each step adds +0.33

**Alternative approaches considered:**
- **Exponential**: Higher levels worth disproportionately more (expert >> proficient > learning)
- **Logarithmic**: Diminishing returns at higher levels
- **Step function**: Current binary behavior

Linear was chosen because a proficient engineer is genuinely "halfway" between learning and expert in practical value. There's no reason to weight higher levels disproportionately.

### Why the +1 Offset?

The `+1` in the formula `(actual + 1) / (preferred + 1)` serves two purposes:
1. **Avoids division by zero** when preferred = learning (index 0)
2. **Provides a minimum floor** so even learning level gets some credit (0.33 when preferred=expert) for having the skill at all

## What We're NOT Doing

- **Not changing required skill filtering**: Required minimum proficiency remains a hard filter in the Cypher query
- **Not changing the score breakdown structure**: We still track `skillsExceedingPreferred` for display purposes
- **Not changing weights or other utility calculations**: Only the internal scoring logic changes

## Implementation Approach

Single-phase change: Update `calculatePreferredSkillProficiencyMatch` to use graduated scoring while maintaining the same interface.

## Phase 1: Update Scoring Function

### Overview
Replace the binary counting logic with graduated linear credit calculation.

### Changes Required

#### 1. Update calculatePreferredSkillProficiencyMatch
**File**: `recommender_api/src/services/utility-calculator.service.ts`
**Lines**: 394-427

**Current code**:
```typescript
/**
 * Calculates per-skill preferred proficiency match.
 * For each skill with a preferredMinProficiency, checks if engineer exceeds it.
 * Returns normalized score and list of skills exceeding their preferred level.
 */
function calculatePreferredSkillProficiencyMatch(
  matchedSkills: MatchedSkill[],
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>,
  maxMatch: number
): PreferredSkillProficiencyMatchResult {
  if (skillIdToPreferredProficiency.size === 0 || matchedSkills.length === 0) {
    return { raw: 0, skillsExceedingPreferred: [] };
  }

  const proficiencyOrder: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];
  const skillsExceedingPreferred: string[] = [];

  for (const skill of matchedSkills) {
    const preferredLevel = skillIdToPreferredProficiency.get(skill.skillId);
    if (preferredLevel) {
      const preferredIndex = proficiencyOrder.indexOf(preferredLevel);
      const actualIndex = proficiencyOrder.indexOf(skill.proficiencyLevel as ProficiencyLevel);
      if (actualIndex >= preferredIndex) {
        skillsExceedingPreferred.push(skill.skillName);
      }
    }
  }

  // Normalize by how many skills have preferred requirements
  const matchRatio = skillsExceedingPreferred.length / skillIdToPreferredProficiency.size;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return { raw, skillsExceedingPreferred };
}
```

**Replace with**:
```typescript
/**
 * Calculates per-skill preferred proficiency match using graduated linear scoring.
 *
 * Uses a linear credit function: score = (actualLevel + 1) / (preferredLevel + 1)
 * where learning=0, proficient=1, expert=2. This gives partial credit for engineers
 * who have the skill but below the preferred level:
 *
 *   | Preferred | learning | proficient | expert |
 *   |-----------|----------|------------|--------|
 *   | expert    | 0.33     | 0.67       | 1.0    |
 *   | proficient| 0.50     | 1.0        | 1.0    |
 *   | learning  | 1.0      | 1.0        | 1.0    |
 *
 * Rationale: If you prefer "React at expert" but can only find proficient engineers,
 * they should score higher than learning-level engineers. The linear function means
 * each proficiency step adds equal credit (e.g., +0.33 per level when preferred=expert).
 *
 * The +1 offset ensures: (1) no division by zero, (2) minimum floor so even learning
 * level gets some credit for having the skill.
 */
function calculatePreferredSkillProficiencyMatch(
  matchedSkills: MatchedSkill[],
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>,
  maxMatch: number
): PreferredSkillProficiencyMatchResult {
  if (skillIdToPreferredProficiency.size === 0 || matchedSkills.length === 0) {
    return { raw: 0, skillsExceedingPreferred: [] };
  }

  const proficiencyOrder: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];
  const skillsExceedingPreferred: string[] = [];
  let totalCredit = 0;
  let skillsWithPreference = 0;

  for (const skill of matchedSkills) {
    const preferredLevel = skillIdToPreferredProficiency.get(skill.skillId);
    if (preferredLevel) {
      skillsWithPreference++;
      const preferredIndex = proficiencyOrder.indexOf(preferredLevel);
      const actualIndex = proficiencyOrder.indexOf(skill.proficiencyLevel as ProficiencyLevel);

      // Linear credit: (actual + 1) / (preferred + 1), capped at 1.0
      const credit = Math.min(1.0, (actualIndex + 1) / (preferredIndex + 1));
      totalCredit += credit;

      // Track skills that meet or exceed for display purposes
      if (actualIndex >= preferredIndex) {
        skillsExceedingPreferred.push(skill.skillName);
      }
    }
  }

  // Average credit across all skills with preferences
  const avgCredit = skillsWithPreference > 0 ? totalCredit / skillsWithPreference : 0;
  const raw = Math.min(avgCredit * maxMatch, maxMatch);

  return { raw, skillsExceedingPreferred };
}
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `cd recommender_api && npx tsc --noEmit`
- [x] Newman API tests pass: `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json`

#### Manual Verification:
- [x] Search for engineers with `preferredSkills: [{identifier: "React", pref: "expert"}]`
- [x] Verify that engineers with proficient React score higher on `preferredSkillProficiencyMatch` than engineers with learning React
- [x] Verify that engineers with expert React still score highest

### Test Results (2026-01-02)

Tested with `requiredSkills: [{skill: "TypeScript", minProficiency: "learning", preferredMinProficiency: "expert"}]`:

| Engineer | Proficiency Level | Score | Credit |
|----------|------------------|-------|--------|
| Priya Sharma | expert | 0.040 | 100% (1.0 × max) |
| Marcus Chen | proficient | 0.027 | 67% (0.67 × max) |
| Emily Nakamura | proficient | 0.027 | 67% (0.67 × max) |

The formula `(actual + 1) / (preferred + 1)` produces:
- Expert (2) → expert (2): `(2+1)/(2+1) = 1.0` = **100% credit**
- Proficient (1) → expert (2): `(1+1)/(2+1) = 0.67` = **67% credit**
- Learning (0) → expert (2): `(0+1)/(2+1) = 0.33` = **33% credit**

## Testing Strategy

### Unit Tests
The change is internal to the scoring function. Existing API tests should still pass since we're not changing the interface, only the scoring distribution.

### Manual Testing Steps
1. Find or seed engineers with the same skill at different proficiency levels (e.g., React at learning, proficient, expert)
2. Search with `preferredSkills: [{identifier: "React", pref: "expert"}]`
3. Verify score breakdown shows graduated scores:
   - Expert React: `preferredSkillProficiencyMatch` near max
   - Proficient React: ~67% of max
   - Learning React: ~33% of max

## Performance Considerations

None. The change adds one division operation per skill, which is negligible.

## References

- Current implementation: `recommender_api/src/services/utility-calculator.service.ts:399-427`
- Related plan: `thoughts/shared/1_chapter_5/1_project_1/plans/per-skill-proficiency.md`
