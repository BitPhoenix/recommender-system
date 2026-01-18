/**
 * Similarity Function Configuration (Section 5.3.1)
 *
 * Weights for Similarity(T, X) = Σ w_i · Sim(t_i, x_i) / Σ w_i
 * Weights sum to 1.0 for normalized scoring.
 *
 * Used by the similarity calculator for case-based recommendations
 * (finding engineers similar to a reference engineer).
 */

export interface SimilarityWeights {
  skills: number;
  yearsExperience: number;
  domain: number;
  timezone: number;
}

export interface SimilarityParams {
  /* Experience asymmetry: more_is_better coefficient (0-1) */
  experienceAlpha: number;
  /* Maximum years for normalization */
  yearsExperienceMax: number;
  /* Minimum correlation strength to consider */
  minCorrelationStrength: number;
  /* Diversity multiplier for bounded greedy selection */
  diversityMultiplier: number;
  /* Domain years normalization factor */
  domainYearsMax: number;
  /* Domain years similarity floor (prevents years from dominating) */
  domainYearsFloor: number;
}

/**
 * Similarity Weights (Research-derived)
 *
 * INTENTIONAL EXCLUSIONS:
 *
 * Timeline: Two engineers with identical skills/experience are equally
 * "similar" regardless of current availability. Timeline is transient
 * (changes when projects end) and reflects scheduling, not capability.
 * If you need availability filtering, apply it as a post-filter on
 * similarity results, not baked into the similarity score.
 *
 * Salary: Two engineers with identical skills and experience are equally
 * "similar" regardless of their compensation expectations. Ranking by
 * salary would be unfair—salary is a budget constraint, not a similarity
 * dimension.
 *
 * See: thoughts/shared/1_chapter_5/3_project_3/research/2026-01-16-project-3-similarity-scoring.md
 */
export const similarityWeights: SimilarityWeights = {
  skills: 0.45,           // Primary differentiator
  yearsExperience: 0.27,  // Seniority matters for replacement
  domain: 0.22,           // Industry/technical context
  timezone: 0.06,         // Geographic proximity (minor factor)
};

/**
 * Similarity Parameters
 *
 * These control the behavior of individual similarity functions.
 * Baked-in defaults only - not exposed as API parameters.
 */
export const similarityParams: SimilarityParams = {
  experienceAlpha: 0.5,         // Tolerate overshoot, penalize undershoot
  yearsExperienceMax: 20,
  minCorrelationStrength: 0.7,  // Filter weak correlations
  diversityMultiplier: 3,       // Pool = 3 × limit for diversity selection
  domainYearsMax: 10,
  domainYearsFloor: 0.5,        // Years can reduce score by at most 50%
};
