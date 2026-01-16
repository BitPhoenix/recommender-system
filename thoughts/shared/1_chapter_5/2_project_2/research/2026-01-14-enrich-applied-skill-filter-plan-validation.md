---
date: 2026-01-14T13:00:00+01:00
researcher: Claude
git_commit: bec4c9da4a835087607d50f043e447e6ab47fb74
branch: project_2
repository: recommender_system
topic: "Validate implementation plan for enriching AppliedSkillFilter for derived constraints"
tags: [research, codebase, constraint-advisor, applied-filter, derived-constraints]
status: complete
last_updated: 2026-01-14
last_updated_by: Claude
---

# Research: Validate Implementation Plan for Enriching AppliedSkillFilter

**Date**: 2026-01-14T13:00:00+01:00
**Researcher**: Claude
**Git Commit**: bec4c9da4a835087607d50f043e447e6ab47fb74
**Branch**: project_2
**Repository**: recommender_system

## Research Question

Validate the implementation plan at `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-14-enrich-applied-skill-filter-for-derived-constraints.md` against the actual codebase to identify any issues, discrepancies, or potential problems.

## Summary

The implementation plan is **well-structured and largely accurate**. The line numbers and current code states match the codebase. However, I found **5 issues** ranging from minor documentation corrections to potential implementation concerns:

1. **Test count discrepancy** (Minor): Plan overstates test count
2. **Skill name placeholder** (Design consideration): Using skillId as skillName
3. **Test removal concern** (Potential gap): Removing tests that validate edge cases
4. **TestableConstraint.value inconsistency** (Low risk): Different value types for user vs derived
5. **Missing skill name resolution step** (UX consideration): Derived filters show IDs not names

## Detailed Findings

### Issue 1: Test Count Discrepancy (Minor)

**Location**: Plan Phase 4, test updates section

**Plan states**:
> "All 16 calls passing `derivedConstraints: []` need parameter removal."

**Actual count**: 11 calls with `derivedConstraints: []` in `constraint-advisor.service.test.ts`

**Impact**: Low - documentation inaccuracy, doesn't affect implementation.

**Recommendation**: Update plan to say "All 11 calls".

---

### Issue 2: Skill Name Placeholder (Design Consideration)

**Location**: Plan Phase 2, line 162

**Plan proposes**:
```typescript
skills: skillIds.map(id => ({ skillId: id, skillName: id })),
```

**Concern**: Using `skillId` as `skillName` creates poor user experience. When displaying applied filters to users, they'll see technical IDs like `skill_distributed` instead of human-readable names like "Distributed Systems".

**Options**:
1. **Accept as-is**: The `displayValue` field is set separately (`Derived: ${derivedConstraint.rule.name}`), so the user-facing display may still be adequate.
2. **Add skill resolution**: Call `resolveSkillId()` to get proper names (adds complexity).
3. **Use rule name as displayValue**: Already proposed in plan - this may be sufficient.

**Recommendation**: Accept as-is. The `displayValue: 'Derived: ${derivedConstraint.rule.name}'` provides meaningful user-facing text. The `skills[].skillName` field is primarily for internal type consistency.

---

### Issue 3: Test Removal Concern (Potential Gap)

**Location**: Plan Phase 3, test restructuring

**Plan proposes removing**:
- `'skips overridden derived constraints'` (lines 154-167)
- `'skips boost-type derived constraints'` (lines 169-181)

**Concern**: These tests validate important edge cases:
- Overridden constraints should not appear
- Boost constraints should not be processed as filters

**Current coverage check**: The constraint-expander.service.test.ts does have override tests (lines 416-450) that verify `isFullyOverridden` behavior.

**Gap**: There's no explicit test for "boost-type constraints don't become skill filters" in constraint-expander. The current constraint-expander creates `AppliedPreferenceKind.Property` for boosts (lines 187-192), not filters, but this isn't explicitly tested.

**Recommendation**:
1. Keep the decomposer test `'skips boost-type derived constraints'` OR
2. Add an explicit test in constraint-expander to verify boost constraints become preferences, not filters

---

### Issue 4: TestableConstraint.value Type Inconsistency (Low Risk)

**Location**: Plan Phase 3, skill filter handling

**User skill filter creates**:
```typescript
value: {
  skill: skill.skillId,
  minProficiency: skill.minProficiency,
}
```

**Derived skill filter creates** (per plan):
```typescript
value: filter.skills.map(s => s.skillId)
```

**Concern**: Different value shapes (object vs array) for same `ConstraintType.SkillTraversal`.

**Analysis**: The `BaseConstraint.value` is typed as `unknown`, so this is type-safe. Downstream code using `value` would need to handle both shapes, but current code primarily uses `skillIds` field for skill traversal constraints, not `value`.

**Impact**: Low - no immediate breakage expected.

**Recommendation**: Document this asymmetry in the type definition or unify the shape. Consider:
```typescript
// For user skills (single skill per constraint)
value: { skillId: string, minProficiency?: string }

// For derived skills (grouped by rule)
value: { skillIds: string[] }
```

---

### Issue 5: API Response Structure (Information)

**Not an issue, but worth noting**: The plan explicitly states:

> "What We're NOT Doing: Changing `derivedConstraints` in the API response (it stays for provenance transparency)"

This is correct. The `SearchFilterResponse.derivedConstraints` provides full provenance information. The change only affects how constraints flow internally through the constraint advisor pipeline.

## Code References

### Verified Line Numbers (All Match)

| File | Plan Lines | Verified |
|------|------------|----------|
| `search.types.ts` | 207-214 | AppliedSkillFilter interface |
| `constraint-expander.service.ts` | 175-194 | Derived filter creation loop |
| `constraint-expander.service.test.ts` | 454-465 | Inference source test |
| `constraint-decomposer.service.ts` | 70-73 | Function signature |
| `constraint-decomposer.service.ts` | 84-101 | Skill filter handling |
| `constraint-decomposer.service.ts` | 215-231 | Derived constraints loop |
| `constraint-decomposer.service.test.ts` | 131-152 | Derived constraints test |
| `constraint-decomposer.service.test.ts` | 154-167 | Override test |
| `constraint-decomposer.service.test.ts` | 169-181 | Boost test |
| `constraint-decomposer.service.test.ts` | 220-255 | Combined filters test |
| `constraint-advisor.service.ts` | 25-32 | Interface |
| `constraint-advisor.service.ts` | 47-48 | Destructuring |
| `constraint-advisor.service.ts` | 52-56 | runRelaxationAnalysis call |
| `constraint-advisor.service.ts` | 70-76 | Function signature |
| `search.service.ts` | 174-180 | getConstraintAdvice call |

### Additional Files Using DerivedConstraint

The plan correctly identifies the core files to modify. Additional files using `DerivedConstraint` that do NOT need changes:

- `rule-engine-adapter.ts` - Creates DerivedConstraint, upstream of changes
- `inference-engine.service.ts` - Accumulates DerivedConstraint, upstream
- `search.service.ts` - Passes to response, downstream (preserved)
- `utility-calculator/types.ts` - Uses in context, unaffected

## Architecture Insights

The plan correctly maintains the key distinction:

- **User skills**: One `TestableConstraint` per skill (independently relaxable)
- **Derived skills**: One `TestableConstraint` per rule (override entire rule)

This distinction is preserved in Phase 3's branching logic:
```typescript
if (filter.ruleId) {
  // Derived: single grouped constraint
} else {
  // User: iterate per skill
}
```

## Recommendations Summary

| Issue | Severity | Action |
|-------|----------|--------|
| Test count discrepancy | Low | Update plan: 16 → 11 |
| Skill name placeholder | Low | Accept as-is (displayValue is adequate) |
| Test removal gap | Medium | Add boost→preference test in constraint-expander OR keep decomposer test |
| Value type inconsistency | Low | Document or accept |
| API response structure | None | Correctly preserved |

## Open Questions

1. Should skill names be resolved for derived filters, or is the rule name in `displayValue` sufficient?
2. Should there be explicit test coverage for "boost constraints don't become filters" in constraint-expander?

## Related Research

- `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-14-enrich-applied-skill-filter-for-derived-constraints.md` - The plan being validated
