---
date: 2026-01-19T12:30:00-05:00
researcher: Claude
git_commit: d0c4c8a9e055f1909396e862024f79ca9fc3403f
branch: project_5
repository: recommender-system
topic: "Project 5 Critique System Code Walkthrough"
tags: [research, codebase, critique, critiquing-system, chapter-5, walkthrough]
status: complete
last_updated: 2026-01-19T23:15:00-05:00
last_updated_by: Claude
---

# Code Walkthrough: Project 5 Critique System

**Date**: 2026-01-19T12:30:00-05:00
**Researcher**: Claude
**Git Commit**: d0c4c8a9e055f1909396e862024f79ca9fc3403f
**Branch**: project_5
**Repository**: recommender-system

## 1. Summary

Project 5 implements a **critiquing system** (Section 5.3.2) that allows users to iteratively refine search results through directional adjustments ("more experience"), replacement values ("set timezone to Pacific"), and skill modifications ("add Python requirement"). The system also generates **dynamic critique suggestions** by mining patterns from current results using a support-based frequent pattern mining approach.

The architectural approach is **critique-as-constraint-modification**: user critiques are interpreted as modifications to the existing `SearchFilterRequest`, then executed through the existing search pipeline. This maximizes code reuse while adding critique-specific metadata (what changed, result count delta) and dynamic suggestions (patterns mined from results).

## 2. Learning Path Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 1: ENTRY POINTS                               │
│                                                                             │
│  ┌──────────────────┐    ┌───────────────────┐    ┌───────────────────────┐│
│  │ 1.1 Schema       │───▶│ 1.2 Types         │───▶│ 1.3 Controller/Route  ││
│  │ (validation)     │    │ (request/response)│    │ (HTTP layer)          ││
│  └──────────────────┘    └───────────────────┘    └───────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 2: CORE LOGIC                                 │
│                                                                             │
│  ┌──────────────────┐    ┌───────────────────┐    ┌───────────────────────┐│
│  │ 2.1 Critique     │───▶│ 2.2 Interpreter   │───▶│ 2.3 Service           ││
│  │     Config       │    │ (adjustments→     │    │ (orchestration)       ││
│  │                  │    │  search criteria) │    │                       ││
│  └──────────────────┘    └───────────────────┘    └───────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: DYNAMIC CRITIQUE GENERATION                     │
│                                                                             │
│  ┌──────────────────┐    ┌───────────────────┐    ┌───────────────────────┐│
│  │ 3.1 Property     │───▶│ 3.2 Single &      │───▶│ 3.3 Filter & Rank     ││
│  │     Value        │    │     Compound      │    │ (support ordering)    ││
│  │     Configs      │    │     Generators    │    │                       ││
│  └──────────────────┘    └───────────────────┘    └───────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phased Walkthrough

### PHASE 1: ENTRY POINTS

---

### 1.1 Critique Schema

**File:** `recommender_api/src/schemas/critique.schema.ts`

This file defines the Zod validation schemas for critique requests. Understanding the schema is essential because it defines the discriminated union pattern that flows through the entire system.

**Read in Order:**

1. **Lines 24-42:** `CritiquablePropertySchema` (enum) - Properties that can be critiqued
   - `'seniority'` → maps to `requiredSeniorityLevel`
   - `'budget'` → maps to `maxBudget`
   - `'timeline'` → maps to `requiredMaxStartTime`
   - `'timezone'` → maps to `requiredTimezone`
   - `'skills'` → maps to `requiredSkills`
   - `'businessDomains'` → maps to `requiredBusinessDomains`
   - `'technicalDomains'` → maps to `requiredTechnicalDomains`

2. **Lines 44-54:** `CritiqueOperationSchema` (enum) - Operations that can be performed
   - `'adjust'` - Directional change (requires direction)
   - `'set'` - Replace with specific value (requires value)
   - `'add'` - Add to collection (requires value)
   - `'remove'` - Remove from collection (requires item)

3. **Lines 56-74:** `DirectionSchema` (enum) - Direction words for 'adjust' operations
   - `'more'` / `'less'` - seniority, budget, skill proficiency
   - `'sooner'` / `'later'` - timeline
   - `'narrower'` / `'wider'` - timezone

4. **Lines 76-83:** `collectionProperties` and `isCollectionProperty`
   - Constant array of collection properties: `['skills', 'businessDomains', 'technicalDomains']`
   - Type guard function used by operation schemas to validate collection operations

5. **Lines 108-116:** `propertyToValidDirections` - Maps valid directions per property
   - Type: `Record<CritiquableProperty, readonly Direction[]>` (type-safe, not string)
   - Used by schema refinements to validate direction is valid for property

6. **Lines 134-158:** `AdjustOperationSchema` - Directional changes
   - Has `direction` field (required)
   - Has optional `item` field for collection properties
   - Two refinements: validate direction and require item for collections (uses `isCollectionProperty`)

7. **Lines 168-179:** `SetOperationSchema` - Replacement values
   - Has `value` field with union type accepting multiple value types
   - No refinements needed

8. **Lines 188-197:** `AddOperationSchema` - Add to collections
   - Has `value` field (SkillValue or DomainValue)
   - Refinement: uses `isCollectionProperty` to validate

9. **Lines 206-215:** `RemoveOperationSchema` - Remove from collections
   - Has `item` field (string)
   - Refinement: uses `isCollectionProperty` to validate

10. **Lines 221-226:** `CritiqueAdjustmentSchema` (discriminated union on `operation`)
    - Combines all four operation schemas
    - TypeScript narrows type based on `operation` value

11. **Lines 240-253:** `CritiqueRequestSchema` - Main request schema
    - `baseSearch`: Full SearchFilterRequest from previous search
    - `adjustments`: Array of CritiqueAdjustment (min 1)
    - Merges with PaginationSchema for limit/offset

**Key Concept:** The discriminated union on `operation` enables type-safe handling throughout the codebase. When `operation === 'adjust'`, TypeScript knows `direction` exists. When `operation === 'set'`, TypeScript knows `value` exists.

---

### 1.2 Critique Types

**File:** `recommender_api/src/types/critique.types.ts`

This file defines response types and re-exports schema types. Parent interfaces are placed before child interfaces for top-down readability.

**Read in Order:**

1. **Lines 17-30:** Re-exports from schema
   - All schema types are re-exported for single import point
   - Includes `AdjustOperation`, `SetOperation`, `AddOperation`, `RemoveOperation` for precise typing

2. **Lines 39-62:** `CritiqueResponse` (interface) - Full response type (top-level parent)
   - Includes `EngineerMatch[]`, `appliedFilters`, `appliedPreferences`, etc. (from search)
   - `appliedCritiqueAdjustments` and `failedCritiqueAdjustments` at top level (parallel to `appliedFilters`)
   - `suggestedCritiques?: DynamicCritiqueSuggestion[]`

3. **Lines 67-76:** `CritiqueQueryMetadata` (interface) - Query execution metadata
   - Standard fields: `executionTimeMs`, `skillsExpanded`, `defaultsApplied`, `unresolvedSkills`
   - Critique-specific fields: `previousResultCount`, `resultCountChange`

4. **Lines 86-92:** `CritiqueAdjustmentBase` (interface) - Base request fields
   - Common fields: `property`, `operation`, `direction?`, `value?`, `item?`
   - Extended by `AppliedCritiqueAdjustment`, `FailedCritiqueAdjustment`
   - Used directly in `DynamicCritiqueSuggestion.adjustments`

5. **Lines 102-111:** `AppliedCritiqueAdjustment` (interface) - Successful adjustment record
   - Extends `CritiqueAdjustmentBase`
   - Adds result fields: `modifiedField`, `previousValue`, `newValue`, `warning?`

6. **Lines 117-122:** `FailedCritiqueAdjustment` (interface) - Failed adjustment record
   - Extends `CritiqueAdjustmentBase`
   - Adds failure fields: `targetField`, `reason`

7. **Lines 132-143:** `DynamicCritiqueSuggestion` (interface) - Mined pattern suggestion
   - `adjustments`: Array of `CritiqueAdjustmentBase`
   - `description`: Human-readable description
   - `resultingMatches`: How many results this yields
   - `support`: Percentage of current results with this pattern (0-1)
   - `rationale`: Why this suggestion is useful

8. **Import:** `DerivedConstraintInfo` - Imported from `search.types.ts` (canonical source)
   - Used for inference rule provenance in the response

**Key Concept:** `appliedCritiqueAdjustments` and `failedCritiqueAdjustments` are at the top level (not nested in metadata) because they are core outputs parallel to `appliedFilters`. Count-related metadata (`previousResultCount`, `resultCountChange`) lives in `queryMetadata`.

---

### 1.3 Controller and Route

**File:** `recommender_api/src/controllers/critique.controller.ts`

This file handles HTTP request/response and validation.

**Read in Order:**

1. **Lines 10-16:** Imports - Schema for validation, service for execution
2. **Lines 18-35:** `handleCritique` function
   - Line 20: Cast validated body to `CritiqueRequest`
   - Lines 22-25: Get driver, create session, call `executeCritique`
   - Lines 27-31: Error handling with structured error response
   - Line 33: Finally block closes session

**File:** `recommender_api/src/routes/search.routes.ts`

**Read in Order:**

1. **Lines 33-39:** Route registration
   - `router.post('/critique', validate(CritiqueRequestSchema), handleCritique)`
   - Uses Zod validation middleware before controller
   - Path: POST `/api/search/critique`

**Key Concept:** Validation happens in middleware via Zod schema, so the controller receives type-safe data.

---

### PHASE 2: CORE LOGIC

---

### 2.1 Critique Configuration

**File:** `recommender_api/src/config/knowledge-base/critique.config.ts`

This file contains tuning parameters extracted for visibility and easy modification.

**Read in Order:**

1. **Lines 10-15:** `budget` section
   - `adjustmentFactor: 0.20` - 20% change per directional adjustment
   - `floorValue: 30_000` - Minimum allowed budget ($30,000)

2. **Lines 17-22:** `dynamicCritiques` section
   - `minSupportThreshold: 0.15` - 15% minimum support for suggestions
   - `maxSuggestions: 5` - Maximum suggestions returned

**Key Concept:** Configuration is separated for tuning. Budget adjustment factor (20%) and support threshold (15%) are the key parameters that affect user experience.

---

### 2.2 Critique Interpreter Service

**File:** `recommender_api/src/services/critique-interpreter.service.ts`

This is the translation layer that converts critique adjustments into modified SearchFilterRequest. It's the heart of the critique system.

**Read in Order:**

1. **Lines 34-39:** `InterpretedCritiques` interface - Return type
   - `modifiedSearchFilterRequest`: The search request after applying all critique adjustments
   - `appliedCritiqueAdjustments`: Successful adjustments
   - `failedCritiqueAdjustments`: Failed adjustments

2. **Lines 41-44:** `AdjustmentResult` type (discriminated union on `type`)
   - `{ type: 'applied'; modifiedSearchFilterRequest; applied }` - Success
   - `{ type: 'failed'; failed }` - Failure
   - This pattern flows through all handlers

3. **Lines 56-80:** `applyAdjustmentsToSearchCriteria` - Main entry point
   - Iterates over adjustments sequentially
   - Accumulates applied/failed results
   - Updates `modifiedSearchFilterRequest` on each success

4. **Lines 88-115:** `applyAdjustmentToSearchCriteria` - Dispatcher
   - Switch on `adjustment.property`
   - Calls appropriate handler for each property
   - Domains share a handler with `domainType` parameter

5. **Lines 118-177:** `applySeniorityAdjustmentToSearchCriteria`
   - Demonstrates discriminated union narrowing on `operation`
   - `'set'`: Uses `adjustment.value`
   - `'adjust'`: Uses `adjustment.direction`, modifies index in SENIORITY_LEVEL_ORDER
   - Returns boundary warnings at max/min

6. **Lines 179-231:** `applyBudgetAdjustmentToSearchCriteria`
   - `'set'`: Sets to exact value
   - `'adjust'`: Multiplies by `(1 ± adjustmentFactor)`, clamps to floor
   - **Returns `failed`** if adjusting non-existent budget

7. **Lines 233-274:** `applyTimelineAdjustmentToSearchCriteria`
   - `'sooner'`: Decrements index (toward immediate)
   - `'later'`: Increments index (toward three_months)
   - Boundary warnings at fastest/slowest

8. **Lines 276-360:** `applyTimezoneAdjustmentToSearchCriteria`
   - Most complex handler
   - `'set'`: Normalizes scalar or array input
   - `'adjust'` + `'narrower'`: Removes outermost zones, keeps middle
   - `'adjust'` + `'wider'`: Adds adjacent zones
   - **Returns `failed`** if adjusting non-existent timezone

9. **Lines 362-437:** `applySkillsAdjustmentToSearchCriteria`
   - `'add'`: Adds skill or updates existing
   - `'remove'`: **Returns `failed`** if skill not found
   - `'adjust'`: Modifies proficiency level
   - `'set'`: Replaces entire array (rare)

10. **Lines 439-500:** `applyDomainAdjustmentToSearchCriteria`
    - Unified handler for business and technical domains
    - `'add'`: Adds domain or updates minYears
    - `'remove'`: **Returns `failed`** if domain not found

**Key Concept:** The `applied` vs `failed` return type allows the service to track partial success. A compound critique with 3 adjustments might have 2 succeed and 1 fail, and the client sees exactly what happened.

---

### 2.3 Critique Service

**File:** `recommender_api/src/services/critique.service.ts`

This is the orchestration layer that ties everything together.

**Read in Order:**

1. **Lines 27-33:** `executeCritique` function signature
   - Takes Neo4j session and CritiqueRequest
   - Returns CritiqueResponse

2. **Lines 34-42:** **Step 1: Baseline Count**
   - Executes base search with `limit: 0` to get count only
   - Stores `previousResultCount` for later comparison

3. **Lines 44-48:** **Step 2: Apply Adjustments**
   - Calls `applyAdjustmentsToSearchCriteria` from interpreter
   - Gets modified criteria, applied/failed lists

4. **Lines 50-55:** **Step 3: Execute Modified Search**
   - Calls `executeSearch` from search.service.ts
   - Uses modified criteria with pagination

5. **Lines 54-63:** **Step 4: Generate Dynamic Suggestions**
   - Only runs if there are matches AND `searchResult.expandedCriteria` exists
   - Uses the `expandedCriteria` already computed by `executeSearch` (no duplicate resolution)
   - Calls `generateDynamicCritiques` from critique-generator

6. **Lines 65-85:** **Step 5: Assemble Response**
   - Combines search results with critique metadata
   - Calculates `resultCountChange`
   - Includes suggestions only if non-empty

**Key Concept:** The service reuses the existing search pipeline via `executeSearch`. The `expandedCriteria` is now returned directly from `executeSearch`, eliminating the need for duplicate skill resolution and criteria expansion. This ensures consistency with regular search behavior while adding critique-specific metadata.

---

### PHASE 3: DYNAMIC CRITIQUE GENERATION

---

### 3.1 Property Value Candidate Configurations

**File:** `recommender_api/src/services/critique-generator/critique-candidate-config.ts`

This file defines the `CritiqueAdjustmentCandidatePropertyConfig` interface and provides concrete implementations for all 7 critiquable properties. It's the foundation of the dynamic critique generation system.

**Read in Order:**

1. **Lines 25-49:** `CritiqueAdjustmentCandidatePropertyValue` interface
   - `id`: Unique identifier
   - `displayLabel`: Human-readable label
   - `matchValue`: Data for filtering (type varies by property)
   - Note: This represents just the **value** part of a critique (a full critique is "property + operation + value")

2. **Lines 51-60:** `CritiqueAdjustmentCandidateContext` interface
   - `searchFilterRequest`: Original SearchFilterRequest
   - `expandedSearchCriteria`: ExpandedSearchCriteria (derived values)

3. **Lines 62-109:** `CritiqueAdjustmentCandidatePropertyConfig` interface
   - `propertyKey`: Which property this config handles
   - `getCritiqueAdjustmentCandidatePropertyValues()`: What values to suggest
   - `doesEngineerPassFilter()`: Check if engineer matches candidate
   - `buildCritiqueAdjustment()`: Create adjustment object
   - `formatDescription()`: Description for single-property suggestion
   - `formatRationale()`: Rationale with support percentage

4. **Lines 115-149:** `timezoneCandidateConfig`
   - Candidates: US timezone zones not already required
   - Filter: `engineerMatch.timezone === candidate.matchValue`
   - Adjustment: `{ property: 'timezone', operation: 'set', value }`

5. **Lines 151-188:** `seniorityCandidateConfig`
   - Candidates: Seniority levels stricter than current (higher minYears)
   - Filter: `yearsExperience >= candidate.matchValue`
   - Uses `seniorityMinYears` from canonical config

6. **Lines 190-239:** `timelineCandidateConfig`
   - Candidates: Timelines earlier than loosest allowed
   - Filter: Cumulative - engineer matches if start time is at-or-before
   - Adjustment: `{ property: 'timeline', operation: 'set', value }`

7. **Lines 241-295:** `skillsCandidateConfig`
   - Candidates: Top 5 skills by occurrence, excluding already required
   - Filter: `matchedSkills.some(skill => skill.skillId === candidate.matchValue)`
   - Adjustment: `{ property: 'skills', operation: 'add', value: { skill, proficiency: 'learning' } }`

8. **Lines 297-366:** `budgetCandidateConfig`
   - Candidates: Salary percentiles (25th, 50th, 75th) stricter than current
   - Filter: `salary <= candidate.matchValue`
   - Adjustment: `{ property: 'budget', operation: 'set', value }`

9. **Lines 368-433:** `businessDomainsCandidateConfig`
   - Candidates: Top 5 domains by occurrence, excluding already required
   - Filter: `matchedBusinessDomains.some(d => d.domainId === candidate.matchValue)`

10. **Lines 435-500:** `technicalDomainsCandidateConfig`
    - Same pattern as business domains

11. **Lines 506-531:** Config collections
    - `SINGLE_PROPERTY_CANDIDATE_CONFIGS`: All 7 configs for single-property suggestions
    - `COMPOUND_PROPERTY_PAIRS`: 3 pairs for compound suggestions

**Key Concept:** The `CritiqueAdjustmentCandidatePropertyConfig` interface enables generic candidate generation. A single function can generate suggestions for any property by using the config's methods, eliminating per-property duplication.

---

### 3.2 Single-Attribute and Compound Generators

**File:** `recommender_api/src/services/critique-generator/single-attribute-critique-generator.ts`

This file mines patterns for individual properties.

**Read in Order:**

1. **Lines 22-38:** `mineSinglePropertyPatterns`
   - Iterates over all configs in `SINGLE_PROPERTY_CANDIDATE_CONFIGS`
   - Calls `generateCritiqueSuggestionsForProperty` for each

2. **Lines 40-78:** `generateCritiqueSuggestionsForProperty`
   - Gets candidate property values from config
   - For each candidate:
     - Counts engineers passing filter
     - Calculates support ratio
     - Builds suggestion with adjustment, description, rationale

**File:** `recommender_api/src/services/critique-generator/compound-critique-generator.ts`

This file mines 2-property combinations.

**Read in Order:**

1. **Lines 32-49:** `mineCompoundPatterns`
   - Iterates over pairs in `COMPOUND_PROPERTY_PAIRS`
   - Calls `generateCompoundCritiqueSuggestionsForPropertyPair` for each

2. **Lines 55-99:** `generateCompoundCritiqueSuggestionsForPropertyPair`
   - Gets candidate property values from both configs
   - Cartesian product: tests all combinations
   - Counts engineers passing BOTH filters
   - Builds suggestion with TWO adjustments

3. **Lines 109-135:** `formatCompoundDescription`
   - Natural language formatting based on attribute pair
   - Examples: "Senior-level engineers in Pacific timezone", "Python developers in Eastern timezone"

**Key Concept:** Compound patterns are often more valuable because they're less obvious and eliminate more candidates. The textbook (p.193) recommends ordering by ascending support because low-support patterns are more useful for narrowing results.

---

### 3.3 Filter and Rank

**File:** `recommender_api/src/services/critique-generator/critique-filter.ts`

This file filters and ranks the final suggestions.

**Read in Order:**

1. **Lines 22-30:** `filterAndRankCritiqueSuggestions`
   - Filter: `support >= minSupportThreshold` (default 15%)
   - Sort: Ascending by support (low support first)
   - Slice: Top `maxSuggestions` (default 5)

**File:** `recommender_api/src/services/critique-generator/dynamic-critique-generator.service.ts`

This is the main orchestrator.

**Read in Order:**

1. **Lines 32-64:** `generateDynamicCritiques`
   - Creates `CritiqueAdjustmentCandidateContext` from request and expanded criteria
   - Step 1: Mine single-property patterns
   - Step 2: Mine compound patterns
   - Step 3: Filter and rank combined results

**Key Concept:** The ascending support ordering is based on the textbook recommendation (Section 5.3.2.3): "low support critiques are often less obvious patterns that can be used to eliminate a larger number of items from the candidate list."

---

## 4. Architecture Diagram

```
                              POST /api/search/critique
                                        │
                                        ▼
                            ┌────────────────────────┐
                            │  critique.controller   │
                            │  - Validation (Zod)    │
                            │  - Session management  │
                            └───────────┬────────────┘
                                        │
                                        ▼
                            ┌────────────────────────┐
                            │   critique.service     │
                            │   (Orchestration)      │
                            │                        │
                            │  1. Baseline count ────┼───────────┐
                            │  2. Apply adjustments  │           │
                            │  3. Execute search ────┼───────────┤
                            │  4. Generate suggest.  │           │
                            │  5. Assemble response  │           │
                            └──┬─────────┬───────────┘           │
                               │         │                       │
                ┌──────────────┘         │       ┌───────────────┘
                │                        │       │
                ▼                        │       ▼
┌───────────────────────────────┐        │    ┌────────────────────────┐
│ critique-interpreter          │        │    │    search.service      │
│                               │        │    │    (Existing)          │
│ applyAdjustments..()          │        │    │                        │
│   ├─ seniority handler        │        │    │  executeSearch()       │
│   ├─ budget handler           │        │    │   ├─ expand criteria   │
│   ├─ timeline handler         │        │    │   ├─ build query       │
│   ├─ timezone handler         │        │    │   ├─ execute           │
│   ├─ skills handler           │        │    │   ├─ score results     │
│   └─ domains handler          │        │    │   └─ return expanded   │
│                               │        │    │       criteria         │
│ Returns:                      │        │    └────────────────────────┘
│  - modifiedSearchFilterReq    │        │
│  - appliedCritiqueAdjustments │        │
│  - failedCritiqueAdjustments  │        │
└───────────────────────────────┘        │
                                         ▼
                            ┌────────────────────────────────────────┐
                            │          critique-generator/           │
                            │                                        │
                            │  ┌──────────────────────────────────┐  │
                            │  │ dynamic-critique-generator.svc   │  │
                            │  │ (Orchestrator)                   │  │
                            │  └───────────────┬──────────────────┘  │
                            │                  │                     │
                            │    ┌─────────────┴─────────────┐       │
                            │    │                           │       │
                            │    ▼                           ▼       │
                            │  ┌─────────────┐   ┌─────────────────┐ │
                            │  │ single-attr │   │ compound-       │ │
                            │  │ generator   │   │ generator       │ │
                            │  └──────┬──────┘   └────────┬────────┘ │
                            │         │                   │          │
                            │         └─────────┬─────────┘          │
                            │                   │                    │
                            │                   ▼                    │
                            │        ┌─────────────────────┐         │
                            │        │ critique-candidate- │         │
                            │        │ config (shared)     │         │
                            │        │  - timezone         │         │
                            │        │  - seniority        │         │
                            │        │  - timeline         │         │
                            │        │  - skills           │         │
                            │        │  - budget           │         │
                            │        │  - domains (2)      │         │
                            │        └─────────────────────┘         │
                            │                   │                    │
                            │                   ▼                    │
                            │        ┌─────────────────────┐         │
                            │        │   critique-filter   │         │
                            │        │ - min support 15%   │         │
                            │        │ - sort ascending    │         │
                            │        │ - limit to 5        │         │
                            │        └─────────────────────┘         │
                            └────────────────────────────────────────┘
```

---

## 5. Reference Tables

### Test Files

| File | Tests | Focus Area |
|------|-------|------------|
| `critique-interpreter.service.test.ts` | 26 | All property handlers, operations, edge cases, compound adjustments |
| `utility.config.test.ts` | 11 | `getSeniorityLevelFromYears` boundary cases |
| `critique-filter.test.ts` | 6 | Threshold filtering, ascending sort, limits |
| **Postman Collection** | 12 | E2E endpoint tests |
| **Total** | **55** | |

### Type Registries

| Schema/Type | Location | Purpose |
|------------|----------|---------|
| `CritiquablePropertySchema` | critique.schema.ts:32-40 | 7 critiquable properties |
| `CritiqueOperationSchema` | critique.schema.ts:47-52 | 4 operations |
| `DirectionSchema` | critique.schema.ts:65-72 | 6 directions |
| `collectionProperties` | critique.schema.ts:79 | Collection properties constant |
| `isCollectionProperty` | critique.schema.ts:81-83 | Type guard for collection properties |
| `propertyToValidDirections` | critique.schema.ts:108-116 | Valid directions per property (type-safe) |
| `SINGLE_PROPERTY_CANDIDATE_CONFIGS` | critique-candidate-config.ts:510-518 | 7 property candidate configs |
| `COMPOUND_PROPERTY_PAIRS` | critique-candidate-config.ts:527-531 | 3 compound pairs |

### Configuration Values

| Config | Value | Purpose |
|--------|-------|---------|
| `budget.adjustmentFactor` | 0.20 | 20% change per "more/less budget" |
| `budget.floorValue` | 30,000 | Minimum budget ($30k) |
| `dynamicCritiques.minSupportThreshold` | 0.15 | 15% minimum support |
| `dynamicCritiques.maxSuggestions` | 5 | Max suggestions returned |

---

## 6. Plan vs Implementation

| Plan Phase | Status | Notes |
|------------|--------|-------|
| **Phase 1: Types and Schema** | Complete | Schema at critique.schema.ts, types at critique.types.ts. Matches plan exactly. |
| **Phase 2: Critique Interpreter** | Complete | All 7 property handlers implemented. Applied/failed distinction works correctly. |
| **Phase 3: Dynamic Critique Generator** | Complete | All 7 single-attribute configs, 3 compound pairs. Modular architecture with shared interface. |
| **Phase 4: Service and Endpoint** | Complete | Service orchestrates 5-step flow. Route registered at POST /api/search/critique. |
| **Phase 5: Testing** | Complete | 55 tests total (26 interpreter, 11 config, 6 filter, 12 E2E). |

### Deviations from Plan

1. **Timeline matching is cumulative**: The plan mentioned timeline mining but didn't specify the cumulative matching logic. Implementation uses "engineer matches if start time is at-or-before candidate timeline" which makes more sense semantically.

2. **ExpandedCriteria returned from executeSearch**: The original implementation called `resolveAllSkills` and `expandSearchCriteria` in the critique service to get the expanded criteria for dynamic critique generation. This was refactored so that `executeSearch` returns `expandedCriteria` directly in its response, eliminating duplicate computation and an extra Neo4j query.

### Post-Implementation Additions

1. **Budget percentile mining**: `budgetMiningConfig` generates candidates at 25th, 50th, 75th salary percentiles. This wasn't explicitly detailed in the plan's config definition.

2. **Domain mining configs**: Both `businessDomainsMiningConfig` and `technicalDomainsMiningConfig` were implemented following the same pattern as skills, which the plan mentioned but didn't fully specify.

---

## 7. Code References

### Primary Implementation Files

| File | Line Range | Contents |
|------|------------|----------|
| `recommender_api/src/schemas/critique.schema.ts` | 1-255 | Zod validation schemas (includes `isCollectionProperty` type guard) |
| `recommender_api/src/types/critique.types.ts` | 1-145 | TypeScript types (DerivedConstraintInfo imported from search.types.ts) |
| `recommender_api/src/services/critique-interpreter.service.ts` | 1-500 | Adjustment interpreter |
| `recommender_api/src/services/critique.service.ts` | 1-86 | Main orchestration |
| `recommender_api/src/controllers/critique.controller.ts` | 1-35 | HTTP controller |
| `recommender_api/src/routes/search.routes.ts` | 33-39 | Route registration |

### Critique Generator Module

| File | Line Range | Contents |
|------|------------|----------|
| `recommender_api/src/services/critique-generator/critique-candidate-config.ts` | 1-532 | CritiqueAdjustmentCandidatePropertyConfig interface and 7 implementations |
| `recommender_api/src/services/critique-generator/dynamic-critique-generator.service.ts` | 1-65 | Main orchestrator |
| `recommender_api/src/services/critique-generator/single-attribute-critique-generator.ts` | 1-79 | Single-attribute mining |
| `recommender_api/src/services/critique-generator/compound-critique-generator.ts` | 1-136 | Compound pattern mining |
| `recommender_api/src/services/critique-generator/critique-filter.ts` | 1-31 | Filter and rank |
| `recommender_api/src/services/critique-generator/pattern-mining-utils.ts` | 1-38 | Shared utilities |

### Configuration

| File | Line Range | Contents |
|------|------------|----------|
| `recommender_api/src/config/knowledge-base/critique.config.ts` | 1-24 | Critique tuning parameters |
| `recommender_api/src/config/knowledge-base/utility.config.ts` | 193-220 | `seniorityMinYears` and `getSeniorityLevelFromYears` |

---

## 8. Recommended Learning Order

1. **Start with the schema** (`critique.schema.ts`): Understand the discriminated union on `operation` and how different operations have different required fields. This pattern flows through the entire system.

2. **Read the interpreter** (`critique-interpreter.service.ts`): Focus on `applySeniorityAdjustmentToSearchCriteria` first to see how the discriminated union enables type-safe handling. Then skim other handlers for patterns.

3. **Understand the service flow** (`critique.service.ts`): Follow the 5-step flow and note how it reuses `executeSearch` from the existing search service.

4. **Explore critique candidate configs** (`critique-candidate-config.ts`): Read the `CritiqueAdjustmentCandidatePropertyConfig` interface, then one or two concrete implementations (timezone and skills are good examples).

5. **Run the tests**: Execute `npm test` and look at test cases in `critique-interpreter.service.test.ts` to see edge cases and expected behavior.

---

## 9. Open Questions

1. **Session persistence**: The current implementation is stateless (client tracks history). Should the server track critique history for analytics or undo functionality?

2. **Compound pattern optimization**: Currently generates cartesian product of all candidate pairs. With many skills and domains, this could grow. Consider sampling or limiting candidates more aggressively.

3. **Support threshold tuning**: The 15% minimum support threshold is from the plan. Should this be configurable per request or based on result set size?

4. **Missing test coverage**:
   - No unit tests for `single-attribute-critique-generator.ts`
   - No unit tests for `compound-critique-generator.ts`
   - No unit tests for `critique-candidate-config.ts`
   - The plan specified these but they weren't found in the codebase

5. **Dynamic suggestions ordering**: The ascending support ordering is per textbook recommendation, but user testing may reveal different preferences.
