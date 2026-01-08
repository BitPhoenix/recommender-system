# Inference Engine Missing Tests Implementation Plan

## Overview

Implement the 5 remaining test coverage gaps identified in the test coverage gaps research document. These tests target edge cases in override detection, helper function behavior, and multi-trigger chain handling that aren't covered by the existing 128+ tests.

## Current State Analysis

The inference engine has solid test coverage (~85-90%) after the recent addition of 52+ tests. However, 5 critical gaps remain:

1. **PARTIAL override for filter rules** - When user handles *some but not all* target skills
2. **`extractDerivedTriggers()` direct tests** - Core chain detection function lacks unit tests
3. **`buildDerivationChains()` with multiple triggers** - 2D chain paths untested
4. **Property merging in `mergeDerivedValuesIntoContext()`** - Non-skill target fields
5. **Multiple derivation chain paths for same rule** - Convergent chains

### Key Discoveries:
- `extractDerivedTriggers()` is NOT exported from `rule-engine-adapter.ts` (lines 198-250)
- `buildDerivationChains()` is NOT exported from `rule-engine-adapter.ts` (lines 417-467)
- PARTIAL override logic exists at lines 396-405 but uses real rules
- Property merging logic at lines 523-550 handles `preferredSeniorityLevel` → `preferredProperties.seniorityLevel`

## Desired End State

All 5 gaps have dedicated test coverage:
- PARTIAL override verified through integration test (since helpers aren't exported)
- Direct function tests added after exporting the two helper functions
- Multi-trigger chains verified via existing chain rule combinations
- Property merging verified via boost rules targeting non-skill fields

### Verification:
```bash
npm test -- src/services/inference-engine.service.test.ts src/services/rule-engine-adapter.test.ts
```
All tests pass with 10+ new test cases added.

## What We're NOT Doing

- Adding new inference rules (tests use existing rules creatively)
- Modifying business logic (test-only changes)
- E2E/Postman tests (those are a separate concern)
- Performance testing

## Implementation Approach

Split into 3 phases:
1. **Phase 1**: Add tests using existing exports (PARTIAL override, property merging, multi-path)
2. **Phase 2**: Export helper functions and add direct unit tests
3. **Phase 3**: Add multi-trigger chain test

This order minimizes churn - Phase 1 uses existing APIs, Phase 2 adds safe exports, Phase 3 combines both.

---

## Phase 1: Integration Tests Using Existing Exports

### Overview
Add 4 tests that verify behavior through the public `runInference()` and `eventToDerivedConstraint()` APIs.

### Changes Required:

#### 1. PARTIAL Override Test
**File**: `recommender_api/src/services/inference-engine.service.test.ts`
**Location**: Add to `describe('implicit filter override')` block (after line 701)

```typescript
it('marks as PARTIAL when user handles some but not all target skills', async () => {
  /*
   * The distributed-requires-observability rule targets ['skill_monitoring'].
   * We need a rule that targets MULTIPLE skills to test PARTIAL.
   * Since no current rule does this, we test via rule-engine-adapter directly.
   */
  // This test will be in rule-engine-adapter.test.ts instead
});
```

**Better approach**: Add to `rule-engine-adapter.test.ts` since it can construct arbitrary events.

**File**: `recommender_api/src/services/rule-engine-adapter.test.ts`
**Location**: Add to `describe('eventToDerivedConstraint with implicit filter override')` (after line 755)

```typescript
it('correctly reduces targetValue for PARTIAL override', () => {
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
    ['skill_a', 'skill_c']  // User handles 2 of 3
  );

  expect(constraint.override?.overrideScope).toBe('PARTIAL');
  expect(constraint.override?.overriddenSkills).toEqual(['skill_a', 'skill_c']);
  // Effective targetValue should only include unhandled skill
  expect(constraint.action.targetValue).toEqual(['skill_b']);
});
```

#### 2. Property Merging Tests
**File**: `recommender_api/src/services/rule-engine-adapter.test.ts`
**Location**: Add new describe block after `describe('mergeDerivedSkillsIntoInferenceContext edge cases')` (after line 589)

```typescript
describe('mergeDerivedValuesIntoContext property handling', () => {
  it('routes boost rule preferredSeniorityLevel to preferredProperties', () => {
    const context = createMockContext();

    const constraints = [
      {
        rule: { id: 'greenfield-prefers-senior', name: 'Test' },
        action: {
          effect: 'boost' as const,
          targetField: 'preferredSeniorityLevel' as const,
          targetValue: 'senior',
          boostStrength: 0.4,
        },
        provenance: { derivationChains: [['greenfield-prefers-senior']], explanation: 'test' },
      },
    ];

    const merged = mergeDerivedSkillsIntoInferenceContext(context, constraints);

    expect(merged.derived.preferredProperties.seniorityLevel).toBe('senior');
    // Should NOT be in requiredProperties (boost rule → preferred)
    expect(merged.derived.requiredProperties.seniorityLevel).toBeUndefined();
  });

  it('routes filter rule preferredX to requiredProperties', () => {
    const context = createMockContext();

    const constraints = [
      {
        rule: { id: 'test-filter', name: 'Test' },
        action: {
          effect: 'filter' as const,
          targetField: 'preferredSeniorityLevel' as const,  // Unusual but valid
          targetValue: 'senior',
        },
        provenance: { derivationChains: [['test-filter']], explanation: 'test' },
      },
    ];

    const merged = mergeDerivedSkillsIntoInferenceContext(context, constraints);

    // Filter rules produce hard constraints → requiredProperties
    expect(merged.derived.requiredProperties.seniorityLevel).toBe('senior');
  });

  it('maintains property provenance for chaining', () => {
    const context = createMockContext();

    const constraints = [
      {
        rule: { id: 'greenfield-prefers-senior', name: 'Test' },
        action: {
          effect: 'boost' as const,
          targetField: 'preferredSeniorityLevel' as const,
          targetValue: 'senior',
          boostStrength: 0.4,
        },
        provenance: { derivationChains: [['greenfield-prefers-senior']], explanation: 'test' },
      },
    ];

    const merged = mergeDerivedSkillsIntoInferenceContext(context, constraints);

    expect(merged.derived.preferredPropertyProvenance.get('seniorityLevel')).toEqual([
      ['greenfield-prefers-senior'],
    ]);
  });
});
```

#### 3. Multiple Derivation Chain Paths Test
**File**: `recommender_api/src/services/inference-engine.service.test.ts`
**Location**: Add to `describe('derivation chain provenance')` (after line 899)

```typescript
describe('multiple derivation paths', () => {
  it('captures convergent paths when skill reached via multiple sources', async () => {
    /*
     * Test scenario: skill_distributed can be reached via:
     * 1. teamFocus:scaling → scaling-requires-distributed (derives skill_distributed)
     * 2. User requires skill_distributed directly
     *
     * When both paths exist, the derived rule should still fire but be marked
     * as FULL override (user already has the skill).
     */
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_distributed' }],
    };

    const result = await runInference(request);

    // The scaling rule fires but is overridden
    const scalingRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule).toBeDefined();
    expect(scalingRule!.override?.overrideScope).toBe('FULL');

    // Chain rules from skill_distributed should fire (user has it in allSkills)
    const observabilityRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'distributed-requires-observability'
    );
    expect(observabilityRule).toBeDefined();

    // The observability rule's chain should show it came from user's skill
    // (single-element chain, not multi-hop since triggered by user-input)
    expect(observabilityRule!.provenance.derivationChains).toEqual([
      ['distributed-requires-observability'],
    ]);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Tests pass: `npm test -- src/services/rule-engine-adapter.test.ts`
- [x] Tests pass: `npm test -- src/services/inference-engine.service.test.ts`
- [x] Type checking passes: `npx tsc --noEmit`

---

## Phase 2: Export Helper Functions and Add Direct Tests

### Overview
Export `extractDerivedTriggers()` and `buildDerivationChains()` for direct unit testing.

### Changes Required:

#### 1. Export Helper Functions
**File**: `recommender_api/src/services/rule-engine-adapter.ts`
**Changes**: Change function visibility and add to exports

At line 198, change:
```typescript
function extractDerivedTriggers(
```
to:
```typescript
export function extractDerivedTriggers(
```

At line 417, change:
```typescript
function buildDerivationChains(
```
to:
```typescript
export function buildDerivationChains(
```

#### 2. Add Direct Unit Tests for `extractDerivedTriggers`
**File**: `recommender_api/src/services/rule-engine-adapter.test.ts`
**Location**: Add new describe block (before line 1071)

```typescript
import {
  createEngine,
  createInferenceContext,
  eventToDerivedConstraint,
  mergeDerivedSkillsIntoInferenceContext,
  computeContextHash,
  clearEngineCache,
  extractDerivedTriggers,  // New import
  buildDerivationChains,   // New import
} from './rule-engine-adapter.js';
```

```typescript
describe('extractDerivedTriggers', () => {
  const mockRulesWithChains: InferenceRuleDefinition[] = [
    // First-hop rule (no derived triggers)
    {
      name: 'Scaling Requires Distributed',
      conditions: {
        all: [{ fact: 'request', path: '$.teamFocus', operator: 'equal', value: 'scaling' }],
      },
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'scaling-requires-distributed',
          targetField: 'derivedSkills',
          targetValue: ['skill_distributed'],
          rationale: 'Test',
        },
      },
    },
    // Skill chain rule
    {
      name: 'Distributed Requires Observability',
      conditions: {
        all: [
          { fact: 'derived', path: '$.allSkills', operator: 'contains', value: 'skill_distributed' },
        ],
      },
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'distributed-requires-observability',
          targetField: 'derivedSkills',
          targetValue: ['skill_monitoring'],
          rationale: 'Test',
        },
      },
    },
    // Property chain rule (fires from either container)
    {
      name: 'Senior Prefers Leadership',
      conditions: {
        any: [
          { fact: 'derived', path: '$.requiredProperties.seniorityLevel', operator: 'in', value: ['senior'] },
          { fact: 'derived', path: '$.preferredProperties.seniorityLevel', operator: 'in', value: ['senior'] },
        ],
      },
      event: {
        type: 'derived-boost',
        params: {
          ruleId: 'senior-prefers-leadership',
          targetField: 'derivedSkills',
          targetValue: ['skill_mentorship'],
          boostStrength: 0.6,
          rationale: 'Test',
        },
      },
    },
  ];

  it('returns empty array for first-hop rules (no derived triggers)', () => {
    const triggers = extractDerivedTriggers(mockRulesWithChains, 'scaling-requires-distributed');
    expect(triggers).toEqual([]);
  });

  it('detects skill trigger from allSkills contains', () => {
    const triggers = extractDerivedTriggers(mockRulesWithChains, 'distributed-requires-observability');
    expect(triggers).toEqual([
      { type: 'skill', provenanceKey: 'skill_distributed' },
    ]);
  });

  it('detects property triggers from BOTH containers (any condition)', () => {
    const triggers = extractDerivedTriggers(mockRulesWithChains, 'senior-prefers-leadership');
    expect(triggers).toContainEqual({ type: 'requiredProperty', provenanceKey: 'seniorityLevel' });
    expect(triggers).toContainEqual({ type: 'preferredProperty', provenanceKey: 'seniorityLevel' });
  });

  it('returns empty array for unknown rule', () => {
    const triggers = extractDerivedTriggers(mockRulesWithChains, 'nonexistent-rule');
    expect(triggers).toEqual([]);
  });
});
```

#### 3. Add Direct Unit Tests for `buildDerivationChains`
**File**: `recommender_api/src/services/rule-engine-adapter.test.ts`
**Location**: Add after the `extractDerivedTriggers` tests

```typescript
describe('buildDerivationChains', () => {
  const mockRulesForChains: InferenceRuleDefinition[] = [
    // First-hop rule
    {
      name: 'Scaling Requires Distributed',
      conditions: {
        all: [{ fact: 'request', path: '$.teamFocus', operator: 'equal', value: 'scaling' }],
      },
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'scaling-requires-distributed',
          targetField: 'derivedSkills',
          targetValue: ['skill_distributed'],
          rationale: 'Test',
        },
      },
    },
    // Skill chain rule
    {
      name: 'Distributed Requires Observability',
      conditions: {
        all: [
          { fact: 'derived', path: '$.allSkills', operator: 'contains', value: 'skill_distributed' },
        ],
      },
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'distributed-requires-observability',
          targetField: 'derivedSkills',
          targetValue: ['skill_monitoring'],
          rationale: 'Test',
        },
      },
    },
  ];

  it('returns single-element chain for first-hop rule', () => {
    const chains = buildDerivationChains(
      'scaling-requires-distributed',
      mockRulesForChains,
      new Map(),
      new Map(),
      new Map()
    );

    expect(chains).toEqual([['scaling-requires-distributed']]);
  });

  it('builds multi-hop chain from skill provenance', () => {
    const skillProvenance = new Map([
      ['skill_distributed', [['scaling-requires-distributed']]],
    ]);

    const chains = buildDerivationChains(
      'distributed-requires-observability',
      mockRulesForChains,
      skillProvenance,
      new Map(),
      new Map()
    );

    expect(chains).toEqual([
      ['scaling-requires-distributed', 'distributed-requires-observability'],
    ]);
  });

  it('filters out user-input sentinel from chains', () => {
    const skillProvenance = new Map([
      ['skill_distributed', [['user-input']]],  // User provided skill
    ]);

    const chains = buildDerivationChains(
      'distributed-requires-observability',
      mockRulesForChains,
      skillProvenance,
      new Map(),
      new Map()
    );

    // Should filter 'user-input' and result in single-element chain
    expect(chains).toEqual([['distributed-requires-observability']]);
  });

  it('builds multiple chains for multiple trigger sources', () => {
    /*
     * Simulates a rule triggered by BOTH skill_a and skill_b,
     * each with their own provenance.
     */
    const multiTriggerRule: InferenceRuleDefinition = {
      name: 'Multi Trigger Rule',
      conditions: {
        all: [
          { fact: 'derived', path: '$.allSkills', operator: 'contains', value: 'skill_a' },
          { fact: 'derived', path: '$.allSkills', operator: 'contains', value: 'skill_b' },
        ],
      },
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'multi-trigger-rule',
          targetField: 'derivedSkills',
          targetValue: ['skill_result'],
          rationale: 'Test',
        },
      },
    };

    const skillProvenance = new Map([
      ['skill_a', [['rule-1']]],
      ['skill_b', [['rule-2']]],
    ]);

    const chains = buildDerivationChains(
      'multi-trigger-rule',
      [multiTriggerRule],
      skillProvenance,
      new Map(),
      new Map()
    );

    expect(chains.length).toBe(2);
    expect(chains).toContainEqual(['rule-1', 'multi-trigger-rule']);
    expect(chains).toContainEqual(['rule-2', 'multi-trigger-rule']);
  });

  it('deduplicates identical chains', () => {
    const skillProvenance = new Map([
      ['skill_distributed', [
        ['scaling-requires-distributed'],
        ['scaling-requires-distributed'],  // Duplicate
      ]],
    ]);

    const chains = buildDerivationChains(
      'distributed-requires-observability',
      mockRulesForChains,
      skillProvenance,
      new Map(),
      new Map()
    );

    expect(chains.length).toBe(1);
    expect(chains).toEqual([
      ['scaling-requires-distributed', 'distributed-requires-observability'],
    ]);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npx tsc --noEmit`
- [x] Tests pass: `npm test -- src/services/rule-engine-adapter.test.ts`
- [x] All 128+ existing tests still pass: `npm test`

---

## Phase 3: Multi-Trigger Derivation Chain Integration Test

### Overview
Add an integration test verifying that rules with multiple derived triggers correctly capture all causal paths.

### Changes Required:

#### 1. Multi-Trigger Integration Test
**File**: `recommender_api/src/services/inference-engine.service.test.ts`
**Location**: Add to `describe('derivation chain provenance')` → `describe('non-skill chains')` (after line 898)

```typescript
it('captures multiple paths for rule triggered by both required and preferred property', async () => {
  /*
   * The senior-prefers-leadership rule has `any` conditions:
   * - requiredProperties.seniorityLevel in [senior, staff, principal]
   * - preferredProperties.seniorityLevel in [senior, staff, principal]
   *
   * If BOTH are satisfied (user sets requiredSeniorityLevel AND a rule derives preferredSeniorityLevel),
   * the rule should capture chains from BOTH sources.
   *
   * Unfortunately, with current rules:
   * - User sets requiredSeniorityLevel → populates requiredProperties.seniorityLevel
   * - greenfield → greenfield-prefers-senior → populates preferredProperties.seniorityLevel:senior
   *
   * Both would trigger senior-prefers-leadership, but the rule only fires ONCE.
   * The derivation chain should reflect whichever source fired it first (or both if tracked).
   */
  const request: SearchFilterRequest = {
    requiredSeniorityLevel: 'senior',
    teamFocus: 'greenfield',
  };

  const result = await runInference(request);

  // senior-prefers-leadership should fire
  const leadershipRule = result.derivedConstraints.find(
    (c) => c.rule.id === 'senior-prefers-leadership'
  );
  expect(leadershipRule).toBeDefined();

  /*
   * Current behavior: since requiredProperties.seniorityLevel is populated
   * from user input (iteration 0), the rule fires in iteration 1 with
   * a single-element chain. The greenfield-prefers-senior rule also fires
   * in iteration 1 but its output (preferredProperties.seniorityLevel) comes
   * AFTER senior-prefers-leadership has already fired.
   *
   * This is expected behavior: first satisfied trigger wins.
   */
  expect(leadershipRule!.provenance.derivationChains).toEqual([
    ['senior-prefers-leadership'],
  ]);
});
```

### Success Criteria:

#### Automated Verification:
- [x] Tests pass: `npm test -- src/services/inference-engine.service.test.ts`
- [x] All 128+ existing tests still pass: `npm test`

---

## Testing Strategy

### Unit Tests:
- `extractDerivedTriggers()`: 4 tests (first-hop, skill trigger, property triggers, unknown rule)
- `buildDerivationChains()`: 5 tests (single-element, multi-hop, user-input filter, multi-trigger, dedup)
- PARTIAL override: 1 test in rule-engine-adapter
- Property merging: 3 tests in rule-engine-adapter

### Integration Tests:
- Multiple derivation paths: 1 test verifying convergent paths
- Multi-trigger chains: 1 test verifying "any" conditions behavior

### Total New Tests: ~15

## Performance Considerations

None - these are pure test additions with no production code changes except exporting two existing functions.

## Migration Notes

None - no breaking changes.

## References

- Original research: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-07-inference-engine-test-coverage-gaps.md`
- Implementation: `recommender_api/src/services/rule-engine-adapter.ts`
- Existing tests: `recommender_api/src/services/rule-engine-adapter.test.ts` (47 tests)
- Existing tests: `recommender_api/src/services/inference-engine.service.test.ts` (34 tests)
