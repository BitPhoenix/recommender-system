/**
 * Builds domain filtering clauses for Cypher queries.
 *
 * Supports the new domain model with:
 * - BusinessDomain nodes (flat, explicit claims with years)
 * - TechnicalDomain nodes (hierarchical with CHILD_OF and ENCOMPASSES)
 * - Skill inference via SkillCategory → TechnicalDomain chain
 */

import type { CypherQueryParams, CollectionClauseResult } from './query-types.js';

export interface DomainFilterContext {
  hasRequiredBusinessDomains: boolean;
  hasPreferredBusinessDomains: boolean;
  hasRequiredTechnicalDomains: boolean;
  hasPreferredTechnicalDomains: boolean;
  /** True if either required or preferred business domains exist */
  hasAnyBusinessDomains: boolean;
  /** True if either required or preferred technical domains exist */
  hasAnyTechnicalDomains: boolean;
}

export function getDomainFilterContext(
  params: CypherQueryParams
): DomainFilterContext {
  const hasRequiredBusinessDomains =
    (params.requiredBusinessDomains?.length ?? 0) > 0;
  const hasPreferredBusinessDomains =
    (params.preferredBusinessDomains?.length ?? 0) > 0;
  const hasRequiredTechnicalDomains =
    (params.requiredTechnicalDomains?.length ?? 0) > 0;
  const hasPreferredTechnicalDomains =
    (params.preferredTechnicalDomains?.length ?? 0) > 0;

  return {
    hasRequiredBusinessDomains,
    hasPreferredBusinessDomains,
    hasRequiredTechnicalDomains,
    hasPreferredTechnicalDomains,
    hasAnyBusinessDomains: hasRequiredBusinessDomains || hasPreferredBusinessDomains,
    hasAnyTechnicalDomains: hasRequiredTechnicalDomains || hasPreferredTechnicalDomains,
  };
}

/**
 * Adds domain query parameters for Neo4j.
 *
 * Passes domain constraints as arrays of objects. Neo4j supports iterating
 * over maps with ALL(x IN $arr WHERE x.field), so we keep related data together.
 */
export function addDomainQueryParams(
  queryParams: Record<string, unknown>,
  params: CypherQueryParams,
  context: DomainFilterContext
): void {
  // Business domain params - now with hierarchy expansion
  if (context.hasRequiredBusinessDomains && params.requiredBusinessDomains) {
    queryParams.requiredBusinessDomains = params.requiredBusinessDomains.map((d) => ({
      expandedDomainIds: d.expandedDomainIds,
      minYears: d.minYears ?? null,
    }));
  }

  if (context.hasPreferredBusinessDomains && params.preferredBusinessDomains) {
    queryParams.preferredBusinessDomains = params.preferredBusinessDomains.map((d) => ({
      domainId: d.domainId,
      expandedDomainIds: d.expandedDomainIds,
      minYears: d.preferredMinYears ?? null,
    }));
  }

  // Technical domain params
  if (context.hasRequiredTechnicalDomains && params.requiredTechnicalDomains) {
    queryParams.requiredTechDomains = params.requiredTechnicalDomains.map((d) => ({
      expandedDomainIds: d.expandedDomainIds,
      minYears: d.minYears ?? null,
    }));
  }

  if (context.hasPreferredTechnicalDomains && params.preferredTechnicalDomains) {
    queryParams.preferredTechDomains = params.preferredTechnicalDomains.map((d) => ({
      domainId: d.domainId,
      expandedDomainIds: d.expandedDomainIds,
      minYears: d.preferredMinYears ?? null,
    }));
  }

  // Add combined flat arrays for collection (union of required + preferred expanded IDs)
  if (context.hasAnyBusinessDomains) {
    const allBusinessExpandedIds: string[] = [];
    if (params.requiredBusinessDomains) {
      for (const d of params.requiredBusinessDomains) {
        allBusinessExpandedIds.push(...d.expandedDomainIds);
      }
    }
    if (params.preferredBusinessDomains) {
      for (const d of params.preferredBusinessDomains) {
        allBusinessExpandedIds.push(...d.expandedDomainIds);
      }
    }
    // Dedupe
    queryParams.allBusinessDomainIds = [...new Set(allBusinessExpandedIds)];
  }

  if (context.hasAnyTechnicalDomains) {
    const allTechExpandedIds: string[] = [];
    if (params.requiredTechnicalDomains) {
      for (const d of params.requiredTechnicalDomains) {
        allTechExpandedIds.push(...d.expandedDomainIds);
      }
    }
    if (params.preferredTechnicalDomains) {
      for (const d of params.preferredTechnicalDomains) {
        allTechExpandedIds.push(...d.expandedDomainIds);
      }
    }
    // Dedupe
    queryParams.allTechDomainIds = [...new Set(allTechExpandedIds)];
  }
}

/**
 * Builds required business domain filter with hierarchy support.
 *
 * Each required domain constraint must be satisfied (ALL). A constraint is satisfied
 * by experience in ANY of its expanded domain IDs (the requested domain + descendants).
 */
export function buildRequiredBusinessDomainFilter(
  context: DomainFilterContext
): string {
  if (!context.hasRequiredBusinessDomains) return '';

  return `
// Each constraint satisfied by experience in ANY of its expanded IDs (domain + descendants)
WITH e
WHERE ALL(constraint IN $requiredBusinessDomains WHERE
  EXISTS {
    MATCH (e)-[exp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    WHERE bd.id IN constraint.expandedDomainIds
    AND (constraint.minYears IS NULL OR exp.years >= constraint.minYears)
  }
)`;
}

/**
 * Builds required technical domain filter with hierarchy support AND skill inference.
 *
 * Each required domain constraint must be satisfied (ALL). A constraint is satisfied by:
 * 1. Explicit HAS_EXPERIENCE_IN with sufficient years, OR
 * 2. Skills via SkillCategory chain with sufficient years
 *
 * ...in ANY of the constraint's expanded domain IDs (requested domain + descendants).
 */
export function buildRequiredTechnicalDomainFilter(
  context: DomainFilterContext
): string {
  if (!context.hasRequiredTechnicalDomains) return '';

  return `
// Each constraint satisfied by explicit claim OR skill inference in ANY expanded ID
WITH e
WHERE ALL(constraint IN $requiredTechDomains WHERE
  (
    // Option 1: Explicit domain experience claim
    EXISTS {
      MATCH (e)-[exp:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
      WHERE td.id IN constraint.expandedDomainIds
      AND (constraint.minYears IS NULL OR exp.years >= constraint.minYears)
    }
    OR
    // Option 2: Inferred from skills via SkillCategory → TechnicalDomain
    EXISTS {
      MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)-[:BELONGS_TO]->(:SkillCategory)-[:BELONGS_TO]->(td:TechnicalDomain)
      WHERE td.id IN constraint.expandedDomainIds
      AND (constraint.minYears IS NULL OR us.yearsUsed >= constraint.minYears)
    }
  )
)`;
}

/**
 * Collects matched business domains for scoring (with hierarchy).
 * Collects domains matching EITHER required OR preferred constraints.
 */
export function buildBusinessDomainCollection(
  context: DomainFilterContext,
  carryoverFields: string[]
): CollectionClauseResult {
  const carryover = carryoverFields.join(', ');

  if (context.hasAnyBusinessDomains) {
    return {
      clause: `
// Collect matched business domains (required OR preferred) for scoring
OPTIONAL MATCH (e)-[bdExp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
WHERE bd.id IN $allBusinessDomainIds
WITH e, ${carryover},
     COLLECT(DISTINCT {
       domainId: bd.id,
       domainName: bd.name,
       years: bdExp.years
     }) AS matchedBusinessDomains`,
      carryForwardFields: ["matchedBusinessDomains"]
    };
  }

  return {
    clause: `
WITH e, ${carryover},
     [] AS matchedBusinessDomains`,
    carryForwardFields: ["matchedBusinessDomains"]
  };
}

/**
 * Collects matched technical domains for scoring.
 * Includes both explicit claims AND skill-inferred experience via SkillCategory.
 * Collects domains matching EITHER required OR preferred constraints.
 *
 * For each matched domain, computes effective years as:
 * - Explicit claim years (if exists), OR
 * - MAX(yearsUsed) from skills in categories that map to that domain (inferred)
 */
export function buildTechnicalDomainCollection(
  context: DomainFilterContext,
  carryoverFields: string[]
): CollectionClauseResult {
  const carryover = carryoverFields.join(', ');

  if (context.hasAnyTechnicalDomains) {
    return {
      clause: `
// Collect explicit domain claims (required OR preferred)
OPTIONAL MATCH (e)-[explicitExp:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
WHERE td.id IN $allTechDomainIds
WITH e, ${carryover},
     COLLECT(DISTINCT CASE WHEN td IS NOT NULL THEN {
       domainId: td.id,
       domainName: td.name,
       years: explicitExp.years,
       source: 'explicit'
     } END) AS explicitDomains

// Collect skill-inferred domain experience via SkillCategory → TechnicalDomain
OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(:Skill)-[:BELONGS_TO]->(:SkillCategory)-[:BELONGS_TO]->(td:TechnicalDomain)
WHERE td.id IN $allTechDomainIds
WITH e, ${carryover}, explicitDomains,
     td.id AS inferredDomainId,
     td.name AS inferredDomainName,
     MAX(us.yearsUsed) AS inferredYears
WITH e, ${carryover}, explicitDomains,
     COLLECT(DISTINCT CASE WHEN inferredDomainId IS NOT NULL THEN {
       domainId: inferredDomainId,
       domainName: inferredDomainName,
       years: inferredYears,
       source: 'inferred'
     } END) AS inferredDomains

// Merge: explicit claims take precedence over inferred
WITH e, ${carryover},
     [d IN explicitDomains WHERE d IS NOT NULL] +
     [d IN inferredDomains WHERE d IS NOT NULL AND NOT d.domainId IN [x IN explicitDomains WHERE x IS NOT NULL | x.domainId]]
     AS matchedTechnicalDomains`,
      carryForwardFields: ["matchedTechnicalDomains"]
    };
  }

  return {
    clause: `
WITH e, ${carryover},
     [] AS matchedTechnicalDomains`,
    carryForwardFields: ["matchedTechnicalDomains"]
  };
}
