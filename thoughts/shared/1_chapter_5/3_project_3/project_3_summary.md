# Project 3: Similarity Scoring (Case-Based Recommender)

**Status**: Complete
**Duration**: January 16, 2026
**Branch**: `project_3`
**Git Commit**: 01383cda18d7c4581e949256c89ed38e5b909222

---

## Executive Summary

Project 3 implements **case-based recommendation** from Section 5.3.1 of the textbook, enabling "find engineers similar to this one" functionality. Unlike the constraint-based search from Projects 1-2 (where users specify requirements), case-based recommendation uses an existing engineer as the reference point and finds similar candidates.

The implementation features:
1. **Graph-aware similarity scoring**: Leverages Neo4j's skill correlations, categories, and hierarchies for intelligent matching
2. **Multi-dimensional analysis**: Skills (45%), experience (27%), domain (22%), timezone (6%)
3. **Asymmetric experience scoring**: More experience is acceptable, less is penalized
4. **Bounded greedy diversity selection**: Prevents homogeneous results

---

## Problem Statement

Previous projects (1-2) implemented constraint-based search: users specify what they want, the system filters and ranks candidates. But users often have a different need:

> "I found a great engineer but they're not available. Who else is like them?"

This requires **similarity-based** rather than **constraint-based** matching. The challenge: how do you quantify "similar" when comparing two engineers?

---

## Solution: Weighted Attribute Similarity with Graph-Aware Scoring

### Core Formula (Equation 5.2)

```
                    Σ(i∈S) w_i · Sim(t_i, x_i)
Similarity(T, X) = ────────────────────────────
                         Σ(i∈S) w_i
```

With weights summing to 1.0, this simplifies to the weighted sum of component similarities.

### Weight Distribution

| Dimension | Weight | Rationale |
|-----------|--------|-----------|
| Skills | 0.45 | Primary differentiator—what an engineer can do |
| Years Experience | 0.27 | Seniority matters for replacement scenarios |
| Domain | 0.22 | Industry/technical context knowledge |
| Timezone | 0.06 | Geographic proximity for collaboration |

**Excluded attributes**: Salary and availability are intentionally excluded—they're situational properties, not capability attributes. Two engineers with identical skills are equally "similar" regardless of compensation or current availability.

---

## Implementation Architecture

### API Endpoint

```
GET /api/engineers/:id/similar?limit=5
```

**Parameters**:
- `id` (path): Engineer ID to find similar candidates for
- `limit` (query): Maximum results to return (1-20, default: 5)

**Response Structure**:
```typescript
{
  target: EngineerForSimilarity,
  similar: [
    {
      engineer: EngineerForSimilarity,
      similarityScore: number,        // 0-1 overall score
      breakdown: {
        skills: number,               // Raw unweighted component scores
        yearsExperience: number,
        domain: number,
        timezone: number
      },
      sharedSkills: string[],         // Exact skill matches
      correlatedSkills: CorrelatedSkillPair[]  // Related skills via graph
    }
  ]
}
```

### File Structure

```
recommender_api/src/
├── routes/similarity.routes.ts           # Route definition
├── controllers/similarity.controller.ts  # HTTP handler
├── schemas/similarity.schema.ts          # Request validation (Zod)
├── services/
│   ├── similarity.service.ts             # Orchestration layer
│   └── similarity-calculator/
│       ├── index.ts                      # Public exports
│       ├── types.ts                      # Type definitions
│       ├── similarity-calculator.ts      # Main scoring logic
│       ├── diversity-selector.ts         # Bounded greedy selection
│       ├── graph-loader.ts               # Neo4j graph loading
│       └── scoring/
│           ├── skill-similarity.ts       # Graph-aware skill matching
│           ├── experience-similarity.ts  # Asymmetric years scoring
│           ├── domain-similarity.ts      # Hierarchy-aware domains
│           └── timezone-similarity.ts    # Position-based zones
└── config/knowledge-base/
    └── similarity.config.ts              # Weights & parameters
```

---

## Key Algorithms

### 1. Graph-Aware Skill Similarity

Pure Jaccard similarity treats all skills as equally different (React vs Vue = React vs PostgreSQL). Our graph-aware approach uses Neo4j relationships for intelligent partial matching:

**Priority Order (first match wins)**:
1. Same skill → 1.0
2. `CORRELATES_WITH` edge → use strength (e.g., TypeScript↔JavaScript = 0.95)
3. Same `SkillCategory` → 0.5 (e.g., React↔Vue, both Frontend Frameworks)
4. Share `CHILD_OF` parent → 0.3 (e.g., Express↔NestJS, both children of Node.js)
5. No relationship → 0.0

**Symmetric Best-Match**: For each skill in engineer A, find the best match in engineer B's skills. Average both directions to ensure A↔B = B↔A.

**Example**:
```
Target:    {React, Node.js, TypeScript, PostgreSQL}
Candidate: {Vue, Python, Django, PostgreSQL}

For each target skill, find best match:
  React      → Vue (same category)        = 0.5
  Node.js    → Python (same category)     = 0.5
  TypeScript → Vue (same category)        = 0.5
  PostgreSQL → PostgreSQL (exact)         = 1.0
                                      Average: 0.625

Pure Jaccard would give: 1/7 = 0.14 (misses all the context!)
```

### 2. Asymmetric Experience Similarity (Equation 5.5)

More experience is acceptable; less is penalized:

```
Sim(t, x) = 1 - |diff|/max + α · I(x > t) · |diff|/max
```

With α = 0.5:
- Candidate has **more** experience: penalty reduced by 50%
- Candidate has **less** experience: full penalty applied

**Example** (target has 7 years):
- Candidate with 9 years: `1 - 0.1 + 0.5×0.1 = 0.95` (slight penalty)
- Candidate with 5 years: `1 - 0.1 = 0.90` (full penalty)

### 3. Graph-Aware Domain Similarity

Same best-match approach as skills, using domain hierarchies:

**Priority Order**:
1. Same domain → 1.0
2. Siblings (share parent) → 0.5 (e.g., Fintech↔Banking under Finance)
3. Parent-child → 0.4 (e.g., Finance↔Fintech)
4. `ENCOMPASSES` → 0.4 (e.g., Full Stack↔Backend)
5. No relationship → 0.0

**Years Adjustment**: When domains match, years similarity acts as a multiplier (with 0.5 floor):
```
yearsSim = 1 - |diff| / 10
finalSim = baseSim × max(0.5, yearsSim)
```

### 4. Bounded Greedy Diversity Selection

Prevents homogeneous results (e.g., 5 nearly-identical React/Node.js engineers):

**Algorithm**:
1. Pool: Top `3 × limit` candidates (diversityMultiplier = 3)
2. Greedy selection: Pick candidate maximizing `Quality = Similarity × AvgDiversity`
3. `AvgDiversity` = average of `(1 - similarity to each already-selected)`

**Effect**: Each selection considers both how similar the candidate is to the target AND how different they are from already-selected results.

---

## Data Flow

```
GET /api/engineers/:id/similar
       │
       ▼
┌──────────────────────────────────────────┐
│        findSimilarEngineers()            │
│                                          │
│  1. Load skill graph (Neo4j)             │
│     └─ Correlations, categories, parents │
│                                          │
│  2. Load domain graph (Neo4j)            │
│     └─ Hierarchies, encompasses          │
│                                          │
│  3. Load target engineer                 │
│     └─ Skills, domains, years, timezone  │
│                                          │
│  4. Load all other engineers             │
│                                          │
│  5. Score each candidate                 │
│     ├─ Skill similarity (graph-aware)    │
│     ├─ Experience similarity (asymmetric)│
│     ├─ Domain similarity (hierarchy)     │
│     └─ Timezone similarity (position)    │
│                                          │
│  6. Apply diversity selection            │
│     └─ Bounded greedy (pool = 3×limit)   │
│                                          │
└──────────────────────────────────────────┘
       │
       ▼
{
  target: {...},
  similar: [
    { engineer, similarityScore, breakdown, sharedSkills, correlatedSkills },
    ...
  ]
}
```

---

## Key Design Decisions

### 1. Graph-Aware vs Pure Jaccard

**Decision**: Use Neo4j relationships for skill and domain similarity, not pure set overlap.

**Rationale**: Jaccard treats all skills as equally different. Our graph contains rich relationship data (73 CORRELATES_WITH edges, 38 CHILD_OF relationships, category memberships) that captures semantic similarity. An engineer with React is partially similar to one with Vue—both are frontend framework experts.

### 2. Exclude Salary and Timeline

**Decision**: Omit salary and availability from similarity scoring.

**Rationale**: These are situational, not intrinsic. Two engineers with identical capabilities are equally "similar" regardless of compensation expectations or current availability. These constraints belong in post-filtering, not similarity calculation.

### 3. Symmetric Best-Match

**Decision**: Average both directions when comparing skill/domain sets.

**Rationale**: Without symmetry, similarity depends on comparison direction:
- A→B: "How well does B cover A's skills?" (specialist can "cover" generalist well)
- B→A: "How well does A cover B's skills?" (generalist covers little of specialist)

Averaging ensures `similar(A, B) = similar(B, A)`.

### 4. Baked-In Parameters

**Decision**: Configuration values (α=0.5, diversityMultiplier=3, minCorrelationStrength=0.7) are not exposed as API parameters.

**Rationale**: Users ask "find similar engineers," not "find similar engineers with asymmetry coefficient 0.5 and diversity multiplier 3." Keep the API simple; add parameters later if real users request them.

### 5. Raw Breakdown Scores

**Decision**: Return unweighted component scores in the breakdown, not weighted contributions.

**Rationale**: Breakdown shows "how similar on each dimension" (0-1 scale), not "contribution to total." Users can understand "skills: 0.8, experience: 0.65" more intuitively than weighted values.

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Similarity calculation | ~50-100ms for 40 engineers |
| Graph loading | ~30-50ms per graph |
| Total endpoint response | <500ms |
| Integration test threshold | 2 seconds |

The algorithm is O(n × m²) where n = candidate count and m = average skills per engineer (for skill similarity). With ~40 engineers and ~8 skills each, this is negligible. For larger datasets, the skill graph could be cached.

---

## Testing

### Unit Tests (68 tests across 7 files)

| Module | Tests | Coverage |
|--------|-------|----------|
| skill-similarity.ts | 14 | Correlations, categories, parents, symmetry |
| experience-similarity.ts | 11 | Asymmetric penalties, overshoots, undershoots |
| domain-similarity.ts | 12 | Hierarchies, years adjustment, both types |
| timezone-similarity.ts | 14 | Distance scoring, all zones, invalid handling |
| similarity-calculator.ts | 7 | Weight application, sorting, shared skills |
| diversity-selector.ts | 11 | Greedy selection, diversity penalties |
| similarity.service.ts | 14 | Orchestration, data transformation, errors |

### Integration Tests (10 tests)

**File**: `recommender_api/src/services/__tests__/similarity.integration.test.ts`

Tests against real Neo4j with seeded data:
- Graph loading (skills with correlations, domains with hierarchies)
- End-to-end similarity calculation
- Excludes target from results
- Respects limit parameter
- Populates sharedSkills
- Performance threshold

### E2E Tests (8 scenarios)

**File**: `postman/collections/similarity-tests.postman_collection.json`

API-level tests:
- Basic similarity request
- Custom limit parameter
- Non-existent engineer (404)
- Invalid limit validation (too high, zero)
- Maximum limit (20)
- Staff-level engineer behavior
- Shared skills populated

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
| Research document | 1 (1,607 lines) |
| Implementation plan | 1 (1,866 lines) |
| New service files | 11 |
| New type definitions | 12 |
| Lines of code (new) | ~1,200 |
| Unit tests | 68 |
| Integration tests | 10 |
| E2E scenarios | 8 |

---

## What We're NOT Doing

Per plan scope:
- **Not supporting multi-engineer similarity** - Single target only; team composition analysis is future work
- **Not exposing configuration parameters** - Baked-in defaults; add if users request
- **Not caching skill graphs** - Premature optimization for 40 engineers
- **Not implementing streaming** - Response is small and fast
- **Not scoring proficiency levels** - Graph relationships are sufficient for now

---

## Lessons Learned

1. **Graph databases shine for similarity**: The skill graph with CORRELATES_WITH, BELONGS_TO, and CHILD_OF relationships enables intelligent partial matching that would be painful in SQL. Comparing 64 skill pairs per candidate is one graph traversal.

2. **Symmetrization is standard**: The asymmetry problem (A→B ≠ B→A) is well-known in information retrieval. Averaging both directions is the standard solution, used in F1 scores and many production systems.

3. **Diversity selection matters**: Without it, "similar to Priya (React/Node.js)" returns 5 nearly-identical React/Node.js engineers. Bounded greedy selection ensures variety in the result set.

4. **Exclude transient attributes**: Salary and availability change; skills and experience don't. Similarity should measure capability, not circumstance.

5. **Raw breakdowns > weighted contributions**: Users understand "skills: 0.8" better than "skills contributed 0.36 to the score."

---

## Future Considerations

1. **Team composition**: Given a team, find engineers who complement (not duplicate) existing skills
2. **Directional similarity**: "Who could replace X?" vs "Who could X mentor?" have different optimal directions
3. **Skill proficiency weighting**: Expert React + familiar Vue vs familiar React + expert Vue
4. **Real-time graph caching**: For larger engineer pools, cache the skill/domain graphs
5. **Explanation generation**: "These engineers are similar because they share React expertise and both have Fintech domain experience"

---

## References

- **Research**: `thoughts/shared/1_chapter_5/3_project_3/research/2026-01-16-project-3-similarity-scoring.md`
- **Implementation Plan**: `thoughts/shared/1_chapter_5/3_project_3/plans/2026-01-16-project-3-similarity-scoring.md`
- **Project 2.5 Summary**: `thoughts/shared/1_chapter_5/2.5_project_2.5/project_2.5_summary.md`
- **Textbook Section**: 5.3.1 (Case-Based Recommender Systems)
