/**
 * Domain Resolver Service
 * Resolves domain identifiers (names or IDs) and handles technical domain hierarchy.
 *
 * Follows similar patterns to skill-resolver.service.ts:
 * - Resolve identifiers to database IDs
 * - Handle hierarchy expansion (CHILD_OF, ENCOMPASSES)
 * - Return resolved data with expansion info
 */

import { Session } from 'neo4j-driver';
import type {
  BusinessDomainRequirement,
  TechnicalDomainRequirement,
} from '../schemas/search.schema.js';
import type {
  ResolvedBusinessDomain,
  ResolvedTechnicalDomain,
} from './cypher-query-builder/query-types.js';

/**
 * Resolves business domain identifiers with hierarchy expansion.
 *
 * For CHILD_OF: If user requests "Finance", expands to include Finance + all children
 * (Fintech, Banking, Payments, Insurance) so engineers with child experience match.
 */
export async function resolveBusinessDomains(
  session: Session,
  requirements: BusinessDomainRequirement[] | undefined
): Promise<ResolvedBusinessDomain[]> {
  if (!requirements || requirements.length === 0) {
    return [];
  }

  const resolved: ResolvedBusinessDomain[] = [];

  for (const req of requirements) {
    // Find the domain by ID or name
    const domainResult = await session.run(
      `MATCH (d:BusinessDomain)
       WHERE d.id = $identifier OR d.name = $identifier
       RETURN d.id AS domainId`,
      { identifier: req.domain }
    );

    if (domainResult.records.length === 0) continue;

    const domainId = domainResult.records[0].get('domainId') as string;

    // Get self + all descendants (CHILD_OF)
    const descendantsResult = await session.run(
      `MATCH (d:BusinessDomain {id: $domainId})
       OPTIONAL MATCH (child:BusinessDomain)-[:CHILD_OF*1..]->(d)
       RETURN d.id AS selfId, COLLECT(DISTINCT child.id) AS childIds`,
      { domainId }
    );

    const record = descendantsResult.records[0];
    const childIds = (record.get('childIds') as string[]).filter(
      (id) => id !== null
    );
    const expandedDomainIds = [domainId, ...childIds];

    resolved.push({
      domainId,
      expandedDomainIds,
      minYears: req.minYears,
      preferredMinYears: req.preferredMinYears,
    });
  }

  return resolved;
}

/**
 * Resolves technical domain identifiers with hierarchy expansion.
 *
 * For CHILD_OF: If user requests "Backend", expands to include Backend + all children
 * (API Development, Database Engineering, etc.) so engineers with child experience match.
 *
 * For ENCOMPASSES: If user requests "Full Stack", expands to Backend + Frontend
 * so engineers with Full Stack show they have both.
 */
export async function resolveTechnicalDomains(
  session: Session,
  requirements: TechnicalDomainRequirement[] | undefined
): Promise<ResolvedTechnicalDomain[]> {
  if (!requirements || requirements.length === 0) {
    return [];
  }

  const resolved: ResolvedTechnicalDomain[] = [];

  for (const req of requirements) {
    // Find the domain by ID or name
    const domainResult = await session.run(
      `MATCH (d:TechnicalDomain)
       WHERE d.id = $identifier OR d.name = $identifier
       RETURN d.id AS domainId, d.isComposite AS isComposite`,
      { identifier: req.domain }
    );

    if (domainResult.records.length === 0) continue;

    const domainId = domainResult.records[0].get('domainId') as string;
    const isComposite = domainResult.records[0].get('isComposite') as boolean;

    let expandedDomainIds: string[];

    if (isComposite) {
      // For composite domains (Full Stack), get encompassed domains
      const encompassedResult = await session.run(
        `MATCH (composite:TechnicalDomain {id: $domainId})-[:ENCOMPASSES]->(encompassed:TechnicalDomain)
         RETURN encompassed.id AS encompassedId`,
        { domainId }
      );
      expandedDomainIds = [
        domainId,
        ...encompassedResult.records.map(
          (r) => r.get('encompassedId') as string
        ),
      ];
    } else {
      // For regular domains, get self + all descendants (CHILD_OF)
      const descendantsResult = await session.run(
        `MATCH (d:TechnicalDomain {id: $domainId})
         OPTIONAL MATCH (child:TechnicalDomain)-[:CHILD_OF*1..]->(d)
         RETURN d.id AS selfId, COLLECT(DISTINCT child.id) AS childIds`,
        { domainId }
      );
      const record = descendantsResult.records[0];
      const childIds = (record.get('childIds') as string[]).filter(
        (id) => id !== null
      );
      expandedDomainIds = [domainId, ...childIds];
    }

    resolved.push({
      domainId,
      expandedDomainIds,
      minYears: req.minYears,
      preferredMinYears: req.preferredMinYears,
    });
  }

  return resolved;
}
