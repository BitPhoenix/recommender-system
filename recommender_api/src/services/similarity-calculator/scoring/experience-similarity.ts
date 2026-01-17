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
