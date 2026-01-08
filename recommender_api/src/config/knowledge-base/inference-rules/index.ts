/**
 * Inference Rules - Combined Export
 * Implements Section 5.2.1 - Iterative Requirement Expansion
 *
 * This module combines filter and boost rules into a single array
 * for the inference engine. Rules are organized by type:
 *
 * - Filter Rules (./filter-rules.config.ts): Hard constraints that exclude candidates
 * - Boost Rules (./boost-rules.config.ts): Soft preferences that affect ranking
 *
 * Multi-hop Chaining:
 * Rules can trigger other rules by deriving skills that are checked
 * by subsequent rules. Example: scaling → distributed → monitoring
 */

import type { InferenceRuleDefinition } from "../../../types/rule-engine.types.js";
import { filterRules } from "./filter-rules.config.js";
import { boostRules } from "./boost-rules.config.js";

/**
 * Maximum iterations for the forward-chaining inference loop.
 * Prevents infinite loops from circular rule dependencies.
 */
export const maxInferenceIterations = 10;

/**
 * Combined inference rules for iterative requirement expansion.
 *
 * Priority levels:
 * - 50: First-hop rules (user fields → skills)
 * - 40: Skill chain rules (skills → skills)
 * - 30: Compound rules (multiple conditions)
 */
export const inferenceRules: InferenceRuleDefinition[] = [
  ...filterRules,
  ...boostRules,
];

// Re-export for granular imports
export { filterRules, boostRules };
