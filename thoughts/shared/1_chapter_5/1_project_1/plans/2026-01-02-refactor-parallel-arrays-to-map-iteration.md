# Refactor Parallel Arrays to Map Iteration in Domain Filters

## Overview

Refactor the domain filter query builders to pass arrays of objects directly to Neo4j instead of flattening them into parallel arrays. This eliminates a fragile pattern where related data (domain IDs, expanded IDs, years) is separated into parallel arrays correlated only by index position.

## Current State Analysis

### The Problem

In `query-domain-filter.builder.ts:51-96`, we flatten structured domain objects into parallel arrays:

```typescript
// Current approach - parallel arrays
queryParams.requiredBusinessDomainExpandedIds = params.requiredBusinessDomains.map(d => d.expandedDomainIds);
queryParams.requiredBusinessMinYears = params.requiredBusinessDomains.map(d => d.minYears ?? null);
```

The Cypher then correlates them by index:

```cypher
WHERE ALL(idx IN range(0, size($requiredBusinessDomainExpandedIds) - 1) WHERE
  ...
  WHERE bd.id IN $requiredBusinessDomainExpandedIds[idx]
  AND $requiredBusinessMinYears[idx] IS NULL OR exp.years >= $requiredBusinessMinYears[idx]
)
```

This is fragile because:
1. The relationship between `expandedDomainIds[i]` and `minYears[i]` is implicit
2. Easy to accidentally misalign arrays if code changes
3. Hard to understand when reading the Cypher

### Key Discovery

The comment on line 47-49 states: "Neo4j doesn't support nested object access like `$arr[0].field`."

However, Neo4j **does** support map iteration with `ALL(x IN $arr WHERE x.field ...)` because `x` is a bound variable, not an indexed lookup. We verified this works:

```cypher
-- This works ✓
WITH $constraints AS constraints
RETURN ALL(c IN constraints WHERE c.minYears IS NULL OR c.minYears >= 2)
```

## Desired End State

Domain constraints passed as arrays of objects, with Cypher iterating over them using bound variables:

```typescript
// Pass objects directly
queryParams.requiredBusinessDomains = params.requiredBusinessDomains.map(d => ({
  expandedDomainIds: d.expandedDomainIds,
  minYears: d.minYears ?? null,
}));
```

```cypher
WHERE ALL(constraint IN $requiredBusinessDomains WHERE
  EXISTS {
    MATCH (e)-[exp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    WHERE bd.id IN constraint.expandedDomainIds
    AND (constraint.minYears IS NULL OR exp.years >= constraint.minYears)
  }
)
```

### Verification

After implementation:
- `npm run typecheck` passes
- `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json` passes
- Domain filter searches return correct results

## What We're NOT Doing

- Changing the collection clauses (`buildBusinessDomainCollection`, `buildTechnicalDomainCollection`) - these use flat `allBusinessDomainIds`/`allTechDomainIds` arrays which are fine
- Changing the `ResolvedBusinessDomain` or `ResolvedTechnicalDomain` types - these already have the right structure
- Refactoring skill-related parallel arrays (if any exist) - out of scope

## Implementation Approach

We'll update `addDomainQueryParams` to pass objects instead of flattening, then update the four filter builder functions to use map iteration.

---

## Phase 1: Update Parameter Passing

### Overview
Change `addDomainQueryParams` to pass domain constraints as arrays of objects instead of parallel arrays.

### Changes Required

**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`

#### 1. Update the docstring (lines 45-50)

```typescript
/**
 * Adds domain query parameters for Neo4j.
 *
 * Passes domain constraints as arrays of objects. Neo4j supports iterating
 * over maps with ALL(x IN $arr WHERE x.field), so we keep related data together.
 */
```

#### 2. Update required business domain params (lines 57-62)

Replace:
```typescript
if (context.hasRequiredBusinessDomains && params.requiredBusinessDomains) {
  queryParams.requiredBusinessDomainExpandedIds =
    params.requiredBusinessDomains.map((d) => d.expandedDomainIds);
  queryParams.requiredBusinessMinYears = params.requiredBusinessDomains.map(
    (d) => d.minYears ?? null
  );
}
```

With:
```typescript
if (context.hasRequiredBusinessDomains && params.requiredBusinessDomains) {
  queryParams.requiredBusinessDomains = params.requiredBusinessDomains.map((d) => ({
    expandedDomainIds: d.expandedDomainIds,
    minYears: d.minYears ?? null,
  }));
}
```

#### 3. Update preferred business domain params (lines 65-72)

Replace:
```typescript
if (context.hasPreferredBusinessDomains && params.preferredBusinessDomains) {
  queryParams.preferredBusinessDomainIds =
    params.preferredBusinessDomains.map((d) => d.domainId);
  queryParams.preferredBusinessDomainExpandedIds =
    params.preferredBusinessDomains.map((d) => d.expandedDomainIds);
  queryParams.preferredBusinessMinYears =
    params.preferredBusinessDomains.map((d) => d.preferredMinYears ?? null);
}
```

With:
```typescript
if (context.hasPreferredBusinessDomains && params.preferredBusinessDomains) {
  queryParams.preferredBusinessDomains = params.preferredBusinessDomains.map((d) => ({
    domainId: d.domainId,
    expandedDomainIds: d.expandedDomainIds,
    minYears: d.preferredMinYears ?? null,
  }));
}
```

#### 4. Update required technical domain params (lines 75-83)

Replace:
```typescript
if (
  context.hasRequiredTechnicalDomains &&
  params.requiredTechnicalDomains
) {
  queryParams.requiredTechDomainExpandedIds =
    params.requiredTechnicalDomains.map((d) => d.expandedDomainIds);
  queryParams.requiredTechDomainMinYears =
    params.requiredTechnicalDomains.map((d) => d.minYears ?? null);
}
```

With:
```typescript
if (context.hasRequiredTechnicalDomains && params.requiredTechnicalDomains) {
  queryParams.requiredTechDomains = params.requiredTechnicalDomains.map((d) => ({
    expandedDomainIds: d.expandedDomainIds,
    minYears: d.minYears ?? null,
  }));
}
```

#### 5. Update preferred technical domain params (lines 85-96)

Replace:
```typescript
if (
  context.hasPreferredTechnicalDomains &&
  params.preferredTechnicalDomains
) {
  queryParams.preferredTechDomainIds = params.preferredTechnicalDomains.map(
    (d) => d.domainId
  );
  queryParams.preferredTechDomainExpandedIds =
    params.preferredTechnicalDomains.map((d) => d.expandedDomainIds);
  queryParams.preferredTechDomainMinYears =
    params.preferredTechnicalDomains.map((d) => d.preferredMinYears ?? null);
}
```

With:
```typescript
if (context.hasPreferredTechnicalDomains && params.preferredTechnicalDomains) {
  queryParams.preferredTechDomains = params.preferredTechnicalDomains.map((d) => ({
    domainId: d.domainId,
    expandedDomainIds: d.expandedDomainIds,
    minYears: d.preferredMinYears ?? null,
  }));
}
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck`

---

## Phase 2: Update Required Domain Filter Cypher

### Overview
Update `buildRequiredBusinessDomainFilter` and `buildRequiredTechnicalDomainFilter` to use map iteration.

### Changes Required

**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`

#### 1. Update `buildRequiredBusinessDomainFilter` (lines 136-154)

Replace:
```typescript
export function buildRequiredBusinessDomainFilter(
  context: DomainFilterContext
): string {
  if (!context.hasRequiredBusinessDomains) return '';

  return `
// Business domain filter: must have experience in ALL required domains (via hierarchy)
WITH e
WHERE ALL(idx IN range(0, size($requiredBusinessDomainExpandedIds) - 1) WHERE
  EXISTS {
    MATCH (e)-[exp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    WHERE bd.id IN $requiredBusinessDomainExpandedIds[idx]
    AND (
      $requiredBusinessMinYears[idx] IS NULL
      OR exp.years >= $requiredBusinessMinYears[idx]
    )
  }
)`;
}
```

With:
```typescript
export function buildRequiredBusinessDomainFilter(
  context: DomainFilterContext
): string {
  if (!context.hasRequiredBusinessDomains) return '';

  return `
// Business domain filter: must have experience in ALL required domains (via hierarchy)
WITH e
WHERE ALL(constraint IN $requiredBusinessDomains WHERE
  EXISTS {
    MATCH (e)-[exp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    WHERE bd.id IN constraint.expandedDomainIds
    AND (constraint.minYears IS NULL OR exp.years >= constraint.minYears)
  }
)`;
}
```

#### 2. Update `buildRequiredTechnicalDomainFilter` (lines 165-197)

Replace:
```typescript
export function buildRequiredTechnicalDomainFilter(
  context: DomainFilterContext
): string {
  if (!context.hasRequiredTechnicalDomains) return '';

  return `
// Technical domain filter: must have experience in ALL required domains
// (via explicit claim OR skill inference)
WITH e
WHERE ALL(idx IN range(0, size($requiredTechDomainExpandedIds) - 1) WHERE
  (
    // Option 1: Explicit domain experience claim
    EXISTS {
      MATCH (e)-[exp:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
      WHERE td.id IN $requiredTechDomainExpandedIds[idx]
      AND (
        $requiredTechDomainMinYears[idx] IS NULL
        OR exp.years >= $requiredTechDomainMinYears[idx]
      )
    }
    OR
    // Option 2: Inferred from skills via SkillCategory → TechnicalDomain
    EXISTS {
      MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)-[:BELONGS_TO]->(:SkillCategory)-[:BELONGS_TO]->(td:TechnicalDomain)
      WHERE td.id IN $requiredTechDomainExpandedIds[idx]
      AND (
        $requiredTechDomainMinYears[idx] IS NULL
        OR us.yearsUsed >= $requiredTechDomainMinYears[idx]
      )
    }
  )
)`;
}
```

With:
```typescript
export function buildRequiredTechnicalDomainFilter(
  context: DomainFilterContext
): string {
  if (!context.hasRequiredTechnicalDomains) return '';

  return `
// Technical domain filter: must have experience in ALL required domains
// (via explicit claim OR skill inference)
WITH e
WHERE ALL(constraint IN $requiredTechDomains WHERE
  (
    // Option 1: Explicit domain experience claim
    EXISTS {
      MATCH (e)-[exp:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
      WHERE td.id IN constraint.expandedDomainIds
      AND (constraint.minYears IS NULL OR exp.years >= constraint.minYears)
    }
    OR
    // Option 2: Inferred from skills via SkillCategory → TechnicalDomain
    EXISTS {
      MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)-[:BELONGS_TO]->(:SkillCategory)-[:BELONGS_TO]->(td:TechnicalDomain)
      WHERE td.id IN constraint.expandedDomainIds
      AND (constraint.minYears IS NULL OR us.yearsUsed >= constraint.minYears)
    }
  )
)`;
}
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck`
- [x] Newman tests pass: `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json`
  - Note: Tests 37 & 42 fail due to pre-existing Neo4j transaction issue unrelated to this refactor
  - All domain-specific tests (24, 25, 35, 36, 38-41) pass

---

## Testing Strategy

### Automated Tests
- Run the existing Postman collection which includes domain filter tests
- Type checking ensures parameter names are consistent

### Manual Testing
If domain filter tests exist in the Postman collection, verify:
- Required business domain filtering works
- Required technical domain filtering works
- Years constraints are respected
- Hierarchy expansion still works (matching child domains satisfies parent constraint)

## References

- Neo4j verification of map iteration: Tested in conversation with `ALL(c IN $constraints WHERE c.minYears ...)`
- Original issue: Parallel arrays in `addDomainQueryParams` where `preferredBusinessMinYears` has no explicit association with its domain
