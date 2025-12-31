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
  /* Candidate attributes (always evaluated) */
  skillMatch: 0.22,
  relatedSkillsMatch: 0.04,
  confidenceScore: 0.14,
  yearsExperience: 0.11,
  startTimeline: 0.11,
  salary: 0.07,

  /* Preference matches (conditional on request specifying them) */
  preferredSkillsMatch: 0.08,
  preferredDomainMatch: 0.04,
  preferredStartTimelineMatch: 0.03,
  preferredTimezoneMatch: 0.02,
  preferredSeniorityMatch: 0.03,
  preferredSalaryRangeMatch: 0.03,
  /* Per-skill preferred proficiency (replaces global preferredConfidenceMatch + preferredProficiencyMatch) */
  preferredSkillProficiencyMatch: 0.04,

  /* Team context alignment */
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
  /*
   * LINEAR: (confidence - 0.5) / (1.0 - 0.5)
   * WHY LINEAR: ML confidence scores are already calibrated probabilities. A 0.7→0.8
   * jump represents a genuine 10% improvement in match certainty. Unlike experience
   * (where gains diminish), each point of confidence means more reliable skill inference.
   * Below 0.5 is filtered out, so this range is "acceptable" to "highly confident."
   */
  confidenceMin: 0.5,
  confidenceMax: 1.0,

  /*
   * LOGARITHMIC: log(1 + years) / log(1 + 20)
   * WHY LOGARITHMIC: Early career years add distinct capabilities - junior→mid gains
   * project ownership, mid→senior gains mentorship and architectural judgment. But
   * 15→20 years adds polish, not fundamentally new capabilities. Hiring managers
   * confirm: "5 years vs 0" is a different conversation than "22 years vs 17."
   */
  yearsExperienceMax: 20,

  /*
   * INVERSE LINEAR: (max - salary) / (max - min)
   * WHY INVERSE LINEAR: Every dollar saved has equal value - $20k under budget is
   * $20k that could fund tooling or headcount, regardless of the salary level.
   * We don't use logarithmic (where the first $50k saved matters more than the next)
   * because budget math is linear, not diminishing returns.
   * When maxSalaryBudget is specified in the request, it replaces salaryMax as ceiling.
   */
  salaryMin: 80000,
  salaryMax: 300000,

  /*
   * RATIO: matched / requested, capped at max
   * WHY RATIO: Each preferred item is an explicit user wish with equal weight.
   * Matching 2 of 4 preferred skills is genuinely twice as good as matching 1 of 4 -
   * there's no diminishing returns on satisfying stated preferences.
   */
  preferredSkillsMatchMax: 1.0,
  preferredDomainMatchMax: 1.0,
  preferredSkillProficiencyMatchMax: 1.0,

  /*
   * RATIO with lower max (0.5)
   * WHY LOWER MAX: Team alignment is a tiebreaker, not a primary criterion. We don't
   * want "matches team stack" to outweigh "has the actual required skills."
   */
  teamFocusMatchMax: 0.5,

  /*
   * EXPONENTIAL DECAY: (1 - e^(-count/5)) * 5
   * WHY EXPONENTIAL DECAY: Having 1-2 related skills signals learning agility and
   * T-shaped breadth. But accumulating 10+ doesn't make someone twice as valuable as
   * having 5 - it just means a longer resume. We reward breadth but don't let it dominate.
   */
  relatedSkillsMatchMax: 5,

  /*
   * POSITION-BASED: (1 - index / length) * max
   * WHY POSITION-BASED: The user explicitly ordered these preferences. First choice
   * means "this is what we actually want," second choice means "acceptable fallback."
   * Position order carries signal - flattening to binary "match/no-match" loses info.
   */
  preferredStartTimelineMatchMax: 1.0,
  preferredTimezoneMatchMax: 1.0,

  /*
   * BINARY: meets threshold ? max : 0
   * WHY BINARY: These are qualification thresholds, not gradients. A mid-level engineer
   * isn't "60% of a senior" - they either meet the seniority bar or don't. Similarly,
   * salary either fits the preferred range or doesn't. Partial credit doesn't make sense.
   */
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
