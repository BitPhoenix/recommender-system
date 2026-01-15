import type { Session } from "neo4j-driver";
import {
  ConstraintType,
  type TestableConstraint,
  type DecomposedConstraints,
  type PropertyConstraint,
  type UserSkillConstraint,
} from "./constraint.types.js";
import type { ProficiencyLevel } from "../../types/search.types.js";
import { buildQueryWithConstraints, buildPropertyConditions } from "./constraint-decomposer.service.js";
import { groupSkillsByProficiency } from "../skill-resolution.service.js";
import { buildSkillFilterCountQuery } from "../cypher-query-builder/index.js";
import type { ResolvedSkillWithProficiency } from "../skill-resolver.service.js";
import { extractSkillConstraintsFromArray } from "./skill-extraction.utils.js";

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
  return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
}

/**
 * Test result count with a modified skill proficiency requirement.
 *
 * Uses the same proficiency logic as the main search query by:
 * 1. Converting constraints to skill format with modified proficiency
 * 2. Calling groupSkillsByProficiency (reuse)
 * 3. Calling buildPropertyConditions (reuse)
 * 4. Calling buildSkillFilterCountQuery (shared proficiency pattern)
 */
export async function testSkillRelaxation(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: UserSkillConstraint,
  modifiedSkill: { skill: string; minProficiency?: ProficiencyLevel }
): Promise<number> {
  const newProficiency: ProficiencyLevel = modifiedSkill.minProficiency ?? 'learning';

  // Extract all skill IDs in a single pass
  const { userRequiredSkills, derivedSkillIds } = extractSkillConstraintsFromArray(decomposedConstraints.constraints);

  // Apply modified proficiency for the constraint we're testing
  const skills = modifySkillProficiency(userRequiredSkills, constraint.value.skill, newProficiency);

  if (skills.length === 0) {
    return 0;
  }

  // Group by proficiency using EXISTING function (no duplication)
  const skillGroups = groupSkillsByProficiency(skills);

  // Build property conditions using EXISTING function (no duplication)
  // Get all property constraint IDs (exclude skill constraints)
  const propertyConstraintIds = new Set(
    decomposedConstraints.constraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const propertyConditions = buildPropertyConditions(
    decomposedConstraints,
    propertyConstraintIds
  );

  // Build count query using SHARED proficiency pattern (no duplication)
  const { query, params } = buildSkillFilterCountQuery(skillGroups, propertyConditions, derivedSkillIds);

  // Execute and return count
  const result = await session.run(query, params);
  return result.records[0]?.get('resultCount')?.toNumber() ?? 0;
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
  return result.records[0]?.get("resultCount")?.toNumber() ?? 0;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/*
 * Returns a new skills array with the target skill's proficiency modified.
 * Used for "what-if" testing: what results would we get if we relaxed this skill's
 * proficiency requirement?
 */
function modifySkillProficiency(
  skills: ResolvedSkillWithProficiency[],
  targetSkillId: string,
  newProficiency: ProficiencyLevel
): ResolvedSkillWithProficiency[] {
  return skills.map(skill =>
    skill.skillId === targetSkillId
      ? { ...skill, minProficiency: newProficiency }
      : skill
  );
}
