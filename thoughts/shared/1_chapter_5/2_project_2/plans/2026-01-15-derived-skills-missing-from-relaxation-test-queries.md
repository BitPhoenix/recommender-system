# Include Derived Skills in Skill Relaxation Test Queries

## Overview

Fix a bug where `testSkillRelaxation` does not include derived skill requirements in its test queries. When testing "what if we relaxed TypeScript from expert to proficient?", the test query should still enforce derived skill requirements (e.g., "scaling requires distributed systems"), but currently it doesn't. This leads to inflated result counts in relaxation suggestions.

## Current State Analysis

The `resolveSkillsFromConstraints` function in `relaxation-generator.service.ts:465-490` explicitly filters out derived skills:

```typescript
// Line 474: Skip derived skills from inference rules
if (constraint.field !== 'requiredSkills') continue;
```

This causes an inconsistency:

| Component | User Skills | Property Constraints | Derived Skills |
|-----------|-------------|---------------------|----------------|
| Main Search | YES | YES | YES |
| testSkillRelaxation | YES | YES | **NO** |

### Key Structural Difference

- **User skill constraints** have proficiency levels: `{skill: string, minProficiency?: string}`
- **Derived skill constraints** are existence-only: `string[]` (just skill IDs)

This is the fundamental reason Option B (separate `derivedSkillIds` array) is the cleanest approach - derived skills have different semantics and shouldn't be conflated with proficiency-based skills.

### Key Discoveries:
- `resolveSkillsFromConstraints` filters at line 474 (`relaxation-generator.service.ts:474`)
- `buildSkillFilterCountQuery` signature at `search-query.builder.ts:146-149`
- `DerivedSkillConstraint` type at `constraint.types.ts:126-132` - has `value: string[]` and `origin: SkillConstraintOrigin.Derived`
- Test patterns in `relaxation-generator.service.test.ts:435-757` verify proficiency query patterns

## Desired End State

After this implementation:

1. `testSkillRelaxation` will include derived skill constraints in its test queries
2. Derived skills will be checked as existence-only (not proficiency-gated)
3. Result counts in relaxation suggestions will be accurate

### Verification:
- All existing tests pass (`npm test`)
- New test case verifies derived skills are included in test queries
- Query parameters include `derivedSkillIds` when derived constraints exist

## What We're NOT Doing

- NOT modifying how derived skills are created (inference engine)
- NOT changing the main search query builder
- NOT adding proficiency levels to derived skills
- NOT modifying the `DerivedSkillConstraint` type

## Implementation Approach

Option B from the research: Add a separate `derivedSkillIds` parameter to `buildSkillFilterCountQuery` and extend the Cypher query to include derived skill existence checks.

This is the cleanest approach because:
1. Derived skills have different semantics (existence-only vs proficiency-gated)
2. The type system already distinguishes these constraint types
3. The query clearly shows the two different checks

## Phase 1: Extend buildSkillFilterCountQuery

### Overview
Modify the `buildSkillFilterCountQuery` function to accept an optional `derivedSkillIds` parameter and extend the Cypher query to enforce derived skill existence.

### Changes Required:

#### 1. Update function signature
**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`
**Lines**: 146-190

Add optional `derivedSkillIds` parameter:

```typescript
export function buildSkillFilterCountQuery(
  skillGroups: SkillProficiencyGroups,
  propertyConditions: { whereClauses: string[]; params: Record<string, unknown> },
  derivedSkillIds: string[] = []  // NEW: existence-only skill checks
): CypherQuery {
```

#### 2. Add derived skills to params
**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`
**After line 170** (where params are built):

```typescript
const params: Record<string, unknown> = {
  ...propertyConditions.params,
  allSkillIds,
  learningLevelSkillIds: skillGroups.learningLevelSkillIds,
  proficientLevelSkillIds: skillGroups.proficientLevelSkillIds,
  expertLevelSkillIds: skillGroups.expertLevelSkillIds,
  derivedSkillIds,  // NEW
};
```

#### 3. Extend Cypher query with derived skill existence check
**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`
**Lines**: 180-187

The query needs to include an additional existence check for derived skills. Replace the query construction:

```typescript
/*
 * Build count query using the shared proficiency pattern.
 * Requires ALL user skills to be matched (>= SIZE($allSkillIds)).
 * Also requires ALL derived skills to exist (existence-only, no proficiency check).
 */
const derivedSkillExistenceClause = derivedSkillIds.length > 0
  ? `
  AND ALL(derivedId IN $derivedSkillIds WHERE EXISTS {
    MATCH (e)-[:HAS]->(:UserSkill)-[:FOR]->(:Skill {id: derivedId})
  })`
  : '';

const query = `
MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
WHERE s.id IN $allSkillIds
  AND ${propertyWhereClause}
WITH e, ${buildProficiencyQualificationClause()} AS qualifyingSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) >= SIZE($allSkillIds)${derivedSkillExistenceClause}
RETURN count(DISTINCT e) AS resultCount
`;
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Existing tests pass: `npm test -- search-query.builder.test.ts`
- [x] Existing relaxation tests pass: `npm test -- relaxation-generator.service.test.ts`

---

## Phase 2: Extract Derived Skills in relaxation-generator.service.ts

### Overview
Add a new function to extract derived skill IDs from constraints and pass them to `buildSkillFilterCountQuery`.

### Changes Required:

#### 1. Add helper function to extract derived skill IDs
**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`
**After line 490** (after `resolveSkillsFromConstraints`):

```typescript
/*
 * Extracts derived skill IDs from constraints.
 * Derived skills are existence-only (no proficiency) - they require the engineer
 * to have the skill at any level.
 */
function resolveDerivedSkillsFromConstraints(
  constraints: TestableConstraint[]
): string[] {
  const skillIds: string[] = [];

  for (const constraint of constraints) {
    if (constraint.constraintType !== ConstraintType.SkillTraversal) continue;
    if (constraint.field !== 'derivedSkills') continue;
    if (!isSkillTraversalConstraint(constraint) || !isDerivedSkillConstraint(constraint)) continue;

    // Derived constraints have value: string[] (array of skill IDs)
    skillIds.push(...constraint.value);
  }

  return [...new Set(skillIds)]; // Deduplicate
}
```

#### 2. Add import for isDerivedSkillConstraint type guard
**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`
**Line 10-16** (update imports):

```typescript
import {
  ConstraintType,
  PropertyFieldType,
  type TestableConstraint,
  type DecomposedConstraints,
  type PropertyConstraint,
  type NumericPropertyConstraint,
  type StringArrayPropertyConstraint,
  type UserSkillConstraint,
  isPropertyConstraint,
  isSkillTraversalConstraint,
  isNumericPropertyConstraint,
  isStringArrayPropertyConstraint,
  isUserSkillConstraint,
  isDerivedSkillConstraint,  // NEW
} from "./constraint.types.js";
```

#### 3. Update testSkillRelaxation to include derived skills
**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`
**Lines 412-453** (testSkillRelaxation function):

Update to extract and pass derived skills:

```typescript
async function testSkillRelaxation(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: UserSkillConstraint,
  modifiedSkill: { skill: string; minProficiency?: string }
): Promise<number> {
  const newProficiency = modifiedSkill.minProficiency ?? 'learning';

  /*
   * Convert TestableConstraint[] → ResolvedSkillWithProficiency[] so we can reuse
   * the existing query builders, then apply the modified proficiency for the
   * constraint we're testing.
   */
  const resolvedSkills = resolveSkillsFromConstraints(decomposedConstraints.constraints);
  const skills = modifySkillProficiency(resolvedSkills, constraint.value.skill, newProficiency);

  if (skills.length === 0) {
    return 0;
  }

  // 2. Group by proficiency using EXISTING function (no duplication)
  const skillGroups = groupSkillsByProficiency(skills);

  // 2.5. Extract derived skills (existence-only, no proficiency)
  const derivedSkillIds = resolveDerivedSkillsFromConstraints(decomposedConstraints.constraints);

  // 3. Build property conditions using EXISTING function (no duplication)
  const propertyConstraintIds = new Set(
    decomposedConstraints.constraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const propertyConditions = buildPropertyConditions(
    decomposedConstraints,
    propertyConstraintIds
  );

  // 4. Build count query using SHARED proficiency pattern (no duplication)
  const { query, params } = buildSkillFilterCountQuery(skillGroups, propertyConditions, derivedSkillIds);

  // 5. Execute and return count
  const result = await session.run(query, params);
  return result.records[0]?.get('resultCount')?.toNumber() ?? 0;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tests pass: `npm test`

---

## Phase 3: Add Test Coverage

### Overview
Add a test case that verifies derived skills are included in skill relaxation test queries.

### Changes Required:

#### 1. Add test for derived skills in skill relaxation queries
**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.test.ts`
**After line 756** (inside the "skill relaxation with proficiency-aware queries" describe block):

```typescript
it("includes derived skill requirements in proficiency relaxation test queries", async () => {
  /*
   * Regression test: When testing skill proficiency relaxation, the query should
   * ALSO enforce derived skill constraints. Previously, derived skills were excluded,
   * leading to inflated result counts.
   */
  const userSkillConstraint: UserSkillConstraint = {
    id: "user_skill_skill_kubernetes",
    field: "requiredSkills",
    operator: "HAS",
    value: { skill: "skill_kubernetes", minProficiency: "expert" },
    displayValue: "Kubernetes|min:expert",
    source: "user",
    constraintType: ConstraintType.SkillTraversal,
    origin: SkillConstraintOrigin.User,
    skillIds: ["skill_kubernetes"],
  };

  const derivedSkillConstraint: DerivedSkillConstraint = {
    id: "derived_scaling-requires-distributed",
    field: "derivedSkills",
    operator: "HAS_ALL",
    value: ["skill_distributed"],
    displayValue: "Derived: Scaling requires distributed",
    source: "inference",
    ruleId: "scaling-requires-distributed",
    constraintType: ConstraintType.SkillTraversal,
    origin: SkillConstraintOrigin.Derived,
    skillIds: ["skill_distributed"],
  };

  const decomposed: DecomposedConstraints = {
    constraints: [userSkillConstraint, derivedSkillConstraint],
    baseMatchClause: "MATCH (e:Engineer)",
  };

  const session = createMockSession(new Map()) as any;
  const capturedParams: Record<string, unknown>[] = [];

  session.run.mockImplementation((query: string, params: Record<string, unknown>) => {
    capturedParams.push(params);
    return { records: [{ get: () => ({ toNumber: () => 5 }) }] };
  });

  await generateRelaxationSuggestions(
    session,
    decomposed,
    [userSkillConstraint]
  );

  // Find the query that tests proficiency relaxation (has proficiency buckets)
  const proficiencyTestParams = capturedParams.find(p =>
    p.learningLevelSkillIds !== undefined &&
    p.proficientLevelSkillIds !== undefined &&
    p.expertLevelSkillIds !== undefined
  );

  expect(proficiencyTestParams).toBeDefined();

  // KEY ASSERTION: derivedSkillIds should include the derived constraint's skills
  expect(proficiencyTestParams!.derivedSkillIds).toEqual(["skill_distributed"]);
});
```

### Success Criteria:

#### Automated Verification:
- [x] New test passes: `npm test -- relaxation-generator.service.test.ts`
- [x] All tests pass: `npm test`
- [x] E2E tests pass: `npm run test:e2e`

---

## Testing Strategy

### Unit Tests:
- Verify `buildSkillFilterCountQuery` includes derived skills in query when provided
- Verify `resolveDerivedSkillsFromConstraints` correctly extracts derived skill IDs
- Verify `testSkillRelaxation` passes derived skills to query builder

### Integration Tests:
- Test full relaxation flow with both user and derived skill constraints
- Verify result counts decrease when derived skills are included (more constraints = fewer matches)

### Manual Testing Steps:
Not required - this is a pure backend change with comprehensive unit test coverage.

## Performance Considerations

The derived skill existence check uses a Cypher EXISTS subquery pattern. For small numbers of derived skills (typically 1-3 from inference rules), this should have minimal performance impact. The subquery pattern ensures Neo4j can optimize the existence check.

## References

- Research document: `thoughts/shared/research/2026-01-15-derived-skills-missing-from-relaxation-test-queries.md`
- Original skill relaxation implementation: `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-14-skill-relaxation-implementation.md`
- Constraint types: `recommender_api/src/services/constraint-advisor/constraint.types.ts`
