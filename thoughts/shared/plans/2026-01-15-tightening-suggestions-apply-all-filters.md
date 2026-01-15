# Tightening Suggestions: Apply All Filters Implementation Plan

## Overview

Fix tightening suggestions to apply ALL user constraints when calculating `resultingMatches`, not just `startTimeline`. Currently, the tightening generators run isolated queries that don't account for the user's other filters (skills, seniority, timezone, budget), leading to misleading counts.

## Current State Analysis

### The Problem

Each tightening generator in `tightening-generator.service.ts` runs its own direct Neo4j query that only filters by a subset of constraints:

| Generator | Current Filters Applied | Missing Filters |
|-----------|------------------------|-----------------|
| Budget | `startTimeline`, `salary` | skills, seniority, timezone, domains |
| Seniority | `startTimeline` | skills, budget, timezone, domains |
| Timezone | `startTimeline` | skills, seniority, budget, domains |
| Timeline | **none** | ALL filters |
| Skills | `startTimeline` | other skills, seniority, budget, timezone, domains |

**Example of misleading output**: If a user has `requiredSkills: [React], requiredSeniorityLevel: senior, maxBudget: 200000`, the budget suggestion might say "120 engineers earn ≤$160k" - but most of those 120 might not have React skills or might not be senior level. The actual count after applying all filters could be much lower (perhaps 15 engineers).

### Key Discoveries

1. **Relaxation testing does this correctly** (`relaxation-tester.service.ts`):
   - Uses `decomposeConstraints()` to convert `AppliedFilter[]` into `TestableConstraint[]`
   - Uses `buildQueryWithConstraints()` to build queries with all constraints
   - Uses `testRelaxedValue()` to test modified property values while keeping other constraints

2. **The decomposer already exists** (`constraint-decomposer.service.ts:29-51`):
   - `decomposeConstraints(appliedFilters)` returns `DecomposedConstraints`
   - `buildPropertyConditions(decomposed, constraintIds)` builds WHERE clauses
   - `buildQueryWithConstraints(decomposed, constraintIds)` builds complete count queries

3. **Tightening generators receive the data they need** (`tightening-generator.service.ts:66-95`):
   - Already receives `expandedSearchCriteria` which contains `appliedFilters`
   - Currently ignores the `_appliedFilters` parameter (unused!)

## Desired End State

After implementation:
1. Each tightening suggestion's `resultingMatches` reflects the count with ALL current user filters applied PLUS the tightening constraint
2. The tightening generators reuse the existing decomposer/tester infrastructure
3. No duplicate query-building logic

### Verification

Run the following test case:
```typescript
// Request with multiple constraints
const request = {
  requiredSkills: [{ skill: 'react', minProficiency: 'proficient' }],
  requiredSeniorityLevel: 'senior',
  maxBudget: 200000,
  requiredMaxStartTime: 'one_month'
};

// Budget tightening suggestion for $160k should return count where:
// - Engineer has React at proficient+
// - Engineer is senior+
// - Engineer is available within one_month
// - Engineer salary <= $160k
// NOT just: Engineer salary <= $160k AND startTimeline in [immediate, two_weeks, one_month]
```

## What We're NOT Doing

- Not changing the relaxation generator or tester (they already work correctly)
- Not adding new filter types
- Not changing the TighteningSuggestion response format
- Not changing the threshold for when tightening is triggered (MANY_RESULTS_THRESHOLD = 25)

## Implementation Approach

Refactor tightening generators to use the same pattern as relaxation testing:
1. Use existing `decomposeConstraints()` to get testable constraints
2. Create a new `testTightenedValue()` function (analogous to `testRelaxedValue()`)
3. Rewrite each generator to use the shared infrastructure

The key insight: tightening is conceptually similar to relaxation testing, except we're testing a STRICTER value instead of a LOOSER one. The mechanics (build query with all constraints, modify one, count results) are identical.

## Phase 1: Add Tightening Tester Service

### Overview

Create a new `tightening-tester.service.ts` with functions to test tightened values while applying all other constraints. This mirrors the structure of `relaxation-tester.service.ts`.

### Changes Required

#### 1. Create tightening-tester.service.ts

**File**: `recommender_api/src/services/constraint-advisor/tightening-tester.service.ts`

```typescript
import type { Session } from "neo4j-driver";
import {
  ConstraintType,
  type DecomposedConstraints,
  type PropertyConstraint,
} from "./constraint.types.js";
import { buildQueryWithConstraints, buildPropertyConditions } from "./constraint-decomposer.service.js";
import { groupSkillsByProficiency } from "../skill-resolution.service.js";
import { buildSkillFilterCountQuery } from "../cypher-query-builder/index.js";
import type { ResolvedSkillWithProficiency } from "../skill-resolver.service.js";
import type { ProficiencyLevel } from "../../types/search.types.js";

/**
 * Test what result count we'd get with a tightened property value.
 * This is the inverse of testRelaxedValue - we're testing a STRICTER constraint.
 *
 * Example: If current maxBudget is $200k and we want to test $160k,
 * this runs a count query with all other constraints PLUS salary <= $160k.
 */
export async function testTightenedPropertyValue(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: PropertyConstraint,
  tightenedValue: unknown
): Promise<number> {
  /*
   * Create a modified decomposition with the tightened value.
   * This replaces the constraint's paramValue with the stricter value.
   */
  const modifiedConstraints = decomposedConstraints.constraints.map((c) => {
    if (c.id === constraint.id && c.constraintType === ConstraintType.Property) {
      return {
        ...c,
        cypher: {
          ...c.cypher,
          paramValue: tightenedValue,
        },
      };
    }
    return c;
  });

  const modifiedDecomposed = {
    ...decomposedConstraints,
    constraints: modifiedConstraints,
  };

  const allIds = new Set(modifiedConstraints.map((c) => c.id));
  const { query, params } = buildQueryWithConstraints(modifiedDecomposed, allIds);

  const result = await session.run(query, params);
  return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
}

/**
 * Test what result count we'd get with an ADDED property constraint.
 * Used when the user doesn't currently have a constraint on this field.
 *
 * Example: User has no timezone filter, we want to test adding "America/*".
 */
export async function testAddedPropertyConstraint(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  field: string,
  operator: string,
  value: unknown,
  paramPrefix: string
): Promise<number> {
  /*
   * Build property conditions from existing constraints, then add the new one.
   */
  const allPropertyIds = new Set(
    decomposedConstraints.constraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const { whereClauses, params } = buildPropertyConditions(decomposedConstraints, allPropertyIds);

  // Add the new constraint
  const newParamName = `tighten_${paramPrefix}`;
  const newClause = buildWhereClause(field, operator, newParamName);
  whereClauses.push(newClause);
  params[newParamName] = value;

  // Check if we have skill constraints to include
  const hasSkillConstraints = decomposedConstraints.constraints.some(
    c => c.constraintType === ConstraintType.SkillTraversal
  );

  if (hasSkillConstraints) {
    // Need to use skill query builder
    const { userRequiredSkills, derivedSkillIds } = extractSkillsFromConstraints(decomposedConstraints);
    if (userRequiredSkills.length > 0 || derivedSkillIds.length > 0) {
      const skillGroups = groupSkillsByProficiency(userRequiredSkills);
      const { query, params: skillParams } = buildSkillFilterCountQuery(
        skillGroups,
        { whereClauses, params },
        derivedSkillIds
      );
      const result = await session.run(query, skillParams);
      return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
    }
  }

  // No skill constraints - simple property query
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join("\n  AND ")}` : "";
  const query = `
${decomposedConstraints.baseMatchClause}
${whereClause}
RETURN count(e) AS resultCount
`;

  const result = await session.run(query, params);
  return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
}

/**
 * Test what result count we'd get with an added skill requirement.
 * Used for skill tightening suggestions.
 */
export async function testAddedSkillConstraint(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  newSkillId: string,
  newSkillMinProficiency: ProficiencyLevel
): Promise<number> {
  // Get existing skills from constraints
  const { userRequiredSkills, derivedSkillIds } = extractSkillsFromConstraints(decomposedConstraints);

  // Add the new skill
  const allSkills: ResolvedSkillWithProficiency[] = [
    ...userRequiredSkills,
    {
      skillId: newSkillId,
      skillName: newSkillId, // Name not needed for query
      minProficiency: newSkillMinProficiency,
      preferredMinProficiency: null,
    },
  ];

  // Build property conditions from all property constraints
  const propertyConstraintIds = new Set(
    decomposedConstraints.constraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const propertyConditions = buildPropertyConditions(decomposedConstraints, propertyConstraintIds);

  // Build and run the query
  const skillGroups = groupSkillsByProficiency(allSkills);
  const { query, params } = buildSkillFilterCountQuery(skillGroups, propertyConditions, derivedSkillIds);

  const result = await session.run(query, params);
  return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
}

/**
 * Get count with ALL current constraints applied (no modifications).
 * Used as the baseline "total" for percentage calculations.
 */
export async function getBaselineCount(
  session: Session,
  decomposedConstraints: DecomposedConstraints
): Promise<number> {
  const hasSkillConstraints = decomposedConstraints.constraints.some(
    c => c.constraintType === ConstraintType.SkillTraversal
  );

  if (hasSkillConstraints) {
    const { userRequiredSkills, derivedSkillIds } = extractSkillsFromConstraints(decomposedConstraints);
    if (userRequiredSkills.length > 0 || derivedSkillIds.length > 0) {
      const propertyConstraintIds = new Set(
        decomposedConstraints.constraints
          .filter(c => c.constraintType === ConstraintType.Property)
          .map(c => c.id)
      );
      const propertyConditions = buildPropertyConditions(decomposedConstraints, propertyConstraintIds);
      const skillGroups = groupSkillsByProficiency(userRequiredSkills);
      const { query, params } = buildSkillFilterCountQuery(skillGroups, propertyConditions, derivedSkillIds);

      const result = await session.run(query, params);
      return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
    }
  }

  // No skill constraints - use property-only query
  const allIds = new Set(decomposedConstraints.constraints.map(c => c.id));
  const { query, params } = buildQueryWithConstraints(decomposedConstraints, allIds);

  const result = await session.run(query, params);
  return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function buildWhereClause(field: string, operator: string, paramName: string): string {
  const cypherField = field === "salary" ? "e.salary" : `e.${field}`;

  switch (operator) {
    case "IN":
      return `${cypherField} IN $${paramName}`;
    case "STARTS WITH":
      return `${cypherField} STARTS WITH $${paramName}`;
    case "<=":
      return `${cypherField} <= $${paramName}`;
    case ">=":
      return `${cypherField} >= $${paramName}`;
    default:
      return `${cypherField} ${operator} $${paramName}`;
  }
}

interface ExtractedSkills {
  userRequiredSkills: ResolvedSkillWithProficiency[];
  derivedSkillIds: string[];
}

function extractSkillsFromConstraints(decomposed: DecomposedConstraints): ExtractedSkills {
  const userRequiredSkills: ResolvedSkillWithProficiency[] = [];
  const derivedSkillIds: string[] = [];

  for (const constraint of decomposed.constraints) {
    if (constraint.constraintType !== ConstraintType.SkillTraversal) continue;

    if (constraint.field === 'requiredSkills' && 'value' in constraint) {
      const value = constraint.value as { skill: string; minProficiency?: ProficiencyLevel };
      userRequiredSkills.push({
        skillId: value.skill,
        skillName: value.skill,
        minProficiency: value.minProficiency ?? 'learning',
        preferredMinProficiency: null,
      });
    } else if (constraint.field === 'derivedSkills' && Array.isArray(constraint.value)) {
      derivedSkillIds.push(...(constraint.value as string[]));
    }
  }

  return {
    userRequiredSkills,
    derivedSkillIds: [...new Set(derivedSkillIds)],
  };
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test`
- [x] New tester functions are importable

#### Manual Verification:
- [x] None required for this phase

---

## Phase 2: Refactor Tightening Generators

### Overview

Rewrite each tightening generator to use the new tester functions and existing decomposer infrastructure.

### Changes Required

#### 1. Update generateTighteningSuggestions signature

**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

Change the main function to accept `DecomposedConstraints` instead of (or in addition to) raw `ExpandedSearchCriteria`:

```typescript
import { decomposeConstraints } from "./constraint-decomposer.service.js";
import {
  testTightenedPropertyValue,
  testAddedPropertyConstraint,
  testAddedSkillConstraint,
  getBaselineCount,
} from "./tightening-tester.service.js";

/**
 * Generate tightening suggestions when results exceed threshold.
 * Each generator filters suggestions to only include values stricter than current constraints.
 */
export async function generateTighteningSuggestions(
  session: Session,
  expandedSearchCriteria: ExpandedSearchCriteria,
  appliedFilters: AppliedFilter[],
  maxSuggestions: number = 5
): Promise<TighteningSuggestion[]> {
  // Decompose filters for query building
  const decomposed = decomposeConstraints(appliedFilters);

  // Get baseline count (with all current filters)
  const baselineCount = await getBaselineCount(session, decomposed);
  if (baselineCount === 0) {
    return []; // No results to tighten
  }

  const allSuggestions: TighteningSuggestion[] = [];

  for (const [field, generateForField] of Object.entries(fieldToTighteningSuggestionGenerator)) {
    try {
      const suggestions = await generateForField(
        session,
        expandedSearchCriteria,
        decomposed,
        baselineCount
      );
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

#### 2. Update generator function signature type

```typescript
type TighteningSuggestionGenerator = (
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
) => Promise<TighteningSuggestion[]>;
```

#### 3. Rewrite generateBudgetTighteningSuggestions

```typescript
async function generateBudgetTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
): Promise<BudgetTightening[]> {
  const currentBudget = expanded.maxBudget;

  // Can't tighten if no budget constraint exists
  if (currentBudget === null) {
    return [];
  }

  // Find the budget constraint in decomposed
  const budgetConstraint = decomposed.constraints.find(
    c => c.constraintType === ConstraintType.Property && c.field === 'salary'
  ) as PropertyConstraint | undefined;

  if (!budgetConstraint) {
    return [];
  }

  // Step-down multipliers - suggest tighter budgets as fractions of current
  const stepDownMultipliers = [0.8, 0.7, 0.6];
  const thresholds = stepDownMultipliers
    .map(m => Math.floor(currentBudget * m))
    .filter(t => t > 0);

  const suggestions: BudgetTightening[] = [];

  for (const threshold of thresholds) {
    const count = await testTightenedPropertyValue(
      session,
      decomposed,
      budgetConstraint,
      threshold
    );

    // Only suggest if it would reduce results
    if (count > 0 && count < baselineCount) {
      const percentage = Math.round((count / baselineCount) * 100);
      suggestions.push({
        field: "maxBudget",
        suggestedValue: threshold,
        rationale: `Lower budget cap to $${threshold.toLocaleString()}`,
        resultingMatches: count,
        distributionInfo: `${count} of ${baselineCount} matching engineers (${percentage}%) earn ≤$${threshold.toLocaleString()}`,
      });
    }
  }

  return suggestions;
}
```

#### 4. Rewrite generateSeniorityTighteningSuggestions

```typescript
async function generateSeniorityTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
): Promise<SeniorityTightening[]> {
  /*
   * Seniority tightening suggests adding/tightening a seniority constraint.
   * We need to test each level to see how many results we'd get.
   */
  const currentSeniority = expanded.requiredSeniorityLevel;
  const currentIndex = currentSeniority
    ? SENIORITY_LEVEL_ORDER.indexOf(currentSeniority)
    : -1;

  // Find existing experience constraint if any
  const experienceConstraint = decomposed.constraints.find(
    c => c.constraintType === ConstraintType.Property &&
         c.field === 'yearsExperience' &&
         c.operator === '>='
  ) as PropertyConstraint | undefined;

  const suggestions: SeniorityTightening[] = [];

  // Test each seniority level stricter than current
  for (let i = currentIndex + 1; i < SENIORITY_LEVEL_ORDER.length; i++) {
    const level = SENIORITY_LEVEL_ORDER[i];
    if (level === 'junior') continue; // Never suggest downgrading

    const minYears = seniorityMinYears[level as keyof typeof seniorityMinYears];

    let count: number;
    if (experienceConstraint) {
      // Modify existing constraint
      count = await testTightenedPropertyValue(
        session,
        decomposed,
        experienceConstraint,
        minYears
      );
    } else {
      // Add new constraint
      count = await testAddedPropertyConstraint(
        session,
        decomposed,
        'yearsExperience',
        '>=',
        minYears,
        'seniority'
      );
    }

    if (count > 0 && count < baselineCount) {
      const percentage = Math.round((count / baselineCount) * 100);
      suggestions.push({
        field: "requiredSeniorityLevel",
        suggestedValue: level,
        rationale: `Filter to ${level} level engineers (${minYears}+ years)`,
        resultingMatches: count,
        distributionInfo: `${count} of ${baselineCount} matching engineers (${percentage}%) are ${level} level`,
      });
    }
  }

  return suggestions;
}
```

#### 5. Rewrite generateTimezoneTighteningSuggestions

```typescript
async function generateTimezoneTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
): Promise<TimezoneTightening[]> {
  /*
   * Timezone tightening suggests adding a regional filter.
   * We test each region to see how many matching results we'd get.
   */
  const suggestions: TimezoneTightening[] = [];

  for (const [region, pattern] of Object.entries(regionToTimezonePattern)) {
    const prefix = pattern.replace('*', '');

    // Skip if user already has this timezone filter
    const alreadyFiltered = expanded.timezonePrefixes.some(
      (tz) => prefix.startsWith(tz) || tz.startsWith(prefix)
    );
    if (alreadyFiltered) continue;

    const count = await testAddedPropertyConstraint(
      session,
      decomposed,
      'timezone',
      'STARTS WITH',
      prefix,
      `tz_${region.toLowerCase()}`
    );

    if (count > 0 && count < baselineCount) {
      const percentage = Math.round((count / baselineCount) * 100);
      suggestions.push({
        field: "requiredTimezone",
        suggestedValue: [pattern],
        rationale: `Filter to ${region} timezone engineers`,
        resultingMatches: count,
        distributionInfo: `${count} of ${baselineCount} matching engineers (${percentage}%) are in ${region}`,
      });
    }
  }

  return suggestions;
}
```

#### 6. Rewrite generateTimelineTighteningSuggestions

```typescript
async function generateTimelineTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
): Promise<StartTimeTightening[]> {
  /*
   * Timeline tightening suggests stricter availability requirements.
   */
  const currentTimeline = expanded.requiredMaxStartTime;
  const currentIndex = currentTimeline
    ? START_TIMELINE_ORDER.indexOf(currentTimeline)
    : START_TIMELINE_ORDER.length;

  // Find existing startTimeline constraint
  const timelineConstraint = decomposed.constraints.find(
    c => c.constraintType === ConstraintType.Property && c.field === 'startTimeline'
  ) as PropertyConstraint | undefined;

  const suggestions: StartTimeTightening[] = [];

  // Test each timeline stricter than current (lower index = faster)
  for (let i = 0; i < currentIndex; i++) {
    const timeline = START_TIMELINE_ORDER[i];

    // Build array of all timelines up to and including this one
    const allowedTimelines = START_TIMELINE_ORDER.slice(0, i + 1);

    let count: number;
    if (timelineConstraint) {
      count = await testTightenedPropertyValue(
        session,
        decomposed,
        timelineConstraint,
        allowedTimelines
      );
    } else {
      count = await testAddedPropertyConstraint(
        session,
        decomposed,
        'startTimeline',
        'IN',
        allowedTimelines,
        'timeline'
      );
    }

    if (count > 0 && count < baselineCount) {
      const percentage = Math.round((count / baselineCount) * 100);
      suggestions.push({
        field: "requiredMaxStartTime",
        suggestedValue: timeline,
        rationale: `Filter to engineers available within ${timeline.replace('_', ' ')}`,
        resultingMatches: count,
        distributionInfo: `${count} of ${baselineCount} matching engineers (${percentage}%) are available within ${timeline.replace('_', ' ')}`,
      });
    }
  }

  return suggestions;
}
```

#### 7. Rewrite generateSkillTighteningSuggestions

```typescript
async function generateSkillTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
): Promise<SkillTightening[]> {
  /*
   * Skill tightening suggests adding skill requirements.
   * We need to find popular skills among current matches, then test adding each.
   *
   * This requires a distribution query first, then testing each candidate.
   */

  // Get currently required skill IDs
  const requiredSkillFilter = expanded.appliedFilters.find(
    (f): f is AppliedSkillFilter => f.kind === AppliedFilterKind.Skill && f.field === 'requiredSkills'
  );
  const currentSkillIds = requiredSkillFilter?.skills.map(s => s.skillId) ?? [];

  /*
   * For skill distribution, we still need a query to find WHICH skills are common
   * among our current result set. This distribution query should apply all filters.
   *
   * We'll build a query that:
   * 1. Matches engineers passing all current constraints
   * 2. Collects their skills
   * 3. Counts skill frequency
   */
  const propertyConstraintIds = new Set(
    decomposed.constraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const { whereClauses, params } = buildPropertyConditions(decomposed, propertyConstraintIds);

  // Check for skill constraints
  const hasSkillConstraints = decomposed.constraints.some(
    c => c.constraintType === ConstraintType.SkillTraversal
  );

  let distributionQuery: string;
  let distributionParams: Record<string, unknown>;

  if (hasSkillConstraints) {
    // Use full skill-aware query for distribution
    // This is more complex - need to find skills among filtered engineers
    const { userRequiredSkills, derivedSkillIds } = extractSkillsFromDecomposed(decomposed);
    const skillGroups = groupSkillsByProficiency(userRequiredSkills);

    // Build a modified query that collects skill distribution
    // (This may need a specialized builder - see implementation notes)
    distributionQuery = buildSkillDistributionQuery(skillGroups, whereClauses, derivedSkillIds);
    distributionParams = { ...params, ...buildSkillParams(skillGroups, derivedSkillIds) };
  } else {
    // Simple distribution query when no skill constraints
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join("\n  AND ")}` : "";
    distributionQuery = `
      MATCH (e:Engineer)
      ${whereClause}
      MATCH (e)-[r:HAS_SKILL]->(s:Skill)
      WITH s.name AS skillName, s.id AS skillId, count(DISTINCT e) AS engineerCount
      ORDER BY engineerCount DESC
      LIMIT 10
      RETURN skillName, skillId, engineerCount
    `;
    distributionParams = params;
  }

  const result = await session.run(distributionQuery, distributionParams);
  const suggestions: SkillTightening[] = [];

  for (const record of result.records) {
    const skillName = record.get("skillName") as string;
    const skillId = record.get("skillId") as string;
    const frequencyCount = record.get("engineerCount")?.toNumber?.() ?? 0;
    const percentage = Math.round((frequencyCount / baselineCount) * 100);

    // Skip if already required or too rare
    if (currentSkillIds.includes(skillId) || percentage < 20) continue;

    // Test what we'd get if we added this skill as a requirement
    const count = await testAddedSkillConstraint(
      session,
      decomposed,
      skillId,
      'familiar'
    );

    if (count > 0 && count < baselineCount) {
      suggestions.push({
        field: "requiredSkills",
        suggestedValue: { skill: skillId, minProficiency: "familiar" },
        rationale: `Add ${skillName} as a required skill`,
        resultingMatches: count,
        distributionInfo: `${count} of ${baselineCount} matching engineers (${Math.round((count / baselineCount) * 100)}%) have ${skillName}`,
      });
    }
  }

  return suggestions;
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test`
- [ ] E2E tests pass: `npm run test:e2e`

#### Manual Verification:
- [ ] Test with multi-constraint request and verify `resultingMatches` reflects all filters

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that suggestions show correct counts reflecting all applied filters.

---

## Phase 3: Update Tests

### Overview

Update or add tests to verify tightening suggestions correctly account for all user constraints.

### Changes Required

#### 1. Add integration test for multi-constraint tightening

**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.test.ts`

```typescript
describe('generateTighteningSuggestions', () => {
  describe('multi-constraint filtering', () => {
    it('should apply all user constraints when calculating resultingMatches', async () => {
      // Setup: Create expanded criteria with multiple constraints
      const expanded: ExpandedSearchCriteria = {
        // ... full expanded criteria with skills, seniority, budget, etc.
      };

      const appliedFilters: AppliedFilter[] = [
        // Skill filter
        {
          kind: AppliedFilterKind.Skill,
          field: 'requiredSkills',
          operator: 'HAS_ALL',
          skills: [{ skillId: 'react', skillName: 'React', minProficiency: 'proficient' }],
          displayValue: 'React (proficient)',
          source: 'user',
        },
        // Seniority filter
        {
          kind: AppliedFilterKind.Property,
          field: 'yearsExperience',
          operator: '>=',
          value: '6',
          source: 'user',
        },
        // Budget filter
        {
          kind: AppliedFilterKind.Property,
          field: 'salary',
          operator: '<=',
          value: '200000',
          source: 'user',
        },
      ];

      const suggestions = await generateTighteningSuggestions(
        session,
        expanded,
        appliedFilters
      );

      // Budget suggestion should have count reflecting ALL constraints
      const budgetSuggestion = suggestions.find(s => s.field === 'maxBudget');
      if (budgetSuggestion) {
        // The count should be for engineers matching:
        // - React at proficient+
        // - 6+ years experience
        // - salary <= suggested threshold
        // NOT just: salary <= suggested threshold
        expect(budgetSuggestion.resultingMatches).toBeLessThanOrEqual(
          // Upper bound: can't have more than engineers matching all current constraints
          await getCountWithAllFilters(session, appliedFilters)
        );
      }
    });
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] All tests pass: `npm test`
- [x] Test coverage maintained

#### Manual Verification:
- [x] None required

---

## Phase 4: Update Caller in constraint-advisor.service.ts

### Overview

Update the call site to pass `appliedFilters` to the tightening generator.

### Changes Required

#### 1. Update runTighteningAnalysis

**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`

```typescript
async function runTighteningAnalysis(
  session: Session,
  expandedSearchCriteria: ExpandedSearchCriteria
): Promise<TighteningOutput> {
  const suggestions = await generateTighteningSuggestions(
    session,
    expandedSearchCriteria,
    expandedSearchCriteria.appliedFilters, // Pass the filters
    5
  );

  return {
    suggestions,
    reason: "Many matching candidates found. Consider adding constraints to narrow results.",
  };
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tests pass: `npm test`
- [ ] E2E tests pass: `npm run test:e2e`

#### Manual Verification:
- [ ] None required

---

## Testing Strategy

### Unit Tests

1. **tightening-tester.service.test.ts**: Test each tester function with mocked decomposed constraints
2. **tightening-generator.service.test.ts**: Verify generators use testers correctly

### Integration Tests

1. Test with multi-constraint scenario and verify `resultingMatches` reflects all constraints
2. Test edge cases:
   - No constraints → should use all engineers as baseline
   - Only skill constraints → should correctly count skill-filtered engineers
   - Mixed property + skill constraints → should apply both

### E2E Tests

Update Postman collection to verify:
- Tightening suggestions with multiple filters return sensible counts
- Budget suggestion counts ≤ current result count

## Performance Considerations

The new approach runs more queries per suggestion (applying all filters each time) rather than simple distribution queries. However:

1. The decomposed constraint queries are parameterized and efficient
2. Tightening only runs when `totalCount >= 25` (already many results)
3. We limit to top 5 suggestions
4. The accuracy improvement is worth the cost

If performance becomes an issue, consider:
- Caching the baseline count query result
- Running tightening suggestion queries in parallel
- Adding query result caching for repeated constraint combinations

## References

- Related issue: Tightening suggestions only filter by startTimeline
- Similar implementation: `relaxation-tester.service.ts` (correct pattern)
- Decomposer: `constraint-decomposer.service.ts`
- Query builder: `cypher-query-builder/search-query.builder.ts`
