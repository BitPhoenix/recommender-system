/**
 * Search Service
 * Main orchestration layer for the constraint-based search API.
 * Coordinates all services to fulfill search requests.
 */

import type { Session } from "neo4j-driver";
import type {
  SearchFilterRequest,
  SearchFilterResponse,
  EngineerMatch,
  MatchedSkill,
  UnmatchedRelatedSkill,
  ConstraintViolation,
  ProficiencyLevel,
  SkillRequirement,
  BusinessDomainMatch,
  TechnicalDomainMatch,
  TechnicalDomainMatchType,
} from "../types/search.types.js";
import { expandSearchCriteria } from "./constraint-expander.service.js";
import {
  resolveSkillRequirements,
  type ResolvedSkillWithProficiency,
} from "./skill-resolver.service.js";
import {
  resolveBusinessDomains,
  resolveTechnicalDomains,
} from "./domain-resolver.service.js";
import {
  buildSearchQuery,
  type CypherQueryParams,
  type SkillProficiencyGroups,
  type ResolvedTechnicalDomain,
  type ResolvedBusinessDomain,
} from "./cypher-query-builder/index.js";
import {
  scoreAndSortEngineers,
  type EngineerData,
  type UtilityContext,
} from "./utility-calculator.service.js";
import { knowledgeBaseConfig } from "../config/knowledge-base/index.js";

// Raw skill data from Cypher query (before splitting into matched/unmatched)
interface RawSkillData {
  skillId: string;
  skillName: string;
  proficiencyLevel: string;
  confidenceScore: number;
  yearsUsed: number;
  matchType: "direct" | "descendant" | "none";
  // This field only exists when skill filtering is active
  meetsProficiency?: boolean;
}

// Raw domain data from Cypher query
interface RawBusinessDomainMatch {
  domainId: string;
  domainName: string;
  years: number;
}

interface RawTechnicalDomainMatch {
  domainId: string;
  domainName: string;
  years: number;
  source: "explicit" | "inferred";
}

interface RawEngineerRecord {
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

// Context for computing meetsRequired/meetsPreferred flags on domain matches
interface DomainConstraintContext {
  requiredBusinessDomains: ResolvedBusinessDomain[];
  preferredBusinessDomains: ResolvedBusinessDomain[];
  requiredTechnicalDomains: ResolvedTechnicalDomain[];
  preferredTechnicalDomains: ResolvedTechnicalDomain[];
}

// Result of resolving both required and preferred skills
interface SkillResolutionResult {
  // From required skills (for query building)
  skillGroups: SkillProficiencyGroups;
  allRequestedSkillIds: string[]; // All skill IDs from skillGroups combined
  expandedSkillNames: string[];
  unresolvedSkills: string[];
  originalSkillIdentifiers: string[];
  // From preferred skills (for ranking)
  preferredSkillIds: string[];
  // Merged from both (for utility calculation)
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>;
}

/**
 * Executes a search filter request and returns ranked results.
 */
export async function executeSearch(
  session: Session,
  request: SearchFilterRequest
): Promise<SearchFilterResponse> {
  const startTime = Date.now();
  const config = knowledgeBaseConfig;

  // Step 1: Expand search criteria using knowledge base rules
  const expanded = expandSearchCriteria(request);

  // Step 2: Resolve all skill requirements (both required and preferred)
  const {
    skillGroups,
    allRequestedSkillIds,
    expandedSkillNames,
    unresolvedSkills,
    originalSkillIdentifiers,
    preferredSkillIds,
    skillIdToPreferredProficiency,
  } = await resolveAllSkills(
    session,
    request.requiredSkills,
    request.preferredSkills,
    config.defaults.defaultMinProficiency
  );

  // Step 2b: Resolve domain requirements using new domain model
  // Note: Must run sequentially - Neo4j sessions are not thread-safe for concurrent queries
  const requiredBusinessDomains = await resolveBusinessDomains(
    session,
    request.requiredBusinessDomains
  );
  const preferredBusinessDomains = await resolveBusinessDomains(
    session,
    request.preferredBusinessDomains
  );
  const requiredTechnicalDomains = await resolveTechnicalDomains(
    session,
    request.requiredTechnicalDomains
  );
  const preferredTechnicalDomains = await resolveTechnicalDomains(
    session,
    request.preferredTechnicalDomains
  );

  // Step 3: Build query parameters with per-skill proficiency buckets
  const queryParams: CypherQueryParams = {
    // Per-skill proficiency buckets
    learningLevelSkillIds: skillGroups.learningLevelSkillIds,
    proficientLevelSkillIds: skillGroups.proficientLevelSkillIds,
    expertLevelSkillIds: skillGroups.expertLevelSkillIds,
    originalSkillIdentifiers:
      originalSkillIdentifiers.length > 0 ? originalSkillIdentifiers : null,
    // Basic engineer filters
    startTimeline: expanded.startTimeline,
    minYearsExperience: expanded.minYearsExperience,
    maxYearsExperience: expanded.maxYearsExperience,
    timezonePrefixes: expanded.timezonePrefixes,
    maxSalary: expanded.maxSalary,
    minSalary: expanded.minSalary,
    offset: expanded.offset,
    limit: expanded.limit,
    // Domain filtering with new model
    requiredBusinessDomains:
      requiredBusinessDomains.length > 0 ? requiredBusinessDomains : undefined,
    preferredBusinessDomains:
      preferredBusinessDomains.length > 0
        ? preferredBusinessDomains
        : undefined,
    requiredTechnicalDomains:
      requiredTechnicalDomains.length > 0
        ? requiredTechnicalDomains
        : undefined,
    preferredTechnicalDomains:
      preferredTechnicalDomains.length > 0
        ? preferredTechnicalDomains
        : undefined,
  };

  // Step 4: Execute main query (unified for skill-filtered and unfiltered search)
  const mainQuery = buildSearchQuery(queryParams);

  // Run main query (now includes totalCount computed before pagination)
  const mainResult = await session.run(mainQuery.query, mainQuery.params);

  // Step 5: Process results
  // Determine search mode from what user specified (not derived data).
  // parseEngineerFromRecord needs these flags to decide how to populate skill arrays:
  // - skill constraints specified → categorize skills as matched/unmatched by constraint
  // - teamFocus only → filter to team-aligned skills (no constraint categorization)
  // - neither → return empty skill arrays (unfiltered search doesn't show skills)
  const hasSkillConstraints =
    (request.requiredSkills?.length ?? 0) > 0 ||
    (request.preferredSkills?.length ?? 0) > 0;
  const hasTeamFocus = request.teamFocus !== undefined;
  const isTeamFocusOnlyMode = !hasSkillConstraints && hasTeamFocus;
  const shouldClearSkills = !hasSkillConstraints && !hasTeamFocus;

  const parseOptions = {
    shouldClearSkills,
    isTeamFocusOnlyMode,
    alignedSkillIds: expanded.alignedSkillIds,
  };

  // Build domain context for flag computation
  const domainContext: DomainConstraintContext = {
    requiredBusinessDomains,
    preferredBusinessDomains,
    requiredTechnicalDomains,
    preferredTechnicalDomains,
  };

  const rawEngineers: RawEngineerRecord[] = mainResult.records.map((record) =>
    parseEngineerFromRecord(record, parseOptions, domainContext)
  );

  // Extract totalCount from first record (all records have same value from early count step)
  const totalCount =
    mainResult.records.length > 0
      ? toNumber(mainResult.records[0].get("totalCount"))
      : 0;

  // Step 6: Calculate utility scores and rank
  const utilityContext: UtilityContext = {
    requestedSkillIds: allRequestedSkillIds,
    preferredSkillIds,
    preferredBusinessDomains,
    preferredTechnicalDomains,
    alignedSkillIds: expanded.alignedSkillIds,
    maxSalaryBudget: expanded.maxSalary,
    // Pass through preferred/required values
    preferredSeniorityLevel: expanded.preferredSeniorityLevel,
    preferredMaxStartTime: expanded.preferredMaxStartTime,
    requiredMaxStartTime: expanded.requiredMaxStartTime,
    preferredTimezone: expanded.preferredTimezone,
    preferredSalaryRange: expanded.preferredSalaryRange,
    // Per-skill preferred proficiencies for ranking boost
    skillIdToPreferredProficiency,
  };

  const engineerData: EngineerData[] = rawEngineers.map((raw) => ({
    id: raw.id,
    name: raw.name,
    headline: raw.headline,
    salary: raw.salary,
    yearsExperience: raw.yearsExperience,
    startTimeline: raw.startTimeline,
    timezone: raw.timezone,
    matchedSkills: raw.matchedSkills,
    unmatchedRelatedSkills: raw.unmatchedRelatedSkills,
    avgConfidence: raw.avgConfidence,
    matchedBusinessDomains: raw.matchedBusinessDomains,
    matchedTechnicalDomains: raw.matchedTechnicalDomains,
  }));

  const scoredEngineers = scoreAndSortEngineers(engineerData, utilityContext);

  // Step 7: Format response
  const matches: EngineerMatch[] = scoredEngineers.map((eng) => ({
    id: eng.id,
    name: eng.name,
    headline: eng.headline,
    salary: eng.salary,
    yearsExperience: eng.yearsExperience,
    startTimeline: eng.startTimeline,
    timezone: eng.timezone,
    matchedSkills: eng.matchedSkills,
    unmatchedRelatedSkills: eng.unmatchedRelatedSkills,
    matchedBusinessDomains: eng.matchedBusinessDomains,
    matchedTechnicalDomains: eng.matchedTechnicalDomains,
    utilityScore: eng.utilityScore,
    scoreBreakdown: eng.scoreBreakdown,
  }));

  const executionTimeMs = Date.now() - startTime;

  return {
    matches,
    totalCount,
    appliedFilters: expanded.appliedFilters,
    appliedPreferences: expanded.appliedPreferences,
    queryMetadata: {
      executionTimeMs,
      skillsExpanded: expandedSkillNames,
      defaultsApplied: expanded.defaultsApplied,
      unresolvedSkills,
    },
  };
}

/**
 * Groups resolved skills by their minProficiency level for efficient query filtering.
 * Returns three arrays: skills requiring 'learning', 'proficient', or 'expert' minimum.
 */
function groupSkillsByProficiency(
  resolvedSkills: ResolvedSkillWithProficiency[]
): SkillProficiencyGroups {
  const learningLevelSkillIds: string[] = [];
  const proficientLevelSkillIds: string[] = [];
  const expertLevelSkillIds: string[] = [];

  for (const skill of resolvedSkills) {
    switch (skill.minProficiency) {
      case "learning":
        learningLevelSkillIds.push(skill.skillId);
        break;
      case "proficient":
        proficientLevelSkillIds.push(skill.skillId);
        break;
      case "expert":
        expertLevelSkillIds.push(skill.skillId);
        break;
    }
  }

  return {
    learningLevelSkillIds,
    proficientLevelSkillIds,
    expertLevelSkillIds,
  };
}

/**
 * Converts Neo4j integer values to JavaScript numbers.
 */
function toNumber(value: unknown): number {
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

/**
 * Resolves both required and preferred skills, returning all data needed for query building and ranking.
 */
async function resolveAllSkills(
  session: Session,
  requiredSkills: SkillRequirement[] | undefined,
  preferredSkills: SkillRequirement[] | undefined,
  defaultProficiency: ProficiencyLevel
): Promise<SkillResolutionResult> {
  // Defaults for when no skills are provided
  let skillGroups: SkillProficiencyGroups = {
    learningLevelSkillIds: [],
    proficientLevelSkillIds: [],
    expertLevelSkillIds: [],
  };
  let expandedSkillNames: string[] = [];
  let unresolvedSkills: string[] = [];
  let originalSkillIdentifiers: string[] = [];
  let preferredSkillIds: string[] = [];
  const skillIdToPreferredProficiency = new Map<string, ProficiencyLevel>();

  // Resolve required skills
  if (requiredSkills && requiredSkills.length > 0) {
    const result = await resolveSkillRequirements(
      session,
      requiredSkills,
      defaultProficiency
    );
    skillGroups = groupSkillsByProficiency(result.resolvedSkills);
    expandedSkillNames = result.expandedSkillNames;
    unresolvedSkills = result.unresolvedIdentifiers;
    originalSkillIdentifiers = result.originalIdentifiers;

    // Add preferred proficiencies from required skills
    for (const skill of result.resolvedSkills) {
      if (skill.preferredMinProficiency) {
        skillIdToPreferredProficiency.set(
          skill.skillId,
          skill.preferredMinProficiency
        );
      }
    }
  }

  // Resolve preferred skills
  if (preferredSkills && preferredSkills.length > 0) {
    const result = await resolveSkillRequirements(
      session,
      preferredSkills,
      defaultProficiency
    );
    preferredSkillIds = result.resolvedSkills.map((s) => s.skillId);

    // Add preferred proficiencies (don't override existing from required)
    for (const skill of result.resolvedSkills) {
      if (
        skill.preferredMinProficiency &&
        !skillIdToPreferredProficiency.has(skill.skillId)
      ) {
        skillIdToPreferredProficiency.set(
          skill.skillId,
          skill.preferredMinProficiency
        );
      }
    }
  }

  const allRequestedSkillIds = [
    ...skillGroups.learningLevelSkillIds,
    ...skillGroups.proficientLevelSkillIds,
    ...skillGroups.expertLevelSkillIds,
  ];

  return {
    skillGroups,
    allRequestedSkillIds,
    expandedSkillNames,
    unresolvedSkills,
    originalSkillIdentifiers,
    preferredSkillIds,
    skillIdToPreferredProficiency,
  };
}

/**
 * Parses a Neo4j record into a RawEngineerRecord.
 * Handles skill categorization based on search mode.
 */
function parseEngineerFromRecord(
  record: { get: (key: string) => unknown },
  options: {
    shouldClearSkills: boolean;
    isTeamFocusOnlyMode: boolean;
    alignedSkillIds: string[];
  },
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
function parseDomainMatches<T, R extends { domainId: unknown }>(
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
