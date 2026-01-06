# Project 1: Constraint-Based Engineer Recommender API

**Status**: Complete
**Duration**: December 30, 2025 - January 6, 2026
**Branch**: `chapter_5_project_1`
**Git Commit**: f69d60a570e5e52d71350e7a4fd7a28846da5d93

---

## Executive Summary

Project 1 implements a **constraint-based recommender system** for matching software engineers to job requirements. Built on Neo4j graph database with a TypeScript/Express API, the system allows hiring managers to specify required and preferred criteria, then returns ranked candidates with full transparency into how scores were computed.

The project progressed through three phases:
1. **Foundation** (Dec 30): Core search API, domain filtering, utility scoring
2. **Refinement** (Dec 31 - Jan 1): Terminology alignment, validation improvements, query optimization
3. **Maturation** (Jan 2 - Jan 6): Graduated scoring, unified skill matching, SRP refactoring

---

## Core Capabilities

### 1. Constraint-Based Search

The API accepts search requests with two types of constraints:

**Hard Filters (Required)** - Candidates must meet these to appear in results:
- `requiredSkills` - Skills with minimum proficiency levels (learning/proficient/expert)
- `requiredMaxSalary` - Budget ceiling (candidates over budget are excluded)
- `requiredBusinessDomains` / `requiredTechnicalDomains` - Must have experience in specified domains
- `requiredSeniority` - Minimum seniority level

**Soft Rankings (Preferred)** - Influence ranking without excluding:
- `preferredSkills` - Skills with preferred proficiency levels
- `preferredBusinessDomains` / `preferredTechnicalDomains` - Bonus for domain experience
- `preferredTimezone` - Timezone proximity preference
- `preferredSeniority` - Preferred seniority band
- `preferredSalaryRange` - Ideal salary range within budget
- `preferredStartTimeline` - Availability window preference

### 2. Skill Hierarchy Traversal

Skills exist in a hierarchical graph:
```
Frontend Development
├── React
│   ├── React Hooks
│   └── React Router
├── Vue.js
└── Angular
```

When a user searches for "Frontend Development", the system:
1. Expands to all descendant skills (React, Vue.js, Angular, etc.)
2. Matches engineers who have ANY of those skills
3. Distinguishes "direct" matches from "descendant" matches in scoring

### 3. Multi-Attribute Utility Scoring

Each candidate receives a utility score (0-1) computed from weighted components:

| Component | Weight | Description |
|-----------|--------|-------------|
| Skill Match | 25% | Coverage of requested skills + proficiency alignment |
| Confidence | 14% | Average confidence in skill assessments |
| Salary | 7% | Budget alignment with gradual decay for over-budget |
| Seniority | 9% | Match to preferred seniority band |
| Experience | 10% | Years of relevant experience |
| Timezone | 5% | Proximity to preferred timezone |
| Availability | 5% | Alignment with start timeline |
| Business Domain | 8% | Match to preferred business domains |
| Technical Domain | 8% | Match to preferred technical domains |
| Team Focus | 5% | Individual contributor vs tech lead preference |
| Related Skills | 4% | Bonus for having related skills |

### 4. Score Transparency

Every response includes a full breakdown showing:
- Raw and weighted scores for each component
- Which skills matched (direct vs descendant)
- Which domain requirements/preferences were satisfied
- Constraint violations for unmatched related skills

---

## Development Timeline

### Phase 1: Foundation (December 30, 2025)

**Plans Implemented:**

1. **Basic Constraint Search API** (`2025-12-30-project-1-basic-constraint-search-api.md`)
   - Established POST `/api/search/filter` endpoint
   - Implemented Cypher query builder for Neo4j
   - Created utility calculation framework

2. **Belongs-To-Category Relationship** (`2025-12-30-belongs-to-category-relationship.md`)
   - Added `:BELONGS_TO_CATEGORY` edge type in Neo4j
   - Enabled skill → category lookups for domain filtering

3. **Domain Filtering** (`2025-12-30-domain-filtering-implementation.md`)
   - Implemented business domain filtering (FinTech, Healthcare, etc.)
   - Implemented technical domain filtering (Cloud, Mobile, etc.)
   - Added domain hierarchy support

4. **Required vs Preferred Properties** (`2025-12-30-required-preferred-properties-implementation.md`)
   - Distinguished hard filters from soft ranking signals
   - Established the `required*` / `preferred*` naming convention

5. **Utility Score Breakdown** (`2025-12-30-utility-score-breakdown-transparency.md`)
   - Added detailed score breakdown in API responses
   - Exposed raw scores, weights, and weighted contributions

6. **Query Builder Consolidation** (`2025-12-30-consolidate-query-builders.md`)
   - Merged separate skill and browse query builders
   - Reduced code duplication in Cypher generation

### Phase 2: Refinement (December 31, 2025 - January 1, 2026)

**Plans Implemented:**

7. **Terminology Alignment** (`2025-12-31-rename-bonus-to-match-terminology.md`)
   - Renamed "bonus" → "match" throughout codebase
   - Aligned variable names with domain language

8. **Zod Validation** (`2025-12-31-replace-validation-middleware-with-zod.md`)
   - Replaced custom validation with Zod schemas
   - Added type-safe request parsing
   - Improved error messages for invalid requests

9. **Unified Query Builder Structure** (`2025-12-31-unify-search-query-builder-structure.md`)
   - Consolidated skill-filtered and unfiltered (browse) queries
   - Used conditional segments instead of separate code paths

10. **Count Query Consolidation** (`2025-12-31-consolidate-count-into-search-query.md`)
    - Merged separate count query into main search query
    - Computed totalCount before pagination for efficiency

11. **Threshold-Based Timeline Scoring** (`2025-12-31-threshold-based-start-timeline.md`)
    - Implemented graduated scoring for availability windows
    - Immediate availability scores highest, further out scores lower

12. **Per-Skill Proficiency** (`per-skill-proficiency.md`)
    - Enabled different proficiency requirements per skill
    - Example: "React at expert, TypeScript at proficient"

13. **Filters/Preferences Split** (`2026-01-01-rename-expanded-constraints-split-filters-preferences.md`)
    - Renamed `expandedConstraints` → clearer `filters` and `preferences`
    - Improved API response structure clarity

14. **Domain Model Redesign** (`2026-01-01-domain-model-redesign.md`)
    - Restructured how domains are represented in responses
    - Added `meetsRequired` / `meetsPreferred` flags per domain

### Phase 3: Maturation (January 2-6, 2026)

**Plans Implemented:**

15. **Business Domain Hierarchy** (`2026-01-02-business-domain-hierarchy.md`)
    - Added hierarchical business domains (Technology → SaaS, E-commerce, etc.)
    - Enabled parent-child traversal for domain matching

16. **Domain Flag Fixes** (`2026-01-02-fix-domain-meetsRequired-meetsPreferred.md`)
    - Fixed computation of `meetsRequired`/`meetsPreferred` flags
    - Ensured correct constraint satisfaction reporting

17. **Flatten Domain Constraint Sets** (`2026-01-02-flatten-domain-constraint-sets.md`)
    - Converted arrays to Sets for O(1) lookups
    - Performance optimization for domain matching

18. **Parallel Arrays Refactor** (`2026-01-02-refactor-parallel-arrays-to-map-iteration.md`)
    - Eliminated fragile parallel array iteration patterns
    - Used Map-based iteration for safer data handling

19. **Graduated Proficiency Scoring** (`2026-01-02-graduated-proficiency-scoring.md`)
    - Implemented partial credit for proficiency mismatches
    - Formula: `(actualLevel + 1) / (preferredLevel + 1)`
    - Expert preferred but proficient found = 67% credit (not 0%)

20. **Remove Dead Confidence Filtering** (`2026-01-02-remove-dead-confidence-filtering.md`)
    - Removed unused `meetsConfidence` field
    - Confidence now only affects ranking (14% weight), not filtering

21. **Unified Skill Matching Score** (`2026-01-02-unified-skill-matching-score.md`)
    - Consolidated `calculateSkillMatchUtility` and `calculatePreferredSkillProficiencyMatch`
    - Single unified function handles coverage + proficiency alignment

22. **Search Service SRP Refactor** (`2026-01-02-refactor-search-service-srp.md`)
    - Split 614-line `search.service.ts` into focused modules:
      - `constraint-expander.service.ts` - Expands skill hierarchies
      - `search-query.service.ts` - Builds and executes Cypher
      - `search.service.ts` - Orchestration layer
    - Improved testability and maintainability

23. **Utility Calculator SRP Refactor** (`2026-01-06-utility-calculator-srp-refactor.md`)
    - Split 980-line `utility-calculator.service.ts` into:
      - `scoring/core-scoring.ts` - Core utility functions
      - `scoring/logistics-scoring.ts` - Timezone, availability, salary
      - `utility-calculator.ts` - Orchestration
    - Reduced cognitive load per file

24. **Salary Utility Gradual Decay** (`2026-01-06-salary-utility-gradual-decay.md`)
    - Replaced hard cutoff with exponential decay for over-budget candidates
    - Within budget: score = 1.0 (all equally affordable)
    - Over budget: `0.5^(percentOver / 0.20)` (halves every 20% over)
    - Exceptional candidates 10% over budget can still surface

---

## Architecture

### File Structure (Post-Refactoring)

```
recommender_api/src/
├── config/
│   └── knowledge-base/
│       ├── utility.config.ts      # Weight configurations
│       └── defaults.config.ts     # Default search parameters
├── schemas/
│   └── search.schema.ts           # Zod validation schemas
├── services/
│   ├── search.service.ts          # Main orchestration (slim)
│   ├── constraint-expander.service.ts  # Skill/domain hierarchy expansion
│   ├── cypher-query-builder/
│   │   ├── index.ts
│   │   ├── query-types.ts
│   │   ├── search-query.builder.ts
│   │   ├── query-conditions.builder.ts
│   │   └── query-domain-filter.builder.ts
│   └── utility-calculator/
│       ├── utility-calculator.ts  # Main entry point
│       ├── scoring/
│       │   ├── core-scoring.ts    # Skill match, confidence, experience
│       │   └── logistics-scoring.ts  # Timezone, availability, salary
│       └── index.ts
└── types/
    ├── search.types.ts            # Request/response types
    └── knowledge-base.types.ts    # Domain model types
```

### Data Flow

```
1. Request received at POST /api/search/filter
                    ↓
2. Zod validates and parses request body
                    ↓
3. ConstraintExpander expands skill/domain hierarchies
   - "Frontend" → [React, Vue, Angular, ...]
   - "Technology" → [SaaS, E-commerce, ...]
                    ↓
4. CypherQueryBuilder generates Neo4j query
   - MATCH patterns for engineers with skills
   - WHERE clauses for hard filters
   - COLLECT for skill/domain aggregation
                    ↓
5. Neo4j executes query, returns raw results
                    ↓
6. UtilityCalculator scores each candidate
   - Applies weighted multi-attribute formula
   - Generates full score breakdown
                    ↓
7. Results sorted by utility score, paginated
                    ↓
8. Response includes ranked candidates + breakdowns
```

---

## Key Design Decisions

### 1. Required vs Preferred Separation

**Decision**: Two distinct constraint types instead of just weighted priorities.

**Rationale**: Reflects real hiring - some things are non-negotiable (must know Python), others are preferences (ideally senior level). Hard filters reduce result set before expensive scoring.

### 2. Graduated Proficiency Scoring

**Decision**: Partial credit for proficiency mismatches instead of binary pass/fail.

**Rationale**: A proficient engineer is still valuable when you prefer expert. The formula `(actual+1)/(preferred+1)` gives:
- Expert preferred, proficient found → 67%
- Expert preferred, learning found → 33%
- Proficient preferred, learning found → 50%

### 3. Salary Exponential Decay

**Decision**: Gradual decay for over-budget instead of hard cutoff.

**Rationale**: Teams often stretch budgets for exceptional candidates. Someone $10k over isn't the same as $50k over. The decay (`0.5^(percentOver/0.20)`) gives:
- 10% over → 71% score
- 20% over → 50% score
- 40% over → 25% score

### 4. Confidence for Ranking Only

**Decision**: Confidence affects utility score (14% weight) but never filters.

**Rationale**: An engineer who self-reports "expert TypeScript" without assessment shouldn't be excluded - they should rank lower while still appearing. As more engineers complete assessments, confidence naturally improves.

### 5. Single Responsibility Refactoring

**Decision**: Split large service files into focused modules.

**Rationale**:
- `search.service.ts` was 614 lines doing expansion, querying, and transformation
- `utility-calculator.service.ts` was 980 lines with 20+ functions
- After splitting: no file over 300 lines, each has single concern

---

## Current State

### What Works

- Full constraint-based search with required/preferred separation
- Skill hierarchy expansion with direct/descendant distinction
- Domain filtering with hierarchy support
- Multi-attribute utility scoring with 11 weighted components
- Transparent score breakdowns in every response
- Graduated proficiency and salary scoring
- Clean, SRP-compliant architecture

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/search/filter` | Main search endpoint with constraints |
| GET | `/health` | Health check |

### Test Coverage

- Newman/Postman collection with comprehensive API tests
- Validates filtering, scoring, and response structure
- Run with: `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json`

---

## Metrics

| Metric | Value |
|--------|-------|
| Total implementation plans | 24 |
| Development duration | 8 days |
| Lines of code (post-refactor) | ~2,500 in services |
| Largest file (post-refactor) | ~280 lines |
| Utility weight components | 11 |
| Supported filter types | 6 required + 9 preferred |

---

## Lessons Learned

1. **Start with required/preferred split** - Doing this early prevented API churn later

2. **Transparency builds trust** - Score breakdowns help users understand and tune searches

3. **Graduated scoring > binary** - Real-world matching is rarely all-or-nothing

4. **Refactor early, refactor often** - The SRP splits at 600+ lines were overdue; should have split at 300

5. **Dead code accumulates** - The confidence filtering removal showed how unused code persists

---

## Future Considerations

These were not implemented but may be valuable:

1. **Unit test infrastructure** - Jest/Vitest setup for utility functions
2. **Caching layer** - Redis for repeated hierarchy expansions
3. **Weight customization** - Allow per-request utility weight overrides
4. **Saved searches** - Persist and re-run constraint sets
5. **Batch scoring** - Bulk candidate evaluation for large pools
