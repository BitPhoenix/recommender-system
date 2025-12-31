/**
 * Filter Conditions Configuration (Section 5.2, p.174)
 *
 * Filter conditions are DIRECT mappings that relate customer requirements
 * to hard requirements on product attributes.
 *
 * From the textbook:
 * "Such rules are also referred to as filter conditions."
 *
 * Textbook example: "Min-Bedrooms≥3 ⇒ Bedrooms≥3"
 * Codebase example: "requiredSkills=['typescript'] ⇒ skills contains 'typescript'"
 */

import type { ProficiencyMapping } from '../../types/knowledge-base.types.js';

/**
 * Proficiency Level Mappings (Section 5.2, p.174)
 *
 * Maps minimum proficiency requirements to allowed proficiency levels.
 * This is a direct mapping because the user requirement directly constrains
 * which product attribute values are acceptable.
 *
 * Direct mapping: requiredMinProficiency=proficient ⇒ proficiency∈['proficient','expert']
 */
export const proficiencyMapping: ProficiencyMapping = {
  learning: ['learning', 'proficient', 'expert'],
  proficient: ['proficient', 'expert'],
  expert: ['expert'],
};
