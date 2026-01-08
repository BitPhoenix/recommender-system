/**
 * Constraint Expander Service
 * Implements Section 5.2.1 - expanding user requirements into database constraints.
 *
 * This service translates manager language (seniorityLevel, teamFocus)
 * into concrete database constraints using the knowledge base rules.
 */

import type {
  SearchFilterRequest,
  AppliedFilter,
  AppliedPreference,
  StartTimeline,
  SeniorityLevel,
  TeamFocus,
  SkillRequirement,
} from "../types/search.types.js";
import { START_TIMELINE_ORDER } from "../types/search.types.js";
import { knowledgeBaseConfig } from "../config/knowledge-base/index.js";
import {
  isFullyOverridden,
  isFilterConstraint,
  type DerivedConstraint,
} from "../types/inference-rule.types.js";
import { runInference } from "./inference-engine.service.js";

// ============================================
// TYPES
// ============================================

export interface ExpandedSearchCriteria {
  // Experience constraints
  minYearsExperience: number | null;
  maxYearsExperience: number | null;

  // Start timeline (when candidate could start) - array for Cypher IN filter
  startTimeline: StartTimeline[];

  // Timezone (converted glob patterns for STARTS WITH matching)
  timezonePrefixes: string[];

  // Budget constraints (job-centric)
  maxBudget: number | null;
  stretchBudget: number | null;

  // Team focus aligned skills
  alignedSkillIds: string[];

  // Pagination
  limit: number;
  offset: number;

  /*
   * Tracking for API response transparency.
   * Returned to callers so they can see what was actually applied.
   */
  appliedFilters: AppliedFilter[]; // Hard constraints that exclude candidates (WHERE clauses)
  appliedPreferences: AppliedPreference[]; // Soft boosts for ranking (utility scoring)
  defaultsApplied: string[]; // Field names where defaults were used

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

  /*
   * Inference engine outputs (Section 5.2.1 - Iterative Expansion).
   */

  /** Derived constraints from inference engine */
  derivedConstraints: DerivedConstraint[];

  /** Skills that MUST be matched (from filter rules) */
  derivedRequiredSkillIds: string[];

  /**
   * Aggregated skill boosts (from boost rules).
   * Note: Map is used internally for O(1) lookup during utility calculation.
   * This is NOT serialized to API response - see search.service.ts for
   * how derivedConstraints are transformed to plain objects for the response.
   */
  derivedSkillBoosts: Map<string, number>;
}

interface ExpansionContext {
  filters: AppliedFilter[];
  preferences: AppliedPreference[];
  defaults: string[];
}

type KnowledgeBaseConfig = typeof knowledgeBaseConfig;

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Expands a search request into database-level constraints.
 * Now async to support the inference engine.
 */
export async function expandSearchCriteria(
  request: SearchFilterRequest
): Promise<ExpandedSearchCriteria> {
  const config = knowledgeBaseConfig;

  // Expand each constraint type
  const seniority = expandSeniorityToYearsExperience(
    request.requiredSeniorityLevel,
    config
  );
  const timeline = expandStartTimelineConstraint(
    request.requiredMaxStartTime,
    config
  );
  const timezone = expandTimezoneToPrefixes(request.requiredTimezone);
  const budget = expandBudgetConstraints(
    request.maxBudget,
    request.stretchBudget
  );
  const teamFocus = expandTeamFocusToAlignedSkills(request.teamFocus, config);
  const pagination = expandPaginationConstraints(
    request.limit,
    request.offset,
    config
  );

  // Track skills and preferred values
  const skillsContext = trackSkillsAsConstraints(
    request.requiredSkills,
    request.preferredSkills
  );
  const preferredContext = trackPreferredValuesAsPreferences(request);

  // ============================================
  // INFERENCE ENGINE - Iterative Expansion (Section 5.2.1)
  // ============================================
  const inferenceResult = await runInference(request);

  // Track inference constraints for transparency
  const inferenceContext: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  for (const derivedConstraint of inferenceResult.derivedConstraints) {
    if (isFullyOverridden(derivedConstraint)) continue;

    if (isFilterConstraint(derivedConstraint)) {
      inferenceContext.filters.push({
        field: derivedConstraint.action.targetField,
        operator: "IN",
        value: JSON.stringify(derivedConstraint.action.targetValue),
        source: "inference",
      });
    } else {
      inferenceContext.preferences.push({
        field: derivedConstraint.action.targetField,
        value: JSON.stringify(derivedConstraint.action.targetValue),
        source: "inference",
      });
    }
  }

  // Concatenate all contexts
  const concatenated = concatenateContexts(
    seniority.context,
    timeline.context,
    timezone.context,
    budget.context,
    teamFocus.context,
    pagination.context,
    skillsContext,
    preferredContext,
    inferenceContext
  );

  return {
    minYearsExperience: seniority.minYears,
    maxYearsExperience: seniority.maxYears,
    startTimeline: timeline.startTimeline,
    timezonePrefixes: timezone.timezonePrefixes,
    maxBudget: budget.maxBudget,
    stretchBudget: budget.stretchBudget,
    alignedSkillIds: teamFocus.alignedSkillIds,
    limit: pagination.limit,
    offset: pagination.offset,
    appliedFilters: concatenated.filters,
    appliedPreferences: concatenated.preferences,
    defaultsApplied: concatenated.defaults,
    // Pass-through preferred/required values for utility calculation
    preferredSeniorityLevel: request.preferredSeniorityLevel ?? null,
    preferredMaxStartTime: request.preferredMaxStartTime ?? null,
    requiredMaxStartTime: timeline.requiredMaxStartTime,
    preferredTimezone: request.preferredTimezone ?? [],
    // Inference engine outputs
    derivedConstraints: inferenceResult.derivedConstraints,
    derivedRequiredSkillIds: inferenceResult.derivedRequiredSkillIds,
    derivedSkillBoosts: inferenceResult.derivedSkillBoosts,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function expandSeniorityToYearsExperience(
  seniorityLevel: SeniorityLevel | undefined,
  config: KnowledgeBaseConfig
): {
  minYears: number | null;
  maxYears: number | null;
  context: ExpansionContext;
} {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  if (!seniorityLevel) {
    return { minYears: null, maxYears: null, context };
  }

  const mapping = config.seniorityMapping[seniorityLevel];
  const minYears = mapping.minYears;
  const maxYears = mapping.maxYears;

  const valueStr =
    maxYears !== null ? `${minYears} AND ${maxYears}` : `>= ${minYears}`;

  context.filters.push({
    field: "yearsExperience",
    operator: maxYears !== null ? "BETWEEN" : ">=",
    value: valueStr,
    source: "knowledge_base",
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
): {
  startTimeline: StartTimeline[];
  requiredMaxStartTime: StartTimeline;
  context: ExpansionContext;
} {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  const threshold =
    requiredMaxStartTime || config.defaults.requiredMaxStartTime;
  if (!requiredMaxStartTime) {
    context.defaults.push("requiredMaxStartTime");
  }

  // Convert threshold to array: all values up to and including the threshold
  const thresholdIndex = START_TIMELINE_ORDER.indexOf(threshold);
  const allowedTimelines = START_TIMELINE_ORDER.slice(0, thresholdIndex + 1);

  context.filters.push({
    field: "startTimeline",
    operator: "IN",
    value: JSON.stringify(allowedTimelines),
    source: requiredMaxStartTime ? "user" : "knowledge_base",
  });

  return {
    startTimeline: allowedTimelines,
    requiredMaxStartTime: threshold,
    context,
  };
}

function expandTimezoneToPrefixes(requiredTimezone: string[] | undefined): {
  timezonePrefixes: string[];
  context: ExpansionContext;
} {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  if (!requiredTimezone || requiredTimezone.length === 0) {
    return { timezonePrefixes: [], context };
  }

  /*
   * Convert glob patterns to prefixes for STARTS WITH matching.
   * Example: ["America/*", "Europe/London"] → ["America/", "Europe/London"]
   */
  const timezonePrefixes = requiredTimezone.map((tz) => tz.replace(/\*$/, ""));

  context.filters.push({
    field: "timezone",
    operator: "STARTS WITH (any of)",
    value: JSON.stringify(requiredTimezone),
    source: "user",
  });

  return { timezonePrefixes, context };
}

/**
 * Expands budget constraints into filter criteria.
 *
 * The hard filter ceiling is stretchBudget if set, otherwise maxBudget.
 * Engineers with salary > ceiling are excluded from results.
 */
function expandBudgetConstraints(
  maxBudget: number | undefined,
  stretchBudget: number | undefined
): {
  maxBudget: number | null;
  stretchBudget: number | null;
  context: ExpansionContext;
} {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  const maxBudgetValue = maxBudget ?? null;
  const stretchBudgetValue = stretchBudget ?? null;

  // Hard filter at the ceiling (stretchBudget if set, otherwise maxBudget)
  const filterCeiling = stretchBudgetValue ?? maxBudgetValue;

  if (filterCeiling !== null) {
    context.filters.push({
      field: "salary",
      operator: "<=",
      value: filterCeiling.toString(),
      source: "user",
    });
  }

  return {
    maxBudget: maxBudgetValue,
    stretchBudget: stretchBudgetValue,
    context,
  };
}

function expandTeamFocusToAlignedSkills(
  teamFocus: TeamFocus | undefined,
  config: KnowledgeBaseConfig
): { alignedSkillIds: string[]; context: ExpansionContext } {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  if (!teamFocus) {
    return { alignedSkillIds: [], context };
  }

  const alignment = config.teamFocusSkillAlignment[teamFocus];
  const alignedSkillIds = alignment.alignedSkillIds;

  context.preferences.push({
    field: "teamFocusMatch",
    value: alignedSkillIds.join(", "),
    source: "knowledge_base",
  });

  return { alignedSkillIds, context };
}

function expandPaginationConstraints(
  requestLimit: number | undefined,
  requestOffset: number | undefined,
  config: KnowledgeBaseConfig
): { limit: number; offset: number; context: ExpansionContext } {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  const limit = Math.min(requestLimit ?? config.defaults.limit, 100);
  const offset = requestOffset ?? config.defaults.offset;

  if (!requestLimit) {
    context.defaults.push("limit");
  }
  if (!requestOffset) {
    context.defaults.push("offset");
  }

  return { limit, offset, context };
}

function formatSkillSummary(
  skill: SkillRequirement,
  includeMinProficiency: boolean
): string {
  const parts = [skill.skill];
  if (includeMinProficiency && skill.minProficiency)
    parts.push(`min:${skill.minProficiency}`);
  if (skill.preferredMinProficiency)
    parts.push(`pref:${skill.preferredMinProficiency}`);
  return parts.join("|");
}

function trackSkillsAsConstraints(
  requiredSkills: SkillRequirement[] | undefined,
  preferredSkills: SkillRequirement[] | undefined
): ExpansionContext {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  if (requiredSkills?.length) {
    const skillSummary = requiredSkills.map((s) => formatSkillSummary(s, true));
    context.filters.push({
      field: "requiredSkills",
      operator: "IN",
      value: JSON.stringify(skillSummary),
      source: "user",
    });
  }

  if (preferredSkills?.length) {
    const skillSummary = preferredSkills.map((s) =>
      formatSkillSummary(s, false)
    );
    context.preferences.push({
      field: "preferredSkills",
      value: JSON.stringify(skillSummary),
      source: "user",
    });
  }

  return context;
}

function trackPreferredValuesAsPreferences(
  request: SearchFilterRequest
): ExpansionContext {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  if (request.preferredSeniorityLevel) {
    context.preferences.push({
      field: "preferredSeniorityLevel",
      value: request.preferredSeniorityLevel,
      source: "user",
    });
  }

  if (request.preferredMaxStartTime) {
    context.preferences.push({
      field: "preferredMaxStartTime",
      value: request.preferredMaxStartTime,
      source: "user",
    });
  }

  if (request.preferredTimezone && request.preferredTimezone.length > 0) {
    context.preferences.push({
      field: "preferredTimezone",
      value: JSON.stringify(request.preferredTimezone),
      source: "user",
    });
  }

  return context;
}

function concatenateContexts(
  ...contexts: ExpansionContext[]
): ExpansionContext {
  return {
    filters: contexts.flatMap((c) => c.filters),
    preferences: contexts.flatMap((c) => c.preferences),
    defaults: contexts.flatMap((c) => c.defaults),
  };
}
