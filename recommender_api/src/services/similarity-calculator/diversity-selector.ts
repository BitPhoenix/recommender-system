/**
 * Diversity Selector
 *
 * Implements bounded greedy selection (Section 5.3.1.1).
 * Quality(X) = Similarity(target, X) × D_avg(X, selected)
 *
 * This prevents returning homogeneous results (e.g., 5 nearly identical
 * React/Node.js engineers). Instead, it balances similarity to the target
 * with diversity among the selected results.
 *
 * Uses the same graph-aware similarity functions as the main scorer,
 * ensuring consistency: if React↔Vue are "similar" for scoring, they're
 * also "similar" for diversity (meaning two React/Vue engineers are less diverse).
 */

import type { SimilarityResult, SkillGraph, DomainGraph } from './types.js';
import { similarityParams } from '../../config/knowledge-base/similarity.config.js';
import { calculateSkillSimilarity } from './scoring/skill-similarity.js';
import { calculateDomainSimilarity } from './scoring/domain-similarity.js';

/**
 * Selects diverse results from a pool of scored candidates.
 *
 * Algorithm:
 * 1. Take top (diversityMultiplier × targetCount) candidates as the pool
 * 2. Greedily select candidates one at a time
 * 3. Each selection maximizes Quality = similarity × avgDiversity
 * 4. avgDiversity = average of (1 - similarity to each already-selected)
 */
export function selectDiverseResults(
  skillGraph: SkillGraph,
  domainGraph: DomainGraph,
  candidates: SimilarityResult[],
  targetCount: number
): SimilarityResult[] {
  const { diversityMultiplier } = similarityParams;
  const poolSize = targetCount * diversityMultiplier;

  // Take top poolSize candidates (already sorted by similarity)
  const pool = candidates.slice(0, poolSize);
  const selected: SimilarityResult[] = [];

  while (selected.length < targetCount && pool.length > 0) {
    let bestIdx = 0;
    let bestQuality = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const avgDiversity = selected.length === 0
        ? 1.0
        : calculateAverageDiversity(skillGraph, domainGraph, candidate, selected);
      const quality = candidate.similarityScore * avgDiversity;

      if (quality > bestQuality) {
        bestQuality = quality;
        bestIdx = i;
      }
    }

    selected.push(pool[bestIdx]);
    pool.splice(bestIdx, 1);
  }

  return selected;
}

/**
 * Calculates average diversity of a candidate relative to already-selected results.
 *
 * Diversity(A, B) = 1 - Similarity(A, B)
 * D_avg = average of Diversity(candidate, each selected)
 *
 * Uses graph-aware skill and domain similarity to ensure consistency with
 * the main similarity scorer. Skills are weighted more heavily (0.7) since
 * they're the primary capability differentiator.
 */
/*
 * Why 0.7/0.3 skill/domain weighting for diversity?
 *
 * This roughly matches the main similarity weights ratio:
 *   - Main weights: skills=0.45, domain=0.22 → ratio ≈ 2:1
 *   - Diversity: skills=0.7, domain=0.3 → ratio ≈ 2:1
 *
 * This ensures that if React↔Vue are "similar" for the main scoring,
 * they're also "similar" for diversity purposes, meaning two React/Vue
 * engineers are less diverse than a React + Python pairing.
 *
 * We exclude experience and timezone from diversity because:
 *   - Experience: seniority diversity is less useful (you usually want
 *     engineers at a similar level, not a mix of junior and staff)
 *   - Timezone: geographic diversity has marginal value for most use cases
 */
function calculateAverageDiversity(
  skillGraph: SkillGraph,
  domainGraph: DomainGraph,
  candidate: SimilarityResult,
  selected: SimilarityResult[]
): number {
  if (selected.length === 0) return 1.0;

  let totalDiversity = 0;

  for (const sel of selected) {
    // Use graph-aware skill similarity
    const skillResult = calculateSkillSimilarity(
      skillGraph,
      candidate.engineer.skills,
      sel.engineer.skills
    );

    // Use graph-aware domain similarity
    const domainResult = calculateDomainSimilarity(
      domainGraph,
      candidate.engineer.businessDomains,
      candidate.engineer.technicalDomains,
      sel.engineer.businessDomains,
      sel.engineer.technicalDomains
    );

    // Combined similarity (skills weighted more as primary differentiator)
    const combinedSimilarity = skillResult.score * 0.7 + domainResult.score * 0.3;
    const diversity = 1 - combinedSimilarity;
    totalDiversity += diversity;
  }

  return totalDiversity / selected.length;
}
