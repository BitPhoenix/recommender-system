# Project 4: Filter-Similarity (Hybrid Recommender)

**Status**: Complete
**Duration**: January 17-18, 2026
**Branch**: `project_4`
**Git Commit**: 211c68ea44ad182ff7af8b045554f4c12eb19763

---

## Executive Summary

Project 4 implements **hybrid knowledge-based recommendation** by combining constraint-based filtering (Section 5.2) with case-based similarity ranking (Section 5.3). This is the textbook's "combination of guidance forms" approach (p.170): users specify hard requirements AND provide a reference engineer, getting back candidates who meet the constraints ranked by how similar they are to the reference.

The implementation features:
1. **Constraint filtering**: Reuses the `/filter` endpoint's constraint expansion, inference engine, and query builder
2. **Similarity ranking**: Reuses Project 3's graph-aware scoring (skills 45%, experience 27%, domain 22%, timezone 6%)
3. **Unified query builder**: Refactored to eliminate duplication between endpoints with a `collectAllSkills` option
4. **Full transparency**: Returns applied filters, derived constraints, and score breakdowns

---

## Problem Statement

Projects 1-2 implemented constraint-based search (`/filter`): users specify requirements and preferences, the system ranks by utility. Project 3 implemented pure similarity search (`/engineers/:id/similar`): given an engineer, find similar ones. But users often have a different need:

> "I found Marcus (eng_marcus), he's perfect for this role. But he's not available. Find me more engineers like him who ALSO meet my hard requirements."

This requires combining both approaches: **filter first**, then **rank by similarity** to a reference engineer.

---

## Solution: Hybrid Filter + Similarity

### The Three Endpoints Mental Model

| What you have | What you want | Endpoint | Ranking |
|---------------|---------------|----------|---------|
| Requirements + **described preferences** | Engineers ranked by job fit | `/api/search/filter` | Utility (11 components) |
| Requirements + **reference engineer** | Engineers similar to reference | `/api/search/filter-similarity` | Similarity (4 components) |
| Just a **reference engineer** | Similar engineers (no constraints) | `/api/engineers/:id/similar` | Similarity (4 components) |

**Key insight**: The `preferred*` fields in `/filter` describe the ideal candidate (Textbook Approach #2: desired attribute values). The value of `/filter-similarity` is different: "Don't make me describe what I want—I found someone who IS what I want, find more like them" (Textbook Approach #1: existing item as reference).

### Why Two Approaches, Not One with Options

| Aspect | `/filter` (utility) | `/filter-similarity` (similarity) |
|--------|---------------------|-----------------------------------|
| Components | 11 weighted attributes | 4 attributes |
| Includes | Budget, timeline, confidence, team focus | Skills, experience, domain, timezone |
| Excludes | (nothing) | Timeline, salary, confidence |
| Rationale | Score how well engineer matches described job | Score how similar engineer is to reference |

Similarity scoring **intentionally excludes** transient factors:
- **Timeline**: Changes when projects end—not a capability attribute
- **Salary**: Budget constraint, not capability—ranking by salary would be unfair

---

## API Design

### Endpoint

```
POST /api/search/filter-similarity
```

### Request Schema

```typescript
{
  // Hard constraints - determines WHO qualifies (same as /filter)
  requiredSkills?: SkillRequirement[];
  requiredSeniorityLevel?: SeniorityLevel;
  requiredMaxStartTime?: StartTimeline;
  requiredTimezone?: USTimezoneZone[];
  maxBudget?: number;
  stretchBudget?: number;
  requiredBusinessDomains?: BusinessDomainRequirement[];
  requiredTechnicalDomains?: TechnicalDomainRequirement[];

  // Reference engineer - determines HOW to RANK qualified candidates
  referenceEngineerId: string;  // REQUIRED

  // Inference rule override
  overriddenRuleIds?: string[];  // Rule IDs to bypass

  // Pagination
  limit?: number;   // default 10, max 100
  offset?: number;  // default 0
}
```

**Key design choices**:
- No `preferred*` fields—those belong on `/filter` for utility scoring
- `referenceEngineerId` is required—this differentiates from `/filter`
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
  totalCount: number;

  // Transparency
  appliedFilters: AppliedFilter[];
  overriddenRuleIds: string[];
  derivedConstraints: DerivedConstraintInfo[];

  // Constraint advisor
  relaxation?: RelaxationResult;   // If < 3 results
  tightening?: TighteningResult;   // If >= 25 results

  // Execution metadata
  queryMetadata: {
    executionTimeMs: number;
    candidatesBeforeDiversity: number;
  };
}
```

---

## Implementation Architecture

### File Structure

```
recommender_api/src/
├── routes/search.routes.ts                    # Route definition (line 29)
├── controllers/filter-similarity.controller.ts # HTTP handler
├── schemas/filter-similarity.schema.ts        # Request validation (Zod)
├── types/filter-similarity.types.ts           # Response types
├── services/
│   ├── filter-similarity.service.ts           # Orchestration layer (main logic)
│   ├── cypher-query-builder/
│   │   ├── search-query.builder.ts            # Unified query builder with collectAllSkills option
│   │   └── query-types.ts                     # CypherQueryParams with excludeEngineerId
│   └── similarity-calculator/                 # Reused from Project 3
│       ├── similarity-calculator.ts           # Scoring logic
│       ├── diversity-selector.ts              # Bounded greedy selection
│       └── scoring/                           # Dimension scoring
└── config/knowledge-base/
    └── similarity.config.ts                   # Weights & parameters
```

### Data Flow

```
POST /api/search/filter-similarity
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│                  executeFilterSimilarity()                  │
│                                                            │
│  1. Load reference engineer (fail fast if not found)       │
│                                                            │
│  2. Resolve skills → IDs grouped by proficiency            │
│                                                            │
│  3. Expand constraints via inference engine                │
│     └─ "senior" → yearsExperience 6-10                    │
│     └─ Inference rules apply derived constraints           │
│                                                            │
│  4. Resolve domain constraints (hierarchy expansion)       │
│                                                            │
│  5. Build unified query with collectAllSkills=true         │
│     └─ Reuses buildSearchQuery from /filter               │
│     └─ Adds excludeEngineerId to exclude reference        │
│     └─ Returns FULL skill profiles for similarity         │
│                                                            │
│  6. Get constraint advice (relaxation/tightening)          │
│                                                            │
│  7. Load skill graph + domain graph                        │
│                                                            │
│  8. Parse query results → EngineerForSimilarity format     │
│                                                            │
│  9. Score candidates by similarity to reference            │
│     └─ Skills (0.45) + Experience (0.27) + Domain (0.22)  │
│       + Timezone (0.06)                                   │
│                                                            │
│  10. Apply diversity selection (bounded greedy)            │
│                                                            │
│  11. Apply pagination (offset/limit)                       │
│                                                            │
│  12. Build response with transparency fields               │
│                                                            │
└────────────────────────────────────────────────────────────┘
       │
       ▼
{
  referenceEngineer: {...},
  matches: [
    { engineer, similarityScore, breakdown, sharedSkills, correlatedSkills },
    ...
  ],
  appliedFilters: [...],
  derivedConstraints: [...],
  ...
}
```

---

## Key Design Decisions

### 1. `referenceEngineerId` Instead of `idealProfile` Object

**Decision**: Use a real engineer as the reference, not a constructed profile object.

**Rationale**:
- The `preferred*` fields in `/filter` already implement "described preferences" (Textbook Approach #2)
- Adding `idealProfile` would be redundant with `preferred*` fields
- `referenceEngineerId` matches real workflow: "I found Marcus, find more like him"
- Simpler API: one ID vs constructing an object with skills, experience, domains, timezone
- Uses real data: actual skill proficiencies, actual domain years, not synthetic values

### 2. No `preferred*` Fields

**Decision**: Only accept `required*` constraint fields, not preference fields.

**Rationale**: Clear separation of concerns:
- `/filter`: "How well does this engineer match my described requirements?" (utility)
- `/filter-similarity`: "How similar is this engineer to the one I already like?" (similarity)

Mixing would create confusion about what affects ranking.

### 3. Unified Query Builder with `collectAllSkills` Option

**Decision**: Refactor `buildSearchQuery` to support both `/filter` and `/filter-similarity` via an option, eliminating `buildFilteredCandidatesQuery`.

**Rationale**:
- Eliminates code duplication between endpoints
- Single source of truth for filtering logic
- Reduces database round-trips (one query returns full data)
- Clear documentation of why the option exists

**The Two Modes**:
- `collectAllSkills: false` (default, for `/filter`): Returns only skills matching the filter—"here's how they matched YOUR criteria"
- `collectAllSkills: true` (for `/filter-similarity`): Returns ALL skills—needed for similarity scoring which compares full profiles

### 4. Diversity Selection on Similarity Results

**Decision**: Apply bounded greedy diversity selection (same as `/engineers/:id/similar`).

**Rationale**: Section 5.3.1.1 (p.187) discusses preventing homogeneous results. Without diversity selection, "find engineers like Marcus (React/Node.js)" returns 5 nearly-identical React/Node.js engineers. Diversity ensures variety while maintaining similarity.

### 5. Exclude Reference Engineer from Results

**Decision**: Filter query includes `WHERE e.id <> $excludeEngineerId`.

**Rationale**: You can't ask "find engineers like Marcus" and get Marcus back in the results. The reference is the anchor, not a candidate.

---

## Textbook Alignment

### How This Design Maps to Chapter 5

The textbook (p.170) explicitly endorses hybrid approaches:

> "Some forms of guidance can be used with both constraint-based and case-based systems. Furthermore, different forms of guidance can also be used **in combination** in a knowledge-based system."

Our `/filter-similarity` endpoint is exactly this combination:
- **From Section 5.2**: Hard constraint filtering (`required*` fields)
- **From Section 5.3**: Similarity ranking to a target (`referenceEngineerId`)

### Two Target Specification Approaches (Section 5.3.1, p.181-182)

The textbook describes two ways to specify targets:
1. **Existing item as reference**: "Find houses like this one"
2. **Desired attribute values**: "3 bedrooms, $500k, suburban"

**Our implementation**:
| Approach | Textbook | Our Implementation |
|----------|----------|-------------------|
| #1: Existing item | "Find houses like this one" | `/filter-similarity` with `referenceEngineerId` |
| #2: Desired attributes | "3 bedrooms, $500k" | `/filter` with `preferred*` fields |

The `preferred*` fields ARE Approach #2—they describe what you want. An `idealProfile` object would be redundant.

### Complete Coverage of Section 5.3.1

| Endpoint | Target Specification | Constraints |
|----------|---------------------|-------------|
| `/api/engineers/:id/similar` | Real engineer (Approach #1) | None |
| `/api/search/filter` | Described preferences (Approach #2) | Yes (`required*`) |
| `/api/search/filter-similarity` | Real engineer (Approach #1) | Yes (`required*`) |

---

## Testing

### Unit Tests (31 tests added)

| Module | Tests | Coverage |
|--------|-------|----------|
| filter-similarity.schema.test.ts | 17 | Validation, refinements, defaults |
| filter-similarity.service.test.ts | 14 | Orchestration, error handling, response |

**Key test cases**:
- Required field validation (referenceEngineerId)
- stretchBudget refinement (requires maxBudget, must be >= maxBudget)
- EngineerNotFoundError for missing reference
- Graph loading for similarity calculation
- Filter query building and execution
- Diversity selection
- Pagination handling
- overriddenRuleIds echo

### E2E Tests (11 tests, 244 total assertions)

| Test # | Name | Key Verification |
|--------|------|------------------|
| 63 | Basic Request | Response structure, similarity ranking |
| 64 | Missing referenceEngineerId | 400 validation error |
| 65 | Non-existent Reference Engineer | 404 ENGINEER_NOT_FOUND |
| 66 | With Skill Constraints | Skill filter applied, results ranked |
| 67 | With Seniority Constraint | Experience filter applied (6-10 years) |
| 68 | With Timezone Constraint | Timezone filter enforced |
| 69 | Pagination | Limit respected, totalCount accurate |
| 70 | Reference Excluded | Reference engineer not in matches |
| 71 | Inference Rules Applied | derivedConstraints populated |
| 72 | Override Inference Rule | overriddenRuleIds echoed |
| 73 | Match Fields | salary and startTimeline present |

**All 73 requests and 244 assertions pass** (full test collection).

---

## Configuration Reference

**File**: `src/config/knowledge-base/similarity.config.ts`

| Parameter | Value | Description |
|-----------|-------|-------------|
| `skills` weight | 0.45 | Skill similarity contribution |
| `yearsExperience` weight | 0.27 | Experience similarity contribution |
| `domain` weight | 0.22 | Domain similarity contribution |
| `timezone` weight | 0.06 | Timezone similarity contribution |
| `experienceAlpha` | 0.5 | Asymmetry coefficient (tolerate overshoot) |
| `yearsExperienceMax` | 20 | Normalization cap for experience |
| `minCorrelationStrength` | 0.7 | Filter weak skill correlations |
| `diversityMultiplier` | 3 | Pool size = 3 × limit |
| `domainYearsMax` | 10 | Years normalization for domains |
| `domainYearsFloor` | 0.5 | Minimum years multiplier |

---

## Metrics

| Metric | Value |
|--------|-------|
| Research document | 1 (795 lines) |
| Implementation plan | 1 (951 lines) |
| Code walkthrough | 1 (495 lines) |
| Query builder refactoring plan | 1 (554 lines) |
| New service files | 4 |
| New type definitions | 6 |
| Lines of code (new) | ~600 |
| Unit tests | 31 |
| E2E scenarios | 11 |
| Total test assertions | 244 |

---

## What We're NOT Doing

Per plan scope:
- **Evidence weights**: Deferred to future project—core learning concepts don't require it
- **Combined utility+similarity score**: No blending—each endpoint has distinct purpose
- **idealProfile object**: Using real engineer reference only—simpler and matches real workflow
- **Changing `/filter` endpoint**: Additive feature, not modification

---

## Lessons Learned

1. **Hybrid approaches work well**: The textbook explicitly endorses combining constraint-based (5.2) and case-based (5.3) methods. Our implementation demonstrates this combination naturally maps to real-world use cases.

2. **Reuse pays off**: By reusing the existing constraint expander, query builder, inference engine, and similarity calculator, the new endpoint required minimal new code (~600 lines) while providing significant new functionality.

3. **Unified query builder eliminates drift**: The `collectAllSkills` option in `buildSearchQuery` ensures both endpoints share the same filtering logic, preventing bugs where changes in one place leave copies stale.

4. **One query beats two**: Refactoring to return full data in a single query (instead of IDs then data) improves performance and simplifies the service logic.

5. **Clear API boundaries matter**: By NOT mixing `preferred*` fields with similarity ranking, users understand exactly what affects their results: constraints filter, reference determines ranking.

---

## Future Considerations

1. **Evidence weighting**: Add weights for assessment scores, stories, certifications (mentioned in learning plan but deferred)
2. **Combined scoring**: `α × utility + (1-α) × similarity` for users who want both factors
3. **Team composition**: Given a team, find engineers who complement (not duplicate) existing skills
4. **Explanation generation**: "These engineers are similar to Marcus because they share React expertise and both have Fintech domain experience"

---

## References

- **Research**: `thoughts/shared/1_chapter_5/4_project_4/research/2026-01-17-project-4-combined-search-research.md`
- **Implementation Plan**: `thoughts/shared/1_chapter_5/4_project_4/plans/2026-01-17-project-4-filter-similarity-endpoint.md`
- **Code Walkthrough**: `thoughts/shared/1_chapter_5/4_project_4/plans/2026-01-17-project-4-code-walkthrough-plan.md`
- **Query Builder Refactoring Plan**: `thoughts/shared/1_chapter_5/4_project_4/plans/2026-01-18-unify-search-query-builder.md`
- **E2E Test Results**: `thoughts/shared/1_chapter_5/4_project_4/test-results/2026-01-17-filter-similarity-e2e-test-results.md`
- **Project 3 Summary**: `thoughts/shared/1_chapter_5/3_project_3/project_3_summary.md`
- **Textbook Sections**: 5.1 (p.170), 5.2, 5.3, 5.3.1 (p.181-187)
