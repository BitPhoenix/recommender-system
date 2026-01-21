/**
 * Type definitions for Cypher query building.
 */

import type {
  SkillFilterType,
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

/**
 * A skill filter group represents one user-requested skill and all skills
 * that satisfy it (the original + descendants).
 *
 * Each group is filtered with HAS_ANY semantics: engineer must have at least
 * one skill from the requirement's set. Multiple requirements are ANDed together.
 *
 * Example: User requests ["Node.js", "TypeScript"]
 * - Requirement 1: originalSkillId = node, expandedSkillIds = [node, express, nestjs]
 * - Requirement 2: originalSkillId = typescript, expandedSkillIds = [typescript]
 * - Result: Engineer must have (node OR express OR nestjs at proficient+)
 *           AND (typescript at any level)
 */
export interface SkillFilterRequirement {
  /** The original skill ID requested by the user (for matchType='direct' classification) */
  originalSkillId: string | null;
  /** All skill IDs that satisfy this requirement (original + descendants via CHILD_OF) */
  expandedSkillIds: string[];
  /** Minimum proficiency level for this requirement */
  minProficiency: string;
  /** Preferred proficiency for ranking boost (optional) */
  preferredMinProficiency?: string | null;
  /**
   * Determines how the skill constraint is evaluated:
   * - 'user': proficiency-qualified check (must meet minProficiency)
   * - 'derived': existence-only check (any proficiency level qualifies, from inference rules)
   */
  type: SkillFilterType;
}

export interface CypherQueryParams extends SkillProficiencyGroups {
  /**
   * Skill filter requirements for HAS_ANY semantics.
   * Each requirement represents one user-requested skill with its expanded candidates.
   * Engineer must match at least one skill from EACH requirement.
   *
   * This replaces the flat proficiency buckets for filtering purposes.
   * The flat buckets (learningLevelSkillIds etc.) are still used for proficiency checking.
   */
  skillFilterRequirements?: SkillFilterRequirement[];

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

  /*
   * Optional: exclude a specific engineer from results.
   *
   * USE CASE: Filter-similarity endpoint needs to find candidates similar to a
   * reference engineer. The reference should not appear in results.
   *
   * When provided, adds `e.id <> $excludeEngineerId` to WHERE clause.
   */
  excludeEngineerId?: string;

  /*
   * Optional: filter to a specific engineer.
   *
   * USE CASE: Explain endpoint needs to run the full search pipeline
   * (skill matching, scoring, constraint expansion) for a single engineer.
   *
   * When provided, adds `e.id = $engineerId` to WHERE clause.
   */
  engineerId?: string;

  // Basic engineer filters
  startTimeline: StartTimeline[];
  minYearsExperience: number | null;
  maxYearsExperience: number | null;
  timezoneZones: string[];
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
