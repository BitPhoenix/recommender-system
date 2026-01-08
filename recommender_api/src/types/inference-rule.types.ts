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
  | "derivedSkills" // Skills to add (filter → required, boost → preferred)
  | "preferredSeniorityLevel"
  | "preferredMaxStartTime"
  | "preferredConfidenceScore"
  | "preferredProficiency";

/**
 * Override scope indicates how a derived constraint was overridden by user.
 * - FULL: Entire constraint is overridden (explicit override via overriddenRuleIds,
 *         implicit boost override, or all target skills user-handled)
 * - PARTIAL: Only some target skills were user-handled, rule still applies for remainder
 */
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
  reasonType: OverrideReasonType;
}

/**
 * Result of the inference engine.
 */
export interface InferenceResult {
  derivedConstraints: DerivedConstraint[];
  firedRules: string[];
  overriddenRules: OverriddenRuleInfo[];
  iterationCount: number;
  warnings: string[];

  /* Extracted results for convenience (computed from derivedConstraints) */

  /** Skills that MUST be matched (from filter rules targeting derivedSkills) */
  derivedRequiredSkillIds: string[];
  /** Aggregated skill boosts from boost rules (max strength wins) */
  derivedSkillBoosts: Map<string, number>;
}

/**
 * A derived constraint produced by rule firing.
 * Properties grouped by semantic concern for clarity.
 */
export interface DerivedConstraint {
  /** Rule identification */
  rule: {
    id: string;
    name: string;
  };

  /** What the constraint does */
  action: {
    effect: "filter" | "boost";
    targetField: ConstraintTargetField;
    targetValue: string | string[] | number;
    boostStrength?: number; // Only for effect === 'boost'
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
    explanation: string;
  };

  /**
   * Override information - only present when user overrode this constraint.
   * Replaces the old overriddenByUser boolean and partiallyOverridden/overriddenSkills.
   *
   * - FULL: Entire constraint overridden (explicit, implicit boost, or all skills user-handled)
   * - PARTIAL: Some target skills user-handled, rule still applies for remaining skills
   */
  override?: {
    overrideScope: OverrideScope;
    overriddenSkills: string[]; // Which skills were overridden (for FULL, contains all target skills)
    reasonType: OverrideReasonType; // Why the override happened
  };
}

/**
 * Helper to check if a constraint is fully overridden.
 */
export function isFullyOverridden(constraint: DerivedConstraint): boolean {
  return constraint.override?.overrideScope === 'FULL';
}

/**
 * Helper to check if a constraint is partially overridden.
 */
export function isPartiallyOverridden(constraint: DerivedConstraint): boolean {
  return constraint.override?.overrideScope === 'PARTIAL';
}

/**
 * Helper to check if a constraint has any override.
 */
export function hasAnyOverride(constraint: DerivedConstraint): boolean {
  return constraint.override !== undefined;
}

/**
 * Helper to check if a constraint has filter effect (hard requirement).
 */
export function isFilterConstraint(constraint: DerivedConstraint): boolean {
  return constraint.action.effect === 'filter';
}

/**
 * Helper to check if a constraint has boost effect (soft preference).
 */
export function isBoostConstraint(constraint: DerivedConstraint): boolean {
  return constraint.action.effect === 'boost';
}

/**
 * Helper to check if a constraint is an effective skill constraint (not fully overridden, targets derivedSkills).
 * Used by merge function - includes both filter and boost effects.
 */
export function isEffectiveSkillConstraint(constraint: DerivedConstraint): boolean {
  return !isFullyOverridden(constraint) && constraint.action.targetField === 'derivedSkills';
}

/**
 * Helper to check if a constraint is an effective skill filter (not fully overridden, filter effect, targets derivedSkills).
 * Used to extract derived required skills.
 */
export function isEffectiveSkillFilter(constraint: DerivedConstraint): boolean {
  return isEffectiveSkillConstraint(constraint) && isFilterConstraint(constraint);
}

/**
 * Helper to check if a constraint is an effective skill boost (not fully overridden, boost effect, targets derivedSkills).
 * Used to extract derived skill boosts.
 */
export function isEffectiveSkillBoost(constraint: DerivedConstraint): boolean {
  return isEffectiveSkillConstraint(constraint) && isBoostConstraint(constraint);
}
