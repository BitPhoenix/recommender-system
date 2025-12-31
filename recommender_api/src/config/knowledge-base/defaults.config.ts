/**
 * Default Values Configuration (Section 5.2.2, p.176-177)
 *
 * From the textbook:
 * "In some cases, default values may be suggested to the user to provide guidance."
 *
 * Default values help when users don't specify all requirements upfront.
 * They provide sensible starting points that can be overridden.
 */

import type { SearchDefaults } from '../../types/knowledge-base.types.js';

/**
 * Search Defaults (Section 5.2.2, p.176-177)
 *
 * Sensible defaults applied when fields are unspecified in a search request.
 * These defaults ensure the system can return results even with minimal input
 * while maintaining reasonable quality thresholds.
 */
export const defaults: SearchDefaults = {
  // Confidence score is now internalized (equivalent to 'medium' risk tolerance)
  defaultMinConfidenceScore: 0.70,
  // Default proficiency for skills without explicit minProficiency
  defaultMinProficiency: 'learning',
  requiredAvailability: ['immediate', 'two_weeks', 'one_month'], // excludes not_available
  limit: 20,
  offset: 0,
};
