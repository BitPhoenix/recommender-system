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
 * Scaling function types used:
 *
 * LINEAR: f(x) = (x - min) / (max - min)
 *   Maps value linearly to [0, 1]. Simple and intuitive - each unit increase
 *   contributes equally. Used when the attribute has consistent marginal value.
 *
 * INVERSE LINEAR: f(x) = (max - x) / (max - min)
 *   Lower values score higher. Used for cost attributes where less is better.
 *
 * LOGARITHMIC: f(x) = log(1 + x) / log(1 + max)
 *   Diminishing returns - early gains matter more. Used for experience where
 *   the jump from 0→5 years matters more than 15→20 years.
 *
 * EXPONENTIAL DECAY: f(x) = (1 - e^(-x/scale)) * max
 *   Quickly approaches max then plateaus. Used for bonus attributes where
 *   having "some" matters, but piling on more has diminishing benefit.
 *
 * RATIO: f(x) = min(matched / requested, max)
 *   Proportion of requested items matched, capped. Used for preference lists
 *   where matching all requested items = full score.
 *
 * POSITION-BASED: f(x) = (1 - index / length) * max
 *   Higher score for earlier matches in ordered preference list.
 *
 * BINARY (STEP): f(x) = x meets threshold ? max : 0
 *   All-or-nothing. Used when partial matches aren't meaningful.
 *
 * From the textbook:
 * "The design of effective utility functions often requires domain-specific knowledge."
 */
export const utilityParams: UtilityFunctionParams = {
  // LINEAR: (confidence - 0.5) / (1.0 - 0.5)
  // Maps ML confidence [0.5, 1.0] to utility [0, 1]. Below 0.5 is filtered out,
  // so this range represents "acceptable" to "highly confident" skill matches.
  confidenceMin: 0.5,
  confidenceMax: 1.0,

  // LOGARITHMIC: log(1 + years) / log(1 + 20)
  // Diminishing returns after ~20 years. A 5-year engineer vs 0-year is a big
  // difference; 25-year vs 20-year is marginal. Reflects real hiring value.
  yearsExperienceMax: 20,

  // INVERSE LINEAR: (300k - salary) / (300k - 80k)
  // Lower salary = higher utility (budget fit). Range covers typical market.
  // When maxBudget is specified, uses that as ceiling instead.
  salaryMin: 80000,
  salaryMax: 300000,

  // RATIO: matched / requested, capped at max
  // These represent "what fraction of preferred items did we match?"
  preferredSkillsMatchMax: 1.0, // Preferred skills coverage
  preferredDomainMatchMax: 1.0, // Preferred domains coverage
  preferredSkillProficiencyMatchMax: 1.0, // Skills meeting proficiency requirements

  // RATIO with lower max: team focus is a smaller bonus, not a primary criterion
  teamFocusMatchMax: 0.5,

  // EXPONENTIAL DECAY: (1 - e^(-count/5)) * 5
  // Related skills beyond ~5 provide diminishing value. Having 1-2 related
  // skills is valuable; having 10 vs 8 matters less.
  relatedSkillsMatchMax: 5,

  // POSITION-BASED: (1 - index / length) * max
  // Earlier positions in preference list score higher. First choice = 100%,
  // second = 75%, third = 50%, etc.
  preferredStartTimelineMatchMax: 1.0,
  preferredTimezoneMatchMax: 1.0,

  // BINARY: meets threshold ? max : 0
  // Either matches the requirement or doesn't - no partial credit.
  preferredSeniorityMatchMax: 1.0,
  preferredSalaryRangeMatchMax: 1.0,
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
