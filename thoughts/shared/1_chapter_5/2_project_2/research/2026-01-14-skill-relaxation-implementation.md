---
date: 2026-01-14T15:30:00+01:00
researcher: Claude
git_commit: bec4c9da4a835087607d50f043e447e6ab47fb74
branch: project_2
repository: recommender-system
topic: "Skill Relaxation Implementation Research"
tags: [research, codebase, constraint-advisor, relaxation, skills]
status: complete
last_updated: 2026-01-14
last_updated_by: Claude
---

# Research: Skill Relaxation Implementation

**Date**: 2026-01-14T15:30:00+01:00
**Researcher**: Claude
**Git Commit**: bec4c9da4a835087607d50f043e447e6ab47fb74
**Branch**: project_2
**Repository**: recommender-system

## Research Question

What would it take to properly implement `testSkillRelaxation` in the constraint-advisor system? Currently, it's a pass-through wrapper that calls `testRelaxedValue`, which returns 0 for all skill constraints.

## Summary

**The core problem**: `testRelaxedValue` immediately returns 0 for skill constraints because it only handles `ConstraintType.Property` constraints. Skill constraints use `ConstraintType.SkillTraversal` and require graph pattern matching, not simple WHERE clause parameter swaps.

**What needs to change**: A new query building approach is needed that:
1. Modifies proficiency bucket membership (move skill from `expertLevelSkillIds` to `proficientLevelSkillIds`)
2. Constructs a count query with proper skill graph traversal
3. Returns the count of matching engineers

## Detailed Findings

### 1. Constraint Type Architecture

**File**: `recommender_api/src/services/constraint-advisor/constraint.types.ts`

Two fundamentally different constraint types exist:

| Aspect | PropertyConstraint | SkillTraversalConstraint |
|--------|-------------------|-------------------------|
| Type | `ConstraintType.Property` | `ConstraintType.SkillTraversal` |
| Key field | `cypher: CypherFragment` | `skillIds: string[]` |
| Query type | Simple WHERE clause | Graph pattern matching |
| Example | `e.salary <= $param` | `(e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)` |

**Lines 37-51**: The discriminated union ensures only `PropertyConstraint` has a `cypher` field.

### 2. Why testRelaxedValue Returns 0 for Skills

**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`

**Lines 382-384**:
```typescript
if (constraint.constraintType !== ConstraintType.Property) {
  return 0;  // Skills have ConstraintType.SkillTraversal - always returns 0
}
```

The function modifies `cypher.paramValue` (line 392), but skill constraints don't have a `cypher` field.

### 3. Skill Constraint Decomposition

**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`

**User skill filters** (lines 68-80) create one constraint per skill:
```typescript
{
  id: `user_skill_${skill.skillId}`,
  field: 'requiredSkills',
  value: {
    skill: skill.skillId,
    minProficiency: skill.minProficiency,  // e.g., "proficient"
  },
  constraintType: ConstraintType.SkillTraversal,
  skillIds: [skill.skillId],
}
```

**Derived skill filters** (lines 53-64) group all skills from a rule:
```typescript
{
  id: `derived_${ruleId}`,
  field: 'derivedSkills',
  skillIds: filter.skills.map(s => s.skillId),  // Array of IDs
  ruleId: ruleId,
}
```

### 4. How buildQueryWithConstraints Handles Skills

**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`

**Lines 264-272**: Skill traversal constraints are explicitly filtered out:
```typescript
// SkillTraversal constraints are handled separately by QUICKXPLAIN
if (constraint.constraintType === ConstraintType.Property) {
  // Only property constraints get included in WHERE clause
}
```

The function only builds WHERE clauses for property constraints.

### 5. How Proficiency Filtering Actually Works

**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`

Skills are filtered using **proficiency buckets**, not simple value comparisons.

**Lines 139-162** (`buildSkillProficiencyFilterClause`):
```cypher
COLLECT(DISTINCT CASE
  WHEN s.id IN $learningLevelSkillIds THEN s.id
  WHEN s.id IN $proficientLevelSkillIds
   AND us.proficiencyLevel IN ['proficient', 'expert'] THEN s.id
  WHEN s.id IN $expertLevelSkillIds
   AND us.proficiencyLevel = 'expert' THEN s.id
END) AS qualifyingSkillIds
```

**Bucket Creation** (`skill-resolution.service.ts`, lines 40-66):
```typescript
export function groupSkillsByProficiency(resolvedSkills): SkillProficiencyGroups {
  const learningLevelSkillIds: string[] = [];
  const proficientLevelSkillIds: string[] = [];
  const expertLevelSkillIds: string[] = [];
  // ... groups by minProficiency
}
```

### 6. The Current (Non-Working) Skill Relaxation Flow

**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`

**Lines 274-297** (`applySkillRelaxationStrategy`):
1. Extracts `minProficiency` from `constraint.value`
2. Finds next lower proficiency in `proficiencyOrder`
3. Calls `testSkillRelaxation` with modified skill object

**Lines 329-341** (`testSkillRelaxation`):
```typescript
async function testSkillRelaxation(...) {
  // Comment acknowledges the issue but doesn't fix it
  return testRelaxedValue(...);  // Returns 0 for skills
}
```

## Implementation Options

### Option A: Skill-Specific Query Builder (Recommended)

Create a new function that builds a complete skill-aware count query:

```typescript
async function testSkillRelaxation(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: TestableConstraint,
  modifiedSkill: { skill: string; minProficiency?: string }
): Promise<number> {
  // 1. Get all constraints except the one being modified
  const otherConstraintIds = new Set(
    decomposedConstraints.constraints
      .filter(c => c.id !== constraint.id)
      .map(c => c.id)
  );

  // 2. Build property-only WHERE clause from other constraints
  const { query: propertyQuery, params } = buildQueryWithConstraints(
    decomposedConstraints,
    otherConstraintIds
  );

  // 3. Build modified proficiency buckets
  const { learningLevelSkillIds, proficientLevelSkillIds, expertLevelSkillIds } =
    buildModifiedProficiencyBuckets(decomposedConstraints, constraint.id, modifiedSkill);

  // 4. Construct full query with skill traversal
  const query = `
    MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    WHERE s.id IN $allSkillIds
      AND ${extractWhereClause(propertyQuery) || 'true'}
    WITH e, COLLECT(DISTINCT CASE
      WHEN s.id IN $learningLevelSkillIds THEN s.id
      WHEN s.id IN $proficientLevelSkillIds
       AND us.proficiencyLevel IN ['proficient', 'expert'] THEN s.id
      WHEN s.id IN $expertLevelSkillIds
       AND us.proficiencyLevel = 'expert' THEN s.id
    END) AS qualifyingSkillIds
    WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) >= $requiredSkillCount
    RETURN count(DISTINCT e) AS resultCount
  `;

  // 5. Execute and return count
  const result = await session.run(query, {
    ...params,
    allSkillIds: [...learningLevelSkillIds, ...proficientLevelSkillIds, ...expertLevelSkillIds],
    learningLevelSkillIds,
    proficientLevelSkillIds,
    expertLevelSkillIds,
    requiredSkillCount: decomposedConstraints.constraints
      .filter(c => c.constraintType === ConstraintType.SkillTraversal)
      .length,
  });

  return result.records[0]?.get('resultCount')?.toNumber() ?? 0;
}
```

**Helper function needed**:
```typescript
function buildModifiedProficiencyBuckets(
  decomposed: DecomposedConstraints,
  constraintId: string,
  modifiedSkill: { skill: string; minProficiency?: string }
): SkillProficiencyGroups {
  // Extract all skill constraints, modify the specified one's proficiency bucket
}
```

### Option B: Extend buildQueryWithConstraints

Add graph traversal support to the existing function. This is more invasive:

1. Add optional `SkillTraversal` handling
2. Modify the MATCH clause to include skill relationships when skills present
3. Add proficiency bucket parameters

**Downside**: Increases complexity of a function designed for simple property testing.

### Option C: Estimate Without DB Query

For skill relaxation, estimate impact based on proficiency level:

```typescript
if (constraint.constraintType === ConstraintType.SkillTraversal) {
  // Lower proficiency = more potential matches
  const proficiencyImpactFactor = {
    'expert': 1.0,
    'proficient': 1.5,
    'familiar': 2.5,
  };
  return Math.floor(baseEstimate * proficiencyImpactFactor[newProficiency]);
}
```

**Downside**: Inaccurate, doesn't respect actual data distribution.

## Code References

- `constraint.types.ts:37-51` - Constraint type definitions
- `relaxation-generator.service.ts:382-384` - Early return for non-Property constraints
- `relaxation-generator.service.ts:329-341` - Current non-working testSkillRelaxation
- `constraint-decomposer.service.ts:264-272` - Skill exclusion in query building
- `search-query.builder.ts:139-162` - Actual proficiency filtering logic
- `skill-resolution.service.ts:40-66` - Proficiency bucket creation

## Architecture Insights

1. **Separation of Concerns**: The system cleanly separates property constraints (WHERE clauses) from skill constraints (graph traversal), but this makes relaxation testing harder.

2. **Proficiency Bucket Pattern**: Skills aren't filtered by direct value comparison. Instead, they're pre-grouped into buckets, and Cypher CASE statements check bucket membership against engineer proficiency.

3. **Parameter Substitution**: Property constraints use `cypher.paramValue` which gets substituted into parameterized queries. Skills use `skillIds[]` arrays that map to bucket arrays.

4. **Query Duplication**: The search query builder duplicates proficiency checking logic (once for filtering, once for collection). Any new skill relaxation testing would need similar logic.

## Open Questions

1. Should we extract the proficiency CASE logic into a reusable Cypher fragment builder?
2. How should derived skill constraints (which lack proficiency) be handled in relaxation?
3. Should skill relaxation suggestions show "estimated" counts with lower confidence?
