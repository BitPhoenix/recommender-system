/**
 * Skill Resolution Service
 * Coordinates resolution of both required and preferred skills for search queries.
 */

import type { Session } from "neo4j-driver";
import type {
  ProficiencyLevel,
  SkillRequirement,
} from "../types/search.types.js";
import {
  resolveSkillRequirements,
  type ResolvedSkillWithProficiency,
} from "./skill-resolver.service.js";
import type { SkillProficiencyGroups } from "./cypher-query-builder/index.js";

/** Result of resolving both required and preferred skills */
export interface SkillResolutionResult {
  /** From required skills (for query building) */
  skillGroups: SkillProficiencyGroups;
  /** All required skill IDs (for coverage calculation in utility scoring) */
  requiredSkillIds: string[];
  expandedSkillNames: string[];
  unresolvedSkills: string[];
  originalSkillIdentifiers: string[];
  /** From preferred skills (for ranking) */
  preferredSkillIds: string[];
  /** Merged from both (for utility calculation) */
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>;
  /** Raw resolved required skills (for constraint expander) */
  resolvedRequiredSkills: ResolvedSkillWithProficiency[];
  /** Raw resolved preferred skills (for constraint expander) */
  resolvedPreferredSkills: ResolvedSkillWithProficiency[];
}

/**
 * Groups resolved skills by their minProficiency level for efficient query filtering.
 * Returns three arrays: skills requiring 'learning', 'proficient', or 'expert' minimum.
 */
export function groupSkillsByProficiency(
  resolvedSkills: ResolvedSkillWithProficiency[]
): SkillProficiencyGroups {
  const learningLevelSkillIds: string[] = [];
  const proficientLevelSkillIds: string[] = [];
  const expertLevelSkillIds: string[] = [];

  for (const skill of resolvedSkills) {
    switch (skill.minProficiency) {
      case "learning":
        learningLevelSkillIds.push(skill.skillId);
        break;
      case "proficient":
        proficientLevelSkillIds.push(skill.skillId);
        break;
      case "expert":
        expertLevelSkillIds.push(skill.skillId);
        break;
    }
  }

  return {
    learningLevelSkillIds,
    proficientLevelSkillIds,
    expertLevelSkillIds,
  };
}

/**
 * Resolves both required and preferred skills, returning all data needed for query building and ranking.
 */
export async function resolveAllSkills(
  session: Session,
  requiredSkills: SkillRequirement[] | undefined,
  preferredSkills: SkillRequirement[] | undefined,
  defaultProficiency: ProficiencyLevel
): Promise<SkillResolutionResult> {
  // Defaults for when no skills are provided
  let skillGroups: SkillProficiencyGroups = {
    learningLevelSkillIds: [],
    proficientLevelSkillIds: [],
    expertLevelSkillIds: [],
  };
  let resolvedRequiredSkills: ResolvedSkillWithProficiency[] = [];
  let expandedSkillNames: string[] = [];
  let unresolvedSkills: string[] = [];
  let originalSkillIdentifiers: string[] = [];
  let preferredSkillIds: string[] = [];
  const skillIdToPreferredProficiency = new Map<string, ProficiencyLevel>();

  // Resolve required skills
  if (requiredSkills && requiredSkills.length > 0) {
    const result = await resolveSkillRequirements(
      session,
      requiredSkills,
      defaultProficiency
    );
    resolvedRequiredSkills = result.resolvedSkills;
    skillGroups = groupSkillsByProficiency(resolvedRequiredSkills);
    expandedSkillNames = result.expandedSkillNames;
    unresolvedSkills = result.unresolvedIdentifiers;
    originalSkillIdentifiers = result.originalIdentifiers;

    // Add preferred proficiencies from required skills
    for (const skill of result.resolvedSkills) {
      if (skill.preferredMinProficiency) {
        skillIdToPreferredProficiency.set(
          skill.skillId,
          skill.preferredMinProficiency
        );
      }
    }
  }

  // Resolve preferred skills
  let resolvedPreferredSkills: ResolvedSkillWithProficiency[] = [];
  if (preferredSkills && preferredSkills.length > 0) {
    const result = await resolveSkillRequirements(
      session,
      preferredSkills,
      defaultProficiency
    );
    resolvedPreferredSkills = result.resolvedSkills;
    preferredSkillIds = resolvedPreferredSkills.map((s) => s.skillId);

    // Add preferred proficiencies (don't override existing from required)
    for (const skill of resolvedPreferredSkills) {
      if (
        skill.preferredMinProficiency &&
        !skillIdToPreferredProficiency.has(skill.skillId)
      ) {
        skillIdToPreferredProficiency.set(
          skill.skillId,
          skill.preferredMinProficiency
        );
      }
    }
  }

  const requiredSkillIds = resolvedRequiredSkills.map((s) => s.skillId);

  return {
    skillGroups,
    requiredSkillIds,
    expandedSkillNames,
    unresolvedSkills,
    originalSkillIdentifiers,
    preferredSkillIds,
    skillIdToPreferredProficiency,
    resolvedRequiredSkills,
    resolvedPreferredSkills,
  };
}
