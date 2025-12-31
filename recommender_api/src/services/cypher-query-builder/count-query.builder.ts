/**
 * Builds count queries for pagination.
 * Returns total matches without pagination limits.
 */

import type { CypherQueryParams, CypherQuery } from "./query-types.js";
import { buildEngineerQueryConditions } from "./query-conditions.builder.js";
import {
  getDomainFilterContext,
  addDomainQueryParams,
  buildRequiredDomainFilterClause,
} from "./query-domain-filter.builder.js";

export function buildCountQuery(params: CypherQueryParams): CypherQuery {
  const hasSkillFilter =
    params.targetSkillIds !== null && params.targetSkillIds.length > 0;

  // === SHARED SETUP ===
  const { conditions, queryParams } = buildEngineerQueryConditions(params);
  const domainContext = getDomainFilterContext(params);
  const whereClause = conditions.join("\n  AND ");

  addDomainQueryParams(queryParams, params, domainContext);

  // === CONDITIONAL: Skill-specific params ===
  if (hasSkillFilter) {
    queryParams.targetSkillIds = params.targetSkillIds;
    queryParams.minConfidenceScore = params.minConfidenceScore;
    queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;
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
WITH e, COLLECT(DISTINCT CASE
  WHEN es.confidenceScore >= $minConfidenceScore
   AND es.proficiencyLevel IN $allowedProficiencyLevels
  THEN s.id END) AS qualifyingSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) > 0`
    : "";

  // === BUILD DOMAIN FILTER ===
  const domainFilterClause = buildRequiredDomainFilterClause(
    domainContext,
    !hasSkillFilter // useDistinct only for non-skill-filtered queries
  );

  // === ASSEMBLE FINAL QUERY ===
  const query = `
${matchClause}
${qualificationClause}
${domainFilterClause}
RETURN COUNT(DISTINCT e) AS totalCount
`;

  return { query, params: queryParams };
}
