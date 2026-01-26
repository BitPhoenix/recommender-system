import type { JobMatchScoringWeights } from "../types/job-match.types.js";

/*
 * Default scoring weights for job-engineer matching.
 *
 * These are hand-tuned cold-start weights based on the Eightfold architecture.
 * They should sum to 1.0 for normalized scoring.
 *
 * Rationale:
 * - skillSimilarity (0.25): Technical fit is primary signal
 * - requiredSkillCoverage (0.20): Must-have skills are critical
 * - semanticSimilarity (0.20): Overall profile/experience alignment
 * - recentSkillSimilarity (0.10): Recency matters for rapidly evolving tech
 * - seniorityMatch (0.10): Experience level alignment
 * - preferredSkillCoverage (0.05): Nice-to-haves boost score
 * - timezoneMatch (0.05): Logistics/collaboration fit
 * - budgetMatch (0.05): Affordability consideration
 */
export const DEFAULT_JOB_MATCH_WEIGHTS: JobMatchScoringWeights = {
  semanticSimilarity: 0.20,
  skillSimilarity: 0.25,
  recentSkillSimilarity: 0.10,
  requiredSkillCoverage: 0.20,
  preferredSkillCoverage: 0.05,
  seniorityMatch: 0.10,
  timezoneMatch: 0.05,
  budgetMatch: 0.05,
};

/*
 * Validate that weights sum to 1.0 (within floating point tolerance).
 */
export function validateWeights(weights: JobMatchScoringWeights): boolean {
  const sum = Object.values(weights).reduce((acc, w) => acc + w, 0);
  return Math.abs(sum - 1.0) < 0.001;
}
