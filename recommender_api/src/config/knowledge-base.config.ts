/**
 * Knowledge Base Configuration
 * Contains all rules for the constraint-based recommender system.
 * Implements Section 5.2.1-5.2.3 from the textbook.
 */

import type { KnowledgeBaseConfig } from '../types/knowledge-base.types.js';

export const knowledgeBaseConfig: KnowledgeBaseConfig = {
  // ============================================
  // FILTER CONDITIONS (Section 5.2.1)
  // ============================================

  /**
   * Seniority Level Mappings
   * Maps manager's seniority requirements to years of experience constraints.
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
   */
  riskToleranceMapping: {
    low: { minConfidenceScore: 0.85 },
    medium: { minConfidenceScore: 0.70 },
    high: { minConfidenceScore: 0.50 },
  },

  /**
   * Proficiency Level Mappings
   * Maps minimum proficiency to allowed proficiency levels.
   */
  proficiencyMapping: {
    learning: ['learning', 'proficient', 'expert'],
    proficient: ['proficient', 'expert'],
    expert: ['expert'],
  },

  // ============================================
  // COMPATIBILITY CONSTRAINTS (Section 5.2.1)
  // ============================================

  /**
   * Team Focus Skill Bonuses
   * Maps team focus to skills that provide ranking boosts.
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
  // DEFAULT VALUES (Section 5.2.2)
  // ============================================

  defaults: {
    requiredRiskTolerance: 'medium',      // was: riskTolerance
    requiredMinProficiency: 'proficient', // was: minProficiency
    requiredAvailability: ['immediate', 'two_weeks', 'one_month'], // was: availability, excludes not_available
    limit: 20,
    offset: 0,
  },

  // ============================================
  // UTILITY FUNCTION CONFIG (Section 5.2.3)
  // ============================================

  /**
   * Attribute Weights for U(V) = Σ w_j * f_j(v_j)
   * Weights sum to 1.0 for normalized scoring.
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
   * Parameters for utility functions
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
   */
  availabilityUtility: {
    immediate: 1.0,
    two_weeks: 0.8,
    one_month: 0.5,
    not_available: 0.0,
  },

  /**
   * Match Strength Classification Thresholds
   */
  matchStrengthThresholds: {
    strong: 0.7,   // >= 0.7 is strong
    moderate: 0.4, // >= 0.4 is moderate, < 0.4 is weak
  },
};

export default knowledgeBaseConfig;
