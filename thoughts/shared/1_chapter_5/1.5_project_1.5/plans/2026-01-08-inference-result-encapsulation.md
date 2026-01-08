# Inference Result Encapsulation Refactor

## Overview

Move `derivedRequiredSkillIds` and `derivedSkillBoosts` into the `InferenceResult` type so that `runInference()` returns a complete, self-contained result. This eliminates the awkward pattern where callers must post-process `derivedConstraints` using separate extraction functions.

## Current State Analysis

### Current Flow (constraint-expander.service.ts:154-161)
```typescript
const inferenceResult = await runInference(request);
const derivedRequiredSkillIds = getDerivedRequiredSkills(inferenceResult.derivedConstraints);
const derivedSkillBoosts = aggregateDerivedSkillBoosts(inferenceResult.derivedConstraints);
```

### Problems
1. **Leaky abstraction** - Callers need to know about extraction functions
2. **Coupling** - Consumer imports both `runInference` AND extraction functions
3. **Incomplete result** - `InferenceResult` doesn't contain all inference outputs

### Key Files
| File | Role |
|------|------|
| `types/inference-rule.types.ts:41-47` | `InferenceResult` interface definition |
| `services/inference-engine.service.ts:34-108` | `runInference()` + extraction functions |
| `services/constraint-expander.service.ts:154-161` | Consumer of inference results |

## Desired End State

```typescript
// constraint-expander.service.ts - AFTER
const inferenceResult = await runInference(request);
// inferenceResult.derivedConstraints      - unchanged
// inferenceResult.derivedRequiredSkillIds - NEW: string[]
// inferenceResult.derivedSkillBoosts      - NEW: Map<string, number>
```

### Verification
- All existing tests pass (`npm test`)
- `ExpandedSearchCriteria` still has correct `derivedRequiredSkillIds` and `derivedSkillBoosts` values
- Code walkthrough documentation reflects new structure

## What We're NOT Doing

- Changing the extraction logic (just moving where it's called)
- Modifying how `derivedConstraints` are built
- Changing the API response format
- Removing the extraction functions entirely (keep for testing/flexibility)

## Implementation Approach

Encapsulate the extraction inside `runInference()` so the function returns everything needed. Keep extraction functions exported for unit testing but consumers should use the complete result.

---

## Phase 1: Update InferenceResult Type

### Overview
Add the two new fields to the `InferenceResult` interface.

### Changes Required:

#### 1. Update InferenceResult interface
**File**: `recommender_api/src/types/inference-rule.types.ts`
**Changes**: Add `derivedRequiredSkillIds` and `derivedSkillBoosts` fields

```typescript
/**
 * Result of the inference engine.
 */
export interface InferenceResult {
  derivedConstraints: DerivedConstraint[];
  firedRules: string[];
  overriddenRules: OverriddenRuleInfo[];
  iterationCount: number;
  warnings: string[];

  // NEW: Extracted results for convenience
  /** Skills that MUST be matched (from filter rules targeting derivedSkills) */
  derivedRequiredSkillIds: string[];
  /** Aggregated skill boosts from boost rules (max strength wins) */
  derivedSkillBoosts: Map<string, number>;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`

---

## Phase 2: Update runInference() Return Value

### Overview
Compute `derivedRequiredSkillIds` and `derivedSkillBoosts` inside `runInference()` and include them in the return.

### Changes Required:

#### 1. Update runInference() to include extracted values
**File**: `recommender_api/src/services/inference-engine.service.ts`
**Changes**: Call extraction functions before returning and include results

```typescript
export async function runInference(
  request: SearchFilterRequest
): Promise<InferenceResult> {
  // ... existing loop logic (lines 37-95) ...

  if (iteration >= maxIterations) {
    warnings.push(`Reached maximum inference iterations (${maxIterations}).`);
  }

  // Extract convenience fields from constraints
  const derivedRequiredSkillIds = getDerivedRequiredSkills(allDerivedConstraints);
  const derivedSkillBoosts = aggregateDerivedSkillBoosts(allDerivedConstraints);

  return {
    derivedConstraints: allDerivedConstraints,
    firedRules: [...firedRuleIds],
    overriddenRules,
    iterationCount: iteration,
    warnings,
    derivedRequiredSkillIds,  // NEW
    derivedSkillBoosts,       // NEW
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] Inference engine tests pass: `npm test -- src/services/inference-engine.service.test.ts`

---

## Phase 3: Update Consumer (constraint-expander.service.ts)

### Overview
Simplify the consumer to use the new fields directly from `InferenceResult`.

### Changes Required:

#### 1. Remove extraction function calls
**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Changes**: Use `inferenceResult.derivedRequiredSkillIds` and `inferenceResult.derivedSkillBoosts` directly

**Before** (lines 154-161):
```typescript
const inferenceResult = await runInference(request);

const derivedRequiredSkillIds = getDerivedRequiredSkills(
  inferenceResult.derivedConstraints
);
const derivedSkillBoosts = aggregateDerivedSkillBoosts(
  inferenceResult.derivedConstraints
);
```

**After**:
```typescript
const inferenceResult = await runInference(request);
```

#### 2. Update return statement
**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Changes**: Reference fields from `inferenceResult` in return (lines 221-223)

**Before**:
```typescript
return {
  // ...
  derivedConstraints: inferenceResult.derivedConstraints,
  derivedRequiredSkillIds,
  derivedSkillBoosts,
};
```

**After**:
```typescript
return {
  // ...
  derivedConstraints: inferenceResult.derivedConstraints,
  derivedRequiredSkillIds: inferenceResult.derivedRequiredSkillIds,
  derivedSkillBoosts: inferenceResult.derivedSkillBoosts,
};
```

#### 3. Remove unused imports
**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Changes**: Remove `getDerivedRequiredSkills` and `aggregateDerivedSkillBoosts` from imports (line 27-28)

**Before**:
```typescript
import {
  runInference,
  getDerivedRequiredSkills,
  aggregateDerivedSkillBoosts,
} from "./inference-engine.service.js";
```

**After**:
```typescript
import { runInference } from "./inference-engine.service.js";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] All unit tests pass: `npm test`
- [x] E2E tests pass: `npm run test:e2e`

---

## Phase 4: Update Documentation

### Overview
Update the code walkthrough to reflect the new structure where `InferenceResult` is self-contained.

### Changes Required:

#### 1. Update InferenceResult section
**File**: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-inference-engine-code-walkthrough.md`
**Changes**: Update the `InferenceResult` interface documentation to include new fields

#### 2. Update Part 5 (Integration with Search)
**File**: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-inference-engine-code-walkthrough.md`
**Changes**: Simplify the integration example to show direct field access

**Before** (around line 1153-1171):
```typescript
export async function expandSearchCriteria(request) {
  // ... existing expansion logic ...

  // Run inference engine
  const inferenceResult = await runInference(request);

  // Extract filter rules (hard requirements)
  const derivedRequiredSkillIds = getDerivedRequiredSkills(inferenceResult.derivedConstraints);

  // Extract boost rules (soft preferences)
  const derivedSkillBoosts = aggregateDerivedSkillBoosts(inferenceResult.derivedConstraints);

  return {
    // ... existing fields ...
    derivedConstraints: inferenceResult.derivedConstraints,
    derivedRequiredSkillIds,
    derivedSkillBoosts,
  };
}
```

**After**:
```typescript
export async function expandSearchCriteria(request) {
  // ... existing expansion logic ...

  // Run inference engine - returns complete result with extracted fields
  const inferenceResult = await runInference(request);

  return {
    // ... existing fields ...
    derivedConstraints: inferenceResult.derivedConstraints,
    derivedRequiredSkillIds: inferenceResult.derivedRequiredSkillIds,
    derivedSkillBoosts: inferenceResult.derivedSkillBoosts,
  };
}
```

#### 3. Update extraction functions section
**File**: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-inference-engine-code-walkthrough.md`
**Changes**: Add note that these are now called internally by `runInference()` but remain exported for testing

### Success Criteria:

#### Automated Verification:
- [x] Documentation file exists and is valid markdown

#### Manual Verification:
- [ ] Code walkthrough accurately reflects the new implementation
- [ ] Examples in documentation match actual code behavior

---

## Testing Strategy

### Unit Tests
- Existing `inference-engine.service.test.ts` tests should pass unchanged (extraction functions still work)
- Verify `runInference()` return value includes new fields with correct values

### Integration Tests
- `constraint-expander.service.test.ts` should pass unchanged (same output, different internal path)

### E2E Tests
- Newman/Postman tests should pass unchanged (API response format unchanged)

## References

- Current implementation: `recommender_api/src/services/inference-engine.service.ts:34-155`
- Consumer: `recommender_api/src/services/constraint-expander.service.ts:154-224`
- Types: `recommender_api/src/types/inference-rule.types.ts:41-47`
- Code walkthrough: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-inference-engine-code-walkthrough.md`
