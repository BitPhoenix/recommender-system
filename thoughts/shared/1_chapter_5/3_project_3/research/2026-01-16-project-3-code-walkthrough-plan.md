---
date: 2026-01-16T15:30:00-08:00
researcher: Claude
git_commit: 4ad1d903fa07194281bc05c13f4c3b95a3114a66
branch: project_3
repository: recommender_system
topic: "Code Walkthrough Plan: Project 3 Similarity Scoring Implementation"
tags: [research, code-walkthrough, similarity-scoring, learning-path, project-3]
status: complete
last_updated: 2026-01-16
last_updated_by: Claude
---

# Code Walkthrough Plan: Project 3 Similarity Scoring Implementation

**Date**: 2026-01-16T15:30:00-08:00
**Researcher**: Claude
**Git Commit**: 4ad1d903fa07194281bc05c13f4c3b95a3114a66
**Branch**: project_3
**Repository**: recommender_system

## Research Question

Generate a code walkthrough plan optimized for learning and understanding the Project 3 Similarity Scoring implementation, comparing against the implementation plan at `thoughts/shared/plans/2026-01-16-project-3-similarity-scoring.md`.

## Executive Summary

The Project 3 implementation successfully delivers a case-based similarity scoring system for engineers. The walkthrough is structured as a **6-module learning path** that progresses from foundational concepts (configuration/types) through algorithms (scoring functions, graph traversal) to integration (service layer, API, tests). Each module builds on the previous, with clear learning objectives and hands-on exercises.

---

## Code Walkthrough Plan

### Learning Path Overview

```
Module 1: Configuration & Type System (Foundation)
    ↓
Module 2: Individual Scoring Functions (Core Algorithms)
    ↓
Module 3: Graph Loading & Orchestration (Data Layer)
    ↓
Module 4: Diversity Selection (Advanced Algorithm)
    ↓
Module 5: Service & API Integration (System Integration)
    ↓
Module 6: Testing Patterns (Quality Assurance)
```

---

## Module 1: Configuration & Type System

**Learning Objectives:**
- Understand how textbook equations map to code configuration
- Learn the type-first design pattern used throughout
- Grasp why certain attributes are included/excluded from similarity

**Duration:** 20-30 minutes

### Files to Study (in order)

#### 1.1 `src/config/knowledge-base/similarity.config.ts`

**Focus Areas:**
- Equation 5.2 mapping: `Similarity(T, X) = Σ w_i · Sim(t_i, x_i)`
- Why weights sum to 1.0 (normalized scoring)
- Weight rationale: skills (0.45) > experience (0.27) > domain (0.22) > timezone (0.06)

**Key Concepts:**
```typescript
// Two interface pattern: Weights vs Parameters
export interface SimilarityWeights {
  skills: number;           // Primary differentiator
  yearsExperience: number;  // Seniority relevance
  domain: number;           // Industry context
  timezone: number;         // Geographic proximity
}

export interface SimilarityParams {
  experienceAlpha: number;        // Asymmetry coefficient (0.5)
  minCorrelationStrength: number; // Noise filter (0.7)
  diversityMultiplier: number;    // Pool size factor (3)
  domainYearsFloor: number;       // Score reduction floor (0.5)
}
```

**Discussion Points:**
- Why is timeline excluded? (Transient property, not capability)
- Why is salary excluded? (Fairness - handled by budget filter)
- What does `experienceAlpha: 0.5` mean practically?

#### 1.2 `src/services/similarity-calculator/types.ts`

**Focus Areas:**
- Three-tier type hierarchy: Public API → Component → Internal
- Graph data structures for O(1) lookups
- Separation of concerns: What consumers see vs. what algorithms use

**Key Type Relationships:**
```
Public API Layer:
├── EngineerForSimilarity (input)
├── SimilarityResult (output per candidate)
└── SimilarEngineersResponse (batch response)

Component Layer:
├── EngineerSkill
├── DomainExperience
├── CorrelatedSkillPair
└── SimilarityBreakdown

Internal Layer (Scoring):
├── SkillSimilarityResult
├── ExperienceSimilarityResult
├── DomainSimilarityResult
├── TimezoneSimilarityResult
├── SkillGraph / SkillGraphNode
└── DomainGraph / DomainGraphNode
```

**Hands-On Exercise:**
1. Draw the data flow from `EngineerForSimilarity` to `SimilarityResult`
2. Why does `SkillSimilarityResult` return more data than other dimensions?
3. Why are graphs stored as `Map<string, Node>` instead of arrays?

#### 1.3 `src/config/knowledge-base/index.ts` (similarity exports only)

**Focus Areas:**
- Modular configuration assembly pattern
- Single source of truth principle
- How similarity config joins the knowledge base

---

## Module 2: Individual Scoring Functions

**Learning Objectives:**
- Implement and test mathematical similarity formulas
- Understand symmetric vs asymmetric scoring
- Learn graph traversal patterns for hierarchical data

**Duration:** 45-60 minutes

### Files to Study (in order)

#### 2.1 `src/services/similarity-calculator/scoring/experience-similarity.ts`

**Why Start Here:** Simplest algorithm, introduces asymmetry concept

**Key Algorithm (Equation 5.5):**
```typescript
// When candidate has MORE experience (diff > 0):
score = 1 - (normalizedDiff × (1 - α))  // Reduced penalty

// When candidate has LESS experience (diff ≤ 0):
score = 1 - normalizedDiff              // Full penalty
```

**Walkthrough Exercise:**
| Target | Candidate | Expected Score | Why? |
|--------|-----------|----------------|------|
| 5 | 5 | 1.0 | Exact match |
| 5 | 8 | 0.925 | More experience, reduced penalty |
| 5 | 2 | 0.85 | Less experience, full penalty |

**Key Insight:** Business domain knowledge encoded in `α=0.5` - over-qualification acceptable, under-qualification is risk.

#### 2.2 `src/services/similarity-calculator/scoring/timezone-similarity.ts`

**Why Second:** Simple position-based algorithm, uses canonical config

**Key Algorithm:**
```typescript
const zones = ['Eastern', 'Central', 'Mountain', 'Pacific'];
const distance = Math.abs(targetIdx - candidateIdx);
return 1 - (distance / 3);  // maxDist = 3
```

**Walkthrough Exercise:**
| Target | Candidate | Distance | Score |
|--------|-----------|----------|-------|
| Eastern | Eastern | 0 | 1.0 |
| Eastern | Central | 1 | 0.67 |
| Eastern | Pacific | 3 | 0.0 |

**Key Insight:** Imports from canonical source (`usTimezoneZones`) - never redefines ordering.

#### 2.3 `src/services/similarity-calculator/scoring/skill-similarity.ts`

**Why Third:** Complex algorithm with graph traversal

**Key Algorithm: Symmetric Best-Match**
```
SkillSim(T, C) = [BestMatch(T→C) + BestMatch(C→T)] / 2
```

**Priority Order for `computeSkillToSkillSimilarity()`:**
1. Exact match → 1.0
2. CORRELATES_WITH → strength value (e.g., 0.95)
3. Same SkillCategory → 0.5
4. Share CHILD_OF parent → 0.3
5. No relationship → 0.0

**Graph Traversal Pattern:**
```typescript
// O(1) lookup using pre-loaded graph
const nodeA = skillGraph.nodes.get(skillA);
const nodeB = skillGraph.nodes.get(skillB);

// Check correlation (array scan, typically small)
const correlation = nodeA.correlations.find(c => c.toSkillId === skillB);
if (correlation) return correlation.strength;

// Check category (flat field comparison)
if (nodeA.categoryId && nodeA.categoryId === nodeB.categoryId) return 0.5;

// Check parent (flat field comparison)
if (nodeA.parentId && nodeA.parentId === nodeB.parentId) return 0.3;
```

**Hands-On Exercise:**
1. Trace through: Target has [React, TypeScript], Candidate has [Vue, JavaScript]
2. Why symmetric average? What happens if only one direction?

#### 2.4 `src/services/similarity-calculator/scoring/domain-similarity.ts`

**Why Fourth:** Builds on skill patterns, adds years multiplier

**Key Additions Beyond Skills:**
- Years similarity multiplier with 0.5 floor
- ENCOMPASSES relationship (for technical domains)
- Combines business + technical domains into single pool

**Years Adjustment Formula:**
```typescript
if (baseSim > 0) {
  const yearsSim = Math.max(0.5, 1 - yearsDiff / 10);
  finalSim = baseSim × yearsSim;
}
```

**Walkthrough Exercise:**
| Target | Candidate | Base | Years Diff | Final |
|--------|-----------|------|-----------|-------|
| Fintech(5yr) | Fintech(5yr) | 1.0 | 0 | 1.0 |
| Fintech(5yr) | Fintech(1yr) | 1.0 | 4 | 0.6 |
| Fintech(5yr) | Banking(5yr) | 0.5 | 0 | 0.5 |
| Backend(5yr) | Full Stack(3yr) | 0.4 | 2 | 0.32 |

**Key Insight:** `domainYearsFloor: 0.5` prevents years from dominating - worst case is 50% reduction.

---

## Module 3: Graph Loading & Orchestration

**Learning Objectives:**
- Understand Neo4j Cypher patterns for relationship loading
- Learn in-memory graph construction
- Grasp the weighted aggregation formula

**Duration:** 30-40 minutes

### Files to Study (in order)

#### 3.1 `src/services/similarity-calculator/graph-loader.ts`

**Key Cypher Pattern (Undirected Correlation):**
```cypher
/*
 * CORRELATES_WITH uses undirected pattern: (s)-[c]-(other)
 * Correlations stored unidirectionally but treated bidirectionally
 * (TypeScript ↔ JavaScript)
 */
MATCH (s:Skill)
OPTIONAL MATCH (s)-[:BELONGS_TO]->(cat:SkillCategory)
OPTIONAL MATCH (s)-[:CHILD_OF]->(parent:Skill)
OPTIONAL MATCH (s)-[c:CORRELATES_WITH]-(other:Skill)
WHERE c.strength >= $minStrength
RETURN s.id AS skillId, cat.id AS categoryId, parent.id AS parentId,
       COLLECT(DISTINCT {toSkillId: other.id, strength: c.strength}) AS correlations
```

**Graph Construction Pattern:**
```typescript
// Build Map from flat query results
const nodes = new Map<string, SkillGraphNode>();
for (const record of result.records) {
  nodes.set(record.get('skillId'), {
    skillId: record.get('skillId'),
    categoryId: record.get('categoryId'),
    parentId: record.get('parentId'),
    correlations: record.get('correlations').filter(c => c.toSkillId !== null)
  });
}
return { nodes };
```

**Hands-On Exercise:**
1. Why filter `minCorrelationStrength: 0.7`?
2. Why separate business vs technical domain graphs?

#### 3.2 `src/services/similarity-calculator/similarity-calculator.ts`

**Key Aggregation (Equation 5.2):**
```typescript
function calculateWeighted(raw: number, weight: number): number {
  return Math.round(raw * weight * 1000) / 1000;  // 3-decimal precision
}

// Weighted sum with 2-decimal final rounding
const totalScore = Math.round(
  (weightedSkills + weightedExperience + weightedDomain + weightedTimezone) * 100
) / 100;
```

**Data Flow:**
```
calculateSimilarityWithBreakdown(graphs, target, candidate)
    ↓
├── calculateSkillSimilarity() → SkillSimilarityResult
├── calculateExperienceSimilarity() → ExperienceSimilarityResult
├── calculateDomainSimilarity() → DomainSimilarityResult
└── calculateTimezoneSimilarity() → TimezoneSimilarityResult
    ↓
Apply weights: 0.45×skill + 0.27×exp + 0.22×domain + 0.06×tz
    ↓
Return SimilarityResult with breakdown + metadata
```

**Hands-On Exercise:**
Calculate manually: `[skill=0.8, exp=1.0, domain=0.5, tz=0.67]`
- Expected: `0.45×0.8 + 0.27×1.0 + 0.22×0.5 + 0.06×0.67 = ?`

---

## Module 4: Diversity Selection

**Learning Objectives:**
- Understand bounded greedy selection algorithm
- Learn quality-diversity tradeoff
- Grasp lightweight vs full similarity

**Duration:** 25-35 minutes

### File to Study

#### 4.1 `src/services/similarity-calculator/diversity-selector.ts`

**Algorithm: Bounded Greedy Selection (Section 5.3.1.1)**
```
Quality(X) = Similarity(T, X) × D_avg(X, selected)
```

**Step-by-Step:**
1. Take top `diversityMultiplier × limit` candidates as pool (default: 3×5=15)
2. For round 1: D_avg = 1.0 (no selected yet), pick highest similarity
3. For round 2+:
   - For each candidate in pool:
     - Calculate average diversity to all selected candidates
     - Quality = similarity × avgDiversity
   - Pick candidate with highest quality
4. Repeat until `selected.length === limit`

**Lightweight Diversity Formula:**
```typescript
// Jaccard similarity (fast, no graph traversal)
skillSim = intersection.size / union.size   // 70% weight
domainSim = intersection.size / union.size  // 30% weight
lightweightSim = skillSim × 0.7 + domainSim × 0.3
diversity = 1 - lightweightSim
```

**Walkthrough Example:**
```
Pool (top 15 by similarity):
  Marcus: 0.95
  Wei: 0.82
  Fatima: 0.85
  ...

Round 1: Select Marcus (0.95 × 1.0 = 0.95)
Round 2:
  Wei: 0.82 × diversity(Wei, {Marcus}) = 0.82 × 0.70 = 0.574
  Fatima: 0.85 × diversity(Fatima, {Marcus}) = 0.85 × 0.65 = 0.553
  → Select Wei
Round 3:
  Fatima: 0.85 × avgDiversity({Marcus, Wei}) = 0.85 × 0.60 = 0.510
  → Select Fatima
```

**Key Insight:** First selection is always highest similarity (diversity factor = 1.0).

---

## Module 5: Service & API Integration

**Learning Objectives:**
- Understand Express middleware patterns
- Learn Zod validation with coercion
- Grasp Neo4j session management

**Duration:** 30-40 minutes

### Files to Study (in order)

#### 5.1 `src/schemas/similarity.schema.ts`

**Zod Patterns:**
```typescript
// URL parameter validation
export const SimilarEngineersParamsSchema = z.object({
  id: z.string().min(1, 'Engineer ID is required'),
});

// Query parameter with coercion and default
export const SimilarEngineersQuerySchema = z.object({
  limit: z.coerce.number()  // "5" → 5
    .int()
    .min(1)
    .max(20)
    .default(5),
});
```

**Key Pattern:** `z.infer<typeof Schema>` provides TypeScript type from Zod schema.

#### 5.2 `src/middleware/zod-validate.middleware.ts`

**Validation Pattern:**
```typescript
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query);
      res.locals.query = parsed;  // Store in res.locals, not req.query
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ success: false, error: { issues: error.issues } });
        return;
      }
      next(error);
    }
  };
}
```

**Key Insight:** Express `req.query` is read-only; store parsed values in `res.locals`.

#### 5.3 `src/routes/similarity.routes.ts`

**Middleware Chain:**
```typescript
router.get(
  '/:id/similar',
  validateParams(SimilarEngineersParamsSchema),
  validateQuery(SimilarEngineersQuerySchema),
  getSimilarEngineers
);
```

#### 5.4 `src/controllers/similarity.controller.ts`

**Session Management Pattern:**
```typescript
const session = driver.session();
try {
  const result = await findSimilarEngineers(session, id, limit);
  res.status(200).json(result);
} catch (error) {
  // Error handling...
} finally {
  await session.close();  // Always close, even on error
}
```

**Error Mapping:**
- `error.message.includes('not found')` → 404 ENGINEER_NOT_FOUND
- Other errors → 500 SIMILARITY_ERROR

#### 5.5 `src/services/similarity.service.ts`

**Orchestration Flow:**
```typescript
export async function findSimilarEngineers(session, targetId, limit = 5) {
  // 1. Load graphs (sequential - Neo4j sessions not thread-safe)
  const skillGraph = await loadSkillGraph(session);
  const domainGraph = await loadDomainGraph(session);

  // 2. Load engineers
  const target = await loadEngineerData(session, targetId);
  const candidates = await loadAllEngineersExcept(session, targetId);

  // 3. Score and rank
  const scored = scoreAndSortCandidates(graphs, target, candidates);

  // 4. Apply diversity
  const diverse = selectDiverseResults(scored, limit);

  return { target, similar: diverse };
}
```

**Neo4j Integer Handling:**
```typescript
// Neo4j returns integers as objects with toNumber()
const yearsValue = typeof years === 'object' && 'toNumber' in years
  ? years.toNumber()
  : Number(years);
```

---

## Module 6: Testing Patterns

**Learning Objectives:**
- Understand test pyramid (unit → integration → E2E)
- Learn mocking strategies for service isolation
- Grasp Neo4j-specific testing patterns

**Duration:** 30-40 minutes

### Files to Study (in order)

#### 6.1 `src/services/similarity.service.test.ts` (Unit)

**Mocking Pattern:**
```typescript
vi.mock('./similarity-calculator/index.js', () => ({
  loadSkillGraph: vi.fn().mockResolvedValue({ nodes: new Map() }),
  scoreAndSortCandidates: vi.fn().mockReturnValue([...]),
  selectDiverseResults: vi.fn().mockImplementation((candidates, limit) =>
    candidates.slice(0, limit)
  ),
}));
```

**Key Tests:**
- Service orchestration (calls graph loaders, calls calculator)
- Error handling (engineer not found)
- Neo4j quirks (null filtering, integer conversion)

#### 6.2 `src/services/__tests__/similarity.integration.test.ts`

**Neo4j Availability Pattern:**
```typescript
let neo4jAvailable = false;

beforeAll(async () => {
  try {
    await session.run('RETURN 1');
    neo4jAvailable = true;
  } catch {
    console.warn('Neo4j not available - tests will be skipped');
  }
});

it('loads skill graph', async () => {
  if (!neo4jAvailable) { console.log('Skipping...'); return; }
  // Test with real database...
}, { timeout: 10000 });
```

**Key Tests:**
- Graph structure validation
- Correlation strength filtering
- Performance threshold (< 2 seconds for 40 engineers)
- Score bounds (all breakdown scores 0-1)

#### 6.3 `postman/collections/similarity-tests.postman_collection.json` (E2E)

**Test Scenarios:**
1. Basic request (200, structure validation)
2. Custom limit parameter
3. Non-existent engineer (404)
4. Invalid limit - too high (400)
5. Invalid limit - zero (400)
6. Maximum limit (20)
7. Staff engineer similarity
8. Shared skills populated

**Assertion Pattern:**
```javascript
pm.test("Status code is 200", () => {
  pm.response.to.have.status(200);
});

pm.test("Similarity scores in valid range", () => {
  const json = pm.response.json();
  json.similar.forEach(result => {
    pm.expect(result.similarityScore).to.be.within(0, 1);
  });
});
```

---

## Learning Progression Summary

| Module | Files | Key Concepts | Estimated Time |
|--------|-------|--------------|----------------|
| 1 | similarity.config.ts, types.ts | Weighted formula, type hierarchy | 20-30 min |
| 2 | scoring/*.ts | Asymmetric scoring, graph traversal | 45-60 min |
| 3 | graph-loader.ts, similarity-calculator.ts | Cypher patterns, weighted aggregation | 30-40 min |
| 4 | diversity-selector.ts | Greedy selection, quality-diversity | 25-35 min |
| 5 | routes, controller, service | Middleware chain, session management | 30-40 min |
| 6 | *.test.ts, postman collection | Test pyramid, mocking strategies | 30-40 min |

**Total Estimated Time:** 3-4 hours

---

## Recommended Walkthrough Order

### For Algorithm-Focused Learning:
1. Module 1 (foundation) → Module 2 (all scoring functions) → Module 4 (diversity)
2. Then: Module 3 → Module 5 → Module 6

### For Full-Stack Integration Learning:
1. Module 5 (API layer top-down) → Module 3 → Module 1 → Module 2
2. Then: Module 4 → Module 6

### For Test-Driven Understanding:
1. Module 6 (tests first) → Read tests to understand expected behavior
2. Then trace through implementation: Module 1 → 2 → 3 → 4 → 5

---

## Code References

| Reference | Purpose |
|-----------|---------|
| `similarity.config.ts:126-140` | Weight and parameter values |
| `types.ts:175-223` | Public API types |
| `types.ts:229-274` | Internal graph structures |
| `experience-similarity.ts:16-30` | Asymmetric formula implementation |
| `skill-similarity.ts:40-70` | Best-match algorithm |
| `graph-loader.ts:15-35` | Skill graph Cypher query |
| `similarity-calculator.ts:40-75` | Weighted aggregation |
| `diversity-selector.ts:20-55` | Greedy selection algorithm |
| `similarity.service.ts:15-50` | Service orchestration |
| `similarity.controller.ts:20-45` | Session management pattern |

---

## Related Documents

- Implementation Plan: `thoughts/shared/plans/2026-01-16-project-3-similarity-scoring.md`
- Research Document: `thoughts/shared/research/2026-01-16-project-3-similarity-scoring.md`
- Textbook Reference: Chapter 5, Section 5.3.1 (Case-Based Recommender Systems)
