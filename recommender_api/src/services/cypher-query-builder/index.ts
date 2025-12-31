/**
 * Cypher Query Builder Service
 * Generates Neo4j Cypher queries based on expanded constraints.
 */

export type { CypherQueryParams, CypherQuery } from "./query-types.js";

import type { CypherQueryParams, CypherQuery } from "./query-types.js";
import { buildSkillSearchQuery } from "./skill-search-query.builder.js";
import { buildBrowseQuery } from "./browse-query.builder.js";
import { buildCountQuery } from "./count-query.builder.js";

export { buildCountQuery };

/**
 * Builds the unified search query for both skill search and browse modes.
 * Delegates to the appropriate builder based on whether skill filtering is active.
 */
export function buildSearchQuery(params: CypherQueryParams): CypherQuery {
  const hasSkillFilter =
    params.targetSkillIds !== null && params.targetSkillIds.length > 0;

  if (hasSkillFilter) {
    return buildSkillSearchQuery(params);
  }
  return buildBrowseQuery(params);
}
