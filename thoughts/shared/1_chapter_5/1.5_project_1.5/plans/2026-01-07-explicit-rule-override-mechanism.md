# Explicit Rule Override Mechanism Implementation Plan

## Overview

Add an `overriddenRuleIds` field to `SearchFilterRequest` that allows users to explicitly override specific inference rules. This enables a better UX pattern where:

1. Users see all triggered rules in the response (already implemented)
2. Users can dismiss/override specific rules they disagree with
3. Users re-run the search without those rules applied

## Rationale

### Current Behavior

The inference engine has two types of rules:

- **Boost rules** (`derived-boost`): Affect ranking, can be implicitly overridden when user sets the same preferred field
- **Filter rules** (`derived-filter`): Hard constraints, currently CANNOT be overridden

From `rule-engine-adapter.ts:133-135`:
```typescript
// Boost rules can be overridden by user; filter rules cannot
const overriddenByUser =
  effect === 'boost' && userExplicitFields.includes(params.targetField);
```

### Problem

If a user wants to hire for a "scaling" team focus but intentionally wants candidates WITHOUT distributed systems experience (e.g., for a training-focused role), the system still forces the `scaling-requires-distributed` filter rule. The user has no way to override this.

### Solution

Allow explicit rule overriding via request parameter. The existing `overriddenByUser` flag and downstream handling already exist - we just need a way for users to explicitly set it.

## Current State Analysis

### Key Files

| File | Purpose |
|------|---------|
| `search.schema.ts:67-136` | `SearchFilterRequest` schema - needs `overriddenRuleIds` |
| `rule-engine.types.ts:42-52` | `InferenceContext` - needs `overriddenRuleIds` in meta |
| `rule-engine-adapter.ts:58-74` | `createContext()` - thread through overridden IDs |
| `rule-engine-adapter.ts:124-154` | `eventToConstraint()` - check overridden list |
| `search.service.ts:229-234` | Response already includes `overriddenByUser` flag |

### Key Discoveries

1. **Override flag already propagates**: `overriddenByUser: true` causes constraints to be skipped in:
   - `mergeSkillsIntoContext()` (line 167) - excluded from chaining
   - `getDerivedRequiredSkills()` (line 107) - excluded from filters
   - `aggregateDerivedSkillBoosts()` (line 130) - excluded from boosts
   - `constraint-expander.service.ts:151` - skipped when building inference context

2. **Response already exposes rules**: `derivedConstraints` in the API response includes all triggered rules with their `overriddenByUser` status

3. **Rule IDs are stable**: Each rule has a unique `ruleId` in its event params (e.g., `scaling-requires-distributed`)

## Desired End State

```typescript
// User request with explicit rule overrides:
{
  teamFocus: 'scaling',
  requiredSkills: [...],
  overriddenRuleIds: ['scaling-requires-distributed']  // NEW
}

// Response shows rule was triggered but overridden:
{
  derivedConstraints: [
    {
      rule: { id: 'scaling-requires-distributed', name: 'Scaling Requires Distributed Systems' },
      action: { effect: 'filter', targetField: 'derivedSkills', targetValue: ['skill_distributed'] },
      overriddenByUser: true,  // Marked as overridden
      provenance: { explanation: 'Scaling work requires distributed systems expertise' }
    }
  ]
}
```

UI can then show: "We suggested requiring distributed systems expertise, but you overrode this rule."

## What We're NOT Doing

- Not building a rule management UI (that's a frontend concern)
- Not persisting overridden rules per user (stateless API)
- Not adding rule categories or bulk override (keep it simple)
- Not validating that rule IDs exist (graceful no-op for unknown IDs)

## Implementation Approach

The implementation is minimal because the downstream `overriddenByUser` handling already exists. We only need to:

1. Accept `overriddenRuleIds` in the request schema
2. Thread it through to the inference context
3. Check it when creating constraints

---

## Phase 1: Schema Extension

### Overview

Add `overriddenRuleIds` optional field to both the request and response schemas.

### Changes Required

#### 1. Search Request Schema

**File**: `recommender_api/src/schemas/search.schema.ts`

**Changes**: Add `overriddenRuleIds` field to `SearchFilterRequestSchema`

```typescript
// Add after line 98 (after preferredTechnicalDomains):

  // Rule Override
  overriddenRuleIds: z.array(z.string()).optional(),
```

The field is:
- Optional (empty array = no overrides)
- Array of strings (rule IDs like `'scaling-requires-distributed'`)
- No validation against actual rule IDs (graceful handling of unknown IDs)

#### 2. Search Response Type

**File**: `recommender_api/src/types/search.types.ts`

**Changes**: Add `overriddenRuleIds` to `SearchFilterResponse` interface for echo-back

```typescript
// Update SearchFilterResponse interface (lines 185-208):
export interface SearchFilterResponse {
  matches: EngineerMatch[];
  totalCount: number;
  appliedFilters: AppliedFilter[];
  appliedPreferences: AppliedPreference[];
  overriddenRuleIds: string[];  // NEW: Echo back the overridden rules from request
  derivedConstraints: Array<{
    // ... existing structure unchanged
  }>;
  queryMetadata: QueryMetadata;
}
```

This echo-back enables:
- UI to show "You overrode these rules: X, Y, Z" without filtering `derivedConstraints`
- Confirmation that the request parameter was processed
- Debugging/transparency

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck`
- [x] Schema validates correctly with overriddenRuleIds field
- [x] Existing tests pass: `npm test`

---

## Phase 2: Context Extension

### Overview

Thread `overriddenRuleIds` through the inference context so it's available during constraint creation.

### Changes Required

#### 1. Rule Engine Types

**File**: `recommender_api/src/types/rule-engine.types.ts`

**Changes**: Add `overriddenRuleIds` to the `meta` object in `InferenceContext`

```typescript
// Update InferenceContext interface (lines 42-52):
export interface InferenceContext {
  request: SearchFilterRequest & {
    skills: string[]; // Flattened skill names for convenient 'contains' checks
  };
  derived: {
    allSkills: string[]; // Grows as rules fire (enables chaining)
  };
  meta: {
    userExplicitFields: string[]; // Fields explicitly set by user
    overriddenRuleIds: string[];    // NEW: Rules explicitly overridden by user
  };
}
```

#### 2. Rule Engine Adapter - createContext

**File**: `recommender_api/src/services/rule-engine-adapter.ts`

**Changes**: Extract and pass `overriddenRuleIds` to context

```typescript
// Update createContext function (lines 58-74):
export function createContext(request: SearchFilterRequest): InferenceContext {
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
      overriddenRuleIds: request.overriddenRuleIds || [],  // NEW
    },
  };
}
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck`
- [x] Existing tests pass: `npm test`

---

## Phase 3: Override Logic Update

### Overview

Update `eventToConstraint` to mark rules as overridden when their ID is in the overridden list. This applies to BOTH filter and boost rules.

### Changes Required

#### 1. Rule Engine Adapter - eventToConstraint

**File**: `recommender_api/src/services/rule-engine-adapter.ts`

**Changes**: Update override detection logic to include explicit overriding

```typescript
// Update eventToConstraint function (lines 124-154):
export function eventToConstraint(
  event: EngineEvent,
  derivationChain: string[],
  userExplicitFields: string[],
  rules: InferenceRuleDefinition[],
  overriddenRuleIds: string[] = []  // NEW parameter
): DerivedConstraint {
  const params = event.params as unknown as InferenceEventParams;
  const effect = event.type === 'derived-filter' ? 'filter' : 'boost';

  // Rule can be overridden if:
  // 1. Explicitly overridden by user via overriddenRuleIds, OR
  // 2. It's a boost rule and user explicitly set the target field
  const explicitlyOverridden = overriddenRuleIds.includes(params.ruleId);
  const implicitlyOverridden = effect === 'boost' &&
    userExplicitFields.includes(params.targetField);
  const overriddenByUser = explicitlyOverridden || implicitlyOverridden;

  return {
    rule: {
      id: params.ruleId,
      name: getRuleName(rules, params.ruleId),
    },
    action: {
      effect,
      targetField: params.targetField,
      targetValue: params.targetValue,
      boostStrength: params.boostStrength,
    },
    provenance: {
      derivationChain: [...derivationChain, params.ruleId],
      explanation: params.rationale,
    },
    overriddenByUser,
  };
}
```

#### 2. Inference Engine Service - runInference

**File**: `recommender_api/src/services/inference-engine.service.ts`

**Changes**: Pass `overriddenRuleIds` from context to `eventToConstraint`

```typescript
// Update the eventToConstraint call (around line 64-69):
const constraint = eventToConstraint(
  event,
  [], // derivation chain tracking
  context.meta.userExplicitFields,
  config.inferenceRules,
  context.meta.overriddenRuleIds  // NEW: pass overridden rule IDs
);
```

#### 3. Search Service - Response Echo

**File**: `recommender_api/src/services/search.service.ts`

**Changes**: Include `overriddenRuleIds` in the API response (around line 225-240)

```typescript
return {
  matches,
  totalCount,
  appliedFilters: expanded.appliedFilters,
  appliedPreferences: expanded.appliedPreferences,
  overriddenRuleIds: request.overriddenRuleIds || [],  // NEW: echo back overridden rules
  derivedConstraints: expanded.derivedConstraints.map((dc) => ({
    rule: dc.rule,
    action: dc.action,
    provenance: dc.provenance,
    overriddenByUser: dc.overriddenByUser,
  })),
  queryMetadata: {
    // ... existing fields
  },
};
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck`
- [x] Existing tests pass: `npm test`

---

## Phase 4: Tests

### Overview

Add unit tests verifying explicit rule overriding works for both filter and boost rules.

### Changes Required

#### 1. Rule Engine Adapter Tests

**File**: `recommender_api/src/services/rule-engine-adapter.test.ts`

**Changes**: Add tests for explicit rule overriding

```typescript
describe('eventToConstraint with explicit overriddenRuleIds', () => {
  it('marks filter rule as overridden when in overriddenRuleIds', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'scaling-requires-distributed',
        targetField: 'derivedSkills',
        targetValue: ['skill_distributed'],
        rationale: 'Test',
      },
    };

    const constraint = eventToConstraint(
      event,
      [],
      [],  // no implicit overrides
      mockRules,
      ['scaling-requires-distributed']  // explicitly overridden
    );

    expect(constraint.overriddenByUser).toBe(true);
    expect(constraint.action.effect).toBe('filter');
  });

  it('marks boost rule as overridden when in overriddenRuleIds', () => {
    const event = {
      type: 'derived-boost',
      params: {
        ruleId: 'senior-prefers-leadership',
        targetField: 'derivedSkills',
        targetValue: ['skill_leadership'],
        boostStrength: 0.6,
        rationale: 'Test',
      },
    };

    const constraint = eventToConstraint(
      event,
      [],
      [],
      mockRules,
      ['senior-prefers-leadership']
    );

    expect(constraint.overriddenByUser).toBe(true);
    expect(constraint.action.effect).toBe('boost');
  });

  it('does not mark rules as overridden when not in overriddenRuleIds', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'scaling-requires-distributed',
        targetField: 'derivedSkills',
        targetValue: ['skill_distributed'],
        rationale: 'Test',
      },
    };

    const constraint = eventToConstraint(
      event,
      [],
      [],
      mockRules,
      ['some-other-rule']  // different rule overridden
    );

    expect(constraint.overriddenByUser).toBe(false);
  });

  it('handles empty overriddenRuleIds gracefully', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'scaling-requires-distributed',
        targetField: 'derivedSkills',
        targetValue: ['skill_distributed'],
        rationale: 'Test',
      },
    };

    const constraint = eventToConstraint(
      event,
      [],
      [],
      mockRules,
      []  // empty overridden list
    );

    expect(constraint.overriddenByUser).toBe(false);
  });
});
```

#### 2. Inference Engine Integration Tests

**File**: `recommender_api/src/services/inference-engine.service.test.ts`

**Changes**: Add integration test for overriding rules via request

```typescript
describe('explicit rule overriding', () => {
  it('marks filter rule as overridden when in overriddenRuleIds', async () => {
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      overriddenRuleIds: ['scaling-requires-distributed'],
    };

    const result = await runInference(request);

    const scalingRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule).toBeDefined();
    expect(scalingRule!.overriddenByUser).toBe(true);

    // Rule should NOT appear in derived required skills
    const requiredSkills = getDerivedRequiredSkills(result.derivedConstraints);
    expect(requiredSkills).not.toContain('skill_distributed');
  });

  it('marks boost rule as overridden when in overriddenRuleIds', async () => {
    const request: SearchFilterRequest = {
      requiredSeniorityLevel: 'senior',
      overriddenRuleIds: ['senior-prefers-leadership'],
    };

    const result = await runInference(request);

    const leadershipRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'senior-prefers-leadership'
    );
    expect(leadershipRule).toBeDefined();
    expect(leadershipRule!.overriddenByUser).toBe(true);

    // Rule should NOT appear in skill boosts
    const boosts = aggregateDerivedSkillBoosts(result.derivedConstraints);
    expect(boosts.has('skill_leadership')).toBe(false);
  });

  it('prevents chaining from overridden filter rules', async () => {
    // If scaling-requires-distributed is overridden,
    // distributed-requires-observability should NOT fire
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      overriddenRuleIds: ['scaling-requires-distributed'],
    };

    const result = await runInference(request);

    // The chain should be broken
    const observabilityRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'distributed-requires-observability'
    );
    expect(observabilityRule).toBeUndefined();
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] All new tests pass: `npm test` (393 total, 13 new)
- [x] Existing tests still pass: `npm test`
- [x] Type checking passes: `npm run typecheck`
- [ ] E2E tests pass: `npm run test:e2e` (requires Tilt running)

---

## Testing Strategy

### Unit Tests

1. **Schema validation**: Verify `overriddenRuleIds` accepts string arrays
2. **Context creation**: Verify overridden IDs are threaded through
3. **Override detection**: Both explicit (overridden list) and implicit (user fields) work
4. **Chain breaking**: Overridden filter rules don't feed into subsequent rules

### Integration Tests

1. **Full inference with overridden filter rule**: Rule fires but marked overridden
2. **Full inference with overridden boost rule**: Rule fires but marked overridden
3. **Response includes override status**: API response shows correct `overriddenByUser`

### Manual Testing Steps

1. Send search request with `overriddenRuleIds: ['scaling-requires-distributed']` and `teamFocus: 'scaling'`
2. Verify response includes the rule with `overriddenByUser: true`
3. Verify candidates are NOT filtered by distributed systems requirement
4. Verify downstream chain rules (distributed → monitoring) also don't fire

---

## Performance Considerations

None. The `overriddenRuleIds` check is O(n) where n = number of overridden rules (typically 0-3). This is negligible compared to the rule engine evaluation.

---

## Migration Notes

None required. The field is optional with graceful defaults:
- Missing `overriddenRuleIds` → empty array → no overrides
- Unknown rule IDs in list → silently ignored

---

## File Summary

### Modified Files (6)

```
recommender_api/src/schemas/search.schema.ts              # Add overriddenRuleIds to request
recommender_api/src/types/search.types.ts                 # Add overriddenRuleIds to response
recommender_api/src/types/rule-engine.types.ts            # Add to InferenceContext.meta
recommender_api/src/services/rule-engine-adapter.ts       # Update createContext, eventToConstraint
recommender_api/src/services/inference-engine.service.ts  # Pass overriddenRuleIds to eventToConstraint
recommender_api/src/services/search.service.ts            # Echo overriddenRuleIds in response
```

### Test Files (2, modified)

```
recommender_api/src/services/rule-engine-adapter.test.ts      # Add explicit override tests
recommender_api/src/services/inference-engine.service.test.ts # Add integration tests
```

---

## Verification Commands

```bash
# After each phase
cd recommender_api && npm run typecheck

# After Phase 4
npm test

# Full verification
npm test && npm run test:e2e
```

---

## References

- Previous plan: `thoughts/shared/1_chapter_5/1.5_project_1.5/plans/2026-01-06-iterative-requirement-expansion-unified.md`
- Current override implementation: `recommender_api/src/services/rule-engine-adapter.ts:133-135`
- Downstream handling: `rule-engine-adapter.ts:167`, `inference-engine.service.ts:107,130`
