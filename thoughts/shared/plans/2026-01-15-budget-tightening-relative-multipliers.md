# Budget Tightening Relative Multipliers Implementation Plan

## Overview

Fix `generateBudgetTighteningSuggestions` to use relative multipliers (like relaxation does) instead of hardcoded absolute salary buckets. This makes tightening suggestions contextual to the user's current budget constraint.

## Current State Analysis

**Relaxation** (`relaxation-generator.service.ts:113-119`):
```typescript
salary: {
  type: RelaxationStrategyType.NumericStep,
  stepsUp: [1.2, 1.5],  // Relative to user's input
  ...
}
```
If user has $100k budget, relaxation suggests $120k (1.2×) and $150k (1.5×).

**Tightening** (`tightening-generator.service.ts:254-266`):
```typescript
CASE
  WHEN e.salary <= 100000 THEN 100000
  WHEN e.salary <= 150000 THEN 150000
  WHEN e.salary <= 200000 THEN 200000
  ELSE 250000
END AS salaryBucket
```
Hardcoded absolute values regardless of user input.

### Key Discoveries:
- Relaxation uses multipliers defined in `relaxation-strategies.config.ts:115-116`
- Tightening has no equivalent config - hardcoded in the service
- `expanded.maxBudget` contains the user's budget constraint (null if not set)
- Tightening needs cumulative counts (≤ threshold) for meaningful suggestions

## Desired End State

Budget tightening suggestions should:
1. Only appear when the user has set a `maxBudget` constraint
2. Suggest values that are step-downs from the user's current budget (e.g., 80%, 70%, 60%)
3. Show cumulative engineer counts at each threshold
4. Be consistent with the relaxation pattern

**Example behavior:**
- User sets `maxBudget: 175000`
- Suggestions: $140k (0.8×), $122k (0.7×), $105k (0.6×)
- Each shows how many engineers earn at or below that amount

### Verification:
- Unit tests pass with updated assertions
- Suggestions are relative to user input, not hardcoded buckets
- No suggestions generated when `maxBudget` is null

## What We're NOT Doing

- Adding a tightening strategies config file (overkill for this single field)
- Changing other tightening generators (timezone, seniority, timeline, skills)
- Modifying relaxation behavior

## Implementation Approach

Simple inline fix in `generateBudgetTighteningSuggestions`:
1. Return empty array if `expanded.maxBudget` is null
2. Calculate step-down thresholds using multipliers `[0.8, 0.7, 0.6]`
3. Query for cumulative counts at each threshold
4. Build suggestions from results

## Phase 1: Update Budget Tightening Generator

### Overview
Replace hardcoded buckets with relative multipliers based on user's current budget.

### Changes Required:

#### 1. Update `generateBudgetTighteningSuggestions`
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`
**Lines**: 246-308

**Replace entire function with:**

```typescript
/**
 * Suggest budget caps as step-downs from the user's current budget.
 * Uses relative multipliers (0.8, 0.7, 0.6) for contextual suggestions.
 *
 * If no budget is set, returns empty (can't tighten what doesn't exist).
 */
async function generateBudgetTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria
): Promise<BudgetTightening[]> {
  const currentBudget = expanded.maxBudget;

  // Can't tighten if no budget constraint exists
  if (currentBudget === null) {
    return [];
  }

  // Step-down multipliers - suggest tighter budgets as fractions of current
  const stepDownMultipliers = [0.8, 0.7, 0.6];
  const thresholds = stepDownMultipliers
    .map(m => Math.floor(currentBudget * m))
    .filter(t => t > 0);

  if (thresholds.length === 0) {
    return [];
  }

  // Get total engineer count first
  const totalQuery = `
    MATCH (e:Engineer)
    WHERE e.startTimeline IN $startTimeline
    RETURN count(e) AS total
  `;
  const totalResult = await session.run(totalQuery, {
    startTimeline: expanded.startTimeline,
  });
  const total = totalResult.records[0]?.get("total")?.toNumber?.() ?? 0;

  if (total === 0) {
    return [];
  }

  const suggestions: BudgetTightening[] = [];

  // Query cumulative count for each threshold
  for (const threshold of thresholds) {
    const query = `
      MATCH (e:Engineer)
      WHERE e.startTimeline IN $startTimeline
        AND e.salary <= $threshold
      RETURN count(e) AS count
    `;

    const result = await session.run(query, {
      startTimeline: expanded.startTimeline,
      threshold,
    });

    const count = result.records[0]?.get("count")?.toNumber?.() ?? 0;

    // Only suggest if it would reduce results
    if (count > 0 && count < total) {
      const percentage = Math.round((count / total) * 100);
      suggestions.push({
        field: "maxBudget",
        suggestedValue: threshold,
        rationale: `Lower budget cap to $${threshold.toLocaleString()}`,
        resultingMatches: count,
        distributionInfo: `${count} of ${total} engineers (${percentage}%) earn ≤$${threshold.toLocaleString()}`,
      });
    }
  }

  return suggestions;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test`
- [x] E2E tests pass: `npm run test:e2e`

---

## Phase 2: Update Unit Tests

### Overview
Update tests to reflect new relative multiplier behavior.

### Changes Required:

#### 1. Update test expectations
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.test.ts`

**Update "generates salary bucket distribution suggestions" test (~line 138):**
The current test has no budget set, so with the new behavior it should return NO suggestions (can't tighten what doesn't exist).

```typescript
it("returns no budget suggestions when no budget constraint set", async () => {
  session.mockRun.mockResolvedValue({ records: [] });

  const suggestions = await generateTighteningSuggestions(
    session as any,
    baseExpanded,  // maxBudget: null
    [],
    10
  );

  const budgetSuggestions = suggestions.filter((s) => s.field === "maxBudget");
  expect(budgetSuggestions).toHaveLength(0);
});
```

**Add new test for relative multiplier behavior:**

```typescript
it("generates budget suggestions relative to user's current budget", async () => {
  // Mock total count query
  session.mockRun.mockImplementation((query: string) => {
    if (query.includes("count(e) AS total")) {
      return {
        records: [{ get: () => ({ toNumber: () => 40 }) }],
      };
    }
    // Mock cumulative count queries for each threshold
    if (query.includes("e.salary <= $threshold")) {
      return {
        records: [{ get: () => ({ toNumber: () => 25 }) }],
      };
    }
    return { records: [] };
  });

  const expandedWithBudget = { ...baseExpanded, maxBudget: 200000 };

  const suggestions = await generateTighteningSuggestions(
    session as any,
    expandedWithBudget,
    [],
    10
  );

  const budgetSuggestions = suggestions.filter((s) => s.field === "maxBudget");

  // Should suggest 160k (0.8×), 140k (0.7×), 120k (0.6×)
  expect(budgetSuggestions.length).toBeGreaterThan(0);
  expect(budgetSuggestions.some(s => s.suggestedValue === 160000)).toBe(true);
  expect(budgetSuggestions.some(s => s.suggestedValue === 140000)).toBe(true);
  expect(budgetSuggestions.some(s => s.suggestedValue === 120000)).toBe(true);
  expect(budgetSuggestions[0].rationale).toContain("Lower budget cap");
});
```

**Update "only suggests budget values stricter than current constraint" test (~line 267):**
This test already sets `maxBudget: 200000` so it will work with new behavior. Update assertions to expect relative values:

```typescript
it("only suggests budget values stricter than current constraint", async () => {
  // Mock total and cumulative count queries
  session.mockRun.mockImplementation((query: string) => {
    if (query.includes("count(e) AS total")) {
      return {
        records: [{ get: () => ({ toNumber: () => 35 }) }],
      };
    }
    if (query.includes("e.salary <= $threshold")) {
      // Return different counts based on threshold
      return {
        records: [{ get: () => ({ toNumber: () => 20 }) }],
      };
    }
    return { records: [] };
  });

  const expandedWithBudget = { ...baseExpanded, maxBudget: 200000 };

  const suggestions = await generateTighteningSuggestions(
    session as any,
    expandedWithBudget,
    [],
    10
  );

  const budgetSuggestions = suggestions.filter((s) => s.field === "maxBudget");

  // All suggestions should be below $200k (the current budget)
  for (const suggestion of budgetSuggestions) {
    expect(suggestion.suggestedValue).toBeLessThan(200000);
  }
});
```

**Update cumulative counts test (~line 1009):**
Update to use relative thresholds instead of hardcoded buckets.

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `npm test`
- [x] No test regressions

---

## Testing Strategy

### Unit Tests:
- No budget set → no suggestions
- Budget set → suggestions at 80%, 70%, 60% of current value
- Suggestions only include values that would reduce results
- Rationale and distributionInfo formatted correctly

### Integration Tests:
- E2E tests should pass (behavior change is backend-only)

### Manual Testing Steps:
1. Call search API with `maxBudget: 200000`
2. Verify tightening suggestions show values like $160k, $140k, $120k
3. Call search API without `maxBudget`
4. Verify no budget tightening suggestions appear

## Performance Considerations

The new implementation makes one query per threshold (3 queries) vs the old single CASE query. This is acceptable because:
- Tightening runs only when results exceed threshold (not hot path)
- Neo4j queries are fast with indexed salary field
- Could optimize to single query with UNION if needed later

## References

- Related relaxation implementation: `relaxation-strategies.config.ts:113-119`
- Tightening generator: `tightening-generator.service.ts:250-308`
- Expanded criteria type: `constraint-expander.service.ts:39-106`
