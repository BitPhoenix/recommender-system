# Unify Search Query Builder Implementation Plan

## Overview

Refactor the Cypher query building infrastructure to eliminate duplication between `buildSearchQuery` (used by `/filter` endpoint) and `buildFilteredCandidatesQuery` (used by `/filter-similarity` endpoint). Both endpoints share the same filtering logic but differ in what data they return.

## Current State Analysis

### The Problem: Two Parallel Implementations

Currently we have:

1. **Two separate parameter interfaces** (`query-types.ts`):
   - `CypherQueryParams` (lines 19-50) - used by search
   - `FilteredCandidatesParams` (lines 96-112) - used by filter-similarity
   - These share ~90% of the same fields

2. **Two separate query builders** (`search-query.builder.ts`):
   - `buildSearchQuery` (lines 28-108) - returns full engineer data
   - `buildFilteredCandidatesQuery` (lines 489-612) - returns only IDs

3. **Duplicated filtering logic**:
   - `buildFilteredCandidatesQuery` manually builds property conditions (lines 516-545) instead of using `buildBasicEngineerFilters`
   - Domain filter logic is duplicated (though recently refactored to use shared functions)

4. **Two database round trips in filter-similarity** (`filter-similarity.service.ts`):
   - Line 139: Runs filter query to get IDs
   - Line 161: Runs `loadEngineersById` to get full data
   - This is inefficient - one query could do both

### Key Insight: Why Skill Collection Differs

The real reason for the separate query builder:

**Search query** (`buildSkillCollectionClause`, line 400-401):
```cypher
MATCH (e)-[:HAS]->(us2:UserSkill)-[:FOR]->(s2:Skill)
WHERE s2.id IN $allSkillIds  -- ONLY filtered skills
```

**Similarity data loader** (`loadEngineersById`, line 174):
```cypher
OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)  -- ALL skills
```

- **Search** returns skills that matched the filter (for display: "here's how they matched your criteria")
- **Similarity** needs ALL skills (for scoring: compare full profiles)

This is a legitimate use case difference, not arbitrary duplication.

## Desired End State

After this refactoring:

1. **One unified parameter interface** - `CypherQueryParams` with optional `excludeEngineerId`
2. **One query builder function** - `buildSearchQuery` with a `collectAllSkills` option
3. **Filter-similarity uses the unified query** - gets full data in one DB call
4. **No duplicated filtering logic** - all property/domain filtering goes through shared functions
5. **Clear documentation** explaining when to use `collectAllSkills: true`

### Verification

- All existing tests pass (`npm test`)
- Filter-similarity E2E tests pass (`npm run test:e2e`)
- TypeScript compiles without errors (`npm run typecheck`)

## What We're NOT Doing

- Changing the `/filter` endpoint's response format
- Changing the `/filter-similarity` endpoint's response format
- Modifying similarity scoring logic
- Changing how diversity selection works

## Implementation Approach

The key insight is that filtering logic is identical - only the data collection differs. We'll:

1. Merge the interfaces (add `excludeEngineerId` to `CypherQueryParams`)
2. Add `collectAllSkills` option to control skill collection behavior
3. Delete `FilteredCandidatesParams` and `buildFilteredCandidatesQuery`
4. Update filter-similarity to use the unified query and parse results

---

## Phase 1: Merge Parameter Interfaces

### Overview
Add `excludeEngineerId` to `CypherQueryParams` and delete `FilteredCandidatesParams`.

### Changes Required:

#### 1. Update CypherQueryParams
**File**: `src/services/cypher-query-builder/query-types.ts`

Add `excludeEngineerId` field with documentation:

```typescript
export interface CypherQueryParams extends SkillProficiencyGroups {
  /*
   * Original skill identifiers from the user's request (before hierarchy expansion).
   * Used to classify each matched skill as "direct" or "descendant" in the response.
   */
  originalSkillIdentifiers: string[] | null;

  /*
   * Optional: exclude a specific engineer from results.
   *
   * USE CASE: Filter-similarity endpoint needs to find candidates similar to a
   * reference engineer. The reference should not appear in results.
   *
   * When provided, adds `e.id <> $excludeEngineerId` to WHERE clause.
   */
  excludeEngineerId?: string;

  // ... rest unchanged
}
```

#### 2. Delete FilteredCandidatesParams
**File**: `src/services/cypher-query-builder/query-types.ts`

Remove lines 92-112 (the entire `FilteredCandidatesParams` interface).

#### 3. Update query-types exports
**File**: `src/services/cypher-query-builder/query-types.ts`

Remove `FilteredCandidatesParams` from any exports.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck` (will fail until Phase 2 complete)

---

## Phase 2: Add collectAllSkills Option

### Overview
Add a `SearchQueryOptions` interface with `collectAllSkills` option that changes skill collection behavior.

### Changes Required:

#### 1. Add SearchQueryOptions type
**File**: `src/services/cypher-query-builder/search-query.builder.ts`

Add after imports:

```typescript
/**
 * Options for buildSearchQuery that control data collection behavior.
 */
export interface SearchQueryOptions {
  /*
   * When true, collects ALL skills for each engineer (no filter).
   * When false/undefined, collects only skills matching $allSkillIds.
   *
   * USE CASES:
   * - false (default): /filter endpoint - show skills that matched the query
   * - true: /filter-similarity endpoint - need full skill profile for similarity scoring
   *
   * WHY THIS MATTERS:
   * Similarity scoring compares engineers across ALL their skills to compute
   * a meaningful similarity score. If we only returned filtered skills, we'd
   * be comparing incomplete profiles (e.g., both have React, but one also has
   * Python, TypeScript, Go which affects how similar they really are).
   *
   * The /filter endpoint, in contrast, shows users "here's how this engineer
   * matched YOUR criteria" - so returning only filtered skills makes sense.
   */
  collectAllSkills?: boolean;
}
```

#### 2. Update buildSearchQuery signature
**File**: `src/services/cypher-query-builder/search-query.builder.ts`

Change function signature:

```typescript
export function buildSearchQuery(
  params: CypherQueryParams,
  options: SearchQueryOptions = {}
): CypherQuery {
```

#### 3. Handle excludeEngineerId in buildBasicEngineerFilters
**File**: `src/services/cypher-query-builder/query-conditions.builder.ts`

Update to handle the optional `excludeEngineerId`:

```typescript
export function buildBasicEngineerFilters(
  params: CypherQueryParams
): BasicEngineerFilters {
  const budgetCeiling = params.stretchBudget ?? params.maxBudget;

  const filters = [
    buildTimelineFilter(params.startTimeline),
    buildExperienceFilter(params.minYearsExperience, params.maxYearsExperience),
    buildTimezoneFilter(params.timezoneZones),
    buildBudgetFilter(budgetCeiling),
  ];

  // Add exclusion filter if specified
  if (params.excludeEngineerId) {
    filters.push(buildExcludeEngineerFilter(params.excludeEngineerId));
  }

  return combineFilters(filters);
}

function buildExcludeEngineerFilter(engineerId: string): FilterParts {
  return {
    conditions: ['e.id <> $excludeEngineerId'],
    queryParams: { excludeEngineerId: engineerId },
  };
}
```

#### 4. Update buildSkillCollectionClause
**File**: `src/services/cypher-query-builder/search-query.builder.ts`

Modify to accept `collectAllSkills` option:

```typescript
function buildSkillCollectionClause(
  hasSkillFilter: boolean,
  collectAllSkills: boolean
): string {
  /*
   * Two collection modes based on use case:
   *
   * 1. collectAllSkills=false (default, for /filter):
   *    Collect only skills matching the filter criteria.
   *    Shows users "here's how this engineer matched your query."
   *
   * 2. collectAllSkills=true (for /filter-similarity):
   *    Collect ALL skills regardless of filter.
   *    Needed for similarity scoring which compares full skill profiles.
   *    Without this, we'd compare incomplete profiles and get misleading scores.
   */

  if (collectAllSkills) {
    // Collect ALL skills for full profile comparison
    return `
// Collect ALL skills (collectAllSkills=true for similarity scoring)
OPTIONAL MATCH (e)-[:HAS]->(us2:UserSkill)-[:FOR]->(s2:Skill)
WHERE s2.isCategory = false

WITH e, totalCount,
     COLLECT(DISTINCT CASE WHEN s2 IS NOT NULL THEN {
       skillId: s2.id,
       skillName: s2.name,
       proficiencyLevel: us2.proficiencyLevel,
       confidenceScore: us2.confidenceScore,
       yearsUsed: us2.yearsUsed,
       matchType: CASE
         WHEN s2.id IN $originalSkillIdentifiers OR s2.name IN $originalSkillIdentifiers THEN 'direct'
         WHEN s2.id IN $allSkillIds THEN 'descendant'
         ELSE 'none'
       END,
       meetsProficiency: CASE
         WHEN s2.id IN $learningLevelSkillIds THEN true
         WHEN s2.id IN $proficientLevelSkillIds AND us2.proficiencyLevel IN ['proficient', 'expert'] THEN true
         WHEN s2.id IN $expertLevelSkillIds AND us2.proficiencyLevel = 'expert' THEN true
         ELSE false
       END
     } END) AS allRelevantSkills,
     SIZE([s IN COLLECT(DISTINCT s2.id) WHERE s IN $allSkillIds]) AS matchedSkillCount,
     AVG(CASE WHEN s2.id IN $allSkillIds THEN us2.confidenceScore END) AS avgConfidence`;
  }

  // Original behavior: collect only filtered skills
  return hasSkillFilter
    ? `
// Collect filtered skills only (for /filter display)
MATCH (e)-[:HAS]->(us2:UserSkill)-[:FOR]->(s2:Skill)
WHERE s2.id IN $allSkillIds
... // (existing code)
`
    : `
// No skill filter - collect all non-category skills
OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
WHERE s.isCategory = false
... // (existing code)
`;
}
```

#### 5. Wire up options in buildSearchQuery
**File**: `src/services/cypher-query-builder/search-query.builder.ts`

Pass options through to skill collection:

```typescript
export function buildSearchQuery(
  params: CypherQueryParams,
  options: SearchQueryOptions = {}
): CypherQuery {
  const { collectAllSkills = false } = options;

  // ... existing code ...

  const skillCollectionClause = buildSkillCollectionClause(hasSkillFilter, collectAllSkills);

  // ... rest unchanged ...
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Existing search tests pass: `npm test -- query-builder`

---

## Phase 3: Delete buildFilteredCandidatesQuery

### Overview
Remove the redundant query builder now that `buildSearchQuery` can handle both use cases.

### Changes Required:

#### 1. Remove buildFilteredCandidatesQuery
**File**: `src/services/cypher-query-builder/search-query.builder.ts`

Delete lines 476-612 (the entire `buildFilteredCandidatesQuery` function and its section comment).

#### 2. Update imports
**File**: `src/services/cypher-query-builder/search-query.builder.ts`

Remove `FilteredCandidatesParams` from the import statement (line 11).

#### 3. Update index exports
**File**: `src/services/cypher-query-builder/index.ts`

Remove `buildFilteredCandidatesQuery` from exports if present.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck` (will fail until Phase 4)

---

## Phase 4: Update Filter-Similarity Service

### Overview
Update filter-similarity to use the unified `buildSearchQuery` with `collectAllSkills: true`, eliminating the second database call.

### Changes Required:

#### 1. Update imports
**File**: `src/services/filter-similarity.service.ts`

Change:
```typescript
import { buildFilteredCandidatesQuery } from './cypher-query-builder/search-query.builder.js';
```

To:
```typescript
import { buildSearchQuery, type SearchQueryOptions } from './cypher-query-builder/search-query.builder.js';
```

#### 2. Remove loadEngineersById import
**File**: `src/services/filter-similarity.service.ts`

Remove `loadEngineersById` from the import (line 24) - we'll get data from the query directly.

#### 3. Build query params
**File**: `src/services/filter-similarity.service.ts`

Replace the `buildFilteredCandidatesQuery` call (lines 121-137) with:

```typescript
/*
 * Build unified search query with collectAllSkills=true.
 *
 * Unlike /filter which shows "skills matching your criteria", filter-similarity
 * needs ALL skills for each engineer to compute meaningful similarity scores.
 * See SearchQueryOptions.collectAllSkills for detailed explanation.
 */
const queryParams: CypherQueryParams = {
  // Exclude reference engineer from results
  excludeEngineerId: request.referenceEngineerId,

  // Skill filters
  learningLevelSkillIds: skillResolution?.skillGroups.learningLevelSkillIds ?? [],
  proficientLevelSkillIds: skillResolution?.skillGroups.proficientLevelSkillIds ?? [],
  expertLevelSkillIds: skillResolution?.skillGroups.expertLevelSkillIds ?? [],
  originalSkillIdentifiers: request.requiredSkills ?? null,

  // Property filters
  startTimeline: expanded.startTimeline,
  minYearsExperience: expanded.minYearsExperience,
  maxYearsExperience: expanded.maxYearsExperience,
  timezoneZones: expanded.timezoneZones,
  maxBudget: expanded.maxBudget,
  stretchBudget: expanded.stretchBudget,

  // Domain filters (only required, no preferred for this endpoint)
  requiredBusinessDomains: requiredBusinessDomains.length > 0 ? requiredBusinessDomains : undefined,
  requiredTechnicalDomains: requiredTechnicalDomains.length > 0 ? requiredTechnicalDomains : undefined,

  // Get all candidates, paginate after diversity selection
  offset: 0,
  limit: 1000,
};

const searchQueryOptions: SearchQueryOptions = {
  collectAllSkills: true,  // Need full profiles for similarity scoring
};

const filterQuery = buildSearchQuery(queryParams, searchQueryOptions);
```

#### 4. Parse results into EngineerForSimilarity format
**File**: `src/services/filter-similarity.service.ts`

Replace the separate data loading (lines 139-161) with result parsing:

```typescript
const filterResult = await session.run(filterQuery.query, filterQuery.params);
const totalCount = filterResult.records.length > 0
  ? toNumber(filterResult.records[0].get('totalCount'))
  : 0;

// Parse query results into EngineerForSimilarity format for scoring
const candidates: EngineerForSimilarity[] = filterResult.records.map(record => ({
  id: record.get('id') as string,
  name: record.get('name') as string,
  headline: record.get('headline') as string,
  yearsExperience: toNumber(record.get('yearsExperience')),
  timezone: record.get('timezone') as string,
  salary: record.get('salary') ? toNumber(record.get('salary')) : undefined,
  startTimeline: record.get('startTimeline') as string | undefined,
  skills: parseSkills(record.get('allRelevantSkills')),
  businessDomains: parseDomains(record.get('matchedBusinessDomains')),
  technicalDomains: parseDomains(record.get('matchedTechnicalDomains')),
}));
```

#### 5. Add helper parsing functions
**File**: `src/services/filter-similarity.service.ts`

Add at bottom of file:

```typescript
function parseSkills(rawSkills: unknown[]): EngineerSkill[] {
  return (rawSkills ?? [])
    .filter((s): s is Record<string, unknown> => s !== null)
    .map(s => ({
      skillId: s.skillId as string,
      skillName: s.skillName as string,
      proficiencyLevel: s.proficiencyLevel as string,
      confidenceScore: toNumber(s.confidenceScore),
    }));
}

function parseDomains(rawDomains: unknown[]): DomainExperience[] {
  return (rawDomains ?? [])
    .filter((d): d is Record<string, unknown> => d !== null)
    .map(d => ({
      domainId: d.domainId as string,
      domainName: d.domainName as string,
      years: toNumber(d.years),
    }));
}
```

#### 6. Add necessary type imports
**File**: `src/services/filter-similarity.service.ts`

Add to imports:
```typescript
import type { CypherQueryParams } from './cypher-query-builder/query-types.js';
import type { EngineerForSimilarity, EngineerSkill, DomainExperience } from './similarity-calculator/types.js';
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All unit tests pass: `npm test`
- [x] Filter-similarity tests pass: `npm test -- filter-similarity`

#### Manual Verification:
- [x] E2E tests pass: `npm run test:e2e`
- [x] Filter-similarity returns correct results (spot check a few requests)

---

## Phase 5: Update Documentation

### Overview
Update the code walkthrough to reflect the unified architecture.

### Changes Required:

#### 1. Update walkthrough document
**File**: `thoughts/shared/research/2026-01-17-project-4-code-walkthrough-plan.md`

Update Section 7 (Query Builder) to document:
- The unified `buildSearchQuery` function
- The `SearchQueryOptions.collectAllSkills` option and when to use it
- Remove references to `buildFilteredCandidatesQuery`

### Success Criteria:

#### Automated Verification:
- [x] All tests still pass: `npm test && npm run test:e2e`

---

## Testing Strategy

### Unit Tests:
- Existing `search-query.builder.test.ts` tests should continue to pass
- Add tests for `collectAllSkills: true` option
- Add tests for `excludeEngineerId` parameter

### Integration Tests:
- Filter-similarity service tests should pass with new implementation
- Verify one DB call instead of two (can check via query spy/mock)

### E2E Tests:
- All existing Postman tests should pass
- Filter-similarity responses should be identical

## Performance Considerations

**Improvement**: Filter-similarity now makes ONE database query instead of TWO:
- Before: Query for IDs → Load full data by IDs
- After: Single query returns full data

This should improve response time, especially for large result sets.

## Migration Notes

This is a backward-compatible refactoring:
- `/filter` endpoint behavior unchanged
- `/filter-similarity` endpoint behavior unchanged (same response format)
- Only internal implementation changes

## References

- Current conversation context (2026-01-18 discussion of unification)
- `query-types.ts` - Current interface definitions
- `search-query.builder.ts` - Current query builder implementation
- `filter-similarity.service.ts` - Current service implementation
- `similarity.service.ts` - Data loading functions for reference
