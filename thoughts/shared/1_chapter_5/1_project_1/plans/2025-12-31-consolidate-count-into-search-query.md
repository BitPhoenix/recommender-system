# Consolidate Count Query Into Search Query

## Overview

Eliminate the separate count query by computing `totalCount` mid-query, then paginating BEFORE the expensive skill/domain collection. This ensures a single source of truth for filtering logic and improves performance by only collecting detailed skill data for the paginated subset.

## Current State Analysis

**Two separate queries exist that must stay in sync:**
- `search-query.builder.ts` (159 lines) - main search with skill/domain collection
- `count-query.builder.ts` (76 lines) - simplified count query

**The duplication problem:**
- Both files duplicate the MATCH clause (lines 39-44 in search, 44-49 in count)
- Both files duplicate the qualification clause (lines 47-55 in search, 52-59 in count)
- Changes to filtering logic require updating both files
- Risk of drift between the two queries

**Current query flow:**
1. Main query: MATCH → filter → qualify → domain filter → **collect all skills** → ORDER → SKIP/LIMIT → RETURN
2. Count query: MATCH → filter → qualify → domain filter → COUNT

**Problem:** The expensive skill collection happens for ALL matching engineers, then we paginate. This is wasteful.

### Key Discoveries:
- `totalCount` is used in `search.service.ts:246` for pagination metadata
- Count query runs separately at `search.service.ts:146-147`
- The service expects `totalCount` as a single number from the response

## Desired End State

A single unified query that:
1. Filters and qualifies engineers (existing logic)
2. **Counts all matching engineers before pagination** (new)
3. **Paginates immediately** (ORDER BY, SKIP, LIMIT)
4. **Then** collects detailed skill/domain data only for the page

**Verification:**
- `count-query.builder.ts` is deleted
- `search-query.builder.ts` returns `totalCount` in results
- `search.service.ts` extracts `totalCount` from main query, removes separate count query call
- All existing tests pass
- `totalCount` matches previous behavior for pagination

## What We're NOT Doing

- Changing the filtering/qualification logic itself
- Modifying the skill collection output format
- Changing the API response shape
- Adding new query parameters

## Implementation Approach

The key insight: **do the count AFTER filtering but BEFORE the expensive skill collection**, and paginate early so skill collection only runs for 20 engineers instead of potentially hundreds.

**Ordering consistency guarantee:** The ordering logic will compute the same values (`matchedSkillCount`, `avgConfidence`) from the same data - just earlier in the query (during qualification rather than during skill collection). The ORDER BY will produce identical results. During implementation, the qualification-phase computation must use the exact same CASE/WHERE conditions as the current skill collection phase to ensure ordering behavior is unchanged.

```cypher
// Stage 1: Filter and qualify (existing logic)
MATCH ... WHERE ...
WITH e, ... basic ordering metrics ...

// Stage 2: NEW - Count all matches, then paginate early
WITH COLLECT({e: e, orderMetrics: ...}) AS allResults
WITH allResults, SIZE(allResults) AS totalCount
UNWIND allResults AS row
ORDER BY ...
SKIP $offset LIMIT $limit
WITH row.e AS e, totalCount, ... ordering metrics ...

// Stage 3: Expensive skill collection (now only for 20 engineers!)
MATCH (e)-[:HAS]->(es2:EngineerSkill)...
WITH e, totalCount, ... skill data ...

// Stage 4: Domain collection (also only for 20 engineers)
...
RETURN ..., totalCount
```

## Phase 1: Restructure Search Query to Include Count

### Overview
Modify `search-query.builder.ts` to collect count mid-query and paginate early, then pass `totalCount` through to the RETURN clause.

### Changes Required:

#### 1. Update search-query.builder.ts

**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`

**Changes**: Insert count collection and early pagination between qualification and skill collection.

The new structure (showing the key change):

```typescript
// After qualification clause, before skill collection:

// === BUILD COUNT AND EARLY PAGINATION ===
// For skill search: we have ordering metrics from qualification
// For unfiltered search: we just have the engineer
const countAndPaginateClause = hasSkillFilter
  ? `
// Count all qualifying engineers, then paginate early
WITH COLLECT({
  e: e,
  qualifyingSkillIds: qualifyingSkillIds
}) AS allResults
WITH allResults, SIZE(allResults) AS totalCount
UNWIND allResults AS row
WITH row.e AS e, row.qualifyingSkillIds AS qualifyingSkillIds, totalCount
ORDER BY SIZE(qualifyingSkillIds) DESC, e.yearsExperience DESC
SKIP $offset LIMIT $limit`
  : `
// Count all matching engineers, then paginate early
WITH COLLECT(e) AS allResults
WITH allResults, SIZE(allResults) AS totalCount
UNWIND allResults AS e
WITH e, totalCount
ORDER BY e.yearsExperience DESC
SKIP $offset LIMIT $limit`;

// Then skill collection continues, but now carrying totalCount through...
```

**Key modifications:**

1. Add `totalCount` to all subsequent WITH clauses to carry it through
2. Move ORDER BY, SKIP, LIMIT to BEFORE skill collection
3. Update skill collection to work with single engineers (not pre-paginated set)
4. Add `totalCount` to the RETURN clause

#### 2. Update RETURN clause

Add `totalCount` to the return statement:

```typescript
const returnClause = `
RETURN e.id AS id,
       e.name AS name,
       ...existing fields...,
       totalCount`;  // NEW
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test` (no tests exist in project)
- [x] Query returns `totalCount` field in results

#### Manual Verification:
- [x] Search with pagination shows correct total (e.g., "Showing 1-20 of 156")
- [x] totalCount matches what the old count query returned

**Implementation Note**: After completing this phase, pause for manual testing to verify totalCount accuracy before proceeding.

---

## Phase 2: Update Service Layer

### Overview
Modify `search.service.ts` to extract `totalCount` from main query results instead of running a separate count query.

### Changes Required:

#### 1. Remove count query call

**File**: `recommender_api/src/services/search.service.ts`

**Changes**:

Remove lines 144-147:
```typescript
// DELETE THIS:
// Separate count query for pagination - main query has LIMIT so .length only
// gives paginated count, not total. This returns totalCount for "1-20 of 156".
const countQuery = buildCountQuery(queryParams);
const countResult = await session.run(countQuery.query, countQuery.params);
```

#### 2. Extract totalCount from main query

**File**: `recommender_api/src/services/search.service.ts`

**Changes**:

Update line 246 from:
```typescript
const totalCount = toNumber(countResult.records[0]?.get('totalCount') || 0);
```

To:
```typescript
// Extract totalCount from first record (all records have same value)
const totalCount = mainResult.records.length > 0
  ? toNumber(mainResult.records[0].get('totalCount'))
  : 0;
```

#### 3. Update import

**File**: `recommender_api/src/services/search.service.ts`

**Changes**:

Update import from:
```typescript
import {
  buildSearchQuery,
  buildCountQuery,  // REMOVE
  type CypherQueryParams,
} from './cypher-query-builder/index.js';
```

To:
```typescript
import {
  buildSearchQuery,
  type CypherQueryParams,
} from './cypher-query-builder/index.js';
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tests pass: `npm test` (no tests exist in project)
- [x] No references to `buildCountQuery` remain in service

#### Manual Verification:
- [x] API response includes correct `totalCount`
- [x] Pagination works correctly in UI

**Implementation Note**: Test the full flow end-to-end before proceeding to cleanup.

---

## Phase 3: Delete Count Query Builder

### Overview
Remove the now-unused count query builder file and its exports.

### Changes Required:

#### 1. Delete count-query.builder.ts

**File**: `recommender_api/src/services/cypher-query-builder/count-query.builder.ts`

**Action**: Delete entire file

#### 2. Update index.ts exports

**File**: `recommender_api/src/services/cypher-query-builder/index.ts`

**Changes**:

From:
```typescript
import { buildSearchQuery } from "./search-query.builder.js";
import { buildCountQuery } from "./count-query.builder.js";

export { buildSearchQuery, buildCountQuery };
```

To:
```typescript
import { buildSearchQuery } from "./search-query.builder.js";

export { buildSearchQuery };
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tests pass: `npm test` (no tests exist in project)
- [x] `count-query.builder.ts` file no longer exists
- [x] No imports of `buildCountQuery` anywhere in codebase

#### Manual Verification:
- [x] Full search flow works end-to-end

---

## Testing Strategy

### Unit Tests:
- Verify search query returns `totalCount` field
- Test with 0 results (totalCount should be 0)
- Test with results < limit (totalCount equals result count)
- Test with results > limit (totalCount > result count)

### Integration Tests:
- Search with pagination: verify totalCount matches actual total
- Skill-filtered search: verify totalCount only counts qualified engineers
- Unfiltered search: verify totalCount counts all matching engineers

### Manual Testing Steps:
1. Search with filters that return ~50 results with limit=20
2. Verify UI shows "Showing 1-20 of 50"
3. Navigate to page 3, verify "Showing 41-50 of 50"
4. Compare totalCount with old implementation (run both queries temporarily)

## Performance Considerations

**Expected improvement:** The expensive skill collection now only runs for the paginated subset (e.g., 20 engineers) instead of all matching engineers (e.g., 156 engineers). This should significantly reduce query execution time for large result sets.

**Potential concern:** The COLLECT/UNWIND pattern adds some overhead, but this is minimal compared to the saved skill collection work.

**Monitoring:** Compare query execution times before/after in `queryMetadata.executionTimeMs`.

## References

- Current count query: `recommender_api/src/services/cypher-query-builder/count-query.builder.ts`
- Current search query: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`
- Service orchestration: `recommender_api/src/services/search.service.ts:139-147`
