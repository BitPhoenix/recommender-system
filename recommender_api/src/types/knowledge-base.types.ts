/**
 * Knowledge Base Types
 * Implements Section 5.2.1 (Returning Relevant Results) from the textbook.
 *
 * The knowledge base contains two types of rules:
 * 1. Filter Conditions - Map user requirements directly to product attribute constraints
 * 2. Compatibility Constraints - Infer expected product requirements based on context
 */

import type {
  SeniorityLevel,
  RiskTolerance,
  TeamFocus,
  ProficiencyLevel,
  AvailabilityOption,
} from './search.types.js';

// ============================================
// FILTER CONDITION RULES (Section 5.2.1)
// ============================================

/**
 * Maps user requirements directly to database constraints.
 * Example: "senior" -> yearsExperience >= 6 AND yearsExperience < 10
 */
export interface ExperienceRange {
  minYears: number;
  maxYears: number | null; // null means no upper limit
}

export type SeniorityMapping = Record<SeniorityLevel, ExperienceRange>;

/**
 * Maps risk tolerance to confidence score thresholds.
 * Example: "medium" -> confidenceScore >= 0.70
 */
export interface ConfidenceThreshold {
  minConfidenceScore: number;
}

export type RiskToleranceMapping = Record<RiskTolerance, ConfidenceThreshold>;

/**
 * Maps proficiency levels to allowed values.
 * Example: "proficient" -> allows ['proficient', 'expert']
 */
export type ProficiencyMapping = Record<ProficiencyLevel, ProficiencyLevel[]>;

// ============================================
// COMPATIBILITY CONSTRAINT RULES (Section 5.2.1)
// ============================================

/**
 * Maps team focus to bonus skills for ranking.
 * These skills provide a ranking boost but are not hard filters.
 */
export interface TeamFocusBonus {
  bonusSkillIds: string[];
  rationale: string;
}

export type TeamFocusBonusMapping = Record<TeamFocus, TeamFocusBonus>;

// ============================================
// DEFAULT VALUES (Section 5.2.2)
// ============================================

/**
 * Sensible defaults applied when fields are unspecified.
 */
export interface SearchDefaults {
  requiredRiskTolerance: RiskTolerance;      // was: riskTolerance
  requiredMinProficiency: ProficiencyLevel;  // was: minProficiency
  requiredAvailability: AvailabilityOption[]; // was: availability
  limit: number;
  offset: number;
}

// ============================================
// UTILITY FUNCTION CONFIG (Section 5.2.3)
// ============================================

/**
 * Weights for the utility function: U(V) = Σ w_j * f_j(v_j)
 */
export interface UtilityWeights {
  skillMatch: number;
  confidenceScore: number;
  yearsExperience: number;
  availability: number;
  salary: number;
  preferredSkillsBonus: number;
  teamFocusBonus: number;
  relatedSkillsBonus: number;  // Bonus for unmatched related skills in hierarchy
  domainBonus: number;         // Bonus for matching preferred domains
  // NEW weights for preferred properties
  preferredAvailabilityBonus: number;
  preferredTimezoneBonus: number;
  preferredSeniorityBonus: number;
  preferredSalaryRangeBonus: number;
  preferredConfidenceBonus: number;
  preferredProficiencyBonus: number;
}

/**
 * Parameters for individual utility functions.
 */
export interface UtilityFunctionParams {
  // Skill match is calculated separately
  // Confidence score linear params
  confidenceMin: number;
  confidenceMax: number;
  // Years experience logarithmic params
  yearsExperienceMax: number;
  // Salary inverse linear params
  salaryMin: number;
  salaryMax: number;
  // Preferred skills bonus max
  preferredSkillsBonusMax: number;
  // Team focus bonus max
  teamFocusBonusMax: number;
  // Related skills bonus max (number of unmatched skills for max bonus)
  relatedSkillsBonusMax: number;
  // Domain bonus max
  domainBonusMax: number;
  // NEW params for preferred properties
  preferredAvailabilityBonusMax: number;
  preferredTimezoneBonusMax: number;
  preferredSeniorityBonusMax: number;
  preferredSalaryRangeBonusMax: number;
  preferredConfidenceBonusMax: number;
  preferredProficiencyBonusMax: number;
}

/**
 * Availability step function values.
 */
export type AvailabilityUtility = Record<AvailabilityOption, number>;

/**
 * Thresholds for match strength classification.
 */
export interface MatchStrengthThresholds {
  strong: number;   // >= this is strong
  moderate: number; // >= this is moderate, below is weak
}

// ============================================
// COMPLETE KNOWLEDGE BASE CONFIG
// ============================================

export interface KnowledgeBaseConfig {
  seniorityMapping: SeniorityMapping;
  riskToleranceMapping: RiskToleranceMapping;
  proficiencyMapping: ProficiencyMapping;
  teamFocusBonusMapping: TeamFocusBonusMapping;
  defaults: SearchDefaults;
  utilityWeights: UtilityWeights;
  utilityParams: UtilityFunctionParams;
  availabilityUtility: AvailabilityUtility;
  matchStrengthThresholds: MatchStrengthThresholds;
}
