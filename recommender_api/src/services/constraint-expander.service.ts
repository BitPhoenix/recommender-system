/**
 * Constraint Expander Service
 * Implements Section 5.2.1 - expanding user requirements into database constraints.
 *
 * This service translates manager language (seniorityLevel, teamFocus)
 * into concrete database constraints using the knowledge base rules.
 */

import type {
  SearchFilterRequest,
  AppliedConstraint,
  StartTimeline,
  SeniorityLevel,
  TeamFocus,
  SkillRequirement,
} from '../types/search.types.js';
import { knowledgeBaseConfig } from '../config/knowledge-base/index.js';

// ============================================
// TYPES
// ============================================

export interface ExpandedConstraints {
  // Experience constraints
  minYearsExperience: number;
  maxYearsExperience: number | null;

  // Start timeline (when candidate could start) - array for Cypher IN filter
  startTimeline: StartTimeline[];

  // Timezone (converted glob patterns for STARTS WITH matching)
  timezonePrefixes: string[];

  // Salary constraints
  maxSalary: number | null;
  minSalary: number | null;

  // Team focus aligned skills
  alignedSkillIds: string[];

  // Pagination
  limit: number;
  offset: number;

  /*
   * Tracking for API response transparency.
   * Returned to callers so they can see what was actually applied.
   */
  appliedConstraints: AppliedConstraint[];  // All constraints with their source (user/knowledge_base/default)
  defaultsApplied: string[];                // Field names where defaults were used

  /*
   * Pass-through preferred values for utility calculation.
   * These are not used for filtering - they inform how candidates are scored/ranked.
   */
  preferredSeniorityLevel: SeniorityLevel | null;
  /*
   * Timeline scoring thresholds (both optional):
   * - preferredMaxStartTime: Engineers at or faster get full startTimelineMatch score
   * - requiredMaxStartTime: Hard filter cutoff; also defines the zero-score boundary
   *
   * Between preferred and required, score degrades linearly.
   * Example: preferred="two_weeks", required="one_month"
   *   immediate → 100%, two_weeks → 100%, one_month → 0%, beyond → filtered out
   */
  preferredMaxStartTime: StartTimeline | null;
  requiredMaxStartTime: StartTimeline | null;
  preferredTimezone: string[];
  preferredSalaryRange: { min: number; max: number } | null;
}

interface ExpansionContext {
  constraints: AppliedConstraint[];
  defaults: string[];
}

type KnowledgeBaseConfig = typeof knowledgeBaseConfig;

// ============================================
// HELPER FUNCTIONS
// ============================================

function expandSeniorityToYearsExperience(
  seniorityLevel: SeniorityLevel | undefined,
  config: KnowledgeBaseConfig
): { minYears: number; maxYears: number | null; context: ExpansionContext } {
  const context: ExpansionContext = { constraints: [], defaults: [] };

  if (!seniorityLevel) {
    return { minYears: 0, maxYears: null, context };
  }

  const mapping = config.seniorityMapping[seniorityLevel];
  const minYears = mapping.minYears;
  const maxYears = mapping.maxYears;

  const valueStr = maxYears !== null
    ? `${minYears} AND ${maxYears}`
    : `>= ${minYears}`;

  context.constraints.push({
    field: 'yearsExperience',
    operator: maxYears !== null ? 'BETWEEN' : '>=',
    value: valueStr,
    source: 'knowledge_base',
  });

  return { minYears, maxYears, context };
}


/**
 * Expands start timeline threshold to array of allowed values.
 * Converts "I need someone within X time" to array for Cypher IN filter.
 */
function expandStartTimelineConstraint(
  requiredMaxStartTime: StartTimeline | undefined,
  config: KnowledgeBaseConfig
): { startTimeline: StartTimeline[]; requiredMaxStartTime: StartTimeline; context: ExpansionContext } {
  const context: ExpansionContext = { constraints: [], defaults: [] };

  const threshold = requiredMaxStartTime || config.defaults.requiredMaxStartTime;
  if (!requiredMaxStartTime) {
    context.defaults.push('requiredMaxStartTime');
  }

  // Convert threshold to array: all values up to and including the threshold
  const timelineOrder: StartTimeline[] = ['immediate', 'two_weeks', 'one_month', 'three_months', 'six_months', 'one_year'];
  const thresholdIndex = timelineOrder.indexOf(threshold);
  const allowedTimelines = timelineOrder.slice(0, thresholdIndex + 1);

  context.constraints.push({
    field: 'startTimeline',
    operator: 'IN',
    value: JSON.stringify(allowedTimelines),
    source: requiredMaxStartTime ? 'user' : 'knowledge_base',
  });

  return { startTimeline: allowedTimelines, requiredMaxStartTime: threshold, context };
}

function expandTimezoneToPrefixes(
  requiredTimezone: string[] | undefined
): { timezonePrefixes: string[]; context: ExpansionContext } {
  const context: ExpansionContext = { constraints: [], defaults: [] };

  if (!requiredTimezone || requiredTimezone.length === 0) {
    return { timezonePrefixes: [], context };
  }

  /*
   * Convert glob patterns to prefixes for STARTS WITH matching.
   * Example: ["America/*", "Europe/London"] → ["America/", "Europe/London"]
   */
  const timezonePrefixes = requiredTimezone.map((tz) => tz.replace(/\*$/, ''));

  context.constraints.push({
    field: 'timezone',
    operator: 'STARTS WITH (any of)',
    value: JSON.stringify(requiredTimezone),
    source: 'user',
  });

  return { timezonePrefixes, context };
}

function expandSalaryConstraints(
  requiredMaxSalary: number | undefined,
  requiredMinSalary: number | undefined
): { maxSalary: number | null; minSalary: number | null; context: ExpansionContext } {
  const context: ExpansionContext = { constraints: [], defaults: [] };

  const maxSalary = requiredMaxSalary ?? null;
  const minSalary = requiredMinSalary ?? null;

  if (maxSalary !== null) {
    context.constraints.push({
      field: 'salary',
      operator: '<=',
      value: maxSalary.toString(),
      source: 'user',
    });
  }

  if (minSalary !== null) {
    context.constraints.push({
      field: 'salary',
      operator: '>=',
      value: minSalary.toString(),
      source: 'user',
    });
  }

  return { maxSalary, minSalary, context };
}

function expandTeamFocusToAlignedSkills(
  teamFocus: TeamFocus | undefined,
  config: KnowledgeBaseConfig
): { alignedSkillIds: string[]; context: ExpansionContext } {
  const context: ExpansionContext = { constraints: [], defaults: [] };

  if (!teamFocus) {
    return { alignedSkillIds: [], context };
  }

  const alignment = config.teamFocusSkillAlignment[teamFocus];
  const alignedSkillIds = alignment.alignedSkillIds;

  context.constraints.push({
    field: 'teamFocusMatch',
    operator: 'BOOST',
    value: alignedSkillIds.join(', '),
    source: 'knowledge_base',
  });

  return { alignedSkillIds, context };
}

function expandPaginationConstraints(
  requestLimit: number | undefined,
  requestOffset: number | undefined,
  config: KnowledgeBaseConfig
): { limit: number; offset: number; context: ExpansionContext } {
  const context: ExpansionContext = { constraints: [], defaults: [] };

  const limit = Math.min(requestLimit ?? config.defaults.limit, 100);
  const offset = requestOffset ?? config.defaults.offset;

  if (!requestLimit) {
    context.defaults.push('limit');
  }
  if (!requestOffset) {
    context.defaults.push('offset');
  }

  return { limit, offset, context };
}

function trackSkillsAsConstraints(
  requiredSkills: SkillRequirement[] | undefined,
  preferredSkills: SkillRequirement[] | undefined
): ExpansionContext {
  const context: ExpansionContext = { constraints: [], defaults: [] };

  if (requiredSkills && requiredSkills.length > 0) {
    // Track skill requirements with their proficiency levels
    const skillSummary = requiredSkills.map((s) => {
      const parts = [s.skill];
      if (s.minProficiency) parts.push(`min:${s.minProficiency}`);
      if (s.preferredMinProficiency) parts.push(`pref:${s.preferredMinProficiency}`);
      return parts.join('|');
    });

    context.constraints.push({
      field: 'requiredSkills',
      operator: 'IN',
      value: JSON.stringify(skillSummary),
      source: 'user',
    });
  }

  if (preferredSkills && preferredSkills.length > 0) {
    const skillSummary = preferredSkills.map((s) => {
      const parts = [s.skill];
      if (s.preferredMinProficiency) parts.push(`pref:${s.preferredMinProficiency}`);
      return parts.join('|');
    });

    context.constraints.push({
      field: 'preferredSkills',
      operator: 'BOOST',
      value: JSON.stringify(skillSummary),
      source: 'user',
    });
  }

  return context;
}

function trackPreferredValuesAsConstraints(request: SearchFilterRequest): ExpansionContext {
  const context: ExpansionContext = { constraints: [], defaults: [] };

  if (request.preferredSeniorityLevel) {
    context.constraints.push({
      field: 'preferredSeniorityLevel',
      operator: 'BOOST',
      value: request.preferredSeniorityLevel,
      source: 'user',
    });
  }

  if (request.preferredMaxStartTime) {
    context.constraints.push({
      field: 'preferredMaxStartTime',
      operator: 'BOOST',
      value: request.preferredMaxStartTime,
      source: 'user',
    });
  }

  if (request.preferredTimezone && request.preferredTimezone.length > 0) {
    context.constraints.push({
      field: 'preferredTimezone',
      operator: 'BOOST',
      value: JSON.stringify(request.preferredTimezone),
      source: 'user',
    });
  }

  if (request.preferredSalaryRange) {
    context.constraints.push({
      field: 'preferredSalaryRange',
      operator: 'BOOST',
      value: JSON.stringify(request.preferredSalaryRange),
      source: 'user',
    });
  }

  // Note: preferredConfidenceScore and preferredProficiency have been removed.
  // Per-skill proficiency preferences are now handled via preferredMinProficiency
  // on each SkillRequirement in requiredSkills/preferredSkills.

  return context;
}

function mergeContexts(...contexts: ExpansionContext[]): ExpansionContext {
  return {
    constraints: contexts.flatMap(c => c.constraints),
    defaults: contexts.flatMap(c => c.defaults),
  };
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Expands a search request into database-level constraints.
 */
export function expandConstraints(request: SearchFilterRequest): ExpandedConstraints {
  const config = knowledgeBaseConfig;

  // Expand each constraint type
  const seniority = expandSeniorityToYearsExperience(request.requiredSeniorityLevel, config);
  const timeline = expandStartTimelineConstraint(request.requiredMaxStartTime, config);
  const timezone = expandTimezoneToPrefixes(request.requiredTimezone);
  const salary = expandSalaryConstraints(request.requiredMaxSalary, request.requiredMinSalary);
  const teamFocus = expandTeamFocusToAlignedSkills(request.teamFocus, config);
  const pagination = expandPaginationConstraints(request.limit, request.offset, config);

  // Track skills and preferred values as constraints
  const skillsContext = trackSkillsAsConstraints(request.requiredSkills, request.preferredSkills);
  const preferredContext = trackPreferredValuesAsConstraints(request);

  // Merge all contexts
  const merged = mergeContexts(
    seniority.context,
    timeline.context,
    timezone.context,
    salary.context,
    teamFocus.context,
    pagination.context,
    skillsContext,
    preferredContext
  );

  return {
    minYearsExperience: seniority.minYears,
    maxYearsExperience: seniority.maxYears,
    startTimeline: timeline.startTimeline,
    timezonePrefixes: timezone.timezonePrefixes,
    maxSalary: salary.maxSalary,
    minSalary: salary.minSalary,
    alignedSkillIds: teamFocus.alignedSkillIds,
    limit: pagination.limit,
    offset: pagination.offset,
    appliedConstraints: merged.constraints,
    defaultsApplied: merged.defaults,
    // Pass-through preferred/required values for utility calculation
    preferredSeniorityLevel: request.preferredSeniorityLevel ?? null,
    preferredMaxStartTime: request.preferredMaxStartTime ?? null,
    requiredMaxStartTime: timeline.requiredMaxStartTime,
    preferredTimezone: request.preferredTimezone ?? [],
    preferredSalaryRange: request.preferredSalaryRange ?? null,
  };
}
