/**
 * Cypher Query Builder Service
 * Generates Neo4j Cypher queries based on expanded constraints.
 */

import { int } from "neo4j-driver";
import type {
  ProficiencyLevel,
  AvailabilityOption,
} from "../types/search.types.js";

export interface CypherQueryParams {
  targetSkillIds: string[] | null;
  skillIdentifiers: string[] | null; // Original skill identifiers for matchType detection
  availability: AvailabilityOption[];
  minYearsExperience: number;
  maxYearsExperience: number | null;
  minConfidenceScore: number;
  allowedProficiencyLevels: ProficiencyLevel[];
  timezonePrefix: string | null;
  maxSalary: number | null;
  minSalary: number | null;
  offset: number;
  limit: number;
  // Domain filtering
  requiredDomainIds?: string[];   // Hard filter - must match at least one
  preferredDomainIds?: string[];  // For scoring - collected but not filtered
}

export interface CypherQuery {
  query: string;
  params: Record<string, unknown>;
}

interface EngineerConditionsResult {
  conditions: string[];
  queryParams: Record<string, unknown>;
}

/**
 * Builds shared engineer-level WHERE conditions and query params.
 */
function buildEngineerConditions(params: CypherQueryParams): EngineerConditionsResult {
  const queryParams: Record<string, unknown> = {
    availability: params.availability,
    minYearsExperience: params.minYearsExperience,
  };

  const conditions: string[] = [
    "e.availability IN $availability",
    "e.yearsExperience >= $minYearsExperience",
  ];

  if (params.maxYearsExperience !== null) {
    conditions.push("e.yearsExperience < $maxYearsExperience");
    queryParams.maxYearsExperience = params.maxYearsExperience;
  }

  if (params.timezonePrefix !== null) {
    conditions.push("e.timezone STARTS WITH $timezonePrefix");
    queryParams.timezonePrefix = params.timezonePrefix;
  }

  if (params.maxSalary !== null) {
    conditions.push("e.salary <= $maxSalary");
    queryParams.maxSalary = params.maxSalary;
  }

  if (params.minSalary !== null) {
    conditions.push("e.salary >= $minSalary");
    queryParams.minSalary = params.minSalary;
  }

  return { conditions, queryParams };
}

/**
 * Builds the unified search query for both skill search and browse modes.
 * Uses shared helper for engineer conditions and returns consistent field names.
 */
export function buildSearchQuery(params: CypherQueryParams): CypherQuery {
  const { conditions, queryParams } = buildEngineerConditions(params);
  const hasSkillFilter = params.targetSkillIds !== null && params.targetSkillIds.length > 0;

  // Add pagination params
  queryParams.offset = int(params.offset);
  queryParams.limit = int(params.limit);

  // Domain filtering flags
  const hasRequiredDomains = params.requiredDomainIds && params.requiredDomainIds.length > 0;
  const hasPreferredDomains = params.preferredDomainIds && params.preferredDomainIds.length > 0;

  if (hasRequiredDomains) {
    queryParams.requiredDomainIds = params.requiredDomainIds;
  }
  if (hasPreferredDomains) {
    queryParams.preferredDomainIds = params.preferredDomainIds;
  }

  if (hasSkillFilter) {
    // SKILL SEARCH MODE: Two-stage filtering with constraint check booleans
    queryParams.targetSkillIds = params.targetSkillIds;
    queryParams.skillIdentifiers = params.skillIdentifiers || [];
    queryParams.minConfidenceScore = params.minConfidenceScore;
    queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;

    const whereClause = conditions.join("\n  AND ");

    // Build domain filter clause if requiredDomains specified
    const domainFilterClause = hasRequiredDomains
      ? `
// Domain filter: must have at least one required domain
MATCH (e)-[:HAS]->(:EngineerSkill)-[:FOR]->(domainSkill:Skill)
WHERE domainSkill.id IN $requiredDomainIds
WITH e`
      : "";

    // Build preferred domain collection clause
    const domainCollectionClause = hasPreferredDomains
      ? `
// Collect matched preferred domains for scoring
OPTIONAL MATCH (e)-[:HAS]->(:EngineerSkill)-[:FOR]->(prefDomain:Skill)
WHERE prefDomain.id IN $preferredDomainIds
WITH e, allRelevantSkills, matchedSkillCount, avgConfidence,
     COLLECT(DISTINCT prefDomain.name) AS matchedDomainNames`
      : `
WITH e, allRelevantSkills, matchedSkillCount, avgConfidence,
     [] AS matchedDomainNames`;

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

  } else {
    // BROWSE MODE: No skill filtering, OPTIONAL MATCH for display
    queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;
    queryParams.minConfidenceScore = params.minConfidenceScore;

    const whereClause = conditions.join("\n  AND ");

    // Build domain filter clause if requiredDomains specified (for browse mode with domain filter)
    const domainFilterClause = hasRequiredDomains
      ? `
// Domain filter: must have at least one required domain
MATCH (e)-[:HAS]->(:EngineerSkill)-[:FOR]->(domainSkill:Skill)
WHERE domainSkill.id IN $requiredDomainIds
WITH DISTINCT e`
      : "";

    // Build preferred domain collection clause for browse mode
    const domainCollectionClause = hasPreferredDomains
      ? `
// Collect matched preferred domains for scoring
OPTIONAL MATCH (e)-[:HAS]->(:EngineerSkill)-[:FOR]->(prefDomain:Skill)
WHERE prefDomain.id IN $preferredDomainIds
WITH e, allRelevantSkills,
     COLLECT(DISTINCT prefDomain.name) AS matchedDomainNames`
      : `
WITH e, allRelevantSkills,
     [] AS matchedDomainNames`;

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
}

/**
 * Builds a count query to get total matches (without pagination).
 */
export function buildCountQuery(params: CypherQueryParams): CypherQuery {
  const { conditions, queryParams } = buildEngineerConditions(params);
  const hasSkillFilter = params.targetSkillIds !== null && params.targetSkillIds.length > 0;
  const hasRequiredDomains = params.requiredDomainIds && params.requiredDomainIds.length > 0;

  if (hasRequiredDomains) {
    queryParams.requiredDomainIds = params.requiredDomainIds;
  }

  if (hasSkillFilter) {
    queryParams.targetSkillIds = params.targetSkillIds;
    queryParams.minConfidenceScore = params.minConfidenceScore;
    queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;

    const whereClause = conditions.join("\n  AND ");

    // Domain filter clause for count query
    const domainFilterClause = hasRequiredDomains
      ? `
MATCH (e)-[:HAS]->(:EngineerSkill)-[:FOR]->(domainSkill:Skill)
WHERE domainSkill.id IN $requiredDomainIds
WITH e`
      : "";

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

  } else {
    const whereClause = conditions.join("\n  AND ");

    // Domain filter clause for browse mode count query
    const domainFilterClause = hasRequiredDomains
      ? `
MATCH (e)-[:HAS]->(:EngineerSkill)-[:FOR]->(domainSkill:Skill)
WHERE domainSkill.id IN $requiredDomainIds
WITH DISTINCT e`
      : "";

    const query = `
MATCH (e:Engineer)
WHERE ${whereClause}
${domainFilterClause}
RETURN COUNT(DISTINCT e) AS totalCount
`;

    return { query, params: queryParams };
  }
}
