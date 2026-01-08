# Iterative Requirement Expansion with json-rules-engine - Unified Plan

## Overview

Implement Section 5.2.1's iterative requirement expansion using [json-rules-engine](https://www.npmjs.com/package/json-rules-engine). This transforms our one-pass constraint expander into a forward-chaining inference engine that iteratively applies rules until no new constraints can be derived.

**Key Benefits of json-rules-engine**:
- Rules are JSON-serializable (enables DB storage, dynamic loading later)
- Well-documented industry-standard pattern
- Built-in operators reduce custom code
- ~248k weekly npm downloads - mature and maintained

## Theoretical Grounding (Section 5.2.1)

This implementation directly maps to the textbook's description of iterative requirement expansion in constraint-based recommender systems (Section 5.2.1, page 175).

### Mapping: Textbook → Implementation

| Textbook Concept | Implementation |
|-----------------|----------------|
| Customer requirements/personal attributes | `SearchFilterRequest` → `InferenceFacts` via `createFacts()` |
| Rule antecedents | `conditions.all` in json-rules-engine rules |
| Rule consequents | `event.params.targetValue` (derived skills/constraints) |
| Knowledge base of rules | `inferenceRules` config array |
| Iterate until no new conditions | `while (iteration < maxIterations)` with hash-based fixpoint |
| Map to product domain constraints | Derived skills → Cypher `WHERE` clauses on engineers |
| Conjunctive normal form query | Cypher `AND` clauses |

### Algorithm Correspondence

**Textbook example (real estate)**:
```
Family-Size=6 → Min-Bedrooms≥3 → Bedrooms≥3, Price≥100,000
             → Min-Bathrooms≥2 → Bathrooms≥2
```

**Our implementation (engineer matching)**:
```
teamFocus=scaling → skill_distributed → skill_monitoring
                                      → skill_tracing
```

Both demonstrate **multi-hop forward chaining**: check current state against rule antecedents, fire matching rules to add consequents, repeat with expanded state, stop at fixpoint.

### Key Textbook Quote

> "Note that the approach essentially maps all customer attribute constraints and requirement attribute constraints to constraints in the product domain."

Our implementation does exactly this: `teamFocus=scaling` (customer attribute) → `skill_distributed` required (product domain constraint on engineers).

### Extensions Beyond Basic Theory

| Extension | Purpose | Textbook Basis |
|-----------|---------|----------------|
| **Filter vs Boost** | Hard constraints vs ranking preferences | Extends 5.2 with utility concepts |
| **User override** | Explicit preferences block inferred boosts | Practical UX enhancement |
| **Provenance chain** | Track derivation for explanations | Supports Section 5.5 (explanation) |
| **Max iterations** | Prevent infinite loops | Standard implementation safeguard |

The filter/boost distinction combines constraint-based filtering (Section 5.2) with utility-based ranking. This hybrid approach is common in modern recommender systems and doesn't violate the theoretical foundation—it extends it.

## Current State Analysis

The current implementation uses **one-pass, sequential constraint expansion**:
- `constraint-expander.service.ts:89-135` - Main `expandSearchCriteria()` function
- `constraint-expander.service.ts:25-72` - `ExpandedSearchCriteria` interface definition
- `config/knowledge-base/` - Modular config files with static mappings
- No rule chaining: results of one expansion don't trigger other rules

## Desired End State

A forward-chaining inference engine that:
1. **Iteratively expands constraints** - Apply rules until fixpoint (no new constraints)
2. **Uses filter/boost semantics** - Filter rules exclude candidates; boost rules affect ranking
3. **Respects user intent** - Explicit user input overrides inferred boosts
4. **Explains reasoning** - Track provenance chain for each derived constraint
5. **Prevents infinite loops** - Max 10 iterations

## Architecture

```
SearchFilterRequest
       │
       ▼
┌──────────────────┐
│  createFacts()   │  ← Convert request to almanac facts
└──────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│         Iteration Loop (max 10)          │
│  ┌────────────────────────────────────┐  │
│  │     json-rules-engine.run()       │  │
│  │  - Evaluates all rules             │  │
│  │  - Fires matching events           │  │
│  └────────────────────────────────────┘  │
│              │                            │
│              ▼                            │
│  ┌────────────────────────────────────┐  │
│  │    eventToConstraint()             │  │
│  │  - Convert events to domain types  │  │
│  │  - Check user overrides            │  │
│  └────────────────────────────────────┘  │
│              │                            │
│              ▼                            │
│  ┌────────────────────────────────────┐  │
│  │    mergeSkillsIntoFacts()          │  │
│  │  - Add derived skills for chaining │  │
│  └────────────────────────────────────┘  │
│              │                            │
│              ▼                            │
│       fixpoint? → break                   │
└──────────────────────────────────────────┘
       │
       ▼
InferenceResult { derivedConstraints, firedRules, ... }
```

## Design Decisions

### Decision 1: Filter vs Boost Based on Domain Semantics

Each rule declares its effect based on what it means in the domain:

| Type | Event Type | Example | Behavior |
|------|------------|---------|----------|
| **Filter** | `derived-filter` | `kubernetes-requires-containers` | Exclude candidates without Docker |
| **Boost** | `derived-boost` | `senior-prefers-leadership` | Rank candidates higher with leadership skills |

**Naming Convention**: `X-requires-Y` (filter), `X-prefers-Y` (boost)

### Decision 2: User Intent Overrides Inference

When user explicitly sets a preference, inferred **boost** rules targeting that field are blocked. Filter rules always fire (they add requirements, don't override preferences).

### Decision 3: Keep derivedSkillBoosts Separate from alignedSkillIds

Preserves provenance for UI explanations:
- `alignedSkillIds`: "Boosted because team focus is greenfield"
- `derivedSkillBoosts`: "Boosted because senior + greenfield implies ownership skills"

### Decision 4: json-rules-engine with Manual Iteration Loop

The library handles rule evaluation; we wrap it in a manual iteration loop for chaining since json-rules-engine doesn't auto-iterate.

## What We're NOT Doing

- Not changing filter semantics for existing constraint expander
- Not building a general-purpose inference engine
- Not supporting backward chaining
- Not implementing conflict resolution UI
- Not persisting derived rules

---

## Phase 1: Types and Dependency

### 1.1 Install json-rules-engine

```bash
cd recommender_api && npm install json-rules-engine
```

### 1.2 Create Domain Types

**File**: `recommender_api/src/types/inference-rule.types.ts` (new)

```typescript
/**
 * Domain types for inference engine (engine-agnostic).
 * Implements Section 5.2.1 iterative requirement expansion.
 */

/**
 * Target fields that inference rules can affect.
 * Used by both filter rules (add hard requirements) and boost rules (affect ranking).
 *
 * Note: 'derivedSkills' is the primary target - filter rules add to required skills,
 * boost rules add to preferred skills. The effect type determines interpretation.
 */
export type ConstraintTargetField =
  | 'derivedSkills'           // Skills to add (filter → required, boost → preferred)
  | 'preferredSeniorityLevel'
  | 'preferredMaxStartTime'
  | 'preferredConfidenceScore'
  | 'preferredProficiency'
  | 'utilityWeightAdjustment';

/**
 * A derived constraint produced by rule firing.
 */
export interface DerivedConstraint {
  ruleId: string;
  ruleName: string;
  effect: 'filter' | 'boost';
  targetField: ConstraintTargetField;
  targetValue: string | string[] | number;
  boostStrength?: number;  // Only for effect === 'boost'
  derivationChain: string[];  // Rule IDs in order
  explanation: string;
  overriddenByUser: boolean;
}

/**
 * Result of the inference engine.
 */
export interface InferenceResult {
  derivedConstraints: DerivedConstraint[];
  firedRules: string[];
  overriddenRules: string[];
  iterationCount: number;
  warnings: string[];
}
```

### 1.3 Create json-rules-engine Specific Types

**File**: `recommender_api/src/types/rule-engine.types.ts` (new)

```typescript
/**
 * Types specific to json-rules-engine integration.
 */

import type { RuleProperties } from 'json-rules-engine';
import type { ConstraintTargetField } from './inference-rule.types.js';

/**
 * Event parameters for derived constraints.
 */
export interface InferenceEventParams {
  ruleId: string;
  targetField: ConstraintTargetField;
  targetValue: string | string[] | number;
  boostStrength?: number;
  rationale: string;
}

/**
 * Extended rule definition with our event structure.
 */
export interface InferenceRuleDefinition extends RuleProperties {
  name: string;
  event: {
    type: 'derived-filter' | 'derived-boost';
    params: InferenceEventParams;
  };
}

/**
 * Facts structure for the almanac.
 */
export interface InferenceFacts {
  requiredSeniorityLevel?: string;
  requiredMinProficiency?: string;
  requiredMaxStartTime?: string;
  teamFocus?: string;
  requiredSkills: string[];  // Skill identifiers
  allSkills: string[];  // Combined required + derived skills for chaining
  maxBudget?: number;
  stretchBudget?: number;
  userExplicitFields: string[];  // Fields explicitly set by user
}
```

### 1.4 Update Knowledge Base Config Type

**File**: `recommender_api/src/types/knowledge-base.types.ts`

Add to `KnowledgeBaseConfig` interface:

```typescript
import type { InferenceRuleDefinition } from './rule-engine.types.js';

export interface KnowledgeBaseConfig {
  // ... existing fields ...

  /** Inference rules for iterative expansion (Section 5.2.1) */
  inferenceRules: InferenceRuleDefinition[];

  /** Maximum iterations for forward chaining */
  maxInferenceIterations: number;
}
```

### 1.5 Update Search Types

**File**: `recommender_api/src/types/search.types.ts`

Add `'inference'` to ConstraintSource and add `derivedConstraints` to response:

```typescript
export type ConstraintSource = 'user' | 'knowledge_base' | 'inference';

// Add to SearchFilterResponse interface:
derivedConstraints: Array<{
  ruleName: string;
  effect: 'filter' | 'boost';
  targetField: string;
  targetValue: unknown;
  boostStrength?: number;
  explanation: string;
  overriddenByUser: boolean;
}>;
```

### Success Criteria

- [ ] `npm install json-rules-engine` succeeds
- [ ] `npm run typecheck` passes
- [ ] Types correctly model domain semantics

---

## Phase 2: Rule Definitions

### 2.1 Create Inference Rules Config

**File**: `recommender_api/src/config/knowledge-base/inference-rules.config.ts` (new)

~15 rules in json-rules-engine format organized into:

**First-Hop Rules (User Fields → Skills)**:
```typescript
{
  name: 'Senior+ Benefits from Leadership Skills',
  priority: 50,
  conditions: {
    all: [{
      fact: 'requiredSeniorityLevel',
      operator: 'in',
      value: ['senior', 'staff', 'principal']
    }]
  },
  event: {
    type: 'derived-boost',  // boost → adds to preferred skills for ranking
    params: {
      ruleId: 'senior-prefers-leadership',
      targetField: 'derivedSkills',
      targetValue: ['skill_mentorship', 'skill_code_review', 'skill_tech_leadership'],
      boostStrength: 0.6,
      rationale: 'Senior engineers often benefit from leadership abilities'
    }
  }
}
```

**Filter Rules**:
```typescript
{
  name: 'Scaling Requires Distributed Systems',
  priority: 50,
  conditions: {
    all: [{ fact: 'teamFocus', operator: 'equal', value: 'scaling' }]
  },
  event: {
    type: 'derived-filter',  // filter → adds to required skills (hard constraint)
    params: {
      ruleId: 'scaling-requires-distributed',
      targetField: 'derivedSkills',
      targetValue: ['skill_distributed'],
      rationale: 'Scaling work requires distributed systems expertise'
    }
  }
}
```

**Skill-to-Skill Chains** (enables multi-hop):
```typescript
{
  name: 'Distributed Systems Require Observability',
  priority: 40,
  conditions: {
    all: [{
      fact: 'allSkills',
      operator: 'contains',
      value: 'skill_distributed'
    }]
  },
  event: {
    type: 'derived-filter',  // filter → adds to required skills (hard constraint)
    params: {
      ruleId: 'distributed-requires-observability',
      targetField: 'derivedSkills',
      targetValue: ['skill_monitoring'],
      rationale: 'Cannot effectively work on distributed systems without monitoring'
    }
  }
}
```

**Full Rule List**:
1. `senior-prefers-leadership` (boost)
2. `principal-prefers-architecture` (boost)
3. `greenfield-prefers-ambiguity-tolerance` (boost)
4. `greenfield-prefers-senior` (boost)
5. `migration-prefers-documentation` (boost)
6. `scaling-requires-distributed` (filter)
7. `scaling-prefers-observability` (boost)
8. `maintenance-prefers-debugging` (boost)
9. `senior-greenfield-prefers-ownership` (boost, compound)
10. `senior-scaling-prefers-architecture` (boost, compound)
11. `kubernetes-requires-containers` (filter, skill chain)
12. `kubernetes-prefers-helm` (boost, skill chain)
13. `microservices-prefers-api-design` (boost, skill chain)
14. `distributed-requires-observability` (filter, skill chain)
15. `distributed-prefers-tracing` (boost, skill chain)

### 2.2 Export from Knowledge Base Index

**File**: `recommender_api/src/config/knowledge-base/index.ts`

```typescript
import { inferenceRules, maxInferenceIterations } from './inference-rules.config.js';

export const knowledgeBaseConfig: KnowledgeBaseConfig = {
  // ... existing fields ...
  inferenceRules,
  maxInferenceIterations,
};
```

### Success Criteria

- [ ] All rule IDs unique
- [ ] `npm run typecheck` passes
- [ ] Filter vs boost semantics encoded correctly

---

## Phase 3: Inference Engine

### 3.1 Create Rule Engine Adapter

**File**: `recommender_api/src/services/rule-engine-adapter.ts` (new, ~150 lines)

```typescript
import { Engine, RuleResult } from 'json-rules-engine';
import type { SearchFilterRequest } from '../schemas/search.schema.js';
import type { InferenceFacts, InferenceRuleDefinition } from '../types/rule-engine.types.js';
import type { DerivedConstraint } from '../types/inference-rule.types.js';

let cachedEngine: Engine | null = null;

/**
 * Create and cache the Engine instance.
 */
export function createEngine(rules: InferenceRuleDefinition[]): Engine {
  if (cachedEngine) return cachedEngine;

  const engine = new Engine();

  // Add custom 'contains' operator for skill arrays
  engine.addOperator('contains', (factValue: string[], jsonValue: string) => {
    return Array.isArray(factValue) && factValue.includes(jsonValue);
  });

  rules.forEach(rule => engine.addRule(rule));
  cachedEngine = engine;
  return engine;
}

/**
 * Convert SearchFilterRequest to almanac facts.
 */
export function createFacts(request: SearchFilterRequest): InferenceFacts {
  const requiredSkills = (request.requiredSkills || []).map(s => s.identifier);

  return {
    requiredSeniorityLevel: request.requiredSeniorityLevel,
    requiredMinProficiency: request.requiredMinProficiency,
    requiredMaxStartTime: request.requiredMaxStartTime,
    teamFocus: request.teamFocus,
    requiredSkills,
    allSkills: [...requiredSkills],  // Will grow as rules fire
    maxBudget: request.maxBudget,
    stretchBudget: request.stretchBudget,
    userExplicitFields: extractUserExplicitFields(request),
  };
}

/**
 * Extract fields explicitly set by user (for override detection).
 */
function extractUserExplicitFields(request: SearchFilterRequest): string[] {
  const explicit: string[] = [];
  if (request.preferredSkills?.length) explicit.push('preferredSkills');
  if (request.preferredSeniorityLevel) explicit.push('preferredSeniorityLevel');
  if (request.preferredMaxStartTime) explicit.push('preferredMaxStartTime');
  return explicit;
}

/**
 * Convert engine event to domain DerivedConstraint.
 */
export function eventToConstraint(
  event: RuleResult['event'],
  derivationChain: string[],
  userExplicitFields: string[]
): DerivedConstraint {
  const params = event.params as InferenceEventParams;
  const effect = event.type === 'derived-filter' ? 'filter' : 'boost';

  // Boost rules can be overridden by user; filter rules cannot
  const overriddenByUser = effect === 'boost' &&
    userExplicitFields.includes(params.targetField);

  return {
    ruleId: params.ruleId,
    ruleName: params.ruleId,  // Will be updated from rule name
    effect,
    targetField: params.targetField,
    targetValue: params.targetValue,
    boostStrength: params.boostStrength,
    derivationChain: [...derivationChain, params.ruleId],
    explanation: params.rationale,
    overriddenByUser,
  };
}

/**
 * Merge derived skills into facts for chaining.
 * Both filter and boost rules targeting 'derivedSkills' feed into chaining.
 */
export function mergeSkillsIntoFacts(
  facts: InferenceFacts,
  constraints: DerivedConstraint[]
): InferenceFacts {
  const newSkills = new Set(facts.allSkills);

  for (const c of constraints) {
    if (c.overriddenByUser) continue;
    if (c.targetField !== 'derivedSkills') continue;

    const skills = Array.isArray(c.targetValue) ? c.targetValue : [c.targetValue];
    skills.forEach(s => typeof s === 'string' && newSkills.add(s));
  }

  return { ...facts, allSkills: [...newSkills] };
}

/**
 * Compute hash for fixpoint detection.
 */
export function computeFactsHash(facts: InferenceFacts): string {
  return JSON.stringify(facts.allSkills.sort());
}
```

### 3.2 Create Inference Engine Service

**File**: `recommender_api/src/services/inference-engine.service.ts` (new, ~150 lines)

```typescript
import type { SearchFilterRequest } from '../schemas/search.schema.js';
import type { DerivedConstraint, InferenceResult, BoostField } from '../types/inference-rule.types.js';
import { knowledgeBaseConfig } from '../config/knowledge-base/index.js';
import {
  createEngine,
  createFacts,
  eventToConstraint,
  mergeSkillsIntoFacts,
  computeFactsHash,
} from './rule-engine-adapter.js';

/**
 * Main inference function - runs forward chaining until fixpoint.
 */
export async function runInference(request: SearchFilterRequest): Promise<InferenceResult> {
  const config = knowledgeBaseConfig;
  const engine = createEngine(config.inferenceRules);
  const maxIterations = config.maxInferenceIterations;

  let facts = createFacts(request);
  const allDerivedConstraints: DerivedConstraint[] = [];
  const firedRuleIds = new Set<string>();
  const overriddenRuleIds = new Set<string>();
  const warnings: string[] = [];

  let iteration = 0;
  let previousHash = '';

  while (iteration < maxIterations) {
    iteration++;
    const currentHash = computeFactsHash(facts);

    // Fixpoint detection
    if (currentHash === previousHash) break;
    previousHash = currentHash;

    // Run engine
    const { events } = await engine.run(facts);

    // Process events
    for (const event of events) {
      const ruleId = (event.params as any).ruleId;

      if (firedRuleIds.has(ruleId)) continue;

      const constraint = eventToConstraint(
        event,
        [],  // derivation chain tracking
        facts.userExplicitFields
      );

      firedRuleIds.add(ruleId);

      if (constraint.overriddenByUser) {
        overriddenRuleIds.add(ruleId);
      }

      allDerivedConstraints.push(constraint);
    }

    // Merge derived skills for chaining
    facts = mergeSkillsIntoFacts(facts, allDerivedConstraints);
  }

  if (iteration >= maxIterations) {
    warnings.push(`Reached maximum inference iterations (${maxIterations}).`);
  }

  return {
    derivedConstraints: allDerivedConstraints,
    firedRules: [...firedRuleIds],
    overriddenRules: [...overriddenRuleIds],
    iterationCount: iteration,
    warnings,
  };
}

/**
 * Extract skills that must be required (from filter rules targeting derivedSkills).
 * Filter rules with effect='filter' add hard requirements.
 */
export function getDerivedRequiredSkills(constraints: DerivedConstraint[]): string[] {
  const skills: string[] = [];

  for (const c of constraints) {
    if (c.overriddenByUser) continue;
    if (c.effect !== 'filter') continue;
    if (c.targetField !== 'derivedSkills') continue;

    const values = Array.isArray(c.targetValue) ? c.targetValue : [c.targetValue];
    skills.push(...values.filter((v): v is string => typeof v === 'string'));
  }

  return [...new Set(skills)];
}

/**
 * Aggregate derived skill boosts (max strength wins).
 * Boost rules with effect='boost' add preferred skills for ranking.
 */
export function aggregateDerivedSkillBoosts(constraints: DerivedConstraint[]): Map<string, number> {
  const boosts = new Map<string, number>();

  for (const c of constraints) {
    if (c.overriddenByUser) continue;
    if (c.effect !== 'boost') continue;
    if (c.targetField !== 'derivedSkills') continue;
    if (c.boostStrength === undefined) continue;

    const skills = Array.isArray(c.targetValue) ? c.targetValue : [c.targetValue];
    for (const skill of skills) {
      if (typeof skill !== 'string') continue;
      const current = boosts.get(skill) || 0;
      boosts.set(skill, Math.max(current, c.boostStrength));
    }
  }

  return boosts;
}
```

### Success Criteria

- [ ] `npm run typecheck` passes
- [ ] Engine evaluates conditions correctly
- [ ] Multi-hop chains work (scaling → distributed → monitoring)

---

## Phase 4: Integration

### 4.1 Update ExpandedSearchCriteria Interface

**File**: `recommender_api/src/services/constraint-expander.service.ts`

Add to interface (around line 25-72):

```typescript
import type { DerivedConstraint } from '../types/inference-rule.types.js';

export interface ExpandedSearchCriteria {
  // ... existing fields ...

  /** Derived constraints from inference engine */
  derivedConstraints: DerivedConstraint[];

  /** Skills that MUST be matched (from filter rules) */
  derivedRequiredSkillIds: string[];

  /**
   * Aggregated skill boosts (from boost rules).
   * Note: Map is used internally for O(1) lookup during utility calculation.
   * This is NOT serialized to API response - see Phase 4.3 Change 3 for
   * how derivedConstraints are transformed to plain objects for the response.
   */
  derivedSkillBoosts: Map<string, number>;
}
```

### 4.2 Make expandSearchCriteria Async and Call Inference

**File**: `recommender_api/src/services/constraint-expander.service.ts`

Change function signature and add inference call:

```typescript
import {
  runInference,
  getDerivedRequiredSkills,
  aggregateDerivedSkillBoosts,
} from './inference-engine.service.js';

// Change signature to async
export async function expandSearchCriteria(
  request: SearchFilterRequest
): Promise<ExpandedSearchCriteria> {
  // ... existing expansion logic ...

  // ============================================
  // INFERENCE ENGINE - Iterative Expansion
  // ============================================
  const inferenceResult = await runInference(request);

  const derivedRequiredSkillIds = getDerivedRequiredSkills(inferenceResult.derivedConstraints);
  const derivedSkillBoosts = aggregateDerivedSkillBoosts(inferenceResult.derivedConstraints);

  // Track inference constraints
  for (const dc of inferenceResult.derivedConstraints) {
    if (dc.overriddenByUser) continue;

    if (dc.effect === 'filter') {
      appliedFilters.push({
        field: dc.targetField,
        value: JSON.stringify(dc.targetValue),
        source: 'inference',
        reason: dc.explanation,
      });
    } else {
      appliedPreferences.push({
        field: dc.targetField,
        value: JSON.stringify(dc.targetValue),
        source: 'inference',
        reason: dc.explanation,
      });
    }
  }

  return {
    // ... existing fields ...
    derivedConstraints: inferenceResult.derivedConstraints,
    derivedRequiredSkillIds,
    derivedSkillBoosts,
  };
}
```

### 4.3 Update Search Service

**File**: `recommender_api/src/services/search.service.ts`

**Change 1**: Await the now-async `expandSearchCriteria` call (line 50):
```typescript
// Before:
const expanded = expandSearchCriteria(request);

// After:
const expanded = await expandSearchCriteria(request);
```

**Change 2**: Pass derived constraints to UtilityContext (around line 180):
```typescript
const utilityContext: UtilityContext = {
  // ... existing fields ...
  derivedRequiredSkillIds: expanded.derivedRequiredSkillIds,
  derivedSkillBoosts: expanded.derivedSkillBoosts,
  derivedConstraints: expanded.derivedConstraints,
};
```

**Change 3**: Include `derivedConstraints` in API response (around line 218):
```typescript
return {
  matches,
  totalCount,
  appliedFilters: expanded.appliedFilters,
  appliedPreferences: expanded.appliedPreferences,
  // Add derived constraints for client visibility
  derivedConstraints: expanded.derivedConstraints.map(dc => ({
    ruleName: dc.ruleName,
    effect: dc.effect,
    targetField: dc.targetField,
    targetValue: dc.targetValue,
    boostStrength: dc.boostStrength,
    explanation: dc.explanation,
    overriddenByUser: dc.overriddenByUser,
  })),
  queryMetadata: {
    executionTimeMs,
    skillsExpanded: expandedSkillNames,
    defaultsApplied: expanded.defaultsApplied,
    unresolvedSkills,
  },
};
```

### 4.4 Update UtilityContext

**File**: `recommender_api/src/services/utility-calculator/types.ts`

```typescript
import type { DerivedConstraint } from '../../types/inference-rule.types.js';

export interface UtilityContext {
  // ... existing fields ...

  derivedRequiredSkillIds: string[];
  derivedSkillBoosts: Map<string, number>;
  derivedConstraints: DerivedConstraint[];
}
```

### Success Criteria

- [ ] Async change propagates correctly (all callers updated)
- [ ] `npm run typecheck` passes
- [ ] API response includes derivedConstraints
- [ ] Existing tests still pass after async changes

---

## Phase 5: Tests

### 5.1 Rule Engine Adapter Tests

**File**: `recommender_api/src/services/rule-engine-adapter.test.ts` (new)

Test cases:
- `createFacts` extracts skills and tracks explicit fields
- `eventToConstraint` creates correct types
- User override detection (boosts blocked, filters pass)
- `computeFactsHash` for fixpoint detection

### 5.2 Inference Engine Tests

**File**: `recommender_api/src/services/inference-engine.service.test.ts` (new)

Test cases:
- Boost rules fire correctly (senior-prefers-leadership)
- Filter rules fire correctly (scaling-requires-distributed)
- User override blocks boosts but not filters
- Multi-hop chains work (scaling → distributed → monitoring)
- Fixpoint detection
- Boost aggregation (max wins)

### Success Criteria

- [ ] `npm test` passes
- [ ] Coverage > 80% for new code
- [ ] Multi-hop chaining verified

---

## Phase 6: Documentation

**File**: `CLAUDE.md`

Add section explaining:
- How to add new inference rules
- Filter vs boost patterns
- Testing instructions

### Success Criteria

- [ ] Documentation explains how to add rules
- [ ] Examples show filter vs boost patterns

---

## File Summary

### New Files (5)
```
recommender_api/src/types/inference-rule.types.ts
recommender_api/src/types/rule-engine.types.ts
recommender_api/src/config/knowledge-base/inference-rules.config.ts
recommender_api/src/services/rule-engine-adapter.ts
recommender_api/src/services/inference-engine.service.ts
```

### Test Files (2)
```
recommender_api/src/services/rule-engine-adapter.test.ts
recommender_api/src/services/inference-engine.service.test.ts
```

### Modified Files (7)
```
recommender_api/package.json                                # Add json-rules-engine
recommender_api/src/types/knowledge-base.types.ts           # Add inference config
recommender_api/src/types/search.types.ts                   # Add inference source
recommender_api/src/config/knowledge-base/index.ts          # Export rules
recommender_api/src/services/constraint-expander.service.ts # Make async, call inference
recommender_api/src/services/search.service.ts              # Pass constraints
recommender_api/src/services/utility-calculator/types.ts    # Add derived boosts
CLAUDE.md                                                   # Add docs
```

---

## Verification Commands

```bash
# After each phase
npm run typecheck
npm run lint

# After Phase 5
npm test

# Full verification
npm test && npm run test:e2e
```

---

## References

- Original custom loop plan: `thoughts/shared/1_chapter_5/1.5_project_1.5/plans/2026-01-06-iterative-requirement-expansion.md`
- json-rules-engine plan: `thoughts/shared/1_chapter_5/1.5_project_1.5/plans/2026-01-06-iterative-requirement-expansion-jre.md`
- RETE analysis: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-rete-vs-json-rules-engine-analysis.md`
- Plan updates research: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-iterative-expansion-plan-updates.md`
- json-rules-engine: https://github.com/CacheControl/json-rules-engine
