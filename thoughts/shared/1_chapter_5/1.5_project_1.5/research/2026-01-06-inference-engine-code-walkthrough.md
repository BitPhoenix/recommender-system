# Inference Engine Code Walkthrough

**Date**: 2026-01-06T15:30:00-08:00 (Updated: 2026-01-08)
**Researcher**: Claude
**Git Commit**: bc75c7446425b86af35a1a5fb8dcaecaf7a6366a (original), updated for explicit rule override, implicit filter override, override object refactor, derivation chain provenance, multi-trigger derivation chains (2D format), eventToDerivedConstraint refactor, and processedConstraintIds optimization
**Branch**: main
**Repository**: recommender-system

---

## What You'll Learn

This walkthrough explains the **iterative requirement expansion** feature (Section 5.2.1 of the textbook). By the end, you'll understand:

1. How user search requirements trigger derived constraints
2. How rules chain together (multi-hop inference)
3. The difference between filter rules (hard requirements) and boost rules (soft preferences)
4. How the system respects user intent when it conflicts with derived rules
5. How users can explicitly override specific rules via `overriddenRuleIds`
6. How implicit filter overrides work when users already handle a skill
7. How derivation chains track the full causal path for multi-hop rules

---

## The Big Picture: What Problem Does This Solve?

When a hiring manager searches for an engineer, they often specify high-level needs like "scaling focus" or "senior level." But these imply deeper requirements:

- **Scaling** implies distributed systems expertise
- **Distributed systems** implies monitoring/observability skills
- **Senior level** implies mentorship capabilities

Instead of requiring users to specify every implied skill, the inference engine **automatically expands requirements** using domain knowledge rules.

### Real-World Analogy (from the textbook)

The textbook uses real estate as an example:
```
Family-Size=6 → Min-Bedrooms≥3 → Bedrooms≥3, Price≥100,000
             → Min-Bathrooms≥2 → Bathrooms≥2
```

Our implementation does the same for engineer matching:
```
teamFocus=scaling → skill_distributed → skill_monitoring
                                      → skill_tracing
```

---

## File Reading Order

Read the files in this order to build understanding progressively:

| Order | File | Purpose | Lines |
|-------|------|---------|-------|
| 1 | `types/inference-rule.types.ts` | Domain concepts (what a constraint means) | ~50 |
| 2 | `types/rule-engine.types.ts` | Bridge to json-rules-engine library | ~60 |
| 3 | `config/knowledge-base/inference-rules/` | The actual rules (business logic) | ~250 |
| 4 | `services/rule-engine-adapter.ts` | Utility functions for rule engine | ~550 |
| 5 | `services/inference-engine.service.ts` | The main algorithm (forward chaining) | ~150 |
| 6 | `services/constraint-expander.service.ts` | Integration point | ~200 |

---

## Part 1: Understanding the Types

### File: `recommender_api/src/types/inference-rule.types.ts`

This file defines **what a derived constraint means** in our domain, independent of any rules library.

**Key Concept: DerivedConstraint**

When a rule fires, it produces a `DerivedConstraint`. Properties are grouped by semantic concern:

```typescript
/**
 * Target fields that inference rules can affect.
 */
export type ConstraintTargetField =
  | "derivedSkills"  // Skills to add (filter → required, boost → preferred)
  | "preferredSeniorityLevel"
  | "preferredMaxStartTime"
  | "preferredConfidenceScore"
  | "preferredProficiency";

export type OverrideScope = 'FULL' | 'PARTIAL';

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

/**
 * Rich information about an overridden rule.
 * Provides transparency about what was overridden and how.
 */
export interface OverriddenRuleInfo {
  ruleId: string;
  overrideScope: OverrideScope;
  overriddenSkills: string[];
  reasonType: OverrideReasonType;  // NEW: explains why the rule was overridden
}

/**
 * Result of the inference engine.
 */
export interface InferenceResult {
  derivedConstraints: DerivedConstraint[];
  firedRules: string[];
  overriddenRules: OverriddenRuleInfo[];  // Rich override info, not just rule IDs
  iterationCount: number;
  warnings: string[];

  /* Extracted results for convenience (computed from derivedConstraints) */

  /** Skills that MUST be matched (from filter rules targeting derivedSkills) */
  derivedRequiredSkillIds: string[];
  /** Aggregated skill boosts from boost rules (max strength wins) */
  derivedSkillBoosts: Map<string, number>;
}

export interface DerivedConstraint {
  /** Rule identification */
  rule: {
    id: string;           // "scaling-requires-distributed"
    name: string;         // Human-readable name for UI
  };

  /** What the constraint does */
  action: {
    effect: 'filter' | 'boost';  // Hard requirement vs soft preference
    targetField: ConstraintTargetField;  // What field to modify
    targetValue: string | string[] | number;  // What to add (may be reduced for partial overrides)
    boostStrength?: number;   // 0-1, only for boost rules
  };

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
    derivationChains: string[][];
    explanation: string;       // Why this was derived
  };

  /** Override information - only present when user overrode this constraint */
  override?: {
    overrideScope: OverrideScope;  // FULL = entire constraint overridden, PARTIAL = some skills user-handled
    overriddenSkills: string[];     // Which skills were user-handled
    reasonType: OverrideReasonType; // Why the override happened (explicit-rule-override, implicit-field-override, implicit-skill-override)
  };
}

// Helper functions for checking override status
export function isFullyOverridden(constraint: DerivedConstraint): boolean {
  return constraint.override?.overrideScope === 'FULL';
}

export function isPartiallyOverridden(constraint: DerivedConstraint): boolean {
  return constraint.override?.overrideScope === 'PARTIAL';
}

export function hasAnyOverride(constraint: DerivedConstraint): boolean {
  return constraint.override !== undefined;
}

// Primitive helpers for effect type checking
export function isFilterConstraint(constraint: DerivedConstraint): boolean {
  return constraint.action.effect === 'filter';
}

export function isBoostConstraint(constraint: DerivedConstraint): boolean {
  return constraint.action.effect === 'boost';
}

// Composable helpers for filtering effective skill constraints
export function isEffectiveSkillConstraint(constraint: DerivedConstraint): boolean {
  return !isFullyOverridden(constraint) && constraint.action.targetField === 'derivedSkills';
}

export function isEffectiveSkillFilter(constraint: DerivedConstraint): boolean {
  return isEffectiveSkillConstraint(constraint) && isFilterConstraint(constraint);
}

export function isEffectiveSkillBoost(constraint: DerivedConstraint): boolean {
  return isEffectiveSkillConstraint(constraint) && isBoostConstraint(constraint);
}
```

**Mental Model**: Think of `DerivedConstraint` as a "conclusion" the system reached by applying rules. Each conclusion has:
- What it affects (`action.targetField`)
- Whether it's mandatory or optional (`action.effect`)
- Why it was derived (`provenance.explanation`, `provenance.derivationChains`)
- Whether the user overrode it (`override?.overrideScope`)

### File: `recommender_api/src/types/rule-engine.types.ts`

This file bridges our domain types with the `json-rules-engine` library.

**Key Concept: InferenceContext**

The context is the "working memory" that rules evaluate against. It's organized into semantic groups:

```typescript
/*
 * Provenance types for tracking derivation chains (2D: array of chains).
 * Each value is an array of chains (string[][]) to support multiple trigger paths.
 *
 * When a derived value can be reached through multiple paths (e.g., a skill derived
 * by both rule-a and rule-b independently), all chains are preserved for transparency.
 *
 * Key: skill ID or normalized property name
 * Value: array of derivation chains (each chain is an array of rule IDs)
 *   - User-provided values: [['user-input']]
 *   - Rule-derived values: [['source-rule', ..., 'current-rule']]
 *   - Multi-path values: [['path-a'], ['path-b']]
 */
export type SkillProvenance = Map<string, string[][]>;  // skill ID → array of chains
export type RequiredPropertyProvenance = Map<string, string[][]>;  // normalized key → array of chains
export type PreferredPropertyProvenance = Map<string, string[][]>;  // normalized key → array of chains

/**
 * Normalize property keys by stripping required/preferred prefix.
 * Example: 'requiredSeniorityLevel' → 'seniorityLevel'
 *          'preferredMaxStartTime' → 'maxStartTime'
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

export interface InferenceContext {
  request: SearchFilterRequest & {
    skills: string[];  // Flattened skill names for convenient 'contains' checks
  };
  derived: {
    allSkills: string[];     // Grows as rules fire (enables chaining)

    // Property containers with normalized keys (for chaining non-skill rules)
    requiredProperties: Record<string, string>;   // e.g., { seniorityLevel: 'senior' }
    preferredProperties: Record<string, string>;  // e.g., { seniorityLevel: 'senior' }

    // Provenance maps for tracking derivation chains
    skillProvenance: SkillProvenance;                         // skill ID → chain
    requiredPropertyProvenance: RequiredPropertyProvenance;   // normalized key → chain
    preferredPropertyProvenance: PreferredPropertyProvenance; // normalized key → chain
  };
  meta: {
    userExplicitFields: string[];  // ALL fields the user explicitly set (defense in depth)
    overriddenRuleIds: string[];   // Rules explicitly overridden by user
    userExplicitSkills: string[];  // Skills explicitly mentioned by user (required OR preferred)
  };
}
```

**Design Notes**:
- `request` extends `SearchFilterRequest` directly, so new fields are automatically available to rules
- `skills` is a convenience field (flattened from `requiredSkills[].skill`) for simple array checks
- Rules access fields via paths like `$.requiredSeniorityLevel`, `$.teamFocus`, `$.skills`

**Property Containers and Provenance**:

The `derived` object now has two property containers:
- `requiredProperties`: Values from user's `required*` fields + filter rule outputs (normalized keys)
- `preferredProperties`: Values from user's `preferred*` fields + boost rule outputs (normalized keys)

And three provenance maps:
- `skillProvenance`: Maps skill ID → array of chains (e.g., `'skill_distributed' → [['scaling-requires-distributed']]`)
- `requiredPropertyProvenance`: Maps normalized key → array of chains for required properties
- `preferredPropertyProvenance`: Maps normalized key → array of chains for preferred properties

**Why 2D Arrays?** A single derived value can have multiple causal paths when:
- Same skill derived by independent rules
- Chain rule has conditions in `any` (OR) block satisfied by different derived values
- Same value reached through different rule paths

**Why Normalized Keys?** Both containers use the same key format (`seniorityLevel` instead of `requiredSeniorityLevel`/`preferredSeniorityLevel`). This allows chain rules to check a single path like `$.requiredProperties.seniorityLevel` regardless of whether the value came from user input or a rule.

**Why Nested?** This structure separates concerns:
- `request`: Read-only inputs from the user's search (don't mutate during inference)
- `derived`: Mutable state that grows during iterations (skills, properties, provenance)
- `meta`: Tracking fields for rule behavior (implicit field overrides via `userExplicitFields`, explicit overrides via `overriddenRuleIds`, implicit skill overrides via `userExplicitSkills`)

**Critical Insight**: The `derived.allSkills` array and property containers enable **multi-hop chaining**. When a rule fires:
- Skill rules: Add skills to `allSkills`, which can trigger other skill-based rules
- Property rules: Add to `requiredProperties`/`preferredProperties`, which can trigger property-based rules
- Provenance is tracked so each constraint knows its full derivation chain

---

## Part 2: The Rules (Business Logic)

### Directory: `recommender_api/src/config/knowledge-base/inference-rules/`

Rules are organized by type following the Single Responsibility Principle:

```
inference-rules/
  index.ts                   # Combines and exports all rules
  filter-rules.config.ts     # Hard constraints (X-requires-Y) - 3 rules
  boost-rules.config.ts      # Soft preferences (X-prefers-Y) - 12 rules
```

The directory contains ~15 rules that encode domain knowledge. Rules come in three flavors:

### Rule Type 1: First-Hop Rules (User Input → Skills)

These directly map user requirements to derived constraints:

```typescript
{
  name: 'Scaling Requires Distributed Systems',
  priority: 50,
  conditions: {
    all: [{
      fact: 'request',
      path: '$.teamFocus',
      operator: 'equal',
      value: 'scaling'
    }]
  },
  event: {
    type: 'derived-filter',  // Hard requirement
    params: {
      ruleId: 'scaling-requires-distributed',
      targetField: 'derivedSkills',
      targetValue: ['skill_distributed'],
      rationale: 'Scaling work requires distributed systems expertise'
    }
  }
}
```

**Reading this rule**: "IF `request.teamFocus` is 'scaling', THEN require distributed systems skill (hard filter)."

**Path Syntax**: Rules use JSONPath (`$.fieldName`) to access nested facts. The `fact` specifies the top-level group (`request`, `derived`, `meta`), and `path` drills into it.

### Rule Type 2: Skill Chain Rules (Skills → More Skills)

These enable multi-hop inference by checking `derived.allSkills`:

```typescript
{
  name: 'Distributed Systems Require Observability',
  priority: 40,
  conditions: {
    all: [{
      fact: 'derived',
      path: '$.allSkills',
      operator: 'contains',  // Custom operator
      value: 'skill_distributed'
    }]
  },
  event: {
    type: 'derived-filter',
    params: {
      ruleId: 'distributed-requires-observability',
      targetField: 'derivedSkills',
      targetValue: ['skill_monitoring'],
      rationale: 'Cannot effectively work on distributed systems without monitoring'
    }
  }
}
```

**Reading this rule**: "IF `derived.allSkills` contains distributed systems (either user-specified OR derived), THEN also require monitoring skill."

### Rule Type 3: Property Chain Rules (Fire from Derived Properties)

Some rules chain from derived property values (not just skills). These use the property containers:

```typescript
{
  name: 'Senior+ Benefits from Leadership Skills',
  priority: 35,  // Chain rule (fires after seniority may be derived)
  conditions: {
    any: [
      // Fire from user's required seniority (normalized key in requiredProperties)
      { fact: 'derived', path: '$.requiredProperties.seniorityLevel', operator: 'in', value: ['senior', 'staff', 'principal'] },
      // Fire from rule-derived preferred seniority (normalized key in preferredProperties)
      { fact: 'derived', path: '$.preferredProperties.seniorityLevel', operator: 'in', value: ['senior', 'staff', 'principal'] },
    ]
  },
  event: {
    type: 'derived-boost',
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

**Reading this rule**: "IF `derived.requiredProperties.seniorityLevel` OR `derived.preferredProperties.seniorityLevel` is senior/staff/principal, THEN boost leadership skills."

**Why `any` conditions?** The rule fires from EITHER container:
- `requiredProperties.seniorityLevel`: User set `requiredSeniorityLevel` in request
- `preferredProperties.seniorityLevel`: A boost rule (like `greenfield-prefers-senior`) derived it

This enables chains like:
```
teamFocus=greenfield → greenfield-prefers-senior (derives preferredSeniorityLevel:senior)
                     → senior-prefers-leadership (chain fires from preferredProperties)
```

### Rule Type 4: Compound Rules (Multiple Conditions)

These fire only when multiple conditions are met:

```typescript
{
  name: 'Senior + Greenfield Prefers Ownership',
  priority: 30,
  conditions: {
    all: [
      { fact: 'request', path: '$.requiredSeniorityLevel', operator: 'in', value: ['senior', 'staff', 'principal'] },
      { fact: 'request', path: '$.teamFocus', operator: 'equal', value: 'greenfield' }
    ]
  },
  event: {
    type: 'derived-boost',
    params: {
      ruleId: 'senior-greenfield-prefers-ownership',
      targetField: 'derivedSkills',
      targetValue: ['skill_ownership'],
      boostStrength: 0.7,
      rationale: 'Senior developers on greenfield projects need ownership mindset'
    }
  }
}
```

### Filter vs Boost: The Key Distinction

| Type | Event Type | File | Example | Behavior |
|------|------------|------|---------|----------|
| **Filter** | `derived-filter` | `filter-rules.config.ts` | kubernetes-requires-containers | Excludes candidates without Docker |
| **Boost** | `derived-boost` | `boost-rules.config.ts` | senior-prefers-leadership | Ranks leadership skills higher |

**Naming Convention**:
- `X-requires-Y` = filter (hard) → add to `filter-rules.config.ts`
- `X-prefers-Y` = boost (soft) → add to `boost-rules.config.ts`

---

## Part 3: The Rule Engine Adapter

### File: `recommender_api/src/services/rule-engine-adapter.ts`

This file provides utilities for working with the rules engine.

### Function: `createInferenceContext(request)`

Converts a search request into context for rule evaluation:

```typescript
export function createInferenceContext(request: SearchFilterRequest): InferenceContext {
  const skillNames = (request.requiredSkills || []).map(s => s.skill);

  // Build initial skill provenance for user-provided skills (2D: array of chains)
  const skillProvenance: SkillProvenance = new Map();
  for (const skill of skillNames) {
    skillProvenance.set(skill, [['user-input']]);  // Special marker for user-provided
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
      requiredPropertyProvenance.set(normalizedKey, [['user-input']]);
    } else if (key.startsWith('preferred')) {
      preferredProperties[normalizedKey] = value;
      preferredPropertyProvenance.set(normalizedKey, [['user-input']]);
    }
  }

  return {
    request: {
      ...request,  // Spread all fields directly (no manual mapping)
      skills: skillNames,  // Convenience field for 'contains' checks
    },
    derived: {
      allSkills: [...skillNames],  // Starts with user's REQUIRED skills only
      requiredProperties,
      preferredProperties,
      skillProvenance,
      requiredPropertyProvenance,
      preferredPropertyProvenance,
    },
    meta: {
      userExplicitFields: extractUserExplicitFields(request),
      overriddenRuleIds: request.overriddenRuleIds || [],  // Explicit rule overrides
      userExplicitSkills: extractUserExplicitSkills(request),  // Implicit filter overrides
    },
  };
}
```

**Key Points**:
- **Spread pattern**: The request is spread directly so new `SearchFilterRequest` fields are automatically available to rules without manual mapping
- **Convenience field**: `skills` is a flattened array of skill names (extracted from `requiredSkills[].skill`) for simple `contains` checks in rules
- **Chaining seed**: `derived.allSkills` starts as a copy of user's **required** skills (NOT preferred) but will grow as rules fire
- **User explicit skills**: `userExplicitSkills` contains BOTH required and preferred skills for implicit filter override detection
- **Property containers**: User's `required*` fields populate `requiredProperties`, `preferred*` fields populate `preferredProperties`
- **Provenance initialization**: User-provided values get `[['user-input']]` marker in their provenance maps (2D format)

### Function: `extractDerivedTriggers(rules, ruleId)`

Detects which derived value(s) triggered a chain rule by analyzing its conditions:

```typescript
interface DerivedTrigger {
  type: 'skill' | 'requiredProperty' | 'preferredProperty';
  provenanceKey: string;  // Normalized key to look up in provenance map
}

function extractDerivedTriggers(rules, ruleId): DerivedTrigger[] {
  const rule = rules.find(r => r.event.params.ruleId === ruleId);
  if (!rule) return [];

  const triggers: DerivedTrigger[] = [];
  const conditions = rule.conditions;
  const allConditions = [...(conditions.all || []), ...(conditions.any || [])];

  for (const condition of allConditions) {
    if (condition.fact !== 'derived') continue;

    const path = condition.path;
    if (typeof path !== 'string' || !path.startsWith('$.')) continue;

    if (path === '$.allSkills' && condition.operator === 'contains') {
      // Skill trigger: $.allSkills contains 'skill_x'
      triggers.push({ type: 'skill', provenanceKey: condition.value });
    } else if (path.startsWith('$.requiredProperties.')) {
      // Required property trigger: $.requiredProperties.seniorityLevel
      triggers.push({ type: 'requiredProperty', provenanceKey: path.replace('$.requiredProperties.', '') });
    } else if (path.startsWith('$.preferredProperties.')) {
      // Preferred property trigger: $.preferredProperties.seniorityLevel
      triggers.push({ type: 'preferredProperty', provenanceKey: path.replace('$.preferredProperties.', '') });
    }
  }

  return triggers;
}
```

**Key Insight**: This function identifies what caused a chain rule to fire. Returns empty array for first-hop rules (they check `request` facts, not `derived` facts).

**Example 1: First-Hop Rule (returns empty array)**

From `filter-rules.config.ts`:
```typescript
// Rule: scaling-requires-distributed
const scalingRequiresDistributed = {
  conditions: {
    all: [{ fact: 'request', path: '$.teamFocus', operator: 'equal', value: 'scaling' }]
  },
  event: { params: { ruleId: 'scaling-requires-distributed', ... } }
};

extractDerivedTriggers(rules, 'scaling-requires-distributed')
// Returns: []
// Why: Condition checks `request.teamFocus`, not any `derived` fact
```

**Example 2: Skill Chain Rule**

From `filter-rules.config.ts`:
```typescript
// Rule: distributed-requires-observability
const distributedRequiresObservability = {
  conditions: {
    all: [{ fact: 'derived', path: '$.allSkills', operator: 'contains', value: 'skill_distributed' }]
  },
  event: { params: { ruleId: 'distributed-requires-observability', ... } }
};

extractDerivedTriggers(rules, 'distributed-requires-observability')
// Returns: [{ type: 'skill', provenanceKey: 'skill_distributed' }]
// Why: Condition checks `derived.allSkills` contains 'skill_distributed'
```

**Example 3: Property Chain Rule (checks both containers)**

From `boost-rules.config.ts`:
```typescript
// Rule: senior-prefers-leadership
const seniorPrefersLeadership = {
  conditions: {
    any: [
      { fact: 'derived', path: '$.requiredProperties.seniorityLevel', operator: 'in', value: ['senior', 'staff', 'principal'] },
      { fact: 'derived', path: '$.preferredProperties.seniorityLevel', operator: 'in', value: ['senior', 'staff', 'principal'] },
    ]
  },
  event: { params: { ruleId: 'senior-prefers-leadership', ... } }
};

extractDerivedTriggers(rules, 'senior-prefers-leadership')
// Returns: [
//   { type: 'requiredProperty', provenanceKey: 'seniorityLevel' },
//   { type: 'preferredProperty', provenanceKey: 'seniorityLevel' }
// ]
// Why: Condition checks both property containers with `any` operator
```

**Example 4: Compound Rule (multiple request conditions)**

From `boost-rules.config.ts`:
```typescript
// Rule: senior-greenfield-prefers-ownership
const seniorGreenfieldPrefersOwnership = {
  conditions: {
    all: [
      { fact: 'request', path: '$.requiredSeniorityLevel', operator: 'in', value: ['senior', 'staff', 'principal'] },
      { fact: 'request', path: '$.teamFocus', operator: 'equal', value: 'greenfield' }
    ]
  },
  event: { params: { ruleId: 'senior-greenfield-prefers-ownership', ... } }
};

extractDerivedTriggers(rules, 'senior-greenfield-prefers-ownership')
// Returns: []
// Why: Both conditions check `request` facts, not `derived` facts
// This is a compound first-hop rule, not a chain rule
```

### Function: `eventToDerivedConstraint(event, ...)`

Converts a rule engine event into our domain type. This function orchestrates three focused helpers:

1. **`toStringArray(val)`** - Normalizes unknown values to string arrays
2. **`determineOverrideStatus(...)`** - Determines if/how a rule is overridden
3. **`buildDerivationChains(...)`** - Builds derivation chains from provenance maps

```typescript
/* Helper: Normalize targetValue to string array */
function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.filter((s): s is string => typeof s === 'string');
  }
  return typeof val === 'string' ? [val] : [];
}

interface OverrideResult {
  override: DerivedConstraint['override'] | undefined;
  effectiveTargetValue: unknown;
}

/*
 * Determine if/how a rule is overridden.
 *
 * Override types (in precedence order):
 * 1. Explicit override: user listed ruleId in overriddenRuleIds → FULL
 * 2. Implicit field override: user set the target field → FULL
 * 3. Implicit skill override: user already requires/prefers target skills → FULL or PARTIAL
 */
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

/*
 * Build derivation chains for a rule based on what triggered it.
 *
 * For first-hop rules (triggered by user input): returns [[ruleId]]
 * For chain rules (triggered by derived values): returns chains from all trigger sources
 */
function buildDerivationChains(
  ruleId: string,
  rules: InferenceRuleDefinition[],
  skillProvenance: SkillProvenance,
  requiredPropertyProvenance: RequiredPropertyProvenance,
  preferredPropertyProvenance: PreferredPropertyProvenance
): string[][] {
  const triggers = extractDerivedTriggers(rules, ruleId);

  if (triggers.length === 0) {
    return [[ruleId]];  // First-hop rule
  }

  // Chain rule - collect ALL trigger chains (not just the longest)
  const allChains: string[][] = [];
  for (const trigger of triggers) {
    let provenanceMap: Map<string, string[][]>;
    switch (trigger.type) {
      case 'skill': provenanceMap = skillProvenance; break;
      case 'requiredProperty': provenanceMap = requiredPropertyProvenance; break;
      case 'preferredProperty': provenanceMap = preferredPropertyProvenance; break;
    }
    const sourceChains = provenanceMap.get(trigger.provenanceKey) || [];
    for (const sourceChain of sourceChains) {
      // Filter out 'user-input' marker, then append current rule
      const filteredChain = sourceChain.filter(id => id !== 'user-input');
      allChains.push([...filteredChain, ruleId]);
    }
  }

  const uniqueChains = deduplicateChains(allChains);
  return uniqueChains.length > 0 ? uniqueChains : [[ruleId]];
}

/* Main function: orchestrates the helpers */
export function eventToDerivedConstraint(
  event, userExplicitFields, rules, overriddenRuleIds = [], userExplicitSkills = [],
  skillProvenance = new Map(), requiredPropertyProvenance = new Map(), preferredPropertyProvenance = new Map()
) {
  const params = event.params as InferenceEventParams;
  const effect = event.type === 'derived-filter' ? 'filter' : 'boost';

  const { override, effectiveTargetValue } = determineOverrideStatus(
    params, effect, userExplicitFields, overriddenRuleIds, userExplicitSkills
  );

  const derivationChains = buildDerivationChains(
    params.ruleId, rules, skillProvenance, requiredPropertyProvenance, preferredPropertyProvenance
  );

  return {
    rule: { id: params.ruleId, name: getRuleName(rules, params.ruleId) },
    action: {
      effect,
      targetField: params.targetField,
      targetValue: effectiveTargetValue,
      boostStrength: params.boostStrength,
    },
    provenance: {
      derivationChains,  // 2D: all causal paths for multi-hop/multi-trigger rules
      explanation: params.rationale,
    },
    override,
  };
}
```

**Derivation Chain Logic**:
- **First-hop rules**: Check `request` facts → `derivationChains: [['current-rule-id']]`
- **Chain rules (single trigger)**: Check single `derived` fact → `derivationChains: [['source-rule-id', ..., 'current-rule-id']]`
- **Chain rules (multiple triggers)**: Check multiple `derived` facts → `derivationChains: [['path-a', 'current'], ['path-b', 'current']]`

Example chain:
```
teamFocus=scaling → scaling-requires-distributed → distributed-requires-observability

scaling-requires-distributed: derivationChains = [['scaling-requires-distributed']]
distributed-requires-observability: derivationChains = [['scaling-requires-distributed', 'distributed-requires-observability']]
```

**Override Logic**:

| Override Type | Mechanism | Applies To | Override Scope | Reason Type |
|---------------|-----------|------------|----------------|-------------|
| **Explicit** | `overriddenRuleIds` in request | Both filter AND boost rules | `FULL` | `explicit-rule-override` |
| **Implicit Field** | User sets target field | Both filter AND boost rules | `FULL` | `implicit-field-override` |
| **Implicit Skill (all)** | User handles ALL target skills | Filter rules targeting `derivedSkills` | `FULL` | `implicit-skill-override` |
| **Implicit Skill (some)** | User handles SOME target skills | Filter rules targeting `derivedSkills` | `PARTIAL` | `implicit-skill-override` |

**Key Insight**: The `override` object is only present when the user overrode the constraint. Check `override?.overrideScope === 'FULL'` to determine if the entire constraint is overridden.

**Partial Overrides**: When a filter rule targets multiple skills and user handles only some:
- Non-overridden skills remain in `targetValue` (rule still applies for them)
- `override.overrideScope = 'PARTIAL'` and `override.overriddenSkills` shows which were user-handled

```typescript
// Example: Rule targets ['skill_a', 'skill_b'], user already has skill_a in preferredSkills
// Input:
{ preferredSkills: [{ skill: 'skill_a' }] }

// Result constraint:
{
  action: { targetValue: ['skill_b'] },        // Reduced - only skill_b applied
  override: { overrideScope: 'PARTIAL', overriddenSkills: ['skill_a'] }
}
```

### Function: `extractUserExplicitFields(request)`

Determines which fields the user explicitly set, for override detection:

```typescript
function extractUserExplicitFields(request: SearchFilterRequest): string[] {
  return Object.entries(request)
    .filter(([key, value]) =>
      value !== undefined &&
      (Array.isArray(value) ? value.length > 0 : true)
    )
    .map(([key]) => key);
}
```

**Defense in Depth**

This tracks ALL user-set fields (not just `preferred*`) to protect against rule authoring errors:

| Concern | Protection |
|---------|------------|
| User sets required field | No rule should overwrite it |
| User sets preferred field | No rule should overwrite it |
| Rule author mistake | Caught at runtime, not just code review |

The semantic distinction between boost/filter rules and their valid targets is enforced elsewhere (documentation, code review). This function provides a safety net: any field the user explicitly set is protected from being overwritten by inference rules.

### Function: `mergeDerivedValuesIntoContext(context, constraints, processedConstraintIds)`

This is the **chaining mechanism** that updates skills, properties, and provenance:

```typescript
export function mergeDerivedValuesIntoContext(
  context,
  constraints,
  processedConstraintIds: Set<string> = new Set()  // Prevents wasteful reprocessing
) {
  const newSkills = new Set(context.derived.allSkills);
  const newSkillProvenance = new Map(context.derived.skillProvenance);
  const newRequiredProperties = { ...context.derived.requiredProperties };
  const newPreferredProperties = { ...context.derived.preferredProperties };
  const newRequiredPropertyProvenance = new Map(context.derived.requiredPropertyProvenance);
  const newPreferredPropertyProvenance = new Map(context.derived.preferredPropertyProvenance);

  for (const c of constraints) {
    /*
     * Skip constraints we've already merged in previous iterations.
     *
     * The inference loop accumulates ALL constraints in allDerivedConstraints across
     * iterations, then calls this function with the full list each time. Without this
     * check, we'd reprocess iteration-1 constraints during iteration-2, iteration-3, etc.
     *
     * The reprocessing would be harmless (deduplicateChains removes duplicates), but
     * wasteful. This Set tracks which constraints have been merged so we only process
     * each constraint once.
     */
    if (processedConstraintIds.has(c.rule.id)) continue;
    processedConstraintIds.add(c.rule.id);

    // Skip fully overridden constraints
    if (c.override?.overrideScope === 'FULL') continue;

    const targetField = c.action.targetField;
    const targetValue = c.action.targetValue;
    const chains = c.provenance.derivationChains;  // Now 2D: string[][]
    const effect = c.action.effect;

    if (targetField === 'derivedSkills') {
      // Handle skills (array, union merge) → skillProvenance
      const skills = Array.isArray(targetValue) ? targetValue : [targetValue];
      for (const skill of skills) {
        if (typeof skill !== 'string') continue;
        if (!newSkills.has(skill)) {
          newSkills.add(skill);
          newSkillProvenance.set(skill, chains);  // Track all provenance chains
        } else {
          // Skill already exists - merge chains (multi-path support)
          const existing = newSkillProvenance.get(skill) || [];
          newSkillProvenance.set(skill, deduplicateChains([...existing, ...chains]));
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
          newRequiredPropertyProvenance.set(normalizedKey, chains);
        } else {
          // Property already exists - merge chains
          const existing = newRequiredPropertyProvenance.get(normalizedKey) || [];
          newRequiredPropertyProvenance.set(normalizedKey, deduplicateChains([...existing, ...chains]));
        }
      } else {
        // Boost rules produce soft preferences → preferredProperties
        if (!(normalizedKey in newPreferredProperties)) {
          newPreferredProperties[normalizedKey] = targetValue;
          newPreferredPropertyProvenance.set(normalizedKey, chains);
        } else {
          // Property already exists - merge chains
          const existing = newPreferredPropertyProvenance.get(normalizedKey) || [];
          newPreferredPropertyProvenance.set(normalizedKey, deduplicateChains([...existing, ...chains]));
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

**What happens**: After rules fire, this function:
1. **Skills**: Adds new skills to `allSkills` and records their provenance in `skillProvenance`
2. **Properties**: Routes to `requiredProperties` (filter rules) or `preferredProperties` (boost rules) with normalized keys
3. **Provenance**: Records the derivation chain for each new value

The `isActiveSkillConstraint` helper checks that constraints are NOT fully overridden and target `derivedSkills`. Partially overridden constraints still contribute their remaining skills.

**Provenance enables multi-hop chains**: When a chain rule fires, we look up the provenance of its trigger value to build the full causal chain.

### Function: `computeContextHash(context)`

Detects when iteration should stop (fixpoint):

```typescript
export function computeContextHash(context) {
  return JSON.stringify(context.derived.allSkills.sort());
}
```

**Simple but effective**: If the hash doesn't change between iterations, no new skills were added, so no new rules can fire. We only hash `derived.allSkills` since that's the only mutable state.

---

## Part 4: The Main Algorithm

### File: `recommender_api/src/services/inference-engine.service.ts`

This is where the forward-chaining loop lives.

### Function: `runInference(request)`

The core algorithm in pseudocode:

```
INPUT: SearchFilterRequest
OUTPUT: InferenceResult

1. Create inference context from request
2. Initialize empty constraint list, fired rules set, overridden rules array, warnings

3. WHILE iteration < maxIterations:
   a) Compute hash of current context
   b) If hash == previous hash: BREAK (fixpoint)
   c) Run rules engine
   d) For each event:
      - Skip if already fired
      - Convert to DerivedConstraint
      - Track if fully overridden
      - Add to results
   e) Merge derived skills back into context

4. Add warning if max iterations reached
5. RETURN all constraints, fired rules, overridden rules, iteration count, warnings
```

### Actual Code with Annotations:

```typescript
export async function runInference(request: SearchFilterRequest): Promise<InferenceResult> {
  const config = knowledgeBaseConfig;
  const engine = createEngine(config.inferenceRules);
  const maxIterations = config.maxInferenceIterations;

  let context = createInferenceContext(request);
  const allDerivedConstraints: DerivedConstraint[] = [];
  const firedRuleIds = new Set<string>();
  const mergedConstraintIds = new Set<string>();  // Tracks which constraints have been merged (optimization)
  const overriddenRules: OverriddenRuleInfo[] = [];  // Rich override tracking
  const warnings: string[] = [];

  let iteration = 0;
  let previousHash = '';

  while (iteration < maxIterations) {
    iteration++;
    const currentHash = computeContextHash(context);

    // FIXPOINT: If nothing changed, stop
    if (currentHash === previousHash) break;
    previousHash = currentHash;

    // Run all rules against current context (json-rules-engine calls this "facts" internally)
    const { events } = await engine.run(context);

    for (const event of events) {
      const ruleId = (event.params as InferenceEventParams).ruleId;

      // Deduplication: each rule fires at most once
      if (firedRuleIds.has(ruleId)) continue;

      const constraint = eventToDerivedConstraint(
        event,
        context.meta.userExplicitFields,
        config.inferenceRules,
        context.meta.overriddenRuleIds,
        context.meta.userExplicitSkills,
        context.derived.skillProvenance,              // For chain tracking
        context.derived.requiredPropertyProvenance,   // For chain tracking
        context.derived.preferredPropertyProvenance   // For chain tracking
      );

      firedRuleIds.add(ruleId);

      // Track any override (FULL or PARTIAL) for transparency
      if (constraint.override) {
        overriddenRules.push({
          ruleId: constraint.rule.id,
          overrideScope: constraint.override.overrideScope,
          overriddenSkills: constraint.override.overriddenSkills,
        });
      }

      allDerivedConstraints.push(constraint);
    }

    // CHAINING: Add derived values (skills + properties) and update provenance
    // mergedConstraintIds prevents wasteful reprocessing of already-merged constraints
    context = mergeDerivedValuesIntoContext(context, allDerivedConstraints, mergedConstraintIds);
  }

  if (iteration >= maxIterations) {
    warnings.push(`Reached maximum inference iterations (${maxIterations}).`);
  }

  // Extract convenience fields from constraints (for consumer convenience)
  const derivedRequiredSkillIds = getDerivedRequiredSkills(allDerivedConstraints);
  const derivedSkillBoosts = aggregateDerivedSkillBoosts(allDerivedConstraints);

  return {
    derivedConstraints: allDerivedConstraints,
    firedRules: [...firedRuleIds],
    overriddenRules,  // Rich override info
    iterationCount: iteration,
    warnings,
    derivedRequiredSkillIds,  // Computed convenience field
    derivedSkillBoosts,       // Computed convenience field
  };
}
```

### Extraction Functions

These functions extract derived requirements from constraints. They are called **internally by `runInference()`** to populate the convenience fields on `InferenceResult`, but remain exported for unit testing and flexibility:

**`getDerivedRequiredSkills(constraints)`** - Gets hard requirements:
```typescript
export function getDerivedRequiredSkills(constraints: DerivedConstraint[]): string[] {
  const skills: string[] = [];

  for (const c of constraints) {
    if (!isEffectiveSkillFilter(c)) continue;  // Uses composable helper

    const values = Array.isArray(c.action.targetValue)
      ? c.action.targetValue
      : [c.action.targetValue];
    skills.push(...values.filter((v): v is string => typeof v === 'string'));
  }

  return [...new Set(skills)];  // Deduplicate
}
```

**`aggregateDerivedSkillBoosts(constraints)`** - Gets soft preferences with max-wins:
```typescript
export function aggregateDerivedSkillBoosts(constraints: DerivedConstraint[]): Map<string, number> {
  const boosts = new Map<string, number>();

  for (const c of constraints) {
    if (!isEffectiveSkillBoost(c)) continue;  // Uses composable helper
    if (c.action.boostStrength === undefined) continue;

    const skills = Array.isArray(c.action.targetValue)
      ? c.action.targetValue
      : [c.action.targetValue];

    for (const skill of skills) {
      if (typeof skill !== 'string') continue;
      // Max-wins: if same skill boosted twice, keep higher strength
      const current = boosts.get(skill) || 0;
      boosts.set(skill, Math.max(current, c.action.boostStrength));
    }
  }

  return boosts;
}
```

**Helper Function Pattern**: The helpers form a composable hierarchy:

| Layer | Function | Checks |
|-------|----------|--------|
| Primitive | `isFilterConstraint(c)` | `effect === 'filter'` |
| Primitive | `isBoostConstraint(c)` | `effect === 'boost'` |
| Composite | `isEffectiveSkillConstraint(c)` | `!isFullyOverridden` + `derivedSkills` |
| Composite | `isEffectiveSkillFilter(c)` | `isEffectiveSkillConstraint` + `isFilterConstraint` |
| Composite | `isEffectiveSkillBoost(c)` | `isEffectiveSkillConstraint` + `isBoostConstraint` |

This composable pattern reduces code duplication and makes the intent clearer.

---

## Part 5: Integration with Search

### File: `recommender_api/src/services/constraint-expander.service.ts`

The inference engine is called during constraint expansion. Since `runInference()` returns a complete result with extracted fields, the consumer simply uses them directly:

```typescript
export async function expandSearchCriteria(request) {
  // ... existing expansion logic ...

  // Run inference engine - returns complete result with extracted fields
  const inferenceResult = await runInference(request);

  return {
    // ... existing fields ...
    derivedConstraints: inferenceResult.derivedConstraints,
    derivedRequiredSkillIds: inferenceResult.derivedRequiredSkillIds,
    derivedSkillBoosts: inferenceResult.derivedSkillBoosts,
  };
}
```

### Flow Through the System

```
SearchFilterRequest
       │
       ▼
expandSearchCriteria()
       │
       ├─► runInference()
       │         │
       │         ▼
       │    Forward-chain until fixpoint
       │         │
       │         ▼
       │    InferenceResult
       │
       ▼
ExpandedSearchCriteria
       │
       ├─► derivedRequiredSkillIds → Cypher WHERE clause
       ├─► derivedSkillBoosts → Utility scoring
       └─► derivedConstraints → API response
```

---

## Part 6: Concrete Examples

### Example 1: Single-Hop (Scaling → Distributed)

**Input**:
```typescript
{ teamFocus: 'scaling' }
```

**Iteration 1**:
- Rule `scaling-requires-distributed` fires
- Adds `skill_distributed` to constraints

**Result**:
```typescript
{
  derivedConstraints: [
    {
      rule: { id: 'scaling-requires-distributed', name: 'Scaling Requires Distributed Systems' },
      action: { effect: 'filter', targetField: 'derivedSkills', targetValue: ['skill_distributed'] },
      provenance: { derivationChains: [['scaling-requires-distributed']], explanation: '...' },
      // override: undefined (not overridden)
    }
  ],
  iterationCount: 2
}
```

### Example 2: Multi-Hop with Proper Derivation Chains (Scaling → Distributed → Monitoring)

**Input**:
```typescript
{ teamFocus: 'scaling' }
```

**Iteration 1**:
- Rule `scaling-requires-distributed` fires (first-hop, checks `request.teamFocus`)
- `allSkills` becomes `['skill_distributed']`
- `skillProvenance` becomes `{ 'skill_distributed': ['scaling-requires-distributed'] }`

**Iteration 2**:
- Rule `distributed-requires-observability` fires (chain rule, checks `derived.allSkills.contains('skill_distributed')`)
- Looks up provenance: `skillProvenance.get('skill_distributed')` → `['scaling-requires-distributed']`
- Builds chain: `['scaling-requires-distributed', 'distributed-requires-observability']`

**Result**:
```typescript
{
  derivedConstraints: [
    {
      rule: { id: 'scaling-requires-distributed', name: 'Scaling Requires Distributed Systems' },
      action: { effect: 'filter', targetField: 'derivedSkills', targetValue: ['skill_distributed'] },
      provenance: {
        derivationChains: [['scaling-requires-distributed']],  // First-hop: single-element chain (2D)
        explanation: '...'
      },
      // override: undefined (not overridden)
    },
    {
      rule: { id: 'distributed-requires-observability', name: 'Distributed Systems Require Observability' },
      action: { effect: 'filter', targetField: 'derivedSkills', targetValue: ['skill_monitoring'] },
      provenance: {
        derivationChains: [['scaling-requires-distributed', 'distributed-requires-observability']],  // Full causal chain (2D)!
        explanation: '...'
      },
      // override: undefined (not overridden)
    }
  ],
  iterationCount: 3
}
```

### Example 3: Implicit Field Override (Defense in Depth)

**Input**:
```typescript
{
  requiredSeniorityLevel: 'senior',
  preferredSkills: [{ skill: 'my_custom_skill' }]  // User explicitly set
}
```

**Result**:
- Rules targeting `derivedSkills` still apply (different field from what user set)
- If any rule targeted `preferredSkills`, it would have `override: { overrideScope: 'FULL', ... }`
- If any rule targeted `requiredSeniorityLevel`, it would also have `override: { overrideScope: 'FULL', ... }`
- This protects ALL user-set fields from being overwritten by inference rules

### Example 4: Explicit Rule Override (Filter or Boost)

**Input**:
```typescript
{
  teamFocus: 'scaling',
  overriddenRuleIds: ['scaling-requires-distributed']  // Explicitly override filter rule
}
```

**What Happens**:

1. Rule `scaling-requires-distributed` fires (conditions still match)
2. BUT it has `override.overrideScope: 'FULL'` because its ID is in `overriddenRuleIds`
3. Because it's fully overridden, its skills are NOT added to `allSkills`
4. Therefore, downstream chain rule `distributed-requires-observability` NEVER fires

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

**Why This Matters**: The `reasonType` field now makes it clear that this override happened because the user explicitly listed the rule in `overriddenRuleIds`, not because of an implicit field or skill match. This lets the UI show "You overrode: Scaling Requires Distributed Systems" while NOT filtering candidates by that skill.

### Example 5: Override Breaks Multi-Hop Chain

**Without Override** (reference):
```typescript
{ teamFocus: 'scaling' }
// Results in: scaling → distributed → observability (3 rules fire)
```

**With Override**:
```typescript
{ teamFocus: 'scaling', overriddenRuleIds: ['scaling-requires-distributed'] }
// Results in: only scaling rule fires (overridden), chain is broken
// - distributed-requires-observability NEVER fires
// - No filtering by skill_distributed or skill_monitoring
```

### Example 6: Implicit Filter Override (User Already Handles Skill)

**Scenario**: A filter rule would add `skill_distributed`, but the user already specified it.

**Input**:
```typescript
{
  teamFocus: 'scaling',
  requiredSkills: [{ skill: 'skill_distributed', minimumProficiency: 3 }]
}
```

**What Happens**:

1. Rule `scaling-requires-distributed` fires (conditions still match)
2. User has `skill_distributed` in `requiredSkills` → detected in `userExplicitSkills`
3. Rule has `override: { overrideScope: 'FULL', ... }` because user already handles that skill
4. **Key difference from explicit override**: The skill IS still in `allSkills` (user put it there)
5. Therefore, downstream chain rule `distributed-requires-observability` STILL fires

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
    {
      rule: { id: 'distributed-requires-observability', name: 'Distributed Systems Require Observability' },
      action: { effect: 'filter', targetField: 'derivedSkills', targetValue: ['skill_monitoring'] },
      provenance: { derivationChains: [['distributed-requires-observability']], explanation: '...' },
      // override: undefined  <-- Chain continues because skill_distributed IS in allSkills
    }
  ],
  iterationCount: 3
}
```

**Why This Differs from Explicit Override**:
- **Explicit override** (`overriddenRuleIds`): Breaks the chain because skill never enters `allSkills`
- **Implicit filter override** (user already has skill): Chain continues because user put the skill in `allSkills`

The implicit filter override respects that the user already requires the skill (perhaps with specific proficiency) while still allowing dependent rules to fire.

### Example 7: Partial Filter Override (Multi-Skill Rule)

**Scenario**: A filter rule targets multiple skills, user handles only some.

**Input**:
```typescript
{
  teamFocus: 'some_focus_requiring_multiple_skills',
  preferredSkills: [{ skill: 'skill_a', minimumProficiency: 2 }]  // User prefers skill_a
}
```

**Assume rule**: `focus-requires-skills` targets `['skill_a', 'skill_b', 'skill_c']`

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

**Key Points**:
- `override.overrideScope` is `'PARTIAL'` because rule still applies (for non-overridden skills)
- `targetValue` is reduced to only the skills user didn't handle
- `override.overriddenSkills` shows which skills the user handled

### Example 8: Property Chain with Derivation Provenance (Greenfield → Senior → Leadership)

**Scenario**: A property-based chain where seniority is derived first, then triggers a leadership boost.

**Input**:
```typescript
{ teamFocus: 'greenfield' }
```

**What Happens**:

1. **Iteration 1** (first-hop rules fire):
   - Rule `greenfield-prefers-senior` fires (checks `request.teamFocus`)
   - Derives `preferredSeniorityLevel: 'senior'`
   - `preferredProperties` becomes `{ seniorityLevel: 'senior' }`
   - `preferredPropertyProvenance` becomes `{ 'seniorityLevel': ['greenfield-prefers-senior'] }`

2. **Iteration 2** (chain rule fires):
   - Rule `senior-prefers-leadership` fires (checks `derived.preferredProperties.seniorityLevel`)
   - Looks up provenance: `preferredPropertyProvenance.get('seniorityLevel')` → `['greenfield-prefers-senior']`
   - Builds chain: `['greenfield-prefers-senior', 'senior-prefers-leadership']`

**Result**:
```typescript
{
  derivedConstraints: [
    {
      rule: { id: 'greenfield-prefers-senior', name: 'Greenfield Projects Prefer Senior Engineers' },
      action: { effect: 'boost', targetField: 'preferredSeniorityLevel', targetValue: 'senior', boostStrength: 0.4 },
      provenance: {
        derivationChains: [['greenfield-prefers-senior']],  // First-hop (2D)
        explanation: 'Greenfield projects often benefit from experienced engineers'
      },
    },
    {
      rule: { id: 'senior-prefers-leadership', name: 'Senior+ Benefits from Leadership Skills' },
      action: { effect: 'boost', targetField: 'derivedSkills', targetValue: ['skill_mentorship', 'skill_code_review', 'skill_tech_leadership'], boostStrength: 0.6 },
      provenance: {
        derivationChains: [['greenfield-prefers-senior', 'senior-prefers-leadership']],  // Full property→skill chain (2D)!
        explanation: 'Senior engineers often benefit from leadership abilities'
      },
    }
  ],
  iterationCount: 3
}
```

**Key Insight**: This demonstrates that provenance tracking works for non-skill chains too. The leadership boost knows it came from greenfield, even though the intermediate step was a property (seniorityLevel) not a skill.

---

## Key Takeaways

1. **Forward-chaining**: Rules fire, add skills/properties, which can trigger more rules
2. **Fixpoint detection**: Stop when `allSkills` stops growing
3. **Filter = hard, Boost = soft**: Filters exclude candidates; boosts adjust ranking
4. **Three override mechanisms** (all produce `override` object with `reasonType`):
   - **Explicit**: `overriddenRuleIds` overrides any rule (breaks chains) → `FULL`, `reasonType: 'explicit-rule-override'`
   - **Implicit field**: User sets ANY field → rules targeting that field are overridden → `FULL`, `reasonType: 'implicit-field-override'`
   - **Implicit skill**: User already handles a skill → filter rule for that skill is overridden (chains continue) → `FULL` or `PARTIAL`, `reasonType: 'implicit-skill-override'`
5. **Chain behavior differs by override type**:
   - Explicit override breaks chains (skill never enters `allSkills`)
   - Implicit skill override allows chains (user's skill is already in `allSkills`)
6. **Partial overrides**: When a filter targets multiple skills and user handles only some:
   - `override.overrideScope = 'PARTIAL'`
   - `targetValue` is reduced to non-overridden skills
   - `override.overriddenSkills` shows what user handled
7. **Rich override tracking**: `InferenceResult.overriddenRules` is an array of `OverriddenRuleInfo` objects (not just rule IDs):
   - `ruleId`: Which rule was overridden
   - `overrideScope`: `'FULL'` or `'PARTIAL'`
   - `overriddenSkills`: Which specific skills were overridden
   - `reasonType`: Why the override happened (`'explicit-rule-override'`, `'implicit-field-override'`, `'implicit-skill-override'`)
   - Both FULL and PARTIAL overrides are tracked for transparency
8. **Derivation chain provenance**: Every constraint tracks ALL its causal paths (2D arrays):
   - First-hop rules: `derivationChains: [['current-rule-id']]`
   - Chain rules (single trigger): `derivationChains: [['source-rule-id', ..., 'current-rule-id']]`
   - Chain rules (multiple triggers): `derivationChains: [['path-a', 'current'], ['path-b', 'current']]`
   - Three provenance maps track skills, required properties, and preferred properties separately
   - Normalized property keys allow chain rules to check a single path regardless of source
   - When same value reached through multiple paths, all paths are captured
9. **Provenance architecture**:
   - `requiredProperties`: Holds values from user's `required*` fields + filter rule outputs
   - `preferredProperties`: Holds values from user's `preferred*` fields + boost rule outputs
   - Chain rules use `any` conditions to fire from either container
   - Override info is in the dedicated `override` object (not `provenance`)
10. **Processing optimization**: `mergedConstraintIds` Set prevents reprocessing constraints:
   - The inference loop accumulates ALL constraints across iterations in `allDerivedConstraints`
   - Each iteration calls `mergeDerivedValuesIntoContext` with the full list
   - Without tracking, iteration-2 would reprocess iteration-1 constraints (wasteful but harmless due to `deduplicateChains`)
   - The Set ensures each constraint is merged exactly once

---

## Where to Go Next

1. **Add a new rule**: See `CLAUDE.md` for instructions
2. **Run tests**: `npm test -- src/services/inference-engine.service.test.ts`
3. **See it in action**: Make a search request with `teamFocus: 'scaling'` and check `derivedConstraints` in the response
4. **Test explicit overrides**: Add `overriddenRuleIds: ['scaling-requires-distributed']` to the request and observe the chain breaking
5. **Test implicit filter overrides**: Add `requiredSkills: [{ skill: 'skill_distributed', minimumProficiency: 3 }]` alongside `teamFocus: 'scaling'` and observe the rule with `override.overrideScope: 'FULL'` while chain continues
6. **Explore partial overrides**: Create a multi-skill filter rule and test with user handling only some skills to see `override.overrideScope: 'PARTIAL'` behavior
7. **Verify derivation chains**: Make a request with `teamFocus: 'scaling'` and examine the `derivationChains` arrays (2D):
   - First rule should have single-element chain: `[['scaling-requires-distributed']]`
   - Chain rules should show full path: `[['scaling-requires-distributed', 'distributed-requires-observability']]`
8. **Test property chains**: Make a request with `teamFocus: 'greenfield'` and observe:
   - `greenfield-prefers-senior` fires with `derivationChains: [['greenfield-prefers-senior']]`
   - `senior-prefers-leadership` fires with `derivationChains: [['greenfield-prefers-senior', 'senior-prefers-leadership']]`
