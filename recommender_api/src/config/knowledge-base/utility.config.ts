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
} from '../../types/knowledge-base.types.js';
import type { SeniorityLevel } from '../../types/search.types.js';
import { seniorityMapping } from './compatibility-constraints.config.js';

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
  // skillMatch: 0.37 (absorbed 0.07 from removed salary utility + 0.04 from preferredSkillProficiencyMatch)
  // Now includes both coverage and proficiency matching in one unified score.
  // Salary utility removed - was unfair to higher-earning engineers, now handled by budget filter only
  skillMatch: 0.37,
  relatedSkillsMatch: 0.04,
  confidenceScore: 0.14,
  yearsExperience: 0.11,

  /* Preference matches (conditional on request specifying them) */
  preferredSkillsMatch: 0.08,
  preferredBusinessDomainMatch: 0.02,
  preferredTechnicalDomainMatch: 0.02,
  /*
   * THRESHOLD-BASED: Full score if engineer's timeline is at or faster than
   * preferredMaxStartTime, linear degradation to requiredMaxStartTime, zero beyond.
   * No preference specified = no timeline-based ranking at all.
   */
  startTimelineMatch: 0.10,
  preferredTimezoneMatch: 0.02,
  preferredSeniorityMatch: 0.03,
  /*
   * STEP + LINEAR DECAY (when stretchBudget is set):
   *   - No budget: 1.0 (no salary-based ranking)
   *   - At/under maxBudget: 1.0 (within budget)
   *   - In stretch zone: linear decay from 1.0 to 0.5
   *
   * WHY THIS MODEL: When no budget is specified, we don't want to disadvantage
   * higher-earning engineers - salary reflects experience/market value, not quality.
   * The salary dimension only differentiates when candidates exceed the stated budget.
   *
   * For over-budget candidates, linear decay (not hard cutoff) because teams often
   * stretch for exceptional candidates. Example with $200k max, $220k stretch:
   *   - $200k: score = 1.0 (at budget)
   *   - $210k: score = 0.75 (halfway through stretch)
   *   - $220k: score = 0.5 (at stretch limit)
   */
  budgetMatch: 0.03,

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
   * RATIO: matched / requested, capped at max
   * WHY RATIO: Each preferred item is an explicit user wish with equal weight.
   * Matching 2 of 4 preferred skills is genuinely twice as good as matching 1 of 4 -
   * there's no diminishing returns on satisfying stated preferences.
   */
  preferredSkillsMatchMax: 1.0,
  preferredBusinessDomainMatchMax: 1.0,
  preferredTechnicalDomainMatchMax: 1.0,

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
   * THRESHOLD-BASED with LINEAR DEGRADATION
   * WHY: Managers think "I need someone within X time" - threshold is intuitive.
   * Full score at/faster than preferred, linear degradation to required, zero beyond.
   * Position-based arrays replaced with threshold semantics.
   */
  startTimelineMatchMax: 1.0,
  /*
   * POSITION-BASED: (1 - index / length) * max
   * WHY POSITION-BASED: The user explicitly ordered these preferences. First choice
   * means "this is what we actually want," second choice means "acceptable fallback."
   * Position order carries signal - flattening to binary "match/no-match" loses info.
   */
  preferredTimezoneMatchMax: 1.0,

  /*
   * BINARY: meets threshold ? max : 0
   * WHY BINARY: Seniority is a qualification threshold, not a gradient. A mid-level engineer
   * isn't "60% of a senior" - they either meet the seniority bar or don't.
   */
  preferredSeniorityMatchMax: 1.0,
  /*
   * STEP + LINEAR DECAY: See budgetMatch weight comment above for formula details.
   */
  budgetMatchMax: 1.0,
};

/**
 * Seniority Level Thresholds
 *
 * BINARY threshold mapping: minimum years of experience for each seniority level.
 * Used by calculatePreferredSeniorityMatch - engineer either meets the bar or doesn't.
 *
 * Derived from seniorityMapping to maintain single source of truth.
 */
export const seniorityMinYears = Object.fromEntries(
  Object.entries(seniorityMapping).map(([level, range]) => [level, range.minYears])
) as Record<SeniorityLevel, number>;

