# Project 4: Filter-Similarity Endpoint Implementation Plan

## Overview

Implement `POST /api/search/filter-similarity` - a hybrid endpoint that combines constraint-based filtering (Section 5.2) with case-based similarity ranking (Section 5.3). Users provide hard constraints (`required*` fields) plus a reference engineer ID, and the system returns qualified candidates ranked by similarity to the reference engineer.

## Current State Analysis

### Existing Infrastructure (Ready to Reuse)

| Component | File | Reusability |
|-----------|------|-------------|
| Constraint expansion | `constraint-expander.service.ts` | **Full** - works with `required*` fields |
| Inference engine | `constraint-expander.service.ts` | **Full** - derives constraints from rules |
| Constraint advisor | `constraint-advisor/index.ts` | **Full** - relaxation/tightening suggestions |
| Cypher query builder | `search-query.builder.ts` | **Full** - generates WHERE clauses |
| Skill resolution | `skill-resolution.service.ts` | **Full** - resolves names → IDs |
| Graph loaders | `graph-loader.ts` | **Full** - loads skill/domain graphs |
| Similarity calculator | `similarity-calculator.ts` | **Full** - scores all 4 dimensions |
| Diversity selector | `diversity-selector.ts` | **Full** - bounded greedy selection |
| Engineer data loader | `similarity.service.ts:72-112` | **Full** - `loadEngineerData()` |

### Key Gap

The existing `/api/engineers/:id/similar` endpoint compares against ALL engineers. The new endpoint needs to:
1. Filter candidates via constraints FIRST (reuse search infrastructure)
2. Exclude the reference engineer from results
3. Score filtered candidates via similarity (reuse similarity infrastructure)

## Desired End State

### New Endpoint

```
POST /api/search/filter-similarity
```

### Request Schema

```typescript
{
  // Hard constraints - determines WHO qualifies (reuses /filter fields)
  requiredSkills?: SkillRequirement[];
  requiredSeniorityLevel?: SeniorityLevel;
  requiredMaxStartTime?: StartTimeline;
  requiredTimezone?: USTimezoneZone[];
  maxBudget?: number;
  stretchBudget?: number;
  requiredBusinessDomains?: BusinessDomainRequirement[];
  requiredTechnicalDomains?: TechnicalDomainRequirement[];

  // Reference engineer - determines HOW to RANK qualified candidates
  referenceEngineerId: string;  // REQUIRED - the engineer to find similar candidates to

  // Inference rule override (same as /filter)
  overriddenRuleIds?: string[];  // Rule IDs to bypass

  // Pagination
  limit?: number;   // default 10, max 100
  offset?: number;  // default 0
}
```

**Key design choices**:
- No `preferred*` fields - those belong on `/filter` for utility scoring
- `referenceEngineerId` is required - this is what differentiates from `/filter`
- Hard constraints are identical to `/filter` for consistency
- `overriddenRuleIds` allows bypassing inference rules (same as `/filter`)

### Response Schema

```typescript
{
  // Reference engineer info (for UI display)
  referenceEngineer: {
    id: string;
    name: string;
    headline: string;
  };

  // Filtered + ranked results
  matches: FilterSimilarityMatch[];
  totalCount: number;  // Total qualifying (before pagination)

  // Transparency (reuses /filter types)
  appliedFilters: AppliedFilter[];
  overriddenRuleIds: string[];  // Echo back overridden rules

  // Inference engine results (same structure as /filter)
  derivedConstraints: Array<{
    rule: { id: string; name: string };
    action: { effect: 'filter' | 'boost'; targetField: string; targetValue: unknown; boostStrength?: number };
    provenance: { derivationChains: string[][]; explanation: string };
    override?: { overrideScope: 'FULL' | 'PARTIAL'; overriddenSkills: string[] };
  }>;

  // Constraint advisor (same as /filter - Project 2)
  relaxation?: RelaxationResult;   // If < 3 results
  tightening?: TighteningResult;   // If >= 25 results

  // Execution metadata
  queryMetadata: {
    executionTimeMs: number;
    candidatesBeforeDiversity: number;  // How many passed filters
  };
}

interface FilterSimilarityMatch {
  // Engineer basic info
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  startTimeline: string;
  timezone: string;

  // Similarity scoring
  similarityScore: number;  // 0-1 normalized
  scoreBreakdown: {
    skills: number;
    yearsExperience: number;
    domain: number;
    timezone: number;
  };

  // Similarity diagnostics
  sharedSkills: string[];           // Common skill names
  correlatedSkills: CorrelatedSkillPair[];  // Semantically related
}
```

### Verification

The endpoint is complete when:
1. `POST /api/search/filter-similarity` accepts the request schema
2. Returns 400 for missing `referenceEngineerId`
3. Returns 404 if reference engineer doesn't exist
4. Returns candidates matching all `required*` constraints
5. Candidates ranked by similarity to reference (not by utility)
6. Reference engineer excluded from results
7. Diversity selection applied to prevent homogeneous results
8. Inference rules apply derived constraints (visible in `derivedConstraints`)
9. `overriddenRuleIds` bypasses specified inference rules
10. Constraint advisor returns `relaxation` when < 3 results
11. Constraint advisor returns `tightening` when >= 25 results
12. E2E tests pass for filter-similarity scenarios

## What We're NOT Doing

1. **Evidence weights** - Deferred to future project (as noted in research doc)
2. **Combined utility+similarity** - No blended scoring; each endpoint has distinct purpose
3. **idealProfile object** - Using real engineer reference only (simpler, matches real workflow)

## Implementation Approach

Reuse maximum existing code. The main new work is:
1. Schema for the new request type (with `overriddenRuleIds` support)
2. Service function that orchestrates filter → inference → similarity → diversify → constraint advice
3. Query builder tweak to exclude reference engineer
4. Route + controller wiring

**Reused infrastructure**:
- Constraint expansion + inference rules (`expandSearchCriteria`)
- Constraint advisor (`getConstraintAdvice`) for relaxation/tightening
- Similarity calculator, diversity selector, graph loaders

---

## Phase 1: Request Schema and Types

### Overview
Create Zod schema and TypeScript types for the new endpoint.

### Changes Required

#### 1. New Schema File
**File**: `src/schemas/filter-similarity.schema.ts` (new)

```typescript
/**
 * Filter-Similarity API Schema
 * Combines constraint filtering (5.2) with similarity ranking (5.3).
 */

import { z } from 'zod';
import {
  SeniorityLevelSchema,
  StartTimelineSchema,
  USTimezoneZoneSchema,
  SkillRequirementSchema,
  BusinessDomainRequirementSchema,
  TechnicalDomainRequirementSchema,
} from './search.schema.js';

export const FilterSimilarityRequestSchema = z.object({
  // Hard constraints (subset of /filter - no preferred* fields)
  requiredSkills: z.array(SkillRequirementSchema).optional(),
  requiredSeniorityLevel: SeniorityLevelSchema.optional(),
  requiredMaxStartTime: StartTimelineSchema.optional(),
  requiredTimezone: z.array(USTimezoneZoneSchema).optional(),
  maxBudget: z.number().positive().optional(),
  stretchBudget: z.number().positive().optional(),
  requiredBusinessDomains: z.array(BusinessDomainRequirementSchema).optional(),
  requiredTechnicalDomains: z.array(TechnicalDomainRequirementSchema).optional(),

  // Reference engineer (REQUIRED)
  referenceEngineerId: z.string().min(1, 'referenceEngineerId is required'),

  // Inference rule override (same as /filter)
  overriddenRuleIds: z.array(z.string()).optional(),

  // Pagination
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
}).refine(
  (data) => {
    if (data.stretchBudget !== undefined && data.maxBudget === undefined) {
      return false;
    }
    return true;
  },
  {
    message: 'stretchBudget requires maxBudget to be set',
    path: ['stretchBudget'],
  }
).refine(
  (data) => {
    if (data.stretchBudget !== undefined && data.maxBudget !== undefined) {
      return data.stretchBudget >= data.maxBudget;
    }
    return true;
  },
  {
    message: 'stretchBudget must be greater than or equal to maxBudget',
    path: ['stretchBudget'],
  }
);

export type FilterSimilarityRequest = z.infer<typeof FilterSimilarityRequestSchema>;
```

#### 2. New Types File
**File**: `src/types/filter-similarity.types.ts` (new)

```typescript
/**
 * Filter-Similarity API Types
 * Response types for the hybrid filter + similarity endpoint.
 */

import type {
  AppliedFilter,
  RelaxationResult,
  TighteningResult,
} from './search.types.js';
import type {
  SimilarityBreakdown,
  CorrelatedSkillPair,
} from '../services/similarity-calculator/types.js';

export interface FilterSimilarityMatch {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  startTimeline: string;
  timezone: string;
  similarityScore: number;
  scoreBreakdown: SimilarityBreakdown;
  sharedSkills: string[];
  correlatedSkills: CorrelatedSkillPair[];
}

export interface DerivedConstraintInfo {
  rule: {
    id: string;
    name: string;
  };
  action: {
    effect: 'filter' | 'boost';
    targetField: string;
    targetValue: unknown;
    boostStrength?: number;
  };
  provenance: {
    derivationChains: string[][];
    explanation: string;
  };
  override?: {
    overrideScope: 'FULL' | 'PARTIAL';
    overriddenSkills: string[];
  };
}

export interface FilterSimilarityResponse {
  referenceEngineer: {
    id: string;
    name: string;
    headline: string;
  };
  matches: FilterSimilarityMatch[];
  totalCount: number;
  appliedFilters: AppliedFilter[];
  overriddenRuleIds: string[];
  derivedConstraints: DerivedConstraintInfo[];
  relaxation?: RelaxationResult;
  tightening?: TighteningResult;
  queryMetadata: {
    executionTimeMs: number;
    candidatesBeforeDiversity: number;
  };
}
```

#### 3. Export from Types Index
**File**: `src/types/index.ts`
**Changes**: Add export for new types

```typescript
// Add to existing exports
export type { SimilarityBreakdown, CorrelatedSkillPair } from '../services/similarity-calculator/types.js';
export * from './filter-similarity.types.js';
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] New files exist at expected paths

---

## Phase 2: Filtered Candidates Query Builder

### Overview
Add a function to load candidates matching constraints (excluding reference engineer). This reuses most of the existing search query builder logic.

### Changes Required

#### 1. Add Filtered Candidates Query Function
**File**: `src/services/cypher-query-builder/search-query.builder.ts`
**Changes**: Add new exported function `buildFilteredCandidatesQuery`

This function builds a query that:
- Applies all constraint WHERE clauses (reusing existing helpers)
- Excludes the reference engineer (`e.id <> $excludeEngineerId`)
- Returns basic engineer info (not full skill details - we load those separately for similarity)
- Returns total count for pagination

```typescript
/**
 * Builds a query to find candidates matching constraints, excluding a reference engineer.
 * Used by filter-similarity endpoint to get candidates before similarity scoring.
 *
 * Unlike buildSearchQuery, this returns minimal engineer data since similarity
 * scoring will load full data separately via graph-loader.
 */
export function buildFilteredCandidatesQuery(
  params: FilteredCandidatesParams
): CypherQuery {
  // Implementation reuses buildBasicEngineerFilters, buildRequiredBusinessDomainFilter, etc.
  // Adds WHERE e.id <> $excludeEngineerId
  // Returns only engineer IDs + basic properties for efficiency
}

export interface FilteredCandidatesParams {
  excludeEngineerId: string;
  // Reuse subset of CypherQueryParams for constraints
  startTimeline: StartTimeline[];
  minYearsExperience: number | null;
  maxYearsExperience: number | null;
  timezoneZones: string[];
  maxBudget: number | null;
  stretchBudget: number | null;
  requiredBusinessDomains?: ResolvedBusinessDomain[];
  requiredTechnicalDomains?: ResolvedTechnicalDomain[];
  // Skill constraints (optional - if no skills, just apply property filters)
  allSkillIds?: string[];
  learningLevelSkillIds?: string[];
  proficientLevelSkillIds?: string[];
  expertLevelSkillIds?: string[];
  offset: number;
  limit: number;
}
```

**Implementation approach**:
- If no skill constraints: Simple MATCH (e:Engineer) with property filters
- If skill constraints: Reuse the skill-filtered pattern from existing `buildSearchQuery`
- Always exclude reference engineer: `WHERE e.id <> $excludeEngineerId`
- Return `RETURN e.id AS id, count(*) OVER () AS totalCount` (or similar pagination pattern)

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Existing search tests still pass: `npm test -- search`

---

## Phase 3: Load Candidates for Similarity Function

### Overview
Add a function to load full engineer data for a list of candidate IDs. This enables efficient batch loading after the filter query returns matching IDs.

### Changes Required

#### 1. Add Batch Engineer Loader
**File**: `src/services/similarity.service.ts`
**Changes**: Export new function `loadEngineersById`

```typescript
/**
 * Loads multiple engineers by ID for similarity comparison.
 * Used after filtering to get full engineer data for scoring.
 */
export async function loadEngineersById(
  session: Session,
  engineerIds: string[]
): Promise<EngineerForSimilarity[]> {
  if (engineerIds.length === 0) {
    return [];
  }

  const query = `
    MATCH (e:Engineer)
    WHERE e.id IN $engineerIds
    OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    OPTIONAL MATCH (e)-[bdExp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    OPTIONAL MATCH (e)-[tdExp:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
    RETURN e.id AS id,
           e.name AS name,
           e.headline AS headline,
           e.yearsExperience AS yearsExperience,
           e.timezone AS timezone,
           COLLECT(DISTINCT CASE WHEN s IS NOT NULL THEN {
             skillId: s.id,
             skillName: s.name,
             proficiencyLevel: us.proficiencyLevel,
             confidenceScore: us.confidenceScore
           } END) AS skills,
           COLLECT(DISTINCT CASE WHEN bd IS NOT NULL THEN {
             domainId: bd.id,
             domainName: bd.name,
             years: bdExp.years
           } END) AS businessDomains,
           COLLECT(DISTINCT CASE WHEN td IS NOT NULL THEN {
             domainId: td.id,
             domainName: td.name,
             years: tdExp.years
           } END) AS technicalDomains
  `;

  const result = await session.run(query, { engineerIds });
  return result.records.map(record => parseEngineerRecord(record));
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Existing similarity tests still pass: `npm test -- similarity`

---

## Phase 4: Filter-Similarity Service

### Overview
Create the main service that orchestrates the filter → similarity flow.

### Changes Required

#### 1. New Service File
**File**: `src/services/filter-similarity.service.ts` (new)

```typescript
/**
 * Filter-Similarity Service
 *
 * Implements the hybrid search pattern (Section 5.2 + 5.3):
 * 1. Filter candidates by hard constraints (5.2) + inference rules
 * 2. Rank filtered candidates by similarity to reference (5.3)
 * 3. Apply diversity selection (5.3.1.1)
 * 4. Provide constraint advice (relaxation/tightening)
 */

import type { Session } from 'neo4j-driver';
import type { FilterSimilarityRequest } from '../schemas/filter-similarity.schema.js';
import type { FilterSimilarityResponse } from '../types/filter-similarity.types.js';

// Reuse from existing services
import { resolveAllSkills } from './skill-resolution.service.js';
import { expandSearchCriteria } from './constraint-expander.service.js';
import { resolveBusinessDomains, resolveTechnicalDomains } from './domain-resolver.service.js';
import { buildFilteredCandidatesQuery } from './cypher-query-builder/search-query.builder.js';
import { loadEngineerData, loadEngineersById } from './similarity.service.js';
import { loadSkillGraph, loadDomainGraph, scoreAndSortCandidates, selectDiverseResults } from './similarity-calculator/index.js';
import { getConstraintAdvice } from './constraint-advisor/index.js';
import { knowledgeBaseConfig } from '../config/knowledge-base/index.js';

export async function executeFilterSimilarity(
  session: Session,
  request: FilterSimilarityRequest
): Promise<FilterSimilarityResponse> {
  const startTime = Date.now();
  const config = knowledgeBaseConfig;

  // 1. Load reference engineer (fail fast if not found)
  const referenceEngineer = await loadEngineerData(session, request.referenceEngineerId);
  if (!referenceEngineer) {
    throw new EngineerNotFoundError(request.referenceEngineerId);
  }

  // 2. Resolve skills (if any required skills specified)
  const skillResolution = request.requiredSkills?.length
    ? await resolveAllSkills(
        session,
        request.requiredSkills,
        [],  // No preferred skills in this endpoint
        config.defaults.defaultMinProficiency
      )
    : null;

  // 3. Expand constraints (seniority → years, timeline → array, inference rules, etc.)
  // Pass overriddenRuleIds to allow users to bypass inference rules
  const expanded = await expandSearchCriteria(
    {
      requiredSeniorityLevel: request.requiredSeniorityLevel,
      requiredMaxStartTime: request.requiredMaxStartTime,
      requiredTimezone: request.requiredTimezone,
      maxBudget: request.maxBudget,
      stretchBudget: request.stretchBudget,
      overriddenRuleIds: request.overriddenRuleIds,
      limit: request.limit,
      offset: request.offset,
    } as any,  // Partial request - only required* fields
    skillResolution?.resolvedRequiredSkills ?? [],
    []  // No preferred skills
  );

  // 4. Resolve domain constraints
  const requiredBusinessDomains = await resolveBusinessDomains(
    session,
    request.requiredBusinessDomains
  );
  const requiredTechnicalDomains = await resolveTechnicalDomains(
    session,
    request.requiredTechnicalDomains
  );

  // 5. Build and execute filter query (excluding reference engineer)
  // Include derived skill constraints from inference engine
  const allRequiredSkillIds = [
    ...(skillResolution?.requiredSkillIds ?? []),
    ...expanded.derivedRequiredSkillIds,
  ];

  const filterQuery = buildFilteredCandidatesQuery({
    excludeEngineerId: request.referenceEngineerId,
    startTimeline: expanded.startTimeline,
    minYearsExperience: expanded.minYearsExperience,
    maxYearsExperience: expanded.maxYearsExperience,
    timezoneZones: expanded.timezoneZones,
    maxBudget: expanded.maxBudget,
    stretchBudget: expanded.stretchBudget,
    requiredBusinessDomains: requiredBusinessDomains.length > 0 ? requiredBusinessDomains : undefined,
    requiredTechnicalDomains: requiredTechnicalDomains.length > 0 ? requiredTechnicalDomains : undefined,
    allSkillIds: allRequiredSkillIds,
    learningLevelSkillIds: skillResolution?.skillGroups.learningLevelSkillIds ?? [],
    proficientLevelSkillIds: skillResolution?.skillGroups.proficientLevelSkillIds ?? [],
    expertLevelSkillIds: skillResolution?.skillGroups.expertLevelSkillIds ?? [],
    offset: 0,  // Get all matching IDs first, paginate after diversity
    limit: 1000,  // Reasonable cap for similarity scoring
  });

  const filterResult = await session.run(filterQuery.query, filterQuery.params);
  const candidateIds = filterResult.records.map(r => r.get('id') as string);
  const totalCount = filterResult.records.length > 0
    ? (filterResult.records[0].get('totalCount') as number)
    : 0;

  // 6. Get constraint advice (relaxation/tightening) based on result count
  const constraintAdviceOutput = await getConstraintAdvice({
    session,
    totalCount,
    expandedSearchCriteria: expanded,
    appliedFilters: expanded.appliedFilters,
  });

  // 7. Load graphs for similarity calculation
  const [skillGraph, domainGraph] = await Promise.all([
    loadSkillGraph(session),
    loadDomainGraph(session),
  ]);

  // 8. Load full candidate data for scoring
  const candidates = await loadEngineersById(session, candidateIds);

  // 9. Score candidates by similarity to reference
  const scored = scoreAndSortCandidates(skillGraph, domainGraph, referenceEngineer, candidates);

  // 10. Apply diversity selection
  const diverse = selectDiverseResults(skillGraph, domainGraph, scored, request.limit);

  // 11. Apply offset (diversity selection returns from rank 0)
  const paginated = diverse.slice(request.offset, request.offset + request.limit);

  // 12. Build response
  return {
    referenceEngineer: {
      id: referenceEngineer.id,
      name: referenceEngineer.name,
      headline: referenceEngineer.headline,
    },
    matches: paginated.map(result => ({
      id: result.engineer.id,
      name: result.engineer.name,
      headline: result.engineer.headline,
      salary: 0,  // Not loaded in similarity data - consider adding if needed
      yearsExperience: result.engineer.yearsExperience,
      startTimeline: '',  // Not loaded in similarity data
      timezone: result.engineer.timezone,
      similarityScore: result.similarityScore,
      scoreBreakdown: result.breakdown,
      sharedSkills: result.sharedSkills,
      correlatedSkills: result.correlatedSkills,
    })),
    totalCount,
    appliedFilters: expanded.appliedFilters,
    overriddenRuleIds: request.overriddenRuleIds || [],
    derivedConstraints: expanded.derivedConstraints.map(dc => ({
      rule: dc.rule,
      action: dc.action,
      provenance: dc.provenance,
      override: dc.override,
    })),
    // Include constraint advice if present
    ...(constraintAdviceOutput.relaxation && { relaxation: constraintAdviceOutput.relaxation }),
    ...(constraintAdviceOutput.tightening && { tightening: constraintAdviceOutput.tightening }),
    queryMetadata: {
      executionTimeMs: Date.now() - startTime,
      candidatesBeforeDiversity: candidates.length,
    },
  };
}

export class EngineerNotFoundError extends Error {
  constructor(engineerId: string) {
    super(`Engineer not found: ${engineerId}`);
    this.name = 'EngineerNotFoundError';
  }
}
```

**Note on salary/startTimeline**: The current `EngineerForSimilarity` type doesn't include salary or startTimeline since similarity scoring doesn't use them. We have two options:
1. Add these fields to `EngineerForSimilarity` and the loader query
2. Return 0/empty in response (these aren't used for similarity ranking)

For now, option 2 is simpler. If the UI needs these, we can add them in a follow-up.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`

---

## Phase 5: Controller and Route

### Overview
Wire up the endpoint with Express route and controller.

### Changes Required

#### 1. New Controller File
**File**: `src/controllers/filter-similarity.controller.ts` (new)

```typescript
/**
 * Filter-Similarity Controller
 * Handles HTTP layer for POST /api/search/filter-similarity
 */

import type { Request, Response } from 'express';
import { getDriver } from '../database/neo4j.js';
import { executeFilterSimilarity, EngineerNotFoundError } from '../services/filter-similarity.service.js';
import type { FilterSimilarityRequest } from '../schemas/filter-similarity.schema.js';

export async function filterSimilarity(req: Request, res: Response): Promise<void> {
  const session = getDriver().session();

  try {
    const request = req.body as FilterSimilarityRequest;
    const result = await executeFilterSimilarity(session, request);
    res.json(result);
  } catch (error) {
    if (error instanceof EngineerNotFoundError) {
      res.status(404).json({
        error: {
          code: 'ENGINEER_NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }

    console.error('Filter-similarity error:', error);
    res.status(500).json({
      error: {
        code: 'FILTER_SIMILARITY_ERROR',
        message: 'Failed to find similar engineers matching constraints',
        details: [{ field: 'internal', message: error instanceof Error ? error.message : 'Unknown error' }],
      },
    });
  } finally {
    await session.close();
  }
}
```

#### 2. Add Route
**File**: `src/routes/search.routes.ts`
**Changes**: Add new route for filter-similarity

```typescript
// Add import
import { filterSimilarity } from '../controllers/filter-similarity.controller.js';
import { FilterSimilarityRequestSchema } from '../schemas/filter-similarity.schema.js';

// Add route (after existing /filter route)
router.post('/filter-similarity', validate(FilterSimilarityRequestSchema), filterSimilarity);
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Server starts without error: (Tilt already running)
- [x] Endpoint responds: `curl -X POST http://localhost:4025/api/search/filter-similarity -H "Content-Type: application/json" -d '{"referenceEngineerId": "invalid"}' | jq` returns 404

---

## Phase 6: Update EngineerForSimilarity Data Loading

### Overview
Add salary and startTimeline to the engineer data for response completeness.

### Changes Required

#### 1. Update Types
**File**: `src/services/similarity-calculator/types.ts`
**Changes**: Add optional fields for response data

```typescript
export interface EngineerForSimilarity {
  id: string;
  name: string;
  headline: string;
  yearsExperience: number;
  timezone: string;
  skills: EngineerSkill[];
  businessDomains: DomainExperience[];
  technicalDomains: DomainExperience[];
  // Optional fields for filter-similarity response (not used in scoring)
  salary?: number;
  startTimeline?: string;
}
```

#### 2. Update Loader Query
**File**: `src/services/similarity.service.ts`
**Changes**: Add salary and startTimeline to RETURN clauses in `loadEngineerData`, `loadAllEngineersExcept`, and new `loadEngineersById`

```cypher
RETURN e.id AS id,
       e.name AS name,
       e.headline AS headline,
       e.yearsExperience AS yearsExperience,
       e.timezone AS timezone,
       e.salary AS salary,
       e.startTimeline AS startTimeline,
       ...
```

#### 3. Update Parser
**File**: `src/services/similarity.service.ts`
**Changes**: Add salary and startTimeline to `parseEngineerRecord`

```typescript
return {
  // ... existing fields
  salary: record.get('salary') as number | undefined,
  startTimeline: record.get('startTimeline') as string | undefined,
};
```

#### 4. Update Response Mapping
**File**: `src/services/filter-similarity.service.ts`
**Changes**: Use actual values instead of placeholders

```typescript
matches: paginated.map(result => ({
  // ...
  salary: result.engineer.salary ?? 0,
  startTimeline: result.engineer.startTimeline ?? '',
  // ...
})),
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Existing similarity tests still pass: `npm test -- similarity`

---

## Phase 7: Unit Tests

### Overview
Add unit tests for the new endpoint logic.

### Changes Required

#### 1. Schema Tests
**File**: `src/schemas/__tests__/filter-similarity.schema.test.ts` (new)

Test cases:
- Valid request with all fields
- Valid request with only referenceEngineerId
- Valid request with overriddenRuleIds
- Invalid: missing referenceEngineerId
- Invalid: stretchBudget without maxBudget
- Invalid: stretchBudget < maxBudget

#### 2. Service Tests
**File**: `src/services/__tests__/filter-similarity.service.test.ts` (new)

Test cases:
- Returns 404-style error for non-existent reference engineer
- Filters candidates by constraints
- Excludes reference engineer from results
- Returns candidates sorted by similarity
- Applies diversity selection
- Respects pagination (limit/offset)
- Includes derivedConstraints from inference engine
- Respects overriddenRuleIds (bypasses specified rules)
- Returns relaxation suggestions when < 3 results
- Returns tightening suggestions when >= 25 results

### Success Criteria

#### Automated Verification:
- [x] All tests pass: `npm test`
- [x] TypeScript compiles: `npm run typecheck`

---

## Phase 8: E2E Tests (Postman)

### Overview
Add Postman collection tests for the new endpoint.

### Changes Required

#### 1. Add Test Folder to Collection
**File**: `postman/collections/search-filter-tests.postman_collection.json`
**Changes**: Add new folder "Filter-Similarity" with test cases:

1. **Basic filter-similarity** - Valid request returns similarity-ranked results
2. **Missing referenceEngineerId** - Returns 400 validation error
3. **Non-existent reference engineer** - Returns 404
4. **With skill constraints** - Filters by required skills + similarity ranking
5. **With seniority constraint** - Filters by seniority + similarity ranking
6. **With timezone constraint** - Filters by timezone + similarity ranking
7. **Pagination** - limit/offset work correctly
8. **Reference excluded** - Reference engineer not in results
9. **Empty constraints** - Returns all engineers except reference, ranked by similarity
10. **Inference rules applied** - derivedConstraints populated when rules fire
11. **Override inference rule** - overriddenRuleIds bypasses specified rule
12. **Sparse results relaxation** - Returns relaxation suggestions when few matches
13. **Many results tightening** - Returns tightening suggestions when many matches

### Success Criteria

#### Automated Verification:
- [x] E2E tests pass: `npm run test:e2e`

#### Manual Verification:
- [x] Response includes `referenceEngineer` with correct info (Test 63: Marcus Chen returned)
- [x] Results are ranked by `similarityScore` (descending) - first result highest, diversity reorders others
- [x] `scoreBreakdown` shows 4 components (skills, yearsExperience, domain, timezone) (Test 63)
- [x] `appliedFilters` correctly reflects constraints applied (Tests 66, 67, 68)
- [x] Diversity in results (not all engineers with identical skills) (Test 63: varied scores)
- [x] `derivedConstraints` shows inference rule outputs when applicable (Test 71)
- [x] `overriddenRuleIds` echo shows which rules were bypassed (Test 72)
- [x] `relaxation` suggestions appear for sparse results (covered by existing /filter tests)
- [x] `tightening` suggestions appear for many results (covered by existing /filter tests)

**Verification completed via automated E2E tests. Full test results documented in:**
`thoughts/shared/1_chapter_5/4_project_4/test-results/2026-01-17-filter-similarity-e2e-test-results.md`

---

## Testing Strategy

### Unit Tests
- Schema validation (required fields, type coercion, refinements)
- Service orchestration (mock Neo4j, verify correct function calls)
- Query builder (verify Cypher syntax and parameters)

### Integration Tests
- Full flow with real Neo4j (seeded data)
- Constraint filtering produces expected candidates
- Similarity scoring orders results correctly
- Diversity selection provides varied results

### Manual Testing Steps
1. Start Tilt: `./bin/tilt-start.sh`
2. Open Postman, send request to `/api/search/filter-similarity`
3. Verify reference engineer appears in response header
4. Verify results exclude reference engineer
5. Verify similarity scores decrease as you scroll down
6. Test with various constraint combinations

---

## Performance Considerations

1. **Two-phase query**: Filter first (returns IDs), then load full data for top N. Avoids loading all engineer data for scoring.

2. **Candidate cap**: Limit filtered candidates to 1000 before similarity scoring. If more than 1000 match, user should add more constraints.

3. **Graph caching opportunity**: Skill/domain graphs could be cached with TTL since they rarely change. Not implemented now, but noted for future.

4. **Diversity pool size**: Uses existing `diversityMultiplier: 3` from config. Pool = 3 × limit ensures good diversity without excessive scoring.

---

## References

- Research doc: `thoughts/shared/1_chapter_5/4_project_4/research/2026-01-17-project-4-combined-search-research.md`
- Existing search service: `src/services/search.service.ts:43-262`
- Existing similarity service: `src/services/similarity.service.ts:30-67`
- Similarity calculator: `src/services/similarity-calculator/similarity-calculator.ts`
- Constraint expander: `src/services/constraint-expander.service.ts:128-238`
- Query builder: `src/services/cypher-query-builder/search-query.builder.ts`
