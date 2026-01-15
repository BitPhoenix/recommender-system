# Project 2: Constraint Advisor (QUICKXPLAIN + Relaxation/Tightening)

**Status**: Complete
**Duration**: January 8, 2026 - January 15, 2026
**Branch**: `project_2`
**Git Commit**: bec4c9da4a835087607d50f043e447e6ab47fb74

---

## Executive Summary

Project 2 implements **automatic constraint advice** (Section 5.2.4-5.2.5 of the textbook) for the `/api/search/filter` endpoint. When searches return too few results (< 3), the system identifies minimal conflicting constraint sets using the **QUICKXPLAIN algorithm** and suggests relaxations. When searches return too many results (>= 25), it analyzes result distributions and suggests additional constraints.

For example:
- **Sparse results (< 3)** → Detect conflicts like "senior + Kubernetes + Kafka" that together exclude all candidates → Suggest lowering proficiency, expanding timeline, or overriding inference rules
- **Many results (>= 25)** → Analyze distribution like "80% are in Americas timezone" → Suggest adding timezone filter

The project progressed through four phases:
1. **Research & Seed Preparation** (Jan 8-10): Seed expansion to 40 engineers, algorithm research
2. **Core Implementation** (Jan 10-13): QUICKXPLAIN, decomposition, orchestration
3. **Type System Refinement** (Jan 14): Discriminated unions for AppliedFilter, RelaxationSuggestion, TestableConstraint
4. **Advanced Features** (Jan 14-15): Skill relaxation, strictness filtering, query consolidation

---

## Core Capabilities

### 1. Threshold-Based Decision Logic

The constraint advisor orchestrates analysis based on result count:

```
Search Results
      │
      ▼
┌─────────────────────────────────┐
│ totalCount < 3 (Sparse)         │──► Relaxation Analysis
├─────────────────────────────────┤
│ totalCount 3-24 (Goldilocks)    │──► No advice needed
├─────────────────────────────────┤
│ totalCount >= 25 (Many)         │──► Tightening Analysis
└─────────────────────────────────┘
```

### 2. QUICKXPLAIN Algorithm

Finds **minimal conflict sets** (MCS) - the smallest combinations of constraints that together cause zero results:

```
Input: {A, B, C, D} → 0 results
Goal: Find minimal subset causing 0 results

QUICKXPLAIN approach:
1. Binary partition: {A, B} and {C, D}
2. Test each partition with background constraints
3. Recursively narrow down to minimal set
4. Result: e.g., {A, C} is a minimal conflict set
```

**Key Characteristics:**
- O(k·log(n/k)) query complexity (k = conflict size, n = total constraints)
- Hitting set approach to find multiple distinct MCS (up to 3)
- Each MCS is independently actionable - relaxing any one constraint yields results

### 3. Constraint Decomposition

Transforms high-level `AppliedFilter` objects into granular `TestableConstraint` units:

| Filter Type | Decomposition | Purpose |
|------------|---------------|---------|
| **BETWEEN** | Two constraints (min/max) | Identify which bound is problematic |
| **Timezone prefixes** | One per prefix | Test each timezone independently |
| **User skills** | One per skill | Independent skill testing |
| **Derived skills** | One grouped per rule | Enable rule override suggestions |

### 4. Relaxation Strategies

Five strategy types for generating relaxation suggestions:

| Strategy | Fields | Example |
|----------|--------|---------|
| **NumericStep** | `maxBudget` | Increase budget cap by 20%, 50% |
| **EnumExpand** | `requiredMaxStartTime` | Expand from `immediate` to `two_weeks` |
| **Remove** | `requiredTimezone` | Remove timezone constraint entirely |
| **DerivedOverride** | `derivedSkills` | Override inference rule that added skills |
| **SkillRelaxation** | `requiredSkills` | Lower proficiency, move to preferred, or remove |

### 5. Tightening Distribution Analysis

Analyzes result distribution to suggest effective filters:

| Dimension | Analysis | Example Suggestion |
|-----------|----------|-------------------|
| **Timezone** | Groups by region (Americas/Europe/APAC) | "32 of 40 engineers (80%) are in Americas" |
| **Seniority** | Buckets by level | "Consider requiring senior level" |
| **Budget** | Applies step-down multipliers | "Lower budget cap to $150,000" |
| **Timeline** | Suggests faster availability | "Require two_weeks availability" |
| **Skills** | Top skills by frequency | "Add Python requirement (present in 60%)" |

**Strictness Filtering:** Only suggests values stricter than current constraints.

---

## Development Timeline

### Phase 1: Research & Seed Preparation (January 8-10, 2026)

**Research Documents:**

1. **Project 2 Seed Data Analysis** (`2026-01-08-project-2-seed-data-analysis.md`)
   - Analyzed 5-engineer seed limitations
   - Identified need for 40 engineers to test conflict scenarios

2. **40-Engineer Seed Specification** (`2026-01-08-40-engineer-seed-specification.md`)
   - Designed realistic engineer distribution
   - Ensured constraint conflicts would occur naturally

3. **Seed Data Realism Evaluation** (`2026-01-08-seed-data-realism-evaluation.md`)
   - Validated distributions against real-world patterns
   - Verified conflict scenarios would trigger

4. **40-Engineer Plan Verification** (`2026-01-10-40-engineer-plan-verification.md`)
   - Final validation before implementation

**Plans Implemented:**

5. **40-Engineer Seed Implementation** (`2026-01-08-40-engineer-seed-implementation.md`)
   - Expanded seed from 5 to 40 engineers
   - Created full evidence chains for skills

### Phase 2: Core Implementation (January 10-13, 2026)

**Research Documents:**

6. **Project 2 Implementation Research** (`2026-01-10-project-2-implementation-research.md`)
   - Analyzed QUICKXPLAIN algorithm from textbook
   - Mapped to existing codebase architecture
   - Decided on integrated auto-diagnosis approach

**Plans Implemented:**

7. **Main Constraint Advisor Plan** (`2026-01-10-project-2-constraint-advisor.md`)
   - 7-phase implementation plan (85K words)
   - Defined response schema, decomposition, QUICKXPLAIN, relaxation, tightening, orchestration, integration

### Phase 3: Type System Refinement (January 14, 2026)

**Research Documents:**

8. **Constraint Advisor Missed Test Cases** (`2026-01-14-constraint-advisor-missed-test-cases.md`)
   - Identified edge cases not covered by initial tests

9. **Applied Filter Plan Validation** (`2026-01-14-applied-filter-plan-validation.md`)
   - Validated discriminated union approach before implementation

10. **Enrich Applied Skill Filter Plan Validation** (`2026-01-14-enrich-applied-skill-filter-plan-validation.md`)
    - Validated nested discriminated union for derived constraints

**Plans Implemented:**

11. **Query Conditions Builder Refactoring** (`2026-01-14-query-conditions-builder-refactoring.md`)
    - Created `buildCypherFragment()` utility for consistent Cypher generation
    - Eliminated duplicated WHERE clause logic

12. **Conflict Set Type Refactoring** (`2026-01-14-conflict-set-type-refactoring.md`)
    - Changed `ConflictSet.constraints` from `string[]` to `AppliedFilter[]`
    - Enabled structured constraint data in conflict analysis

13. **Relaxation Suggestion Discriminated Union** (`2026-01-14-relaxation-suggestion-discriminated-union.md`)
    - Split `RelaxationSuggestion` into `UserConstraintRelaxation` | `DerivedConstraintOverride`
    - Added actual DB-tested result counts for derived overrides

14. **Applied Filter Discriminated Union** (`2026-01-14-applied-filter-discriminated-union-refactoring.md`)
    - Refactored `AppliedFilter` to discriminated union (Property vs Skill)
    - Eliminated parallel data paths for skill constraints

15. **Constraint Decomposer Skill Separation** (`2026-01-14-constraint-decomposer-skill-separation.md`)
    - Extracted skill IDs directly from `AppliedSkillFilter`
    - Removed redundant `requiredSkillIds` parameter

16. **Enrich Applied Skill Filter for Derived Constraints** (`2026-01-14-enrich-applied-skill-filter-for-derived-constraints.md`)
    - Created nested discriminated union: `AppliedUserSkillFilter` vs `AppliedDerivedSkillFilter`
    - Compiler now enforces `ruleId` presence on derived filters

17. **resultingCount Rename Refactor** (`2026-01-14-resultingCount-rename-refactor.md`)
    - Standardized naming from `resultingCountIfRelaxed` to `resultingMatches`

### Phase 4: Advanced Features (January 14-15, 2026)

**Research Documents:**

18. **Skill Relaxation Implementation Research** (`2026-01-14-skill-relaxation-implementation.md`)
    - Analyzed proficiency-aware count query requirements

19. **Skill Relaxation Plan Evaluation** (`2026-01-14-skill-relaxation-plan-evaluation.md`)
    - Validated approach before implementation

20. **Suggested Value Discriminated Union Plan Validation** (`2026-01-15-suggested-value-discriminated-union-plan-validation.md`)
    - Validated field-discriminated union approach

**Plans Implemented:**

21. **Skill Relaxation Implementation** (`2026-01-14-skill-relaxation-implementation.md`)
    - Added proficiency-aware count queries
    - Created `buildSkillFilterCountQuery()` for skill relaxation testing
    - Fixed derived skill inclusion in relaxation tests

22. **Constraint Type Unification** (`2026-01-15-constraint-type-unification.md`)
    - Added typed discriminated unions to `TestableConstraint`
    - Property constraints: Numeric, String, StringArray variants
    - Skill constraints: User vs Derived variants
    - Eliminated all `as` casts in relaxation-generator

23. **Suggested Value Discriminated Union** (`2026-01-15-suggested-value-discriminated-union.md`)
    - Field-discriminated unions for `UserConstraintRelaxation` and `TighteningSuggestion`
    - `SkillRelaxationAction` enum (LowerProficiency, MoveToPreferred, Remove)
    - Aligned relaxation output with API schema

**Post-Implementation Consolidation:**

24. **Code Walkthrough** (`2026-01-14-project-2-constraint-advisor-walkthrough.md`)
    - Comprehensive learning guide with architecture diagrams
    - Three-phase walkthrough: Big Picture → Core Algorithms → Strategy Patterns

25. **Tightening Generator Walkthrough** (`2026-01-15-tightening-generator-walkthrough.md`)
    - Detailed analysis of strictness filtering and distribution queries

---

## Architecture

### File Structure

```
recommender_api/src/
├── config/knowledge-base/
│   └── relaxation-strategies.config.ts    # Strategy definitions
├── services/
│   ├── search.service.ts                  # Integration point (Step 5.5)
│   └── constraint-advisor/
│       ├── constraint-advisor.service.ts  # Orchestrator
│       ├── constraint-decomposer.service.ts # AppliedFilter → TestableConstraint
│       ├── constraint.types.ts            # Internal constraint types
│       ├── quickxplain.service.ts         # QUICKXPLAIN algorithm
│       ├── relaxation-generator.service.ts # Strategy-based suggestions
│       ├── relaxation-tester.service.ts   # DB testing for relaxations
│       ├── tightening-generator.service.ts # Distribution-based suggestions
│       ├── tightening-tester.service.ts   # DB testing for tightenings
│       └── skill-extraction.utils.ts      # Shared skill extraction
├── utils/
│   └── cypher-fragment.builder.ts         # Shared Cypher generation
└── types/
    └── search.types.ts                    # API types (discriminated unions)
```

### Data Flow

```
SearchFilterRequest
       │
       ▼
┌──────────────────────────────────────────┐
│         Search Pipeline (Steps 1-5)      │
└──────────────────────────────────────────┘
       │
       ▼ totalCount
┌──────────────────────────────────────────┐
│     Step 5.5: Constraint Advisor         │
│                                          │
│  if (totalCount < 3):                    │
│    1. decomposeConstraints(appliedFilters)│
│    2. findConflictSets(QUICKXPLAIN)      │
│    3. generateRelaxationSuggestions()    │
│    → return { relaxation: ... }          │
│                                          │
│  if (totalCount >= 25):                  │
│    1. runDistributionQueries()           │
│    2. generateTighteningSuggestions()    │
│    → return { tightening: ... }          │
│                                          │
│  else: return {}                         │
└──────────────────────────────────────────┘
       │
       ▼
SearchFilterResponse
```

### Type System Diagram

```
AppliedFilter (API)
├── AppliedPropertyFilter (kind: 'property')
│   └── field, operator, value: string
└── AppliedSkillFilter (kind: 'skill')
    ├── AppliedUserSkillFilter (field: 'requiredSkills')
    │   └── skills: ResolvedSkillConstraint[]
    └── AppliedDerivedSkillFilter (field: 'derivedSkills')
        └── skills, ruleId: string (required)

TestableConstraint (Internal)
├── PropertyConstraint (constraintType: 'property')
│   ├── NumericPropertyConstraint (fieldType: 'numeric')
│   ├── StringPropertyConstraint (fieldType: 'string')
│   └── StringArrayPropertyConstraint (fieldType: 'string-array')
└── SkillTraversalConstraint (constraintType: 'skill-traversal')
    ├── UserSkillConstraint (origin: 'user')
    └── DerivedSkillConstraint (origin: 'derived')

RelaxationSuggestion (API)
├── UserConstraintRelaxation (type: 'user-constraint')
│   ├── BudgetRelaxation (field: 'maxBudget')
│   ├── StartTimeRelaxation (field: 'requiredMaxStartTime')
│   ├── TimezoneRelaxation (field: 'requiredTimezone')
│   └── SkillRelaxation (field: 'requiredSkills')
└── DerivedConstraintOverride (type: 'derived-override')
    └── ruleId, ruleName, affectedConstraints

TighteningSuggestion (API)
├── TimezoneTightening (field: 'requiredTimezone')
├── SeniorityTightening (field: 'requiredSeniorityLevel')
├── BudgetTightening (field: 'maxBudget')
├── StartTimeTightening (field: 'requiredMaxStartTime')
└── SkillTightening (field: 'requiredSkills')
```

---

## Key Design Decisions

### 1. Integrated Auto-Diagnosis

**Decision**: Integrate constraint advice into `/api/search/filter` rather than separate endpoint.

**Rationale**:
- Better UX - users get advice automatically when needed
- Efficiency - reuses already-parsed constraints
- Single roundtrip - no extra network calls
- Pragmatic - textbook's separate endpoint was pedagogical

### 2. Three-Level Discriminated Unions

**Decision**: Use nested discriminated unions throughout the type system.

**Rationale**:
- Compile-time safety - TypeScript enforces correct field access
- No `as` casts - type guards narrow correctly
- Self-documenting - discriminator fields indicate type
- Extensible - adding new variants causes compile errors at unhandled cases

### 3. Separate AppliedFilter and TestableConstraint

**Decision**: Keep API types and internal types separate despite similarities.

**Rationale**:
- Different purposes - API serialization vs query building
- Different cardinality - one AppliedSkillFilter → multiple TestableConstraints
- Implementation details - Cypher fragments shouldn't leak to API
- Transformation is intentional - decomposition does real work

### 4. Strategy Pattern for Relaxation

**Decision**: Use configuration-driven strategy pattern for relaxation generation.

**Rationale**:
- Adding new field = adding config entry, not code changes
- Clear separation - strategy knows how to relax, orchestrator knows when
- Testable - each strategy can be tested in isolation
- Domain knowledge - strategies encode domain-specific relaxation rules

### 5. Strictness Filtering for Tightening

**Decision**: Only suggest values stricter than current constraints.

**Rationale**:
- Prevents redundant suggestions (e.g., "add senior when already requiring senior")
- Logical consistency - tightening should narrow, not loosen
- Better UX - fewer irrelevant suggestions
- Explicit logic - compile-time registry ensures all fields are handled

---

## Current State

### What Works

- Automatic constraint advice at thresholds (< 3 sparse, >= 25 many)
- QUICKXPLAIN algorithm finding up to 3 minimal conflict sets
- Five relaxation strategies with type-safe discriminated unions
- Five tightening dimensions with strictness filtering
- Skill relaxation with proficiency-aware count queries
- Derived constraint override suggestions with actual result counts
- Comprehensive test coverage (76 unit tests, 160 E2E assertions)

### API Response Examples

**Sparse Results (< 3 matches):**
```typescript
{
  matches: [...],
  totalCount: 1,
  relaxation: {
    conflictAnalysis: {
      conflictSets: [
        {
          constraints: [AppliedFilter, AppliedFilter],
          explanation: "These constraints together eliminate all candidates"
        }
      ]
    },
    suggestions: [
      {
        type: 'user-constraint',
        field: 'maxBudget',
        currentValue: 100000,
        suggestedValue: 150000,
        resultingMatches: 8,
        rationale: "Increase budget ceiling by 50%"
      },
      {
        type: 'derived-override',
        ruleId: 'scaling-requires-distributed',
        ruleName: 'Scaling Focus Requires Distributed Systems',
        affectedConstraints: [...],
        resultingMatches: 5,
        rationale: "Override inference rule to remove derived requirement"
      }
    ]
  }
}
```

**Many Results (>= 25 matches):**
```typescript
{
  matches: [...],
  totalCount: 35,
  tightening: {
    suggestions: [
      {
        field: 'requiredTimezone',
        suggestedValue: ['America/'],
        distributionInfo: "28 of 35 engineers (80%) are in Americas timezone",
        resultingMatches: 28,
        rationale: "Filter by timezone region to narrow results"
      }
    ]
  }
}
```

### Test Coverage

| Category | Files | Test Cases |
|----------|-------|------------|
| Unit/Integration | 5 | 76 |
| E2E (Postman) | 5 requests | 160 assertions |
| **Total** | **10** | **236+** |

**Key Test Files:**
- `constraint-advisor.service.test.ts` - 13 tests (orchestration, thresholds)
- `quickxplain.service.test.ts` - 9 tests (algorithm, hitting sets)
- `relaxation-generator.service.test.ts` - 14 tests (all strategies)
- `tightening-generator.service.test.ts` - 22 tests (all dimensions, strictness)
- `constraint-decomposer.service.test.ts` - 18 tests (decomposition, query building)

---

## Metrics

| Metric | Value |
|--------|-------|
| Total implementation plans | 12 |
| Research documents | 13 |
| Development duration | 8 days |
| Lines of code (new files) | ~3,500 |
| Service files | 9 |
| Discriminated union types | 12 |
| Relaxation strategies | 5 |
| Tightening dimensions | 5 |
| Type guards | 10+ |

---

## Lessons Learned

1. **Discriminated unions eliminate cast hell** - The progressive refinement from `unknown` to typed unions eliminated all unsafe casts while maintaining flexibility.

2. **Decomposition enables granular testing** - Splitting BETWEEN into two constraints allows identifying "min too high" vs "max too low" conflicts.

3. **Strictness filtering prevents noise** - Only suggesting stricter values for tightening avoids redundant/confusing suggestions.

4. **Shared utilities reduce drift** - Creating `skill-extraction.utils.ts` and `cypher-fragment.builder.ts` consolidated duplicated logic that was evolving independently.

5. **Type system drives discovery** - Using `Record<TightenableField, ...>` ensures compile errors when new suggestion types lack generators.

6. **Nested unions handle complexity** - AppliedSkillFilter's nested union (User vs Derived) cleanly handles two very different use cases with one type.

7. **Configuration-driven strategies scale** - Adding relaxation support for new fields requires only config changes, not code.

---

## Future Considerations

These were not implemented but may be valuable:

1. **Query caching** - Cache QUICKXPLAIN partial results for repeated constraint patterns
2. **Parallel constraint testing** - Neo4j session pooling for concurrent conflict tests
3. **Explanation generation** - Natural language explanations of why conflicts occur
4. **Weighted relaxation** - Prioritize suggestions by domain importance (e.g., skills over timezone)
5. **Incremental tightening** - Show how combinations of tightenings compound
6. **Client-side preview** - Optimistic UI updates before server round-trip

---

## Documentation

- **Code Walkthrough**: `research/2026-01-14-project-2-constraint-advisor-walkthrough.md` - Three-phase learning guide with architecture diagrams
- **Tightening Walkthrough**: `research/2026-01-15-tightening-generator-walkthrough.md` - Deep dive into distribution analysis
- **CLAUDE.md**: Updated with constraint advisor integration point and test commands
