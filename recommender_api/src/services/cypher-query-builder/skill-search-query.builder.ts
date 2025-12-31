/**
 * Builds Cypher query for skill search mode.
 * Two-stage filtering: finds engineers with qualifying skills, then collects all related skills.
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

export function buildSkillSearchQuery(params: CypherQueryParams): CypherQuery {
  const { conditions, queryParams } = buildEngineerQueryConditions(params);
  const domainContext = getDomainFilterContext(params);

  queryParams.offset = int(params.offset);
  queryParams.limit = int(params.limit);
  queryParams.targetSkillIds = params.targetSkillIds;
  queryParams.skillIdentifiers = params.skillIdentifiers || [];
  queryParams.minConfidenceScore = params.minConfidenceScore;
  queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;

  addDomainQueryParams(queryParams, params, domainContext);

  const whereClause = conditions.join("\n  AND ");
  const domainFilterClause = buildRequiredDomainFilterClause(
    domainContext,
    false
  );
  const domainCollectionClause = buildPreferredDomainCollectionClause(
    domainContext,
    ["allRelevantSkills", "matchedSkillCount", "avgConfidence"]
  );

  const query = `
// Stage 1: Find engineers with at least one qualifying skill in the hierarchy
MATCH (e:Engineer)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.id IN $targetSkillIds
  AND ${whereClause}

// Check which engineers have at least one skill meeting confidence/proficiency constraints
WITH e, COLLECT(DISTINCT CASE
  WHEN es.confidenceScore >= $minConfidenceScore
   AND es.proficiencyLevel IN $allowedProficiencyLevels
  THEN s.id END) AS qualifyingSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) > 0
${domainFilterClause}

// Stage 2: Get ALL skills in hierarchy for qualifying engineers
MATCH (e)-[:HAS]->(es2:EngineerSkill)-[:FOR]->(s2:Skill)
WHERE s2.id IN $targetSkillIds

// Collect all skills with constraint check info
WITH e,
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
       THEN es2.confidenceScore END) AS avgConfidence
${domainCollectionClause}

// Return results ordered by match quality
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
       matchedDomainNames

ORDER BY matchedSkillCount DESC, avgConfidence DESC, e.yearsExperience DESC
SKIP $offset
LIMIT $limit
`;

  return { query, params: queryParams };
}
