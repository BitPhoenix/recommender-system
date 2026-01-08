# Implicit Filter Override Implementation Plan

## Overview

Add implicit filter override detection: when a user explicitly handles a skill (in `requiredSkills` or `preferredSkills`), derived filter rules that would add that same skill are marked `overriddenByUser: true`. This prevents the system from promoting user-chosen "nice to have" skills to hard requirements.

## Current State Analysis

The explicit override mechanism (`overriddenRuleIds`) is already implemented. Implicit override for **boost rules** exists (when user sets a `preferred*` field). This plan adds implicit override for **filter rules**.

### Key Discoveries

- `createInferenceContext()` already extracts `userExplicitFields` for boost override detection (`rule-engine-adapter.ts:99-108`)
- `eventToDerivedConstraint()` already handles both explicit and implicit overrides (`rule-engine-adapter.ts:135-141`)
- `allSkills` is initialized from `requiredSkills` only, not `preferredSkills` (`rule-engine-adapter.ts:68`)
- Overridden constraints are skipped in `mergeDerivedSkillsIntoInferenceContext()` (`rule-engine-adapter.ts:173`)

## Desired End State

```typescript
// User request with skill as "preferred" (soft)
{
  teamFocus: 'scaling',
  preferredSkills: [{ skill: 'skill_distributed' }]
}

// Response: rule fired but overridden (user's soft preference wins)
{
  derivedConstraints: [
    {
      rule: { id: 'scaling-requires-distributed', name: '...' },
      action: { effect: 'filter', targetField: 'derivedSkills', targetValue: ['skill_distributed'] },
      overriddenByUser: true,  // Implicitly overridden
      provenance: { explanation: '...' }
    }
  ]
}
```

### Verification

After implementation:
1. Filter rules targeting skills user already handles are marked `overriddenByUser: true`
2. Partial overrides (multi-skill rules) correctly filter to non-overridden skills
3. Chaining behavior differs based on source:
   - `requiredSkills` → skill in `allSkills` → chaining continues
   - `preferredSkills` → skill NOT in `allSkills` → chaining stops (rule overridden, skill not added)

## What We're NOT Doing

- Adding proficiency to derived constraints (future work)
- UI changes (frontend concern)
- Analytics tracking of override frequency (future work)
- Automatic rule demotion when frequently overridden (future work)

## Implementation Approach

Extend the existing override detection in `eventToDerivedConstraint()` to also check if the target skills are in `userExplicitSkills`. Handle partial overrides where only some skills in a multi-skill rule are user-handled.

---

## Phase 1: Extend Context with User Explicit Skills

### Overview

Add `userExplicitSkills` to the inference context meta, tracking all skills the user explicitly mentioned.

### Changes Required

#### 1. Rule Engine Types

**File**: `recommender_api/src/types/rule-engine.types.ts`

**Changes**: Add `userExplicitSkills` to the `meta` object in `InferenceContext`

```typescript
// Update InferenceContext interface (lines 42-53):
export interface InferenceContext {
  request: SearchFilterRequest & {
    skills: string[]; // Flattened skill names for convenient 'contains' checks
  };
  derived: {
    allSkills: string[]; // Grows as rules fire (enables chaining)
  };
  meta: {
    userExplicitFields: string[]; // Fields explicitly set by user
    overriddenRuleIds: string[];  // Rules explicitly overridden by user
    userExplicitSkills: string[]; // Skills explicitly mentioned by user (required OR preferred)
  };
}
```

#### 2. Rule Engine Adapter - createInferenceContext

**File**: `recommender_api/src/services/rule-engine-adapter.ts`

**Changes**: Extract and pass `userExplicitSkills` to context

```typescript
// Add helper function after extractUserExplicitFields (around line 108):

/**
 * Extract skills explicitly mentioned by user (for implicit filter override detection).
 *
 * Includes skills from BOTH requiredSkills and preferredSkills because:
 * - requiredSkills: user already requires it (derived filter would be redundant)
 * - preferredSkills: user deliberately made it soft (system shouldn't promote to required)
 *
 * This is used by implicit filter override detection, NOT for allSkills initialization.
 * allSkills only contains requiredSkills because chaining should only happen from
 * hard requirements, not soft preferences.
 */
function extractUserExplicitSkills(request: SearchFilterRequest): string[] {
  const skills: string[] = [];

  if (request.requiredSkills) {
    skills.push(...request.requiredSkills.map(s => s.skill));
  }
  if (request.preferredSkills) {
    skills.push(...request.preferredSkills.map(s => s.skill));
  }

  return skills;
}

// Update createInferenceContext function (lines 58-75):
export function createInferenceContext(request: SearchFilterRequest): InferenceContext {
  // Flattened skill names for convenient 'contains' checks in rules
  const skillNames = (request.requiredSkills || []).map((s) => s.skill);

  return {
    request: {
      ...request,
      skills: skillNames,
    },
    derived: {
      allSkills: [...skillNames], // Will grow as rules fire
    },
    meta: {
      userExplicitFields: extractUserExplicitFields(request),
      overriddenRuleIds: request.overriddenRuleIds || [],
      userExplicitSkills: extractUserExplicitSkills(request),  // NEW
    },
  };
}
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `cd recommender_api && npm run typecheck`
- [x] Existing tests pass: `npm test`

---

## Phase 2: Extend Override Logic for Filter Rules

### Overview

Update `eventToDerivedConstraint` to check for implicit filter overrides. A filter rule is implicitly overridden when it targets skills that the user already handles explicitly.

### Changes Required

#### 1. Rule Engine Adapter - eventToDerivedConstraint

**File**: `recommender_api/src/services/rule-engine-adapter.ts`

**Changes**: Add implicit filter override detection with partial override support

```typescript
// Update eventToDerivedConstraint function (lines 125-160):
export function eventToDerivedConstraint(
  event: EngineEvent,
  derivationChain: string[],
  userExplicitFields: string[],
  rules: InferenceRuleDefinition[],
  overriddenRuleIds: string[] = [],
  userExplicitSkills: string[] = []  // NEW parameter
): DerivedConstraint {
  const params = event.params as unknown as InferenceEventParams;
  const effect = event.type === 'derived-filter' ? 'filter' : 'boost';

  // Explicit override: user listed this rule ID in overriddenRuleIds
  const explicitlyOverridden = overriddenRuleIds.includes(params.ruleId);

  // Implicit boost override: user explicitly set the target preferred field
  const implicitBoostOverride =
    effect === 'boost' && userExplicitFields.includes(params.targetField);

  // Implicit filter override: user already handles the skill(s) in this rule
  // Only applies to filter rules targeting derivedSkills
  let implicitFilterOverride = false;
  let partiallyOverridden = false;
  let overriddenSkills: string[] = [];
  let effectiveTargetValue = params.targetValue;

  if (
    effect === 'filter' &&
    params.targetField === 'derivedSkills' &&
    !explicitlyOverridden  // Don't compute partial if already fully overridden
  ) {
    const userSkillSet = new Set(userExplicitSkills);
    const targetSkills = Array.isArray(params.targetValue)
      ? params.targetValue
      : [params.targetValue];

    overriddenSkills = targetSkills.filter(
      (s): s is string => typeof s === 'string' && userSkillSet.has(s)
    );
    const nonOverriddenSkills = targetSkills.filter(
      (s): s is string => typeof s === 'string' && !userSkillSet.has(s)
    );

    if (overriddenSkills.length === targetSkills.length) {
      // All skills user-handled, mark whole constraint overridden
      implicitFilterOverride = true;
    } else if (overriddenSkills.length > 0) {
      // Partial override - reduce targetValue to non-overridden skills
      partiallyOverridden = true;
      effectiveTargetValue = nonOverriddenSkills;
    }
  }

  const overriddenByUser = explicitlyOverridden || implicitBoostOverride || implicitFilterOverride;

  return {
    rule: {
      id: params.ruleId,
      name: getRuleName(rules, params.ruleId),
    },
    action: {
      effect,
      targetField: params.targetField,
      targetValue: effectiveTargetValue,  // May be reduced for partial overrides
      boostStrength: params.boostStrength,
    },
    provenance: {
      derivationChain: [...derivationChain, params.ruleId],
      explanation: params.rationale,
      ...(partiallyOverridden && {
        partiallyOverridden: true,
        overriddenSkills,
      }),
    },
    overriddenByUser,
  };
}
```

#### 2. Inference Engine Service - runInference

**File**: `recommender_api/src/services/inference-engine.service.ts`

**Changes**: Pass `userExplicitSkills` from context to `eventToDerivedConstraint`

```typescript
// Update the eventToDerivedConstraint call (around line 64-70):
const constraint = eventToDerivedConstraint(
  event,
  [], // derivation chain tracking
  context.meta.userExplicitFields,
  config.inferenceRules,
  context.meta.overriddenRuleIds,
  context.meta.userExplicitSkills  // NEW: pass user explicit skills
);
```

#### 3. Inference Rule Types - Provenance Extension

**File**: `recommender_api/src/types/inference-rule.types.ts`

**Changes**: Add optional partial override fields to provenance

```typescript
// Find the DerivedConstraint interface and update provenance:
export interface DerivedConstraint {
  rule: {
    id: string;
    name: string;
  };
  action: {
    effect: 'filter' | 'boost';
    targetField: ConstraintTargetField;
    targetValue: string | string[] | number;
    boostStrength?: number;
  };
  provenance: {
    derivationChain: string[];
    explanation: string;
    partiallyOverridden?: boolean;  // NEW: some but not all target skills user-handled
    overriddenSkills?: string[];    // NEW: which skills were user-handled
  };
  overriddenByUser: boolean;
}
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `cd recommender_api && npm run typecheck`
- [x] Existing tests pass: `npm test`

---

## Phase 3: Tests

### Overview

Add unit tests verifying implicit filter override works correctly for various scenarios.

### Changes Required

#### 1. Inference Engine Integration Tests

**File**: `recommender_api/src/services/inference-engine.service.test.ts`

**Changes**: Add test cases for implicit filter override

```typescript
describe('implicit filter override', () => {
  it('marks derived filter as overridden when user already requires the skill', async () => {
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_distributed', minProficiency: 'expert' }],
    };

    const result = await runInference(request);

    const scalingRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule).toBeDefined();
    expect(scalingRule!.overriddenByUser).toBe(true);

    // Skill should NOT be in derived required skills (user already has it)
    const derivedRequired = getDerivedRequiredSkills(result.derivedConstraints);
    expect(derivedRequired).not.toContain('skill_distributed');
  });

  it('marks derived filter as overridden when user has skill as preferred', async () => {
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      preferredSkills: [{ skill: 'skill_distributed' }],
    };

    const result = await runInference(request);

    const scalingRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule).toBeDefined();
    expect(scalingRule!.overriddenByUser).toBe(true);
  });

  it('continues chaining when user requires skill (skill in allSkills)', async () => {
    // User requires distributed, system also derives it (redundant but not conflicting)
    // Chaining should continue because skill IS in allSkills from user
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_distributed' }],
    };

    const result = await runInference(request);

    // First hop: scaling → distributed (overridden, user already has it)
    const scalingRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule!.overriddenByUser).toBe(true);

    // Second hop: distributed → observability SHOULD fire
    // because skill_distributed is in allSkills from user's requiredSkills
    const obsRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'distributed-requires-observability'
    );
    expect(obsRule).toBeDefined();
    expect(obsRule!.overriddenByUser).toBe(false);
  });

  it('stops chaining when user prefers skill (skill NOT in allSkills)', async () => {
    // User prefers distributed (soft), system would require it (hard)
    // Chaining should NOT continue because skill is NOT in allSkills
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      preferredSkills: [{ skill: 'skill_distributed' }],
    };

    const result = await runInference(request);

    // First hop: scaling → distributed (overridden, user has it as preferred)
    const scalingRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule!.overriddenByUser).toBe(true);

    // Second hop: distributed → observability should NOT fire
    // because skill_distributed is NOT in allSkills (only requiredSkills initialize allSkills)
    const obsRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'distributed-requires-observability'
    );
    expect(obsRule).toBeUndefined();
  });

  it('does not override filter rule when user has different skill', async () => {
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_python' }],  // Different skill
    };

    const result = await runInference(request);

    const scalingRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule).toBeDefined();
    expect(scalingRule!.overriddenByUser).toBe(false);
  });
});

describe('partial filter override', () => {
  // This test requires a rule that adds multiple skills
  // If no such rule exists, we test the logic via unit tests on eventToDerivedConstraint

  it('handles partial override when user handles some but not all target skills', async () => {
    // Note: This test may need adjustment based on actual multi-skill rules
    // For now, test the concept with a mock in rule-engine-adapter.test.ts
  });
});
```

#### 2. Rule Engine Adapter Unit Tests

**File**: `recommender_api/src/services/rule-engine-adapter.test.ts`

**Changes**: Add unit tests for implicit filter override logic

```typescript
describe('eventToDerivedConstraint with implicit filter override', () => {
  it('marks filter rule as overridden when target skill in userExplicitSkills', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_distributed'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      [],  // userExplicitFields
      mockRules,
      [],  // overriddenRuleIds
      ['skill_distributed']  // userExplicitSkills - user has this skill
    );

    expect(constraint.overriddenByUser).toBe(true);
  });

  it('does not override filter when target skill NOT in userExplicitSkills', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_distributed'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      [],
      mockRules,
      [],
      ['skill_python']  // Different skill
    );

    expect(constraint.overriddenByUser).toBe(false);
  });

  it('handles partial override - reduces targetValue to non-overridden skills', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_monitoring', 'skill_tracing', 'skill_logging'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      [],
      mockRules,
      [],
      ['skill_monitoring']  // User only handles one skill
    );

    expect(constraint.overriddenByUser).toBe(false);  // Not fully overridden
    expect(constraint.action.targetValue).toEqual(['skill_tracing', 'skill_logging']);
    expect(constraint.provenance.partiallyOverridden).toBe(true);
    expect(constraint.provenance.overriddenSkills).toEqual(['skill_monitoring']);
  });

  it('fully overrides when all target skills in userExplicitSkills', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_a', 'skill_b'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      [],
      mockRules,
      [],
      ['skill_a', 'skill_b', 'skill_c']  // User handles both (and more)
    );

    expect(constraint.overriddenByUser).toBe(true);
    expect(constraint.provenance.partiallyOverridden).toBeUndefined();
  });

  it('does not apply implicit filter override to boost rules', () => {
    const event = {
      type: 'derived-boost',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_distributed'],
        boostStrength: 0.6,
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      [],
      mockRules,
      [],
      ['skill_distributed']  // User has skill, but it's a boost rule
    );

    // Boost rules use implicit boost override (via userExplicitFields), not filter override
    expect(constraint.overriddenByUser).toBe(false);
  });

  it('does not apply implicit filter override to non-derivedSkills targets', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'preferredSeniorityLevel',  // Not derivedSkills
        targetValue: 'senior',
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      [],
      mockRules,
      [],
      ['senior']  // Even if value matches somehow
    );

    expect(constraint.overriddenByUser).toBe(false);
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] All new tests pass: `npm test`
- [x] Existing tests still pass: `npm test`
- [x] Type checking passes: `npm run typecheck`
- [x] E2E tests pass: `npm run test:e2e` (requires Tilt running)

---

## Testing Strategy

### Unit Tests

1. **Context creation**: Verify `userExplicitSkills` includes both required and preferred skills
2. **Override detection**: Filter rules targeting user-handled skills are overridden
3. **Partial override**: Multi-skill rules correctly reduce targetValue
4. **Boost rules unaffected**: Implicit filter override doesn't apply to boost rules

### Integration Tests

1. **Full inference with user-required skill**: Rule fires, marked overridden, chaining continues
2. **Full inference with user-preferred skill**: Rule fires, marked overridden, chaining stops
3. **Response includes override status**: API response shows correct `overriddenByUser`

### Manual Testing Steps

1. Send search request with `teamFocus: 'scaling'` and `requiredSkills: [{ skill: 'skill_distributed' }]`
2. Verify `scaling-requires-distributed` is marked `overriddenByUser: true`
3. Verify `distributed-requires-observability` DOES fire (chaining from user's required skill)
4. Send same request but with `preferredSkills` instead
5. Verify chaining does NOT occur (observability rule should not fire)

---

## Performance Considerations

Minimal. The `userExplicitSkills` extraction is O(n) where n = number of user skills (typically 0-10). The Set lookup during override detection is O(1) per skill.

---

## Migration Notes

None required. The new behavior only affects responses when users explicitly handle skills that rules would derive. Existing behavior for requests without user-specified skills is unchanged.

---

## File Summary

### Modified Files (4)

```
recommender_api/src/types/rule-engine.types.ts            # Add userExplicitSkills to meta
recommender_api/src/types/inference-rule.types.ts         # Add partial override fields to provenance
recommender_api/src/services/rule-engine-adapter.ts       # Add extractUserExplicitSkills, extend eventToDerivedConstraint
recommender_api/src/services/inference-engine.service.ts  # Pass userExplicitSkills to eventToDerivedConstraint
```

### Test Files (2, modified)

```
recommender_api/src/services/rule-engine-adapter.test.ts      # Add implicit filter override unit tests
recommender_api/src/services/inference-engine.service.test.ts # Add integration tests
```

---

## Verification Commands

```bash
# After each phase
cd recommender_api && npm run typecheck

# After Phase 3
npm test

# Full verification (requires Tilt running)
npm test && npm run test:e2e
```

---

## References

- Research: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-07-user-vs-derived-constraint-conflicts.md`
- Explicit override plan: `thoughts/shared/1_chapter_5/1.5_project_1.5/plans/2026-01-07-explicit-rule-override-mechanism.md`
- Current implementation: `recommender_api/src/services/rule-engine-adapter.ts:135-141`
