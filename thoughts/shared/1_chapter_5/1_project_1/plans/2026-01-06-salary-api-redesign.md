# Salary API Redesign: Job Pay Band Model

**Status: READY FOR IMPLEMENTATION**

## Overview

Redesign the salary API to use job-centric pay band parameters instead of engineer-centric salary filtering. This prevents hiring managers from using engineer salary expectations to lowball offers, while still allowing budget-based filtering and ranking.

## Current State Analysis

### Current API Parameters

```typescript
// search.schema.ts:91-94
requiredMaxSalary: z.number().positive().optional(),   // Hard filter
requiredMinSalary: z.number().positive().optional(),   // Hard filter - PROBLEMATIC
preferredSalaryRange: PreferredSalaryRangeSchema.optional(),  // Soft preference
```

### Problems with Current Approach

1. **`requiredMinSalary` enables lowballing**: A hiring manager with $180k budget sees an engineer expecting $150k, adjusts their offer to $150k instead of $180k. The engineer loses $30k they would have received.

2. **`preferredSalaryRange.min` has same problem**: Even as a soft preference, exposing that an engineer would accept less enables exploitation.

3. **Terminology is confusing**: "requiredMaxSalary" sounds like the engineer's requirement, not the job's budget ceiling.

4. **No budget flexibility model**: Real hiring often involves "we budgeted $200k but could stretch to $220k for someone exceptional."

### Key Files to Modify

| File | Current Salary Logic |
|------|---------------------|
| `recommender_api/src/schemas/search.schema.ts:34-40, 91-94` | Schema definitions |
| `recommender_api/src/services/constraint-expander.service.ts:226-254` | Constraint expansion |
| `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts:82-100` | Cypher WHERE clauses |
| `recommender_api/src/services/utility-calculator/scoring/logistics-scoring.ts:147-160` | Preference scoring |
| `recommender_api/src/services/utility-calculator/utility-calculator.ts:126-130` | Score calculation |
| `recommender_api/src/config/knowledge-base/utility.config.ts:54` | Weight: 0.03 |
| `recommender_api/src/types/search.types.ts` | Response types |
| `recommender_api/src/types/knowledge-base.types.ts` | Config types |

## Desired End State

### New API Parameters

```typescript
// Job-centric budget parameters
maxBudget: z.number().positive().optional(),      // Job's budget ceiling
stretchBudget: z.number().positive().optional(),  // Optional stretch ceiling for exceptional candidates
```

### Behavior Matrix

| `maxBudget` | `stretchBudget` | Filtering | Scoring |
|-------------|-----------------|-----------|---------|
| Not set | Not set | No salary filter | All score 1.0 (no salary bias) |
| Set | Not set | Hard filter at `maxBudget` | All returned score 1.0 |
| Set | Set | Hard filter at `stretchBudget` | 1.0 up to `maxBudget`, linear decay to `stretchBudget` |

### Scoring Formula (when stretchBudget is set)

```typescript
if (salary <= maxBudget) {
  return 1.0;  // Within budget - no penalty
}
// Linear decay from maxBudget to stretchBudget
const progress = (salary - maxBudget) / (stretchBudget - maxBudget);
return 1.0 - (progress * 0.5);  // Decays from 1.0 to 0.5 at stretch limit
```

Example with $200k max, $220k stretch:
- $180k → 1.0 (under budget)
- $200k → 1.0 (at budget)
- $210k → 0.75 (halfway through stretch zone)
- $220k → 0.5 (at stretch limit, still gets half credit)

### Verification

- API accepts new parameters and rejects old ones
- Engineers over `stretchBudget` (or `maxBudget` if no stretch) are filtered out
- Engineers in stretch zone rank lower but still appear
- No salary filter when neither parameter is set
- All existing Postman tests updated and passing
- New tests cover stretch budget scenarios

## What We're NOT Doing

- **Not adding `minBudget` (job pay band floor)**: See "Why No minBudget?" section below
- **Not adding cost optimization mode**: If companies want to prefer lower salaries, that's a separate opt-in feature (YAGNI)
- **Not exposing engineer salary expectations differently**: The filtering is based on "can they afford this engineer," not "what does the engineer want"
- **Not changing the utility weight**: The 0.03 weight stays the same, just applied to the new scoring function
- **Not supporting percentage-based stretch**: Explicit dollar amounts are clearer and match how budgets work

## Why No `minBudget`?

A job might have a pay band of $180k-$200k, but we deliberately don't capture the lower bound ($180k). Here's why:

### The only question that matters for search: "Can we afford this engineer?"

This is fully answered by `maxBudget` (and optionally `stretchBudget`). The job's full pay band is internal HR/compensation metadata that doesn't affect the search algorithm.

### `minBudget` isn't useful for filtering

Would we ever filter OUT engineers who ask for less than the job's minimum? No. If an engineer asks $150k and the job pays $180k-$200k, you'd still consider them and offer within the band. You wouldn't exclude someone for being "too affordable."

### `minBudget` isn't useful for scoring

There's no reason to rank engineers differently based on how their ask compares to the job's floor. A candidate asking $150k isn't better or worse than one asking $175k when both are under the $200k ceiling.

### Including `minBudget` could enable harm

If a hiring manager sees "engineer asks $150k, job min is $180k," they might be tempted to offer $160k (splitting the difference) instead of the proper $180k minimum. By not exposing this comparison, we remove the temptation.

### The offer is a negotiation, not a search parameter

The actual offer an engineer receives should be within the job's pay band regardless of what they stated as their expectation. That's between the company and the engineer during negotiation - not something the search algorithm needs to facilitate.

## Stakeholder Analysis

### Engineers (talent side)
- **Benefit**: No longer disadvantaged by having lower salary expectations
- **Benefit**: Can't be lowballed based on their stated minimum

### Hiring Managers (company side)
- **Neutral**: Can still filter by budget
- **Benefit**: Clearer semantics - "what's your budget?" not "filter by engineer expectations"
- **New capability**: Can specify flexible budget to see slightly over-budget candidates

### Platform
- **Benefit**: Fairer marketplace leads to higher trust
- **Note**: May see higher average match salaries (engineers get fair offers)

## Implementation Approach

1. Update schema with new parameters, remove old ones
2. Update constraint expander to handle new logic
3. Update query builder to filter at correct ceiling
4. Replace preference scoring with budget-based scoring
5. Update types throughout
6. Update Postman collection with new test cases

---

## Phase 1: Schema Changes

### Overview
Replace the three salary parameters with two job-centric budget parameters.

### Changes Required

#### 1. Update search.schema.ts
**File**: `recommender_api/src/schemas/search.schema.ts`
**Changes**: Remove old salary schemas, add new budget parameters

```typescript
// DELETE these lines (34-40):
// export const PreferredSalaryRangeSchema = z.object({
//   min: z.number().positive(),
//   max: z.number().positive(),
// }).refine(
//   (data) => data.min <= data.max,
//   { message: 'min must be less than or equal to max' }
// );

// REPLACE lines 91-94 with:
  // Budget (job-centric, not engineer-centric)
  maxBudget: z.number().positive().optional(),
  stretchBudget: z.number().positive().optional(),

// ADD new refinement after the existing refinements:
.refine(
  (data) => {
    if (data.stretchBudget !== undefined && data.maxBudget === undefined) {
      return false;  // stretchBudget requires maxBudget
    }
    return true;
  },
  {
    message: 'stretchBudget requires maxBudget to be set',
    path: ['stretchBudget'],
  }
)
.refine(
  (data) => {
    if (data.stretchBudget !== undefined && data.maxBudget !== undefined) {
      return data.stretchBudget >= data.maxBudget;
    }
    return true;
  },
  {
    message: 'stretchBudget must be greater than or equal to maxBudget',
    path: ['stretchBudget'],
  }
)

// DELETE the old refinement for requiredMinSalary <= requiredMaxSalary (lines 110-120)

// DELETE type export (line 143):
// export type PreferredSalaryRange = z.infer<typeof PreferredSalaryRangeSchema>;
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Schema validation rejects old parameters
- [ ] Schema validation accepts new parameters
- [ ] Refinement: `stretchBudget` without `maxBudget` fails validation
- [ ] Refinement: `stretchBudget < maxBudget` fails validation

#### Manual Verification
- [ ] API returns 400 for requests with `requiredMinSalary`
- [ ] API returns 400 for requests with `preferredSalaryRange`
- [ ] API accepts `maxBudget` alone
- [ ] API accepts `maxBudget` + `stretchBudget` together

---

## Phase 2: Constraint Expander Changes

### Overview
Update the constraint expander to handle new budget parameters and remove salary preference tracking.

### Changes Required

#### 1. Update ExpandedSearchCriteria type
**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Changes**: Update the expanded criteria interface

```typescript
// In ExpandedSearchCriteria interface, REPLACE:
//   maxSalary: number | null;
//   minSalary: number | null;
// WITH:
  maxBudget: number | null;
  stretchBudget: number | null;

// REMOVE from ExpandedSearchCriteria:
//   preferredSalaryRange: { min: number; max: number } | null;
```

#### 2. Update expandSalaryConstraints function
**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Changes**: Rename and simplify the function

```typescript
/**
 * Expands budget constraints into filter criteria.
 *
 * The hard filter ceiling is stretchBudget if set, otherwise maxBudget.
 * Engineers with salary > ceiling are excluded from results.
 */
function expandBudgetConstraints(
  maxBudget: number | undefined,
  stretchBudget: number | undefined
): { maxBudget: number | null; stretchBudget: number | null; context: ExpansionContext } {
  const context: ExpansionContext = { filters: [], preferences: [] };

  const maxBudgetValue = maxBudget ?? null;
  const stretchBudgetValue = stretchBudget ?? null;

  // Hard filter at the ceiling (stretchBudget if set, otherwise maxBudget)
  const filterCeiling = stretchBudgetValue ?? maxBudgetValue;

  if (filterCeiling !== null) {
    context.filters.push({
      field: 'salary',
      operator: '<=',
      value: filterCeiling.toString(),
      source: 'user',
    });
  }

  return { maxBudget: maxBudgetValue, stretchBudget: stretchBudgetValue, context };
}
```

#### 3. Update the main expand function call site
**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Changes**: Update the call to use new function and parameters

```typescript
// Find the call to expandSalaryConstraints and replace with:
const budgetResult = expandBudgetConstraints(
  request.maxBudget,
  request.stretchBudget
);

// Update how results are merged into ExpandedSearchCriteria:
maxBudget: budgetResult.maxBudget,
stretchBudget: budgetResult.stretchBudget,
```

#### 4. Remove salary preference tracking
**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Changes**: Remove `preferredSalaryRange` from preference tracking

```typescript
// In trackPreferredValuesAsPreferences, DELETE the preferredSalaryRange handling
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Constraint expander produces correct filter for `maxBudget` only
- [ ] Constraint expander produces correct filter for `maxBudget` + `stretchBudget`

#### Manual Verification
- [ ] API request with `maxBudget: 200000` filters at $200k
- [ ] API request with `maxBudget: 200000, stretchBudget: 220000` filters at $220k

---

## Phase 3: Query Builder Changes

### Overview
Update the Cypher query builder to use new parameter names.

### Changes Required

#### 1. Update buildSalaryFilter function
**File**: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts`
**Changes**: Rename parameters and simplify logic

```typescript
/**
 * Builds salary filter for budget constraint.
 * The ceiling is the hard filter - no engineers above this are returned.
 */
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

#### 2. Update call site in buildBasicEngineerFilters
**File**: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts`
**Changes**: Pass the correct ceiling value

```typescript
// The ceiling is stretchBudget if set, otherwise maxBudget
const budgetCeiling = criteria.stretchBudget ?? criteria.maxBudget;
const budgetFilter = buildBudgetFilter(budgetCeiling);
```

#### 3. Update QueryBuildParams type
**File**: `recommender_api/src/services/cypher-query-builder/query-types.ts`
**Changes**: Update the type to use new field names

```typescript
// REPLACE:
//   maxSalary: number | null;
//   minSalary: number | null;
// WITH:
  maxBudget: number | null;
  stretchBudget: number | null;
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Generated Cypher uses `$budgetCeiling` parameter

#### Manual Verification
- [ ] Query correctly filters engineers above budget ceiling

---

## Phase 4: Utility Calculator Changes

### Overview
Replace the binary `preferredSalaryRangeMatch` with a new `budgetMatch` scoring function that implements linear decay in the stretch zone.

### Changes Required

#### 1. Remove calculatePreferredSalaryRangeMatch
**File**: `recommender_api/src/services/utility-calculator/scoring/logistics-scoring.ts`
**Changes**: Delete the function (lines 136-160) and its import/export

#### 2. Add calculateBudgetMatch function
**File**: `recommender_api/src/services/utility-calculator/scoring/logistics-scoring.ts`
**Changes**: Add new function

```typescript
/**
 * Calculates budget match score.
 *
 * Function type: STEP + LINEAR DECAY
 * Formula:
 *   - No budget set: 1.0 (no salary-based ranking - fairness to all engineers)
 *   - salary <= maxBudget: 1.0 (within budget)
 *   - maxBudget < salary <= stretchBudget: linear decay from 1.0 to 0.5
 *
 * Rationale: When no budget is specified, we don't penalize higher-earning engineers -
 * this would be unfair as salary reflects experience/market value, not candidate quality.
 * The salary dimension only differentiates when candidates exceed the stated budget.
 *
 * For over-budget candidates (when stretchBudget is set), we use linear decay rather
 * than a hard cutoff because teams often stretch budgets for exceptional candidates.
 * Being $10k over is very different from being $50k over - the decay reflects this.
 */
export function calculateBudgetMatch(
  engineerSalary: number,
  maxBudget: number | null,
  stretchBudget: number | null,
  maxMatch: number
): BudgetMatchResult {
  // No budget specified: all engineers score equally (fairness)
  if (maxBudget === null) {
    return { raw: maxMatch, inBudget: true, inStretchZone: false };
  }

  // Within budget: full score
  if (engineerSalary <= maxBudget) {
    return { raw: maxMatch, inBudget: true, inStretchZone: false };
  }

  // Over budget but no stretch defined: shouldn't happen (filtered out)
  // But handle gracefully with zero score
  if (stretchBudget === null) {
    return { raw: 0, inBudget: false, inStretchZone: false };
  }

  // In stretch zone: linear decay from maxMatch to maxMatch * 0.5
  const progress = (engineerSalary - maxBudget) / (stretchBudget - maxBudget);
  const decayedScore = maxMatch * (1 - progress * 0.5);

  return { raw: decayedScore, inBudget: false, inStretchZone: true };
}
```

#### 3. Add BudgetMatchResult type
**File**: `recommender_api/src/services/utility-calculator/types.ts`
**Changes**: Add new result type, remove old one

```typescript
// DELETE:
// export interface PreferredSalaryRangeMatchResult {
//   raw: number;
//   inPreferredRange: boolean;
// }

// ADD:
export interface BudgetMatchResult {
  raw: number;
  inBudget: boolean;
  inStretchZone: boolean;
}
```

#### 4. Update utility-calculator.ts
**File**: `recommender_api/src/services/utility-calculator/utility-calculator.ts`
**Changes**: Replace the preference calculation with budget calculation

```typescript
// REPLACE the preferredSalaryRangeMatch calculation with:
const budgetResult = calculateBudgetMatch(
  engineer.salary,
  context.maxBudget,
  context.stretchBudget,
  params.budgetMatchMax  // New param name
);

// UPDATE matchScores to use budgetMatch instead of preferredSalaryRangeMatch:
budgetMatch: calculateWeighted(budgetResult.raw, weights.budgetMatch),

// UPDATE response building:
if (matchScores.budgetMatch > 0 && matchScores.budgetMatch < weights.budgetMatch) {
  // Only include if in stretch zone (partial score)
  preferenceMatches.budgetMatch = {
    score: matchScores.budgetMatch,
    inStretchZone: budgetResult.inStretchZone,
  };
}
```

#### 5. Update UtilityContext type
**File**: `recommender_api/src/services/utility-calculator/types.ts`
**Changes**: Update context to use new fields

```typescript
// REPLACE:
//   maxSalaryBudget: number | null;
//   preferredSalaryRange: { min: number; max: number } | null;
// WITH:
  maxBudget: number | null;
  stretchBudget: number | null;
```

#### 6. Update utility weights and params
**File**: `recommender_api/src/config/knowledge-base/utility.config.ts`
**Changes**: Rename weight and param

```typescript
// In utilityWeights, REPLACE:
//   preferredSalaryRangeMatch: 0.03,
// WITH:
  budgetMatch: 0.03,

// In utilityParams, REPLACE:
//   preferredSalaryRangeMatchMax: 1.0,
// WITH:
  budgetMatchMax: 1.0,

// UPDATE the comment block:
  /*
   * STEP + LINEAR DECAY (when stretchBudget is set):
   *   - No budget: 1.0 (no salary-based ranking)
   *   - At/under maxBudget: 1.0 (within budget)
   *   - In stretch zone: linear decay from 1.0 to 0.5
   *
   * WHY THIS MODEL: When no budget is specified, we don't want to disadvantage
   * higher-earning engineers - salary reflects experience/market value, not quality.
   * The salary dimension only differentiates when candidates exceed the stated budget.
   *
   * For over-budget candidates, linear decay (not hard cutoff) because teams often
   * stretch for exceptional candidates. Example with $200k max, $220k stretch:
   *   - $200k: score = 1.0 (at budget)
   *   - $210k: score = 0.75 (halfway through stretch)
   *   - $220k: score = 0.5 (at stretch limit)
   */
  budgetMatchMax: 1.0,
```

#### 7. Update UtilityWeights type
**File**: `recommender_api/src/types/knowledge-base.types.ts`
**Changes**: Rename the weight field

```typescript
// REPLACE:
//   preferredSalaryRangeMatch: number;
// WITH:
  budgetMatch: number;
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] No references to old salary preference functions remain

#### Manual Verification
- [ ] Search without budget: all engineers score equally on budget dimension
- [ ] Search with `maxBudget` only: all returned engineers score 1.0
- [ ] Search with `maxBudget` + `stretchBudget`: engineers in stretch zone score < 1.0

---

## Phase 5: Search Service Integration

### Overview
Update the search service to pass new parameters to the utility calculator.

### Changes Required

#### 1. Update search.service.ts
**File**: `recommender_api/src/services/search.service.ts`
**Changes**: Update UtilityContext construction

```typescript
// REPLACE:
//   maxSalaryBudget: expanded.maxSalary,
//   preferredSalaryRange: expanded.preferredSalaryRange,
// WITH:
  maxBudget: expanded.maxBudget,
  stretchBudget: expanded.stretchBudget,
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `npm run typecheck`

---

## Phase 6: Response Type Updates

### Overview
Update response types to reflect new scoring output.

### Changes Required

#### 1. Update search.types.ts
**File**: `recommender_api/src/types/search.types.ts`
**Changes**: Update preference match types

```typescript
// REPLACE PreferredSalaryRangeMatch interface with:
export interface BudgetMatch {
  score: number;
  inStretchZone: boolean;
}

// UPDATE PreferenceMatches interface:
// REPLACE:
//   preferredSalaryRangeMatch?: PreferredSalaryRangeMatch;
// WITH:
  budgetMatch?: BudgetMatch;
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `npm run typecheck`

---

## Phase 7: Postman Collection Updates

### Overview
Update existing salary tests and add new tests for the budget model.

### Changes Required

#### 1. Update existing salary tests
**File**: `postman/collections/search-filter-tests.postman_collection.json`

**Test 16 - Salary Range Filter** → **Budget Filter**
```json
{
  "name": "16 - Budget Filter",
  "request": {
    "body": {
      "raw": "{\n  \"maxBudget\": 180000\n}"
    }
  },
  "description": "## Budget Filter\n\nFilters engineers by job budget ceiling.\n\n### Expected Behavior\n- Only engineers with salary <= $180k returned\n- All returned engineers score 1.0 on budget dimension\n\n### appliedConstraints\n| Field | Operator | Value |\n|-------|----------|-------|\n| salary | <= | 180000 |"
}
```

**Test 17 - Max Salary Only** → **Budget with Stretch**
```json
{
  "name": "17 - Budget with Stretch",
  "request": {
    "body": {
      "raw": "{\n  \"maxBudget\": 150000,\n  \"stretchBudget\": 180000\n}"
    }
  },
  "description": "## Budget with Stretch\n\nFilters at stretch ceiling, scores decay in stretch zone.\n\n### Expected Behavior\n- Engineers with salary <= $180k returned (filter at stretch)\n- Engineers <= $150k score 1.0 on budget\n- Engineers $150k-$180k score 0.5-1.0 (linear decay)\n\n### Example Scores\n- $140k: 1.0 (under budget)\n- $150k: 1.0 (at budget)\n- $165k: 0.75 (halfway through stretch)\n- $180k: 0.5 (at stretch limit)"
}
```

**Test 31 - Preferred Salary Range** → DELETE or repurpose

#### 2. Add new test cases

**New Test: No Budget (Fairness)**
```json
{
  "name": "XX - No Budget (Fair Ranking)",
  "request": {
    "body": {
      "raw": "{\n  \"requiredSkills\": [{\"skill\": \"TypeScript\"}]\n}"
    }
  },
  "description": "## No Budget Specified\n\nWhen no budget is set, salary should not affect ranking.\n\n### Expected Behavior\n- All salary levels returned\n- Budget match score = 1.0 for all (no salary bias)\n- Engineers ranked purely by skills, experience, etc.\n\n### Rationale\nNot specifying a budget means the company hasn't expressed cost constraints.\nWe shouldn't penalize higher-earning engineers just because they earn more -\nthat would be unfair as salary reflects experience/market value, not quality."
}
```

**New Test: Stretch Budget Edge Cases**
```json
{
  "name": "XX - Stretch Budget Edge Cases",
  "request": {
    "body": {
      "raw": "{\n  \"maxBudget\": 200000,\n  \"stretchBudget\": 220000\n}"
    }
  },
  "description": "## Stretch Budget Edge Cases\n\nVerify linear decay calculation in stretch zone.\n\n### Expected Scores\n| Salary | Expected Score | Reason |\n|--------|---------------|--------|\n| $190k | 1.0 | Under budget |\n| $200k | 1.0 | At budget |\n| $205k | 0.875 | 25% through stretch |\n| $210k | 0.75 | 50% through stretch |\n| $215k | 0.625 | 75% through stretch |\n| $220k | 0.5 | At stretch limit |"
}
```

**New Test: Validation - stretchBudget without maxBudget**
```json
{
  "name": "XX - Validation: stretchBudget requires maxBudget",
  "request": {
    "body": {
      "raw": "{\n  \"stretchBudget\": 200000\n}"
    }
  },
  "event": [{
    "listen": "test",
    "script": {
      "exec": [
        "pm.test('Returns 400 for stretchBudget without maxBudget', function () {",
        "    pm.response.to.have.status(400);",
        "});"
      ]
    }
  }],
  "description": "## Validation Test\n\nstretchBudget requires maxBudget to be set."
}
```

### Success Criteria

#### Automated Verification
- [ ] Newman collection passes: `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json`

#### Manual Verification
- [ ] New budget tests demonstrate expected behavior
- [ ] Validation tests correctly reject invalid combinations

---

## Testing Strategy

### Unit Tests (if test runner is configured)

```typescript
describe('calculateBudgetMatch', () => {
  const maxMatch = 1.0;

  describe('no budget specified', () => {
    it('returns full score for fairness', () => {
      expect(calculateBudgetMatch(150000, null, null, maxMatch).raw).toBe(1.0);
      expect(calculateBudgetMatch(300000, null, null, maxMatch).raw).toBe(1.0);
    });
  });

  describe('maxBudget only', () => {
    it('returns full score for under/at budget', () => {
      expect(calculateBudgetMatch(150000, 200000, null, maxMatch).raw).toBe(1.0);
      expect(calculateBudgetMatch(200000, 200000, null, maxMatch).raw).toBe(1.0);
    });

    it('returns 0 for over budget (should be filtered)', () => {
      expect(calculateBudgetMatch(250000, 200000, null, maxMatch).raw).toBe(0);
    });
  });

  describe('with stretchBudget', () => {
    const maxBudget = 200000;
    const stretchBudget = 220000;

    it('returns full score at/under maxBudget', () => {
      expect(calculateBudgetMatch(200000, maxBudget, stretchBudget, maxMatch).raw).toBe(1.0);
    });

    it('returns linear decay in stretch zone', () => {
      // Halfway: 1.0 - (0.5 * 0.5) = 0.75
      expect(calculateBudgetMatch(210000, maxBudget, stretchBudget, maxMatch).raw).toBeCloseTo(0.75);
      // At stretch: 1.0 - (1.0 * 0.5) = 0.5
      expect(calculateBudgetMatch(220000, maxBudget, stretchBudget, maxMatch).raw).toBeCloseTo(0.5);
    });
  });
});
```

### Integration Tests (Newman)

- Budget filter correctly excludes over-ceiling engineers
- Stretch zone scoring produces expected values
- No budget = fair ranking (verify with manual inspection)
- Validation rejects invalid parameter combinations

### Manual Testing Steps

1. Start API via Tilt
2. **Test no budget**: Search with skills only, verify engineers of all salaries appear, check no salary bias in rankings
3. **Test maxBudget only**: Search with `maxBudget: 150000`, verify only <=$150k engineers returned
4. **Test stretch zone**: Search with `maxBudget: 150000, stretchBudget: 180000`:
   - Verify $160k engineer ranks lower than $140k engineer
   - Verify $180k engineer still appears (not filtered)
   - Verify $185k engineer is filtered out
5. **Test validation**: Confirm API rejects `stretchBudget` without `maxBudget`

## Performance Considerations

None significant. The new scoring function is O(1) - just a few comparisons and arithmetic operations.

## Migration Notes

### Breaking API Changes

| Old Parameter | New Parameter | Migration |
|---------------|---------------|-----------|
| `requiredMaxSalary` | `maxBudget` | Rename |
| `requiredMinSalary` | (removed) | Delete from requests |
| `preferredSalaryRange` | (removed) | Delete from requests |
| - | `stretchBudget` | New optional parameter |

### Client Updates Required

Any API clients using salary parameters must update:
1. Rename `requiredMaxSalary` → `maxBudget`
2. Remove `requiredMinSalary` (no longer supported)
3. Remove `preferredSalaryRange` (no longer supported)
4. Optionally add `stretchBudget` for flexible budgets

## References

- Previous salary fairness plan: `thoughts/shared/1_chapter_5/1_project_1/plans/2026-01-06-salary-utility-fairness.md`
- Previous gradual decay plan: `thoughts/shared/1_chapter_5/1_project_1/plans/2026-01-06-salary-utility-gradual-decay.md`
- Current schema: `recommender_api/src/schemas/search.schema.ts:91-94`
- Current constraint expander: `recommender_api/src/services/constraint-expander.service.ts:226-254`
- Current query builder: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts:82-100`
- Current scoring: `recommender_api/src/services/utility-calculator/scoring/logistics-scoring.ts:147-160`
