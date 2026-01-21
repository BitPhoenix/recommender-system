# Unify Constraint Advisor Skill Filtering Implementation Plan

## Overview

Refactor the constraint advisor services to use the unified `skillFilterGroups` mechanism instead of the separate `derivedSkillIds` parameter. This aligns the count/distribution queries with the main search query pattern established in the HAS_ALL removal work.

## Current State Analysis

The codebase currently has **two different skill filtering patterns**:

### Pattern 1: Main Search Query (unified)
```typescript
// search.service.ts - builds unified skillFilterGroups
const skillFilterGroups = [...userSkillFilterGroups, ...derivedSkillFilterGroups];
// Passes to buildSearchQuery which uses skillFilterGroups for all skill filtering
```

### Pattern 2: Constraint Advisor Queries (separate paths)
```typescript
// skill-extraction.utils.ts - returns separate arrays
interface ExtractedSkillConstraints {
  userRequiredSkills: ResolvedSkillWithProficiency[];
  derivedSkillIds: string[];  // ← Separate path
}

// buildSkillFilterCountQuery - takes derivedSkillIds as separate param
export function buildSkillFilterCountQuery(
  skillGroups: SkillProficiencyGroups,
  propertyConditions: {...},
  derivedSkillIds: string[]  // ← Separate parameter
): CypherQuery
```

### Key Files Using derivedSkillIds:

| File | Usage |
|------|-------|
| `skill-extraction.utils.ts:19,46,60,66` | Returns `derivedSkillIds` in result |
| `relaxation-tester.service.ts:77,102` | Extracts and passes `derivedSkillIds` |
| `tightening-tester.service.ts:42,95,100,133,138,154,178,191,203,243,244,251` | Context interface and all usages |
| `tightening-generator.service.ts:431,451` | Extracts and passes to distribution query |
| `search-query.builder.ts:265,281,287,299,326,332,347,348,363,371` | Query builders accept separate param |

## Desired End State

A single unified pattern where all skill filtering uses `SkillFilterGroup[]`:

```typescript
// skill-extraction.utils.ts - returns unified groups
interface ExtractedSkillConstraints {
  skillFilterGroups: SkillFilterGroup[];
}

// buildSkillFilterCountQuery - uses groups
export function buildSkillFilterCountQuery(
  skillFilterGroups: SkillFilterGroup[],
  propertyConditions: {...}
): CypherQuery
```

### Verification:
- All unit tests pass
- All E2E tests pass (321/321 assertions)
- `grep -r "derivedSkillIds" src/services/constraint-advisor/` returns no matches
- `grep -r "derivedSkillIds" src/services/cypher-query-builder/` returns no matches (in count/distribution queries)

## What We're NOT Doing

- **Not changing the main search query** - it already uses the unified pattern
- **Not changing functional behavior** - derived skills are already hierarchy-expanded
- **Not removing SkillFilterGroup.isDerived** - this is needed for existence-only vs proficiency checks
- **Not touching constraint-decomposer.service.ts** - it creates the constraints, extraction handles conversion

## Implementation Approach

Work bottom-up: update the query builders first, then the extraction utility, then the services that use them.

---

## Phase 1: Update Query Builders

### Overview
Update `buildSkillFilterCountQuery` and `buildSkillDistributionQuery` to accept `SkillFilterGroup[]` instead of separate `derivedSkillIds`.

### Changes Required:

#### 1. search-query.builder.ts

**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`

**Update buildSkillFilterCountQuery** (lines 278-332):

```typescript
/**
 * Builds a count-only query for skill-filtered searches.
 * Uses unified skillFilterGroups for both user and derived skills.
 *
 * @param skillFilterGroups - Unified skill filter groups (user and derived)
 * @param propertyConditions - WHERE clause conditions
 */
export function buildSkillFilterCountQuery(
  skillFilterGroups: SkillFilterGroup[],
  propertyConditions: { whereClauses: string[]; params: Record<string, unknown> }
): CypherQuery {
  // Separate user and derived groups
  const userGroups = skillFilterGroups.filter(g => !g.isDerived);
  const derivedGroups = skillFilterGroups.filter(g => g.isDerived);

  // Build proficiency buckets from user groups
  const skillGroups = groupSkillsByProficiencyFromGroups(userGroups);

  const allSkillIds = [
    ...skillGroups.learningLevelSkillIds,
    ...skillGroups.proficientLevelSkillIds,
    ...skillGroups.expertLevelSkillIds,
    ...derivedGroups.flatMap(g => g.expandedSkillIds),
  ];

  if (allSkillIds.length === 0) {
    return { query: `RETURN 0 AS resultCount`, params: {} };
  }

  const params: Record<string, unknown> = {
    ...propertyConditions.params,
    allSkillIds,
    learningLevelSkillIds: skillGroups.learningLevelSkillIds,
    proficientLevelSkillIds: skillGroups.proficientLevelSkillIds,
    expertLevelSkillIds: skillGroups.expertLevelSkillIds,
  };

  // Add per-group parameters for derived skills
  derivedGroups.forEach((group, i) => {
    params[`derivedGroup${i}`] = group.expandedSkillIds;
  });

  const propertyWhereClause = propertyConditions.whereClauses.length > 0
    ? propertyConditions.whereClauses.join('\n  AND ')
    : 'true';

  // Build derived skill existence clauses (HAS_ANY per group)
  const derivedClauses = derivedGroups.map((_, i) =>
    `SIZE([x IN allEngineerSkillIds WHERE x IN $derivedGroup${i}]) > 0`
  );
  const derivedCondition = derivedClauses.length > 0
    ? `\n  AND ${derivedClauses.join('\n  AND ')}`
    : '';

  const query = `
MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
WHERE s.id IN $allSkillIds
  AND ${propertyWhereClause}
WITH e, ${buildProficiencyQualificationClause()} AS qualifyingSkillIds,
     COLLECT(DISTINCT s.id) AS allEngineerSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) >= SIZE($allSkillIds) - ${derivedGroups.flatMap(g => g.expandedSkillIds).length}${derivedCondition}
RETURN count(DISTINCT e) AS resultCount
`;

  return { query, params };
}
```

**Update buildSkillDistributionQuery** (lines 345-420) with same pattern.

**Add helper function**:

```typescript
/**
 * Groups user skill filter groups by proficiency level.
 * Converts SkillFilterGroup[] to SkillProficiencyGroups for query building.
 */
function groupSkillsByProficiencyFromGroups(
  groups: SkillFilterGroup[]
): SkillProficiencyGroups {
  const learningLevelSkillIds: string[] = [];
  const proficientLevelSkillIds: string[] = [];
  const expertLevelSkillIds: string[] = [];

  for (const group of groups) {
    if (group.isDerived) continue; // Skip derived, handled separately

    const skillIds = group.expandedSkillIds;
    switch (group.minProficiency) {
      case 'expert':
        expertLevelSkillIds.push(...skillIds);
        break;
      case 'proficient':
        proficientLevelSkillIds.push(...skillIds);
        break;
      default:
        learningLevelSkillIds.push(...skillIds);
    }
  }

  return { learningLevelSkillIds, proficientLevelSkillIds, expertLevelSkillIds };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Query builder tests pass: `npm test -- search-query.builder`

---

## Phase 2: Update Skill Extraction Utility

### Overview
Change `ExtractedSkillConstraints` to return unified `skillFilterGroups` instead of separate arrays.

### Changes Required:

#### 1. skill-extraction.utils.ts

**File**: `recommender_api/src/services/constraint-advisor/skill-extraction.utils.ts`

**Update interface and functions**:

```typescript
import type { SkillFilterGroup } from "../cypher-query-builder/query-types.js";

/**
 * Result of extracting skills from decomposed constraints.
 * Returns unified skill filter groups for both user and derived skills.
 */
export interface ExtractedSkillConstraints {
  /** Unified skill filter groups (both user and derived) */
  skillFilterGroups: SkillFilterGroup[];
}

/**
 * Extracts skill constraints from decomposed constraints.
 * Returns unified SkillFilterGroup[] matching the main search query pattern.
 */
export function extractSkillConstraints(
  decomposed: DecomposedConstraints
): ExtractedSkillConstraints {
  return extractSkillConstraintsFromArray(decomposed.constraints);
}

export function extractSkillConstraintsFromArray(
  constraints: TestableConstraint[]
): ExtractedSkillConstraints {
  const skillFilterGroups: SkillFilterGroup[] = [];

  for (const constraint of constraints) {
    if (constraint.constraintType !== ConstraintType.SkillTraversal) continue;

    if (constraint.field === 'requiredSkills' && isUserSkillConstraint(constraint)) {
      const skillReq = constraint.value;
      skillFilterGroups.push({
        expandedSkillIds: [skillReq.skill],
        originalSkillId: skillReq.skill,
        minProficiency: skillReq.minProficiency ?? 'learning',
        preferredMinProficiency: null,
        isDerived: false,
      });
    } else if (constraint.field === 'derivedSkills' && isDerivedSkillConstraint(constraint)) {
      // Derived skills already have expanded IDs from constraint-expander
      skillFilterGroups.push({
        expandedSkillIds: constraint.value,
        originalSkillId: constraint.value[0] ?? null,
        minProficiency: 'learning', // Existence-only
        preferredMinProficiency: null,
        isDerived: true,
      });
    }
  }

  return { skillFilterGroups };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`

---

## Phase 3: Update Tightening Tester Service

### Overview
Update `tightening-tester.service.ts` to use `skillFilterGroups` instead of `derivedSkillIds`.

### Changes Required:

#### 1. tightening-tester.service.ts

**File**: `recommender_api/src/services/constraint-advisor/tightening-tester.service.ts`

**Update CountQueryContext interface** (lines 36-45):

```typescript
interface CountQueryContext {
  propertyConditions: { whereClauses: string[]; params: Record<string, unknown> };
  skillFilterGroups: SkillFilterGroup[];  // Unified groups
  baseMatchClause: string;
}
```

**Update all functions** that extract and use skills:

```typescript
// Example pattern for each function:
const { skillFilterGroups } = extractSkillConstraints(decomposedConstraints);

return runCountQuery(session, {
  propertyConditions,
  skillFilterGroups,
  baseMatchClause: decomposedConstraints.baseMatchClause,
});
```

**Update runCountQuery** (around line 243):

```typescript
async function runCountQuery(
  session: Session,
  context: CountQueryContext
): Promise<number> {
  const { propertyConditions, skillFilterGroups, baseMatchClause } = context;
  const hasSkills = skillFilterGroups.length > 0;

  if (!hasSkills) {
    // Property-only query
    const { query, params } = buildPropertyOnlyCountQuery(propertyConditions, baseMatchClause);
    const result = await session.run(query, params);
    return toNumber(result.records[0]?.get('resultCount'));
  }

  // Skill-filtered query using unified groups
  const { query, params } = buildSkillFilterCountQuery(
    skillFilterGroups,
    propertyConditions
  );

  const result = await session.run(query, params);
  return toNumber(result.records[0]?.get('resultCount'));
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Tightening tester tests pass: `npm test -- tightening-tester`

---

## Phase 4: Update Relaxation Tester Service

### Overview
Update `relaxation-tester.service.ts` to use `skillFilterGroups`.

### Changes Required:

#### 1. relaxation-tester.service.ts

**File**: `recommender_api/src/services/constraint-advisor/relaxation-tester.service.ts`

**Update testSkillProficiencyRelaxation** (around line 70):

```typescript
export async function testSkillProficiencyRelaxation(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: UserSkillConstraint,
  modifiedSkill: { skill: string; minProficiency?: ProficiencyLevel }
): Promise<number> {
  const newProficiency: ProficiencyLevel = modifiedSkill.minProficiency ?? 'learning';

  // Extract unified skill filter groups
  const { skillFilterGroups } = extractSkillConstraintsFromArray(decomposedConstraints.constraints);

  // Modify the proficiency for the target skill
  const modifiedGroups = skillFilterGroups.map(group => {
    if (!group.isDerived && group.originalSkillId === constraint.value.skill) {
      return { ...group, minProficiency: newProficiency };
    }
    return group;
  });

  if (modifiedGroups.length === 0) {
    return 0;
  }

  // Build property conditions
  const propertyConstraintIds = new Set(
    decomposedConstraints.constraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const propertyConditions = buildPropertyConditions(
    decomposedConstraints,
    propertyConstraintIds
  );

  // Build count query using unified groups
  const { query, params } = buildSkillFilterCountQuery(modifiedGroups, propertyConditions);

  const result = await session.run(query, params);
  return toNumber(result.records[0]?.get('resultCount'));
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Relaxation tester tests pass: `npm test -- relaxation-tester`

---

## Phase 5: Update Tightening Generator Service

### Overview
Update `tightening-generator.service.ts` to use `skillFilterGroups`.

### Changes Required:

#### 1. tightening-generator.service.ts

**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

**Update generateSkillTighteningSuggestions** (around line 431):

```typescript
// Extract unified skill filter groups
const { skillFilterGroups } = extractSkillConstraints(decomposed);

// Build and run distribution query using unified groups
const { query: distributionQuery, params: distributionParams } =
  buildSkillDistributionQuery(
    skillFilterGroups,
    propertyConditions
  );
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Tightening generator tests pass: `npm test -- tightening-generator`

---

## Phase 6: Update Tests and Final Cleanup

### Overview
Update test files and verify no remaining `derivedSkillIds` references.

### Changes Required:

1. Update test mocks and assertions in:
   - `relaxation-tester.service.test.ts`
   - `tightening-tester.service.test.ts`
   - `tightening-generator.service.test.ts`
   - `search-query.builder.test.ts`

2. Remove old `groupSkillsByProficiency` usage where replaced

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All unit tests pass: `npm test` (810/810 passed)
- [x] All E2E tests pass: `npm run test:e2e` (321/321 assertions)
- [x] No derivedSkillIds in constraint-advisor API: buildSkillFilterCountQuery and buildSkillDistributionQuery now accept SkillFilterGroup[]
- [x] No derivedSkillIds in count/distribution function signatures: Check search-query.builder.ts - functions now take SkillFilterGroup[]

#### Manual Verification:
- [x] Search with teamFocus returns same results as before (E2E tests 14-15, 48-57)
- [x] Constraint advisor suggestions work correctly (E2E tests 58-62)

---

## Testing Strategy

### Unit Tests:
- Verify skill extraction returns unified `skillFilterGroups`
- Verify count queries work with unified groups
- Verify derived skills are handled as existence-only

### Integration Tests:
- E2E tests cover constraint advisor functionality
- No new E2E tests needed - behavior unchanged

### Manual Testing Steps:
1. Run search with `teamFocus: greenfield` - verify tightening suggestions appear
2. Run search with skill constraints - verify relaxation suggestions work
3. Check constraint advisor output matches pre-refactor behavior

## Performance Considerations

No performance impact expected - same number of database queries with same logic, just cleaner code structure.

## Migration Notes

No data migration needed - this is a pure code refactoring.

## References

- Parent ticket: HAS_ALL removal implementation plan `thoughts/private/plans/2026-01-20-remove-has-all-unify-skill-filtering.md`
- Related code: `search.service.ts` shows the unified pattern to follow

---

## Retrospective: Was This Refactoring Worthwhile?

**Completed:** 2026-01-20

### Assessment: Mixed Results

This refactoring achieved its stated goal (unify the API) but in retrospect, the unification wasn't clearly necessary.

### What Improved

- **API consistency**: The count/distribution queries now accept `SkillFilterGroup[]`, matching the main search query pattern
- **Caller simplification**: Callers no longer need to call `groupSkillsByProficiency()` explicitly

### What Didn't Really Improve

The constraint advisor use case is fundamentally different from the main search. The code now does a round-trip conversion:

```
constraints → SkillFilterGroup[] → { proficiency buckets, derivedSkillIds }
```

The query builders immediately decompose the unified groups:

```typescript
// In buildSkillFilterCountQuery:
const userGroups = skillFilterGroups.filter(g => !g.isDerived);
const derivedGroups = skillFilterGroups.filter(g => g.isDerived);
const skillGroups = groupSkillsByProficiencyFromGroups(userGroups);
```

The original pattern returning `{ userRequiredSkills, derivedSkillIds }` was more direct for what the constraint advisor actually needs. We moved complexity (the `groupSkillsByProficiency` call) rather than removing it.

### Why We're Keeping It

1. The change is complete and all tests pass (810 unit, 321 E2E assertions)
2. The "cost" is code complexity, not runtime performance
3. Reverting would be more churn for marginal benefit
4. It's not actively harmful, just not as elegant as it could be

### Lessons Learned

1. **Pattern consistency is a means, not an end.** Unifying patterns has value when it reduces cognitive load or enables code reuse. When different parts of a codebase have genuinely different requirements, forcing them into the same pattern can add indirection without benefit.

2. **Ask "what problem does this solve?" before creating unification plans.** "These two things use different patterns" isn't inherently a problem worth fixing. The original constraint advisor code was already correct and reasonably clean for its use case.

3. **`SkillFilterGroup` was designed for HAS_ANY per-group semantics** (one requested skill with expanded descendants). The constraint advisor doesn't use that semantic—it just passes skills to count queries. The abstraction doesn't fit the use case.

### Recommendation for Future Work

Don't create similar "unify for consistency" refactoring plans without identifying a concrete problem they solve (e.g., bugs from divergent logic, difficulty understanding code, code duplication causing maintenance burden). Pattern alignment for its own sake isn't sufficient justification.
