---
date: 2026-01-14T10:30:00-08:00
researcher: Claude
git_commit: bec4c9da4a835087607d50f043e447e6ab47fb74
branch: project_2
repository: BitPhoenix/recommender-system
topic: "Project 2 Constraint Advisor Implementation - Code Walkthrough"
tags: [research, codebase, constraint-advisor, quickxplain, relaxation, walkthrough]
status: complete
last_updated: 2026-01-15
last_updated_by: Claude
update_notes: "Consolidated skill query duplication: created skill-extraction.utils.ts as single source of truth for skill extraction from DecomposedConstraints, added buildSkillDistributionQuery to search-query.builder.ts reusing buildProficiencyQualificationClause, updated all consumers to use shared utilities."
---

# Research: Project 2 Constraint Advisor Implementation - Code Walkthrough

**Date**: 2026-01-14T10:30:00-08:00
**Researcher**: Claude
**Git Commit**: bec4c9da4a835087607d50f043e447e6ab47fb74
**Branch**: project_2
**Repository**: BitPhoenix/recommender-system

## Research Question

Generate a code walkthrough plan comparing the implementation against the project plan, optimized for learning and understanding what was implemented.

## Summary

The Constraint Advisor (Project 2) implements automatic constraint advice for the `/api/search/filter` endpoint. The system detects minimal conflicting constraint sets using the QUICKXPLAIN algorithm when results are sparse (< 3) and suggests relaxations, or suggests constraint additions when results are excessive (≥ 25). The implementation closely follows the plan with a clean separation of concerns across 6 service files.

---

# Code Walkthrough Plan

## Learning Path Overview

This walkthrough is designed in **3 phases** of increasing depth:
1. **The Big Picture** - Understanding the architecture and data flow
2. **Core Algorithms** - Deep dive into QUICKXPLAIN and constraint testing
3. **Strategy Patterns** - How relaxation and tightening suggestions are generated

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LEARNING PATH                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: The Big Picture (Start Here)                                  │
│  ├── 1.1 Entry Point: search.service.ts                                 │
│  ├── 1.2 Types Contract: search.types.ts                                │
│  └── 1.3 Orchestration: constraint-advisor.service.ts                   │
│                                                                          │
│  PHASE 2: Core Algorithms                                                │
│  ├── 2.1 Constraint Decomposition: constraint-decomposer.service.ts     │
│  ├── 2.2 Shared Utility: cypher-fragment.builder.ts                     │
│  ├── 2.3 Shared Utility: skill-extraction.utils.ts                      │
│  └── 2.4 QUICKXPLAIN Algorithm: quickxplain.service.ts                  │
│                                                                          │
│  PHASE 3: Strategy Patterns                                              │
│  ├── 3.1 Config-Driven: relaxation-strategies.config.ts                 │
│  ├── 3.2 Relaxation Generator: relaxation-generator.service.ts          │
│  └── 3.3 Tightening Generator: tightening-generator.service.ts          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1: The Big Picture

### 1.1 Entry Point: Where Constraint Advice Fits

**File:** `recommender_api/src/services/search.service.ts`

Start by understanding WHERE the constraint advisor fits in the 7-step search pipeline:

```
Search Pipeline Flow:
┌──────────────────────────────────────────────────────────────┐
│ Step 1:   Expand search criteria (inference engine)          │
│ Step 2:   Resolve skills (hierarchy expansion)               │
│ Step 2b:  Resolve domains                                    │
│ Step 3:   Build query parameters                             │
│ Step 4:   Execute main Cypher query                          │
│ Step 5:   Process raw results                                │
│                                                              │
│ ► Step 5.5: GET CONSTRAINT ADVICE ◄  <-- YOU ARE HERE       │
│                                                              │
│ Step 6:   Calculate utility scores and rank                  │
│ Step 7:   Format response                                    │
└──────────────────────────────────────────────────────────────┘
```

**Key Lines to Read:**
- Line 38: Import statement
- Lines 166-173: Step 5.5 - the call to `getConstraintAdvice()`
- Lines 252-254: How advice is added to response

**Learning Focus:** Notice that constraint advice runs AFTER we have the total result count but BEFORE scoring/ranking. This allows us to analyze what the constraints produced.

---

### 1.2 Types Contract: The API Response Shape

**File:** `recommender_api/src/types/search.types.ts`

Understanding the response shape is critical before diving into implementation.

**Read in Order:**
1. **Lines 109-170:** `AppliedFilter` (discriminated union) - Two kinds:
   - `AppliedPropertyFilter` (kind: `'property'`) - Standard field constraints (has `field`, `operator`, `value`, `source`)
   - `AppliedSkillFilter` (kind: `'skill'`) - Nested discriminated union using `field` as discriminator:
     - `AppliedUserSkillFilter` (field: `'requiredSkills'`) - User-specified skill constraints
     - `AppliedDerivedSkillFilter` (field: `'derivedSkills'`) - Inference-derived skill constraints (has required `ruleId`)
2. **Lines 233-243:** `ConflictSet` - Minimal sets of constraints that together cause 0 results. Note: `constraints` is `AppliedFilter[]` (the discriminated union).
3. **Lines 246-305:** `RelaxationSuggestion` (discriminated union) - Two types:
   - `UserConstraintRelaxation` (type: `'user-constraint'`) - suggests modifying user-provided values (has `field`, `currentValue`, `suggestedValue`)
   - `DerivedConstraintOverride` (type: `'derived-override'`) - suggests bypassing inference rules (has `ruleId`, `ruleName`, `affectedConstraints`)
4. **Lines 307-315:** `RelaxationResult` - Full relaxation payload (conflict analysis + suggestions)
5. **Lines 320-339:** `TighteningSuggestion` and `TighteningResult` - For excessive results
6. **Lines 218-222:** Where these attach to `SearchFilterResponse`

**Key Concept:** The response is conditional:
- `< 3 results` → Include `relaxation` field
- `≥ 25 results` → Include `tightening` field
- `3-24 results` → No advice needed (goldilocks zone)

---

### 1.3 Orchestration: The Decision Logic

**File:** `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`

This is the **brain** that decides which analysis to run.

**Read in Order:**
1. **Lines 16-20:** Threshold constants (SPARSE=3, MANY=25)
2. **Lines 22-29:** Input/Output interfaces - Note `ConstraintAdviceInput` takes only `appliedFilters` (derived constraints now flow through as `AppliedSkillFilter` with `ruleId`)
3. **Lines 40-60:** `getConstraintAdvice()` - The main decision tree
4. **Lines 62-95:** `runRelaxationAnalysis()` - What happens for sparse results
5. **Lines 97-140:** `runTighteningAnalysis()` - What happens for many results

**Architecture Insight:**
```typescript
// Lines 46-61: The decision tree
if (totalCount < SPARSE_RESULTS_THRESHOLD) {
  // Run QUICKXPLAIN → Find conflicts → Generate relaxations
  return { relaxation: await runRelaxationAnalysis(...) };
}

if (totalCount >= MANY_RESULTS_THRESHOLD) {
  // Analyze distributions → Suggest constraints to add
  return { tightening: await runTighteningAnalysis(...) };
}

// Goldilocks zone: no advice needed
return {};
```

---

## PHASE 2: Core Algorithms

### 2.1 Constraint Decomposition: Preparing for Analysis

**File:** `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`

Before QUICKXPLAIN can test constraints, we need to convert `AppliedFilter[]` into `TestableConstraint[]`.

**First, read the types file:**
**File:** `recommender_api/src/services/constraint-advisor/constraint.types.ts`

The constraint type system uses a two-level discriminated union:

1. **Lines 9-15:** `ConstraintType` enum (Property vs SkillTraversal) - First-level discriminator
2. **Lines 20-28:** `PropertyFieldType` enum (Numeric, String, StringArray) - Second-level discriminator for property constraints
3. **Lines 33-38:** `SkillConstraintOrigin` enum (User, Derived) - Second-level discriminator for skill constraints
4. **Lines 44-56:** `ConstraintBase` - Common fields (no `value` - that's in the typed variants)
5. **Lines 61-91:** Property constraint variants:
   - `NumericPropertyConstraint` (fieldType: Numeric, value: number)
   - `StringPropertyConstraint` (fieldType: String, value: string)
   - `StringArrayPropertyConstraint` (fieldType: StringArray, value: string[])
6. **Lines 96-131:** Skill constraint variants:
   - `UserSkillConstraint` (origin: User, value: UserSkillRequirement)
   - `DerivedSkillConstraint` (origin: Derived, value: string[], ruleId: string)
7. **Lines 133-148:** `TestableConstraint` top-level union and type guards
8. **Lines 158-165:** `DecomposedConstraints` - The output structure

**Key Design Decision:** The `value` field is typed differently per constraint variant, eliminating all `as` casts in consumers.

**Then, read the decomposer (organized top-down: main function first, helpers below):**

1. **Lines 23-45:** `decomposeConstraints(appliedFilters)` - Main entry point, routes to specialized handlers
2. **Lines 52-81:** `decomposeSkillFilter()` - Handles AppliedSkillFilter (derived vs user)
3. **Lines 87-116:** `decomposePropertyFilter()` - Routes property filters to specialized handlers
4. **Lines 122-150:** `decomposeBetweenFilter()` - Splits BETWEEN into min/max constraints
5. **Lines 156-190:** `decomposeTimezoneFilter()` - Creates one constraint per timezone prefix
6. **Lines 196-200:** `normalizeOperator()` - Converts display operators to Cypher
7. **Lines 206-238:** `parseFilterValue()` - Re-types string values from AppliedPropertyFilter

**Key Transformations:**
- **Skill filters (`decomposeSkillFilter`):** Uses `isDerivedSkillFilter()` type guard to branch:
  - **`AppliedDerivedSkillFilter`:** Creates ONE grouped constraint per rule with `id: derived_${ruleId}`
  - **`AppliedUserSkillFilter`:** Creates ONE constraint per skill for independent testing
- **BETWEEN operator (`decomposeBetweenFilter`):** Splits into TWO constraints (`>= min` AND `< max`) so conflict detector can identify which bound is problematic
- **Timezone prefixes (`decomposeTimezoneFilter`):** Creates one constraint per prefix for granular testing

**Learning Exercise:** Trace how a BETWEEN constraint like "yearsExperience BETWEEN 6 AND 10" becomes two separate testable constraints.

---

### 2.2 Shared Cypher Utility

**File:** `recommender_api/src/utils/cypher-fragment.builder.ts`

This utility ensures consistent Cypher generation across the system.

**Read:**
1. **Lines 6-10:** `CypherFragment` interface
2. **Lines 15-69:** `buildCypherFragment()` - Handles all operators

**Supported Operators:**
| Operator | Example Output |
|----------|----------------|
| `"IN"` | `e.startTimeline IN $startTimeline` |
| `">="` | `e.yearsExperience >= $minYearsExperience` |
| `"<"` | `e.yearsExperience < $maxYearsExperience` |
| `"<="` | `e.salary <= $budgetCeiling` |
| `"STARTS WITH"` | `e.timezone STARTS WITH $tz0` |
| `"="` | `e.field = $paramName` |

**Note:** The `query-conditions.builder.ts` file now uses this shared utility for all its filter builders (timeline, experience, timezone, budget), establishing a single source of truth for Cypher WHERE clause generation.

---

### 2.3 Shared Skill Extraction Utility

**File:** `recommender_api/src/services/constraint-advisor/skill-extraction.utils.ts`

This utility provides a single source of truth for extracting skill constraints from `DecomposedConstraints`. Previously, this logic was duplicated across three files.

**Read:**
1. **Lines 14-20:** `ExtractedSkillConstraints` interface - separates user skills (with proficiency) from derived skills (existence-only)
2. **Lines 31-35:** `extractSkillConstraints(decomposed)` - Main entry point, delegates to array version
3. **Lines 41-60:** `extractSkillConstraintsFromArray(constraints)` - Core extraction logic

**Key Design:**
- **User skills** (`requiredSkills`): Have proficiency requirements, checked via CASE pattern in queries
- **Derived skills** (`derivedSkills`): Existence-only, checked via `ALL(...WHERE EXISTS {...})` pattern

**Consumers:**
| File | Function Used |
|------|---------------|
| `relaxation-tester.service.ts` | `extractSkillConstraintsFromArray()` |
| `tightening-tester.service.ts` | `extractSkillConstraints()` |
| `tightening-generator.service.ts` | `extractSkillConstraints()` |

---

### 2.4 QUICKXPLAIN Algorithm: Finding Minimal Conflict Sets

**File:** `recommender_api/src/services/constraint-advisor/quickxplain.service.ts`

This is the **heart** of conflict detection. It implements Junker's QUICKXPLAIN algorithm (AAAI 2004).

**Conceptual Overview:**
```
Problem: {A, B, C, D} together → 0 results
Goal: Find MINIMAL subset that causes 0 results

QUICKXPLAIN approach:
1. Binary partition: {A, B} and {C, D}
2. Test each partition with background constraints
3. Recursively narrow down to minimal set
4. Result: e.g., {A, C} is the minimal conflict set
```

**Read in Order:**
1. **Lines 11-16:** `QuickXplainResult` interface
2. **Lines 21-26:** `QuickXplainConfig` (maxSets=3, insufficientThreshold=3)
3. **Lines 44-55:** Helper functions (`countResults`, `isConsistent`)
4. **Lines 73-125:** `quickXplain()` recursive function - **THE CORE ALGORITHM**
5. **Lines 127-196:** Finding additional minimal sets using hitting set approach

**The Recursive Algorithm (Lines 73-125):**
```typescript
async function quickXplain(
  background: TestableConstraint[],  // Already known to be needed
  delta: TestableConstraint[],        // Recently added constraints
  candidates: TestableConstraint[]    // Constraints to test
): Promise<TestableConstraint[] | null>
```

**Key Insight:** The algorithm exploits the fact that if removing a constraint makes results appear, that constraint is part of the conflict. Binary search reduces O(2^n) to O(n log n) queries.

**Learning Exercise:** Walk through the test in `quickxplain.service.test.ts` (lines 109-179) that finds two distinct MCS: {A,B} and {C,D} from four constraints.

---

## PHASE 3: Strategy Patterns

### 3.1 Configuration-Driven Relaxation

**File:** `recommender_api/src/config/knowledge-base/relaxation-strategies.config.ts`

This config embodies **domain knowledge** about how to relax each constraint type.

**Strategy Types (Lines 7-18):**
- `NumericStep` - Multiply by step factors (experience, salary)
- `EnumExpand` - Include more enum values (startTimeline)
- `Remove` - Remove constraint entirely (timezone)
- `DerivedOverride` - Override inference rule (derivedSkills)
- `SkillRelaxation` - Skill-specific logic (lower proficiency, move to preferred)

**Strategy Mapping (Lines 109-153):**
```typescript
export const relaxationStrategies: Record<string, RelaxationStrategy> = {
  yearsExperience: { type: NumericStep, stepsDown: [0.7, 0.5], ... },
  salary: { type: NumericStep, stepsUp: [1.2, 1.5], ... },
  startTimeline: { type: EnumExpand, enumOrder: START_TIMELINE_ORDER, ... },
  timezone: { type: Remove, ... },
  derivedSkills: { type: DerivedOverride, ... },
  requiredSkills: { type: SkillRelaxation, ... },
};
```

**Design Pattern:** Adding relaxation support for a new field = adding an entry to this map.

---

### 3.2 Relaxation Generator: Applying Strategies

**File:** `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`

This service applies the configured strategies to generate concrete suggestions using a discriminated union pattern.

**Read in Order:**
1. **Lines 31-51:** `generateRelaxationSuggestions()` - Entry point
2. **Lines 61-88:** `generateRelaxationsForConstraint()` - Strategy routing
3. **Lines 90-131:** `applyNumericStepStrategy()` - Returns `UserConstraintRelaxation[]` with steps up/down based on operator
4. **Lines 133-175:** `applyEnumExpandStrategy()` - Returns `UserConstraintRelaxation[]` with expanded enum values
5. **Lines 177-210:** `applyRemoveStrategy()` - Returns `UserConstraintRelaxation[]` suggesting constraint removal
6. **Lines 212-254:** `applyDerivedOverrideStrategy()` - Returns `DerivedConstraintOverride[]` with actual DB-tested result counts (no longer returns -1)
7. **Lines 260-327:** `applySkillRelaxationStrategy()` - Returns `UserConstraintRelaxation[]` for complex skill handling

**Type Mapping:**
| Strategy | Return Type | Key Fields |
|----------|-------------|------------|
| NumericStep | `BudgetRelaxation[]` | `field: 'maxBudget'`, `currentValue: number`, `suggestedValue: number` |
| EnumExpand | `StartTimeRelaxation[]` | `field: 'requiredMaxStartTime'`, `currentValue: string`, `suggestedValue: string` |
| Remove | `TimezoneRelaxation[]` | `field: 'requiredTimezone'`, `currentValue: string[]`, `suggestedValue: null` |
| DerivedOverride | `DerivedConstraintOverride[]` | `ruleId`, `ruleName`, `affectedConstraints` |
| SkillRelaxation | `SkillRelaxation[]` | `field: 'requiredSkills'`, `suggestedValue: SkillRelaxationValue` |

**Skill Relaxation Actions** (`SkillRelaxationAction` enum):
| Action | suggestedValue Shape |
|--------|---------------------|
| `LowerProficiency` | `{ action: 'lowerProficiency', skill: string, minProficiency: string }` |
| `MoveToPreferred` | `{ action: 'moveToPreferred', skill: string }` |
| `Remove` | `{ action: 'remove', skill: string }` |

**Skill Relaxation Infrastructure:**

The skill relaxation testing uses proper proficiency-aware count queries that include derived skill constraints. This infrastructure is shared across multiple services:

**File:** `recommender_api/src/services/constraint-advisor/relaxation-tester.service.ts`

1. **`testSkillRelaxation()`** - Tests result count with modified proficiency:
   - Uses `extractSkillConstraintsFromArray()` from `skill-extraction.utils.ts` to get user skills and derived skill IDs
   - Calls `groupSkillsByProficiency()` from skill-resolution.service.ts
   - Calls `buildPropertyConditions()` from constraint-decomposer.service.ts
   - Calls `buildSkillFilterCountQuery(skillGroups, propertyConditions, derivedSkillIds)` - derived skills are now **required** to prevent inflated counts

**File:** `recommender_api/src/services/constraint-advisor/tightening-tester.service.ts`

All four public functions delegate to a shared `runCountQuery(session, context)` helper:
- **`testTightenedPropertyValue()`** - Modifies property param value, delegates to helper
- **`testAddedPropertyConstraint()`** - Adds new WHERE clause, delegates to helper
- **`testAddedSkillConstraint()`** - Adds skill to array, delegates to helper
- **`getBaselineCount()`** - Uses unmodified constraints, delegates to helper

The `CountQueryContext` interface captures: property conditions, user skills, derived skill IDs, and base match clause. The helper handles the skill-aware vs property-only decision tree.

**Key Helpers:**
- `testRelaxedValue()` (Lines 440-477) - Tests what count we'd get with relaxed value (property constraints only)
- `formatValue()` (Lines 430-435) - Formats values for display

**Learning Exercise:** Trace how a `yearsExperience >= 10` constraint gets relaxed to `>= 7` and `>= 5` suggestions, noting the `type: 'user-constraint'` discriminator.

---

### 3.3 Tightening Generator: Distribution Analysis

**File:** `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

When results exceed threshold (≥25), analyze result distribution to suggest effective filters.

**Type-Safe Registry (Lines 18-47):**

The generator uses a type-safe registry pattern that ensures compile-time enforcement:

```typescript
type TightenableField = TighteningSuggestion['field'];

type TighteningSuggestionGenerator = (
  session: Session,
  expanded: ExpandedSearchCriteria
) => Promise<TighteningSuggestion[]>;

const fieldToTighteningSuggestionGenerator: Record<TightenableField, TighteningSuggestionGenerator> = {
  requiredTimezone: generateTimezoneTighteningSuggestions,
  requiredSeniorityLevel: generateSeniorityTighteningSuggestions,
  maxBudget: generateBudgetTighteningSuggestions,
  requiredMaxStartTime: generateTimelineTighteningSuggestions,
  requiredSkills: generateSkillTighteningSuggestions,
};
```

**Key Design Decision:** Using `Record<TightenableField, ...>` ensures we have a generator for every field in the `TighteningSuggestion` discriminated union. Adding a new `TighteningSuggestion` variant will cause a compile error until a generator is added.

**Strictness Filtering:**

Each generator now filters suggestions to only include values **stricter** than the user's current constraint. This prevents suggesting redundant or less-restrictive options:

| Dimension | "Stricter" Means | Uses |
|-----------|------------------|------|
| Budget | Lower `maxBudget` | `expanded.maxBudget` |
| Seniority | Higher level (mid→senior→staff) | `expanded.requiredSeniorityLevel` + `SENIORITY_LEVEL_ORDER` |
| Timeline | Faster (one_month→two_weeks→immediate) | `expanded.requiredMaxStartTime` + `START_TIMELINE_ORDER` |
| Skills | Not already required | `expanded.appliedFilters` (AppliedSkillFilter) |
| Timezone | Not already filtered | `expanded.timezonePrefixes` |

**Read Generator Functions:**
1. **Lines 88-152:** `generateTimezoneTighteningSuggestions()` - Groups by Americas/Europe/APAC, excludes already-filtered regions
2. **Lines 154-222:** `generateSeniorityTighteningSuggestions()` - Buckets by seniority level, only suggests higher levels
3. **Lines 224-295:** `generateBudgetTighteningSuggestions()` - Buckets by salary bands, only suggests lower caps
4. **Lines 297-355:** `generateTimelineTighteningSuggestions()` - Suggests all timelines faster than current
5. **Lines 357-420:** `generateSkillTighteningSuggestions()` - Top skills by frequency, excludes already-required

**Pattern:** Each generator runs a Cypher distribution query, filters by strictness, and generates suggestions with `distributionInfo` like "32 of 40 engineers (80%) are in Americas timezone".

**Shared Skill Extraction Utility:**

**File:** `recommender_api/src/services/constraint-advisor/skill-extraction.utils.ts`

The skill distribution query in `generateSkillTighteningSuggestions` uses shared utilities to avoid code duplication:

1. **`extractSkillConstraints(decomposed)`** - Extracts user skills (with proficiency) and derived skill IDs from `DecomposedConstraints`
2. **`buildSkillDistributionQuery(skillGroups, propertyConditions, derivedSkillIds)`** - Builds the distribution query reusing `buildProficiencyQualificationClause`

This consolidates previously duplicated skill extraction logic from three files (`tightening-generator`, `tightening-tester`, `relaxation-tester`) into a single source of truth.

---

## Test Files Reference

| Test File | Test Count | Focus |
|-----------|-----------|-------|
| `constraint-decomposer.service.test.ts` | 18 | Parsing, query building, ruleId branching, buildPropertyConditions |
| `quickxplain.service.test.ts` | 9 | Conflict detection algorithm |
| `relaxation-generator.service.test.ts` | 14 | Relaxation suggestion generation incl. skill proficiency, derived skills in test queries |
| `tightening-generator.service.test.ts` | 22 | Distribution analysis, strictness filtering for all dimensions |
| `constraint-advisor.service.test.ts` | 13 | Orchestration, thresholds, and relaxation type routing |
| `constraint-expander.service.test.ts` | 58 | AppliedSkillFilter structure for derived constraints |
| `search-query.builder.test.ts` | 39 | Query building incl. buildSkillFilterCountQuery, buildSkillDistributionQuery |
| Postman E2E (tests 58-62) | 5 | API endpoint integration |

---

## Architecture Summary

```
                                search.service.ts
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │  constraint-advisor.service  │
                        │  (Orchestrator)              │
                        │  Thresholds: <3 / ≥25       │
                        └──────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                      ▼
        ┌─────────────────────┐              ┌─────────────────────┐
        │ SPARSE RESULTS      │              │ MANY RESULTS        │
        │ (< 3 matches)       │              │ (≥ 25 matches)      │
        └─────────────────────┘              └─────────────────────┘
                    │                                      │
                    ▼                                      ▼
        ┌─────────────────────┐              ┌─────────────────────┐
        │ constraint-decomposer│              │ tightening-generator│
        │ AppliedFilter →     │              │ Distribution queries │
        │ TestableConstraint  │              │ → Suggestions        │
        │ buildPropertyConds  │              └─────────────────────┘
        └─────────────────────┘                          │
                    │                                    │
                    ▼                                    │
        ┌─────────────────────┐                          │
        │ quickxplain.service │                          │
        │ QUICKXPLAIN algo    │                          │
        │ → ConflictSets[]    │                          │
        └─────────────────────┘                          │
                    │                                    │
                    ▼                                    │
        ┌─────────────────────┐                          │
        │ relaxation-generator│                          │
        │ Strategy patterns   │                          │
        │ → Suggestions[]     │                          │
        └─────────────────────┘                          │
                    │                                    │
        ┌───────────┴───────────────────┐                │
        ▼                               ▼                │
┌───────────────┐            ┌─────────────────────────┐ │
│ cypher-fragment│            │ relaxation-strategies   │ │
│ .builder.ts   │            │ .config.ts (KB config)  │ │
└───────────────┘            └─────────────────────────┘ │
        │                                                │
        │ (skill relaxation)                             │
        │                                                │
        ▼ ◄──────────────────────────────────────────────┘
┌─────────────────────────────────────┐
│ skill-extraction.utils.ts           │ ◄── SHARED UTILITY
│ extractSkillConstraints()           │     (single source of truth)
│ extractSkillConstraintsFromArray()  │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│ search-query.builder.ts             │
│ buildSkillFilterCountQuery(         │
│   skillGroups,                      │
│   propertyConditions,               │
│   derivedSkillIds  ← REQUIRED       │
│ )                                   │
│ buildSkillDistributionQuery(        │ ◄── NEW: reuses proficiency pattern
│   skillGroups,                      │
│   propertyConditions,               │
│   derivedSkillIds                   │
│ )                                   │
│ • proficiency CASE pattern          │
│ • derived skill EXISTS pattern      │
└─────────────────────────────────────┘
```

---

## Plan vs Implementation Comparison

| Plan Phase | Status | Notes |
|------------|--------|-------|
| Phase 1: Response Schema | ✅ Complete | All types implemented at lines 233-298 of search.types.ts |
| Phase 2: Constraint Decomposition | ✅ Complete | Handles BETWEEN splitting, timezone prefixes, derived constraints |
| Phase 3: QUICKXPLAIN | ✅ Complete | Full algorithm with hitting set approach for multiple MCS |
| Phase 4: Relaxation Generator | ✅ Complete | All 5 strategy types implemented |
| Phase 5: Tightening Generator | ✅ Complete | 5 distribution dimensions analyzed |
| Phase 6: Orchestration | ✅ Complete | Clean threshold-based routing |
| Phase 7: Integration | ✅ Complete | Step 5.5 in search pipeline |

**Deviations from Plan:**
1. ~~`AppliedFilter.displayValue` not added~~ **RESOLVED**: `AppliedSkillFilter` now has a `displayValue` field for human-readable skill summary, while `AppliedPropertyFilter` keeps `value` as string

**Completed Post-Implementation:**
1. `query-conditions.builder.ts` refactored to use `buildCypherFragment()` (all 4 filter functions now use the shared utility)
2. `ConflictSet.constraints` refactored from `string[]` to `AppliedFilter[]` for structured constraint data
3. `RelaxationSuggestion` refactored from single interface to discriminated union:
   - Added `RelaxationSuggestionType` enum with `UserConstraint` and `DerivedOverride` values
   - `UserConstraintRelaxation` for user constraint modifications (has `field`, `currentValue`, `suggestedValue`)
   - `DerivedConstraintOverride` for inference rule bypasses (has `ruleId`, `ruleName`, `affectedConstraints`)
   - `applyDerivedOverrideStrategy` now queries DB for actual result counts (no longer returns -1)
4. `AppliedFilter` refactored from single interface to discriminated union:
   - Added `AppliedFilterKind` enum with `Property` and `Skill` values
   - `AppliedPropertyFilter` for standard field constraints (has `field`, `operator`, `value`)
   - `AppliedSkillFilter` for skill constraints (has `skills: ResolvedSkillConstraint[]`, `displayValue`)
   - Type guards `isSkillFilter()` and `isPropertyFilter()` for type-safe narrowing
   - `constraint-expander.service.ts` now accepts resolved skills and produces structured `AppliedSkillFilter`
   - `constraint-decomposer.service.ts` extracts skill IDs directly from `AppliedSkillFilter` - eliminated parallel `requiredSkillIds` parameter
5. `AppliedPreference` refactored similarly with `AppliedPreferenceKind` discriminator:
   - `AppliedPropertyPreference` for standard preferences
   - `AppliedSkillPreference` for skill-based preferences with structured data
6. Derived constraints unified into `AppliedSkillFilter`:
   - `constraint-expander.service.ts` now creates `AppliedSkillFilter` with `field: 'derivedSkills'` and `ruleId` for derived filter constraints
   - `constraint-advisor.service.ts` removed `derivedConstraints` parameter - all constraints now flow through `appliedFilters`
   - `search.service.ts` no longer passes `derivedConstraints` to constraint advisor
7. `AppliedSkillFilter` refactored to nested discriminated union:
   - `AppliedUserSkillFilter` (field: `'requiredSkills'`) - user-specified skill constraints
   - `AppliedDerivedSkillFilter` (field: `'derivedSkills'`, `ruleId: string` required) - inference-derived skill constraints
   - New type guards: `isUserSkillFilter()` and `isDerivedSkillFilter()` for type-safe narrowing
   - `constraint-decomposer.service.ts` uses `isDerivedSkillFilter()` instead of checking optional `ruleId`
   - Compiler now enforces `ruleId` is always present on derived filters
8. Skill relaxation testing now uses proper proficiency-aware count queries:
   - `buildPropertyConditions()` extracted from `buildQueryWithConstraints()` for reuse by skill relaxation
   - `buildProficiencyQualificationClause()` added as single source of truth for proficiency CASE pattern
   - `buildSkillFilterCountQuery()` composes proficiency and property conditions for count queries
   - `testSkillRelaxation()` refactored to use the new infrastructure (no longer returns 0 for skill constraints)
9. **Constraint type unification** - TestableConstraint now uses typed discriminated unions:
   - `PropertyFieldType` enum (Numeric, String, StringArray) as second-level discriminator for property constraints
   - `SkillConstraintOrigin` enum (User, Derived) as second-level discriminator for skill constraints
   - All `as` casts removed from `relaxation-generator.service.ts` - type guards narrow correctly
   - Type guards added: `isNumericPropertyConstraint`, `isStringArrayPropertyConstraint`, `isUserSkillConstraint`, etc.
10. **SuggestedValue discriminated union refactoring** - `UserConstraintRelaxation` and `TighteningSuggestion` now use field-discriminated unions:
    - `UserConstraintRelaxation` split into: `BudgetRelaxation`, `StartTimeRelaxation`, `TimezoneRelaxation`, `SkillRelaxation`
    - `TighteningSuggestion` split into: `TimezoneTightening`, `SeniorityTightening`, `BudgetTightening`, `StartTimeTightening`, `SkillTightening`
    - Skill relaxations now use `SkillRelaxationAction` enum (`LowerProficiency`, `MoveToPreferred`, `Remove`) instead of boolean flags
    - `requiredMaxStartTime` relaxations return single `string` (multiple suggestions) instead of `string[]`
    - `yearsExperience` relaxations removed (no corresponding API field)
11. **Derived skills in skill relaxation test queries** - Fixed bug where `testSkillRelaxation` excluded derived skill constraints:
    - `buildSkillFilterCountQuery()` now requires `derivedSkillIds` parameter (not optional) to prevent silent omission
    - Added `resolveDerivedSkillsFromConstraints()` helper to extract derived skill IDs from constraints
    - `testSkillRelaxation()` now passes derived skills to the count query builder
    - Derived skills use existence-only checks (no proficiency) via Cypher `ALL(...WHERE EXISTS {...})` pattern
    - Result counts for skill relaxation suggestions are now accurate (no longer inflated by missing derived constraints)
12. **Tightening generator strictness filtering** - Suggestions now only include values stricter than current constraint:
    - Replaced loosely-typed `tighteningDimensions` array with type-safe `Record<TightenableField, TighteningSuggestionGenerator>`
    - Added `SENIORITY_LEVEL_ORDER` constant to schema for ordered seniority comparison
    - Added `requiredSeniorityLevel` to `ExpandedSearchCriteria` interface
    - Budget: Only suggests values lower than current `maxBudget`
    - Seniority: Only suggests levels higher than current `requiredSeniorityLevel`
    - Timeline: Only suggests faster timelines than current `requiredMaxStartTime`
    - Skills: Excludes skills already in `requiredSkills` (via `AppliedSkillFilter`)
    - Timezone: Excludes already-filtered timezone regions (via `timezonePrefixes`)
13. **Skill query duplication consolidation** - Eliminated duplicated skill extraction and query building logic:
    - Created `skill-extraction.utils.ts` with `extractSkillConstraints()` and `extractSkillConstraintsFromArray()` as single source of truth
    - Added `buildSkillDistributionQuery()` to `search-query.builder.ts` reusing `buildProficiencyQualificationClause()`
    - `relaxation-tester.service.ts` now uses `extractSkillConstraintsFromArray()` (deleted local `resolveSkillIdsFromConstraints`)
    - `tightening-tester.service.ts` now uses `extractSkillConstraints()` (deleted local `extractSkillsFromConstraints`)
    - `tightening-generator.service.ts` now uses `extractSkillConstraints()` and `buildSkillDistributionQuery()` (deleted local `extractSkillsFromDecomposed` and `buildSkillParams`)
    - Proficiency CASE pattern only exists in `search-query.builder.ts` (no more copy-paste in tightening generator)
14. **Tightening tester duplication consolidation** - Eliminated repeated skill-aware query pattern:
    - Added `CountQueryContext` interface to encapsulate query inputs
    - Added `runCountQuery()` helper as single location for skill-aware vs property-only decision
    - All four tester functions (`getBaselineCount`, `testTightenedPropertyValue`, `testAddedPropertyConstraint`, `testAddedSkillConstraint`) now prepare context and delegate to helper
    - Reduced ~150 lines of duplicated code across the four functions

---

## Recommended Learning Order

1. **Start with the tests** - Run `npm test -- src/services/constraint-advisor/` to see what behaviors are expected
2. **Trace a sparse results scenario** - Follow a request with 0 matches through the full flow
3. **Understand QUICKXPLAIN** - Step through the recursive algorithm manually with paper
4. **Modify a strategy** - Change step factors in relaxation-strategies.config.ts and observe effects
5. **Add a new dimension** - Try adding a new tightening dimension (e.g., location)

---

## Code References

### Primary Implementation Files
- `recommender_api/src/services/search.service.ts:166-173` - Integration point
- `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts:40-64` - Decision logic
- `recommender_api/src/services/constraint-advisor/quickxplain.service.ts:73-125` - Core algorithm
- `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts:48-72` - Strategy routing
- `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts:30-61` - Distribution analysis
- `recommender_api/src/services/constraint-advisor/skill-extraction.utils.ts` - Shared skill extraction from DecomposedConstraints
- `recommender_api/src/services/cypher-query-builder/search-query.builder.ts:197-268` - `buildSkillDistributionQuery()` for tightening

### Type Definitions
- `recommender_api/src/types/search.types.ts:199-233` - AppliedFilter discriminated union (AppliedPropertyFilter, AppliedUserSkillFilter, AppliedDerivedSkillFilter)
- `recommender_api/src/types/search.types.ts:338-365` - SkillRelaxationAction enum, SkillRelaxationValue type, SkillRequirementValue interface
- `recommender_api/src/types/search.types.ts:388-439` - Field-specific relaxation types (BudgetRelaxation, StartTimeRelaxation, TimezoneRelaxation, SkillRelaxation)
- `recommender_api/src/types/search.types.ts:489-536` - Field-specific tightening types (TimezoneTightening, SeniorityTightening, BudgetTightening, StartTimeTightening, SkillTightening)
- `recommender_api/src/types/search.types.ts:569-591` - Type guards (isSkillFilter, isPropertyFilter, isUserSkillFilter, isDerivedSkillFilter)
- `recommender_api/src/services/constraint-advisor/constraint.types.ts:1-165` - Internal constraint types with typed discriminated unions:
  - `PropertyFieldType` enum (Numeric, String, StringArray)
  - `SkillConstraintOrigin` enum (User, Derived)
  - Typed variants: NumericPropertyConstraint, StringPropertyConstraint, StringArrayPropertyConstraint, UserSkillConstraint, DerivedSkillConstraint
  - Type guards for type-safe narrowing

### Configuration
- `recommender_api/src/config/knowledge-base/relaxation-strategies.config.ts:109-153` - Strategy mapping
- `recommender_api/src/config/knowledge-base/index.ts:88-93` - KB exports

### Test Files
- `recommender_api/src/services/constraint-advisor/*.test.ts` - Unit tests (83 total)
- `recommender_api/src/services/constraint-expander.service.test.ts` - Constraint expander tests (54 total, includes AppliedSkillFilter structure tests)
- `postman/collections/search-filter-tests.postman_collection.json` - E2E tests (tests 58-62)

---

## Open Questions

1. **Performance optimization** - How does QUICKXPLAIN perform with many constraints? Plan mentioned potential caching.
2. ~~**Skill traversal handling** - SkillTraversal constraints are excluded from WHERE clause building. How are these tested in conflict detection?~~ **RESOLVED**: Both user and derived skills are now embedded in `AppliedSkillFilter` via nested discriminated union. The `decomposeConstraints` function uses `isDerivedSkillFilter()` type guard:
   - **`AppliedUserSkillFilter`**: Creates one `SkillTraversal` constraint per skill for independent testing
   - **`AppliedDerivedSkillFilter`**: Creates one grouped `SkillTraversal` constraint per rule (compiler enforces `ruleId` is present), enabling override suggestions via `DerivedConstraintOverride` type
