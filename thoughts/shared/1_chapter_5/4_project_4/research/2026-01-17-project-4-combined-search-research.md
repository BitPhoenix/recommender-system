---
date: 2026-01-17T10:30:00-08:00
researcher: Claude
git_commit: e248baa2928764640b5ff27a68ea810e56f0bab6
branch: project_3
repository: recommender-system
topic: "Project 4: Combined Search (Filter → Rank) - Foundational Research"
tags: [research, codebase, project-4, combined-search, constraint-filtering, similarity-ranking]
status: complete
last_updated: 2026-01-17
last_updated_by: Claude
last_updated_note: "Refined to use referenceEngineerId instead of idealProfile - cleaner design that maps to real workflow"
---

# Research: Project 4 - Combined Search (Filter → Rank)

**Date**: 2026-01-17T10:30:00-08:00
**Researcher**: Claude
**Git Commit**: e248baa2928764640b5ff27a68ea810e56f0bab6
**Branch**: project_3
**Repository**: recommender-system

## Research Question

How should Project 4 (Combined Search) be implemented given the existing codebase from Projects 1-3? What architectural patterns, services, and types already exist that can be leveraged?

## Summary

Project 4 combines **constraint-based filtering** (Section 5.2) with **case-based similarity ranking** (Section 5.3) into a unified search flow. The textbook describes these as two complementary approaches within knowledge-based recommender systems.

### The Three Endpoints Mental Model

| What you have | What you want | Endpoint | Ranking |
|---------------|---------------|----------|---------|
| Job requirements + **described preferences** | Engineers ranked by job fit | `/api/search/filter` | Utility (11 components) |
| Job requirements + **reference engineer** | Engineers similar to reference | `/api/search/filter-similarity` | Similarity (4 components) |
| Just a **reference engineer** | Similar engineers (no constraints) | `/api/engineers/:id/similar` | Similarity (4 components) |

**Key insight**: The `preferred*` fields in `/filter` ARE the "ideal profile" - you're describing what you want (Textbook Approach #2: desired attribute values). The value of `/filter-similarity` is different: "Don't make me describe what I want - I found someone who IS what I want, find more like them" (Textbook Approach #1: existing item as reference).

### Real-World Use Cases

**`/filter` (utility ranking)**: Recruiter is on a search UI, has a job spec with requirements and preferences, wants to find engineers who fit.

**`/filter-similarity` (similarity ranking)**: Recruiter found a great engineer (Marcus) but he's unavailable. Now they want to find more engineers like Marcus who also meet the job's hard requirements.

**`/engineers/:id/similar`**: Recruiter is looking at an engineer's profile and wants to see similar engineers, regardless of any specific job.

### New Endpoint Schema

```typescript
POST /api/search/filter-similarity
{
  // Hard constraints from the job - determines WHO qualifies
  requiredSkills?: SkillRequirement[],
  requiredSeniorityLevel?: SeniorityLevel,
  requiredMaxStartTime?: StartTimeline,
  requiredTimezone?: USTimezoneZone[],
  maxBudget?: number,
  stretchBudget?: number,
  requiredBusinessDomains?: BusinessDomainRequirement[],
  requiredTechnicalDomains?: TechnicalDomainRequirement[],

  // Reference engineer - determines HOW to RANK qualified candidates
  referenceEngineerId: string,  // Required - the engineer to find similar candidates to

  // Pagination
  limit?: number,
  offset?: number
}
```

**Key design choices**:
- No `preferred*` fields - those belong on `/filter` for utility scoring
- No `idealProfile` object - that would be redundant with `preferred*` fields
- Just `referenceEngineerId` - simple, practical, matches real workflow

---

## Detailed Findings

### 1. Project 4 Requirements from Learning Plan

**Endpoint**: `POST /api/search`

**Request Structure** (from learning plan):
```typescript
{
  // Hard constraints (filter) - dealbreakers
  constraints: {
    requiredSkills: ['React'],
    minExperience: 3,
    availability: ['immediate', 'two_weeks'],
    timezonePattern: 'America/*'
  },

  // Soft preferences (rank) - ideal profile
  preferences: {
    idealExperience: 5,
    bonusSkills: ['TypeScript', 'Next.js', 'GraphQL'],
    preferredDomain: 'SaaS',
    evidenceWeights: {
      assessment: 0.4,
      stories: 0.35,
      certifications: 0.25
    }
  }
}
```

**Response Structure**:
```typescript
{
  totalMatches: number,
  results: [
    {
      engineer: { id, name, ... },
      matchScore: number,              // Combined ranking score
      constraintsSatisfied: string[],  // Which hard constraints met
      preferenceBreakdown: {
        experienceMatch: number,       // Similarity to ideal experience
        bonusSkills: number,           // Coverage of preferred skills
        domainMatch: number,           // Domain alignment
        evidenceQuality: number        // Evidence-based confidence
      }
    }
  ]
}
```

**Textbook Sections**:
- 5.2.1 (Returning Relevant Results) - Hard constraint filtering
- 5.2.3 (Ranking the Matched Items) - Utility-based ranking
- 5.3.1 (Similarity Metrics) - Preference-based similarity scoring

---

### 2. Existing Constraint-Based Search (Project 1)

**Endpoint**: `POST /api/search/filter`

**Key Files**:
- Route: `src/routes/search.routes.ts`
- Controller: `src/controllers/search.controller.ts`
- Service: `src/services/search.service.ts`
- Schema: `src/schemas/search.schema.ts`
- Query Builder: `src/services/cypher-query-builder/search-query.builder.ts`

**Current Request Structure**:
The existing endpoint already distinguishes required vs preferred:
- `requiredSkills` / `preferredSkills`
- `requiredSeniorityLevel` / `preferredSeniorityLevel`
- `requiredMaxStartTime` / `preferredMaxStartTime`
- `requiredTimezone` / `preferredTimezone`
- `requiredBusinessDomains` / `preferredBusinessDomains`
- `requiredTechnicalDomains` / `preferredTechnicalDomains`

**Current Flow**:
1. Resolve skill IDs from names (with hierarchy expansion)
2. Expand constraints via knowledge base rules (inference engine)
3. Build Cypher query with WHERE clauses for hard filters
4. Execute query against Neo4j
5. Score results using utility calculator
6. Return ranked results with score breakdowns

**Constraint Types** (AppliedFilter discriminated union):
- `property` - Scalar constraints (yearsExperience, salary, timezone, timeline)
- `skill` - Skill matching with proficiency requirements

---

### 3. Existing Similarity Scoring (Project 3)

**Endpoint**: `GET /api/engineers/:id/similar`

**Key Files**:
- Route: `src/routes/similarity.routes.ts`
- Controller: `src/controllers/similarity.controller.ts`
- Service: `src/services/similarity.service.ts`
- Calculator: `src/services/similarity-calculator/similarity-calculator.ts`
- Config: `src/config/knowledge-base/similarity.config.ts`

**Similarity Weights**:
```typescript
export const similarityWeights = {
  skills: 0.45,           // Primary differentiator
  yearsExperience: 0.27,  // Seniority matters
  domain: 0.22,           // Industry context
  timezone: 0.06,         // Geographic proximity
};
```

**Scoring Modules**:
- `skill-similarity.ts` - Graph-aware best-match with correlations
- `experience-similarity.ts` - Asymmetric (more_is_better with alpha=0.5)
- `domain-similarity.ts` - Hierarchy-aware with years multiplier
- `timezone-similarity.ts` - Position-based distance

**Key Features**:
- Bidirectional similarity (average of A→B and B→A)
- Graph-aware: Uses CORRELATES_WITH, CHILD_OF, BELONGS_TO relationships
- Diversity selection: Bounded greedy algorithm to avoid homogeneous results

**Current Limitation**: Requires an existing engineer as the target. For Project 4, we need to score similarity against an **ideal profile** (preferences), not another engineer.

---

### 4. Existing Utility Calculator

**Key Files**:
- Calculator: `src/services/utility-calculator/utility-calculator.ts`
- Types: `src/services/utility-calculator/types.ts`
- Config: `src/config/knowledge-base/utility.config.ts`
- Scoring: `src/services/utility-calculator/scoring/`

**Current Weights** (sum to 1.0):
```typescript
export const utilityWeights = {
  // Core attributes
  skillMatch: 0.37,
  confidence: 0.14,
  experience: 0.11,

  // Preference matches
  startTimelineMatch: 0.10,
  preferredSkillsMatch: 0.08,
  relatedSkillsMatch: 0.04,
  preferredTimezoneMatch: 0.02,
  teamFocusMatch: 0.04,
  preferredBusinessDomainMatch: 0.02,
  preferredTechnicalDomainMatch: 0.02,
  preferredSeniorityMatch: 0.03,
  budgetMatch: 0.03,
};
```

**Scoring Function Types**:
- LINEAR: Confidence scores
- LOGARITHMIC: Experience (diminishing returns)
- GRADUATED: Skill proficiency matching
- THRESHOLD: Timeline matching with degradation
- RATIO: Skill/domain coverage
- EXPONENTIAL DECAY: Related skills (diminishing returns)
- BINARY: Seniority matching

**Key Pattern**: Each component returns raw + weighted score, assembled into breakdown for transparency.

---

### 5. API Patterns and Types

**Validation Pattern**:
- Zod schemas define both validation and types (single source of truth)
- `validate()` middleware for body validation
- `validateParams()` and `validateQuery()` for path/query params
- Custom `.refine()` rules for cross-field validation

**Service Composition**:
- Controllers create Neo4j sessions, call services, return responses
- Services orchestrate sub-services in clear sequence
- Neo4j sessions are sequential (not thread-safe for concurrent queries)

**Response Pattern**:
- Success: Domain-specific response object
- Error: `{ error: { code, message, details? } }`
- Validation Error: Zod error format

---

## Architectural Decision: Two Routes with Distinct Purposes

### Context

We considered several approaches for implementing Project 4:

1. **Single endpoint with `rankingMode`**: Add a parameter to switch between utility and similarity scoring
2. **Two routes with `idealProfile` object**: `/filter` (utility) and `/filter-similarity` with constructed profile
3. **Two routes with `referenceEngineerId`**: `/filter` (utility) and `/filter-similarity` with real engineer reference
4. **Combined scoring**: Blend utility + similarity into a single score

### Decision

**Two routes with `referenceEngineerId`**: Keep `/api/search/filter` unchanged, add `/api/search/filter-similarity` that takes a reference engineer ID.

### Key Insight: `preferred*` Fields ARE the Ideal Profile

The textbook (p.181-182) describes two ways to specify a target:
1. **Desired attribute values**: "3 bedrooms, $500k, suburban"
2. **Existing item as reference**: "Find houses like this one"

We realized that **Approach #1 is already implemented** via the `preferred*` fields in `/filter`:
- `preferredSkills` - The skills you ideally want
- `preferredSeniorityLevel` - The seniority you ideally want
- `preferredTimezone` - The timezones you ideally want
- etc.

These fields describe your ideal candidate. The utility function scores how well each engineer matches this description.

**Therefore**: Adding an `idealProfile` object would be redundant with `preferred*` fields - both are ways of describing what you want.

**The value of `/filter-similarity`** is Approach #2: "I found an engineer who IS what I want, find more like them." This requires a `referenceEngineerId`, not a constructed profile.

### Rationale

#### 1. Clean Separation of Concerns

| Route | Input | Question Answered |
|-------|-------|-------------------|
| `/filter` | `required*` + `preferred*` | "How well does this engineer match my described requirements?" |
| `/filter-similarity` | `required*` + `referenceEngineerId` | "How similar is this engineer to the one I already like?" |

No overlap, no confusion.

#### 2. Matches Real Recruiting Workflow

**Scenario for `/filter`**: Recruiter opens search UI, enters job requirements and preferences, browses results.

**Scenario for `/filter-similarity`**: Recruiter found Marcus (great fit but unavailable). They want more engineers like Marcus who also meet the job's hard constraints. They pass Marcus's ID as the reference.

#### 3. Utility and Similarity Use Different Dimensions

| Aspect | Utility (`/filter`) | Similarity (`/filter-similarity`) |
|--------|---------------------|-----------------------------------|
| **Components** | 11 weighted attributes | 4 attributes |
| **Includes** | Skills, confidence, timeline, budget, domains, team focus, seniority | Skills, experience, domain, timezone |
| **Intentionally excludes** | (nothing) | Timeline, salary, confidence |

Similarity scoring excludes transient factors:
- **Timeline**: Changes when projects end - not a capability attribute
- **Salary**: Budget constraint, not capability - ranking by salary would be unfair

#### 4. Simpler API

Instead of:
```typescript
idealProfile: {
  skills: ['TypeScript', 'React', 'GraphQL'],
  yearsExperience: 5,
  businessDomains: ['SaaS'],
  technicalDomains: ['Web Development'],
  timezone: 'Pacific'
}
```

Just:
```typescript
referenceEngineerId: 'eng_marcus'
```

The system looks up Marcus's actual skills, experience, domains, and timezone. No need to manually construct a profile.

#### 5. Reuses Existing Similarity Infrastructure

The `/api/engineers/:id/similar` endpoint already computes similarity to a real engineer. The new `/filter-similarity` endpoint adds constraint filtering BEFORE similarity ranking - same similarity logic, just with a filter step first.

### Alternatives Considered

#### `idealProfile` Object Instead of `referenceEngineerId`

```typescript
idealProfile: {
  skills: ['TypeScript', 'React'],
  yearsExperience: 5,
  ...
}
```

**Why rejected**:
- Redundant with `preferred*` fields - both describe what you want
- More complex request (construct an object vs pass an ID)
- Doesn't match real workflow (recruiters find a good engineer, want more like them)
- Could be added later if there's a use case for hypothetical profiles

#### Single Endpoint with `rankingMode`

```typescript
POST /api/search/filter
{
  rankingMode: 'similarity',
  referenceEngineerId: 'eng_marcus',
  preferredSkills: [...]  // Would this be ignored?
}
```

**Why rejected**:
- Confusion about which fields apply in which mode
- `preferred*` fields would be ignored in similarity mode but still accepted
- Complex conditional validation
- Unclear API contract

#### Combined Utility + Similarity Score

```typescript
combinedScore = α × utilityScore + (1-α) × similarityScore
```

**Why rejected** (for now):
- Utility includes dimensions (budget, timeline) that similarity intentionally excludes
- Combining creates a score with unclear meaning
- Can be added later as `/api/search/filter-combined` if there's demand

---

## Textbook Alignment Analysis

### How This Design Maps to Chapter 5

The textbook (Chapter 5) presents two main approaches to knowledge-based recommendation:

#### Section 5.2 - Constraint-Based Recommender Systems

> "In constraint-based systems, specific requirements (or constraints) are specified by the user" (p.169)

**Our implementation**: `/api/search/filter`
- `required*` fields → Hard constraints (WHERE clauses)
- `preferred*` fields → Utility function inputs (describing the ideal)
- `utilityScore` → Ranking via U(V) = Σ w_j · f_j(v_j)

This is **pure Section 5.2**: filter by constraints, rank by utility.

#### Section 5.3 - Case-Based Recommender Systems

> "In case-based recommender systems, specific cases are specified by the user as targets or anchor points. Similarity metrics are defined on the item attributes to retrieve similar items to these targets." (p.169)

**Our implementation**: `/api/search/filter-similarity`
- `referenceEngineerId` → The "target case" (real engineer as anchor point)
- `similarityScore` → Ranking via Similarity(T, X) = Σ w_i · Sim(t_i, x_i)

This is a **hybrid of 5.2 + 5.3**: filter by constraints (5.2), rank by similarity to target (5.3).

#### The Textbook Explicitly Endorses Hybrid Approaches

> "Some forms of guidance can be used with both constraint-based and case-based systems. Furthermore, different forms of guidance can also be used **in combination** in a knowledge-based system." (p.170)

Our `/filter-similarity` endpoint is exactly this combination:
- **From 5.2**: Hard constraint filtering (`required*` fields)
- **From 5.3**: Similarity ranking to a target (`referenceEngineerId`)

### Two Ways to Specify a Target (Section 5.3.1)

The textbook (p.181-182) describes two ways users can specify targets:

1. **An existing item as reference**: "Find houses like this one"
2. **Desired attribute values**: "3 bedrooms, $500k, suburban"

**Key realization**: We implement BOTH approaches, but in different endpoints:

| Approach | Textbook | Our Implementation |
|----------|----------|-------------------|
| #1: Existing item as reference | "Find houses like this one" | `/filter-similarity` with `referenceEngineerId` |
| #2: Desired attribute values | "3 bedrooms, $500k" | `/filter` with `preferred*` fields |

The `preferred*` fields ARE Approach #2 - they describe what you want. An `idealProfile` object would be redundant.

### Complete Coverage of Section 5.3.1

| Endpoint | Target Specification | Constraints |
|----------|---------------------|-------------|
| `/api/engineers/:id/similar` | Real engineer (Approach #1) | None |
| `/api/search/filter` | Described preferences (Approach #2) | Yes (`required*`) |
| `/api/search/filter-similarity` | Real engineer (Approach #1) | Yes (`required*`) |

This gives users flexibility:
- Pure similarity without constraints
- Described preferences with constraints (utility)
- Reference engineer with constraints (similarity)

### Similarity Metrics (Section 5.3.1)

The textbook formula (Equation 5.2, p.184):

```
f(T, X) = Σ w_i · Sim(t_i, x_i) / Σ w_i
```

**Our implementation** (from Project 3):
- Skills: 0.45 weight - Graph-aware best-match with correlations
- Experience: 0.27 weight - Asymmetric (more_is_better, Equation 5.5)
- Domain: 0.22 weight - Hierarchy-aware matching
- Timezone: 0.06 weight - Position-based distance

The asymmetric experience scoring directly implements **Equation 5.5** (p.184):
> "For the case of attributes in which larger values are better, an example of a possible similarity function is [asymmetric reward for overshooting]"

### Intentional Exclusions from Similarity

The textbook emphasizes domain-specific design (p.185):
> "The specific form of the similarity function may be different... depending on the data domain. It is here that the domain expert has to invest a significant amount of time in deciding how to model the specific problem setting."

Our similarity scoring **intentionally excludes** timeline and salary:
- **Timeline**: Transient property (changes when projects end) - not a capability
- **Salary**: Budget constraint, not capability - ranking by salary would be unfair

This is a deliberate domain modeling decision for the talent marketplace.

### Why This Is Good Pedagogy

| Concept | Textbook Section | Our Implementation |
|---------|------------------|-------------------|
| Hard constraints | 5.2.1 | `required*` fields (both endpoints) |
| Knowledge base expansion | 5.2.1 | Inference engine, skill hierarchy |
| Utility ranking (described preferences) | 5.2.3 | `/filter` with `preferred*` → `utilityScore` |
| Target case: existing item | 5.3 (p.181) Approach #1 | `referenceEngineerId` |
| Target case: desired attributes | 5.3 (p.181) Approach #2 | `preferred*` fields (already have this!) |
| Similarity metrics | 5.3.1 | `/filter-similarity` → `similarityScore` |
| Asymmetric similarity | 5.3.1 (Eq. 5.5) | Experience scoring (more_is_better) |
| Domain hierarchies | 5.3.1 (p.185) | Graph-aware skill/domain similarity |
| Hybrid approaches | 5.1 (p.170) | Filter (5.2) + Similarity rank (5.3) |

The design demonstrates that the textbook's two target specification approaches map naturally to different use cases, not to a single endpoint with options.

---

## Additional Design Decisions

### Evidence Weights (Deferred)

The learning plan mentions `evidenceWeights`:
```typescript
evidenceWeights: {
  assessment: 0.4,
  stories: 0.35,
  certifications: 0.25
}
```

This is **not currently implemented**. The codebase has assessment attempts, interview stories, and certifications, but scoring doesn't weight by evidence type.

**Decision**: Defer to a future project. The core Project 4 learning concepts (constraint filtering + similarity ranking) can be implemented without this. Evidence weighting could be Project 4.5 or integrated into Project 6 (Explanation Generation).

### Response Structure Differences

Each endpoint returns a score type matching its ranking approach. Both use `scoreBreakdown` for consistency - the score type is already indicated by the score field name.

**`/api/search/filter` response**:
```typescript
{
  utilityScore: 0.82,
  scoreBreakdown: {
    skillMatch: 0.37,
    confidence: 0.14,
    experience: 0.11,
    // ... 11 components total
  }
}
```

**`/api/search/filter-similarity` response**:
```typescript
{
  similarityScore: 0.78,
  scoreBreakdown: {
    skills: 0.45,
    yearsExperience: 0.27,
    domain: 0.22,
    timezone: 0.06
  },
  sharedSkills: ['React', 'TypeScript'],
  // Diagnostic info for transparency
}
```

### Diversity Selection

**Decision**: Apply diversity selection to `/filter-similarity` results (same as `/engineers/:id/similar`).

**Rationale**: Section 5.3.1.1 (p.187) discusses the bounded greedy selection strategy to avoid returning homogeneous results. This is important for case-based recommendations where similar candidates might cluster.

---

## Implementation Approach

### Proposed Architecture

```
POST /api/search/filter-similarity
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  1. Validate Request (Zod schema)                   │
│     - required* fields: hard constraints            │
│     - referenceEngineerId: similarity target        │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  2. Load Reference Engineer (REUSE graph-loader)    │
│     - Fetch engineer data from Neo4j                │
│     - Return 404 if not found                       │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  3. Expand Constraints (REUSE constraint-expander)  │
│     - Skill hierarchy resolution                    │
│     - Knowledge base rule application               │
│     - Inference engine derivation                   │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  4. Execute Filter Query (REUSE search-query.builder)│
│     - Build Cypher WHERE clauses from required*     │
│     - Exclude the reference engineer from results   │
│     - Return qualifying candidates                  │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  5. Load Graphs (REUSE graph-loader)                │
│     - Skill graph (correlations, categories)        │
│     - Domain graph (hierarchies)                    │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  6. Calculate Similarity Scores (REUSE)             │
│     - Skill similarity (graph-aware)                │
│     - Experience similarity (asymmetric)            │
│     - Domain similarity (hierarchy-aware)           │
│     - Timezone similarity (position-based)          │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  7. Apply Diversity Selection (REUSE)               │
│     - Bounded greedy algorithm                      │
│     - Prevent homogeneous results                   │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  8. Return Results                                  │
│     - Sort by similarityScore                       │
│     - Include scoreBreakdown                        │
│     - Include appliedFilters (for transparency)     │
│     - Include reference engineer info               │
└─────────────────────────────────────────────────────┘
```

### Reusable Components

| Component | Reusability | Notes |
|-----------|-------------|-------|
| `constraint-expander.service.ts` | **Full** | Works with `required*` fields unchanged |
| `search-query.builder.ts` | **Full** | Generates Cypher from constraints (minor tweak to exclude reference) |
| `skill-resolution.service.ts` | **Full** | Resolves skill names to IDs |
| `graph-loader.ts` | **Full** | Load skill/domain graphs AND reference engineer data |
| `similarity-calculator/scoring/` | **Full** | All 4 scoring modules work as-is |
| `diversity-selector.ts` | **Full** | Bounded greedy selection |
| `similarity.config.ts` | **Full** | Weights and parameters |
| `similarity.service.ts` | **Partial** | Core logic reusable, just different candidate source |

### New Components Needed

1. **`FilterSimilarityRequestSchema`**: Zod schema with `required*` fields + `referenceEngineerId`
2. **`filter-similarity.service.ts`**: Orchestrates filter → similarity flow
3. **Route + Controller**: Standard Express setup

### Key Simplification: No Profile Adapter Needed

Unlike an `idealProfile` object approach, using `referenceEngineerId` means:
- We load a real engineer using existing `loadEngineerData()` from `graph-loader.ts`
- The engineer data is already in `EngineerForSimilarity` format
- No conversion or adaptation needed
- Real skill proficiencies, real domain years, real everything

This is simpler and more accurate than constructing a synthetic profile.

### Relationship to Existing `/engineers/:id/similar`

The new endpoint shares most logic with the existing similarity endpoint:

```
/engineers/:id/similar (existing)
├── Load reference engineer          ← REUSE
├── Load ALL other engineers         ← REPLACE with filtered candidates
├── Load graphs                       ← REUSE
├── Calculate similarity scores       ← REUSE
├── Apply diversity selection         ← REUSE
└── Return results                    ← REUSE (add appliedFilters)

/search/filter-similarity (new)
├── Validate request with constraints
├── Load reference engineer          ← REUSE from similarity.service
├── Expand constraints               ← REUSE from search.service
├── Execute filter query             ← REUSE from search.service (exclude reference)
├── Load graphs                       ← REUSE from similarity.service
├── Calculate similarity scores       ← REUSE from similarity.service
├── Apply diversity selection         ← REUSE from similarity.service
└── Return results                    ← Combined format
```

The main difference: candidate source is filtered query results instead of all engineers.

---

## Comparison: The Three Endpoints

| Aspect | `/api/search/filter` | `/api/search/filter-similarity` | `/api/engineers/:id/similar` |
|--------|------------------------------|-------------------------|-------------------------|
| **Purpose** | Job requirements matching | Find more like a good engineer | Pure similarity |
| **Question answered** | "How well does this engineer fit my job?" | "Who's similar to Marcus AND meets job requirements?" | "Who's similar to Marcus?" |
| **Hard constraints** | `required*` fields | `required*` fields | None |
| **Ranking input** | `preferred*` fields | `referenceEngineerId` | Path parameter `:id` |
| **Score type** | `utilityScore` | `similarityScore` | `similarityScore` |
| **Components** | 11 weighted attributes | 4 attributes | 4 attributes |
| **Includes** | Budget, timeline, confidence, team focus | Skills, experience, domain, timezone | Skills, experience, domain, timezone |
| **Diversity** | No | Yes (bounded greedy) | Yes (bounded greedy) |
| **Textbook section** | 5.2 (Constraint-based) | 5.2 + 5.3 (Hybrid) | 5.3 (Case-based) |
| **Target approach** | Described preferences (Approach #2) | Real engineer (Approach #1) | Real engineer (Approach #1) |

---

## Resolved Questions

1. **Evidence Weights**: Deferred to future project. Core learning concepts don't require it.

2. **Score Interpretation**: Both scores are 0-1 normalized (similarity already is; utility is weighted sum of 0-1 components).

3. **Timezone Pattern**: Keep existing zone array (`['Eastern', 'Central', 'Mountain', 'Pacific']`). No glob patterns needed.

4. **Diversity Selection**: Yes, apply to `/filter-similarity` (matches textbook Section 5.3.1.1).

5. **Relationship to Existing Endpoint**: `/api/search/filter` remains unchanged. New `/api/search/filter-similarity` is additive.

---

## Code References

### Constraint-Based Search
- `src/routes/search.routes.ts:6` - Route definition
- `src/controllers/search.controller.ts:9` - Controller
- `src/services/search.service.ts:28` - Main orchestration
- `src/services/constraint-expander.service.ts:45` - Constraint expansion
- `src/services/cypher-query-builder/search-query.builder.ts:15` - Cypher generation

### Similarity Scoring
- `src/routes/similarity.routes.ts:8` - Route definition
- `src/services/similarity.service.ts:12` - Service
- `src/services/similarity-calculator/similarity-calculator.ts:18` - Core calculator
- `src/config/knowledge-base/similarity.config.ts:1` - Weights config

### Utility Calculator
- `src/services/utility-calculator/utility-calculator.ts:25` - Main calculator
- `src/services/utility-calculator/types.ts:1` - Type definitions
- `src/config/knowledge-base/utility.config.ts:1` - Weights config

### Types and Schemas
- `src/types/search.types.ts:1` - Search type definitions
- `src/schemas/search.schema.ts:1` - Zod validation schemas

---

## Related Research

- `thoughts/shared/1_chapter_5/3_project_3/research/2026-01-16-project-3-similarity-scoring.md` - Similarity implementation details

---

## Textbook Reference Summary

### Section 5.1 - Introduction (p.167-170)
- Knowledge-based systems for complex, customized items
- Cold-start advantages over collaborative filtering
- Two main approaches: constraint-based and case-based
- **Key quote (p.170)**: "Different forms of guidance can also be used in combination in a knowledge-based system"

### Section 5.2 - Constraint-Based Recommender Systems (p.170-179)
- **5.2.1 - Returning Relevant Results**: Iterative constraint expansion via knowledge base rules
- **5.2.3 - Ranking the Matched Items**: Utility functions U(V) = Σ w_j · f_j(v_j)
- **Our implementation**: `/api/search/filter` with `required*` + `preferred*` fields

### Section 5.3 - Case-Based Recommender Systems (p.179-194)
- **5.3.1 - Similarity Metrics (p.181-187)**:
  - Weighted attribute similarity: f(T, X) = Σ w_i · Sim(t_i, x_i)
  - **Equation 5.5 (p.184)**: Asymmetric similarity for "more is better" attributes
  - **p.185**: Domain hierarchies for categorical similarity
  - Two ways to specify targets: existing item OR desired attributes
- **5.3.1.1 - Diversity (p.187-188)**: Bounded greedy selection to avoid homogeneous results
- **Our implementation**: `/api/search/filter-similarity` with `required*` + `idealProfile`

### How Our Design Maps to the Textbook

```
                    Chapter 5: Knowledge-Based Recommender Systems
                    ├── Section 5.2: Constraint-Based
                    │   ├── 5.2.1: Filtering    ─────────┐
                    │   └── 5.2.3: Utility Ranking ──────┼──→ /api/search/filter
                    │                                    │
                    └── Section 5.3: Case-Based          │
                        ├── 5.3.1: Similarity Metrics ───┼──→ /api/search/filter-similarity
                        └── 5.3.1.1: Diversity ──────────┘    (hybrid: filter + similarity rank)
```
