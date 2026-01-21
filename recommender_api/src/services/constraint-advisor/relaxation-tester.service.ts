import type { Session } from "neo4j-driver";
import {
  ConstraintType,
  type TestableConstraint,
  type DecomposedConstraints,
  type PropertyConstraint,
  type UserSkillConstraint,
} from "./constraint.types.js";
import { SkillFilterType, type ProficiencyLevel } from "../../types/search.types.js";
import { buildQueryWithConstraints, buildPropertyConditions } from "./constraint-decomposer.service.js";
import { buildSkillFilterCountQuery } from "../cypher-query-builder/index.js";
import { extractSkillConstraintsFromArray } from "./skill-extraction.utils.js";
import { toNumber } from "../engineer-record-parser.js";

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Test what result count we'd get with a relaxed value.
 */
export async function testRelaxedValue(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: PropertyConstraint,
  relaxedValue: unknown
): Promise<number> {
  /*
   * Create a modified decomposition with the relaxed value.
   * Only property constraints can be modified this way.
   */
  const modifiedConstraints = decomposedConstraints.constraints.map((c) => {
    if (c.id === constraint.id && c.constraintType === ConstraintType.Property) {
      return {
        ...c,
        cypher: {
          ...c.cypher,
          paramValue: relaxedValue,
        },
      };
    }
    return c;
  });

  const modifiedDecomposedConstraints = {
    ...decomposedConstraints,
    constraints: modifiedConstraints,
  };

  const allIds = new Set(modifiedConstraints.map((c) => c.id));
  const { query, params } = buildQueryWithConstraints(modifiedDecomposedConstraints, allIds);

  const result = await session.run(query, params);
  return toNumber(result.records[0]?.get("resultCount"));
}

/**
 * Test result count with a modified skill proficiency requirement.
 *
 * Uses unified skillFilterRequirements pattern to modify the proficiency
 * for the target skill and run a count query with all constraints.
 */
export async function testSkillRelaxation(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: UserSkillConstraint,
  modifiedSkill: { skill: string; minProficiency?: ProficiencyLevel }
): Promise<number> {
  const newProficiency: ProficiencyLevel = modifiedSkill.minProficiency ?? 'learning';

  // Extract unified skill filter requirements
  const { skillFilterRequirements } = extractSkillConstraintsFromArray(decomposedConstraints.constraints);

  // Modify the proficiency for the target skill
  const modifiedRequirements = skillFilterRequirements.map(requirement => {
    if (requirement.type === SkillFilterType.User && requirement.originalSkillId === constraint.value.skill) {
      return { ...requirement, minProficiency: newProficiency };
    }
    return requirement;
  });

  if (modifiedRequirements.length === 0) {
    return 0;
  }

  // Build property conditions
  const propertyConstraintIds = new Set(
    decomposedConstraints.constraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const propertyConditions = buildPropertyConditions(
    decomposedConstraints,
    propertyConstraintIds
  );

  // Build count query using unified requirements
  const { query, params } = buildSkillFilterCountQuery(modifiedRequirements, propertyConditions);

  // Execute and return count
  const result = await session.run(query, params);
  return toNumber(result.records[0]?.get('resultCount'));
}

/**
 * Test result count when a skill constraint is removed entirely.
 */
export async function testSkillRemoval(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: TestableConstraint
): Promise<number> {
  const allIds = new Set(decomposedConstraints.constraints.map((c) => c.id));
  allIds.delete(constraint.id);
  const { query, params } = buildQueryWithConstraints(decomposedConstraints, allIds);

  const result = await session.run(query, params);
  return toNumber(result.records[0]?.get("resultCount"));
}

