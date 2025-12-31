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

  // === BUILD SKILL COLLECTION ===
  const skillCollectionClause = hasSkillFilter
    ? `
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
       THEN es2.confidenceScore END) AS avgConfidence`
    : `
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
     [skill IN rawSkills WHERE skill IS NOT NULL] AS allRelevantSkills,
     0 AS matchedSkillCount,
     0.0 AS avgConfidence`;

  // === BUILD DOMAIN COLLECTION (shared) ===
  const carryoverFields = ["allRelevantSkills", "matchedSkillCount", "avgConfidence"];
  const domainCollectionClause = buildPreferredDomainCollectionClause(
    domainContext,
    carryoverFields
  );

  // === BUILD ORDER BY (conditional) ===
  const orderByClause = hasSkillFilter
    ? "ORDER BY matchedSkillCount DESC, avgConfidence DESC, e.yearsExperience DESC"
    : "ORDER BY e.yearsExperience DESC";

  // === SHARED RETURN CLAUSE ===
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
       matchedDomainNames`;

  // === ASSEMBLE FINAL QUERY ===
  const query = `
// ${hasSkillFilter ? "Skill-Filtered" : "Unfiltered"} Search Query
${matchClause}
${qualificationClause}
${domainFilterClause}
${skillCollectionClause}
${domainCollectionClause}
${returnClause}

${orderByClause}
SKIP $offset
LIMIT $limit
`;

  return { query, params: queryParams };
}
