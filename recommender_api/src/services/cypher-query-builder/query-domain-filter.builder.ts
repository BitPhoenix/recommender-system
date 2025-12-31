/**
 * Builds domain filtering clauses for Cypher queries.
 * Consolidates the domain filter logic used across search and count queries.
 */

import type { CypherQueryParams } from "./query-types.js";

export interface DomainFilterContext {
  hasRequiredDomains: boolean;
  hasPreferredDomains: boolean;
}

export function getDomainFilterContext(
  params: CypherQueryParams
): DomainFilterContext {
  return {
    hasRequiredDomains:
      params.requiredDomainIds !== undefined &&
      params.requiredDomainIds.length > 0,
    hasPreferredDomains:
      params.preferredDomainIds !== undefined &&
      params.preferredDomainIds.length > 0,
  };
}

export function addDomainQueryParams(
  queryParams: Record<string, unknown>,
  params: CypherQueryParams,
  context: DomainFilterContext
): void {
  if (context.hasRequiredDomains) {
    queryParams.requiredDomainIds = params.requiredDomainIds;
  }
  if (context.hasPreferredDomains) {
    queryParams.preferredDomainIds = params.preferredDomainIds;
  }
}

export function buildRequiredDomainFilterClause(
  context: DomainFilterContext,
  useDistinct: boolean
): string {
  if (!context.hasRequiredDomains) {
    return "";
  }

  const withClause = useDistinct ? "WITH DISTINCT e" : "WITH e";

  return `
// Domain filter: must have at least one required domain
MATCH (e)-[:HAS]->(:EngineerSkill)-[:FOR]->(domainSkill:Skill)
WHERE domainSkill.id IN $requiredDomainIds
${withClause}`;
}

export function buildPreferredDomainCollectionClause(
  context: DomainFilterContext,
  carryoverFields: string[]
): string {
  const carryover = carryoverFields.join(", ");

  if (context.hasPreferredDomains) {
    return `
// Collect matched preferred domains for scoring
OPTIONAL MATCH (e)-[:HAS]->(:EngineerSkill)-[:FOR]->(prefDomain:Skill)
WHERE prefDomain.id IN $preferredDomainIds
WITH e, ${carryover},
     COLLECT(DISTINCT prefDomain.name) AS matchedDomainNames`;
  }

  return `
WITH e, ${carryover},
     [] AS matchedDomainNames`;
}
