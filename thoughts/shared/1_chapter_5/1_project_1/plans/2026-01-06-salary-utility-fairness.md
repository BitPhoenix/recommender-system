# Remove Salary Utility (Fairness Simplification)

**Status: READY FOR IMPLEMENTATION**

## Overview

Remove the salary utility function entirely and redistribute its weight (0.07) to skillMatch. The current inverse-linear scoring systematically disadvantages higher-earning engineers when no budget is set, and a flat 1.0 would just be dead code. Cleaner to remove it.

## Current State Analysis

**File**: `recommender_api/src/services/utility-calculator/scoring/core-scoring.ts:87-101`

```typescript
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

  // Budget specified: candidates over budget are filtered out before scoring,
  // so all candidates reaching this point are within budget.
  return 1.0;
}
```

**File**: `recommender_api/src/config/knowledge-base/utility.config.ts:39`
```typescript
salary: 0.07,
```

### Problem with Current Approach

When `maxBudget === null`, the function uses inverse linear scoring where lower salary = higher score:
- $80k engineer: score = 1.0
- $190k engineer: score = 0.5
- $300k engineer: score = 0.0

This **systematically disadvantages higher-earning engineers** even when the company has expressed no budget preference.

If we changed to flat 1.0, it would be dead code—a constant added to every score has zero ranking impact.

## Desired End State

- Salary utility function removed entirely
- Salary weight (0.07) redistributed to skillMatch (0.30 → 0.37)
- Salary-related config params removed
- Budget filtering unchanged (still filters out over-budget candidates)

### Verification:
- Salary no longer affects ranking in any scenario
- skillMatch weight increased to 0.37
- All tests pass, API behavior unchanged for budget filtering

## What We're NOT Doing

- **Not changing budget filtering logic**: Over-budget candidates are still filtered when budget is set
- **Not adding "cost-conscious" mode**: If needed later, can reintroduce with clear opt-in semantics
- **Not touching preferredSalaryRangeMatch**: That's a separate preference-based utility (kept)

## Stakeholder Analysis

### Companies (hiring side)
- **Impact**: Must explicitly set a budget to optimize for cost
- **Rationale**: A budget is a *constraint* ("willing to pay up to X"), not an *optimization target*. Companies who care about cost have the budget filter.

### Developers (talent side)
- **Impact**: Higher-earning engineers no longer systematically disadvantaged
- **Rationale**: A $180k senior engineer shouldn't rank lower than a $100k junior just because of salary when the company hasn't specified a budget.

### Marketplace (platform)
- **Impact**: Neutral on salary → potentially higher average match salaries → higher success fees
- **Note**: This is a side effect, not the goal. Fairness to users comes first.

## Implementation Approach

Remove `calculateSalaryUtility` entirely and all references to it. Redistribute the 0.07 weight to skillMatch.

## Phase 1: Remove Salary Utility

### Overview
Delete the salary utility function, remove its weight, update skillMatch weight, and clean up all call sites.

### Changes Required:

#### 1. Delete calculateSalaryUtility from core-scoring.ts
**File**: `recommender_api/src/services/utility-calculator/scoring/core-scoring.ts`
**Action**: Delete the entire `calculateSalaryUtility` function (lines 74-101)

#### 2. Update utility weights
**File**: `recommender_api/src/config/knowledge-base/utility.config.ts`
**Changes**:
- Remove `salary: 0.07,` line
- Change `skillMatch: 0.30,` → `skillMatch: 0.37,`
- Remove `salaryMin` and `salaryMax` from `utilityParams`
- Update the skillMatch comment to note it absorbed salary weight

```typescript
export const utilityWeights: UtilityWeights = {
  /* Candidate attributes (always evaluated) */
  // skillMatch: 0.37 (absorbed 0.07 from removed salary utility)
  // Includes both coverage and proficiency matching in one unified score.
  skillMatch: 0.37,
  relatedSkillsMatch: 0.04,
  confidenceScore: 0.14,
  yearsExperience: 0.11,
  // salary removed - was unfair to higher-earning engineers, now handled by budget filter only

  /* Preference matches ... */
```

#### 3. Update UtilityWeights type
**File**: `recommender_api/src/types/knowledge-base.types.ts`
**Action**: Remove `salary` from the `UtilityWeights` interface

#### 4. Update UtilityFunctionParams type and config
**File**: `recommender_api/src/types/knowledge-base.types.ts`
**Action**: Remove `salaryMin` and `salaryMax` from `UtilityFunctionParams` interface

**File**: `recommender_api/src/config/knowledge-base/utility.config.ts`
**Action**: Remove `salaryMin` and `salaryMax` from `utilityParams` object

#### 5. Remove salary utility call from utility calculator
**File**: `recommender_api/src/services/utility-calculator/utility-calculator.ts` (or wherever it's called)
**Action**: Remove the call to `calculateSalaryUtility` and its contribution to the score

#### 6. Update exports if needed
**File**: `recommender_api/src/services/utility-calculator/scoring/index.ts`
**Action**: Remove `calculateSalaryUtility` from exports if present

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] API responds correctly: `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json`

#### Manual Verification:
- [x] Search without budget: verify engineers of all salary levels rank purely on skills/experience
- [x] Search with budget: verify filtering still excludes over-budget candidates

---

## Testing Strategy

### Integration Tests:
- Newman collection validates API behavior unchanged for budget-filtered searches
- No regressions in overall search functionality

### Manual Testing Steps:
1. Start API via Tilt
2. Search without any budget constraint
3. Verify results rank purely on skills, experience, etc. (no salary bias)
4. Search with `requiredMaxSalary: 150000`
5. Verify only under-$150k engineers appear (budget filtering works)

## Performance Considerations

Slight improvement—one fewer utility calculation per candidate.

## Future Considerations

If companies explicitly want cost optimization without a hard budget cap, consider adding:

```typescript
// Optional future enhancement
preferCostEfficiency?: boolean  // If true, reintroduce salary utility with inverse linear
```

This would make cost optimization **opt-in** rather than default. Not implementing now—YAGNI.

## References

- Current implementation: `recommender_api/src/services/utility-calculator/scoring/core-scoring.ts:87-101`
- Utility config: `recommender_api/src/config/knowledge-base/utility.config.ts`
- Previous salary utility plan: `thoughts/shared/plans/2026-01-06-salary-utility-gradual-decay.md`
