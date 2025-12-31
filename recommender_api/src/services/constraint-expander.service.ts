/**
 * Constraint Expander Service
 * Implements Section 5.2.1 - expanding user requirements into database constraints.
 *
 * This service translates manager language (seniorityLevel, teamFocus)
 * into concrete database constraints using the knowledge base rules.
 *
 * Note: Risk tolerance and global proficiency have been replaced by per-skill
 * proficiency requirements. Confidence score is now fixed at 0.70.
 */

import type {
  SearchFilterRequest,
  AppliedConstraint,
  AvailabilityOption,
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

  // Fixed confidence score (internalized from medium risk tolerance)
  minConfidenceScore: number;

  // Availability
  availability: AvailabilityOption[];

  // Timezone
  timezonePrefix: string | null;

  // Salary constraints
  maxSalary: number | null;
  minSalary: number | null;

  // Team focus aligned skills
  alignedSkillIds: string[];

  // Pagination
  limit: number;
  offset: number;

  // Tracking
  appliedConstraints: AppliedConstraint[];
  defaultsApplied: string[];

  // Pass-through preferred values for utility calculation
  preferredSeniorityLevel: SeniorityLevel | null;
  preferredAvailability: AvailabilityOption[];
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


function expandAvailabilityConstraint(
  requiredAvailability: AvailabilityOption[] | undefined,
  config: KnowledgeBaseConfig
): { availability: AvailabilityOption[]; context: ExpansionContext } {
  const context: ExpansionContext = { constraints: [], defaults: [] };

  const availability = requiredAvailability || config.defaults.requiredAvailability;
  if (!requiredAvailability) {
    context.defaults.push('requiredAvailability');
  }

  context.constraints.push({
    field: 'availability',
    operator: 'IN',
    value: JSON.stringify(availability),
    source: requiredAvailability ? 'user' : 'knowledge_base',
  });

  return { availability, context };
}

function expandTimezoneToPrefix(
  requiredTimezone: string | undefined
): { timezonePrefix: string | null; context: ExpansionContext } {
  const context: ExpansionContext = { constraints: [], defaults: [] };

  if (!requiredTimezone) {
    return { timezonePrefix: null, context };
  }

  // Convert glob pattern to prefix for STARTS WITH
  // "America/*" -> "America/"
  const timezonePrefix = requiredTimezone.replace(/\*$/, '');

  context.constraints.push({
    field: 'timezone',
    operator: 'STARTS WITH',
    value: timezonePrefix,
    source: 'user',
  });

  return { timezonePrefix, context };
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

  if (request.preferredAvailability && request.preferredAvailability.length > 0) {
    context.constraints.push({
      field: 'preferredAvailability',
      operator: 'BOOST',
      value: JSON.stringify(request.preferredAvailability),
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
  const availability = expandAvailabilityConstraint(request.requiredAvailability, config);
  const timezone = expandTimezoneToPrefix(request.requiredTimezone);
  const salary = expandSalaryConstraints(request.requiredMaxSalary, request.requiredMinSalary);
  const teamFocus = expandTeamFocusToAlignedSkills(request.teamFocus, config);
  const pagination = expandPaginationConstraints(request.limit, request.offset, config);

  // Fixed confidence score (internalized from medium risk tolerance)
  const minConfidenceScore = config.defaults.defaultMinConfidenceScore;
  const confidenceContext: ExpansionContext = {
    constraints: [{
      field: 'confidenceScore',
      operator: '>=',
      value: minConfidenceScore.toFixed(2),
      source: 'knowledge_base',
    }],
    defaults: [],
  };

  // Track skills and preferred values as constraints
  const skillsContext = trackSkillsAsConstraints(request.requiredSkills, request.preferredSkills);
  const preferredContext = trackPreferredValuesAsConstraints(request);

  // Merge all contexts
  const merged = mergeContexts(
    seniority.context,
    confidenceContext,
    availability.context,
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
    minConfidenceScore,
    availability: availability.availability,
    timezonePrefix: timezone.timezonePrefix,
    maxSalary: salary.maxSalary,
    minSalary: salary.minSalary,
    alignedSkillIds: teamFocus.alignedSkillIds,
    limit: pagination.limit,
    offset: pagination.offset,
    appliedConstraints: merged.constraints,
    defaultsApplied: merged.defaults,
    // Pass-through preferred values
    preferredSeniorityLevel: request.preferredSeniorityLevel ?? null,
    preferredAvailability: request.preferredAvailability ?? [],
    preferredTimezone: request.preferredTimezone ?? [],
    preferredSalaryRange: request.preferredSalaryRange ?? null,
  };
}
