---
date: 2026-01-14T18:30:00+01:00
researcher: Claude
git_commit: bec4c9d
branch: project_2
repository: recommender_system
topic: "Validation of AppliedFilter Discriminated Union Refactoring Plan"
tags: [research, codebase, applied-filter, discriminated-union, refactoring, validation]
status: complete
last_updated: 2026-01-14
last_updated_by: Claude
---

# Research: Validation of AppliedFilter Discriminated Union Refactoring Plan

**Date**: 2026-01-14T18:30:00+01:00
**Researcher**: Claude
**Git Commit**: bec4c9d
**Branch**: project_2
**Repository**: recommender_system

## Research Question

Does the plan at `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-14-applied-filter-discriminated-union-refactoring.md` make sense and are there any issues with the proposed implementation?

## Summary

**Overall Assessment: The plan is sound and well-structured.** The refactoring approach is correct, and the discriminated union pattern aligns with existing codebase patterns (e.g., `RelaxationSuggestion`, `TestableConstraint`). There are a few minor issues:

1. **Line numbers in constraint-expander.service.ts are off by 17-25 lines** (functions exist earlier than documented)
2. **Phase 3 needs additional work** to capture `resolvedPreferredSkills` variable (currently not tracked separately)
3. **Phase 3 orchestration order change** is correctly identified but needs more explicit steps

The plan can proceed with implementation after noting the line number corrections.

## Detailed Findings

### Line Number Verification Summary

| Component | Plan Location | Actual Location | Status |
|-----------|---------------|-----------------|--------|
| **search.types.ts** AppliedFilter | 157-166 | 161-169 | ~4 lines off |
| **constraint-expander** trackSkillsAsConstraints | 431-462 | 431-462 | ✅ Exact |
| **constraint-expander** expandSeniorityToYearsExperience | ~245 | 220-253 | ~25 lines off |
| **constraint-expander** expandStartTimelineConstraint | ~283 | 259-295 | ~24 lines off |
| **constraint-expander** expandTimezoneToPrefixes | ~317 | 297-325 | ~20 lines off |
| **constraint-expander** expandBudgetConstraints | ~354 | 333-367 | ~21 lines off |
| **constraint-expander** expandTeamFocusToAlignedSkills | ~386 | 369-393 | ~17 lines off |
| **constraint-expander** trackPreferredValuesAsPreferences | 474-496 | 465-499 | ~9 lines off |
| **constraint-decomposer** workaround | 175-178 | 175-178 | ✅ Exact |
| **constraint-decomposer** skill loop | 216-228 | 216-228 | ✅ Exact |
| **constraint-advisor** ConstraintAdviceInput | ~28 | 22-29 | ✅ Close |
| **constraint-advisor** formatConflictSets | 107-116 | 107-116 | ✅ Exact |
| **search.service** getConstraintAdvice call | ~167 | 167-174 | ✅ Exact |
| **skill-resolution** return statement | ~135 | 135-143 | ✅ Exact |

### Issue 1: constraint-expander.service.ts Line Numbers

**Impact**: Low - Functions exist at correct relative positions, just shifted earlier in file.

**Root Cause**: The file has more imports and documentation at the top than originally anticipated.

**Resolution**: Use actual line numbers when implementing Phase 2. The code changes proposed in the plan are correct; only the navigation references need adjustment.

### Issue 2: Phase 3 - Capturing resolvedPreferredSkills

**Impact**: Medium - Plan's code snippet is incomplete.

**Current State** (skill-resolution.service.ts lines 111-131):
```typescript
// Preferred skills are resolved inline, only IDs extracted
preferredSkillIds = result.resolvedSkills.map((s) => s.skillId);
```

**What's Missing**: The plan notes "need to capture this" but doesn't provide complete code. The implementation must:
1. Create a local `resolvedPreferredSkills` variable
2. Assign `result.resolvedSkills` to it before extracting IDs
3. Add both arrays to the return object and interface

**Corrected Code for Phase 3**:
```typescript
// In resolveAllSkills function around line 111
let resolvedPreferredSkills: ResolvedSkillWithProficiency[] = [];

if (preferredSkills && preferredSkills.length > 0) {
  const result = await resolveSkillRequirements(
    session,
    preferredSkills,
    defaultProficiency
  );
  resolvedPreferredSkills = result.resolvedSkills;  // Capture this
  preferredSkillIds = resolvedPreferredSkills.map((s) => s.skillId);
  // ... rest unchanged
}

// In return statement
return {
  // ... existing fields
  resolvedRequiredSkills,    // Already exists as local var at line 79
  resolvedPreferredSkills,   // Now captured
};
```

### Issue 3: Phase 3 - Orchestration Order in search.service.ts

**Current Order** (search.service.ts):
1. Line 52: `expandSearchCriteria(request)` - expansion first
2. Lines 63-68: `resolveAllSkills()` - skill resolution second

**Required Order** (for plan to work):
1. Skill resolution first (to get `resolvedRequiredSkills`, `resolvedPreferredSkills`)
2. Expansion second (receives resolved skills as parameters)

**Resolution**: The plan correctly identifies this but should be more explicit. Phase 3 must reorder these calls before updating the `expandSearchCriteria` signature.

### Verified Correct Aspects

1. **Type discriminator naming**: Using `kind` (not `type`) to avoid TypeScript keyword confusion ✅
2. **Import paths**: `ResolvedSkillWithProficiency` is correctly at `skill-resolver.service.ts:29-34` ✅
3. **TestableConstraint structure**: Has `skillIds: string[]` on `SkillTraversalConstraint` for Phase 4 ✅
4. **Workaround exists**: `constraint-decomposer.service.ts:175-178` has the skip logic to remove ✅
5. **Existing patterns**: `RelaxationSuggestion` discriminated union at `search.types.ts:247-305` ✅

## Code References

- `recommender_api/src/types/search.types.ts:161-169` - Current AppliedFilter interface
- `recommender_api/src/types/search.types.ts:171-176` - Current AppliedPreference interface
- `recommender_api/src/services/constraint-expander.service.ts:431-462` - trackSkillsAsConstraints function
- `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts:175-178` - Workaround to remove
- `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts:216-228` - User skill loop to remove
- `recommender_api/src/services/constraint-advisor/constraint.types.ts:47-51` - SkillTraversalConstraint with skillIds
- `recommender_api/src/services/skill-resolver.service.ts:29-34` - ResolvedSkillWithProficiency type
- `recommender_api/src/services/skill-resolution.service.ts:17-30` - SkillResolutionResult interface

## Architecture Insights

The plan follows established codebase patterns for discriminated unions:

1. **Enum discriminators** - Used for `RelaxationSuggestionType` and `ConstraintType`
2. **Type guards** - Helper functions like `isFilterConstraint()` exist in `inference-rule.types.ts`
3. **Union types** - `TestableConstraint = PropertyConstraint | SkillTraversalConstraint` is a direct parallel

The refactoring aligns well with these patterns, making the codebase more consistent.

## Recommendations

1. **Proceed with implementation** - The plan is fundamentally sound
2. **Update line numbers** - Use actual locations when navigating during implementation
3. **Expand Phase 3** - Add explicit code for capturing `resolvedPreferredSkills`
4. **Test incrementally** - Run `npm run typecheck` after each phase before proceeding

## Open Questions

None - all aspects of the plan have been validated against the current codebase state.
