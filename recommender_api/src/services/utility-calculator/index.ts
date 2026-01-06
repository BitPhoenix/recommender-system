/**
 * Utility Calculator Module
 * Exports the public API for utility score calculation.
 */

// Re-export public types
export type {
  EngineerData,
  UtilityContext,
  ScoredEngineer,
  UtilityCalculationResult,
} from './types.js';

// Re-export public functions
export {
  calculateUtilityWithBreakdown,
  calculateUtilityScore,
  scoreAndSortEngineers,
} from './utility-calculator.js';
