import {
  isSkillFilter,
  isDerivedSkillFilter,
  type AppliedFilter,
  type AppliedPropertyFilter,
  type AppliedSkillFilter,
} from "../../types/search.types.js";
import {
  ConstraintType,
  PropertyFieldType,
  SkillConstraintOrigin,
  type TestableConstraint,
  type DecomposedConstraints,
  type PropertyConstraint,
  type NumericPropertyConstraint,
  type StringPropertyConstraint,
  type StringArrayPropertyConstraint,
  type UserSkillConstraint,
  type DerivedSkillConstraint,
} from "./constraint.types.js";
import { buildCypherFragment } from "../../utils/cypher-fragment.builder.js";

/**
 * Decomposes applied filters into testable constraints.
 *
 * Handles discriminated union types: AppliedPropertyFilter and AppliedSkillFilter.
 * Skill IDs are now embedded directly in AppliedSkillFilter.
 */
export function decomposeConstraints(
  appliedFilters: AppliedFilter[]
): DecomposedConstraints {
  let paramCounter = 0;
  const nextParam = (prefix: string): string => `diag_${prefix}_${paramCounter++}`;

  const constraints: TestableConstraint[] = [];

  for (let index = 0; index < appliedFilters.length; index++) {
    const filter = appliedFilters[index];

    if (isSkillFilter(filter)) {
      constraints.push(...decomposeSkillFilter(filter));
    } else {
      constraints.push(...decomposePropertyFilter(filter, index, nextParam));
    }
  }

  return {
    constraints,
    baseMatchClause: "MATCH (e:Engineer)",
  };
}

/**
 * Decomposes an AppliedSkillFilter into testable constraints.
 * - Derived filters: ONE grouped constraint per rule
 * - User filters: ONE constraint per skill (independent testing)
 */
function decomposeSkillFilter(filter: AppliedSkillFilter): TestableConstraint[] {
  if (isDerivedSkillFilter(filter)) {
    const constraint: DerivedSkillConstraint = {
      id: `derived_${filter.ruleId}`,
      field: filter.field,
      operator: 'IN',
      value: filter.skills.map(s => s.skillId),
      displayValue: filter.displayValue,
      source: filter.source,
      ruleId: filter.ruleId,
      constraintType: ConstraintType.SkillTraversal,
      origin: SkillConstraintOrigin.Derived,
      skillIds: filter.skills.map(s => s.skillId),
    };
    return [constraint];
  }

  // User skill filter: ONE constraint per skill
  return filter.skills.map((skill): UserSkillConstraint => ({
    id: `user_skill_${skill.skillId}`,
    field: 'requiredSkills',
    operator: 'IN',
    value: {
      skill: skill.skillId,
      minProficiency: skill.minProficiency,
    },
    displayValue: `Required skill: ${skill.skillName}`,
    source: filter.source,
    constraintType: ConstraintType.SkillTraversal,
    origin: SkillConstraintOrigin.User,
    skillIds: [skill.skillId],
  }));
}

/**
 * Decomposes an AppliedPropertyFilter into testable constraints.
 * Routes to specialized handlers for BETWEEN and timezone filters.
 */
function decomposePropertyFilter(
  filter: AppliedPropertyFilter,
  index: number,
  nextParam: (prefix: string) => string
): TestableConstraint[] {
  const parsedValue = parseFilterValue(filter);
  const normalizedOperator = normalizeOperator(filter.operator);

  // BETWEEN creates two constraints (min and max)
  if (filter.operator === "BETWEEN" && typeof parsedValue === "object" && parsedValue !== null) {
    return decomposeBetweenFilter(filter, index, parsedValue as { min: number; max: number }, nextParam);
  }

  // Timezone STARTS WITH creates one constraint per prefix
  if (filter.field === "timezone" && normalizedOperator === "STARTS WITH") {
    return decomposeTimezoneFilter(filter, index, parsedValue, nextParam);
  }

  // Determine field type for discrimination
  const fieldType = getPropertyFieldType(filter.field, normalizedOperator);

  // Standard property constraint - type varies by fieldType
  return [createPropertyConstraint(filter, index, parsedValue, normalizedOperator, fieldType, nextParam)];
}

/**
 * Determines the property field type based on field name and operator.
 */
function getPropertyFieldType(field: string, operator: string): PropertyFieldType {
  if (field === "yearsExperience" || field === "salary") {
    return PropertyFieldType.Numeric;
  }
  if (field === "timezone" && operator === "STARTS WITH") {
    return PropertyFieldType.String;
  }
  if (field === "startTimeline" || operator === "IN") {
    return PropertyFieldType.StringArray;
  }
  // Default to string for unknown fields
  return PropertyFieldType.String;
}

/**
 * Creates a property constraint with the correct type based on fieldType.
 */
function createPropertyConstraint(
  filter: AppliedPropertyFilter,
  index: number,
  parsedValue: unknown,
  operator: string,
  fieldType: PropertyFieldType,
  nextParam: (prefix: string) => string
): PropertyConstraint {
  const base = {
    id: `${filter.field}_${index}`,
    field: filter.field,
    operator,
    displayValue: filter.value,
    source: filter.source,
    constraintType: ConstraintType.Property as const,
    cypher: buildCypherFragment(filter.field, operator, parsedValue, nextParam(filter.field)),
  };

  switch (fieldType) {
    case PropertyFieldType.Numeric:
      return { ...base, fieldType, value: parsedValue as number } as NumericPropertyConstraint;
    case PropertyFieldType.String:
      return { ...base, fieldType, value: parsedValue as string } as StringPropertyConstraint;
    case PropertyFieldType.StringArray:
      return { ...base, fieldType, value: parsedValue as string[] } as StringArrayPropertyConstraint;
  }
}

/**
 * Splits a BETWEEN filter into two constraints (>= min, < max).
 * This allows the conflict detector to identify which bound is problematic.
 */
function decomposeBetweenFilter(
  filter: AppliedPropertyFilter,
  index: number,
  betweenValue: { min: number; max: number },
  nextParam: (prefix: string) => string
): NumericPropertyConstraint[] {
  return [
    {
      id: `${filter.field}_min_${index}`,
      field: filter.field,
      operator: ">=",
      value: betweenValue.min,
      displayValue: `${filter.field} >= ${betweenValue.min}`,
      source: filter.source,
      constraintType: ConstraintType.Property,
      fieldType: PropertyFieldType.Numeric,
      cypher: buildCypherFragment(filter.field, ">=", betweenValue.min, nextParam(`${filter.field}_min`)),
    },
    {
      id: `${filter.field}_max_${index}`,
      field: filter.field,
      operator: "<",
      value: betweenValue.max,
      displayValue: `${filter.field} < ${betweenValue.max}`,
      source: filter.source,
      constraintType: ConstraintType.Property,
      fieldType: PropertyFieldType.Numeric,
      cypher: buildCypherFragment(filter.field, "<", betweenValue.max, nextParam(`${filter.field}_max`)),
    },
  ];
}

/**
 * Decomposes timezone STARTS WITH filter into one constraint per prefix.
 * Multiple prefixes are ORed together during query building.
 */
function decomposeTimezoneFilter(
  filter: AppliedPropertyFilter,
  index: number,
  parsedValue: unknown,
  nextParam: (prefix: string) => string
): StringPropertyConstraint[] {
  if (Array.isArray(parsedValue)) {
    return parsedValue.map((val, i): StringPropertyConstraint => {
      const prefix = String(val).replace(/\*$/, "");
      return {
        id: `timezone_${index}_${i}`,
        field: "timezone",
        operator: "STARTS WITH",
        value: prefix,
        displayValue: `timezone ${val}`,
        source: filter.source,
        constraintType: ConstraintType.Property,
        fieldType: PropertyFieldType.String,
        cypher: buildCypherFragment("timezone", "STARTS WITH", prefix, nextParam(`tz_${i}`)),
      };
    });
  }

  // Single timezone prefix
  const prefix = String(parsedValue).replace(/\*$/, "");
  return [{
    id: `timezone_${index}`,
    field: "timezone",
    operator: "STARTS WITH",
    value: prefix,
    displayValue: `timezone ${parsedValue}`,
    source: filter.source,
    constraintType: ConstraintType.Property,
    fieldType: PropertyFieldType.String,
    cypher: buildCypherFragment("timezone", "STARTS WITH", prefix, nextParam("tz")),
  }];
}

/**
 * Maps AppliedFilter operator strings to Cypher operators.
 * The AppliedFilter uses display-friendly operators; we need to normalize them.
 */
function normalizeOperator(operator: string): string {
  if (operator === "BETWEEN") return ">="; // BETWEEN is handled as two separate constraints
  if (operator.includes("STARTS WITH")) return "STARTS WITH";
  return operator;
}

/**
 * Parses the value from AppliedPropertyFilter (which stores values as strings)
 * into typed values for Cypher parameterization.
 */
function parseFilterValue(filter: AppliedPropertyFilter): unknown {
  const { field, operator, value } = filter;

  /*
   * AppliedFilter.value is a string representation.
   * We need to parse it back to the appropriate type for Cypher.
   */
  try {
    // JSON-encoded arrays (startTimeline, requiredSkills, etc.)
    if (value.startsWith("[")) {
      return JSON.parse(value);
    }

    // Numeric fields
    if (field === "yearsExperience" || field === "salary") {
      // Handle "X AND Y" format for BETWEEN
      if (operator === "BETWEEN") {
        const parts = value.split(" AND ");
        return { min: parseInt(parts[0], 10), max: parseInt(parts[1], 10) };
      }
      // Handle ">= X" format
      if (value.startsWith(">=")) {
        return parseInt(value.replace(">=", "").trim(), 10);
      }
      return parseInt(value, 10);
    }

    // Default: return as-is
    return value;
  } catch {
    return value;
  }
}

/**
 * Builds WHERE clause conditions from property constraints.
 * Extracted for reuse by skill relaxation testing.
 *
 * Note: Timezone constraints are ORed together, all others are ANDed.
 */
export function buildPropertyConditions(
  decomposed: DecomposedConstraints,
  constraintIds: Set<string>
): { whereClauses: string[]; params: Record<string, unknown> } {
  const activeConstraints = decomposed.constraints.filter((c) =>
    constraintIds.has(c.id)
  );

  const params: Record<string, unknown> = {};
  const whereClauses: string[] = [];

  /*
   * Group timezone constraints - they need to be ORed together.
   * Other constraints are ANDed.
   */
  const timezoneConstraints: PropertyConstraint[] = [];
  const otherConstraints: PropertyConstraint[] = [];

  for (const constraint of activeConstraints) {
    if (constraint.constraintType === ConstraintType.Property) {
      if (constraint.field === "timezone") {
        timezoneConstraints.push(constraint);
      } else {
        otherConstraints.push(constraint);
      }
    }
    // SkillTraversal constraints are handled separately
  }

  // Add non-timezone constraints (ANDed)
  for (const constraint of otherConstraints) {
    whereClauses.push(constraint.cypher.clause);
    params[constraint.cypher.paramName] = constraint.cypher.paramValue;
  }

  // Add timezone constraints (ORed together, then ANDed with the rest)
  if (timezoneConstraints.length > 0) {
    const tzClauses = timezoneConstraints.map((c) => c.cypher.clause);
    for (const constraint of timezoneConstraints) {
      params[constraint.cypher.paramName] = constraint.cypher.paramValue;
    }
    if (timezoneConstraints.length === 1) {
      whereClauses.push(tzClauses[0]);
    } else {
      whereClauses.push(`(${tzClauses.join(" OR ")})`);
    }
  }

  return { whereClauses, params };
}

/**
 * Builds a Cypher query using only the specified constraints.
 * Only includes property constraints - skill-traversal constraints
 * require separate handling with graph pattern matching.
 */
export function buildQueryWithConstraints(
  decomposed: DecomposedConstraints,
  constraintIds: Set<string>
): { query: string; params: Record<string, unknown> } {
  const { whereClauses, params } = buildPropertyConditions(decomposed, constraintIds);

  const whereClause =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join("\n  AND ")}` : "";

  const query = `
${decomposed.baseMatchClause}
${whereClause}
RETURN count(e) AS resultCount
`;

  return { query, params };
}
