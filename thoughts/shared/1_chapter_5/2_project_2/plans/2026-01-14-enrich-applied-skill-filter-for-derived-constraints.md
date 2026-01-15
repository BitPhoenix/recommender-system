# Enrich AppliedSkillFilter for Derived Constraints

## Overview

Remove duplication where derived filter constraints appear in both `appliedFilters` (as broken `AppliedPropertyFilter`) and `derivedConstraints`. Unify by enriching `AppliedSkillFilter` to support derived constraints with a new `ruleId` field.

## Current State Analysis

### The Problem

Derived filter constraints (from inference engine) appear in **two places**:

1. **appliedFilters** as `AppliedPropertyFilter`:
   ```typescript
   {
     kind: AppliedFilterKind.Property,
     field: 'derivedSkills',
     operator: 'IN',
     value: '["skill_distributed"]',  // JSON string
     source: 'inference'
   }
   ```

2. **derivedConstraints** with full provenance:
   ```typescript
   {
     rule: { id: 'scaling-requires-distributed', name: 'Scaling requires distributed' },
     action: { effect: 'filter', targetField: 'derivedSkills', targetValue: ['skill_distributed'] },
     provenance: { ... }
   }
   ```

This causes `decomposeConstraints()` to create **duplicate TestableConstraints**:
- A broken `Property` type from appliedFilters (can't do skill traversal)
- A correct `SkillTraversal` type from derivedConstraints

### Key Files

- `recommender_api/src/types/search.types.ts:207-214` - `AppliedSkillFilter` interface
- `recommender_api/src/services/constraint-expander.service.ts:175-194` - Creates filters from derived constraints
- `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts:70-231` - Processes both sources
- `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts:44-76` - Calls decomposer

## Desired End State

1. `AppliedSkillFilter` supports both user and derived skill constraints via optional `ruleId`
2. Constraint expander creates `AppliedSkillFilter` (not `AppliedPropertyFilter`) for derived filter constraints
3. Constraint decomposer only processes `appliedFilters`, not a separate `derivedConstraints` parameter
4. No duplicate TestableConstraints for the same derived rule

### Verification

- All unit tests pass: `npm test`
- All E2E tests pass: `npm run test:e2e`
- API response for `teamFocus: 'scaling'` shows `AppliedSkillFilter` with `ruleId: 'scaling-requires-distributed'`
- Relaxation suggestions work for both user constraints and derived rule overrides

## What We're NOT Doing

- Changing `derivedConstraints` in the API response (it stays for provenance transparency)
- Modifying boost constraint handling (only filter constraints are affected)
- Changing how user skill filters work (they remain one constraint per skill)

## Implementation Approach

Derived skill filters should use `AppliedSkillFilter` (the structured type) instead of `AppliedPropertyFilter` (generic key-value). This requires:

1. Adding `ruleId?: string` to `AppliedSkillFilter`
2. Widening `field` type to include `'derivedSkills'`
3. Updating constraint-expander to create proper `AppliedSkillFilter` for derived constraints
4. Updating constraint-decomposer to handle `ruleId` in skill filters and remove `derivedConstraints` parameter

**Key distinction preserved**: User skills create one TestableConstraint per skill (each independently relaxable). Derived rules create one TestableConstraint per rule (override entire rule).

---

## Phase 1: Type Updates

### Overview
Update `AppliedSkillFilter` interface to support derived constraints.

### Changes Required:

#### 1. AppliedSkillFilter Interface
**File**: `recommender_api/src/types/search.types.ts`
**Lines**: 207-214

**Current**:
```typescript
export interface AppliedSkillFilter {
  kind: AppliedFilterKind.Skill;
  field: 'requiredSkills';
  operator: 'HAS_ALL';
  skills: ResolvedSkillConstraint[];
  displayValue: string;
  source: ConstraintSource;
}
```

**Change to**:
```typescript
export interface AppliedSkillFilter {
  kind: AppliedFilterKind.Skill;
  field: 'requiredSkills' | 'derivedSkills';
  operator: 'HAS_ALL';
  skills: ResolvedSkillConstraint[];
  displayValue: string;
  source: ConstraintSource;
  /** Present for inference-derived skill filters. Identifies the rule that added this constraint. */
  ruleId?: string;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `cd recommender_api && npx tsc --noEmit`

---

## Phase 2: Constraint Expander Update

### Overview
Create `AppliedSkillFilter` instead of `AppliedPropertyFilter` for derived filter constraints.

### Changes Required:

#### 1. Derived Filter Creation
**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Lines**: 175-194

**Current**:
```typescript
for (const derivedConstraint of inferenceResult.derivedConstraints) {
  if (isFullyOverridden(derivedConstraint)) continue;

  if (isFilterConstraint(derivedConstraint)) {
    inferenceContext.filters.push({
      kind: AppliedFilterKind.Property,
      field: derivedConstraint.action.targetField,
      operator: "IN",
      value: JSON.stringify(derivedConstraint.action.targetValue),
      source: "inference",
    });
  } else {
    // ... boost handling unchanged
  }
}
```

**Change to**:
```typescript
for (const derivedConstraint of inferenceResult.derivedConstraints) {
  if (isFullyOverridden(derivedConstraint)) continue;

  if (isFilterConstraint(derivedConstraint)) {
    const skillIds = derivedConstraint.action.targetValue as string[];
    inferenceContext.filters.push({
      kind: AppliedFilterKind.Skill,
      field: 'derivedSkills',
      operator: 'HAS_ALL',
      skills: skillIds.map(id => ({ skillId: id, skillName: id })),
      displayValue: `Derived: ${derivedConstraint.rule.name}`,
      source: 'inference',
      ruleId: derivedConstraint.rule.id,
    });
  } else {
    // ... boost handling unchanged
  }
}
```

#### 2. Update Test
**File**: `recommender_api/src/services/constraint-expander.service.test.ts`
**Lines**: 454-465

Update `'includes inference source for derived filter constraints'` test to verify:
- Filter has `kind: AppliedFilterKind.Skill`
- Filter has `field: 'derivedSkills'`
- Filter has `ruleId` property
- Filter has `skills` array with skill IDs

#### 3. Add Boost Routing Test
**File**: `recommender_api/src/services/constraint-expander.service.test.ts`

Add new test to verify boost constraints become preferences, not filters. This replaces the decomposer test `'skips boost-type derived constraints'` which will be removed in Phase 3.

```typescript
it('routes boost constraints to preferences, not filters', async () => {
  // Trigger a boost rule (senior-prefers-leadership)
  const result = await expand({ requiredSeniorityLevel: 'senior' });

  // Verify boost appears in preferences
  const boostPreference = result.appliedPreferences.find(
    p => p.source === 'inference' && p.field === 'derivedSkills'
  );
  expect(boostPreference).toBeDefined();

  // Verify NO filter was created for the boost
  const boostAsFilter = result.appliedFilters.find(
    f => f.source === 'inference' &&
    f.kind === AppliedFilterKind.Property &&
    f.field === 'derivedSkills'
  );
  expect(boostAsFilter).toBeUndefined();
});
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `cd recommender_api && npx tsc --noEmit`
- [x] Constraint expander tests pass: `cd recommender_api && npm test -- src/services/constraint-expander.service.test.ts`

---

## Phase 3: Constraint Decomposer Update

### Overview
Remove `derivedConstraints` parameter and handle `ruleId` in skill filter processing.

### Changes Required:

#### 1. Update Function Signature
**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`
**Line**: 70-73

**Current**:
```typescript
export function decomposeConstraints(
  appliedFilters: AppliedFilter[],
  derivedConstraints: DerivedConstraint[]
): DecomposedConstraints {
```

**Change to**:
```typescript
export function decomposeConstraints(
  appliedFilters: AppliedFilter[]
): DecomposedConstraints {
```

#### 2. Update Skill Filter Handling
**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`
**Lines**: 84-101

**Current**:
```typescript
if (isSkillFilter(filter)) {
  for (const skill of filter.skills) {
    constraints.push({
      id: `user_skill_${skill.skillId}`,
      field: 'requiredSkills',
      operator: 'IN',
      value: {
        skill: skill.skillId,
        minProficiency: skill.minProficiency,
      },
      displayValue: `Required skill: ${skill.skillName}`,
      source: filter.source,
      constraintType: ConstraintType.SkillTraversal,
      skillIds: [skill.skillId],
    });
  }
  continue;
}
```

**Change to**:
```typescript
if (isSkillFilter(filter)) {
  if (filter.ruleId) {
    // Derived skill filter: ONE constraint per rule (grouped)
    constraints.push({
      id: `derived_${filter.ruleId}`,
      field: filter.field,
      operator: 'IN',
      value: filter.skills.map(s => s.skillId),
      displayValue: filter.displayValue,
      source: filter.source,
      ruleId: filter.ruleId,
      constraintType: ConstraintType.SkillTraversal,
      skillIds: filter.skills.map(s => s.skillId),
    });
  } else {
    // User skill filter: ONE constraint per skill (independent)
    for (const skill of filter.skills) {
      constraints.push({
        id: `user_skill_${skill.skillId}`,
        field: 'requiredSkills',
        operator: 'IN',
        value: {
          skill: skill.skillId,
          minProficiency: skill.minProficiency,
        },
        displayValue: `Required skill: ${skill.skillName}`,
        source: filter.source,
        constraintType: ConstraintType.SkillTraversal,
        skillIds: [skill.skillId],
      });
    }
  }
  continue;
}
```

#### 3. Remove Derived Constraints Loop
**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`
**Lines**: 215-231

**Delete** this entire block:
```typescript
// Add derived skill constraints (from inference engine)
for (const dc of derivedConstraints) {
  if (dc.action.effect === "filter" && !dc.override?.overrideScope) {
    const skillIds = dc.action.targetValue as string[];
    constraints.push({
      id: `derived_${dc.rule.id}`,
      field: "derivedSkills",
      operator: "IN",
      value: skillIds,
      displayValue: `Derived: ${dc.rule.name}`,
      source: "inference",
      ruleId: dc.rule.id,
      constraintType: ConstraintType.SkillTraversal,
      skillIds,
    });
  }
}
```

#### 4. Remove Unused Import
**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`
**Line**: 13

Remove:
```typescript
import type { DerivedConstraint } from "../../types/inference-rule.types.js";
```

#### 5. Update Tests
**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.test.ts`

All 11 calls to `decomposeConstraints(appliedFilters, derivedConstraints)` need signature update to `decomposeConstraints(appliedFilters)`.

Additionally, restructure tests:
- **Lines 131-152** `'adds derived constraints as SkillTraversal type'`: Change to test AppliedSkillFilter with `ruleId` instead of separate derivedConstraints
- **Lines 154-167** `'skips overridden derived constraints'`: Remove (override handling now in constraint-expander, tested at lines 416-450)
- **Lines 169-181** `'skips boost-type derived constraints'`: Remove (coverage moved to Phase 2 new test `'routes boost constraints to preferences, not filters'`)
- **Lines 220-255** `'combines AppliedSkillFilter with derived skills'`: Update to pass AppliedSkillFilter with `ruleId` instead of derivedConstraints

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `cd recommender_api && npx tsc --noEmit` (deferred until Phase 4 - callers need updating)
- [x] Decomposer tests pass: `cd recommender_api && npm test -- src/services/constraint-advisor/constraint-decomposer.service.test.ts`

---

## Phase 4: Constraint Advisor Update

### Overview
Update constraint advisor service and tests to remove `derivedConstraints` parameter.

### Changes Required:

#### 1. Update Service Interface
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`
**Lines**: 25-32

**Current**:
```typescript
export interface ConstraintAdviceInput {
  session: Session;
  totalCount: number;
  expandedSearchCriteria: ExpandedSearchCriteria;
  appliedFilters: AppliedFilter[];
  derivedConstraints: DerivedConstraint[];
}
```

**Change to**:
```typescript
export interface ConstraintAdviceInput {
  session: Session;
  totalCount: number;
  expandedSearchCriteria: ExpandedSearchCriteria;
  appliedFilters: AppliedFilter[];
}
```

#### 2. Update Function Implementation
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`
**Lines**: 47-48

**Current**:
```typescript
const { session, totalCount, expandedSearchCriteria, appliedFilters, derivedConstraints } =
  input;
```

**Change to**:
```typescript
const { session, totalCount, expandedSearchCriteria, appliedFilters } = input;
```

#### 3. Update runRelaxationAnalysis Call
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`
**Lines**: 52-56

**Current**:
```typescript
const relaxation = await runRelaxationAnalysis(
  session,
  appliedFilters,
  derivedConstraints
);
```

**Change to**:
```typescript
const relaxation = await runRelaxationAnalysis(
  session,
  appliedFilters
);
```

#### 4. Update runRelaxationAnalysis Function
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`
**Lines**: 70-76

**Current**:
```typescript
async function runRelaxationAnalysis(
  session: Session,
  appliedFilters: AppliedFilter[],
  derivedConstraints: DerivedConstraint[]
): Promise<RelaxationResult> {
  const decomposed = decomposeConstraints(appliedFilters, derivedConstraints);
```

**Change to**:
```typescript
async function runRelaxationAnalysis(
  session: Session,
  appliedFilters: AppliedFilter[]
): Promise<RelaxationResult> {
  const decomposed = decomposeConstraints(appliedFilters);
```

#### 5. Remove Unused Import
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`
**Line**: 12

Remove:
```typescript
import type { DerivedConstraint } from "../../types/inference-rule.types.js";
```

#### 6. Update Tests
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.test.ts`

All 11 calls passing `derivedConstraints: []` need parameter removal.

**Critical test update** (lines 242-279 `'derived constraint handling'`):
- Change from passing `derivedConstraints` array to passing `AppliedSkillFilter` with `ruleId` in `appliedFilters`

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `cd recommender_api && npx tsc --noEmit` (deferred until Phase 5 - search service needs updating)
- [x] Constraint advisor tests pass: `cd recommender_api && npm test -- src/services/constraint-advisor/constraint-advisor.service.test.ts`

---

## Phase 5: Search Service Update

### Overview
Update search service to not pass `derivedConstraints` to constraint advisor.

### Changes Required:

#### 1. Update getConstraintAdvice Call
**File**: `recommender_api/src/services/search.service.ts`
**Lines**: ~173-180 (where getConstraintAdvice is called)

Remove `derivedConstraints` from the input object passed to `getConstraintAdvice`.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `cd recommender_api && npx tsc --noEmit`
- [x] All tests pass: `cd recommender_api && npm test`
- [x] E2E tests pass: `cd recommender_api && npm run test:e2e`

---

## Phase 6: Final Verification

### Success Criteria:

#### Automated Verification:
- [x] Full test suite passes: `cd recommender_api && npm test`
- [x] E2E tests pass: `cd recommender_api && npm run test:e2e`
- [x] No TypeScript errors: `cd recommender_api && npx tsc --noEmit`

#### Manual Verification (Now Automated):
- [x] API call with `teamFocus: 'scaling'` shows `appliedFilters` containing `AppliedSkillFilter` with correct structure
  - **Covered by**: `constraint-expander.service.test.ts` → "teamFocus: scaling creates AppliedSkillFilter with correct structure"
- [x] Relaxation suggestions work for derived constraints (suggest overriding rule)
  - **Covered by**: `constraint-advisor.service.test.ts` → "suggests DerivedOverride for derived skill filters"
  - **Covered by**: E2E test #62 "Constraint Advice: Derived Constraint Conflict"
- [x] Relaxation suggestions work for user constraints (suggest modifying value)
  - **Covered by**: `constraint-advisor.service.test.ts` → "processes user property/skill filters in relaxation analysis"
  - **Covered by**: E2E tests #60, #61 "Constraint Advice: Sparse/Empty Results"

---

## Testing Strategy

### Unit Tests
- Constraint expander: Verify derived filter constraints create `AppliedSkillFilter` with `ruleId`
- Constraint decomposer: Verify skill filters with `ruleId` create single grouped constraint
- Constraint advisor: Verify relaxation works with embedded derived constraints

### Integration Tests
- E2E test for `teamFocus: 'scaling'` verifies proper filter structure in response

### Key Edge Cases
- Mixed user and derived skill constraints in same request
- Overridden derived constraints (should not appear in appliedFilters)
- Multiple derived rules firing (each gets own AppliedSkillFilter)

## References

- Types: `recommender_api/src/types/search.types.ts:207-214`
- Constraint expander: `recommender_api/src/services/constraint-expander.service.ts:175-194`
- Constraint decomposer: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`
- Constraint advisor: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`
