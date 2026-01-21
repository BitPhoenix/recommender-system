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
  AppliedSkillFilter,
} from "../types/search.types.js";
import {
  isSkillFilter,
  isDerivedSkillFilter,
  SkillFilterType,
} from "../types/search.types.js";
import { expandSearchCriteria } from "./constraint-expander.service.js";
import { resolveAllSkills } from "./skill-resolution.service.js";
import {
  resolveBusinessDomains,
  resolveTechnicalDomains,
} from "./domain-resolver.service.js";
import {
  buildSearchQuery,
  buildSearchCountQuery,
  type CypherQueryParams,
  type ResolvedTechnicalDomain,
  type ResolvedBusinessDomain,
  type SkillFilterRequirement,
} from "./cypher-query-builder/index.js";
import {
  scoreAndSortEngineers,
  type EngineerData,
  type UtilityContext,
} from "./utility-calculator/index.js";
import { knowledgeBaseConfig } from "../config/knowledge-base/index.js";
import {
  parseEngineerFromRecord,
  toNumber,
  type RawEngineerRecord,
  type DomainConstraintContext,
  type ParseOptions,
} from "./engineer-record-parser.js";
import { getConstraintAdvice } from "./constraint-advisor/index.js";

/**
 * Executes a search filter request and returns ranked results.
 */
export async function executeSearch(
  session: Session,
  request: SearchFilterRequest
): Promise<SearchFilterResponse> {
  const startTime = Date.now();
  const config = knowledgeBaseConfig;

  // Step 1: Resolve all skill requirements FIRST (needed for constraint expansion)
  const {
    skillGroups,
    resolvedRequiredSkillRequirements,
    resolvedPreferredSkillRequirements,
    requiredSkillIds,
    expandedSkillNames,
    unresolvedSkills,
    originalSkillIdentifiers,
    preferredSkillIds,
    skillIdToPreferredProficiency,
    resolvedRequiredSkills,
    resolvedPreferredSkills,
  } = await resolveAllSkills(
    session,
    request.requiredSkills,
    request.preferredSkills,
    config.defaults.defaultMinProficiency
  );

  // Step 2: Expand search criteria using knowledge base rules
  // Now receives resolved skill requirements for per-requirement HAS_ANY filtering
  const expanded = await expandSearchCriteria(
    session,
    request,
    resolvedRequiredSkillRequirements,
    resolvedPreferredSkillRequirements
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
  /*
   * Convert resolved skill requirements to query filter requirements.
   * Each requirement enables HAS_ANY semantics: engineer must have at least one skill
   * from each requirement's expanded set. This properly handles skill hierarchy expansion
   * where requesting "Node.js" should match engineers who have Express (descendant).
   */
  const userSkillFilterRequirements: SkillFilterRequirement[] = resolvedRequiredSkillRequirements.map(requirement => ({
    expandedSkillIds: requirement.expandedSkillIds,
    originalSkillId: requirement.originalSkillId,
    minProficiency: requirement.minProficiency,
    preferredMinProficiency: requirement.preferredMinProficiency,
    type: SkillFilterType.User,
  }));

  /*
   * Build skill filter requirements from derived skill filters (from inference rules).
   * These use existence-only checks - any proficiency level qualifies.
   * This unifies the skill filtering path: both user and derived skills go through
   * the same skillFilterRequirements mechanism in the query builder.
   */
  const derivedSkillFilters = expanded.appliedFilters.filter(
    (f): f is AppliedSkillFilter => isSkillFilter(f) && isDerivedSkillFilter(f)
  );
  const derivedSkillFilterRequirements: SkillFilterRequirement[] = derivedSkillFilters.map(filter => ({
    expandedSkillIds: filter.skills.map(s => s.skillId),
    originalSkillId: filter.originalSkillId ?? null,
    minProficiency: 'learning',  // Existence-only: any proficiency qualifies
    preferredMinProficiency: null,
    type: SkillFilterType.Derived,
  }));

  const skillFilterRequirements = [...userSkillFilterRequirements, ...derivedSkillFilterRequirements];

  const queryParams: CypherQueryParams = {
    // Per-skill proficiency buckets (for proficiency filtering)
    learningLevelSkillIds: skillGroups.learningLevelSkillIds,
    proficientLevelSkillIds: skillGroups.proficientLevelSkillIds,
    expertLevelSkillIds: skillGroups.expertLevelSkillIds,
    // Skill filter requirements for HAS_ANY semantics
    skillFilterRequirements: skillFilterRequirements.length > 0 ? skillFilterRequirements : undefined,
    originalSkillIdentifiers:
      originalSkillIdentifiers.length > 0 ? originalSkillIdentifiers : null,
    // Basic engineer filters
    startTimeline: expanded.startTimeline,
    minYearsExperience: expanded.minYearsExperience,
    maxYearsExperience: expanded.maxYearsExperience,
    timezoneZones: expanded.timezoneZones,
    maxBudget: expanded.maxBudget,
    stretchBudget: expanded.stretchBudget,
    offset: expanded.offset,
    limit: expanded.limit,
    // Optional: filter to a specific engineer (for explain endpoint)
    engineerId: request.engineerId,
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

  // Step 5.5: Get constraint advice if needed (sparse or many results)
  // Note: Derived skill constraints are now embedded in appliedFilters as AppliedSkillFilter with ruleId
  const constraintAdviceOutput = await getConstraintAdvice({
    session,
    totalCount,
    expandedSearchCriteria: expanded,
    appliedFilters: expanded.appliedFilters,
  });

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
    requiredSkillIds,
    preferredSkillIds,
    preferredBusinessDomains,
    preferredTechnicalDomains,
    alignedSkillIds: expanded.alignedSkillIds,
    maxBudget: expanded.maxBudget,
    stretchBudget: expanded.stretchBudget,
    // Pass through preferred/required values
    preferredSeniorityLevel: expanded.preferredSeniorityLevel,
    preferredMaxStartTime: expanded.preferredMaxStartTime,
    requiredMaxStartTime: expanded.requiredMaxStartTime,
    preferredTimezone: expanded.preferredTimezone,
    // Per-skill preferred proficiencies for ranking boost
    skillIdToPreferredProficiency,
    // Inference engine outputs
    derivedRequiredSkillIds: expanded.derivedRequiredSkillIds,
    derivedSkillBoosts: expanded.derivedSkillBoosts,
    derivedConstraints: expanded.derivedConstraints,
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
    overriddenRuleIds: request.overriddenRuleIds || [],
    // Include derived constraints for client visibility (pass through nested structure)
    derivedConstraints: expanded.derivedConstraints.map((dc) => ({
      rule: dc.rule,
      action: dc.action,
      provenance: dc.provenance,
      override: dc.override,
    })),
    queryMetadata: {
      executionTimeMs,
      skillsExpanded: expandedSkillNames,
      defaultsApplied: expanded.defaultsApplied,
      unresolvedSkills,
    },
    // Include constraint advice results if present (Project 2)
    ...(constraintAdviceOutput.relaxation && { relaxation: constraintAdviceOutput.relaxation }),
    ...(constraintAdviceOutput.tightening && { tightening: constraintAdviceOutput.tightening }),
    // Include expanded criteria for downstream processing (critique generation)
    expandedCriteria: expanded,
  };
}

/**
 * Gets just the result count for a search request without fetching actual results.
 * Used by the critique service to get baseline counts before applying adjustments.
 *
 * This is more efficient than executeSearch with limit:0 because it:
 * - Runs a simpler count-only Cypher query
 * - Skips utility scoring, constraint advice, and result formatting
 */
export async function getSearchResultCount(
  session: Session,
  request: SearchFilterRequest
): Promise<number> {
  const config = knowledgeBaseConfig;

  // Resolve skills (needed for skill-filtered counts)
  const { skillGroups } = await resolveAllSkills(
    session,
    request.requiredSkills,
    request.preferredSkills,
    config.defaults.defaultMinProficiency
  );

  // Expand search criteria (needed for derived constraints like seniority→years)
  // Pass empty arrays for skill groups since count query uses flat skill IDs
  const expanded = await expandSearchCriteria(session, request, [], []);

  // Resolve domains
  const requiredBusinessDomains = await resolveBusinessDomains(
    session,
    request.requiredBusinessDomains
  );
  const requiredTechnicalDomains = await resolveTechnicalDomains(
    session,
    request.requiredTechnicalDomains
  );

  // Build query params (subset needed for count query)
  const queryParams: CypherQueryParams = {
    learningLevelSkillIds: skillGroups.learningLevelSkillIds,
    proficientLevelSkillIds: skillGroups.proficientLevelSkillIds,
    expertLevelSkillIds: skillGroups.expertLevelSkillIds,
    originalSkillIdentifiers: null,
    startTimeline: expanded.startTimeline,
    minYearsExperience: expanded.minYearsExperience,
    maxYearsExperience: expanded.maxYearsExperience,
    timezoneZones: expanded.timezoneZones,
    maxBudget: expanded.maxBudget,
    stretchBudget: expanded.stretchBudget,
    offset: 0,
    limit: 0, // Not used by count query but required by type
    requiredBusinessDomains:
      requiredBusinessDomains.length > 0 ? requiredBusinessDomains : undefined,
    requiredTechnicalDomains:
      requiredTechnicalDomains.length > 0 ? requiredTechnicalDomains : undefined,
  };

  // Build and execute count query
  const countQuery = buildSearchCountQuery(queryParams);
  const result = await session.run(countQuery.query, countQuery.params);

  return result.records.length > 0
    ? toNumber(result.records[0].get("totalCount"))
    : 0;
}
