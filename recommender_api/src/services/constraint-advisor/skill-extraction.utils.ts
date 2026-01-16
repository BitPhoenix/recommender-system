import {
  ConstraintType,
  type TestableConstraint,
  type DecomposedConstraints,
  isUserSkillConstraint,
  isDerivedSkillConstraint,
} from "./constraint.types.js";
import type { ResolvedSkillWithProficiency } from "../skill-resolver.service.js";
import type { ProficiencyLevel } from "../../types/search.types.js";

/**
 * Result of extracting skills from decomposed constraints.
 * Separates user skills (with proficiency requirements) from derived skills (existence-only).
 */
export interface ExtractedSkillConstraints {
  /** User skills with proficiency requirements (checked via CASE pattern) */
  userRequiredSkills: ResolvedSkillWithProficiency[];
  /** Derived skills from inference rules (existence-only, no proficiency) */
  derivedSkillIds: string[];
}

/**
 * Extracts skill constraints from decomposed constraints.
 *
 * SINGLE SOURCE OF TRUTH for skill extraction from DecomposedConstraints.
 * Used by relaxation-tester, tightening-tester, and tightening-generator.
 *
 * Returns two categories with different query semantics:
 * - userRequiredSkills: Have proficiency requirements, checked via CASE pattern
 * - derivedSkillIds: Existence-only, checked via ALL(...WHERE EXISTS {...}) pattern
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
  const userRequiredSkills: ResolvedSkillWithProficiency[] = [];
  const derivedSkillIds: string[] = [];

  for (const constraint of constraints) {
    if (constraint.constraintType !== ConstraintType.SkillTraversal) continue;

    if (constraint.field === 'requiredSkills' && isUserSkillConstraint(constraint)) {
      const skillReq = constraint.value;
      userRequiredSkills.push({
        skillId: skillReq.skill,
        skillName: skillReq.skill,
        minProficiency: (skillReq.minProficiency ?? 'learning') as ProficiencyLevel,
        preferredMinProficiency: null,
      });
    } else if (constraint.field === 'derivedSkills' && isDerivedSkillConstraint(constraint)) {
      derivedSkillIds.push(...constraint.value);
    }
  }

  return {
    userRequiredSkills,
    derivedSkillIds: [...new Set(derivedSkillIds)],
  };
}
