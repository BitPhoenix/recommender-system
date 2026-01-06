/**
 * Core Scoring Functions
 * Normalization utilities and core attribute utility calculations.
 */

/**
 * Normalizes a value to [0, 1] using linear scaling.
 *
 * Function type: LINEAR (helper)
 * Formula: (value - min) / (max - min)
 */
export function normalizeLinear(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Normalizes a value to [0, 1] using inverse linear scaling.
 * Lower values get higher scores.
 *
 * Function type: INVERSE LINEAR (helper)
 * Formula: (max - value) / (max - min)
 */
export function normalizeLinearInverse(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (max - value) / (max - min)));
}

/**
 * Calculates confidence score utility.
 *
 * Function type: LINEAR
 * Formula: (confidence - min) / (max - min)
 *
 * Rationale: ML confidence scores are already calibrated probabilities. A 0.7→0.8
 * jump represents a genuine 10% improvement in match certainty. Unlike experience
 * (where gains diminish), each point of confidence means more reliable skill inference.
 * Below 0.5 is filtered out, so this range is "acceptable" to "highly confident."
 */
export function calculateConfidenceUtility(
  avgConfidence: number,
  min: number,
  max: number
): number {
  if (avgConfidence <= 0) {
    return 0.5; // Neutral when no skill filtering is applied
  }
  return normalizeLinear(avgConfidence, min, max);
}

/**
 * Calculates years of experience utility.
 *
 * Function type: LOGARITHMIC
 * Formula: log(1 + years) / log(1 + maxYears)
 *
 * Rationale: Early career years add distinct capabilities - junior→mid gains project
 * ownership, mid→senior gains mentorship and architectural judgment. But 15→20 years
 * adds polish, not fundamentally new capabilities. Hiring managers confirm: "5 years
 * vs 0" is a different conversation than "22 years vs 17."
 */
export function calculateExperienceUtility(
  yearsExperience: number,
  maxYears: number
): number {
  const logYears = Math.log(1 + yearsExperience);
  const logMax = Math.log(1 + maxYears);
  return Math.min(logYears / logMax, 1);
}

/**
 * Calculates salary utility.
 *
 * Function type: INVERSE LINEAR
 * Formula: (max - salary) / (max - min)
 *
 * Rationale: Every dollar saved has equal value - $20k under budget is $20k that
 * could fund tooling or headcount, regardless of the salary level. We don't use
 * logarithmic (where the first $50k saved matters more than the next) because
 * budget math is linear, not diminishing returns. When maxSalaryBudget is specified
 * in the request, it replaces salaryMax as the ceiling.
 */
export function calculateSalaryUtility(
  salary: number,
  maxBudget: number | null,
  minSalary: number,
  maxSalary: number
): number {
  // If no budget specified, use neutral scoring
  if (maxBudget === null) {
    return normalizeLinearInverse(salary, minSalary, maxSalary);
  }

  // If salary exceeds budget, penalize heavily
  if (salary > maxBudget) {
    return 0;
  }

  // Otherwise, inverse linear within budget
  return normalizeLinearInverse(salary, minSalary, maxBudget);
}
