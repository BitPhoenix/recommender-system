# Engineer Similarity Calculation Explained

This document explains how engineer similarity is calculated in the recommender API, with concrete examples and a walkthrough of the diversity selection algorithm.

## Overview

The system implements a **weighted multi-attribute similarity model** based on case-based recommendation principles. The core formula is:

```
Similarity(Target, Candidate) = Σ weight_i × Sim(attribute_i)
```

## Similarity Weights

Configured in `config/knowledge-base/similarity.config.ts`:

| Attribute | Weight | Rationale |
|-----------|--------|-----------|
| Skills | 0.45 | Primary capability differentiator |
| Years Experience | 0.27 | Seniority matters for replacement |
| Domain | 0.22 | Industry/technical context |
| Timezone | 0.06 | Geographic proximity (minor factor) |

### Intentionally Excluded Attributes

- **Salary**: Two engineers with identical skills and experience are equally "similar" regardless of compensation expectations. Salary is a budget constraint, not a similarity dimension.
- **Timeline**: Availability is transient (changes when projects end) and reflects scheduling, not capability. Apply as a post-filter if needed.

## Attribute Similarity Functions

### 1. Skills (`services/similarity-calculator/scoring/skill-similarity.ts`)

**Algorithm**: Graph-aware best-match with symmetry averaging

For each skill in the target's skill set, find the best matching skill in the candidate's set using this priority:

| Relationship | Score |
|-------------|-------|
| Exact match | 1.0 |
| `CORRELATES_WITH` edge | Edge strength (e.g., 0.95 for TypeScript↔JavaScript) |
| Same `SkillCategory` | 0.5 |
| Share parent via `CHILD_OF` | 0.3 |
| No relationship | 0.0 |

**Why symmetry matters**: The algorithm averages both directions (Target→Candidate and Candidate→Target) to handle specialists vs generalists fairly. A backend specialist with 10 backend skills shouldn't be penalized when compared to a full-stack generalist with 5 frontend + 5 backend skills.

### 2. Years Experience (`services/similarity-calculator/scoring/experience-similarity.ts`)

**Algorithm**: Asymmetric penalty with α=0.5

```typescript
normalizedDiff = |targetYears - candidateYears| / yearsExperienceMax  // max = 20

if (candidateHasMore) {
  score = 1 - (normalizedDiff * (1 - α))  // Reduced penalty (α=0.5)
} else {
  score = 1 - normalizedDiff              // Full penalty
}
```

**Rationale**: More experience than needed is acceptable; less experience is concerning. The α=0.5 parameter means "tolerate overshoot, penalize undershoot."

### 3. Domain (`services/similarity-calculator/scoring/domain-similarity.ts`)

**Algorithm**: Graph-aware like skills, combines business and technical domains

| Relationship | Score |
|-------------|-------|
| Exact match | 1.0 |
| Siblings (same parent) | 0.5 (e.g., Fintech ↔ Banking) |
| Parent-child | 0.4 (e.g., Finance ↔ Fintech) |
| `ENCOMPASSES` | 0.4 (e.g., Full Stack ↔ Backend) |
| No relationship | 0.0 |

**Years adjustment**: Domain years experience acts as a multiplicative factor with a 0.5 floor, preventing years from dominating the domain match.

```
finalScore = baseSimilarity × max(0.5, yearsSimilarity)
```

### 4. Timezone (`services/similarity-calculator/scoring/timezone-similarity.ts`)

**Algorithm**: Position-based distance

```typescript
// Ordered East to West: Eastern, Central, Mountain, Pacific
score = 1 - (distance / maxDistance)
```

Same timezone = 1.0, opposite coasts (Eastern ↔ Pacific) = 0.25.

---

## Worked Example: Marcus vs Emily

### Engineer Profiles

| Attribute | Marcus Chen | Emily Nakamura |
|-----------|-------------|----------------|
| **Years Experience** | 5 | 4 |
| **Timezone** | Pacific | Pacific |
| **Skills** | React (expert), TypeScript, Next.js, Node.js, Express, PostgreSQL, GraphQL, Docker, Ownership, Learning | React (expert), TypeScript, Next.js, GraphQL, Unit Testing, Attention to Detail, Cross-Functional, Curiosity |
| **Business Domain** | SaaS (4 yrs) | E-commerce (3 yrs) |
| **Technical Domain** | Full Stack (5 yrs) | Frontend (4 yrs), React Ecosystem (4 yrs) |

### Step 1: Skills (weight: 0.45)

**Direction: Marcus → Emily**

| Marcus's Skill | Best Match in Emily | Score | Why |
|----------------|---------------------|-------|-----|
| React | React | 1.0 | Exact match |
| TypeScript | TypeScript | 1.0 | Exact match |
| Next.js | Next.js | 1.0 | Exact match |
| GraphQL | GraphQL | 1.0 | Exact match |
| Node.js | (none) | 0.0 | No relationship |
| Express | (none) | 0.0 | No relationship |
| PostgreSQL | (none) | 0.0 | No relationship |
| Docker | (none) | 0.0 | No relationship |
| Ownership | Attention to Detail | 0.7 | CORRELATES_WITH |
| Learning | Curiosity | ~0.3 | Same category |

Average (Marcus→Emily): `(1.0+1.0+1.0+1.0+0+0+0+0+0.7+0.3) / 10 = 0.50`

**Direction: Emily → Marcus**

| Emily's Skill | Best Match in Marcus | Score |
|---------------|----------------------|-------|
| React | React | 1.0 |
| TypeScript | TypeScript | 1.0 |
| Next.js | Next.js | 1.0 |
| GraphQL | GraphQL | 1.0 |
| Unit Testing | (none) | 0.0 |
| Attention to Detail | Ownership | 0.7 |
| Cross-Functional | (none) | 0.0 |
| Curiosity | Learning | ~0.3 |

Average (Emily→Marcus): `(1.0+1.0+1.0+1.0+0+0.7+0+0.3) / 8 = 0.625`

**Symmetric skill score**: `(0.50 + 0.625) / 2 = 0.5625`

### Step 2: Years Experience (weight: 0.27)

```
Target (Marcus): 5 years
Candidate (Emily): 4 years
Difference: -1 (Emily has LESS)
Normalized: 1/20 = 0.05
```

Since Emily has less experience, full penalty applies:

```
score = 1 - 0.05 = 0.95
```

### Step 3: Domain (weight: 0.22)

**Business domains:**
- Marcus: SaaS
- Emily: E-commerce
- Relationship: Both siblings under common parent → **0.5**

**Technical domains:**
- Marcus: Full Stack (5 yrs)
- Emily: Frontend (4 yrs), React Ecosystem (4 yrs)
- Full Stack `ENCOMPASSES` Frontend → **0.4**

Combined domain score: `(0.5 + 0.4) / 2 = 0.45`

Years adjustment:
- Years similarity ≈ 0.9 (4 vs 5 years)
- Final: `0.45 × max(0.5, 0.9) = 0.45 × 0.9 = 0.405`

### Step 4: Timezone (weight: 0.06)

Both Pacific → distance = 0 → **score = 1.0**

### Final Score

```
Similarity = (0.45 × 0.5625) + (0.27 × 0.95) + (0.22 × 0.405) + (0.06 × 1.0)
           = 0.253 + 0.257 + 0.089 + 0.06
           = 0.659
```

**Emily scores ~0.66 similarity to Marcus** — reasonably similar due to shared frontend skills and same timezone, but penalized by missing backend skills and different domains.

---

## Diversity Selection Algorithm

The system applies **bounded greedy selection** (`services/similarity-calculator/diversity-selector.ts`) to prevent homogeneous results.

### The Problem

Without diversity selection, requesting "top 3 similar to Marcus" might return:
- Rachel (React expert)
- Emily (React expert)
- Jordan (React developer)

All React-focused frontend engineers — homogeneous and not useful for exploring alternatives.

### The Solution: Quality = Similarity × Diversity

```
Quality(X) = Similarity(target, X) × D_avg(X, alreadySelected)
```

Where:
- `D_avg` = average diversity from already-selected candidates
- `Diversity(A, B) = 1 - Similarity(A, B)`

### Algorithm

1. Take top `diversityMultiplier × limit` candidates as the pool (default: 3×)
2. Greedily select candidates one at a time
3. Each selection maximizes: `similarity × avgDiversity`
4. Diversity uses skills (70%) + domain (30%) — excludes experience/timezone

### Worked Example

Request: **Top 3 similar to Marcus**

**Candidate pool** (sorted by raw similarity):

| Rank | Engineer | Similarity | Skills Focus |
|------|----------|------------|--------------|
| 1 | Rachel | 0.82 | React, TypeScript, Performance |
| 2 | Emily | 0.66 | React, TypeScript, Next.js |
| 3 | Jordan | 0.62 | React, Tailwind |
| 4 | Carlos | 0.58 | Node.js, React |
| 5 | Maya | 0.55 | React, TypeScript |
| 6 | Ashley | 0.52 | Vue.js |
| 7 | Zoe | 0.48 | Broad/generalist |
| 8 | Kevin | 0.40 | Python, Django |
| 9 | Tyler | 0.35 | Java, Spring |

**Round 1**: First selection
- No one selected yet → `avgDiversity = 1.0` for everyone
- Quality = Similarity × 1.0
- **Rachel wins** (highest similarity: 0.82)

**Round 2**: Second selection

Compute diversity from Rachel for each remaining candidate:

| Candidate | Similarity to Rachel | Diversity | Quality |
|-----------|---------------------|-----------|---------|
| Emily | 0.85 (both React experts) | 0.15 | 0.66 × 0.15 = 0.099 |
| Jordan | 0.75 (both React) | 0.25 | 0.62 × 0.25 = 0.155 |
| Carlos | 0.50 (has Node.js) | 0.50 | 0.58 × 0.50 = 0.290 |
| Maya | 0.80 (both React/TS) | 0.20 | 0.55 × 0.20 = 0.110 |
| Ashley | 0.45 (Vue ≠ React) | 0.55 | 0.52 × 0.55 = 0.286 |
| Zoe | 0.35 (generalist) | 0.65 | 0.48 × 0.65 = 0.312 |
| Kevin | 0.20 (Python/Django) | 0.80 | 0.40 × 0.80 = 0.320 |
| Tyler | 0.15 (Java/Spring) | 0.85 | 0.35 × 0.85 = 0.298 |

**Kevin wins** (quality 0.320) — despite lower raw similarity, his diversity from Rachel makes him more valuable.

**Round 3**: Third selection

Compute average diversity from {Rachel, Kevin}:

| Candidate | Div from Rachel | Div from Kevin | Avg Diversity | Quality |
|-----------|-----------------|----------------|---------------|---------|
| Emily | 0.15 | 0.75 | 0.45 | 0.66 × 0.45 = 0.297 |
| Carlos | 0.50 | 0.55 | 0.525 | 0.58 × 0.525 = 0.305 |
| Ashley | 0.55 | 0.70 | 0.625 | 0.52 × 0.625 = 0.325 |
| Zoe | 0.65 | 0.60 | 0.625 | 0.48 × 0.625 = 0.300 |

**Ashley wins** (quality 0.325) — Vue.js provides diversity from both React (Rachel) and Python (Kevin).

### Final Comparison

| Without Diversity | With Diversity |
|-------------------|----------------|
| Rachel (React) | Rachel (React) |
| Emily (React) | Kevin (Python) |
| Jordan (React) | Ashley (Vue) |

The diversity selection ensures a **varied set** of candidates rather than 3 nearly identical React engineers.

---

## Key Files Reference

| Component | File | Key Functions |
|-----------|------|---------------|
| Main orchestrator | `services/similarity-calculator/similarity-calculator.ts` | `scoreAndSortCandidates()`, `calculateSimilarityWithBreakdown()` |
| Configuration | `config/knowledge-base/similarity.config.ts` | `similarityWeights`, `similarityParams` |
| Skill scoring | `services/similarity-calculator/scoring/skill-similarity.ts` | `calculateSkillSimilarity()` |
| Experience scoring | `services/similarity-calculator/scoring/experience-similarity.ts` | `calculateExperienceSimilarity()` |
| Domain scoring | `services/similarity-calculator/scoring/domain-similarity.ts` | `calculateDomainSimilarity()` |
| Timezone scoring | `services/similarity-calculator/scoring/timezone-similarity.ts` | `calculateTimezoneSimilarity()` |
| Diversity selection | `services/similarity-calculator/diversity-selector.ts` | `selectDiverseResults()` |
| Graph loading | `services/similarity-calculator/graph-loader.ts` | `loadSkillGraph()`, `loadDomainGraph()` |
| Service integration | `services/similarity.service.ts` | `findSimilarEngineers()` |

## Related Documentation

- **Theoretical foundations**: `thoughts/shared/1_chapter_5/3_project_3/research/2026-01-16-project-3-similarity-scoring.md`
- **Implementation plan**: `thoughts/shared/1_chapter_5/3_project_3/plans/`
