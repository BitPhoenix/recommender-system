/**
 * Knowledge Base Configuration
 * Contains all rules for the constraint-based recommender system.
 * Implements Section 5.2-5.2.3 from the textbook.
 *
 * Knowledge Base Structure (Section 5.2, p.174):
 * - DIRECT mappings (Filter Conditions): Rules that relate customer requirements
 *   to hard requirements on product attributes.
 *   Example: "Min-Bedrooms≥3 ⇒ Bedrooms≥3"
 *
 * - INDIRECT mappings (Compatibility Constraints): Rules that relate customer
 *   attributes/requirements to typically expected product requirements.
 *   Example: "Family-Size≥5 ⇒ Min-Bedrooms≥3"
 */

import type { KnowledgeBaseConfig } from '../types/knowledge-base.types.js';

export const knowledgeBaseConfig: KnowledgeBaseConfig = {
  // ============================================
  // FILTER CONDITIONS - Direct Mappings (Section 5.2, p.174)
  // ============================================
  // These rules directly map user requirements to product attribute constraints.
  // "Such rules are also referred to as filter conditions."

  /**
   * Seniority Level Mappings
   * Maps manager's seniority requirements to years of experience constraints.
   * Direct mapping: requiredSeniority=senior ⇒ yearsExperience≥6
   */
  seniorityMapping: {
    junior: { minYears: 0, maxYears: 3 },
    mid: { minYears: 3, maxYears: 6 },
    senior: { minYears: 6, maxYears: 10 },
    staff: { minYears: 10, maxYears: null },
    principal: { minYears: 15, maxYears: null },
  },

  /**
   * Risk Tolerance Mappings
   * Maps manager's risk tolerance to confidence score thresholds.
   * Direct mapping: requiredRiskTolerance=low ⇒ confidenceScore≥0.85
   */
  riskToleranceMapping: {
    low: { minConfidenceScore: 0.85 },
    medium: { minConfidenceScore: 0.70 },
    high: { minConfidenceScore: 0.50 },
  },

  /**
   * Proficiency Level Mappings
   * Maps minimum proficiency to allowed proficiency levels.
   * Direct mapping: requiredMinProficiency=proficient ⇒ proficiency∈['proficient','expert']
   */
  proficiencyMapping: {
    learning: ['learning', 'proficient', 'expert'],
    proficient: ['proficient', 'expert'],
    expert: ['expert'],
  },

  // ============================================
  // COMPATIBILITY CONSTRAINTS - Indirect Mappings (Section 5.2, p.174)
  // ============================================
  // These rules relate customer attributes to typically expected product requirements.
  // "Such conditions are also referred to as compatibility conditions, because they
  // can be used to quickly discover inconsistencies in the user-specified requirements."

  /**
   * Team Focus Skill Bonuses
   * Maps team focus to skills that provide ranking boosts.
   * Indirect mapping: teamFocus=greenfield ⇒ bonus for ambiguity/creativity skills
   */
  teamFocusBonusMapping: {
    greenfield: {
      bonusSkillIds: [
        'skill_ambiguity',
        'skill_creativity',
        'skill_ownership',
        'skill_system_design',
      ],
      rationale: 'New projects require navigating unclear requirements',
    },
    migration: {
      bonusSkillIds: [
        'skill_system_design',
        'skill_debugging',
        'skill_attention_detail',
        'skill_documentation',
      ],
      rationale: 'Understanding both old and new systems',
    },
    maintenance: {
      bonusSkillIds: [
        'skill_debugging',
        'skill_root_cause',
        'skill_documentation',
        'skill_code_review',
      ],
      rationale: 'Bug fixing and quality gates',
    },
    scaling: {
      bonusSkillIds: [
        'skill_distributed',
        'skill_system_design',
        'skill_monitoring',
        'skill_kafka',
      ],
      rationale: 'Performance and scalability expertise',
    },
  },

  // ============================================
  // DEFAULT VALUES (Section 5.2.2, p.176-177)
  // ============================================
  // "In some cases, default values may be suggested to the user to provide guidance."
  // Default values help when users don't specify all requirements upfront.

  defaults: {
    requiredRiskTolerance: 'medium',      // was: riskTolerance
    requiredMinProficiency: 'proficient', // was: minProficiency
    requiredAvailability: ['immediate', 'two_weeks', 'one_month'], // was: availability, excludes not_available
    limit: 20,
    offset: 0,
  },

  // ============================================
  // UTILITY FUNCTION CONFIG (Section 5.2.3, p.178)
  // ============================================
  // "Utility functions may be defined as weighted functions of the utilities of
  // individual attributes." Used to rank matched items after filtering.
  // Formula: U(V) = Σ w_j * f_j(v_j)

  /**
   * Attribute Weights for U(V) = Σ w_j * f_j(v_j)
   * Weights sum to 1.0 for normalized scoring.
   * w_j regulates the relative importance of the jth attribute (Section 5.2.3, p.178)
   */
  utilityWeights: {
    // Core attributes (reduced slightly to make room for new bonuses)
    skillMatch: 0.22,              // was 0.25
    confidenceScore: 0.14,         // was 0.16
    yearsExperience: 0.11,         // was 0.13
    availability: 0.11,            // was 0.13
    salary: 0.07,                  // was 0.08
    // Existing bonuses
    preferredSkillsBonus: 0.08,    // was 0.10
    teamFocusBonus: 0.04,          // was 0.05
    relatedSkillsBonus: 0.04,      // was 0.05
    domainBonus: 0.04,             // was 0.05
    // NEW bonuses (total: 0.15)
    preferredAvailabilityBonus: 0.03,
    preferredTimezoneBonus: 0.02,
    preferredSeniorityBonus: 0.03,
    preferredSalaryRangeBonus: 0.03,
    preferredConfidenceBonus: 0.02,
    preferredProficiencyBonus: 0.02,
  },

  /**
   * Parameters for utility functions f_j(v_j)
   * These define the contribution of each attribute value to the utility score.
   * "The design of effective utility functions often requires domain-specific knowledge."
   */
  utilityParams: {
    // Confidence score linear range
    confidenceMin: 0.5,
    confidenceMax: 1.0,
    // Years experience logarithmic max (diminishing returns after 20)
    yearsExperienceMax: 20,
    // Salary inverse linear range
    salaryMin: 80000,
    salaryMax: 300000,
    // Max preferred skills bonus (accumulated from user-specified preferred skills)
    preferredSkillsBonusMax: 1.0,
    // Max team focus bonus (accumulated from compatibility rules)
    teamFocusBonusMax: 0.5,
    // Related skills bonus: number of unmatched skills for max bonus (diminishing returns)
    relatedSkillsBonusMax: 5,
    // Max domain bonus (accumulated from matched preferred domains)
    domainBonusMax: 1.0,
    // NEW params for preferred properties
    preferredAvailabilityBonusMax: 1.0,   // Full bonus for top preference
    preferredTimezoneBonusMax: 1.0,
    preferredSeniorityBonusMax: 1.0,
    preferredSalaryRangeBonusMax: 1.0,
    preferredConfidenceBonusMax: 1.0,
    preferredProficiencyBonusMax: 1.0,
  },

  /**
   * Availability Step Function Values
   * Discrete utility values for categorical availability attribute.
   * Similar to how categorical attributes have domain-specific utility mappings.
   */
  availabilityUtility: {
    immediate: 1.0,
    two_weeks: 0.8,
    one_month: 0.5,
    not_available: 0.0,
  },

  /**
   * Match Strength Classification Thresholds
   * Used to classify candidates into strong/moderate/weak matches.
   * Provides users with intuitive quality indicators for results.
   */
  matchStrengthThresholds: {
    strong: 0.7,   // >= 0.7 is strong
    moderate: 0.4, // >= 0.4 is moderate, < 0.4 is weak
  },
};

export default knowledgeBaseConfig;
