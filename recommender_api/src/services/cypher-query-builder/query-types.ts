/**
 * Type definitions for Cypher query building.
 */

import type {
  ProficiencyLevel,
  AvailabilityOption,
} from "../../types/search.types.js";

export interface CypherQueryParams {
  targetSkillIds: string[] | null;
  skillIdentifiers: string[] | null;
  availability: AvailabilityOption[];
  minYearsExperience: number;
  maxYearsExperience: number | null;
  minConfidenceScore: number;
  allowedProficiencyLevels: ProficiencyLevel[];
  timezonePrefix: string | null;
  maxSalary: number | null;
  minSalary: number | null;
  offset: number;
  limit: number;
  requiredDomainIds?: string[];
  preferredDomainIds?: string[];
}

export interface CypherQuery {
  query: string;
  params: Record<string, unknown>;
}

export interface EngineerConditionsResult {
  conditions: string[];
  queryParams: Record<string, unknown>;
}
