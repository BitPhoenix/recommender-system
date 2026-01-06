/**
 * Compatibility Constraints Configuration (Section 5.2, p.174)
 *
 * Compatibility constraints are INDIRECT mappings that relate customer
 * attributes/requirements to typically expected product requirements.
 *
 * From the textbook:
 * "Such conditions are also referred to as compatibility conditions, because they
 * can be used to quickly discover inconsistencies in the user-specified requirements."
 *
 * Textbook example: "Family-Size≥5 ⇒ Min-Bedrooms≥3"
 * Codebase example: "requiredSeniority=senior ⇒ yearsExperience≥6"
 */

import type {
  SeniorityMapping,
  TeamFocusSkillAlignmentMapping,
} from '../../types/knowledge-base.types.js';

/**
 * Seniority Level Mappings (Section 5.2, p.174)
 *
 * Maps manager's seniority requirements to years of experience constraints.
 * This is an indirect mapping because "seniority" is an abstract customer
 * requirement that gets translated into concrete product attribute constraints.
 *
 * Indirect mapping: requiredSeniority=senior ⇒ yearsExperience≥6
 */
export const seniorityMapping: SeniorityMapping = {
  junior: { minYears: 0, maxYears: 3 },
  mid: { minYears: 3, maxYears: 6 },
  senior: { minYears: 6, maxYears: 10 },
  staff: { minYears: 10, maxYears: null },
  principal: { minYears: 15, maxYears: null },
};

/**
 * Team Focus Skill Alignment (Section 5.2, p.174)
 *
 * Maps team focus to skills that are contextually relevant.
 * This is an indirect mapping because the team's focus area implies
 * certain skills would be more valuable, even if not explicitly requested.
 *
 * Indirect mapping: teamFocus=greenfield ⇒ boost for ambiguity/creativity skills
 */
export const teamFocusSkillAlignment: TeamFocusSkillAlignmentMapping = {
  greenfield: {
    alignedSkillIds: [
      'skill_ambiguity',
      'skill_creativity',
      'skill_ownership',
      'skill_system_design',
    ],
    rationale: 'New projects require navigating unclear requirements',
  },
  migration: {
    alignedSkillIds: [
      'skill_system_design',
      'skill_debugging',
      'skill_attention_detail',
      'skill_documentation',
    ],
    rationale: 'Understanding both old and new systems',
  },
  maintenance: {
    alignedSkillIds: [
      'skill_debugging',
      'skill_root_cause',
      'skill_documentation',
      'skill_code_review',
    ],
    rationale: 'Bug fixing and quality gates',
  },
  scaling: {
    alignedSkillIds: [
      'skill_distributed',
      'skill_system_design',
      'skill_monitoring',
      'skill_kafka',
    ],
    rationale: 'Performance and scalability expertise',
  },
};
