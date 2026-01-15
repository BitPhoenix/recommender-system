import { START_TIMELINE_ORDER, type ProficiencyLevel } from "../../types/search.types.js";

/**
 * Relaxation strategy types.
 * Each type defines how to generate relaxed values for a constraint.
 */
export enum RelaxationStrategyType {
  /** Multiply current value by step factors (up or down based on operator) */
  NumericStep = "numeric-step",
  /** Expand to include more values from an ordered enum */
  EnumExpand = "enum-expand",
  /** Suggest removing the constraint entirely */
  Remove = "remove",
  /** Suggest overriding the inference rule */
  DerivedOverride = "derived-override",
  /** Skill-specific relaxations (lower proficiency, move to preferred, remove) */
  SkillRelaxation = "skill-relaxation",
}

/**
 * Base strategy interface.
 */
interface BaseStrategy {
  type: RelaxationStrategyType;
}

/**
 * Numeric step strategy - multiply current value by step factors.
 * Direction determines whether we're relaxing up (for <= constraints)
 * or down (for >= constraints).
 */
export interface NumericStepStrategy extends BaseStrategy {
  type: RelaxationStrategyType.NumericStep;
  /** Step multipliers to try (e.g., [0.7, 0.5] for stepping down) */
  stepsDown: number[];
  /** Step multipliers for stepping up (e.g., [1.2, 1.5]) */
  stepsUp: number[];
  /** Template for rationale. Placeholders: {current}, {suggested}, {direction} */
  rationaleTemplate: string;
  /** Optional: field name to use in suggestion (defaults to constraint field) */
  suggestedField?: string;
}

/**
 * Enum expand strategy - expand to include more values from an ordered enum.
 */
export interface EnumExpandStrategy extends BaseStrategy {
  type: RelaxationStrategyType.EnumExpand;
  /** The ordered enum values */
  enumOrder: readonly string[];
  /** Maximum number of expansion steps to suggest */
  maxExpansion: number;
  /** Template for rationale. Placeholders: {expanded} */
  rationaleTemplate: string;
  /** Field name to use in suggestion */
  suggestedField: string;
}

/**
 * Remove strategy - suggest removing the constraint entirely.
 */
export interface RemoveStrategy extends BaseStrategy {
  type: RelaxationStrategyType.Remove;
  /** Template for rationale. Placeholders: {current} */
  rationaleTemplate: string;
  /** Field name to use in suggestion */
  suggestedField: string;
}

/**
 * Derived override strategy - suggest overriding the inference rule.
 */
export interface DerivedOverrideStrategy extends BaseStrategy {
  type: RelaxationStrategyType.DerivedOverride;
  /** Template for rationale. Placeholders: {displayValue} */
  rationaleTemplate: string;
}

/**
 * Skill relaxation strategy - suggests ways to relax skill requirements.
 * Generates multiple suggestions:
 * - Lower proficiency threshold (expert → proficient → learning)
 * - Move required skill to preferred
 * - Remove one of multiple required skills
 */
export interface SkillRelaxationStrategy extends BaseStrategy {
  type: RelaxationStrategyType.SkillRelaxation;
  /** Ordered proficiency levels from highest to lowest */
  proficiencyOrder: readonly ProficiencyLevel[];
  /** Rationale templates for each relaxation type */
  rationales: {
    lowerProficiency: string;
    moveToPreferred: string;
    removeSkill: string;
  };
}

export type RelaxationStrategy =
  | NumericStepStrategy
  | EnumExpandStrategy
  | RemoveStrategy
  | DerivedOverrideStrategy
  | SkillRelaxationStrategy;

/**
 * Relaxation strategies by field name.
 * Adding a new constraint type = adding an entry here.
 *
 * Note: yearsExperience was removed - there's no corresponding API field.
 * The salary constraint maps to maxBudget via suggestedField config.
 */
export const fieldToRelaxationStrategy: Record<string, RelaxationStrategy> = {
  salary: {
    type: RelaxationStrategyType.NumericStep,
    stepsDown: [0.8, 0.6], // unlikely to use, but symmetric
    stepsUp: [1.2, 1.5],
    rationaleTemplate: "Increase budget from ${current} to ${suggested}",
    suggestedField: "maxBudget",
  },

  startTimeline: {
    type: RelaxationStrategyType.EnumExpand,
    enumOrder: START_TIMELINE_ORDER,
    maxExpansion: 2,
    rationaleTemplate: "Expand start timeline to include {expanded}",
    suggestedField: "requiredMaxStartTime",
  },

  timezone: {
    type: RelaxationStrategyType.Remove,
    rationaleTemplate: "Remove timezone restriction (currently: {current}*)",
    suggestedField: "requiredTimezone",
  },

  derivedSkills: {
    type: RelaxationStrategyType.DerivedOverride,
    rationaleTemplate: "Override inference rule: {displayValue}",
  },

  requiredSkills: {
    type: RelaxationStrategyType.SkillRelaxation,
    proficiencyOrder: ["expert", "proficient", "learning"],
    rationales: {
      lowerProficiency: "Lower {skill} proficiency from {current} to {suggested}",
      moveToPreferred: "Move {skill} from required to preferred",
      removeSkill: "Remove {skill} requirement",
    },
  },
};
