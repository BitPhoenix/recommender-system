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
 *
 * When no skill filtering is applied, avgConfidence is 0 and we return 0 since
 * confidence is irrelevant (all engineers get the same value, so ranking unaffected).
 */
export function calculateConfidenceUtility(
  avgConfidence: number,
  min: number,
  max: number
): number {
  if (avgConfidence <= 0) {
    return 0; // No skill filtering applied, confidence is irrelevant
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

