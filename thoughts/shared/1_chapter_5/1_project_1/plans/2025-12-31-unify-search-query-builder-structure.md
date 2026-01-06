# Unify Search Query Builder Structure

## Overview

Further consolidate the search query builder to eliminate the internal two-branch pattern (`if hasSkillFilter ... else ...`) that generates completely separate Cypher queries. This refactor creates a single query-building flow with conditional segments only where logic truly differs, reducing maintenance burden and preventing the two code paths from drifting apart.

## Current State Analysis

The previous consolidation (2025-12-30) unified the **external interface** by creating a single `buildSearchQuery` function. However, internally it still delegates to completely separate query-building logic:

**`cypher-query-builder/index.ts:19-27`**:
```typescript
export function buildSearchQuery(params: CypherQueryParams): CypherQuery {
  const hasSkillFilter = params.targetSkillIds !== null && params.targetSkillIds.length > 0;
  if (hasSkillFilter) {
    return buildSkillSearchQuery(params);  // 100+ lines
  }
  return buildBrowseQuery(params);  // 80+ lines
}
```

**Problem**: If we modify one branch (e.g., add a new return field, change domain filtering), we must remember to make the equivalent change in the other branch. This has already caused bugs (the original `matchedSkills` vs `allRelevantSkills` field name mismatch).

The same pattern exists in `count-query.builder.ts:68-76`.

### Key Discoveries

From analyzing the current files:

| Component | Skill Search | Browse | Shareable? |
|-----------|-------------|--------|------------|
| Engineer conditions | `buildEngineerQueryConditions()` | Same | Already shared |
| Domain params | `addDomainQueryParams()` | Same | Already shared |
| Domain filter clause | `buildRequiredDomainFilterClause()` | Same | Already shared |
| Domain collection | `buildPreferredDomainCollectionClause()` | Same | Already shared |
| Initial MATCH | `MATCH (e)-[:HAS]->(es)-[:FOR]->(s) WHERE s.id IN $targetSkillIds` | `MATCH (e:Engineer)` | Different |
| Qualification check | Two-stage with `qualifyingSkillIds` | None | Conditional |
| Skill collection | Collects with `matchType`, constraint booleans | `OPTIONAL MATCH`, `matchType: 'none'` | Different |
| Metrics | Actual `matchedSkillCount`, `avgConfidence` | Hardcoded `0`, `0.0` | Conditional |
| ORDER BY | `matchedSkillCount DESC, avgConfidence DESC, yearsExperience DESC` | `yearsExperience DESC` | Conditional |
| RETURN fields | Identical | Identical | Shareable |

## Desired End State

A single `buildSearchQuery` function that:
1. Has **one code path** that handles both cases
2. Uses **conditional string segments** only for parts that truly differ
3. Shares all common logic (conditions, domain filtering, return fields, pagination)
4. Makes it **obvious** what differs between skill-filtered and non-filtered queries

**Verification**:
- `npm run typecheck` passes
- Manual testing of both skill search and browse modes returns correct results
- The `cypher-query-builder/` folder contains fewer files with less code duplication

## What We're NOT Doing

- Changing the Cypher query semantics (same queries, different code structure)
- Using APOC procedures for conditional logic within Cypher itself
- Changing the external API or return types
- Modifying the count query builder in this phase (follow-up task)

## Implementation Approach

Replace the two separate query builders with a single function that builds the query string by assembling conditional segments. The function will have this structure:

```typescript
export function buildSearchQuery(params: CypherQueryParams): CypherQuery {
  const hasSkillFilter = params.targetSkillIds?.length > 0;

  // 1. Shared setup (conditions, domain context, params)
  // 2. Build MATCH clause (conditional)
  // 3. Build qualification check (conditional - only for skill search)
  // 4. Build skill collection clause (conditional)
  // 5. Build domain collection clause (shared)
  // 6. Build RETURN clause (shared)
  // 7. Build ORDER BY clause (conditional)
  // 8. Assemble final query
}
```

---

## Phase 1: Create Unified Search Query Builder

### Overview

Replace `skill-search-query.builder.ts` and `browse-query.builder.ts` with a single `search-query.builder.ts` that uses conditional string building.

### Changes Required

#### 1. Create new unified builder

**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`

```typescript
/**
 * Builds unified Cypher query for engineer search.
 * Handles both skill-filtered search and unfiltered browse in a single code path.
 */

import { int } from "neo4j-driver";
import type { CypherQueryParams, CypherQuery } from "./query-types.js";
import { buildEngineerQueryConditions } from "./query-conditions.builder.js";
import {
  getDomainFilterContext,
  addDomainQueryParams,
  buildRequiredDomainFilterClause,
  buildPreferredDomainCollectionClause,
} from "./query-domain-filter.builder.js";

export function buildSearchQuery(params: CypherQueryParams): CypherQuery {
  const hasSkillFilter = params.targetSkillIds !== null && params.targetSkillIds.length > 0;

  // === SHARED SETUP ===
  const { conditions, queryParams } = buildEngineerQueryConditions(params);
  const domainContext = getDomainFilterContext(params);
  const whereClause = conditions.join("\n  AND ");

  queryParams.offset = int(params.offset);
  queryParams.limit = int(params.limit);
  queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;
  queryParams.minConfidenceScore = params.minConfidenceScore;

  addDomainQueryParams(queryParams, params, domainContext);

  // === CONDITIONAL: Skill-specific params ===
  if (hasSkillFilter) {
    queryParams.targetSkillIds = params.targetSkillIds;
    queryParams.skillIdentifiers = params.skillIdentifiers || [];
  }

  // === BUILD MATCH CLAUSE ===
  const matchClause = hasSkillFilter
    ? `MATCH (e:Engineer)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.id IN $targetSkillIds
  AND ${whereClause}`
    : `MATCH (e:Engineer)
WHERE ${whereClause}`;

  // === BUILD QUALIFICATION CHECK (skill search only) ===
  const qualificationClause = hasSkillFilter
    ? `
// Check which engineers have at least one skill meeting confidence/proficiency constraints
WITH e, COLLECT(DISTINCT CASE
  WHEN es.confidenceScore >= $minConfidenceScore
   AND es.proficiencyLevel IN $allowedProficiencyLevels
  THEN s.id END) AS qualifyingSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) > 0`
    : "";

  // === BUILD DOMAIN FILTER (positioned after qualification) ===
  const domainFilterClause = buildRequiredDomainFilterClause(
    domainContext,
    !hasSkillFilter // useDistinct only for browse mode
  );

  // === BUILD SKILL COLLECTION ===
  const skillCollectionClause = hasSkillFilter
    ? `
// Stage 2: Get ALL skills in hierarchy for qualifying engineers
MATCH (e)-[:HAS]->(es2:EngineerSkill)-[:FOR]->(s2:Skill)
WHERE s2.id IN $targetSkillIds

// Collect all skills with constraint check info
WITH e,
     COLLECT({
       skillId: s2.id,
       skillName: s2.name,
       proficiencyLevel: es2.proficiencyLevel,
       confidenceScore: es2.confidenceScore,
       yearsUsed: es2.yearsUsed,
       matchType: CASE
         WHEN s2.id IN $skillIdentifiers OR s2.name IN $skillIdentifiers THEN 'direct'
         ELSE 'descendant'
       END,
       meetsConfidence: es2.confidenceScore >= $minConfidenceScore,
       meetsProficiency: es2.proficiencyLevel IN $allowedProficiencyLevels
     }) AS allRelevantSkills,
     SIZE([x IN COLLECT(DISTINCT CASE
       WHEN es2.confidenceScore >= $minConfidenceScore
        AND es2.proficiencyLevel IN $allowedProficiencyLevels
       THEN s2.id END) WHERE x IS NOT NULL]) AS matchedSkillCount,
     AVG(CASE
       WHEN es2.confidenceScore >= $minConfidenceScore
        AND es2.proficiencyLevel IN $allowedProficiencyLevels
       THEN es2.confidenceScore END) AS avgConfidence`
    : `
// Get all skills for display (not filtering)
OPTIONAL MATCH (e)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.isCategory = false
  AND es.proficiencyLevel IN $allowedProficiencyLevels
  AND es.confidenceScore >= $minConfidenceScore

WITH e,
     COLLECT(
       CASE WHEN s IS NOT NULL THEN {
         skillId: s.id,
         skillName: s.name,
         proficiencyLevel: es.proficiencyLevel,
         confidenceScore: es.confidenceScore,
         yearsUsed: es.yearsUsed,
         matchType: 'none'
       } ELSE NULL END
     ) AS rawSkills

WITH e,
     [skill IN rawSkills WHERE skill IS NOT NULL] AS allRelevantSkills,
     0 AS matchedSkillCount,
     0.0 AS avgConfidence`;

  // === BUILD DOMAIN COLLECTION (shared) ===
  const carryoverFields = hasSkillFilter
    ? ["allRelevantSkills", "matchedSkillCount", "avgConfidence"]
    : ["allRelevantSkills", "matchedSkillCount", "avgConfidence"];
  const domainCollectionClause = buildPreferredDomainCollectionClause(
    domainContext,
    carryoverFields
  );

  // === BUILD ORDER BY (conditional) ===
  const orderByClause = hasSkillFilter
    ? "ORDER BY matchedSkillCount DESC, avgConfidence DESC, e.yearsExperience DESC"
    : "ORDER BY e.yearsExperience DESC";

  // === SHARED RETURN CLAUSE ===
  const returnClause = `
RETURN e.id AS id,
       e.name AS name,
       e.headline AS headline,
       e.salary AS salary,
       e.yearsExperience AS yearsExperience,
       e.availability AS availability,
       e.timezone AS timezone,
       allRelevantSkills,
       matchedSkillCount,
       COALESCE(avgConfidence, 0.0) AS avgConfidence,
       matchedDomainNames`;

  // === ASSEMBLE FINAL QUERY ===
  const query = `
// ${hasSkillFilter ? "Skill Search" : "Browse"} Mode Query
${matchClause}
${qualificationClause}
${domainFilterClause}
${skillCollectionClause}
${domainCollectionClause}
${returnClause}

${orderByClause}
SKIP $offset
LIMIT $limit
`;

  return { query, params: queryParams };
}
```

#### 2. Update index.ts exports

**File**: `recommender_api/src/services/cypher-query-builder/index.ts`

```typescript
/**
 * Cypher Query Builder Service
 * Generates Neo4j Cypher queries based on expanded constraints.
 */

export type { CypherQueryParams, CypherQuery } from "./query-types.js";

import { buildSearchQuery } from "./search-query.builder.js";
import { buildCountQuery } from "./count-query.builder.js";

export { buildSearchQuery, buildCountQuery };
```

#### 3. Delete old builder files

Delete these files (their logic is now in the unified builder):
- `recommender_api/src/services/cypher-query-builder/skill-search-query.builder.ts`
- `recommender_api/src/services/cypher-query-builder/browse-query.builder.ts`

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] No runtime errors when starting server: `npm run dev`

#### Manual Verification:
- [x] Skill search works: `POST /api/search/filter` with `{"requiredSkills": ["TypeScript"]}`
  - Returns engineers with matched skills having `matchType: 'direct'` or `'descendant'`
  - Returns `matchedSkillCount` > 0 and real `avgConfidence` values
- [x] Unfiltered search works: `POST /api/search/filter` with `{}`
  - Returns engineers (skills cleared when no filter applied - expected behavior)
- [x] Domain filtering works in both modes (no matching domain data in test DB)

**Implementation Note**: After completing this phase, pause for manual verification before proceeding.

---

## Phase 2: Unify Count Query Builder (Optional Follow-up)

### Overview

Apply the same consolidation pattern to `count-query.builder.ts`.

### Changes Required

#### 1. Refactor count-query.builder.ts

**File**: `recommender_api/src/services/cypher-query-builder/count-query.builder.ts`

```typescript
/**
 * Builds count queries for pagination.
 * Returns total matches without pagination limits.
 */

import type { CypherQueryParams, CypherQuery } from "./query-types.js";
import { buildEngineerQueryConditions } from "./query-conditions.builder.js";
import {
  getDomainFilterContext,
  addDomainQueryParams,
  buildRequiredDomainFilterClause,
} from "./query-domain-filter.builder.js";

export function buildCountQuery(params: CypherQueryParams): CypherQuery {
  const hasSkillFilter = params.targetSkillIds !== null && params.targetSkillIds.length > 0;

  // === SHARED SETUP ===
  const { conditions, queryParams } = buildEngineerQueryConditions(params);
  const domainContext = getDomainFilterContext(params);
  const whereClause = conditions.join("\n  AND ");

  addDomainQueryParams(queryParams, params, domainContext);

  // === CONDITIONAL: Skill-specific params ===
  if (hasSkillFilter) {
    queryParams.targetSkillIds = params.targetSkillIds;
    queryParams.minConfidenceScore = params.minConfidenceScore;
    queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;
  }

  // === BUILD MATCH CLAUSE ===
  const matchClause = hasSkillFilter
    ? `MATCH (e:Engineer)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.id IN $targetSkillIds
  AND ${whereClause}`
    : `MATCH (e:Engineer)
WHERE ${whereClause}`;

  // === BUILD QUALIFICATION CHECK (skill search only) ===
  const qualificationClause = hasSkillFilter
    ? `
WITH e, COLLECT(DISTINCT CASE
  WHEN es.confidenceScore >= $minConfidenceScore
   AND es.proficiencyLevel IN $allowedProficiencyLevels
  THEN s.id END) AS qualifyingSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) > 0`
    : "";

  // === BUILD DOMAIN FILTER ===
  const domainFilterClause = buildRequiredDomainFilterClause(
    domainContext,
    !hasSkillFilter // useDistinct only for browse mode
  );

  // === ASSEMBLE FINAL QUERY ===
  const query = `
${matchClause}
${qualificationClause}
${domainFilterClause}
RETURN COUNT(DISTINCT e) AS totalCount
`;

  return { query, params: queryParams };
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`

#### Manual Verification:
- [x] Pagination `totalCount` is correct for skill search queries
- [x] Pagination `totalCount` is correct for unfiltered queries

---

## Testing Strategy

### Manual Testing Steps

1. **Skill search with various filters**:
   ```bash
   curl -X POST http://localhost:3000/api/search/filter \
     -H "Content-Type: application/json" \
     -d '{"requiredSkills": ["TypeScript", "React"], "maxBudget": 150000}'
   ```
   - Verify `matchedSkillCount` > 0
   - Verify skills have `matchType: 'direct'` or `'descendant'`
   - Verify constraint booleans (`meetsConfidence`, `meetsProficiency`) are present

2. **Browse mode (no skills)**:
   ```bash
   curl -X POST http://localhost:3000/api/search/filter \
     -H "Content-Type: application/json" \
     -d '{"maxBudget": 100000}'
   ```
   - Verify `matchedSkillCount: 0`
   - Verify skills have `matchType: 'none'`
   - Verify ordered by `yearsExperience DESC`

3. **Domain filtering in both modes**:
   ```bash
   curl -X POST http://localhost:3000/api/search/filter \
     -H "Content-Type: application/json" \
     -d '{"requiredDomains": ["Healthcare"], "requiredSkills": ["Python"]}'
   ```

## References

- Previous consolidation plan: `thoughts/shared/1_chapter_5/1_project_1/plans/2025-12-30-consolidate-query-builders.md`
- Query builder files: `recommender_api/src/services/cypher-query-builder/`
- Search service: `recommender_api/src/services/search.service.ts`
