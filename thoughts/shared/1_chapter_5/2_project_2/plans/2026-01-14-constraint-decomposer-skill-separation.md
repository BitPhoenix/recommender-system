# Constraint Decomposer Skill Separation Refactor

## Overview

Refactor the constraint decomposer to properly handle user skill constraints by passing resolved skill IDs as a separate parameter, rather than trying to extract them from `appliedFilters` (which only contains display-oriented string summaries).

## Current State Analysis

### The Problem

The constraint decomposer receives two inputs:
1. `appliedFilters: AppliedFilter[]` - contains `requiredSkills` as a display string like `'["typescript|min:proficient"]'`
2. `derivedConstraints: DerivedConstraint[]` - contains actual skill IDs like `["skill_typescript"]`

Currently, `decomposeConstraints` **skips** user skills entirely (lines 174-177 of `constraint-decomposer.service.ts`):

```typescript
if (filter.field === "requiredSkills") {
  // Skills are tracked separately via derivedConstraints
  continue;
}
```

This means user-specified skills are never converted to testable `SkillTraversal` constraints - only inference-derived skills are. The conflict detector cannot identify conflicts involving user skills.

### Data Flow Trace

```
User Request
    │
    ├──→ resolveAllSkills()
    │       Returns: requiredSkillIds: ["skill_typescript", ...]  ← actual IDs
    │
    ├──→ expandSearchCriteria()
    │       Returns: appliedFilters with:
    │         { field: "requiredSkills", value: '["typescript|min:proficient"]' }  ← display string
    │
    └──→ getConstraintAdvice({ appliedFilters, derivedConstraints })
            │
            └──→ decomposeConstraints(appliedFilters, derivedConstraints)
                    ❌ Skips requiredSkills (no skill IDs available)
                    ✅ Handles derivedConstraints (has skill IDs)
```

### Key Discovery

The resolved skill IDs (`requiredSkillIds`) are already computed in `search.service.ts` (line 57) but never passed to the constraint advisor. The data exists - it's just not wired through.

## Desired End State

After this refactor:
1. User skill constraints are decomposed into `SkillTraversal` constraints
2. Conflict detection works for both user and derived skill constraints
3. `appliedFilters` continues to serve API transparency (no change to API response)
4. Clean separation: display data (`appliedFilters`) vs execution data (`requiredSkillIds`)

### Verification

- Unit tests verify user skills become `SkillTraversal` constraints
- Integration tests verify conflict detection identifies user skill conflicts
- API response still includes skill info in `appliedFilters` (no breaking change)

## What We're NOT Doing

- Not changing the `AppliedFilter` type or enriching it with skill IDs
- Not removing skills from `appliedFilters` (needed for API transparency)
- Not passing the full `SkillResolutionResult` (over-coupling, minimal interface principle)
- Not changing how derived skills are handled (already works correctly)

## Implementation Approach

Add `requiredSkillIds: string[]` as a new parameter that flows through:
1. `search.service.ts` → passes `requiredSkillIds`
2. `constraint-advisor.service.ts` → forwards to decomposer
3. `constraint-decomposer.service.ts` → creates `SkillTraversal` constraints

This is the minimal change that solves the problem while maintaining clean separation of concerns.

---

## Phase 1: Update Type Interfaces

### Overview
Add `requiredSkillIds` parameter to the constraint advisor input interface.

### Changes Required:

#### 1. Update ConstraintAdviceInput
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`
**Changes**: Add `requiredSkillIds` to the input interface

```typescript
export interface ConstraintAdviceInput {
  session: Session;
  totalCount: number;
  expandedSearchCriteria: ExpandedSearchCriteria;
  appliedFilters: AppliedFilter[];
  derivedConstraints: DerivedConstraint[];
  requiredSkillIds: string[];  // NEW: resolved skill IDs from user's requiredSkills
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `npm run typecheck` (from `recommender_api/`)
- [x] No new lint errors: `npm run lint`

---

## Phase 2: Wire Data Through Constraint Advisor

### Overview
Pass `requiredSkillIds` from `search.service.ts` through to `decomposeConstraints`.

### Changes Required:

#### 1. Update search.service.ts Call Site
**File**: `recommender_api/src/services/search.service.ts`
**Changes**: Pass `requiredSkillIds` to `getConstraintAdvice`

```typescript
// Step 5.5: Get constraint advice if needed (sparse or many results)
const constraintAdviceOutput = await getConstraintAdvice({
  session,
  totalCount,
  expandedSearchCriteria: expanded,
  appliedFilters: expanded.appliedFilters,
  derivedConstraints: expanded.derivedConstraints,
  requiredSkillIds: requiredSkillIds,  // NEW: pass resolved skill IDs
});
```

#### 2. Update runRelaxationAnalysis
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`
**Changes**: Forward `requiredSkillIds` to `decomposeConstraints`

```typescript
async function runRelaxationAnalysis(
  session: Session,
  appliedFilters: AppliedFilter[],
  derivedConstraints: DerivedConstraint[],
  requiredSkillIds: string[]  // NEW parameter
): Promise<RelaxationResult> {
  // Step 1: Decompose constraints
  const decomposed = decomposeConstraints(appliedFilters, derivedConstraints, requiredSkillIds);
  // ... rest unchanged
}
```

#### 3. Update getConstraintAdvice to Forward Parameter
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`
**Changes**: Extract and forward `requiredSkillIds`

```typescript
export async function getConstraintAdvice(
  input: ConstraintAdviceInput
): Promise<ConstraintAdviceOutput> {
  const { session, totalCount, expandedSearchCriteria, appliedFilters, derivedConstraints, requiredSkillIds } =
    input;

  // Case 1: Sparse results - run conflict detection and relaxation
  if (totalCount < SPARSE_RESULTS_THRESHOLD) {
    const relaxation = await runRelaxationAnalysis(
      session,
      appliedFilters,
      derivedConstraints,
      requiredSkillIds  // NEW: forward to analysis
    );
    return { relaxation };
  }
  // ... rest unchanged
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `npm run typecheck`
- [x] No new lint errors: `npm run lint`

---

## Phase 3: Update Constraint Decomposer

### Overview
Update `decomposeConstraints` to accept `requiredSkillIds` and create `SkillTraversal` constraints for user skills.

### Changes Required:

#### 1. Update Function Signature
**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`
**Changes**: Add `requiredSkillIds` parameter

```typescript
export function decomposeConstraints(
  appliedFilters: AppliedFilter[],
  derivedConstraints: DerivedConstraint[],
  requiredSkillIds: string[]  // NEW parameter
): DecomposedConstraints {
```

#### 2. Create User Skill Constraints
**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`
**Changes**: Add logic to create `SkillTraversal` constraints for user skills

Add after the derived constraints loop (around line 213), before the return statement:

```typescript
// Add user skill constraints (from resolved requiredSkills)
for (const skillId of requiredSkillIds) {
  constraints.push({
    id: `user_skill_${skillId}`,
    field: "requiredSkills",
    operator: "IN",
    value: [skillId],
    displayValue: `Required skill: ${skillId}`,
    source: "user",
    constraintType: ConstraintType.SkillTraversal,
    skillIds: [skillId],
  });
}
```

Note: The existing `continue` for `requiredSkills` in the `appliedFilters` loop (lines 174-177) should remain - it correctly prevents attempting to parse the display string.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `npm run typecheck`
- [x] No new lint errors: `npm run lint`
- [x] Existing unit tests pass: `npm test`

---

## Phase 4: Update Tests

### Overview
Update existing tests and add new tests for user skill constraint decomposition.

### Changes Required:

#### 1. Update Existing Decomposer Tests
**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.test.ts`
**Changes**: Update all `decomposeConstraints` calls to include the new parameter

All existing calls like:
```typescript
const result = decomposeConstraints(appliedFilters, []);
```

Should become:
```typescript
const result = decomposeConstraints(appliedFilters, [], []);
```

#### 2. Add New Test for User Skills
**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.test.ts`
**Changes**: Add test case for user skill constraint creation

```typescript
describe("user skill constraints", () => {
  it("creates SkillTraversal constraints for user skills", () => {
    const appliedFilters: AppliedFilter[] = [];
    const derivedConstraints: DerivedConstraint[] = [];
    const requiredSkillIds = ["skill_typescript", "skill_react"];

    const result = decomposeConstraints(appliedFilters, derivedConstraints, requiredSkillIds);

    expect(result.constraints).toHaveLength(2);

    const tsConstraint = result.constraints.find(c => c.id === "user_skill_skill_typescript");
    expect(tsConstraint).toBeDefined();
    expect(tsConstraint?.constraintType).toBe(ConstraintType.SkillTraversal);
    expect(tsConstraint?.source).toBe("user");
    expect((tsConstraint as SkillTraversalConstraint).skillIds).toEqual(["skill_typescript"]);

    const reactConstraint = result.constraints.find(c => c.id === "user_skill_skill_react");
    expect(reactConstraint).toBeDefined();
    expect(reactConstraint?.source).toBe("user");
  });

  it("combines user skills with derived skills", () => {
    const appliedFilters: AppliedFilter[] = [];
    const derivedConstraints: DerivedConstraint[] = [
      {
        rule: { id: "test-rule", name: "Test Rule" },
        action: {
          effect: "filter",
          targetField: "derivedSkills",
          targetValue: ["skill_distributed"],
        },
        provenance: {
          derivationChains: [["test-rule"]],
          explanation: "Test",
        },
      },
    ];
    const requiredSkillIds = ["skill_typescript"];

    const result = decomposeConstraints(appliedFilters, derivedConstraints, requiredSkillIds);

    // Should have both derived and user skill constraints
    const derivedConstraint = result.constraints.find(c => c.id === "derived_test-rule");
    const userConstraint = result.constraints.find(c => c.id === "user_skill_skill_typescript");

    expect(derivedConstraint).toBeDefined();
    expect(userConstraint).toBeDefined();
    expect(derivedConstraint?.source).toBe("inference");
    expect(userConstraint?.source).toBe("user");
  });
});
```

#### 3. Update Constraint Advisor Service Tests
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.test.ts`
**Changes**: Update `getConstraintAdvice` calls to include `requiredSkillIds`

Update the mock input objects to include:
```typescript
requiredSkillIds: [],  // or specific skill IDs for tests that need them
```

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `npm test`
- [x] Test coverage maintained or improved: `npm run test:coverage`
- [x] TypeScript compilation passes: `npm run typecheck`

---

## Testing Strategy

### Unit Tests:
- Verify `decomposeConstraints` creates `SkillTraversal` constraints for user skills
- Verify user skills have `source: "user"`
- Verify derived skills still have `source: "inference"`
- Verify both user and derived skills coexist correctly

### Integration Tests:
- E2E test with user skills verifies conflict detection works
- Existing E2E tests should continue to pass

### Manual Testing Steps:
1. Make a search request with `requiredSkills` that would cause zero results
2. Verify the relaxation suggestions include the user skill constraints
3. Verify the conflict analysis identifies the user skill in conflict sets

---

## Performance Considerations

None - this is a simple parameter addition with O(n) iteration over user skills, where n is typically 1-5 skills.

---

## Migration Notes

No migration needed - this is an internal refactor with no API changes.

---

## References

- Related discussion: Constraint decomposer skill handling design
- Key files:
  - `recommender_api/src/services/search.service.ts:167` - call site
  - `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts:72` - decompose call
  - `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts:174-177` - current skip logic
