/**
 * Utility Function Configuration (Section 5.2.3, p.178)
 *
 * From the textbook:
 * "Utility functions may be defined as weighted functions of the utilities of
 * individual attributes."
 *
 * Used to rank matched items after filtering.
 * Formula: U(V) = Σ w_j * f_j(v_j)
 *
 * Where:
 * - U(V) is the overall utility of a product V
 * - w_j is the weight of attribute j (regulates relative importance)
 * - f_j(v_j) is the utility function for attribute j evaluated at value v_j
 */

import type {
  UtilityWeights,
  UtilityFunctionParams,
  StartTimelineUtility,
} from '../../types/knowledge-base.types.js';

/**
 * Attribute Weights (Section 5.2.3, p.178)
 *
 * Weights for U(V) = Σ w_j * f_j(v_j)
 * Weights sum to 1.0 for normalized scoring.
 *
 * From the textbook:
 * "w_j regulates the relative importance of the jth attribute"
 */
export const utilityWeights: UtilityWeights = {
  // Candidate attributes (always evaluated)
  skillMatch: 0.22,
  relatedSkillsMatch: 0.04,
  confidenceScore: 0.14,
  yearsExperience: 0.11,
  startTimeline: 0.11,
  salary: 0.07,

  // Preference matches (conditional on request specifying them)
  preferredSkillsMatch: 0.08,
  preferredDomainMatch: 0.04,
  preferredStartTimelineMatch: 0.03,
  preferredTimezoneMatch: 0.02,
  preferredSeniorityMatch: 0.03,
  preferredSalaryRangeMatch: 0.03,
  // Per-skill preferred proficiency (replaces global preferredConfidenceMatch + preferredProficiencyMatch)
  preferredSkillProficiencyMatch: 0.04,

  // Team context alignment
  teamFocusMatch: 0.04,
};

/**
 * Utility Function Parameters (Section 5.2.3, p.178)
 *
 * Parameters for individual utility functions f_j(v_j).
 * These define the contribution of each attribute value to the utility score.
 *
 * From the textbook:
 * "The design of effective utility functions often requires domain-specific knowledge."
 */
export const utilityParams: UtilityFunctionParams = {
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
  preferredStartTimelineMatchMax: 1.0,
  preferredTimezoneMatchMax: 1.0,
  preferredSeniorityMatchMax: 1.0,
  preferredSalaryRangeMatchMax: 1.0,
  // Per-skill preferred proficiency match max
  preferredSkillProficiencyMatchMax: 1.0,
};

/**
 * Start Timeline Step Function Values (Section 5.2.3, p.178)
 *
 * Discrete utility values for categorical start timeline attribute.
 * Step functions are appropriate for categorical attributes where
 * each value has a distinct, non-interpolatable utility.
 *
 * Note: All options have positive utility - even candidates who need a year
 * are valuable to include in results, just ranked lower.
 */
export const startTimelineUtility: StartTimelineUtility = {
  immediate: 1.0,
  two_weeks: 0.9,
  one_month: 0.75,
  three_months: 0.5,
  six_months: 0.25,
  one_year: 0.1,
};
