# Job Description Similarity Search Implementation Plan

## Overview

Implement a new API endpoint that accepts a job description ID and returns a ranked list of engineers who match that job. The system computes multiple similarity signals (following Eightfold's architecture) and combines them with hand-tuned weights for a cold-start scoring model.

## Current State Analysis

### What Exists

**Job Description Infrastructure (Project 2)**:
- `JobDescription` nodes with embeddings (1024-dim, mxbai-embed-large)
- Skill relationships: `REQUIRES_SKILL`, `PREFERS_SKILL` with `minProficiency`
- Domain relationships: `REQUIRES_BUSINESS_DOMAIN`, `PREFERS_BUSINESS_DOMAIN`, `REQUIRES_TECHNICAL_DOMAIN`, `PREFERS_TECHNICAL_DOMAIN`
- Company relationship: `POSTED_BY`
- Properties: `seniority`, `minBudget`, `maxBudget`, `timezone[]`, `teamFocus`, `startTimeline`

**Content Search Infrastructure (Project 1)**:
- Engineer embeddings (1024-dim, mxbai-embed-large)
- Skill embeddings with centroid similarity (`skill-embedding-similarity.service.ts`)
- Recency-weighted skill similarity (skills used within 3 years)
- TF-IDF index for keyword matching and explainability
- HNSW vector index for O(log n) approximate nearest neighbor search

**Key Services**:
- `content-search.service.ts`: Embedding, TF-IDF, and hybrid search
- `candidate-skill-similarity.service.ts`: Skill similarity computation with caching
- `embedding-index-manager.service.ts`: Vector search via Neo4j HNSW
- `tfidf-vectorizer.service.ts`: Sparse vector operations
- `job.service.ts`: Job description persistence and queries

### Key Discoveries

1. **Skill centroids already work for job matching**: `computeSkillSetSimilarity()` computes centroid similarity between two skill sets - can be used for job required skills vs engineer skills.

2. **Job embeddings are stored**: Each job has an embedding generated from its description text, enabling semantic similarity search.

3. **Content search is query-agnostic**: `findSimilarByEmbedding()` accepts any embedding vector - can use job embedding to find similar engineers.

4. **Eightfold architecture applies**: Multiple signals combined with hand-tuned weights:
   - Dense embedding similarity (semantic)
   - Skill embedding similarity (technical fit)
   - Recency-weighted skill similarity
   - Title similarity (optional, future)
   - Structured feature matching (seniority, timezone, budget)

## Desired End State

### API Endpoint

```
GET /api/job/{jobId}/matches
```

**Query Parameters**:
- `limit` (optional, default 10, max 100): Number of results
- `offset` (optional, default 0): Pagination offset

**Response** (200 OK):
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
    matchScore: number;  // Combined weighted score (0-1)
    scoreBreakdown: {
      // Content similarity signals
      semanticSimilarity: number;      // Job embedding vs engineer embedding
      skillSimilarity: number;         // Job required skills centroid vs engineer skills centroid
      recentSkillSimilarity: number;   // Same but only skills used in last 3 years

      // Structured match signals
      requiredSkillCoverage: number;   // Fraction of required skills engineer has
      preferredSkillCoverage: number;  // Fraction of preferred skills engineer has
      seniorityMatch: number;          // 1.0 if matches, 0.5 if adjacent, 0 otherwise
      timezoneMatch: number;           // 1.0 if engineer's timezone in job's list
      budgetMatch: number;             // 1.0 if salary within budget, graduated otherwise

      // Explainability
      matchingSkills: string[];        // Skills engineer has that job requires/prefers
      missingRequiredSkills: string[]; // Required skills engineer lacks
    };
  }>;
  totalCount: number;
  queryMetadata: {
    executionTimeMs: number;
    candidatesEvaluated: number;
    scoringWeights: Record<string, number>;  // Echo weights used for transparency
  };
}
```

**Error Responses**:
- 404: Job not found
- 400: Invalid parameters

### Verification

1. **Manual**: Query with a known job ID and verify engineers are ranked appropriately
2. **E2E Tests**: Postman collection with test scenarios covering:
   - Basic matching returns ranked results
   - Score breakdown contains all signals
   - Missing required skills are identified
   - Pagination works correctly
   - 404 for non-existent job

## What We're NOT Doing

1. **Career trajectory prediction** (RNN-based): Requires training data we don't have
2. **Learned scoring weights**: Cold-start with hand-tuned weights; learning deferred
3. **Company similarity**: Not enough company embedding infrastructure yet
4. **Boolean filtering on required skills**: We'll score all engineers and let required skill coverage influence the score (more nuanced than hard filter)
5. **Domain matching in MVP**: Focus on skills first; domain matching can be added later
6. **Title similarity**: Engineers don't have "current title" in a way that matches job titles; defer to future

## MVP Simplifications

The current implementation uses simplified skill matching that doesn't fully leverage the rich graph relationships:

**What we implemented:**
- **Skill embedding centroid similarity**: Aggregate skill vectors compared via cosine similarity
- **Skill coverage via set intersection**: Jaccard-like matching on skill IDs (does engineer have skill X?)

**Graph relationships NOT yet leveraged:**
- **Skill proficiency levels**: Jobs specify `minProficiency` (e.g., "expert" in TypeScript) but we don't check if engineer meets that level
- **RELATED_TO skill edges**: Embedding similarity already captures much of this implicitly (React/Vue embeddings are close). Explicit edges would add value for: (a) asymmetric inference ("has Kubernetes → implies Docker" but not vice versa), (b) explainability, (c) curated certainty vs statistical co-occurrence. Lower priority than other gaps.
- **Years per skill**: `UserSkill.yearsUsed` could weight skill matches by depth of experience
- **Domain graph**: Business and technical domain relationships exist but aren't used in scoring
- **Company graph**: Engineers worked at companies with types/domains that could signal fit

**Rationale for MVP approach:**
- Cold-start: Need to validate basic matching quality before adding complexity
- Interpretability: Simple coverage scores are easy to explain ("has 3 of 4 required skills")
- Iteration path: Can add proficiency matching, related skill bonuses, and domain signals in future phases once we have feedback on baseline performance

## Implementation Approach

Follow the Eightfold multi-signal architecture:
1. Compute each similarity signal independently
2. Combine with configurable hand-tuned weights
3. Return individual scores for explainability

**Scoring Formula (Cold Start)**:
```
matchScore = Σ(weight[i] * signal[i]) for all signals

Initial weights:
  semanticSimilarity:       0.20  # Overall content fit
  skillSimilarity:          0.25  # Technical skill alignment
  recentSkillSimilarity:    0.10  # Recency bonus
  requiredSkillCoverage:    0.20  # Hard requirement coverage
  preferredSkillCoverage:   0.05  # Nice-to-have bonus
  seniorityMatch:           0.10  # Experience level fit
  timezoneMatch:            0.05  # Logistics
  budgetMatch:              0.05  # Affordability
```

These weights sum to 1.0 and can be adjusted based on feedback.

---

## Phase 0: Rename Embedding Functions for Clarity

### Overview

The `embedding-index-manager.service.ts` has inconsistent naming - some functions include "Engineer" in the name, others don't. Since these functions specifically query engineers, rename them for clarity before using them in job matching.

### Changes Required

**File**: `recommender_api/src/services/content-search/embedding-index-manager.service.ts` (modify)

Rename the following functions:

| Current Name | New Name |
|--------------|----------|
| `findSimilarByEmbedding` | `findSimilarEngineersByEmbedding` |
| `findSimilarByEmbeddingWithFilter` | `findSimilarEngineersByEmbeddingWithFilter` |
| `hasEmbedding` | `hasEngineerEmbedding` |

**Files to update imports** (find all usages and update):

```bash
# Find all files importing these functions
grep -r "findSimilarByEmbedding\|hasEmbedding" --include="*.ts" recommender_api/src
```

Update imports in all affected files.

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tests pass: `npm test`
- [x] No remaining references to old function names

---

## Phase 1: Job Matching Service Core

### Overview

Create the core service that computes all similarity signals for a job-engineer pair.

### Changes Required

#### 1. Job Match Types

**File**: `recommender_api/src/types/job-match.types.ts` (new)

```typescript
/*
 * Scoring weights for job-engineer matching.
 * Weights should sum to 1.0 for normalized scoring.
 */
export interface JobMatchScoringWeights {
  semanticSimilarity: number;
  skillSimilarity: number;
  recentSkillSimilarity: number;
  requiredSkillCoverage: number;
  preferredSkillCoverage: number;
  seniorityMatch: number;
  timezoneMatch: number;
  budgetMatch: number;
}

/*
 * Individual similarity signals computed for a job-engineer pair.
 */
export interface JobEngineerMatchSignals {
  // Content similarity (embedding-based)
  semanticSimilarity: number;
  skillSimilarity: number;
  recentSkillSimilarity: number;

  // Structured matching
  requiredSkillCoverage: number;
  preferredSkillCoverage: number;
  seniorityMatch: number;
  timezoneMatch: number;
  budgetMatch: number;

  // Explainability data (not used in scoring)
  matchingSkills: string[];
  missingRequiredSkills: string[];
}

/*
 * Complete match result for one engineer.
 */
export interface JobMatchResult {
  engineerId: string;
  matchScore: number;
  signals: JobEngineerMatchSignals;
}
```

#### 2. Job Match Scoring Configuration

**File**: `recommender_api/src/config/job-match-scoring.config.ts` (new)

```typescript
import type { JobMatchScoringWeights } from "../types/job-match.types.js";

/*
 * Default scoring weights for job-engineer matching.
 *
 * These are hand-tuned cold-start weights based on the Eightfold architecture.
 * They should sum to 1.0 for normalized scoring.
 *
 * Rationale:
 * - skillSimilarity (0.25): Technical fit is primary signal
 * - requiredSkillCoverage (0.20): Must-have skills are critical
 * - semanticSimilarity (0.20): Overall profile/experience alignment
 * - recentSkillSimilarity (0.10): Recency matters for rapidly evolving tech
 * - seniorityMatch (0.10): Experience level alignment
 * - preferredSkillCoverage (0.05): Nice-to-haves boost score
 * - timezoneMatch (0.05): Logistics/collaboration fit
 * - budgetMatch (0.05): Affordability consideration
 */
export const DEFAULT_JOB_MATCH_WEIGHTS: JobMatchScoringWeights = {
  semanticSimilarity: 0.20,
  skillSimilarity: 0.25,
  recentSkillSimilarity: 0.10,
  requiredSkillCoverage: 0.20,
  preferredSkillCoverage: 0.05,
  seniorityMatch: 0.10,
  timezoneMatch: 0.05,
  budgetMatch: 0.05,
};

/*
 * Validate that weights sum to 1.0 (within floating point tolerance).
 */
export function validateWeights(weights: JobMatchScoringWeights): boolean {
  const sum = Object.values(weights).reduce((acc, w) => acc + w, 0);
  return Math.abs(sum - 1.0) < 0.001;
}
```

#### 3. Add Query Function to Job Service

**File**: `recommender_api/src/services/job.service.ts` (modify)

Add a query function to load job data with skill relationships for matching. This keeps all job-related database operations in one service.

Add the `JobWithSkills` type and `loadJobWithSkills` function:

```typescript
// Add to types section at top of file (after imports)

export interface JobSkillRelationship {
  skillId: string;
  skillName: string;
  minProficiency: string | null;
  embedding: number[];
}

export interface JobWithSkills {
  id: string;
  title: string;
  description: string;
  embedding: number[];
  seniority: string;
  minBudget: number | null;
  maxBudget: number | null;
  timezone: string[];
  requiredSkills: JobSkillRelationship[];
  preferredSkills: JobSkillRelationship[];
}

// Add to QUERY FUNCTIONS section

/*
 * Load job description with skill relationships and embeddings.
 * Used for job-to-engineer matching where we need skill embeddings for similarity computation.
 */
export async function loadJobWithSkills(
  session: Session,
  jobId: string
): Promise<JobWithSkills | null> {
  const result = await session.run(`
    MATCH (j:JobDescription {id: $jobId})
    OPTIONAL MATCH (j)-[rr:REQUIRES_SKILL]->(rs:Skill)
    OPTIONAL MATCH (j)-[rp:PREFERS_SKILL]->(ps:Skill)
    RETURN j {
      .id, .title, .description, .embedding, .seniority,
      .minBudget, .maxBudget, .timezone
    } AS job,
    collect(DISTINCT CASE WHEN rs IS NOT NULL THEN {
      skillId: rs.id,
      skillName: rs.name,
      minProficiency: rr.minProficiency,
      embedding: rs.embedding
    } END) AS requiredSkills,
    collect(DISTINCT CASE WHEN ps IS NOT NULL THEN {
      skillId: ps.id,
      skillName: ps.name,
      minProficiency: rp.minProficiency,
      embedding: ps.embedding
    } END) AS preferredSkills
  `, { jobId });

  if (result.records.length === 0) {
    return null;
  }

  const record = result.records[0];
  const job = record.get("job");
  const requiredSkills = record.get("requiredSkills").filter(Boolean);
  const preferredSkills = record.get("preferredSkills").filter(Boolean);

  return {
    id: job.id,
    title: job.title,
    description: job.description,
    embedding: job.embedding,
    seniority: job.seniority,
    minBudget: job.minBudget,
    maxBudget: job.maxBudget,
    timezone: job.timezone ?? [],
    requiredSkills,
    preferredSkills,
  };
}
```

#### 4. Structured Signal Calculators

**File**: `recommender_api/src/services/job-match/structured-signals.service.ts` (new)

```typescript
import { getSeniorityLevelFromYears } from "../../config/knowledge-base/utility.config.js";
import { SENIORITY_LEVEL_ORDER, type SeniorityLevel } from "../../types/enums.types.js";

/*
 * Calculate seniority match score.
 * - 1.0 if exact match
 * - 0.5 if adjacent level (one step away)
 * - 0.0 if more than one level away
 */
export function calculateSeniorityMatch(
  jobSeniority: string,
  engineerYearsExperience: number
): number {
  // Determine engineer's implied seniority from years of experience
  const engineerSeniority = getSeniorityLevelFromYears(engineerYearsExperience);

  const jobIndex = SENIORITY_LEVEL_ORDER.indexOf(jobSeniority as SeniorityLevel);
  const engineerIndex = SENIORITY_LEVEL_ORDER.indexOf(engineerSeniority);

  if (jobIndex === -1 || engineerIndex === -1) {
    return 0;
  }

  const distance = Math.abs(jobIndex - engineerIndex);

  if (distance === 0) return 1.0;
  if (distance === 1) return 0.5;
  return 0.0;
}

/*
 * Calculate timezone match score.
 * - 1.0 if engineer's timezone is in job's allowed list
 * - 0.0 otherwise
 */
export function calculateTimezoneMatch(
  jobTimezones: string[],
  engineerTimezone: string
): number {
  if (jobTimezones.length === 0) {
    // No timezone restriction
    return 1.0;
  }
  return jobTimezones.includes(engineerTimezone) ? 1.0 : 0.0;
}

/*
 * Calculate budget match score.
 * - 1.0 if salary <= maxBudget
 * - Graduated score if within stretch range
 * - 0.0 if significantly over budget
 */
export function calculateBudgetMatch(
  jobMinBudget: number | null,
  jobMaxBudget: number | null,
  engineerSalary: number
): number {
  if (jobMaxBudget === null) {
    // No budget constraint
    return 1.0;
  }

  if (engineerSalary <= jobMaxBudget) {
    return 1.0;
  }

  // Allow 20% stretch range with graduated scoring
  const stretchLimit = jobMaxBudget * 1.2;
  if (engineerSalary <= stretchLimit) {
    // Linear interpolation from 1.0 at maxBudget to 0.0 at stretchLimit
    const overageRatio = (engineerSalary - jobMaxBudget) / (stretchLimit - jobMaxBudget);
    return 1.0 - overageRatio;
  }

  return 0.0;
}

/*
 * Calculate skill coverage - what fraction of job skills the engineer has.
 * Returns { coverage, matchingSkills, missingSkills }.
 */
export function calculateSkillCoverage(
  jobSkillIds: string[],
  engineerSkillIds: Set<string>
): {
  coverage: number;
  matchingSkillIds: string[];
  missingSkillIds: string[];
} {
  if (jobSkillIds.length === 0) {
    return { coverage: 1.0, matchingSkillIds: [], missingSkillIds: [] };
  }

  const matchingSkillIds: string[] = [];
  const missingSkillIds: string[] = [];

  for (const skillId of jobSkillIds) {
    if (engineerSkillIds.has(skillId)) {
      matchingSkillIds.push(skillId);
    } else {
      missingSkillIds.push(skillId);
    }
  }

  const coverage = matchingSkillIds.length / jobSkillIds.length;
  return { coverage, matchingSkillIds, missingSkillIds };
}
```

#### 5. Job Match Service (Main Orchestrator)

**File**: `recommender_api/src/services/job-match/job-match.service.ts` (new)

```typescript
import { Session } from "neo4j-driver";
import { loadJobWithSkills, type JobWithSkills } from "../job.service.js";
import {
  calculateSeniorityMatch,
  calculateTimezoneMatch,
  calculateBudgetMatch,
  calculateSkillCoverage,
} from "./structured-signals.service.js";
import { findSimilarEngineersByEmbedding } from "../content-search/embedding-index-manager.service.js";
import { computeSkillSetSimilarity } from "../content-search/skill-embedding-similarity.service.js";
import { loadEngineerSkillsWithRecency } from "../content-search/candidate-skill-similarity.service.js";
import { loadEngineerInfo } from "../engineer.service.js";
import { DEFAULT_JOB_MATCH_WEIGHTS } from "../../config/job-match-scoring.config.js";
import type {
  JobMatchScoringWeights,
  JobEngineerMatchSignals,
  JobMatchResult,
} from "../../types/job-match.types.js";
import type { SkillWithEmbedding } from "../content-search/skill-embedding-similarity.types.js";

interface JobMatchRequest {
  jobId: string;
  limit: number;
  offset: number;
  weights?: JobMatchScoringWeights;
}

interface JobMatchResponse {
  jobId: string;
  jobTitle: string;
  matches: Array<{
    id: string;
    name: string;
    headline: string;
    salary: number;
    yearsExperience: number;
    timezone: string;
    matchScore: number;
    scoreBreakdown: JobEngineerMatchSignals;
  }>;
  totalCount: number;
  queryMetadata: {
    executionTimeMs: number;
    candidatesEvaluated: number;
    scoringWeights: JobMatchScoringWeights;
  };
}

/*
 * Find engineers matching a job description.
 *
 * Uses multi-signal scoring following Eightfold architecture:
 * 1. Semantic similarity (job embedding vs engineer embedding)
 * 2. Skill embedding similarity (centroids)
 * 3. Recency-weighted skill similarity
 * 4. Structured feature matching (skills, seniority, timezone, budget)
 */
export async function findEngineersForJob(
  session: Session,
  request: JobMatchRequest
): Promise<JobMatchResponse> {
  const startTime = Date.now();
  const weights = request.weights ?? DEFAULT_JOB_MATCH_WEIGHTS;

  // Load job data
  const jobData = await loadJobWithSkills(session, request.jobId);
  if (!jobData) {
    throw new Error(`Job not found: ${request.jobId}`);
  }

  if (!jobData.embedding) {
    throw new Error(`Job has no embedding: ${request.jobId}`);
  }

  // Stage 1: Find candidate engineers by semantic similarity
  // Fetch more than needed for re-ranking after computing all signals
  const candidatePoolSize = Math.max((request.limit + request.offset) * 3, 100);
  const candidateEngineers = await findSimilarEngineersByEmbedding(
    session,
    jobData.embedding,
    candidatePoolSize
  );

  // Stage 2: Compute all signals for each candidate
  const matchResults: JobMatchResult[] = [];

  for (const candidateEngineer of candidateEngineers) {
    const signals = await computeJobEngineerMatchSignals(
      session,
      jobData,
      candidateEngineer.engineerId,
      candidateEngineer.score
    );

    // Compute weighted score
    const matchScore = computeWeightedScore(signals, weights);

    matchResults.push({
      engineerId: candidateEngineer.engineerId,
      matchScore,
      signals,
    });
  }

  // Stage 3: Sort by match score and apply pagination
  matchResults.sort((a, b) => b.matchScore - a.matchScore);
  const totalCount = matchResults.length;
  const paginatedResults = matchResults.slice(
    request.offset,
    request.offset + request.limit
  );

  // Stage 4: Load engineer details for results
  const engineerIds = paginatedResults.map(r => r.engineerId);
  const engineerInfoMap = await loadEngineerInfo(session, engineerIds);

  // Build response
  const matches = paginatedResults
    .filter(result => engineerInfoMap.has(result.engineerId))
    .map(result => {
      const engineer = engineerInfoMap.get(result.engineerId)!;
      return {
        id: engineer.id,
        name: engineer.name,
        headline: engineer.headline,
        salary: engineer.salary,
        yearsExperience: engineer.yearsExperience,
        timezone: engineer.timezone,
        matchScore: result.matchScore,
        scoreBreakdown: result.signals,
      };
    });

  return {
    jobId: jobData.id,
    jobTitle: jobData.title,
    matches,
    totalCount,
    queryMetadata: {
      executionTimeMs: Date.now() - startTime,
      candidatesEvaluated: candidateEngineers.length,
      scoringWeights: weights,
    },
  };
}

/*
 * Compute all similarity signals for one engineer.
 */
async function computeJobEngineerMatchSignals(
  session: Session,
  jobData: JobWithSkills,
  engineerId: string,
  semanticSimilarity: number
): Promise<JobEngineerMatchSignals> {
  // Load engineer's skills with recency data
  const engineerSkills = await loadEngineerSkillsWithRecency(session, engineerId);

  // Load basic engineer info for structured matching
  const engineerInfoMap = await loadEngineerInfo(session, [engineerId]);
  const engineerInfo = engineerInfoMap.get(engineerId);

  // Prepare job skill embeddings for centroid comparison
  const jobRequiredSkillEmbeddings: SkillWithEmbedding[] = jobData.requiredSkills
    .filter(s => s.embedding)
    .map(s => ({
      skillId: s.skillId,
      skillName: s.skillName,
      embedding: s.embedding,
    }));

  // Compute skill embedding similarity (centroid comparison)
  let skillSimilarity = 0;
  let recentSkillSimilarity = 0;

  if (jobRequiredSkillEmbeddings.length > 0 && engineerSkills.length > 0) {
    const skillSetSimilarity = computeSkillSetSimilarity(
      engineerSkills,
      jobRequiredSkillEmbeddings
    );
    skillSimilarity = skillSetSimilarity.skills.score;
    recentSkillSimilarity = skillSetSimilarity.recentSkills.score;
  }

  // Compute skill coverage (exact matches)
  const engineerSkillIds = new Set(engineerSkills.map(s => s.skillId));
  const requiredCoverage = calculateSkillCoverage(
    jobData.requiredSkills.map(s => s.skillId),
    engineerSkillIds
  );
  const preferredCoverage = calculateSkillCoverage(
    jobData.preferredSkills.map(s => s.skillId),
    engineerSkillIds
  );

  // Get skill names for explainability
  const skillIdToName = new Map<string, string>();
  for (const skill of [...jobData.requiredSkills, ...jobData.preferredSkills]) {
    skillIdToName.set(skill.skillId, skill.skillName);
  }

  const matchingSkills = [
    ...requiredCoverage.matchingSkillIds,
    ...preferredCoverage.matchingSkillIds,
  ].map(id => skillIdToName.get(id) ?? id);

  const missingRequiredSkills = requiredCoverage.missingSkillIds
    .map(id => skillIdToName.get(id) ?? id);

  // Compute structured signals
  const seniorityMatch = engineerInfo
    ? calculateSeniorityMatch(jobData.seniority, engineerInfo.yearsExperience)
    : 0;

  const timezoneMatch = engineerInfo
    ? calculateTimezoneMatch(jobData.timezone, engineerInfo.timezone)
    : 0;

  const budgetMatch = engineerInfo
    ? calculateBudgetMatch(jobData.minBudget, jobData.maxBudget, engineerInfo.salary)
    : 0;

  return {
    semanticSimilarity,
    skillSimilarity,
    recentSkillSimilarity,
    requiredSkillCoverage: requiredCoverage.coverage,
    preferredSkillCoverage: preferredCoverage.coverage,
    seniorityMatch,
    timezoneMatch,
    budgetMatch,
    matchingSkills,
    missingRequiredSkills,
  };
}

/*
 * Compute weighted score from signals.
 */
function computeWeightedScore(
  signals: JobEngineerMatchSignals,
  weights: JobMatchScoringWeights
): number {
  return (
    weights.semanticSimilarity * signals.semanticSimilarity +
    weights.skillSimilarity * signals.skillSimilarity +
    weights.recentSkillSimilarity * signals.recentSkillSimilarity +
    weights.requiredSkillCoverage * signals.requiredSkillCoverage +
    weights.preferredSkillCoverage * signals.preferredSkillCoverage +
    weights.seniorityMatch * signals.seniorityMatch +
    weights.timezoneMatch * signals.timezoneMatch +
    weights.budgetMatch * signals.budgetMatch
  );
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test`
- [x] Linting passes: `npm run lint` (no lint script configured)

#### Manual Verification
- [x] None for this phase (internal service only)

**Implementation Note**: This phase creates the core matching logic. The service is not yet exposed via API.

---

## Phase 2: API Endpoint

### Overview

Create the REST endpoint and controller to expose job matching functionality.

### Changes Required

#### 1. Request/Response Schemas

**File**: `recommender_api/src/schemas/job-match.schema.ts` (new)

```typescript
import { z } from "zod";
import type { JobEngineerMatchSignals } from "../types/job-match.types.js";

export const JobMatchRequestSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type JobMatchRequest = z.infer<typeof JobMatchRequestSchema>;

export interface JobMatchResponseMatch {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  timezone: string;
  matchScore: number;
  scoreBreakdown: JobEngineerMatchSignals;
}

export interface JobMatchResponse {
  jobId: string;
  jobTitle: string;
  matches: JobMatchResponseMatch[];
  totalCount: number;
  queryMetadata: {
    executionTimeMs: number;
    candidatesEvaluated: number;
    scoringWeights: Record<string, number>;
  };
}
```

#### 2. Controller

**File**: `recommender_api/src/controllers/job-match.controller.ts` (new)

```typescript
import { Request, Response } from "express";
import { getSession } from "../db/neo4j.js";
import { findEngineersForJob } from "../services/job-match/job-match.service.js";
import type { JobMatchRequest } from "../schemas/job-match.schema.js";

export async function getJobMatches(req: Request, res: Response): Promise<void> {
  const session = getSession();

  try {
    const jobId = req.params.jobId;
    const query = req.query as unknown as JobMatchRequest;

    const result = await findEngineersForJob(session, {
      jobId,
      limit: query.limit,
      offset: query.offset,
    });

    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("not found")) {
      res.status(404).json({
        error: "NOT_FOUND",
        message: `Job not found: ${req.params.jobId}`,
      });
      return;
    }

    if (message.includes("no embedding")) {
      res.status(422).json({
        error: "UNPROCESSABLE_ENTITY",
        message: "Job has no embedding. Re-upload to generate embedding.",
      });
      return;
    }

    console.error("Job match error:", error);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to find matching engineers",
    });
  } finally {
    await session.close();
  }
}
```

#### 3. Routes

**File**: `recommender_api/src/routes/job.routes.ts` (new)

```typescript
import { Router } from "express";
import { getJobMatches } from "../controllers/job-match.controller.js";
import { zodValidate } from "../middleware/zod-validate.middleware.js";
import { JobMatchRequestSchema } from "../schemas/job-match.schema.js";

const router = Router();

/*
 * GET /api/job/:jobId/matches
 *
 * Find engineers matching a job.
 * Returns ranked list with multi-signal scoring and explainability.
 */
router.get(
  "/:jobId/matches",
  zodValidate(JobMatchRequestSchema, "query"),
  getJobMatches
);

export default router;
```

#### 4. Register Routes

**File**: `recommender_api/src/app.ts` (modify)

Add the new routes:

```typescript
import jobRoutes from "./routes/job.routes.js";

// ... existing route registrations ...

app.use("/api/job", jobRoutes);
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test`
- [x] Linting passes: `npm run lint` (no lint script)
- [ ] Integration tests pass (added in next phase)

---

## Phase 3: Testing

### Overview

Add unit tests, integration tests, and E2E tests for the job matching feature.

### Changes Required

#### 1. Unit Tests

**File**: `recommender_api/src/services/job-match/__tests__/structured-signals.service.test.ts` (new)

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateSeniorityMatch,
  calculateTimezoneMatch,
  calculateBudgetMatch,
  calculateSkillCoverage,
} from "../structured-signals.service.js";

describe("structured-signals.service", () => {
  describe("calculateSeniorityMatch", () => {
    it("returns 1.0 for exact match", () => {
      expect(calculateSeniorityMatch("senior", 7)).toBe(1.0); // 7 years = senior
    });

    it("returns 0.5 for adjacent level", () => {
      expect(calculateSeniorityMatch("senior", 4)).toBe(0.5); // 4 years = mid, adjacent to senior
    });

    it("returns 0.0 for non-adjacent levels", () => {
      expect(calculateSeniorityMatch("staff", 2)).toBe(0.0); // 2 years = junior, far from staff
    });
  });

  describe("calculateTimezoneMatch", () => {
    it("returns 1.0 when engineer timezone is in job list", () => {
      expect(calculateTimezoneMatch(["Eastern", "Central"], "Eastern")).toBe(1.0);
    });

    it("returns 0.0 when engineer timezone not in job list", () => {
      expect(calculateTimezoneMatch(["Eastern", "Central"], "Pacific")).toBe(0.0);
    });

    it("returns 1.0 when job has no timezone restriction", () => {
      expect(calculateTimezoneMatch([], "Pacific")).toBe(1.0);
    });
  });

  describe("calculateBudgetMatch", () => {
    it("returns 1.0 when salary within budget", () => {
      expect(calculateBudgetMatch(100000, 150000, 140000)).toBe(1.0);
    });

    it("returns graduated score within stretch range", () => {
      // 160000 is 106.7% of 150000 (within 20% stretch)
      const score = calculateBudgetMatch(100000, 150000, 160000);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it("returns 0.0 when salary exceeds stretch range", () => {
      // 200000 is 133% of 150000 (beyond 20% stretch)
      expect(calculateBudgetMatch(100000, 150000, 200000)).toBe(0.0);
    });

    it("returns 1.0 when no budget constraint", () => {
      expect(calculateBudgetMatch(null, null, 500000)).toBe(1.0);
    });
  });

  describe("calculateSkillCoverage", () => {
    it("returns 1.0 when engineer has all job skills", () => {
      const result = calculateSkillCoverage(
        ["skill_react", "skill_typescript"],
        new Set(["skill_react", "skill_typescript", "skill_nodejs"])
      );
      expect(result.coverage).toBe(1.0);
      expect(result.matchingSkillIds).toEqual(["skill_react", "skill_typescript"]);
      expect(result.missingSkillIds).toEqual([]);
    });

    it("returns partial coverage when engineer missing some skills", () => {
      const result = calculateSkillCoverage(
        ["skill_react", "skill_typescript", "skill_graphql"],
        new Set(["skill_react", "skill_nodejs"])
      );
      expect(result.coverage).toBeCloseTo(1/3);
      expect(result.matchingSkillIds).toEqual(["skill_react"]);
      expect(result.missingSkillIds).toEqual(["skill_typescript", "skill_graphql"]);
    });

    it("returns 1.0 when job has no skill requirements", () => {
      const result = calculateSkillCoverage([], new Set(["skill_react"]));
      expect(result.coverage).toBe(1.0);
    });
  });
});
```

#### 2. Integration Tests

**File**: `recommender_api/src/services/job-match/__tests__/job-match.service.integration.test.ts` (new)

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSession, closeDriver } from "../../../db/neo4j.js";
import { findEngineersForJob } from "../job-match.service.js";
import type { Session } from "neo4j-driver";

describe("job-match.service integration", () => {
  let session: Session;

  beforeAll(() => {
    session = getSession();
  });

  afterAll(async () => {
    await session.close();
    await closeDriver();
  });

  it("finds matching engineers for a seeded job", async () => {
    const result = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 10,
      offset: 0,
    });

    expect(result.jobId).toBe("job_senior_backend_fintech");
    expect(result.jobTitle).toContain("Backend");
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.length).toBeLessThanOrEqual(10);

    // Verify score breakdown structure
    const firstMatch = result.matches[0];
    expect(firstMatch.matchScore).toBeGreaterThan(0);
    expect(firstMatch.matchScore).toBeLessThanOrEqual(1);
    expect(firstMatch.scoreBreakdown).toHaveProperty("semanticSimilarity");
    expect(firstMatch.scoreBreakdown).toHaveProperty("skillSimilarity");
    expect(firstMatch.scoreBreakdown).toHaveProperty("requiredSkillCoverage");
    expect(firstMatch.scoreBreakdown).toHaveProperty("matchingSkills");
  });

  it("returns results sorted by match score descending", async () => {
    const result = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 20,
      offset: 0,
    });

    for (let i = 1; i < result.matches.length; i++) {
      expect(result.matches[i].matchScore).toBeLessThanOrEqual(
        result.matches[i - 1].matchScore
      );
    }
  });

  it("respects pagination", async () => {
    const firstPage = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 5,
      offset: 0,
    });

    const secondPage = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 5,
      offset: 5,
    });

    expect(firstPage.matches.length).toBe(5);
    expect(secondPage.matches.length).toBeGreaterThan(0);

    // No overlap between pages
    const firstPageIds = new Set(firstPage.matches.map(m => m.id));
    for (const match of secondPage.matches) {
      expect(firstPageIds.has(match.id)).toBe(false);
    }
  });

  it("throws error for non-existent job", async () => {
    await expect(
      findEngineersForJob(session, {
        jobId: "job_nonexistent",
        limit: 10,
        offset: 0,
      })
    ).rejects.toThrow("Job not found");
  });

  it("returns score breakdown with all required fields", async () => {
    const result = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 5,
      offset: 0,
    });

    const breakdown = result.matches[0].scoreBreakdown;

    // All numeric signals should be between 0 and 1
    expect(breakdown.semanticSimilarity).toBeGreaterThanOrEqual(0);
    expect(breakdown.semanticSimilarity).toBeLessThanOrEqual(1);
    expect(breakdown.skillSimilarity).toBeGreaterThanOrEqual(0);
    expect(breakdown.skillSimilarity).toBeLessThanOrEqual(1);
    expect(breakdown.recentSkillSimilarity).toBeGreaterThanOrEqual(0);
    expect(breakdown.recentSkillSimilarity).toBeLessThanOrEqual(1);
    expect(breakdown.requiredSkillCoverage).toBeGreaterThanOrEqual(0);
    expect(breakdown.requiredSkillCoverage).toBeLessThanOrEqual(1);
    expect(breakdown.preferredSkillCoverage).toBeGreaterThanOrEqual(0);
    expect(breakdown.preferredSkillCoverage).toBeLessThanOrEqual(1);
    expect(breakdown.seniorityMatch).toBeGreaterThanOrEqual(0);
    expect(breakdown.seniorityMatch).toBeLessThanOrEqual(1);
    expect(breakdown.timezoneMatch).toBeGreaterThanOrEqual(0);
    expect(breakdown.timezoneMatch).toBeLessThanOrEqual(1);
    expect(breakdown.budgetMatch).toBeGreaterThanOrEqual(0);
    expect(breakdown.budgetMatch).toBeLessThanOrEqual(1);

    // Explainability arrays should be present
    expect(Array.isArray(breakdown.matchingSkills)).toBe(true);
    expect(Array.isArray(breakdown.missingRequiredSkills)).toBe(true);
  });

  it("populates matchingSkills with skills engineer has", async () => {
    const result = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 10,
      offset: 0,
    });

    // At least one engineer should have some matching skills
    const engineerWithMatchingSkills = result.matches.find(
      m => m.scoreBreakdown.matchingSkills.length > 0
    );
    expect(engineerWithMatchingSkills).toBeDefined();

    // Matching skills should be strings (skill names)
    for (const skill of engineerWithMatchingSkills!.scoreBreakdown.matchingSkills) {
      expect(typeof skill).toBe("string");
      expect(skill.length).toBeGreaterThan(0);
    }
  });

  it("populates missingRequiredSkills correctly", async () => {
    const result = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 10,
      offset: 0,
    });

    // Engineers with requiredSkillCoverage < 1.0 should have missing skills
    for (const match of result.matches) {
      if (match.scoreBreakdown.requiredSkillCoverage < 1.0) {
        expect(match.scoreBreakdown.missingRequiredSkills.length).toBeGreaterThan(0);
      }
    }
  });

  it("returns different results for different job types", async () => {
    // This test assumes we have jobs with different requirements seeded
    const backendJob = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 10,
      offset: 0,
    });

    const frontendJob = await findEngineersForJob(session, {
      jobId: "job_mid_frontend_ecommerce",
      limit: 10,
      offset: 0,
    });

    // Top matches should differ between different job types
    const backendTopIds = new Set(backendJob.matches.slice(0, 3).map(m => m.id));
    const frontendTopIds = new Set(frontendJob.matches.slice(0, 3).map(m => m.id));

    // At least some difference in top 3 (not all the same)
    const overlap = [...backendTopIds].filter(id => frontendTopIds.has(id));
    expect(overlap.length).toBeLessThan(3);
  });

  it("includes query metadata with execution time and weights", async () => {
    const result = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 10,
      offset: 0,
    });

    expect(result.queryMetadata.executionTimeMs).toBeGreaterThan(0);
    expect(result.queryMetadata.candidatesEvaluated).toBeGreaterThan(0);
    expect(result.queryMetadata.scoringWeights).toBeDefined();
    expect(result.queryMetadata.scoringWeights.skillSimilarity).toBe(0.25);
  });
});
```

#### 3. E2E Tests (Postman Collection)

**File**: `postman/collections/job-match-tests.postman_collection.json` (new)

Add a new Postman collection with comprehensive tests:

**Happy Path Tests:**

1. **Basic Match Success**: `GET /api/job-description/job_senior_backend_fintech/matches`
   - Status 200
   - Response has `jobId`, `jobTitle`, `matches`, `totalCount`, `queryMetadata`
   - `matches` is non-empty array
   - Each match has `id`, `name`, `matchScore`, `scoreBreakdown`

2. **Score Breakdown Structure**: Verify all score breakdown fields
   - `semanticSimilarity`, `skillSimilarity`, `recentSkillSimilarity` present and 0-1
   - `requiredSkillCoverage`, `preferredSkillCoverage` present and 0-1
   - `seniorityMatch`, `timezoneMatch`, `budgetMatch` present and 0-1
   - `matchingSkills` and `missingRequiredSkills` are arrays

3. **Results Ordered by Score**: Verify `matches[i].matchScore >= matches[i+1].matchScore`

4. **Pagination - First Page**: `GET /api/job-description/job_senior_backend_fintech/matches?limit=5&offset=0`
   - Returns exactly 5 matches (or less if fewer available)

5. **Pagination - Second Page**: `GET /api/job-description/job_senior_backend_fintech/matches?limit=5&offset=5`
   - Returns different engineers than first page

6. **Different Job Types Return Different Rankings**:
   - Compare top results for backend vs frontend jobs
   - Top matches should differ

7. **Query Metadata Present**:
   - `executionTimeMs` is positive number
   - `candidatesEvaluated` is positive number
   - `scoringWeights` contains expected keys

**Error Cases:**

8. **404 Not Found**: `GET /api/job-description/nonexistent_job_id/matches`
   - Status 404
   - Response has `error: "NOT_FOUND"`

9. **Invalid Limit Parameter**: `GET /api/job-description/job_senior_backend_fintech/matches?limit=999`
   - Status 400 (exceeds max of 100)

10. **Invalid Offset Parameter**: `GET /api/job-description/job_senior_backend_fintech/matches?offset=-1`
    - Status 400

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test`
- [x] Integration tests pass: `npm test`
- [x] E2E tests pass: `npm run test:e2e` (29 assertions pass)
- [x] Linting passes: `npm run lint` (no lint script configured)

---

## Phase 4: Skill Similarity Enhancement

### Overview

The current skill similarity uses engineer-to-engineer centroid comparison. We need to adapt it for job-to-engineer comparison where the job has required skills (not a full skill profile).

### Changes Required

#### 1. Export loadEngineerSkillsWithRecency

**File**: `recommender_api/src/services/content-search/candidate-skill-similarity.service.ts` (modify)

The function `loadEngineerSkillsWithRecency` is currently internal. Export it for use in job matching:

```typescript
// Change from:
async function loadEngineerSkillsWithRecency(...)

// To:
export async function loadEngineerSkillsWithRecency(...)
```

#### 2. Verify computeSkillSetSimilarity Works for Job Skills

The existing `computeSkillSetSimilarity` in `skill-embedding-similarity.service.ts` takes:
- `sourceSkills: SkillWithRecency[]` (engineer's skills)
- `targetSkills: SkillWithEmbedding[]` (comparison target)

For job matching, we pass:
- Engineer skills (with recency) as source
- Job required skills (with embeddings, no recency needed) as target

This should work as-is since `targetSkills` only needs `skillId`, `skillName`, and `embedding`.

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] Existing tests still pass: `npm test`
- [x] No breaking changes to existing functionality

Note: The function `loadEngineerSkillsWithEmbeddings` is already exported from `skill-embedding-loader.service.ts` and returns `SkillWithRecency[]`. No changes needed.

---

## Testing Strategy

All verification is automated. No manual testing required.

### Unit Tests

| Module | Tests | Key Coverage |
|--------|-------|--------------|
| structured-signals.service.test.ts | ~12 | Seniority, timezone, budget, skill coverage calculations |
| job-match.service.test.ts | ~8 | Weighted scoring, signal combination |

### Integration Tests

| Test File | Scenarios | Key Coverage |
|-----------|-----------|--------------|
| job-match.service.integration.test.ts | ~10 | End-to-end matching with real Neo4j data |

Key integration test coverage:
- Basic matching returns ranked results
- Results sorted by match score descending
- Pagination (first page, second page, no overlap)
- 404 for non-existent job
- Score breakdown with all fields in valid ranges (0-1)
- `matchingSkills` populated correctly
- `missingRequiredSkills` populated when coverage < 1.0
- Different job types return different rankings
- Query metadata includes execution time and weights

### E2E Tests (Postman/Newman)

| Collection | Requests | Key Coverage |
|------------|----------|--------------|
| job-match-tests.postman_collection.json | ~10 | Full API contract validation |

Key E2E test coverage:
- HTTP 200 with correct response structure
- Score breakdown structure validation
- Results ordering verification
- Pagination behavior
- Different jobs return different results
- HTTP 404 for non-existent job
- HTTP 400 for invalid parameters

---

## Performance Considerations

1. **Semantic search is O(log n)**: Using Neo4j HNSW index, finding similar engineers is fast regardless of corpus size.

2. **Signal computation is O(k)**: For each of k candidate engineers, we compute ~8 signals. With k=100 candidates, this is acceptable.

3. **Potential optimization**: Cache job data (skills with embeddings) if the same job is queried frequently. Currently not implemented as premature optimization.

4. **Skill similarity reuses cache**: The `candidate-skill-similarity.service.ts` caches engineer skills, so repeated queries for the same engineers are fast.

---

## References

- **Architecture Reference**: `docs/learning_through_imitation/eightfold/content_similarity_architecture.md`
- **Project 1 Summary**: `thoughts/shared/2_chapter_4/1_project_1/project_1_summary.md`
- **Project 2 Summary**: `thoughts/shared/2_chapter_4/2_project_2/project_2_summary.md`
- **Reusable Components Research**: `thoughts/shared/2_chapter_4/1_project_1/research/2026-01-23-job-description-matching-reusable-components.md`
- **Skill Embedding Similarity**: `recommender_api/src/services/content-search/skill-embedding-similarity.service.ts`
- **Content Search Service**: `recommender_api/src/services/content-search/content-search.service.ts`
