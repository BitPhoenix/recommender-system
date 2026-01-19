# Project 5: Critiquing System

**Status**: Complete
**Duration**: January 19, 2026
**Branch**: `project_5`
**Git Commit**: d0c4c8a9e055f1909396e862024f79ca9fc3403f

---

## Executive Summary

Project 5 implements a **critiquing system** (Section 5.3.2) that allows users to iteratively refine search results through directional adjustments ("more experience"), replacement values ("set timezone to Pacific"), and skill modifications ("add Python requirement"). The system also generates **dynamic critique suggestions** by mining patterns from current results using support-based frequent pattern analysis.

The implementation features:
1. **Unified adjustment model**: All critiques follow `{ property, operation, direction?, value?, item? }` structure
2. **Type-safe interpretation**: Discriminated union on `operation` enables compile-time guarantees
3. **Full reuse**: Modified searches flow through existing search pipeline
4. **Dynamic suggestions**: Pattern mining generates non-obvious refinement options
5. **Complete transparency**: Applied/failed adjustments, warnings, and result count changes

---

## Problem Statement

Projects 1-4 implemented various search modalities:
- **Project 1-2**: Constraint-based filtering with inference rules and constraint advisor
- **Project 3**: Similarity-based search (find engineers like a reference)
- **Project 4**: Hybrid filter + similarity (constraints + reference-based ranking)

But these are all **single-shot** interactions. Real users often need to **iteratively refine** their search:

> "The results are close, but I need engineers with MORE experience."
> "Actually, my budget is flexible—can we increase it?"
> "These are too spread out geographically—narrow to Pacific only."

This requires a **conversational refinement** capability that:
- Accepts directional adjustments (not just explicit values)
- Tracks what changed and why
- Suggests next refinement steps

---

## Solution: Critique-as-Constraint-Modification

### Core Architectural Insight

Critiques are fundamentally **constraint modifications**. Rather than building a separate critique system, we:

1. Translate user critiques into modified `SearchFilterRequest`
2. Run the modified request through the existing search pipeline
3. Add critique-specific metadata (what changed, result count delta)
4. Generate suggestions by mining patterns from results

This maximizes code reuse while adding critique-specific intelligence.

### The Mental Model

| User Says | System Does | Modified Field |
|-----------|-------------|----------------|
| "More experience" | Bump seniority level up | `requiredSeniorityLevel: mid → senior` |
| "Increase budget" | Multiply by 1.20 | `maxBudget: 100000 → 120000` |
| "Sooner availability" | Move timeline earlier | `requiredMaxStartTime: one_month → two_weeks` |
| "Pacific only" | Replace timezone array | `requiredTimezone: ['Central'] → ['Pacific']` |
| "Add Python" | Append to skills | `requiredSkills: [..., { skill: 'Python' }]` |
| "Remove React" | Filter from skills | `requiredSkills: [... without React]` |

---

## API Design

### Endpoint

```
POST /api/search/critique
```

### Request Schema

```typescript
{
  // The previous search to modify
  baseSearch: SearchFilterRequest;

  // One or more adjustments to apply
  adjustments: CritiqueAdjustment[];  // min 1

  // Pagination
  limit?: number;   // default 10, max 100
  offset?: number;  // default 0
}
```

### Critique Adjustment Structure

```typescript
// Discriminated union on 'operation'
type CritiqueAdjustment =
  | AdjustOperation   // direction-based changes
  | SetOperation      // explicit value replacement
  | AddOperation      // add to collection
  | RemoveOperation;  // remove from collection

// Example: "more experience"
{ property: 'seniority', operation: 'adjust', direction: 'more' }

// Example: "set budget to 150k"
{ property: 'budget', operation: 'set', value: 150000 }

// Example: "add Python requirement"
{ property: 'skills', operation: 'add', value: { skill: 'Python', proficiency: 'proficient' } }

// Example: "remove React requirement"
{ property: 'skills', operation: 'remove', item: 'React' }
```

### Critiquable Properties

| Property | Valid Operations | Valid Directions |
|----------|------------------|------------------|
| seniority | adjust, set | more, less |
| budget | adjust, set | more, less |
| timeline | adjust, set | sooner, later |
| timezone | adjust, set | narrower, wider |
| skills | adjust, add, remove, set | more, less (proficiency) |
| businessDomains | add, remove | — |
| technicalDomains | add, remove | — |

### Response Schema

```typescript
{
  // Search results (same as /filter)
  matches: EngineerMatch[];
  totalCount: number;

  // Transparency (same as /filter)
  appliedFilters: AppliedFilter[];
  appliedPreferences: AppliedPreference[];
  derivedConstraints: DerivedConstraintInfo[];

  // Critique-specific (top-level, parallel to appliedFilters)
  appliedCritiqueAdjustments: AppliedCritiqueAdjustment[];
  failedCritiqueAdjustments: FailedCritiqueAdjustment[];

  // Dynamic suggestions (Section 5.3.2.3)
  suggestedCritiques?: DynamicCritiqueSuggestion[];

  // Constraint advice (reused from /filter)
  relaxation?: RelaxationResult;
  tightening?: TighteningResult;

  // Query metadata with critique-specific fields
  queryMetadata: {
    executionTimeMs: number;
    skillsExpanded: string[];
    defaultsApplied: string[];
    unresolvedSkills: string[];
    previousResultCount: number;    // Before critique
    resultCountChange: number;      // +/- change
  };
}
```

---

## Implementation Architecture

### File Structure

```
recommender_api/src/
├── routes/search.routes.ts                    # Route registration (line 33)
├── controllers/critique.controller.ts         # HTTP handler
├── schemas/critique.schema.ts                 # Zod validation (discriminated union)
├── types/critique.types.ts                    # Response types
├── services/
│   ├── critique.service.ts                    # Orchestration layer
│   ├── critique-interpreter.service.ts        # Adjustment → constraint translation
│   └── critique-generator/
│       ├── dynamic-critique-generator.service.ts  # Main orchestrator
│       ├── critique-candidate-config.ts           # Property configurations
│       ├── single-attribute-critique-generator.ts # Single-property mining
│       ├── compound-critique-generator.ts         # 2-property mining
│       ├── critique-filter.ts                     # Filter & rank suggestions
│       └── pattern-mining-utils.ts                # Shared utilities
└── config/knowledge-base/
    └── critique.config.ts                     # Tuning parameters
```

### Data Flow

```
POST /api/search/critique
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      executeCritique()                               │
│                                                                      │
│  1. Get baseline count (execute baseSearch with limit: 0)           │
│                                                                      │
│  2. Interpret adjustments → modified SearchFilterRequest            │
│     └─ "more experience" → requiredSeniorityLevel: mid → senior    │
│     └─ "increase budget" → maxBudget * 1.20                        │
│     └─ Track applied/failed adjustments                            │
│                                                                      │
│  3. Execute modified search (reuse existing pipeline)               │
│     └─ Constraint expansion                                        │
│     └─ Inference engine                                            │
│     └─ Query building & execution                                  │
│     └─ Utility scoring                                             │
│                                                                      │
│  4. Generate dynamic suggestions (if results exist)                 │
│     └─ Mine single-property patterns (7 properties)                │
│     └─ Mine compound patterns (3 property pairs)                   │
│     └─ Filter by support threshold (≥15%)                          │
│     └─ Sort ascending (low support first)                          │
│     └─ Return top 5                                                │
│                                                                      │
│  5. Assemble response with critique metadata                        │
│     └─ appliedCritiqueAdjustments                                  │
│     └─ failedCritiqueAdjustments                                   │
│     └─ previousResultCount, resultCountChange                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
{
  matches: [...],
  appliedCritiqueAdjustments: [{ modifiedField, previousValue, newValue, ... }],
  suggestedCritiques: [{ adjustments, description, support, ... }],
  queryMetadata: { previousResultCount, resultCountChange, ... }
}
```

---

## Key Design Decisions

### 1. Critique-as-Constraint-Modification

**Decision**: Translate critiques into modified `SearchFilterRequest`, then run through existing search pipeline.

**Rationale**:
- Maximizes code reuse (no new query logic)
- Ensures consistency with regular search behavior
- Simplifies testing (same search machinery)
- Clear mental model: critiques are constraint transformations

### 2. Discriminated Union on `operation`

**Decision**: Use Zod discriminated union for type-safe operation handling.

**Rationale**:
- Compile-time guarantees: `adjustment.direction` only exists when `operation === 'adjust'`
- Clean switch statements in interpreter
- Self-documenting code: types show valid combinations

**Implementation**:
```typescript
// Schema (critique.schema.ts)
export const CritiqueAdjustmentSchema = z.discriminatedUnion('operation', [
  AdjustOperationSchema,
  SetOperationSchema,
  AddOperationSchema,
  RemoveOperationSchema,
]);

// Interpreter (critique-interpreter.service.ts)
switch (adjustment.operation) {
  case 'adjust':
    // TypeScript knows: adjustment.direction exists
    break;
  case 'set':
    // TypeScript knows: adjustment.value exists
    break;
}
```

### 3. Applied vs Failed Adjustments

**Decision**: Separate tracking for successful and failed adjustments.

**Rationale**:
- Compound critiques may partially succeed
- Users need to know exactly what happened
- Failed adjustments include reason for debugging

**Example**:
```typescript
// Request: adjust seniority + adjust budget (but no budget set)
appliedCritiqueAdjustments: [{
  property: 'seniority', operation: 'adjust', direction: 'more',
  modifiedField: 'requiredSeniorityLevel', previousValue: 'mid', newValue: 'senior'
}]
failedCritiqueAdjustments: [{
  property: 'budget', operation: 'adjust', direction: 'more',
  targetField: 'maxBudget', reason: 'No budget constraint set - cannot adjust a non-existent value'
}]
```

### 4. Warnings vs Failures

**Decision**: Distinguish between boundary warnings (applied despite limit) and failures (couldn't apply).

**Rationale**:
- Warning: "Already at maximum seniority (principal)" — adjustment applied but no-op
- Failure: "No budget set — cannot adjust" — adjustment rejected
- Users need this distinction to understand system behavior

### 5. Low-Support Pattern Prioritization

**Decision**: Order dynamic suggestions by ascending support (low support first).

**Rationale** (from textbook p.193):
> "Low support critiques are often less obvious patterns that can be used to eliminate a larger number of items from the candidate list."

High-support patterns are obvious (many engineers match). Low-support patterns reveal non-obvious refinements.

### 6. Property Configuration Pattern

**Decision**: Define each critiquable property through a standardized configuration interface.

**Rationale**:
- Single-property and compound generators iterate over configs
- Adding a new property = implementing one interface
- No repetitive code in generators

**Interface**:
```typescript
interface CritiqueAdjustmentCandidatePropertyConfig {
  propertyKey: CritiquableProperty;
  getCritiqueAdjustmentCandidatePropertyValues(context): CandidatePropertyValue[];
  doesEngineerPassFilter(engineer, candidate): boolean;
  buildCritiqueAdjustment(candidate): { property, operation, ... };
  formatDescription(candidate): string;
  formatRationale(candidate, supportPercentage): string;
}
```

---

## Textbook Alignment

### How This Design Maps to Section 5.3.2

The textbook (Section 5.3.2, p.191-196) describes three critique types:

| Textbook Concept | Our Implementation |
|-----------------|-------------------|
| **Simple critiques** (5.3.2.1) | Single adjustment in `adjustments[]` |
| **Compound critiques** (5.3.2.2) | Multiple adjustments in `adjustments[]` |
| **Dynamic critiques** (5.3.2.3) | `suggestedCritiques[]` mined from results |

### Dynamic Critique Generation (Section 5.3.2.3)

The textbook describes mining patterns from current results to suggest refinements. Our implementation:

1. **Single-property patterns**: "80% of results are in Pacific timezone"
2. **Compound patterns**: "60% are senior-level AND in Pacific"
3. **Support ordering**: Low-support patterns first (more discriminating)

**Key Quote** (p.193):
> "Many recommender systems order the critiques to the user in ascending order of support. The logic for this approach is that low support critiques are often less obvious patterns that can be used to eliminate a larger number of items from the candidate list."

### Stateless Design

The textbook allows for session-based critique history, but we chose stateless:
- Client tracks history and sends full `baseSearch`
- Simpler architecture, no server-side state
- Works naturally with REST API model

---

## Testing

### Unit Tests (47 tests)

| Module | Tests | Coverage |
|--------|-------|----------|
| critique-interpreter.service.test.ts | 30 | All property handlers, operations, boundary cases, compound adjustments |
| critique-filter.test.ts | 6 | Threshold filtering, ascending sort, limits |
| utility.config.test.ts | 11 | `getSeniorityLevelFromYears` boundary cases |

**Key test cases**:
- Seniority adjustments (increase, decrease, boundaries, set)
- Budget adjustments (20% factor, floor value, failure when none set)
- Timeline adjustments (sooner/later, boundaries)
- Timezone adjustments (narrower/wider, set array, set scalar)
- Skills adjustments (add, remove, proficiency adjust, duplicates)
- Domain adjustments (add, remove)
- Compound adjustments (multiple simultaneous, mixed success/failure)

### E2E Tests (12 scenarios, 35 assertions)

| Test # | Name | Key Verification |
|--------|------|------------------|
| 74 | Basic Seniority Adjustment | Seniority changed from mid to senior |
| 75 | Budget Set Operation | Budget set to explicit value |
| 76 | Failed Adjustment (No Budget) | Proper failure reason returned |
| 77 | Compound Adjustment | Both adjustments applied |
| 78 | Mixed Success/Failure | One applied, one failed |
| 79 | Timeline Adjustment (Sooner) | Timeline moved earlier |
| 80 | Add Skill Requirement | Skill added to requirements |
| 81 | Dynamic Suggestions Returned | Suggestions with support/rationale |
| 82 | Already at Maximum Warning | Warning when at boundary |
| 83 | Validation Error (Invalid Direction) | 400 for invalid input |
| 84 | Validation Error (Missing Adjustments) | 400 for empty adjustments |
| 85 | Timezone Set Operation | Timezone set to specific zones |

**All 85 E2E requests and tests pass** (full test collection including previous projects).

---

## Configuration Reference

**File**: `src/config/knowledge-base/critique.config.ts`

| Parameter | Value | Description |
|-----------|-------|-------------|
| `budget.adjustmentFactor` | 0.20 | 20% change per "more/less budget" |
| `budget.floorValue` | 30,000 | Minimum budget ($30k) |
| `dynamicCritiques.minSupportThreshold` | 0.15 | 15% minimum support for suggestions |
| `dynamicCritiques.maxSuggestions` | 5 | Maximum suggestions returned |

**Candidate Generation**:
| Property | Candidate Selection |
|----------|-------------------|
| timezone | US zones not already required |
| seniority | Levels stricter than current |
| timeline | Timelines earlier than current |
| skills | Top 5 skills by occurrence, not already required |
| budget | Salary percentiles (25th, 50th, 75th) |
| domains | Top 5 domains by occurrence, not already required |

**Compound Property Pairs**:
- `[timezone, seniority]` → "Senior engineers in Pacific"
- `[skills, timezone]` → "Python developers in Eastern"
- `[skills, seniority]` → "Senior Python developers"

---

## Metrics

| Metric | Value |
|--------|-------|
| Implementation plan | 1 (1000+ lines) |
| Code walkthrough | 1 (693 lines) |
| Refactoring plan | 1 (193 lines) |
| New service files | 8 |
| New type definitions | 10+ |
| Lines of code (new) | ~1,940 |
| Unit tests | 47 |
| E2E scenarios | 12 |
| Total test assertions | ~280 |

---

## What We're NOT Doing

Per plan scope:
- **Session persistence**: Client tracks history, no server-side sessions (stateless design)
- **LLM explanations**: Reuse existing explanation infrastructure if needed later
- **UI components**: API-only implementation
- **Unit tests for generators**: Covered by E2E tests; deferred to future if needed

---

## Lessons Learned

1. **Critique-as-constraint works well**: Translating critiques into constraint modifications enabled full reuse of the search pipeline. No new query logic required.

2. **Discriminated unions prevent bugs**: The `operation` discriminated union caught several type errors during development. TypeScript's narrowing makes handler code clean and safe.

3. **Warnings vs failures matter**: Users need to know "I tried but was already at max" vs "I couldn't do that at all." The distinction aids debugging and user understanding.

4. **Low-support ordering is counterintuitive but correct**: Initially we sorted high-support first (most common patterns). The textbook's ascending order makes sense: low-support patterns are more discriminating.

5. **Configuration interface pays off**: Adding a new critiquable property requires implementing one interface. The generators just iterate over configs.

6. **Expanded criteria from executeSearch eliminates duplication**: Originally the critique service called `resolveAllSkills` and `expandSearchCriteria` separately. Refactoring `executeSearch` to return `expandedCriteria` eliminated duplicate computation.

---

## Future Considerations

1. **Conversational history**: Track critique sequences for analytics or undo functionality
2. **More compound combinations**: Currently 3 pairs; could expand based on user patterns
3. **Threshold tuning**: Support threshold (15%) may need adjustment based on result set size
4. **Additional generators**: Unit tests for single/compound generators (currently covered by E2E)
5. **Explanation integration**: Natural language explanations for why suggestions are useful

---

## References

- **Research**: `thoughts/shared/1_chapter_5/5_project_5/research/2026-01-19-project-5-critique-system-code-walkthrough.md`
- **Implementation Plan**: `thoughts/shared/1_chapter_5/5_project_5/plans/2026-01-19-project-5-critiquing-system.md`
- **Refactoring Plan**: `thoughts/shared/1_chapter_5/5_project_5/plans/2026-01-19-critique-naming-refactoring.md`
- **Project 4 Summary**: `thoughts/shared/1_chapter_5/4_project_4/project_4_summary.md`
- **Textbook Sections**: 5.3.2 (p.191-196), 5.3.2.1 (Simple Critiques), 5.3.2.2 (Compound Critiques), 5.3.2.3 (Dynamic Critiques)
