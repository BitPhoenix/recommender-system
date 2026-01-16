# Tightening-Tester Duplication Refactoring Plan

## Overview

Refactor `tightening-tester.service.ts` to eliminate the repeated "skill-aware query execution" pattern that appears in all four public functions. The duplication stems from each function needing to: check for skills → extract skills → build property conditions → build skill query → execute → parse result.

## Current State Analysis

### The Duplicated Pattern

All four functions in `tightening-tester.service.ts` repeat this logic:

```typescript
const hasSkillConstraints = decomposedConstraints.constraints.some(
  c => c.constraintType === ConstraintType.SkillTraversal
);

if (hasSkillConstraints) {
  const { userRequiredSkills, derivedSkillIds } = extractSkillConstraints(decomposedConstraints);
  if (userRequiredSkills.length > 0 || derivedSkillIds.length > 0) {
    const propertyConstraintIds = new Set(
      decomposedConstraints.constraints
        .filter(c => c.constraintType === ConstraintType.Property)
        .map(c => c.id)
    );
    const propertyConditions = buildPropertyConditions(decomposed, propertyConstraintIds);
    const skillGroups = groupSkillsByProficiency(userRequiredSkills);
    const { query, params } = buildSkillFilterCountQuery(skillGroups, propertyConditions, derivedSkillIds);

    const result = await session.run(query, params);
    return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
  }
}

// Property-only fallback...
```

### Where Variations Occur

| Function | Property Conditions Source | Skills Source | Fallback Query |
|----------|---------------------------|---------------|----------------|
| `testTightenedPropertyValue` | Modified decomposed | From decomposed | `buildQueryWithConstraints` |
| `testAddedPropertyConstraint` | Manually built + extra clause | From decomposed | Manual query string |
| `testAddedSkillConstraint` | From decomposed | Modified (new skill added) | N/A (always has skills) |
| `getBaselineCount` | From decomposed | From decomposed | `buildQueryWithConstraints` |

### Comparison with `relaxation-tester.service.ts`

The relaxation tester has similar but slightly different patterns:
- `testRelaxedValue`: Property-only, no skill awareness needed
- `testSkillRelaxation`: Always has skills, cleaner code
- `testSkillRemoval`: Property-only, no skill awareness needed

The relaxation tester is already cleaner because each function has a clear single responsibility.

## Desired End State

A single helper function handles query execution with these inputs:
1. Pre-built property conditions
2. Skill constraints (user + derived)
3. Base match clause (for property-only fallback)

Each public function prepares its specific inputs, then delegates to the shared executor.

### Verification

After refactoring:
1. All existing tests pass: `npm test -- src/services/constraint-advisor/tightening-tester.service.test.ts`
2. All constraint-advisor tests pass: `npm test -- src/services/constraint-advisor/`
3. TypeScript compiles: `npm run typecheck`
4. E2E tests pass: `npm run test:e2e`

## What We're NOT Doing

- **Not refactoring `relaxation-tester.service.ts`** - It's already cleaner with distinct responsibilities per function
- **Not changing the query builder APIs** - The existing `buildSkillFilterCountQuery` and `buildPropertyConditions` are fine
- **Not adding new query builders** - We're consolidating the calling pattern, not the query construction

## Implementation Approach

Extract the query execution into a single helper that accepts a `CountQueryContext` object. This approach:

1. **Makes the decision tree explicit**: The helper encodes "if skills → skill query, else → property query" once
2. **Separates concerns**: Each public function focuses on preparing its specific context (what changes), the helper handles execution (shared mechanics)
3. **Improves testability**: The helper can be unit tested with mock contexts

## Phase 1: Add `CountQueryContext` Type and `runCountQuery` Helper

### Overview

Add a new interface and helper function at the bottom of `tightening-tester.service.ts` that encapsulates the repeated query execution pattern.

### Changes Required:

#### 1. Add new types and helper function

**File**: `recommender_api/src/services/constraint-advisor/tightening-tester.service.ts`

**Add after line 11 (after imports), before the LOCAL TYPES section:**

```typescript
import type { ResolvedSkillWithProficiency } from "../skill-resolver.service.js";
```

**Replace the LOCAL TYPES section (lines 14-28) with:**

```typescript
// ============================================================================
// LOCAL TYPES
// ============================================================================

/**
 * Specification for a property condition to add to a query.
 * Used when testing the effect of adding a new constraint.
 */
export interface PropertyConditionSpec {
  field: string;
  operator: string;
  value: unknown;
  /** Key used for generating unique parameter names */
  paramKey: string;
}

/**
 * Context for running a constraint count query.
 * Encapsulates all inputs needed to build and execute either a skill-aware
 * or property-only count query.
 */
interface CountQueryContext {
  /** Pre-built property conditions (WHERE clauses and params) */
  propertyConditions: { whereClauses: string[]; params: Record<string, unknown> };
  /** User-specified skills with proficiency requirements */
  userRequiredSkills: ResolvedSkillWithProficiency[];
  /** Derived skill IDs (existence-only check) */
  derivedSkillIds: string[];
  /** Base MATCH clause for property-only fallback */
  baseMatchClause: string;
}
```

**Add at the end of the file, before the closing (after `buildWhereClause`):**

```typescript
/**
 * Executes a count query with the appropriate strategy based on skill presence.
 *
 * This is the SINGLE LOCATION for the skill-aware vs property-only decision.
 * All tester functions prepare a CountQueryContext and delegate here.
 *
 * Decision tree:
 * - If skills exist → buildSkillFilterCountQuery → skill-aware Cypher
 * - If no skills → simple property-only Cypher
 */
async function runCountQuery(
  session: Session,
  context: CountQueryContext
): Promise<number> {
  const { propertyConditions, userRequiredSkills, derivedSkillIds, baseMatchClause } = context;
  const hasSkills = userRequiredSkills.length > 0 || derivedSkillIds.length > 0;

  if (hasSkills) {
    const skillGroups = groupSkillsByProficiency(userRequiredSkills);
    const { query, params } = buildSkillFilterCountQuery(
      skillGroups,
      propertyConditions,
      derivedSkillIds
    );
    const result = await session.run(query, params);
    return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
  }

  // Property-only query
  const { whereClauses, params } = propertyConditions;
  const whereClause = whereClauses.length > 0
    ? `WHERE ${whereClauses.join("\n  AND ")}`
    : "";
  const query = `
${baseMatchClause}
${whereClause}
RETURN count(e) AS resultCount
`;

  const result = await session.run(query, params);
  return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] No linting errors (if applicable)

**Implementation Note**: This phase just adds the helper. No behavior changes yet.

---

## Phase 2: Refactor Public Functions to Use Helper

### Overview

Refactor all four public functions to use the new `runCountQuery` helper.

### Changes Required:

#### 1. Refactor `testTightenedPropertyValue`

**File**: `recommender_api/src/services/constraint-advisor/tightening-tester.service.ts`

**Replace the entire function (lines 41-96) with:**

```typescript
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

  const modifiedDecomposed: DecomposedConstraints = {
    ...decomposedConstraints,
    constraints: modifiedConstraints,
  };

  // Build property conditions from the modified constraints
  const propertyConstraintIds = new Set(
    modifiedConstraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const propertyConditions = buildPropertyConditions(modifiedDecomposed, propertyConstraintIds);

  // Extract skills from original decomposed (skills aren't modified)
  const { userRequiredSkills, derivedSkillIds } = extractSkillConstraints(decomposedConstraints);

  return runCountQuery(session, {
    propertyConditions,
    userRequiredSkills,
    derivedSkillIds,
    baseMatchClause: decomposedConstraints.baseMatchClause,
  });
}
```

#### 2. Refactor `testAddedPropertyConstraint`

**Replace the entire function with:**

```typescript
/**
 * Test what result count we'd get with an ADDED property constraint.
 * Used when the user doesn't currently have a constraint on this field.
 *
 * Example: User has no timezone filter, we want to test adding "America/*".
 */
export async function testAddedPropertyConstraint(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  condition: PropertyConditionSpec
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
  const newParamName = `tighten_${condition.paramKey}`;
  const newClause = buildWhereClause(condition.field, condition.operator, newParamName);
  whereClauses.push(newClause);
  params[newParamName] = condition.value;

  // Extract skills from decomposed
  const { userRequiredSkills, derivedSkillIds } = extractSkillConstraints(decomposedConstraints);

  return runCountQuery(session, {
    propertyConditions: { whereClauses, params },
    userRequiredSkills,
    derivedSkillIds,
    baseMatchClause: decomposedConstraints.baseMatchClause,
  });
}
```

#### 3. Refactor `testAddedSkillConstraint`

**Replace the entire function with:**

```typescript
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
  const { userRequiredSkills, derivedSkillIds } = extractSkillConstraints(decomposedConstraints);

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

  return runCountQuery(session, {
    propertyConditions,
    userRequiredSkills: allSkills,
    derivedSkillIds,
    baseMatchClause: decomposedConstraints.baseMatchClause,
  });
}
```

#### 4. Refactor `getBaselineCount`

**Replace the entire function with:**

```typescript
/**
 * Get count with ALL current constraints applied (no modifications).
 * Used as the baseline "total" for percentage calculations.
 */
export async function getBaselineCount(
  session: Session,
  decomposedConstraints: DecomposedConstraints
): Promise<number> {
  const { userRequiredSkills, derivedSkillIds } = extractSkillConstraints(decomposedConstraints);

  const propertyConstraintIds = new Set(
    decomposedConstraints.constraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const propertyConditions = buildPropertyConditions(decomposedConstraints, propertyConstraintIds);

  return runCountQuery(session, {
    propertyConditions,
    userRequiredSkills,
    derivedSkillIds,
    baseMatchClause: decomposedConstraints.baseMatchClause,
  });
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tightening-tester tests pass: `npm test -- src/services/constraint-advisor/tightening-tester.service.test.ts`
- [x] All constraint-advisor tests pass: `npm test -- src/services/constraint-advisor/`
- [x] E2E tests pass: `npm run test:e2e`

#### Manual Verification:
- [ ] Code review confirms reduced duplication
- [ ] Each public function is shorter and focused on its specific modification logic

**Implementation Note**: After completing this phase and all automated verification passes, the refactoring is complete.

---

## Testing Strategy

### Unit Tests:

The existing tests in `tightening-tester.service.test.ts` should cover this refactoring. Key test scenarios:

- Property-only constraints (no skills) - exercises the property-only path in `runCountQuery`
- Skill + property constraints - exercises the skill-aware path
- Adding new property constraints
- Adding new skill constraints
- Baseline count calculation

### Integration Tests:

E2E tests via Newman will verify end-to-end behavior hasn't changed.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single helper function vs multiple | One function with clear decision tree is easier to understand than multiple specialized helpers |
| `CountQueryContext` interface | Makes the inputs explicit and allows type-safe construction |
| Keep `buildWhereClause` unchanged | It's a simple utility unrelated to the duplication pattern |
| Property-only fallback in helper | Consolidates both paths in one place; callers don't need to know the strategy |

---

## Phase 3: Update Documentation

### Overview

Update the research walkthrough documents to reflect the new `runCountQuery` helper and `CountQueryContext` pattern.

### Changes Required:

#### 1. Update Tightening Generator Walkthrough

**File**: `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-15-tightening-generator-walkthrough.md`

**Replace Section 3.2 "The Skill-Aware Pattern" (lines 213-245) with:**

```markdown
### 3.2 The Unified Count Query Pattern

All four functions delegate to a shared `runCountQuery` helper via a `CountQueryContext`:

```typescript
// CountQueryContext interface (tightening-tester.service.ts)
interface CountQueryContext {
  propertyConditions: { whereClauses: string[]; params: Record<string, unknown> };
  userRequiredSkills: ResolvedSkillWithProficiency[];
  derivedSkillIds: string[];
  baseMatchClause: string;
}
```

Each public function prepares its specific context, then delegates:

| Function | What It Prepares |
|----------|-----------------|
| `getBaselineCount()` | Unmodified constraints |
| `testTightenedPropertyValue()` | Property conditions with modified param value |
| `testAddedPropertyConstraint()` | Property conditions with extra WHERE clause |
| `testAddedSkillConstraint()` | Skills array with new skill added |

The `runCountQuery` helper encapsulates the decision tree:
- If skills exist → `buildSkillFilterCountQuery` → skill-aware Cypher
- If no skills → simple property-only Cypher

**Why this matters:** The skill-aware vs property-only logic lives in ONE place, eliminating ~150 lines of duplicated code.
```

**Update Section 3.1 "Four Public Functions" table (lines 204-211) - add note about delegation:**

After the table, add:
```markdown
All four functions delegate query execution to `runCountQuery(session, context)` after preparing their specific `CountQueryContext`.
```

#### 2. Update Project 2 Constraint Advisor Walkthrough

**File**: `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-14-project-2-constraint-advisor-walkthrough.md`

**Update Section 3.2 lines 373-376 to reflect the new pattern:**

Replace:
```markdown
**File:** `recommender_api/src/services/constraint-advisor/tightening-tester.service.ts`

1. **`testTightenedPropertyValue()`**, **`testAddedPropertyConstraint()`**, **`testAddedSkillConstraint()`**, **`getBaselineCount()`** - All use `extractSkillConstraints()` from `skill-extraction.utils.ts` to extract skills consistently
```

With:
```markdown
**File:** `recommender_api/src/services/constraint-advisor/tightening-tester.service.ts`

All four public functions delegate to a shared `runCountQuery(session, context)` helper:
- **`testTightenedPropertyValue()`** - Modifies property param value, delegates to helper
- **`testAddedPropertyConstraint()`** - Adds new WHERE clause, delegates to helper
- **`testAddedSkillConstraint()`** - Adds skill to array, delegates to helper
- **`getBaselineCount()`** - Uses unmodified constraints, delegates to helper

The `CountQueryContext` interface captures: property conditions, user skills, derived skill IDs, and base match clause. The helper handles the skill-aware vs property-only decision tree.
```

**Add to "Completed Post-Implementation" section (after item 13, around line 620):**

```markdown
14. **Tightening tester duplication consolidation** - Eliminated repeated skill-aware query pattern:
    - Added `CountQueryContext` interface to encapsulate query inputs
    - Added `runCountQuery()` helper as single location for skill-aware vs property-only decision
    - All four tester functions (`getBaselineCount`, `testTightenedPropertyValue`, `testAddedPropertyConstraint`, `testAddedSkillConstraint`) now prepare context and delegate to helper
    - Reduced ~150 lines of duplicated code across the four functions
```

### Success Criteria:

#### Automated Verification:
- [x] Documentation files exist and are valid markdown

#### Manual Verification:
- [ ] Section 3.2 in tightening-generator-walkthrough accurately describes the new pattern
- [ ] Section 3.2 in constraint-advisor-walkthrough accurately describes the delegation pattern
- [ ] "Completed Post-Implementation" list is updated with the refactoring

**Implementation Note**: This phase should be completed after Phase 2 passes all tests.

---

## References

- Original duplication analysis: `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-15-tightening-generator-walkthrough.md` (Section 3.2)
- Related service: `recommender_api/src/services/constraint-advisor/relaxation-tester.service.ts`
- Query builder: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts:146-200`
