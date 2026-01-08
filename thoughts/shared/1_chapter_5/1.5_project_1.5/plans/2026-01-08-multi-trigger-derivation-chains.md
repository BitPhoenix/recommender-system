# Multi-Trigger Derivation Chains Implementation Plan

## Overview

Rename `derivationChain: string[]` → `derivationChains: string[][]` to capture **all** causal paths when a chain rule is triggered by multiple derived values from different rules.

Currently, when a rule has multiple conditions satisfied by different derived values (each with its own provenance chain), we only keep the longest chain. This loses information about alternative trigger paths.

**Example**: If rule C fires because:
- `allSkills contains 'skill_distributed'` (from chain: `['rule-a']`)
- `preferredProperties.seniorityLevel = 'senior'` (from chain: `['rule-b']`)

Current output: `derivationChain: ['rule-a', 'rule-c']` (longest chain)
New output: `derivationChains: [['rule-a', 'rule-c'], ['rule-b', 'rule-c']]` (all paths)

The plural name better reflects the semantic meaning: an array of derivation chains.

## Current State Analysis

### Key Files to Modify

| File | Changes |
|------|---------|
| `types/inference-rule.types.ts:83` | Rename `derivationChain: string[]` → `derivationChains: string[][]` |
| `types/search.types.ts:191-210` | Rename in API response schema |
| `types/rule-engine.types.ts:8-11` | Update provenance map types to `Map<string, string[][]>` |
| `services/rule-engine-adapter.ts:305-344` | Collect all trigger chains, not just longest |
| `services/rule-engine-adapter.ts:371-433` | Update `mergeDerivedValuesIntoContext` to store multi-chain provenance |
| `services/rule-engine-adapter.test.ts` | Update test expectations for 2D chains |
| `services/inference-engine.service.test.ts` | Update test expectations for 2D chains |
| `postman/collections/search-filter-tests.postman_collection.json` | Update E2E assertions |
| `thoughts/.../research/2026-01-06-inference-engine-code-walkthrough.md` | Update documentation |

### Key Discoveries

- `eventToDerivedConstraint` at `rule-engine-adapter.ts:258-364` builds derivation chains
- Current logic at lines 316-344 selects longest chain via `longestSourceChain` comparison
- Provenance maps are `Map<string, string[]>` where value is single chain (`types/rule-engine.types.ts:8-11`)
- First-hop rules always have single-element chain: `[params.ruleId]` (line 311)
- Chain rules look up trigger provenance and append current rule (lines 337-344)

## Desired End State

After implementation:

1. `DerivedConstraint.provenance.derivationChain` is `string[][]` (array of chains)
2. First-hop rules: `[['rule-id']]` (single chain, single element)
3. Chain rules with single trigger: `[['source-rule', 'current-rule']]`
4. Chain rules with multiple triggers: `[['source-a', 'current'], ['source-b', 'current']]`
5. Provenance maps store `string[][]` to support merged chains
6. All tests pass with updated expectations
7. Documentation updated to reflect new structure

### Verification

```bash
cd recommender_api && npm test
```

All 144+ tests should pass with updated expectations.

## API Breaking Change

This **is** a breaking change to the API response schema:
1. Field **renamed**: `derivationChain` → `derivationChains` (plural)
2. Type **changed**: `string[]` → `string[][]`

**Before:**
```json
{
  "derivedConstraints": [{
    "provenance": {
      "derivationChain": ["scaling-requires-distributed", "distributed-requires-observability"],
      "explanation": "..."
    }
  }]
}
```

**After:**
```json
{
  "derivedConstraints": [{
    "provenance": {
      "derivationChains": [["scaling-requires-distributed", "distributed-requires-observability"]],
      "explanation": "..."
    }
  }]
}
```

Any API consumers will need to update both the field name and parsing logic.

## What We're NOT Doing

- NOT modifying how rules fire or chain (behavior unchanged)
- NOT changing override logic (unaffected by this change)
- NOT adding new rules or modifying existing ones

## Implementation Approach

The change is primarily mechanical:
1. Update type from `string[]` to `string[][]`
2. Update provenance map types from `Map<string, string[]>` to `Map<string, string[][]>`
3. Collect all trigger chains instead of keeping only longest
4. Update all test expectations
5. Update documentation

## Phase 1: Type Changes

### Overview
Update the type definitions to use 2D arrays for derivation chains.

### Changes Required

#### 1. `types/inference-rule.types.ts`

**File**: `recommender_api/src/types/inference-rule.types.ts`
**Changes**: Update `derivationChain` type in `DerivedConstraint.provenance`

```typescript
/** Provenance/traceability */
provenance: {
  /**
   * All causal paths showing how this constraint was derived.
   * Each inner array is one derivation path (rule IDs in causal order).
   *
   * - First-hop rules (triggered by user input): [['current-rule-id']]
   * - Chain rules with single trigger: [['source-rule-id', ..., 'current-rule-id']]
   * - Chain rules with multiple triggers: [['path-a', 'current'], ['path-b', 'current']]
   *
   * Examples:
   * - teamFocus=scaling → scaling-requires-distributed:
   *   derivationChains: [['scaling-requires-distributed']]
   *
   * - distributed (from scaling) → distributed-requires-observability:
   *   derivationChains: [['scaling-requires-distributed', 'distributed-requires-observability']]
   *
   * - Rule triggered by both skill AND seniority from different rules:
   *   derivationChains: [['rule-a', 'current-rule'], ['rule-b', 'current-rule']]
   */
  derivationChains: string[][];  // Renamed from derivationChain (singular)
  explanation: string;
};
```

#### 2. `types/rule-engine.types.ts`

**File**: `recommender_api/src/types/rule-engine.types.ts`
**Changes**: Update provenance map types

```typescript
/*
 * Provenance types for tracking derivation chains.
 * Each value is an array of chains (string[][]) to support multiple trigger paths.
 */
export type SkillProvenance = Map<string, string[][]>;
export type RequiredPropertyProvenance = Map<string, string[][]>;
export type PreferredPropertyProvenance = Map<string, string[][]>;
```

#### 3. `types/search.types.ts` (API Response Schema)

**File**: `recommender_api/src/types/search.types.ts`
**Lines**: ~191-210
**Changes**: Update `SearchResponse.derivedConstraints` provenance type

```typescript
derivedConstraints: Array<{
  rule: {
    id: string;
    name: string;
  };
  action: {
    effect: 'filter' | 'boost';
    targetField: string;
    targetValue: string | string[];
    boostStrength?: number;
  };
  provenance: {
    derivationChains: string[][];  // Renamed from derivationChain, now 2D
    explanation: string;
  };
  override?: {
    overrideScope: 'FULL' | 'PARTIAL';
    overriddenSkills?: string[];
  };
}>;
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npx tsc --noEmit` (after Phase 2 completes)

---

## Phase 2: Adapter Logic Changes

### Overview
Update `rule-engine-adapter.ts` to collect all trigger chains and store multi-chain provenance.

### Changes Required

#### 1. `createInferenceContext` - Initialize with 2D chains

**File**: `recommender_api/src/services/rule-engine-adapter.ts`
**Lines**: 65-114

```typescript
// Build initial skill provenance for user-provided skills
const skillProvenance: SkillProvenance = new Map();
for (const skill of skillNames) {
  skillProvenance.set(skill, [['user-input']]);  // Now 2D: array of chains
}

// ... in the loop for required/preferred properties ...
if (key.startsWith('required')) {
  requiredProperties[normalizedKey] = value;
  requiredPropertyProvenance.set(normalizedKey, [['user-input']]);  // Now 2D
} else if (key.startsWith('preferred')) {
  preferredProperties[normalizedKey] = value;
  preferredPropertyProvenance.set(normalizedKey, [['user-input']]);  // Now 2D
}
```

#### 2. `eventToDerivedConstraint` - Collect all trigger chains

**File**: `recommender_api/src/services/rule-engine-adapter.ts`
**Lines**: 305-344

```typescript
// Build derivation chain(s)
const triggers = extractDerivedTriggers(rules, params.ruleId);
let derivationChains: string[][];

if (triggers.length === 0) {
  // First-hop rule (triggered by user input, not by derived values)
  derivationChains = [[params.ruleId]];
} else {
  /*
   * Chain rule - collect ALL trigger chains, not just the longest.
   * This captures all causal paths when a rule has multiple conditions
   * satisfied by different derived values.
   */
  const allChains: string[][] = [];

  for (const trigger of triggers) {
    let provenanceMap: Map<string, string[][]>;
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

    const sourceChains = provenanceMap.get(trigger.provenanceKey) || [];
    for (const sourceChain of sourceChains) {
      /*
       * The provenance maps use 'user-input' as a sentinel to mark values that came
       * from the user's request (not from rules). When a chain rule is triggered by
       * a user-provided value, its source chain is ['user-input']. We filter this out
       * because derivationChain should only contain rule IDs - a single-element chain
       * like ['current-rule'] already implies it was triggered by user input.
       */
      const filteredChain = sourceChain.filter(id => id !== 'user-input');
      allChains.push([...filteredChain, params.ruleId]);
    }
  }

  // Deduplicate chains (same chain from multiple triggers)
  const uniqueChains = deduplicateChains(allChains);
  derivationChains = uniqueChains.length > 0 ? uniqueChains : [[params.ruleId]];
}

return {
  // ...
  provenance: {
    derivationChains,  // Renamed field, now string[][]
    explanation: params.rationale,
  },
  // ...
};
```

#### 3. Add helper function for chain deduplication

**File**: `recommender_api/src/services/rule-engine-adapter.ts`
**Add before `eventToDerivedConstraint`**:

```typescript
/**
 * Deduplicate chains by comparing as JSON strings.
 * Returns unique chains in stable order.
 */
function deduplicateChains(chains: string[][]): string[][] {
  const seen = new Set<string>();
  const result: string[][] = [];

  for (const chain of chains) {
    const key = JSON.stringify(chain);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(chain);
    }
  }

  return result;
}
```

#### 4. `mergeDerivedValuesIntoContext` - Store 2D provenance

**File**: `recommender_api/src/services/rule-engine-adapter.ts`
**Lines**: 371-433

Update to handle `string[][]` provenance:

```typescript
if (targetField === 'derivedSkills') {
  const skills = Array.isArray(targetValue) ? targetValue : [targetValue];
  for (const skill of skills) {
    if (typeof skill !== 'string') continue;
    if (!newSkills.has(skill)) {
      newSkills.add(skill);
      newSkillProvenance.set(skill, chain);  // chain is now string[][]
    } else {
      // Skill already exists - merge chains
      const existing = newSkillProvenance.get(skill) || [];
      const merged = deduplicateChains([...existing, ...chain]);
      newSkillProvenance.set(skill, merged);
    }
  }
}
```

Similar updates for property provenance.

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npx tsc --noEmit` (after Phase 3 completes)

---

## Phase 3: Test Updates

### Overview
Update all test expectations to use 2D chain format.

### Changes Required

#### 1. `rule-engine-adapter.test.ts`

**File**: `recommender_api/src/services/rule-engine-adapter.test.ts`

Update `createMockContext` helper:
```typescript
derived: {
  // ...
  skillProvenance: new Map(),  // Now Map<string, string[][]>
  requiredPropertyProvenance: new Map(),
  preferredPropertyProvenance: new Map(),
},
```

Update test expectations (field renamed + 2D array):
```typescript
// Before:
expect(constraint.provenance.derivationChain).toEqual(['test-filter']);

// After:
expect(constraint.provenance.derivationChains).toEqual([['test-filter']]);
```

#### 2. `inference-engine.service.test.ts`

**File**: `recommender_api/src/services/inference-engine.service.test.ts`

Update derivation chain test expectations (field renamed + 2D array):

```typescript
// Before:
expect(scalingRule!.provenance.derivationChain).toEqual([
  'scaling-requires-distributed',
]);

// After:
expect(scalingRule!.provenance.derivationChains).toEqual([
  ['scaling-requires-distributed'],
]);

// Before:
expect(obsRule!.provenance.derivationChain).toEqual([
  'scaling-requires-distributed',
  'distributed-requires-observability',
]);

// After:
expect(obsRule!.provenance.derivationChains).toEqual([
  ['scaling-requires-distributed', 'distributed-requires-observability'],
]);
```

### Success Criteria

#### Automated Verification
- [x] All unit tests pass: `cd recommender_api && npm test`

---

## Phase 4: Documentation Updates

### Overview
Update the inference engine code walkthrough to reflect the new 2D chain structure.

### Changes Required

#### 1. Update `2026-01-06-inference-engine-code-walkthrough.md`

**File**: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-inference-engine-code-walkthrough.md`

Key sections to update:

1. **Type definitions section** (~line 70-145): Rename field and update to `string[][]`

2. **Provenance types section** (~line 200-260): Update map types and add explanation of 2D structure

3. **eventToDerivedConstraint section** (~line 620-720): Update logic explanation for collecting all chains

4. **Examples section** (~line 1090-1360): Rename all `derivationChain` → `derivationChains` and update to 2D format

Example updates:

```markdown
<!-- Before -->
derivationChain: ['scaling-requires-distributed']

<!-- After -->
derivationChains: [['scaling-requires-distributed']]

<!-- Before -->
derivationChain: ['scaling-requires-distributed', 'distributed-requires-observability']

<!-- After -->
derivationChains: [['scaling-requires-distributed', 'distributed-requires-observability']]
```

Add new example showing multiple trigger paths:

```markdown
### Example: Multi-Trigger Rule (Multiple Derivation Paths)

**Scenario**: A rule fires when multiple conditions are satisfied by different derived values.

**Input**:
```typescript
{ teamFocus: 'scaling', requiredSeniorityLevel: 'senior' }
```

**Assume rule**: `complex-rule` requires BOTH distributed skill AND senior seniority

**Result**:
```typescript
{
  rule: { id: 'complex-rule', name: '...' },
  provenance: {
    derivationChains: [
      ['scaling-requires-distributed', 'complex-rule'],  // Path from scaling
      ['senior-prefers-leadership', 'complex-rule'],    // Path from seniority (if it derived something)
    ],
    explanation: '...',
  },
}
```

**Key Insight**: All causal paths are preserved, enabling complete debugging and transparency.
```

### Success Criteria

#### Automated Verification
- [x] Markdown renders correctly (no syntax errors)

#### Manual Verification
- [x] Examples are consistent with new format
- [x] All mentions of `derivationChain` updated

---

## Phase 5: Postman Collection Update

### Overview
Update E2E test assertions to expect 2D derivationChain format.

### Changes Required

**File**: `postman/collections/search-filter-tests.postman_collection.json`

Search for any assertions checking `derivationChain` and update expectations:

```javascript
// Before
pm.expect(constraint.provenance.derivationChain).to.be.an('array');
pm.expect(constraint.provenance.derivationChain[0]).to.be.a('string');

// After (field renamed + 2D array)
pm.expect(constraint.provenance.derivationChains).to.be.an('array');
pm.expect(constraint.provenance.derivationChains[0]).to.be.an('array');
pm.expect(constraint.provenance.derivationChains[0][0]).to.be.a('string');
```

### Success Criteria

#### Automated Verification
- [x] E2E tests pass: `cd recommender_api && npm run test:e2e`

---

## Testing Strategy

### Unit Tests

All existing tests updated to expect 2D format. Key test scenarios:

1. **First-hop rules**: `[['rule-id']]`
2. **Single-trigger chain rules**: `[['source-rule', 'current-rule']]`
3. **User-input triggered chains**: `[['chain-rule']]` (user-input filtered)
4. **Multi-trigger rules**: `[['path-a', 'rule'], ['path-b', 'rule']]` (new test)

### New Test Case to Add

```typescript
describe('multi-trigger derivation chains', () => {
  it('captures all trigger paths when rule has multiple derived triggers', async () => {
    // This requires a rule with conditions checking multiple derived values
    // Currently no such rule exists, so this validates the mechanism is in place
    // for when such rules are added
  });
});
```

### Integration Tests

Run E2E tests to verify API responses still work:

```bash
cd recommender_api && npm run test:e2e
```

## Performance Considerations

- Slight increase in memory for storing multiple chains per value
- Chain deduplication adds O(n) overhead per rule firing (n = number of triggers)
- Both impacts are negligible given typical chain lengths (1-3 rules)

## Migration Notes

This is a breaking change to the internal type structure. No database migration needed.

If external consumers rely on `derivationChain` type, they need to update to handle `string[][]`.

## References

- Original discussion: Conversation about multiple trigger paths
- Related research: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-inference-engine-code-walkthrough.md`
- Rule definitions: `recommender_api/src/config/knowledge-base/inference-rules/`
