# Project 3: Similarity Scoring - Implementation Plan

## Overview

Implement case-based similarity scoring for engineers via `GET /api/engineers/:id/similar`. This complements the existing constraint-based search (Projects 1-2) by finding engineers similar to a reference engineer rather than matching against explicit requirements. Based on textbook Section 5.3.1 and the research document at `thoughts/shared/research/2026-01-16-project-3-similarity-scoring.md`.

## Current State Analysis

**Existing architecture supports this well:**
- `utility-calculator/` module provides a template for the parallel `similarity-calculator/` module
- Skill graph has rich relationships: 41 CHILD_OF, 69 CORRELATES_WITH, 130+ BELONGS_TO
- Domain hierarchies exist: 23 CHILD_OF + 2 ENCOMPASSES relationships
- Service patterns (route → controller → service → Neo4j) are well-established

**Key differences from utility scoring:**
| Aspect | Utility Calculator | Similarity Calculator |
|--------|-------------------|----------------------|
| Input | Engineer + Requirements | Engineer + Engineer |
| Purpose | Rank against user preferences | Find similar candidates |
| Skills | Match against requirement list | Overlap + hierarchy + correlations |
| Asymmetry | N/A | Experience: more_is_better (α=0.5) |

### Key Discoveries:
- `utility-calculator/utility-calculator.ts:44-46` - Weight application pattern with 3-decimal rounding
- `skill-resolver.service.ts:105-132` - CHILD_OF/BELONGS_TO traversal patterns for skills
- `domain-resolver.service.ts:27-147` - Domain hierarchy expansion with CHILD_OF/ENCOMPASSES
- `seeds/skills.ts:197-270` - CORRELATES_WITH relationships with strength values
- `config/knowledge-base/index.ts` - Pattern for adding new config exports

## Desired End State

**Endpoint**: `GET /api/engineers/:id/similar?limit=5`

**Response structure:**
```typescript
{
  target: EngineerSummary,
  similar: Array<{
    engineer: EngineerSummary,
    similarityScore: number,        // 0-1
    breakdown: {
      skills: number,               // 0-1
      yearsExperience: number,      // 0-1
      domain: number,               // 0-1
      timezone: number,             // 0-1
    },
    sharedSkills: string[],
    correlatedSkills: Array<{
      targetSkill: string,
      candidateSkill: string,
      strength: number,
    }>,
  }>
}
```

**Verification:**
- `npm run typecheck` passes
- `npm test` passes with new unit tests achieving >80% coverage of similarity-calculator
- `npm run test:e2e` passes with new Postman tests for the endpoint
- Manual verification: `curl localhost:4025/api/engineers/eng_priya/similar` returns valid response

## What We're NOT Doing

1. **Timeline similarity** - Excluded per research (transient property, not capability attribute)
2. **Salary similarity** - Excluded for fairness (handled by budget filter in search)
3. **Configurable parameters** - No request params for α, diversity, correlation threshold; baked-in defaults only
4. **Proficiency-weighted skill similarity** - Phase 1 uses skill presence; proficiency weighting is a Phase 2 enhancement
5. **Confidence-weighted skill similarity** - Same as above; Phase 2 enhancement

## Implementation Approach

Create a parallel `similarity-calculator/` module mirroring `utility-calculator/` structure. Implement graph-aware similarity using best-match approach for skills and domains. Apply bounded greedy diversity selection to results.

**Weights (research-derived):**
```typescript
skills: 0.45,           // Primary differentiator
yearsExperience: 0.27,  // Seniority matters
domain: 0.22,           // Industry/technical context
timezone: 0.06,         // Geographic proximity (minor)
```

---

## Phase 1: Configuration & Types

### Overview
Define similarity-specific configuration and types in the knowledge-base.

### Changes Required:

#### 1. Create similarity configuration
**File**: `recommender_api/src/config/knowledge-base/similarity.config.ts`
**Changes**: New file with similarity weights and parameters

```typescript
/**
 * Similarity Function Configuration (Section 5.3.1)
 *
 * Weights for Similarity(T, X) = Σ w_i · Sim(t_i, x_i) / Σ w_i
 * Weights sum to 1.0 for normalized scoring.
 */

export interface SimilarityWeights {
  skills: number;
  yearsExperience: number;
  domain: number;
  timezone: number;
}

export interface SimilarityParams {
  /* Experience asymmetry: more_is_better coefficient (0-1) */
  experienceAlpha: number;
  /* Maximum years for normalization */
  yearsExperienceMax: number;
  /* Minimum correlation strength to consider */
  minCorrelationStrength: number;
  /* Diversity multiplier for bounded greedy selection */
  diversityMultiplier: number;
  /* Domain years normalization factor */
  domainYearsMax: number;
  /* Domain years similarity floor (prevents years from dominating) */
  domainYearsFloor: number;
}

export const similarityWeights: SimilarityWeights = {
  skills: 0.45,           // Primary differentiator
  yearsExperience: 0.27,  // Seniority matters for replacement
  domain: 0.22,           // Industry/technical context
  timezone: 0.06,         // Geographic proximity (minor factor)
};

export const similarityParams: SimilarityParams = {
  experienceAlpha: 0.5,       // Tolerate overshoot, penalize undershoot
  yearsExperienceMax: 20,
  minCorrelationStrength: 0.7,  // Filter weak correlations
  diversityMultiplier: 3,       // Pool = 3 × limit for diversity selection
  domainYearsMax: 10,
  domainYearsFloor: 0.5,        // Years can reduce score by at most 50%
};
```

#### 2. Export from knowledge-base index
**File**: `recommender_api/src/config/knowledge-base/index.ts`
**Changes**: Add import and export for similarity config

```typescript
// Add import after utility.config.js import
import {
  similarityWeights,
  similarityParams,
} from './similarity.config.js';

// Add to re-exports
export {
  similarityWeights,
  similarityParams,
};
```

#### 3. Define similarity calculator types
**File**: `recommender_api/src/services/similarity-calculator/types.ts`
**Changes**: New file with type definitions

```typescript
/**
 * Similarity Calculator Types
 * Type definitions for engineer-to-engineer similarity scoring.
 */

// ============================================
// PUBLIC API TYPES
// ============================================

export interface EngineerForSimilarity {
  id: string;
  name: string;
  headline: string;
  yearsExperience: number;
  timezone: string;
  skills: EngineerSkill[];
  businessDomains: DomainExperience[];
  technicalDomains: DomainExperience[];
}

export interface EngineerSkill {
  skillId: string;
  skillName: string;
  proficiencyLevel: string;
  confidenceScore: number;
}

export interface DomainExperience {
  domainId: string;
  domainName: string;
  years: number;
}

export interface SimilarityBreakdown {
  skills: number;
  yearsExperience: number;
  domain: number;
  timezone: number;
}

export interface CorrelatedSkillPair {
  targetSkill: string;
  candidateSkill: string;
  strength: number;
}

export interface SimilarityResult {
  engineer: EngineerForSimilarity;
  similarityScore: number;
  breakdown: SimilarityBreakdown;
  sharedSkills: string[];
  correlatedSkills: CorrelatedSkillPair[];
}

export interface SimilarEngineersResponse {
  target: EngineerForSimilarity;
  similar: SimilarityResult[];
}

// ============================================
// INTERNAL TYPES (used by scoring modules)
// ============================================

export interface SkillSimilarityResult {
  score: number;
  sharedSkillIds: string[];
  correlatedPairs: CorrelatedSkillPair[];
}

export interface DomainSimilarityResult {
  score: number;
}

export interface ExperienceSimilarityResult {
  score: number;
}

export interface TimezoneSimilarityResult {
  score: number;
}

// Graph data structures for in-memory traversal
export interface SkillCorrelation {
  toSkillId: string;
  strength: number;
  correlationType: string;
}

export interface SkillGraphNode {
  skillId: string;
  categoryId: string | null;
  parentId: string | null;
  correlations: SkillCorrelation[];
}

export interface SkillGraph {
  nodes: Map<string, SkillGraphNode>;
}

export interface DomainGraphNode {
  domainId: string;
  parentId: string | null;
  encompassedBy: string[];  // For technical domains (Full Stack encompasses Backend)
}

export interface DomainGraph {
  businessDomains: Map<string, DomainGraphNode>;
  technicalDomains: Map<string, DomainGraphNode>;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] No lint errors: `npm run lint` (no lint script in project)
- [x] Imports resolve correctly when used in Phase 2

#### Manual Verification:
- [ ] Config values match research document recommendations

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Scoring Functions

### Overview
Implement individual similarity scoring functions for each attribute.

### Changes Required:

#### 1. Skill similarity scoring
**File**: `recommender_api/src/services/similarity-calculator/scoring/skill-similarity.ts`
**Changes**: New file implementing graph-aware skill similarity

Key algorithm (from research):
1. For each target skill, find best match in candidate skills using `computeSkillToSkillSimilarity()`
2. Priority: exact match (1.0) → CORRELATES_WITH (strength) → same category (0.5) → share parent (0.3) → unrelated (0.0)
3. Average best matches from target → candidate
4. Average best matches from candidate → target
5. Return symmetric average

```typescript
/**
 * Skill Similarity Scoring
 *
 * Uses symmetric best-match approach with graph relationships.
 * Similarity priority: exact > correlation > category > parent > none
 */

import type {
  EngineerSkill,
  SkillGraph,
  SkillSimilarityResult,
  CorrelatedSkillPair,
} from '../types.js';
import { similarityParams } from '../../../config/knowledge-base/similarity.config.js';

export function calculateSkillSimilarity(
  skillGraph: SkillGraph,
  targetSkills: EngineerSkill[],
  candidateSkills: EngineerSkill[]
): SkillSimilarityResult {
  // Implementation follows research document algorithm
}

function computeBestMatchAverage(
  skillGraph: SkillGraph,
  sourceSkills: EngineerSkill[],
  targetSkills: EngineerSkill[]
): number {
  // For each source skill, find best match in target skills
}

function computeSkillToSkillSimilarity(
  skillGraph: SkillGraph,
  skillA: string,
  skillB: string
): number {
  // Priority: exact (1.0) → correlation → category (0.5) → parent (0.3) → 0
}
```

#### 2. Experience similarity scoring
**File**: `recommender_api/src/services/similarity-calculator/scoring/experience-similarity.ts`
**Changes**: New file implementing asymmetric experience similarity

```typescript
/**
 * Experience Similarity Scoring
 *
 * Asymmetric: more experience is acceptable (α=0.5 reduces penalty),
 * less experience gets full penalty.
 */

import type { ExperienceSimilarityResult } from '../types.js';
import { similarityParams } from '../../../config/knowledge-base/similarity.config.js';

export function calculateExperienceSimilarity(
  targetYears: number,
  candidateYears: number
): ExperienceSimilarityResult {
  const { yearsExperienceMax, experienceAlpha } = similarityParams;

  const diff = candidateYears - targetYears;
  const normalizedDiff = Math.abs(diff) / yearsExperienceMax;

  let score: number;
  if (diff > 0) {
    // Candidate has more experience: reduce penalty by α
    score = Math.max(0, 1 - (normalizedDiff * (1 - experienceAlpha)));
  } else {
    // Candidate has less experience: full penalty
    score = Math.max(0, 1 - normalizedDiff);
  }

  return { score };
}
```

#### 3. Domain similarity scoring
**File**: `recommender_api/src/services/similarity-calculator/scoring/domain-similarity.ts`
**Changes**: New file implementing hierarchy-aware domain similarity

Key algorithm:
1. Best-match approach (same as skills)
2. Priority: exact (1.0) → siblings (0.5) → parent-child (0.4) → encompasses (0.4) → unrelated (0.0)
3. Years similarity multiplier with 0.5 floor
4. Symmetric average of both directions

```typescript
/**
 * Domain Similarity Scoring
 *
 * Uses symmetric best-match approach with domain hierarchies.
 * Combines business and technical domains.
 */

import type {
  DomainExperience,
  DomainGraph,
  DomainSimilarityResult,
} from '../types.js';
import { similarityParams } from '../../../config/knowledge-base/similarity.config.js';

export function calculateDomainSimilarity(
  domainGraph: DomainGraph,
  targetDomains: DomainExperience[],
  candidateDomains: DomainExperience[]
): DomainSimilarityResult {
  // Combine business + technical domains
  // Apply best-match with hierarchy
  // Factor in years similarity with floor
}
```

#### 4. Timezone similarity scoring
**File**: `recommender_api/src/services/similarity-calculator/scoring/timezone-similarity.ts`
**Changes**: New file implementing position-based timezone similarity

```typescript
/**
 * Timezone Similarity Scoring
 *
 * Position-based: closer timezones = higher similarity.
 */

import type { TimezoneSimilarityResult } from '../types.js';
import { usTimezoneZones } from '../../../config/knowledge-base/compatibility-constraints.config.js';

export function calculateTimezoneSimilarity(
  targetTimezone: string,
  candidateTimezone: string
): TimezoneSimilarityResult {
  const zones = usTimezoneZones; // ['Eastern', 'Central', 'Mountain', 'Pacific']
  const targetIdx = zones.indexOf(targetTimezone);
  const candidateIdx = zones.indexOf(candidateTimezone);

  if (targetIdx === -1 || candidateIdx === -1) {
    return { score: 0 };
  }

  const maxDist = zones.length - 1;
  const distance = Math.abs(targetIdx - candidateIdx);

  return { score: 1 - (distance / maxDist) };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [ ] Unit tests for each scoring function pass
- [ ] Test coverage >80% for scoring modules

#### Manual Verification:
- [ ] Scoring functions produce expected values for test cases from research doc

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

## Phase 3: Graph Loading & Main Calculator

### Overview
Implement graph loading from Neo4j and the main similarity calculator orchestration.

### Changes Required:

#### 1. Graph loader service
**File**: `recommender_api/src/services/similarity-calculator/graph-loader.ts`
**Changes**: New file for loading skill and domain graphs from Neo4j

```typescript
/**
 * Graph Loader
 *
 * Loads skill and domain graphs from Neo4j for in-memory traversal.
 */

import type { Session } from 'neo4j-driver';
import type { SkillGraph, DomainGraph } from './types.js';
import { similarityParams } from '../../config/knowledge-base/similarity.config.js';

export async function loadSkillGraph(session: Session): Promise<SkillGraph> {
  // Load skills with CORRELATES_WITH, BELONGS_TO (→SkillCategory), CHILD_OF
  // Filter correlations by minCorrelationStrength
}

export async function loadDomainGraph(session: Session): Promise<DomainGraph> {
  // Load BusinessDomain and TechnicalDomain nodes
  // Include CHILD_OF and ENCOMPASSES relationships
}
```

Cypher for skill graph:
```cypher
/*
 * Note: CORRELATES_WITH uses undirected pattern matching (s)-[c]-(other)
 * because correlations are stored unidirectionally in seeds but should
 * be treated as bidirectional for similarity (TypeScript ↔ JavaScript).
 */
MATCH (s:Skill)
OPTIONAL MATCH (s)-[:BELONGS_TO]->(cat:SkillCategory)
OPTIONAL MATCH (s)-[:CHILD_OF]->(parent:Skill)
OPTIONAL MATCH (s)-[c:CORRELATES_WITH]-(other:Skill)
WHERE c.strength >= $minStrength
RETURN s.id AS skillId,
       cat.id AS categoryId,
       parent.id AS parentId,
       COLLECT(DISTINCT {toSkillId: other.id, strength: c.strength, type: c.correlationType}) AS correlations
```

#### 2. Main similarity calculator
**File**: `recommender_api/src/services/similarity-calculator/similarity-calculator.ts`
**Changes**: New file with main orchestration logic

```typescript
/**
 * Similarity Calculator
 *
 * Main orchestration for engineer-to-engineer similarity scoring.
 * Implements Equation 5.2: Similarity(T, X) = Σ w_i · Sim(t_i, x_i) / Σ w_i
 */

import type {
  EngineerForSimilarity,
  SimilarityResult,
  SkillGraph,
  DomainGraph,
} from './types.js';
import { similarityWeights } from '../../config/knowledge-base/similarity.config.js';
import { calculateSkillSimilarity } from './scoring/skill-similarity.js';
import { calculateExperienceSimilarity } from './scoring/experience-similarity.js';
import { calculateDomainSimilarity } from './scoring/domain-similarity.js';
import { calculateTimezoneSimilarity } from './scoring/timezone-similarity.js';

function calculateWeighted(raw: number, weight: number): number {
  return Math.round(raw * weight * 1000) / 1000;
}

export function calculateSimilarityWithBreakdown(
  skillGraph: SkillGraph,
  domainGraph: DomainGraph,
  target: EngineerForSimilarity,
  candidate: EngineerForSimilarity
): SimilarityResult {
  const weights = similarityWeights;

  // Calculate individual similarities
  const skillResult = calculateSkillSimilarity(skillGraph, target.skills, candidate.skills);
  const experienceResult = calculateExperienceSimilarity(target.yearsExperience, candidate.yearsExperience);
  const domainResult = calculateDomainSimilarity(
    domainGraph,
    [...target.businessDomains, ...target.technicalDomains],
    [...candidate.businessDomains, ...candidate.technicalDomains]
  );
  const timezoneResult = calculateTimezoneSimilarity(target.timezone, candidate.timezone);

  // Apply weights
  const weightedSkills = calculateWeighted(skillResult.score, weights.skills);
  const weightedExperience = calculateWeighted(experienceResult.score, weights.yearsExperience);
  const weightedDomain = calculateWeighted(domainResult.score, weights.domain);
  const weightedTimezone = calculateWeighted(timezoneResult.score, weights.timezone);

  const totalScore = Math.round(
    (weightedSkills + weightedExperience + weightedDomain + weightedTimezone) * 100
  ) / 100;

  return {
    engineer: candidate,
    similarityScore: totalScore,
    breakdown: {
      skills: skillResult.score,
      yearsExperience: experienceResult.score,
      domain: domainResult.score,
      timezone: timezoneResult.score,
    },
    sharedSkills: skillResult.sharedSkillIds,
    correlatedSkills: skillResult.correlatedPairs,
  };
}

export function scoreAndSortCandidates(
  skillGraph: SkillGraph,
  domainGraph: DomainGraph,
  target: EngineerForSimilarity,
  candidates: EngineerForSimilarity[]
): SimilarityResult[] {
  return candidates
    .map(candidate => calculateSimilarityWithBreakdown(skillGraph, domainGraph, target, candidate))
    .sort((a, b) => b.similarityScore - a.similarityScore);
}
```

#### 3. Diversity selection
**File**: `recommender_api/src/services/similarity-calculator/diversity-selector.ts`
**Changes**: New file implementing bounded greedy diversity selection

```typescript
/**
 * Diversity Selector
 *
 * Implements bounded greedy selection (Section 5.3.1.1).
 * Quality(X) = Similarity(target, X) × D_avg(X, selected)
 */

import type { SimilarityResult, SkillGraph, DomainGraph } from './types.js';
import { similarityParams } from '../../config/knowledge-base/similarity.config.js';

export function selectDiverseResults(
  skillGraph: SkillGraph,
  domainGraph: DomainGraph,
  candidates: SimilarityResult[],
  targetCount: number
): SimilarityResult[] {
  const { diversityMultiplier } = similarityParams;
  const poolSize = targetCount * diversityMultiplier;

  // Take top poolSize candidates
  const pool = candidates.slice(0, poolSize);
  const selected: SimilarityResult[] = [];

  while (selected.length < targetCount && pool.length > 0) {
    let bestIdx = 0;
    let bestQuality = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const avgDiversity = selected.length === 0
        ? 1.0
        : calculateAverageDiversity(skillGraph, domainGraph, candidate, selected);
      const quality = candidate.similarityScore * avgDiversity;

      if (quality > bestQuality) {
        bestQuality = quality;
        bestIdx = i;
      }
    }

    selected.push(pool[bestIdx]);
    pool.splice(bestIdx, 1);
  }

  return selected;
}

function calculateAverageDiversity(
  skillGraph: SkillGraph,
  domainGraph: DomainGraph,
  candidate: SimilarityResult,
  selected: SimilarityResult[]
): number {
  // Calculate 1 - similarity between candidate and each selected
  // Return average
}
```

#### 4. Module index
**File**: `recommender_api/src/services/similarity-calculator/index.ts`
**Changes**: New file exporting public API

```typescript
/**
 * Similarity Calculator Module
 * Exports the public API for engineer-to-engineer similarity scoring.
 */

export type {
  EngineerForSimilarity,
  SimilarityResult,
  SimilarityBreakdown,
  SimilarEngineersResponse,
  CorrelatedSkillPair,
} from './types.js';

export {
  calculateSimilarityWithBreakdown,
  scoreAndSortCandidates,
} from './similarity-calculator.js';

export { selectDiverseResults } from './diversity-selector.js';
export { loadSkillGraph, loadDomainGraph } from './graph-loader.js';
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [ ] Unit tests for calculator pass
- [ ] Integration test: similarity of engineer to self ≈ 1.0

#### Manual Verification:
- [ ] Graph loading completes in <500ms for current data set

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 4.

---

## Phase 4: Service Layer

### Overview
Create the service that orchestrates Neo4j queries and similarity calculation.

### Changes Required:

#### 1. Similarity service
**File**: `recommender_api/src/services/similarity.service.ts`
**Changes**: New file with main service function

```typescript
/**
 * Similarity Service
 *
 * Orchestrates finding similar engineers for a given target.
 */

import type { Session } from 'neo4j-driver';
import type { SimilarEngineersResponse, EngineerForSimilarity } from './similarity-calculator/index.js';
import {
  loadSkillGraph,
  loadDomainGraph,
  scoreAndSortCandidates,
  selectDiverseResults,
} from './similarity-calculator/index.js';

export async function findSimilarEngineers(
  session: Session,
  targetEngineerId: string,
  limit: number = 5
): Promise<SimilarEngineersResponse> {
  const startTime = Date.now();

  /*
   * Load graphs sequentially - Neo4j sessions are not thread-safe.
   * See: conflict-stats.service.ts:24-29, search.service.ts:76-77
   * For production, consider caching these graphs with TTL since
   * skill/domain hierarchies change infrequently.
   */
  const skillGraph = await loadSkillGraph(session);
  const domainGraph = await loadDomainGraph(session);

  // Load target engineer
  const target = await loadEngineerData(session, targetEngineerId);
  if (!target) {
    throw new Error(`Engineer not found: ${targetEngineerId}`);
  }

  // Load all other engineers
  const candidates = await loadAllEngineersExcept(session, targetEngineerId);

  // Score and sort
  const scored = scoreAndSortCandidates(skillGraph, domainGraph, target, candidates);

  // Apply diversity selection
  const diverse = selectDiverseResults(skillGraph, domainGraph, scored, limit);

  console.log(`findSimilarEngineers completed in ${Date.now() - startTime}ms`);

  return {
    target,
    similar: diverse,
  };
}

async function loadEngineerData(
  session: Session,
  engineerId: string
): Promise<EngineerForSimilarity | null> {
  // Cypher query to load engineer with skills and domains
}

async function loadAllEngineersExcept(
  session: Session,
  excludeId: string
): Promise<EngineerForSimilarity[]> {
  // Cypher query to load all other engineers
}
```

Cypher for loading engineer data:
```cypher
MATCH (e:Engineer {id: $engineerId})
OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
OPTIONAL MATCH (e)-[bdExp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
OPTIONAL MATCH (e)-[tdExp:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
RETURN e.id AS id, e.name AS name, e.headline AS headline,
       e.yearsExperience AS yearsExperience, e.timezone AS timezone,
       COLLECT(DISTINCT {
         skillId: s.id,
         skillName: s.name,
         proficiencyLevel: us.proficiencyLevel,
         confidenceScore: us.confidenceScore
       }) AS skills,
       COLLECT(DISTINCT {domainId: bd.id, domainName: bd.name, years: bdExp.years}) AS businessDomains,
       COLLECT(DISTINCT {domainId: td.id, domainName: td.name, years: tdExp.years}) AS technicalDomains
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [ ] Integration tests pass
- [ ] Service handles non-existent engineer ID gracefully

#### Manual Verification:
- [ ] Service completes in <2s for 40 engineers

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 5.

---

## Phase 5: API Layer

### Overview
Add route, controller, and schema for the similar engineers endpoint.

### Changes Required:

#### 1. Request schema
**File**: `recommender_api/src/schemas/similarity.schema.ts`
**Changes**: New file with Zod validation schema

```typescript
/**
 * Similarity Request Schema
 */

import { z } from 'zod';

export const SimilarEngineersParamsSchema = z.object({
  id: z.string().min(1, 'Engineer ID is required'),
});

export const SimilarEngineersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type SimilarEngineersParams = z.infer<typeof SimilarEngineersParamsSchema>;
export type SimilarEngineersQuery = z.infer<typeof SimilarEngineersQuerySchema>;
```

#### 2. Controller
**File**: `recommender_api/src/controllers/similarity.controller.ts`
**Changes**: New file with controller function

```typescript
/**
 * Similarity Controller
 */

import type { Request, Response } from 'express';
import driver from '../neo4j.js';
import { findSimilarEngineers } from '../services/similarity.service.js';
import type { SimilarEngineersParams, SimilarEngineersQuery } from '../schemas/similarity.schema.js';

interface SimilarEngineersRequest extends Request {
  params: SimilarEngineersParams;
  query: SimilarEngineersQuery;
}

export async function getSimilarEngineers(
  req: SimilarEngineersRequest,
  res: Response
): Promise<void> {
  const session = driver.session();

  try {
    const { id } = req.params;
    const { limit } = req.query;

    const result = await findSimilarEngineers(session, id, limit);

    res.status(200).json(result);
  } catch (error) {
    console.error('getSimilarEngineers error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: {
          code: 'ENGINEER_NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'SIMILARITY_ERROR',
        message: 'Failed to find similar engineers',
        details: error instanceof Error ? [{ field: 'internal', message: error.message }] : undefined,
      },
    });
  } finally {
    await session.close();
  }
}
```

#### 3. Routes
**File**: `recommender_api/src/routes/similarity.routes.ts`
**Changes**: New file with route definitions

```typescript
/**
 * Similarity Routes
 */

import { Router } from 'express';
import { getSimilarEngineers } from '../controllers/similarity.controller.js';
import { validateParams, validateQuery } from '../middleware/zod-validate.middleware.js';
import { SimilarEngineersParamsSchema, SimilarEngineersQuerySchema } from '../schemas/similarity.schema.js';

const router = Router();

router.get(
  '/:id/similar',
  validateParams(SimilarEngineersParamsSchema),
  validateQuery(SimilarEngineersQuerySchema),
  getSimilarEngineers
);

export default router;
```

#### 4. Register routes in app
**File**: `recommender_api/src/app.ts`
**Changes**: Add import and mount similarity routes

```typescript
// Add import
import similarityRoutes from './routes/similarity.routes.js';

// Add route mounting (after search routes)
app.use('/api/engineers', similarityRoutes);
```

#### 5. Add param/query validation to middleware (if not exists)
**File**: `recommender_api/src/middleware/zod-validate.middleware.ts`
**Changes**: Add validateParams and validateQuery functions if they don't exist

```typescript
export function validateParams<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            name: 'ZodError',
            issues: error.issues,
          },
        });
        return;
      }
      next(error);
    }
  };
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            name: 'ZodError',
            issues: error.issues,
          },
        });
        return;
      }
      next(error);
    }
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [ ] Route tests pass
- [ ] Validation tests pass (invalid ID, invalid limit)

#### Manual Verification:
- [ ] `curl http://localhost:4025/api/engineers/eng_priya/similar` returns valid response
- [ ] `curl http://localhost:4025/api/engineers/invalid_id/similar` returns 404

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 6.

---

## Phase 6: Unit Tests

### Overview
Comprehensive unit tests for all scoring functions and calculator logic.

### Changes Required:

#### 1. Skill similarity tests
**File**: `recommender_api/src/services/similarity-calculator/scoring/skill-similarity.test.ts`
**Tests**:
- Identical skill sets → 1.0
- No overlap → 0.0
- Partial overlap → proportional score
- Correlated skills boost score
- Same category gives partial credit
- Shared parent gives partial credit

#### 2. Experience similarity tests
**File**: `recommender_api/src/services/similarity-calculator/scoring/experience-similarity.test.ts`
**Tests**:
- Same years → 1.0
- More candidate years → reduced penalty (α=0.5)
- Less candidate years → full penalty
- Edge cases (0 years, max years)

#### 3. Domain similarity tests
**File**: `recommender_api/src/services/similarity-calculator/scoring/domain-similarity.test.ts`
**Tests**:
- Identical domains → 1.0
- Sibling domains → 0.5
- Parent-child → 0.4
- Encompasses → 0.4
- Years similarity adjustment
- Years floor (0.5) applied

#### 4. Timezone similarity tests
**File**: `recommender_api/src/services/similarity-calculator/scoring/timezone-similarity.test.ts`
**Tests**:
- Same timezone → 1.0
- Adjacent timezones → 0.67
- Opposite timezones → 0.0
- Invalid timezone → 0.0

#### 5. Calculator tests
**File**: `recommender_api/src/services/similarity-calculator/similarity-calculator.test.ts`
**Tests**:
- Self-similarity ≈ 1.0
- Weights applied correctly
- Breakdown matches individual scores
- Score rounded to 2 decimals

#### 6. Diversity selector tests
**File**: `recommender_api/src/services/similarity-calculator/diversity-selector.test.ts`
**Tests**:
- First selection = highest similarity
- Subsequent selections balance similarity × diversity
- Respects limit parameter
- Handles pool smaller than limit

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `npm test`
- [x] Coverage >80%: `npm run test:coverage` (scoring modules: 91.79%)

#### Manual Verification:
- [ ] Tests cover edge cases from research document

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 7.

---

## Phase 7: E2E Tests

### Overview
Add Postman collection tests for the new endpoint.

### Changes Required:

#### 1. Update Postman collection
**File**: `postman/collections/search-filter-tests.postman_collection.json`
**Changes**: Add new folder "Similar Engineers" with test requests

**Test scenarios to add:**

1. **Basic similar request**
   - `GET /api/engineers/eng_priya/similar`
   - Asserts: 200, has `target` and `similar` arrays, `similar.length === 5`

2. **Custom limit**
   - `GET /api/engineers/eng_priya/similar?limit=3`
   - Asserts: `similar.length === 3`

3. **Target not in results**
   - Asserts: target engineer ID not in `similar[].engineer.id`

4. **Results sorted by score**
   - Asserts: `similar[0].similarityScore >= similar[1].similarityScore`

5. **Breakdown present**
   - Asserts: each result has `breakdown` with `skills`, `yearsExperience`, `domain`, `timezone`

6. **Invalid engineer ID**
   - `GET /api/engineers/invalid_id/similar`
   - Asserts: 404, error code `ENGINEER_NOT_FOUND`

7. **Invalid limit (too high)**
   - `GET /api/engineers/eng_priya/similar?limit=100`
   - Asserts: 400, validation error

8. **Invalid limit (negative)**
   - `GET /api/engineers/eng_priya/similar?limit=-1`
   - Asserts: 400, validation error

### Success Criteria:

#### Automated Verification:
- [x] E2E tests pass: `npx newman run postman/collections/similarity-tests.postman_collection.json`

#### Manual Verification:
- [x] All 8 test scenarios pass (30/30 assertions)
- [x] Response times <2s (avg 18ms, max 44ms)

**Postman Collection Created:** `postman/collections/similarity-tests.postman_collection.json`
- 8 test scenarios with 30 assertions total
- Tests cover: basic request, custom limit, 404 handling, validation errors, boundary values

**Implementation Note**: After completing this phase and all automated verification passes, the implementation is complete.

---

## Testing Strategy

### Unit Tests:
- Mock SkillGraph and DomainGraph for isolation
- Test each scoring function independently
- Test weight application
- Test diversity selection algorithm

### Integration Tests:
- Real Neo4j queries via test database
- End-to-end service flow
- Graph loading performance

### E2E Tests (Postman):
- Full API contract validation
- Error handling
- Response structure

## Performance Considerations

1. **Graph caching**: SkillGraph and DomainGraph are relatively static. Consider caching in production for repeated requests.

2. **Candidate loading**: Loading all engineers is O(N). For large datasets (>1000), consider pre-filtering by some heuristic (e.g., same primary skill category).

3. **Diversity calculation**: O(k²) where k is limit. Acceptable for k ≤ 20.

## Migration Notes

No schema changes required. The endpoint is additive and doesn't affect existing functionality.

## Post-Implementation Notes

### Implementation Complete: 2026-01-16

All phases completed successfully. Final test results:
- **703 unit/integration tests** pass
- **215 search filter E2E assertions** pass
- **30 similarity E2E assertions** pass

### Issues Encountered & Fixes

#### 1. Express `req.query` is Read-Only

**Problem**: The `validateQuery` middleware attempted to assign to `req.query`, but Express makes this read-only:
```
TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
```

**Fix**: Store parsed values in `res.locals` instead:
```typescript
// zod-validate.middleware.ts
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req.query);
    res.locals.query = parsed;  // Not req.query
    next();
  };
}
```

Controller reads from `res.locals`:
```typescript
const { id } = res.locals.params as SimilarEngineersParams;
const { limit } = res.locals.query as SimilarEngineersQuery;
```

#### 2. Diversity Selector Reorders Results

**Problem**: Tests expected strict descending sort by similarity score, but the diversity selector intentionally reorders results to maximize diversity.

**Fix**: Updated tests to only verify that the first result has the highest score (since it's always selected first before diversity kicks in):
```typescript
// Integration test
it('first result has highest similarity score (diversity reorders others)', async () => {
  const result = await findSimilarEngineers(session, 'eng_sofia', 5);
  if (result.similar.length > 1) {
    const firstScore = result.similar[0].similarityScore;
    const maxScore = Math.max(...result.similar.map(r => r.similarityScore));
    expect(firstScore).toBe(maxScore);
  }
});
```

#### 3. Tiltfile Port-Forwarding Not Working Locally

**Problem**: Integration tests couldn't connect to Neo4j locally (`localhost:7687` connection refused) even though Tilt was running. The port-forwarding was configured but not binding to an accessible interface.

**Root Cause**: The default port-forward format `'7687:7687'` in the Tiltfile wasn't binding to `localhost` when Tilt was started with a different bind address (Tailscale IP).

**Fix**: Updated `Tiltfile` to explicitly bind to all interfaces:
```python
k8s_resource(
    'neo4j-db',
    labels=['recommender'],
    port_forwards=[
        '0.0.0.0:7687:7687',  # Bolt protocol (bind to all interfaces)
        '0.0.0.0:7474:7474',  # HTTP browser
    ],
)

k8s_resource(
    'recommender-api',
    labels=['recommender'],
    port_forwards=['0.0.0.0:4025:4025'],  # Bind to all interfaces
    resource_deps=['neo4j-db', 'ollama'],
)
```

This enables both:
- **Local access**: `localhost:7687`, `localhost:7474`, `localhost:4025`
- **Remote access**: Tailscale hostname on the same ports

**Tilt restart required** for port-forward changes to take effect.

### Files Created

| File | Purpose |
|------|---------|
| `src/config/knowledge-base/similarity.config.ts` | Weights and parameters |
| `src/services/similarity-calculator/types.ts` | Type definitions |
| `src/services/similarity-calculator/scoring/experience-similarity.ts` | Asymmetric experience scoring |
| `src/services/similarity-calculator/scoring/skill-similarity.ts` | Graph-aware skill matching |
| `src/services/similarity-calculator/scoring/domain-similarity.ts` | Hierarchy-aware domain matching |
| `src/services/similarity-calculator/scoring/timezone-similarity.ts` | Position-based timezone scoring |
| `src/services/similarity-calculator/graph-loader.ts` | Neo4j graph loading |
| `src/services/similarity-calculator/similarity-calculator.ts` | Main scoring orchestration |
| `src/services/similarity-calculator/diversity-selector.ts` | Bounded greedy selection |
| `src/services/similarity-calculator/index.ts` | Module exports |
| `src/services/similarity.service.ts` | Service layer |
| `src/schemas/similarity.schema.ts` | Zod validation schemas |
| `src/controllers/similarity.controller.ts` | HTTP handler |
| `src/routes/similarity.routes.ts` | Express routes |
| `src/services/similarity.service.test.ts` | Mocked unit tests |
| `src/services/__tests__/similarity.integration.test.ts` | Real Neo4j integration tests |
| `postman/collections/similarity-tests.postman_collection.json` | E2E test scenarios |

### Files Modified

| File | Changes |
|------|---------|
| `src/config/knowledge-base/index.ts` | Export similarity config |
| `src/app.ts` | Mount `/api/engineers` routes |
| `src/middleware/zod-validate.middleware.ts` | Add `validateParams`, `validateQuery` using `res.locals` |
| `Tiltfile` | Bind port-forwards to `0.0.0.0` for local+remote access |

---

## References

- Research document: `thoughts/shared/research/2026-01-16-project-3-similarity-scoring.md`
- Textbook: Section 5.3.1 (Case-Based Recommenders)
- Utility calculator: `recommender_api/src/services/utility-calculator/`
- Skill graph data: `seeds/skills.ts:147-270`
- Domain graph data: `seeds/domains.ts`
