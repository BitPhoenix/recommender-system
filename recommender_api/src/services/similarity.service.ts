/**
 * Similarity Service
 *
 * Orchestrates finding similar engineers for a given target.
 * Loads graph data from Neo4j and uses the similarity calculator
 * to score and rank candidates.
 */

import type { Session } from 'neo4j-driver';
import type {
  SimilarEngineersResponse,
  EngineerForSimilarity,
  EngineerSkill,
  DomainExperience,
} from './similarity-calculator/index.js';
import {
  loadSkillGraph,
  loadDomainGraph,
  scoreAndSortCandidates,
  selectDiverseResults,
} from './similarity-calculator/index.js';

/**
 * Finds engineers similar to the target engineer.
 *
 * @param session Neo4j session
 * @param targetEngineerId ID of the engineer to find similar candidates for
 * @param limit Maximum number of similar engineers to return (default 5)
 */
export async function findSimilarEngineers(
  session: Session,
  targetEngineerId: string,
  limit: number = 5
): Promise<SimilarEngineersResponse> {
  const startTime = Date.now();

  /*
   * Load graphs sequentially - Neo4j sessions are not thread-safe.
   * See: search.service.ts:76-77 for pattern
   * For production, consider caching these graphs with TTL since
   * skill/domain hierarchies change infrequently.
   */
  const skillGraph = await loadSkillGraph(session);
  const domainGraph = await loadDomainGraph(session);

  // Load target engineer
  const target = await loadEngineerData(session, targetEngineerId);
  if (!target) {
    throw new Error(`Engineer not found: ${targetEngineerId}`);
  }

  // Load all other engineers
  const candidates = await loadAllEngineersExcept(session, targetEngineerId);

  // Score and sort
  const scored = scoreAndSortCandidates(skillGraph, domainGraph, target, candidates);

  // Apply diversity selection (uses same graph-aware similarity as scoring)
  const diverse = selectDiverseResults(skillGraph, domainGraph, scored, limit);

  console.log(`findSimilarEngineers completed in ${Date.now() - startTime}ms`);

  return {
    target,
    similar: diverse,
  };
}

/**
 * Loads a single engineer's data for similarity comparison.
 */
async function loadEngineerData(
  session: Session,
  engineerId: string
): Promise<EngineerForSimilarity | null> {
  const query = `
    MATCH (e:Engineer {id: $engineerId})
    OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    OPTIONAL MATCH (e)-[bdExp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    OPTIONAL MATCH (e)-[tdExp:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
    RETURN e.id AS id,
           e.name AS name,
           e.headline AS headline,
           e.yearsExperience AS yearsExperience,
           e.timezone AS timezone,
           COLLECT(DISTINCT CASE WHEN s IS NOT NULL THEN {
             skillId: s.id,
             skillName: s.name,
             proficiencyLevel: us.proficiencyLevel,
             confidenceScore: us.confidenceScore
           } END) AS skills,
           COLLECT(DISTINCT CASE WHEN bd IS NOT NULL THEN {
             domainId: bd.id,
             domainName: bd.name,
             years: bdExp.years
           } END) AS businessDomains,
           COLLECT(DISTINCT CASE WHEN td IS NOT NULL THEN {
             domainId: td.id,
             domainName: td.name,
             years: tdExp.years
           } END) AS technicalDomains
  `;

  const result = await session.run(query, { engineerId });

  if (result.records.length === 0) {
    return null;
  }

  const record = result.records[0];
  return parseEngineerRecord(record);
}

/**
 * Loads all engineers except the target for comparison.
 */
async function loadAllEngineersExcept(
  session: Session,
  excludeId: string
): Promise<EngineerForSimilarity[]> {
  const query = `
    MATCH (e:Engineer)
    WHERE e.id <> $excludeId
    OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    OPTIONAL MATCH (e)-[bdExp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    OPTIONAL MATCH (e)-[tdExp:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
    RETURN e.id AS id,
           e.name AS name,
           e.headline AS headline,
           e.yearsExperience AS yearsExperience,
           e.timezone AS timezone,
           COLLECT(DISTINCT CASE WHEN s IS NOT NULL THEN {
             skillId: s.id,
             skillName: s.name,
             proficiencyLevel: us.proficiencyLevel,
             confidenceScore: us.confidenceScore
           } END) AS skills,
           COLLECT(DISTINCT CASE WHEN bd IS NOT NULL THEN {
             domainId: bd.id,
             domainName: bd.name,
             years: bdExp.years
           } END) AS businessDomains,
           COLLECT(DISTINCT CASE WHEN td IS NOT NULL THEN {
             domainId: td.id,
             domainName: td.name,
             years: tdExp.years
           } END) AS technicalDomains
  `;

  const result = await session.run(query, { excludeId });

  return result.records.map(record => parseEngineerRecord(record));
}

/**
 * Parses a Neo4j record into an EngineerForSimilarity object.
 */
function parseEngineerRecord(record: import('neo4j-driver').Record): EngineerForSimilarity {
  const skills = (record.get('skills') as Array<EngineerSkill | null>)
    .filter((s): s is EngineerSkill => s !== null);

  const businessDomains = (record.get('businessDomains') as Array<DomainExperience | null>)
    .filter((d): d is DomainExperience => d !== null);

  const technicalDomains = (record.get('technicalDomains') as Array<DomainExperience | null>)
    .filter((d): d is DomainExperience => d !== null);

  // Handle Neo4j integer types
  const yearsExperience = record.get('yearsExperience');
  const yearsValue = typeof yearsExperience === 'object' && yearsExperience !== null && 'toNumber' in yearsExperience
    ? (yearsExperience as { toNumber: () => number }).toNumber()
    : Number(yearsExperience);

  return {
    id: record.get('id') as string,
    name: record.get('name') as string,
    headline: record.get('headline') as string,
    yearsExperience: yearsValue,
    timezone: record.get('timezone') as string,
    skills,
    businessDomains,
    technicalDomains,
  };
}
