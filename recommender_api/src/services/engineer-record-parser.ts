/**
 * Engineer Record Parser
 * Parses raw Neo4j query results into typed domain objects.
 */

import type {
  MatchedSkill,
  UnmatchedRelatedSkill,
  ConstraintViolation,
  BusinessDomainMatch,
  TechnicalDomainMatch,
  TechnicalDomainMatchType,
} from "../types/search.types.js";
import type { ResolvedBusinessDomain, ResolvedTechnicalDomain } from "./cypher-query-builder/index.js";

// ============================================================================
// Internal Types - Raw data structures from Cypher query results
// ============================================================================

/** Raw skill data from Cypher query (before splitting into matched/unmatched) */
export interface RawSkillData {
  skillId: string;
  skillName: string;
  proficiencyLevel: string;
  confidenceScore: number;
  yearsUsed: number;
  matchType: "direct" | "descendant" | "none";
  /** This field only exists when skill filtering is active */
  meetsProficiency?: boolean;
}

/** Raw business domain data from Cypher query */
interface RawBusinessDomainMatch {
  domainId: string;
  domainName: string;
  years: number;
}

/** Raw technical domain data from Cypher query */
interface RawTechnicalDomainMatch {
  domainId: string;
  domainName: string;
  years: number;
  source: "explicit" | "inferred";
}

/** Parsed engineer record before utility scoring */
export interface RawEngineerRecord {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  startTimeline: string;
  timezone: string;
  matchedSkills: MatchedSkill[];
  unmatchedRelatedSkills: UnmatchedRelatedSkill[];
  matchedSkillCount: number;
  avgConfidence: number;
  matchedBusinessDomains: BusinessDomainMatch[];
  matchedTechnicalDomains: TechnicalDomainMatch[];
}

/** Context for computing meetsRequired/meetsPreferred flags on domain matches */
export interface DomainConstraintContext {
  requiredBusinessDomains: ResolvedBusinessDomain[];
  preferredBusinessDomains: ResolvedBusinessDomain[];
  requiredTechnicalDomains: ResolvedTechnicalDomain[];
  preferredTechnicalDomains: ResolvedTechnicalDomain[];
}

/** Options for controlling skill parsing behavior */
export interface ParseOptions {
  shouldClearSkills: boolean;
  isTeamFocusOnlyMode: boolean;
  alignedSkillIds: string[];
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Converts Neo4j integer values to JavaScript numbers.
 */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  // Handle Neo4j Integer type
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}

/**
 * Parses a Neo4j record into a RawEngineerRecord.
 * Handles skill categorization based on search mode.
 */
export function parseEngineerFromRecord(
  record: { get: (key: string) => unknown },
  options: ParseOptions,
  domainContext: DomainConstraintContext
): RawEngineerRecord {
  const { shouldClearSkills, isTeamFocusOnlyMode, alignedSkillIds } = options;

  // Pre-flatten domain constraint IDs for efficient lookup
  const allRequiredBusinessDomainIds = new Set(
    domainContext.requiredBusinessDomains.flatMap((c) => c.expandedDomainIds)
  );
  const allPreferredBusinessDomainIds = new Set(
    domainContext.preferredBusinessDomains.flatMap((c) => c.expandedDomainIds)
  );
  const allRequiredTechnicalDomainIds = new Set(
    domainContext.requiredTechnicalDomains.flatMap((c) => c.expandedDomainIds)
  );
  const allPreferredTechnicalDomainIds = new Set(
    domainContext.preferredTechnicalDomains.flatMap((c) => c.expandedDomainIds)
  );

  let matchedSkills: MatchedSkill[] = [];
  let unmatchedRelatedSkills: UnmatchedRelatedSkill[] = [];

  if (!shouldClearSkills) {
    const allSkills = (record.get("allRelevantSkills") as RawSkillData[]) || [];

    if (isTeamFocusOnlyMode) {
      // Team-focus-only: no constraints to categorize, just filter to aligned skills
      matchedSkills = allSkills
        .filter((skill) => alignedSkillIds.includes(skill.skillId))
        .map((skill) => ({
          skillId: skill.skillId,
          skillName: skill.skillName,
          proficiencyLevel: skill.proficiencyLevel,
          confidenceScore: skill.confidenceScore,
          yearsUsed: skill.yearsUsed,
          matchType: skill.matchType,
        }));
      // unmatchedRelatedSkills stays empty - no constraint violations to report
    } else {
      // Skill-filtered mode: categorize by constraint checks
      const categorized = categorizeSkillsByConstraints(allSkills);
      matchedSkills = categorized.matchedSkills;
      unmatchedRelatedSkills = categorized.unmatchedRelatedSkills;
    }
  }

  // Extract matched domains with correct flag computation
  const matchedBusinessDomains = parseDomainMatches<
    BusinessDomainMatch,
    RawBusinessDomainMatch
  >(
    record.get("matchedBusinessDomains") as RawBusinessDomainMatch[] | null,
    (raw) => ({
      domainId: raw.domainId,
      domainName: raw.domainName,
      engineerYears: toNumber(raw.years),
      meetsRequired: allRequiredBusinessDomainIds.has(raw.domainId),
      meetsPreferred: allPreferredBusinessDomainIds.has(raw.domainId),
    })
  );

  const matchedTechnicalDomains = parseDomainMatches<
    TechnicalDomainMatch,
    RawTechnicalDomainMatch
  >(
    record.get("matchedTechnicalDomains") as RawTechnicalDomainMatch[] | null,
    (raw) => ({
      domainId: raw.domainId,
      domainName: raw.domainName,
      engineerYears: toNumber(raw.years),
      matchType: (raw.source === "inferred"
        ? "skill_inferred"
        : "direct") as TechnicalDomainMatchType,
      meetsRequired: allRequiredTechnicalDomainIds.has(raw.domainId),
      meetsPreferred: allPreferredTechnicalDomainIds.has(raw.domainId),
    })
  );

  return {
    id: record.get("id") as string,
    name: record.get("name") as string,
    headline: record.get("headline") as string,
    salary: toNumber(record.get("salary")),
    yearsExperience: toNumber(record.get("yearsExperience")),
    startTimeline: record.get("startTimeline") as string,
    timezone: record.get("timezone") as string,
    matchedSkills,
    unmatchedRelatedSkills,
    matchedSkillCount: shouldClearSkills
      ? 0
      : toNumber(record.get("matchedSkillCount")),
    avgConfidence: shouldClearSkills
      ? 0
      : toNumber(record.get("avgConfidence")),
    matchedBusinessDomains,
    matchedTechnicalDomains,
  };
}

/**
 * Parses raw domain match data from Cypher query results.
 * Filters out null values and objects with null domainId (from OPTIONAL MATCH).
 */
export function parseDomainMatches<T, R extends { domainId: unknown }>(
  rawDomains: R[] | null,
  mapper: (raw: R) => T
): T[] {
  if (!rawDomains) return [];
  return rawDomains
    .filter(
      (d): d is R => d !== null && typeof d === "object" && d.domainId !== null
    )
    .map(mapper);
}

/**
 * Categorizes raw skill data into matched and unmatched skills based on constraint checks.
 *
 * This separation exists because the API returns both categories to the client:
 * - matchedSkills: Skills that directly satisfy the search criteria (used for ranking)
 * - unmatchedRelatedSkills: Related skills shown as context to explain why an engineer
 *   appeared in results or what gaps exist
 *
 * Categorization rules:
 * - Direct matches passing all constraints → matchedSkills
 * - Descendants → unmatchedRelatedSkills (even if passing constraints). When a user
 *   specifies constraints like "TypeScript at expert level", we can only verify that
 *   against a direct TypeScript assessment—not infer it from a descendant skill.
 *   The descendant explains why the engineer appeared in results but isn't a confirmed match.
 * - Any skill with constraint violations → unmatchedRelatedSkills
 */
function categorizeSkillsByConstraints(allSkills: RawSkillData[]): {
  matchedSkills: MatchedSkill[];
  unmatchedRelatedSkills: UnmatchedRelatedSkill[];
} {
  const matchedSkills: MatchedSkill[] = [];
  const unmatchedRelatedSkills: UnmatchedRelatedSkill[] = [];

  for (const skill of allSkills) {
    const violations: ConstraintViolation[] = [];
    if (!skill.meetsProficiency) violations.push("proficiency_below_minimum");

    const isDirectMatchPassingConstraints =
      skill.matchType === "direct" && violations.length === 0;

    if (isDirectMatchPassingConstraints) {
      matchedSkills.push({
        skillId: skill.skillId,
        skillName: skill.skillName,
        proficiencyLevel: skill.proficiencyLevel,
        confidenceScore: skill.confidenceScore,
        yearsUsed: skill.yearsUsed,
        matchType: skill.matchType,
      });
    } else {
      // Descendants (even if passing constraints) and any skill with violations
      unmatchedRelatedSkills.push({
        skillId: skill.skillId,
        skillName: skill.skillName,
        proficiencyLevel: skill.proficiencyLevel,
        confidenceScore: skill.confidenceScore,
        yearsUsed: skill.yearsUsed,
        matchType: skill.matchType,
        constraintViolations: violations,
      });
    }
  }

  return { matchedSkills, unmatchedRelatedSkills };
}
