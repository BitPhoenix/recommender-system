/**
 * Critique Configuration
 *
 * Tuning parameters for critique adjustments.
 * Extracted here for visibility and easy modification.
 */

export const critiqueConfig = {
  /**
   * Budget adjustment settings
   */
  budget: {
    /** Percentage change per directional adjustment (0.20 = 20%) */
    adjustmentFactor: 0.20,
    /** Minimum allowed budget value */
    floorValue: 30_000,
  },

  /**
   * Dynamic critique generation settings
   */
  dynamicCritiques: {
    /** Minimum support threshold for suggestions (0.15 = 15%) */
    minSupportThreshold: 0.15,
    /** Maximum number of suggestions to return */
    maxSuggestions: 5,
  },
} as const;

export type CritiqueConfig = typeof critiqueConfig;
