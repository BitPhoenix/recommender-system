/**
 * Filter-Similarity Service
 *
 * Implements the hybrid search pattern (Section 5.2 + 5.3):
 * 1. Filter candidates by hard constraints (5.2) + inference rules
 * 2. Rank filtered candidates by similarity to reference (5.3)
 * 3. Apply diversity selection (5.3.1.1)
 * 4. Provide constraint advice (relaxation/tightening)
 */

import type { Session } from 'neo4j-driver';
import type { FilterSimilarityRequest } from '../schemas/filter-similarity.schema.js';
import type {
  FilterSimilarityResponse,
  FilterSimilarityMatch,
  DerivedConstraintInfo,
} from '../types/filter-similarity.types.js';
import type { SearchFilterRequest } from '../types/search.types.js';

import { resolveAllSkills } from './skill-resolution.service.js';
import { expandSearchCriteria } from './constraint-expander.service.js';
import { resolveBusinessDomains, resolveTechnicalDomains } from './domain-resolver.service.js';
import { buildSearchQuery, type SearchQueryOptions } from './cypher-query-builder/search-query.builder.js';
import type { CypherQueryParams } from './cypher-query-builder/query-types.js';
import { loadEngineerData } from './similarity.service.js';
import type { EngineerForSimilarity, EngineerSkill, DomainExperience } from './similarity-calculator/types.js';
import {
  loadSkillGraph,
  loadDomainGraph,
  scoreAndSortCandidates,
  selectDiverseResults,
} from './similarity-calculator/index.js';
import { getConstraintAdvice } from './constraint-advisor/index.js';
import { knowledgeBaseConfig } from '../config/knowledge-base/index.js';

/**
 * Executes a filter-similarity search.
 *
 * Flow:
 * 1. Load reference engineer (fail fast if not found)
 * 2. Resolve skills and expand constraints using inference engine
 * 3. Build and execute filter query (excluding reference engineer)
 * 4. Load graphs for similarity calculation
 * 5. Load full candidate data and score by similarity
 * 6. Apply diversity selection
 * 7. Get constraint advice (relaxation/tightening)
 * 8. Build response
 */
export async function executeFilterSimilarity(
  session: Session,
  request: FilterSimilarityRequest
): Promise<FilterSimilarityResponse> {
  const startTime = Date.now();
  const config = knowledgeBaseConfig;

  // 1. Load reference engineer (fail fast if not found)
  const referenceEngineer = await loadEngineerData(session, request.referenceEngineerId);
  if (!referenceEngineer) {
    throw new EngineerNotFoundError(request.referenceEngineerId);
  }

  // 2. Resolve skills (if any required skills specified)
  const skillResolution = request.requiredSkills?.length
    ? await resolveAllSkills(
        session,
        request.requiredSkills,
        [], // Preferences captured by reference engineer, not explicit preferred* fields
        config.defaults.defaultMinProficiency
      )
    : null;

  /*
   * 3. Expand constraints (seniority → years, timeline → array, inference rules, etc.)
   * Pass overriddenRuleIds to allow users to bypass inference rules.
   *
   * We build a partial SearchFilterRequest with only the fields this endpoint supports.
   * The constraint expander is designed for the full /filter request but works fine
   * with a subset of fields.
   */
  const partialRequest: Partial<SearchFilterRequest> = {
    requiredSeniorityLevel: request.requiredSeniorityLevel,
    requiredMaxStartTime: request.requiredMaxStartTime,
    requiredTimezone: request.requiredTimezone,
    maxBudget: request.maxBudget,
    stretchBudget: request.stretchBudget,
    overriddenRuleIds: request.overriddenRuleIds,
    limit: request.limit,
    offset: request.offset,
    requiredSkills: request.requiredSkills,
  };

  /*
   * No preferred skills for this endpoint. In filter-similarity, the reference engineer
   * implicitly captures all preferences - we want candidates who meet the hard constraints
   * AND are similar to the reference. This differs from /filter where explicit preferred*
   * fields drive utility scoring.
   */
  const expanded = await expandSearchCriteria(
    partialRequest as SearchFilterRequest,
    skillResolution?.resolvedRequiredSkills ?? [],
    []
  );

  // 4. Resolve domain constraints
  const requiredBusinessDomains = await resolveBusinessDomains(
    session,
    request.requiredBusinessDomains
  );
  const requiredTechnicalDomains = await resolveTechnicalDomains(
    session,
    request.requiredTechnicalDomains
  );

  /*
   * 5. Build unified search query with collectAllSkills=true.
   *
   * Unlike /filter which shows "skills matching your criteria", filter-similarity
   * needs ALL skills for each engineer to compute meaningful similarity scores.
   * See SearchQueryOptions.collectAllSkills for detailed explanation.
   */
  const queryParams: CypherQueryParams = {
    // Exclude reference engineer from results
    excludeEngineerId: request.referenceEngineerId,

    // Skill filters
    learningLevelSkillIds: skillResolution?.skillGroups.learningLevelSkillIds ?? [],
    proficientLevelSkillIds: skillResolution?.skillGroups.proficientLevelSkillIds ?? [],
    expertLevelSkillIds: skillResolution?.skillGroups.expertLevelSkillIds ?? [],
    originalSkillIdentifiers: request.requiredSkills?.map(s => s.skill) ?? null,

    // Property filters
    startTimeline: expanded.startTimeline,
    minYearsExperience: expanded.minYearsExperience,
    maxYearsExperience: expanded.maxYearsExperience,
    timezoneZones: expanded.timezoneZones,
    maxBudget: expanded.maxBudget,
    stretchBudget: expanded.stretchBudget,

    // Domain filters (only required, no preferred for this endpoint)
    requiredBusinessDomains: requiredBusinessDomains.length > 0 ? requiredBusinessDomains : undefined,
    requiredTechnicalDomains: requiredTechnicalDomains.length > 0 ? requiredTechnicalDomains : undefined,

    // Get all candidates, paginate after diversity selection
    offset: 0,
    limit: 1000,
  };

  const searchQueryOptions: SearchQueryOptions = {
    collectAllSkills: true,  // Need full profiles for similarity scoring
  };

  const filterQuery = buildSearchQuery(queryParams, searchQueryOptions);
  const filterResult = await session.run(filterQuery.query, filterQuery.params);

  const totalCount = filterResult.records.length > 0
    ? toNumber(filterResult.records[0].get('totalCount'))
    : 0;

  // 6. Get constraint advice (relaxation/tightening) based on result count
  const constraintAdviceOutput = await getConstraintAdvice({
    session,
    totalCount,
    expandedSearchCriteria: expanded,
    appliedFilters: expanded.appliedFilters,
  });

  /*
   * 7. Load graphs for similarity calculation
   * Note: Neo4j sessions are not thread-safe, so we load sequentially.
   */
  const skillGraph = await loadSkillGraph(session);
  const domainGraph = await loadDomainGraph(session);

  /*
   * 8. Parse query results into EngineerForSimilarity format for scoring.
   * The unified query returns full engineer data with all skills (collectAllSkills=true),
   * eliminating the need for a separate loadEngineersById call.
   */
  const candidates: EngineerForSimilarity[] = filterResult.records.map(record => ({
    id: record.get('id') as string,
    name: record.get('name') as string,
    headline: record.get('headline') as string,
    yearsExperience: toNumber(record.get('yearsExperience')),
    timezone: record.get('timezone') as string,
    salary: record.get('salary') ? toNumber(record.get('salary')) : undefined,
    startTimeline: record.get('startTimeline') as string | undefined,
    skills: parseSkills(record.get('allRelevantSkills')),
    businessDomains: parseDomains(record.get('matchedBusinessDomains')),
    technicalDomains: parseDomains(record.get('matchedTechnicalDomains')),
  }));

  // 9. Score candidates by similarity to reference
  const scoredCandidates = scoreAndSortCandidates(skillGraph, domainGraph, referenceEngineer, candidates);

  /*
   * 10. Apply diversity selection
   * Note: We pass a larger limit to get more candidates for diversity selection,
   * then apply pagination after.
   */
  const diversityLimit = Math.min(request.limit + request.offset, scoredCandidates.length);
  const diverse = selectDiverseResults(skillGraph, domainGraph, scoredCandidates, diversityLimit);

  // 11. Apply pagination (diversity selection returns from rank 0)
  const paginated = diverse.slice(request.offset, request.offset + request.limit);

  // 12. Build derived constraints info for response
  const derivedConstraints: DerivedConstraintInfo[] = expanded.derivedConstraints.map(dc => ({
    rule: dc.rule,
    action: dc.action,
    provenance: dc.provenance,
    override: dc.override,
  }));

  // 13. Build response
  const matches: FilterSimilarityMatch[] = paginated.map(result => ({
    id: result.engineer.id,
    name: result.engineer.name,
    headline: result.engineer.headline,
    salary: result.engineer.salary ?? 0,
    yearsExperience: result.engineer.yearsExperience,
    startTimeline: result.engineer.startTimeline ?? '',
    timezone: result.engineer.timezone,
    similarityScore: result.similarityScore,
    scoreBreakdown: result.breakdown,
    sharedSkills: result.sharedSkills,
    correlatedSkills: result.correlatedSkills,
  }));

  return {
    referenceEngineer: {
      id: referenceEngineer.id,
      name: referenceEngineer.name,
      headline: referenceEngineer.headline,
    },
    matches,
    totalCount,
    appliedFilters: expanded.appliedFilters,
    overriddenRuleIds: request.overriddenRuleIds ?? [],
    derivedConstraints,
    ...(constraintAdviceOutput.relaxation && { relaxation: constraintAdviceOutput.relaxation }),
    ...(constraintAdviceOutput.tightening && { tightening: constraintAdviceOutput.tightening }),
    queryMetadata: {
      executionTimeMs: Date.now() - startTime,
      candidatesBeforeDiversity: candidates.length,
    },
  };
}

/**
 * Error thrown when reference engineer is not found.
 */
export class EngineerNotFoundError extends Error {
  constructor(engineerId: string) {
    super(`Engineer not found: ${engineerId}`);
    this.name = 'EngineerNotFoundError';
  }
}

/**
 * Converts Neo4j integer types to JavaScript numbers.
 */
function toNumber(value: unknown): number {
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/**
 * Parses raw skill data from Cypher query into EngineerSkill format.
 */
function parseSkills(rawSkills: unknown[]): EngineerSkill[] {
  return (rawSkills ?? [])
    .filter((s): s is Record<string, unknown> => s !== null && s !== undefined)
    .map(s => ({
      skillId: s.skillId as string,
      skillName: s.skillName as string,
      proficiencyLevel: s.proficiencyLevel as string,
      confidenceScore: toNumber(s.confidenceScore),
    }));
}

/**
 * Parses raw domain data from Cypher query into DomainExperience format.
 */
function parseDomains(rawDomains: unknown[]): DomainExperience[] {
  return (rawDomains ?? [])
    .filter((d): d is Record<string, unknown> => d !== null && d !== undefined)
    .map(d => ({
      domainId: d.domainId as string,
      domainName: d.domainName as string,
      years: toNumber(d.years),
    }));
}
