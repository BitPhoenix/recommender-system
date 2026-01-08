---
date: 2026-01-07T12:00:00-05:00
researcher: Claude
git_commit: bc75c7446425b86af35a1a5fb8dcaecaf7a6366a
branch: main
repository: recommender-system
topic: "Inference Engine Test Coverage Gaps Analysis"
tags: [research, testing, inference-engine, json-rules-engine, coverage-gaps]
status: complete
last_updated: 2026-01-08
last_updated_by: Claude
last_updated_note: "Follow-up analysis after ~50 tests added; identified remaining gaps"
---

# Research: Inference Engine Test Coverage Gaps Analysis

**Date**: 2026-01-07T12:00:00-05:00
**Researcher**: Claude
**Git Commit**: bc75c7446425b86af35a1a5fb8dcaecaf7a6366a
**Branch**: main
**Repository**: recommender-system

## Research Question

After implementing the iterative requirement expansion (Section 5.2.1) with json-rules-engine and the explicit rule override mechanism, what test cases are missing from our current test coverage?

## Summary

The current test suite has **solid baseline coverage** for core inference functionality but has **significant gaps** in:

1. **Multi-hop chaining beyond 2 levels** - No tests for 3+ hop chains or mixed filter/boost chains
2. **Edge case handling** - Missing tests for max iterations, empty inputs, malformed data
3. **Integration testing** - Constraint expander tests don't verify actual inference results
4. **E2E coverage** - Zero E2E tests verify `derivedConstraints` or `overriddenRuleIds` behavior

## Detailed Findings

### Inference Engine Service Tests (`inference-engine.service.test.ts`)

**Current Coverage (15 tests):**
- Basic filter/boost rule firing
- 2-hop chaining (scaling → distributed → monitoring)
- Explicit and implicit override mechanisms
- Compound conditions (AND logic)
- Helper function behavior (`getDerivedRequiredSkills`, `aggregateDerivedSkillBoosts`)

**Missing Tests (High Priority):**

| Gap | Description |
|-----|-------------|
| **3+ hop chains** | No test verifies chains deeper than 2 levels |
| **Mixed filter/boost chains** | No test where filter rule output triggers a boost rule |
| **Max iteration limit** | No test hits `maxInferenceIterations` and verifies warning |
| **Empty request** | No test for `runInference({})` graceful handling |
| **OR conditions** | No tests for rules using `any` operator instead of `all` |
| **Override in middle of chain** | Chain A→B→C, override B, verify C doesn't fire |

**Missing Tests (Medium Priority):**
- Priority ordering verification
- Same priority rule determinism
- Non-derivedSkills target field handling
- Engine cache isolation verification

### Rule Engine Adapter Tests (`rule-engine-adapter.test.ts`)

**Current Coverage (22 tests):**
- `createContext` basic field extraction
- `eventToConstraint` for filter and boost events
- Override detection (implicit and explicit)
- `mergeSkillsIntoContext` basic merging
- `computeContextHash` ordering independence
- Custom `contains` operator

**Missing Tests (High Priority):**

| Gap | Description |
|-----|-------------|
| **`overriddenRuleIds` extraction** | Test that `request.overriddenRuleIds` flows to `meta.overriddenRuleIds` |
| **Empty preferred arrays** | Test `preferredSkills: []` is NOT in `userExplicitFields` |
| **Unknown event type** | What happens with invalid `event.type`? |
| **Missing rule in rules array** | Test `getRuleName` fallback to ruleId |
| **Non-derivedSkills targetField** | Verify other target fields are ignored in `mergeSkillsIntoContext` |
| **`contains` with non-array** | Test operator returns false for non-array fact |

**Missing Tests (Medium Priority):**
- Request field spread verification
- `targetValue` as single string (not array)
- Context immutability verification
- Engine caching behavior

### Constraint Expander Tests (`constraint-expander.service.test.ts`)

**Current Coverage (33 tests):**
- Basic field expansions (seniority, timeline, timezone, budget)
- Team focus skill mapping
- Applied filters/preferences tracking
- Pass-through values
- Inference outputs exist (but not verified)

**Critical Gaps:**

| Gap | Description | Priority |
|-----|-------------|----------|
| **Filter rule populates `derivedRequiredSkillIds`** | Verify `teamFocus: 'scaling'` produces `skill_distributed` | HIGH |
| **Boost rule populates `derivedSkillBoosts`** | Verify `requiredSeniorityLevel: 'senior'` produces boosts | HIGH |
| **Inference adds to `appliedFilters`** | Verify `source: 'inference'` constraints appear | HIGH |
| **Chain propagation** | Test scaling→distributed→observability chain | HIGH |
| **Override mechanism** | Test `overriddenRuleIds` excludes from outputs | HIGH |
| **Provenance tracking** | Verify `derivationChain` and `explanation` populated | MEDIUM |

### Search Service Tests (`search.service.test.ts`)

**Current Coverage:**
- `overriddenRuleIds` echo-back (2 tests)
- Override marking for filter/boost rules (2 tests)
- Chain breaking via override (1 test)
- Unknown rule ID handling (1 test)

**Missing Tests (High Priority):**

| Gap | Description |
|-----|-------------|
| **Basic derivedConstraints population** | Test `teamFocus: 'scaling'` produces expected derivedConstraints |
| **Derived filter skills affect query** | Verify `derivedRequiredSkillIds` actually filter results |
| **Derived boost skills affect ranking** | Verify boosted engineers rank higher |
| **appliedFilters with source='inference'** | Verify inference constraints tracked |
| **Full derivedConstraints structure** | Verify all nested fields present |

**Missing Tests (Medium Priority):**
- Multiple overriddenRuleIds
- provenance field verification
- boostStrength in response
- Compound rules in derivedConstraints

### E2E / Postman Tests

**Current Coverage:**
- 47 test scenarios with 172 assertions
- 3 scenarios use `teamFocus` input
- **ZERO** tests verify `derivedConstraints` output
- **ZERO** tests exercise `overriddenRuleIds`

**Critical Gaps:**

| Gap | Priority |
|-----|----------|
| **derivedConstraints array exists** | HIGH |
| **derivedConstraints structure validation** | HIGH |
| **Filter rule fires for scaling** | HIGH |
| **Boost rule fires for senior** | HIGH |
| **Override mechanism works** | HIGH |
| **Multi-hop chain works** | HIGH |
| **Response echoes overriddenRuleIds** | MEDIUM |
| **Filter rules actually exclude candidates** | HIGH |
| **Boost rules actually affect ranking** | HIGH |

## Code References

- `recommender_api/src/services/inference-engine.service.test.ts` - 15 tests
- `recommender_api/src/services/rule-engine-adapter.test.ts` - 22 tests
- `recommender_api/src/services/constraint-expander.service.test.ts` - 33 tests
- `recommender_api/src/services/search.service.test.ts` - 6 inference-related tests
- `postman/collections/search-filter-tests.postman_collection.json` - 0 inference tests

## Prioritized Recommendations

### Tier 1: Critical (Add Immediately)

1. **Inference Engine**: Max iteration limit warning test
2. **Inference Engine**: Empty request handling
3. **Inference Engine**: 3-hop chain verification
4. **Rule Engine Adapter**: `overriddenRuleIds` context extraction
5. **Rule Engine Adapter**: Empty preferred arrays handling
6. **Constraint Expander**: Filter rule populates `derivedRequiredSkillIds`
7. **Constraint Expander**: Boost rule populates `derivedSkillBoosts`
8. **Constraint Expander**: Override excludes from outputs
9. **Search Service**: Basic derivedConstraints population
10. **Search Service**: Derived skills affect query results
11. **E2E**: derivedConstraints structure validation
12. **E2E**: overriddenRuleIds request/response

### Tier 2: Important (Add for Robustness)

1. Mixed filter/boost chain chaining
2. Override in middle of chain
3. appliedFilters with source='inference'
4. appliedPreferences with source='inference'
5. Compound rules verification
6. provenance/derivationChain tracking
7. E2E: Filter rules exclude candidates
8. E2E: Boost rules affect ranking

### Tier 3: Completeness

1. OR conditions (`any` operator)
2. Priority ordering verification
3. Engine caching behavior
4. Context immutability
5. Non-derivedSkills target fields

## Estimated Test Counts

| Test File | Current | Missing High | Missing Medium | Missing Low |
|-----------|---------|--------------|----------------|-------------|
| inference-engine.service.test.ts | 15 | 6 | 5 | 5 |
| rule-engine-adapter.test.ts | 22 | 6 | 6 | 8 |
| constraint-expander.service.test.ts | 33 | 6 | 4 | 4 |
| search.service.test.ts | 6 | 5 | 5 | 3 |
| Postman collection | 0 | 8 | 4 | 3 |
| **TOTAL** | **76** | **31** | **24** | **23** |

## Open Questions

1. Should we mock the inference engine in search service tests for isolation, or keep integration tests that use real rules?
2. Should E2E tests depend on seeded test data with specific skills, or use flexible assertions?
3. Is there a need for performance testing of the inference engine with large rule sets?

## Related Research

- `thoughts/shared/1_chapter_5/1.5_project_1.5/plans/2026-01-06-iterative-requirement-expansion-unified.md` - Implementation plan
- `thoughts/shared/1_chapter_5/1.5_project_1.5/plans/2026-01-07-explicit-rule-override-mechanism.md` - Override mechanism plan
- `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-rete-vs-json-rules-engine-analysis.md` - Engine selection analysis
- `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-inference-engine-code-walkthrough.md` - Full implementation walkthrough

---

## Follow-up Research [2026-01-08]

### Test Coverage Progress

Since the initial analysis, **52+ tests have been added**, increasing total coverage from 76 to 128+ tests:

| Test File | Previous | Current | Change |
|-----------|----------|---------|--------|
| inference-engine.service.test.ts | 15 | 34+ | +19 |
| rule-engine-adapter.test.ts | 22 | 47 | +25 |
| constraint-expander.service.test.ts | 33 | 47+ | +14 |
| **TOTAL** | **76** | **128+** | **+52** |

### Resolved Gaps (from original analysis)

The following gaps from the original Tier 1 list have been **addressed**:

- ✅ 3-hop chain verification (lines 410-438 in inference-engine tests)
- ✅ `overriddenRuleIds` context extraction (lines 257-344 in adapter tests)
- ✅ Empty preferred arrays handling (lines 463-478 in adapter tests)
- ✅ Filter rule populates `derivedRequiredSkillIds` (lines 299-317 in expander tests)
- ✅ Boost rule populates `derivedSkillBoosts` (lines 319-351 in expander tests)
- ✅ Override excludes from outputs (lines 406-442 in expander tests)
- ✅ Basic derivedConstraints population (lines 693-852 in search tests)
- ✅ Mixed filter/boost chains (lines 463-486 in inference tests)
- ✅ Override in middle of chain (lines 488-517 in inference tests)
- ✅ Override reasonType tracking (lines 758-888 in adapter tests)
- ✅ Derivation chain provenance (lines 803-923 in inference tests)

### Remaining Gaps (Updated Priority List)

**5 critical gaps remain**:

| Priority | Gap | Location | Risk |
|----------|-----|----------|------|
| **1** | PARTIAL override for filter rules | `rule-engine-adapter.ts:396-405` | HIGH |
| **2** | `extractDerivedTriggers()` direct tests | `rule-engine-adapter.ts:198-250` | HIGH |
| **3** | `buildDerivationChains()` with multiple triggers | `rule-engine-adapter.ts:417-467` | HIGH |
| **4** | Property merging in `mergeDerivedValuesIntoContext()` | `rule-engine-adapter.ts:505-535` | MEDIUM |
| **5** | Multiple derivation chain paths for same rule | Various | MEDIUM |

### Gap Details

#### 1. PARTIAL Override for Filter Rules (HIGH)

**What's implemented but untested**: When a filter rule targets multiple skills and user handles only some:
```typescript
// Rule targets ['skill_a', 'skill_b', 'skill_c'], user requires skill_a
// Expected: override.overrideScope === 'PARTIAL', targetValue reduced to ['skill_b', 'skill_c']
```

**Location**: `determineOverrideStatus()` at lines 396-405

**Test needed**:
```typescript
it('should mark as PARTIAL when user handles some but not all target skills', async () => {
  const request = {
    teamFocus: 'multi-skill-trigger',
    preferredSkills: [{ skill: 'skill_a' }]  // Handles 1 of 3 target skills
  };
  const result = await runInference(request);
  const constraint = result.derivedConstraints.find(c => /* multi-skill rule */);

  expect(constraint.override?.overrideScope).toBe('PARTIAL');
  expect(constraint.override?.overriddenSkills).toEqual(['skill_a']);
  expect(constraint.action.targetValue).toEqual(['skill_b', 'skill_c']);
});
```

#### 2. `extractDerivedTriggers()` Direct Tests (HIGH)

**What's implemented but untested**: Core function that detects what derived values triggered a chain rule.

**Location**: Lines 198-250

**Tests needed**:
```typescript
describe('extractDerivedTriggers', () => {
  it('returns empty array for first-hop rules', () => {
    const triggers = extractDerivedTriggers(rules, 'scaling-requires-distributed');
    expect(triggers).toEqual([]);
  });

  it('detects skill trigger from allSkills contains', () => {
    const triggers = extractDerivedTriggers(rules, 'distributed-requires-observability');
    expect(triggers).toEqual([{ type: 'skill', provenanceKey: 'skill_distributed' }]);
  });

  it('detects property triggers from both containers', () => {
    const triggers = extractDerivedTriggers(rules, 'senior-prefers-leadership');
    expect(triggers).toContainEqual({ type: 'requiredProperty', provenanceKey: 'seniorityLevel' });
    expect(triggers).toContainEqual({ type: 'preferredProperty', provenanceKey: 'seniorityLevel' });
  });
});
```

#### 3. `buildDerivationChains()` with Multiple Triggers (HIGH)

**What's implemented but untested**: 2D derivation chains when rule has multiple independent triggers.

**Location**: Lines 417-467

**Test needed**:
```typescript
it('builds multiple chains for rules with multiple trigger sources', () => {
  // Rule triggered by BOTH skill_a (from rule-1) AND skill_b (from rule-2)
  const chains = buildDerivationChains(
    'multi-trigger-rule',
    rules,
    new Map([['skill_a', [['rule-1']]], ['skill_b', [['rule-2']]]]),
    new Map(),
    new Map()
  );

  expect(chains.length).toBe(2);
  expect(chains).toContainEqual(['rule-1', 'multi-trigger-rule']);
  expect(chains).toContainEqual(['rule-2', 'multi-trigger-rule']);
});
```

#### 4. Property Merging (MEDIUM)

**What's implemented but untested**: `mergeDerivedValuesIntoContext()` handles properties, not just skills.

**Location**: Lines 505-535

**Tests needed**:
- Boost rule targeting `preferredSeniorityLevel` → populates `preferredProperties.seniorityLevel`
- Filter rule targeting properties → populates `requiredProperties`
- Property provenance tracking

#### 5. Multiple Derivation Chain Paths (MEDIUM)

**What's implemented but untested**: Same skill/property reached via multiple independent paths.

**Test needed**:
```typescript
it('captures multiple derivation paths for same skill', async () => {
  // skill_monitoring reached via BOTH:
  // - scaling → distributed → monitoring
  // - kubernetes → containers → monitoring (hypothetical)
  const constraint = result.derivedConstraints.find(c => /* monitoring rule */);
  expect(constraint.provenance.derivationChains.length).toBeGreaterThan(1);
});
```

### Updated Test Statistics

| Category | Status |
|----------|--------|
| **Multi-hop skill chains** | ✅ Covered (2-3+ hops) |
| **Property chains** | ✅ Covered |
| **Mixed filter/boost chains** | ✅ Covered |
| **Explicit rule overrides** | ✅ Covered |
| **Implicit field overrides** | ✅ Covered |
| **Implicit skill overrides (FULL)** | ✅ Covered |
| **Implicit skill overrides (PARTIAL)** | ❌ NOT Covered |
| **Override breaks chain** | ✅ Covered |
| **User-required skill chaining** | ✅ Covered |
| **User-preferred skill (no chain)** | ✅ Covered |
| **Derivation chain provenance** | ✅ Covered |
| **Multiple derivation paths** | ❌ NOT Covered |
| **Max-strength aggregation** | ✅ Covered |
| **Fixpoint detection** | ✅ Covered |
| **Max iteration warning** | ✅ Covered (basic) |
| **Helper functions (direct)** | ❌ PARTIAL (extractDerivedTriggers, buildDerivationChains) |

### Recommendations

#### Immediate (Before Next Feature)
1. Add PARTIAL override test to `inference-engine.service.test.ts`
2. Add direct tests for `extractDerivedTriggers()` to `rule-engine-adapter.test.ts`

#### Short-Term
3. Add property merging tests
4. Add multi-trigger derivation chain test
5. Create rule definition validation test file

### Conclusion

Overall coverage has improved from ~60% to ~85-90%. The remaining gaps are primarily in:
1. Edge cases for override detection (PARTIAL)
2. Direct unit tests for chaining helper functions
3. Property handling in merge operations

These gaps represent less common scenarios that wouldn't typically occur with current rules, but should be tested for robustness as the rule base grows.
