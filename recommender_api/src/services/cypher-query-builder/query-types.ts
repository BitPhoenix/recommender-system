/**
 * Type definitions for Cypher query building.
 */

import type {
  StartTimeline,
} from "../../types/search.types.js";

/**
 * Skill IDs grouped by their minimum proficiency requirement.
 * Used for filtering engineers by per-skill proficiency levels.
 */
export interface SkillProficiencyGroups {
  learningLevelSkillIds: string[];
  proficientLevelSkillIds: string[];
  expertLevelSkillIds: string[];
}

export interface CypherQueryParams extends SkillProficiencyGroups {
  /*
   * Original skill identifiers from the user's request (before hierarchy expansion).
   * Used to classify each matched skill as "direct" or "descendant" in the response.
   *
   * Example: User requests "JavaScript". We expand to ["JavaScript", "React", "Vue"].
   * When an engineer matches on React:
   *   - "React" is NOT in originalSkillIdentifiers → matchType: "descendant"
   *   - "JavaScript" IS in originalSkillIdentifiers → matchType: "direct"
   */
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
