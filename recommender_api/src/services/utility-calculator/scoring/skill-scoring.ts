/**
 * Skill Scoring Functions
 * Calculates utility scores for skill matches.
 */

import type { MatchedSkill, UnmatchedRelatedSkill, ProficiencyLevel } from '../../../types/search.types.js';
import type {
  SkillMatchResult,
  PreferredSkillsMatchResult,
  TeamFocusMatchResult,
  RelatedSkillsMatchResult,
} from '../types.js';

/**
 * Unified skill match scoring that combines coverage and proficiency matching.
 *
 * Function type: GRADUATED LINEAR (per-skill proficiency scoring)
 * Formula: average of (actual_level + 1) / (preferred_level + 1) across all skills
 *
 * Rationale: This unified approach replaces two separate mechanisms that were
 * unprincipled. By scoring each skill based on how close the engineer's proficiency
 * is to the preferred level, we get intuitive graduated credit: an engineer with
 * "proficient" when you wanted "expert" gets 2/3 credit, not zero.
 *
 * For each requested skill:
 * - If engineer doesn't have it: 0 credit
 * - If engineer has it with no preferred proficiency: 1.0 credit (full)
 * - If engineer has it with preferred proficiency: graduated credit (actual+1)/(preferred+1)
 *
 * Final score = average credit across all requested skills.
 *
 * Score table (when preference specified):
 *   | Preferred | learning | proficient | expert |
 *   |-----------|----------|------------|--------|
 *   | expert    | 0.33     | 0.67       | 1.0    |
 *   | proficient| 0.50     | 1.0        | 1.0    |
 *   | learning  | 1.0      | 1.0        | 1.0    |
 *
 * When no preference specified: full credit (1.0) for having the skill.
 */
export function calculateSkillMatch(
  matchedSkills: MatchedSkill[],
  requiredSkillIds: string[],
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>
): SkillMatchResult {
  if (requiredSkillIds.length === 0) {
    return { score: 0.5, skillsExceedingPreferred: [] };
  }

  const proficiencyOrder: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];
  const skillsExceedingPreferred: string[] = [];
  let totalCredit = 0;

  // Build a map for O(1) lookup
  const matchedSkillMap = new Map(matchedSkills.map(s => [s.skillId, s]));

  for (const skillId of requiredSkillIds) {
    const matchedSkill = matchedSkillMap.get(skillId);

    if (!matchedSkill) {
      // Skill not matched - zero credit (already filtered by Cypher, but handle edge cases)
      continue;
    }

    const preferredLevel = skillIdToPreferredProficiency.get(skillId);

    if (preferredLevel) {
      // Has preferred proficiency: use graduated linear scoring
      const preferredIndex = proficiencyOrder.indexOf(preferredLevel);
      const actualIndex = proficiencyOrder.indexOf(matchedSkill.proficiencyLevel as ProficiencyLevel);
      const credit = Math.min(1.0, (actualIndex + 1) / (preferredIndex + 1));
      totalCredit += credit;

      // Track for display
      if (actualIndex >= preferredIndex) {
        skillsExceedingPreferred.push(matchedSkill.skillName);
      }
    } else {
      // No preferred proficiency specified: full credit for having the skill
      totalCredit += 1.0;
    }
  }

  const score = totalCredit / requiredSkillIds.length;

  return { score, skillsExceedingPreferred };
}

/**
 * Calculates preferred skills match utility with matched skill details.
 * Engineers with preferred skills get a ranking boost.
 *
 * Function type: RATIO (linear proportion)
 * Formula: matched / requested, capped at max
 *
 * Rationale: Each preferred item is an explicit user wish with equal weight.
 * Matching 2 of 4 preferred skills is genuinely twice as good as matching 1 of 4 -
 * there's no diminishing returns on satisfying stated preferences.
 */
export function calculatePreferredSkillsMatch(
  matchedSkills: MatchedSkill[],
  preferredSkillIds: string[],
  maxMatch: number
): PreferredSkillsMatchResult {
  if (preferredSkillIds.length === 0) {
    return { raw: 0, matchedSkillNames: [] };
  }

  // Find which preferred skills the engineer has
  const matchingPreferredSkills = matchedSkills.filter((skill) =>
    preferredSkillIds.includes(skill.skillId)
  );

  // Normalize by the number of preferred skills, capped at maxMatch
  const matchRatio = matchingPreferredSkills.length / preferredSkillIds.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedSkillNames: matchingPreferredSkills.map((s) => s.skillName),
  };
}

/**
 * Calculates team focus match utility with matched skill details.
 *
 * Function type: RATIO (linear proportion)
 * Formula: matched / requested, capped at max (0.5)
 *
 * Rationale: Team alignment is a tiebreaker, not a primary criterion. We use the
 * same ratio logic as preferred skills but cap at 0.5 so "matches team stack"
 * doesn't outweigh "has the actual required skills."
 */
export function calculateTeamFocusMatch(
  matchedSkills: MatchedSkill[],
  alignedSkillIds: string[],
  maxMatch: number
): TeamFocusMatchResult {
  if (alignedSkillIds.length === 0) {
    return { raw: 0, matchedSkillNames: [] };
  }

  // Find which aligned skills the engineer has
  const matchingAlignedSkills = matchedSkills.filter((skill) =>
    alignedSkillIds.includes(skill.skillId)
  );

  // Normalize by the number of aligned skills, capped at maxMatch
  const matchRatio = matchingAlignedSkills.length / alignedSkillIds.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedSkillNames: matchingAlignedSkills.map((s) => s.skillName),
  };
}

/**
 * Calculates related skills match utility.
 * Engineers with more unmatched related skills (below threshold) get a small match score
 * to reward breadth of experience in the skill hierarchy.
 *
 * Function type: EXPONENTIAL DECAY
 * Formula: (1 - e^(-count/scale)) * max
 *
 * Rationale: Having 1-2 related skills signals learning agility and T-shaped breadth.
 * But accumulating 10+ doesn't make someone twice as valuable as having 5 - it just
 * means a longer resume. We reward breadth but don't let it dominate.
 */
export function calculateRelatedSkillsMatch(
  unmatchedRelatedSkills: UnmatchedRelatedSkill[],
  maxMatch: number
): RelatedSkillsMatchResult {
  const count = unmatchedRelatedSkills.length;

  if (count === 0) {
    return { raw: 0, count: 0 };
  }

  // Normalize: more unmatched skills = higher match score, capped at maxMatch
  // Use a diminishing returns curve: score increases quickly at first, then plateaus
  // Formula: 1 - e^(-count/maxMatch) gives nice curve from 0 to ~1
  const raw = Math.min((1 - Math.exp(-count / maxMatch)) * maxMatch, maxMatch);

  return { raw, count };
}
