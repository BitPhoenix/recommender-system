/**
 * Utility Calculator Service
 * Implements Section 5.2.3 - Ranking the Matched Items
 *
 * Formula: U(V) = Σ w_j * f_j(v_j)
 * Where:
 *   w_j = weight of attribute j
 *   f_j(v_j) = utility function applied to attribute value
 */

import type { CoreScores, RawCoreScores, PreferenceMatches, StartTimeline } from '../../types/search.types.js';
import { knowledgeBaseConfig } from '../../config/knowledge-base/index.js';
import type {
  EngineerData,
  UtilityContext,
  ScoredEngineer,
  UtilityCalculationResult,
} from './types.js';

// Import scoring functions
import {
  calculateConfidenceUtility,
  calculateExperienceUtility,
} from './scoring/core-scoring.js';
import {
  calculateRequiredSkillsProficiencyMatch,
  calculatePreferredSkillsMatch,
  calculateTeamFocusMatch,
  calculateRelatedSkillsMatch,
} from './scoring/skill-scoring.js';
import {
  calculatePreferredBusinessDomainMatch,
  calculatePreferredTechnicalDomainMatch,
} from './scoring/domain-scoring.js';
import {
  calculateStartTimelineMatch,
  calculatePreferredTimezoneMatch,
  calculatePreferredSeniorityMatch,
  calculateBudgetMatch,
} from './scoring/logistics-scoring.js';

const config = knowledgeBaseConfig;

function calculateWeighted(raw: number, weight: number): number {
  return Math.round(raw * weight * 1000) / 1000;
}

/**
 * Calculates utility score with full breakdown for transparency.
 */
export function calculateUtilityWithBreakdown(
  engineer: EngineerData,
  context: UtilityContext
): UtilityCalculationResult {
  const weights = config.utilityWeights;
  const params = config.utilityParams;

  // Score how well engineer proficiency matches preferred levels for required skills
  const skillMatchResult = calculateRequiredSkillsProficiencyMatch(
    engineer.matchedSkills,
    context.requiredSkillIds,
    context.skillIdToPreferredProficiency
  );
  const skillMatchRaw = skillMatchResult.score;

  const confidenceRaw = calculateConfidenceUtility(
    engineer.avgConfidence,
    params.confidenceMin,
    params.confidenceMax
  );

  const experienceRaw = calculateExperienceUtility(
    engineer.yearsExperience,
    params.yearsExperienceMax
  );

  const preferredSkillsResult = calculatePreferredSkillsMatch(
    engineer.matchedSkills,
    context.preferredSkillIds,
    params.preferredSkillsMatchMax
  );

  const teamFocusResult = calculateTeamFocusMatch(
    engineer.matchedSkills,
    context.alignedSkillIds,
    params.teamFocusMatchMax
  );

  const relatedSkillsResult = calculateRelatedSkillsMatch(
    engineer.unmatchedRelatedSkills,
    params.relatedSkillsMatchMax
  );

  const preferredBusinessDomainResult = calculatePreferredBusinessDomainMatch(
    engineer.matchedBusinessDomains,
    context.preferredBusinessDomains,
    params.preferredBusinessDomainMatchMax
  );

  const preferredTechnicalDomainResult = calculatePreferredTechnicalDomainMatch(
    engineer.matchedTechnicalDomains,
    context.preferredTechnicalDomains,
    params.preferredTechnicalDomainMatchMax
  );

  // Calculate preference matches
  const startTimelineResult = calculateStartTimelineMatch(
    engineer.startTimeline as StartTimeline,
    context.preferredMaxStartTime,
    context.requiredMaxStartTime,
    params.startTimelineMatchMax
  );

  const preferredTimezoneResult = calculatePreferredTimezoneMatch(
    engineer.timezone,
    context.preferredTimezone,
    params.preferredTimezoneMatchMax
  );

  const preferredSeniorityResult = calculatePreferredSeniorityMatch(
    engineer.yearsExperience,
    context.preferredSeniorityLevel,
    params.preferredSeniorityMatchMax
  );

  const budgetResult = calculateBudgetMatch(
    engineer.salary,
    context.maxBudget,
    context.stretchBudget,
    params.budgetMatchMax
  );

  // Calculate core weighted scores
  const coreScores: CoreScores = {
    skillMatch: calculateWeighted(skillMatchRaw, weights.skillMatch),
    confidence: calculateWeighted(confidenceRaw, weights.confidenceScore),
    experience: calculateWeighted(experienceRaw, weights.yearsExperience),
  };

  // Calculate match weighted scores
  const matchScores = {
    preferredSkillsMatch: calculateWeighted(preferredSkillsResult.raw, weights.preferredSkillsMatch),
    teamFocusMatch: calculateWeighted(teamFocusResult.raw, weights.teamFocusMatch),
    relatedSkillsMatch: calculateWeighted(relatedSkillsResult.raw, weights.relatedSkillsMatch),
    preferredBusinessDomainMatch: calculateWeighted(preferredBusinessDomainResult.raw, weights.preferredBusinessDomainMatch),
    preferredTechnicalDomainMatch: calculateWeighted(preferredTechnicalDomainResult.raw, weights.preferredTechnicalDomainMatch),
    startTimelineMatch: calculateWeighted(startTimelineResult.raw, weights.startTimelineMatch),
    preferredTimezoneMatch: calculateWeighted(preferredTimezoneResult.raw, weights.preferredTimezoneMatch),
    preferredSeniorityMatch: calculateWeighted(preferredSeniorityResult.raw, weights.preferredSeniorityMatch),
    budgetMatch: calculateWeighted(budgetResult.raw, weights.budgetMatch),
  };

  // Sum all weighted scores
  const total = Object.values(coreScores).reduce((sum, score) => sum + score, 0)
    + Object.values(matchScores).reduce((sum, score) => sum + score, 0);

  // Filter core scores - only include non-zero values
  const scores: Partial<CoreScores> = {};
  for (const [key, value] of Object.entries(coreScores)) {
    if (value > 0) {
      scores[key as keyof CoreScores] = value;
    }
  }

  // Build raw scores (0-1 normalized) for explanation generation
  // Only include non-zero values to match scores filtering
  const rawScores: Partial<RawCoreScores> = {};
  if (skillMatchRaw > 0) rawScores.skillMatch = skillMatchRaw;
  if (confidenceRaw > 0) rawScores.confidence = confidenceRaw;
  if (experienceRaw > 0) rawScores.experience = experienceRaw;

  // Build preference matches - only include non-zero matches with their data
  const preferenceMatches: PreferenceMatches = {};

  if (matchScores.preferredSkillsMatch > 0) {
    preferenceMatches.preferredSkillsMatch = {
      score: matchScores.preferredSkillsMatch,
      matchedSkills: preferredSkillsResult.matchedSkillNames,
    };
  }
  if (matchScores.teamFocusMatch > 0) {
    preferenceMatches.teamFocusMatch = {
      score: matchScores.teamFocusMatch,
      matchedSkills: teamFocusResult.matchedSkillNames,
    };
  }
  if (matchScores.relatedSkillsMatch > 0) {
    preferenceMatches.relatedSkillsMatch = {
      score: matchScores.relatedSkillsMatch,
      count: relatedSkillsResult.count,
    };
  }
  if (matchScores.preferredBusinessDomainMatch > 0) {
    preferenceMatches.preferredBusinessDomainMatch = {
      score: matchScores.preferredBusinessDomainMatch,
      matchedDomains: preferredBusinessDomainResult.matchedDomainNames,
    };
  }
  if (matchScores.preferredTechnicalDomainMatch > 0) {
    preferenceMatches.preferredTechnicalDomainMatch = {
      score: matchScores.preferredTechnicalDomainMatch,
      matchedDomains: preferredTechnicalDomainResult.matchedDomainNames,
    };
  }
  if (matchScores.startTimelineMatch > 0) {
    preferenceMatches.startTimelineMatch = {
      score: matchScores.startTimelineMatch,
      matchedStartTimeline: startTimelineResult.matchedStartTimeline!,
      withinPreferred: startTimelineResult.withinPreferred,
    };
  }
  if (matchScores.preferredTimezoneMatch > 0) {
    preferenceMatches.preferredTimezoneMatch = {
      score: matchScores.preferredTimezoneMatch,
      matchedTimezone: preferredTimezoneResult.matchedTimezone!,
      rank: preferredTimezoneResult.rank,
    };
  }
  if (matchScores.preferredSeniorityMatch > 0) {
    preferenceMatches.preferredSeniorityMatch = {
      score: matchScores.preferredSeniorityMatch,
    };
  }
  // Only include budgetMatch if in stretch zone (partial score)
  // Engineers within budget get full score but we don't need to show that
  if (matchScores.budgetMatch > 0 && budgetResult.inStretchZone) {
    preferenceMatches.budgetMatch = {
      score: matchScores.budgetMatch,
      inStretchZone: budgetResult.inStretchZone,
    };
  }

  const utilityScore = Math.round(total * 100) / 100;

  return {
    utilityScore,
    scoreBreakdown: {
      scores,
      rawScores: Object.keys(rawScores).length > 0 ? rawScores : undefined,
      preferenceMatches,
      total: utilityScore,
    },
  };
}

/**
 * Calculates utility score for a single engineer.
 * Delegates to calculateUtilityWithBreakdown and extracts the score.
 */
export function calculateUtilityScore(
  engineer: EngineerData,
  context: UtilityContext
): number {
  return calculateUtilityWithBreakdown(engineer, context).utilityScore;
}

/**
 * Scores and sorts a list of engineers by utility score.
 */
export function scoreAndSortEngineers(
  engineers: EngineerData[],
  context: UtilityContext
): ScoredEngineer[] {
  return engineers
    .map((engineer) => {
      const { utilityScore, scoreBreakdown } = calculateUtilityWithBreakdown(
        engineer,
        context
      );
      return {
        ...engineer,
        utilityScore,
        scoreBreakdown,
      };
    })
    .sort((a, b) => b.utilityScore - a.utilityScore);
}
