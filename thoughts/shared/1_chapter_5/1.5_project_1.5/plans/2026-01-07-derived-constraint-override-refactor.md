# Refactor DerivedConstraint Override Properties

## Problem

The `DerivedConstraint` type mixes override-related properties across different locations:
- `provenance.partiallyOverridden` and `provenance.overriddenSkills` describe override state
- `overriddenByUser` is a top-level boolean

These properties share a common semantic concern (user override state) but are scattered, making the structure confusing.

## Solution

Group all override-related properties into a dedicated `override` object:

```typescript
// Before
{
  rule: { id, name },
  action: { effect, targetField, targetValue, boostStrength },
  provenance: {
    derivationChain,
    explanation,
    partiallyOverridden?,   // ← mixed concern
    overriddenSkills?,      // ← mixed concern
  },
  overriddenByUser,          // ← top-level orphan
}

// After
{
  rule: { id, name },
  action: { effect, targetField, targetValue, boostStrength },
  provenance: { derivationChain, explanation },
  override?: {
    overrideScope: 'FULL' | 'PARTIAL',
    overriddenSkills: string[],
  },
}
```

Key changes:
- `override` is **optional** - only present when an override occurred
- `overrideScope` replaces both `overriddenByUser` (FULL) and `partiallyOverridden` (PARTIAL)
- `overriddenSkills` always present when `override` exists (for FULL scope, contains all target skills)
- `provenance` stays focused on derivation history only

## Files to Modify

### 1. Type Definition
**File:** `recommender_api/src/types/inference-rule.types.ts`

```typescript
// Add new type
export type OverrideScope = 'FULL' | 'PARTIAL';

// Update DerivedConstraint
export interface DerivedConstraint {
  rule: { id: string; name: string };
  action: {
    effect: 'filter' | 'boost';
    targetField: ConstraintTargetField;
    targetValue: string | string[] | number;
    boostStrength?: number;
  };
  provenance: {
    derivationChain: string[];
    explanation: string;
    // REMOVED: partiallyOverridden, overriddenSkills
  };
  // REMOVED: overriddenByUser: boolean;
  override?: {
    overrideScope: OverrideScope;
    overriddenSkills: string[];
  };
}
```

### 2. Constraint Builder
**File:** `recommender_api/src/services/rule-engine-adapter.ts`

Update `eventToDerivedConstraint()` (lines 150-225):

```typescript
// Replace the return statement logic:

// Determine override state
let override: DerivedConstraint['override'] | undefined;

if (explicitlyOverridden || implicitBoostOverride || implicitFilterOverride) {
  // Full override - collect all target skills
  const allTargetSkills = Array.isArray(params.targetValue)
    ? params.targetValue.filter((s): s is string => typeof s === 'string')
    : typeof params.targetValue === 'string' ? [params.targetValue] : [];

  override = {
    overrideScope: 'FULL',
    overriddenSkills: allTargetSkills,
  };
} else if (partiallyOverridden) {
  override = {
    overrideScope: 'PARTIAL',
    overriddenSkills,
  };
}

return {
  rule: { id: params.ruleId, name: getRuleName(rules, params.ruleId) },
  action: {
    effect,
    targetField: params.targetField,
    targetValue: effectiveTargetValue,
    boostStrength: params.boostStrength,
  },
  provenance: {
    derivationChain: [...derivationChain, params.ruleId],
    explanation: params.rationale,
  },
  override,
};
```

### 3. Update Usages

**File:** `recommender_api/src/services/rule-engine-adapter.ts`
- `mergeDerivedSkillsIntoInferenceContext()` line 238:
  - Change `if (c.overriddenByUser)` → `if (c.override?.overrideScope === 'FULL')`

**File:** `recommender_api/src/services/inference-engine.service.ts`
- `runInference()` line 75:
  - Change `if (constraint.overriddenByUser)` → `if (constraint.override?.overrideScope === 'FULL')`
- `getDerivedRequiredSkills()` line 109:
  - Change `if (c.overriddenByUser)` → `if (c.override?.overrideScope === 'FULL')`
- `aggregateDerivedSkillBoosts()` line 132:
  - Change `if (c.overriddenByUser)` → `if (c.override?.overrideScope === 'FULL')`

**File:** `recommender_api/src/services/constraint-expander.service.ts`
- Line 151: Change `if (dc.overriddenByUser)` → `if (dc.override?.overrideScope === 'FULL')`

### 4. Update Tests

**File:** `recommender_api/src/services/rule-engine-adapter.test.ts`
- Update all assertions checking `overriddenByUser`, `partiallyOverridden`, `overriddenSkills`
- New pattern: `expect(result.override).toBeUndefined()` or `expect(result.override?.overrideScope).toBe('FULL')`

**File:** `recommender_api/src/services/inference-engine.service.test.ts`
- Same pattern as above

## Helper Function (Optional)

Consider adding a helper for common checks:

```typescript
// In inference-rule.types.ts or a utils file
export function isFullyOverridden(constraint: DerivedConstraint): boolean {
  return constraint.override?.overrideScope === 'FULL';
}

export function isPartiallyOverridden(constraint: DerivedConstraint): boolean {
  return constraint.override?.overrideScope === 'PARTIAL';
}

export function hasAnyOverride(constraint: DerivedConstraint): boolean {
  return constraint.override !== undefined;
}
```

## Verification

```bash
# Type check
npm run typecheck

# Unit tests
npm test

# E2E tests (if API response shape is affected)
npm run test:e2e
```

## Notes

- This is a breaking change to the `DerivedConstraint` type
- API responses including `derivedConstraints` will have a different shape
- No Postman collection changes needed unless tests explicitly check override fields
