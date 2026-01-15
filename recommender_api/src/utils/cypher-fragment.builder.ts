/**
 * Shared utility for generating Cypher WHERE clause fragments.
 * Used by both query-conditions.builder.ts and constraint-advisor.
 */

export interface CypherFragment {
  clause: string;
  paramName: string;
  paramValue: unknown;
}

/**
 * Generate a Cypher WHERE clause fragment for a constraint.
 */
export function buildCypherFragment(
  field: string,
  operator: string,
  value: unknown,
  paramPrefix: string
): CypherFragment {
  const paramName = paramPrefix;

  switch (operator) {
    case "IN":
      return {
        clause: `e.${field} IN $${paramName}`,
        paramName,
        paramValue: value,
      };

    case ">=":
      return {
        clause: `e.${field} >= $${paramName}`,
        paramName,
        paramValue: value,
      };

    case "<":
      return {
        clause: `e.${field} < $${paramName}`,
        paramName,
        paramValue: value,
      };

    case "<=":
      return {
        clause: `e.${field} <= $${paramName}`,
        paramName,
        paramValue: value,
      };

    case "STARTS WITH":
      return {
        clause: `e.${field} STARTS WITH $${paramName}`,
        paramName,
        paramValue: value,
      };

    case "=":
      return {
        clause: `e.${field} = $${paramName}`,
        paramName,
        paramValue: value,
      };

    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}
