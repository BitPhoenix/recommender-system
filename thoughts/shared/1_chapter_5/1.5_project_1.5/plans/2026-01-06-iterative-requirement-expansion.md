# Iterative Requirement Expansion Implementation Plan

## Overview

Implement Section 5.2.1's iterative requirement expansion mechanism where one constraint can trigger additional constraints, which in turn can trigger more constraints. This transforms our one-pass constraint expander into a forward-chaining inference engine that iteratively applies rules until no new constraints can be derived.

## Current State Analysis

The current implementation uses **one-pass, sequential constraint expansion**:

- `constraint-expander.service.ts:60-313` - Each user input mapped independently to database constraints
- `config/knowledge-base/` directory - Modular config files with static key-value mappings
- No rule chaining: results of one expansion don't trigger other rules

### Key Discoveries:
- Current `expandSearchCriteria()` function processes each field once in sequence (`constraint-expander.service.ts:60-313`)
- Knowledge base uses modular config structure: `config/knowledge-base/{index,filter-conditions,compatibility-constraints,defaults,utility}.config.ts`
- `AppliedFilter` and `AppliedPreference` types track constraint sources (`search.types.ts`)
- `ExpandedSearchCriteria` interface at `constraint-expander.service.ts:25-72`
- `UtilityContext` interface at `utility-calculator/types.ts:40-67`
- Search service orchestrates expansion before query building (`search.service.ts`)
- Types re-exported from Zod schemas: `import type { ... } from '../schemas/search.schema.js'`

## Desired End State

A forward-chaining inference engine that:

1. **Iteratively expands constraints** - Apply rules repeatedly until fixpoint (no new constraints)
2. **Uses boost semantics** - Derived constraints affect ranking, not filtering
3. **Respects user intent** - Explicit user input overrides inferred rules
4. **Explains reasoning** - Track provenance chain for each derived constraint
5. **Prevents infinite loops** - Detect cycles and enforce iteration limits

### Verification:
- Unit tests for each rule chain scenario
- Integration tests showing multi-hop expansion
- API response includes `derivedConstraints` with explanation chains

## Design Decisions and Rationale

This section explains the reasoning behind our key architectural decisions.

### Decision 1: Filter or Boost Based on Domain Semantics

**Decision**: Each rule declares its effect (`filter` or `boost`) based on domain semantics, not a blanket policy.

**Rationale**:

Not all inferred constraints are equal. Some represent hard technical requirements ("can't do X without Y"), while others represent beneficial correlations ("X is better with Y"). A principled approach classifies each rule based on what it actually means in the domain:

1. **Technical Prerequisites → Filters**
   - Example: `kubernetes-requires-containers` - An engineer who "knows Kubernetes" but can't use Docker either misrepresents their skills or has knowledge too shallow to be effective
   - These are dependency relationships where the derived skill is genuinely required
   - Effect: Remove candidates who lack the derived skill

2. **Soft Skill Correlations → Boosts**
   - Example: `senior-prefers-leadership` - A senior engineer without documented leadership skills might still be excellent; maybe they haven't had that role yet or skills aren't captured in our data
   - These are beneficial correlations, not requirements
   - Effect: Rank candidates higher if they have the derived skill

3. **Experience Preferences → Boosts**
   - Example: `greenfield-prefers-senior` - A strong mid-level might excel at greenfield work
   - These express statistical tendencies, not requirements
   - Effect: Weak ranking boost

**Why not all boosts?**
- "If we don't trust our rules enough to filter, why trust them enough to boost?" Defensive "always boost" design implies the rules are unreliable—but then why build them at all?
- For staffing decisions, users often prefer focused results over "here's everyone, with good ones ranked higher"
- Technical prerequisites genuinely are requirements—treating them as preferences dilutes result quality

**Why not all filters?**
- Soft skills and preferences shouldn't exclude candidates
- Data quality varies—an engineer may have skills not captured in our system
- Overly aggressive filtering produces empty or sparse results

**Naming Convention**:
- Filter rules: `X-requires-Y` (implies hard requirement)
- Boost rules: `X-prefers-Y` (implies soft preference)

This makes rules self-documenting: reading `kubernetes-requires-containers` vs `senior-prefers-leadership` immediately conveys intent.

### Decision 2: User Intent Overrides Inference

**Decision**: When a user explicitly sets a preference, inferred rules targeting that field are blocked.

**Rationale**:
1. **Users know their context better** - A manager asking for `preferredSeniorityLevel=junior` on a greenfield project might have good reasons: training opportunity, budget constraints, or team composition needs. Our general rule "greenfield prefers senior" shouldn't override their specific knowledge.

2. **Maintains trust** - If the system silently overrode user input, users would feel the system "knows better" than them. This erodes trust and makes the system frustrating to use.

3. **Explicit is better than implicit** - The Zen of Python applies here. When there's a conflict between what the user said and what we infer, the explicit statement wins.

4. **Transparency via tracking** - We still track which rules WOULD have fired but were overridden (`overriddenByUser: true`). This lets the UI show "We noticed you prefer junior, but greenfield projects often benefit from senior experience" - informative without being pushy.

5. **Avoids unexpected behavior** - Users should never be surprised by results. If they asked for X and got Y because of hidden inference, that's a bug in their mental model of the system.

### Decision 3: Provenance Chain Tracking

**Decision**: Every derived constraint includes an explanation chain showing which rules led to it.

**Rationale**:
1. **User confusion prevention** - Without explanations, users see recommendations they didn't ask for. "Why is the system boosting distributed systems skills?" The explanation "Because you selected teamFocus=scaling, which typically requires distributed systems expertise" answers this.

2. **Debuggability** - When rules produce unexpected results, developers and product managers need to trace the reasoning. The derivation chain makes this possible without digging through code.

3. **Trust through transparency** - Knowledge-based systems are only trusted when users understand their reasoning. Black-box recommendations feel arbitrary; explained recommendations feel intelligent.

4. **Educational value** - Users learn domain relationships through explanations. "Oh, scaling projects DO need monitoring skills - I hadn't thought of that." This makes the system a teacher, not just a tool.

5. **Feedback loop enablement** - When users disagree with a derived constraint, they can report WHY. "This rule doesn't apply to my team because X." The explanation makes this feedback actionable.

6. **Alignment with textbook** - Section 5.2.1 emphasizes that constraint-based systems should be explainable. The derivation chain implements this principle.

### Decision 4: Inference Engine as Separate Service Called Within expandSearchCriteria

**Decision**:
- Create `inference-engine.service.ts` as a separate service (not `rule-engine.service.ts`)
- Call from within `expandSearchCriteria()` at the end - callers don't need to know about two-step process

**Rationale**:
- "Inference engine" is a well-defined term in knowledge-based systems (aligns with Section 5.2.1)
- Clearly distinguishes from constraint expander's one-pass mappings
- Calling from within `expandSearchCriteria()` encapsulates the two-step process from callers
- Maintains testability as a separate service

### Decision 5: Keep derivedSkillBoosts Separate from alignedSkillIds

**Decision**: Keep `derivedSkillBoosts` as a separate `Map<string, number>` rather than merging into `alignedSkillIds`.

**Rationale**:
- Preserves provenance for UI explanations:
  - "Boosted because team focus is greenfield" (alignedSkillIds)
  - "Boosted because senior + greenfield implies ownership skills" (derivedSkillBoosts)
- Inference rules have explicit `boostStrength` values (0.4-0.9) while aligned skills are uniform
- Transparency is a core design principle of the inference engine

## What We're NOT Doing

- **Not changing filter semantics** - Derived constraints are boosts only, not hard filters
- **Not building a general-purpose inference engine** - Domain-specific rules for engineer matching
- **Not supporting backward chaining** - Only forward chaining from user requirements
- **Not implementing conflict resolution UI** - Backend handles conflicts automatically (user wins)
- **Not persisting derived rules** - Each request is stateless
- **Not implementing riskTolerance rules** - Field doesn't exist in current schema

## Implementation Approach

We'll extend the existing architecture rather than replace it:

1. Add a new `InferenceRule` type alongside existing mappings
2. Create an `inference-engine.service.ts` that is called from `expandSearchCriteria()`
3. New rules produce `DerivedConstraint` objects that feed into utility calculation
4. Existing direct mappings (seniority → years) remain as hard filters
5. Inferred rules (teamFocus=greenfield + seniority=senior → boost ownership) become boosts

---

## Phase 1: Define Rule Format and Types

### Overview
Extend the knowledge base type system to support inference rules with antecedents and consequents.

### Changes Required:

#### 1. New Types for Inference Rules
**File**: `recommender_api/src/types/inference-rule.types.ts` (new file)

```typescript
/**
 * Inference Rule Types
 * Implements Section 5.2.1 iterative requirement expansion.
 */

import type {
  SeniorityLevel,
  TeamFocus,
  ProficiencyLevel,
  StartTimeline,
} from '../schemas/search.schema.js';

/**
 * Supported constraint fields that can appear in rules.
 * Note: riskTolerance removed - not in current schema.
 */
export type ConstraintField =
  | 'requiredSeniorityLevel'
  | 'requiredMinProficiency'
  | 'requiredMaxStartTime'
  | 'teamFocus'
  | 'requiredSkills'
  | 'preferredSkills'
  | 'minYearsExperience'
  | 'maxBudget'
  | 'stretchBudget';

/**
 * Supported boost target fields.
 */
export type BoostField =
  | 'preferredSkills'
  | 'preferredSeniorityLevel'
  | 'preferredMaxStartTime'
  | 'preferredConfidenceScore'
  | 'preferredProficiency'
  | 'utilityWeightAdjustment';  // For dynamic weight changes

/**
 * Comparison operators for antecedent conditions.
 */
export type ComparisonOperator = '=' | '!=' | '>=' | '<=' | '>' | '<' | 'in' | 'contains';

/**
 * A single condition in an antecedent.
 */
export interface Condition {
  field: ConstraintField;
  operator: ComparisonOperator;
  value: string | number | string[] | boolean;
}

/**
 * Antecedent: one or more conditions that must all be true (AND logic).
 * For OR logic, create separate rules.
 */
export interface Antecedent {
  conditions: Condition[];
}

/**
 * Consequent: what happens when the rule fires.
 */
export interface Consequent {
  /** Field to target */
  targetField: BoostField;
  /** Value to require (filter) or prefer (boost) */
  targetValue: string | string[] | number;
  /** Boost strength (0-1). Only used when effect === 'boost' */
  boostStrength?: number;
}

/**
 * A complete inference rule.
 */
export interface InferenceRule {
  /** Unique identifier for the rule (use X-requires-Y or X-prefers-Y naming) */
  id: string;
  /** Human-readable name */
  name: string;
  /** When does this rule fire? */
  antecedent: Antecedent;
  /** What does this rule add? */
  consequent: Consequent;
  /** Human-readable explanation for UI */
  rationale: string;
  /** Priority for conflict resolution (higher = more important) */
  priority: number;
  /** Is this rule active? */
  enabled: boolean;
  /**
   * What effect does this rule have?
   * - 'filter': Hard requirement - exclude candidates without the derived skill
   * - 'boost': Soft preference - rank candidates higher if they have the derived skill
   */
  effect: 'filter' | 'boost';
}

/**
 * A derived constraint produced by rule firing.
 */
export interface DerivedConstraint {
  /** The rule that produced this */
  ruleId: string;
  ruleName: string;
  /** What effect does this constraint have? */
  effect: 'filter' | 'boost';
  /** The field being constrained */
  targetField: BoostField;
  targetValue: string | string[] | number;
  /** Boost strength (only for effect === 'boost') */
  boostStrength?: number;
  /** Explanation chain: which rules led to this */
  derivationChain: string[];  // Rule IDs in order
  /** Human-readable explanation */
  explanation: string;
  /** Was this overridden by user input? */
  overriddenByUser: boolean;
}

/**
 * Result of the inference engine.
 */
export interface InferenceResult {
  /** Constraints derived from rules (boosts) */
  derivedConstraints: DerivedConstraint[];
  /** Rules that fired */
  firedRules: string[];
  /** Rules that would have fired but were overridden by user */
  overriddenRules: string[];
  /** Number of iterations until fixpoint */
  iterationCount: number;
  /** Any warnings (e.g., max iterations reached) */
  warnings: string[];
}
```

#### 2. Extend Knowledge Base Config Type
**File**: `recommender_api/src/types/knowledge-base.types.ts`
**Changes**: Add inference rules to the config interface

```typescript
// Add import at top
import type { InferenceRule } from './inference-rule.types.js';

// Add to KnowledgeBaseConfig interface
export interface KnowledgeBaseConfig {
  // ... existing fields ...

  /** Inference rules for iterative expansion (Section 5.2.1) */
  inferenceRules: InferenceRule[];

  /** Maximum iterations for forward chaining (prevent infinite loops) */
  maxInferenceIterations: number;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] No linting errors: `npm run lint`
- [ ] Types are exported correctly from index

#### Manual Verification:
- [ ] Review type definitions for completeness
- [ ] Verify type names align with textbook terminology

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the types look correct before proceeding to the next phase.

---

## Phase 2: Create Initial Rule Set

### Overview
Populate the knowledge base with inference rules for the engineer matching domain.

### Changes Required:

#### 1. Create Inference Rules Config File
**File**: `recommender_api/src/config/knowledge-base/inference-rules.config.ts` (new file)

```typescript
/**
 * Inference Rules Configuration
 * Section 5.2.1 - Forward-chaining rules that derive additional constraints.
 *
 * Each rule declares its effect:
 * - 'filter': Hard requirement - exclude candidates without the derived skill
 * - 'boost': Soft preference - rank candidates higher if they have the derived skill
 *
 * Naming convention:
 * - Filter rules: X-requires-Y (hard requirement)
 * - Boost rules: X-prefers-Y (soft preference)
 *
 * Rules are organized into:
 * 1. FIRST-HOP RULES: User request fields → skills
 * 2. SKILL-TO-SKILL CHAINS: Derived skills → additional skills (enables iterative expansion)
 *
 * Example multi-hop chain:
 *   teamFocus=scaling
 *     → [filter] scaling-requires-distributed → skill_distributed
 *       → [filter] distributed-requires-observability → skill_monitoring, skill_tracing
 */

import type { InferenceRule } from '../../types/inference-rule.types.js';

export const inferenceRules: InferenceRule[] = [
  // ============================================
  // FIRST-HOP RULES: User Fields → Skills
  // ============================================

  // ----------------------------------------
  // SENIORITY-BASED RULES (mostly boosts - soft skill correlations)
  // ----------------------------------------
  {
    id: 'senior-prefers-leadership',
    name: 'Senior+ Benefits from Leadership Skills',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'requiredSeniorityLevel', operator: 'in', value: ['senior', 'staff', 'principal'] }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_mentorship', 'skill_code_review', 'skill_tech_leadership'],
      boostStrength: 0.6,
    },
    rationale: 'Senior engineers often benefit from leadership and mentoring abilities',
    priority: 50,
    enabled: true,
  },
  {
    id: 'principal-prefers-architecture',
    name: 'Principal Benefits from Architecture Skills',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'requiredSeniorityLevel', operator: '=', value: 'principal' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_system_design', 'skill_microservices', 'skill_tradeoffs'],
      boostStrength: 0.8,
    },
    rationale: 'Principal engineers typically define technical direction and architecture',
    priority: 60,
    enabled: true,
  },

  // ----------------------------------------
  // TEAM FOCUS RULES (mix of filters and boosts)
  // ----------------------------------------
  {
    id: 'greenfield-prefers-ambiguity-tolerance',
    name: 'Greenfield Benefits from Ambiguity Tolerance',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'teamFocus', operator: '=', value: 'greenfield' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_ambiguity', 'skill_ownership', 'skill_creativity'],
      boostStrength: 0.7,
    },
    rationale: 'New projects benefit from engineers who navigate unclear requirements well',
    priority: 50,
    enabled: true,
  },
  {
    id: 'greenfield-prefers-senior',
    name: 'Greenfield Benefits from Senior Experience',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'teamFocus', operator: '=', value: 'greenfield' }
      ]
    },
    consequent: {
      targetField: 'preferredSeniorityLevel',
      targetValue: 'senior',
      boostStrength: 0.5,
    },
    rationale: 'Greenfield projects often benefit from experienced engineers',
    priority: 45,
    enabled: true,
  },
  {
    id: 'migration-prefers-documentation',
    name: 'Migration Benefits from Documentation Skills',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'teamFocus', operator: '=', value: 'migration' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_documentation', 'skill_debugging', 'skill_analytical'],
      boostStrength: 0.6,
    },
    rationale: 'Migrations benefit from engineers who document and analyze systems well',
    priority: 50,
    enabled: true,
  },
  {
    id: 'scaling-requires-distributed',
    name: 'Scaling Projects Require Distributed Systems Skills',
    effect: 'filter',
    antecedent: {
      conditions: [
        { field: 'teamFocus', operator: '=', value: 'scaling' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_distributed'],
    },
    rationale: 'Scaling work fundamentally requires distributed systems expertise',
    priority: 50,
    enabled: true,
  },
  {
    id: 'scaling-prefers-observability',
    name: 'Scaling Benefits from Observability Skills',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'teamFocus', operator: '=', value: 'scaling' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_monitoring', 'skill_kafka'],
      boostStrength: 0.6,
    },
    rationale: 'Scaling work benefits from observability and messaging expertise',
    priority: 45,
    enabled: true,
  },
  {
    id: 'maintenance-prefers-debugging',
    name: 'Maintenance Benefits from Strong Debugging',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'teamFocus', operator: '=', value: 'maintenance' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_debugging', 'skill_root_cause', 'skill_unit_testing', 'skill_code_review'],
      boostStrength: 0.6,
    },
    rationale: 'Maintenance work benefits from bug fixing and quality skills',
    priority: 50,
    enabled: true,
  },

  // ----------------------------------------
  // COMPOUND RULES (multiple conditions)
  // ----------------------------------------
  {
    id: 'senior-greenfield-prefers-ownership',
    name: 'Senior + Greenfield Benefits from Strong Ownership',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'requiredSeniorityLevel', operator: 'in', value: ['senior', 'staff', 'principal'] },
        { field: 'teamFocus', operator: '=', value: 'greenfield' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_ownership', 'skill_tech_leadership', 'skill_system_design'],
      boostStrength: 0.8,
    },
    rationale: 'Senior engineers on greenfield projects benefit from ownership and leadership',
    priority: 70,
    enabled: true,
  },
  {
    id: 'senior-scaling-prefers-architecture',
    name: 'Senior + Scaling Benefits from Architecture Focus',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'requiredSeniorityLevel', operator: 'in', value: ['senior', 'staff', 'principal'] },
        { field: 'teamFocus', operator: '=', value: 'scaling' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_system_design', 'skill_microservices'],
      boostStrength: 0.8,
    },
    rationale: 'Senior engineers scaling systems benefit from architecture skills',
    priority: 70,
    enabled: true,
  },

  // ============================================
  // SKILL-TO-SKILL CHAINS (Second-Hop Rules)
  // These enable iterative expansion where
  // derived skills trigger additional constraints.
  //
  // Technical prerequisites use 'filter' (hard requirements).
  // Beneficial correlations use 'boost' (soft preferences).
  // ============================================

  {
    id: 'kubernetes-requires-containers',
    name: 'Kubernetes Requires Container Skills',
    effect: 'filter',
    antecedent: {
      conditions: [
        { field: 'requiredSkills', operator: 'contains', value: 'skill_kubernetes' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_docker'],
    },
    rationale: 'Cannot operate Kubernetes without container fundamentals',
    priority: 40,
    enabled: true,
  },
  {
    id: 'kubernetes-prefers-helm',
    name: 'Kubernetes Benefits from Helm',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'requiredSkills', operator: 'contains', value: 'skill_kubernetes' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_helm'],
      boostStrength: 0.5,
    },
    rationale: 'Helm is commonly used for Kubernetes deployments but not strictly required',
    priority: 35,
    enabled: true,
  },
  {
    id: 'microservices-prefers-api-design',
    name: 'Microservices Benefits from API Design',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'requiredSkills', operator: 'contains', value: 'skill_microservices' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_api_design', 'skill_event_driven'],
      boostStrength: 0.6,
    },
    rationale: 'Microservices benefit from clean API boundaries and event-driven patterns',
    priority: 40,
    enabled: true,
  },
  {
    id: 'distributed-requires-observability',
    name: 'Distributed Systems Require Observability',
    effect: 'filter',
    antecedent: {
      conditions: [
        { field: 'requiredSkills', operator: 'contains', value: 'skill_distributed' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_monitoring'],
    },
    rationale: 'Cannot effectively work on distributed systems without monitoring skills',
    priority: 40,
    enabled: true,
  },
  {
    id: 'distributed-prefers-tracing',
    name: 'Distributed Systems Benefit from Tracing',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'requiredSkills', operator: 'contains', value: 'skill_distributed' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_tracing', 'skill_logging'],
      boostStrength: 0.5,
    },
    rationale: 'Tracing and logging help debug distributed systems but can be learned',
    priority: 35,
    enabled: true,
  },
  {
    id: 'system-design-prefers-tradeoffs',
    name: 'System Design Benefits from Tradeoff Evaluation',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'requiredSkills', operator: 'contains', value: 'skill_system_design' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_tradeoffs', 'skill_data_modeling'],
      boostStrength: 0.5,
    },
    rationale: 'System design benefits from tradeoff analysis and data modeling skills',
    priority: 40,
    enabled: true,
  },
  {
    id: 'tech-leadership-prefers-mentoring',
    name: 'Tech Leadership Benefits from Mentoring',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'requiredSkills', operator: 'contains', value: 'skill_tech_leadership' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_mentorship', 'skill_decision_making', 'skill_code_review'],
      boostStrength: 0.6,
    },
    rationale: 'Technical leaders benefit from mentoring and decision-making skills',
    priority: 40,
    enabled: true,
  },
  {
    id: 'event-driven-prefers-messaging',
    name: 'Event-Driven Benefits from Messaging Skills',
    effect: 'boost',
    antecedent: {
      conditions: [
        { field: 'requiredSkills', operator: 'contains', value: 'skill_event_driven' }
      ]
    },
    consequent: {
      targetField: 'preferredSkills',
      targetValue: ['skill_kafka', 'skill_redis'],
      boostStrength: 0.5,
    },
    rationale: 'Event-driven architectures benefit from messaging expertise',
    priority: 40,
    enabled: true,
  },
];

/** Maximum iterations for forward chaining */
export const maxInferenceIterations = 10;
```

#### Rule Chaining Examples

The power of iterative expansion comes from rules triggering other rules. Here are concrete examples showing how chains work with the filter/boost model:

**Example 1: Filter Chain (Scaling Project)**
```
User Input: { teamFocus: 'scaling' }

Iteration 1:
  → scaling-requires-distributed [FILTER] fires
    Adds: skill_distributed as REQUIRED skill
  → scaling-prefers-observability [BOOST] fires
    Adds: skill_monitoring, skill_kafka as PREFERRED skills (strength: 0.6)

Iteration 2:
  → distributed-requires-observability [FILTER] fires (triggered by skill_distributed)
    Adds: skill_monitoring as REQUIRED skill
  → distributed-prefers-tracing [BOOST] fires (triggered by skill_distributed)
    Adds: skill_tracing, skill_logging as PREFERRED skills (strength: 0.5)

Result:
  - FILTERS (must have): skill_distributed, skill_monitoring
  - BOOSTS (prefer): skill_kafka, skill_tracing, skill_logging

Engineers without distributed systems AND monitoring skills are excluded.
Engineers with tracing/logging/kafka skills rank higher.
```

**Example 2: Boost-Only Chain (Senior Greenfield)**
```
User Input: { requiredSeniorityLevel: 'senior', teamFocus: 'greenfield' }

Iteration 1:
  → senior-prefers-leadership [BOOST] fires
    Adds: skill_mentorship, skill_code_review, skill_tech_leadership (strength: 0.6)
  → greenfield-prefers-ambiguity-tolerance [BOOST] fires
    Adds: skill_ambiguity, skill_ownership, skill_creativity (strength: 0.7)
  → senior-greenfield-prefers-ownership [BOOST] fires (compound rule)
    Adds: skill_ownership, skill_tech_leadership, skill_system_design (strength: 0.8)

Iteration 2:
  → tech-leadership-prefers-mentoring [BOOST] fires (triggered by skill_tech_leadership)
    Adds: skill_mentorship, skill_decision_making, skill_code_review (strength: 0.6)
  → system-design-prefers-tradeoffs [BOOST] fires (triggered by skill_system_design)
    Adds: skill_tradeoffs, skill_data_modeling (strength: 0.5)

Result:
  - FILTERS: none (all boost rules)
  - BOOSTS (aggregated by max strength):
    - skill_ownership: 0.8
    - skill_tech_leadership: 0.8
    - skill_system_design: 0.8
    - skill_ambiguity: 0.7
    - skill_creativity: 0.7
    - skill_mentorship: 0.6
    - skill_code_review: 0.6
    - skill_tradeoffs: 0.5
    - skill_data_modeling: 0.5
    - skill_decision_making: 0.6

No engineers excluded; those with ownership/leadership/ambiguity skills rank highest.
```

**Example 3: Mixed Filter + Boost Chain (Kubernetes Project)**
```
User Input: { requiredSkills: [{ identifier: 'skill_kubernetes', minProficiency: 'proficient' }] }

Iteration 1:
  → kubernetes-requires-containers [FILTER] fires
    Adds: skill_docker as REQUIRED skill
  → kubernetes-prefers-helm [BOOST] fires
    Adds: skill_helm as PREFERRED skill (strength: 0.5)

Result:
  - FILTERS: skill_docker (must have)
  - BOOSTS: skill_helm (prefer)

Engineers without Docker knowledge excluded, even if they claim Kubernetes skills.
```

**Key Behaviors:**

1. **Filter propagation**: When a filter rule derives a skill, that skill becomes part of the constraint set and can trigger further rules (both filter and boost).

2. **Boost aggregation**: When multiple rules boost the same skill, take the maximum strength (not sum) to avoid over-boosting.

3. **Mixed chains**: A filter rule can trigger boost rules, and boost rules can trigger other boost rules. The effect type determines what happens when the rule fires, not what it can trigger.

4. **Iteration limit**: Max 10 iterations prevents infinite loops. In practice, most chains complete in 2-3 iterations.

#### 2. Update Knowledge Base Index to Export Inference Rules
**File**: `recommender_api/src/config/knowledge-base/index.ts`
**Changes**: Add inference rules export

```typescript
// Add import
import { inferenceRules, maxInferenceIterations } from './inference-rules.config.js';

// Add to knowledgeBaseConfig object export
export const knowledgeBaseConfig: KnowledgeBaseConfig = {
  // ... existing fields ...
  inferenceRules,
  maxInferenceIterations,
};
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] No linting errors: `npm run lint`
- [ ] Config exports correctly

#### Manual Verification:
- [ ] Review rules for domain correctness
- [ ] Verify rule IDs are unique
- [ ] Check rationales are clear

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the rules look correct before proceeding to the next phase.

---

## Phase 3: Implement Forward-Chaining Inference Engine

### Overview
Create the core inference engine that iteratively applies rules until no new constraints are derived.

### Changes Required:

#### 1. Create Inference Engine Service
**File**: `recommender_api/src/services/inference-engine.service.ts` (new file)

```typescript
/**
 * Inference Engine Service
 * Implements Section 5.2.1 - Iterative requirement expansion via forward chaining.
 *
 * This engine:
 * 1. Takes user requirements as input
 * 2. Iteratively applies inference rules until fixpoint
 * 3. Produces derived constraints (filters AND boosts) with explanation chains
 * 4. Respects user overrides (explicit input wins)
 *
 * Key distinction:
 * - effect: 'filter' → Hard requirement, exclude candidates without skill
 * - effect: 'boost' → Soft preference, rank candidates higher with skill
 */

import type { SearchFilterRequest } from '../schemas/search.schema.js';
import type {
  InferenceRule,
  Condition,
  DerivedConstraint,
  InferenceResult,
  BoostField,
} from '../types/inference-rule.types.js';
import { knowledgeBaseConfig } from '../config/knowledge-base/index.js';

/**
 * Internal state tracked during inference.
 */
interface InferenceState {
  /** Current set of active constraints (user + derived) */
  activeConstraints: Map<string, unknown>;
  /** Skills that are now required due to filter rules */
  derivedRequiredSkills: Set<string>;
  /** Which rules have already fired */
  firedRuleIds: Set<string>;
  /** Derived constraints produced so far */
  derivedConstraints: DerivedConstraint[];
  /** Rules blocked by user override */
  overriddenRuleIds: Set<string>;
  /** Fields explicitly set by user (cannot be overridden) */
  userExplicitFields: Set<string>;
}

/**
 * Extracts fields explicitly set by the user (not defaults).
 */
function extractUserExplicitFields(request: SearchFilterRequest): Set<string> {
  const explicit = new Set<string>();

  if (request.requiredSeniorityLevel !== undefined) explicit.add('requiredSeniorityLevel');
  if (request.requiredMinProficiency !== undefined) explicit.add('requiredMinProficiency');
  if (request.requiredMaxStartTime !== undefined) explicit.add('requiredMaxStartTime');
  if (request.teamFocus !== undefined) explicit.add('teamFocus');
  if (request.requiredSkills !== undefined && request.requiredSkills.length > 0) explicit.add('requiredSkills');
  if (request.preferredSkills !== undefined && request.preferredSkills.length > 0) explicit.add('preferredSkills');
  if (request.maxBudget !== undefined) explicit.add('maxBudget');
  if (request.stretchBudget !== undefined) explicit.add('stretchBudget');
  if (request.preferredSeniorityLevel !== undefined) explicit.add('preferredSeniorityLevel');
  if (request.preferredMaxStartTime !== undefined) explicit.add('preferredMaxStartTime');

  return explicit;
}

/**
 * Converts request to a map for condition checking.
 */
function requestToConstraintMap(request: SearchFilterRequest): Map<string, unknown> {
  const map = new Map<string, unknown>();

  if (request.requiredSeniorityLevel) map.set('requiredSeniorityLevel', request.requiredSeniorityLevel);
  if (request.requiredMinProficiency) map.set('requiredMinProficiency', request.requiredMinProficiency);
  if (request.requiredMaxStartTime) map.set('requiredMaxStartTime', request.requiredMaxStartTime);
  if (request.teamFocus) map.set('teamFocus', request.teamFocus);
  if (request.requiredSkills) {
    // Extract skill identifiers for condition checking
    const skillIds = request.requiredSkills.map(s => s.identifier);
    map.set('requiredSkills', skillIds);
  }
  if (request.maxBudget !== undefined) map.set('maxBudget', request.maxBudget);
  if (request.stretchBudget !== undefined) map.set('stretchBudget', request.stretchBudget);

  return map;
}

/**
 * Checks if a single condition is satisfied.
 */
function evaluateCondition(condition: Condition, constraints: Map<string, unknown>): boolean {
  const value = constraints.get(condition.field);

  if (value === undefined || value === null) {
    return false;
  }

  switch (condition.operator) {
    case '=':
      return value === condition.value;
    case '!=':
      return value !== condition.value;
    case '>=':
      return typeof value === 'number' && value >= (condition.value as number);
    case '<=':
      return typeof value === 'number' && value <= (condition.value as number);
    case '>':
      return typeof value === 'number' && value > (condition.value as number);
    case '<':
      return typeof value === 'number' && value < (condition.value as number);
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(value as string);
    case 'contains':
      return Array.isArray(value) && value.includes(condition.value as string);
    default:
      return false;
  }
}

/**
 * Checks if all conditions in an antecedent are satisfied (AND logic).
 */
function evaluateAntecedent(rule: InferenceRule, constraints: Map<string, unknown>): boolean {
  return rule.antecedent.conditions.every(cond => evaluateCondition(cond, constraints));
}

/**
 * Checks if a rule's consequent would conflict with user-explicit fields.
 * Only applies to boost rules - filter rules add requirements, they don't override preferences.
 */
function wouldOverrideUser(rule: InferenceRule, userExplicitFields: Set<string>): boolean {
  // Filter rules don't override user preferences - they add requirements
  if (rule.effect === 'filter') {
    return false;
  }

  const fieldMapping: Record<BoostField, string> = {
    'preferredSkills': 'preferredSkills',
    'preferredSeniorityLevel': 'preferredSeniorityLevel',
    'preferredMaxStartTime': 'preferredMaxStartTime',
    'preferredConfidenceScore': 'preferredConfidenceScore',
    'preferredProficiency': 'preferredProficiency',
    'utilityWeightAdjustment': 'utilityWeightAdjustment',
  };

  const targetField = fieldMapping[rule.consequent.targetField];
  return userExplicitFields.has(targetField);
}

/**
 * Applies a rule to produce a derived constraint.
 */
function applyRule(rule: InferenceRule, derivationChain: string[]): DerivedConstraint {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    effect: rule.effect,
    targetField: rule.consequent.targetField,
    targetValue: rule.consequent.targetValue,
    boostStrength: rule.effect === 'boost' ? rule.consequent.boostStrength : undefined,
    derivationChain: [...derivationChain, rule.id],
    explanation: rule.rationale,
    overriddenByUser: false,
  };
}

/**
 * Main inference function - runs forward chaining until fixpoint.
 */
export function runInference(request: SearchFilterRequest): InferenceResult {
  const config = knowledgeBaseConfig;
  const rules = config.inferenceRules.filter(r => r.enabled);
  const maxIterations = config.maxInferenceIterations;

  const state: InferenceState = {
    activeConstraints: requestToConstraintMap(request),
    derivedRequiredSkills: new Set(),
    firedRuleIds: new Set(),
    derivedConstraints: [],
    overriddenRuleIds: new Set(),
    userExplicitFields: extractUserExplicitFields(request),
  };

  const warnings: string[] = [];
  let iteration = 0;
  let changed = true;

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (state.firedRuleIds.has(rule.id)) continue;
      if (!evaluateAntecedent(rule, state.activeConstraints)) continue;

      // Check user override (only for boost rules)
      if (wouldOverrideUser(rule, state.userExplicitFields)) {
        state.overriddenRuleIds.add(rule.id);
        state.derivedConstraints.push({ ...applyRule(rule, []), overriddenByUser: true });
        state.firedRuleIds.add(rule.id);
        continue;
      }

      // Apply the rule
      const derived = applyRule(rule, []);
      state.derivedConstraints.push(derived);
      state.firedRuleIds.add(rule.id);
      changed = true;

      // Add derived skills to active constraints for chaining
      // Both filters and boosts can trigger subsequent rules
      if (derived.targetField === 'preferredSkills') {
        const currentSkills = (state.activeConstraints.get('requiredSkills') as string[]) || [];
        const newSkills = Array.isArray(derived.targetValue)
          ? derived.targetValue as string[]
          : [derived.targetValue as string];

        // Track required skills from filter rules
        if (derived.effect === 'filter') {
          newSkills.forEach(s => state.derivedRequiredSkills.add(s));
        }

        // Add to active constraints for chain triggering
        state.activeConstraints.set('requiredSkills', [...new Set([...currentSkills, ...newSkills])]);
      }
    }
  }

  if (iteration >= maxIterations) {
    warnings.push(`Reached maximum inference iterations (${maxIterations}).`);
  }

  return {
    derivedConstraints: state.derivedConstraints,
    firedRules: Array.from(state.firedRuleIds),
    overriddenRules: Array.from(state.overriddenRuleIds),
    iterationCount: iteration,
    warnings,
  };
}

/**
 * Extracts skills that must be required (from filter rules).
 */
export function getDerivedRequiredSkills(derivedConstraints: DerivedConstraint[]): string[] {
  const skills: string[] = [];

  for (const dc of derivedConstraints) {
    if (dc.overriddenByUser) continue;
    if (dc.effect !== 'filter') continue;
    if (dc.targetField !== 'preferredSkills') continue;

    const values = Array.isArray(dc.targetValue) ? dc.targetValue : [dc.targetValue];
    skills.push(...values.filter((v): v is string => typeof v === 'string'));
  }

  return [...new Set(skills)];
}

/**
 * Aggregates derived skill boosts (from boost rules only).
 */
export function aggregateDerivedSkillBoosts(derivedConstraints: DerivedConstraint[]): Map<string, number> {
  const skillBoosts = new Map<string, number>();

  for (const dc of derivedConstraints) {
    if (dc.overriddenByUser) continue;
    if (dc.effect !== 'boost') continue;
    if (dc.targetField !== 'preferredSkills') continue;
    if (dc.boostStrength === undefined) continue;

    const skills = Array.isArray(dc.targetValue) ? dc.targetValue : [dc.targetValue];
    for (const skill of skills) {
      if (typeof skill !== 'string') continue;
      const current = skillBoosts.get(skill) || 0;
      skillBoosts.set(skill, Math.max(current, dc.boostStrength));
    }
  }

  return skillBoosts;
}

/**
 * Gets the strongest derived boost for a specific field.
 */
export function getStrongestBoost(
  derivedConstraints: DerivedConstraint[],
  field: BoostField
): { value: unknown; strength: number } | null {
  const relevant = derivedConstraints
    .filter(dc => !dc.overriddenByUser && dc.effect === 'boost' && dc.targetField === field)
    .filter(dc => dc.boostStrength !== undefined)
    .sort((a, b) => (b.boostStrength ?? 0) - (a.boostStrength ?? 0));

  if (relevant.length === 0) return null;

  return {
    value: relevant[0].targetValue,
    strength: relevant[0].boostStrength!,
  };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] No linting errors: `npm run lint`
- [ ] Unit tests pass for inference engine

#### Manual Verification:
- [ ] Test with sample requests to verify rule firing
- [ ] Verify user override logic works correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the inference engine logic looks correct before proceeding to the next phase.

---

## Phase 4: Integrate with Constraint Expander

### Overview
Wire the inference engine into the existing search pipeline so derived constraints affect utility calculation.

### Changes Required:

#### 1. Update ExpandedSearchCriteria Interface
**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Changes**: Add derived constraints to the output (around line 25-72)

```typescript
// Add import at top
import type { DerivedConstraint } from '../types/inference-rule.types.js';

// Update ExpandedSearchCriteria interface to add new fields:
export interface ExpandedSearchCriteria {
  // ... existing fields (lines 25-72) ...

  /** Derived constraints from inference engine */
  derivedConstraints: DerivedConstraint[];

  /** Skills that MUST be matched (from filter rules) - added to query WHERE clause */
  derivedRequiredSkillIds: string[];

  /** Aggregated skill boosts (from boost rules) - affects ranking, not filtering */
  derivedSkillBoosts: Map<string, number>;
}
```

#### 2. Call Inference Engine in expandSearchCriteria
**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Changes**: Add inference step at the end of expandSearchCriteria function

```typescript
// Add import at top
import {
  runInference,
  getDerivedRequiredSkills,
  aggregateDerivedSkillBoosts,
} from './inference-engine.service.js';

// At end of expandSearchCriteria function, before return:

  // ============================================
  // INFERENCE ENGINE - Iterative Expansion
  // ============================================
  const inferenceResult = runInference(request);

  // Extract derived filters (required skills) and boosts separately
  const derivedRequiredSkillIds = getDerivedRequiredSkills(inferenceResult.derivedConstraints);
  const derivedSkillBoosts = aggregateDerivedSkillBoosts(inferenceResult.derivedConstraints);

  // Track inference metadata in applied filters/preferences
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
    derivedRequiredSkillIds,  // Skills that MUST be matched (from filter rules)
    derivedSkillBoosts,       // Skills that get ranking boost (from boost rules)
  };
```

#### 3. Update AppliedPreference Source Type
**File**: `recommender_api/src/types/search.types.ts`
**Changes**: Add 'inference' to the source type

```typescript
// Update ConstraintSource type (or wherever source is defined)
export type ConstraintSource = 'user' | 'knowledge_base' | 'inference';
```

#### 4. Update UtilityContext to Accept Derived Constraints
**File**: `recommender_api/src/services/utility-calculator/types.ts`
**Changes**: Add derived filter and boost fields (around line 40-67)

```typescript
// Add import at top
import type { DerivedConstraint } from '../../types/inference-rule.types.js';

// Add to UtilityContext interface:
export interface UtilityContext {
  // ... existing fields (lines 40-67) ...

  /** Skills required by inference filter rules (already filtered in query) */
  derivedRequiredSkillIds: string[];

  /** Skill boosts from inference boost rules (affects ranking) */
  derivedSkillBoosts: Map<string, number>;

  /** All derived constraints for explanation/debugging */
  derivedConstraints: DerivedConstraint[];
}
```

#### 5. Apply Derived Skill Boosts in Skill Scoring
**File**: `recommender_api/src/services/utility-calculator/scoring/skill-scoring.ts`
**Changes**: Add derived boost contribution to skill scoring

```typescript
/**
 * Applies derived skill boosts from inference engine to a base score.
 * Called after calculating base skill match score.
 */
export function applyDerivedSkillBoosts(
  baseScore: number,
  matchedSkillIds: string[],
  derivedSkillBoosts: Map<string, number>
): number {
  if (derivedSkillBoosts.size === 0 || matchedSkillIds.length === 0) {
    return baseScore;
  }

  let boost = 0;
  let boostCount = 0;
  for (const skillId of matchedSkillIds) {
    const derivedBoost = derivedSkillBoosts.get(skillId);
    if (derivedBoost) {
      boost += derivedBoost;
      boostCount++;
    }
  }

  if (boostCount === 0) {
    return baseScore;
  }

  // Normalize: max boost is 0.2 additional (20% of base weight)
  const normalizedBoost = Math.min(boost / matchedSkillIds.length, 0.2);
  return baseScore * (1 + normalizedBoost);
}
```

#### 6. Update Search Service to Pass Derived Constraints
**File**: `recommender_api/src/services/search.service.ts`
**Changes**: Pass derived constraints through to utility calculator and include in query

```typescript
// Update utilityContext creation to include derived constraints:
  const utilityContext: UtilityContext = {
    // ... existing fields ...
    derivedRequiredSkillIds: expanded.derivedRequiredSkillIds,
    derivedSkillBoosts: expanded.derivedSkillBoosts,
    derivedConstraints: expanded.derivedConstraints,
  };

// IMPORTANT: derivedRequiredSkillIds must be added to the Cypher query WHERE clause
// to filter out engineers who lack required skills from filter rules.
// See query-conditions.builder.ts for integration point.
```

#### 7. Update API Response to Include Derived Constraints
**File**: `recommender_api/src/types/search.types.ts`
**Changes**: Add derivedConstraints to response type (around line 185-191)

```typescript
// Add to SearchFilterResponse interface:
export interface SearchFilterResponse {
  matches: EngineerMatch[];
  totalCount: number;
  appliedFilters: AppliedFilter[];
  appliedPreferences: AppliedPreference[];
  queryMetadata: QueryMetadata;

  /** Constraints derived by inference engine (both filters and boosts) */
  derivedConstraints: Array<{
    ruleName: string;
    effect: 'filter' | 'boost';
    targetField: string;
    targetValue: unknown;
    boostStrength?: number;
    explanation: string;
    overriddenByUser: boolean;
  }>;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] No linting errors: `npm run lint`
- [ ] All existing tests still pass: `npm test`
- [ ] Integration tests show derived constraints in response

#### Manual Verification:
- [ ] API response includes derivedConstraints array
- [ ] Verify boost affects ranking order
- [ ] Test user override blocks inference correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the integration is working correctly before proceeding to the next phase.

---

## Phase 5: Add Comprehensive Tests

### Overview
Create unit and integration tests for the inference engine and rule chaining.

### Changes Required:

#### 1. Unit Tests for Inference Engine
**File**: `recommender_api/src/services/inference-engine.service.test.ts` (new file)

```typescript
import { describe, it, expect } from 'vitest';
import {
  runInference,
  getDerivedRequiredSkills,
  aggregateDerivedSkillBoosts,
  getStrongestBoost,
} from './inference-engine.service.js';
import type { SearchFilterRequest } from '../schemas/search.schema.js';

describe('Inference Engine Service', () => {
  describe('runInference - Boost Rules', () => {
    it('should fire senior-prefers-leadership boost for senior seniority', () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
      };

      const result = runInference(request);

      expect(result.firedRules).toContain('senior-prefers-leadership');
      const derived = result.derivedConstraints.find(
        dc => dc.ruleId === 'senior-prefers-leadership'
      );
      expect(derived?.effect).toBe('boost');
      expect(derived?.targetField).toBe('preferredSkills');
    });

    it('should fire multiple boost rules for compound conditions', () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
        teamFocus: 'greenfield',
      };

      const result = runInference(request);

      expect(result.firedRules).toContain('senior-prefers-leadership');
      expect(result.firedRules).toContain('greenfield-prefers-ambiguity-tolerance');
      expect(result.firedRules).toContain('senior-greenfield-prefers-ownership');
    });

    it('should respect user override on preferredSeniorityLevel (boost only)', () => {
      const request: SearchFilterRequest = {
        teamFocus: 'greenfield',
        preferredSeniorityLevel: 'junior',  // User explicitly wants junior
      };

      const result = runInference(request);

      // greenfield-prefers-senior should be marked as overridden
      expect(result.overriddenRules).toContain('greenfield-prefers-senior');
      const overridden = result.derivedConstraints.find(
        dc => dc.ruleId === 'greenfield-prefers-senior'
      );
      expect(overridden?.overriddenByUser).toBe(true);
    });
  });

  describe('runInference - Filter Rules', () => {
    it('should fire scaling-requires-distributed filter for teamFocus=scaling', () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
      };

      const result = runInference(request);

      expect(result.firedRules).toContain('scaling-requires-distributed');
      const derived = result.derivedConstraints.find(
        dc => dc.ruleId === 'scaling-requires-distributed'
      );
      expect(derived?.effect).toBe('filter');
      expect(derived?.targetValue).toContain('skill_distributed');
    });

    it('should fire kubernetes-requires-containers filter for kubernetes skill', () => {
      const request: SearchFilterRequest = {
        requiredSkills: [{ identifier: 'skill_kubernetes', minProficiency: 'proficient' }],
      };

      const result = runInference(request);

      expect(result.firedRules).toContain('kubernetes-requires-containers');
      const derived = result.derivedConstraints.find(
        dc => dc.ruleId === 'kubernetes-requires-containers'
      );
      expect(derived?.effect).toBe('filter');
      expect(derived?.targetValue).toContain('skill_docker');
    });

    it('filter rules should NOT be blocked by user overrides', () => {
      // Filter rules add requirements - they don't conflict with user preferences
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
        preferredSkills: [{ identifier: 'skill_python' }],  // User has preferred skills
      };

      const result = runInference(request);

      // Filter should still fire despite user having preferredSkills set
      expect(result.firedRules).toContain('scaling-requires-distributed');
      expect(result.overriddenRules).not.toContain('scaling-requires-distributed');
    });
  });

  describe('runInference - Mixed Filter + Boost Chains', () => {
    it('should fire filter chain: scaling → distributed → observability', () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
      };

      const result = runInference(request);

      // Hop 1: scaling → distributed (FILTER)
      expect(result.firedRules).toContain('scaling-requires-distributed');

      // Hop 2: distributed → monitoring (FILTER)
      expect(result.firedRules).toContain('distributed-requires-observability');

      // Also fires boost rules
      expect(result.firedRules).toContain('scaling-prefers-observability');
      expect(result.firedRules).toContain('distributed-prefers-tracing');

      // Should take multiple iterations
      expect(result.iterationCount).toBeGreaterThan(1);
    });

    it('should correctly separate filters from boosts in derived constraints', () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
      };

      const result = runInference(request);

      const filters = result.derivedConstraints.filter(dc => dc.effect === 'filter');
      const boosts = result.derivedConstraints.filter(dc => dc.effect === 'boost');

      // Should have both filter and boost constraints
      expect(filters.length).toBeGreaterThan(0);
      expect(boosts.length).toBeGreaterThan(0);

      // Filters should include distributed and monitoring
      const filterSkills = filters.flatMap(f =>
        Array.isArray(f.targetValue) ? f.targetValue : [f.targetValue]
      );
      expect(filterSkills).toContain('skill_distributed');
      expect(filterSkills).toContain('skill_monitoring');
    });
  });

  describe('getDerivedRequiredSkills', () => {
    it('should extract skills from filter rules only', () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
      };

      const result = runInference(request);
      const requiredSkills = getDerivedRequiredSkills(result.derivedConstraints);

      // Should include skills from filter rules
      expect(requiredSkills).toContain('skill_distributed');
      expect(requiredSkills).toContain('skill_monitoring');

      // Should NOT include skills from boost rules
      // (skill_kafka comes from scaling-prefers-observability boost)
    });
  });

  describe('aggregateDerivedSkillBoosts', () => {
    it('should only aggregate boost rules, not filter rules', () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
      };

      const result = runInference(request);
      const boosts = aggregateDerivedSkillBoosts(result.derivedConstraints);

      // skill_distributed comes from FILTER rule - should NOT be in boosts
      // (unless also boosted by a separate boost rule)
      // skill_kafka comes from BOOST rule - should be in boosts
      expect(boosts.has('skill_kafka')).toBe(true);
    });

    it('should aggregate skill boosts taking max strength', () => {
      const derivedConstraints = [
        {
          ruleId: 'rule1',
          ruleName: 'Rule 1',
          effect: 'boost' as const,
          targetField: 'preferredSkills' as const,
          targetValue: ['skill_a', 'skill_b'],
          boostStrength: 0.6,
          derivationChain: ['rule1'],
          explanation: 'Test',
          overriddenByUser: false,
        },
        {
          ruleId: 'rule2',
          ruleName: 'Rule 2',
          effect: 'boost' as const,
          targetField: 'preferredSkills' as const,
          targetValue: ['skill_a', 'skill_c'],
          boostStrength: 0.8,
          derivationChain: ['rule2'],
          explanation: 'Test',
          overriddenByUser: false,
        },
      ];

      const result = aggregateDerivedSkillBoosts(derivedConstraints);

      expect(result.get('skill_a')).toBe(0.8);  // Max of 0.6 and 0.8
      expect(result.get('skill_b')).toBe(0.6);
      expect(result.get('skill_c')).toBe(0.8);
    });

    it('should exclude filter rules from boost aggregation', () => {
      const derivedConstraints = [
        {
          ruleId: 'filter-rule',
          ruleName: 'Filter Rule',
          effect: 'filter' as const,
          targetField: 'preferredSkills' as const,
          targetValue: ['skill_required'],
          derivationChain: ['filter-rule'],
          explanation: 'Test',
          overriddenByUser: false,
        },
      ];

      const result = aggregateDerivedSkillBoosts(derivedConstraints);

      expect(result.size).toBe(0);  // Filter rules not included
    });
  });

  describe('getStrongestBoost', () => {
    it('should return strongest boost for a field', () => {
      const derivedConstraints = [
        {
          ruleId: 'rule1',
          ruleName: 'Rule 1',
          effect: 'boost' as const,
          targetField: 'preferredSeniorityLevel' as const,
          targetValue: 'senior',
          boostStrength: 0.5,
          derivationChain: ['rule1'],
          explanation: 'Test',
          overriddenByUser: false,
        },
        {
          ruleId: 'rule2',
          ruleName: 'Rule 2',
          effect: 'boost' as const,
          targetField: 'preferredSeniorityLevel' as const,
          targetValue: 'staff',
          boostStrength: 0.7,
          derivationChain: ['rule2'],
          explanation: 'Test',
          overriddenByUser: false,
        },
      ];

      const result = getStrongestBoost(derivedConstraints, 'preferredSeniorityLevel');

      expect(result?.value).toBe('staff');
      expect(result?.strength).toBe(0.7);
    });

    it('should ignore filter rules when finding strongest boost', () => {
      const derivedConstraints = [
        {
          ruleId: 'filter-rule',
          ruleName: 'Filter Rule',
          effect: 'filter' as const,
          targetField: 'preferredSeniorityLevel' as const,
          targetValue: 'principal',
          derivationChain: ['filter-rule'],
          explanation: 'Test',
          overriddenByUser: false,
        },
      ];

      const result = getStrongestBoost(derivedConstraints, 'preferredSeniorityLevel');

      expect(result).toBeNull();  // Filter rules ignored
    });
  });
});
```

#### 2. Add Postman Tests for Inference
**File**: `postman/collections/search-filter-tests.postman_collection.json`
**Changes**: Add test scenarios for inference engine

Add test requests covering:
- Basic inference (single rule)
- Compound inference (multiple rules)
- User override blocking inference
- API response includes derivedConstraints

### Success Criteria:

#### Automated Verification:
- [ ] All unit tests pass: `npm test`
- [ ] All integration tests pass: `npm run test:e2e`
- [ ] Code coverage > 80% for inference engine

#### Manual Verification:
- [ ] Review test coverage for edge cases
- [ ] Verify tests cover user override scenarios

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the tests are comprehensive before proceeding to the next phase.

---

## Phase 6: Documentation and API Updates

### Overview
Update API documentation and add user-facing explanation of derived constraints.

### Changes Required:

#### 1. Update Zod Schema Documentation
**File**: `recommender_api/src/schemas/search.schema.ts`
**Changes**: Add JSDoc comments explaining inference behavior

#### 2. Update CLAUDE.md with Inference Documentation
**File**: `CLAUDE.md`
**Changes**: Add section explaining inference rules and how to test them

### Success Criteria:

#### Automated Verification:
- [ ] No TypeScript errors after doc changes

#### Manual Verification:
- [ ] API documentation explains derived constraints
- [ ] Examples show chaining behavior

---

## Testing Strategy

### Unit Tests:
- Rule condition evaluation (each operator)
- Antecedent evaluation (AND logic)
- User override detection
- Boost aggregation
- Iteration limiting

### Integration Tests:
- End-to-end search with inference
- Derived constraints in response
- Ranking affected by boosts
- Multiple rule chains

### Manual Testing Steps:

#### First-Hop Rule Testing:
1. Send request with `requiredSeniorityLevel=senior` - verify leadership skills boosted (`skill_tech_leadership`, `skill_mentorship`, `skill_system_design`)
2. Send request with `teamFocus=greenfield` without seniority - verify senior preferred
3. Send request with explicit `preferredSeniorityLevel=junior` + `teamFocus=greenfield` - verify inference overridden
4. Check response includes `derivedConstraints` with explanations

#### Skill-to-Skill Chain Testing (Single Hop):
5. Send request with `requiredSkills=['skill_kubernetes']` - verify Docker and Helm skills boosted
6. Send request with `requiredSkills=['skill_distributed']` - verify observability skills boosted (`skill_monitoring`, `skill_tracing`, `skill_logging`)
7. Send request with `requiredSkills=['skill_microservices']` - verify API design boosted (`skill_api_design`)
8. Send request with `requiredSkills=['skill_event_driven']` - verify messaging boosted (`skill_kafka`, `skill_rabbitmq`)

#### Multi-Hop Chain Testing:
9. Send request with `teamFocus=scaling` (no skills specified):
   - **Iteration 1**: `scaling-needs-distributed` fires → boosts `skill_distributed`
   - **Iteration 2**: `distributed-needs-observability` fires → boosts `skill_monitoring`, `skill_tracing`, `skill_logging`
   - Verify `iterationCount=2` in response and all derived skills present

10. Send request with `teamFocus=scaling` + `requiredSeniorityLevel=senior`:
    - **Iteration 1**: `scaling-needs-distributed` → `skill_distributed`, `senior-needs-leadership` → leadership skills
    - **Iteration 2**: `distributed-needs-observability` → observability skills, `senior-greenfield-needs-microservices` (if greenfield) → `skill_microservices`
    - **Iteration 3**: (if microservices added) `microservices-needs-api-design` → `skill_api_design`
    - Verify multi-iteration chaining and derivation chains in response

11. Verify derivation chain provenance in response shows the full chain (e.g., `["scaling-needs-distributed", "distributed-needs-observability"]` for skills derived via 2-hop)

## Performance Considerations

- **Iteration limit**: Set to 10 to prevent runaway chains
- **Rule count**: Current 15 rules (9 first-hop + 6 skill-to-skill), O(rules * iterations) complexity
- **Caching**: Consider caching inference results for identical requests (future enhancement)
- **Note**: Performance constraint removed as premature optimization - implement first, measure, optimize if needed

## Migration Notes

- No database changes required
- API response is backwards-compatible (new fields only)
- Existing clients can ignore `derivedConstraints` field

## File Structure Summary

After implementation, the following files will be created/modified:

### New Files:
```
recommender_api/src/types/inference-rule.types.ts           # Inference rule type definitions
recommender_api/src/config/knowledge-base/inference-rules.config.ts  # Rule definitions
recommender_api/src/services/inference-engine.service.ts    # Core inference logic
recommender_api/src/services/inference-engine.service.test.ts  # Unit tests
```

### Modified Files:
```
recommender_api/src/types/knowledge-base.types.ts           # Add inference config to interface
recommender_api/src/config/knowledge-base/index.ts          # Export inference rules
recommender_api/src/services/constraint-expander.service.ts # Call inference, extend interface
recommender_api/src/services/utility-calculator/types.ts    # Add derived boosts to context
recommender_api/src/services/utility-calculator/scoring/skill-scoring.ts  # Apply derived boosts
recommender_api/src/services/search.service.ts              # Pass derived constraints
recommender_api/src/types/search.types.ts                   # Add inference source, response fields
```

## References

- Research document: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-iterative-expansion-plan-updates.md`
- Original plan: `thoughts/shared/1_chapter_5/1.5_project_1.5/plans/2025-12-31-iterative-requirement-expansion.md`
- Textbook Section 5.2.1: Iterative requirement expansion
- Current constraint expander: `recommender_api/src/services/constraint-expander.service.ts`
- Knowledge base config: `recommender_api/src/config/knowledge-base/`
