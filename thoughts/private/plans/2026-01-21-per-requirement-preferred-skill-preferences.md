# Per-Requirement Preferred Skill Preferences Implementation Plan

## Overview

Change preferred skills handling to create one `AppliedSkillPreference` per requirement instead of flattening all preferred skills into a single preference. This makes the structure consistent with how required skills are handled (one `AppliedSkillFilter` per requirement).

## Current State Analysis

### How Required Skills Work (the pattern to follow)
Each required skill requirement creates a separate `AppliedSkillFilter`:
```typescript
// constraint-expander.service.ts:504-527
for (const requirement of resolvedRequiredSkillRequirements) {
  const skillFilter: AppliedSkillFilter = {
    type: AppliedFilterType.Skill,
    field: 'requiredSkills',
    operator: 'HAS_ANY',
    skills: [...],  // expanded skills for this requirement
    displayValue: requirement.originalIdentifier,
    source: 'user',
    originalSkillId: requirement.originalSkillId,
  };
  context.filters.push(skillFilter);
}
```

### How Preferred Skills Work (current - flattened)
All preferred skill requirements are merged into ONE `AppliedSkillPreference`:
```typescript
// constraint-expander.service.ts:532-554
if (preferredSkills?.length && resolvedPreferredSkillRequirements.length) {
  const allPreferredSkills: ResolvedSkillConstraint[] = [];
  for (const requirement of resolvedPreferredSkillRequirements) {
    for (const skillId of requirement.expandedSkillIds) {
      allPreferredSkills.push({...});
    }
  }

  const skillPreference: AppliedSkillPreference = {
    type: AppliedPreferenceType.Skill,
    field: 'preferredSkills',
    skills: allPreferredSkills,  // ALL skills from ALL requirements
    displayValue: preferredSkills.map(s => formatSkillSummary(s, false)).join(', '),
    source: 'user',
  };
  context.preferences.push(skillPreference);
}
```

### Downstream Consumers

1. **Utility Calculator** (`search.service.ts:249`)
   - Uses `preferredSkillIds` from `skill-resolution.service.ts` (flat array)
   - NOT affected by this change - it doesn't use `appliedPreferences`

2. **Tradeoff Explanation** (`search-match-explanation.service.ts:123-143`)
   - Extracts `preferredSkillIds` by flattening all skill preferences
   - Extracts `preferredSkillNames` from each preference's `displayValue`
   - With per-requirement preferences, this will naturally give the correct count

3. **API Response** (`SearchFilterResponse.appliedPreferences`)
   - Currently shows one preference with all skills
   - Will show multiple preferences (one per requirement) - more informative

## Desired End State

1. Each preferred skill requirement creates a separate `AppliedSkillPreference`
2. Each preference has:
   - `skills`: The expanded skills for that specific requirement
   - `displayValue`: The original identifier (e.g., "Python" not "Python, Django, Flask")
3. Downstream code derives requirement count from array length
4. Consistent with required skills pattern

### Verification
- All 815 unit tests pass
- E2E tests pass
- API response shows separate preferences for each preferred skill
- Tradeoff explanation correctly shows original skill names

## What We're NOT Doing

- NOT changing the utility calculator - it uses a separate `preferredSkillIds` array
- NOT changing the `AppliedSkillPreference` type definition
- NOT adding any new fields like `preferredSkillGroupCount`

## Implementation Approach

Single-phase change to `constraint-expander.service.ts` and verification in downstream consumers.

## Phase 1: Update Preferred Skills Handling

### Overview
Change `trackSkillsAsConstraints` to create one `AppliedSkillPreference` per requirement.

### Changes Required:

#### 1. constraint-expander.service.ts

**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Lines**: 528-554

**Current code:**
```typescript
/*
 * Preferred skills also use requirements but don't create hard filters.
 * They boost ranking when engineers have matching skills.
 */
if (preferredSkills?.length && resolvedPreferredSkillRequirements.length) {
  // For preferences, we can flatten since it's just for ranking boost
  const allPreferredSkills: ResolvedSkillConstraint[] = [];
  for (const requirement of resolvedPreferredSkillRequirements) {
    for (const skillId of requirement.expandedSkillIds) {
      allPreferredSkills.push({
        skillId,
        skillName: requirement.skillIdToName.get(skillId) ?? skillId,
        minProficiency: requirement.minProficiency,
        preferredMinProficiency: requirement.preferredMinProficiency ?? undefined,
      });
    }
  }

  const skillPreference: AppliedSkillPreference = {
    type: AppliedPreferenceType.Skill,
    field: 'preferredSkills',
    skills: allPreferredSkills,
    displayValue: preferredSkills.map(s => formatSkillSummary(s, false)).join(', '),
    source: 'user',
  };
  context.preferences.push(skillPreference);
}
```

**New code:**
```typescript
/*
 * Each preferred skill requirement becomes a separate preference.
 * This matches required skills pattern and enables accurate requirement counting.
 * Preferences boost ranking when engineers have matching skills.
 */
for (const requirement of resolvedPreferredSkillRequirements) {
  const skills: ResolvedSkillConstraint[] = requirement.expandedSkillIds.map(skillId => ({
    skillId,
    skillName: requirement.skillIdToName.get(skillId) ?? skillId,
    minProficiency: requirement.minProficiency,
    preferredMinProficiency: requirement.preferredMinProficiency ?? undefined,
  }));

  const skillPreference: AppliedSkillPreference = {
    type: AppliedPreferenceType.Skill,
    field: 'preferredSkills',
    skills,
    displayValue: requirement.originalIdentifier,
    source: 'user',
  };
  context.preferences.push(skillPreference);
}
```

**Note**: The `preferredSkills` parameter is no longer needed. We already removed `requiredSkills` - now we can remove `preferredSkills` too since we use `requirement.originalIdentifier` instead of `formatSkillSummary`.

#### 2. Remove preferredSkills parameter from trackSkillsAsConstraints

**File**: `recommender_api/src/services/constraint-expander.service.ts`

Update function signature:
```typescript
function trackSkillsAsConstraints(
  resolvedRequiredSkillRequirements: ResolvedSkillRequirement[],
  resolvedPreferredSkillRequirements: ResolvedSkillRequirement[]
): ExpansionContext {
```

Update call site (~line 164):
```typescript
const skillsContext = trackSkillsAsConstraints(
  resolvedRequiredSkillRequirements,
  resolvedPreferredSkillRequirements
);
```

#### 3. Update test expectations

**File**: `recommender_api/src/services/constraint-expander.service.test.ts`

The test `creates AppliedSkillPreference with resolved preferred skills` needs updating:
- Currently expects one preference with all skills
- Should expect multiple preferences (one per requirement)

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All unit tests pass: `npm test`
- [x] E2E tests pass: `npm run test:e2e`

#### Manual Verification:
- [x] API response `appliedPreferences` shows separate entries for each preferred skill
- [x] Tradeoff explanation correctly identifies missing preferred skills by name

---

## Testing Strategy

### Unit Tests:
- Update `constraint-expander.service.test.ts` to verify:
  - Multiple preferred skills create multiple `AppliedSkillPreference` entries
  - Each preference has the correct `displayValue` (original identifier)
  - Each preference contains only its own expanded skills

### Verification of Downstream Behavior:
- `search-match-explanation.service.ts` already extracts `preferredSkillNames` from each preference's `displayValue`
- With per-requirement preferences, `preferredSkillNames` will naturally be `["Python", "Java"]` instead of `["Python, Java"]`

## References

- Required skills pattern: `constraint-expander.service.ts:504-527`
- Current preferred skills: `constraint-expander.service.ts:528-554`
- Tradeoff explanation consumer: `search-match-explanation.service.ts:123-143`
