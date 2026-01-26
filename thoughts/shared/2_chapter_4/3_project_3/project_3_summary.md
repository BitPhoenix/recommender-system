# Project 3: Job Description Similarity Search API

**Status**: Complete
**Duration**: January 26, 2026
**Branch**: `chapter-4-project-3`

---

## Executive Summary

Project 3 implements job-to-engineer matching, the core "find candidates for this job" functionality. Building on Project 1's content-based filtering and Project 2's job description infrastructure, this project delivers a multi-signal scoring API that ranks engineers for any job description using the Eightfold-inspired architecture.

Key capabilities delivered:

1. **Job Match API Endpoint**: `GET /api/job/:jobId/matches` returns ranked engineers
2. **Multi-Signal Scoring**: 8 independent signals combined with hand-tuned weights
3. **Two-Stage Retrieval**: Semantic search for candidate pool, then multi-signal re-ranking
4. **Explainability**: Score breakdown with all signals plus matching/missing skill lists
5. **Configurable Weights**: Cold-start weights with validation (must sum to 1.0)

---

## Problem Statement

### Problem 1: No Way to Find Engineers for a Job

Project 2 created job descriptions with skills, embeddings, and structured data. But there was no API to ask "which engineers match this job?"

### Problem 2: Single-Signal Ranking Was Insufficient

Pure embedding similarity captures semantic meaning but misses:
- Exact skill matches (does engineer have required skills?)
- Structured constraints (seniority, timezone, budget)
- Recency (recent skills matter more for fast-evolving technologies)

### Problem 3: No Explainability

Black-box matching provides no insight into why an engineer ranked high or low.

---

## Solution Overview

### Solution 1: Job Match API Endpoint

```
GET /api/job/:jobId/matches?limit=10&offset=0
```

Returns engineers ranked by multi-signal match score with full explainability.

### Solution 2: Eightfold-Inspired Multi-Signal Architecture

Compute 8 independent signals, each normalized 0-1, combined with configurable weights:

| Signal | Weight | Description |
|--------|--------|-------------|
| skillSimilarity | 0.25 | Embedding centroid comparison (job skills vs engineer skills) |
| requiredSkillCoverage | 0.20 | Fraction of required skills engineer possesses |
| semanticSimilarity | 0.20 | Job embedding vs engineer embedding similarity |
| seniorityMatch | 0.10 | Experience level alignment (exact=1.0, adjacent=0.5, far=0.0) |
| recentSkillSimilarity | 0.10 | Recency-weighted skill embedding similarity |
| preferredSkillCoverage | 0.05 | Fraction of preferred skills engineer possesses |
| timezoneMatch | 0.05 | Binary match against job's allowed timezones |
| budgetMatch | 0.05 | Salary within budget (graduated falloff in 20% stretch range) |

### Solution 3: Two-Stage Retrieval

1. **Stage 1**: Use job embedding to find ~3x candidates via HNSW vector search
2. **Stage 2**: Compute all 8 signals for each candidate
3. **Stage 3**: Re-rank by weighted composite score (better than embedding-only ranking)
4. **Stage 4**: Apply pagination and load engineer details

### Solution 4: Full Explainability

Each match includes:
- `scoreBreakdown`: All 8 signal values
- `matchingSkills`: Skill names engineer has that job requires/prefers
- `missingRequiredSkills`: Required skills engineer lacks
- `queryMetadata`: Execution time, candidates evaluated, weights used

---

## API Design

### Endpoint

```
GET /api/job/:jobId/matches
```

### Query Parameters

| Parameter | Type | Default | Constraints |
|-----------|------|---------|-------------|
| `limit` | integer | 10 | 1-100 |
| `offset` | integer | 0 | >= 0 |

### Response Schema

```typescript
{
  jobId: string;
  jobTitle: string;
  matches: Array<{
    id: string;
    name: string;
    headline: string;
    salary: number;
    yearsExperience: number;
    timezone: string;
    matchScore: number;  // 0-1, weighted combination
    scoreBreakdown: {
      semanticSimilarity: number;
      skillSimilarity: number;
      recentSkillSimilarity: number;
      requiredSkillCoverage: number;
      preferredSkillCoverage: number;
      seniorityMatch: number;
      timezoneMatch: number;
      budgetMatch: number;
      matchingSkills: string[];
      missingRequiredSkills: string[];
    };
  }>;
  totalCount: number;
  queryMetadata: {
    executionTimeMs: number;
    candidatesEvaluated: number;
    scoringWeights: Record<string, number>;
  };
}
```

### Error Responses

| Status | Error | When |
|--------|-------|------|
| 404 | NOT_FOUND | Job ID doesn't exist |
| 422 | UNPROCESSABLE_ENTITY | Job has no embedding |
| 400 | ZodError | Invalid query parameters |

---

## Implementation Architecture

### File Structure

```
recommender_api/src/
├── routes/
│   └── job.routes.ts                    # GET /:jobId/matches
├── controllers/
│   └── job-match.controller.ts          # Request handling, error mapping
├── schemas/
│   └── job-match.schema.ts              # Zod validation schemas
├── types/
│   └── job-match.types.ts               # TypeScript interfaces
├── config/
│   └── job-match-scoring.config.ts      # Scoring weights (sum to 1.0)
└── services/
    ├── job.service.ts                   # +loadJobWithSkills function
    ├── job-match/
    │   ├── job-match.service.ts         # Main orchestrator (4-stage pipeline)
    │   └── structured-signals.service.ts # Individual signal calculators
    └── content-search/
        └── embedding-index-manager.service.ts  # Renamed functions

postman/collections/
└── job-match-tests.postman_collection.json    # E2E test collection
```

### Data Flow

```
GET /api/job/job_senior_backend_fintech/matches
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        job.routes.ts                                 │
│  • Zod schema validation (limit, offset)                            │
│  • Routes to controller                                              │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   job-match.controller.ts                            │
│  • Extract jobId from params                                         │
│  • Call findEngineersForJob service                                 │
│  • Map errors to HTTP status codes                                   │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    job-match.service.ts                              │
│  Stage 1: Load job with skills and embeddings                       │
│  Stage 2: Find ~3x candidates by embedding similarity               │
│  Stage 3: Compute 8 signals for each candidate                      │
│  Stage 4: Re-rank, paginate, load engineer details                  │
└─────────────────────────────────────────────────────────────────────┘
       │
       ├──────────────────────────────────┐
       ▼                                  ▼
┌──────────────────────┐    ┌─────────────────────────────────────────┐
│  embedding-index-    │    │     structured-signals.service.ts        │
│  manager.service.ts  │    │  • calculateSeniorityMatch()             │
│  • findSimilarEngi-  │    │  • calculateTimezoneMatch()              │
│    neersByEmbedding  │    │  • calculateBudgetMatch()                │
└──────────────────────┘    │  • calculateSkillCoverage()              │
                            └─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Response                                    │
│  • jobId, jobTitle                                                   │
│  • matches[]: id, name, matchScore, scoreBreakdown                  │
│  • totalCount, queryMetadata                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Two-Stage Retrieval with Re-Ranking

**Decision**: Fetch 3x candidates via semantic search, then re-rank with full signal computation.

**Rationale**:
- Semantic search alone misses structured constraints
- Computing all signals for entire corpus is too expensive
- 3x padding ensures high-quality candidates aren't lost to initial ranking imprecision

### 2. Configurable Weights with Validation

**Decision**: Store weights in `job-match-scoring.config.ts` with validation that weights sum to 1.0.

**Rationale**:
- Cold-start weights are tunable based on feedback
- Validation prevents misconfiguration
- Weights can eventually be learned from interaction data

### 3. Seniority Distance Scoring

**Decision**: Use 3-level scoring (1.0 exact, 0.5 adjacent, 0.0 far) based on seniority ladder.

**Rationale**:
- Binary match is too harsh (senior engineer can do mid-level work)
- Adjacent levels are reasonable matches with some tradeoff
- Uses `getSeniorityLevelFromYears()` to derive seniority from experience

### 4. Budget Stretch Range

**Decision**: Allow 20% overage with graduated scoring (linear falloff from 1.0 to 0.0).

**Rationale**:
- Salary negotiations happen; rigid cutoffs lose good candidates
- 20% stretch is common budget flexibility
- Graduated scoring reflects "more expensive = less preferred"

### 5. Function Renaming for Clarity

**Decision**: Rename embedding functions to include "Engineer" (e.g., `findSimilarEngineersByEmbedding`).

**Rationale**:
- Previous generic names were confusing (what entity?)
- Makes code self-documenting
- Prepares for future job-to-job similarity

---

## Signal Computation Details

### Content-Based Signals (Embedding)

| Signal | Computation | Source |
|--------|-------------|--------|
| semanticSimilarity | Cosine similarity of job vs engineer embeddings | HNSW vector index |
| skillSimilarity | Centroid comparison of skill embedding sets | `computeSkillSetSimilarity()` |
| recentSkillSimilarity | Same as above, but only skills used within 3 years | Recency-weighted |

### Structured Signals (Exact/Logical)

| Signal | Computation | Edge Cases |
|--------|-------------|------------|
| requiredSkillCoverage | `matching / total required skills` | 1.0 if no requirements |
| preferredSkillCoverage | `matching / total preferred skills` | 1.0 if no preferences |
| seniorityMatch | Ladder distance (junior/mid/senior/staff/principal) | 0.0 for invalid seniority |
| timezoneMatch | `engineer.timezone in job.timezones` | 1.0 if no restriction |
| budgetMatch | `1.0 if salary <= max, else graduated falloff` | 1.0 if no budget |

---

## Testing

### Unit Tests

| Module | Tests | Coverage |
|--------|-------|----------|
| structured-signals.service.test.ts | 23 | Seniority, timezone, budget, skill coverage |

Key unit test scenarios:
- Exact seniority match (junior, mid, senior, staff)
- Adjacent seniority (0.5 score)
- Non-adjacent seniority (0.0 score)
- Timezone in/out of allowed list
- Budget within, in stretch range, and beyond
- Full, partial, and zero skill coverage

### Integration Tests

| Test File | Tests | Coverage |
|-----------|-------|----------|
| job-match.service.integration.test.ts | 10 | End-to-end with Neo4j |

Key integration test scenarios:
- Basic matching returns ranked results
- Results sorted by matchScore descending
- Pagination (first/second page, no overlap)
- 404 for non-existent job
- Score breakdown completeness (all 10 fields, 0-1 range)
- matchingSkills populated with skill names
- missingRequiredSkills when coverage < 1.0
- Different jobs return different rankings
- Query metadata includes timing and weights

### E2E Tests (Newman/Postman)

| Test | Status | Response Time | Key Verification |
|------|--------|---------------|------------------|
| Basic Match Success | PASS | 745ms | Response structure |
| Score Breakdown Structure | PASS | 450ms | All 10 fields present |
| Results Ordered by Score | PASS | 297ms | Descending sort |
| Pagination First Page | PASS | 294ms | Limit enforced |
| Pagination Second Page | PASS | 350ms | No overlap |
| Different Jobs Different Rankings | PASS | 630ms | Frontend vs backend |
| Query Metadata Present | PASS | 177ms | Timing and weights |
| 404 Not Found | PASS | 5ms | Error handling |
| Invalid Limit Parameter | PASS | 7ms | Validation |
| Invalid Offset Parameter | PASS | 3ms | Validation |

**Total: 10 tests, 29 assertions, all passing.**

---

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Initial match query | ~745ms | Cold: job loading + embedding lookup |
| Subsequent queries | ~300ms | Warm: cached embeddings |
| Full scoring (100 candidates) | ~587ms | 8 signals per candidate |
| Validation errors | ~5ms | Fast-fail before processing |
| 404 errors | ~5ms | Fast-fail on job lookup |

Bottleneck analysis:
- Signal computation is O(k) where k = candidates (100 in tests)
- HNSW search is O(log n) for corpus size n
- Skill embedding loading dominates candidate processing

---

## Scoring Behavior (E2E Results)

### Backend Job: `job_senior_backend_fintech`

| Rank | Engineer | Score | Key Factors |
|------|----------|-------|-------------|
| 1 | eng_priya | 0.929 | 100% required skills, fintech background |
| 2 | eng_ravi | 0.842 | Missing Kafka, strong TypeScript/Node.js |
| 3 | eng_alex | 0.798 | Staff-level, missing Node.js/TypeScript |
| 4 | eng_christine | 0.796 | Strong skills, timezone mismatch (Pacific) |
| 5 | eng_natasha | 0.794 | Missing Kafka, timezone mismatch |

### Frontend Job: `job_mid_frontend_saas`

| Rank | Engineer | Score | Key Factors |
|------|----------|-------|-------------|
| 1 | eng_emma | 0.949 | 100% required + preferred, design systems |
| 2 | eng_emily | 0.946 | 100% skills, React specialist |
| 3 | eng_ryan | 0.910 | Mobile/React crossover |
| 4 | eng_marcus | 0.908 | Full stack with React |
| 5 | eng_rachel | 0.888 | Frontend specialist |

The scoring correctly surfaces domain-relevant engineers based on skill overlap and semantic similarity.

### Score Breakdown Example

Top match for backend job (eng_priya):

| Component | Value | Weight | Contribution |
|-----------|-------|--------|--------------|
| skillSimilarity | 0.913 | 0.25 | 0.228 |
| semanticSimilarity | 0.922 | 0.20 | 0.184 |
| requiredSkillCoverage | 1.000 | 0.20 | 0.200 |
| recentSkillSimilarity | 0.913 | 0.10 | 0.091 |
| seniorityMatch | 1.000 | 0.10 | 0.100 |
| timezoneMatch | 1.000 | 0.05 | 0.050 |
| budgetMatch | 1.000 | 0.05 | 0.050 |
| preferredSkillCoverage | 0.500 | 0.05 | 0.025 |
| **Total** | | | **0.929** |

---

## MVP Simplifications (Future Enhancements)

Per the implementation plan, these were explicitly deferred:

1. **Skill proficiency matching**: Jobs have `minProficiency` but we don't check if engineer meets that level
2. **RELATED_TO skill edges**: Embedding similarity captures this implicitly; explicit edges would add asymmetric inference
3. **Years per skill**: `UserSkill.yearsUsed` could weight skill matches by depth
4. **Domain graph**: Business/technical domain relationships not used in scoring
5. **Company graph**: Engineer → Company relationships could signal fit
6. **Title similarity**: Engineers don't have structured "current title" for comparison

---

## Metrics

| Metric | Value |
|--------|-------|
| Implementation plans | 1 |
| New service files | 2 |
| New config files | 1 |
| New type files | 1 |
| New schema files | 1 |
| New controller files | 1 |
| New route files | 1 |
| Modified service files | 2 |
| Lines of code (new) | ~650 |
| Unit tests | 23 |
| Integration tests | 10 |
| E2E tests | 10 |
| Total test assertions | ~100 |

---

## Lessons Learned

1. **Two-stage retrieval enables precision**: Re-ranking after semantic search produces better results than embedding-only ranking.

2. **Configurable weights support iteration**: Hand-tuned weights work for cold-start; infrastructure supports future learning.

3. **Explainability requires forethought**: Including matching/missing skills in the response required planning the data flow early.

4. **Function naming matters**: Renaming `findSimilarByEmbedding` to `findSimilarEngineersByEmbedding` clarified the codebase.

5. **Budget stretch ranges are practical**: Real hiring has flexibility; graduated scoring reflects this reality.

---

## References

- **Implementation Plan**: `thoughts/shared/2_chapter_4/3_project_3/plans/2026-01-26-job-description-similarity-search.md`
- **E2E Test Results**: `thoughts/shared/2_chapter_4/3_project_3/test-results/2026-01-26-job-match-api-e2e-test-results.md`
- **Project 1 Summary**: `thoughts/shared/2_chapter_4/1_project_1/project_1_summary.md` (content-based filtering)
- **Project 2 Summary**: `thoughts/shared/2_chapter_4/2_project_2/project_2_summary.md` (job description infrastructure)
- **Architecture Reference**: `docs/learning_through_imitation/eightfold/content_similarity_architecture.md`
