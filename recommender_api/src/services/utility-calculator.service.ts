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
  ScoreComponent,
  TeamFocusBonusComponent,
  PreferredSkillsBonusComponent,
  RelatedSkillsBonusComponent,
  DomainBonusComponent,
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
  bonusSkillIds: string[];
  maxSalaryBudget: number | null;
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

interface TeamFocusBonusResult {
  raw: number;
  matchedSkillNames: string[];
}

interface PreferredSkillsBonusResult {
  raw: number;
  matchedSkillNames: string[];
}

interface RelatedSkillsBonusResult {
  raw: number;
  count: number;
}

interface DomainBonusResult {
  raw: number;
  matchedDomainNames: string[];
}

/**
 * Calculates preferred skills bonus utility with matched skill details.
 * Engineers with preferred skills get a ranking boost.
 */
function calculatePreferredSkillsBonusWithDetails(
  matchedSkills: MatchedSkill[],
  preferredSkillIds: string[],
  maxBonus: number
): PreferredSkillsBonusResult {
  if (preferredSkillIds.length === 0) {
    return { raw: 0, matchedSkillNames: [] };
  }

  // Find which preferred skills the engineer has
  const matchingPreferredSkills = matchedSkills.filter((skill) =>
    preferredSkillIds.includes(skill.skillId)
  );

  // Normalize by the number of preferred skills, capped at maxBonus
  const bonusRatio = matchingPreferredSkills.length / preferredSkillIds.length;
  const raw = Math.min(bonusRatio * maxBonus, maxBonus);

  return {
    raw,
    matchedSkillNames: matchingPreferredSkills.map((s) => s.skillName),
  };
}

/**
 * Calculates team focus bonus utility with matched skill details.
 */
function calculateTeamFocusBonusWithDetails(
  matchedSkills: MatchedSkill[],
  bonusSkillIds: string[],
  maxBonus: number
): TeamFocusBonusResult {
  if (bonusSkillIds.length === 0) {
    return { raw: 0, matchedSkillNames: [] };
  }

  // Find which bonus skills the engineer has
  const matchingBonusSkills = matchedSkills.filter((skill) =>
    bonusSkillIds.includes(skill.skillId)
  );

  // Normalize by the number of bonus skills, capped at maxBonus
  const bonusRatio = matchingBonusSkills.length / bonusSkillIds.length;
  const raw = Math.min(bonusRatio * maxBonus, maxBonus);

  return {
    raw,
    matchedSkillNames: matchingBonusSkills.map((s) => s.skillName),
  };
}

/**
 * Calculates related skills bonus utility.
 * Engineers with more unmatched related skills (below threshold) get a small bonus
 * to reward breadth of experience in the skill hierarchy.
 */
function calculateRelatedSkillsBonusWithDetails(
  unmatchedRelatedSkills: UnmatchedRelatedSkill[],
  maxBonus: number
): RelatedSkillsBonusResult {
  const count = unmatchedRelatedSkills.length;

  if (count === 0) {
    return { raw: 0, count: 0 };
  }

  // Normalize: more unmatched skills = higher bonus, capped at maxBonus
  // Use a diminishing returns curve: bonus increases quickly at first, then plateaus
  // Formula: 1 - e^(-count/maxBonus) gives nice curve from 0 to ~1
  const raw = Math.min((1 - Math.exp(-count / maxBonus)) * maxBonus, maxBonus);

  return { raw, count };
}

/**
 * Calculates domain bonus utility with matched domain details.
 * Engineers with preferred domain experience get a ranking boost.
 */
function calculateDomainBonusWithDetails(
  matchedDomainNames: string[],
  preferredDomainIds: string[],
  maxBonus: number
): DomainBonusResult {
  if (preferredDomainIds.length === 0) {
    return { raw: 0, matchedDomainNames: [] };
  }

  // matchedDomainNames already contains the names of matched preferred domains from the query
  // Normalize by the number of preferred domains, capped at maxBonus
  const bonusRatio = matchedDomainNames.length / preferredDomainIds.length;
  const raw = Math.min(bonusRatio * maxBonus, maxBonus);

  return {
    raw,
    matchedDomainNames,
  };
}

function buildComponent(raw: number, weight: number): ScoreComponent {
  return {
    raw: Math.round(raw * 100) / 100,
    weight,
    weighted: Math.round(raw * weight * 1000) / 1000,
  };
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

  const preferredSkillsResult = calculatePreferredSkillsBonusWithDetails(
    engineer.matchedSkills,
    context.preferredSkillIds,
    params.preferredSkillsBonusMax
  );

  const teamFocusResult = calculateTeamFocusBonusWithDetails(
    engineer.matchedSkills,
    context.bonusSkillIds,
    params.teamFocusBonusMax
  );

  const relatedSkillsResult = calculateRelatedSkillsBonusWithDetails(
    engineer.unmatchedRelatedSkills,
    params.relatedSkillsBonusMax
  );

  const domainBonusResult = calculateDomainBonusWithDetails(
    engineer.matchedDomainNames,
    context.preferredDomainIds,
    params.domainBonusMax
  );

  // Build component breakdown
  const components = {
    skillMatch: buildComponent(skillMatchRaw, weights.skillMatch),
    confidence: buildComponent(confidenceRaw, weights.confidenceScore),
    experience: buildComponent(experienceRaw, weights.yearsExperience),
    availability: buildComponent(availabilityRaw, weights.availability),
    salary: buildComponent(salaryRaw, weights.salary),
    preferredSkillsBonus: {
      ...buildComponent(preferredSkillsResult.raw, weights.preferredSkillsBonus),
      matchedSkills: preferredSkillsResult.matchedSkillNames,
    } as PreferredSkillsBonusComponent,
    teamFocusBonus: {
      ...buildComponent(teamFocusResult.raw, weights.teamFocusBonus),
      matchedSkills: teamFocusResult.matchedSkillNames,
    } as TeamFocusBonusComponent,
    relatedSkillsBonus: {
      ...buildComponent(relatedSkillsResult.raw, weights.relatedSkillsBonus),
      count: relatedSkillsResult.count,
    } as RelatedSkillsBonusComponent,
    domainBonus: {
      ...buildComponent(domainBonusResult.raw, weights.domainBonus),
      matchedDomains: domainBonusResult.matchedDomainNames,
    } as DomainBonusComponent,
  };

  // Sum weighted scores
  const total = Object.values(components).reduce(
    (sum, comp) => sum + comp.weighted,
    0
  );

  const utilityScore = Math.round(total * 100) / 100;

  return {
    utilityScore,
    scoreBreakdown: {
      components,
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

  const preferredSkillsBonusUtility = calculatePreferredSkillsBonusUtility(
    engineer.matchedSkills,
    context.preferredSkillIds,
    params.preferredSkillsBonusMax
  );

  const teamFocusBonusUtility = calculateTeamFocusBonusUtility(
    engineer.matchedSkills,
    context.bonusSkillIds,
    params.teamFocusBonusMax
  );

  const relatedSkillsBonusUtility = calculateRelatedSkillsBonusUtility(
    engineer.unmatchedRelatedSkills,
    params.relatedSkillsBonusMax
  );

  const domainBonusUtility = calculateDomainBonusUtility(
    engineer.matchedDomainNames,
    context.preferredDomainIds,
    params.domainBonusMax
  );

  // Weighted sum: U(V) = Σ w_j * f_j(v_j)
  const utilityScore =
    weights.skillMatch * skillMatchUtility +
    weights.confidenceScore * confidenceUtility +
    weights.yearsExperience * experienceUtility +
    weights.availability * availabilityUtility +
    weights.salary * salaryUtility +
    weights.preferredSkillsBonus * preferredSkillsBonusUtility +
    weights.teamFocusBonus * teamFocusBonusUtility +
    weights.relatedSkillsBonus * relatedSkillsBonusUtility +
    weights.domainBonus * domainBonusUtility;

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
 * Calculates related skills bonus utility.
 * Engineers with more unmatched related skills (below threshold) get a small bonus
 * to reward breadth of experience in the skill hierarchy.
 */
function calculateRelatedSkillsBonusUtility(
  unmatchedRelatedSkills: UnmatchedRelatedSkill[],
  maxBonus: number
): number {
  const count = unmatchedRelatedSkills.length;
  if (count === 0) return 0;
  // Diminishing returns curve: bonus increases quickly at first, then plateaus
  return Math.min((1 - Math.exp(-count / maxBonus)) * maxBonus, maxBonus);
}

/**
 * Calculates preferred skills bonus utility.
 * Accumulated bonus from matching user-specified preferred skills.
 */
function calculatePreferredSkillsBonusUtility(
  matchedSkills: MatchedSkill[],
  preferredSkillIds: string[],
  maxBonus: number
): number {
  if (preferredSkillIds.length === 0) {
    return 0;
  }

  // Count how many preferred skills the engineer has
  const matchingPreferredSkills = matchedSkills.filter((skill) =>
    preferredSkillIds.includes(skill.skillId)
  ).length;

  // Normalize by the number of preferred skills, capped at maxBonus
  const bonusRatio = matchingPreferredSkills / preferredSkillIds.length;
  return Math.min(bonusRatio * maxBonus, maxBonus);
}

/**
 * Calculates team focus bonus utility.
 * Accumulated bonus from matching bonus skills.
 */
function calculateTeamFocusBonusUtility(
  matchedSkills: MatchedSkill[],
  bonusSkillIds: string[],
  maxBonus: number
): number {
  if (bonusSkillIds.length === 0) {
    return 0;
  }

  // Count how many bonus skills the engineer has
  const matchingBonusSkills = matchedSkills.filter((skill) =>
    bonusSkillIds.includes(skill.skillId)
  ).length;

  // Normalize by the number of bonus skills, capped at maxBonus
  const bonusRatio = matchingBonusSkills / bonusSkillIds.length;
  return Math.min(bonusRatio * maxBonus, maxBonus);
}

/**
 * Calculates domain bonus utility.
 * Accumulated bonus from matching preferred domains.
 */
function calculateDomainBonusUtility(
  matchedDomainNames: string[],
  preferredDomainIds: string[],
  maxBonus: number
): number {
  if (preferredDomainIds.length === 0) {
    return 0;
  }

  // matchedDomainNames already contains the names of matched preferred domains from the query
  // Normalize by the number of preferred domains, capped at maxBonus
  const bonusRatio = matchedDomainNames.length / preferredDomainIds.length;
  return Math.min(bonusRatio * maxBonus, maxBonus);
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
