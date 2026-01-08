/**
 * Types specific to json-rules-engine integration.
 */

import type { RuleProperties } from 'json-rules-engine';
import type { ConstraintTargetField } from './inference-rule.types.js';
import type { SearchFilterRequest } from '../schemas/search.schema.js';

/*
 * Provenance types for tracking derivation chains.
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
export type SkillProvenance = Map<string, string[][]>;
export type RequiredPropertyProvenance = Map<string, string[][]>;
export type PreferredPropertyProvenance = Map<string, string[][]>;

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
 * Context passed to the inference engine for rule evaluation.
 *
 * Organized into semantic groups:
 * - request: All fields from SearchFilterRequest, plus convenience fields
 * - derived: Mutable state that grows during inference iterations
 * - meta: Tracking fields for rule behavior (e.g., override detection)
 *
 * Note: json-rules-engine internally calls this "facts" in its almanac,
 * but we use "context" as it better describes the nested structure.
 */
export interface InferenceContext {
  request: SearchFilterRequest & {
    skills: string[]; // Flattened skill names for convenient 'contains' checks
  };
  derived: {
    allSkills: string[]; // Grows as rules fire (enables chaining)

    // Property containers with normalized keys (e.g., 'seniorityLevel')
    requiredProperties: Record<string, string>;   // From required* fields + filter rules
    preferredProperties: Record<string, string>;  // From preferred* fields + boost rules

    // Provenance maps for derivation chain building
    skillProvenance: SkillProvenance;
    requiredPropertyProvenance: RequiredPropertyProvenance;
    preferredPropertyProvenance: PreferredPropertyProvenance;
  };
  meta: {
    userExplicitFields: string[]; // Fields explicitly set by user
    overriddenRuleIds: string[];  // Rules explicitly overridden by user
    userExplicitSkills: string[]; // Skills explicitly mentioned by user (required OR preferred)
  };
}
