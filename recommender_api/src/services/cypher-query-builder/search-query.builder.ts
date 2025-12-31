/**
 * Builds unified Cypher query for engineer search.
 * Handles both skill-filtered and unfiltered search in a single code path.
 */

import { int } from "neo4j-driver";
import type { CypherQueryParams, CypherQuery } from "./query-types.js";
import { buildEngineerQueryConditions } from "./query-conditions.builder.js";
import {
  getDomainFilterContext,
  addDomainQueryParams,
  buildRequiredDomainFilterClause,
  buildPreferredDomainCollectionClause,
} from "./query-domain-filter.builder.js";

export function buildSearchQuery(params: CypherQueryParams): CypherQuery {
  const hasSkillFilter =
    params.targetSkillIds !== null && params.targetSkillIds.length > 0;

  // === SHARED SETUP ===
  const { conditions, queryParams } = buildEngineerQueryConditions(params);
  const domainContext = getDomainFilterContext(params);
  const whereClause = conditions.join("\n  AND ");

  queryParams.offset = int(params.offset);
  queryParams.limit = int(params.limit);
  queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;
  queryParams.minConfidenceScore = params.minConfidenceScore;

  addDomainQueryParams(queryParams, params, domainContext);

  // === CONDITIONAL: Skill-specific params ===
  if (hasSkillFilter) {
    queryParams.targetSkillIds = params.targetSkillIds;
    queryParams.skillIdentifiers = params.skillIdentifiers || [];
  }

  // === BUILD MATCH CLAUSE ===
  const matchClause = hasSkillFilter
    ? `MATCH (e:Engineer)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.id IN $targetSkillIds
  AND ${whereClause}`
    : `MATCH (e:Engineer)
WHERE ${whereClause}`;

  // === BUILD QUALIFICATION CHECK (skill search only) ===
  const qualificationClause = hasSkillFilter
    ? `
// Check which engineers have at least one skill meeting confidence/proficiency constraints
WITH e, COLLECT(DISTINCT CASE
  WHEN es.confidenceScore >= $minConfidenceScore
   AND es.proficiencyLevel IN $allowedProficiencyLevels
  THEN s.id END) AS qualifyingSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) > 0`
    : "";

  // === BUILD DOMAIN FILTER (positioned after qualification) ===
  const domainFilterClause = buildRequiredDomainFilterClause(
    domainContext,
    !hasSkillFilter // useDistinct only for non-skill-filtered queries
  );

  /*
   * COUNT AND EARLY PAGINATION
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
  const countAndPaginateClause = hasSkillFilter
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

  /*
   * SKILL COLLECTION
   *
   * Collects detailed skill data for each engineer. This only runs for the
   * paginated subset (e.g., 20 engineers) rather than all matches.
   *
   * We must include `totalCount` in every WITH clause from here forward.
   * Cypher's WITH acts like a pipeline - any variable not explicitly passed
   * through is lost. Since totalCount was computed earlier and we need it
   * in the final RETURN, we carry it through each stage.
   */
  const skillCollectionClause = hasSkillFilter
    ? `
// Collect all skills with constraint check info (now only for paginated subset)
MATCH (e)-[:HAS]->(es2:EngineerSkill)-[:FOR]->(s2:Skill)
WHERE s2.id IN $targetSkillIds

WITH e, totalCount,
     COLLECT({
       skillId: s2.id,
       skillName: s2.name,
       proficiencyLevel: es2.proficiencyLevel,
       confidenceScore: es2.confidenceScore,
       yearsUsed: es2.yearsUsed,
       matchType: CASE
         WHEN s2.id IN $skillIdentifiers OR s2.name IN $skillIdentifiers THEN 'direct'
         ELSE 'descendant'
       END,
       meetsConfidence: es2.confidenceScore >= $minConfidenceScore,
       meetsProficiency: es2.proficiencyLevel IN $allowedProficiencyLevels
     }) AS allRelevantSkills,
     SIZE([x IN COLLECT(DISTINCT CASE
       WHEN es2.confidenceScore >= $minConfidenceScore
        AND es2.proficiencyLevel IN $allowedProficiencyLevels
       THEN s2.id END) WHERE x IS NOT NULL]) AS matchedSkillCount,
     AVG(CASE
       WHEN es2.confidenceScore >= $minConfidenceScore
        AND es2.proficiencyLevel IN $allowedProficiencyLevels
       THEN es2.confidenceScore END) AS avgConfidence`
    : `
// Get all skills for display (now only for paginated subset)
OPTIONAL MATCH (e)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.isCategory = false
  AND es.proficiencyLevel IN $allowedProficiencyLevels
  AND es.confidenceScore >= $minConfidenceScore

WITH e, totalCount,
     COLLECT(
       CASE WHEN s IS NOT NULL THEN {
         skillId: s.id,
         skillName: s.name,
         proficiencyLevel: es.proficiencyLevel,
         confidenceScore: es.confidenceScore,
         yearsUsed: es.yearsUsed,
         matchType: 'none'
       } ELSE NULL END
     ) AS rawSkills

WITH e, totalCount,
     [skill IN rawSkills WHERE skill IS NOT NULL] AS allRelevantSkills,
     0 AS matchedSkillCount,
     0.0 AS avgConfidence`;

  /*
   * DOMAIN COLLECTION
   *
   * The domain collection helper needs to know which fields to preserve in its
   * WITH clauses. These "carryover fields" are variables computed in earlier
   * stages that must survive through the domain collection to reach RETURN.
   * Without explicitly listing them, Cypher would drop them from scope.
   */
  const carryoverFields = ["totalCount", "allRelevantSkills", "matchedSkillCount", "avgConfidence"];
  const domainCollectionClause = buildPreferredDomainCollectionClause(
    domainContext,
    carryoverFields
  );

  // === SHARED RETURN CLAUSE ===
  // Note: ORDER BY, SKIP, LIMIT already applied in count/pagination step
  const returnClause = `
RETURN e.id AS id,
       e.name AS name,
       e.headline AS headline,
       e.salary AS salary,
       e.yearsExperience AS yearsExperience,
       e.availability AS availability,
       e.timezone AS timezone,
       allRelevantSkills,
       matchedSkillCount,
       COALESCE(avgConfidence, 0.0) AS avgConfidence,
       matchedDomainNames,
       totalCount`;

  // === ASSEMBLE FINAL QUERY ===
  const query = `
// ${hasSkillFilter ? "Skill-Filtered" : "Unfiltered"} Search Query
${matchClause}
${qualificationClause}
${domainFilterClause}
${countAndPaginateClause}
${skillCollectionClause}
${domainCollectionClause}
${returnClause}
`;

  return { query, params: queryParams };
}
