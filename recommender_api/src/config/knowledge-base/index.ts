/**
 * Knowledge Base Configuration
 *
 * Contains all rules for the constraint-based recommender system.
 * Implements Section 5.2-5.2.3 from the textbook.
 *
 * Knowledge Base Structure (Section 5.2, p.174):
 *
 * - Filter Conditions (CF): Rules that relate customer requirements
 *   to hard requirements on product attributes.
 *   See: ./filter-conditions.config.ts
 *
 * - Compatibility Constraints (CC): Rules that relate customer
 *   attributes/requirements to typically expected product requirements.
 *   See: ./compatibility-constraints.config.ts
 *
 * - Default Values (Section 5.2.2): Sensible defaults for unspecified requirements.
 *   See: ./defaults.config.ts
 *
 * - Utility Functions (Section 5.2.3): Weighted scoring functions for ranking.
 *   See: ./utility.config.ts
 */

import type { KnowledgeBaseConfig } from '../../types/knowledge-base.types.js';

// Filter Conditions (Direct Mappings)
import { proficiencyMapping } from './filter-conditions.config.js';

// Compatibility Constraints (Indirect Mappings)
import {
  seniorityMapping,
  teamFocusSkillAlignment,
} from './compatibility-constraints.config.js';

// Default Values
import { defaults } from './defaults.config.js';

// Utility Function Configuration
import {
  utilityWeights,
  utilityParams,
} from './utility.config.js';

// Inference Rules (Section 5.2.1 - Iterative Expansion)
import {
  inferenceRules,
  maxInferenceIterations,
} from './inference-rules/index.js';

/**
 * Assembled Knowledge Base Configuration
 *
 * This combines all configuration modules into a single typed object
 * for use throughout the application.
 */
export const knowledgeBaseConfig: KnowledgeBaseConfig = {
  // Filter Conditions (Section 5.2, p.174)
  proficiencyMapping,

  // Compatibility Constraints (Section 5.2, p.174)
  seniorityMapping,
  teamFocusSkillAlignment,

  // Default Values (Section 5.2.2, p.176-177)
  defaults,

  // Utility Function Config (Section 5.2.3, p.178)
  utilityWeights,
  utilityParams,

  // Inference Rules (Section 5.2.1 - Iterative Expansion)
  inferenceRules,
  maxInferenceIterations,
};

// Re-export individual configs for granular imports
export {
  proficiencyMapping,
  seniorityMapping,
  teamFocusSkillAlignment,
  defaults,
  utilityWeights,
  utilityParams,
  inferenceRules,
  maxInferenceIterations,
};

export default knowledgeBaseConfig;
