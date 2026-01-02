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
} from "../types/search.types.js";
import { expandSearchCriteria } from "./constraint-expander.service.js";
import { resolveAllSkills } from "./skill-resolution.service.js";
import {
  resolveBusinessDomains,
  resolveTechnicalDomains,
} from "./domain-resolver.service.js";
import {
  buildSearchQuery,
  type CypherQueryParams,
  type ResolvedTechnicalDomain,
  type ResolvedBusinessDomain,
} from "./cypher-query-builder/index.js";
import {
  scoreAndSortEngineers,
  type EngineerData,
  type UtilityContext,
} from "./utility-calculator.service.js";
import { knowledgeBaseConfig } from "../config/knowledge-base/index.js";
import {
  parseEngineerFromRecord,
  toNumber,
  type RawEngineerRecord,
  type DomainConstraintContext,
  type ParseOptions,
} from "./engineer-record-parser.js";

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

  const parseOptions: ParseOptions = {
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
