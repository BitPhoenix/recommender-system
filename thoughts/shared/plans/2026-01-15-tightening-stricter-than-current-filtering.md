# Tightening Generator: "Stricter Than Current" Filtering

## Overview

Currently, `generateTighteningSuggestions` excludes dimensions that have any filter applied. This is incorrect - we should still suggest tightening on already-constrained dimensions, but only suggest values that are **stricter** than the current constraint.

For example:
- User has `maxBudget: $200k` → suggest `$150k` or `$100k` (not `$250k`)
- User has `requiredSeniorityLevel: mid` → suggest `senior` or `staff` (not `junior`)
- User has `requiredMaxStartTime: one_month` → suggest `immediate` or `two_weeks`

## Current State Analysis

### Key Discoveries:

1. **`generateTighteningSuggestions`** at `tightening-generator.service.ts:38` currently filters out constrained dimensions entirely:
   ```typescript
   const constrainedFields = new Set(appliedFilters.map((f) => f.field));
   const unconstrainedDimensions = tighteningDimensions.filter(
     (d) => !constrainedFields.has(d.field)
   );
   ```

2. **`ExpandedSearchCriteria`** (from `constraint-expander.service.ts:39-104`) already contains the original user request values - no need to reverse-engineer from stringified `AppliedFilter`:
   - `maxBudget: number | null` - direct from request
   - `requiredMaxStartTime: StartTimeline | null` - direct from request
   - `timezonePrefixes: string[]` - converted from request
   - `minYearsExperience: number | null` - converted from seniority (but loses the seniority level name)

3. **Missing field**: `requiredSeniorityLevel` is NOT preserved in `ExpandedSearchCriteria`. It gets converted to `minYearsExperience`/`maxYearsExperience` and the original seniority level name is lost. We need to add it.

4. **Strictness orderings** exist for some dimensions:
   - `START_TIMELINE_ORDER` at `search.schema.ts:16-18`: `['immediate', 'two_weeks', 'one_month', 'three_months', 'six_months', 'one_year']`
   - Seniority: `junior < mid < senior < staff < principal`
   - Budget: lower is stricter (numeric comparison)

5. **`TighteningDimension`** interface at line 17 passes `expanded: ExpandedSearchCriteria` - we already have access to user values, just need to use them.

## Desired End State

Each analyze function receives the current filter value for its dimension (if any) and only returns suggestions that are **stricter** than that value. The `generateTighteningSuggestions` function will no longer skip constrained dimensions entirely.

### Verification:
- With `maxBudget: $200k`, budget suggestions should only include `$100k` and `$150k`
- With `requiredSeniorityLevel: mid`, seniority suggestions should only include `senior` and `staff`
- With `requiredMaxStartTime: one_month`, timeline suggestions should only include `immediate` and `two_weeks`
- All existing tests should pass (with modifications to the "excludes constrained fields" test)

## What We're NOT Doing

- **Not changing the relaxation generator** - this only affects tightening
- **Not adding new dimensions** - same five dimensions, just smarter filtering
- **Not changing the API response format** - `TighteningSuggestion` types remain unchanged
- **Not changing the Cypher queries** - distribution analysis stays the same

## Implementation Approach

1. **Replace `tighteningDimensions` array with type-safe `Record`** - keyed by `TighteningSuggestion['field']`, ensuring compile-time completeness
2. **Add `requiredSeniorityLevel` to `ExpandedSearchCriteria`** - preserve the original user value
3. **Use `ExpandedSearchCriteria` directly** - analyzers already receive this, no need for new extraction logic
4. **Modify each analyzer to filter by strictness** - compare suggestions against values already in `expanded`
5. **Remove the "skip constrained dimensions" logic** from `generateTighteningSuggestions`

This approach provides:
- **Type safety**: Adding a new `TighteningSuggestion` variant will cause a compile error until an analyzer is added
- **Simplicity**: No need to parse stringified `AppliedFilter` values - we use typed values directly from `expanded`

## Phase 1: Add Type-Safe Analyzer Registry and `requiredSeniorityLevel`

### Overview
1. Replace the loosely-typed `tighteningDimensions` array with a type-safe `Record` keyed by `TighteningSuggestion['field']`. This ensures compile-time enforcement: adding a new `TighteningSuggestion` variant will error until an analyzer is added.
2. Add `requiredSeniorityLevel` to `ExpandedSearchCriteria` so analyzers can compare against the user's original seniority constraint.

### Changes Required:

#### 1. Add field to ExpandedSearchCriteria
**File**: `recommender_api/src/services/constraint-expander.service.ts`

Add to the `ExpandedSearchCriteria` interface (around line 73, after `preferredSeniorityLevel`):
```typescript
  /** Original seniority constraint for tightening suggestions */
  requiredSeniorityLevel: SeniorityLevel | null;
```

#### 2. Populate the new field in expandSearchCriteria
**File**: `recommender_api/src/services/constraint-expander.service.ts`

Update the return statement (around line 226):
```typescript
    // Pass-through preferred/required values for utility calculation
    preferredSeniorityLevel: request.preferredSeniorityLevel ?? null,
    requiredSeniorityLevel: request.requiredSeniorityLevel ?? null,  // ADD THIS LINE
    preferredMaxStartTime: request.preferredMaxStartTime ?? null,
```

#### 3. Replace TighteningDimension with type-safe registry
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

Replace the `TighteningDimension` interface and `tighteningDimensions` array (lines 13-32) with:
```typescript
import type { TighteningSuggestion } from "../../types/search.types.js";

/**
 * All fields that can have tightening suggestions.
 * Derived from the TighteningSuggestion discriminated union.
 */
type TightenableField = TighteningSuggestion['field'];

/**
 * Function that analyzes result set distribution for a field and generates
 * tightening suggestions (ways to narrow down results).
 */
type TighteningSuggestionGenerator = (
  session: Session,
  expanded: ExpandedSearchCriteria
) => Promise<TighteningSuggestion[]>;

/**
 * Registry mapping each tightenable field to its suggestion generator.
 *
 * Using Record<TightenableField, ...> ensures we have a generator for every
 * field defined in TighteningSuggestion. Adding a new TighteningSuggestion
 * variant (e.g., DomainTightening with field: 'requiredBusinessDomains') will
 * cause a compile error here until a generator is added.
 */
const fieldToTighteningSuggestionGenerator: Record<TightenableField, TighteningSuggestionGenerator> = {
  requiredTimezone: generateTimezoneTighteningSuggestions,
  requiredSeniorityLevel: generateSeniorityTighteningSuggestions,
  maxBudget: generateBudgetTighteningSuggestions,
  requiredMaxStartTime: generateTimelineTighteningSuggestions,
  requiredSkills: generateSkillTighteningSuggestions,
};
```

#### 4. Update generateTighteningSuggestions to use the registry
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

Replace the current implementation:
```typescript
export async function generateTighteningSuggestions(
  session: Session,
  expandedSearchCriteria: ExpandedSearchCriteria,
  appliedFilters: AppliedFilter[],
  maxSuggestions: number = 5
): Promise<TighteningSuggestion[]> {
  /*
   * Run suggestion generators sequentially. Neo4j sessions serialize queries
   * internally anyway (parallel queries require multiple sessions), so sequential
   * execution is both clearer and matches actual behavior.
   *
   * Each generator analyzes the result set distribution for its field and returns
   * suggestions that are stricter than the user's current constraint.
   */
  const allSuggestions: TighteningSuggestion[] = [];

  for (const [field, generateForField] of Object.entries(fieldToTighteningSuggestionGenerator)) {
    try {
      const suggestions = await generateForField(session, expandedSearchCriteria);
      allSuggestions.push(...suggestions);
    } catch (error) {
      console.warn(`Tightening suggestion generation failed for field "${field}":`, error);
    }
  }

  // Sort by effectiveness (biggest reduction in results)
  allSuggestions.sort((a, b) => a.resultingMatches - b.resultingMatches);

  return allSuggestions.slice(0, maxSuggestions);
}
```

#### 5. Update test helper to include new field
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.test.ts`

Update `createBaseExpanded()` (around line 18):
```typescript
function createBaseExpanded(): ExpandedSearchCriteria {
  return {
    minYearsExperience: null,
    maxYearsExperience: null,
    startTimeline: ["immediate", "two_weeks", "one_month"],
    timezonePrefixes: [],
    maxBudget: null,
    stretchBudget: null,
    alignedSkillIds: [],
    limit: 20,
    offset: 0,
    appliedFilters: [],
    appliedPreferences: [],
    defaultsApplied: [],
    preferredSeniorityLevel: null,
    requiredSeniorityLevel: null,  // ADD THIS LINE
    preferredMaxStartTime: null,
    requiredMaxStartTime: "one_month",
    preferredTimezone: [],
    derivedConstraints: [],
    derivedRequiredSkillIds: [],
    derivedSkillBoosts: new Map(),
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All existing tests pass: `npm test -- src/services/constraint-advisor/tightening-generator.service.test.ts`

---

## Phase 2: Rename and Update Suggestion Generators with Strictness Filtering

### Overview
1. Rename the `analyze*Distribution` functions to `generate*Suggestions` for clarity
2. Update each generator to compare suggestions against current constraint values from `expanded`

### Changes Required:

#### 1. Add SENIORITY_LEVEL_ORDER to schema (following existing pattern)
**File**: `recommender_api/src/schemas/search.schema.ts`

Update the seniority schema to follow the same pattern as `START_TIMELINE_ORDER` and `PROFICIENCY_LEVEL_ORDER` (around line 12):
```typescript
export const SENIORITY_LEVEL_ORDER = [
  'junior', 'mid', 'senior', 'staff', 'principal'
] as const;

export const SeniorityLevelSchema = z.enum(SENIORITY_LEVEL_ORDER);
```

#### 2. Export SENIORITY_LEVEL_ORDER from types
**File**: `recommender_api/src/types/search.types.ts`

Add to the re-exports (around line 25):
```typescript
export { START_TIMELINE_ORDER, PROFICIENCY_LEVEL_ORDER, SENIORITY_LEVEL_ORDER } from '../schemas/search.schema.js';
```

#### 3. Import ordering constants in tightening generator
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

Add import (around line 11):
```typescript
import { START_TIMELINE_ORDER, SENIORITY_LEVEL_ORDER } from "../../types/search.types.js";
```

#### 2. Rename analyzeTimezoneDistribution → generateTimezoneTighteningSuggestions
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

Update the suggestion filtering logic (in the for loop):
```typescript
      const suggestedPrefix = tzPrefix[region];
      if (suggestedPrefix) {
        /*
         * Skip if user already has this exact timezone filter.
         * Timezone doesn't have a strict ordering, so we only filter out
         * suggestions that match the current constraint exactly.
         */
        const alreadyFiltered = expanded.timezonePrefixes.some(
          (tz) => suggestedPrefix.startsWith(tz) || tz.startsWith(suggestedPrefix.replace('*', ''))
        );

        if (!alreadyFiltered) {
          suggestions.push({
            // ... existing suggestion object
          });
        }
      }
```

#### 3. Rename analyzeExperienceDistribution → generateSeniorityTighteningSuggestions
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

Update to use `expanded.requiredSeniorityLevel`:
```typescript
  /*
   * Determine minimum seniority index to suggest.
   * If user already has a seniority constraint, only suggest stricter (higher index).
   */
  const currentSeniority = expanded.requiredSeniorityLevel;
  const currentIndex = currentSeniority
    ? SENIORITY_LEVEL_ORDER.indexOf(currentSeniority)
    : -1;

  for (const record of result.records) {
    const level = record.get("level") as string;
    const count = record.get("count")?.toNumber?.() ?? 0;
    const percentage = Math.round((count / total) * 100);

    // Map staff+ to staff for comparison
    const normalizedLevel = level === "staff+" ? "staff" : level;
    const levelIndex = SENIORITY_LEVEL_ORDER.indexOf(normalizedLevel as typeof SENIORITY_LEVEL_ORDER[number]);

    /*
     * Only suggest if:
     * 1. Would reduce results (count < total)
     * 2. Not junior (never suggest downgrading)
     * 3. Stricter than current constraint (higher index)
     */
    if (count < total && level !== "junior" && levelIndex > currentIndex) {
      suggestions.push({
        // ... existing suggestion object
      });
    }
  }
```

#### 4. Rename analyzeSalaryDistribution → generateBudgetTighteningSuggestions
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

Update to use `expanded.maxBudget`:
```typescript
    /*
     * Only suggest budget caps that are:
     * 1. Below the current constraint (stricter = lower budget)
     * 2. Would actually reduce results (cumulative < total)
     */
    const isStricterThanCurrent = expanded.maxBudget === null || bucket < expanded.maxBudget;

    if (cumulative < total && isStricterThanCurrent) {
      suggestions.push({
        // ... existing suggestion object
      });
    }
```

#### 5. Rename analyzeTimelineDistribution → generateTimelineTighteningSuggestions
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

Update to use `expanded.requiredMaxStartTime`:
```typescript
  /*
   * Determine maximum timeline index to suggest.
   * If user has a timeline constraint, only suggest stricter (lower index = faster).
   */
  const currentTimeline = expanded.requiredMaxStartTime;
  const currentIndex = currentTimeline
    ? START_TIMELINE_ORDER.indexOf(currentTimeline)
    : START_TIMELINE_ORDER.length; // No constraint = all timelines valid

  // Find all timelines that are stricter than current
  for (const record of result.records) {
    const timeline = record.get("timeline") as string;
    const count = record.get("count")?.toNumber?.() ?? 0;
    const timelineIndex = START_TIMELINE_ORDER.indexOf(timeline as typeof START_TIMELINE_ORDER[number]);

    /*
     * Only suggest if:
     * 1. Would reduce results (count < total)
     * 2. Stricter than current (lower index = faster timeline)
     * 3. Valid timeline in our ordering
     */
    if (count > 0 && count < total && timelineIndex >= 0 && timelineIndex < currentIndex) {
      suggestions.push({
        // ... existing suggestion object
      });
    }
  }
```

#### 6. Rename analyzeSkillDistribution → generateSkillTighteningSuggestions
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

Update to check required skills from `expanded.appliedFilters`:
```typescript
  /*
   * Get currently required skill IDs from appliedFilters.
   * We need to check appliedFilters because requiredSkills are stored there
   * as AppliedSkillFilter with the resolved skill IDs.
   */
  const requiredSkillFilter = expanded.appliedFilters.find(
    (f): f is AppliedSkillFilter => f.kind === AppliedFilterKind.Skill && f.field === 'requiredSkills'
  );
  const currentSkillIds = requiredSkillFilter?.skills.map(s => s.skillId) ?? [];

  for (const record of result.records) {
    const skillName = record.get("skillName") as string;
    const skillId = record.get("skillId") as string;
    const count = record.get("engineerCount")?.toNumber?.() ?? 0;
    const percentage = Math.round((count / total) * 100);

    /*
     * Only suggest skills that:
     * 1. Are common enough to be useful (>20% of engineers)
     * 2. Would actually reduce results (not 100%)
     * 3. Are not already required by the user
     */
    const alreadyRequired = currentSkillIds.includes(skillId);

    if (percentage >= 20 && count < total && !alreadyRequired) {
      suggestions.push({
        // ... existing suggestion object
      });
    }
  }
```

Also add the import for `AppliedSkillFilter` and `AppliedFilterKind` at the top of the file.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All existing tests pass: `npm test -- src/services/constraint-advisor/tightening-generator.service.test.ts`

---

## Phase 3: Update Tests

### Overview
Update the test file to verify the new strictness filtering behavior and modify tests that assumed constrained dimensions were skipped entirely.

### Changes Required:

#### 1. Replace "excludes already-constrained fields" test with strictness tests
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.test.ts`

Replace the test at line 259-291 with a new `describe("strictness filtering")` block:

```typescript
describe("strictness filtering", () => {
  it("only suggests budget values stricter than current constraint", async () => {
    session.mockRun.mockImplementation((query: string) => {
      if (query.includes("salaryBucket")) {
        return {
          records: [
            { get: (field: string) => field === "salaryBucket" ? { toNumber: () => 100000 } : { toNumber: () => 10 } },
            { get: (field: string) => field === "salaryBucket" ? { toNumber: () => 150000 } : { toNumber: () => 15 } },
            { get: (field: string) => field === "salaryBucket" ? { toNumber: () => 200000 } : { toNumber: () => 10 } },
          ],
        };
      }
      return { records: [] };
    });

    // User already has maxBudget at $200k - set directly in expanded
    const expandedWithBudget = { ...baseExpanded, maxBudget: 200000 };

    const suggestions = await generateTighteningSuggestions(
      session as any,
      expandedWithBudget,
      [],  // appliedFilters not needed - we read from expanded
      10
    );

    const budgetSuggestions = suggestions.filter((s) => s.field === "maxBudget");

    // Should suggest $100k and $150k (stricter than $200k), but not $200k itself
    expect(budgetSuggestions.map(s => s.suggestedValue)).toContain(100000);
    expect(budgetSuggestions.map(s => s.suggestedValue)).toContain(150000);
    expect(budgetSuggestions.map(s => s.suggestedValue)).not.toContain(200000);
  });

  it("only suggests seniority levels stricter than current constraint", async () => {
    session.mockRun.mockImplementation((query: string) => {
      if (query.includes("yearsExperience >= 9")) {
        return {
          records: [
            { get: (field: string) => {
              if (field === "level") return "staff+";
              if (field === "count") return { toNumber: () => 5 };
              return { toNumber: () => 9 };
            }},
            { get: (field: string) => {
              if (field === "level") return "senior";
              if (field === "count") return { toNumber: () => 15 };
              return { toNumber: () => 6 };
            }},
            { get: (field: string) => {
              if (field === "level") return "mid";
              if (field === "count") return { toNumber: () => 20 };
              return { toNumber: () => 3 };
            }},
          ],
        };
      }
      return { records: [] };
    });

    // User already has requiredSeniorityLevel at mid - set directly in expanded
    const expandedWithSeniority = { ...baseExpanded, requiredSeniorityLevel: "mid" as const };

    const suggestions = await generateTighteningSuggestions(
      session as any,
      expandedWithSeniority,
      [],
      10
    );

    const senioritySuggestions = suggestions.filter((s) => s.field === "requiredSeniorityLevel");

    // Should suggest senior and staff (stricter than mid), but not mid or junior
    const suggestedValues = senioritySuggestions.map(s => s.suggestedValue);
    expect(suggestedValues).toContain("senior");
    expect(suggestedValues).toContain("staff");
    expect(suggestedValues).not.toContain("mid");
    expect(suggestedValues).not.toContain("junior");
  });

  it("only suggests timelines stricter than current constraint", async () => {
    session.mockRun.mockImplementation((query: string) => {
      if (query.includes("e.startTimeline AS timeline")) {
        return {
          records: [
            { get: (field: string) => field === "timeline" ? "immediate" : { toNumber: () => 10 } },
            { get: (field: string) => field === "timeline" ? "two_weeks" : { toNumber: () => 15 } },
            { get: (field: string) => field === "timeline" ? "one_month" : { toNumber: () => 10 } },
          ],
        };
      }
      return { records: [] };
    });

    // User already has requiredMaxStartTime at one_month - already in baseExpanded
    // baseExpanded.requiredMaxStartTime is "one_month"

    const suggestions = await generateTighteningSuggestions(
      session as any,
      baseExpanded,
      [],
      10
    );

    const timelineSuggestions = suggestions.filter((s) => s.field === "requiredMaxStartTime");

    // Should suggest immediate and two_weeks (stricter than one_month)
    const suggestedValues = timelineSuggestions.map(s => s.suggestedValue);
    expect(suggestedValues).toContain("immediate");
    expect(suggestedValues).toContain("two_weeks");
    expect(suggestedValues).not.toContain("one_month");
  });

  it("excludes skills already in requiredSkills", async () => {
    session.mockRun.mockImplementation((query: string) => {
      if (query.includes("HAS_SKILL")) {
        return {
          records: [
            { get: (field: string) => {
              if (field === "skillName") return "TypeScript";
              if (field === "skillId") return "skill_typescript";
              if (field === "engineerCount") return { toNumber: () => 20 };
              if (field === "proficiencies") return ["proficient", "expert"];
              return null;
            }},
            { get: (field: string) => {
              if (field === "skillName") return "React";
              if (field === "skillId") return "skill_react";
              if (field === "engineerCount") return { toNumber: () => 15 };
              if (field === "proficiencies") return ["proficient"];
              return null;
            }},
          ],
        };
      }
      if (query.includes("count(e) AS total")) {
        return { records: [{ get: () => ({ toNumber: () => 40 }) }] };
      }
      return { records: [] };
    });

    // User already requires TypeScript - add to appliedFilters in expanded
    const skillFilter: AppliedFilter = {
      kind: AppliedFilterKind.Skill,
      field: "requiredSkills",
      operator: "HAS_ALL",
      skills: [{ skillId: "skill_typescript", skillName: "TypeScript" }],
      displayValue: "TypeScript",
      source: "user",
    };
    const expandedWithSkill = {
      ...baseExpanded,
      appliedFilters: [skillFilter],
    };

    const suggestions = await generateTighteningSuggestions(
      session as any,
      expandedWithSkill,
      [],
      10
    );

    const skillSuggestions = suggestions.filter((s) => s.field === "requiredSkills");

    // Should suggest React but not TypeScript (already required)
    expect(skillSuggestions.some(s => (s.suggestedValue as any).skill === "skill_react")).toBe(true);
    expect(skillSuggestions.some(s => (s.suggestedValue as any).skill === "skill_typescript")).toBe(false);
  });
});
```

#### 2. Delete the old "excludes already-constrained fields from suggestions" test
The test at line 259-291 should be removed entirely - it tested the old behavior of skipping constrained dimensions.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tests pass: `npm test -- src/services/constraint-advisor/tightening-generator.service.test.ts`
- [x] E2E tests pass: `npm run test:e2e`

---

## Testing Strategy

### Unit Tests:
- Test that each analyzer filters by strictness correctly
- Test edge cases: no current constraint, constraint at strictest level already
- Test the `extractCurrentConstraints` function with various AppliedFilter formats

### Integration Tests:
- Test full flow through `generateTighteningSuggestions` with various constraint combinations
- Verify sorting by effectiveness still works correctly

## References

- Current implementation: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`
- Types: `recommender_api/src/types/search.types.ts:479-536`
- Schema orderings: `recommender_api/src/schemas/search.schema.ts:16-24`
- Tests: `recommender_api/src/services/constraint-advisor/tightening-generator.service.test.ts`
