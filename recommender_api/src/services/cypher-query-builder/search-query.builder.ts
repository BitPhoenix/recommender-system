/**
 * Builds unified Cypher query for engineer search.
 * Handles both skill-filtered and unfiltered search in a single code path.
 */

import { int } from "neo4j-driver";
import type { CypherQueryParams, CypherQuery } from "./query-types.js";
import { buildBasicEngineerFilters } from "./query-conditions.builder.js";
import {
  getDomainFilterContext,
  addDomainQueryParams,
  buildRequiredBusinessDomainFilter,
  buildRequiredTechnicalDomainFilter,
  buildBusinessDomainCollection,
  buildTechnicalDomainCollection,
} from "./query-domain-filter.builder.js";

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export function buildSearchQuery(params: CypherQueryParams): CypherQuery {
  /*
   * QUERY STRUCTURE: SHARED + CONDITIONAL
   *
   * This function builds a single Cypher query that handles two search modes:
   * 1. Skill-filtered: Find engineers matching specific skills with constraints
   * 2. Unfiltered: Return all engineers meeting basic criteria (experience, salary, etc.)
   *
   * Rather than maintaining two separate query builders that could drift apart,
   * we use conditional string segments within one builder. Code below marked
   * "shared" runs for both modes; code marked "conditional" or checking
   * `hasSkillFilter` only runs for skill-filtered searches.
   *
   * Shared: engineer conditions, domain context, pagination, return clause
   * Conditional: skill matching, qualification checks, skill-based ordering
   */
  const allSkillIds = getAllSkillIds(params);
  const hasSkillFilter = allSkillIds.length > 0;

  const { conditions, queryParams } = buildBasicEngineerFilters(params);
  const domainContext = getDomainFilterContext(params);
  const whereClause = conditions.join("\n  AND ");

  queryParams.offset = int(params.offset);
  queryParams.limit = int(params.limit);

  addDomainQueryParams(queryParams, params, domainContext);

  if (hasSkillFilter) {
    addSkillQueryParams(queryParams, params, allSkillIds);
  }

  // === BUILD QUERY CLAUSES ===
  const matchClause = buildMatchClause(hasSkillFilter, whereClause);
  const skillProficiencyFilterClause = buildSkillProficiencyFilterClause(hasSkillFilter);

  // Domain filter clauses (separate for business and technical domains)
  const requiredBusinessDomainFilterClause = buildRequiredBusinessDomainFilter(domainContext);
  const requiredTechnicalDomainFilterClause = buildRequiredTechnicalDomainFilter(domainContext);

  const countAndPaginateClause = buildCountAndPaginateClause(hasSkillFilter);
  const skillCollectionClause = buildSkillCollectionClause(hasSkillFilter);

  /*
   * Cypher's WITH clause acts like a pipeline - any variable not explicitly
   * passed through is dropped from scope. These fields were computed in the
   * skill collection step and must be carried through domain collection to
   * reach the final RETURN clause.
   *
   * We accumulate carryover fields incrementally because each collection step
   * produces a new field that subsequent steps need. We can't include all fields
   * upfront because they don't exist yet - e.g., matchedBusinessDomains is only
   * created by buildBusinessDomainCollection, so it can't be carried into that
   * function, only out of it.
   */
  const carryoverFields = ["totalCount", "allRelevantSkills", "matchedSkillCount", "avgConfidence"];

  const businessDomainCollection = buildBusinessDomainCollection(domainContext, carryoverFields);
  carryoverFields.push(...businessDomainCollection.carryForwardFields);

  const technicalDomainCollection = buildTechnicalDomainCollection(domainContext, carryoverFields);
  carryoverFields.push(...technicalDomainCollection.carryForwardFields);

  const returnClause = buildReturnClause();

  // === ASSEMBLE FINAL QUERY ===
  const query = `
// ${hasSkillFilter ? "Skill-Filtered" : "Unfiltered"} Search Query
${matchClause}
${skillProficiencyFilterClause}
${requiredBusinessDomainFilterClause}
${requiredTechnicalDomainFilterClause}
${countAndPaginateClause}
${skillCollectionClause}
${businessDomainCollection.clause}
${technicalDomainCollection.clause}
${returnClause}
`;

  return { query, params: queryParams };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getAllSkillIds(params: CypherQueryParams): string[] {
  return [
    ...params.learningLevelSkillIds,
    ...params.proficientLevelSkillIds,
    ...params.expertLevelSkillIds,
  ];
}

function addSkillQueryParams(
  queryParams: Record<string, unknown>,
  params: CypherQueryParams,
  allSkillIds: string[]
): void {
  queryParams.allSkillIds = allSkillIds;
  queryParams.learningLevelSkillIds = params.learningLevelSkillIds;
  queryParams.proficientLevelSkillIds = params.proficientLevelSkillIds;
  queryParams.expertLevelSkillIds = params.expertLevelSkillIds;
  // originalSkillIdentifiers: the user's original skill input (names or IDs)
  // Used to classify matches as 'direct' (exact match) vs 'descendant' (hierarchy expansion)
  queryParams.originalSkillIdentifiers = params.originalSkillIdentifiers || [];
}

function buildMatchClause(hasSkillFilter: boolean, whereClause: string): string {
  return hasSkillFilter
    ? `MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
WHERE s.id IN $allSkillIds
  AND ${whereClause}`
    : `MATCH (e:Engineer)
WHERE ${whereClause}`;
}

/**
 * Builds the qualification check clause for skill-filtered searches.
 *
 * Per-skill proficiency: each skill bucket has its own minimum proficiency requirement
 * - learningLevelSkillIds: any proficiency level qualifies
 * - proficientLevelSkillIds: 'proficient' or 'expert' qualifies
 * - expertLevelSkillIds: only 'expert' qualifies
 */
function buildSkillProficiencyFilterClause(hasSkillFilter: boolean): string {
  if (!hasSkillFilter) return "";

  return `
// Check which engineers have at least one skill meeting per-skill proficiency constraints
// Note: confidence score is used for ranking only, not exclusion
WITH e, COLLECT(DISTINCT CASE
  WHEN s.id IN $learningLevelSkillIds THEN s.id
  WHEN s.id IN $proficientLevelSkillIds
   AND us.proficiencyLevel IN ['proficient', 'expert'] THEN s.id
  WHEN s.id IN $expertLevelSkillIds
   AND us.proficiencyLevel = 'expert' THEN s.id
END) AS qualifyingSkillIds
// SIZE([...WHERE x IS NOT NULL]) filters out NULLs from CASE misses (skill didn't meet proficiency)
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) > 0`;
}

/**
 * Builds the count and early pagination clause.
 *
 * This is a performance optimization. Previously, we ran two queries:
 * 1. Main query: collected skills for ALL matching engineers, then paginated
 * 2. Count query: separate query just to get totalCount for pagination UI
 *
 * Now we do it in one query by:
 * 1. Collecting all qualifying engineers into a list
 * 2. Computing SIZE(list) as totalCount BEFORE pagination
 * 3. Paginating (ORDER BY, SKIP, LIMIT) immediately
 * 4. Only THEN running expensive skill/domain collection on the small page
 *
 * This means skill collection runs for ~20 engineers instead of potentially
 * hundreds, significantly reducing query time for large result sets.
 */
function buildCountAndPaginateClause(hasSkillFilter: boolean): string {
  return hasSkillFilter
    ? `
// Count all qualifying engineers, then paginate early
WITH COLLECT({
  e: e,
  qualifyingSkillIds: qualifyingSkillIds
}) AS allResults
WITH allResults, SIZE(allResults) AS totalCount
UNWIND allResults AS row
WITH row.e AS e, row.qualifyingSkillIds AS qualifyingSkillIds, totalCount
ORDER BY SIZE(qualifyingSkillIds) DESC, e.yearsExperience DESC
SKIP $offset LIMIT $limit`
    : `
// Count all matching engineers, then paginate early
WITH COLLECT(e) AS allResults
WITH allResults, SIZE(allResults) AS totalCount
UNWIND allResults AS e
WITH e, totalCount
ORDER BY e.yearsExperience DESC
SKIP $offset LIMIT $limit`;
}

/**
 * Builds the skill collection clause.
 *
 * Collects detailed skill data for each engineer. This only runs for the
 * paginated subset (e.g., 20 engineers) rather than all matches.
 *
 * We must include `totalCount` in every WITH clause from here forward.
 * Cypher's WITH acts like a pipeline - any variable not explicitly passed
 * through is lost. Since totalCount was computed earlier and we need it
 * in the final RETURN, we carry it through each stage.
 *
 * WHY PROFICIENCY LOGIC IS REPEATED FROM buildSkillProficiencyFilterClause:
 * The same proficiency-check logic (learning/proficient/expert buckets) appears
 * in both the filter clause and here. This is unavoidable because:
 * 1. Cypher has no reusable functions — we can't define the check once and reuse it
 * 2. The filter stage runs BEFORE pagination (coarse filter on all candidates)
 * 3. This stage runs AFTER pagination (detailed collection for ~20 engineers)
 * 4. Cypher's WITH pipeline drops the original skill matches after pagination,
 *    so we must re-MATCH and re-check proficiency here
 *
 * The repetition is the cost of single-query optimization with early pagination.
 */
function buildSkillCollectionClause(hasSkillFilter: boolean): string {
  return hasSkillFilter
    ? `
// Collect all skills with per-skill proficiency check (now only for paginated subset)
// Confidence score is collected for ranking but not used to filter/exclude engineers
MATCH (e)-[:HAS]->(us2:UserSkill)-[:FOR]->(s2:Skill)
WHERE s2.id IN $allSkillIds

WITH e, totalCount,
     COLLECT({
       skillId: s2.id,
       skillName: s2.name,
       proficiencyLevel: us2.proficiencyLevel,
       confidenceScore: us2.confidenceScore,
       yearsUsed: us2.yearsUsed,
       matchType: CASE
         WHEN s2.id IN $originalSkillIdentifiers OR s2.name IN $originalSkillIdentifiers THEN 'direct'
         ELSE 'descendant'
       END,
       meetsProficiency: CASE
         WHEN s2.id IN $learningLevelSkillIds THEN true
         WHEN s2.id IN $proficientLevelSkillIds AND us2.proficiencyLevel IN ['proficient', 'expert'] THEN true
         WHEN s2.id IN $expertLevelSkillIds AND us2.proficiencyLevel = 'expert' THEN true
         ELSE false
       END
     }) AS allRelevantSkills,
     SIZE([x IN COLLECT(DISTINCT CASE
       WHEN s2.id IN $learningLevelSkillIds THEN s2.id
       WHEN s2.id IN $proficientLevelSkillIds AND us2.proficiencyLevel IN ['proficient', 'expert'] THEN s2.id
       WHEN s2.id IN $expertLevelSkillIds AND us2.proficiencyLevel = 'expert' THEN s2.id
     END) WHERE x IS NOT NULL]) AS matchedSkillCount,
     AVG(CASE
       WHEN s2.id IN $learningLevelSkillIds
         OR (s2.id IN $proficientLevelSkillIds AND us2.proficiencyLevel IN ['proficient', 'expert'])
         OR (s2.id IN $expertLevelSkillIds AND us2.proficiencyLevel = 'expert')
       THEN us2.confidenceScore END) AS avgConfidence`
    : `
// Get all skills for display (now only for paginated subset)
// Confidence score is collected for ranking but not used to filter/exclude engineers
OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
WHERE s.isCategory = false

WITH e, totalCount,
     COLLECT(
       CASE WHEN s IS NOT NULL THEN {
         skillId: s.id,
         skillName: s.name,
         proficiencyLevel: us.proficiencyLevel,
         confidenceScore: us.confidenceScore,
         yearsUsed: us.yearsUsed,
         matchType: 'none'
       } ELSE NULL END
     ) AS rawSkills

WITH e, totalCount,
     [skill IN rawSkills WHERE skill IS NOT NULL] AS allRelevantSkills,
     0 AS matchedSkillCount,
     0.0 AS avgConfidence`;
}

/**
 * Builds the shared RETURN clause.
 * Note: ORDER BY, SKIP, LIMIT already applied in count/pagination step.
 */
function buildReturnClause(): string {
  return `
RETURN e.id AS id,
       e.name AS name,
       e.headline AS headline,
       e.salary AS salary,
       e.yearsExperience AS yearsExperience,
       e.startTimeline AS startTimeline,
       e.timezone AS timezone,
       allRelevantSkills,
       matchedSkillCount,
       COALESCE(avgConfidence, 0.0) AS avgConfidence,
       matchedBusinessDomains,
       matchedTechnicalDomains,
       totalCount`;
}
