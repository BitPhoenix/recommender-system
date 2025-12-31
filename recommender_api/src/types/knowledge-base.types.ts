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
 * Maps team focus to skills that are contextually relevant.
 * These skills provide a ranking boost but are not hard filters.
 */
export interface TeamFocusSkillAlignment {
  alignedSkillIds: string[];
  rationale: string;
}

export type TeamFocusSkillAlignmentMapping = Record<TeamFocus, TeamFocusSkillAlignment>;

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
  // Candidate attributes (always evaluated)
  skillMatch: number;
  relatedSkillsMatch: number;
  confidenceScore: number;
  yearsExperience: number;
  availability: number;
  salary: number;

  // Preference matches (conditional on request specifying them)
  preferredSkillsMatch: number;
  preferredDomainMatch: number;
  preferredAvailabilityMatch: number;
  preferredTimezoneMatch: number;
  preferredSeniorityMatch: number;
  preferredSalaryRangeMatch: number;
  preferredConfidenceMatch: number;
  preferredProficiencyMatch: number;

  // Team context alignment
  teamFocusMatch: number;
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
  // Preference match maximums
  preferredSkillsMatchMax: number;
  teamFocusMatchMax: number;
  relatedSkillsMatchMax: number;
  preferredDomainMatchMax: number;
  preferredAvailabilityMatchMax: number;
  preferredTimezoneMatchMax: number;
  preferredSeniorityMatchMax: number;
  preferredSalaryRangeMatchMax: number;
  preferredConfidenceMatchMax: number;
  preferredProficiencyMatchMax: number;
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
  teamFocusSkillAlignment: TeamFocusSkillAlignmentMapping;
  defaults: SearchDefaults;
  utilityWeights: UtilityWeights;
  utilityParams: UtilityFunctionParams;
  availabilityUtility: AvailabilityUtility;
  matchStrengthThresholds: MatchStrengthThresholds;
}
