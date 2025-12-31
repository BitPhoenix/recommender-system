# Iterative Requirement Expansion Implementation Plan

## Overview

Implement Section 5.2.1's iterative requirement expansion mechanism where one constraint can trigger additional constraints, which in turn can trigger more constraints. This transforms our one-pass constraint expander into a forward-chaining inference engine that iteratively applies rules until no new constraints can be derived.

## Current State Analysis

The current implementation uses **one-pass, sequential constraint expansion**:

- `constraint-expander.service.ts:60-313` - Each user input mapped independently to database constraints
- `knowledge-base.config.ts:30-109` - Static key-value mappings (seniorityMapping, riskToleranceMapping, etc.)
- No rule chaining: results of one expansion don't trigger other rules

### Key Discoveries:
- Current `expandConstraints()` function processes each field once in sequence (`constraint-expander.service.ts:60-313`)
- Knowledge base uses direct mappings, not inference rules (`knowledge-base.config.ts:30-109`)
- `AppliedConstraint` type already tracks constraint sources (`search.types.ts`)
- Search service orchestrates expansion before query building (`search.service.ts:66-67`)

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
- No performance regression (< 10ms expansion time for typical requests)

## Design Decisions and Rationale

This section explains the reasoning behind our key architectural decisions.

### Decision 1: Boost Semantics (Not Filtering)

**Decision**: Derived constraints affect ranking only, not retrieval filtering.

**Rationale**:
1. **User didn't explicitly request them** - If a user asks for `teamFocus=greenfield`, they didn't explicitly say "exclude anyone without ambiguity tolerance skills." Using derived constraints as hard filters could eliminate valid candidates the user would want to see.

2. **Keeps options open** - Boosts surface the "better-fit" candidates at the top while still allowing the user to see alternatives. A senior engineer without documented leadership skills might still be excellent for the role.

3. **Forgiving of imperfect rule design** - Our rules encode general domain heuristics, not absolute truths. If a rule is slightly wrong (e.g., not all scaling projects need Kafka expertise), boosts degrade gracefully while filters would wrongly exclude candidates.

4. **Matches user expectations** - Users expect the system to be helpful, not restrictive. Boosts feel like "smart suggestions" while filters feel like "the system deciding for me."

5. **Reversible and transparent** - Users can see why candidates rank higher via the explanation chain. With filters, eliminated candidates are invisible, making the system opaque.

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

## What We're NOT Doing

- **Not changing filter semantics** - Derived constraints are boosts only, not hard filters
- **Not building a general-purpose inference engine** - Domain-specific rules for engineer matching
- **Not supporting backward chaining** - Only forward chaining from user requirements
- **Not implementing conflict resolution UI** - Backend handles conflicts automatically (user wins)
- **Not persisting derived rules** - Each request is stateless

## Implementation Approach

We'll extend the existing architecture rather than replace it:

1. Add a new `InferenceRule` type alongside existing mappings
2. Create a `rule-engine.service.ts` that wraps `expandConstraints()`
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
  RiskTolerance,
  TeamFocus,
  ProficiencyLevel,
  AvailabilityOption
} from './search.types.js';

/**
 * Supported constraint fields that can appear in rules.
 */
export type ConstraintField =
  | 'requiredSeniorityLevel'
  | 'requiredRiskTolerance'
  | 'requiredMinProficiency'
  | 'requiredAvailability'
  | 'teamFocus'
  | 'requiredSkills'
  | 'preferredSkills'
  | 'minYearsExperience'
  | 'maxSalary'
  | 'minSalary';

/**
 * Supported boost target fields.
 */
export type BoostField =
  | 'preferredSkills'
  | 'preferredSeniorityLevel'
  | 'preferredAvailability'
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
 * Uses boost semantics - affects ranking, not filtering.
 */
export interface Consequent {
  /** Field to boost */
  boostField: BoostField;
  /** Value to boost toward */
  boostValue: string | string[] | number;
  /** Boost strength (0-1, multiplied by base weight) */
  boostStrength: number;
}

/**
 * A complete inference rule.
 */
export interface InferenceRule {
  /** Unique identifier for the rule */
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
}

/**
 * A derived constraint produced by rule firing.
 */
export interface DerivedConstraint {
  /** The rule that produced this */
  ruleId: string;
  ruleName: string;
  /** The boost being applied */
  boostField: BoostField;
  boostValue: string | string[] | number;
  boostStrength: number;
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

// Add to KnowledgeBaseConfig interface (around line 152)
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

---

## Phase 2: Create Initial Rule Set

### Overview
Populate the knowledge base with inference rules for the engineer matching domain.

### Changes Required:

#### 1. Add Inference Rules to Knowledge Base Config
**File**: `recommender_api/src/config/knowledge-base.config.ts`
**Changes**: Add inferenceRules array with domain-specific rules

```typescript
// Add to knowledgeBaseConfig object:

  // ============================================
  // INFERENCE RULES (Section 5.2.1)
  // ============================================
  // Forward-chaining rules that derive additional constraints.
  // Consequents are BOOSTS (affect ranking) not FILTERS (affect retrieval).

  inferenceRules: [
    // ----------------------------------------
    // SENIORITY-BASED CHAINS
    // ----------------------------------------
    {
      id: 'senior-needs-leadership',
      name: 'Senior+ Implies Leadership Skills',
      antecedent: {
        conditions: [
          { field: 'requiredSeniorityLevel', operator: 'in', value: ['senior', 'staff', 'principal'] }
        ]
      },
      consequent: {
        boostField: 'preferredSkills',
        boostValue: ['skill_mentoring', 'skill_code_review', 'skill_technical_leadership'],
        boostStrength: 0.6,
      },
      rationale: 'Senior engineers typically need leadership and mentoring abilities',
      priority: 50,
      enabled: true,
    },
    {
      id: 'principal-needs-architecture',
      name: 'Principal Implies Architecture Skills',
      antecedent: {
        conditions: [
          { field: 'requiredSeniorityLevel', operator: '=', value: 'principal' }
        ]
      },
      consequent: {
        boostField: 'preferredSkills',
        boostValue: ['skill_system_design', 'skill_architecture', 'skill_technical_vision'],
        boostStrength: 0.8,
      },
      rationale: 'Principal engineers define technical direction and architecture',
      priority: 60,
      enabled: true,
    },
    {
      id: 'junior-needs-mentoring-env',
      name: 'Junior Benefits from Structured Environment',
      antecedent: {
        conditions: [
          { field: 'requiredSeniorityLevel', operator: '=', value: 'junior' }
        ]
      },
      consequent: {
        boostField: 'preferredProficiency',
        boostValue: 'learning',  // Accept learning proficiency
        boostStrength: 0.5,
      },
      rationale: 'Junior engineers may still be developing proficiency',
      priority: 40,
      enabled: true,
    },

    // ----------------------------------------
    // TEAM FOCUS CHAINS
    // ----------------------------------------
    {
      id: 'greenfield-needs-ambiguity-tolerance',
      name: 'Greenfield Projects Need Ambiguity Tolerance',
      antecedent: {
        conditions: [
          { field: 'teamFocus', operator: '=', value: 'greenfield' }
        ]
      },
      consequent: {
        boostField: 'preferredSkills',
        boostValue: ['skill_ambiguity', 'skill_ownership', 'skill_creativity'],
        boostStrength: 0.7,
      },
      rationale: 'New projects require navigating unclear requirements and taking ownership',
      priority: 50,
      enabled: true,
    },
    {
      id: 'greenfield-senior-preferred',
      name: 'Greenfield Benefits from Senior Experience',
      antecedent: {
        conditions: [
          { field: 'teamFocus', operator: '=', value: 'greenfield' }
        ]
      },
      consequent: {
        boostField: 'preferredSeniorityLevel',
        boostValue: 'senior',
        boostStrength: 0.5,
      },
      rationale: 'Greenfield projects benefit from experienced engineers who can handle ambiguity',
      priority: 45,
      enabled: true,
    },
    {
      id: 'migration-needs-documentation',
      name: 'Migration Projects Need Documentation Skills',
      antecedent: {
        conditions: [
          { field: 'teamFocus', operator: '=', value: 'migration' }
        ]
      },
      consequent: {
        boostField: 'preferredSkills',
        boostValue: ['skill_documentation', 'skill_debugging', 'skill_legacy_systems'],
        boostStrength: 0.6,
      },
      rationale: 'Migrations require understanding and documenting both old and new systems',
      priority: 50,
      enabled: true,
    },
    {
      id: 'scaling-needs-distributed',
      name: 'Scaling Projects Need Distributed Systems Skills',
      antecedent: {
        conditions: [
          { field: 'teamFocus', operator: '=', value: 'scaling' }
        ]
      },
      consequent: {
        boostField: 'preferredSkills',
        boostValue: ['skill_distributed', 'skill_performance', 'skill_monitoring', 'skill_kafka'],
        boostStrength: 0.7,
      },
      rationale: 'Scaling work requires performance optimization and distributed systems expertise',
      priority: 50,
      enabled: true,
    },
    {
      id: 'scaling-high-confidence',
      name: 'Scaling Projects Need High Confidence',
      antecedent: {
        conditions: [
          { field: 'teamFocus', operator: '=', value: 'scaling' }
        ]
      },
      consequent: {
        boostField: 'preferredConfidenceScore',
        boostValue: 0.85,
        boostStrength: 0.6,
      },
      rationale: 'Critical infrastructure work benefits from proven track record',
      priority: 55,
      enabled: true,
    },
    {
      id: 'maintenance-needs-debugging',
      name: 'Maintenance Needs Strong Debugging',
      antecedent: {
        conditions: [
          { field: 'teamFocus', operator: '=', value: 'maintenance' }
        ]
      },
      consequent: {
        boostField: 'preferredSkills',
        boostValue: ['skill_debugging', 'skill_root_cause', 'skill_testing', 'skill_code_review'],
        boostStrength: 0.6,
      },
      rationale: 'Maintenance work is primarily bug fixing and quality improvement',
      priority: 50,
      enabled: true,
    },

    // ----------------------------------------
    // RISK TOLERANCE CHAINS
    // ----------------------------------------
    {
      id: 'low-risk-prefers-experience',
      name: 'Low Risk Tolerance Prefers Experience',
      antecedent: {
        conditions: [
          { field: 'requiredRiskTolerance', operator: '=', value: 'low' }
        ]
      },
      consequent: {
        boostField: 'preferredSeniorityLevel',
        boostValue: 'senior',
        boostStrength: 0.5,
      },
      rationale: 'Low risk tolerance benefits from experienced, proven engineers',
      priority: 45,
      enabled: true,
    },
    {
      id: 'high-risk-accepts-learning',
      name: 'High Risk Tolerance Accepts Learning Proficiency',
      antecedent: {
        conditions: [
          { field: 'requiredRiskTolerance', operator: '=', value: 'high' }
        ]
      },
      consequent: {
        boostField: 'preferredProficiency',
        boostValue: 'learning',
        boostStrength: 0.4,
      },
      rationale: 'High risk tolerance means we can consider engineers still developing skills',
      priority: 40,
      enabled: true,
    },

    // ----------------------------------------
    // COMPOUND CHAINS (multiple conditions)
    // ----------------------------------------
    {
      id: 'senior-greenfield-ownership',
      name: 'Senior + Greenfield = Strong Ownership',
      antecedent: {
        conditions: [
          { field: 'requiredSeniorityLevel', operator: 'in', value: ['senior', 'staff', 'principal'] },
          { field: 'teamFocus', operator: '=', value: 'greenfield' }
        ]
      },
      consequent: {
        boostField: 'preferredSkills',
        boostValue: ['skill_ownership', 'skill_technical_leadership', 'skill_system_design'],
        boostStrength: 0.8,
      },
      rationale: 'Senior engineers on greenfield projects need to own and lead technical decisions',
      priority: 70,
      enabled: true,
    },
    {
      id: 'senior-scaling-architecture',
      name: 'Senior + Scaling = Architecture Focus',
      antecedent: {
        conditions: [
          { field: 'requiredSeniorityLevel', operator: 'in', value: ['senior', 'staff', 'principal'] },
          { field: 'teamFocus', operator: '=', value: 'scaling' }
        ]
      },
      consequent: {
        boostField: 'preferredSkills',
        boostValue: ['skill_system_design', 'skill_distributed', 'skill_architecture'],
        boostStrength: 0.8,
      },
      rationale: 'Senior engineers scaling systems need strong architecture skills',
      priority: 70,
      enabled: true,
    },
    {
      id: 'low-risk-scaling-proven',
      name: 'Low Risk + Scaling = Proven Track Record',
      antecedent: {
        conditions: [
          { field: 'requiredRiskTolerance', operator: '=', value: 'low' },
          { field: 'teamFocus', operator: '=', value: 'scaling' }
        ]
      },
      consequent: {
        boostField: 'preferredConfidenceScore',
        boostValue: 0.9,
        boostStrength: 0.7,
      },
      rationale: 'Critical scaling work with low risk tolerance requires highly proven engineers',
      priority: 75,
      enabled: true,
    },

    // ----------------------------------------
    // AVAILABILITY/URGENCY CHAINS
    // ----------------------------------------
    {
      id: 'immediate-flexible-seniority',
      name: 'Immediate Availability = Flexible on Seniority',
      antecedent: {
        conditions: [
          { field: 'requiredAvailability', operator: 'contains', value: 'immediate' }
        ]
      },
      consequent: {
        boostField: 'preferredAvailability',
        boostValue: ['immediate'],
        boostStrength: 0.9,  // Strong boost for immediate availability
      },
      rationale: 'Urgent hiring needs prioritize availability over other factors',
      priority: 60,
      enabled: true,
    },

    // ----------------------------------------
    // BUDGET CHAINS
    // ----------------------------------------
    {
      id: 'junior-budget-junior-seniority',
      name: 'Junior Budget Suggests Junior Seniority',
      antecedent: {
        conditions: [
          { field: 'maxSalary', operator: '<=', value: 100000 }
        ]
      },
      consequent: {
        boostField: 'preferredSeniorityLevel',
        boostValue: 'junior',
        boostStrength: 0.4,
      },
      rationale: 'Budget under $100k aligns with junior-level compensation',
      priority: 35,
      enabled: true,
    },
    {
      id: 'senior-budget-senior-seniority',
      name: 'Senior Budget Enables Senior Seniority',
      antecedent: {
        conditions: [
          { field: 'maxSalary', operator: '>=', value: 200000 }
        ]
      },
      consequent: {
        boostField: 'preferredSeniorityLevel',
        boostValue: 'staff',
        boostStrength: 0.5,
      },
      rationale: 'Budget over $200k enables staff-level compensation',
      priority: 40,
      enabled: true,
    },
  ],

  /** Maximum iterations for forward chaining */
  maxInferenceIterations: 10,
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

---

## Phase 3: Implement Forward-Chaining Inference Engine

### Overview
Create the core inference engine that iteratively applies rules until no new constraints are derived.

### Changes Required:

#### 1. Create Rule Engine Service
**File**: `recommender_api/src/services/rule-engine.service.ts` (new file)

```typescript
/**
 * Rule Engine Service
 * Implements Section 5.2.1 - Iterative requirement expansion via forward chaining.
 *
 * This engine:
 * 1. Takes user requirements as input
 * 2. Iteratively applies inference rules until fixpoint
 * 3. Produces derived constraints (boosts) with explanation chains
 * 4. Respects user overrides (explicit input wins)
 */

import type { SearchFilterRequest } from '../types/search.types.js';
import type {
  InferenceRule,
  Condition,
  DerivedConstraint,
  InferenceResult,
  BoostField,
} from '../types/inference-rule.types.js';
import { knowledgeBaseConfig } from '../config/knowledge-base.config.js';

/**
 * Internal state tracked during inference.
 */
interface InferenceState {
  /** Current set of active constraints (user + derived) */
  activeConstraints: Map<string, unknown>;
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
  if (request.requiredRiskTolerance !== undefined) explicit.add('requiredRiskTolerance');
  if (request.requiredMinProficiency !== undefined) explicit.add('requiredMinProficiency');
  if (request.requiredAvailability !== undefined) explicit.add('requiredAvailability');
  if (request.teamFocus !== undefined) explicit.add('teamFocus');
  if (request.requiredSkills !== undefined && request.requiredSkills.length > 0) explicit.add('requiredSkills');
  if (request.preferredSkills !== undefined && request.preferredSkills.length > 0) explicit.add('preferredSkills');
  if (request.requiredMaxSalary !== undefined) explicit.add('maxSalary');
  if (request.requiredMinSalary !== undefined) explicit.add('minSalary');
  if (request.preferredSeniorityLevel !== undefined) explicit.add('preferredSeniorityLevel');
  if (request.preferredAvailability !== undefined) explicit.add('preferredAvailability');
  if (request.preferredConfidenceScore !== undefined) explicit.add('preferredConfidenceScore');
  if (request.preferredProficiency !== undefined) explicit.add('preferredProficiency');

  return explicit;
}

/**
 * Converts request to a map for condition checking.
 */
function requestToConstraintMap(request: SearchFilterRequest): Map<string, unknown> {
  const map = new Map<string, unknown>();

  if (request.requiredSeniorityLevel) map.set('requiredSeniorityLevel', request.requiredSeniorityLevel);
  if (request.requiredRiskTolerance) map.set('requiredRiskTolerance', request.requiredRiskTolerance);
  if (request.requiredMinProficiency) map.set('requiredMinProficiency', request.requiredMinProficiency);
  if (request.requiredAvailability) map.set('requiredAvailability', request.requiredAvailability);
  if (request.teamFocus) map.set('teamFocus', request.teamFocus);
  if (request.requiredSkills) map.set('requiredSkills', request.requiredSkills);
  if (request.requiredMaxSalary !== undefined) map.set('maxSalary', request.requiredMaxSalary);
  if (request.requiredMinSalary !== undefined) map.set('minSalary', request.requiredMinSalary);

  return map;
}

/**
 * Checks if a single condition is satisfied.
 */
function evaluateCondition(condition: Condition, constraints: Map<string, unknown>): boolean {
  const value = constraints.get(condition.field);

  // Field not set - condition cannot be satisfied
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
      // Value is in the condition's array
      if (Array.isArray(condition.value)) {
        return condition.value.includes(value as string);
      }
      return false;

    case 'contains':
      // Value (array) contains the condition's value
      if (Array.isArray(value)) {
        return value.includes(condition.value as string);
      }
      return false;

    default:
      return false;
  }
}

/**
 * Checks if all conditions in an antecedent are satisfied (AND logic).
 */
function evaluateAntecedent(
  rule: InferenceRule,
  constraints: Map<string, unknown>
): boolean {
  return rule.antecedent.conditions.every(cond => evaluateCondition(cond, constraints));
}

/**
 * Checks if a rule's consequent would conflict with user-explicit fields.
 */
function wouldOverrideUser(
  rule: InferenceRule,
  userExplicitFields: Set<string>
): boolean {
  // Map boost fields to their corresponding explicit field names
  const boostToExplicit: Record<BoostField, string> = {
    'preferredSkills': 'preferredSkills',
    'preferredSeniorityLevel': 'preferredSeniorityLevel',
    'preferredAvailability': 'preferredAvailability',
    'preferredConfidenceScore': 'preferredConfidenceScore',
    'preferredProficiency': 'preferredProficiency',
    'utilityWeightAdjustment': 'utilityWeightAdjustment', // Never user-set
  };

  const targetField = boostToExplicit[rule.consequent.boostField];
  return userExplicitFields.has(targetField);
}

/**
 * Applies a rule's consequent to produce a derived constraint.
 */
function applyRule(
  rule: InferenceRule,
  derivationChain: string[]
): DerivedConstraint {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    boostField: rule.consequent.boostField,
    boostValue: rule.consequent.boostValue,
    boostStrength: rule.consequent.boostStrength,
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

  // Initialize state
  const state: InferenceState = {
    activeConstraints: requestToConstraintMap(request),
    firedRuleIds: new Set(),
    derivedConstraints: [],
    overriddenRuleIds: new Set(),
    userExplicitFields: extractUserExplicitFields(request),
  };

  const warnings: string[] = [];
  let iteration = 0;
  let changed = true;

  // Forward chaining loop
  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    // Sort rules by priority (higher priority first)
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      // Skip if already fired
      if (state.firedRuleIds.has(rule.id)) {
        continue;
      }

      // Check if antecedent is satisfied
      if (!evaluateAntecedent(rule, state.activeConstraints)) {
        continue;
      }

      // Check if this would override user-explicit field
      if (wouldOverrideUser(rule, state.userExplicitFields)) {
        state.overriddenRuleIds.add(rule.id);
        state.derivedConstraints.push({
          ...applyRule(rule, []),
          overriddenByUser: true,
        });
        state.firedRuleIds.add(rule.id);
        continue;
      }

      // Apply the rule
      const derived = applyRule(rule, []);
      state.derivedConstraints.push(derived);
      state.firedRuleIds.add(rule.id);
      changed = true;

      // Note: We don't update activeConstraints with derived constraints
      // because derived constraints are BOOSTS, not new filter conditions.
      // Only user requirements and their direct expansions can trigger rules.
    }
  }

  if (iteration >= maxIterations) {
    warnings.push(`Reached maximum inference iterations (${maxIterations}). Some rules may not have been evaluated.`);
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
 * Aggregates derived skill boosts into a single list with combined strengths.
 */
export function aggregateDerivedSkillBoosts(
  derivedConstraints: DerivedConstraint[]
): Map<string, number> {
  const skillBoosts = new Map<string, number>();

  for (const dc of derivedConstraints) {
    if (dc.overriddenByUser) continue;
    if (dc.boostField !== 'preferredSkills') continue;

    const skills = Array.isArray(dc.boostValue) ? dc.boostValue : [dc.boostValue];
    for (const skill of skills) {
      const current = skillBoosts.get(skill as string) || 0;
      // Combine boosts: take max rather than sum to avoid over-boosting
      skillBoosts.set(skill as string, Math.max(current, dc.boostStrength));
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
    .filter(dc => !dc.overriddenByUser && dc.boostField === field)
    .sort((a, b) => b.boostStrength - a.boostStrength);

  if (relevant.length === 0) return null;

  return {
    value: relevant[0].boostValue,
    strength: relevant[0].boostStrength,
  };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] No linting errors: `npm run lint`
- [ ] Unit tests pass for rule engine

#### Manual Verification:
- [ ] Test with sample requests to verify rule firing
- [ ] Verify user override logic works correctly

---

## Phase 4: Integrate with Constraint Expander

### Overview
Wire the inference engine into the existing search pipeline so derived constraints affect utility calculation.

### Changes Required:

#### 1. Update ExpandedConstraints Type
**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Changes**: Add derived constraints to the output

```typescript
// Add import at top
import type { DerivedConstraint } from '../types/inference-rule.types.js';

// Update ExpandedConstraints interface (around line 18)
export interface ExpandedConstraints {
  // ... existing fields ...

  /** Derived constraints from inference engine */
  derivedConstraints: DerivedConstraint[];

  /** Aggregated skill boosts from derived constraints */
  derivedSkillBoosts: Map<string, number>;
}
```

#### 2. Call Inference Engine in expandConstraints
**File**: `recommender_api/src/services/constraint-expander.service.ts`
**Changes**: Add inference step after direct mappings

```typescript
// Add import at top
import { runInference, aggregateDerivedSkillBoosts } from './rule-engine.service.js';

// At end of expandConstraints function, before return (around line 290):

  // ============================================
  // INFERENCE ENGINE - Iterative Expansion
  // ============================================
  const inferenceResult = runInference(request);
  const derivedSkillBoosts = aggregateDerivedSkillBoosts(inferenceResult.derivedConstraints);

  // Track inference metadata in applied constraints
  for (const dc of inferenceResult.derivedConstraints) {
    if (!dc.overriddenByUser) {
      appliedConstraints.push({
        field: dc.boostField,
        operator: 'BOOST',
        value: JSON.stringify(dc.boostValue),
        source: 'inference',
      });
    }
  }

  return {
    // ... existing fields ...
    derivedConstraints: inferenceResult.derivedConstraints,
    derivedSkillBoosts,
  };
```

#### 3. Update Utility Calculator to Use Derived Boosts
**File**: `recommender_api/src/services/utility-calculator.service.ts`
**Changes**: Factor in derived skill boosts

```typescript
// Add to UtilityContext interface:
export interface UtilityContext {
  // ... existing fields ...

  /** Derived skill boosts from inference engine */
  derivedSkillBoosts: Map<string, number>;

  /** All derived constraints for potential use */
  derivedConstraints: DerivedConstraint[];
}

// In calculateSkillMatchScore or wherever skill scoring happens:
// Add derived boost contribution
function applyDerivedSkillBoosts(
  baseScore: number,
  matchedSkillIds: string[],
  derivedSkillBoosts: Map<string, number>
): number {
  let boost = 0;
  for (const skillId of matchedSkillIds) {
    const derivedBoost = derivedSkillBoosts.get(skillId);
    if (derivedBoost) {
      boost += derivedBoost;
    }
  }
  // Normalize: max boost is 0.2 additional (20% of base weight)
  const normalizedBoost = Math.min(boost / matchedSkillIds.length, 0.2);
  return baseScore * (1 + normalizedBoost);
}
```

#### 4. Update Search Service to Pass Derived Constraints
**File**: `recommender_api/src/services/search.service.ts`
**Changes**: Pass derived constraints through to utility calculator

```typescript
// Around line 246, update utilityContext:
  const utilityContext: UtilityContext = {
    // ... existing fields ...
    derivedSkillBoosts: expanded.derivedSkillBoosts,
    derivedConstraints: expanded.derivedConstraints,
  };
```

#### 5. Update API Response to Include Derived Constraints
**File**: `recommender_api/src/types/search.types.ts`
**Changes**: Add derivedConstraints to response type

```typescript
// Add to SearchFilterResponse interface:
export interface SearchFilterResponse {
  // ... existing fields ...

  /** Constraints derived by inference engine */
  derivedConstraints: Array<{
    ruleName: string;
    boostField: string;
    boostValue: unknown;
    explanation: string;
    overriddenByUser: boolean;
  }>;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] No linting errors: `npm run lint`
- [ ] All existing tests still pass
- [ ] Integration tests show derived constraints in response

#### Manual Verification:
- [ ] API response includes derivedConstraints array
- [ ] Verify boost affects ranking order
- [ ] Test user override blocks inference correctly

---

## Phase 5: Add Comprehensive Tests

### Overview
Create unit and integration tests for the inference engine and rule chaining.

### Changes Required:

#### 1. Unit Tests for Rule Engine
**File**: `recommender_api/src/services/__tests__/rule-engine.service.test.ts` (new file)

```typescript
import { describe, it, expect } from 'vitest';
import { runInference } from '../rule-engine.service.js';
import type { SearchFilterRequest } from '../../types/search.types.js';

describe('Rule Engine Service', () => {
  describe('runInference', () => {
    it('should fire senior-needs-leadership for senior seniority', () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
      };

      const result = runInference(request);

      expect(result.firedRules).toContain('senior-needs-leadership');
      expect(result.derivedConstraints).toContainEqual(
        expect.objectContaining({
          ruleId: 'senior-needs-leadership',
          boostField: 'preferredSkills',
        })
      );
    });

    it('should fire multiple rules for compound conditions', () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
        teamFocus: 'greenfield',
      };

      const result = runInference(request);

      // Should fire both individual and compound rules
      expect(result.firedRules).toContain('senior-needs-leadership');
      expect(result.firedRules).toContain('greenfield-needs-ambiguity-tolerance');
      expect(result.firedRules).toContain('senior-greenfield-ownership');
    });

    it('should respect user override on preferredSeniorityLevel', () => {
      const request: SearchFilterRequest = {
        teamFocus: 'greenfield',
        preferredSeniorityLevel: 'junior',  // User explicitly wants junior
      };

      const result = runInference(request);

      // greenfield-senior-preferred should be marked as overridden
      expect(result.overriddenRules).toContain('greenfield-senior-preferred');

      const overriddenConstraint = result.derivedConstraints.find(
        dc => dc.ruleId === 'greenfield-senior-preferred'
      );
      expect(overriddenConstraint?.overriddenByUser).toBe(true);
    });

    it('should not fire rules when antecedent is not satisfied', () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'junior',
      };

      const result = runInference(request);

      // senior-needs-leadership should NOT fire
      expect(result.firedRules).not.toContain('senior-needs-leadership');
    });

    it('should handle budget-based rules', () => {
      const request: SearchFilterRequest = {
        requiredMaxSalary: 90000,
      };

      const result = runInference(request);

      expect(result.firedRules).toContain('junior-budget-junior-seniority');
    });

    it('should handle empty request', () => {
      const request: SearchFilterRequest = {};

      const result = runInference(request);

      expect(result.firedRules).toHaveLength(0);
      expect(result.iterationCount).toBe(1);
    });
  });
});
```

#### 2. Integration Tests for Search with Inference
**File**: `recommender_api/src/__tests__/search-inference.integration.test.ts` (new file)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// ... setup Neo4j test connection ...

describe('Search API with Inference', () => {
  it('should include derivedConstraints in response', async () => {
    const response = await executeSearch(session, {
      requiredSeniorityLevel: 'senior',
      teamFocus: 'scaling',
    });

    expect(response.derivedConstraints).toBeDefined();
    expect(response.derivedConstraints.length).toBeGreaterThan(0);

    // Should have explanation
    const constraint = response.derivedConstraints[0];
    expect(constraint.explanation).toBeTruthy();
  });

  it('should boost ranking based on derived constraints', async () => {
    // Test that engineers matching derived skill boosts rank higher
    // ... implementation depends on test data ...
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All unit tests pass: `npm test`
- [ ] All integration tests pass
- [ ] Code coverage > 80% for rule engine

#### Manual Verification:
- [ ] Review test coverage for edge cases
- [ ] Verify tests cover user override scenarios

---

## Phase 6: Documentation and API Updates

### Overview
Update API documentation and add user-facing explanation of derived constraints.

### Changes Required:

#### 1. Update OpenAPI Schema
**File**: `recommender_api/src/routes/search.routes.ts` or OpenAPI spec
**Changes**: Document new response fields

#### 2. Add Inference Explanation to README
**File**: `recommender_api/README.md`
**Changes**: Document inference behavior

### Success Criteria:

#### Automated Verification:
- [ ] OpenAPI schema is valid
- [ ] Docs build without errors

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
1. Send request with `requiredSeniorityLevel=senior` - verify leadership skills boosted
2. Send request with `teamFocus=greenfield` without seniority - verify senior preferred
3. Send request with explicit `preferredSeniorityLevel=junior` + `teamFocus=greenfield` - verify inference overridden
4. Check response includes `derivedConstraints` with explanations

## Performance Considerations

- **Iteration limit**: Set to 10 to prevent runaway chains
- **Rule count**: Current 15 rules, O(rules * iterations) complexity
- **Caching**: Consider caching inference results for identical requests
- **Target**: < 5ms inference time for typical requests

## Migration Notes

- No database changes required
- API response is backwards-compatible (new fields only)
- Existing clients can ignore `derivedConstraints` field

## References

- Research document: `thoughts/shared/research/2025-12-31-requirement-expansion-analysis.md`
- Textbook Section 5.2.1: `docs/chapter_5/chapter5_raw.txt:389-416`
- Current constraint expander: `recommender_api/src/services/constraint-expander.service.ts:60-313`
- Knowledge base config: `recommender_api/src/config/knowledge-base.config.ts:30-109`
