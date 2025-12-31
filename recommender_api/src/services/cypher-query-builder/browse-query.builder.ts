/**
 * Builds Cypher query for browse mode.
 * No skill filtering - returns all engineers matching base constraints with their skills.
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

export function buildBrowseQuery(params: CypherQueryParams): CypherQuery {
  const { conditions, queryParams } = buildEngineerQueryConditions(params);
  const domainContext = getDomainFilterContext(params);

  queryParams.offset = int(params.offset);
  queryParams.limit = int(params.limit);
  queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;
  queryParams.minConfidenceScore = params.minConfidenceScore;

  addDomainQueryParams(queryParams, params, domainContext);

  const whereClause = conditions.join("\n  AND ");
  const domainFilterClause = buildRequiredDomainFilterClause(
    domainContext,
    true
  );
  const domainCollectionClause = buildPreferredDomainCollectionClause(
    domainContext,
    ["allRelevantSkills"]
  );

  const query = `
// Find all engineers matching base constraints
MATCH (e:Engineer)
WHERE ${whereClause}
${domainFilterClause}

// Get all skills for display (not filtering)
OPTIONAL MATCH (e)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.isCategory = false
  AND es.proficiencyLevel IN $allowedProficiencyLevels
  AND es.confidenceScore >= $minConfidenceScore

WITH e,
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

WITH e,
     [skill IN rawSkills WHERE skill IS NOT NULL] AS allRelevantSkills
${domainCollectionClause}

RETURN e.id AS id,
       e.name AS name,
       e.headline AS headline,
       e.salary AS salary,
       e.yearsExperience AS yearsExperience,
       e.availability AS availability,
       e.timezone AS timezone,
       allRelevantSkills,
       0 AS matchedSkillCount,
       0.0 AS avgConfidence,
       matchedDomainNames

ORDER BY e.yearsExperience DESC
SKIP $offset
LIMIT $limit
`;

  return { query, params: queryParams };
}
