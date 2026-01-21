# Project 6: Explanation Generation - Code Walkthrough

## Summary

This implementation adds a `POST /api/search/filter/:engineerId/explain` endpoint that explains why a specific engineer matches (or doesn't match) search criteria. The architecture follows a **modular pipeline pattern** where an orchestrator service delegates to four specialized explanation generators (constraints, scores, evidence, tradeoffs), then assembles their outputs into a unified response with optional LLM-enhanced narrative. The key innovation is **reusing the existing search pipeline** with an `engineerId` filter to get consistent match data, avoiding reimplementation of complex matching logic.

## Learning Path Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXPLANATION GENERATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1: ENTRY POINTS & DATA STRUCTURES                                     │
│  ├── 1.1 Type Definitions (search-match-explanation.types.ts)               │
│  ├── 1.2 Request Schema (search-match-explanation.schema.ts)                │
│  └── 1.3 HTTP Layer (controller + routes)                                   │
│                                                                              │
│  PHASE 2: ORCHESTRATION & EXPLANATION SERVICES                               │
│  ├── 2.1 Main Orchestrator (search-match-explanation.service.ts)            │
│  ├── 2.2 Constraint Explanations (constraint-explanation.service.ts)        │
│  ├── 2.3 Score Explanations (score-explanation.service.ts)                  │
│  ├── 2.4 Tradeoff Detection (tradeoff-explanation.service.ts)               │
│  └── 2.5 Evidence Pipeline (evidence-*.service.ts)                          │
│                                                                              │
│  PHASE 3: INTEGRATION & PATTERNS                                             │
│  ├── 3.1 Search Pipeline Reuse (engineerId filter)                          │
│  ├── 3.2 LLM Integration (dual explanation pattern)                         │
│  └── 3.3 Testing Strategy (unit + E2E)                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Entry Points & Data Structures

### 1.1 Type Definitions

**File:** `src/types/search-match-explanation.types.ts`

This file defines the complete type hierarchy for explanation responses. Start here to understand the data shape before reading any service code.

**Read in Order:**

1. **Lines 38-59:** `SearchMatchExplanation` (top-level response interface) - The complete API response shape. Key fields:
   - `engineer` (id, name, headline) - Basic info about the explained engineer
   - `matchScore` - Overall utility score
   - `summary` (inline object) - Quick text summaries for UI display
   - `constraints`, `scores`, `evidence`, `tradeoffs` - Arrays of structured explanations

2. **Lines 73-79:** `ConstraintExplanation` - Explains a single filter's satisfaction status. Key fields:
   - `constraint: AppliedFilter` - The filter being explained (reuses existing type)
   - `satisfied: boolean` - Whether the engineer passes this filter
   - `matchType?: MatchType` - How the skill was matched (direct/descendant/correlated)

3. **Lines 151-158:** `ScoreExplanation` - Explains one scoring component's contribution. Key fields:
   - `component: string` - Component name (e.g., 'skillMatch', 'experience')
   - `weight`, `rawScore`, `weightedScore` - Numeric breakdown
   - `contributingFactors: string[]` - What specifically contributed

4. **Lines 164-177:** `EvidenceExplanation` + `EvidenceItem` - Groups evidence by skill. Note the discriminated union pattern:
   - `EvidenceItem.type: EvidenceType` (discriminator: `'story' | 'performance' | 'certification'`)
   - `details: StoryDetails | PerformanceDetails | CertificationDetails`

5. **Lines 214-242:** Detail types (`StoryDetails`, `PerformanceDetails`, `CertificationDetails`) - Flattened DTOs for API responses. Note the comment block at lines 185-212 explaining why these are flattened rather than reusing seed types.

6. **Lines 269-274:** `TradeoffExplanation` - Describes gaps between requested and actual values. Note lines 248-267 explaining why no `direction` or `severity` fields (design decision: facts not judgments).

**Key Concept:** The response is hierarchical but flat at the top level—four parallel arrays that can be rendered independently in a UI without cross-references.

---

### 1.2 Request Schema

**File:** `src/schemas/search-match-explanation.schema.ts`

A minimal schema that wraps the existing search criteria.

**Read in Order:**

1. **Lines 1-8:** The entire file. Note:
   - `ExplainRequestSchema` wraps `SearchFilterRequestSchema` as `searchCriteria`
   - The `engineerId` comes from the URL path parameter, not the body
   - This enables full search criteria (skills, budget, timezones, etc.) for the explanation

**Key Concept:** The explain endpoint accepts the same criteria as `/filter`, enabling explanations for any search configuration.

---

### 1.3 HTTP Layer

**File:** `src/controllers/search-match-explanation.controller.ts`

Standard Express controller with Zod validation and error handling.

**Read in Order:**

1. **Lines 7-28:** `explainFilterMatch` - Main handler. Note the flow:
   - Line 15: Extract `engineerId` from URL params
   - Line 21: Validate body with Zod
   - Lines 23-26: Call orchestrator service
   - Line 28: Return JSON response

2. **Lines 29-46:** Error handling. Two special cases:
   - Line 30-36: `ZodError` → 400 with validation details
   - Line 38-41: "does not match" error → 404 (engineer filtered out by criteria)

**File:** `src/routes/search.routes.ts`

**Read in Order:**

1. **Line 49:** Route registration - `router.post('/filter/:engineerId/explain', ...)`. Note:
   - Path nests under `/filter` to indicate it's related to filter-based search
   - Uses `validate(ExplainRequestSchema)` middleware before controller

**Key Concept:** The `:engineerId` URL parameter separates "which engineer" from "what criteria", matching the user workflow of drilling into a specific search result.

---

## Phase 2: Orchestration & Explanation Services

### 2.1 Main Orchestrator

**File:** `src/services/search-match-explanation/search-match-explanation.service.ts`

The central service that coordinates all explanation generation. This is the most important file.

**Read in Order:**

1. **Lines 22-36:** Comment block explaining why we reuse `executeSearch` instead of loading data manually. Key insight: this guarantees consistent matchType, scores, and constraints with the `/filter` endpoint.

2. **Lines 38-41:** `ExplainRequest` interface - Simple: `engineerId` + `searchCriteria`

3. **Lines 43-58:** `LLM_SYSTEM_PROMPT` - The prompt used for generating narrative explanations. Note the structured approach: lists what the LLM receives and what it should produce.

4. **Lines 60-160:** `generateSearchMatchExplanation` - Main orchestration function. Follow the numbered steps:
   - **Step 1 (66-77):** Run search with engineerId filter → get `engineerMatch`
   - **Step 2 (79-83):** Generate constraint explanations
   - **Step 3 (85-89):** Generate score explanations
   - **Step 4 (91-92):** Collect relevant skill IDs
   - **Step 5 (94-99):** Generate evidence explanations (async - DB query)
   - **Step 6 (101-128):** Detect tradeoffs
   - **Step 7 (130-137):** Generate LLM narrative (async - may be null)
   - **Step 8 (139-145):** Generate summary
   - **Return (147-159):** Assemble final response

5. **Lines 162-171:** `generateLLMNarrative` - Thin wrapper that builds context and calls LLM service.

6. **Lines 173-205:** `generateSummary` - Creates the quick text summaries. Note:
   - Constraint summary: "Matches X of Y requirements"
   - Strength summary: Top weighted score component
   - Tradeoff summary: Delegates to `summarizeTradeoffs`

7. **Lines 207-265:** `buildLLMContext` - Formats data for LLM consumption. Markdown-like structure with sections for Profile, Constraints, Scores, Evidence, Tradeoffs.

8. **Lines 272-300:** Helper functions `formatComponentName` and `formatTimeline` - Human-readable formatting.

**Key Concept:** The orchestrator follows a strict sequence but delegates all domain logic to specialized services. It only handles flow control and assembly.

---

### 2.2 Constraint Explanations

**File:** `src/services/search-match-explanation/constraint-explanation.service.ts`

Generates human-readable explanations for filter satisfaction.

**Read in Order:**

1. **Lines 1-12:** Imports - Note the type guards `isSkillFilter` and `isPropertyFilter` imported from search.types.

2. **Lines 14-19:** `generateConstraintExplanations` - Entry point. Simple map over filters.

3. **Lines 21-31:** `generateSingleConstraintExplanation` - Dispatcher using type guards:
   - Skill filters → `generateSkillConstraintExplanation`
   - Property filters → `generatePropertyConstraintExplanation`

4. **Lines 33-78:** `generateSkillConstraintExplanation` - The most complex function:
   - Lines 37-46: Find matched skills for this filter
   - Line 48: Determine satisfaction (all required skills matched?)
   - Line 49: Determine primary match type (direct > descendant > correlated)
   - Lines 51-53: Format matched skill names with proficiency/confidence
   - Lines 55-69: Generate explanation text based on match type and satisfaction

5. **Lines 80-85:** `determinePrimaryMatchType` - Priority: direct → descendant → correlated

6. **Lines 87-103:** `generatePropertyConstraintExplanation` - Handles non-skill constraints:
   - Gets engineer's actual value
   - Evaluates against constraint
   - Generates explanation text

7. **Lines 105-138:** `getEngineerPropertyValue` and `evaluatePropertyConstraint` - Property access and comparison logic. Note operator handling: `>=`, `<=`, `IN`, `BETWEEN`.

8. **Lines 140-219:** `generatePropertyExplanationText` and formatting helpers - Human-readable text generation with field-specific templates.

**Key Concept:** Skill constraints have hierarchical match types (direct/descendant/correlated); property constraints have operators (>=, IN, etc.). Both produce boolean satisfaction + human explanation.

---

### 2.3 Score Explanations

**File:** `src/services/search-match-explanation/score-explanation.service.ts`

Translates numeric scores into human-readable explanations.

**Read in Order:**

1. **Lines 1-8:** Imports - Note `utilityWeights` from config (canonical source for weights).

2. **Lines 10-29:** `generateScoreExplanations` - Entry point. Processes:
   - Core scores (skillMatch, confidence, experience)
   - Preference matches (9 different types)

3. **Lines 31-54:** `generateSkillMatchExplanation` - Example of score-to-text:
   - Multiplies raw × weight for weighted score
   - Maps raw score ranges to qualitative descriptions ("Excellent", "Good", etc.)

4. **Lines 56-80:** `generateConfidenceExplanation` - Note the denormalization at line 61 (converts from 0-1 back to 0.5-1.0 range).

5. **Lines 82-109:** `generateExperienceExplanation` - Reverses the logarithmic formula to recover approximate years (line 88).

6. **Lines 111-230:** `generatePreferenceExplanations` - Handles all 9 preference types:
   - preferredSkillsMatch (lines 114-125)
   - teamFocusMatch (lines 127-138)
   - preferredBusinessDomainMatch (lines 140-151)
   - preferredTechnicalDomainMatch (lines 153-164)
   - startTimelineMatch (lines 166-177)
   - preferredTimezoneMatch (lines 179-190)
   - preferredSeniorityMatch (lines 192-203)
   - budgetMatch (lines 205-216) - Note: only shown if score < 1.0
   - relatedSkillsMatch (lines 218-227)

**Key Concept:** Score explanations combine numeric precision (weight, rawScore, weightedScore) with qualitative descriptions. The `contributingFactors` array provides drill-down detail.

---

### 2.4 Tradeoff Detection

**File:** `src/services/search-match-explanation/tradeoff-explanation.service.ts`

Identifies gaps between preferences and reality.

**Read in Order:**

1. **Lines 1-4:** Imports - Note `seniorityMapping` from config and `START_TIMELINE_ORDER` from schema.

2. **Lines 6-12:** `EngineerProfile` interface - What we know about the engineer.

3. **Lines 14-45:** Comment block explaining why tradeoffs focus on preferences, not required constraints. Key insight: failing a required constraint is disqualification, not a tradeoff.

4. **Lines 47-100:** `detectTradeoffs` - Main function. Checks 5 tradeoff types:
   - Experience (lines 53-60)
   - Salary (lines 62-70)
   - Timeline (lines 72-79)
   - Timezone (lines 81-88)
   - Missing preferred skills (lines 90-97)

5. **Lines 102-130:** `detectExperienceTradeoff` - Uses `seniorityMapping` from config. Detects both under-experience AND over-experience (more than 2 years above max).

6. **Lines 132-152:** `detectSalaryTradeoff` - Distinguishes "over budget" from "within stretch range".

7. **Lines 154-171:** `detectTimelineTradeoff` - Uses `START_TIMELINE_ORDER` to compare timelines.

8. **Lines 173-187:** `detectTimezoneTradeoff` - Simple set membership check.

9. **Lines 189-206:** `detectMissingPreferredSkills` - Counts missing skills.

10. **Lines 208-215:** `summarizeTradeoffs` - "X tradeoffs: attr1, attr2, ..."

**Key Concept:** Tradeoffs are facts, not judgments. The service reports "Has X, wanted Y" and lets the hiring manager decide if that's acceptable.

---

### 2.5 Evidence Pipeline

**File:** `src/services/search-match-explanation/evidence-query.service.ts`

Cypher queries for EVIDENCED_BY relationships.

**Read in Order:**

1. **Lines 10-97:** `queryEngineerEvidence` - Main query function:
   - Lines 30-63: Cypher query traversing:
     ```
     (Engineer)-[:HAS]->(UserSkill)-[:FOR]->(Skill)
     (UserSkill)-[:EVIDENCED_BY]->(evidence)
     ```
   - Also joins StoryAnalysis (for stories) and AssessmentQuestion + Assessment (for performances)
   - Lines 65-96: Groups results by skill, parses evidence items

2. **Lines 99-141:** `parseEvidenceItem` - Dispatcher based on evidence type (story/performance/certification).

3. **Lines 143-173:** Story parsing - `generateStorySummary` (first sentence of action + result) and `parseStoryDetails` (full STAR + optional analysis scores).

4. **Lines 175-199:** Performance parsing - Includes joined data (assessmentName, questionSummary, maxScore).

5. **Lines 201-216:** Certification parsing - Name, org, dates, verification status.

**File:** `src/services/search-match-explanation/evidence-explanation.service.ts`

Thin wrapper that filters and sorts evidence.

**Read in Order:**

1. **Lines 5-28:** `generateEvidenceExplanations` - Filters to skills with evidence, sorts by item count.

2. **Lines 30-57:** `summarizeEvidence` - "X evidence items across Y skills (N stories, M performances, K certifications)".

**Key Concept:** Evidence queries are expensive (graph traversal), so they're only run for relevant skills from the search criteria, not all engineer skills.

---

## Phase 3: Integration & Patterns

### 3.1 Search Pipeline Reuse

**How the engineerId filter works:**

1. **Schema addition** - `src/schemas/search.schema.ts:157` adds optional `engineerId` field
2. **Query builder** - `src/services/cypher-query-builder/query-conditions.builder.ts:35-36` adds `e.id = $engineerId` when present
3. **Orchestrator usage** - `search-match-explanation.service.ts:66-69` passes `engineerId` to `executeSearch`

```
Client request: POST /api/search/filter/eng_priya/explain
                      ↓
Controller extracts engineerId from URL
                      ↓
Orchestrator calls executeSearch({ ...criteria, engineerId: 'eng_priya' })
                      ↓
Search returns array with 0 or 1 matches
                      ↓
If 0 matches → throw "does not match"
If 1 match → proceed with explanation generation
```

**Key Concept:** This pattern guarantees that the explanation uses exactly the same matching logic as the original search. No divergence possible.

---

### 3.2 LLM Integration (Dual Explanation Pattern)

**File:** `src/services/llm.service.ts`

**Read in Order:**

1. **Lines 23-41:** `isLLMAvailable` - Checks Ollama connectivity, caches result.

2. **Lines 60-103:** `generateCompletion` - Main function:
   - Returns null if LLM unavailable (graceful degradation)
   - Builds messages array with optional system prompt
   - Has timeout protection (line 80)

**Dual explanation pattern in orchestrator:**

```
summary.narrative = await generateLLMNarrative(...)  // May be null
```

The response always includes:
- `summary.constraints`, `summary.strengths`, `summary.tradeoffs` - Template-based (always present)
- `summary.narrative` - LLM-generated (null if unavailable)

**Key Concept:** The API is useful even without LLM. Templates provide immediate value; LLM adds richness when available.

---

### 3.3 Testing Strategy

**Unit Tests:**

| File | Focus |
|------|-------|
| `constraint-explanation.service.test.ts` | Direct/descendant/missing skills, property operators |
| `tradeoff-explanation.service.test.ts` | All 5 tradeoff types, summarization |

**E2E Tests (Postman):**

| Test # | Scenario |
|--------|----------|
| 89 | Basic explain for eng_priya |
| 90 | Explain with all constraint types |
| 91 | Explain for eng_james (different engineer) |
| 92 | Explain with inference rules |
| 93 | Explain with tradeoff detection |
| 94 | Evidence in response |

---

## Architecture Diagram

```
                                    HTTP Request
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          search.routes.ts:49                                  │
│                  POST /api/search/filter/:engineerId/explain                 │
└──────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                search-match-explanation.controller.ts                         │
│                        explainFilterMatch()                                   │
│  • Extracts engineerId from URL                                              │
│  • Validates body with ExplainRequestSchema                                  │
│  • Handles ZodError → 400, "does not match" → 404                           │
└──────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│            search-match-explanation.service.ts                                │
│               generateSearchMatchExplanation()                                │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Step 1: executeSearch() with engineerId filter                         │ │
│  │         ↓ returns EngineerMatch with computed scores, matchTypes       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│          ┌───────────────────┼───────────────────┐                          │
│          │                   │                   │                          │
│          ▼                   ▼                   ▼                          │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐                 │
│  │ constraint-   │   │ score-        │   │ evidence-     │                 │
│  │ explanation   │   │ explanation   │   │ explanation   │                 │
│  │ .service.ts   │   │ .service.ts   │   │ .service.ts   │                 │
│  └───────────────┘   └───────────────┘   └───────────────┘                 │
│          │                   │                   │                          │
│          │                   │                   ▼                          │
│          │                   │          ┌───────────────┐                   │
│          │                   │          │ evidence-     │                   │
│          │                   │          │ query.service │──── Neo4j        │
│          │                   │          └───────────────┘                   │
│          │                   │                   │                          │
│          ▼                   ▼                   ▼                          │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         tradeoff-explanation.service.ts                │ │
│  │                              detectTradeoffs()                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                         │                                   │
│                                         ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         llm.service.ts                                 │ │
│  │                    generateCompletion() (optional)                     │ │
│  │                    → summary.narrative                                 │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                         │                                   │
│                                         ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      Assemble SearchMatchExplanation                   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                                   JSON Response
```

---

## Reference Tables

### Test Files

| File | Test Count | Focus |
|------|------------|-------|
| `constraint-explanation.service.test.ts` | 7 | Skill matches (direct, descendant, missing), property constraints (years, timezone, salary), multiple constraints |
| `tradeoff-explanation.service.test.ts` | 13 | Experience under/over, salary over/stretch/within, timeline later/sooner, timezone mismatch, missing skills, multiple tradeoffs, summarization |

### Type Registry

| Type | File:Line | Purpose |
|------|-----------|---------|
| `SearchMatchExplanation` | types/search-match-explanation.types.ts:38 | API response |
| `ConstraintExplanation` | types/search-match-explanation.types.ts:73 | Filter satisfaction |
| `ScoreExplanation` | types/search-match-explanation.types.ts:151 | Score breakdown |
| `EvidenceExplanation` | types/search-match-explanation.types.ts:164 | Evidence by skill |
| `EvidenceItem` | types/search-match-explanation.types.ts:170 | Single evidence piece |
| `TradeoffExplanation` | types/search-match-explanation.types.ts:269 | Preference gap |
| `ExplainRequest` | schemas/search-match-explanation.schema.ts:4 | Request validation |

### Configuration Dependencies

| Config | Source | Usage |
|--------|--------|-------|
| `utilityWeights` | `config/knowledge-base/utility.config.ts` | Score weights |
| `seniorityMapping` | `config/knowledge-base/compatibility-constraints.config.ts` | Experience ranges |
| `START_TIMELINE_ORDER` | `schemas/search.schema.ts:18` | Timeline comparison |

---

## Plan vs Implementation

| Plan Phase | Status | Notes |
|------------|--------|-------|
| Phase 1: Types and Evidence Queries | ✅ Complete | Types match plan exactly. Evidence query enhanced with question/assessment joins (plan had simpler version). |
| Phase 2: Constraint Satisfaction Explanations | ✅ Complete | Added `formatTimezoneValue` and `formatTimelineValue` helpers not in plan. |
| Phase 3: Score Component Explanations | ✅ Complete | Changed `actualTimeline` → `matchedStartTimeline` and `actualTimezone` → `matchedTimezone` to match actual PreferenceMatches type. Added `inStretchZone` check for budget. |
| Phase 4: Evidence Explanation Service | ✅ Complete | Matches plan. |
| Phase 5: Tradeoff Detection Service | ✅ Complete | Added null handling for `minYears` (line 109). |
| Phase 6: Orchestration Service | ✅ Complete | Changed LLM call signature from `(context, systemPrompt)` to `(context, { systemPrompt })` to match actual llm.service interface. Added `formatTimeline` helper. |
| Phase 7: Controller, Schema, Testing | ✅ Complete | Route registered in search.routes.ts instead of index.ts (plan said index.ts). Schema capitalized as `ExplainRequestSchema` vs plan's `explainRequestSchema`. |

### Deviations from Plan

1. **Evidence query enrichment**: Plan's Cypher query was simpler. Implementation adds joins to `AssessmentQuestion` and `Assessment` to get `questionSummary`, `maxScore`, and `assessmentName` for performance evidence.

2. **LLM service interface**: Plan assumed `generateCompletion(prompt, systemPrompt)` but actual interface is `generateCompletion(prompt, { systemPrompt })`.

3. **Type field names**: Plan used `actualTimeline`/`actualTimezone` but actual `PreferenceMatches` type uses `matchedStartTimeline`/`matchedTimezone`.

4. **Route file**: Plan said modify `routes/index.ts` but routes are organized by domain (`routes/search.routes.ts`).

### Post-Implementation Additions

None - implementation matches plan scope.

---

## Code References

### Primary Implementation Files

| File | Lines | Key Functions |
|------|-------|---------------|
| `src/types/search-match-explanation.types.ts` | 1-275 | All type definitions |
| `src/schemas/search-match-explanation.schema.ts` | 1-9 | `ExplainRequestSchema` |
| `src/controllers/search-match-explanation.controller.ts` | 1-48 | `explainFilterMatch` |
| `src/routes/search.routes.ts` | 49 | Route registration |
| `src/services/search-match-explanation/search-match-explanation.service.ts` | 1-301 | `generateSearchMatchExplanation`, `generateLLMNarrative`, `generateSummary`, `buildLLMContext` |
| `src/services/search-match-explanation/constraint-explanation.service.ts` | 1-220 | `generateConstraintExplanations`, `generateSkillConstraintExplanation`, `generatePropertyConstraintExplanation` |
| `src/services/search-match-explanation/score-explanation.service.ts` | 1-243 | `generateScoreExplanations`, `generatePreferenceExplanations` |
| `src/services/search-match-explanation/tradeoff-explanation.service.ts` | 1-228 | `detectTradeoffs`, `summarizeTradeoffs` |
| `src/services/search-match-explanation/evidence-explanation.service.ts` | 1-58 | `generateEvidenceExplanations`, `summarizeEvidence` |
| `src/services/search-match-explanation/evidence-query.service.ts` | 1-217 | `queryEngineerEvidence`, `parseEvidenceItem` |
| `src/services/search-match-explanation/index.ts` | 1-7 | Module exports |

### Supporting Infrastructure

| File | Lines | Key Functions |
|------|-------|---------------|
| `src/services/llm.service.ts` | 60-103 | `generateCompletion` |
| `src/schemas/search.schema.ts` | 157 | `engineerId` field |
| `src/services/cypher-query-builder/query-conditions.builder.ts` | 35-36, 131-135 | `buildIncludeEngineerFilter` |

### Test Files

| File | Lines | Test Scenarios |
|------|-------|---------------|
| `src/services/search-match-explanation/constraint-explanation.service.test.ts` | 1-214 | 7 test cases |
| `src/services/search-match-explanation/tradeoff-explanation.service.test.ts` | 1-188 | 13 test cases |
| `postman/collections/search-filter-tests.postman_collection.json` | 6079+ | 6 E2E scenarios |

---

## Recommended Learning Order

1. **Read the types first** (`search-match-explanation.types.ts`) - Understand the response shape before any service code. Pay attention to the type hierarchy comment (lines 22-31).

2. **Trace a request through the controller** (`search-match-explanation.controller.ts`) - See how URL params and body are extracted, then trace into the orchestrator.

3. **Study the orchestrator** (`search-match-explanation.service.ts`) - Follow the 8 numbered steps in `generateSearchMatchExplanation`. This is the spine of the feature.

4. **Pick one explanation service to understand deeply** - Start with `constraint-explanation.service.ts` because it's the most complex (skill hierarchy matching). Then skim the others.

5. **Run the tests and try the endpoint** - Execute `npm test` to see unit tests pass, then call the endpoint with curl or Postman to see real responses.

---

## Open Questions

None - implementation is complete and tested.
