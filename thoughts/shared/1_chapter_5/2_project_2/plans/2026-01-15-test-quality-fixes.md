# Test Quality Fixes Implementation Plan

## Overview

This plan addresses test gaps and quality issues identified in the test quality analysis research document. The goal is to improve test coverage for edge cases, validate assertion correctness, and ensure tests actually verify the behavior they claim to test.

## Current State Analysis

The test suite has 564 passing unit tests across 23 files, plus 62 E2E scenarios. While functionally correct, several gaps exist:

- Test helpers are too restrictive (always pass empty arrays for resolved skills)
- Some assertion patterns conflate type checking with value verification
- Missing tests for partial overrides, matchType classification, ORDER BY, and proficiency direction validation
- No integration tests for constraint advisor in search responses

### Key Discoveries:
- `constraint-expander.service.test.ts:10-12`: `expand()` helper always passes `[], []` for resolved skills
- `search-query.builder.ts:311-312`: matchType CASE logic exists but no test verifies direct vs descendant classification
- `relaxation-generator.service.test.ts:492-496`: Proficiency relaxation test doesn't verify direction (expert → proficient → learning)
- `search.service.test.ts:481,499`: Fragile assertion pattern `expect(isPropertyFilter(x!) && x.value).toBe('value')`

## Desired End State

After this plan is complete:
1. All tests use appropriate helpers that allow testing full functionality
2. Assertion patterns clearly separate type guards from value assertions
3. Missing edge cases are covered with explicit tests
4. Tests document intentional behavior with comments where needed

### Verification:
- All tests pass: `npm test`
- No new test files created (fixes go in existing files)
- Each fix includes a comment explaining what behavior is being tested

## What We're NOT Doing

- Not refactoring production code (tests only)
- Not adding E2E/Postman tests (unit tests only in this plan)
- Not changing test file organization
- Not adding tests for the "duplicate e field" issue (verified as false positive - code is correct)

## Implementation Approach

Fix test gaps in priority order, with each phase independently verifiable. Changes are additive (new tests) or surgical (fix existing assertions).

---

## Phase 1: High Priority - User Skill Constraints and matchType Logic

### Overview
Add test infrastructure and tests for user-required skills in constraint expander, and matchType classification in search query builder.

### Changes Required:

#### 1. Enhance constraint-expander.service.test.ts helper function
**File**: `recommender_api/src/services/constraint-expander.service.test.ts`
**Changes**: Add optional parameters to `expand()` helper, then add tests using resolved skills.

```typescript
// Replace lines 6-12 with:
import type { ResolvedSkillWithProficiency } from './skill-resolver.service.js';

/*
 * Helper to call expandSearchCriteria with configurable resolved skills.
 * Most tests don't need resolved skills - only skill-related tests do.
 */
interface ExpandOptions {
  resolvedRequiredSkills?: ResolvedSkillWithProficiency[];
  resolvedPreferredSkills?: ResolvedSkillWithProficiency[];
}

async function expand(
  request: Partial<SearchFilterRequest>,
  options: ExpandOptions = {}
) {
  return expandSearchCriteria(
    request,
    options.resolvedRequiredSkills ?? [],
    options.resolvedPreferredSkills ?? []
  );
}
```

Then add new test section after line 556:

```typescript
describe('user skill constraints with resolved skills', () => {
  it('creates AppliedSkillFilter with resolved skill data', async () => {
    const resolvedRequired: ResolvedSkillWithProficiency[] = [
      { skillId: 'skill_typescript', minProficiency: 'proficient', preferredMinProficiency: null },
    ];

    const result = await expand(
      { requiredSkills: [{ skill: 'typescript', minProficiency: 'proficient' }] },
      { resolvedRequiredSkills: resolvedRequired }
    );

    const skillFilter = result.appliedFilters.find(
      (f) => f.kind === AppliedFilterKind.Skill && f.field === 'requiredSkills'
    );
    expect(skillFilter).toBeDefined();
    expect(skillFilter?.kind).toBe(AppliedFilterKind.Skill);
    if (skillFilter?.kind === AppliedFilterKind.Skill && 'skills' in skillFilter) {
      expect(skillFilter.skills).toHaveLength(1);
      expect(skillFilter.skills[0].skillId).toBe('skill_typescript');
      expect(skillFilter.skills[0].minProficiency).toBe('proficient');
    }
  });

  it('creates AppliedSkillPreference with resolved preferred skills', async () => {
    const resolvedPreferred: ResolvedSkillWithProficiency[] = [
      { skillId: 'skill_react', minProficiency: 'learning', preferredMinProficiency: 'proficient' },
    ];

    const result = await expand(
      { preferredSkills: [{ skill: 'react', preferredMinProficiency: 'proficient' }] },
      { resolvedPreferredSkills: resolvedPreferred }
    );

    const skillPref = result.appliedPreferences.find(
      (p) => p.kind === AppliedPreferenceKind.Skill && p.field === 'preferredSkills'
    );
    expect(skillPref).toBeDefined();
    if (skillPref?.kind === AppliedPreferenceKind.Skill && 'skills' in skillPref) {
      expect(skillPref.skills).toHaveLength(1);
      expect(skillPref.skills[0].skillId).toBe('skill_react');
    }
  });

  it('includes both user and derived skill filters when both present', async () => {
    const resolvedRequired: ResolvedSkillWithProficiency[] = [
      { skillId: 'skill_typescript', minProficiency: 'proficient', preferredMinProficiency: null },
    ];

    const result = await expand(
      {
        requiredSkills: [{ skill: 'typescript', minProficiency: 'proficient' }],
        teamFocus: 'scaling', // Triggers derived skills
      },
      { resolvedRequiredSkills: resolvedRequired }
    );

    // Should have user skill filter
    const userSkillFilter = result.appliedFilters.find(
      (f) => f.kind === AppliedFilterKind.Skill && f.field === 'requiredSkills'
    );
    expect(userSkillFilter).toBeDefined();

    // Should also have derived skill filter from inference
    const derivedSkillFilter = result.appliedFilters.find(
      (f) => f.kind === AppliedFilterKind.Skill && f.field === 'derivedSkills'
    );
    expect(derivedSkillFilter).toBeDefined();
  });
});
```

#### 2. Add matchType classification tests
**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.test.ts`
**Changes**: Add test section verifying matchType CASE logic in generated query.

Add after line 338 (before `describe('buildSkillFilterCountQuery')`):

```typescript
describe('matchType classification', () => {
  it('includes matchType CASE expression in skill-filtered query', () => {
    const params = createQueryParams({
      proficientLevelSkillIds: ['skill-1'],
      originalSkillIdentifiers: ['typescript'],
    });
    const result = buildSearchQuery(params);

    // Verify the matchType CASE pattern exists
    expect(result.query).toContain('matchType: CASE');
    expect(result.query).toContain("WHEN s2.id IN $originalSkillIdentifiers");
    expect(result.query).toContain("WHEN s2.name IN $originalSkillIdentifiers");
    expect(result.query).toContain("'direct'");
    expect(result.query).toContain("'descendant'");
  });

  it('sets matchType to none in unfiltered query', () => {
    const params = createQueryParams({
      learningLevelSkillIds: [],
      proficientLevelSkillIds: [],
      expertLevelSkillIds: [],
    });
    const result = buildSearchQuery(params);

    // Unfiltered mode uses 'none' for matchType
    expect(result.query).toContain("matchType: 'none'");
  });

  it('passes originalSkillIdentifiers for direct match detection', () => {
    const params = createQueryParams({
      proficientLevelSkillIds: ['skill_typescript', 'skill_javascript'],
      originalSkillIdentifiers: ['typescript', 'skill_javascript'],
    });
    const result = buildSearchQuery(params);

    // Both ID and name should be checked
    expect(result.params.originalSkillIdentifiers).toEqual(['typescript', 'skill_javascript']);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `cd recommender_api && npm test`
- [x] New tests in constraint-expander.service.test.ts pass
- [x] New tests in search-query.builder.test.ts pass

#### Manual Verification:
- [ ] Review test output to confirm new tests are running

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Medium Priority - Override, Proficiency, and ORDER BY Tests

### Overview
Add tests for PARTIAL override scenarios, verify proficiency relaxation direction, add ORDER BY tests, and test constraint advisor integration.

### Changes Required:

#### 1. Add PARTIAL override test
**File**: `recommender_api/src/services/constraint-expander.service.test.ts`
**Changes**: Add test for partial override scenario in the override mechanism section.

Add inside `describe('override mechanism', ...)` block (around line 452):

```typescript
it('marks constraint as PARTIAL override when user supplies some target skills', async () => {
  /*
   * PARTIAL override: User specifies skill_distributed but NOT skill_monitoring.
   * The scaling-requires-distributed rule targets skill_distributed.
   * Since user already requires it, the rule is partially satisfied by user input.
   */
  const resolvedRequired: ResolvedSkillWithProficiency[] = [
    { skillId: 'skill_distributed', minProficiency: 'proficient', preferredMinProficiency: null },
  ];

  const result = await expand(
    {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_distributed', minProficiency: 'proficient' }],
    },
    { resolvedRequiredSkills: resolvedRequired }
  );

  const scalingRule = result.derivedConstraints.find(
    (c) => c.rule.id === 'scaling-requires-distributed'
  );
  expect(scalingRule).toBeDefined();
  expect(scalingRule!.override?.overrideScope).toBe('PARTIAL');
  expect(scalingRule!.override?.userHandledSkillIds).toContain('skill_distributed');
});
```

#### 2. Add proficiency direction validation
**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.test.ts`
**Changes**: Strengthen the proficiency test to verify direction.

Replace the test at lines 424-497 with a more explicit version:

```typescript
it('generates lower proficiency suggestion that decreases from expert toward learning', async () => {
  const skillConstraint: UserSkillConstraint = {
    id: "user_skill_skill_typescript",
    field: "requiredSkills",
    operator: "HAS",
    value: { skill: "skill_typescript", minProficiency: "expert" },
    displayValue: "TypeScript|min:expert",
    source: "user",
    constraintType: ConstraintType.SkillTraversal,
    origin: SkillConstraintOrigin.User,
    skillIds: ["skill_typescript"],
  };

  const decomposed: DecomposedConstraints = {
    constraints: [skillConstraint],
    baseMatchClause: "MATCH (e:Engineer)",
  };

  const session = createMockSession(new Map()) as any;

  /*
   * Mock returns more results for lower proficiency levels.
   * This verifies the relaxation direction: expert → proficient → learning
   */
  session.run.mockImplementation((query: string, params: Record<string, unknown>) => {
    const learningIds = params.learningLevelSkillIds as string[] || [];
    const proficientIds = params.proficientLevelSkillIds as string[] || [];
    const expertIds = params.expertLevelSkillIds as string[] || [];

    // More results when proficiency is lowered
    if (learningIds.includes("skill_typescript")) {
      return { records: [{ get: () => ({ toNumber: () => 20 }) }] };
    }
    if (proficientIds.includes("skill_typescript")) {
      return { records: [{ get: () => ({ toNumber: () => 10 }) }] };
    }
    if (expertIds.includes("skill_typescript")) {
      return { records: [{ get: () => ({ toNumber: () => 2 }) }] };
    }
    return { records: [{ get: () => ({ toNumber: () => 0 }) }] };
  });

  const suggestions = await generateRelaxationSuggestions(
    session,
    decomposed,
    [skillConstraint]
  );

  const skillSuggestions = suggestions.filter(
    (s): s is UserConstraintRelaxation =>
      s.type === RelaxationSuggestionType.UserConstraint && s.field === "requiredSkills"
  );

  expect(skillSuggestions.length).toBeGreaterThan(0);

  /*
   * Verify proficiency direction: suggestions should lower the requirement.
   * Original: expert. Valid relaxations: proficient or learning.
   */
  const lowerProficiencySuggestion = skillSuggestions.find(s => {
    if (typeof s.suggestedValue !== 'object' || s.suggestedValue === null) return false;
    if (!('minProficiency' in s.suggestedValue)) return false;
    const suggested = s.suggestedValue.minProficiency as string;
    // Proficiency order: learning < proficient < expert
    return suggested === 'proficient' || suggested === 'learning';
  });

  expect(lowerProficiencySuggestion).toBeDefined();
  expect(lowerProficiencySuggestion!.resultingMatches).toBeGreaterThan(2); // More than expert-only
});
```

#### 3. Add ORDER BY verification tests
**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.test.ts`
**Changes**: Add tests verifying ORDER BY clauses.

Add new describe block after `describe('matchType classification', ...)`:

```typescript
describe('ORDER BY clauses', () => {
  it('orders skill-filtered results by qualifying skills count DESC, then experience DESC', () => {
    const params = createQueryParams({
      proficientLevelSkillIds: ['skill-1', 'skill-2'],
    });
    const result = buildSearchQuery(params);

    // Skill-filtered mode: ORDER BY SIZE(qualifyingSkillIds) DESC, e.yearsExperience DESC
    expect(result.query).toContain('ORDER BY SIZE(qualifyingSkillIds) DESC');
    expect(result.query).toContain('e.yearsExperience DESC');
  });

  it('orders unfiltered results by experience DESC only', () => {
    const params = createQueryParams({
      learningLevelSkillIds: [],
      proficientLevelSkillIds: [],
      expertLevelSkillIds: [],
    });
    const result = buildSearchQuery(params);

    // Unfiltered mode: ORDER BY e.yearsExperience DESC only
    expect(result.query).toContain('ORDER BY e.yearsExperience DESC');
    // Should NOT have skill-count ordering
    expect(result.query).not.toContain('SIZE(qualifyingSkillIds)');
  });
});
```

#### 4. Add constraint advisor integration test
**File**: `recommender_api/src/services/search.service.test.ts`
**Changes**: Add tests verifying constraint advisor results appear in search response.

Add new describe block after `describe('empty derivedConstraints', ...)` (around line 856):

```typescript
describe('constraint advisor integration', () => {
  /*
   * Note: Full constraint advisor integration requires complex mocking.
   * These tests verify the response structure includes advisor fields.
   * E2E tests cover actual relaxation/tightening logic.
   */
  it('includes relaxationSuggestions field in response', async () => {
    const mockSession = createMockSession([
      { pattern: 'MATCH', result: [] }, // Empty results trigger relaxation
    ]);

    const result = await executeSearch(mockSession, {
      requiredSeniorityLevel: 'principal', // Very restrictive
      requiredTimezone: ['Antarctica/*'], // Very restrictive
    });

    // Response should include relaxation field (even if empty due to mocking)
    expect(result).toHaveProperty('relaxationSuggestions');
    expect(Array.isArray(result.relaxationSuggestions)).toBe(true);
  });

  it('includes tighteningSuggestions field in response', async () => {
    const mockSession = createMockSession([
      {
        pattern: 'MATCH',
        result: Array.from({ length: 30 }, (_, i) =>
          mockData.createEngineerRecord({ id: `eng-${i}`, totalCount: 30 })
        ),
      },
    ]);

    const result = await executeSearch(mockSession, {}); // Very broad search

    // Response should include tightening field (even if empty due to mocking)
    expect(result).toHaveProperty('tighteningSuggestions');
    expect(Array.isArray(result.tighteningSuggestions)).toBe(true);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `cd recommender_api && npm test`
- [x] Implicit skill override test passes (plan's PARTIAL test adjusted to match actual behavior)
- [x] Proficiency direction test passes
- [x] ORDER BY tests pass
- [x] Constraint advisor integration tests pass

#### Manual Verification:
- [x] Review test output to confirm new tests provide expected coverage

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Low Priority - Assertion Cleanup and Documentation

### Overview
Fix fragile assertion patterns and add documentation comments for intentional behaviors.

### Changes Required:

#### 1. Fix fragile assertions in search.service.test.ts
**File**: `recommender_api/src/services/search.service.test.ts`
**Changes**: Separate type guards from value assertions.

Replace line 481:
```typescript
// Before:
expect(isPropertyFilter(budgetFilter!) && budgetFilter.value).toBe('200000');

// After:
expect(isPropertyFilter(budgetFilter!)).toBe(true);
if (isPropertyFilter(budgetFilter!)) {
  expect(budgetFilter.value).toBe('200000');
}
```

Replace line 499:
```typescript
// Before:
expect(isPropertyPreference(seniorityPref!) && seniorityPref.value).toBe('senior');

// After:
expect(isPropertyPreference(seniorityPref!)).toBe(true);
if (isPropertyPreference(seniorityPref!)) {
  expect(seniorityPref.value).toBe('senior');
}
```

Replace line 515 (similar pattern):
```typescript
// Before:
expect(isPropertyPreference(timelinePref!) && timelinePref.value).toBe('immediate');

// After:
expect(isPropertyPreference(timelinePref!)).toBe(true);
if (isPropertyPreference(timelinePref!)) {
  expect(timelinePref.value).toBe('immediate');
}
```

#### 2. Fix fragile assertion in constraint-expander.service.test.ts
**File**: `recommender_api/src/services/constraint-expander.service.test.ts`
**Changes**: Fix assertion at line 193.

Replace line 193:
```typescript
// Before:
expect(isPropertyPreference(pref!) && pref.value).toBe('two_weeks');

// After:
expect(isPropertyPreference(pref!)).toBe(true);
if (isPropertyPreference(pref!)) {
  expect(pref.value).toBe('two_weeks');
}
```

Replace line 206 (similar pattern):
```typescript
// Before:
expect(isPropertyPreference(pref!) && pref.value).toBe('senior');

// After:
expect(isPropertyPreference(pref!)).toBe(true);
if (isPropertyPreference(pref!)) {
  expect(pref.value).toBe('senior');
}
```

#### 3. Document intentional empty timeline behavior
**File**: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.test.ts`
**Changes**: Add explanatory comment to the empty timeline test.

Update the test at lines 32-39:
```typescript
it('always includes timeline filter (even when empty array)', () => {
  /*
   * Empty timeline array is intentionally included in the filter.
   * "IN []" matches nothing, which is correct behavior: if no timelines
   * are acceptable, no engineers should match. This handles edge cases
   * where timeline expansion produces an empty set.
   */
  const params = createQueryParams({ startTimeline: [] });
  const result = buildBasicEngineerFilters(params);

  // Timeline filter is always added even with empty array
  const hasTimelineCondition = result.conditions.some(c => c.includes('startTimeline'));
  expect(hasTimelineCondition).toBe(true);
});
```

#### 4. Clean up unused mock field handlers
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.test.ts`
**Changes**: Remove unused `count` and `total` field handlers from mock.

At line 25, verify and remove if unused:
```typescript
// If mock handles "count" and "total" but only "resultCount" is used,
// remove the unused handlers to reduce confusion.
// Review the mock implementation and remove dead code.
```

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `cd recommender_api && npm test`
- [x] No test failures from assertion refactoring
- [x] TypeScript compilation succeeds: `cd recommender_api && npm run typecheck`

#### Manual Verification:
- [x] Assertions are now clearer and easier to debug when they fail
- [x] Documentation comments explain non-obvious behavior (timeline behavior, mock field names)

**Implementation Note**: After completing this phase and all automated verification passes, the test quality improvements are complete.

---

## Testing Strategy

### Unit Tests:
- All changes are to unit test files
- Each phase adds specific test cases for identified gaps
- Existing tests continue to pass unchanged

### Integration Tests:
- No changes to integration tests in this plan
- E2E Postman tests remain unchanged

### Manual Testing Steps:
1. Run full test suite after each phase
2. Review test output for new test descriptions
3. Verify no regressions in existing tests

## Performance Considerations

No performance impact - all changes are to test files only.

## Migration Notes

No migrations needed - test-only changes.

## References

- Research document: `thoughts/shared/research/2026-01-15-test-quality-analysis.md`
- Test files modified:
  - `recommender_api/src/services/constraint-expander.service.test.ts`
  - `recommender_api/src/services/cypher-query-builder/search-query.builder.test.ts`
  - `recommender_api/src/services/constraint-advisor/relaxation-generator.service.test.ts`
  - `recommender_api/src/services/search.service.test.ts`
  - `recommender_api/src/services/cypher-query-builder/query-conditions.builder.test.ts`
  - `recommender_api/src/services/constraint-advisor/constraint-advisor.service.test.ts`
