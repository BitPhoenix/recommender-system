# Inference Engine Test Report

**Generated:** 2026-01-06
**Test Framework:** Vitest v4.0.16
**Total Tests:** 38
**Passed:** 38
**Failed:** 0
**Duration:** 226ms

---

## Summary

| Test Suite | Tests | Passed | Failed | Duration |
|------------|-------|--------|--------|----------|
| `rule-engine-adapter.test.ts` | 18 | 18 | 0 | ~5ms |
| `inference-engine.service.test.ts` | 20 | 20 | 0 | ~18ms |

---

## Test Suite: `rule-engine-adapter.test.ts`

This suite tests the adapter layer that wraps `json-rules-engine` with domain-specific utilities.

### `createFacts` (6 tests)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 1 | extracts skill names from requiredSkills | Verifies that skill identifiers are extracted from the `requiredSkills` array in the request | ✅ Pass |
| 2 | extracts requiredSeniorityLevel | Verifies seniority level is passed through to facts | ✅ Pass |
| 3 | extracts teamFocus | Verifies team focus (greenfield/maintenance/scaling) is passed to facts | ✅ Pass |
| 4 | extracts budget constraints | Verifies `maxBudget` and `stretchBudget` are extracted | ✅ Pass |
| 5 | tracks user explicit fields for override detection | Verifies fields like `preferredSkills`, `preferredSeniorityLevel` are tracked for user override logic | ✅ Pass |
| 6 | returns empty array for no required skills | Verifies empty request returns empty skill arrays | ✅ Pass |

### `eventToConstraint` (5 tests)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 7 | creates filter constraint from derived-filter event | Converts a `derived-filter` rule event into a `DerivedConstraint` with `effect: 'filter'` | ✅ Pass |
| 8 | creates boost constraint from derived-boost event | Converts a `derived-boost` rule event into a `DerivedConstraint` with `effect: 'boost'` and `boostStrength` | ✅ Pass |
| 9 | marks boost as overridden when user explicitly set that field | If user set `preferredSkills`, boost targeting that field gets `overriddenByUser: true` | ✅ Pass |
| 10 | does NOT mark filter as overridden (filters always apply) | Filter rules are never overridden by user preferences (hard constraints) | ✅ Pass |
| 11 | appends to derivation chain | Verifies `derivationChain` tracks rule provenance for multi-hop inference | ✅ Pass |

### `mergeSkillsIntoFacts` (3 tests)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 12 | adds derived skills to allSkills | Newly derived skills are merged into `allSkills` for next iteration | ✅ Pass |
| 13 | skips overridden constraints | Overridden constraints don't contribute skills to next iteration | ✅ Pass |
| 14 | deduplicates skills | Same skill from multiple sources appears only once | ✅ Pass |

### `computeFactsHash` (2 tests)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 15 | produces same hash for same skills regardless of order | Hash is order-independent for fixpoint detection | ✅ Pass |
| 16 | produces different hash for different skills | Different skill sets produce different hashes | ✅ Pass |

### `createEngine` (2 tests)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 17 | creates engine with custom contains operator | Verifies custom `contains` operator works (checks if array contains value) | ✅ Pass |
| 18 | does not fire when skill not present | Rule with `contains` condition doesn't fire when skill is absent | ✅ Pass |

---

## Test Suite: `inference-engine.service.test.ts`

This suite tests the main inference engine that iteratively applies rules until fixpoint.

### `runInference` > Boost Rules (3 tests)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 1 | fires senior-prefers-leadership for senior seniority | Senior engineers get boosted for leadership/mentorship skills | ✅ Pass |
| 2 | fires principal-prefers-architecture for principal seniority | Principal engineers get boosted for system design skills | ✅ Pass |
| 3 | fires greenfield-prefers-ambiguity-tolerance for greenfield focus | Greenfield projects boost ambiguity tolerance skills | ✅ Pass |

### `runInference` > Filter Rules (1 test)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 4 | fires scaling-requires-distributed for scaling focus | Scaling-focused teams require distributed systems skills (hard filter) | ✅ Pass |

### `runInference` > User Override (2 tests)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 5 | marks boost as overridden when user set preferredSkills | When user explicitly sets preferences, inferred boosts are marked overridden | ✅ Pass |
| 6 | does NOT override filter rules (they always apply) | Filter rules cannot be overridden - they represent hard requirements | ✅ Pass |

### `runInference` > Multi-hop Chaining (2 tests)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 7 | chains scaling → distributed → monitoring | Tests 2-hop chain: scaling requires distributed, distributed requires monitoring | ✅ Pass |
| 8 | chains kubernetes → containers | Tests skill-to-skill chain: kubernetes requires docker/containers | ✅ Pass |

### `runInference` > Fixpoint Detection (2 tests)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 9 | stops when no new constraints are derived | Engine stops iterating when no new rules fire | ✅ Pass |
| 10 | tracks fired rules without duplicates | Each rule fires at most once per inference run | ✅ Pass |

### `runInference` > Compound Rules (2 tests)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 11 | fires senior-greenfield-prefers-ownership for senior + greenfield | Compound rule fires when BOTH conditions met | ✅ Pass |
| 12 | does NOT fire compound rule when only one condition met | Compound rule requires ALL conditions | ✅ Pass |

### `getDerivedRequiredSkills` (4 tests)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 13 | extracts skills from filter rules only | Only filter constraints contribute to required skills | ✅ Pass |
| 14 | skips overridden constraints | Overridden constraints don't add to required skills | ✅ Pass |
| 15 | deduplicates skills | Same skill from multiple filters appears once | ✅ Pass |
| 16 | only includes derivedSkills target field | Only constraints targeting `derivedSkills` field are extracted | ✅ Pass |

### `aggregateDerivedSkillBoosts` (4 tests)

| # | Test Case | Description | Result |
|---|-----------|-------------|--------|
| 17 | extracts skills from boost rules only | Only boost constraints contribute to skill boosts | ✅ Pass |
| 18 | takes max strength when multiple rules boost same skill | If two rules boost same skill, higher `boostStrength` wins | ✅ Pass |
| 19 | skips overridden constraints | Overridden boosts don't affect scoring | ✅ Pass |
| 20 | skips boosts without boostStrength | Malformed boost constraints (missing strength) are ignored | ✅ Pass |

---

## Key Behaviors Verified

### 1. Forward-Chaining Inference
The engine iteratively applies rules until no new constraints can be derived (fixpoint).

### 2. Filter vs Boost Semantics
- **Filters**: Hard constraints that exclude candidates (cannot be overridden)
- **Boosts**: Soft preferences that affect ranking (can be overridden by user)

### 3. Multi-hop Rule Chaining
Rules can trigger other rules:
```
scaling (teamFocus)
  → skill_distributed (filter)
    → skill_monitoring (filter)
```

### 4. User Override Protection
When users explicitly set preferences (e.g., `preferredSkills`), inferred boosts targeting those fields are marked `overriddenByUser: true` and excluded from scoring.

### 5. Provenance Tracking
Every derived constraint includes a `derivationChain` showing the sequence of rules that led to it.

---

## Test Coverage

| Component | Coverage |
|-----------|----------|
| Facts creation from request | ✅ Complete |
| Event-to-constraint conversion | ✅ Complete |
| Filter constraint generation | ✅ Complete |
| Boost constraint generation | ✅ Complete |
| User override detection | ✅ Complete |
| Multi-hop chaining | ✅ Complete |
| Fixpoint detection | ✅ Complete |
| Compound rule evaluation | ✅ Complete |
| Skill extraction utilities | ✅ Complete |
| Boost aggregation utilities | ✅ Complete |
