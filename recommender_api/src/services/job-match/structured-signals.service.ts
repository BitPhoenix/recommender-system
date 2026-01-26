import { getSeniorityLevelFromYears } from "../../config/knowledge-base/utility.config.js";
import { SENIORITY_LEVEL_ORDER, type SeniorityLevel } from "../../types/enums.types.js";

/*
 * Calculate seniority match score.
 * - 1.0 if exact match
 * - 0.5 if adjacent level (one step away)
 * - 0.0 if more than one level away
 */
export function calculateSeniorityMatch(
  jobSeniority: string,
  engineerYearsExperience: number
): number {
  // Determine engineer's implied seniority from years of experience
  const engineerSeniority = getSeniorityLevelFromYears(engineerYearsExperience);

  const jobIndex = SENIORITY_LEVEL_ORDER.indexOf(jobSeniority as SeniorityLevel);
  const engineerIndex = SENIORITY_LEVEL_ORDER.indexOf(engineerSeniority);

  if (jobIndex === -1 || engineerIndex === -1) {
    return 0;
  }

  const distance = Math.abs(jobIndex - engineerIndex);

  if (distance === 0) return 1.0;
  if (distance === 1) return 0.5;
  return 0.0;
}

/*
 * Calculate timezone match score.
 * - 1.0 if engineer's timezone is in job's allowed list
 * - 0.0 otherwise
 */
export function calculateTimezoneMatch(
  jobTimezones: string[],
  engineerTimezone: string
): number {
  if (jobTimezones.length === 0) {
    // No timezone restriction
    return 1.0;
  }
  return jobTimezones.includes(engineerTimezone) ? 1.0 : 0.0;
}

/*
 * Calculate budget match score.
 * - 1.0 if salary <= maxBudget
 * - Graduated score if within stretch range (20% above maxBudget)
 * - 0.0 if significantly over budget
 */
export function calculateBudgetMatch(
  jobMinBudget: number | null,
  jobMaxBudget: number | null,
  engineerSalary: number
): number {
  if (jobMaxBudget === null) {
    // No budget constraint
    return 1.0;
  }

  if (engineerSalary <= jobMaxBudget) {
    return 1.0;
  }

  // Allow 20% stretch range with graduated scoring
  const stretchLimit = jobMaxBudget * 1.2;
  if (engineerSalary <= stretchLimit) {
    // Linear interpolation from 1.0 at maxBudget to 0.0 at stretchLimit
    const overageRatio = (engineerSalary - jobMaxBudget) / (stretchLimit - jobMaxBudget);
    return 1.0 - overageRatio;
  }

  return 0.0;
}

/*
 * Calculate skill coverage - what fraction of job skills the engineer has.
 * Returns { coverage, matchingSkillIds, missingSkillIds }.
 */
export function calculateSkillCoverage(
  jobSkillIds: string[],
  engineerSkillIds: Set<string>
): {
  coverage: number;
  matchingSkillIds: string[];
  missingSkillIds: string[];
} {
  if (jobSkillIds.length === 0) {
    return { coverage: 1.0, matchingSkillIds: [], missingSkillIds: [] };
  }

  const matchingSkillIds: string[] = [];
  const missingSkillIds: string[] = [];

  for (const skillId of jobSkillIds) {
    if (engineerSkillIds.has(skillId)) {
      matchingSkillIds.push(skillId);
    } else {
      missingSkillIds.push(skillId);
    }
  }

  const coverage = matchingSkillIds.length / jobSkillIds.length;
  return { coverage, matchingSkillIds, missingSkillIds };
}
