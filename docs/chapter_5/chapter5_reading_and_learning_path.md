# Learning Path: Knowledge-Based Recommender Systems for Talent Marketplace

**Project Status Legend:** ✅ Complete | ⏳ Planned

## Domain Context

Engineering managers search for full-time software engineers. Key search dimensions:

- Skills (technical, behavioral, domain knowledge)
- Years of experience
- Availability (immediate, two weeks, one month)
- Timezone

---

## Phase 1: Foundation Concepts

**Read:** Section 5.1 (Introduction)

Understand why knowledge-based systems fit this domain:

- Engineers are high-value — you don't spam candidates
- Managers have explicit requirements they can articulate
- Cold-start is common (new engineers have no interaction history)
- Domain knowledge matters (skill relationships, what seniority means)

---

## Phase 2: Constraint-Based Systems (5.2)

**Read:** 5.2 → 5.2.1 → 5.2.2 → 5.2.3 → 5.2.4 → 5.2.5

### Project 1: Basic Constraint Search API ✅

**Textbook Sections:** 5.2.1 (Returning Relevant Results), 5.2.2 (Interaction Approach), 5.2.3 (Ranking the Matched Items)

Build `POST /api/search/filter` that translates manager requirements into Cypher queries.

**Features:**

- Accept manager input in their language (seniorityLevel, teamFocus, riskTolerance)
- Apply knowledge base rules to expand into engineer attributes
- Required skills matching using hierarchy (`:CHILD_OF` traversal)
- Minimum confidence scores
- Years of experience range
- Availability, timezone filtering

**Example Request:**

```typescript
{
  seniorityLevel: 'senior',
  requiredSkills: ['Backend'],
  availability: ['immediate', 'two_weeks'],
  timezone: 'America/*'
}
```

**Example Response:**

```typescript
{
  matches: [
    { id: 'eng_priya', name: 'Priya Sharma', ... },
    { id: 'eng_marcus', name: 'Marcus Chen', ... }
  ],
  appliedConstraints: [
    'yearsExperience >= 6 AND yearsExperience < 10',
    'skill IN descendantsOf("Backend")',
    'availability IN ["immediate", "two_weeks"]',
    'timezone STARTS WITH "America/"'
  ]
}
```

---

#### Project 1: Implementation Summary

**Status**: Complete | **Duration**: Dec 30, 2025 - Jan 6, 2026 | **Branch**: `chapter_5_project_1`

Built a **constraint-based recommender system** for matching software engineers to job requirements. The system allows hiring managers to specify required and preferred criteria, then returns ranked candidates with full transparency into how scores were computed.

**What Was Built:**

- **Hard filters** (required): `requiredSkills`, `requiredMaxSalary`, `requiredBusinessDomains`, `requiredSeniority`
- **Soft rankings** (preferred): `preferredSkills`, `preferredTimezone`, `preferredSeniority`, `preferredSalaryRange`, etc.
- **Skill hierarchy traversal**: "Frontend" expands to React, Vue, Angular, etc. via `:CHILD_OF` relationships
- **Multi-attribute utility scoring** with 11 weighted components (skills 25%, confidence 14%, salary 7%, etc.)
- **Score transparency**: Full breakdowns showing raw/weighted scores per component

**Key Design Decisions:**
- Required vs preferred separation reflects real hiring (non-negotiables vs nice-to-haves)
- Graduated proficiency scoring: expert preferred but proficient found = 67% credit (not 0%)
- Salary exponential decay: 10% over budget = 71% score, 20% over = 50%
- Confidence for ranking only (14% weight), never filters

**Architecture (post-refactoring):**
- `constraint-expander.service.ts` - Skill/domain hierarchy expansion
- `search-query.service.ts` - Cypher query building
- `utility-calculator/` - Multi-attribute scoring with separate core/logistics modules

---

### Project 1.1: Testing Infrastructure ✅

**Duration**: Jan 6, 2026 | **Branch**: `main`

Established comprehensive testing infrastructure for the recommender API.

**What Was Built:**

- **Vitest setup** for ESM + TypeScript
- **Unit tests** for:
  - All pure scoring functions (~13 functions)
  - Constraint expansion functions
  - Zod validation schemas
  - Utility calculator orchestration
  - Inference engine components

- **Newman/Postman E2E tests** with 62 test scenarios, 215+ assertions

**Test Commands:**
```bash
npm test              # Unit/integration tests
npm run test:coverage # Coverage report
npm run test:e2e      # E2E tests (requires Tilt)
```

---

### Project 1.5: Iterative Requirement Expansion (Inference Engine) ✅

**Textbook Sections:** 5.2.1 (Returning Relevant Results)

**Duration**: Dec 31, 2025 - Jan 8, 2026 | **Branch**: `main`

Implements **iterative requirement expansion** (Section 5.2.1) using a rules-based inference engine. When a hiring manager specifies high-level needs like "scaling focus" or "senior level," the inference engine **automatically expands these requirements** by deriving implied skills and preferences.

**What Was Built:**

- **Forward-chaining inference** with json-rules-engine
  - Rules iterate until fixpoint (no new values derived)
  - Supports multi-hop skill chains (scaling → distributed → monitoring)

- **Dual rule types** in separate config files:
  - `filter-rules.config.ts`: Hard requirements (X-requires-Y)
  - `boost-rules.config.ts`: Soft preferences (X-prefers-Y)

- **Three override mechanisms**:
  - Explicit: `overriddenRuleIds` in request
  - Implicit field: User sets target field directly
  - Implicit skill: User handles target skill(s)

- **Derivation chain provenance**: 2D arrays tracking all causal paths for debugging

**Example Chain:**
```
teamFocus=scaling
    ↓ (scaling-requires-distributed)
skill_distributed added
    ↓ (distributed-requires-observability)
skill_monitoring added
```

**Key Design Decisions:**
- json-rules-engine over custom loop (JSON-serializable, extensible)
- Separate `requiredProperties` vs `preferredProperties` containers
- 2D derivation chains for multi-trigger rules

---

### Project 2: Constraint Relaxation and Repair Proposals ✅

**Textbook Sections:** 5.2.4 (Handling Unacceptable Results or Empty Sets), 5.2.5 (Adding Constraints)

Build `POST /api/search/diagnose` that handles empty or sparse result sets.

#### Part A: Detect Minimal Inconsistent Sets

When zero results are returned, find the smallest combinations of constraints that conflict:

```typescript
interface ConflictSet {
  constraints: string[];  // e.g., ['minYearsExperience >= 10', 'availability = immediate']
  explanation: string;    // human-readable why these conflict
}
```

#### Part B: Generate Relaxation Suggestions

For each constraint in a conflict set, show what happens if you relax it:

```typescript
interface RelaxationOption {
  constraint: string;       // which constraint to change
  currentValue: any;        // what they specified
  suggestedValue: any;      // what we suggest
  resultingMatches: number; // how many engineers this yields
}
```

#### Part C: Algorithm

1. Start with full constraint set → 0 results
2. Remove one constraint at a time, check if results > 0
3. If removing constraint X gives results, X is part of a conflict
4. Find smallest subsets where removal yields results
5. Present these as minimal conflict sets

**Example Request:**

```typescript
{
  requiredSkills: ['Kubernetes', 'Kafka'],
  minConfidenceScore: 0.9,
  minYearsExperience: 10,
  availability: 'immediate'
}
```

**Example Response:**

```typescript
{
  matches: 0,
  diagnosis: {
    conflictSets: [
      {
        constraints: [
          'minYearsExperience >= 10',
          'availability = "immediate"'
        ],
        explanation: 'Only 1 engineer has 10+ years, and they are not immediately available.'
      },
      {
        constraints: [
          'skill("Kubernetes").confidence >= 0.9',
          'skill("Kafka").confidence >= 0.9'
        ],
        explanation: 'No engineers have 0.9+ confidence in both Kubernetes AND Kafka.'
      }
    ],
    relaxationSuggestions: [
      {
        constraint: 'minYearsExperience',
        currentValue: 10,
        suggestedValue: 7,
        resultingMatches: 2
      },
      {
        constraint: 'minConfidenceScore',
        currentValue: 0.9,
        suggestedValue: 0.8,
        resultingMatches: 3
      },
      {
        constraint: 'availability',
        currentValue: 'immediate',
        suggestedValue: 'two_weeks',
        resultingMatches: 1
      }
    ]
  }
}
```

**What Was Implemented:**

- **Threshold-based decision logic**:
  - < 3 results → Relaxation analysis (QUICKXPLAIN + suggestions)
  - 3-24 results → No advice needed (goldilocks zone)
  - >= 25 results → Tightening analysis (distribution-based suggestions)

- **QUICKXPLAIN algorithm** for minimal conflict sets:
  - O(k·log(n/k)) query complexity
  - Hitting set approach to find up to 3 distinct MCS
  - Each MCS is independently actionable

- **Five relaxation strategies**: NumericStep (budget), EnumExpand (timeline), Remove (timezone), DerivedOverride (inference rules), SkillRelaxation (proficiency/preferred/remove)

- **Five tightening dimensions**: Timezone, Seniority, Budget, Timeline, Skills (with strictness filtering)

- **40-engineer seed data** expansion for realistic conflict scenarios

**Type System Highlights:**
- Three-level discriminated unions throughout (AppliedFilter, TestableConstraint, RelaxationSuggestion)
- No `as` casts needed - TypeScript enforces correct field access
- Separate API types (AppliedFilter) vs internal types (TestableConstraint)

---

### Project 2.5: Local LLM Integration for Conflict Explanations ✅

**Textbook Sections:** 5.2.4 (Handling Unacceptable Results or Empty Sets)

**Duration**: Jan 15-16, 2026 | **Branch**: `project_2.5`

Integrated a **local LLM (Ollama)** to generate richer, domain-aware conflict explanations using a **dual-explanation approach**.

**What Was Built:**

- **Dual explanation fields** in conflict response:
  - `dataAwareExplanation`: Fast (~50ms), factual template using actual DB statistics
  - `llmExplanation`: RAG-enhanced LLM explanation with reasoning and alternatives

- **Conflict statistics service**: Queries actual database counts/ranges per constraint type:
  - Skill stats (exact + lower proficiency counts)
  - Salary stats (matching count + DB range)
  - Years experience stats (seniority bucket distribution)
  - Timezone/timeline stats (distribution breakdown)

- **Ollama integration** via `ollama` npm package:
  - Connection caching to avoid repeated health checks
  - Graceful degradation (template always works, LLM may return null)
  - Configurable via `LLM_HOST`, `LLM_MODEL`, `LLM_ENABLED`, `LLM_TIMEOUT_MS`
  - Runs on host machine (not K8s) to access Apple Silicon GPU

**Why Both Explanations?**

| Capability | Template | LLM |
|------------|----------|-----|
| Explain *what* conflicts | ✓ | ✓ |
| Explain *why* it conflicts | Limited | ✓ |
| Suggest alternatives | ❌ | ✓ |
| Market/temporal awareness | ❌ | ✓ |

---

## Phase 3: Case-Based Recommenders (5.3)

**Read:** 5.3 → 5.3.1 → 5.3.2 (all subsections) → 5.3.3

### Project 3: Similarity Scoring ⏳

**Textbook Sections:** 5.3.1 (Similarity Metrics), 5.3.1.1 (Incorporating Diversity in Similarity Computation)

Build `GET /api/engineers/:id/similar` that computes similarity between engineers.

**Features:**

- Weighted attribute similarity
- Asymmetric similarity functions (more experience = okay, less = penalized)
- Skill correlation bonuses via `:CORRELATES_WITH`
- Configurable weights per attribute

**Similarity Function Components:**

```typescript
interface SimilarityWeights {
  skills: number;           // 0.40
  yearsExperience: number;  // 0.25
  domain: number;           // 0.20
  availability: number;     // 0.15
}

interface SimilarityConfig {
  weights: SimilarityWeights;
  experienceTarget: number;  // e.g., 5 years
  experienceAsymmetry: 'more_is_better' | 'less_is_better' | 'symmetric';
  includeCorrelatedSkills: boolean;
  correlationMinStrength: number;  // e.g., 0.7
}
```

**Example Request:**

```
GET /api/engineers/eng_priya/similar?limit=5
```

**Example Response:**

```typescript
{
  target: { id: 'eng_priya', name: 'Priya Sharma' },
  similar: [
    {
      engineer: { id: 'eng_james', name: 'James Okonkwo' },
      similarityScore: 0.82,
      breakdown: {
        skills: 0.85,
        yearsExperience: 0.75,
        domain: 0.90,
        availability: 0.70
      }
    },
    ...
  ]
}
```

---

### Project 4: Combined Search (Filter → Rank) ⏳

**Textbook Sections:** 5.2.1 (Returning Relevant Results), 5.2.3 (Ranking the Matched Items), 5.3.1 (Similarity Metrics)

Build `POST /api/search` that combines constraint filtering with similarity ranking.

**Features:**

- Accept hard constraints (dealbreakers) and soft preferences (ideal profile)
- Filter using constraints first
- Rank remaining candidates by similarity to preferences
- Return ranked results with match scores

**Example Request:**

```typescript
{
  // Hard constraints (filter)
  constraints: {
    requiredSkills: ['React'],
    minExperience: 3,
    availability: ['immediate', 'two_weeks'],
    timezonePattern: 'America/*'
  },

  // Soft preferences (rank)
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

**Example Response:**

```typescript
{
  totalMatches: 3,
  results: [
    {
      engineer: { id: 'eng_marcus', name: 'Marcus Chen', ... },
      matchScore: 0.92,
      constraintsSatisfied: ['React', '5 years', 'immediate', 'America/Los_Angeles'],
      preferenceBreakdown: {
        experienceMatch: 1.0,   // exactly 5 years
        bonusSkills: 0.67,      // has 2 of 3
        domainMatch: 1.0,       // SaaS experience
        evidenceQuality: 0.85
      }
    },
    {
      engineer: { id: 'eng_emily', name: 'Emily Nakamura', ... },
      matchScore: 0.78,
      ...
    },
    ...
  ]
}
```

---

### Project 5: Critiquing System ⏳

**Textbook Sections:** 5.3.2 (Critiquing Methods), 5.3.2.1 (Simple Critiques), 5.3.2.2 (Compound Critiques), 5.3.2.3 (Dynamic Critiques)

Build `POST /api/search/critique` for conversational refinement of search results.

#### Part A: Simple Critiques

Single attribute adjustments:

```typescript
{
  baseSearch: { /* previous search */ },
  critique: {
    type: 'simple',
    attribute: 'yearsExperience',
    direction: 'more'  // or 'less', 'different'
  }
}
```

#### Part B: Compound Critiques

Multiple attribute adjustments:

```typescript
{
  baseSearch: { /* previous search */ },
  critique: {
    type: 'compound',
    adjustments: [
      { attribute: 'yearsExperience', direction: 'more' },
      { attribute: 'availability', direction: 'sooner' }
    ]
  }
}
```

#### Part C: Dynamic Critique Suggestions

Analyze current results and suggest useful critiques:

```typescript
// Response includes suggested critiques
{
  results: [...],
  suggestedCritiques: [
    {
      critique: { attribute: 'domain', value: 'Fintech' },
      description: 'Add Fintech experience',
      resultingMatches: 2,
      support: 0.4  // 40% of current results have this
    },
    {
      critique: { attribute: 'yearsExperience', direction: 'less' },
      description: 'Consider less experienced candidates',
      resultingMatches: 5,
      support: 0.6
    }
  ]
}
```

---

### Project 6: Explanation Generation ⏳

**Textbook Sections:** 5.3.3 (Explanation in Critiques)

Build `GET /api/engineers/:id/explain?searchId=:searchId` that explains why an engineer matches.

**Features:**

- Explain which constraints were satisfied and how
- Show evidence supporting each skill claim
- Highlight tradeoffs vs. the ideal profile
- Link to actual evidence (stories, assessments, certifications)

**Example Request:**

```
GET /api/engineers/eng_priya/explain?searchId=search_abc123
```

**Example Response:**

```typescript
{
  engineer: { id: 'eng_priya', name: 'Priya Sharma' },
  matchScore: 0.88,

  constraintExplanations: [
    {
      constraint: 'requiredSkills includes "Backend"',
      satisfied: true,
      explanation: 'Priya has Node.js (expert, 0.92 confidence) which is a child of Backend',
      evidence: [
        {
          type: 'assessment',
          id: 'attempt_priya_backend',
          summary: 'Scored 89% on Backend Engineering Assessment',
          relevance: 0.95
        },
        {
          type: 'story',
          id: 'story_priya_1',
          summary: 'Led microservices migration handling 10M transactions/day',
          relevance: 0.92
        }
      ]
    },
    {
      constraint: 'minYearsExperience >= 5',
      satisfied: true,
      explanation: 'Priya has 8 years of experience'
    }
  ],

  preferenceExplanations: [
    {
      preference: 'idealExperience = 5',
      score: 0.85,
      explanation: 'Priya has 8 years (3 more than ideal, slight penalty for overqualification)'
    },
    {
      preference: 'bonusSkills includes "TypeScript"',
      score: 1.0,
      explanation: 'Priya has TypeScript at expert level (0.92 confidence)'
    }
  ],

  tradeoffs: [
    {
      attribute: 'availability',
      issue: 'Available in 2 weeks, not immediately',
      severity: 'minor'
    }
  ]
}
```

---

## Phase 4: Persistent Personalization (5.4)

**Read:** Section 5.4

### Project 7: Manager Preference Learning ⏳

**Textbook Sections:** 5.4 (Persistent Personalization in Knowledge-Based Systems)

Build preference tracking and personalized ranking.

#### Part A: Track Implicit Signals

Log every manager action:

```typescript
interface ManagerAction {
  managerId: string;
  searchId: string;
  engineerId: string;
  action: 'view' | 'skip' | 'message' | 'interview' | 'hire' | 'reject';
  timestamp: string;
  dwellTimeSeconds?: number;  // for views
}
```

#### Part B: Learn Preferences

After sufficient history, derive manager-specific weights:

```typescript
interface ManagerPreferenceModel {
  managerId: string;
  learnedWeights: {
    yearsExperience: number;
    skillConfidence: number;
    availability: number;
    evidenceQuality: number;
  };
  sampleSize: number;   // how many hires this is based on
  confidence: number;   // how confident we are in these weights
  lastUpdated: string;
}
```

#### Part C: Apply Personalization

When ranking results, blend global and personal models:

```typescript
function getRankingWeights(managerId: string): Weights {
  const globalWeights = getGlobalWeights();
  const personalModel = getManagerModel(managerId);

  if (!personalModel || personalModel.sampleSize < 10) {
    // Not enough data, use global
    return globalWeights;
  }

  // Blend based on confidence
  const blendFactor = Math.min(personalModel.sampleSize / 50, 1);
  return blendWeights(globalWeights, personalModel.learnedWeights, blendFactor);
}
```

#### Part D: Pre-populate Search Defaults

Use history to suggest default search values:

```typescript
// Manager 2 always searches for 7+ years experience
// Pre-fill the search form with their typical values

interface SearchDefaults {
  managerId: string;
  suggestedDefaults: {
    minYearsExperience: 7,           // based on past searches
    preferredSkills: ['Java', 'Kafka'],  // frequently required
    availability: 'two_weeks'        // typical preference
  }
}
```

---

## Project Summary

| # | Project | Sections | Focus | Status |
|---|---------|----------|-------|--------|
| 1 | Basic Constraint Search | 5.2.1–5.2.3 | Filter engineers using knowledge base rules | ✅ Complete |
| 1.1 | Testing Infrastructure | — | Vitest setup, unit tests, E2E tests | ✅ Complete |
| 1.5 | Iterative Requirement Expansion | 5.2.1 | Forward-chaining inference engine | ✅ Complete |
| 2 | Constraint Relaxation | 5.2.4–5.2.5 | Detect conflicts, suggest repairs | ✅ Complete |
| 2.5 | Local LLM Integration | 5.2.4 | Dual-explanation conflict analysis | ✅ Complete |
| 3 | Similarity Scoring | 5.3.1 | Compute weighted similarity between engineers | Planned |
| 4 | Combined Search | 5.2.1, 5.2.3, 5.3.1 | Filter with constraints, rank by similarity | Planned |
| 5 | Critiquing System | 5.3.2.1–5.3.2.3 | Refine searches conversationally | Planned |
| 6 | Explanation Generation | 5.3.3 | Explain why engineers match | Planned |
| 7 | Preference Learning | 5.4 | Learn from manager behavior over time | Planned |

### Subsection Details

**Project 1: Basic Constraint Search** (5.2.1–5.2.3)
- 5.2.1 Returning Relevant Results — Rule-based expansion of requirements, iterative constraint propagation, building database queries
- 5.2.2 Interaction Approach — Three-phase interaction (specify → refine → repeat), default value handling
- 5.2.3 Ranking the Matched Items — Utility functions, weighted attribute scoring

**Project 2: Constraint Relaxation** (5.2.4–5.2.5)
- 5.2.4 Handling Unacceptable Results or Empty Sets — Minimal inconsistent constraint sets, repair proposals, QUICKXPLAIN/MINRELAX algorithms
- 5.2.5 Adding Constraints — Suggesting constraints when too many results, mining historical sessions for popular constraints

**Project 3: Similarity Scoring** (5.3.1)
- 5.3.1 Similarity Metrics — Weighted attribute similarity, symmetric vs asymmetric functions, categorical hierarchy similarity
- 5.3.1.1 Incorporating Diversity in Similarity Computation — Bounded greedy selection, quality metrics combining similarity and diversity

**Project 4: Combined Search** (5.2.1, 5.2.3, 5.3.1)
- 5.2.1 Returning Relevant Results — Hard constraint filtering (first pass)
- 5.2.3 Ranking the Matched Items — Utility-based ranking of filtered candidates
- 5.3.1 Similarity Metrics — Preference-based similarity scoring (second pass)

**Project 5: Critiquing System** (5.3.2.1–5.3.2.3)
- 5.3.2.1 Simple Critiques — Single attribute changes, directional critiques (more/less)
- 5.3.2.2 Compound Critiques — Multiple attribute changes in one cycle, informal descriptions ("classier", "roomier")
- 5.3.2.3 Dynamic Critiques — Data-mined critique suggestions, support-based ordering

**Project 6: Explanation Generation** (5.3.3)
- 5.3.3 Explanation in Critiques — Trade-off explanations, correlation statistics, fruitless session analysis

**Project 7: Preference Learning** (5.4)
- 5.4 Persistent Personalization — Tracking user actions (view, save, apply), learning personalized utility/similarity weights, constraint suggestion personalization, dynamic critique personalization

---

## Suggested Timeline

| Week | Reading | Build |
|------|---------|-------|
| 1 | 5.1, 5.2.1-5.2.3 | Project 1 (constraint search) |
| 2 | 5.2.4, 5.2.5 | Project 2 (relaxation, repair proposals) |
| 3 | 5.3.1 | Project 3 (similarity scoring) |
| 4 | 5.3.1 continued | Project 4 (combined search) |
| 5 | 5.3.2 | Project 5 (critiquing) |
| 6 | 5.3.3 | Project 6 (explanations) |
| 7 | 5.4 | Project 7 (preference learning) |

---

## Quick Reference: Seeded Data

| Entity | Count | Notes |
|--------|-------|-------|
| Skills | 110+ | Technical, behavioral, domain with hierarchy |
| Skill correlations | 60+ | Cross-type correlations included |
| Engineers | 40 | Varied profiles (0-20 years experience), expanded in Project 2 |
| Engineer skills | 400+ | With proficiency levels and confidence scores |
| Interview stories | 8 | STAR format with AI analyses |
| Story demonstrations | 35 | Links stories → skills with strength |
| Assessments | 4 | Backend, frontend, system design, platform |
| Questions | 11 | Each tests 2-3 skills with weights |
| Performances | 15 | Scores and feedback per question |
| Certifications | 5 | AWS, CKA, CKAD, Terraform |
| Evidence links | 30+ | Connects skills to proof |
