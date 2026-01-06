# Unified Skill Matching Score

## Overview

Consolidate two separate proficiency-related scoring mechanisms into a single unified skill match score. Currently, the utility calculator has:
1. **`calculateSkillMatchUtility`** - coverage ratio + generic proficiency bonus (expert=+0.1, proficient=+0.05)
2. **`calculatePreferredSkillProficiencyMatch`** - graduated linear scoring comparing actual vs preferred proficiency

The generic proficiency bonus is unprincipled—it rewards higher proficiency even when the user didn't ask for it. If you search for "React at learning" and find an expert, there's no reason to give bonus points.

## Current State Analysis

### Two Scoring Mechanisms

**1. Skill Match Utility** (`utility-calculator.service.ts:782-807`)
```typescript
function calculateSkillMatchUtility(
  matchedSkills: MatchedSkill[],
  requestedSkillIds: string[]
): number {
  if (requestedSkillIds.length === 0) return 0.5;

  // Coverage: what fraction of requested skills does the engineer have?
  const coverageRatio = Math.min(matchedSkills.length / requestedSkillIds.length, 1);

  // Generic bonus: rewards higher proficiency regardless of what was requested
  const proficiencyBonus = matchedSkills.reduce((sum, skill) => {
    const bonus = skill.proficiencyLevel === 'expert' ? 0.1
                : skill.proficiencyLevel === 'proficient' ? 0.05
                : 0;
    return sum + bonus;
  }, 0) / Math.max(matchedSkills.length, 1);

  return Math.min(coverageRatio + proficiencyBonus, 1);
}
```

**2. Preferred Skill Proficiency Match** (`utility-calculator.service.ts:414-451`)
```typescript
function calculatePreferredSkillProficiencyMatch(
  matchedSkills: MatchedSkill[],
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>,
  maxMatch: number
): PreferredSkillProficiencyMatchResult {
  // Graduated scoring: (actual + 1) / (preferred + 1)
  // Only scores skills that have a preferred proficiency specified
}
```

### Data Flow

In `search.service.ts:230-255`:
```typescript
// Combines all skill IDs regardless of proficiency bucket
const allRequestedSkillIds = [
  ...skillGroups.learningLevelSkillIds,
  ...skillGroups.proficientLevelSkillIds,
  ...skillGroups.expertLevelSkillIds,
];

const utilityContext: UtilityContext = {
  requestedSkillIds: allRequestedSkillIds,  // Flat array for coverage
  // ...
  skillIdToPreferredProficiency,  // Map for graduated scoring
};
```

### Score Breakdown Structure

Currently in `search.types.ts`:
- `CoreScores.skillMatch` - from `calculateSkillMatchUtility`
- `PreferenceMatches.preferredSkillProficiencyMatch` - from `calculatePreferredSkillProficiencyMatch`

## Desired End State

### Single Unified Score

Replace both scoring mechanisms with one unified function that:
1. For each requested skill, calculates a per-skill score based on whether the engineer has it and at what level
2. If the skill has a preferred proficiency: use graduated formula `(actual + 1) / (preferred + 1)`
3. If NO preferred proficiency specified: give full credit (1.0) for having it at any level
4. Average across all requested skills

```typescript
function calculateSkillMatch(
  matchedSkills: MatchedSkill[],
  requestedSkillIds: string[],
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>
): SkillMatchResult {
  if (requestedSkillIds.length === 0) {
    return { score: 0.5, skillsExceedingPreferred: [] };
  }

  const proficiencyOrder: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];
  const matchedSkillIds = new Set(matchedSkills.map(s => s.skillId));
  const skillsExceedingPreferred: string[] = [];
  let totalCredit = 0;

  for (const skillId of requestedSkillIds) {
    const matchedSkill = matchedSkills.find(s => s.skillId === skillId);

    if (!matchedSkill) {
      // Skill not matched - zero credit
      continue;
    }

    const preferredLevel = skillIdToPreferredProficiency.get(skillId);

    if (preferredLevel) {
      // Has preferred proficiency: use graduated scoring
      const preferredIndex = proficiencyOrder.indexOf(preferredLevel);
      const actualIndex = proficiencyOrder.indexOf(matchedSkill.proficiencyLevel as ProficiencyLevel);
      const credit = Math.min(1.0, (actualIndex + 1) / (preferredIndex + 1));
      totalCredit += credit;

      if (actualIndex >= preferredIndex) {
        skillsExceedingPreferred.push(matchedSkill.skillName);
      }
    } else {
      // No preferred proficiency: full credit for having the skill
      totalCredit += 1.0;
    }
  }

  // Average credit across all requested skills
  const score = totalCredit / requestedSkillIds.length;

  return { score, skillsExceedingPreferred };
}
```

### Score Table (when preference specified)

| Preferred | learning | proficient | expert |
|-----------|----------|------------|--------|
| expert    | 0.33     | 0.67       | 1.0    |
| proficient| 0.50     | 1.0        | 1.0    |
| learning  | 1.0      | 1.0        | 1.0    |

### Score When No Preference Specified

Full credit (1.0) for having the skill at any level that passes the hard filter.

## What We're NOT Doing

- **Not changing hard filters**: Required minimum proficiency remains a Cypher WHERE clause
- **Not changing the weight configuration**: The unified score uses the same weight slot

## Implementation Approach

Single-phase change that updates the scoring logic. This removes `preferredSkillProficiencyMatch` from the API response since its functionality is now absorbed into `skillMatch`.

## Phase 1: Unify Skill Match Scoring

### Overview

Replace the two separate scoring functions with one unified function. Update the score breakdown to populate both fields from the same calculation.

### Changes Required

#### 1. Add New Unified Function
**File**: `recommender_api/src/services/utility-calculator.service.ts`

Add new function after the existing `calculatePreferredSkillProficiencyMatch`:

```typescript
interface SkillMatchResult {
  /** Normalized score 0-1 representing skill coverage + proficiency match */
  score: number;
  /** Skills that meet or exceed preferred proficiency (for display) */
  skillsExceedingPreferred: string[];
}

/**
 * Unified skill match scoring that combines coverage and proficiency matching.
 *
 * For each requested skill:
 * - If engineer doesn't have it: 0 credit
 * - If engineer has it with no preferred proficiency: 1.0 credit (full)
 * - If engineer has it with preferred proficiency: graduated credit (actual+1)/(preferred+1)
 *
 * Final score = average credit across all requested skills.
 *
 * This replaces the previous two-mechanism approach:
 * 1. Old skillMatch: coverage ratio + generic proficiency bonus (unprincipled)
 * 2. Old preferredSkillProficiencyMatch: graduated scoring but separate weight
 */
function calculateSkillMatch(
  matchedSkills: MatchedSkill[],
  requestedSkillIds: string[],
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>
): SkillMatchResult {
  if (requestedSkillIds.length === 0) {
    return { score: 0.5, skillsExceedingPreferred: [] };
  }

  const proficiencyOrder: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];
  const skillsExceedingPreferred: string[] = [];
  let totalCredit = 0;

  // Build a map for O(1) lookup
  const matchedSkillMap = new Map(matchedSkills.map(s => [s.skillId, s]));

  for (const skillId of requestedSkillIds) {
    const matchedSkill = matchedSkillMap.get(skillId);

    if (!matchedSkill) {
      // Skill not matched - zero credit (already filtered by Cypher, but handle edge cases)
      continue;
    }

    const preferredLevel = skillIdToPreferredProficiency.get(skillId);

    if (preferredLevel) {
      // Has preferred proficiency: use graduated linear scoring
      const preferredIndex = proficiencyOrder.indexOf(preferredLevel);
      const actualIndex = proficiencyOrder.indexOf(matchedSkill.proficiencyLevel as ProficiencyLevel);
      const credit = Math.min(1.0, (actualIndex + 1) / (preferredIndex + 1));
      totalCredit += credit;

      // Track for display
      if (actualIndex >= preferredIndex) {
        skillsExceedingPreferred.push(matchedSkill.skillName);
      }
    } else {
      // No preferred proficiency specified: full credit for having the skill
      totalCredit += 1.0;
    }
  }

  const score = totalCredit / requestedSkillIds.length;

  return { score, skillsExceedingPreferred };
}
```

#### 2. Update calculateUtilityWithBreakdown
**File**: `recommender_api/src/services/utility-calculator.service.ts`
**Location**: `calculateUtilityWithBreakdown` function (~line 460)

Replace the separate skill match and preferred proficiency calculations with the unified call:

```typescript
// OLD:
const skillMatchRaw = calculateSkillMatchUtility(
  engineer.matchedSkills,
  context.requestedSkillIds
);
// ... later ...
const preferredSkillProficiencyResult = calculatePreferredSkillProficiencyMatch(
  engineer.matchedSkills,
  context.skillIdToPreferredProficiency,
  params.preferredSkillProficiencyMatchMax
);

// NEW:
const skillMatchResult = calculateSkillMatch(
  engineer.matchedSkills,
  context.requestedSkillIds,
  context.skillIdToPreferredProficiency
);
const skillMatchRaw = skillMatchResult.score;
```

Update the score breakdown to remove the separate `preferredSkillProficiencyMatch`:

```typescript
// Remove preferredSkillProficiencyMatch from preferenceMatches
// The skillsExceedingPreferred info can be included in a different way if needed
```

#### 3. Update calculateUtilitySimple
**File**: `recommender_api/src/services/utility-calculator.service.ts`
**Location**: `calculateUtilitySimple` function (~line 660)

Apply the same change to the simple utility calculation.

#### 4. Remove Old Functions
**File**: `recommender_api/src/services/utility-calculator.service.ts`

Remove:
- `calculateSkillMatchUtility` (lines 782-807)
- `calculatePreferredSkillProficiencyMatch` (lines 414-451) - or keep as internal helper if the display data is still needed

#### 5. Remove preferredSkillProficiencyMatch from Types
**File**: `recommender_api/src/types/search.types.ts`

Remove `preferredSkillProficiencyMatch` from `PreferenceMatches` since its functionality is now absorbed into `skillMatch`:

```typescript
// Remove this interface:
export interface PreferredSkillProficiencyMatch {
  score: number;
  skillsExceedingPreferred: string[];
}

// Update PreferenceMatches to remove the field:
export interface PreferenceMatches {
  preferredSkillsMatch?: PreferredSkillsMatch;
  teamFocusMatch?: TeamFocusMatch;
  relatedSkillsMatch?: RelatedSkillsMatch;
  preferredBusinessDomainMatch?: PreferredBusinessDomainMatch;
  preferredTechnicalDomainMatch?: PreferredTechnicalDomainMatch;
  startTimelineMatch?: StartTimelineMatch;
  preferredTimezoneMatch?: PreferredTimezoneMatch;
  preferredSeniorityMatch?: PreferredSeniorityMatch;
  preferredSalaryRangeMatch?: PreferredSalaryRangeMatch;
  // REMOVED: preferredSkillProficiencyMatch - now part of skillMatch
}
```

#### 6. Update search.service.ts Comment
**File**: `recommender_api/src/services/search.service.ts`
**Location**: Lines 230-234

```typescript
// OLD:
// Step 6: Calculate utility scores and rank
// Combine all required skill IDs into a single array for utility scoring.
// The utility calculator needs this to measure how well each engineer matches
// the search request—it doesn't care about proficiency buckets, just whether
// the engineer has skills the user asked for.

// NEW:
// Step 6: Calculate utility scores and rank
// Combine all required skill IDs for unified skill matching.
// The utility calculator scores each skill based on:
// - Whether the engineer has it (coverage)
// - How well they meet the preferred proficiency (if specified)
```

#### 7. Update Config Weights
**File**: `recommender_api/src/config/knowledge-base.config.ts`

Check if `preferredSkillProficiencyMatchMax` weight should be redistributed to `skillMatch` or removed.

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `cd recommender_api && npx tsc --noEmit`
- [x] Newman API tests pass: `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json`

#### Manual Verification:
- [x] Search with no preferred proficiency: engineers scored by coverage only
- [x] Search with preferred proficiency "expert": proficient engineers score ~67%, learning ~33%
- [x] Verify score breakdown no longer shows `preferredSkillProficiencyMatch` field
- [x] Overall ranking still makes sense for typical searches

## Testing Strategy

### Test Cases

1. **No skills requested**: Score should be 0.5 (neutral)
2. **Skills with no preferred proficiency**: Full credit for having skill at any level
3. **Skills with preferred proficiency**:
   - Expert preferred, expert actual → 1.0
   - Expert preferred, proficient actual → 0.67
   - Expert preferred, learning actual → 0.33
4. **Mixed skills**: Average across all (some with preference, some without)

### Manual Testing Steps

1. Search for engineers with `requiredSkills: [{skill: "TypeScript", minProficiency: "learning"}]` (no preference)
2. Verify all matching engineers get same `skillMatch` score regardless of proficiency
3. Search with `requiredSkills: [{skill: "TypeScript", minProficiency: "learning", preferredMinProficiency: "expert"}]`
4. Verify experts score higher than proficient who score higher than learning

## Performance Considerations

None. The change adds one Map lookup per skill, which is O(1).

## References

- Graduated proficiency scoring plan: `thoughts/shared/1_chapter_5/1_project_1/plans/2026-01-02-graduated-proficiency-scoring.md`
- Current utility calculator: `recommender_api/src/services/utility-calculator.service.ts`
- Current search service: `recommender_api/src/services/search.service.ts`
