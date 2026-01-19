/**
 * Pattern Mining Utilities
 *
 * Shared functions for dynamic critique generation.
 */

import type { EngineerMatch } from '../../types/search.types.js';

/**
 * Count skill occurrences across engineer matches.
 * Used by both single-attribute skill mining and compound pattern mining.
 */
export function countSkillOccurrencesAcrossEngineerMatches(
  engineerMatches: EngineerMatch[]
): Map<string, { count: number; name: string }> {
  const skillOccurrences = new Map<string, { count: number; name: string }>();

  for (const engineerMatch of engineerMatches) {
    for (const skill of engineerMatch.matchedSkills) {
      const existing = skillOccurrences.get(skill.skillId);
      if (existing) {
        existing.count++;
      } else {
        skillOccurrences.set(skill.skillId, { count: 1, name: skill.skillName });
      }
    }
  }

  return skillOccurrences;
}

/**
 * Capitalize first letter of a string.
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
