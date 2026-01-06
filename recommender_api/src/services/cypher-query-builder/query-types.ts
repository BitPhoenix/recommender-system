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
  maxBudget: number | null;
  stretchBudget: number | null;

  // Pagination
  offset: number;
  limit: number;

  // Business Domain filtering (structured with years)
  requiredBusinessDomains?: ResolvedBusinessDomain[];
  preferredBusinessDomains?: ResolvedBusinessDomain[];

  // Technical Domain filtering (structured with hierarchy expansion)
  requiredTechnicalDomains?: ResolvedTechnicalDomain[];
  preferredTechnicalDomains?: ResolvedTechnicalDomain[];
}

/**
 * Resolved business domain with hierarchy expansion and years requirements.
 */
export interface ResolvedBusinessDomain {
  domainId: string;
  expandedDomainIds: string[];  // includes self + descendants via CHILD_OF
  minYears?: number;
  preferredMinYears?: number;
}

/**
 * Resolved technical domain with expanded domain IDs (includes ancestors via CHILD_OF
 * and children via ENCOMPASSES) for matching.
 */
export interface ResolvedTechnicalDomain {
  domainId: string;
  expandedDomainIds: string[];  // includes self + ancestors (for CHILD_OF) or children (for ENCOMPASSES)
  minYears?: number;
  preferredMinYears?: number;
}

export interface CypherQuery {
  query: string;
  params: Record<string, unknown>;
}

/**
 * Result from a collection clause builder.
 * Contains the Cypher clause and the fields it produces that need to be carried forward.
 */
export interface CollectionClauseResult {
  clause: string;
  carryForwardFields: string[];
}

export interface BasicEngineerFilters {
  conditions: string[];
  queryParams: Record<string, unknown>;
}
