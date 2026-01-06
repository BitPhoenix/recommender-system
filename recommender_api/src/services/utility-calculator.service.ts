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
  ScoreBreakdown,
  CoreScores,
  PreferenceMatches,
  SeniorityLevel,
  ProficiencyLevel,
  StartTimeline,
  BusinessDomainMatch,
  TechnicalDomainMatch,
} from '../types/search.types.js';
import { START_TIMELINE_ORDER } from '../types/search.types.js';
import type {
  ResolvedBusinessDomain,
  ResolvedTechnicalDomain,
} from './cypher-query-builder/query-types.js';
import { knowledgeBaseConfig } from '../config/knowledge-base/index.js';

export interface EngineerData {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  startTimeline: string;
  timezone: string;
  matchedSkills: MatchedSkill[];
  unmatchedRelatedSkills: UnmatchedRelatedSkill[];
  avgConfidence: number;
  matchedBusinessDomains: BusinessDomainMatch[];
  matchedTechnicalDomains: TechnicalDomainMatch[];
}

export interface UtilityContext {
  requiredSkillIds: string[];
  preferredSkillIds: string[];
  preferredBusinessDomains: ResolvedBusinessDomain[];
  preferredTechnicalDomains: ResolvedTechnicalDomain[];
  alignedSkillIds: string[];
  maxSalaryBudget: number | null;
  /*
   * Preferred values for match calculation.
   *
   * Timeline scoring thresholds:
   * - preferredMaxStartTime: Engineers at or faster get full startTimelineMatch score
   * - requiredMaxStartTime: Hard filter cutoff; also defines the zero-score boundary
   * Between preferred and required, score degrades linearly.
   */
  preferredSeniorityLevel: SeniorityLevel | null;
  preferredMaxStartTime: StartTimeline | null;
  requiredMaxStartTime: StartTimeline | null;
  preferredTimezone: string[];
  preferredSalaryRange: { min: number; max: number } | null;
  // Per-skill preferred proficiency requirements (skillId -> preferredMinProficiency)
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>;
}

export interface ScoredEngineer extends EngineerData {
  utilityScore: number;
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

interface PreferredBusinessDomainMatchResult {
  raw: number;
  matchedDomainNames: string[];
}

interface PreferredTechnicalDomainMatchResult {
  raw: number;
  matchedDomainNames: string[];
}

/**
 * Calculates preferred skills match utility with matched skill details.
 * Engineers with preferred skills get a ranking boost.
 *
 * Function type: RATIO (linear proportion)
 * Formula: matched / requested, capped at max
 *
 * Rationale: Each preferred item is an explicit user wish with equal weight.
 * Matching 2 of 4 preferred skills is genuinely twice as good as matching 1 of 4 -
 * there's no diminishing returns on satisfying stated preferences.
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
 *
 * Function type: RATIO (linear proportion)
 * Formula: matched / requested, capped at max (0.5)
 *
 * Rationale: Team alignment is a tiebreaker, not a primary criterion. We use the
 * same ratio logic as preferred skills but cap at 0.5 so "matches team stack"
 * doesn't outweigh "has the actual required skills."
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
 *
 * Function type: EXPONENTIAL DECAY
 * Formula: (1 - e^(-count/scale)) * max
 *
 * Rationale: Having 1-2 related skills signals learning agility and T-shaped breadth.
 * But accumulating 10+ doesn't make someone twice as valuable as having 5 - it just
 * means a longer resume. We reward breadth but don't let it dominate.
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
 * Calculates preferred business domain match utility with matched domain details.
 * Engineers with preferred business domain experience get a ranking boost.
 *
 * Function type: RATIO (linear proportion)
 * Formula: matched / requested, capped at max
 *
 * Rationale: Each preferred domain is an explicit user wish with equal weight.
 * Matching all requested domains = full score; partial matches scale linearly.
 */
function calculatePreferredBusinessDomainMatchWithDetails(
  matchedBusinessDomains: BusinessDomainMatch[],
  preferredBusinessDomains: ResolvedBusinessDomain[],
  maxMatch: number
): PreferredBusinessDomainMatchResult {
  if (preferredBusinessDomains.length === 0) {
    return { raw: 0, matchedDomainNames: [] };
  }

  // Filter to domains that meet the preferred criteria
  const matchingDomains = matchedBusinessDomains.filter((d) => d.meetsPreferred);

  // Normalize by the number of preferred domains, capped at maxMatch
  const matchRatio = matchingDomains.length / preferredBusinessDomains.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedDomainNames: matchingDomains.map((d) => d.domainName),
  };
}

/**
 * Calculates preferred technical domain match utility with matched domain details.
 * Engineers with preferred technical domain experience get a ranking boost.
 *
 * Function type: RATIO (linear proportion)
 * Formula: matched / requested, capped at max
 *
 * Rationale: Each preferred domain is an explicit user wish with equal weight.
 * Matching all requested domains = full score; partial matches scale linearly.
 */
function calculatePreferredTechnicalDomainMatchWithDetails(
  matchedTechnicalDomains: TechnicalDomainMatch[],
  preferredTechnicalDomains: ResolvedTechnicalDomain[],
  maxMatch: number
): PreferredTechnicalDomainMatchResult {
  if (preferredTechnicalDomains.length === 0) {
    return { raw: 0, matchedDomainNames: [] };
  }

  // Filter to domains that meet the preferred criteria
  const matchingDomains = matchedTechnicalDomains.filter((d) => d.meetsPreferred);

  // Normalize by the number of preferred domains, capped at maxMatch
  const matchRatio = matchingDomains.length / preferredTechnicalDomains.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedDomainNames: matchingDomains.map((d) => d.domainName),
  };
}

// ============================================
// PREFERENCE MATCH CALCULATION FUNCTIONS
// ============================================

interface StartTimelineMatchResult {
  raw: number;
  matchedStartTimeline: string | null;
  withinPreferred: boolean;
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


/**
 * Calculates start timeline match using threshold-based scoring.
 *
 * Function type: THRESHOLD-BASED with LINEAR DEGRADATION
 * Formula: Full score at preferred threshold, linear decay to required threshold, zero beyond
 *
 * Rationale: Managers think "I need someone within X time" - threshold semantics are
 * intuitive. Unlike position-based scoring, this rewards engineers who beat the
 * deadline while gracefully degrading for those who are slower but acceptable.
 *
 * Scoring logic:
 * - Neither specified: No scoring (returns 0)
 * - Only preferred: Full score if at/faster than preferred, else 0
 * - Only required: No scoring (filtering only, no ranking boost)
 * - Both: Full score at/faster than preferred, linear degradation to required
 */
function calculateStartTimelineMatch(
  engineerStartTimeline: StartTimeline,
  preferredMaxStartTime: StartTimeline | null,
  requiredMaxStartTime: StartTimeline | null,
  maxMatch: number
): StartTimelineMatchResult {
  // Neither specified → no timeline scoring
  if (!preferredMaxStartTime && !requiredMaxStartTime) {
    return { raw: 0, matchedStartTimeline: null, withinPreferred: false };
  }

  const engineerIdx = START_TIMELINE_ORDER.indexOf(engineerStartTimeline);

  // Only preferred specified → soft boost only
  if (preferredMaxStartTime && !requiredMaxStartTime) {
    const preferredIdx = START_TIMELINE_ORDER.indexOf(preferredMaxStartTime);
    const withinPreferred = engineerIdx <= preferredIdx;
    return {
      raw: withinPreferred ? maxMatch : 0,
      matchedStartTimeline: engineerStartTimeline,
      withinPreferred,
    };
  }

  // Only required specified → hard filter (already done by query), no scoring boost
  if (!preferredMaxStartTime && requiredMaxStartTime) {
    return { raw: 0, matchedStartTimeline: engineerStartTimeline, withinPreferred: false };
  }

  // Both specified → linear degradation between preferred and required
  const preferredIdx = START_TIMELINE_ORDER.indexOf(preferredMaxStartTime!);
  const requiredIdx = START_TIMELINE_ORDER.indexOf(requiredMaxStartTime!);

  if (engineerIdx <= preferredIdx) {
    // At or faster than preferred → full score
    return { raw: maxMatch, matchedStartTimeline: engineerStartTimeline, withinPreferred: true };
  } else if (engineerIdx <= requiredIdx) {
    // Between preferred and required → linear degradation
    const score = maxMatch * (1 - (engineerIdx - preferredIdx) / (requiredIdx - preferredIdx));
    return { raw: score, matchedStartTimeline: engineerStartTimeline, withinPreferred: false };
  }

  // Beyond required (shouldn't happen - filtered by query)
  return { raw: 0, matchedStartTimeline: engineerStartTimeline, withinPreferred: false };
}

/**
 * Calculates preferred timezone match.
 * Matches against prefix patterns in preference order.
 *
 * Function type: POSITION-BASED
 * Formula: (1 - index / length) * max
 *
 * Rationale: The user explicitly ordered their timezone preferences. First choice
 * means "this is what we actually want," second choice means "acceptable fallback."
 * Position order carries signal - flattening to binary "match/no-match" loses info.
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
 *
 * Function type: BINARY (step function)
 * Formula: meets threshold ? max : 0
 *
 * Rationale: Seniority is a qualification threshold, not a gradient. A mid-level
 * engineer isn't "60% of a senior" - they either meet the seniority bar or don't.
 * Partial credit doesn't make sense for role-level requirements.
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
 *
 * Function type: BINARY (step function)
 * Formula: in range ? max : 0
 *
 * Rationale: Salary either fits the preferred budget range or doesn't. Unlike the
 * main salary utility (which uses inverse linear to prefer lower costs), this is
 * about matching an explicit preference - partial credit doesn't make sense.
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

interface SkillMatchResult {
  /** Normalized score 0-1 representing skill coverage + proficiency match */
  score: number;
  /** Skills that meet or exceed preferred proficiency (for display) */
  skillsExceedingPreferred: string[];
}

/**
 * Unified skill match scoring that combines coverage and proficiency matching.
 *
 * Function type: GRADUATED LINEAR (per-skill proficiency scoring)
 * Formula: average of (actual_level + 1) / (preferred_level + 1) across all skills
 *
 * Rationale: This unified approach replaces two separate mechanisms that were
 * unprincipled. By scoring each skill based on how close the engineer's proficiency
 * is to the preferred level, we get intuitive graduated credit: an engineer with
 * "proficient" when you wanted "expert" gets 2/3 credit, not zero.
 *
 * For each requested skill:
 * - If engineer doesn't have it: 0 credit
 * - If engineer has it with no preferred proficiency: 1.0 credit (full)
 * - If engineer has it with preferred proficiency: graduated credit (actual+1)/(preferred+1)
 *
 * Final score = average credit across all requested skills.
 *
 * Score table (when preference specified):
 *   | Preferred | learning | proficient | expert |
 *   |-----------|----------|------------|--------|
 *   | expert    | 0.33     | 0.67       | 1.0    |
 *   | proficient| 0.50     | 1.0        | 1.0    |
 *   | learning  | 1.0      | 1.0        | 1.0    |
 *
 * When no preference specified: full credit (1.0) for having the skill.
 */
function calculateSkillMatch(
  matchedSkills: MatchedSkill[],
  requiredSkillIds: string[],
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>
): SkillMatchResult {
  if (requiredSkillIds.length === 0) {
    return { score: 0.5, skillsExceedingPreferred: [] };
  }

  const proficiencyOrder: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];
  const skillsExceedingPreferred: string[] = [];
  let totalCredit = 0;

  // Build a map for O(1) lookup
  const matchedSkillMap = new Map(matchedSkills.map(s => [s.skillId, s]));

  for (const skillId of requiredSkillIds) {
    const matchedSkill = matchedSkillMap.get(skillId);

    if (!matchedSkill) {
      // Skill not matched - zero credit (already filtered by Cypher, but handle edge cases)
      continue;
    }

    const preferredLevel = skillIdToPreferredProficiency.get(skillId);

    if (preferredLevel) {
      // Has preferred proficiency: use graduated linear scoring
      const preferredIndex = proficiencyOrder.indexOf(preferredLevel);
      const actualIndex = proficiencyOrder.indexOf(matchedSkill.proficiencyLevel as ProficiencyLevel);
      const credit = Math.min(1.0, (actualIndex + 1) / (preferredIndex + 1));
      totalCredit += credit;

      // Track for display
      if (actualIndex >= preferredIndex) {
        skillsExceedingPreferred.push(matchedSkill.skillName);
      }
    } else {
      // No preferred proficiency specified: full credit for having the skill
      totalCredit += 1.0;
    }
  }

  const score = totalCredit / requiredSkillIds.length;

  return { score, skillsExceedingPreferred };
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

  // Calculate unified skill match (coverage + proficiency in one score)
  const skillMatchResult = calculateSkillMatch(
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

  const preferredBusinessDomainResult = calculatePreferredBusinessDomainMatchWithDetails(
    engineer.matchedBusinessDomains,
    context.preferredBusinessDomains,
    params.preferredBusinessDomainMatchMax
  );

  const preferredTechnicalDomainResult = calculatePreferredTechnicalDomainMatchWithDetails(
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

  const preferredSalaryRangeResult = calculatePreferredSalaryRangeMatch(
    engineer.salary,
    context.preferredSalaryRange,
    params.preferredSalaryRangeMatchMax
  );

  // Note: preferredSkillProficiencyMatch is now absorbed into skillMatch via calculateSkillMatch
  // The unified function handles both coverage and proficiency matching in one score.

  // Calculate core weighted scores (startTimeline removed - now in preference matches)
  const coreScores: CoreScores = {
    skillMatch: calculateWeighted(skillMatchRaw, weights.skillMatch),
    confidence: calculateWeighted(confidenceRaw, weights.confidenceScore),
    experience: calculateWeighted(experienceRaw, weights.yearsExperience),
    salary: calculateWeighted(salaryRaw, weights.salary),
  };

  // Calculate match weighted scores
  // Note: preferredSkillProficiencyMatch removed - now part of skillMatch
  const matchScores = {
    preferredSkillsMatch: calculateWeighted(preferredSkillsResult.raw, weights.preferredSkillsMatch),
    teamFocusMatch: calculateWeighted(teamFocusResult.raw, weights.teamFocusMatch),
    relatedSkillsMatch: calculateWeighted(relatedSkillsResult.raw, weights.relatedSkillsMatch),
    preferredBusinessDomainMatch: calculateWeighted(preferredBusinessDomainResult.raw, weights.preferredBusinessDomainMatch),
    preferredTechnicalDomainMatch: calculateWeighted(preferredTechnicalDomainResult.raw, weights.preferredTechnicalDomainMatch),
    startTimelineMatch: calculateWeighted(startTimelineResult.raw, weights.startTimelineMatch),
    preferredTimezoneMatch: calculateWeighted(preferredTimezoneResult.raw, weights.preferredTimezoneMatch),
    preferredSeniorityMatch: calculateWeighted(preferredSeniorityResult.raw, weights.preferredSeniorityMatch),
    preferredSalaryRangeMatch: calculateWeighted(preferredSalaryRangeResult.raw, weights.preferredSalaryRangeMatch),
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
  if (matchScores.preferredSalaryRangeMatch > 0) {
    preferenceMatches.preferredSalaryRangeMatch = {
      score: matchScores.preferredSalaryRangeMatch,
    };
  }
  // Note: preferredSkillProficiencyMatch removed - now absorbed into skillMatch

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

  // Calculate unified skill match (coverage + proficiency in one score)
  const skillMatchUtility = calculateSkillMatch(
    engineer.matchedSkills,
    context.requiredSkillIds,
    context.skillIdToPreferredProficiency
  ).score;

  const confidenceUtility = calculateConfidenceUtility(
    engineer.avgConfidence,
    params.confidenceMin,
    params.confidenceMax
  );

  const experienceUtility = calculateExperienceUtility(
    engineer.yearsExperience,
    params.yearsExperienceMax
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

  const preferredBusinessDomainMatchUtility = calculatePreferredBusinessDomainMatchUtility(
    engineer.matchedBusinessDomains,
    context.preferredBusinessDomains,
    params.preferredBusinessDomainMatchMax
  );

  const preferredTechnicalDomainMatchUtility = calculatePreferredTechnicalDomainMatchUtility(
    engineer.matchedTechnicalDomains,
    context.preferredTechnicalDomains,
    params.preferredTechnicalDomainMatchMax
  );

  // Calculate preference match utilities
  const startTimelineMatchUtility = calculateStartTimelineMatch(
    engineer.startTimeline as StartTimeline,
    context.preferredMaxStartTime,
    context.requiredMaxStartTime,
    params.startTimelineMatchMax
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

  // Note: preferredSkillProficiencyMatch is now absorbed into skillMatch

  // Weighted sum: U(V) = Σ w_j * f_j(v_j)
  const utilityScore =
    weights.skillMatch * skillMatchUtility +
    weights.confidenceScore * confidenceUtility +
    weights.yearsExperience * experienceUtility +
    weights.salary * salaryUtility +
    weights.preferredSkillsMatch * preferredSkillsMatchUtility +
    weights.teamFocusMatch * teamFocusMatchUtility +
    weights.relatedSkillsMatch * relatedSkillsMatchUtility +
    weights.preferredBusinessDomainMatch * preferredBusinessDomainMatchUtility +
    weights.preferredTechnicalDomainMatch * preferredTechnicalDomainMatchUtility +
    // Preference matches
    weights.startTimelineMatch * startTimelineMatchUtility +
    weights.preferredTimezoneMatch * preferredTimezoneUtility +
    weights.preferredSeniorityMatch * preferredSeniorityUtility +
    weights.preferredSalaryRangeMatch * preferredSalaryRangeUtility;

  return Math.round(utilityScore * 100) / 100; // Round to 2 decimal places
}

// Note: Old calculateSkillMatchUtility removed - replaced by calculateSkillMatch
// which unifies coverage and proficiency scoring.

/**
 * Calculates confidence score utility.
 *
 * Function type: LINEAR
 * Formula: (confidence - min) / (max - min)
 *
 * Rationale: ML confidence scores are already calibrated probabilities. A 0.7→0.8
 * jump represents a genuine 10% improvement in match certainty. Unlike experience
 * (where gains diminish), each point of confidence means more reliable skill inference.
 * Below 0.5 is filtered out, so this range is "acceptable" to "highly confident."
 */
function calculateConfidenceUtility(
  avgConfidence: number,
  min: number,
  max: number
): number {
  if (avgConfidence <= 0) {
    return 0.5; // Neutral when no skill filtering is applied
  }
  return normalizeLinear(avgConfidence, min, max);
}

/**
 * Calculates years of experience utility.
 *
 * Function type: LOGARITHMIC
 * Formula: log(1 + years) / log(1 + maxYears)
 *
 * Rationale: Early career years add distinct capabilities - junior→mid gains project
 * ownership, mid→senior gains mentorship and architectural judgment. But 15→20 years
 * adds polish, not fundamentally new capabilities. Hiring managers confirm: "5 years
 * vs 0" is a different conversation than "22 years vs 17."
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
 * Calculates salary utility.
 *
 * Function type: INVERSE LINEAR
 * Formula: (max - salary) / (max - min)
 *
 * Rationale: Every dollar saved has equal value - $20k under budget is $20k that
 * could fund tooling or headcount, regardless of the salary level. We don't use
 * logarithmic (where the first $50k saved matters more than the next) because
 * budget math is linear, not diminishing returns. When maxSalaryBudget is specified
 * in the request, it replaces salaryMax as the ceiling.
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
 *
 * Function type: EXPONENTIAL DECAY
 * Formula: (1 - e^(-count/scale)) * max
 *
 * Rationale: Having 1-2 related skills signals learning agility and T-shaped breadth.
 * But accumulating 10+ doesn't make someone twice as valuable as having 5 - it just
 * means a longer resume. We reward breadth but don't let it dominate.
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
 *
 * Function type: RATIO (linear proportion)
 * Formula: matched / requested, capped at max
 *
 * Rationale: Each preferred item is an explicit user wish with equal weight.
 * Matching 2 of 4 preferred skills is genuinely twice as good as matching 1 of 4 -
 * there's no diminishing returns on satisfying stated preferences.
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
 *
 * Function type: RATIO (linear proportion)
 * Formula: matched / requested, capped at max (0.5)
 *
 * Rationale: Team alignment is a tiebreaker, not a primary criterion. We use the
 * same ratio logic as preferred skills but cap at 0.5 so "matches team stack"
 * doesn't outweigh "has the actual required skills."
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
 * Calculates preferred business domain match utility.
 * Accumulated score from matching preferred business domains.
 *
 * Function type: RATIO (linear proportion)
 * Formula: matched / requested, capped at max
 *
 * Rationale: Each preferred domain is an explicit user wish with equal weight.
 * Matching all requested domains = full score; partial matches scale linearly.
 */
function calculatePreferredBusinessDomainMatchUtility(
  matchedBusinessDomains: BusinessDomainMatch[],
  preferredBusinessDomains: ResolvedBusinessDomain[],
  maxMatch: number
): number {
  if (preferredBusinessDomains.length === 0) {
    return 0;
  }

  // Filter to domains that meet the preferred criteria
  const matchingDomains = matchedBusinessDomains.filter((d) => d.meetsPreferred);

  // Normalize by the number of preferred domains, capped at maxMatch
  const matchRatio = matchingDomains.length / preferredBusinessDomains.length;
  return Math.min(matchRatio * maxMatch, maxMatch);
}

/**
 * Calculates preferred technical domain match utility.
 * Accumulated score from matching preferred technical domains.
 *
 * Function type: RATIO (linear proportion)
 * Formula: matched / requested, capped at max
 *
 * Rationale: Each preferred domain is an explicit user wish with equal weight.
 * Matching all requested domains = full score; partial matches scale linearly.
 */
function calculatePreferredTechnicalDomainMatchUtility(
  matchedTechnicalDomains: TechnicalDomainMatch[],
  preferredTechnicalDomains: ResolvedTechnicalDomain[],
  maxMatch: number
): number {
  if (preferredTechnicalDomains.length === 0) {
    return 0;
  }

  // Filter to domains that meet the preferred criteria
  const matchingDomains = matchedTechnicalDomains.filter((d) => d.meetsPreferred);

  // Normalize by the number of preferred domains, capped at maxMatch
  const matchRatio = matchingDomains.length / preferredTechnicalDomains.length;
  return Math.min(matchRatio * maxMatch, maxMatch);
}

/**
 * Normalizes a value to [0, 1] using linear scaling.
 *
 * Function type: LINEAR (helper)
 * Formula: (value - min) / (max - min)
 */
function normalizeLinear(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Normalizes a value to [0, 1] using inverse linear scaling.
 * Lower values get higher scores.
 *
 * Function type: INVERSE LINEAR (helper)
 * Formula: (max - value) / (max - min)
 */
function normalizeLinearInverse(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (max - value) / (max - min)));
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
