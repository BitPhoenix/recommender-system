# Override Reason Type Implementation Plan

## Overview

Add an `OverrideReasonType` field to the inference engine's override mechanism to make it clear **why** a rule was overridden. Currently, all three override mechanisms produce the same output structure, making it impossible for API consumers to distinguish between explicit user overrides vs implicit system overrides.

## Current State Analysis

The `determineOverrideStatus()` function in `rule-engine-adapter.ts:348-386` handles three override types that all produce identical output:

| Override Type | Mechanism | Current Output |
|---------------|-----------|----------------|
| Explicit | `overriddenRuleIds.includes(ruleId)` | `{ overrideScope: 'FULL', overriddenSkills: [...] }` |
| Implicit field | `userExplicitFields.includes(targetField)` | `{ overrideScope: 'FULL', overriddenSkills: [...] }` |
| Implicit skill | User handles target skills | `{ overrideScope: 'FULL'|'PARTIAL', overriddenSkills: [...] }` |

### Key Discoveries:
- Override determination happens in `determineOverrideStatus()` at `rule-engine-adapter.ts:348`
- The function already distinguishes between override types internally but discards this information
- `OverriddenRuleInfo` at `inference-rule.types.ts:32` mirrors the constraint override info at the result level
- Tests exist for all three override mechanisms in both test files

## Desired End State

API responses will include `reasonType` explaining why each rule was overridden:

```typescript
// In DerivedConstraint.override
override: {
  overrideScope: 'FULL',
  overriddenSkills: ['skill_distributed'],
  reasonType: 'explicit-rule-override'  // NEW
}

// In InferenceResult.overriddenRules
overriddenRules: [{
  ruleId: 'scaling-requires-distributed',
  overrideScope: 'FULL',
  overriddenSkills: ['skill_distributed'],
  reasonType: 'explicit-rule-override'  // NEW
}]
```

### Verification:
- All existing tests pass
- New tests verify `reasonType` is set correctly for each override mechanism
- API response includes `reasonType` in both `derivedConstraints[].override` and `overriddenRules[]`

## What We're NOT Doing

- Adding a `reasonMessage` field (UI can derive messages from `reasonType`)
- Changing override precedence or behavior
- Adding new override mechanisms
- Modifying the Cypher query builder or search service

## Implementation Approach

Two-phase implementation:
1. **Phase 1**: Add `OverrideReasonType` to source files and tests (4 source files, 2 test files)
2. **Phase 2**: Update the code walkthrough documentation to reflect the new field

Changes are additive (new field) so no migration needed.

---

## Phase 1: Add OverrideReasonType

### Overview
Add the `OverrideReasonType` type and update all interfaces and functions to include it.

### Changes Required:

#### 1. Type Definitions
**File**: `recommender_api/src/types/inference-rule.types.ts`

Add the new type after `OverrideScope` (around line 26):

```typescript
/**
 * Reason why a constraint was overridden.
 * - explicit-rule-override: User listed ruleId in overriddenRuleIds
 * - implicit-field-override: User explicitly set the target field
 * - implicit-skill-override: User already requires/prefers the target skill(s)
 */
export type OverrideReasonType =
  | 'explicit-rule-override'
  | 'implicit-field-override'
  | 'implicit-skill-override';
```

Update `OverriddenRuleInfo` interface (around line 32):

```typescript
export interface OverriddenRuleInfo {
  ruleId: string;
  overrideScope: OverrideScope;
  overriddenSkills: string[];
  reasonType: OverrideReasonType;  // NEW
}
```

Update the `override` property in `DerivedConstraint` interface (around line 106):

```typescript
override?: {
  overrideScope: OverrideScope;
  overriddenSkills: string[];
  reasonType: OverrideReasonType;  // NEW
};
```

#### 2. Override Determination Logic
**File**: `recommender_api/src/services/rule-engine-adapter.ts`

Update `OverrideResult` interface (around line 325):

```typescript
interface OverrideResult {
  override: DerivedConstraint['override'] | undefined;
  effectiveTargetValue: string | string[] | number;
}
```

Update `determineOverrideStatus()` function (around line 348) to include `reasonType`:

```typescript
function determineOverrideStatus(
  params: InferenceEventParams,
  effect: 'filter' | 'boost',
  userExplicitFields: string[],
  overriddenRuleIds: string[],
  userExplicitSkills: string[]
): OverrideResult {
  const explicitlyOverridden = overriddenRuleIds.includes(params.ruleId);
  const implicitFieldOverride = userExplicitFields.includes(params.targetField);

  if (explicitlyOverridden) {
    return {
      override: {
        overrideScope: 'FULL',
        overriddenSkills: toStringArray(params.targetValue),
        reasonType: 'explicit-rule-override',
      },
      effectiveTargetValue: params.targetValue,
    };
  }

  if (implicitFieldOverride) {
    return {
      override: {
        overrideScope: 'FULL',
        overriddenSkills: toStringArray(params.targetValue),
        reasonType: 'implicit-field-override',
      },
      effectiveTargetValue: params.targetValue,
    };
  }

  // Check implicit skill override for filter rules targeting derivedSkills
  if (effect === 'filter' && params.targetField === 'derivedSkills') {
    const targetSkills = toStringArray(params.targetValue);
    const userSkillSet = new Set(userExplicitSkills);
    const overriddenSkills = targetSkills.filter(s => userSkillSet.has(s));

    if (overriddenSkills.length === targetSkills.length) {
      return {
        override: {
          overrideScope: 'FULL',
          overriddenSkills,
          reasonType: 'implicit-skill-override',
        },
        effectiveTargetValue: params.targetValue,
      };
    }
    if (overriddenSkills.length > 0) {
      return {
        override: {
          overrideScope: 'PARTIAL',
          overriddenSkills,
          reasonType: 'implicit-skill-override',
        },
        effectiveTargetValue: targetSkills.filter(s => !userSkillSet.has(s)),
      };
    }
  }

  return { override: undefined, effectiveTargetValue: params.targetValue };
}
```

#### 3. Inference Engine Service
**File**: `recommender_api/src/services/inference-engine.service.ts`

Update the override tracking in `runInference()` (around line 82):

```typescript
// Track any override (FULL or PARTIAL) for transparency
if (constraint.override) {
  overriddenRules.push({
    ruleId: constraint.rule.id,
    overrideScope: constraint.override.overrideScope,
    overriddenSkills: constraint.override.overriddenSkills,
    reasonType: constraint.override.reasonType,  // NEW
  });
}
```

#### 4. Unit Tests - Rule Engine Adapter
**File**: `recommender_api/src/services/rule-engine-adapter.test.ts`

Add tests in the `eventToDerivedConstraint` describe block:

```typescript
describe('override reasonType', () => {
  const mockRules: InferenceRuleDefinition[] = [
    {
      name: 'Test Rule',
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'test-rule',
          targetField: 'derivedSkills',
          targetValue: ['skill_test'],
          rationale: 'Test rationale',
        },
      },
      conditions: { all: [] },
    },
  ];

  it('sets reasonType to explicit-rule-override when rule in overriddenRuleIds', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_test'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      mockRules,
      ['test-rule'],  // explicitly overridden
      []
    );

    expect(constraint.override?.reasonType).toBe('explicit-rule-override');
  });

  it('sets reasonType to implicit-field-override when user set target field', () => {
    const event = {
      type: 'derived-boost',
      params: {
        ruleId: 'test-rule',
        targetField: 'preferredSkills',
        targetValue: ['skill_test'],
        boostStrength: 0.5,
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      ['preferredSkills'],  // user explicit field
      mockRules,
      [],
      []
    );

    expect(constraint.override?.reasonType).toBe('implicit-field-override');
  });

  it('sets reasonType to implicit-skill-override when user handles skill (FULL)', () => {
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
      mockRules,
      [],
      ['skill_distributed']  // user has this skill
    );

    expect(constraint.override?.reasonType).toBe('implicit-skill-override');
    expect(constraint.override?.overrideScope).toBe('FULL');
  });

  it('sets reasonType to implicit-skill-override when user handles some skills (PARTIAL)', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_a', 'skill_b', 'skill_c'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      mockRules,
      [],
      ['skill_a']  // user handles only one
    );

    expect(constraint.override?.reasonType).toBe('implicit-skill-override');
    expect(constraint.override?.overrideScope).toBe('PARTIAL');
  });

  it('explicit override takes precedence over implicit field override', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_test'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      ['derivedSkills'],  // would trigger implicit-field
      mockRules,
      ['test-rule'],      // AND explicit override
      []
    );

    // Explicit takes precedence
    expect(constraint.override?.reasonType).toBe('explicit-rule-override');
  });
});
```

#### 5. Integration Tests - Inference Engine Service
**File**: `recommender_api/src/services/inference-engine.service.test.ts`

Add tests in the `explicit rule overriding` describe block:

```typescript
it('includes reasonType in overriddenRules for explicit override', async () => {
  const request: SearchFilterRequest = {
    teamFocus: 'scaling',
    overriddenRuleIds: ['scaling-requires-distributed'],
  };

  const result = await runInference(request);

  const overriddenRule = result.overriddenRules.find(
    (r) => r.ruleId === 'scaling-requires-distributed'
  );
  expect(overriddenRule).toBeDefined();
  expect(overriddenRule!.reasonType).toBe('explicit-rule-override');
});
```

Add test in the `implicit filter override` describe block:

```typescript
it('includes reasonType in overriddenRules for implicit skill override', async () => {
  const request: SearchFilterRequest = {
    teamFocus: 'scaling',
    requiredSkills: [{ skill: 'skill_distributed' }],
  };

  const result = await runInference(request);

  const overriddenRule = result.overriddenRules.find(
    (r) => r.ruleId === 'scaling-requires-distributed'
  );
  expect(overriddenRule).toBeDefined();
  expect(overriddenRule!.reasonType).toBe('implicit-skill-override');
});
```

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `npm test`
- [x] Type checking passes: `npx tsc --noEmit`
- [x] E2E tests pass: `npm run test:e2e`

#### Manual Verification (now covered by E2E tests):
- [x] Test 51 verifies `reasonType: 'explicit-rule-override'` when using `overriddenRuleIds`
- [x] Test 57 verifies `reasonType: 'implicit-field-override'` when user sets target field
- [x] Test 56 verifies `reasonType: 'implicit-skill-override'` when user requires derived skill

---

## Phase 2: Update Code Walkthrough Documentation

### Overview
Update the inference engine code walkthrough to document the new `reasonType` field, ensuring the documentation stays in sync with the implementation.

### Changes Required:

#### 1. Update Type Documentation
**File**: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-inference-engine-code-walkthrough.md`

**Section**: Part 1 - `DerivedConstraint` type definition (around line 117)

Update the `override` property documentation to include `reasonType`:

```typescript
/** Override information - only present when user overrode this constraint */
override?: {
  overrideScope: OverrideScope;  // FULL = entire constraint overridden, PARTIAL = some skills user-handled
  overriddenSkills: string[];     // Which skills were user-handled
  reasonType: OverrideReasonType; // Why the override happened (explicit-rule-override, implicit-field-override, implicit-skill-override)
};
```

Add the `OverrideReasonType` type definition after `OverrideScope` (around line 87):

```typescript
/**
 * Reason why a constraint was overridden.
 * - explicit-rule-override: User listed ruleId in overriddenRuleIds
 * - implicit-field-override: User explicitly set the target field
 * - implicit-skill-override: User already requires/prefers the target skill(s)
 */
export type OverrideReasonType =
  | 'explicit-rule-override'
  | 'implicit-field-override'
  | 'implicit-skill-override';
```

Update `OverriddenRuleInfo` interface (around line 93):

```typescript
export interface OverriddenRuleInfo {
  ruleId: string;
  overrideScope: OverrideScope;
  overriddenSkills: string[];
  reasonType: OverrideReasonType;  // NEW: explains why the rule was overridden
}
```

#### 2. Update determineOverrideStatus Documentation
**Section**: Part 3 - `determineOverrideStatus()` function (around line 683)

Update the function documentation to show the three separate return paths with `reasonType`:

```typescript
function determineOverrideStatus(
  params: InferenceEventParams,
  effect: 'filter' | 'boost',
  userExplicitFields: string[],
  overriddenRuleIds: string[],
  userExplicitSkills: string[]
): OverrideResult {
  const explicitlyOverridden = overriddenRuleIds.includes(params.ruleId);
  const implicitFieldOverride = userExplicitFields.includes(params.targetField);

  if (explicitlyOverridden) {
    return {
      override: {
        overrideScope: 'FULL',
        overriddenSkills: toStringArray(params.targetValue),
        reasonType: 'explicit-rule-override',
      },
      effectiveTargetValue: params.targetValue,
    };
  }

  if (implicitFieldOverride) {
    return {
      override: {
        overrideScope: 'FULL',
        overriddenSkills: toStringArray(params.targetValue),
        reasonType: 'implicit-field-override',
      },
      effectiveTargetValue: params.targetValue,
    };
  }

  // Check implicit skill override for filter rules targeting derivedSkills
  if (effect === 'filter' && params.targetField === 'derivedSkills') {
    const targetSkills = toStringArray(params.targetValue);
    const userSkillSet = new Set(userExplicitSkills);
    const overriddenSkills = targetSkills.filter(s => userSkillSet.has(s));

    if (overriddenSkills.length === targetSkills.length) {
      return {
        override: { overrideScope: 'FULL', overriddenSkills, reasonType: 'implicit-skill-override' },
        effectiveTargetValue: params.targetValue,
      };
    }
    if (overriddenSkills.length > 0) {
      return {
        override: { overrideScope: 'PARTIAL', overriddenSkills, reasonType: 'implicit-skill-override' },
        effectiveTargetValue: targetSkills.filter(s => !userSkillSet.has(s)),
      };
    }
  }

  return { override: undefined, effectiveTargetValue: params.targetValue };
}
```

#### 3. Update Override Logic Table
**Section**: Part 3 - Override Logic table (around line 808)

Update the table to include `reasonType`:

```markdown
| Override Type | Mechanism | Applies To | Override Scope | Reason Type |
|---------------|-----------|------------|----------------|-------------|
| **Explicit** | `overriddenRuleIds` in request | Both filter AND boost rules | `FULL` | `explicit-rule-override` |
| **Implicit Field** | User sets target field | Both filter AND boost rules | `FULL` | `implicit-field-override` |
| **Implicit Skill (all)** | User handles ALL target skills | Filter rules targeting `derivedSkills` | `FULL` | `implicit-skill-override` |
| **Implicit Skill (some)** | User handles SOME target skills | Filter rules targeting `derivedSkills` | `PARTIAL` | `implicit-skill-override` |
```

#### 4. Update Example 4 (Explicit Rule Override)
**Section**: Part 6 - Example 4 (around line 1296)

Update the result to show `reasonType`:

```typescript
**Result**:
```typescript
{
  derivedConstraints: [
    {
      rule: { id: 'scaling-requires-distributed', name: 'Scaling Requires Distributed Systems' },
      action: { effect: 'filter', targetField: 'derivedSkills', targetValue: ['skill_distributed'] },
      provenance: { derivationChains: [['scaling-requires-distributed']], explanation: '...' },
      override: {
        overrideScope: 'FULL',
        overriddenSkills: ['skill_distributed'],
        reasonType: 'explicit-rule-override'  // <-- NEW: indicates WHY override happened
      }
    }
    // Note: NO distributed-requires-observability because chain was broken
  ],
  iterationCount: 2
}
```

**Why This Matters**: The `reasonType` field now makes it clear that this override happened because the user explicitly listed the rule in `overriddenRuleIds`, not because of an implicit field or skill match.
```

#### 5. Update Example 6 (Implicit Filter Override)
**Section**: Part 6 - Example 6 (around line 1360)

Update the result to show `reasonType`:

```typescript
**Result**:
```typescript
{
  derivedConstraints: [
    {
      rule: { id: 'scaling-requires-distributed', name: 'Scaling Requires Distributed Systems' },
      action: { effect: 'filter', targetField: 'derivedSkills', targetValue: ['skill_distributed'] },
      provenance: { derivationChains: [['scaling-requires-distributed']], explanation: '...' },
      override: {
        overrideScope: 'FULL',
        overriddenSkills: ['skill_distributed'],
        reasonType: 'implicit-skill-override'  // <-- Implicit filter override (user already has skill)
      }
    },
    // ... chain continues
  ],
  iterationCount: 3
}
```
```

#### 6. Update Example 7 (Partial Filter Override)
**Section**: Part 6 - Example 7 (around line 1407)

Update the result to show `reasonType`:

```typescript
**Result**:
```typescript
{
  rule: { id: 'focus-requires-skills', name: '...' },
  action: {
    effect: 'filter',
    targetField: 'derivedSkills',
    targetValue: ['skill_b', 'skill_c']  // <-- Reduced! skill_a removed
  },
  provenance: {
    derivationChains: [['focus-requires-skills']],
    explanation: '...',
  },
  override: {
    overrideScope: 'PARTIAL',  // <-- Indicates partial override
    overriddenSkills: ['skill_a'],  // <-- What user handled
    reasonType: 'implicit-skill-override'  // <-- Reason for override
  }
}
```
```

#### 7. Update Key Takeaways
**Section**: Key Takeaways (around line 1483)

Update takeaway #4 to mention `reasonType`:

```markdown
4. **Three override mechanisms** (all produce `override` object with `reasonType`):
   - **Explicit**: `overriddenRuleIds` overrides any rule (breaks chains) → `FULL`, `reasonType: 'explicit-rule-override'`
   - **Implicit field**: User sets ANY field → rules targeting that field are overridden → `FULL`, `reasonType: 'implicit-field-override'`
   - **Implicit skill**: User already handles a skill → filter rule for that skill is overridden (chains continue) → `FULL` or `PARTIAL`, `reasonType: 'implicit-skill-override'`
```

### Success Criteria:

#### Automated Verification:
- [x] Documentation file is valid markdown (no syntax errors)
- [x] All code blocks have proper syntax highlighting tags

#### Manual Verification:
- [ ] All type definitions in walkthrough match the actual implementation
- [ ] All examples show correct `reasonType` values for their scenario
- [ ] Override logic table is accurate and complete
- [ ] Key takeaways correctly summarize the three `reasonType` values

**Implementation Note**: This phase should be completed after Phase 1 passes all tests, to ensure the documentation reflects the actual implementation.

---

## Testing Strategy

### Unit Tests:
- `reasonType` is set correctly for each of the three override mechanisms
- Precedence: explicit > implicit-field > implicit-skill
- `reasonType` is propagated to `OverriddenRuleInfo` in the result

### Integration Tests:
- Full inference flow includes `reasonType` in both constraint and result
- E2E tests continue to pass (no breaking changes)

### Manual Testing Steps:
1. Start Tilt: `./bin/tilt-start.sh`
2. Test explicit override:
   ```bash
   curl -X POST http://localhost:4025/api/search \
     -H "Content-Type: application/json" \
     -d '{"teamFocus": "scaling", "overriddenRuleIds": ["scaling-requires-distributed"]}'
   ```
   Verify response contains `"reasonType": "explicit-rule-override"`

3. Test implicit skill override:
   ```bash
   curl -X POST http://localhost:4025/api/search \
     -H "Content-Type: application/json" \
     -d '{"teamFocus": "scaling", "requiredSkills": [{"skill": "skill_distributed"}]}'
   ```
   Verify response contains `"reasonType": "implicit-skill-override"`

## References

- Current override implementation: `rule-engine-adapter.ts:348-386`
- Type definitions: `inference-rule.types.ts:20-110`
- Code walkthrough (to update in Phase 2): `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-inference-engine-code-walkthrough.md`
  - Part 1: Type definitions (lines 76-197)
  - Part 3: `determineOverrideStatus()` and override logic table (lines 680-820)
  - Part 6: Examples 4, 6, 7 (lines 1296-1426)
  - Key Takeaways (lines 1483-1520)
