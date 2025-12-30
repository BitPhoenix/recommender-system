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
} from '../types/search.types.js';
import { knowledgeBaseConfig } from '../config/knowledge-base.config.js';

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

  // Team focus bonus skills
  bonusSkillIds: string[];

  // Pagination
  limit: number;
  offset: number;

  // Tracking
  appliedConstraints: AppliedConstraint[];
  defaultsApplied: string[];
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

  if (request.seniorityLevel) {
    const mapping = config.seniorityMapping[request.seniorityLevel];
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
  const riskTolerance = request.riskTolerance || config.defaults.riskTolerance;
  if (!request.riskTolerance) {
    defaultsApplied.push('riskTolerance');
  }

  const confidenceMapping = config.riskToleranceMapping[riskTolerance];
  const minConfidenceScore = confidenceMapping.minConfidenceScore;

  appliedConstraints.push({
    field: 'confidenceScore',
    operator: '>=',
    value: minConfidenceScore.toFixed(2),
    source: request.riskTolerance ? 'user' : 'knowledge_base',
  });

  // ============================================
  // MIN PROFICIENCY -> ALLOWED LEVELS
  // ============================================
  const minProficiency = request.minProficiency || config.defaults.minProficiency;
  if (!request.minProficiency) {
    defaultsApplied.push('minProficiency');
  }

  const allowedProficiencyLevels = config.proficiencyMapping[minProficiency];

  appliedConstraints.push({
    field: 'proficiencyLevel',
    operator: 'IN',
    value: JSON.stringify(allowedProficiencyLevels),
    source: request.minProficiency ? 'user' : 'knowledge_base',
  });

  // ============================================
  // AVAILABILITY
  // ============================================
  const availability = request.availability || config.defaults.availability;
  if (!request.availability) {
    defaultsApplied.push('availability');
  }

  appliedConstraints.push({
    field: 'availability',
    operator: 'IN',
    value: JSON.stringify(availability),
    source: request.availability ? 'user' : 'knowledge_base',
  });

  // ============================================
  // TIMEZONE
  // ============================================
  let timezonePrefix: string | null = null;

  if (request.timezone) {
    // Convert glob pattern to prefix for STARTS WITH
    // "America/*" -> "America/"
    timezonePrefix = request.timezone.replace(/\*$/, '');

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
  const maxSalary = request.maxSalary ?? null;
  const minSalary = request.minSalary ?? null;

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
  // TEAM FOCUS -> BONUS SKILLS
  // ============================================
  let bonusSkillIds: string[] = [];

  if (request.teamFocus) {
    const bonus = config.teamFocusBonusMapping[request.teamFocus];
    bonusSkillIds = bonus.bonusSkillIds;

    appliedConstraints.push({
      field: 'teamFocusBonus',
      operator: 'BOOST',
      value: bonusSkillIds.join(', '),
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

  return {
    minYearsExperience,
    maxYearsExperience,
    minConfidenceScore,
    allowedProficiencyLevels,
    availability,
    timezonePrefix,
    maxSalary,
    minSalary,
    bonusSkillIds,
    limit,
    offset,
    appliedConstraints,
    defaultsApplied,
  };
}
