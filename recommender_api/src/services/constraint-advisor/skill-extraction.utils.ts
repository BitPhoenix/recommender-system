import {
  ConstraintType,
  type TestableConstraint,
  type DecomposedConstraints,
  isUserSkillConstraint,
  isDerivedSkillConstraint,
} from "./constraint.types.js";
import type { SkillFilterRequirement } from "../cypher-query-builder/query-types.js";
import { SkillFilterType, type ProficiencyLevel } from "../../types/search.types.js";

/**
 * Result of extracting skills from decomposed constraints.
 * Returns unified skill filter requirements for both user and derived skills.
 */
export interface ExtractedSkillConstraints {
  /** Unified skill filter requirements (both user and derived) */
  skillFilterRequirements: SkillFilterRequirement[];
}

/**
 * Extracts skill constraints from decomposed constraints.
 *
 * SINGLE SOURCE OF TRUTH for skill extraction from DecomposedConstraints.
 * Used by relaxation-tester, tightening-tester, and tightening-generator.
 *
 * Returns unified SkillFilterRequirement[] matching the main search query pattern.
 */
export function extractSkillConstraints(
  decomposed: DecomposedConstraints
): ExtractedSkillConstraints {
  return extractSkillConstraintsFromArray(decomposed.constraints);
}

/**
 * Lower-level extraction from a constraints array.
 * Useful when you have constraints but not the full DecomposedConstraints object.
 */
export function extractSkillConstraintsFromArray(
  constraints: TestableConstraint[]
): ExtractedSkillConstraints {
  const skillFilterRequirements: SkillFilterRequirement[] = [];

  for (const constraint of constraints) {
    if (constraint.constraintType !== ConstraintType.SkillTraversal) continue;

    if (constraint.field === 'requiredSkills' && isUserSkillConstraint(constraint)) {
      const skillReq = constraint.value;
      skillFilterRequirements.push({
        expandedSkillIds: [skillReq.skill],
        originalSkillId: skillReq.skill,
        minProficiency: (skillReq.minProficiency ?? 'learning') as ProficiencyLevel,
        preferredMinProficiency: null,
        type: SkillFilterType.User,
      });
    } else if (constraint.field === 'derivedSkills' && isDerivedSkillConstraint(constraint)) {
      /*
       * Derived skills already have expanded IDs from constraint-expander.
       * Create a single requirement with all derived skill IDs. The derivedSkillIds
       * are the hierarchy-expanded IDs, so we use the first as originalSkillId.
       */
      const uniqueSkillIds = [...new Set(constraint.value)];
      if (uniqueSkillIds.length > 0) {
        skillFilterRequirements.push({
          expandedSkillIds: uniqueSkillIds,
          originalSkillId: uniqueSkillIds[0],
          minProficiency: 'learning', // Existence-only
          preferredMinProficiency: null,
          type: SkillFilterType.Derived,
        });
      }
    }
  }

  return { skillFilterRequirements };
}
