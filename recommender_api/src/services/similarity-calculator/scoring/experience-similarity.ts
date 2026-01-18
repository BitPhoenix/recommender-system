/**
 * Experience Similarity Scoring
 *
 * Asymmetric: more experience is acceptable (α=0.5 reduces penalty),
 * less experience gets full penalty.
 *
 * Formula (Equation 5.5 from textbook):
 *   Sim(t, x) = 1 - |diff|/max + α · I(x > t) · |diff|/max
 *
 * When candidate has more experience (diff > 0):
 *   score = 1 - (normalizedDiff * (1 - α))
 *
 * When candidate has less experience (diff < 0):
 *   score = 1 - normalizedDiff  (full penalty)
 */

/*
 * Why α = 0.5 ("more_is_better" with partial tolerance)?
 *
 * α controls how we treat candidates with MORE experience than the target:
 *   - α = 0: Symmetric penalty (8 years vs 6 years penalized same as 4 years vs 6 years)
 *   - α = 0.5: Reduced penalty for overshoot (current setting)
 *   - α = 1: No penalty for overshoot
 *
 * Example with target = 6 years:
 *   - Candidate with 4 years: score = 0.9 (less experienced = less similar)
 *   - Candidate with 8 years: score = 0.95 (more experienced = slightly less similar)
 *
 * α=0.5 interpretation: "Find engineers around 6 years—a solid senior level.
 * Someone with 4 years may lack the seniority we need. Someone with 8 years
 * is closer to what we want, but a staff-level engineer might be overqualified—
 * they could get bored or expect faster promotion."
 *
 * If you wanted "more experience is always fine", use α=1 instead.
 */

import type { ExperienceSimilarityResult } from '../types.js';
import { similarityParams } from '../../../config/knowledge-base/similarity.config.js';

export function calculateExperienceSimilarity(
  targetYears: number,
  candidateYears: number
): ExperienceSimilarityResult {
  const { yearsExperienceMax, experienceAlpha } = similarityParams;

  const diff = candidateYears - targetYears;
  const normalizedDiff = Math.abs(diff) / yearsExperienceMax;

  let score: number;
  if (diff > 0) {
    // Candidate has more experience: reduce penalty by α
    score = Math.max(0, 1 - (normalizedDiff * (1 - experienceAlpha)));
  } else {
    // Candidate has less experience: full penalty
    score = Math.max(0, 1 - normalizedDiff);
  }

  return { score };
}
