import { TradeoffExplanation } from '../../types/search-match-explanation.types.js';
import { seniorityMapping } from '../../config/knowledge-base/compatibility-constraints.config.js';
import { formatStartTimeline } from '../../config/display.config.js';
import { SeniorityLevel, StartTimeline } from '../../types/search.types.js';
import { START_TIMELINE_ORDER } from '../../schemas/search.schema.js';

interface EngineerProfile {
  yearsExperience: number;
  salary: number;
  startTimeline: StartTimeline;
  timezone: string;
  skills: string[]; // Skill IDs the engineer has
}

/*
 * WHY ONLY PREFERRED CRITERIA, NOT REQUIRED?
 *
 * Tradeoffs and required constraints serve different purposes:
 *
 * | Type     | If engineer doesn't match                                    |
 * |----------|--------------------------------------------------------------|
 * | Required | Filtered out, or ConstraintExplanation.satisfied = false     |
 * | Preferred| Still shown, but it's a tradeoff                             |
 *
 * "Tradeoff" implies you're still considering the engineer despite the gap.
 * Failing a required constraint isn't a tradeoff - it's a disqualification.
 *
 * Required constraints are handled by ConstraintExplanation (satisfied: true/false).
 * TradeoffExplanation focuses on preference gaps - the compromises you'd make
 * if you hire this person.
 *
 * SearchPreferences is extracted from SearchFilterRequest fields:
 *   - preferredSeniorityLevel → preferredSeniorityLevel
 *   - maxBudget, stretchBudget → maxBudget, stretchBudget
 *   - preferredMaxStartTime → preferredMaxStartTime
 *   - preferredTimezone → preferredTimezone
 *   - preferredSkills → preferredSkillIds (after resolution)
 */
interface SearchPreferences {
  preferredSeniorityLevel?: SeniorityLevel;
  maxBudget?: number;
  stretchBudget?: number;
  preferredMaxStartTime?: StartTimeline;
  preferredTimezone?: string[];
  preferredSkillIds?: string[];
  /*
   * Original skill names from user's request (e.g., ["Python", "React"]).
   * Used to generate human-readable tradeoff explanations like "Missing: Python".
   */
  preferredSkillNames?: string[];
}

export function detectTradeoffs(
  engineer: EngineerProfile,
  preferences: SearchPreferences
): TradeoffExplanation[] {
  const tradeoffs: TradeoffExplanation[] = [];

  // Experience tradeoff
  if (preferences.preferredSeniorityLevel) {
    const experienceTradeoff = detectExperienceTradeoff(
      engineer.yearsExperience,
      preferences.preferredSeniorityLevel
    );
    if (experienceTradeoff) tradeoffs.push(experienceTradeoff);
  }

  // Salary tradeoff
  if (preferences.maxBudget) {
    const salaryTradeoff = detectSalaryTradeoff(
      engineer.salary,
      preferences.maxBudget,
      preferences.stretchBudget
    );
    if (salaryTradeoff) tradeoffs.push(salaryTradeoff);
  }

  // Timeline tradeoff
  if (preferences.preferredMaxStartTime) {
    const timelineTradeoff = detectTimelineTradeoff(
      engineer.startTimeline,
      preferences.preferredMaxStartTime
    );
    if (timelineTradeoff) tradeoffs.push(timelineTradeoff);
  }

  // Timezone tradeoff
  if (preferences.preferredTimezone && preferences.preferredTimezone.length > 0) {
    const timezoneTradeoff = detectTimezoneTradeoff(
      engineer.timezone,
      preferences.preferredTimezone
    );
    if (timezoneTradeoff) tradeoffs.push(timezoneTradeoff);
  }

  // Missing preferred skills
  if (preferences.preferredSkillIds && preferences.preferredSkillIds.length > 0) {
    const skillTradeoff = detectMissingPreferredSkills(
      engineer.skills,
      preferences.preferredSkillIds,
      preferences.preferredSkillNames
    );
    if (skillTradeoff) tradeoffs.push(skillTradeoff);
  }

  return tradeoffs;
}

function detectExperienceTradeoff(
  actualYears: number,
  preferredSeniority: SeniorityLevel
): TradeoffExplanation | null {
  const { minYears, maxYears } = seniorityMapping[preferredSeniority];

  // minYears should never be null in practice, but handle it for type safety
  const effectiveMinYears = minYears ?? 0;

  if (actualYears < effectiveMinYears) {
    return {
      attribute: 'yearsExperience',
      requested: `${effectiveMinYears}+ years (${preferredSeniority})`,
      actual: actualYears,
      explanation: `Has ${actualYears} years experience (${preferredSeniority} level expects ${effectiveMinYears}+ years)`,
    };
  }

  if (maxYears !== null && actualYears > maxYears + 2) {
    return {
      attribute: 'yearsExperience',
      requested: `${effectiveMinYears}-${maxYears} years (${preferredSeniority})`,
      actual: actualYears,
      explanation: `Has ${actualYears} years experience (${preferredSeniority} range is ${effectiveMinYears}-${maxYears} years)`,
    };
  }

  return null;
}

function detectSalaryTradeoff(
  actualSalary: number,
  maxBudget: number,
  stretchBudget?: number
): TradeoffExplanation | null {
  if (actualSalary <= maxBudget) {
    return null; // Within budget, no tradeoff
  }

  const overAmount = actualSalary - maxBudget;
  const inStretch = stretchBudget && actualSalary <= stretchBudget;

  return {
    attribute: 'salary',
    requested: maxBudget,
    actual: actualSalary,
    explanation: inStretch
      ? `Salary ($${actualSalary.toLocaleString()}) is $${overAmount.toLocaleString()} over budget ($${maxBudget.toLocaleString()}) but within stretch range ($${stretchBudget!.toLocaleString()})`
      : `Salary ($${actualSalary.toLocaleString()}) is $${overAmount.toLocaleString()} over budget ($${maxBudget.toLocaleString()})`,
  };
}

function detectTimelineTradeoff(
  actualTimeline: StartTimeline,
  preferredTimeline: StartTimeline
): TradeoffExplanation | null {
  const actualIndex = START_TIMELINE_ORDER.indexOf(actualTimeline);
  const preferredIndex = START_TIMELINE_ORDER.indexOf(preferredTimeline);

  if (actualIndex <= preferredIndex) {
    return null; // Available at or before preferred, no tradeoff
  }

  return {
    attribute: 'startTimeline',
    requested: preferredTimeline,
    actual: actualTimeline,
    explanation: `Available ${formatStartTimeline(actualTimeline)} (preferred: ${formatStartTimeline(preferredTimeline)})`,
  };
}

function detectTimezoneTradeoff(
  actualTimezone: string,
  preferredTimezones: string[]
): TradeoffExplanation | null {
  if (preferredTimezones.includes(actualTimezone)) {
    return null; // In preferred timezone, no tradeoff
  }

  return {
    attribute: 'timezone',
    requested: preferredTimezones,
    actual: actualTimezone,
    explanation: `In ${actualTimezone} timezone (preferred: ${preferredTimezones.join(' or ')})`,
  };
}

function detectMissingPreferredSkills(
  engineerSkills: string[],
  preferredSkillIds: string[],
  preferredSkillNames?: string[]
): TradeoffExplanation | null {
  const engineerSkillSet = new Set(engineerSkills);
  const hasAnyPreferredSkill = preferredSkillIds.some((id) => engineerSkillSet.has(id));

  if (hasAnyPreferredSkill) {
    return null;
  }

  /*
   * Engineer doesn't have any of the preferred skills.
   * Use the original skill names for a clear explanation.
   */
  const skillList = preferredSkillNames?.join(', ') ?? 'requested skills';
  const explanation =
    preferredSkillNames && preferredSkillNames.length === 1
      ? `Missing preferred skill: ${skillList}`
      : `Missing preferred skills: ${skillList}`;

  return {
    attribute: 'preferredSkills',
    requested: skillList,
    actual: 'none',
    explanation,
  };
}

export function summarizeTradeoffs(tradeoffs: TradeoffExplanation[]): string {
  if (tradeoffs.length === 0) {
    return 'No tradeoffs detected';
  }

  const attributes = tradeoffs.map((t) => t.attribute);
  return `${tradeoffs.length} tradeoff${tradeoffs.length === 1 ? '' : 's'}: ${attributes.join(', ')}`;
}

