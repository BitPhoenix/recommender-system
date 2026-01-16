---
date: 2026-01-14T09:00:00+01:00
researcher: Claude
git_commit: bec4c9da4a835087607d50f043e447e6ab47fb74
branch: project_2
repository: recommender_system
topic: "Is the skill relaxation implementation plan the cleanest solution?"
tags: [research, codebase, constraint-advisor, skill-relaxation, architecture-evaluation]
status: complete
last_updated: 2026-01-14
last_updated_by: Claude
---

# Research: Is the Skill Relaxation Implementation Plan the Cleanest Solution?

**Date**: 2026-01-14T09:00:00+01:00
**Researcher**: Claude
**Git Commit**: bec4c9da4a835087607d50f043e447e6ab47fb74
**Branch**: project_2
**Repository**: recommender_system

## Research Question

Is the implementation plan at `thoughts/shared/plans/2026-01-14-skill-relaxation-implementation.md` the cleanest way to solve the skill relaxation testing problem? Are there better alternatives?

## Summary

**Yes, the proposed plan represents the cleanest approach.** After analyzing the codebase architecture, constraint system, and alternative approaches, the plan:

1. **Follows established patterns** - Uses the same builder composition pattern found throughout `cypher-query-builder/`
2. **Maintains single source of truth** - Extracts proficiency logic into reusable helper
3. **Minimizes duplication** - Reuses existing `groupSkillsByProficiency` and adds `buildPropertyConditions`
4. **Creates clean interfaces** - New `buildSkillFilterCountQuery` composes existing pieces

There are no materially better alternatives. Minor improvements are noted below.

## The Problem Being Solved

`testSkillRelaxation` returns 0 for all skill constraints because:

```typescript
// relaxation-generator.service.ts:382-384
if (constraint.constraintType !== ConstraintType.Property) {
  return 0;  // ← All skill constraints hit this
}
```

Skill constraints use `SkillTraversalConstraint` (not `PropertyConstraint`) and require graph pattern matching with the proficiency bucket logic, which doesn't exist in the relaxation testing path.

## Alternative Approaches Analyzed

### Alternative 1: Extend testRelaxedValue to Handle Skills

**Approach**: Add a second code path in `testRelaxedValue` to handle `SkillTraversalConstraint`.

**Why it's worse**:
- Would duplicate proficiency bucket logic in relaxation-generator.service.ts
- Violates single source of truth principle
- `testRelaxedValue` was designed for simple parameter substitution in WHERE clauses

### Alternative 2: Add cypher Property to SkillTraversalConstraint

**Approach**: Store pre-built Cypher fragments in skill constraints like property constraints.

**Why it's worse**:
- Skill proficiency isn't a simple WHERE clause - it requires `MATCH...COLLECT(DISTINCT CASE...)` pattern
- Would require significant refactoring of constraint decomposer
- Graph pattern matching fundamentally differs from property comparison

### Alternative 3: Modify buildSearchQuery with "countOnly" Mode

**Approach**: Add a parameter to `buildSearchQuery(params, { countOnly: true })` that returns a count query.

**Why it's worse**:
- `buildSearchQuery` takes `CypherQueryParams` (user request format)
- Relaxation testing has constraints from `DecomposedConstraints` (different format)
- Would couple search query builder to constraint testing concerns
- Count query doesn't need pagination, ordering, skill collection clauses

### Alternative 4: Direct Query String Building

**Approach**: Build the count query string directly in `testSkillRelaxation` without helper functions.

**Why it's worse**:
- Duplicates proficiency CASE pattern (already exists in two places in search-query.builder.ts)
- Violates DRY principle
- Harder to maintain when proficiency logic changes

## Why the Proposed Plan is Cleanest

### Architecture Alignment

The plan follows the established **builder composition pattern** used throughout the codebase:

| Existing Pattern | Proposed Addition |
|-----------------|-------------------|
| `buildBasicEngineerFilters()` → conditions | `buildPropertyConditions()` → conditions |
| `groupSkillsByProficiency()` → buckets | Reused directly |
| `buildSkillProficiencyFilterClause()` → clause | `buildSkillFilterCountQuery()` → count query |

### Single Source of Truth

The plan creates `buildProficiencyQualificationClause()` which both:
- `buildSkillProficiencyFilterClause()` uses for search queries
- `buildSkillFilterCountQuery()` uses for count queries

This eliminates divergence risk when proficiency logic changes.

### Clean Interface Design

```typescript
buildSkillFilterCountQuery(
  skillGroups: SkillProficiencyGroups,        // ← From groupSkillsByProficiency
  propertyConditions: { whereClauses, params } // ← From buildPropertyConditions
): CypherQuery
```

This interface:
- Takes pre-processed inputs (buckets and conditions)
- Returns standard `CypherQuery` type
- Composes existing pieces without modification

### Reuse Over Duplication

| Function | Status | Reuse Level |
|----------|--------|-------------|
| `groupSkillsByProficiency()` | Existing | Full reuse |
| `buildPropertyConditions()` | Extracted | Refactored from buildQueryWithConstraints |
| `buildProficiencyQualificationClause()` | New | Single source of truth |
| `buildSkillFilterCountQuery()` | New | Composes above functions |

## Minor Improvement Suggestions

### 1. Consider Extracting Proficiency Helper to Shared Location

If the proficiency pattern might be needed elsewhere in the future, consider:

```
cypher-query-builder/
├── search-query.builder.ts
├── skill-proficiency.builder.ts  ← New file for proficiency helpers
└── query-conditions.builder.ts
```

**Current plan**: Keeps `buildProficiencyQualificationClause` as private function in search-query.builder.ts, which is fine for current scope.

### 2. Type Safety for Skill Constraint Value

The plan casts constraint value to `{ skill: string; minProficiency?: string }`:

```typescript
const skillReq = constraint.value as { skill: string; minProficiency?: string };
```

Consider adding a type guard or branded type for stronger type safety. However, this is a minor concern since the constraint decomposer guarantees this structure for `requiredSkills` field.

### 3. Consider Batch Count Query for Multiple Relaxations

Current design: One database query per skill relaxation option tested.

For 3 skills with 2 proficiency steps each = 6 queries.

Alternative: Build a UNION query that tests all variations in one call:

```cypher
CALL {
  // Variation 1: Skill A at proficient level
  MATCH ... RETURN count(e) AS c1
UNION ALL
  // Variation 2: Skill A at learning level
  MATCH ... RETURN count(e) AS c2
}
RETURN c1, c2
```

**Verdict**: Premature optimization. The plan correctly notes this only runs when original search returns 0 results, and 6 simple count queries is acceptable. This could be a future enhancement if profiling shows it's a bottleneck.

## Architectural Consistency Score

| Criterion | Score | Notes |
|-----------|-------|-------|
| Follows existing patterns | ✅ | Builder composition, same as cypher-query-builder |
| Single source of truth | ✅ | Proficiency pattern in one place |
| Minimal code changes | ✅ | Only adds functions, one refactor |
| Interface cleanliness | ✅ | Clear inputs/outputs, composable |
| Test coverage plan | ✅ | Phase 5 adds unit tests |
| Performance consideration | ✅ | Acknowledged, acceptable for use case |

## Conclusion

The proposed plan is the cleanest solution for these reasons:

1. **It's idiomatic** - Follows the builder composition pattern already established in cypher-query-builder/
2. **It's DRY** - Reuses `groupSkillsByProficiency` and extracts `buildPropertyConditions`
3. **It's maintainable** - Single source of truth for proficiency pattern
4. **It's minimal** - No unnecessary abstractions or over-engineering
5. **It's testable** - Clear function boundaries with unit tests planned

**Recommendation**: Proceed with the plan as written. The minor improvements noted above are optional enhancements, not blockers.

## Code References

- `relaxation-generator.service.ts:382-384` - The early return causing 0 results
- `relaxation-generator.service.ts:329-341` - Current `testSkillRelaxation` (thin wrapper)
- `search-query.builder.ts:147-162` - `buildSkillProficiencyFilterClause` (proficiency pattern source)
- `skill-resolution.service.ts:40-66` - `groupSkillsByProficiency` (to reuse)
- `constraint-decomposer.service.ts:245-303` - `buildQueryWithConstraints` (to refactor)
- `cypher-query-builder/query-conditions.builder.ts` - Example of builder composition pattern

## Related Research

- `thoughts/shared/plans/2026-01-14-skill-relaxation-implementation.md` - The plan being evaluated
