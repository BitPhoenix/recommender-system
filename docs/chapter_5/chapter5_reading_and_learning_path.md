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

### Project 3: Similarity Scoring ✅

**Textbook Sections:** 5.3.1 (Similarity Metrics), 5.3.1.1 (Incorporating Diversity in Similarity Computation)

**Duration**: Jan 16-17, 2026 | **Branch**: `project_3`

Build `GET /api/engineers/:id/similar` that computes similarity between engineers.

**What Was Built:**

- **Four-component weighted similarity** (Equation 5.2):
  - Skills: 0.45 weight - Graph-aware best-match with CORRELATES_WITH edges
  - Years Experience: 0.27 weight - Asymmetric (more_is_better with α=0.5)
  - Domain: 0.22 weight - Hierarchy-aware matching for business + technical domains
  - Timezone: 0.06 weight - Position-based distance on East→West ordering

- **Graph-aware skill similarity**:
  - Exact match: 1.0
  - CORRELATES_WITH edge: correlation strength (0.7+ threshold)
  - Same category: 0.5
  - Share parent: 0.3
  - No relation: 0.0

- **Bidirectional scoring**: Averages A→B and B→A for symmetric results

- **Bounded greedy diversity selection** (Section 5.3.1.1):
  - Prevents homogeneous results when similar engineers cluster
  - Quality = similarity × avgDiversity
  - Pool size = 3 × limit for selection

**Key Design Decisions:**

- **Timeline excluded from similarity**: Transient property (changes when projects end) - not a capability
- **Salary excluded from similarity**: Budget constraint, not capability - ranking by salary would be unfair
- **Experience asymmetry (α=0.5)**: Penalize undershoot fully, tolerate overshoot partially (Equation 5.5)
- **Domain years as multiplier**: Years can reduce domain score by at most 50% (floor = 0.5)

**Example Response:**

```typescript
{
  target: { id: 'eng_priya', name: 'Priya Sharma', ... },
  similar: [
    {
      engineer: { id: 'eng_james', name: 'James Okonkwo', ... },
      similarityScore: 0.82,
      breakdown: {
        skills: 0.85,
        yearsExperience: 0.75,
        domain: 0.90,
        timezone: 0.70
      },
      sharedSkills: ['TypeScript', 'React'],
      correlatedSkills: [{ targetSkill: 'Node.js', candidateSkill: 'Express', strength: 0.8 }]
    },
    ...
  ]
}
```

---

### Project 4: Combined Search (Filter → Similarity) ✅

**Textbook Sections:** 5.2.1 (Returning Relevant Results), 5.2.3 (Ranking the Matched Items), 5.3.1 (Similarity Metrics)

**Duration**: Jan 17-18, 2026 | **Branch**: `project_4`

Build `POST /api/search/filter-similarity` that combines constraint filtering with case-based similarity ranking.

#### Design Decision: Two Endpoints, Two Ranking Strategies

The textbook (p.181-182) describes two ways to specify a target for case-based recommendations:
1. **Existing item as reference**: "Find engineers like this one"
2. **Desired attribute values**: "Find engineers with these skills, experience, etc."

**Key insight**: Approach #2 is already implemented via the `preferred*` fields in `/filter`. Those fields describe the ideal candidate, and the utility function scores how well each engineer matches.

**Our approach**: Add a new endpoint `/filter-similarity` for Approach #1. This serves a distinct use case: "I found a great engineer (Marcus) but he's unavailable. Find more like Marcus who also meet the job's hard requirements."

#### The Three Endpoints Mental Model

| What you have | What you want | Endpoint | Ranking |
|---------------|---------------|----------|---------|
| Job requirements + **described preferences** | Engineers ranked by job fit | `POST /filter` | Utility (11 components) |
| Job requirements + **reference engineer** | Engineers similar to reference | `POST /filter-similarity` | Similarity (4 components) |
| Just a **reference engineer** | Similar engineers (no constraints) | `GET /engineers/:id/similar` | Similarity (4 components) |

#### Why Not a Single Endpoint with `rankingMode`?

We considered adding a `rankingMode: 'utility' | 'similarity'` parameter to `/filter`. Rejected because:
- Confusion about which fields apply in which mode (`preferred*` ignored in similarity mode?)
- Complex conditional validation
- Unclear API contract
- Two endpoints with distinct purposes is cleaner

#### Why Not an `idealProfile` Object?

We considered letting users construct a hypothetical profile:
```typescript
idealProfile: { skills: ['TypeScript', 'React'], yearsExperience: 5, ... }
```

Rejected because:
- Redundant with `preferred*` fields - both describe what you want
- More complex request (construct an object vs pass an ID)
- Doesn't match real workflow (recruiters find a good engineer, want more like them)

#### Endpoint Design

**Request:**
```typescript
POST /api/search/filter-similarity
{
  // Hard constraints - WHO qualifies (same as /filter)
  requiredSkills?: SkillRequirement[];
  requiredSeniorityLevel?: SeniorityLevel;
  requiredMaxStartTime?: StartTimeline;
  requiredTimezone?: USTimezoneZone[];
  maxBudget?: number;
  requiredBusinessDomains?: BusinessDomainRequirement[];
  requiredTechnicalDomains?: TechnicalDomainRequirement[];

  // Reference engineer - HOW to RANK qualified candidates
  referenceEngineerId: string;  // Required

  // Inference rule override (same as /filter)
  overriddenRuleIds?: string[];

  // Pagination
  limit?: number;
  offset?: number;
}
```

**Response:**
```typescript
{
  referenceEngineer: { id, name, headline },
  matches: [
    {
      id, name, headline, salary, yearsExperience, startTimeline, timezone,
      similarityScore: 0.82,
      scoreBreakdown: { skills, yearsExperience, domain, timezone },
      sharedSkills: ['React', 'TypeScript'],
      correlatedSkills: [...]
    },
    ...
  ],
  totalCount: 15,
  appliedFilters: [...],
  derivedConstraints: [...],  // Inference rules applied
  relaxation?: {...},          // If < 3 results
  tightening?: {...},          // If >= 25 results
  queryMetadata: { executionTimeMs, candidatesBeforeDiversity }
}
```

**Features:**

- Same hard constraint filtering as `/filter`
- Inference rules via `expandSearchCriteria` (same as `/filter`)
- Constraint advisor for relaxation/tightening (same as `/filter`)
- Reference engineer excluded from results
- Similarity ranking using 4-component scoring from Project 3
- Diversity selection to prevent homogeneous results

#### Why Include Inference Rules and Constraint Advisor?

Initially considered omitting these for simplicity. Included because:
- Same sparse/many results problem applies (user specifies tight constraints)
- Infrastructure already exists and is reusable
- Consistency with `/filter` reduces cognitive load
- No additional implementation complexity

#### Implementation Summary

**What Was Built:**

- **New endpoint**: `POST /api/search/filter-similarity` - hybrid search combining constraints + similarity ranking
- **Unified query builder**: Refactored `buildSearchQuery` with `collectAllSkills` option to eliminate code duplication
- **Full request validation**: Zod schema with refinements (stretchBudget requires maxBudget, etc.)
- **Response types**: `FilterSimilarityResponse`, `FilterSimilarityMatch`, `DerivedConstraintInfo`

**Data Flow (13 steps in service):**

1. Load reference engineer (fail fast if not found)
2. Resolve skills → IDs grouped by proficiency
3. Expand constraints via inference engine (seniority → years, inference rules)
4. Resolve domain constraints (hierarchy expansion)
5. Build unified query with `collectAllSkills=true` (returns full skill profiles)
6. Get constraint advice (relaxation/tightening based on result count)
7. Load skill graph + domain graph
8. Parse query results → EngineerForSimilarity format
9. Score candidates by similarity: Skills (45%) + Experience (27%) + Domain (22%) + Timezone (6%)
10. Apply diversity selection (bounded greedy)
11. Apply pagination
12. Build derived constraints info
13. Return response with full transparency

**Key Design Decisions:**

- **`referenceEngineerId` not `idealProfile`**: Real engineer reference matches actual workflow ("I found Marcus, find more like him")
- **No `preferred*` fields**: Clear separation—`/filter` uses utility scoring from preferences, `/filter-similarity` uses similarity to reference
- **Unified query builder**: `collectAllSkills` option eliminates duplication between endpoints
- **Reference excluded from results**: Can't ask "find engineers like Marcus" and get Marcus back

**Architecture:**

```
recommender_api/src/
├── controllers/filter-similarity.controller.ts    # HTTP handler
├── schemas/filter-similarity.schema.ts            # Request validation (Zod)
├── types/filter-similarity.types.ts               # Response types
├── services/
│   ├── filter-similarity.service.ts               # Orchestration (13-step flow)
│   └── cypher-query-builder/
│       ├── search-query.builder.ts                # collectAllSkills option
│       └── query-types.ts                         # excludeEngineerId param
```

**Testing:**

- **31 unit tests**: Schema validation, service orchestration, error handling
- **11 E2E scenarios**: Basic request, validation errors, constraints, pagination, inference rules
- **244 total assertions** across the full test collection (73 requests)

---

### Project 5: Critiquing System ⏳

**Textbook Sections:** 5.3.2 (Critiquing Methods), 5.3.2.1 (Simple Critiques), 5.3.2.2 (Compound Critiques), 5.3.2.3 (Dynamic Critiques)

Build `POST /api/search/critique` for conversational refinement of search results.

#### Request Schema

Use a unified `adjustments[]` array—no need to distinguish simple vs compound:
- 1 adjustment = simple critique (5.3.2.1)
- Multiple adjustments = compound critique (5.3.2.2)

```typescript
{
  baseSearch: { /* previous SearchFilterRequest */ },
  adjustments: [
    { attribute: 'yearsExperience', direction: 'more' },
    { attribute: 'startTimeline', direction: 'sooner' }
  ]
}
```

#### Part A: Directional Critiques

User specifies whether to increase or decrease an attribute:

| Attribute | Directions | Effect |
|-----------|------------|--------|
| `yearsExperience` | `more` / `less` | Adjust seniority level |
| `salary` | `more` / `less` | Adjust budget cap |
| `startTimeline` | `sooner` / `later` | Adjust availability window |
| `timezone` | `closer` / `farther` | Narrow or expand timezone |

#### Part B: Replacement Critiques

User specifies a concrete value:

```typescript
{ attribute: 'timezone', value: 'Pacific' }
{ attribute: 'skills', action: 'add', skill: 'Python', proficiency: 'proficient' }
```

#### Part C: Dynamic Critique Suggestions (5.3.2.3)

Analyze current results using **frequent pattern mining** to suggest useful critiques.

**Algorithm (from textbook p.193):**

1. **Mine patterns**: Find all attribute change patterns in current results
2. **Filter by minimum support**: Only keep patterns above threshold (e.g., 20%)
3. **Order by ascending support**: Show low-support patterns first

**Why ascending order?** Low-support critiques are often **less obvious patterns** that eliminate more items from the candidate list. High-support patterns (obvious to the user) are less useful for narrowing.

**Example**: With 20 current results:
```typescript
suggestedCritiques: [
  // Low support first (less obvious, more useful for filtering)
  {
    adjustments: [{ attribute: 'domain', value: 'Fintech' }],
    description: 'Add Fintech experience',
    resultingMatches: 4,
    support: 0.20  // Only 20% have this—non-obvious pattern
  },
  {
    adjustments: [
      { attribute: 'yearsExperience', direction: 'more' },
      { attribute: 'timezone', value: 'Pacific' }
    ],
    description: 'More experienced AND Pacific timezone',
    resultingMatches: 3,
    support: 0.15  // Compound pattern
  },
  // Higher support last (more obvious)
  {
    adjustments: [{ attribute: 'skills', action: 'add', skill: 'Python' }],
    description: 'Add Python requirement',
    resultingMatches: 12,
    support: 0.60  // 60% have Python—obvious pattern
  }
]
```

**Configuration:**
- `minSupportThreshold`: Minimum support to include (default: 0.15)
- `maxSuggestions`: Maximum suggestions to return (default: 5)

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
| 3 | Similarity Scoring | 5.3.1 | Graph-aware engineer-to-engineer similarity | ✅ Complete |
| 4 | Filter-Similarity Search | 5.2.1, 5.3.1 | Filter with constraints, rank by similarity to reference | ✅ Complete |
| 5 | Critiquing System | 5.3.2.1–5.3.2.3 | Directional/replacement critiques, dynamic suggestions with support-based ordering | Planned |
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
- 5.3.1 Similarity Metrics — Four-component weighted similarity (skills, experience, domain, timezone), graph-aware skill matching via CORRELATES_WITH, asymmetric experience scoring (Equation 5.5)
- 5.3.1.1 Incorporating Diversity in Similarity Computation — Bounded greedy selection preventing homogeneous results, Quality = similarity × avgDiversity

**Project 4: Filter-Similarity Search** (5.2.1, 5.3.1)
- 5.2.1 Returning Relevant Results — Hard constraint filtering using existing search infrastructure
- 5.3.1 Similarity Metrics — Rank filtered candidates by similarity to reference engineer (not by utility)
- Design insight: `preferred*` fields in `/filter` ARE the "ideal profile" (Approach #2 from textbook p.181), so `/filter-similarity` adds Approach #1 (existing item as reference)

**Project 5: Critiquing System** (5.3.2.1–5.3.2.3)
- 5.3.2.1 Simple Critiques — Single attribute changes via directional (more/less) or replacement (concrete value) critiques
- 5.3.2.2 Compound Critiques — Multiple adjustments in one cycle; unified `adjustments[]` array (1 item = simple, 2+ items = compound)
- 5.3.2.3 Dynamic Critiques — Frequent pattern mining on current results, minimum support threshold filtering, **ascending support ordering** (low-support patterns first because they're less obvious and eliminate more items)

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
| 4 | 5.3.1 continued | Project 4 (filter-similarity search) |
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
