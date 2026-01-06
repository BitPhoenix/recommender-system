/**
 * Preference Scoring Functions
 * Calculates utility scores for user preference matches.
 */

import type { SeniorityLevel, StartTimeline } from '../../../types/search.types.js';
import { START_TIMELINE_ORDER } from '../../../types/search.types.js';
import type {
  StartTimelineMatchResult,
  PreferredTimezoneMatchResult,
  PreferredSeniorityMatchResult,
  PreferredSalaryRangeMatchResult,
} from '../types.js';

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
export function calculateStartTimelineMatch(
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
export function calculatePreferredTimezoneMatch(
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
export function calculatePreferredSeniorityMatch(
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
export function calculatePreferredSalaryRangeMatch(
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
