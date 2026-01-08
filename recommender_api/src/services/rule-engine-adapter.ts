/**
 * Rule Engine Adapter
 * Wraps json-rules-engine with domain-specific utilities.
 */

import { Engine } from 'json-rules-engine';
import type { SearchFilterRequest } from '../schemas/search.schema.js';
import type {
  InferenceContext,
  InferenceRuleDefinition,
  InferenceEventParams,
  SkillProvenance,
  RequiredPropertyProvenance,
  PreferredPropertyProvenance,
} from '../types/rule-engine.types.js';
import { normalizePropertyKey } from '../types/rule-engine.types.js';
import type { DerivedConstraint } from '../types/inference-rule.types.js';

/**
 * Event type from json-rules-engine with guaranteed structure.
 */
interface EngineEvent {
  type: string;
  params?: Record<string, unknown>;
}

let cachedEngine: Engine | null = null;

/**
 * Create and cache the Engine instance.
 * Caches the engine for performance - rules are loaded once.
 */
export function createEngine(rules: InferenceRuleDefinition[]): Engine {
  if (cachedEngine) return cachedEngine;

  const engine = new Engine();

  // Add custom 'contains' operator for skill arrays
  engine.addOperator(
    'contains',
    (factValue: unknown, jsonValue: string): boolean => {
      return Array.isArray(factValue) && factValue.includes(jsonValue);
    }
  );

  rules.forEach((rule) => engine.addRule(rule));
  cachedEngine = engine;
  return engine;
}

/**
 * Clear the cached engine (for testing).
 */
export function clearEngineCache(): void {
  cachedEngine = null;
}

/**
 * Convert SearchFilterRequest to inference context.
 * Spreads the request directly so new fields are automatically available to rules.
 */
export function createInferenceContext(request: SearchFilterRequest): InferenceContext {
  // Flattened skill names for convenient 'contains' checks in rules
  const skillNames = (request.requiredSkills || []).map((s) => s.skill);

  // Build initial skill provenance for user-provided skills (2D: array of chains)
  const skillProvenance: SkillProvenance = new Map();
  for (const skill of skillNames) {
    skillProvenance.set(skill, [['user-input']]);
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
      ...request,
      skills: skillNames,
    },
    derived: {
      allSkills: [...skillNames], // Will grow as rules fire
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

/**
 * Extract ALL fields explicitly set by user (for override detection).
 *
 * DEFENSE IN DEPTH
 * ----------------
 * This is used to mark rules as "overridden by user" when the user
 * explicitly set the same field the rule wants to modify.
 *
 * We track ALL user-set fields (not just preferred) because:
 * 1. If a user sets a required field, no rule should overwrite it
 * 2. If a user sets a preferred field, no rule should overwrite it
 * 3. This protects against rule authoring errors (e.g., a boost rule
 *    mistakenly targeting a required field)
 *
 * The semantic distinction between boost/filter rules and their valid
 * targets is enforced elsewhere (code review, documentation). This
 * function provides a safety net: any field the user explicitly set
 * is protected from being overwritten by inference rules.
 *
 * Auto-detection: Any field with a non-empty value is included,
 * so new fields are automatically tracked.
 */
function extractUserExplicitFields(request: SearchFilterRequest): string[] {
  return Object.entries(request)
    .filter(
      ([key, value]) =>
        value !== undefined &&
        (Array.isArray(value) ? value.length > 0 : true)
    )
    .map(([key]) => key);
}

/**
 * Extract skills explicitly mentioned by user (for implicit filter override detection).
 *
 * Includes skills from BOTH requiredSkills and preferredSkills because:
 * - requiredSkills: user already requires it (derived filter would be redundant)
 * - preferredSkills: user deliberately made it soft (system shouldn't promote to required)
 *
 * This is used by implicit filter override detection, NOT for allSkills initialization.
 * allSkills only contains requiredSkills because chaining should only happen from
 * hard requirements, not soft preferences.
 */
function extractUserExplicitSkills(request: SearchFilterRequest): string[] {
  const skills: string[] = [];

  if (request.requiredSkills) {
    skills.push(...request.requiredSkills.map(s => s.skill));
  }
  if (request.preferredSkills) {
    skills.push(...request.preferredSkills.map(s => s.skill));
  }

  return skills;
}

/**
 * Get the rule name from the engine by event's ruleId.
 * Falls back to ruleId if rule name not found.
 */
function getRuleName(
  rules: InferenceRuleDefinition[],
  ruleId: string
): string {
  const rule = rules.find((r) => r.event.params.ruleId === ruleId);
  return rule?.name ?? ruleId;
}

/**
 * Trigger info for a chain rule.
 */
export interface DerivedTrigger {
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
export function extractDerivedTriggers(
  rules: InferenceRuleDefinition[],
  ruleId: string
): DerivedTrigger[] {
  const rule = rules.find(r => r.event.params.ruleId === ruleId);
  if (!rule) return [];

  const triggers: DerivedTrigger[] = [];

  // Check both 'all' and 'any' conditions (chain rules may use 'any' to fire from both containers)
  const conditions = rule.conditions as {
    all?: Array<{ fact?: string; path?: string; operator?: string; value?: unknown }>;
    any?: Array<{ fact?: string; path?: string; operator?: string; value?: unknown }>;
  };

  const allConditions = [
    ...(conditions.all || []),
    ...(conditions.any || []),
  ];

  for (const condition of allConditions) {
    if (condition.fact !== 'derived') continue;

    const path = condition.path;
    if (typeof path !== 'string' || !path.startsWith('$.')) continue;

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

/**
 * Convert engine event to domain DerivedConstraint.
 */
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

  const { override, effectiveTargetValue } = determineOverrideStatus(
    params,
    effect,
    userExplicitFields,
    overriddenRuleIds,
    userExplicitSkills
  );

  const derivationChains = buildDerivationChains(
    params.ruleId,
    rules,
    skillProvenance,
    requiredPropertyProvenance,
    preferredPropertyProvenance
  );

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
      derivationChains,
      explanation: params.rationale,
    },
    override,
  };
}

/**
 * Result of override determination.
 */
interface OverrideResult {
  override: DerivedConstraint['override'] | undefined;
  effectiveTargetValue: string | string[] | number;
}

/**
 * Normalize targetValue to string array.
 */
function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.filter((s): s is string => typeof s === 'string');
  }
  return typeof val === 'string' ? [val] : [];
}

/**
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

/**
 * Build derivation chains for a rule based on what triggered it.
 *
 * For first-hop rules (triggered by user input): returns [[ruleId]]
 * For chain rules (triggered by derived values): returns chains from all trigger sources
 */
export function buildDerivationChains(
  ruleId: string,
  rules: InferenceRuleDefinition[],
  skillProvenance: SkillProvenance,
  requiredPropertyProvenance: RequiredPropertyProvenance,
  preferredPropertyProvenance: PreferredPropertyProvenance
): string[][] {
  const triggers = extractDerivedTriggers(rules, ruleId);

  if (triggers.length === 0) {
    // First-hop rule (triggered by user input, not by derived values)
    return [[ruleId]];
  }

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
       * from the user's request (not from rules). We filter this out because
       * derivationChain should only contain rule IDs - a single-element chain
       * like ['current-rule'] already implies it was triggered by user input.
       */
      const filteredChain = sourceChain.filter(id => id !== 'user-input');
      allChains.push([...filteredChain, ruleId]);
    }
  }

  const uniqueChains = deduplicateChains(allChains);
  return uniqueChains.length > 0 ? uniqueChains : [[ruleId]];
}

/**
 * Merge derived values from constraints into context for chaining.
 * Handles skills (array union) and properties (first-wins into appropriate container).
 * Maintains separate provenance maps for skills, required properties, and preferred properties.
 */
export function mergeDerivedValuesIntoContext(
  context: InferenceContext,
  constraints: DerivedConstraint[],
  processedConstraintIds: Set<string> = new Set()
): InferenceContext {
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
          newSkillProvenance.set(skill, chains);
        } else {
          // Skill already exists - merge chains
          const existing = newSkillProvenance.get(skill) || [];
          const merged = deduplicateChains([...existing, ...chains]);
          newSkillProvenance.set(skill, merged);
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
          const merged = deduplicateChains([...existing, ...chains]);
          newRequiredPropertyProvenance.set(normalizedKey, merged);
        }
      } else {
        // Boost rules produce soft preferences → preferredProperties
        if (!(normalizedKey in newPreferredProperties)) {
          newPreferredProperties[normalizedKey] = targetValue;
          newPreferredPropertyProvenance.set(normalizedKey, chains);
        } else {
          // Property already exists - merge chains
          const existing = newPreferredPropertyProvenance.get(normalizedKey) || [];
          const merged = deduplicateChains([...existing, ...chains]);
          newPreferredPropertyProvenance.set(normalizedKey, merged);
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

/**
 * @deprecated Use mergeDerivedValuesIntoContext instead.
 * Alias for backward compatibility with existing tests.
 */
export const mergeDerivedSkillsIntoInferenceContext = mergeDerivedValuesIntoContext;

/**
 * Compute hash for fixpoint detection.
 * When the hash stops changing between iterations, we've reached fixpoint.
 */
export function computeContextHash(context: InferenceContext): string {
  return JSON.stringify(context.derived.allSkills.sort());
}
