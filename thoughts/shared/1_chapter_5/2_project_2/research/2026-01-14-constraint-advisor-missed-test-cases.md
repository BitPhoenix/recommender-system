---
date: 2026-01-14T00:00:00Z
researcher: Claude
git_commit: bec4c9da4a835087607d50f043e447e6ab47fb74
branch: project_2
repository: recommender_system
topic: "Constraint Advisor - Missed Test Cases Analysis"
tags: [research, testing, constraint-advisor, gaps]
status: complete
last_updated: 2026-01-14
last_updated_by: Claude
---

# Research: Constraint Advisor - Missed Test Cases Analysis

**Date**: 2026-01-14
**Researcher**: Claude
**Git Commit**: bec4c9da4a835087607d50f043e447e6ab47fb74
**Branch**: project_2
**Repository**: recommender_system

## Research Question

Compare the current constraint-advisor implementation against the plan at `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-10-project-2-constraint-advisor.md` and identify any missed test cases that should be added.

## Summary

The constraint-advisor implementation is **nearly complete**, but several test gaps were identified:

1. **Critical Gap**: The entire `tightening-generator.service.test.ts` file is missing (Phase 5)
2. **E2E Gaps**: 2 of 5 planned Postman test scenarios are not implemented
3. **Additional test cases** should be added for edge cases and error scenarios

## Current Test Coverage

### Unit Tests (4 files, 51 test cases)

| Test File | Test Count | Status |
|-----------|------------|--------|
| `constraint-decomposer.service.test.ts` | 14 | Complete |
| `quickxplain.service.test.ts` | 9 | Complete |
| `relaxation-generator.service.test.ts` | 8 | Complete |
| `constraint-advisor.service.test.ts` | 11 | Complete |
| `tightening-generator.service.test.ts` | 0 | **MISSING** |

### E2E Tests (Postman Collection)

| Planned Scenario | Status | Test # |
|-----------------|--------|--------|
| Many Results - Tightening Suggestions | Implemented | #58 |
| Goldilocks Zone - No Advice Needed | Implemented | #59 |
| Sparse Results - Relaxation Suggestions | Implemented | #60 |
| Empty Results - Conflicting Constraints | **NOT IMPLEMENTED** | - |
| Derived Constraint Conflict | **NOT IMPLEMENTED** | - |

## Detailed Findings

### 1. Missing Test File: tightening-generator.service.test.ts

**Severity**: High

The plan (Phase 5) explicitly requires:
> Success Criteria:
> - [x] Tightening tests pass: `npm test -- src/services/constraint-advisor/tightening`

However, no test file exists for `tightening-generator.service.ts`. The following tests should be added:

```typescript
// tightening-generator.service.test.ts

describe("generateTighteningSuggestions", () => {
  // Basic functionality
  it("generates timezone distribution suggestions");
  it("generates experience level distribution suggestions");
  it("generates salary bucket distribution suggestions");
  it("generates timeline distribution suggestions");
  it("generates skill distribution suggestions");

  // Filtering logic
  it("excludes already-constrained fields from suggestions");
  it("excludes suggestions that match 100% of results");
  it("only suggests skills with >= 20% coverage");

  // Sorting and limits
  it("sorts suggestions by effectiveness (fewest resulting matches first)");
  it("respects maxSuggestions limit (default 5)");

  // Edge cases
  it("returns empty array when all fields are constrained");
  it("handles empty result set gracefully");
  it("handles missing timezone values");
});

describe("analyzeTimezoneDistribution", () => {
  it("groups engineers by region (Americas, Europe, APAC)");
  it("maps regions to timezone prefixes correctly");
  it("calculates percentages correctly");
});

describe("analyzeExperienceDistribution", () => {
  it("categorizes by seniority level (junior, mid, senior, staff+)");
  it("maps seniority levels to experience requirements");
  it("excludes junior level from suggestions");
});

describe("analyzeSalaryDistribution", () => {
  it("buckets salaries at 100k, 150k, 200k, 250k thresholds");
  it("calculates cumulative counts");
  it("formats currency in rationale");
});

describe("analyzeTimelineDistribution", () => {
  it("suggests immediate availability when it filters effectively");
});

describe("analyzeSkillDistribution", () => {
  it("finds top 10 skills in result set");
  it("only suggests skills with >= 20% coverage");
  it("suggests 'familiar' as default proficiency");
});
```

### 2. Missing E2E Test Scenarios

**Scenario: Empty Results - Conflicting Constraints**

```json
// Test Request
{
  "requiredSeniorityLevel": "principal",
  "maxBudget": 80000,
  "requiredTimezone": ["Asia/*"]
}

// Expected Assertions
- Status code is 200
- totalCount is 0
- Response has `relaxation` field
- relaxation.conflictAnalysis.conflictSets is non-empty
- relaxation.conflictAnalysis.conflictSets[0].constraints.length >= 2
- relaxation.suggestions is non-empty array
```

**Scenario: Derived Constraint Conflict**

```json
// Test Request
{
  "teamFocus": "scaling",
  "requiredTimezone": ["Asia/*"]
}

// Expected Assertions
- Status code is 200
- Response has `relaxation` field if totalCount < 3
- relaxation.suggestions should include item with ruleIdToOverride
- ruleIdToOverride should be "scaling-requires-distributed"
```

### 3. Additional Unit Test Cases Needed

#### constraint-decomposer.service.test.ts

| Test Case | Description |
|-----------|-------------|
| Empty appliedFilters | `decomposeConstraints([], [])` should return empty constraints array |
| Null/undefined values | Handle filters with null or undefined values gracefully |
| Multiple derived constraints same rule | Handle duplicate rule IDs |
| Partial override | Constraints with `overrideScope: "PARTIAL"` should still be included |

#### quickxplain.service.test.ts

| Test Case | Description |
|-----------|-------------|
| Large constraint set (10+) | Verify algorithm performance with many constraints |
| All constraints conflict | Every constraint conflicts with every other |
| Nested conflict sets | MCS within MCS scenarios |
| Query failure handling | Session.run throws error |

#### relaxation-generator.service.test.ts

| Test Case | Description |
|-----------|-------------|
| Skill proficiency lowering | expert -> proficient -> familiar chain |
| Already lowest proficiency | Familiar skill has no lower proficiency suggestion |
| Multiple skills in conflict | Generate suggestions for each skill |
| Move skill to preferred | Verify suggestedValue format |
| Empty conflict set | Handle empty array input |
| Numeric boundary cases | Value at 0, negative multiplier results |

#### constraint-advisor.service.test.ts

| Test Case | Description |
|-----------|-------------|
| Exactly 2 results | Lower boundary - should trigger relaxation |
| Exactly 3 results | Lower boundary - should NOT trigger relaxation |
| Exactly 24 results | Upper boundary - should NOT trigger tightening |
| Exactly 25 results | Upper boundary - should trigger tightening |
| Session error handling | Neo4j connection failure |
| Timeout handling | Long-running QUICKXPLAIN |

### 4. Integration Test Gaps

The plan mentions integration tests (Phase 8) but the current tests use simple mocks. Consider adding:

| Test Case | Description |
|-----------|-------------|
| Full pipeline with real constraints | End-to-end flow from AppliedFilter to suggestion |
| Constraint chaining | Derived constraint from inference triggers relaxation |
| Multiple conflict sets | Verify up to 3 MCS are found and reported |
| Large result set tightening | Verify distribution analysis with 40+ engineers |

## Code References

- Plan: `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-10-project-2-constraint-advisor.md`
- Constraint Advisor Service: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`
- Tightening Generator (missing tests): `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`
- Existing Tests: `recommender_api/src/services/constraint-advisor/*.test.ts`
- Postman Collection: `postman/collections/search-filter-tests.postman_collection.json`

## Architecture Insights

The constraint-advisor module follows a well-structured architecture:

1. **Main Orchestrator** (`constraint-advisor.service.ts`) - Routes to relaxation or tightening based on result count
2. **Constraint Decomposer** - Converts AppliedFilter to testable constraints
3. **QUICKXPLAIN Algorithm** - Finds minimal conflict sets
4. **Relaxation Generator** - Uses strategy pattern for different field types
5. **Tightening Generator** - Analyzes distribution across 5 dimensions

Testing gaps are primarily in:
- Tightening generator (no tests at all)
- Edge cases and error handling
- E2E scenarios for derived constraint conflicts

## Recommendations

### Priority 1: Add tightening-generator.service.test.ts

This is a critical gap - an entire service has no test coverage. Create the file with ~15-20 test cases covering all 5 distribution analysis functions.

### Priority 2: Add Missing E2E Tests

Add the two missing Postman test scenarios:
1. Empty Results - Conflicting Constraints (explicit 0-result scenario)
2. Derived Constraint Conflict (tests `ruleIdToOverride` functionality)

### Priority 3: Add Edge Case Tests

Enhance existing test files with boundary conditions, error handling, and null/undefined value handling.

## Test Count Summary

| Category | Current | Needed | Gap |
|----------|---------|--------|-----|
| Unit Tests | 51 | ~70 | +19 |
| E2E Tests (constraint-advice) | 3 | 5 | +2 |
| **Total Test Cases** | **54** | **~75** | **+21** |

## Open Questions

1. Should integration tests use a real Neo4j test database or enhanced mocks?
2. What is the expected behavior when QUICKXPLAIN times out?
3. Should there be stress tests for large constraint sets (20+ constraints)?

## Related Research

- `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-10-project-2-implementation-research.md` - Original implementation research
- `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-10-project-2-constraint-advisor.md` - Implementation plan
