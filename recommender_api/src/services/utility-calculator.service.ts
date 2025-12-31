/**
 * Utility Calculator Service
 * Implements Section 5.2.3 - Ranking the Matched Items
 *
 * Formula: U(V) = Σ w_j * f_j(v_j)
 * Where:
 *   w_j = weight of attribute j
 *   f_j(v_j) = utility function applied to attribute value
 */

import type {
  MatchedSkill,
  UnmatchedRelatedSkill,
  MatchStrength,
  AvailabilityOption,
  ScoreBreakdown,
  CoreScores,
  PreferenceMatches,
  SeniorityLevel,
  ProficiencyLevel,
} from '../types/search.types.js';
import { knowledgeBaseConfig } from '../config/knowledge-base.config.js';

export interface EngineerData {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  availability: string;
  timezone: string;
  matchedSkills: MatchedSkill[];
  unmatchedRelatedSkills: UnmatchedRelatedSkill[];
  avgConfidence: number;
  matchedDomainNames: string[];
}

export interface UtilityContext {
  requestedSkillIds: string[];
  preferredSkillIds: string[];
  preferredDomainIds: string[];
  alignedSkillIds: string[];
  maxSalaryBudget: number | null;
  // Preferred values for match calculation
  preferredSeniorityLevel: SeniorityLevel | null;
  preferredAvailability: AvailabilityOption[];
  preferredTimezone: string[];
  preferredSalaryRange: { min: number; max: number } | null;
  preferredConfidenceScore: number | null;
  preferredProficiency: ProficiencyLevel | null;
}

export interface ScoredEngineer extends EngineerData {
  utilityScore: number;
  matchStrength: MatchStrength;
  scoreBreakdown: ScoreBreakdown;
}

const config = knowledgeBaseConfig;

export interface UtilityCalculationResult {
  utilityScore: number;
  scoreBreakdown: ScoreBreakdown;
}

interface TeamFocusMatchResult {
  raw: number;
  matchedSkillNames: string[];
}

interface PreferredSkillsMatchResult {
  raw: number;
  matchedSkillNames: string[];
}

interface RelatedSkillsMatchResult {
  raw: number;
  count: number;
}

interface PreferredDomainMatchResult {
  raw: number;
  matchedDomainNames: string[];
}

/**
 * Calculates preferred skills match utility with matched skill details.
 * Engineers with preferred skills get a ranking boost.
 */
function calculatePreferredSkillsMatchWithDetails(
  matchedSkills: MatchedSkill[],
  preferredSkillIds: string[],
  maxMatch: number
): PreferredSkillsMatchResult {
  if (preferredSkillIds.length === 0) {
    return { raw: 0, matchedSkillNames: [] };
  }

  // Find which preferred skills the engineer has
  const matchingPreferredSkills = matchedSkills.filter((skill) =>
    preferredSkillIds.includes(skill.skillId)
  );

  // Normalize by the number of preferred skills, capped at maxMatch
  const matchRatio = matchingPreferredSkills.length / preferredSkillIds.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedSkillNames: matchingPreferredSkills.map((s) => s.skillName),
  };
}

/**
 * Calculates team focus match utility with matched skill details.
 */
function calculateTeamFocusMatchWithDetails(
  matchedSkills: MatchedSkill[],
  alignedSkillIds: string[],
  maxMatch: number
): TeamFocusMatchResult {
  if (alignedSkillIds.length === 0) {
    return { raw: 0, matchedSkillNames: [] };
  }

  // Find which aligned skills the engineer has
  const matchingAlignedSkills = matchedSkills.filter((skill) =>
    alignedSkillIds.includes(skill.skillId)
  );

  // Normalize by the number of aligned skills, capped at maxMatch
  const matchRatio = matchingAlignedSkills.length / alignedSkillIds.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedSkillNames: matchingAlignedSkills.map((s) => s.skillName),
  };
}

/**
 * Calculates related skills match utility.
 * Engineers with more unmatched related skills (below threshold) get a small match score
 * to reward breadth of experience in the skill hierarchy.
 */
function calculateRelatedSkillsMatchWithDetails(
  unmatchedRelatedSkills: UnmatchedRelatedSkill[],
  maxMatch: number
): RelatedSkillsMatchResult {
  const count = unmatchedRelatedSkills.length;

  if (count === 0) {
    return { raw: 0, count: 0 };
  }

  // Normalize: more unmatched skills = higher match score, capped at maxMatch
  // Use a diminishing returns curve: score increases quickly at first, then plateaus
  // Formula: 1 - e^(-count/maxMatch) gives nice curve from 0 to ~1
  const raw = Math.min((1 - Math.exp(-count / maxMatch)) * maxMatch, maxMatch);

  return { raw, count };
}

/**
 * Calculates preferred domain match utility with matched domain details.
 * Engineers with preferred domain experience get a ranking boost.
 */
function calculatePreferredDomainMatchWithDetails(
  matchedDomainNames: string[],
  preferredDomainIds: string[],
  maxMatch: number
): PreferredDomainMatchResult {
  if (preferredDomainIds.length === 0) {
    return { raw: 0, matchedDomainNames: [] };
  }

  // matchedDomainNames already contains the names of matched preferred domains from the query
  // Normalize by the number of preferred domains, capped at maxMatch
  const matchRatio = matchedDomainNames.length / preferredDomainIds.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedDomainNames,
  };
}

// ============================================
// PREFERENCE MATCH CALCULATION FUNCTIONS
// ============================================

interface PreferredAvailabilityMatchResult {
  raw: number;
  matchedAvailability: string | null;
  rank: number;
}

interface PreferredTimezoneMatchResult {
  raw: number;
  matchedTimezone: string | null;
  rank: number;
}

interface PreferredSeniorityMatchResult {
  raw: number;
  matchedLevel: boolean;
}

interface PreferredSalaryRangeMatchResult {
  raw: number;
  inPreferredRange: boolean;
}

interface PreferredConfidenceMatchResult {
  raw: number;
  meetsPreferred: boolean;
}

interface PreferredProficiencyMatchResult {
  raw: number;
  matchedLevel: boolean;
}

/**
 * Calculates preferred availability match.
 * Higher score for earlier positions in preference list.
 */
function calculatePreferredAvailabilityMatch(
  engineerAvailability: AvailabilityOption,
  preferredAvailability: AvailabilityOption[],
  maxMatch: number
): PreferredAvailabilityMatchResult {
  if (preferredAvailability.length === 0) {
    return { raw: 0, matchedAvailability: null, rank: -1 };
  }

  const index = preferredAvailability.indexOf(engineerAvailability);
  if (index === -1) {
    return { raw: 0, matchedAvailability: null, rank: -1 };
  }

  // Higher score for earlier positions: 1st = full, 2nd = 75%, 3rd = 50%, 4th = 25%
  const positionMultiplier = 1 - (index / preferredAvailability.length);
  const raw = positionMultiplier * maxMatch;

  return { raw, matchedAvailability: engineerAvailability, rank: index };
}

/**
 * Calculates preferred timezone match.
 * Matches against prefix patterns in preference order.
 */
function calculatePreferredTimezoneMatch(
  engineerTimezone: string,
  preferredTimezone: string[],
  maxMatch: number
): PreferredTimezoneMatchResult {
  if (preferredTimezone.length === 0) {
    return { raw: 0, matchedTimezone: null, rank: -1 };
  }

  for (let i = 0; i < preferredTimezone.length; i++) {
    const pattern = preferredTimezone[i].replace(/\*$/, '');
    if (engineerTimezone.startsWith(pattern) || engineerTimezone === preferredTimezone[i]) {
      const positionMultiplier = 1 - (i / preferredTimezone.length);
      const raw = positionMultiplier * maxMatch;
      return { raw, matchedTimezone: preferredTimezone[i], rank: i };
    }
  }

  return { raw: 0, matchedTimezone: null, rank: -1 };
}

/**
 * Calculates preferred seniority match.
 * Full score if engineer meets or exceeds preferred level.
 */
function calculatePreferredSeniorityMatch(
  engineerYearsExperience: number,
  preferredSeniorityLevel: SeniorityLevel | null,
  maxMatch: number
): PreferredSeniorityMatchResult {
  if (!preferredSeniorityLevel) {
    return { raw: 0, matchedLevel: false };
  }

  const seniorityMinYears: Record<SeniorityLevel, number> = {
    junior: 0,
    mid: 3,
    senior: 6,
    staff: 10,
    principal: 15,
  };

  const requiredYears = seniorityMinYears[preferredSeniorityLevel];
  const matchedLevel = engineerYearsExperience >= requiredYears;

  return { raw: matchedLevel ? maxMatch : 0, matchedLevel };
}

/**
 * Calculates preferred salary range match.
 * Full score if salary is within preferred range.
 */
function calculatePreferredSalaryRangeMatch(
  engineerSalary: number,
  preferredSalaryRange: { min: number; max: number } | null,
  maxMatch: number
): PreferredSalaryRangeMatchResult {
  if (!preferredSalaryRange) {
    return { raw: 0, inPreferredRange: false };
  }

  const inPreferredRange = engineerSalary >= preferredSalaryRange.min &&
                           engineerSalary <= preferredSalaryRange.max;

  return { raw: inPreferredRange ? maxMatch : 0, inPreferredRange };
}

/**
 * Calculates preferred confidence score match.
 * Full score if engineer's average confidence meets threshold.
 */
function calculatePreferredConfidenceMatch(
  avgConfidence: number,
  preferredConfidenceScore: number | null,
  maxMatch: number
): PreferredConfidenceMatchResult {
  if (preferredConfidenceScore === null || avgConfidence <= 0) {
    return { raw: 0, meetsPreferred: false };
  }

  const meetsPreferred = avgConfidence >= preferredConfidenceScore;

  return { raw: meetsPreferred ? maxMatch : 0, meetsPreferred };
}

/**
 * Calculates preferred proficiency match.
 * Full score if engineer has skills at or above preferred level.
 */
function calculatePreferredProficiencyMatch(
  matchedSkills: MatchedSkill[],
  preferredProficiency: ProficiencyLevel | null,
  maxMatch: number
): PreferredProficiencyMatchResult {
  if (!preferredProficiency || matchedSkills.length === 0) {
    return { raw: 0, matchedLevel: false };
  }

  const proficiencyOrder: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];
  const preferredIndex = proficiencyOrder.indexOf(preferredProficiency);

  // Check if any matched skill meets or exceeds preferred proficiency
  const matchedLevel = matchedSkills.some((skill) => {
    const skillIndex = proficiencyOrder.indexOf(skill.proficiencyLevel as ProficiencyLevel);
    return skillIndex >= preferredIndex;
  });

  return { raw: matchedLevel ? maxMatch : 0, matchedLevel };
}

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

  // Calculate individual utility components
  const skillMatchRaw = calculateSkillMatchUtility(
    engineer.matchedSkills,
    context.requestedSkillIds
  );

  const confidenceRaw = calculateConfidenceUtility(
    engineer.avgConfidence,
    params.confidenceMin,
    params.confidenceMax
  );

  const experienceRaw = calculateExperienceUtility(
    engineer.yearsExperience,
    params.yearsExperienceMax
  );

  const availabilityRaw = calculateAvailabilityUtility(
    engineer.availability as AvailabilityOption
  );

  const salaryRaw = calculateSalaryUtility(
    engineer.salary,
    context.maxSalaryBudget,
    params.salaryMin,
    params.salaryMax
  );

  const preferredSkillsResult = calculatePreferredSkillsMatchWithDetails(
    engineer.matchedSkills,
    context.preferredSkillIds,
    params.preferredSkillsMatchMax
  );

  const teamFocusResult = calculateTeamFocusMatchWithDetails(
    engineer.matchedSkills,
    context.alignedSkillIds,
    params.teamFocusMatchMax
  );

  const relatedSkillsResult = calculateRelatedSkillsMatchWithDetails(
    engineer.unmatchedRelatedSkills,
    params.relatedSkillsMatchMax
  );

  const preferredDomainResult = calculatePreferredDomainMatchWithDetails(
    engineer.matchedDomainNames,
    context.preferredDomainIds,
    params.preferredDomainMatchMax
  );

  // Calculate preference matches
  const preferredAvailabilityResult = calculatePreferredAvailabilityMatch(
    engineer.availability as AvailabilityOption,
    context.preferredAvailability,
    params.preferredAvailabilityMatchMax
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

  const preferredSalaryRangeResult = calculatePreferredSalaryRangeMatch(
    engineer.salary,
    context.preferredSalaryRange,
    params.preferredSalaryRangeMatchMax
  );

  const preferredConfidenceResult = calculatePreferredConfidenceMatch(
    engineer.avgConfidence,
    context.preferredConfidenceScore,
    params.preferredConfidenceMatchMax
  );

  const preferredProficiencyResult = calculatePreferredProficiencyMatch(
    engineer.matchedSkills,
    context.preferredProficiency,
    params.preferredProficiencyMatchMax
  );

  // Calculate core weighted scores
  const coreScores: CoreScores = {
    skillMatch: calculateWeighted(skillMatchRaw, weights.skillMatch),
    confidence: calculateWeighted(confidenceRaw, weights.confidenceScore),
    experience: calculateWeighted(experienceRaw, weights.yearsExperience),
    availability: calculateWeighted(availabilityRaw, weights.availability),
    salary: calculateWeighted(salaryRaw, weights.salary),
  };

  // Calculate match weighted scores
  const matchScores = {
    preferredSkillsMatch: calculateWeighted(preferredSkillsResult.raw, weights.preferredSkillsMatch),
    teamFocusMatch: calculateWeighted(teamFocusResult.raw, weights.teamFocusMatch),
    relatedSkillsMatch: calculateWeighted(relatedSkillsResult.raw, weights.relatedSkillsMatch),
    preferredDomainMatch: calculateWeighted(preferredDomainResult.raw, weights.preferredDomainMatch),
    preferredAvailabilityMatch: calculateWeighted(preferredAvailabilityResult.raw, weights.preferredAvailabilityMatch),
    preferredTimezoneMatch: calculateWeighted(preferredTimezoneResult.raw, weights.preferredTimezoneMatch),
    preferredSeniorityMatch: calculateWeighted(preferredSeniorityResult.raw, weights.preferredSeniorityMatch),
    preferredSalaryRangeMatch: calculateWeighted(preferredSalaryRangeResult.raw, weights.preferredSalaryRangeMatch),
    preferredConfidenceMatch: calculateWeighted(preferredConfidenceResult.raw, weights.preferredConfidenceMatch),
    preferredProficiencyMatch: calculateWeighted(preferredProficiencyResult.raw, weights.preferredProficiencyMatch),
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
  if (matchScores.preferredDomainMatch > 0) {
    preferenceMatches.preferredDomainMatch = {
      score: matchScores.preferredDomainMatch,
      matchedDomains: preferredDomainResult.matchedDomainNames,
    };
  }
  if (matchScores.preferredAvailabilityMatch > 0) {
    preferenceMatches.preferredAvailabilityMatch = {
      score: matchScores.preferredAvailabilityMatch,
      matchedAvailability: preferredAvailabilityResult.matchedAvailability!,
      rank: preferredAvailabilityResult.rank,
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
  if (matchScores.preferredSalaryRangeMatch > 0) {
    preferenceMatches.preferredSalaryRangeMatch = {
      score: matchScores.preferredSalaryRangeMatch,
    };
  }
  if (matchScores.preferredConfidenceMatch > 0) {
    preferenceMatches.preferredConfidenceMatch = {
      score: matchScores.preferredConfidenceMatch,
    };
  }
  if (matchScores.preferredProficiencyMatch > 0) {
    preferenceMatches.preferredProficiencyMatch = {
      score: matchScores.preferredProficiencyMatch,
    };
  }

  const utilityScore = Math.round(total * 100) / 100;

  return {
    utilityScore,
    scoreBreakdown: {
      scores,
      preferenceMatches,
      total: utilityScore,
    },
  };
}

/**
 * Calculates utility score for a single engineer.
 */
export function calculateUtilityScore(
  engineer: EngineerData,
  context: UtilityContext
): number {
  const weights = config.utilityWeights;
  const params = config.utilityParams;

  // Calculate individual utility components
  const skillMatchUtility = calculateSkillMatchUtility(
    engineer.matchedSkills,
    context.requestedSkillIds
  );

  const confidenceUtility = calculateConfidenceUtility(
    engineer.avgConfidence,
    params.confidenceMin,
    params.confidenceMax
  );

  const experienceUtility = calculateExperienceUtility(
    engineer.yearsExperience,
    params.yearsExperienceMax
  );

  const availabilityUtility = calculateAvailabilityUtility(
    engineer.availability as AvailabilityOption
  );

  const salaryUtility = calculateSalaryUtility(
    engineer.salary,
    context.maxSalaryBudget,
    params.salaryMin,
    params.salaryMax
  );

  const preferredSkillsMatchUtility = calculatePreferredSkillsMatchUtility(
    engineer.matchedSkills,
    context.preferredSkillIds,
    params.preferredSkillsMatchMax
  );

  const teamFocusMatchUtility = calculateTeamFocusMatchUtility(
    engineer.matchedSkills,
    context.alignedSkillIds,
    params.teamFocusMatchMax
  );

  const relatedSkillsMatchUtility = calculateRelatedSkillsMatchUtility(
    engineer.unmatchedRelatedSkills,
    params.relatedSkillsMatchMax
  );

  const preferredDomainMatchUtility = calculatePreferredDomainMatchUtility(
    engineer.matchedDomainNames,
    context.preferredDomainIds,
    params.preferredDomainMatchMax
  );

  // Calculate preference match utilities
  const preferredAvailabilityUtility = calculatePreferredAvailabilityMatch(
    engineer.availability as AvailabilityOption,
    context.preferredAvailability,
    params.preferredAvailabilityMatchMax
  ).raw;

  const preferredTimezoneUtility = calculatePreferredTimezoneMatch(
    engineer.timezone,
    context.preferredTimezone,
    params.preferredTimezoneMatchMax
  ).raw;

  const preferredSeniorityUtility = calculatePreferredSeniorityMatch(
    engineer.yearsExperience,
    context.preferredSeniorityLevel,
    params.preferredSeniorityMatchMax
  ).raw;

  const preferredSalaryRangeUtility = calculatePreferredSalaryRangeMatch(
    engineer.salary,
    context.preferredSalaryRange,
    params.preferredSalaryRangeMatchMax
  ).raw;

  const preferredConfidenceUtility = calculatePreferredConfidenceMatch(
    engineer.avgConfidence,
    context.preferredConfidenceScore,
    params.preferredConfidenceMatchMax
  ).raw;

  const preferredProficiencyUtility = calculatePreferredProficiencyMatch(
    engineer.matchedSkills,
    context.preferredProficiency,
    params.preferredProficiencyMatchMax
  ).raw;

  // Weighted sum: U(V) = Σ w_j * f_j(v_j)
  const utilityScore =
    weights.skillMatch * skillMatchUtility +
    weights.confidenceScore * confidenceUtility +
    weights.yearsExperience * experienceUtility +
    weights.availability * availabilityUtility +
    weights.salary * salaryUtility +
    weights.preferredSkillsMatch * preferredSkillsMatchUtility +
    weights.teamFocusMatch * teamFocusMatchUtility +
    weights.relatedSkillsMatch * relatedSkillsMatchUtility +
    weights.preferredDomainMatch * preferredDomainMatchUtility +
    // Preference matches
    weights.preferredAvailabilityMatch * preferredAvailabilityUtility +
    weights.preferredTimezoneMatch * preferredTimezoneUtility +
    weights.preferredSeniorityMatch * preferredSeniorityUtility +
    weights.preferredSalaryRangeMatch * preferredSalaryRangeUtility +
    weights.preferredConfidenceMatch * preferredConfidenceUtility +
    weights.preferredProficiencyMatch * preferredProficiencyUtility;

  return Math.round(utilityScore * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculates skill match utility.
 * Based on coverage ratio plus proficiency bonus.
 */
function calculateSkillMatchUtility(
  matchedSkills: MatchedSkill[],
  requestedSkillIds: string[]
): number {
  // If no skills requested, return neutral score
  if (requestedSkillIds.length === 0) {
    return 0.5;
  }

  // Coverage ratio: how many of the requested skills are matched
  const coverageRatio = Math.min(matchedSkills.length / requestedSkillIds.length, 1);

  // Bonus for proficiency levels
  const proficiencyBonus =
    matchedSkills.reduce((sum, skill) => {
      const bonus =
        skill.proficiencyLevel === 'expert'
          ? 0.1
          : skill.proficiencyLevel === 'proficient'
            ? 0.05
            : 0;
      return sum + bonus;
    }, 0) / Math.max(matchedSkills.length, 1);

  return Math.min(coverageRatio + proficiencyBonus, 1);
}

/**
 * Calculates confidence score utility.
 * Linear function between min and max.
 */
function calculateConfidenceUtility(
  avgConfidence: number,
  min: number,
  max: number
): number {
  if (avgConfidence <= 0) {
    return 0.5; // Neutral for browse mode
  }
  return normalizeLinear(avgConfidence, min, max);
}

/**
 * Calculates years of experience utility.
 * Logarithmic function with diminishing returns.
 */
function calculateExperienceUtility(
  yearsExperience: number,
  maxYears: number
): number {
  // Logarithmic scaling: log(1 + years) / log(1 + maxYears)
  const logYears = Math.log(1 + yearsExperience);
  const logMax = Math.log(1 + maxYears);
  return Math.min(logYears / logMax, 1);
}

/**
 * Calculates availability utility.
 * Step function based on availability value.
 */
function calculateAvailabilityUtility(
  availability: AvailabilityOption
): number {
  return config.availabilityUtility[availability] ?? 0;
}

/**
 * Calculates salary utility.
 * Inverse linear: lower salary = higher utility (budget fit).
 */
function calculateSalaryUtility(
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

/**
 * Calculates related skills match utility.
 * Engineers with more unmatched related skills (below threshold) get a small match score
 * to reward breadth of experience in the skill hierarchy.
 */
function calculateRelatedSkillsMatchUtility(
  unmatchedRelatedSkills: UnmatchedRelatedSkill[],
  maxMatch: number
): number {
  const count = unmatchedRelatedSkills.length;
  if (count === 0) return 0;
  // Diminishing returns curve: score increases quickly at first, then plateaus
  return Math.min((1 - Math.exp(-count / maxMatch)) * maxMatch, maxMatch);
}

/**
 * Calculates preferred skills match utility.
 * Accumulated score from matching user-specified preferred skills.
 */
function calculatePreferredSkillsMatchUtility(
  matchedSkills: MatchedSkill[],
  preferredSkillIds: string[],
  maxMatch: number
): number {
  if (preferredSkillIds.length === 0) {
    return 0;
  }

  // Count how many preferred skills the engineer has
  const matchingPreferredSkills = matchedSkills.filter((skill) =>
    preferredSkillIds.includes(skill.skillId)
  ).length;

  // Normalize by the number of preferred skills, capped at maxMatch
  const matchRatio = matchingPreferredSkills / preferredSkillIds.length;
  return Math.min(matchRatio * maxMatch, maxMatch);
}

/**
 * Calculates team focus match utility.
 * Accumulated score from matching aligned skills.
 */
function calculateTeamFocusMatchUtility(
  matchedSkills: MatchedSkill[],
  alignedSkillIds: string[],
  maxMatch: number
): number {
  if (alignedSkillIds.length === 0) {
    return 0;
  }

  // Count how many aligned skills the engineer has
  const matchingAlignedSkills = matchedSkills.filter((skill) =>
    alignedSkillIds.includes(skill.skillId)
  ).length;

  // Normalize by the number of aligned skills, capped at maxMatch
  const matchRatio = matchingAlignedSkills / alignedSkillIds.length;
  return Math.min(matchRatio * maxMatch, maxMatch);
}

/**
 * Calculates preferred domain match utility.
 * Accumulated score from matching preferred domains.
 */
function calculatePreferredDomainMatchUtility(
  matchedDomainNames: string[],
  preferredDomainIds: string[],
  maxMatch: number
): number {
  if (preferredDomainIds.length === 0) {
    return 0;
  }

  // matchedDomainNames already contains the names of matched preferred domains from the query
  // Normalize by the number of preferred domains, capped at maxMatch
  const matchRatio = matchedDomainNames.length / preferredDomainIds.length;
  return Math.min(matchRatio * maxMatch, maxMatch);
}

/**
 * Normalizes a value to [0, 1] using linear scaling.
 */
function normalizeLinear(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Normalizes a value to [0, 1] using inverse linear scaling.
 * Lower values get higher scores.
 */
function normalizeLinearInverse(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (max - value) / (max - min)));
}

/**
 * Determines match strength based on utility score thresholds.
 */
export function classifyMatchStrength(utilityScore: number): MatchStrength {
  const thresholds = config.matchStrengthThresholds;

  if (utilityScore >= thresholds.strong) {
    return 'strong';
  } else if (utilityScore >= thresholds.moderate) {
    return 'moderate';
  } else {
    return 'weak';
  }
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
      const matchStrength = classifyMatchStrength(utilityScore);
      return {
        ...engineer,
        utilityScore,
        matchStrength,
        scoreBreakdown,
      };
    })
    .sort((a, b) => b.utilityScore - a.utilityScore);
}
