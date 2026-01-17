/**
 * Graph Loader
 *
 * Loads skill and domain graphs from Neo4j for in-memory traversal.
 * These graphs are used by the similarity calculator to compute
 * graph-aware similarity scores.
 */

import type { Session } from 'neo4j-driver';
import type { SkillGraph, SkillGraphNode, DomainGraph, DomainGraphNode } from './types.js';
import { similarityParams } from '../../config/knowledge-base/similarity.config.js';

/**
 * Loads the skill graph with relationships needed for similarity scoring.
 *
 * Includes:
 * - CORRELATES_WITH relationships (bidirectional, filtered by minStrength)
 * - BELONGS_TO category membership
 * - CHILD_OF parent relationships
 */
export async function loadSkillGraph(session: Session): Promise<SkillGraph> {
  const { minCorrelationStrength } = similarityParams;

  /*
   * Note: CORRELATES_WITH uses undirected pattern matching (s)-[c]-(other)
   * because correlations are stored unidirectionally in seeds but should
   * be treated as bidirectional for similarity (TypeScript ↔ JavaScript).
   */
  const query = `
    MATCH (s:Skill)
    OPTIONAL MATCH (s)-[:BELONGS_TO]->(cat:SkillCategory)
    OPTIONAL MATCH (s)-[:CHILD_OF]->(parent:Skill)
    OPTIONAL MATCH (s)-[c:CORRELATES_WITH]-(other:Skill)
    WHERE c.strength >= $minStrength
    RETURN s.id AS skillId,
           cat.id AS categoryId,
           parent.id AS parentId,
           COLLECT(DISTINCT {
             toSkillId: other.id,
             strength: c.strength,
             correlationType: c.correlationType
           }) AS correlations
  `;

  const result = await session.run(query, { minStrength: minCorrelationStrength });

  const nodes = new Map<string, SkillGraphNode>();

  for (const record of result.records) {
    const skillId = record.get('skillId') as string;
    const categoryId = record.get('categoryId') as string | null;
    const parentId = record.get('parentId') as string | null;
    const rawCorrelations = record.get('correlations') as Array<{
      toSkillId: string | null;
      strength: number;
      correlationType: string;
    }>;

    // Filter out null correlations (from OPTIONAL MATCH with no matches)
    const correlations = rawCorrelations
      .filter(c => c.toSkillId !== null)
      .map(c => ({
        toSkillId: c.toSkillId!,
        strength: c.strength,
        correlationType: c.correlationType,
      }));

    nodes.set(skillId, {
      skillId,
      categoryId,
      parentId,
      correlations,
    });
  }

  return { nodes };
}

/**
 * Loads the domain graph with hierarchy relationships.
 *
 * Includes:
 * - CHILD_OF parent relationships (for both business and technical domains)
 * - ENCOMPASSES relationships (for technical domains like Full Stack)
 */
export async function loadDomainGraph(session: Session): Promise<DomainGraph> {
  // Load business domains
  const businessQuery = `
    MATCH (d:BusinessDomain)
    OPTIONAL MATCH (d)-[:CHILD_OF]->(parent:BusinessDomain)
    RETURN d.id AS domainId,
           parent.id AS parentId
  `;

  const businessResult = await session.run(businessQuery);
  const businessDomains = new Map<string, DomainGraphNode>();

  for (const record of businessResult.records) {
    const domainId = record.get('domainId') as string;
    const parentId = record.get('parentId') as string | null;

    businessDomains.set(domainId, {
      domainId,
      parentId,
      encompassedBy: [], // Business domains don't have ENCOMPASSES relationships
    });
  }

  // Load technical domains with ENCOMPASSES relationships
  const technicalQuery = `
    MATCH (d:TechnicalDomain)
    OPTIONAL MATCH (d)-[:CHILD_OF]->(parent:TechnicalDomain)
    OPTIONAL MATCH (d)<-[:ENCOMPASSES]-(container:TechnicalDomain)
    RETURN d.id AS domainId,
           parent.id AS parentId,
           COLLECT(DISTINCT container.id) AS encompassedBy
  `;

  const technicalResult = await session.run(technicalQuery);
  const technicalDomains = new Map<string, DomainGraphNode>();

  for (const record of technicalResult.records) {
    const domainId = record.get('domainId') as string;
    const parentId = record.get('parentId') as string | null;
    const encompassedBy = (record.get('encompassedBy') as (string | null)[])
      .filter((id): id is string => id !== null);

    technicalDomains.set(domainId, {
      domainId,
      parentId,
      encompassedBy,
    });
  }

  return { businessDomains, technicalDomains };
}
