# Derivation Chain Provenance Implementation Plan

## Overview

Implement proper multi-hop derivation chain tracking for the inference engine. Currently, `derivationChain` only contains the current rule's ID. After this change, it will contain the full causal chain showing how each constraint was derived.

**Scope expansion**: This plan also generalizes the chaining mechanism to support non-skill derived values (e.g., `preferredSeniorityLevel`), enabling richer inference chains.

## Current State Analysis

**The Problem**: In `rule-engine-adapter.ts:207-209`:
```typescript
provenance: {
  derivationChain: [params.ruleId],  // Always just the current rule
  explanation: params.rationale,
},
```

**Example of current (incorrect) behavior**:
```
Input: { teamFocus: 'scaling' }

Rule 1: scaling-requires-distributed
  derivationChain: ['scaling-requires-distributed']  ✓ correct

Rule 2: distributed-requires-observability (triggered because Rule 1 added skill_distributed)
  derivationChain: ['distributed-requires-observability']  ✗ should be ['scaling-requires-distributed', 'distributed-requires-observability']
```

**Root Cause**: Nothing tracks which constraint produced which derived value.

### Key Discoveries:
- Rules chain via `derived.allSkills` - skill chain rules use `contains` operator (`filter-rules.config.ts:86-93`)
- Skills are merged in `mergeDerivedSkillsIntoInferenceContext` after each iteration
- First-hop rules check user input fields (`request.teamFocus`, etc.)
- Chain rules check `derived.*` values
- Non-skill derived values (e.g., `preferredSeniorityLevel`) don't currently support chaining
- The inference loop already tracks `allDerivedConstraints` in order

### Current Limitation:
Rules like `greenfield-prefers-senior` set `preferredSeniorityLevel: 'senior'`, but no downstream rules can chain from this. If a rule derived that senior is preferred, we should also be able to derive leadership skill boosts.

## Desired End State

After implementation:

1. **First-hop rules** (triggered by user input like `teamFocus`): `derivationChain: ['rule-id']`
2. **Skill chain rules** (triggered by skill in `allSkills`): `derivationChain: ['source-rule-id', ..., 'current-rule-id']`
3. **Property chain rules from derived values**: `derivationChain: ['source-rule-id', ..., 'current-rule-id']`
4. **Property chain rules from user input**: `derivationChain: ['current-rule-id']` (single element)

**Example 1: Multi-hop chain via derived value**:
```
Input: { teamFocus: 'greenfield' }

Rule 1: greenfield-prefers-senior
  derivationChain: ['greenfield-prefers-senior']
  sets: preferredSeniorityLevel = 'senior' (in derived.preferredProperties)

Rule 2: senior-prefers-leadership (fires from derived.preferredProperties)
  derivationChain: ['greenfield-prefers-senior', 'senior-prefers-leadership']
  boosts: skill_mentorship, skill_tech_leadership
```

**Example 2: Single-hop from user input**:
```
Input: { requiredSeniorityLevel: 'senior' }

Rule: senior-prefers-leadership (fires from request.requiredSeniorityLevel)
  derivationChain: ['senior-prefers-leadership']
  boosts: skill_mentorship, skill_tech_leadership
```

**Verification**:
- Unit tests assert correct derivation chains for multi-hop scenarios
- Existing tests continue to pass
- Documentation examples match actual behavior

## What We're NOT Doing

- **Not changing existing rule definitions**: Existing rules stay the same
- **Not changing API response shape**: `derivationChain` field already exists, just populated correctly
- **Not adding complex merge strategies**: Non-skill fields use first-wins (first rule to set a field wins)

## Implementation Approach

**Strategy: Dual Provenance Maps**

Maintain two separate maps for tracking provenance, reflecting the semantic difference between skills (array, union merge) and fields (scalar, first-wins):

1. **Two property containers** reflecting constraint types:
   - `requiredProperties: Record<string, string>` - from required* fields + filter rules
   - `preferredProperties: Record<string, string>` - from preferred* fields + boost rules

2. **Three provenance maps** for derivation chain tracking:
   - `SkillProvenance = Map<string, string[]>` - skill ID → derivation chain
   - `RequiredPropertyProvenance = Map<string, string[]>` - property name → derivation chain
   - `PreferredPropertyProvenance = Map<string, string[]>` - property name → derivation chain

3. **Normalized property keys** - strip `required`/`preferred` prefix so both containers use semantic keys (e.g., `seniorityLevel` not `requiredSeniorityLevel`)

4. **Explicit chain rule control**:
   - Filter chain rules check `requiredProperties` only (hard constraint from hard source)
   - Boost chain rules use `any` to check both containers (soft constraint from any source)

**Why two property containers?** Required and preferred have different semantics - required filters candidates out, preferred affects ranking. Separate containers let rule authors explicitly choose what triggers their rule.

---

## Phase 1: Generalize Derived Value Tracking

### Overview
Extend `InferenceContext.derived` to track all derived values with provenance.

### Changes Required:

#### 1. Add Provenance Types
**File**: `recommender_api/src/types/rule-engine.types.ts`
**Changes**: Add three provenance types (one for skills, two for properties)

```typescript
/**
 * Maps skill IDs to the derivation chain that produced them.
 * Used to build proper derivationChain for skill-triggered chain rules.
 *
 * Key: skill ID (e.g., 'skill_distributed')
 * Value: derivation chain (['user-input'] for user-provided, rule IDs for derived)
 */
export type SkillProvenance = Map<string, string[]>;

/**
 * Maps normalized property names to the derivation chain that produced them.
 * Used to build proper derivationChain for property-triggered chain rules.
 *
 * Key: normalized property name (e.g., 'seniorityLevel' not 'requiredSeniorityLevel')
 * Value: derivation chain (['user-input'] for user-provided, rule IDs for derived)
 */
export type RequiredPropertyProvenance = Map<string, string[]>;
export type PreferredPropertyProvenance = Map<string, string[]>;

/**
 * Normalize property key by stripping required/preferred prefix.
 * 'requiredSeniorityLevel' → 'seniorityLevel'
 * 'preferredMaxStartTime' → 'maxStartTime'
 */
export function normalizePropertyKey(key: string): string {
  if (key.startsWith('required')) {
    return key.charAt(8).toLowerCase() + key.slice(9);
  }
  if (key.startsWith('preferred')) {
    return key.charAt(9).toLowerCase() + key.slice(10);
  }
  return key;
}
```

#### 1b. Clean Up ConstraintTargetField
**File**: `recommender_api/src/types/inference-rule.types.ts`
**Changes**: Remove unused `utilityWeightAdjustment`

```typescript
export type ConstraintTargetField =
  | "derivedSkills"
  | "preferredSeniorityLevel"
  | "preferredMaxStartTime"
  | "preferredConfidenceScore"
  | "preferredProficiency";
  // Removed: utilityWeightAdjustment (unused, conceptually different)
```

#### 2. Extend InferenceContext.derived
**File**: `recommender_api/src/types/rule-engine.types.ts`
**Changes**: Add two property containers and three provenance maps

```typescript
export interface InferenceContext {
  request: SearchFilterRequest & {
    skills: string[];
  };
  derived: {
    // Existing
    allSkills: string[];

    // NEW: Two property containers with normalized keys (e.g., 'seniorityLevel')
    requiredProperties: Record<string, string>;   // From required* fields + filter rules
    preferredProperties: Record<string, string>;  // From preferred* fields + boost rules

    // NEW: Provenance maps for derivation chain building
    skillProvenance: SkillProvenance;
    requiredPropertyProvenance: RequiredPropertyProvenance;
    preferredPropertyProvenance: PreferredPropertyProvenance;
  };
  meta: {
    userExplicitFields: string[];
    overriddenRuleIds: string[];
    userExplicitSkills: string[];
  };
}
```

**Why two property containers?**
- Semantic clarity: required = hard filter, preferred = soft ranking
- Rule authors explicitly choose what triggers their rules
- Filter chain rules check `requiredProperties` only (safe: hard from hard)
- Boost chain rules can check both via `any` (safe: soft from any source)

#### 3. Initialize Provenance in createInferenceContext
**File**: `recommender_api/src/services/rule-engine-adapter.ts`
**Changes**: Initialize both property containers and all three provenance maps

```typescript
export function createInferenceContext(request: SearchFilterRequest): InferenceContext {
  const skillNames = (request.requiredSkills || []).map((s) => s.skill);

  // Build initial skill provenance for user-provided skills
  const skillProvenance: SkillProvenance = new Map();
  for (const skill of skillNames) {
    skillProvenance.set(skill, ['user-input']);
  }

  // Build initial property containers and provenance from user input
  const requiredProperties: Record<string, string> = {};
  const preferredProperties: Record<string, string> = {};
  const requiredPropertyProvenance: RequiredPropertyProvenance = new Map();
  const preferredPropertyProvenance: PreferredPropertyProvenance = new Map();

  for (const [key, value] of Object.entries(request)) {
    if (typeof value !== 'string') continue;

    const normalizedKey = normalizePropertyKey(key);

    if (key.startsWith('required')) {
      requiredProperties[normalizedKey] = value;
      requiredPropertyProvenance.set(normalizedKey, ['user-input']);
    } else if (key.startsWith('preferred')) {
      preferredProperties[normalizedKey] = value;
      preferredPropertyProvenance.set(normalizedKey, ['user-input']);
    }
  }

  return {
    request: {
      ...request,
      skills: skillNames,
    },
    derived: {
      allSkills: [...skillNames],
      requiredProperties,
      preferredProperties,
      skillProvenance,
      requiredPropertyProvenance,
      preferredPropertyProvenance,
    },
    meta: {
      userExplicitFields: extractUserExplicitFields(request),
      overriddenRuleIds: request.overriddenRuleIds || [],
      userExplicitSkills: extractUserExplicitSkills(request),
    },
  };
}
```

**Key design decisions**:
- User's `requiredSeniorityLevel` → `requiredProperties.seniorityLevel` (normalized key)
- User's `preferredX` (if existed) → `preferredProperties.x` (normalized key)
- Both containers populated from user input, just like `allSkills` is populated from `requiredSkills`
- Consistent pattern: user input goes into derived context to enable chain rules

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Existing tests pass: `npm test`

#### Manual Verification:
- [ ] None required for this phase

---

## Phase 2: Generalize Merge Function

### Overview
Rename and extend merge function to track all derived values, not just skills.

### Changes Required:

#### 1. Rename and Extend Merge Function
**File**: `recommender_api/src/services/rule-engine-adapter.ts`
**Changes**: `mergeDerivedSkillsIntoInferenceContext` → `mergeDerivedValuesIntoContext`

```typescript
/**
 * Merge derived values from constraints into context for chaining.
 * Handles skills (array union) and properties (first-wins into appropriate container).
 * Maintains separate provenance maps for skills, required properties, and preferred properties.
 */
export function mergeDerivedValuesIntoContext(
  context: InferenceContext,
  constraints: DerivedConstraint[]
): InferenceContext {
  const newSkills = new Set(context.derived.allSkills);
  const newSkillProvenance = new Map(context.derived.skillProvenance);
  const newRequiredProperties = { ...context.derived.requiredProperties };
  const newPreferredProperties = { ...context.derived.preferredProperties };
  const newRequiredPropertyProvenance = new Map(context.derived.requiredPropertyProvenance);
  const newPreferredPropertyProvenance = new Map(context.derived.preferredPropertyProvenance);

  for (const c of constraints) {
    // Skip fully overridden constraints
    if (c.override?.overrideScope === 'FULL') continue;

    const targetField = c.action.targetField;
    const targetValue = c.action.targetValue;
    const chain = c.provenance.derivationChain;
    const effect = c.action.effect;

    if (targetField === 'derivedSkills') {
      // Handle skills (array, union merge) → skillProvenance
      const skills = Array.isArray(targetValue) ? targetValue : [targetValue];
      for (const skill of skills) {
        if (typeof skill !== 'string') continue;
        if (!newSkills.has(skill)) {
          newSkills.add(skill);
          newSkillProvenance.set(skill, chain);
        }
      }
    } else if (targetField.startsWith('preferred') && typeof targetValue === 'string') {
      // Normalize the key (preferredSeniorityLevel → seniorityLevel)
      const normalizedKey = normalizePropertyKey(targetField);

      // Route to appropriate container based on rule effect
      if (effect === 'filter') {
        // Filter rules produce hard constraints → requiredProperties
        if (!(normalizedKey in newRequiredProperties)) {
          newRequiredProperties[normalizedKey] = targetValue;
          newRequiredPropertyProvenance.set(normalizedKey, chain);
        }
      } else {
        // Boost rules produce soft preferences → preferredProperties
        if (!(normalizedKey in newPreferredProperties)) {
          newPreferredProperties[normalizedKey] = targetValue;
          newPreferredPropertyProvenance.set(normalizedKey, chain);
        }
      }
    }
  }

  return {
    ...context,
    derived: {
      ...context.derived,
      allSkills: [...newSkills],
      requiredProperties: newRequiredProperties,
      preferredProperties: newPreferredProperties,
      skillProvenance: newSkillProvenance,
      requiredPropertyProvenance: newRequiredPropertyProvenance,
      preferredPropertyProvenance: newPreferredPropertyProvenance,
    },
  };
}
```

**Key improvements**:
- Filter rules targeting properties → `requiredProperties` (hard constraints)
- Boost rules targeting properties → `preferredProperties` (soft preferences)
- Normalized keys used in both containers
- Adding a new property requires zero code changes - just add the rule

#### 2. Update Call Site in Inference Engine
**File**: `recommender_api/src/services/inference-engine.service.ts`
**Changes**: Update import and function call

```typescript
import {
  // ... existing imports
  mergeDerivedValuesIntoContext,  // renamed
} from './rule-engine-adapter.js';

// In runInference:
context = mergeDerivedValuesIntoContext(context, allDerivedConstraints);
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Existing tests pass: `npm test`

#### Manual Verification:
- [ ] None required for this phase

---

## Phase 3: Generalize Trigger Detection

### Overview
Modify `eventToDerivedConstraint` to detect triggers from any `derived.*` condition, not just skills.

### Changes Required:

#### 1. Add Generalized Trigger Detection
**File**: `recommender_api/src/services/rule-engine-adapter.ts`
**Changes**: Replace `extractTriggerSkills` with `extractDerivedTriggers`

```typescript
/**
 * Trigger info for a chain rule.
 */
interface DerivedTrigger {
  type: 'skill' | 'requiredProperty' | 'preferredProperty';
  provenanceKey: string;  // Normalized key to look up in the appropriate provenance map
}

/**
 * Extract derived value(s) that triggered a chain rule.
 * Chain rules have conditions like:
 * - { fact: 'derived', path: '$.allSkills', operator: 'contains', value: 'skill_x' }
 * - { fact: 'derived', path: '$.requiredProperties.seniorityLevel', operator: 'in', value: [...] }
 * - { fact: 'derived', path: '$.preferredProperties.seniorityLevel', operator: 'in', value: [...] }
 *
 * Returns empty array for first-hop rules (they only check non-chainable request fields like teamFocus).
 */
function extractDerivedTriggers(
  rules: InferenceRuleDefinition[],
  ruleId: string
): DerivedTrigger[] {
  const rule = rules.find(r => r.event.params.ruleId === ruleId);
  if (!rule) return [];

  const triggers: DerivedTrigger[] = [];

  // Check both 'all' and 'any' conditions (chain rules may use 'any' to fire from both containers)
  const allConditions = [
    ...(rule.conditions.all || []),
    ...(rule.conditions.any || []),
  ];

  for (const condition of allConditions) {
    if (condition.fact !== 'derived') continue;

    const path = condition.path as string;
    if (!path?.startsWith('$.')) continue;

    if (path === '$.allSkills' && condition.operator === 'contains') {
      // Skill trigger: $.allSkills contains 'skill_x'
      if (typeof condition.value === 'string') {
        triggers.push({
          type: 'skill',
          provenanceKey: condition.value,  // Skill ID
        });
      }
    } else if (path.startsWith('$.requiredProperties.')) {
      // Required property trigger: $.requiredProperties.seniorityLevel
      const normalizedKey = path.replace('$.requiredProperties.', '');
      triggers.push({
        type: 'requiredProperty',
        provenanceKey: normalizedKey,  // e.g., 'seniorityLevel'
      });
    } else if (path.startsWith('$.preferredProperties.')) {
      // Preferred property trigger: $.preferredProperties.seniorityLevel
      const normalizedKey = path.replace('$.preferredProperties.', '');
      triggers.push({
        type: 'preferredProperty',
        provenanceKey: normalizedKey,  // e.g., 'seniorityLevel'
      });
    }
  }

  return triggers;
}
```

#### 2. Update eventToDerivedConstraint
**File**: `recommender_api/src/services/rule-engine-adapter.ts`
**Changes**: Use generalized trigger detection with three provenance maps

```typescript
export function eventToDerivedConstraint(
  event: EngineEvent,
  userExplicitFields: string[],
  rules: InferenceRuleDefinition[],
  overriddenRuleIds: string[] = [],
  userExplicitSkills: string[] = [],
  skillProvenance: SkillProvenance = new Map(),
  requiredPropertyProvenance: RequiredPropertyProvenance = new Map(),
  preferredPropertyProvenance: PreferredPropertyProvenance = new Map()
): DerivedConstraint {
  const params = event.params as unknown as InferenceEventParams;
  const effect = event.type === 'derived-filter' ? 'filter' : 'boost';

  // ... existing override logic ...

  // Build derivation chain
  const triggers = extractDerivedTriggers(rules, params.ruleId);
  let derivationChain: string[];

  if (triggers.length === 0) {
    // First-hop rule (triggered by user input, not by derived values)
    derivationChain = [params.ruleId];
  } else {
    // Chain rule - find the provenance of the trigger value(s)
    // Look up from the correct map based on trigger type
    // If multiple triggers, use the longest chain (most specific provenance)
    let longestSourceChain: string[] = [];
    for (const trigger of triggers) {
      let provenanceMap: Map<string, string[]>;
      switch (trigger.type) {
        case 'skill':
          provenanceMap = skillProvenance;
          break;
        case 'requiredProperty':
          provenanceMap = requiredPropertyProvenance;
          break;
        case 'preferredProperty':
          provenanceMap = preferredPropertyProvenance;
          break;
      }
      const sourceChain = provenanceMap.get(trigger.provenanceKey) || [];
      if (sourceChain.length > longestSourceChain.length) {
        longestSourceChain = sourceChain;
      }
    }

    // Filter out 'user-input' marker if present, then append current rule
    const filteredChain = longestSourceChain.filter(id => id !== 'user-input');
    derivationChain = [...filteredChain, params.ruleId];
  }

  return {
    rule: {
      id: params.ruleId,
      name: getRuleName(rules, params.ruleId),
    },
    action: {
      effect,
      targetField: params.targetField,
      targetValue: effectiveTargetValue,
      boostStrength: params.boostStrength,
    },
    provenance: {
      derivationChain,
      explanation: params.rationale,
    },
    override,
  };
}
```

#### 3. Update runInference to Pass Provenance Maps
**File**: `recommender_api/src/services/inference-engine.service.ts`
**Changes**: Pass all three provenance maps to `eventToDerivedConstraint`

```typescript
const constraint = eventToDerivedConstraint(
  event,
  context.meta.userExplicitFields,
  config.inferenceRules,
  context.meta.overriddenRuleIds,
  context.meta.userExplicitSkills,
  context.derived.skillProvenance,
  context.derived.requiredPropertyProvenance,
  context.derived.preferredPropertyProvenance
);
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Existing tests pass: `npm test`

#### Manual Verification:
- [ ] None required for this phase

---

## Phase 4: Add Non-Skill Chain Rule

### Overview
Add a new rule that demonstrates chaining from a non-skill derived value.

### Changes Required:

#### 1. Add derived-senior-prefers-leadership Rule
**File**: `recommender_api/src/config/knowledge-base/inference-rules/boost-rules.config.ts`
**Changes**: Add new chain rule

```typescript
/**
 * Senior seniority benefits from leadership skills.
 * Priority 35: Fires after seniority may be derived (lower than first-hop priority 50)
 *
 * Fires from EITHER container (user required OR rule-derived preferred):
 * - requiredProperties.seniorityLevel = senior/staff/principal (user set requiredSeniorityLevel)
 * - preferredProperties.seniorityLevel = senior/staff/principal (rule set preferredSeniorityLevel)
 *
 * Example chains:
 * - User input: requiredSeniorityLevel:senior → leadership boost (single-element chain)
 * - Derived: greenfield → preferredSeniorityLevel:senior → leadership boost (multi-hop chain)
 */
const seniorPrefersLeadership: InferenceRuleDefinition = {
  name: 'Senior Seniority Benefits from Leadership',
  priority: 35,
  conditions: {
    any: [
      // Fire from user's required seniority (normalized key in requiredProperties)
      {
        fact: 'derived',
        path: '$.requiredProperties.seniorityLevel',
        operator: 'in',
        value: ['senior', 'staff', 'principal'],
      },
      // Fire from rule-derived preferred seniority (normalized key in preferredProperties)
      {
        fact: 'derived',
        path: '$.preferredProperties.seniorityLevel',
        operator: 'in',
        value: ['senior', 'staff', 'principal'],
      },
    ],
  },
  event: {
    type: 'derived-boost',
    params: {
      ruleId: 'senior-prefers-leadership',
      targetField: 'derivedSkills',
      targetValue: ['skill_mentorship', 'skill_tech_leadership'],
      boostStrength: 0.5,
      rationale:
        'Senior seniority suggests leadership skills would be valuable',
    },
  },
};

// Add to exported array:
export const boostRules: InferenceRuleDefinition[] = [
  // ... existing rules ...

  // Chain boosts (fire from required OR preferred properties)
  seniorPrefersLeadership,
];
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Existing tests pass: `npm test`

#### Manual Verification:
- [ ] None required for this phase

---

## Phase 5: Add Tests for Derivation Chain

### Overview
Add unit tests verifying correct derivation chain behavior for skill and non-skill chains.

### Changes Required:

#### 1. Add Derivation Chain Tests
**File**: `recommender_api/src/services/inference-engine.service.test.ts`
**Changes**: Add new describe block

```typescript
describe('derivation chain provenance', () => {
  describe('skill-based chains', () => {
    it('first-hop rule has single-element chain', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
      };

      const result = await runInference(request);

      const scalingRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'scaling-requires-distributed'
      );
      expect(scalingRule).toBeDefined();
      expect(scalingRule!.provenance.derivationChain).toEqual([
        'scaling-requires-distributed',
      ]);
    });

    it('skill chain rule includes source rule in derivation chain', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
      };

      const result = await runInference(request);

      const obsRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'distributed-requires-observability'
      );
      expect(obsRule).toBeDefined();
      expect(obsRule!.provenance.derivationChain).toEqual([
        'scaling-requires-distributed',
        'distributed-requires-observability',
      ]);
    });

    it('chain triggered by user skill has single-element chain', async () => {
      const request: SearchFilterRequest = {
        requiredSkills: [{ skill: 'skill_kubernetes' }],
      };

      const result = await runInference(request);

      const containersRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'kubernetes-requires-containers'
      );
      expect(containersRule).toBeDefined();
      expect(containersRule!.provenance.derivationChain).toEqual([
        'kubernetes-requires-containers',
      ]);
    });
  });

  describe('non-skill chains', () => {
    it('rule chaining from derived seniority includes source rule', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'greenfield',
      };

      const result = await runInference(request);

      // First hop: greenfield → preferredProperties.seniorityLevel:senior
      const seniorRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'greenfield-prefers-senior'
      );
      expect(seniorRule).toBeDefined();
      expect(seniorRule!.provenance.derivationChain).toEqual([
        'greenfield-prefers-senior',
      ]);

      // Second hop: derived senior (from preferredProperties) → leadership skills
      const leadershipRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'senior-prefers-leadership'
      );
      expect(leadershipRule).toBeDefined();
      expect(leadershipRule!.provenance.derivationChain).toEqual([
        'greenfield-prefers-senior',
        'senior-prefers-leadership',
      ]);
    });

    it('user-provided required seniority triggers chain rule with single-element chain', async () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
      };

      const result = await runInference(request);

      // senior-prefers-leadership fires from requiredProperties.seniorityLevel
      // (populated from user's requiredSeniorityLevel)
      // Chain should be single element since triggered by user input
      const leadershipRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'senior-prefers-leadership'
      );
      expect(leadershipRule).toBeDefined();
      expect(leadershipRule!.provenance.derivationChain).toEqual([
        'senior-prefers-leadership',
      ]);
    });

    it('context is populated correctly from user input', async () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
      };

      // Verify the context structure (internal test)
      const context = createInferenceContext(request);
      expect(context.derived.requiredProperties.seniorityLevel).toBe('senior');
      expect(context.derived.requiredPropertyProvenance.get('seniorityLevel')).toEqual(['user-input']);
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All tests pass: `npm test`
- [ ] New derivation chain tests pass: `npm test -- --grep "derivation chain"`

#### Manual Verification:
- [ ] None required for this phase

---

## Phase 6: Update Documentation

### Overview
Update the code walkthrough and CLAUDE.md to reflect the generalized chaining capability.

### Changes Required:

#### 1. Update Code Walkthrough
**File**: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-inference-engine-code-walkthrough.md`
**Changes**:
- Fix Example 2 to show correct derivation chains
- Add example showing non-skill chain

#### 2. Update CLAUDE.md
**File**: `CLAUDE.md`
**Changes**: Add note about non-skill chaining capability in the Inference Rules section

```markdown
### Chaining Mechanism

Rules can chain from derived context values:
- **Skills in `derived.allSkills`**: Use `contains` operator
- **Required properties in `derived.requiredProperties`**: Normalized keys (e.g., `seniorityLevel`)
- **Preferred properties in `derived.preferredProperties`**: Normalized keys

**Key concept**: User input (`requiredSeniorityLevel`) is normalized and stored in `derived.requiredProperties.seniorityLevel`. Rule-derived values go to `derived.preferredProperties`.

Example: Boost chain rule that fires from required OR preferred seniority:
```typescript
{
  conditions: {
    any: [
      // Fire from user's required seniority
      { fact: 'derived', path: '$.requiredProperties.seniorityLevel', operator: 'in', value: ['senior', ...] },
      // Fire from rule-derived preferred seniority
      { fact: 'derived', path: '$.preferredProperties.seniorityLevel', operator: 'in', value: ['senior', ...] },
    ]
  },
  // ...
}
```

The derivation chain reflects the trigger source:
- User input trigger → single-element chain: `['current-rule']`
- Derived value trigger → multi-hop chain: `['source-rule', 'current-rule']`
```

#### 3. Enhance Type Documentation
**File**: `recommender_api/src/types/inference-rule.types.ts`
**Changes**: Update `derivationChain` documentation

```typescript
/** Provenance/traceability */
provenance: {
  /**
   * Rule IDs in causal order showing how this constraint was derived.
   *
   * - First-hop rules (triggered by user input): ['current-rule-id']
   * - Chain rules (triggered by derived value): ['source-rule-id', ..., 'current-rule-id']
   *
   * Examples:
   * - Skill chain: teamFocus=scaling → scaling-requires-distributed → distributed-requires-observability
   *   Second rule's chain: ['scaling-requires-distributed', 'distributed-requires-observability']
   *
   * - Non-skill chain: teamFocus=greenfield → greenfield-prefers-senior → derived-senior-prefers-leadership
   *   Third rule's chain: ['greenfield-prefers-senior', 'derived-senior-prefers-leadership']
   */
  derivationChain: string[];
  explanation: string;
};
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] All tests pass: `npm test`

#### Manual Verification:
- [ ] Documentation examples match actual test output

---

## Testing Strategy

### Unit Tests:
- First-hop rule derivation chain (single element)
- Skill chain rule derivation chain (multiple elements)
- Non-skill chain rule derivation chain (multiple elements)
- User-provided skill triggering chain (single element)
- User-provided seniority triggering chain (single element)
- Mixed skill and non-skill chains

### Integration Tests:
- E2E test via Postman: verify `derivedConstraints[].provenance.derivationChain` in API response
- Test greenfield → senior → leadership chain end-to-end

### Manual Testing Steps:
1. Start Tilt: `./bin/tilt-start.sh`
2. Make search request with `teamFocus: 'greenfield'`
3. Verify response shows the full chain: greenfield → senior → leadership
4. Make search request with `teamFocus: 'scaling'`
5. Verify response shows: scaling → distributed → observability chain

## Performance Considerations

- `SkillProvenance` + `PreferredPropertyProvenance` maps add O(n) space where n = number of derived values (typically < 30 total)
- `extractDerivedTriggers` iterates rule conditions once per rule fire (O(conditions))
- Lookup uses the correct map based on trigger type (O(1) map lookup)
- Preferred property tracking adds minimal overhead (few properties, first-wins)
- No significant performance impact expected

## Migration Notes

- No data migration required
- API response shape unchanged (derivationChain already exists)
- Backwards compatible - just more accurate data and new chaining capability
- New rule `derived-senior-prefers-leadership` will start firing for greenfield requests

## Future Extensions

This generalized infrastructure enables future rules like:
- `derived-urgent-prefers-contractors`: Chain from derived start time urgency
- `derived-budget-constrained-prefers-growth`: Chain from derived budget preferences
- Any other multi-hop inference across derived values

## References

- Original issue: User feedback on code walkthrough document
- Code walkthrough: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-inference-engine-code-walkthrough.md`
- Inference engine: `recommender_api/src/services/inference-engine.service.ts`
- Rule adapter: `recommender_api/src/services/rule-engine-adapter.ts`
- Boost rules: `recommender_api/src/config/knowledge-base/inference-rules/boost-rules.config.ts`
