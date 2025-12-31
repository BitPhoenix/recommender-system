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

function buildSkillSearchCountQuery(params: CypherQueryParams): CypherQuery {
  const { conditions, queryParams } = buildEngineerQueryConditions(params);
  const domainContext = getDomainFilterContext(params);

  queryParams.targetSkillIds = params.targetSkillIds;
  queryParams.minConfidenceScore = params.minConfidenceScore;
  queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;

  addDomainQueryParams(queryParams, params, domainContext);

  const whereClause = conditions.join("\n  AND ");
  const domainFilterClause = buildRequiredDomainFilterClause(
    domainContext,
    false
  );

  const query = `
MATCH (e:Engineer)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.id IN $targetSkillIds
  AND ${whereClause}
WITH e, COLLECT(DISTINCT CASE
  WHEN es.confidenceScore >= $minConfidenceScore
   AND es.proficiencyLevel IN $allowedProficiencyLevels
  THEN s.id END) AS qualifyingSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) > 0
${domainFilterClause}
RETURN COUNT(DISTINCT e) AS totalCount
`;

  return { query, params: queryParams };
}

function buildBrowseCountQuery(params: CypherQueryParams): CypherQuery {
  const { conditions, queryParams } = buildEngineerQueryConditions(params);
  const domainContext = getDomainFilterContext(params);

  addDomainQueryParams(queryParams, params, domainContext);

  const whereClause = conditions.join("\n  AND ");
  const domainFilterClause = buildRequiredDomainFilterClause(
    domainContext,
    true
  );

  const query = `
MATCH (e:Engineer)
WHERE ${whereClause}
${domainFilterClause}
RETURN COUNT(DISTINCT e) AS totalCount
`;

  return { query, params: queryParams };
}

export function buildCountQuery(params: CypherQueryParams): CypherQuery {
  const hasSkillFilter =
    params.targetSkillIds !== null && params.targetSkillIds.length > 0;

  if (hasSkillFilter) {
    return buildSkillSearchCountQuery(params);
  }
  return buildBrowseCountQuery(params);
}
