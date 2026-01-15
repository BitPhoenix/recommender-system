---
date: 2026-01-15T12:00:00-08:00
researcher: Claude
git_commit: bec4c9da4a835087607d50f043e447e6ab47fb74
branch: project_2
repository: recommender_system
topic: "Why does resolveSkillsFromConstraints only extract user skills, not derived skills?"
tags: [research, codebase, constraint-advisor, skill-relaxation, bug-investigation]
status: complete
last_updated: 2026-01-15
last_updated_by: Claude
last_updated_note: "Updated recommendation to Option B based on software design principles analysis"
---

# Research: Why does resolveSkillsFromConstraints only extract user skills?

**Date**: 2026-01-15T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: bec4c9da4a835087607d50f043e447e6ab47fb74
**Branch**: project_2
**Repository**: recommender_system

## Research Question

Why does `resolveSkillsFromConstraints` only extract user-specified skills and not derived skills from inference rules? Is this intentional or a bug?

## Summary

**This is a bug.** The `testSkillRelaxation` function builds test queries that do NOT include derived skill requirements, leading to potentially inflated result counts. When testing "what if we relaxed TypeScript from expert to proficient?", the test query should still enforce derived skill requirements (e.g., "scaling requires distributed systems"), but currently it doesn't.

The root cause is that `resolveSkillsFromConstraints` explicitly filters to only `requiredSkills` field, excluding `derivedSkills`. There is no documented rationale for this exclusion, and it creates an inconsistency with how the main search handles skills.

## Detailed Findings

### 1. Structure Differences Between User and Derived Skill Constraints

| Aspect | UserSkillConstraint | DerivedSkillConstraint |
|--------|---------------------|------------------------|
| **Field** | `requiredSkills` | `derivedSkills` |
| **Value Type** | `{skill: string, minProficiency?: string}` | `string[]` (skill IDs only) |
| **Has Proficiency?** | Yes (optional) | No |
| **Origin** | User request | Inference rules |

This is the key structural difference: derived skills have no proficiency level, they're just "must have skill X" requirements.

### 2. The Filtering in resolveSkillsFromConstraints

```typescript
// relaxation-generator.service.ts:471-477
for (const constraint of constraints) {
  // Skip property constraints (timezone, seniority, etc.) - only want skill traversals
  if (constraint.constraintType !== ConstraintType.SkillTraversal) continue;
  // Skip derived skills from inference rules - they use 'derivedSkills' field
  if (constraint.field !== 'requiredSkills') continue;  // <-- DERIVED SKILLS EXCLUDED HERE
  // Type narrowing...
  if (!isSkillTraversalConstraint(constraint) || !isUserSkillConstraint(constraint)) continue;
```

The second check (`field !== 'requiredSkills'`) explicitly excludes derived skills.

### 3. What testSkillRelaxation DOES Include

- **User skill constraints**: YES - with modified proficiency for target skill
- **Property constraints**: YES - all property constraints (timezone, salary, etc.)
- **Derived skill constraints**: NO - explicitly filtered out

### 4. What Main Search Includes

The main search flow in `search.service.ts` includes derived skills:

1. `expandSearchCriteria()` runs the inference engine
2. Derived constraints become `AppliedSkillFilter` with `field: 'derivedSkills'`
3. These flow into `derivedRequiredSkillIds`
4. Used for both filtering and utility scoring

### 5. The Inconsistency

| Component | User Skills | Property Constraints | Derived Skills |
|-----------|-------------|---------------------|----------------|
| Main Search | YES | YES | YES |
| testSkillRelaxation | YES | YES | **NO** |

This inconsistency means `testSkillRelaxation` can report result counts higher than what users would actually see if they applied the relaxation.

### 6. Historical Context

The skill relaxation implementation plan (`thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-14-skill-relaxation-implementation.md`) does not explain why derived skills are excluded. The focus was on fixing a more fundamental bug where skill constraints returned 0 because they weren't handled as graph traversals.

The plan mentions `buildSkillsFromConstraints` filtering to `requiredSkills` but doesn't justify why derived skills should be excluded.

## Code References

- `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts:471-477` - The filtering logic
- `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts:412-453` - testSkillRelaxation function
- `recommender_api/src/services/search.service.ts:70-74` - Main search includes derived skills
- `recommender_api/src/services/constraint-expander.service.ts:175-197` - How derived constraints are created

## Architecture Insights

### Why This Is Non-Trivial to Fix

Derived skills have no proficiency level, so they can't be added to the existing proficiency buckets (learning/proficient/expert). The query builder would need to handle them differently:

**Option A**: Add derived skills to `learningLevelSkillIds` (treat as "any proficiency")
- Simple but semantically imprecise
- A semantic lie - derived skills don't have a proficiency level, so pretending they're "learning level" conflates two different concepts
- Makes the code harder to reason about

**Option B**: Add a separate `derivedSkillIds` array and modify the Cypher query
- More accurate, requires changes to `buildSkillFilterCountQuery`
- Cleanest from a software design standpoint (see recommendation below)

**Option C**: Run a separate existence check for derived skills
- Most accurate but adds query complexity and potential performance issues

### Recommendation

**Option B is the cleanest approach** from a software design principles standpoint:

1. **Explicit over Implicit**: Derived skills have different semantics (existence check vs proficiency check). A separate `derivedSkillIds` array makes this explicit in the code and query.

2. **Self-documenting**: The Cypher query would clearly show:
   - User skills: "must have skill X at proficiency Y"
   - Derived skills: "must have skill X" (existence only)

3. **Type-driven design**: The type system already distinguishes these (`UserSkillConstraint` has proficiency, `DerivedSkillConstraint` doesn't). The query building should mirror this distinction rather than conflating them.

4. **Single Responsibility**: `groupSkillsByProficiency` handles proficiency bucketing. Derived skills don't have proficiency, so they shouldn't go through that function at all.

### Implementation Sketch for Option B

```typescript
// In buildSkillFilterCountQuery signature
interface SkillFilterParams {
  skillGroups: SkillProficiencyGroups;      // User skills with proficiency
  derivedSkillIds: string[];                 // Derived skills (existence only)
  propertyConditions: { whereClauses: string[]; params: Record<string, unknown> };
}

// Cypher query modification - add derived skill existence check:
// WHERE s.id IN $allSkillIds
//   AND ${propertyWhereClause}
//   AND ALL(derivedId IN $derivedSkillIds WHERE EXISTS {
//     MATCH (e)-[:HAS]->(:UserSkill)-[:FOR]->(:Skill {id: derivedId})
//   })
```

This keeps the proficiency logic separate from existence-only checks, respecting the domain model.

## Historical Context (from thoughts/)

- `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-14-skill-relaxation-implementation.md` - Original implementation plan, doesn't justify derived skill exclusion
- `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-14-project-2-constraint-advisor-walkthrough.md` - Code walkthrough showing the two constraint types

## Open Questions

1. ~~Should the fix be in `resolveSkillsFromConstraints` or should there be a separate function for derived skills?~~ **Resolved**: Separate function - derived skills have different semantics and shouldn't be mixed with proficiency-based skills.
2. ~~What proficiency level should be used for derived skills in test queries?~~ **Resolved**: No proficiency level - derived skills are existence-only checks, handled via separate `derivedSkillIds` array.
3. Are there any edge cases where excluding derived skills was intentional? (Likely not - appears to be an oversight)
