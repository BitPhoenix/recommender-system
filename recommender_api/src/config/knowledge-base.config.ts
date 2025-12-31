/**
 * Knowledge Base Configuration
 * Contains all rules for the constraint-based recommender system.
 * Implements Section 5.2-5.2.3 from the textbook.
 *
 * Knowledge Base Structure (Section 5.2, p.174):
 * - DIRECT mappings (Filter Conditions): Rules that relate customer requirements
 *   to hard requirements on product attributes.
 *   Textbook example: "Min-Bedrooms≥3 ⇒ Bedrooms≥3"
 *   Codebase example: "requiredSkills=['typescript'] ⇒ skills contains 'typescript'"
 *
 * - INDIRECT mappings (Compatibility Constraints): Rules that relate customer
 *   attributes/requirements to typically expected product requirements.
 *   Textbook example: "Family-Size≥5 ⇒ Min-Bedrooms≥3"
 *   Codebase example: "requiredSeniority=senior ⇒ yearsExperience≥6"
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
   * Team Focus Skill Alignment
   * Maps team focus to skills that are contextually relevant.
   * Indirect mapping: teamFocus=greenfield ⇒ boost for ambiguity/creativity skills
   */
  teamFocusSkillAlignment: {
    greenfield: {
      alignedSkillIds: [
        'skill_ambiguity',
        'skill_creativity',
        'skill_ownership',
        'skill_system_design',
      ],
      rationale: 'New projects require navigating unclear requirements',
    },
    migration: {
      alignedSkillIds: [
        'skill_system_design',
        'skill_debugging',
        'skill_attention_detail',
        'skill_documentation',
      ],
      rationale: 'Understanding both old and new systems',
    },
    maintenance: {
      alignedSkillIds: [
        'skill_debugging',
        'skill_root_cause',
        'skill_documentation',
        'skill_code_review',
      ],
      rationale: 'Bug fixing and quality gates',
    },
    scaling: {
      alignedSkillIds: [
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
    // Candidate attributes (always evaluated)
    skillMatch: 0.22,
    relatedSkillsMatch: 0.04,
    confidenceScore: 0.14,
    yearsExperience: 0.11,
    availability: 0.11,
    salary: 0.07,

    // Preference matches (conditional on request specifying them)
    preferredSkillsMatch: 0.08,
    preferredDomainMatch: 0.04,
    preferredAvailabilityMatch: 0.03,
    preferredTimezoneMatch: 0.02,
    preferredSeniorityMatch: 0.03,
    preferredSalaryRangeMatch: 0.03,
    preferredConfidenceMatch: 0.02,
    preferredProficiencyMatch: 0.02,

    // Team context alignment
    teamFocusMatch: 0.04,
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
    // Preference match maximums
    preferredSkillsMatchMax: 1.0,
    teamFocusMatchMax: 0.5,
    relatedSkillsMatchMax: 5,
    preferredDomainMatchMax: 1.0,
    preferredAvailabilityMatchMax: 1.0,
    preferredTimezoneMatchMax: 1.0,
    preferredSeniorityMatchMax: 1.0,
    preferredSalaryRangeMatchMax: 1.0,
    preferredConfidenceMatchMax: 1.0,
    preferredProficiencyMatchMax: 1.0,
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
