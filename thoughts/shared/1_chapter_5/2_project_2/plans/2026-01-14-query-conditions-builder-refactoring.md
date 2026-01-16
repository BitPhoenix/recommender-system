# Query Conditions Builder Refactoring Plan

## Overview

Refactor `query-conditions.builder.ts` to use the shared `buildCypherFragment()` utility from `cypher-fragment.builder.ts`, eliminating duplicated Cypher generation logic and establishing a single source of truth for WHERE clause construction.

## Current State Analysis

**Duplication exists between two files:**

1. `recommender_api/src/utils/cypher-fragment.builder.ts` - Shared utility (already used by constraint-advisor)
2. `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts` - Manually constructs identical Cypher patterns

**Current manual construction in query-conditions.builder.ts:**
- Line 43: `"e.startTimeline IN $startTimeline"`
- Line 56: `"e.yearsExperience >= $minYearsExperience"`
- Line 61: `"e.yearsExperience < $maxYearsExperience"`
- Line 73: `` `e.timezone STARTS WITH $tz${i}` ``
- Line 96: `"e.salary <= $budgetCeiling"`

**The shared utility already produces identical output:**
```typescript
buildCypherFragment("startTimeline", "IN", value, "startTimeline")
// Returns: { clause: "e.startTimeline IN $startTimeline", paramName: "startTimeline", paramValue: value }
```

## Desired End State

After this plan is complete:

1. All 4 filter functions in `query-conditions.builder.ts` use `buildCypherFragment()` instead of inline strings
2. All 21 existing tests continue to pass without modification
3. The public API (`buildBasicEngineerFilters`) remains unchanged
4. Single source of truth for Cypher WHERE clause generation

**Verification:**
```bash
npm run typecheck                  # Types compile
npm test -- src/services/cypher-query-builder/query-conditions.builder  # Unit tests pass
npm test                           # All tests pass
```

## What We're NOT Doing

- **Changing the public API** - `buildBasicEngineerFilters()` signature and return type stay the same
- **Modifying tests** - Tests verify behavior, not implementation; they should pass as-is
- **Changing the CypherFragment interface** - It already supports all needed operators
- **Refactoring other query builders** - Only `query-conditions.builder.ts` is in scope

---

## Phase 1: Add Import and Refactor Simple Filters

### Overview

Add the import statement and refactor the two simplest filters: `buildTimelineFilter()` and `buildBudgetFilter()`. These have straightforward 1:1 mappings to `buildCypherFragment()`.

### Changes Required:

#### 1. Add Import Statement

**File**: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts`
**Location**: After line 11 (after existing imports)

```typescript
import { buildCypherFragment } from "../../utils/cypher-fragment.builder.js";
```

#### 2. Refactor buildTimelineFilter

**File**: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts`
**Replace**: Lines 41-46

**Before:**
```typescript
function buildTimelineFilter(startTimeline: StartTimeline[]): FilterParts {
  return {
    conditions: ["e.startTimeline IN $startTimeline"],
    queryParams: { startTimeline },
  };
}
```

**After:**
```typescript
function buildTimelineFilter(startTimeline: StartTimeline[]): FilterParts {
  const fragment = buildCypherFragment("startTimeline", "IN", startTimeline, "startTimeline");
  return {
    conditions: [fragment.clause],
    queryParams: { [fragment.paramName]: fragment.paramValue },
  };
}
```

#### 3. Refactor buildBudgetFilter

**File**: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts`
**Replace**: Lines 89-101

**Before:**
```typescript
function buildBudgetFilter(
  filterCeiling: number | null
): FilterParts {
  const conditions: string[] = [];
  const queryParams: Record<string, unknown> = {};

  if (filterCeiling !== null) {
    conditions.push("e.salary <= $budgetCeiling");
    queryParams.budgetCeiling = filterCeiling;
  }

  return { conditions, queryParams };
}
```

**After:**
```typescript
function buildBudgetFilter(
  filterCeiling: number | null
): FilterParts {
  if (filterCeiling === null) {
    return { conditions: [], queryParams: {} };
  }

  const fragment = buildCypherFragment("salary", "<=", filterCeiling, "budgetCeiling");
  return {
    conditions: [fragment.clause],
    queryParams: { [fragment.paramName]: fragment.paramValue },
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Timeline filter tests pass: `npm test -- query-conditions.builder --grep "timeline"`
- [x] Budget filter tests pass: `npm test -- query-conditions.builder --grep "budget"`
- [x] All query-conditions tests pass: `npm test -- src/services/cypher-query-builder/query-conditions.builder`

---

## Phase 2: Refactor Experience Filter

### Overview

Refactor `buildExperienceFilter()` which creates up to two separate fragments (min and max bounds).

### Changes Required:

#### 1. Refactor buildExperienceFilter

**File**: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts`
**Replace**: Lines 48-66

**Before:**
```typescript
function buildExperienceFilter(
  min: number | null,
  max: number | null
): FilterParts {
  const conditions: string[] = [];
  const queryParams: Record<string, unknown> = {};

  if (min !== null) {
    conditions.push("e.yearsExperience >= $minYearsExperience");
    queryParams.minYearsExperience = min;
  }

  if (max !== null) {
    conditions.push("e.yearsExperience < $maxYearsExperience");
    queryParams.maxYearsExperience = max;
  }

  return { conditions, queryParams };
}
```

**After:**
```typescript
function buildExperienceFilter(
  min: number | null,
  max: number | null
): FilterParts {
  const conditions: string[] = [];
  const queryParams: Record<string, unknown> = {};

  if (min !== null) {
    const fragment = buildCypherFragment("yearsExperience", ">=", min, "minYearsExperience");
    conditions.push(fragment.clause);
    queryParams[fragment.paramName] = fragment.paramValue;
  }

  if (max !== null) {
    const fragment = buildCypherFragment("yearsExperience", "<", max, "maxYearsExperience");
    conditions.push(fragment.clause);
    queryParams[fragment.paramName] = fragment.paramValue;
  }

  return { conditions, queryParams };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Experience filter tests pass: `npm test -- query-conditions.builder --grep "experience"`
- [x] All query-conditions tests pass: `npm test -- src/services/cypher-query-builder/query-conditions.builder`

---

## Phase 3: Refactor Timezone Filter

### Overview

Refactor `buildTimezoneFilter()` which creates multiple fragments that are ORed together. This is the most complex refactoring as it involves iterating over timezone prefixes.

### Changes Required:

#### 1. Refactor buildTimezoneFilter

**File**: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts`
**Replace**: Lines 68-83

**Before:**
```typescript
function buildTimezoneFilter(timezonePrefixes: string[]): FilterParts {
  if (timezonePrefixes.length === 0) {
    return { conditions: [], queryParams: {} };
  }

  const tzConditions = timezonePrefixes.map((_, i) => `e.timezone STARTS WITH $tz${i}`);
  const queryParams: Record<string, unknown> = {};
  timezonePrefixes.forEach((tz, i) => {
    queryParams[`tz${i}`] = tz;
  });

  return {
    conditions: [`(${tzConditions.join(" OR ")})`],
    queryParams,
  };
}
```

**After:**
```typescript
function buildTimezoneFilter(timezonePrefixes: string[]): FilterParts {
  if (timezonePrefixes.length === 0) {
    return { conditions: [], queryParams: {} };
  }

  const fragments = timezonePrefixes.map((prefix, i) =>
    buildCypherFragment("timezone", "STARTS WITH", prefix, `tz${i}`)
  );

  const queryParams: Record<string, unknown> = {};
  fragments.forEach((fragment) => {
    queryParams[fragment.paramName] = fragment.paramValue;
  });

  return {
    conditions: [`(${fragments.map((f) => f.clause).join(" OR ")})`],
    queryParams,
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Timezone filter tests pass: `npm test -- query-conditions.builder --grep "timezone"`
- [x] All query-conditions tests pass: `npm test -- src/services/cypher-query-builder/query-conditions.builder`
- [x] All tests pass: `npm test`

---

## Final Verification

After all phases are complete:

```bash
# Full test suite
npm test

# E2E tests (requires Tilt running)
npm run test:e2e
```

## Testing Strategy

### Unit Tests:
- All 21 existing tests in `query-conditions.builder.test.ts` should pass without modification
- Tests verify the output format (conditions array, queryParams object) which remains identical

### Key Test Cases Covered:
- Timeline: IN condition formatting (lines 23-39)
- Experience: >= and < conditions, null handling (lines 42-83)
- Timezone: STARTS WITH, OR logic, parentheses wrapping (lines 85-120)
- Budget: <= condition, stretchBudget priority (lines 122-161)
- Combined: Multiple filters together (lines 163-199)
- Formatting: `e.` prefix on all fields (lines 201-233)

## References

- Shared utility: `recommender_api/src/utils/cypher-fragment.builder.ts`
- Target file: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts`
- Test file: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.test.ts`
- Usage example: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts:96-188`
- Original plan reference: `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-10-project-2-constraint-advisor.md` (Phase 2, lines 291-364)
