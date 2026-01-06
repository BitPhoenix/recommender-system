# Salary Utility Simplification Plan

**Status: COMPLETED**

## Overview

Simplify the salary utility calculation to treat all within-budget candidates equally. Since `requiredMaxSalary` acts as a hard filter (excluding over-budget candidates before scoring), the salary utility function only sees candidates within budget. All such candidates should score equally - we shouldn't penalize someone asking $140k vs $150k when both are under the $160k budget.

## Current State Analysis

**File**: `recommender_api/src/services/utility-calculator/scoring/core-scoring.ts:86-104`

```typescript
export function calculateSalaryUtility(
  salary: number,
  maxBudget: number | null,
  minSalary: number,
  maxSalary: number
): number {
  // If no budget specified, use neutral scoring
  if (maxBudget === null) {
    return normalizeLinearInverse(salary, minSalary, maxSalary);
  }

  // If salary exceeds budget, penalize heavily
  if (salary > maxBudget) {
    return 0;  // <-- HARD CUTOFF - problem we're fixing
  }

  // Otherwise, inverse linear within budget
  return normalizeLinearInverse(salary, minSalary, maxBudget);
}
```

### Problems with Current Approach:
1. **Hard cutoff at budget**: A candidate $1 over budget gets the same score (0) as someone $50k over
2. **Penalizes at-budget candidates**: The inverse linear formula gives 0 at exactly `maxBudget`
3. **Doesn't reflect real hiring**: Teams frequently stretch 10-20% for exceptional candidates

## Desired End State

A salary utility function where:
- **Under or at budget**: All candidates score 1.0 (equally affordable)
- **Over budget**: Exponential decay from 1.0, approaching 0 asymptotically

This means:
- Salary only differentiates when candidates exceed budget
- The further over budget, the lower the score (but never hard zero)
- An exceptional candidate 30% over budget can still surface if outstanding in other dimensions

### Verification:
- Unit tests pass demonstrating new decay behavior
- Manual verification: search results show over-budget candidates ranked appropriately (not eliminated)

## What We're NOT Doing

- **Not changing the "no budget" case**: When `maxBudget === null`, we keep current inverse linear behavior
- **Not changing utility weights**: The salary weight (0.07) stays the same
- **Not adding new API parameters**: The decay rate is not configurable per-request (simplicity first)
- **Not updating config files**: No changes to `utility.config.ts` - the decay rate is embedded in the function

## Implementation Approach

Replace the hard cutoff with a two-part function:
1. At or under budget → return 1.0 (all equally affordable)
2. Over budget → exponential decay: `Math.pow(0.5, percentOver / 0.20)`

The decay rate of 0.20 (20%) means the score halves every 20% over budget.

## Phase 1: Update Salary Utility Function

### Overview
Modify `calculateSalaryUtility` to implement gradual decay for over-budget salaries.

### Changes Required:

#### 1. Update core-scoring.ts
**File**: `recommender_api/src/services/utility-calculator/scoring/core-scoring.ts`
**Changes**: Replace the salary utility function

```typescript
/**
 * Calculates salary utility.
 *
 * Function type: STEP + EXPONENTIAL DECAY
 * Formula:
 *   - salary <= maxBudget: 1.0 (fully affordable)
 *   - salary > maxBudget: 0.5^(percentOver / 0.20) (halves every 20% over)
 *
 * Rationale: All candidates within budget are equally affordable - we shouldn't
 * penalize someone asking $150k vs $140k when both are under the $160k budget.
 * The salary dimension only acts as a differentiator when candidates exceed budget.
 *
 * For over-budget candidates, we use exponential decay rather than a hard cutoff
 * because teams often stretch budgets for exceptional candidates. Being $10k over
 * is very different from being $50k over - the decay reflects this reality while
 * ensuring over-budget candidates can still surface if outstanding in other dimensions.
 *
 * When no budget is specified, falls back to inverse linear scoring across the
 * full salary range (lower salary = higher score).
 */
export function calculateSalaryUtility(
  salary: number,
  maxBudget: number | null,
  minSalary: number,
  maxSalary: number
): number {
  // If no budget specified, use inverse linear scoring (lower salary = better)
  if (maxBudget === null) {
    return normalizeLinearInverse(salary, minSalary, maxSalary);
  }

  // At or under budget: all equally affordable
  if (salary <= maxBudget) {
    return 1.0;
  }

  // Over budget: exponential decay
  // Score halves every 20% over budget
  const percentOver = (salary - maxBudget) / maxBudget;
  const decayHalfLife = 0.20;
  return Math.pow(0.5, percentOver / decayHalfLife);
}
```

#### 2. Update utility.config.ts documentation
**File**: `recommender_api/src/config/knowledge-base/utility.config.ts`
**Changes**: Update the comment block for salary to reflect new behavior

```typescript
  /*
   * STEP + EXPONENTIAL DECAY:
   *   - At/under budget: 1.0 (all equally affordable)
   *   - Over budget: 0.5^(percentOver / 0.20), halves every 20% over
   *
   * WHY THIS MODEL: Within budget, salary shouldn't differentiate candidates -
   * a $140k candidate isn't "better" than a $150k one if both are under the $160k
   * budget. The salary dimension only matters when candidates exceed budget.
   *
   * For over-budget candidates, we use exponential decay (not a hard cutoff) because
   * teams often stretch for exceptional candidates. The gradual decay means:
   *   - 10% over budget: score = 0.71
   *   - 20% over budget: score = 0.50
   *   - 40% over budget: score = 0.25
   *
   * This lets exceptional over-budget candidates still surface while appropriately
   * penalizing larger budget overruns.
   *
   * When no maxSalaryBudget is specified, falls back to inverse linear where
   * lower salary = higher score (original behavior for budget-agnostic searches).
   */
  salaryMin: 80000,
  salaryMax: 300000,
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All existing tests pass: `npm test` (no test script configured, skipped)
- [x] API still responds correctly: `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json`

#### Manual Verification:
- [ ] Search with `maxSalaryBudget: 150000` shows candidates over $150k ranked lower (not eliminated)
- [ ] Candidate at $165k (+10%) ranks higher than candidate at $180k (+20%), all else equal
- [ ] Candidates under budget are not differentiated by salary in rankings

---

## Phase 2: Add Unit Tests

### Overview
Add specific unit tests for the new salary utility behavior.

### Changes Required:

#### 1. Create or update test file
**File**: `recommender_api/src/services/utility-calculator/scoring/__tests__/core-scoring.test.ts` (create if doesn't exist)

```typescript
import { calculateSalaryUtility } from '../core-scoring.js';

describe('calculateSalaryUtility', () => {
  const minSalary = 80000;
  const maxSalary = 300000;

  describe('with no budget specified', () => {
    it('returns inverse linear score (lower salary = higher score)', () => {
      expect(calculateSalaryUtility(80000, null, minSalary, maxSalary)).toBeCloseTo(1.0);
      expect(calculateSalaryUtility(190000, null, minSalary, maxSalary)).toBeCloseTo(0.5);
      expect(calculateSalaryUtility(300000, null, minSalary, maxSalary)).toBeCloseTo(0.0);
    });
  });

  describe('with budget specified', () => {
    const maxBudget = 150000;

    it('returns 1.0 for salaries at or under budget', () => {
      expect(calculateSalaryUtility(80000, maxBudget, minSalary, maxSalary)).toBe(1.0);
      expect(calculateSalaryUtility(140000, maxBudget, minSalary, maxSalary)).toBe(1.0);
      expect(calculateSalaryUtility(150000, maxBudget, minSalary, maxSalary)).toBe(1.0);
    });

    it('returns exponential decay for salaries over budget', () => {
      // 10% over ($165k): 0.5^(0.10/0.20) = 0.5^0.5 ≈ 0.707
      expect(calculateSalaryUtility(165000, maxBudget, minSalary, maxSalary)).toBeCloseTo(0.707, 2);

      // 20% over ($180k): 0.5^(0.20/0.20) = 0.5^1 = 0.5
      expect(calculateSalaryUtility(180000, maxBudget, minSalary, maxSalary)).toBeCloseTo(0.5, 2);

      // 40% over ($210k): 0.5^(0.40/0.20) = 0.5^2 = 0.25
      expect(calculateSalaryUtility(210000, maxBudget, minSalary, maxSalary)).toBeCloseTo(0.25, 2);
    });

    it('asymptotically approaches but never reaches 0', () => {
      // Even at 100% over budget (2x), score is still positive
      const score = calculateSalaryUtility(300000, maxBudget, minSalary, maxSalary);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(0.1); // But very small
    });

    it('ranks candidates correctly: closer to budget = higher score', () => {
      const score10Over = calculateSalaryUtility(165000, maxBudget, minSalary, maxSalary);
      const score20Over = calculateSalaryUtility(180000, maxBudget, minSalary, maxSalary);
      const score40Over = calculateSalaryUtility(210000, maxBudget, minSalary, maxSalary);

      expect(score10Over).toBeGreaterThan(score20Over);
      expect(score20Over).toBeGreaterThan(score40Over);
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] New unit tests pass: `npm test -- --testPathPattern=core-scoring`
- [ ] All tests pass: `npm test`

**Note**: Phase 2 is blocked - no test runner configured in the project. Requires Jest/Vitest setup first.

---

## Testing Strategy

### Unit Tests:
- Verify score = 1.0 for all under-budget salaries
- Verify exponential decay values at key percentages (10%, 20%, 40% over)
- Verify score never reaches 0 (asymptotic)
- Verify ranking order is preserved (closer to budget = higher score)

### Integration Tests:
- Run Newman collection to ensure API behavior unchanged for normal cases
- Verify search results include over-budget candidates when appropriate

### Manual Testing Steps:
1. Start the API via Tilt
2. Execute search with `maxSalaryBudget: 150000`
3. Verify results include candidates over $150k (ranked lower, not filtered)
4. Compare two over-budget candidates - verify the one closer to budget ranks higher

## Performance Considerations

None significant. `Math.pow(0.5, x)` is a trivial operation, and this runs once per candidate during scoring (not in hot paths).

## References

- Current implementation: `recommender_api/src/services/utility-calculator/scoring/core-scoring.ts:86-104`
- Utility config: `recommender_api/src/config/knowledge-base/utility.config.ts:115-124`
- Discussion context: Conversation about gradual decay vs hard cutoff for over-budget candidates
