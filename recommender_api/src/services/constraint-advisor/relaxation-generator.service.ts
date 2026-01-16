import type { Session } from "neo4j-driver";
import {
  ConstraintType,
  type TestableConstraint,
  type DecomposedConstraints,
  type NumericPropertyConstraint,
  type StringArrayPropertyConstraint,
  type UserSkillConstraint,
  isPropertyConstraint,
  isSkillTraversalConstraint,
  isNumericPropertyConstraint,
  isStringArrayPropertyConstraint,
  isUserSkillConstraint,
} from "./constraint.types.js";
import {
  RelaxationSuggestionType,
  SkillRelaxationAction,
  type RelaxationSuggestion,
  type BudgetRelaxation,
  type StartTimeRelaxation,
  type TimezoneRelaxation,
  type SkillRelaxation,
  type DerivedConstraintOverride,
} from "../../types/search.types.js";
import { buildQueryWithConstraints } from "./constraint-decomposer.service.js";
import {
  fieldToRelaxationStrategy,
  RelaxationStrategyType,
  type NumericStepStrategy,
  type EnumExpandStrategy,
  type RemoveStrategy,
  type DerivedOverrideStrategy,
  type SkillRelaxationStrategy,
} from "../../config/knowledge-base/relaxation-strategies.config.js";
import {
  testRelaxedValue,
  testSkillRelaxation,
  testSkillRemoval,
} from "./relaxation-tester.service.js";
import { toNumber } from "../engineer-record-parser.js";

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate relaxation suggestions for constraints in conflict sets.
 */
export async function generateRelaxationSuggestions(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  conflictingConstraints: TestableConstraint[]
): Promise<RelaxationSuggestion[]> {
  const allRelaxationSuggestions: RelaxationSuggestion[] = [];

  for (const conflictingConstraint of conflictingConstraints) {
    const constraintRelaxationSuggestions = await generateRelaxationsForConstraint(
      session,
      decomposedConstraints,
      conflictingConstraint
    );
    allRelaxationSuggestions.push(...constraintRelaxationSuggestions);
  }

  // Sort by impact (most results first)
  allRelaxationSuggestions.sort((a, b) => b.resultingMatches - a.resultingMatches);

  return allRelaxationSuggestions;
}

/*
 * Generate relaxations for a single constraint using its configured strategy.
 *
 * We need both decomposedConstraints and conflictingConstraint because relaxation
 * testing asks: "If we relax THIS ONE constraint, how many results would we get
 * with ALL the other constraints still applied?"
 *
 * Without the full constraint context, resultingMatches would be meaningless—it
 * would tell the user "relaxing X gives N results" while ignoring their other
 * requirements entirely.
 */
async function generateRelaxationsForConstraint(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  conflictingConstraint: TestableConstraint
): Promise<RelaxationSuggestion[]> {
  const strategy = fieldToRelaxationStrategy[conflictingConstraint.field];

  if (!strategy) {
    // No strategy configured for this field - no suggestions
    return [];
  }

  switch (strategy.type) {
    case RelaxationStrategyType.NumericStep:
      if (isPropertyConstraint(conflictingConstraint) &&
          isNumericPropertyConstraint(conflictingConstraint)) {
        return applyNumericStepStrategy(session, decomposedConstraints, conflictingConstraint, strategy);
      }
      return [];

    case RelaxationStrategyType.EnumExpand:
      if (isPropertyConstraint(conflictingConstraint) &&
          isStringArrayPropertyConstraint(conflictingConstraint)) {
        return applyEnumExpandStrategy(session, decomposedConstraints, conflictingConstraint, strategy);
      }
      return [];

    case RelaxationStrategyType.Remove:
      return applyRemoveStrategy(session, decomposedConstraints, conflictingConstraint, strategy);

    case RelaxationStrategyType.DerivedOverride:
      return applyDerivedOverrideStrategy(session, decomposedConstraints, conflictingConstraint, strategy);

    case RelaxationStrategyType.SkillRelaxation:
      if (isSkillTraversalConstraint(conflictingConstraint) &&
          isUserSkillConstraint(conflictingConstraint)) {
        return applySkillRelaxationStrategy(session, decomposedConstraints, conflictingConstraint, strategy);
      }
      return [];
  }
}

async function applyNumericStepStrategy(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: NumericPropertyConstraint,
  strategy: NumericStepStrategy
): Promise<BudgetRelaxation[]> {
  const suggestions: BudgetRelaxation[] = [];
  const currentValue = constraint.value; // No cast needed - it's number

  /*
   * Only maxBudget is a valid API field for numeric relaxation.
   * yearsExperience has no corresponding API field - skip it.
   */
  const field = strategy.suggestedField ?? constraint.field;
  if (field !== 'maxBudget') {
    return [];
  }

  // Choose steps based on operator direction
  const isLowerBound = constraint.operator === ">=" || constraint.operator === ">";
  const steps = isLowerBound ? strategy.stepsDown : strategy.stepsUp;
  const direction = isLowerBound ? "Lowering minimum" : "Raising maximum";

  for (const multiplier of steps) {
    const relaxedValue = isLowerBound
      ? Math.max(0, Math.floor(currentValue * multiplier))
      : Math.ceil(currentValue * multiplier);

    if (relaxedValue === currentValue) continue;

    const count = await testRelaxedValue(session, decomposedConstraints, constraint, relaxedValue);

    if (count > 0) {
      const rationale = fillTemplate(strategy.rationaleTemplate, {
        direction,
        current: formatValue(currentValue, constraint.field),
        suggested: formatValue(relaxedValue, constraint.field),
      });

      suggestions.push({
        type: RelaxationSuggestionType.UserConstraint,
        field: 'maxBudget',
        currentValue,
        suggestedValue: relaxedValue,
        rationale,
        resultingMatches: count,
      });
    }
  }

  return suggestions;
}

async function applyEnumExpandStrategy(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: StringArrayPropertyConstraint,
  strategy: EnumExpandStrategy
): Promise<StartTimeRelaxation[]> {
  const suggestions: StartTimeRelaxation[] = [];
  const currentValues = constraint.value; // No cast needed - it's string[]
  const currentValue = currentValues[0]; // User's current single value

  // Find the furthest current value in the enum order
  const maxCurrentIndex = Math.max(
    ...currentValues.map((v) => strategy.enumOrder.indexOf(v))
  );
  if (maxCurrentIndex < 0) return [];

  /*
   * Suggest each expanded value individually.
   * e.g., if user has "immediate", suggest "two_weeks" then "one_month"
   * Each is a separate suggestion the user can apply directly.
   */
  for (
    let i = maxCurrentIndex + 1;
    i < Math.min(maxCurrentIndex + 1 + strategy.maxExpansion, strategy.enumOrder.length);
    i++
  ) {
    const expandedValue = strategy.enumOrder[i];

    // Test what count we'd get with all values up to this expansion
    const expandedValues = [...strategy.enumOrder.slice(0, i + 1)];
    const count = await testRelaxedValue(session, decomposedConstraints, constraint, expandedValues);

    if (count > 0) {
      const rationale = fillTemplate(strategy.rationaleTemplate, {
        expanded: expandedValue,
      });

      suggestions.push({
        type: RelaxationSuggestionType.UserConstraint,
        field: 'requiredMaxStartTime',
        currentValue,           // string (API format)
        suggestedValue: expandedValue,  // string (API format)
        rationale,
        resultingMatches: count,
      });
    }
  }

  return suggestions;
}

async function applyRemoveStrategy(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: TestableConstraint,
  strategy: RemoveStrategy
): Promise<TimezoneRelaxation[]> {
  // Test removing this constraint entirely
  const allIds = new Set(decomposedConstraints.constraints.map((c) => c.id));
  allIds.delete(constraint.id);
  const { query, params } = buildQueryWithConstraints(decomposedConstraints, allIds);

  const result = await session.run(query, params);
  const count = toNumber(result.records[0]?.get("resultCount"));

  if (count > 0) {
    const rationale = fillTemplate(strategy.rationaleTemplate, {
      current: stringifyConstraintValue(constraint),
    });

    return [
      {
        type: RelaxationSuggestionType.UserConstraint,
        field: 'requiredTimezone',
        currentValue: getConstraintValue(constraint) as string[],
        suggestedValue: null,
        rationale,
        resultingMatches: count,
      },
    ];
  }

  return [];
}

async function applyDerivedOverrideStrategy(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: TestableConstraint,
  strategy: DerivedOverrideStrategy
): Promise<DerivedConstraintOverride[]> {
  if (!constraint.ruleId) return [];

  /*
   * Test result count with this derived constraint removed.
   * This tells the user how many results they'd get by overriding the rule.
   */
  const allIds = new Set(decomposedConstraints.constraints.map((c) => c.id));
  allIds.delete(constraint.id);
  const { query, params } = buildQueryWithConstraints(decomposedConstraints, allIds);

  const result = await session.run(query, params);
  const count = toNumber(result.records[0]?.get("resultCount"));

  const rationale = fillTemplate(strategy.rationaleTemplate, {
    displayValue: constraint.displayValue,
  });

  // Extract rule name from displayValue (format: "Derived: Rule Name")
  const ruleName = constraint.displayValue.replace(/^Derived:\s*/, "");

  return [
    {
      type: RelaxationSuggestionType.DerivedOverride,
      ruleId: constraint.ruleId,
      ruleName,
      affectedConstraints: [
        {
          field: constraint.field,
          value: getConstraintValue(constraint),
        },
      ],
      rationale,
      resultingMatches: count,
    },
  ];
}

/**
 * Skill-specific relaxations: lower proficiency, move to preferred, or remove.
 * The constraint.value is expected to be a UserSkillRequirement object with skill and minProficiency.
 */
async function applySkillRelaxationStrategy(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: UserSkillConstraint,
  strategy: SkillRelaxationStrategy
): Promise<SkillRelaxation[]> {
  const suggestions: SkillRelaxation[] = [];

  /*
   * Skill constraints are complex - the value contains skill name and proficiency.
   * We need to parse this to generate meaningful relaxations.
   */
  const skillReq = constraint.value; // No cast needed - it's UserSkillRequirement
  const skillName = skillReq.skill;
  const currentProficiency = skillReq.minProficiency;

  /*
   * 1. Lower proficiency threshold
   *
   * Suggests accepting a lower proficiency level (e.g., "proficient" instead of
   * "expert"). This keeps the skill as a hard requirement but widens the pool of
   * candidates. Only applicable when the user specified a proficiency threshold.
   */
  if (currentProficiency) {
    const currentIndex = strategy.proficiencyOrder.indexOf(currentProficiency);
    if (currentIndex >= 0 && currentIndex < strategy.proficiencyOrder.length - 1) {
      const lowerProficiency = strategy.proficiencyOrder[currentIndex + 1];

      const count = await testSkillRelaxation(session, decomposedConstraints, constraint, {
        ...skillReq,
        minProficiency: lowerProficiency,
      });

      if (count > 0) {
        suggestions.push({
          type: RelaxationSuggestionType.UserConstraint,
          field: 'requiredSkills',
          currentValue: { skill: skillName, minProficiency: currentProficiency },
          suggestedValue: {
            action: SkillRelaxationAction.LowerProficiency,
            skill: skillName,
            minProficiency: lowerProficiency,
          },
          rationale: fillTemplate(strategy.rationales.lowerProficiency, {
            skill: skillName,
            current: currentProficiency,
            suggested: lowerProficiency,
          }),
          resultingMatches: count,
        });
      }
    }
  }

  /*
   * 2. Move to preferred (remove from required, suggest adding to preferred)
   *
   * We test removal because "move to preferred" has the same filtering effect as
   * removal - the skill is no longer a hard constraint. The suggestedValue with
   * action: MoveToPreferred tells the client which action the user wants; from a
   * count perspective, both options yield identical results.
   */
  const countWithoutSkill = await testSkillRemoval(session, decomposedConstraints, constraint);
  if (countWithoutSkill > 0) {
    suggestions.push({
      type: RelaxationSuggestionType.UserConstraint,
      field: 'requiredSkills',
      currentValue: { skill: skillName, minProficiency: currentProficiency },
      suggestedValue: {
        action: SkillRelaxationAction.MoveToPreferred,
        skill: skillName,
      },
      rationale: fillTemplate(strategy.rationales.moveToPreferred, { skill: skillName }),
      resultingMatches: countWithoutSkill,
    });

    /*
     * 3. Remove skill entirely
     *
     * Suggests dropping the skill requirement altogether. Reuses countWithoutSkill
     * since removing a hard constraint yields the same candidate count as moving
     * it to preferred - both eliminate the skill as a filter.
     */
    suggestions.push({
      type: RelaxationSuggestionType.UserConstraint,
      field: 'requiredSkills',
      currentValue: { skill: skillName, minProficiency: currentProficiency },
      suggestedValue: {
        action: SkillRelaxationAction.Remove,
        skill: skillName,
      },
      rationale: fillTemplate(strategy.rationales.removeSkill, { skill: skillName }),
      resultingMatches: countWithoutSkill,
    });
  }

  return suggestions;
}

/**
 * Fill a template string by replacing {key} placeholders with values.
 */
function fillTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    template
  );
}

/**
 * Format a value for display in rationale.
 */
function formatValue(value: number, field: string): string {
  if (field === "salary") {
    return `$${value.toLocaleString()}`;
  }
  return String(value);
}

/**
 * Get the value from a constraint, handling different constraint types.
 */
function getConstraintValue(constraint: TestableConstraint): unknown {
  return constraint.value;
}

/**
 * Stringify constraint value for display purposes.
 */
function stringifyConstraintValue(constraint: TestableConstraint): string {
  const value = constraint.value;
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}
