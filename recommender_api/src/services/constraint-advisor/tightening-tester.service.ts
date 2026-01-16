import type { Session } from "neo4j-driver";
import {
  ConstraintType,
  type DecomposedConstraints,
  type PropertyConstraint,
} from "./constraint.types.js";
import { buildPropertyConditions } from "./constraint-decomposer.service.js";
import { groupSkillsByProficiency } from "../skill-resolution.service.js";
import { buildSkillFilterCountQuery } from "../cypher-query-builder/index.js";
import type { ResolvedSkillWithProficiency } from "../skill-resolver.service.js";
import type { ProficiencyLevel } from "../../types/search.types.js";
import { extractSkillConstraints } from "./skill-extraction.utils.js";

// ============================================================================
// LOCAL TYPES
// ============================================================================

/**
 * Specification for a property condition to add to a query.
 * Used when testing the effect of adding a new constraint.
 */
export interface PropertyConditionSpec {
  field: string;
  operator: string;
  value: unknown;
  /** Key used for generating unique parameter names */
  paramKey: string;
}

/**
 * Context for running a constraint count query.
 * Encapsulates all inputs needed to build and execute either a skill-aware
 * or property-only count query.
 */
interface CountQueryContext {
  /** Pre-built property conditions (WHERE clauses and params) */
  propertyConditions: { whereClauses: string[]; params: Record<string, unknown> };
  /** User-specified skills with proficiency requirements */
  userRequiredSkills: ResolvedSkillWithProficiency[];
  /** Derived skill IDs (existence-only check) */
  derivedSkillIds: string[];
  /** Base MATCH clause for property-only fallback */
  baseMatchClause: string;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Test what result count we'd get with a tightened property value.
 * This is the inverse of testRelaxedValue - we're testing a STRICTER constraint.
 *
 * Example: If current maxBudget is $200k and we want to test $160k,
 * this runs a count query with all other constraints PLUS salary <= $160k.
 */
export async function testTightenedPropertyValue(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: PropertyConstraint,
  tightenedValue: unknown
): Promise<number> {
  /*
   * Create a modified decomposition with the tightened value.
   * This replaces the constraint's paramValue with the stricter value.
   */
  const modifiedConstraints = decomposedConstraints.constraints.map((c) => {
    if (c.id === constraint.id && c.constraintType === ConstraintType.Property) {
      return {
        ...c,
        cypher: {
          ...c.cypher,
          paramValue: tightenedValue,
        },
      };
    }
    return c;
  });

  const modifiedDecomposed: DecomposedConstraints = {
    ...decomposedConstraints,
    constraints: modifiedConstraints,
  };

  // Build property conditions from the modified constraints
  const propertyConstraintIds = new Set(
    modifiedConstraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const propertyConditions = buildPropertyConditions(modifiedDecomposed, propertyConstraintIds);

  // Extract skills from original decomposed (skills aren't modified)
  const { userRequiredSkills, derivedSkillIds } = extractSkillConstraints(decomposedConstraints);

  return runCountQuery(session, {
    propertyConditions,
    userRequiredSkills,
    derivedSkillIds,
    baseMatchClause: decomposedConstraints.baseMatchClause,
  });
}

/**
 * Test what result count we'd get with an ADDED property constraint.
 * Used when the user doesn't currently have a constraint on this field.
 *
 * Example: User has no timezone filter, we want to test adding "Eastern".
 */
export async function testAddedPropertyConstraint(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  condition: PropertyConditionSpec
): Promise<number> {
  /*
   * Build property conditions from existing constraints, then add the new one.
   */
  const allPropertyIds = new Set(
    decomposedConstraints.constraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const { whereClauses, params } = buildPropertyConditions(decomposedConstraints, allPropertyIds);

  // Add the new constraint
  const newParamName = `tighten_${condition.paramKey}`;
  const newClause = buildWhereClause(condition.field, condition.operator, newParamName);
  whereClauses.push(newClause);
  params[newParamName] = condition.value;

  // Extract skills from decomposed
  const { userRequiredSkills, derivedSkillIds } = extractSkillConstraints(decomposedConstraints);

  return runCountQuery(session, {
    propertyConditions: { whereClauses, params },
    userRequiredSkills,
    derivedSkillIds,
    baseMatchClause: decomposedConstraints.baseMatchClause,
  });
}

/**
 * Test what result count we'd get with an added skill requirement.
 * Used for skill tightening suggestions.
 */
export async function testAddedSkillConstraint(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  newSkillId: string,
  newSkillMinProficiency: ProficiencyLevel
): Promise<number> {
  // Get existing skills from constraints
  const { userRequiredSkills, derivedSkillIds } = extractSkillConstraints(decomposedConstraints);

  // Add the new skill
  const allSkills: ResolvedSkillWithProficiency[] = [
    ...userRequiredSkills,
    {
      skillId: newSkillId,
      skillName: newSkillId, // Name not needed for query
      minProficiency: newSkillMinProficiency,
      preferredMinProficiency: null,
    },
  ];

  // Build property conditions from all property constraints
  const propertyConstraintIds = new Set(
    decomposedConstraints.constraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const propertyConditions = buildPropertyConditions(decomposedConstraints, propertyConstraintIds);

  return runCountQuery(session, {
    propertyConditions,
    userRequiredSkills: allSkills,
    derivedSkillIds,
    baseMatchClause: decomposedConstraints.baseMatchClause,
  });
}

/**
 * Get count with ALL current constraints applied (no modifications).
 * Used as the baseline "total" for percentage calculations.
 */
export async function getBaselineCount(
  session: Session,
  decomposedConstraints: DecomposedConstraints
): Promise<number> {
  const { userRequiredSkills, derivedSkillIds } = extractSkillConstraints(decomposedConstraints);

  const propertyConstraintIds = new Set(
    decomposedConstraints.constraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const propertyConditions = buildPropertyConditions(decomposedConstraints, propertyConstraintIds);

  return runCountQuery(session, {
    propertyConditions,
    userRequiredSkills,
    derivedSkillIds,
    baseMatchClause: decomposedConstraints.baseMatchClause,
  });
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function buildWhereClause(field: string, operator: string, paramName: string): string {
  const cypherField = field === "salary" ? "e.salary" : `e.${field}`;

  switch (operator) {
    case "IN":
      return `${cypherField} IN $${paramName}`;
    case "STARTS WITH":
      return `${cypherField} STARTS WITH $${paramName}`;
    case "<=":
      return `${cypherField} <= $${paramName}`;
    case ">=":
      return `${cypherField} >= $${paramName}`;
    default:
      return `${cypherField} ${operator} $${paramName}`;
  }
}

/**
 * Executes a count query with the appropriate strategy based on skill presence.
 *
 * This is the SINGLE LOCATION for the skill-aware vs property-only decision.
 * All tester functions prepare a CountQueryContext and delegate here.
 *
 * Decision tree:
 * - If skills exist → buildSkillFilterCountQuery → skill-aware Cypher
 * - If no skills → simple property-only Cypher
 */
async function runCountQuery(
  session: Session,
  context: CountQueryContext
): Promise<number> {
  const { propertyConditions, userRequiredSkills, derivedSkillIds, baseMatchClause } = context;
  const hasSkills = userRequiredSkills.length > 0 || derivedSkillIds.length > 0;

  if (hasSkills) {
    const skillGroups = groupSkillsByProficiency(userRequiredSkills);
    const { query, params } = buildSkillFilterCountQuery(
      skillGroups,
      propertyConditions,
      derivedSkillIds
    );
    const result = await session.run(query, params);
    return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
  }

  // Property-only query
  const { whereClauses, params } = propertyConditions;
  const whereClause = whereClauses.length > 0
    ? `WHERE ${whereClauses.join("\n  AND ")}`
    : "";
  const query = `
${baseMatchClause}
${whereClause}
RETURN count(e) AS resultCount
`;

  const result = await session.run(query, params);
  return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
}
