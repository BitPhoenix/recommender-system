/**
 * Type definitions for Cypher query building.
 */

import type {
  StartTimeline,
} from "../../types/search.types.js";

export interface CypherQueryParams {
  // Per-skill proficiency buckets: skill IDs grouped by their minimum proficiency requirement
  learningLevelSkillIds: string[];
  proficientLevelSkillIds: string[];
  expertLevelSkillIds: string[];

  // Original skill identifiers from the request (for matchType classification)
  originalSkillIdentifiers: string[] | null;

  // Basic engineer filters
  startTimeline: StartTimeline[];
  minYearsExperience: number | null;
  maxYearsExperience: number | null;
  timezonePrefixes: string[];
  maxSalary: number | null;
  minSalary: number | null;

  // Pagination
  offset: number;
  limit: number;

  // Domain filtering
  requiredDomainIds?: string[];
  preferredDomainIds?: string[];
}

export interface CypherQuery {
  query: string;
  params: Record<string, unknown>;
}

export interface BasicEngineerFilters {
  conditions: string[];
  queryParams: Record<string, unknown>;
}
