/**
 * Constraint Expander Service
 * Implements Section 5.2.1 - expanding user requirements into database constraints.
 *
 * This service translates manager language (seniorityLevel, riskTolerance, teamFocus)
 * into concrete database constraints using the knowledge base rules.
 */

import type {
  SearchFilterRequest,
  AppliedConstraint,
  ProficiencyLevel,
  AvailabilityOption,
  SeniorityLevel,
} from '../types/search.types.js';
import { knowledgeBaseConfig } from '../config/knowledge-base/index.js';

export interface ExpandedConstraints {
  // Experience constraints
  minYearsExperience: number;
  maxYearsExperience: number | null;

  // Quality constraints
  minConfidenceScore: number;
  allowedProficiencyLevels: ProficiencyLevel[];

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

  // NEW: Pass-through preferred values for utility calculation
  preferredSeniorityLevel: SeniorityLevel | null;
  preferredAvailability: AvailabilityOption[];
  preferredTimezone: string[];
  preferredSalaryRange: { min: number; max: number } | null;
  preferredConfidenceScore: number | null;
  preferredProficiency: ProficiencyLevel | null;
}

/**
 * Expands a search request into database-level constraints.
 */
export function expandConstraints(request: SearchFilterRequest): ExpandedConstraints {
  const appliedConstraints: AppliedConstraint[] = [];
  const defaultsApplied: string[] = [];
  const config = knowledgeBaseConfig;

  // ============================================
  // SENIORITY LEVEL -> YEARS EXPERIENCE
  // ============================================
  let minYearsExperience = 0;
  let maxYearsExperience: number | null = null;

  if (request.requiredSeniorityLevel) {  // RENAMED
    const mapping = config.seniorityMapping[request.requiredSeniorityLevel];
    minYearsExperience = mapping.minYears;
    maxYearsExperience = mapping.maxYears;

    const valueStr = maxYearsExperience !== null
      ? `${minYearsExperience} AND ${maxYearsExperience}`
      : `>= ${minYearsExperience}`;

    appliedConstraints.push({
      field: 'yearsExperience',
      operator: maxYearsExperience !== null ? 'BETWEEN' : '>=',
      value: valueStr,
      source: 'knowledge_base',
    });
  }

  // ============================================
  // RISK TOLERANCE -> CONFIDENCE SCORE
  // ============================================
  const riskTolerance = request.requiredRiskTolerance || config.defaults.requiredRiskTolerance;  // RENAMED
  if (!request.requiredRiskTolerance) {
    defaultsApplied.push('requiredRiskTolerance');
  }

  const confidenceMapping = config.riskToleranceMapping[riskTolerance];
  const minConfidenceScore = confidenceMapping.minConfidenceScore;

  appliedConstraints.push({
    field: 'confidenceScore',
    operator: '>=',
    value: minConfidenceScore.toFixed(2),
    source: request.requiredRiskTolerance ? 'user' : 'knowledge_base',
  });

  // ============================================
  // MIN PROFICIENCY -> ALLOWED LEVELS
  // ============================================
  const minProficiency = request.requiredMinProficiency || config.defaults.requiredMinProficiency;  // RENAMED
  if (!request.requiredMinProficiency) {
    defaultsApplied.push('requiredMinProficiency');
  }

  const allowedProficiencyLevels = config.proficiencyMapping[minProficiency];

  appliedConstraints.push({
    field: 'proficiencyLevel',
    operator: 'IN',
    value: JSON.stringify(allowedProficiencyLevels),
    source: request.requiredMinProficiency ? 'user' : 'knowledge_base',
  });

  // ============================================
  // AVAILABILITY
  // ============================================
  const availability = request.requiredAvailability || config.defaults.requiredAvailability;  // RENAMED
  if (!request.requiredAvailability) {
    defaultsApplied.push('requiredAvailability');
  }

  appliedConstraints.push({
    field: 'availability',
    operator: 'IN',
    value: JSON.stringify(availability),
    source: request.requiredAvailability ? 'user' : 'knowledge_base',
  });

  // ============================================
  // TIMEZONE
  // ============================================
  let timezonePrefix: string | null = null;

  if (request.requiredTimezone) {  // RENAMED
    // Convert glob pattern to prefix for STARTS WITH
    // "America/*" -> "America/"
    timezonePrefix = request.requiredTimezone.replace(/\*$/, '');

    appliedConstraints.push({
      field: 'timezone',
      operator: 'STARTS WITH',
      value: timezonePrefix,
      source: 'user',
    });
  }

  // ============================================
  // SALARY CONSTRAINTS
  // ============================================
  const maxSalary = request.requiredMaxSalary ?? null;  // RENAMED
  const minSalary = request.requiredMinSalary ?? null;  // RENAMED

  if (maxSalary !== null) {
    appliedConstraints.push({
      field: 'salary',
      operator: '<=',
      value: maxSalary.toString(),
      source: 'user',
    });
  }

  if (minSalary !== null) {
    appliedConstraints.push({
      field: 'salary',
      operator: '>=',
      value: minSalary.toString(),
      source: 'user',
    });
  }

  // ============================================
  // TEAM FOCUS -> ALIGNED SKILLS
  // ============================================
  let alignedSkillIds: string[] = [];

  if (request.teamFocus) {
    const alignment = config.teamFocusSkillAlignment[request.teamFocus];
    alignedSkillIds = alignment.alignedSkillIds;

    appliedConstraints.push({
      field: 'teamFocusMatch',
      operator: 'BOOST',
      value: alignedSkillIds.join(', '),
      source: 'knowledge_base',
    });
  }

  // ============================================
  // PAGINATION
  // ============================================
  const limit = Math.min(request.limit ?? config.defaults.limit, 100);
  const offset = request.offset ?? config.defaults.offset;

  if (!request.limit) {
    defaultsApplied.push('limit');
  }
  if (!request.offset) {
    defaultsApplied.push('offset');
  }

  // ============================================
  // REQUIRED SKILLS (tracked as constraint)
  // ============================================
  if (request.requiredSkills && request.requiredSkills.length > 0) {
    appliedConstraints.push({
      field: 'requiredSkills',
      operator: 'IN',
      value: JSON.stringify(request.requiredSkills),
      source: 'user',
    });
  }

  // ============================================
  // PREFERRED SKILLS (tracked as constraint)
  // ============================================
  if (request.preferredSkills && request.preferredSkills.length > 0) {
    appliedConstraints.push({
      field: 'preferredSkills',
      operator: 'BOOST',
      value: JSON.stringify(request.preferredSkills),
      source: 'user',
    });
  }

  // ============================================
  // NEW: PREFERRED VALUES (pass-through for utility)
  // ============================================
  if (request.preferredSeniorityLevel) {
    appliedConstraints.push({
      field: 'preferredSeniorityLevel',
      operator: 'BOOST',
      value: request.preferredSeniorityLevel,
      source: 'user',
    });
  }

  if (request.preferredAvailability && request.preferredAvailability.length > 0) {
    appliedConstraints.push({
      field: 'preferredAvailability',
      operator: 'BOOST',
      value: JSON.stringify(request.preferredAvailability),
      source: 'user',
    });
  }

  if (request.preferredTimezone && request.preferredTimezone.length > 0) {
    appliedConstraints.push({
      field: 'preferredTimezone',
      operator: 'BOOST',
      value: JSON.stringify(request.preferredTimezone),
      source: 'user',
    });
  }

  if (request.preferredSalaryRange) {
    appliedConstraints.push({
      field: 'preferredSalaryRange',
      operator: 'BOOST',
      value: JSON.stringify(request.preferredSalaryRange),
      source: 'user',
    });
  }

  if (request.preferredConfidenceScore !== undefined) {
    appliedConstraints.push({
      field: 'preferredConfidenceScore',
      operator: 'BOOST',
      value: request.preferredConfidenceScore.toString(),
      source: 'user',
    });
  }

  if (request.preferredProficiency) {
    appliedConstraints.push({
      field: 'preferredProficiency',
      operator: 'BOOST',
      value: request.preferredProficiency,
      source: 'user',
    });
  }

  return {
    minYearsExperience,
    maxYearsExperience,
    minConfidenceScore,
    allowedProficiencyLevels,
    availability,
    timezonePrefix,
    maxSalary,
    minSalary,
    alignedSkillIds,
    limit,
    offset,
    appliedConstraints,
    defaultsApplied,
    // NEW: Pass-through preferred values
    preferredSeniorityLevel: request.preferredSeniorityLevel ?? null,
    preferredAvailability: request.preferredAvailability ?? [],
    preferredTimezone: request.preferredTimezone ?? [],
    preferredSalaryRange: request.preferredSalaryRange ?? null,
    preferredConfidenceScore: request.preferredConfidenceScore ?? null,
    preferredProficiency: request.preferredProficiency ?? null,
  };
}
