# ConflictSet Type Refactoring Implementation Plan

## Overview

Refactor the `ConflictSet` type to use structured `AppliedFilter` objects instead of plain strings, and reference constraints by field name in evidence rather than duplicating strings.

## Current State Analysis

**Current `ConflictSet` type** (`search.types.ts:233-243`):
```typescript
interface ConflictSet {
  constraints: string[];  // Human-readable strings like "salary <= 80000"
  explanation: string;
  evidence?: {
    constraintRemoved: string;  // Duplicates the constraint string
    resultingCountIfRelaxed: number;
  }[];
}
```

**Problems:**
1. `constraints` are unstructured strings - hard to process programmatically
2. `evidence.constraintRemoved` duplicates the string - fragile, hard to correlate

**Existing types that can be reused:**
- `AppliedFilter` (`search.types.ts:161-166`): `{ field, operator, value: string, source }`

## Desired End State

```typescript
interface ConflictSet {
  /** Structured constraints that form the conflict set */
  constraints: AppliedFilter[];
  /** Explanation of why these constraints conflict */
  explanation: string;
  /** Evidence: result counts when each constraint is removed */
  evidence?: {
    constraintField: string;  // References AppliedFilter.field
    resultingCountIfRelaxed: number;
  }[];
}
```

**Verification:**
- All tests pass: `npm test`
- API responses use structured `AppliedFilter` objects in `conflictSets`

## What We're NOT Doing

- Not changing `AppliedFilter.value` from `string` to `unknown`
- Not adding evidence population (that's separate future work)
- Not changing the QUICKXPLAIN algorithm or `TestableConstraint` internals

## Implementation Approach

The `formatConflictSets` function already receives `TestableConstraint[][]` which contains all the structured data. We just need to map it to `AppliedFilter[]` instead of `string[]`.

## Phase 1: Update Type Definition

### Overview
Update the `ConflictSet` interface to use `AppliedFilter[]` instead of `string[]`.

### Changes Required:

#### 1. search.types.ts
**File**: `recommender_api/src/types/search.types.ts`
**Lines**: 233-243

**Before:**
```typescript
export interface ConflictSet {
  /** Human-readable constraint descriptions */
  constraints: string[];
  /** Explanation of why these constraints conflict */
  explanation: string;
  /** Evidence: result counts when each constraint is removed (optional) */
  evidence?: {
    constraintRemoved: string;
    resultingCountIfRelaxed: number;
  }[];
}
```

**After:**
```typescript
export interface ConflictSet {
  /** Structured constraints that form the conflict set */
  constraints: AppliedFilter[];
  /** Explanation of why these constraints conflict */
  explanation: string;
  /** Evidence: result counts when each constraint is removed */
  evidence?: {
    /** Field name referencing AppliedFilter.field in constraints array */
    constraintField: string;
    resultingCountIfRelaxed: number;
  }[];
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run build` (will fail until Phase 2)

---

## Phase 2: Update formatConflictSets Function

### Overview
Update the `formatConflictSets` function to map `TestableConstraint` to `AppliedFilter`.

### Changes Required:

#### 1. constraint-advisor.service.ts
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`
**Lines**: 104-109

**Before:**
```typescript
function formatConflictSets(minimalSets: TestableConstraint[][]): ConflictSet[] {
  return minimalSets.map((constraints) => ({
    constraints: constraints.map((c) => c.displayValue),
    explanation: generateConflictExplanation(constraints),
  }));
}
```

**After:**
```typescript
function formatConflictSets(minimalSets: TestableConstraint[][]): ConflictSet[] {
  return minimalSets.map((constraints) => ({
    constraints: constraints.map((c): AppliedFilter => ({
      field: c.field,
      operator: c.operator,
      value: stringifyConstraintValue(c.value),
      source: c.source,
    })),
    explanation: generateConflictExplanation(constraints),
  }));
}

/**
 * Convert constraint value to string for AppliedFilter.
 * Arrays are JSON-stringified to match existing AppliedFilter conventions.
 */
function stringifyConstraintValue(value: unknown): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return String(value);
}
```

**Rationale:** We use the raw `c.value` (not `displayValue`) because:
1. **Consistency**: Existing `AppliedFilter` objects store just the value (e.g., `"120000"` for salary), not redundant `"salary <= 120000"`
2. **Programmatic use**: Consumers can reconstruct display strings from `{ field, operator, value }` - that's the point of structuring
3. **Pattern matching**: Arrays are JSON-stringified to match how `constraint-expander.service.ts` creates `AppliedFilter` objects (see lines 166, 286, 320, 446)

#### 2. Add import for AppliedFilter
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`
**Line**: 8

The import already exists:
```typescript
import type { AppliedFilter } from "../../types/search.types.js";
```

No change needed.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run build`
- [x] All unit tests pass: `npm test`

---

## Phase 3: Verify Tests

### Overview
Ensure existing tests still pass. The test at `constraint-advisor.service.test.ts:103-104` only checks that `conflictSets` is defined and is an array - it doesn't assert on the structure.

### Changes Required:

No test changes required - existing tests check:
- `conflictSets` is defined
- `conflictSets` is an array

These assertions remain valid with the new type.

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `npm test`
- [x] E2E tests pass: `npm run test:e2e`

---

## Testing Strategy

### Unit Tests:
- Existing tests in `constraint-advisor.service.test.ts` verify structure
- No new tests needed for this refactoring

### Integration Tests:
- E2E tests via Newman will validate API response shape

### Manual Testing Steps:
1. Trigger a sparse results scenario (< 3 matches) via API
2. Verify `relaxation.conflictAnalysis.conflictSets[].constraints` contains objects with `field`, `operator`, `value`, `source`

## References

- Type definition: `recommender_api/src/types/search.types.ts:233-243`
- Format function: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts:104-109`
- Tests: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.test.ts:90-105`
