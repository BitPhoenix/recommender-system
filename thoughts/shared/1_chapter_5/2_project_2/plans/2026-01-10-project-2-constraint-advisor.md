# Project 2: Constraint Advisor Implementation Plan

## Overview

Implement automatic constraint advice for the `/api/search/filter` endpoint. When searches return too few results (< 3), the system will detect minimal conflicting constraint sets using the QUICKXPLAIN algorithm and suggest relaxations. When searches return too many results (≥ 25), it will suggest constraint additions based on result distribution analysis.

## Current State Analysis

**Existing Architecture:**

- `search.service.ts:42-243` - 7-step search pipeline ending with `totalCount` extraction at line 163
- `constraint-expander.service.ts:114-214` - Expands user input into `ExpandedSearchCriteria` with `appliedFilters` array
- `cypher-query-builder/query-conditions.builder.ts:15-101` - Modular filter functions (`buildTimelineFilter`, `buildExperienceFilter`, etc.)
- `search-query.builder.ts:22-102` - Unified Cypher query generation
- `search.types.ts:185-217` - `SearchFilterResponse` type definition

**Key Patterns:**

1. `appliedFilters` already tracks each hard constraint with field, operator, value, source
2. Modular query builder functions can be called selectively
3. Response schema uses optional fields for conditional data
4. Tests use mock session pattern with pattern-based result matching

## Desired End State

After this plan is complete:

1. Searches returning < 3 results automatically include a `relaxation` field with:
   - `conflictAnalysis` containing up to 3 minimal conflict sets with explanations
   - `suggestions` with relaxation options for each constraint in conflict
   - Rule override suggestions for derived constraints
2. Searches returning ≥ 25 results include a `tightening` field with:
   - `suggestions` with additional constraints based on distribution analysis
   - Impact preview (how many results each constraint would filter)
3. All existing tests continue to pass
4. New Postman E2E tests verify relaxation/tightening behavior

**Verification:**

```bash
npm run typecheck                  # Types compile
npm test                           # Unit/integration tests pass
npm run test:e2e                   # E2E tests including new diagnosis tests
```

## What We're NOT Doing

- **Parallel query execution**: Keep sequential for simplicity (Neo4j sessions aren't thread-safe anyway)
- **Caching partial results**: Add later if performance becomes an issue
- **Custom QUICKXPLAIN optimizations**: Use standard algorithm first
- **UI integration**: API-only in this phase
- **Histogram visualizations**: Just return numerical suggestions

## Implementation Approach

1. Create a new `constraint-advisor.service.ts` that orchestrates conflict detection and relaxation generation
2. Implement QUICKXPLAIN algorithm for minimal inconsistent set detection
3. Add constraint relaxation generators per constraint type
4. Add constraint tightening suggestions based on distribution queries
5. Extend `SearchFilterResponse` with optional `diagnosis` and `tightening` fields
6. Integrate into `search.service.ts` after result count check
7. Update Postman collection with diagnosis test scenarios

---

## Phase 1: Response Schema Extension

### Overview

Define the TypeScript types for the diagnosis and tightening response fields. This establishes the contract before implementation.

### Changes Required:

#### 1. Search Types

**File**: `recommender_api/src/types/search.types.ts`
**Changes**: Add diagnosis and tightening types

```typescript
// Add after line 216 (after SearchFilterResponse)

// ============================================
// CONSTRAINT ADVICE TYPES (Project 2)
// ============================================

/**
 * A minimal set of constraints that together cause 0 results.
 * Removing any single constraint from this set would yield results.
 */
export interface ConflictSet {
  /** Human-readable constraint descriptions */
  constraints: string[];
  /** Explanation of why these constraints conflict */
  explanation: string;
  /** Evidence: result counts when each constraint is removed (optional, included when detailed analysis is requested) */
  evidence?: {
    constraintRemoved: string;
    resultingCountIfRelaxed: number;
  }[];
}

/**
 * Suggestion to relax a specific constraint.
 */
export interface RelaxationSuggestion {
  /** The constraint field being relaxed */
  field: string;
  /** Current constraint value */
  currentValue: unknown;
  /** Suggested relaxed value */
  suggestedValue: unknown;
  /** Why this relaxation helps */
  rationale: string;
  /** How many results this would yield */
  resultingMatches: number;
  /** If this is a derived constraint, the rule ID to override */
  ruleIdToOverride?: string;
}

/**
 * Relaxation payload returned when results < threshold.
 */
export interface RelaxationResult {
  /** Analysis of which constraints conflict */
  conflictAnalysis: {
    /** Minimal sets of conflicting constraints (max 3) */
    conflictSets: ConflictSet[];
  };
  /** Suggested constraint relaxations sorted by impact */
  suggestions: RelaxationSuggestion[];
}

/**
 * Suggestion to add/tighten a constraint.
 */
export interface TighteningSuggestion {
  /** The constraint field to add/tighten */
  field: string;
  /** Suggested value */
  suggestedValue: unknown;
  /** Why this helps narrow results */
  rationale: string;
  /** How many results this would yield */
  resultingMatches: number;
  /** Distribution info (e.g., "32 of 40 engineers are in Americas timezone") */
  distributionInfo: string;
}

/**
 * Tightening payload returned when results >= threshold.
 */
export interface TighteningResult {
  /** Suggested constraints to add, sorted by effectiveness */
  suggestions: TighteningSuggestion[];
}
```

#### 2. Update SearchFilterResponse

**File**: `recommender_api/src/types/search.types.ts`
**Changes**: Add optional diagnosis and tightening fields

```typescript
// Modify SearchFilterResponse interface (around line 185-217)
export interface SearchFilterResponse {
  matches: EngineerMatch[];
  totalCount: number;
  appliedFilters: AppliedFilter[];
  appliedPreferences: AppliedPreference[];
  overriddenRuleIds: string[];
  derivedConstraints: Array<{
    rule: { id: string; name: string };
    action: {
      effect: "filter" | "boost";
      targetField: string;
      targetValue: unknown;
      boostStrength?: number;
    };
    provenance: {
      derivationChains: string[][];
      explanation: string;
    };
    override?: {
      overrideScope: "FULL" | "PARTIAL";
      overriddenSkills: string[];
    };
  }>;
  queryMetadata: QueryMetadata;

  // NEW: Relaxation advice for sparse results (< 3 matches)
  relaxation?: RelaxationResult;

  // NEW: Tightening advice for many results (>= 25 matches)
  tightening?: TighteningResult;
}
```

### Success Criteria:

- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Existing tests still pass: `npm test`

---

## Phase 2: Constraint Decomposition Service

### Overview

Create a service that decomposes the search request into individual testable constraints. Each constraint is a self-contained unit that can be toggled on/off for conflict detection.

To avoid duplicating Cypher generation logic that already exists in `query-conditions.builder.ts`, we'll extract a shared utility that both systems can use.

### Changes Required:

#### 1. Shared Cypher Fragment Utility

**File**: `recommender_api/src/utils/cypher-fragment.builder.ts` (new file)

```typescript
/**
 * Shared utility for generating Cypher WHERE clause fragments.
 * Used by both query-conditions.builder.ts and constraint-advisor.
 */

export interface CypherFragment {
  clause: string;
  paramName: string;
  paramValue: unknown;
}

/**
 * Generate a Cypher WHERE clause fragment for a constraint.
 */
export function buildCypherFragment(
  field: string,
  operator: string,
  value: unknown,
  paramPrefix: string
): CypherFragment {
  const paramName = paramPrefix;

  switch (operator) {
    case "IN":
      return {
        clause: `e.${field} IN $${paramName}`,
        paramName,
        paramValue: value,
      };

    case ">=":
      return {
        clause: `e.${field} >= $${paramName}`,
        paramName,
        paramValue: value,
      };

    case "<":
      return {
        clause: `e.${field} < $${paramName}`,
        paramName,
        paramValue: value,
      };

    case "<=":
      return {
        clause: `e.${field} <= $${paramName}`,
        paramName,
        paramValue: value,
      };

    case "STARTS WITH":
      return {
        clause: `e.${field} STARTS WITH $${paramName}`,
        paramName,
        paramValue: value,
      };

    case "=":
      return {
        clause: `e.${field} = $${paramName}`,
        paramName,
        paramValue: value,
      };

    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}
```

**Required refactor:** Update `query-conditions.builder.ts` to use this shared utility, eliminating the duplicated Cypher generation logic. This ensures a single source of truth for constraint-to-Cypher mapping.

**File**: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts`
**Changes**: Refactor filter functions to use shared utility

```typescript
// Add import at top
import { buildCypherFragment } from "../../utils/cypher-fragment.builder.js";

// Refactor buildTimelineFilter
function buildTimelineFilter(startTimeline: StartTimeline[]): FilterParts {
  const fragment = buildCypherFragment("startTimeline", "IN", startTimeline, "startTimeline");
  return {
    conditions: [fragment.clause],
    queryParams: { [fragment.paramName]: fragment.paramValue },
  };
}

// Refactor buildExperienceFilter
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

// Refactor buildTimezoneFilter
function buildTimezoneFilter(timezonePrefixes: string[]): FilterParts {
  if (timezonePrefixes.length === 0) {
    return { conditions: [], queryParams: {} };
  }

  const fragments = timezonePrefixes.map((prefix, i) =>
    buildCypherFragment("timezone", "STARTS WITH", prefix, `tz${i}`)
  );

  const queryParams: Record<string, unknown> = {};
  fragments.forEach((f) => {
    queryParams[f.paramName] = f.paramValue;
  });

  return {
    conditions: [`(${fragments.map((f) => f.clause).join(" OR ")})`],
    queryParams,
  };
}

// Refactor buildBudgetFilter
function buildBudgetFilter(filterCeiling: number | null): FilterParts {
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

#### 2. Enrich AppliedFilter Type

**File**: `recommender_api/src/types/search.types.ts`
**Changes**: Update `AppliedFilter` to store typed values instead of string representations

```typescript
// Update existing AppliedFilter interface (around line 161)
export interface AppliedFilter {
  field: string;
  operator: string;       // 'BETWEEN', 'IN', '>=', '<=', 'STARTS WITH', etc.
  value: unknown;         // Typed value (number, string[], etc.) - CHANGED from string
  displayValue: string;   // Human-readable for API response - NEW
  source: ConstraintSource;
}
```

#### 3. Update Constraint Expander

**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Changes**: Build filters with typed values

```typescript
// Example: expandSeniorityToYearsExperience (around line 245)
// BEFORE:
context.filters.push({
  field: "yearsExperience",
  operator: maxYears !== null ? "BETWEEN" : ">=",
  value: valueStr,  // string like "6 AND 10"
  source: "knowledge_base",
});

// AFTER:
if (minYears !== null) {
  context.filters.push({
    field: "yearsExperience",
    operator: ">=",
    value: minYears,
    displayValue: `>= ${minYears} years`,
    source: "knowledge_base",
  });
}
if (maxYears !== null) {
  context.filters.push({
    field: "yearsExperience",
    operator: "<",
    value: maxYears,
    displayValue: `< ${maxYears} years`,
    source: "knowledge_base",
  });
}

// Example: expandStartTimelineConstraint (around line 280)
context.filters.push({
  field: "startTimeline",
  operator: "IN",
  value: startTimeline,  // string[] - typed
  displayValue: `available within ${requiredMaxStartTime}`,
  source: source,
});

// Example: expandTimezoneConstraint (around line 310)
for (const prefix of timezonePrefixes) {
  context.filters.push({
    field: "timezone",
    operator: "STARTS WITH",
    value: prefix,
    displayValue: `timezone ${prefix}*`,
    source: "user",
  });
}

// Example: expandBudgetConstraint (around line 350)
if (maxBudget !== null) {
  context.filters.push({
    field: "salary",
    operator: "<=",
    value: stretchBudget ?? maxBudget,
    displayValue: `salary <= $${(stretchBudget ?? maxBudget).toLocaleString()}`,
    source: "user",
  });
}
```

#### 4. Constraint Types (Simplified)

**File**: `recommender_api/src/services/constraint-advisor/constraint.types.ts` (new file)

```typescript
import type { CypherFragment } from "../../utils/cypher-fragment.builder.js";
import type { AppliedFilter } from "../../types/search.types.js";

/**
 * Enum for constraint types - determines how the constraint is evaluated.
 */
export enum ConstraintType {
  /** Simple property constraint that maps to a WHERE clause */
  Property = "property",
  /** Skill traversal constraint requiring graph pattern matching */
  SkillTraversal = "skill-traversal",
}

/**
 * Base constraint properties shared by all constraint types.
 */
interface BaseConstraint extends AppliedFilter {
  /** Unique identifier for this constraint */
  id: string;
  /** For derived constraints, the rule ID to override */
  ruleId?: string;
}

/**
 * A simple property constraint that maps to a WHERE clause.
 */
interface PropertyConstraint extends BaseConstraint {
  constraintType: ConstraintType.Property;
  /** Generated Cypher fragment for this constraint */
  cypher: CypherFragment;
}

/**
 * A skill traversal constraint that requires graph pattern matching.
 * These can't be expressed as simple WHERE clauses and need special handling.
 */
interface SkillTraversalConstraint extends BaseConstraint {
  constraintType: ConstraintType.SkillTraversal;
  /** Skill IDs that must be matched via relationship traversal */
  skillIds: string[];
}

/**
 * Discriminated union of all constraint types.
 * Use constraintType to determine how to handle each constraint.
 */
export type TestableConstraint = PropertyConstraint | SkillTraversalConstraint;

/**
 * Result of decomposing a search request into testable constraints.
 */
export interface DecomposedConstraints {
  /** All constraints extracted from the request */
  constraints: TestableConstraint[];
  /** The base MATCH clause (without WHERE) */
  baseMatchClause: string;
}
```

#### 5. Constraint Decomposition Service (Simplified)

**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts` (new file)

```typescript
import type { AppliedFilter } from "../../types/search.types.js";
import {
  ConstraintType,
  type TestableConstraint,
  type DecomposedConstraints,
} from "./constraint.types.js";
import type { DerivedConstraint } from "../../types/inference-rule.types.js";
import { buildCypherFragment } from "../../utils/cypher-fragment.builder.js";

/**
 * Decomposes applied filters into testable constraints.
 *
 * Since AppliedFilter now contains typed values, this is a simple mapping
 * that adds Cypher fragments for each filter. No constraint-specific logic needed.
 */
export function decomposeConstraints(
  appliedFilters: AppliedFilter[],
  derivedConstraints: DerivedConstraint[]
): DecomposedConstraints {
  let paramCounter = 0;
  const nextParam = (prefix: string): string => `diag_${prefix}_${paramCounter++}`;

  // Map applied filters to property constraints
  const constraints: TestableConstraint[] = appliedFilters.map((filter, index) => ({
    ...filter,
    id: `${filter.field}_${index}`,
    constraintType: ConstraintType.Property,
    cypher: buildCypherFragment(filter.field, filter.operator, filter.value, nextParam(filter.field)),
  }));

  // Add derived skill constraints (from inference engine)
  for (const dc of derivedConstraints) {
    if (dc.action.effect === "filter" && !dc.override?.overrideScope) {
      const skillIds = dc.action.targetValue as string[];
      constraints.push({
        id: `derived_${dc.rule.id}`,
        field: "derivedSkills",
        operator: "IN",
        value: skillIds,
        displayValue: `Derived: ${dc.rule.name}`,
        source: "derived",
        ruleId: dc.rule.id,
        constraintType: ConstraintType.SkillTraversal,
        skillIds,
      });
    }
  }

  return {
    constraints,
    baseMatchClause: "MATCH (e:Engineer)",
  };
}

/**
 * Builds a Cypher query using only the specified constraints.
 * Only includes property constraints - skill-traversal constraints
 * require separate handling with graph pattern matching.
 */
export function buildQueryWithConstraints(
  decomposed: DecomposedConstraints,
  constraintIds: Set<string>
): { query: string; params: Record<string, unknown> } {
  const activeConstraints = decomposed.constraints.filter((c) =>
    constraintIds.has(c.id)
  );

  const params: Record<string, unknown> = {};
  const whereClauses: string[] = [];

  for (const constraint of activeConstraints) {
    if (constraint.constraintType === ConstraintType.Property) {
      whereClauses.push(constraint.cypher.clause);
      params[constraint.cypher.paramName] = constraint.cypher.paramValue;
    }
    // SkillTraversal constraints are handled separately by QUICKXPLAIN
  }

  const whereClause =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join("\n  AND ")}` : "";

  const query = `
${decomposed.baseMatchClause}
${whereClause}
RETURN count(e) AS resultCount
`;

  return { query, params };
}
```

#### 6. Unit Tests

**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.test.ts` (new file)

```typescript
import { describe, it, expect } from "vitest";
import {
  decomposeConstraints,
  buildQueryWithConstraints,
} from "./constraint-decomposer.service.js";
import { ConstraintType } from "./constraint.types.js";
import type { AppliedFilter } from "../../types/search.types.js";

describe("decomposeConstraints", () => {
  it("maps applied filters to property constraints with Cypher fragments", () => {
    const appliedFilters: AppliedFilter[] = [
      {
        field: "startTimeline",
        operator: "IN",
        value: ["immediate", "two_weeks"],
        displayValue: "available within two_weeks",
        source: "default",
      },
      {
        field: "yearsExperience",
        operator: ">=",
        value: 6,
        displayValue: ">= 6 years",
        source: "user",
      },
    ];

    const result = decomposeConstraints(appliedFilters, []);

    expect(result.constraints).toHaveLength(2);
    expect(result.constraints[0].constraintType).toBe(ConstraintType.Property);
    expect(result.constraints[1].constraintType).toBe(ConstraintType.Property);

    // Type narrowing - only property constraints have cypher
    const first = result.constraints[0];
    const second = result.constraints[1];
    if (first.constraintType === ConstraintType.Property && second.constraintType === ConstraintType.Property) {
      expect(first.cypher.clause).toContain("e.startTimeline IN");
      expect(second.cypher.clause).toContain("e.yearsExperience >=");
    }
  });

  it("preserves filter properties in testable constraints", () => {
    const appliedFilters: AppliedFilter[] = [
      {
        field: "salary",
        operator: "<=",
        value: 150000,
        displayValue: "salary <= $150,000",
        source: "user",
      },
    ];

    const result = decomposeConstraints(appliedFilters, []);

    expect(result.constraints[0].field).toBe("salary");
    expect(result.constraints[0].operator).toBe("<=");
    expect(result.constraints[0].value).toBe(150000);
    expect(result.constraints[0].source).toBe("user");
    expect(result.constraints[0].constraintType).toBe(ConstraintType.Property);
  });

  it("adds derived constraints as SkillTraversal type", () => {
    const derivedConstraints = [
      {
        rule: { id: "scaling-requires-distributed", name: "Scaling requires distributed" },
        action: { effect: "filter" as const, targetField: "skills", targetValue: ["skill_distributed"] },
        provenance: { derivationChains: [], explanation: "test" },
      },
    ];

    const result = decomposeConstraints([], derivedConstraints);

    expect(result.constraints).toHaveLength(1);
    expect(result.constraints[0].constraintType).toBe(ConstraintType.SkillTraversal);
    expect(result.constraints[0].ruleId).toBe("scaling-requires-distributed");
    expect(result.constraints[0].source).toBe("derived");

    // Type narrowing - SkillTraversal constraints have skillIds
    const constraint = result.constraints[0];
    if (constraint.constraintType === ConstraintType.SkillTraversal) {
      expect(constraint.skillIds).toEqual(["skill_distributed"]);
    }
  });
});

describe("buildQueryWithConstraints", () => {
  it("builds query with selected property constraints only", () => {
    const decomposed = {
      constraints: [
        {
          id: "salary_0",
          field: "salary",
          operator: "<=",
          value: 150000,
          displayValue: "salary <= $150,000",
          source: "user" as const,
          constraintType: ConstraintType.Property,
          cypher: {
            clause: "e.salary <= $diag_salary_0",
            paramName: "diag_salary_0",
            paramValue: 150000,
          },
        },
        {
          id: "yearsExperience_1",
          field: "yearsExperience",
          operator: ">=",
          value: 6,
          displayValue: ">= 6 years",
          source: "user" as const,
          constraintType: ConstraintType.Property,
          cypher: {
            clause: "e.yearsExperience >= $diag_yearsExperience_1",
            paramName: "diag_yearsExperience_1",
            paramValue: 6,
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    // Only include salary constraint
    const { query, params } = buildQueryWithConstraints(
      decomposed,
      new Set(["salary_0"])
    );

    expect(query).toContain("e.salary <= $diag_salary_0");
    expect(query).not.toContain("yearsExperience");
    expect(params.diag_salary_0).toBe(150000);
    expect(params.diag_yearsExperience_1).toBeUndefined();
  });
});
```

### Success Criteria:

- [x] TypeScript compiles: `npm run typecheck`
- [x] New tests pass: `npm test -- src/services/constraint-advisor/`
- [x] All existing tests still pass: `npm test`

---

## Phase 3: QUICKXPLAIN Algorithm Implementation

### Overview

Implement the QUICKXPLAIN algorithm for finding minimal inconsistent sets of constraints. This is a divide-and-conquer algorithm that efficiently identifies the smallest combination of constraints causing conflicts.

### Changes Required:

#### 1. QUICKXPLAIN Service

**File**: `recommender_api/src/services/constraint-advisor/quickxplain.service.ts` (new file)

```typescript
import type { Session } from "neo4j-driver";
import type {
  TestableConstraint,
  DecomposedConstraints,
} from "./constraint.types.js";
import { buildQueryWithConstraints } from "./constraint-decomposer.service.js";

/**
 * Result of QUICKXPLAIN analysis.
 */
export interface QuickXplainResult {
  /** Minimal inconsistent sets found (up to maxSets) */
  minimalSets: TestableConstraint[][];
  /** Number of queries executed during analysis */
  queryCount: number;
}

/**
 * Configuration for QUICKXPLAIN execution.
 */
interface QuickXplainConfig {
  /** Maximum number of minimal sets to find */
  maxSets: number;
  /** Threshold below which results are considered "insufficient" */
  insufficientThreshold: number;
}

const DEFAULT_CONFIG: QuickXplainConfig = {
  maxSets: 3,
  insufficientThreshold: 3,
};

/**
 * Executes QUICKXPLAIN algorithm to find minimal inconsistent constraint sets.
 *
 * Based on: Junker, U. (2004). "QuickXPlain: Preferred explanations and
 * relaxations for over-constrained problems." AAAI-04.
 *
 * @param session Neo4j session for executing count queries
 * @param decomposed Decomposed constraints from the search request
 * @param config Algorithm configuration
 * @returns Minimal inconsistent sets found
 */
export async function findMinimalConflictSets(
  session: Session,
  decomposed: DecomposedConstraints,
  config: Partial<QuickXplainConfig> = {}
): Promise<QuickXplainResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const constraints = decomposed.constraints;

  let queryCount = 0;
  const minimalSets: TestableConstraint[][] = [];

  // Helper: count results with given constraint IDs
  async function countResults(constraintIds: Set<string>): Promise<number> {
    queryCount++;
    const { query, params } = buildQueryWithConstraints(
      decomposed,
      constraintIds
    );
    const result = await session.run(query, params);
    return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
  }

  // Helper: check if constraint set is consistent (returns sufficient results)
  async function isConsistent(constraintIds: Set<string>): Promise<boolean> {
    const count = await countResults(constraintIds);
    return count >= cfg.insufficientThreshold;
  }

  // QUICKXPLAIN recursive function
  async function quickXplain(
    background: TestableConstraint[],
    delta: TestableConstraint[],
    candidates: TestableConstraint[]
  ): Promise<TestableConstraint[] | null> {
    // If delta is non-empty and background alone is inconsistent,
    // then we've already found the minimal set
    if (delta.length > 0) {
      const bgIds = new Set(background.map((c) => c.id));
      if (!(await isConsistent(bgIds))) {
        return [];
      }
    }

    // If only one candidate, it must be part of the conflict
    if (candidates.length === 1) {
      return candidates;
    }

    // If no candidates, no conflict in this branch
    if (candidates.length === 0) {
      return null;
    }

    // Split candidates into two halves
    const mid = Math.floor(candidates.length / 2);
    const left = candidates.slice(0, mid);
    const right = candidates.slice(mid);

    // First, check right side with background + left
    const rightResult = await quickXplain(
      [...background, ...left],
      left,
      right
    );

    if (rightResult === null) {
      return null;
    }

    // Then check left side with background + rightResult
    const leftResult = await quickXplain(
      [...background, ...rightResult],
      rightResult,
      left
    );

    if (leftResult === null) {
      return rightResult;
    }

    return [...leftResult, ...rightResult];
  }

  // Check if full constraint set is inconsistent
  const allIds = new Set(constraints.map((c) => c.id));
  if (await isConsistent(allIds)) {
    // Not inconsistent, no conflicts to find
    return { minimalSets: [], queryCount };
  }

  // Find first minimal conflict set
  const firstSet = await quickXplain([], [], constraints);
  if (firstSet && firstSet.length > 0) {
    minimalSets.push(firstSet);
  }

  /*
   * Find additional minimal conflict sets using the "hitting set" approach.
   *
   * After finding MCS_1, we need to find MCS_2 such that MCS_2 ≠ MCS_1.
   * The key insight: any solution must "hit" (include at least one constraint from)
   * every MCS. So to find a different MCS, we block the first one by requiring
   * at least one of its constraints to be absent.
   *
   * Algorithm: For each constraint c_i in MCS_1:
   *   - Remove c_i from the candidate set
   *   - Run QUICKXPLAIN on remaining constraints
   *   - If a new MCS is found and it's not a duplicate, add it
   *
   * This guarantees we find true minimal conflict sets, not approximations.
   */
  if (minimalSets.length < cfg.maxSets && firstSet && firstSet.length > 0) {
    const foundSetKeys = new Set<string>();
    foundSetKeys.add(serializeConstraintSet(firstSet));

    for (const blockedConstraint of firstSet) {
      if (minimalSets.length >= cfg.maxSets) break;

      /*
       * To find a different MCS, we "block" the first one by excluding
       * one of its constraints. Any MCS found in the remaining constraints
       * must be different from MCS₁ (since it can't contain blockedConstraint).
       *
       * Example: If MCS₁ = {A, B}, we try:
       *   - Search {B, C, D, E, ...} (without A) → might find MCS₂
       *   - Search {A, C, D, E, ...} (without B) → might find MCS₃
       */
      const remainingConstraints = constraints.filter(
        (c) => c.id !== blockedConstraint.id
      );

      /*
       * Optimization: Before running QUICKXPLAIN, check if the remaining
       * constraints are even inconsistent. If removing blockedConstraint
       * makes everything consistent (>= threshold results), then there's
       * no conflict to find in this subset - skip it.
       */
      const remainingIds = new Set(remainingConstraints.map((c) => c.id));
      if (await isConsistent(remainingIds)) {
        continue;
      }

      // The remaining set is still inconsistent - find the MCS within it
      const newSet = await quickXplain([], [], remainingConstraints);
      if (newSet && newSet.length > 0) {
        const setKey = serializeConstraintSet(newSet);
        if (!foundSetKeys.has(setKey)) {
          foundSetKeys.add(setKey);
          minimalSets.push(newSet);
        }
      }
    }
  }

  return { minimalSets: minimalSets.slice(0, cfg.maxSets), queryCount };
}

/**
 * Serialize a constraint set to a string for deduplication.
 * Sorted by ID to ensure consistent ordering.
 */
function serializeConstraintSet(constraints: TestableConstraint[]): string {
  return constraints
    .map((c) => c.id)
    .sort()
    .join(",");
}

```

#### 2. Unit Tests

**File**: `recommender_api/src/services/constraint-advisor/quickxplain.service.test.ts` (new file)

```typescript
import { describe, it, expect, vi } from "vitest";
import { findMinimalConflictSets } from "./quickxplain.service.js";
import {
  ConstraintType,
  type DecomposedConstraints,
  type TestableConstraint,
} from "./constraint.types.js";

// Mock session that returns different counts based on constraints
function createMockSession(countMap: Map<string, number>) {
  return {
    run: vi
      .fn()
      .mockImplementation((query: string, params: Record<string, unknown>) => {
        // Determine which constraints are active based on params
        const activeConstraints = Object.keys(params)
          .filter((k) => k.startsWith("diag_"))
          .sort()
          .join(",");

        const count = countMap.get(activeConstraints) ?? 0;

        return {
          records: [
            {
              get: (field: string) => {
                if (field === "resultCount") {
                  return { toNumber: () => count };
                }
                return null;
              },
            },
          ],
        };
      }),
  };
}

describe("findMinimalConflictSets", () => {
  const makeConstraint = (id: string): TestableConstraint => ({
    id,
    field: id,
    operator: "=",
    value: 1,
    displayValue: `${id} = 1`,
    source: "user",
    constraintType: ConstraintType.Property,
    cypher: {
      clause: `e.${id} = $diag_${id}`,
      paramName: `diag_${id}`,
      paramValue: 1,
    },
  });

  it("returns empty when constraints are consistent", async () => {
    const constraints = [makeConstraint("a"), makeConstraint("b")];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    // All combinations return sufficient results
    const countMap = new Map([
      ["diag_a,diag_b", 10], // full set
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed);

    expect(result.minimalSets).toHaveLength(0);
  });

  it("finds single-constraint conflict", async () => {
    const constraints = [makeConstraint("a")];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const countMap = new Map([
      ["diag_a", 0], // full set is inconsistent
      ["", 10], // empty set is consistent
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed);

    expect(result.minimalSets).toHaveLength(1);
    expect(result.minimalSets[0]).toHaveLength(1);
    expect(result.minimalSets[0][0].id).toBe("a");
  });

  it("respects maxSets configuration", async () => {
    const constraints = [
      makeConstraint("a"),
      makeConstraint("b"),
      makeConstraint("c"),
    ];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    // Setup: removing any single constraint yields results
    const countMap = new Map([
      ["diag_a,diag_b,diag_c", 0],
      ["diag_b,diag_c", 5],
      ["diag_a,diag_c", 5],
      ["diag_a,diag_b", 5],
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed, {
      maxSets: 2,
    });

    expect(result.minimalSets.length).toBeLessThanOrEqual(2);
  });

  it("finds multiple distinct minimal conflict sets using hitting set approach", async () => {
    /*
     * Test scenario: 4 constraints {A, B, C, D} with two distinct MCS:
     * - MCS_1 = {A, B} (A and B together cause 0 results)
     * - MCS_2 = {C, D} (C and D together cause 0 results)
     *
     * Full set {A,B,C,D} is inconsistent
     * {A,B} alone is inconsistent
     * {C,D} alone is inconsistent
     * {A,C}, {A,D}, {B,C}, {B,D} are all consistent
     */
    const constraints = [
      makeConstraint("a"),
      makeConstraint("b"),
      makeConstraint("c"),
      makeConstraint("d"),
    ];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const countMap = new Map([
      // Full set: inconsistent
      ["diag_a,diag_b,diag_c,diag_d", 0],
      // Remove one from {A,B}: still inconsistent due to {C,D}
      ["diag_a,diag_c,diag_d", 0],
      ["diag_b,diag_c,diag_d", 0],
      // Remove one from {C,D}: still inconsistent due to {A,B}
      ["diag_a,diag_b,diag_c", 0],
      ["diag_a,diag_b,diag_d", 0],
      // Remove one from each MCS: consistent
      ["diag_a,diag_c", 10],
      ["diag_a,diag_d", 10],
      ["diag_b,diag_c", 10],
      ["diag_b,diag_d", 10],
      // Pairs that are MCS
      ["diag_a,diag_b", 0],
      ["diag_c,diag_d", 0],
      // Singles: all consistent
      ["diag_a", 10],
      ["diag_b", 10],
      ["diag_c", 10],
      ["diag_d", 10],
      // Empty: consistent
      ["", 10],
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed, {
      maxSets: 3,
    });

    // Should find both MCS
    expect(result.minimalSets.length).toBeGreaterThanOrEqual(2);

    // Each MCS should have exactly 2 elements
    for (const mcs of result.minimalSets) {
      expect(mcs).toHaveLength(2);
    }

    // Verify we found both {A,B} and {C,D} (in some order)
    const setKeys = result.minimalSets.map((mcs) =>
      mcs
        .map((c) => c.id)
        .sort()
        .join(",")
    );
    expect(setKeys).toContain("a,b");
    expect(setKeys).toContain("c,d");
  });

  it("avoids duplicate MCS when hitting set exploration finds the same set", async () => {
    /*
     * Test scenario: 3 constraints {A, B, C} where all 3 together form
     * a single MCS (removing any one makes it consistent).
     *
     * The hitting set approach will try blocking each constraint in the MCS,
     * but should not find any new distinct MCS.
     */
    const constraints = [
      makeConstraint("a"),
      makeConstraint("b"),
      makeConstraint("c"),
    ];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const countMap = new Map([
      // Full set: inconsistent
      ["diag_a,diag_b,diag_c", 0],
      // Remove any one: consistent
      ["diag_a,diag_b", 10],
      ["diag_a,diag_c", 10],
      ["diag_b,diag_c", 10],
      // Singles: consistent
      ["diag_a", 10],
      ["diag_b", 10],
      ["diag_c", 10],
      ["", 10],
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed, {
      maxSets: 3,
    });

    // Should find exactly one MCS: {A, B, C}
    expect(result.minimalSets).toHaveLength(1);
    expect(result.minimalSets[0]).toHaveLength(3);
  });
});
```

### Success Criteria:

- [x] TypeScript compiles: `npm run typecheck`
- [x] QUICKXPLAIN tests pass: `npm test -- src/services/constraint-advisor/quickxplain`
- [x] All tests pass: `npm test`

---

## Phase 4: Relaxation Generator Service

### Overview

Implement relaxation suggestion generation using a config-driven approach. Domain-specific knowledge (step sizes, enum orderings, rationale templates) lives in the knowledge base config, while the generator itself is generic.

### Changes Required:

#### 1. Relaxation Strategy Config

**File**: `recommender_api/src/config/knowledge-base/relaxation-strategies.config.ts` (new file)

```typescript
import { START_TIMELINE_ORDER } from "../../types/search.types.js";

/**
 * Relaxation strategy types.
 * Each type defines how to generate relaxed values for a constraint.
 */
export enum RelaxationStrategyType {
  /** Multiply current value by step factors (up or down based on operator) */
  NumericStep = "numeric-step",
  /** Expand to include more values from an ordered enum */
  EnumExpand = "enum-expand",
  /** Suggest removing the constraint entirely */
  Remove = "remove",
  /** Suggest overriding the inference rule */
  DerivedOverride = "derived-override",
  /** Skill-specific relaxations (lower proficiency, move to preferred, remove) */
  SkillRelaxation = "skill-relaxation",
}

/**
 * Base strategy interface.
 */
interface BaseStrategy {
  type: RelaxationStrategyType;
}

/**
 * Numeric step strategy - multiply current value by step factors.
 * Direction determines whether we're relaxing up (for <= constraints)
 * or down (for >= constraints).
 */
export interface NumericStepStrategy extends BaseStrategy {
  type: RelaxationStrategyType.NumericStep;
  /** Step multipliers to try (e.g., [0.7, 0.5] for stepping down) */
  stepsDown: number[];
  /** Step multipliers for stepping up (e.g., [1.2, 1.5]) */
  stepsUp: number[];
  /** Template for rationale. Placeholders: {current}, {suggested}, {direction} */
  rationaleTemplate: string;
  /** Optional: field name to use in suggestion (defaults to constraint field) */
  suggestedField?: string;
}

/**
 * Enum expand strategy - expand to include more values from an ordered enum.
 */
export interface EnumExpandStrategy extends BaseStrategy {
  type: RelaxationStrategyType.EnumExpand;
  /** The ordered enum values */
  enumOrder: readonly string[];
  /** Maximum number of expansion steps to suggest */
  maxExpansion: number;
  /** Template for rationale. Placeholders: {expanded} */
  rationaleTemplate: string;
  /** Field name to use in suggestion */
  suggestedField: string;
}

/**
 * Remove strategy - suggest removing the constraint entirely.
 */
export interface RemoveStrategy extends BaseStrategy {
  type: RelaxationStrategyType.Remove;
  /** Template for rationale. Placeholders: {current} */
  rationaleTemplate: string;
  /** Field name to use in suggestion */
  suggestedField: string;
}

/**
 * Derived override strategy - suggest overriding the inference rule.
 */
export interface DerivedOverrideStrategy extends BaseStrategy {
  type: RelaxationStrategyType.DerivedOverride;
  /** Template for rationale. Placeholders: {displayValue} */
  rationaleTemplate: string;
}

/**
 * Skill relaxation strategy - suggests ways to relax skill requirements.
 * Generates multiple suggestions:
 * - Lower proficiency threshold (expert → proficient → familiar)
 * - Move required skill to preferred
 * - Remove one of multiple required skills
 */
export interface SkillRelaxationStrategy extends BaseStrategy {
  type: RelaxationStrategyType.SkillRelaxation;
  /** Ordered proficiency levels from highest to lowest */
  proficiencyOrder: readonly string[];
  /** Rationale templates for each relaxation type */
  rationales: {
    lowerProficiency: string;
    moveToPreferred: string;
    removeSkill: string;
  };
}

export type RelaxationStrategy =
  | NumericStepStrategy
  | EnumExpandStrategy
  | RemoveStrategy
  | DerivedOverrideStrategy
  | SkillRelaxationStrategy;

/**
 * Relaxation strategies by field name.
 * Adding a new constraint type = adding an entry here.
 */
export const relaxationStrategies: Record<string, RelaxationStrategy> = {
  yearsExperience: {
    type: RelaxationStrategyType.NumericStep,
    stepsDown: [0.7, 0.5],
    stepsUp: [1.3, 1.5],
    rationaleTemplate: "{direction} experience from {current} to {suggested} years",
  },

  salary: {
    type: RelaxationStrategyType.NumericStep,
    stepsDown: [0.8, 0.6], // unlikely to use, but symmetric
    stepsUp: [1.2, 1.5],
    rationaleTemplate: "Increasing budget from ${current} to ${suggested}",
    suggestedField: "maxBudget",
  },

  startTimeline: {
    type: RelaxationStrategyType.EnumExpand,
    enumOrder: START_TIMELINE_ORDER,
    maxExpansion: 2,
    rationaleTemplate: "Expanding start timeline to include {expanded}",
    suggestedField: "requiredMaxStartTime",
  },

  timezone: {
    type: RelaxationStrategyType.Remove,
    rationaleTemplate: "Removing timezone restriction (currently: {current}*)",
    suggestedField: "requiredTimezone",
  },

  derivedSkills: {
    type: RelaxationStrategyType.DerivedOverride,
    rationaleTemplate: "Override inference rule: {displayValue}",
  },

  requiredSkills: {
    type: RelaxationStrategyType.SkillRelaxation,
    proficiencyOrder: ["expert", "proficient", "familiar"],
    rationales: {
      lowerProficiency: "Lower {skill} proficiency from {current} to {suggested}",
      moveToPreferred: "Move {skill} from required to preferred",
      removeSkill: "Remove {skill} requirement",
    },
  },
};
```

#### 2. Update Knowledge Base Index

**File**: `recommender_api/src/config/knowledge-base/index.ts`
**Changes**: Export relaxation strategies

```typescript
// Add to existing exports
export {
  relaxationStrategies,
  RelaxationStrategyType,
} from "./relaxation-strategies.config.js";
export type { RelaxationStrategy } from "./relaxation-strategies.config.js";
```

#### 3. Relaxation Generator (Config-Driven)

**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts` (new file)

```typescript
import type { Session } from "neo4j-driver";
import type {
  TestableConstraint,
  DecomposedConstraints,
} from "./constraint.types.js";
import type { RelaxationSuggestion } from "../../types/search.types.js";
import { buildQueryWithConstraints } from "./constraint-decomposer.service.js";
import {
  relaxationStrategies,
  RelaxationStrategyType,
  type NumericStepStrategy,
  type EnumExpandStrategy,
  type RemoveStrategy,
  type SkillRelaxationStrategy,
} from "../../config/knowledge-base/relaxation-strategies.config.js";

/**
 * Generate relaxation suggestions for constraints in conflict sets.
 */
export async function generateRelaxationSuggestions(
  session: Session,
  decomposed: DecomposedConstraints,
  conflictingConstraints: TestableConstraint[]
): Promise<RelaxationSuggestion[]> {
  const suggestions: RelaxationSuggestion[] = [];

  for (const constraint of conflictingConstraints) {
    const relaxations = await generateRelaxationsForConstraint(
      session,
      decomposed,
      constraint
    );
    suggestions.push(...relaxations);
  }

  // Sort by impact (most results first)
  suggestions.sort((a, b) => b.resultingMatches - a.resultingMatches);

  return suggestions;
}

/**
 * Generate relaxations for a single constraint using its configured strategy.
 * No switch statement needed - strategy type determines behavior.
 */
async function generateRelaxationsForConstraint(
  session: Session,
  decomposed: DecomposedConstraints,
  constraint: TestableConstraint
): Promise<RelaxationSuggestion[]> {
  const strategy = relaxationStrategies[constraint.field];

  if (!strategy) {
    // No strategy configured for this field - no suggestions
    return [];
  }

  switch (strategy.type) {
    case RelaxationStrategyType.NumericStep:
      return applyNumericStepStrategy(session, decomposed, constraint, strategy);
    case RelaxationStrategyType.EnumExpand:
      return applyEnumExpandStrategy(session, decomposed, constraint, strategy);
    case RelaxationStrategyType.Remove:
      return applyRemoveStrategy(session, decomposed, constraint, strategy);
    case RelaxationStrategyType.DerivedOverride:
      return applyDerivedOverrideStrategy(constraint, strategy);
    case RelaxationStrategyType.SkillRelaxation:
      return applySkillRelaxationStrategy(session, decomposed, constraint, strategy);
  }
}

async function applyNumericStepStrategy(
  session: Session,
  decomposed: DecomposedConstraints,
  constraint: TestableConstraint,
  strategy: NumericStepStrategy
): Promise<RelaxationSuggestion[]> {
  const suggestions: RelaxationSuggestion[] = [];
  const currentValue = constraint.value as number;

  // Choose steps based on operator direction
  const isLowerBound = constraint.operator === ">=" || constraint.operator === ">";
  const steps = isLowerBound ? strategy.stepsDown : strategy.stepsUp;
  const direction = isLowerBound ? "Lowering minimum" : "Raising maximum";

  for (const multiplier of steps) {
    const relaxedValue = isLowerBound
      ? Math.max(0, Math.floor(currentValue * multiplier))
      : Math.ceil(currentValue * multiplier);

    if (relaxedValue === currentValue) continue;

    const count = await testRelaxedValue(session, decomposed, constraint, relaxedValue);

    if (count > 0) {
      const rationale = strategy.rationaleTemplate
        .replace("{direction}", direction)
        .replace("{current}", formatValue(currentValue, constraint.field))
        .replace("{suggested}", formatValue(relaxedValue, constraint.field));

      suggestions.push({
        field: strategy.suggestedField ?? constraint.field,
        currentValue,
        suggestedValue: relaxedValue,
        rationale,
        resultingMatches: count,
      });
    }
  }

  return suggestions;
}

async function applyEnumExpandStrategy(
  session: Session,
  decomposed: DecomposedConstraints,
  constraint: TestableConstraint,
  strategy: EnumExpandStrategy
): Promise<RelaxationSuggestion[]> {
  const suggestions: RelaxationSuggestion[] = [];
  const currentValues = constraint.value as string[];

  // Find the furthest current value in the enum order
  const maxCurrentIndex = Math.max(
    ...currentValues.map((v) => strategy.enumOrder.indexOf(v))
  );

  // Suggest expanding to include next values
  for (
    let i = maxCurrentIndex + 1;
    i < Math.min(maxCurrentIndex + 1 + strategy.maxExpansion, strategy.enumOrder.length);
    i++
  ) {
    const expandedValues = strategy.enumOrder.slice(0, i + 1);

    const count = await testRelaxedValue(session, decomposed, constraint, expandedValues);

    if (count > 0) {
      const rationale = strategy.rationaleTemplate.replace(
        "{expanded}",
        strategy.enumOrder[i]
      );

      suggestions.push({
        field: strategy.suggestedField,
        currentValue: currentValues,
        suggestedValue: expandedValues,
        rationale,
        resultingMatches: count,
      });
    }
  }

  return suggestions;
}

async function applyRemoveStrategy(
  session: Session,
  decomposed: DecomposedConstraints,
  constraint: TestableConstraint,
  strategy: RemoveStrategy
): Promise<RelaxationSuggestion[]> {
  // Test removing this constraint entirely
  const allIds = new Set(decomposed.constraints.map((c) => c.id));
  allIds.delete(constraint.id);
  const { query, params } = buildQueryWithConstraints(decomposed, allIds);

  const result = await session.run(query, params);
  const count = result.records[0]?.get("resultCount")?.toNumber() ?? 0;

  if (count > 0) {
    const rationale = strategy.rationaleTemplate.replace(
      "{current}",
      String(constraint.value)
    );

    return [
      {
        field: strategy.suggestedField,
        currentValue: constraint.value,
        suggestedValue: null,
        rationale,
        resultingMatches: count,
      },
    ];
  }

  return [];
}

function applyDerivedOverrideStrategy(
  constraint: TestableConstraint,
  strategy: { rationaleTemplate: string }
): RelaxationSuggestion[] {
  if (!constraint.ruleId) return [];

  const rationale = strategy.rationaleTemplate.replace(
    "{displayValue}",
    constraint.displayValue
  );

  return [
    {
      field: constraint.field,
      currentValue: constraint.value,
      suggestedValue: null,
      rationale,
      resultingMatches: -1, // Unknown without testing
      ruleIdToOverride: constraint.ruleId,
    },
  ];
}

/**
 * Skill-specific relaxations: lower proficiency, move to preferred, or remove.
 * The constraint.value is expected to be a SkillRequirement object with skill and minProficiency.
 */
async function applySkillRelaxationStrategy(
  session: Session,
  decomposed: DecomposedConstraints,
  constraint: TestableConstraint,
  strategy: SkillRelaxationStrategy
): Promise<RelaxationSuggestion[]> {
  const suggestions: RelaxationSuggestion[] = [];

  /*
   * Skill constraints are complex - the value contains skill name and proficiency.
   * We need to parse this to generate meaningful relaxations.
   */
  const skillReq = constraint.value as { skill: string; minProficiency?: string };
  const skillName = skillReq.skill;
  const currentProficiency = skillReq.minProficiency;

  // 1. Lower proficiency threshold (if proficiency is set)
  if (currentProficiency) {
    const currentIndex = strategy.proficiencyOrder.indexOf(currentProficiency);
    if (currentIndex >= 0 && currentIndex < strategy.proficiencyOrder.length - 1) {
      const lowerProficiency = strategy.proficiencyOrder[currentIndex + 1];

      const count = await testSkillRelaxation(session, decomposed, constraint, {
        ...skillReq,
        minProficiency: lowerProficiency,
      });

      if (count > 0) {
        suggestions.push({
          field: "requiredSkills",
          currentValue: constraint.value,
          suggestedValue: { ...skillReq, minProficiency: lowerProficiency },
          rationale: strategy.rationales.lowerProficiency
            .replace("{skill}", skillName)
            .replace("{current}", currentProficiency)
            .replace("{suggested}", lowerProficiency),
          resultingMatches: count,
        });
      }
    }
  }

  // 2. Move to preferred (remove from required, suggest adding to preferred)
  const countWithoutSkill = await testSkillRemoval(session, decomposed, constraint);
  if (countWithoutSkill > 0) {
    suggestions.push({
      field: "requiredSkills",
      currentValue: constraint.value,
      suggestedValue: { moveToPreferred: true, skill: skillName },
      rationale: strategy.rationales.moveToPreferred.replace("{skill}", skillName),
      resultingMatches: countWithoutSkill,
    });

    // 3. Remove skill entirely (same query result as moveToPreferred)
    suggestions.push({
      field: "requiredSkills",
      currentValue: constraint.value,
      suggestedValue: { remove: true, skill: skillName },
      rationale: strategy.rationales.removeSkill.replace("{skill}", skillName),
      resultingMatches: countWithoutSkill,
    });
  }

  return suggestions;
}

/**
 * Test result count with a modified skill requirement.
 */
async function testSkillRelaxation(
  session: Session,
  decomposed: DecomposedConstraints,
  constraint: TestableConstraint,
  modifiedSkill: { skill: string; minProficiency?: string }
): Promise<number> {
  /*
   * For skill constraints, we need to modify the Cypher query to use the
   * relaxed proficiency. This is more complex than simple property constraints.
   * For now, we test by removing and re-adding with modified value.
   */
  return testRelaxedValue(session, decomposed, constraint, modifiedSkill);
}

/**
 * Test result count when a skill constraint is removed entirely.
 */
async function testSkillRemoval(
  session: Session,
  decomposed: DecomposedConstraints,
  constraint: TestableConstraint
): Promise<number> {
  const allIds = new Set(decomposed.constraints.map((c) => c.id));
  allIds.delete(constraint.id);
  const { query, params } = buildQueryWithConstraints(decomposed, allIds);

  const result = await session.run(query, params);
  return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
}

/**
 * Format a value for display in rationale.
 */
function formatValue(value: number, field: string): string {
  if (field === "salary") {
    return `$${value.toLocaleString()}`;
  }
  return String(value);
}

/**
 * Test what result count we'd get with a relaxed value.
 */
async function testRelaxedValue(
  session: Session,
  decomposed: DecomposedConstraints,
  constraint: TestableConstraint,
  relaxedValue: unknown
): Promise<number> {
  const modifiedConstraints = decomposed.constraints.map((c) => {
    if (c.id === constraint.id) {
      return {
        ...c,
        cypher: {
          ...c.cypher,
          paramValue: relaxedValue,
        },
      };
    }
    return c;
  });

  const modifiedDecomposed = {
    ...decomposed,
    constraints: modifiedConstraints,
  };

  const allIds = new Set(modifiedConstraints.map((c) => c.id));
  const { query, params } = buildQueryWithConstraints(modifiedDecomposed, allIds);

  const result = await session.run(query, params);
  return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
}
```

#### 4. Unit Tests

**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.test.ts` (new file)

```typescript
import { describe, it, expect, vi } from "vitest";
import { generateRelaxationSuggestions } from "./relaxation-generator.service.js";
import { ConstraintType, type DecomposedConstraints } from "./constraint.types.js";

function createMockSession(countMap: Map<string, number>) {
  return {
    run: vi.fn().mockImplementation((query: string, params: Record<string, unknown>) => {
      const activeParams = Object.keys(params)
        .filter((k) => k.startsWith("diag_"))
        .sort()
        .join(",");

      const count = countMap.get(activeParams) ?? 0;

      return {
        records: [
          {
            get: (field: string) => {
              if (field === "resultCount") {
                return { toNumber: () => count };
              }
              return null;
            },
          },
        ],
      };
    }),
  };
}

describe("generateRelaxationSuggestions", () => {
  it("generates numeric-step relaxations for experience constraint", async () => {
    const decomposed: DecomposedConstraints = {
      constraints: [
        {
          id: "exp_0",
          field: "yearsExperience",
          operator: ">=",
          value: 10,
          displayValue: ">= 10 years",
          source: "user",
          constraintType: ConstraintType.Property,
          cypher: {
            clause: "e.yearsExperience >= $diag_exp_0",
            paramName: "diag_exp_0",
            paramValue: 10,
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    // Relaxed values: 7 (0.7x) and 5 (0.5x) should yield results
    const countMap = new Map([
      ["diag_exp_0", 0], // original: 0 results
    ]);

    const session = createMockSession(countMap) as any;

    // Mock to return results for relaxed values
    session.run.mockImplementation((query: string, params: Record<string, unknown>) => {
      const expValue = params.diag_exp_0 as number;
      const count = expValue <= 7 ? 5 : 0;
      return {
        records: [{ get: () => ({ toNumber: () => count }) }],
      };
    });

    const suggestions = await generateRelaxationSuggestions(
      session,
      decomposed,
      decomposed.constraints
    );

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].field).toBe("yearsExperience");
    expect(suggestions[0].suggestedValue).toBeLessThan(10);
    expect(suggestions[0].rationale).toContain("Lowering");
  });

  it("generates remove relaxation for timezone constraint", async () => {
    const decomposed: DecomposedConstraints = {
      constraints: [
        {
          id: "tz_0",
          field: "timezone",
          operator: "STARTS WITH",
          value: "Europe/",
          displayValue: "timezone Europe/*",
          source: "user",
          constraintType: ConstraintType.Property,
          cypher: {
            clause: "e.timezone STARTS WITH $diag_tz_0",
            paramName: "diag_tz_0",
            paramValue: "Europe/",
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const session = createMockSession(new Map()) as any;
    session.run.mockResolvedValue({
      records: [{ get: () => ({ toNumber: () => 15 }) }],
    });

    const suggestions = await generateRelaxationSuggestions(
      session,
      decomposed,
      decomposed.constraints
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].field).toBe("requiredTimezone");
    expect(suggestions[0].suggestedValue).toBeNull();
    expect(suggestions[0].rationale).toContain("Removing");
  });

  it("returns empty for unknown field", async () => {
    const decomposed: DecomposedConstraints = {
      constraints: [
        {
          id: "unknown_0",
          field: "unknownField",
          operator: "=",
          value: "foo",
          displayValue: "unknown = foo",
          source: "user",
          constraintType: ConstraintType.Property,
          cypher: {
            clause: "e.unknownField = $diag_unknown_0",
            paramName: "diag_unknown_0",
            paramValue: "foo",
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const session = createMockSession(new Map()) as any;

    const suggestions = await generateRelaxationSuggestions(
      session,
      decomposed,
      decomposed.constraints
    );

    expect(suggestions).toHaveLength(0);
  });
});
```

### Success Criteria:

- [x] TypeScript compiles: `npm run typecheck`
- [x] Relaxation tests pass: `npm test -- src/services/constraint-advisor/relaxation`
- [x] All tests pass: `npm test`

---

## Phase 5: Tightening Suggestions Service

### Overview

Implement constraint tightening suggestions for when results exceed the threshold (≥ 25). Analyzes result distribution to suggest effective filtering constraints.

### Changes Required:

#### 1. Tightening Generator

**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts` (new file)

```typescript
import type { Session } from "neo4j-driver";
import type { TighteningSuggestion, AppliedFilter } from "../../types/search.types.js";
import type { ExpandedSearchCriteria } from "../constraint-expander.service.js";

/**
 * Tightening dimension definition.
 * Each dimension knows how to analyze the result set distribution for that field.
 */
interface TighteningDimension {
  field: string;
  analyze: (session: Session, expanded: ExpandedSearchCriteria) => Promise<TighteningSuggestion[]>;
}

/**
 * All available tightening dimensions.
 * Adding a new dimension = adding an entry here.
 */
const tighteningDimensions: TighteningDimension[] = [
  { field: "timezone", analyze: analyzeTimezoneDistribution },
  { field: "yearsExperience", analyze: analyzeExperienceDistribution },
  { field: "salary", analyze: analyzeSalaryDistribution },
  { field: "startTimeline", analyze: analyzeTimelineDistribution },
  { field: "requiredSkills", analyze: analyzeSkillDistribution },
];

/**
 * Generate tightening suggestions when results exceed threshold.
 * Uses appliedFilters to determine which dimensions are already constrained.
 */
export async function generateTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  appliedFilters: AppliedFilter[],
  maxSuggestions: number = 5
): Promise<TighteningSuggestion[]> {
  // Determine which fields are already constrained
  const constrainedFields = new Set(appliedFilters.map((f) => f.field));

  // Filter to unconstrained dimensions
  const unconstrainedDimensions = tighteningDimensions.filter(
    (d) => !constrainedFields.has(d.field)
  );

  // Analyze distributions in parallel
  const analyses = await Promise.all(
    unconstrainedDimensions.map((d) => d.analyze(session, expanded))
  );

  // Flatten and sort by effectiveness (biggest reduction in results)
  const suggestions = analyses.flat();
  suggestions.sort((a, b) => a.resultingMatches - b.resultingMatches);

  return suggestions.slice(0, maxSuggestions);
}

async function analyzeTimezoneDistribution(
  session: Session,
  expanded: ExpandedSearchCriteria
): Promise<TighteningSuggestion[]> {
  const query = `
    MATCH (e:Engineer)
    WHERE e.startTimeline IN $startTimeline
    WITH e,
         CASE
           WHEN e.timezone STARTS WITH 'America/' THEN 'Americas'
           WHEN e.timezone STARTS WITH 'Europe/' THEN 'Europe'
           WHEN e.timezone STARTS WITH 'Asia/' OR e.timezone STARTS WITH 'Australia/' THEN 'APAC'
           ELSE 'Other'
         END AS region
    RETURN region, count(e) AS count
    ORDER BY count DESC
  `;

  const result = await session.run(query, {
    startTimeline: expanded.startTimeline,
  });

  const total = result.records.reduce(
    (sum, r) => sum + r.get("count").toNumber(),
    0
  );
  const suggestions: TighteningSuggestion[] = [];

  for (const record of result.records) {
    const region = record.get("region") as string;
    const count = record.get("count").toNumber();
    const percentage = Math.round((count / total) * 100);

    if (count < total) {
      const tzPrefix = {
        Americas: "America/*",
        Europe: "Europe/*",
        APAC: "Asia/*",
      }[region];

      if (tzPrefix) {
        suggestions.push({
          field: "requiredTimezone",
          suggestedValue: [tzPrefix],
          rationale: `Filter to ${region} timezone engineers`,
          resultingMatches: count,
          distributionInfo: `${count} of ${total} engineers (${percentage}%) are in ${region}`,
        });
      }
    }
  }

  return suggestions;
}

async function analyzeExperienceDistribution(
  session: Session,
  expanded: ExpandedSearchCriteria
): Promise<TighteningSuggestion[]> {
  const query = `
    MATCH (e:Engineer)
    WHERE e.startTimeline IN $startTimeline
    WITH e,
         CASE
           WHEN e.yearsExperience >= 9 THEN 'staff+'
           WHEN e.yearsExperience >= 6 THEN 'senior'
           WHEN e.yearsExperience >= 3 THEN 'mid'
           ELSE 'junior'
         END AS level
    RETURN level, count(e) AS count,
           min(e.yearsExperience) AS minYears,
           max(e.yearsExperience) AS maxYears
    ORDER BY minYears DESC
  `;

  const result = await session.run(query, {
    startTimeline: expanded.startTimeline,
  });

  const total = result.records.reduce(
    (sum, r) => sum + r.get("count").toNumber(),
    0
  );
  const suggestions: TighteningSuggestion[] = [];

  const seniorityToMin: Record<string, number> = {
    "staff+": 9,
    senior: 6,
    mid: 3,
    junior: 0,
  };

  for (const record of result.records) {
    const level = record.get("level") as string;
    const count = record.get("count").toNumber();
    const percentage = Math.round((count / total) * 100);

    if (count < total && level !== "junior") {
      suggestions.push({
        field: "requiredSeniorityLevel",
        suggestedValue: level === "staff+" ? "staff" : level,
        rationale: `Filter to ${level} level engineers (${seniorityToMin[level]}+ years)`,
        resultingMatches: count,
        distributionInfo: `${count} of ${total} engineers (${percentage}%) are ${level} level`,
      });
    }
  }

  return suggestions;
}

async function analyzeSalaryDistribution(
  session: Session,
  expanded: ExpandedSearchCriteria
): Promise<TighteningSuggestion[]> {
  const query = `
    MATCH (e:Engineer)
    WHERE e.startTimeline IN $startTimeline
    WITH e,
         CASE
           WHEN e.salary <= 100000 THEN 100000
           WHEN e.salary <= 150000 THEN 150000
           WHEN e.salary <= 200000 THEN 200000
           ELSE 250000
         END AS salaryBucket
    RETURN salaryBucket, count(e) AS count
    ORDER BY salaryBucket
  `;

  const result = await session.run(query, {
    startTimeline: expanded.startTimeline,
  });

  const total = result.records.reduce(
    (sum, r) => sum + r.get("count").toNumber(),
    0
  );
  const suggestions: TighteningSuggestion[] = [];
  let cumulative = 0;

  for (const record of result.records) {
    const bucket = record.get("salaryBucket").toNumber();
    const count = record.get("count").toNumber();
    cumulative += count;
    const percentage = Math.round((cumulative / total) * 100);

    if (cumulative < total) {
      suggestions.push({
        field: "maxBudget",
        suggestedValue: bucket,
        rationale: `Set budget cap at $${bucket.toLocaleString()}`,
        resultingMatches: cumulative,
        distributionInfo: `${cumulative} of ${total} engineers (${percentage}%) earn ≤$${bucket.toLocaleString()}`,
      });
    }
  }

  return suggestions;
}

async function analyzeTimelineDistribution(
  session: Session,
  expanded: ExpandedSearchCriteria
): Promise<TighteningSuggestion[]> {
  const query = `
    MATCH (e:Engineer)
    RETURN e.startTimeline AS timeline, count(e) AS count
    ORDER BY count DESC
  `;

  const result = await session.run(query, {});

  const total = result.records.reduce(
    (sum, r) => sum + r.get("count").toNumber(),
    0
  );
  const suggestions: TighteningSuggestion[] = [];

  // Suggest restricting to faster timelines
  const immediateCount =
    result.records
      .find((r) => r.get("timeline") === "immediate")
      ?.get("count")
      .toNumber() ?? 0;

  if (immediateCount > 0 && immediateCount < total) {
    suggestions.push({
      field: "requiredMaxStartTime",
      suggestedValue: "immediate",
      rationale: "Filter to engineers available immediately",
      resultingMatches: immediateCount,
      distributionInfo: `${immediateCount} of ${total} engineers (${Math.round(
        (immediateCount / total) * 100
      )}%) are available immediately`,
    });
  }

  return suggestions;
}

/**
 * Analyze skill distribution to suggest skill requirements.
 * Finds skills that are common in the result set but not required.
 */
async function analyzeSkillDistribution(
  session: Session,
  expanded: ExpandedSearchCriteria
): Promise<TighteningSuggestion[]> {
  /*
   * Query to find most common skills in the result set.
   * We look at skills that appear frequently - these are good candidates
   * for tightening because adding them as requirements would still yield results.
   */
  const query = `
    MATCH (e:Engineer)
    WHERE e.startTimeline IN $startTimeline
    MATCH (e)-[r:HAS_SKILL]->(s:Skill)
    WITH s.name AS skillName, s.id AS skillId, count(e) AS engineerCount,
         collect(DISTINCT r.proficiency) AS proficiencies
    ORDER BY engineerCount DESC
    LIMIT 10
    RETURN skillName, skillId, engineerCount, proficiencies
  `;

  const result = await session.run(query, {
    startTimeline: expanded.startTimeline,
  });

  // Get total engineer count for percentage calculation
  const totalQuery = `
    MATCH (e:Engineer)
    WHERE e.startTimeline IN $startTimeline
    RETURN count(e) AS total
  `;
  const totalResult = await session.run(totalQuery, {
    startTimeline: expanded.startTimeline,
  });
  const total = totalResult.records[0]?.get("total").toNumber() ?? 0;

  if (total === 0) return [];

  const suggestions: TighteningSuggestion[] = [];

  for (const record of result.records) {
    const skillName = record.get("skillName") as string;
    const skillId = record.get("skillId") as string;
    const count = record.get("engineerCount").toNumber();
    const percentage = Math.round((count / total) * 100);

    /*
     * Only suggest skills that:
     * 1. Are common enough to be useful (>20% of engineers)
     * 2. Would actually reduce results (not 100%)
     */
    if (percentage >= 20 && count < total) {
      suggestions.push({
        field: "requiredSkills",
        suggestedValue: { skill: skillId, minProficiency: "familiar" },
        rationale: `Add ${skillName} as a required skill`,
        resultingMatches: count,
        distributionInfo: `${count} of ${total} engineers (${percentage}%) have ${skillName}`,
      });
    }
  }

  return suggestions;
}
```

### Success Criteria:

- [x] TypeScript compiles: `npm run typecheck`
- [x] Tightening tests pass: `npm test -- src/services/constraint-advisor/tightening`
- [x] All tests pass: `npm test`

---

## Phase 6: Main Constraint Advisor Service and Integration

### Overview

Create the main constraint advisor service that orchestrates all components, then integrate it into the search service.

### Changes Required:

#### 1. Main Constraint Advisor Service

**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts` (new file)

```typescript
import type { Session } from "neo4j-driver";
import type {
  RelaxationResult,
  TighteningResult,
  ConflictSet,
} from "../../types/search.types.js";
import type { ExpandedSearchCriteria } from "../constraint-expander.service.js";
import type { AppliedFilter } from "../../types/search.types.js";
import type { DerivedConstraint } from "../../types/inference-rule.types.js";
import { decomposeConstraints } from "./constraint-decomposer.service.js";
import { findMinimalConflictSets } from "./quickxplain.service.js";
import { generateRelaxationSuggestions } from "./relaxation-generator.service.js";
import { generateTighteningSuggestions } from "./tightening-generator.service.js";

/** Threshold below which diagnosis is triggered */
const SPARSE_RESULTS_THRESHOLD = 3;

/** Threshold above which tightening suggestions are provided */
const MANY_RESULTS_THRESHOLD = 25;

export interface ConstraintAdviceInput {
  session: Session;
  totalCount: number;
  expanded: ExpandedSearchCriteria;
  appliedFilters: AppliedFilter[];
  derivedConstraints: DerivedConstraint[];
}

export interface ConstraintAdviceOutput {
  relaxation?: RelaxationResult;
  tightening?: TighteningResult;
}

/**
 * Get constraint advice based on result count.
 * - If totalCount < SPARSE_RESULTS_THRESHOLD: return relaxation advice (conflicts + suggestions)
 * - If totalCount >= MANY_RESULTS_THRESHOLD: return tightening suggestions
 */
export async function getConstraintAdvice(
  input: ConstraintAdviceInput
): Promise<ConstraintAdviceOutput> {
  const { session, totalCount, expanded, appliedFilters, derivedConstraints } =
    input;

  // Case 1: Sparse results - run conflict detection and relaxation
  if (totalCount < SPARSE_RESULTS_THRESHOLD) {
    const relaxation = await runRelaxationAnalysis(
      session,
      appliedFilters,
      derivedConstraints
    );
    return { relaxation };
  }

  // Case 2: Many results - suggest tightening
  if (totalCount >= MANY_RESULTS_THRESHOLD) {
    const tightening = await runTighteningAnalysis(session, expanded, appliedFilters);
    return { tightening };
  }

  // Case 3: Goldilocks zone - no suggestions needed
  return {};
}

async function runRelaxationAnalysis(
  session: Session,
  appliedFilters: AppliedFilter[],
  derivedConstraints: DerivedConstraint[]
): Promise<RelaxationResult> {
  // Step 1: Decompose constraints (simple mapping since AppliedFilter has typed values)
  const decomposed = decomposeConstraints(appliedFilters, derivedConstraints);

  // Step 2: Find minimal conflict sets using QUICKXPLAIN
  const { minimalSets } = await findMinimalConflictSets(session, decomposed, {
    maxSets: 3,
    insufficientThreshold: SPARSE_RESULTS_THRESHOLD,
  });

  // Step 3: Format conflict sets for API response
  const conflictSets = formatConflictSets(minimalSets);

  // Step 4: Get unique constraints for relaxation suggestions
  const uniqueConstraints = [
    ...new Map(minimalSets.flat().map((c) => [c.id, c])).values(),
  ];

  // Step 5: Generate relaxation suggestions
  const suggestions = await generateRelaxationSuggestions(
    session,
    decomposed,
    uniqueConstraints
  );

  return {
    conflictAnalysis: { conflictSets },
    suggestions,
  };
}

/**
 * Format minimal conflict sets into API response format.
 */
function formatConflictSets(minimalSets: TestableConstraint[][]): ConflictSet[] {
  return minimalSets.map((constraints) => ({
    constraints: constraints.map((c) => c.displayValue),
    explanation: generateConflictExplanation(constraints),
  }));
}

async function runTighteningAnalysis(
  session: Session,
  expanded: ExpandedSearchCriteria,
  appliedFilters: AppliedFilter[]
): Promise<TighteningResult> {
  const suggestions = await generateTighteningSuggestions(
    session,
    expanded,
    appliedFilters
  );

  return { suggestions };
}

function generateConflictExplanation(
  constraints: import("./constraint.types.js").TestableConstraint[]
): string {
  if (constraints.length === 1) {
    return `The constraint "${constraints[0].displayValue}" alone is too restrictive.`;
  }

  const descriptions = constraints.map((c) => c.displayValue);
  const lastDescription = descriptions.pop();
  return `The combination of ${descriptions.join(
    ", "
  )} and ${lastDescription} is too restrictive.`;
}
```

#### 2. Service Index Export

**File**: `recommender_api/src/services/constraint-advisor/index.ts` (new file)

```typescript
export { getConstraintAdvice } from "./constraint-advisor.service.js";
export type {
  ConstraintAdviceInput,
  ConstraintAdviceOutput,
} from "./constraint-advisor.service.js";
export type {
  TestableConstraint,
  DecomposedConstraints,
} from "./constraint.types.js";
```

#### 3. Integrate into Search Service

**File**: `recommender_api/src/services/search.service.ts`
**Changes**: Add constraint advice call after result count check

```typescript
// Add import at top of file (around line 30)
import { getConstraintAdvice } from "./constraint-advisor/index.js";

// Modify executeSearch function to include constraint advice
// After line 163 (where totalCount is extracted), add advice logic

// Inside executeSearch, after extracting totalCount and before Step 6:

// Step 5.5: Get constraint advice if needed (sparse or many results)
const adviceOutput = await getConstraintAdvice({
  session,
  totalCount,
  expanded,
  appliedFilters: expanded.appliedFilters,
  derivedConstraints: expanded.derivedConstraints,
});

// Then in the return statement (around line 223), add:
return {
  matches,
  totalCount,
  appliedFilters: expanded.appliedFilters,
  appliedPreferences: expanded.appliedPreferences,
  overriddenRuleIds: request.overriddenRuleIds || [],
  derivedConstraints: expanded.derivedConstraints.map((dc) => ({
    rule: dc.rule,
    action: dc.action,
    provenance: dc.provenance,
    override: dc.override,
  })),
  queryMetadata: {
    executionTimeMs,
    skillsExpanded: expandedSkillNames,
    defaultsApplied: expanded.defaultsApplied,
    unresolvedSkills,
  },
  // NEW: Include constraint advice results if present
  ...(adviceOutput.relaxation && { relaxation: adviceOutput.relaxation }),
  ...(adviceOutput.tightening && { tightening: adviceOutput.tightening }),
};
```

### Success Criteria:

- [x] TypeScript compiles: `npm run typecheck`
- [x] All unit tests pass: `npm test`

---

## Phase 7: E2E Tests and Postman Collection Update

### Overview

Add E2E test scenarios to the Postman collection verifying diagnosis and tightening behavior.

### Changes Required:

#### 1. Update Postman Collection

**File**: `postman/collections/search-filter-tests.postman_collection.json`
**Changes**: Add new folder "Constraint Advice" with test scenarios

New test scenarios to add:

1. **Empty Results - Conflicting Constraints**

   - Request: `{ "requiredSeniorityLevel": "principal", "maxBudget": 80000, "requiredTimezone": ["Asia/*"] }`
   - Assertions:
     - Response has `relaxation` field
     - `relaxation.conflictAnalysis.conflictSets` is non-empty array
     - `relaxation.suggestions` is non-empty array

2. **Sparse Results - Single Conflict**

   - Request: `{ "requiredSkills": [{"skill": "Kubernetes", "minProficiency": "expert"}], "requiredTimezone": ["Asia/*"] }`
   - Assertions:
     - `totalCount` is 0, 1, or 2
     - Response has `relaxation` field
     - `relaxation.suggestions` includes timezone or skill relaxation

3. **Many Results - Tightening Suggestions**

   - Request: `{}` (empty request gets all engineers)
   - Assertions:
     - `totalCount` >= 25
     - Response has `tightening` field
     - `tightening.suggestions` is non-empty array
     - Each suggestion has `field`, `suggestedValue`, `resultingMatches`, `distributionInfo`

4. **Goldilocks Zone - No Advice Needed**

   - Request: `{ "requiredSeniorityLevel": "senior" }`
   - Assertions:
     - `totalCount` >= 3 and < 25
     - Response does NOT have `relaxation` field
     - Response does NOT have `tightening` field

5. **Derived Constraint Conflict**
   - Request: `{ "teamFocus": "scaling", "requiredTimezone": ["Asia/*"] }`
   - Assertions:
     - Response has `relaxation` field if sparse
     - `relaxation.suggestions` includes `ruleIdToOverride` for derived constraints

### Success Criteria:

- [ ] E2E tests pass: `npm run test:e2e`
- [ ] All 172+ assertions pass (original + new)

Note: E2E tests require Tilt to be running. Run `npm run test:e2e` manually to verify.

---

## Phase 8: Integration Tests

### Overview

Add integration tests that test the full constraint advisor flow with a real Neo4j session mock.

### Changes Required:

#### 1. Constraint Advisor Integration Tests

**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.test.ts` (new file)

```typescript
import { describe, it, expect, vi } from "vitest";
import { getConstraintAdvice } from "./constraint-advisor.service.js";
import type { ExpandedSearchCriteria } from "../constraint-expander.service.js";

// Create a mock session that simulates Neo4j behavior
function createMockSession(resultCounts: Map<string, number>) {
  return {
    run: vi.fn().mockImplementation((query: string) => {
      // Determine result based on query pattern
      for (const [pattern, count] of resultCounts.entries()) {
        if (query.includes(pattern)) {
          return {
            records: [
              {
                get: (field: string) => {
                  if (field === "resultCount" || field === "count") {
                    return { toNumber: () => count };
                  }
                  return null;
                },
              },
            ],
          };
        }
      }
      return { records: [] };
    }),
  } as any;
}

describe("getConstraintAdvice", () => {
  const baseExpanded: ExpandedSearchCriteria = {
    minYearsExperience: null,
    maxYearsExperience: null,
    startTimeline: ["immediate", "two_weeks"],
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
    preferredMaxStartTime: null,
    requiredMaxStartTime: "two_weeks",
    preferredTimezone: [],
    derivedConstraints: [],
    derivedRequiredSkillIds: [],
    derivedSkillBoosts: new Map(),
  };

  describe("sparse results (< 3)", () => {
    it("returns relaxation with conflict analysis for zero results", async () => {
      const session = createMockSession(new Map([["RETURN count", 0]]));

      const result = await getConstraintAdvice({
        session,
        totalCount: 0,
        expanded: { ...baseExpanded, minYearsExperience: 10 },
        appliedFilters: [],
        derivedConstraints: [],
      });

      expect(result.relaxation).toBeDefined();
      expect(result.relaxation?.conflictAnalysis).toBeDefined();
      expect(result.tightening).toBeUndefined();
    });

    it("returns relaxation for sparse results (1-2)", async () => {
      const session = createMockSession(new Map([["RETURN count", 2]]));

      const result = await getConstraintAdvice({
        session,
        totalCount: 2,
        expanded: baseExpanded,
        appliedFilters: [],
        derivedConstraints: [],
      });

      expect(result.relaxation).toBeDefined();
      expect(result.relaxation?.suggestions).toBeDefined();
    });
  });

  describe("many results (>= 25)", () => {
    it("returns tightening suggestions", async () => {
      const session = createMockSession(
        new Map([
          ["RETURN region", 30],
          ["count(e) AS count", 30],
        ])
      );

      const result = await getConstraintAdvice({
        session,
        totalCount: 30,
        expanded: baseExpanded,
        appliedFilters: [],
        derivedConstraints: [],
      });

      expect(result.tightening).toBeDefined();
      expect(result.tightening?.suggestions).toBeDefined();
      expect(result.relaxation).toBeUndefined();
    });
  });

  describe("goldilocks zone (3-24)", () => {
    it("returns neither relaxation nor tightening", async () => {
      const session = createMockSession(new Map());

      const result = await getConstraintAdvice({
        session,
        totalCount: 15,
        expanded: baseExpanded,
        appliedFilters: [],
        derivedConstraints: [],
      });

      expect(result.relaxation).toBeUndefined();
      expect(result.tightening).toBeUndefined();
    });
  });
});
```

### Success Criteria:

- [x] All tests pass: `npm test`
- [x] Test coverage for constraint-advisor service: `npm run test:coverage`

---

## Testing Strategy

### Unit Tests:

- Constraint decomposition for all constraint types
- QUICKXPLAIN algorithm with various conflict scenarios
- Relaxation generation for each constraint type
- Tightening suggestion generation

### Integration Tests:

- Full diagnosis flow with mock Neo4j session
- Edge cases: empty constraints, single constraint, many constraints
- Threshold boundary testing (2 vs 3, 24 vs 25)

### E2E Tests (Postman):

- Real API calls against running Tilt environment
- Verify response schema compliance
- Test with seed data scenarios

## Performance Considerations

- **Single MCS**: QUICKXPLAIN runs O(k log n) queries where k is conflict set size, n is constraint count
- **Multiple MCS (hitting set approach)**: For each constraint in the first MCS, we may run another QUICKXPLAIN
  - Worst case: O(k × k log n) queries for maxSets MCS
  - Typical case: Much fewer, since many branches are pruned when removing a constraint makes the remaining set consistent
- For typical requests (5-10 constraints, 2-3 MCS), this is ~20-50 queries
- Each query is a COUNT query (fast)
- Total diagnosis overhead: ~100-400ms for sparse results
- Consider adding query caching if performance degrades with more constraints

## Migration Notes

- No database schema changes required
- No breaking API changes (diagnosis fields are optional/additive)
- Existing clients will ignore new fields
- Seed data already supports conflict scenarios (40 engineers with varied profiles)

## References

- Research document: `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-10-project-2-implementation-research.md`
- QUICKXPLAIN paper: [Junker, U. (2004). QuickXPlain](https://link.springer.com/article/10.1007/s10462-022-10149-w)
- Textbook: Aggarwal, C. "Recommender Systems: The Textbook" - Sections 5.2.4-5.2.5
- Seed data specification: `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-08-40-engineer-seed-implementation.md`
