---
date: 2026-01-17T10:30:00-05:00
researcher: Claude
git_commit: e248baa2928764640b5ff27a68ea810e56f0bab6
branch: project_3
repository: recommender_system
topic: "Project 4 Filter-Similarity Endpoint - Code Walkthrough"
tags: [research, codebase, filter-similarity, walkthrough, learning]
status: complete
last_updated: 2026-01-18
last_updated_by: Claude
---

# Code Walkthrough: Project 4 Filter-Similarity Endpoint

## The Big Picture

This endpoint solves a specific problem: **"Find engineers who match my hard requirements AND are similar to this engineer I already like."**

It's a hybrid of two systems:
1. **Constraint filtering** (from `/filter` endpoint) - "Must have TypeScript, must be senior level"
2. **Similarity ranking** (from `/engineers/:id/similar` endpoint) - "Rank by how similar they are to Marcus"

---

## Reading Order

```
1. Route Definition ──────────── (entry point)
2. Validation Middleware ─────── (how requests are validated)
3. Request Schema ────────────── (what the API accepts)
4. Response Types ────────────── (what the API returns)
5. Controller ────────────────── (HTTP layer)
6. Main Service ──────────────── (orchestration - the core)
7. Query Builder ─────────────── (how filtering works)
8. Data Loader ───────────────── (how engineer data is fetched)
9. Similarity Calculator ─────── (how scoring works)
10. Diversity Selector ────────── (how results are diversified)
```

---

## 1. Route Definition

**File:** `src/routes/search.routes.ts`

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 6-11 | Imports | The route imports controller, middleware, and schema |
| 29 | `router.post('/filter-similarity', ...)` | **This is the entry point.** |

```typescript
// Line 29
router.post('/filter-similarity', validate(FilterSimilarityRequestSchema), filterSimilarity);
```

**Key concept:** Express middleware composition. The chain is:
1. `validate(FilterSimilarityRequestSchema)` runs first
2. If validation passes, `filterSimilarity` controller runs
3. If validation fails, controller never runs (400 error returned)

---

## 2. Validation Middleware

**File:** `src/middleware/zod-validate.middleware.ts`

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 13-14 | `export function validate<T>(schema: ZodSchema<T>)` | Generic factory function - takes any Zod schema, returns Express middleware |
| 17-19 | Empty body handling | `const body = req.body && Object.keys(req.body).length > 0 ? req.body : {}` - allows calling endpoint with no constraints |
| 22 | **Key line** | `req.body = schema.parse(body)` - replaces raw body with validated/typed version. Zod applies defaults here (limit=10, offset=0) |
| 24-34 | Error handling | If validation fails, returns 400 with Zod error issues. Request never reaches controller. |

**Key concept:** The middleware mutates `req.body`. After line 22 runs, `req.body` is guaranteed to match `FilterSimilarityRequest` type.

---

## 3. Request Schema

**File:** `src/schemas/filter-similarity.schema.ts`

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 10-17 | Imports from `search.schema.js` | **Reuse pattern:** Don't redefine schemas. Import existing validators for skills, seniority, timezone, etc. |
| 21-28 | Hard constraint fields | All optional - you can filter by any combination or none |
| 31 | `referenceEngineerId` | `z.string().min(1, 'referenceEngineerId is required')` - **The only required field.** This differentiates from `/filter` |
| 34 | `overriddenRuleIds` | `z.array(z.string()).optional()` - allows users to bypass inference rules |
| 37-38 | Pagination with defaults | `limit: z.number().int().min(1).max(100).default(10)` and `offset: z.number().int().min(0).default(0)` |
| 39-49 | First `.refine()` | Cross-field validation: can't have `stretchBudget` without `maxBudget` |
| 50-60 | Second `.refine()` | `stretchBudget` must be >= `maxBudget` |
| 63 | Type inference | `export type FilterSimilarityRequest = z.infer<typeof FilterSimilarityRequestSchema>` - TypeScript type derived from schema |

**Key concept:** Zod schemas do three things: validate, transform (apply defaults), and provide TypeScript types. Single source of truth.

---

## 4. Response Types

**File:** `src/types/filter-similarity.types.ts`

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 6-14 | Imports | Reuses `AppliedFilter`, `RelaxationResult`, `TighteningResult` from search types, and `SimilarityBreakdown`, `CorrelatedSkillPair` from similarity calculator |
| 16-28 | `FilterSimilarityMatch` | What each result looks like |
| 20 | `salary: number` | Basic engineer info |
| 24 | `similarityScore: number` | 0-1 overall similarity |
| 25 | `scoreBreakdown: SimilarityBreakdown` | Per-dimension scores: `{ skills, yearsExperience, domain, timezone }` |
| 26-27 | `sharedSkills`, `correlatedSkills` | Diagnostics explaining WHY they're similar |
| 30-49 | `DerivedConstraintInfo` | How inference rule output is structured |
| 32-34 | `rule: { id, name }` | Which rule fired |
| 35-40 | `action: { effect, targetField, targetValue }` | What the rule did |
| 41-44 | `provenance: { derivationChains, explanation }` | Why the rule fired |
| 45-48 | `override?` | Whether the rule was bypassed |
| 51-68 | `FilterSimilarityResponse` | The full response wrapper |
| 52-56 | `referenceEngineer` | Basic info about who you're comparing against |
| 57-61 | Core fields | `matches[]`, `totalCount`, `appliedFilters`, `overriddenRuleIds`, `derivedConstraints` |
| 62-63 | `relaxation?`, `tightening?` | Optional - only present when too few or too many results |
| 64-67 | `queryMetadata` | `{ executionTimeMs, candidatesBeforeDiversity }` - performance info |

**Key concept:** The response is designed for transparency - it tells you what was applied, what was derived, and why you got these results.

---

## 5. Controller

**File:** `src/controllers/filter-similarity.controller.ts`

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 6-12 | Imports | Controller imports driver, service, error class, and request type |
| 18-19 | Function signature | `async function filterSimilarity(req: Request, res: Response): Promise<void>` |
| 19 | Session creation | `const session = driver.session()` - creates Neo4j connection |
| 21-24 | `try` block | Type assertion `req.body as FilterSimilarityRequest` is safe because middleware validated it. All logic delegated to `executeFilterSimilarity` |
| 25-34 | `EngineerNotFoundError` handling | **Error discrimination pattern.** `if (error instanceof EngineerNotFoundError)` → return 404 |
| 36-43 | Generic error handling | Catch-all for unexpected errors → 500 with error details |
| 44-46 | `finally` block | **Critical:** `await session.close()` - always close session, even on error. Prevents connection leaks. |

**Key concept:** Controller is thin - handles HTTP concerns only. Business logic lives in the service.

---

## 6. Main Service (The Heart of the Implementation)

**File:** `src/services/filter-similarity.service.ts`

This is the most important file. Read it in phases:

### Phase A: Setup and Fail-Fast Validation

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 47-50 | Function signature | `async function executeFilterSimilarity(session: Session, request: FilterSimilarityRequest): Promise<FilterSimilarityResponse>` |
| 51 | `const startTime = Date.now()` | Track execution time for response metadata |
| 52 | `const config = knowledgeBaseConfig` | Load configuration |
| 54-58 | **Fail-fast validation** | Load reference engineer first. If not found, throw immediately. Don't do any other work. |

```typescript
// Lines 54-58
const referenceEngineer = await loadEngineerData(session, request.referenceEngineerId);
if (!referenceEngineer) {
  throw new EngineerNotFoundError(request.referenceEngineerId);
}
```

### Phase B: Constraint Resolution

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 60-68 | Skill resolution | If `requiredSkills` provided, resolve names to IDs and group by proficiency level |
| 61-68 | Conditional resolution | `request.requiredSkills?.length ? await resolveAllSkills(...) : null` - only resolve if skills specified |
| 70-77 | Comment block | Explains why we build a "partial request" to reuse the constraint expander |
| 78-88 | `partialRequest` construction | Maps filter-similarity fields to search request format |
| 84 | `overriddenRuleIds` | Passed through to allow users to bypass inference rules |
| 90-94 | `expandSearchCriteria()` call | **Inference engine integration.** Expands "senior" → "6-10 years", applies rules like "React required" → "JavaScript also required" |
| 97-104 | Domain resolution | `resolveBusinessDomains()` and `resolveTechnicalDomains()` - resolves names to IDs, expands hierarchies |

### Phase C: Filter Query Execution

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 106-109 | Comment | Explains skill ID merging |
| 110-113 | Skill ID merging | `allRequiredSkillIds = [...skillResolution?.requiredSkillIds, ...expanded.derivedRequiredSkillIds]` - combines user-specified and inference-derived skills |
| 115-131 | `buildFilteredCandidatesQuery()` call | Builds the Cypher query with all constraints |
| 116 | `excludeEngineerId` | **Key:** Don't return the reference engineer in results |
| 129-130 | Pagination override | `offset: 0, limit: 1000` - get ALL matching IDs, paginate AFTER diversity selection |
| 133 | Execute query | `const filterResult = await session.run(filterQuery.query, filterQuery.params)` |
| 134 | Extract IDs | `const candidateIds = filterResult.records.map(r => r.get('id'))` |
| 135-137 | Get total count | Extracts `totalCount` from first record for pagination metadata |

### Phase D: Constraint Advice

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 139-145 | `getConstraintAdvice()` call | If < 3 results → suggest relaxation. If >= 25 → suggest tightening. |

### Phase E: Similarity Scoring

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 147-150 | Comment | Neo4j sessions aren't thread-safe, so load sequentially |
| 151 | `loadSkillGraph(session)` | Loads skill relationships into memory (React relates to JavaScript) |
| 152 | `loadDomainGraph(session)` | Loads domain relationships into memory |
| 154-155 | `loadEngineersById()` | **Batch loading.** Loads full profile data for all filtered candidates in one query |
| 157-158 | `scoreAndSortCandidates()` | **Similarity calculation.** Scores each candidate against reference, sorts descending |
| 160-164 | Comment | Explains diversity selection approach |
| 165 | `diversityLimit` calculation | `Math.min(request.limit + request.offset, scored.length)` - get more candidates than needed for diversity headroom |
| 166 | `selectDiverseResults()` | Prevents homogeneous results (not 5 identical React/Node.js engineers) |
| 168-169 | Pagination | `diverse.slice(request.offset, request.offset + request.limit)` - apply pagination AFTER diversity |

### Phase F: Response Construction

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 171-177 | `derivedConstraints` mapping | Format inference rule output for response |
| 179-192 | `matches` mapping | Transform internal `SimilarityResult` to API response type |
| 184 | `salary: result.engineer.salary ?? 0` | Default to 0 if missing |
| 186 | `startTimeline: result.engineer.startTimeline ?? ''` | Default to empty string if missing |
| 194-211 | Final response assembly | Puts all pieces together |
| 205-206 | Conditional fields | `...(constraintAdviceOutput.relaxation && { relaxation: ... })` - only include if present |
| 207-210 | `queryMetadata` | Execution time and candidates-before-diversity count |

### Error Class and Helper

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 217-222 | `EngineerNotFoundError` class | Custom error class with `name` property for `instanceof` checking |
| 227-232 | `toNumber()` helper | Neo4j returns integers as objects with `.toNumber()` method. This handles both cases. |

---

## 7. Query Builder (Unified Architecture)

**File:** `src/services/cypher-query-builder/search-query.builder.ts`

The filter-similarity endpoint uses the **unified `buildSearchQuery`** function with a `collectAllSkills` option, eliminating the previously separate `buildFilteredCandidatesQuery`. This design:
- Shares filtering logic with the `/filter` endpoint (no duplication)
- Supports different skill collection modes via `SearchQueryOptions`
- Returns full engineer data in one query (no separate data loading step)

### SearchQueryOptions Interface

```typescript
export interface SearchQueryOptions {
  /*
   * When true, collects ALL skills for each engineer (no filter).
   * When false/undefined, collects only skills matching $allSkillIds.
   *
   * USE CASES:
   * - false (default): /filter endpoint - show skills that matched the query
   * - true: /filter-similarity endpoint - need full skill profile for similarity scoring
   */
  collectAllSkills?: boolean;
}
```

### Key Integration Points

| Location | What to Read | What to Understand |
|----------|--------------|-------------------|
| `CypherQueryParams.excludeEngineerId` | `query-types.ts` | Optional field to exclude a specific engineer (for filter-similarity) |
| `buildBasicEngineerFilters()` | `query-conditions.builder.ts` | Handles `excludeEngineerId` → adds `e.id <> $excludeEngineerId` clause |
| `buildSearchQuery(params, options)` | `search-query.builder.ts:53` | Entry point with optional `SearchQueryOptions` |
| `buildSkillCollectionClause(hasSkillFilter, collectAllSkills)` | `search-query.builder.ts:428` | Switches between filtered and all-skills collection |

### How Filter-Similarity Uses the Unified Query

```typescript
// In filter-similarity.service.ts
const queryParams: CypherQueryParams = {
  excludeEngineerId: request.referenceEngineerId,  // Exclude reference from results
  // ... other params from expanded search criteria
};

const searchQueryOptions: SearchQueryOptions = {
  collectAllSkills: true,  // Need full profiles for similarity scoring
};

const filterQuery = buildSearchQuery(queryParams, searchQueryOptions);
```

### Skill Collection Modes (buildSkillCollectionClause)

**Mode 1: `collectAllSkills=false` (default, for /filter)**
```cypher
// Collect only skills matching the filter
MATCH (e)-[:HAS]->(us2:UserSkill)-[:FOR]->(s2:Skill)
WHERE s2.id IN $allSkillIds
// Returns: skills the user asked for
```

**Mode 2: `collectAllSkills=true` (for /filter-similarity)**
```cypher
// Collect ALL skills for full profile comparison
OPTIONAL MATCH (e)-[:HAS]->(us2:UserSkill)-[:FOR]->(s2:Skill)
WHERE s2.isCategory = false
// Returns: all skills for similarity scoring
```

**Why this matters:** Similarity scoring compares engineers across ALL their skills. If we only returned filtered skills, we'd compare incomplete profiles (e.g., both have React, but one also has Python, TypeScript, Go which affects similarity).

### Shared Cypher Fragments

Both `/filter` and `/filter-similarity` reuse the same building blocks:

| Fragment | Purpose |
|----------|---------|
| `buildBasicEngineerFilters()` | Property filters + optional exclusion |
| `buildProficiencyQualificationClause()` | Proficiency-level filtering |
| `buildRequiredBusinessDomainFilter()` | Business domain constraints |
| `buildRequiredTechnicalDomainFilter()` | Technical domain constraints |

---

## 8. Result Parsing (In-Service)

**File:** `src/services/filter-similarity.service.ts`

The filter-similarity service now parses query results directly (no separate `loadEngineersById` call):

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 179-190 | Result mapping | `filterResult.records.map(record => {...})` transforms Neo4j records to `EngineerForSimilarity` |
| 272-280 | `parseSkills()` | Filters nulls, maps raw skill data to `EngineerSkill` type |
| 286-293 | `parseDomains()` | Filters nulls, maps raw domain data to `DomainExperience` type |
| 262-267 | `toNumber()` | Handles Neo4j integers that come as objects with `.toNumber()` |

### Performance Improvement

**Before (two queries):**
1. Filter query → get IDs
2. `loadEngineersById()` → get full data

**After (one query):**
1. Unified query with `collectAllSkills: true` → get full data directly

This eliminates a database round-trip, improving response time for large result sets.

---

## 9. Similarity Calculator

**File:** `src/services/similarity-calculator/similarity-calculator.ts`

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 5-8 | Equation comment | `Similarity = Σ w_i · Sim(t_i, x_i)` - weighted sum of dimension similarities |
| 27-36 | `scoreAndSortCandidates()` | Maps all candidates through scoring, sorts by score descending |
| 33-35 | Implementation | `candidates.map(c => calculateSimilarityWithBreakdown(...)).sort((a, b) => b.score - a.score)` |
| 42-47 | `calculateSimilarityWithBreakdown()` | Main scoring function signature |
| 48 | Load weights | `const weights = similarityWeights` from config |
| 50-55 | Skill similarity | `calculateSkillSimilarity(skillGraph, target.skills, candidate.skills)` |
| 57-60 | Experience similarity | `calculateExperienceSimilarity(target.yearsExperience, candidate.yearsExperience)` |
| 62-68 | Domain similarity | `calculateDomainSimilarity(domainGraph, target.domains, candidate.domains)` |
| 70-73 | Timezone similarity | `calculateTimezoneSimilarity(target.timezone, candidate.timezone)` |
| 75-79 | Apply weights | Multiply each raw score by its weight |
| 81-84 | Total score | Sum weighted scores, round to 2 decimals |
| 86-92 | Breakdown | **Uses raw (unweighted) scores.** Users see "skills: 0.8" meaning "80% similar on skills" |
| 94-98 | Shared skills | Map skill IDs to names for human-readable output |
| 100-106 | Result assembly | Bundles engineer, score, breakdown, shared/correlated skills |

**Key concept:** The breakdown shows unweighted scores so users understand "why" without needing to know the weight math.

---

## 10. Similarity Types

**File:** `src/services/similarity-calculator/types.ts`

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 10-22 | `EngineerForSimilarity` | Data needed for similarity calculation |
| 19-21 | Optional fields | `salary?: number` and `startTimeline?: string` - comment: "not used in scoring" |
| 24-29 | `EngineerSkill` | `{ skillId, skillName, proficiencyLevel, confidenceScore }` |
| 31-35 | `DomainExperience` | `{ domainId, domainName, years }` |
| 37-42 | `SimilarityBreakdown` | The four dimensions: `{ skills, yearsExperience, domain, timezone }` |
| 44-48 | `CorrelatedSkillPair` | `{ targetSkill, candidateSkill, strength }` - e.g., React ↔ JavaScript at 0.8 |
| 50-56 | `SimilarityResult` | `{ engineer, similarityScore, breakdown, sharedSkills, correlatedSkills }` |
| 85-101 | Graph types | `SkillGraph` and `SkillGraphNode` - in-memory structures for skill relationships |
| 103-112 | Domain graph types | `DomainGraph` and `DomainGraphNode` |

---

## 11. Diversity Selector

**File:** `src/services/similarity-calculator/diversity-selector.ts`

| Lines | What to Read | What to Understand |
|-------|--------------|-------------------|
| 1-14 | File comment | Explains the problem: without diversity, you get 5 identical React/Node.js engineers |
| 5 | Quality formula | `Quality(X) = Similarity(target, X) × D_avg(X, selected)` |
| 24-29 | Algorithm comment | Greedy selection maximizing `similarity × avgDiversity` |
| 30-35 | Function signature | `selectDiverseResults(skillGraph, domainGraph, candidates, targetCount)` |
| 36-37 | Pool sizing | `poolSize = targetCount * diversityMultiplier` (multiplier from config, typically 3) |
| 39-40 | Pool creation | `candidates.slice(0, poolSize)` - take top candidates by similarity |
| 43-62 | **Greedy selection loop** | Core algorithm |
| 47-52 | Quality calculation | For each candidate: `avgDiversity = ...` then `quality = similarityScore * avgDiversity` |
| 49-51 | First selection | `selected.length === 0 ? 1.0 : calculateAverageDiversity(...)` - first pick has no diversity penalty |
| 54-57 | Best selection | Track best quality score and index |
| 60-61 | Add to selected | `selected.push(pool[bestIdx])` then `pool.splice(bestIdx, 1)` - remove from pool |
| 77-92 | Weight explanation comment | Why 0.7/0.3 skill/domain weighting, why experience/timezone excluded |
| 93-127 | `calculateAverageDiversity()` | For each selected, compute `diversity = 1 - similarity` |
| 103-118 | Per-pair calculation | Calculate skill and domain similarity to each already-selected engineer |
| 121 | Combined similarity | `skillResult.score * 0.7 + domainResult.score * 0.3` |
| 122-123 | Diversity calculation | `diversity = 1 - combinedSimilarity` |
| 126 | Average | `totalDiversity / selected.length` |

**Key concept:** Diversity selection is greedy. Each iteration picks the candidate that maximizes `similarity × diversity_from_already_selected`.

---

## Summary: Complete Data Flow

```
POST /api/search/filter-similarity
│
├─ 1. validate(schema) middleware [zod-validate.middleware.ts:13-37]
│     └─ Parses body, validates, applies defaults, replaces req.body
│
├─ 2. filterSimilarity controller [filter-similarity.controller.ts:18-47]
│     └─ Creates session, delegates to service, handles errors, closes session
│
└─ 3. executeFilterSimilarity service [filter-similarity.service.ts:47-247]
      │
      ├─ [54-58] Load reference engineer (fail fast if not found)
      │
      ├─ [61-68] Resolve skills → IDs grouped by proficiency
      │
      ├─ [96-100] Expand constraints → inference rules, seniority→years
      │
      ├─ [103-112] Resolve domains → IDs with hierarchy expansion
      │
      ├─ [114-153] Build unified query with collectAllSkills=true
      │     └─ [search-query.builder.ts:53-133] Uses buildSearchQuery with options
      │     └─ Returns FULL engineer data (skills, domains) in one query
      │
      ├─ [159-165] Get constraint advice (relaxation/tightening)
      │
      ├─ [171-172] Load graphs (skill + domain relationships)
      │
      ├─ [179-190] Parse results into EngineerForSimilarity format
      │     └─ No separate loadEngineersById call - data already in query result
      │
      ├─ [193] Score by similarity [similarity-calculator.ts:27-36]
      │     └─ 4 dimensions, weighted sum
      │
      ├─ [199-201] Diversity selection [diversity-selector.ts:30-65]
      │     └─ Greedy: maximize similarity × diversity
      │
      ├─ [204] Paginate (offset/limit)
      │
      └─ [229-246] Build response with transparency fields
```

---

## Questions for Deeper Understanding

1. **Why is `referenceEngineerId` required but all constraints are optional?**
   - The endpoint's purpose is similarity to a reference. Without a reference, use `/filter` instead.

2. **Why load skill/domain graphs separately from engineer data?**
   - Graphs describe relationships between entities (skill X relates to skill Y). This is different from what skills an engineer has.

3. **Why apply diversity selection AFTER similarity scoring?**
   - You want diverse results from among the most similar candidates, not random diverse candidates.

4. **Why use a unified query builder with `collectAllSkills` option instead of separate queries?**
   - Eliminates code duplication between `/filter` and `/filter-similarity` endpoints.
   - Reduces database round-trips (one query instead of two).
   - Single source of truth for filtering logic prevents drift between endpoints.

5. **Why are `salary` and `startTimeline` optional in `EngineerForSimilarity`?**
   - They're not needed for similarity scoring, only for the response. Keeping them optional prevents breaking the scoring logic.

6. **Why does diversity selection use 0.7/0.3 skill/domain weighting?**
   - Matches the approximate ratio of main similarity weights (skills=0.45, domain=0.22 ≈ 2:1). Ensures consistency.

7. **Why use `COLLECT/COUNT/UNWIND` in the Cypher query?**
   - Gets total count for pagination while still returning individual rows for processing.

8. **Why extract domain filters and proficiency logic into shared functions?**
   - Single source of truth prevents bugs where changes in one place leave copies stale.
   - `buildSearchQuery` and `buildFilteredCandidatesQuery` both use the same logic for business/technical domain filters and proficiency qualification.
   - See `query-domain-filter.builder.ts` for domain filters and `buildProficiencyQualificationClause()` for proficiency logic.

---

## Related Resources

- Implementation Plan: `thoughts/shared/plans/2026-01-17-project-4-filter-similarity-endpoint.md`
- Project 3 Summary (similarity scoring): `thoughts/shared/1_chapter_5/3_project_3/`
- E2E Test Results: `thoughts/shared/1_chapter_5/4_project_4/test-results/`
- Chapter 5 Research: `thoughts/shared/1_chapter_5/4_project_4/research/`
