/**
 * Similarity Calculator
 *
 * Main orchestration for engineer-to-engineer similarity scoring.
 * Implements Equation 5.2: Similarity(T, X) = Σ w_i · Sim(t_i, x_i) / Σ w_i
 *
 * Since weights sum to 1.0, the denominator is 1 and the formula simplifies
 * to: Similarity(T, X) = Σ w_i · Sim(t_i, x_i)
 */

import type {
  EngineerForSimilarity,
  SimilarityResult,
  SimilarityBreakdown,
  SkillGraph,
  DomainGraph,
} from './types.js';
import { similarityWeights } from '../../config/knowledge-base/similarity.config.js';
import { calculateSkillSimilarity } from './scoring/skill-similarity.js';
import { calculateExperienceSimilarity } from './scoring/experience-similarity.js';
import { calculateDomainSimilarity } from './scoring/domain-similarity.js';
import { calculateTimezoneSimilarity } from './scoring/timezone-similarity.js';

/**
 * Scores all candidates against the target and sorts by similarity descending.
 */
export function scoreAndSortCandidates(
  skillGraph: SkillGraph,
  domainGraph: DomainGraph,
  target: EngineerForSimilarity,
  candidates: EngineerForSimilarity[]
): SimilarityResult[] {
  return candidates
    .map(candidate => calculateSimilarityWithBreakdown(skillGraph, domainGraph, target, candidate))
    .sort((a, b) => b.similarityScore - a.similarityScore);
}

/**
 * Calculates similarity between target and candidate engineers.
 * Returns the scored result with full breakdown.
 */
export function calculateSimilarityWithBreakdown(
  skillGraph: SkillGraph,
  domainGraph: DomainGraph,
  target: EngineerForSimilarity,
  candidate: EngineerForSimilarity
): SimilarityResult {
  const weights = similarityWeights;

  // Calculate individual similarities
  const skillResult = calculateSkillSimilarity(
    skillGraph,
    target.skills,
    candidate.skills
  );

  const experienceResult = calculateExperienceSimilarity(
    target.yearsExperience,
    candidate.yearsExperience
  );

  const domainResult = calculateDomainSimilarity(
    domainGraph,
    target.businessDomains,
    target.technicalDomains,
    candidate.businessDomains,
    candidate.technicalDomains
  );

  const timezoneResult = calculateTimezoneSimilarity(
    target.timezone,
    candidate.timezone
  );

  // Apply weights
  const weightedSkills = calculateWeighted(skillResult.score, weights.skills);
  const weightedExperience = calculateWeighted(experienceResult.score, weights.yearsExperience);
  const weightedDomain = calculateWeighted(domainResult.score, weights.domain);
  const weightedTimezone = calculateWeighted(timezoneResult.score, weights.timezone);

  // Sum weighted scores and round to 2 decimals
  const totalScore = Math.round(
    (weightedSkills + weightedExperience + weightedDomain + weightedTimezone) * 100
  ) / 100;

  // Build breakdown with raw (unweighted) scores
  const breakdown: SimilarityBreakdown = {
    skills: Math.round(skillResult.score * 100) / 100,
    yearsExperience: Math.round(experienceResult.score * 100) / 100,
    domain: Math.round(domainResult.score * 100) / 100,
    timezone: Math.round(timezoneResult.score * 100) / 100,
  };

  // Map shared skill IDs to names for the response
  const sharedSkills = skillResult.sharedSkillIds.map(skillId => {
    const skill = candidate.skills.find(s => s.skillId === skillId);
    return skill?.skillName ?? skillId;
  });

  return {
    engineer: candidate,
    similarityScore: totalScore,
    breakdown,
    sharedSkills,
    correlatedSkills: skillResult.correlatedPairs,
  };
}

/**
 * Applies weight to a raw score with 3-decimal rounding.
 * Mirrors the pattern from utility-calculator.ts:44-46.
 */
function calculateWeighted(raw: number, weight: number): number {
  return Math.round(raw * weight * 1000) / 1000;
}
