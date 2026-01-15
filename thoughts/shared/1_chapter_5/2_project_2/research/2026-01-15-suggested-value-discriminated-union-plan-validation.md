---
date: 2026-01-15T12:00:00+01:00
researcher: Claude
git_commit: bec4c9da4a835087607d50f043e447e6ab47fb74
branch: project_2
repository: recommender_system
topic: "Validation of SuggestedValue Discriminated Union Refactoring Plan"
tags: [research, codebase, plan-validation, types, refactoring]
status: complete
last_updated: 2026-01-15
last_updated_by: Claude
---

# Research: Validation of SuggestedValue Discriminated Union Refactoring Plan

**Date**: 2026-01-15T12:00:00+01:00
**Researcher**: Claude
**Git Commit**: bec4c9da4a835087607d50f043e447e6ab47fb74
**Branch**: project_2
**Repository**: recommender_system

## Research Question

Validate the plan at `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-15-suggested-value-discriminated-union.md` against the codebase to identify any issues, inconsistencies, or missing considerations.

## Summary

The plan is **largely accurate** and well-designed, but has several issues that need addressing:

1. **Breaking API change** - Skill relaxation response format changes from boolean flags to action enum
2. **Test patterns need updating** - Existing tests check for `'remove' in suggestedValue` pattern
3. **Missing `moveToPreferred` test case** - Tests check `remove` but not `moveToPreferred`
4. **LowerProficiency shape change** - Current implementation doesn't use action discriminator for this case
5. **Minor line number inaccuracies** - Some referenced line numbers are approximate

## Detailed Findings

### 1. Current Types in search.types.ts

**Location**: `recommender_api/src/types/search.types.ts`

| Type | Lines | Status |
|------|-------|--------|
| `UserConstraintRelaxation` | 352-360 | Has `suggestedValue: unknown` - matches plan |
| `TighteningSuggestion` | 401-412 | Has `suggestedValue: unknown` - matches plan |
| `BaseRelaxationSuggestion` | 341-346 | Private interface, uses `resultingMatches` |
| `RelaxationSuggestionType` | 331-336 | Two values: `UserConstraint`, `DerivedOverride` |

**Plan Accuracy**: Plan correctly describes current state.

### 2. Relaxation Generator - Current Patterns

**Location**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`

| Function | Lines | suggestedValue Type |
|----------|-------|---------------------|
| `applyNumericStepStrategy` | 115-157 | `number` |
| `applyEnumExpandStrategy` | 159-200 | `string[]` |
| `applyRemoveStrategy` | 202-234 | `null` |
| `applyDerivedOverrideStrategy` | 236-277 | N/A (uses `ruleId`) |
| `applySkillRelaxationStrategy` | 283-370 | Object (3 variants) |

**Skill Relaxation Patterns (Current)**:
- **Lower proficiency** (line 321): `{ ...skillReq, minProficiency: lowerProficiency }` - NO action property
- **Move to preferred** (line 347): `{ moveToPreferred: true, skill: skillName }` - boolean flag
- **Remove skill** (line 363): `{ remove: true, skill: skillName }` - boolean flag

### 3. Issue: Breaking API Change for Skill Relaxations

**Severity**: HIGH

The plan proposes changing skill relaxation `suggestedValue` shapes:

| Action | Current | Proposed |
|--------|---------|----------|
| Lower proficiency | `{ skill, minProficiency }` | `{ action: 'lowerProficiency', skill, minProficiency }` |
| Move to preferred | `{ moveToPreferred: true, skill }` | `{ action: 'moveToPreferred', skill }` |
| Remove | `{ remove: true, skill }` | `{ action: 'remove', skill }` |

This is a **breaking API change**. The plan acknowledges this in the "Migration Notes" section (lines 706-746), but:
- No version bump mentioned
- No client communication strategy
- Consider whether API versioning is needed

**Recommendation**: Add explicit breaking change handling - either version the API or ensure all clients are updated simultaneously.

### 4. Issue: Test Patterns Need Updating

**Severity**: MEDIUM

**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.test.ts`

**Line 540**: Tests check for removal pattern using property existence:
```typescript
const removeSuggestion = suggestions.find(
  (s): s is UserConstraintRelaxation =>
    s.type === RelaxationSuggestionType.UserConstraint &&
    s.suggestedValue !== null &&
    typeof s.suggestedValue === 'object' &&
    'remove' in s.suggestedValue  // ← This pattern will break
);
```

After refactoring, this should become:
```typescript
s.suggestedValue.action === SkillRelaxationAction.Remove
```

**Recommendation**: Plan Phase 4 mentions updating tests but should include the specific pattern change from `'remove' in s.suggestedValue` to `action === 'remove'`.

### 5. Issue: Missing moveToPreferred Test Assertion

**Severity**: LOW

The test file has explicit assertions for:
- Lower proficiency (`minProficiency` property check at line 484-488)
- Remove skill (`'remove' in s.suggestedValue` check at line 540)

But **no explicit test** for `moveToPreferred` pattern. The test may pass implicitly, but explicit coverage is missing.

**Recommendation**: Add explicit test case for `moveToPreferred` action in the plan's Phase 4.

### 6. Issue: LowerProficiency Currently Has No Action Discriminator

**Severity**: LOW (Plan handles this)

Current implementation (line 321):
```typescript
suggestedValue: { ...skillReq, minProficiency: lowerProficiency }
// Produces: { skill: string, minProficiency: string }
```

Plan proposes adding `action: SkillRelaxationAction.LowerProficiency`. This is a good change for consistency, but tests that check `'minProficiency' in s.suggestedValue` (line 484) may need adjustment since ALL skill relaxation types will have the `action` property as the primary discriminator.

### 7. Relaxation Strategies Config - yearsExperience EXISTS

**Location**: `recommender_api/src/config/knowledge-base/relaxation-strategies.config.ts`

**Lines 110-115**: `yearsExperience` is configured with NumericStep strategy:
```typescript
yearsExperience: {
  type: RelaxationStrategyType.NumericStep,
  stepsDown: [0.7, 0.5],
  stepsUp: [1.3, 1.5],
  rationaleTemplate: "{direction} experience from {current} to {suggested} years",
}
```

**Plan Accuracy**: Plan correctly identifies this needs removal (Phase 2, item 6). The field has no corresponding API endpoint.

### 8. Tightening Generator - Current State

**Location**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

| Function | Field | suggestedValue Type |
|----------|-------|---------------------|
| `analyzeTimezoneDistribution` (63-120) | `requiredTimezone` | `string[]` |
| `analyzeExperienceDistribution` (122-180) | `requiredSeniorityLevel` | `string` |
| `analyzeSalaryDistribution` (182-233) | `maxBudget` | `number` |
| `analyzeTimelineDistribution` (235-274) | `requiredMaxStartTime` | `string` |
| `analyzeSkillDistribution` (280-344) | `requiredSkills` | `{ skill, minProficiency }` |

**Plan Accuracy**: Plan correctly states tightening generator "already matches API" - field names align with API schema.

### 9. Minor: Line Number Discrepancies

The plan references some approximate line numbers:
- Plan says RelaxationSuggestionType at "~line 336" → Actually lines 331-336 ✓
- Plan says yearsExperience config removal at lines 512-528 → Actual config at 110-115

These are minor and don't affect implementation.

### 10. EnumExpand Strategy Change - Behavior Modification

**Severity**: MEDIUM

**Current behavior** (lines 159-200): Returns `string[]` with expanded enum values:
```json
{ "field": "requiredMaxStartTime", "suggestedValue": ["immediate", "two_weeks"] }
```

**Proposed behavior**: Multiple suggestions, each with single `string`:
```json
{ "field": "requiredMaxStartTime", "suggestedValue": "two_weeks" }
{ "field": "requiredMaxStartTime", "suggestedValue": "one_month" }
```

This changes the API response structure - clients expecting an array will break.

**Recommendation**: Explicitly document this in migration notes. Consider whether this should be a separate suggestion or if array format is actually correct for the client's use case.

## Code References

- `recommender_api/src/types/search.types.ts:352-360` - UserConstraintRelaxation interface
- `recommender_api/src/types/search.types.ts:401-412` - TighteningSuggestion interface
- `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts:317-366` - Skill relaxation logic
- `recommender_api/src/services/constraint-advisor/relaxation-generator.service.test.ts:540` - Remove pattern test
- `recommender_api/src/config/knowledge-base/relaxation-strategies.config.ts:110-115` - yearsExperience config

## Architecture Insights

The plan's approach of using discriminated unions based on `field` is sound and aligns with TypeScript best practices. Key benefits:
1. Compile-time type checking for suggestion consumers
2. Eliminates need for type assertions/casts
3. Makes API contract explicit

The decision to use `action` enum for skill relaxations (instead of boolean flags) is cleaner and more extensible.

## Recommendations Summary

| Issue | Severity | Recommendation |
|-------|----------|----------------|
| Breaking API change | HIGH | Add versioning strategy or client coordination plan |
| Test pattern update | MEDIUM | Document specific pattern change from `'remove' in x` to `action === 'remove'` |
| Missing moveToPreferred test | LOW | Add explicit test case in Phase 4 |
| EnumExpand behavior change | MEDIUM | Document array→single value change in migration notes |

## Open Questions

1. **Client impact**: Are there any clients currently consuming the API that would break?
2. **API versioning**: Should this be a v2 API endpoint or can all clients be updated?
3. **EnumExpand semantics**: Is returning multiple single-value suggestions better than one array suggestion for the client UX?

## Conclusion

The plan is well-structured and addresses the core type safety issues. The main concerns are around breaking changes to the API response format, particularly for skill relaxations and enum expansion. Recommend adding explicit breaking change documentation and ensuring test coverage for the `moveToPreferred` action.
