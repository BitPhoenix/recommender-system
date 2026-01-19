/**
 * Critique API Types (Section 5.3.2)
 *
 * Implements conversational refinement of search results through
 * directional, replacement, and skill-based critiques.
 */

import type {
  EngineerMatch,
  AppliedFilter,
  AppliedPreference,
  DerivedConstraintInfo,
  RelaxationResult,
  TighteningResult,
} from './search.types.js';

// Re-export schema types
export type {
  CritiquableProperty,
  CritiqueOperation,
  Direction,
  SkillValue,
  DomainValue,
  CritiqueAdjustment,
  CritiqueRequest,
  // Individual operation types for type-safe handling
  AdjustOperation,
  SetOperation,
  AddOperation,
  RemoveOperation,
} from '../schemas/critique.schema.js';

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Full critique response.
 */
export interface CritiqueResponse {
  /** Results after applying critique */
  matches: EngineerMatch[];
  totalCount: number;

  /** What was applied (transparency) */
  appliedFilters: AppliedFilter[];
  appliedPreferences: AppliedPreference[];
  derivedConstraints: DerivedConstraintInfo[];

  /** Critique adjustments that were successfully applied */
  appliedCritiqueAdjustments: AppliedCritiqueAdjustment[];
  /** Critique adjustments that could not be applied (e.g., no budget to adjust) */
  failedCritiqueAdjustments: FailedCritiqueAdjustment[];

  /** Dynamic critique suggestions (Section 5.3.2.3) */
  suggestedCritiques?: DynamicCritiqueSuggestion[];

  /** Constraint advice (reuse existing) */
  relaxation?: RelaxationResult;
  tightening?: TighteningResult;

  queryMetadata: CritiqueQueryMetadata;
}

/**
 * Query metadata for critique operations.
 */
export interface CritiqueQueryMetadata {
  executionTimeMs: number;
  skillsExpanded: string[];
  defaultsApplied: string[];
  unresolvedSkills: string[];
  /** Result count before critique was applied */
  previousResultCount: number;
  /** Change in result count after critique (+/-) */
  resultCountChange: number;
}

// ============================================
// CRITIQUE ADJUSTMENT BASE TYPE
// ============================================

/**
 * Base fields for a critique adjustment request.
 * Used by AppliedCritiqueAdjustment, FailedCritiqueAdjustment, and DynamicCritiqueSuggestion.
 */
export interface CritiqueAdjustmentBase {
  property: string;
  operation: string;
  direction?: string;
  value?: unknown;
  item?: string;
}

// ============================================
// APPLIED CRITIQUE TYPES
// ============================================

/**
 * Records what adjustment was actually applied.
 * Extends base request fields with result information.
 */
export interface AppliedCritiqueAdjustment extends CritiqueAdjustmentBase {
  /** The field that was modified in the base search (e.g., 'requiredSeniorityLevel') */
  modifiedField: string;
  /** The previous value (from baseSearch) */
  previousValue: unknown;
  /** The new value (after critique) */
  newValue: unknown;
  /** Warning if critique was applied but hit a boundary (e.g., already at maximum) */
  warning?: string;
}

/**
 * Records an adjustment that could not be applied.
 * Extends base request fields with failure information.
 */
export interface FailedCritiqueAdjustment extends CritiqueAdjustmentBase {
  /** The field that would have been modified */
  targetField: string;
  /** Reason the adjustment couldn't be applied */
  reason: string;
}

// ============================================
// DYNAMIC CRITIQUE SUGGESTION TYPES
// ============================================

/**
 * A dynamic critique suggestion mined from current results.
 * Ordered by ascending support (low-support patterns first per Section 5.3.2.3).
 */
export interface DynamicCritiqueSuggestion {
  /** The suggested critique adjustments */
  adjustments: CritiqueAdjustmentBase[];
  /** Human-readable description */
  description: string;
  /** How many results this yields */
  resultingMatches: number;
  /** What percentage of current results have this pattern (0-1) */
  support: number;
  /** Rationale for why this suggestion is useful */
  rationale: string;
}
