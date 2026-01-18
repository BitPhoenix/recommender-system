/**
 * Skill Similarity Scoring
 *
 * Uses symmetric best-match approach with graph relationships.
 *
 * Priority order (first match wins):
 *   1. Exact match → 1.0
 *   2. CORRELATES_WITH → use edge strength (e.g., 0.95)
 *   3. Same SkillCategory → 0.5
 *   4. Share CHILD_OF parent → 0.3
 *   5. No relationship → 0.0
 *
 * Returns symmetric average of both directions plus shared/correlated skill info.
 */

/*
 * Why graph-aware similarity instead of Jaccard?
 *
 * Pure Jaccard similarity treats all skills as equally different:
 *   - React vs Vue = React vs PostgreSQL (both count as "no overlap")
 *
 * Example comparison:
 *   Target: {React, Node.js, TypeScript, PostgreSQL}
 *   Candidate: {Vue, Python, Django, PostgreSQL}
 *
 *   Jaccard: intersection={PostgreSQL} / union=7 → 0.14
 *   Graph-aware: React→Vue(0.5), Node.js→Python(0.5), TypeScript→Vue(0.5), PostgreSQL→PostgreSQL(1.0)
 *               → average = 0.625
 *
 * The graph recognizes these engineers have similar *capabilities* even though
 * they use different specific technologies.
 *
 * Why symmetric (averaging both directions)?
 * This is analogous to F1 score averaging precision and recall:
 *   - Target→Candidate: "How well are target's skills covered?"
 *   - Candidate→Target: "How well are candidate's skills covered?"
 * A specialist and generalist would have very different scores depending on
 * which direction you measure. Symmetric average gives the balanced answer
 * to "how similar are these engineers?"
 */

import type {
  EngineerSkill,
  SkillGraph,
  SkillSimilarityResult,
  CorrelatedSkillPair,
} from '../types.js';
import { similarityParams } from '../../../config/knowledge-base/similarity.config.js';

export function calculateSkillSimilarity(
  skillGraph: SkillGraph,
  targetSkills: EngineerSkill[],
  candidateSkills: EngineerSkill[]
): SkillSimilarityResult {
  if (targetSkills.length === 0 && candidateSkills.length === 0) {
    return { score: 1.0, sharedSkillIds: [], correlatedPairs: [] };
  }

  if (targetSkills.length === 0 || candidateSkills.length === 0) {
    return { score: 0.0, sharedSkillIds: [], correlatedPairs: [] };
  }

  // Symmetric: average both directions
  const targetToCandidateAvg = computeBestMatchAverage(
    skillGraph, targetSkills, candidateSkills
  );
  const candidateToTargetAvg = computeBestMatchAverage(
    skillGraph, candidateSkills, targetSkills
  );
  const symmetricScore = (targetToCandidateAvg + candidateToTargetAvg) / 2;

  // Collect exact matches
  const targetIds = new Set(targetSkills.map(s => s.skillId));
  const candidateIds = new Set(candidateSkills.map(s => s.skillId));
  const sharedSkillIds = [...targetIds].filter(id => candidateIds.has(id));

  // Collect correlated (non-exact) skill pairs for transparency
  const correlatedPairs = findCorrelatedSkillPairs(
    skillGraph, targetSkills, candidateSkills
  );

  return {
    score: symmetricScore,
    sharedSkillIds,
    correlatedPairs,
  };
}

function computeBestMatchAverage(
  skillGraph: SkillGraph,
  sourceSkills: EngineerSkill[],
  targetSkills: EngineerSkill[]
): number {
  if (sourceSkills.length === 0) return 0;

  let totalBestMatch = 0;

  for (const source of sourceSkills) {
    let bestMatch = 0;
    for (const target of targetSkills) {
      const sim = computeSkillToSkillSimilarity(
        skillGraph, source.skillId, target.skillId
      );
      bestMatch = Math.max(bestMatch, sim);
    }
    totalBestMatch += bestMatch;
  }

  return totalBestMatch / sourceSkills.length;
}

function computeSkillToSkillSimilarity(
  skillGraph: SkillGraph,
  skillA: string,
  skillB: string
): number {
  // Same skill = perfect match
  if (skillA === skillB) return 1.0;

  const nodeA = skillGraph.nodes.get(skillA);
  const nodeB = skillGraph.nodes.get(skillB);

  if (!nodeA || !nodeB) return 0.0;

  // Check CORRELATES_WITH relationship (use actual strength from graph)
  const { minCorrelationStrength } = similarityParams;
  const correlation = nodeA.correlations.find(
    c => c.toSkillId === skillB && c.strength >= minCorrelationStrength
  );
  if (correlation) return correlation.strength;

  // Check if same SkillCategory (both BELONGS_TO same category)
  if (nodeA.categoryId && nodeB.categoryId && nodeA.categoryId === nodeB.categoryId) {
    return 0.5;
  }

  // Check if share parent via CHILD_OF
  if (nodeA.parentId && nodeB.parentId && nodeA.parentId === nodeB.parentId) {
    return 0.3;
  }

  // No relationship found
  return 0.0;
}

function findCorrelatedSkillPairs(
  skillGraph: SkillGraph,
  targetSkills: EngineerSkill[],
  candidateSkills: EngineerSkill[]
): CorrelatedSkillPair[] {
  const { minCorrelationStrength } = similarityParams;
  const pairs: CorrelatedSkillPair[] = [];
  const seenPairs = new Set<string>();

  // Find skills that are correlated (but not exact matches)
  const targetIds = new Set(targetSkills.map(s => s.skillId));
  const candidateIds = new Set(candidateSkills.map(s => s.skillId));

  for (const target of targetSkills) {
    const node = skillGraph.nodes.get(target.skillId);
    if (!node) continue;

    for (const corr of node.correlations) {
      if (corr.strength < minCorrelationStrength) continue;
      if (targetIds.has(corr.toSkillId)) continue; // Skip if target already has this skill
      if (!candidateIds.has(corr.toSkillId)) continue; // Only include if candidate has it

      const pairKey = [target.skillId, corr.toSkillId].sort().join(':');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      pairs.push({
        targetSkill: target.skillName,
        candidateSkill: getCandidateSkillName(candidateSkills, corr.toSkillId),
        strength: corr.strength,
      });
    }
  }

  return pairs.sort((a, b) => b.strength - a.strength);
}

function getCandidateSkillName(candidateSkills: EngineerSkill[], skillId: string): string {
  const skill = candidateSkills.find(s => s.skillId === skillId);
  return skill?.skillName ?? skillId;
}
