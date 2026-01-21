/**
 * Constraint Expander Service
 * Implements Section 5.2.1 - expanding user requirements into database constraints.
 *
 * This service translates manager language (seniorityLevel, teamFocus)
 * into concrete database constraints using the knowledge base rules.
 */

import type { Session } from "neo4j-driver";
import type {
  SearchFilterRequest,
  AppliedFilter,
  AppliedPreference,
  AppliedSkillFilter,
  AppliedSkillPreference,
  ResolvedSkillConstraint,
  StartTimeline,
  SeniorityLevel,
  TeamFocus,
} from "../types/search.types.js";
import {
  AppliedFilterType,
  AppliedPreferenceType,
} from "../types/search.types.js";
import type { ResolvedSkillRequirement } from "./skill-resolver.service.js";
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

  // Timezone zones (Eastern, Central, Mountain, Pacific)
  timezoneZones: string[];

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
  /** Original seniority constraint for tightening suggestions */
  requiredSeniorityLevel: SeniorityLevel | null;
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
 * Now async to support the inference engine and skill hierarchy expansion.
 *
 * @param session - Neo4j session for querying skill hierarchy
 * @param request - The search filter request from the API
 * @param resolvedRequiredSkillRequirements - Skill requirements for required skills (each is an independent HAS_ANY filter)
 * @param resolvedPreferredSkillRequirements - Skill requirements for preferred skills
 */
export async function expandSearchCriteria(
  session: Session,
  request: SearchFilterRequest,
  resolvedRequiredSkillRequirements: ResolvedSkillRequirement[],
  resolvedPreferredSkillRequirements: ResolvedSkillRequirement[]
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
  const timezone = expandTimezoneZones(request.requiredTimezone);
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

  // Track skills and preferred values (with resolved skill data for structured types)
  const skillsContext = trackSkillsAsConstraints(
    resolvedRequiredSkillRequirements,
    resolvedPreferredSkillRequirements
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
      const skillIds = derivedConstraint.action.targetValue as string[];

      /*
       * Expand each derived skill through hierarchy to enable descendant matching.
       * This fixes the inconsistency where user-requested skills got hierarchy expansion
       * but derived skills from inference rules did not.
       *
       * Example: inference rule derives "Node.js" requirement
       * → expand to [node, express, nestjs]
       * → engineer with Express matches (satisfies Node.js requirement)
       */
      for (const skillId of skillIds) {
        const expandedSkills = await expandSkillHierarchy(session, skillId);

        inferenceContext.filters.push({
          type: AppliedFilterType.Skill,
          field: 'derivedSkills',
          operator: 'HAS_ANY',
          skills: expandedSkills.map(s => ({ skillId: s.skillId, skillName: s.skillName })),
          displayValue: `Derived: ${derivedConstraint.rule.name}`,
          source: 'inference',
          ruleId: derivedConstraint.rule.id,
          originalSkillId: skillId,
        });
      }
    } else {
      inferenceContext.preferences.push({
        type: AppliedPreferenceType.Property,
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
    timezoneZones: timezone.timezoneZones,
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
    requiredSeniorityLevel: request.requiredSeniorityLevel ?? null,
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
    type: AppliedFilterType.Property,
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
    type: AppliedFilterType.Property,
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

function expandTimezoneZones(requiredTimezone: string[] | undefined): {
  timezoneZones: string[];
  context: ExpansionContext;
} {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  if (!requiredTimezone || requiredTimezone.length === 0) {
    return { timezoneZones: [], context };
  }

  // Timezone zones are stored directly (Eastern, Central, Mountain, Pacific)
  // No conversion needed - pass through as-is for IN matching
  const timezoneZones = requiredTimezone;

  context.filters.push({
    type: AppliedFilterType.Property,
    field: "timezone",
    operator: "IN",
    value: JSON.stringify(requiredTimezone),
    source: "user",
  });

  return { timezoneZones, context };
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
      type: AppliedFilterType.Property,
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
    type: AppliedPreferenceType.Property,
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

/**
 * Converts resolved skill requirements into AppliedFilter and AppliedPreference entries.
 *
 * Each skill requirement becomes a separate HAS_ANY filter. This enables descendant matching:
 * - User requests "Node.js"
 * - Resolver expands to requirement: { originalSkillId: "node", expandedSkillIds: ["node", "express", "nestjs"] }
 * - Filter: HAS_ANY of [node, express, nestjs]
 * - Engineer with Express (only) matches because Express is in expandedSkillIds
 *
 * Multiple requirements are ANDed: requesting ["Node.js", "TypeScript"] means engineer must have
 * (any Node.js descendant) AND (any TypeScript descendant).
 */
function trackSkillsAsConstraints(
  resolvedRequiredSkillRequirements: ResolvedSkillRequirement[],
  resolvedPreferredSkillRequirements: ResolvedSkillRequirement[]
): ExpansionContext {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  /*
   * Each skill requirement becomes a separate filter with HAS_ANY semantics.
   * The engineer must have at least one skill from each requirement's expanded set.
   */
  for (const requirement of resolvedRequiredSkillRequirements) {
    // Build the skill constraints for all match candidates
    const skills: ResolvedSkillConstraint[] = requirement.expandedSkillIds.map(skillId => ({
      skillId,
      skillName: requirement.skillIdToName.get(skillId) ?? skillId,
      minProficiency: requirement.minProficiency,
      preferredMinProficiency: requirement.preferredMinProficiency ?? undefined,
    }));

    const skillFilter: AppliedSkillFilter = {
      type: AppliedFilterType.Skill,
      field: 'requiredSkills',
      operator: 'HAS_ANY',
      skills,
      displayValue: requirement.originalIdentifier,
      source: 'user',
      // Track original skill for matchType classification
      originalSkillId: requirement.originalSkillId,
    };
    context.filters.push(skillFilter);
  }

  /*
   * Each preferred skill requirement becomes a separate preference.
   * This matches required skills pattern and enables accurate requirement counting.
   * Preferences boost ranking when engineers have matching skills.
   */
  for (const requirement of resolvedPreferredSkillRequirements) {
    const skills: ResolvedSkillConstraint[] = requirement.expandedSkillIds.map(skillId => ({
      skillId,
      skillName: requirement.skillIdToName.get(skillId) ?? skillId,
      minProficiency: requirement.minProficiency,
      preferredMinProficiency: requirement.preferredMinProficiency ?? undefined,
    }));

    const skillPreference: AppliedSkillPreference = {
      type: AppliedPreferenceType.Skill,
      field: 'preferredSkills',
      skills,
      displayValue: requirement.originalIdentifier,
      source: 'user',
    };
    context.preferences.push(skillPreference);
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
      type: AppliedPreferenceType.Property,
      field: "preferredSeniorityLevel",
      value: request.preferredSeniorityLevel,
      source: "user",
    });
  }

  if (request.preferredMaxStartTime) {
    context.preferences.push({
      type: AppliedPreferenceType.Property,
      field: "preferredMaxStartTime",
      value: request.preferredMaxStartTime,
      source: "user",
    });
  }

  if (request.preferredTimezone && request.preferredTimezone.length > 0) {
    context.preferences.push({
      type: AppliedPreferenceType.Property,
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

interface ExpandedSkill {
  skillId: string;
  skillName: string;
}

/**
 * Expands a skill ID to include all its descendants via CHILD_OF relationship.
 * This enables descendant matching for derived skills from inference rules.
 *
 * Example: "Node.js" → [{ skillId: "skill_nodejs", skillName: "Node.js" }, ...]
 *
 * Uses CHILD_OF*0.. to include the skill itself (depth 0) plus all descendants.
 * This matches the same traversal used by skill-resolver.service.ts for user skills.
 */
async function expandSkillHierarchy(session: Session, skillId: string): Promise<ExpandedSkill[]> {
  const result = await session.run(`
    MATCH (root:Skill {id: $skillId})
    OPTIONAL MATCH (descendant:Skill)-[:CHILD_OF*0..]->(root)
    WHERE descendant.isCategory = false
    RETURN COLLECT(DISTINCT { id: descendant.id, name: descendant.name }) AS descendants
  `, { skillId });

  const record = result.records[0];
  if (!record) {
    // Skill not found in graph - return original ID as fallback
    return [{ skillId, skillName: skillId }];
  }

  const descendants = record.get('descendants') as Array<{ id: string; name: string }> | null;
  if (!descendants || descendants.length === 0) {
    return [{ skillId, skillName: skillId }];
  }
  return descendants
    .filter(d => d.id !== null)
    .map(d => ({ skillId: d.id, skillName: d.name ?? d.id }));
}
