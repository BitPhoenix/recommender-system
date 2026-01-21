import { describe, it, expect } from "vitest";
import {
  decomposeConstraints,
  buildQueryWithConstraints,
  buildPropertyConditions,
} from "./constraint-decomposer.service.js";
import {
  ConstraintType,
  PropertyFieldType,
  SkillConstraintOrigin,
} from "./constraint.types.js";
import {
  AppliedFilterType,
  type AppliedFilter,
  type AppliedSkillFilter,
} from "../../types/search.types.js";

describe("decomposeConstraints", () => {
  it("maps applied filters to property constraints with Cypher fragments", () => {
    const appliedFilters: AppliedFilter[] = [
      {
        type: AppliedFilterType.Property,
        field: "startTimeline",
        operator: "IN",
        value: '["immediate", "two_weeks"]',
        source: "user",
      },
      {
        type: AppliedFilterType.Property,
        field: "salary",
        operator: "<=",
        value: "150000",
        source: "user",
      },
    ];

    const result = decomposeConstraints(appliedFilters);

    expect(result.constraints).toHaveLength(2);
    expect(result.constraints[0].constraintType).toBe(ConstraintType.Property);
    expect(result.constraints[1].constraintType).toBe(ConstraintType.Property);

    // Type narrowing - only property constraints have cypher
    const first = result.constraints[0];
    const second = result.constraints[1];
    if (first.constraintType === ConstraintType.Property && second.constraintType === ConstraintType.Property) {
      expect(first.cypher.clause).toContain("e.startTimeline IN");
      expect(second.cypher.clause).toContain("e.salary <=");
      expect(first.fieldType).toBe(PropertyFieldType.StringArray);
      expect(second.fieldType).toBe(PropertyFieldType.Numeric);
    }
  });

  it("preserves filter properties in testable constraints", () => {
    const appliedFilters: AppliedFilter[] = [
      {
        type: AppliedFilterType.Property,
        field: "salary",
        operator: "<=",
        value: "150000",
        source: "user",
      },
    ];

    const result = decomposeConstraints(appliedFilters);

    expect(result.constraints[0].field).toBe("salary");
    expect(result.constraints[0].operator).toBe("<=");
    expect(result.constraints[0].value).toBe(150000);
    expect(result.constraints[0].source).toBe("user");
    expect(result.constraints[0].constraintType).toBe(ConstraintType.Property);

    if (result.constraints[0].constraintType === ConstraintType.Property) {
      expect(result.constraints[0].fieldType).toBe(PropertyFieldType.Numeric);
    }
  });

  it("splits BETWEEN into two separate constraints", () => {
    const appliedFilters: AppliedFilter[] = [
      {
        type: AppliedFilterType.Property,
        field: "yearsExperience",
        operator: "BETWEEN",
        value: "6 AND 10",
        source: "knowledge_base",
      },
    ];

    const result = decomposeConstraints(appliedFilters);

    expect(result.constraints).toHaveLength(2);

    const minConstraint = result.constraints.find((c) => c.operator === ">=");
    const maxConstraint = result.constraints.find((c) => c.operator === "<");

    expect(minConstraint).toBeDefined();
    expect(maxConstraint).toBeDefined();
    expect(minConstraint?.value).toBe(6);
    expect(maxConstraint?.value).toBe(10);
    expect(minConstraint?.displayValue).toContain(">=");
    expect(maxConstraint?.displayValue).toContain("<");

    // Both should be numeric
    if (minConstraint?.constraintType === ConstraintType.Property &&
        maxConstraint?.constraintType === ConstraintType.Property) {
      expect(minConstraint.fieldType).toBe(PropertyFieldType.Numeric);
      expect(maxConstraint.fieldType).toBe(PropertyFieldType.Numeric);
    }
  });

  it("handles >= operator for experience without upper bound", () => {
    const appliedFilters: AppliedFilter[] = [
      {
        type: AppliedFilterType.Property,
        field: "yearsExperience",
        operator: ">=",
        value: ">= 9",
        source: "knowledge_base",
      },
    ];

    const result = decomposeConstraints(appliedFilters);

    expect(result.constraints).toHaveLength(1);
    expect(result.constraints[0].operator).toBe(">=");
    expect(result.constraints[0].value).toBe(9);

    if (result.constraints[0].constraintType === ConstraintType.Property) {
      expect(result.constraints[0].fieldType).toBe(PropertyFieldType.Numeric);
    }
  });

  it("creates a single constraint for timezone zones (IN operator)", () => {
    const appliedFilters: AppliedFilter[] = [
      {
        type: AppliedFilterType.Property,
        field: "timezone",
        operator: "IN",
        value: '["Eastern", "Central"]',
        source: "user",
      },
    ];

    const result = decomposeConstraints(appliedFilters);

    expect(result.constraints).toHaveLength(1);
    expect(result.constraints[0].field).toBe("timezone");
    expect(result.constraints[0].operator).toBe("IN");

    // Should be StringArray type for IN operator
    if (result.constraints[0].constraintType === ConstraintType.Property) {
      expect(result.constraints[0].fieldType).toBe(PropertyFieldType.StringArray);
      expect(result.constraints[0].value).toEqual(["Eastern", "Central"]);
    }
  });

  it("handles AppliedSkillFilter with ruleId as derived constraint", () => {
    /*
     * Derived skill constraints now come through appliedFilters as AppliedSkillFilter
     * with a ruleId field, instead of a separate derivedConstraints parameter.
     */
    const derivedSkillFilter: AppliedSkillFilter = {
      type: AppliedFilterType.Skill,
      field: 'derivedSkills',
      operator: 'HAS_ANY',
      skills: [{ skillId: 'skill_distributed', skillName: 'skill_distributed' }],
      displayValue: 'Derived: Scaling requires distributed',
      source: 'inference',
      ruleId: 'scaling-requires-distributed',
    };
    const appliedFilters: AppliedFilter[] = [derivedSkillFilter];

    const result = decomposeConstraints(appliedFilters);

    expect(result.constraints).toHaveLength(1);
    expect(result.constraints[0].constraintType).toBe(ConstraintType.SkillTraversal);
    expect(result.constraints[0].ruleId).toBe("scaling-requires-distributed");
    expect(result.constraints[0].source).toBe("inference");
    expect(result.constraints[0].id).toBe("derived_scaling-requires-distributed");

    // Type narrowing - SkillTraversal constraints have skillIds and origin
    const constraint = result.constraints[0];
    if (constraint.constraintType === ConstraintType.SkillTraversal) {
      expect(constraint.skillIds).toEqual(["skill_distributed"]);
      expect(constraint.origin).toBe(SkillConstraintOrigin.Derived);
    }
  });

  it("returns baseMatchClause for Engineer nodes", () => {
    const result = decomposeConstraints([]);
    expect(result.baseMatchClause).toBe("MATCH (e:Engineer)");
  });

  describe("user skill constraints via AppliedSkillFilter", () => {
    it("creates SkillTraversal constraints from AppliedSkillFilter", () => {
      const skillFilter: AppliedSkillFilter = {
        type: AppliedFilterType.Skill,
        field: 'requiredSkills',
        operator: 'HAS_ANY',
        skills: [
          { skillId: 'skill_typescript', skillName: 'TypeScript', minProficiency: 'proficient' },
          { skillId: 'skill_react', skillName: 'React' },
        ],
        displayValue: 'TypeScript|min:proficient, React',
        source: 'user',
      };
      const appliedFilters: AppliedFilter[] = [skillFilter];

      const result = decomposeConstraints(appliedFilters);

      expect(result.constraints).toHaveLength(2);

      const tsConstraint = result.constraints.find(c => c.id === "user_skill_skill_typescript");
      expect(tsConstraint).toBeDefined();
      expect(tsConstraint?.constraintType).toBe(ConstraintType.SkillTraversal);
      expect(tsConstraint?.source).toBe("user");
      if (tsConstraint?.constraintType === ConstraintType.SkillTraversal) {
        expect(tsConstraint.skillIds).toEqual(["skill_typescript"]);
        expect(tsConstraint.origin).toBe(SkillConstraintOrigin.User);
      }

      const reactConstraint = result.constraints.find(c => c.id === "user_skill_skill_react");
      expect(reactConstraint).toBeDefined();
      expect(reactConstraint?.source).toBe("user");
      if (reactConstraint?.constraintType === ConstraintType.SkillTraversal) {
        expect(reactConstraint.origin).toBe(SkillConstraintOrigin.User);
      }
    });

    it("combines user AppliedSkillFilter with derived AppliedSkillFilter", () => {
      const userSkillFilter: AppliedSkillFilter = {
        type: AppliedFilterType.Skill,
        field: 'requiredSkills',
        operator: 'HAS_ANY',
        skills: [{ skillId: 'skill_typescript', skillName: 'TypeScript' }],
        displayValue: 'TypeScript',
        source: 'user',
      };
      const derivedSkillFilter: AppliedSkillFilter = {
        type: AppliedFilterType.Skill,
        field: 'derivedSkills',
        operator: 'HAS_ANY',
        skills: [{ skillId: 'skill_distributed', skillName: 'skill_distributed' }],
        displayValue: 'Derived: Test Rule',
        source: 'inference',
        ruleId: 'test-rule',
      };
      const appliedFilters: AppliedFilter[] = [userSkillFilter, derivedSkillFilter];

      const result = decomposeConstraints(appliedFilters);

      // Should have both derived and user skill constraints
      const derivedConstraint = result.constraints.find(c => c.id === "derived_test-rule");
      const userConstraint = result.constraints.find(c => c.id === "user_skill_skill_typescript");

      expect(derivedConstraint).toBeDefined();
      expect(userConstraint).toBeDefined();
      expect(derivedConstraint?.source).toBe("inference");
      expect(userConstraint?.source).toBe("user");

      // Check origins
      if (derivedConstraint?.constraintType === ConstraintType.SkillTraversal) {
        expect(derivedConstraint.origin).toBe(SkillConstraintOrigin.Derived);
      }
      if (userConstraint?.constraintType === ConstraintType.SkillTraversal) {
        expect(userConstraint.origin).toBe(SkillConstraintOrigin.User);
      }
    });
  });
});

describe("buildQueryWithConstraints", () => {
  it("builds query with selected property constraints only", () => {
    const decomposed = {
      constraints: [
        {
          id: "salary_0",
          field: "salary",
          operator: "<=",
          value: 150000,
          displayValue: "salary <= 150000",
          source: "user" as const,
          constraintType: ConstraintType.Property as const,
          fieldType: PropertyFieldType.Numeric as const,
          cypher: {
            clause: "e.salary <= $diag_salary_0",
            paramName: "diag_salary_0",
            paramValue: 150000,
          },
        },
        {
          id: "yearsExperience_1",
          field: "yearsExperience",
          operator: ">=",
          value: 6,
          displayValue: "yearsExperience >= 6",
          source: "user" as const,
          constraintType: ConstraintType.Property as const,
          fieldType: PropertyFieldType.Numeric as const,
          cypher: {
            clause: "e.yearsExperience >= $diag_yearsExperience_1",
            paramName: "diag_yearsExperience_1",
            paramValue: 6,
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    // Only include salary constraint
    const { query, params } = buildQueryWithConstraints(
      decomposed,
      new Set(["salary_0"])
    );

    expect(query).toContain("e.salary <= $diag_salary_0");
    expect(query).not.toContain("yearsExperience");
    expect(params.diag_salary_0).toBe(150000);
    expect(params.diag_yearsExperience_1).toBeUndefined();
  });

  it("builds query with multiple constraints ANDed", () => {
    const decomposed = {
      constraints: [
        {
          id: "salary_0",
          field: "salary",
          operator: "<=",
          value: 150000,
          displayValue: "salary <= 150000",
          source: "user" as const,
          constraintType: ConstraintType.Property as const,
          fieldType: PropertyFieldType.Numeric as const,
          cypher: {
            clause: "e.salary <= $diag_salary_0",
            paramName: "diag_salary_0",
            paramValue: 150000,
          },
        },
        {
          id: "yearsExperience_1",
          field: "yearsExperience",
          operator: ">=",
          value: 6,
          displayValue: "yearsExperience >= 6",
          source: "user" as const,
          constraintType: ConstraintType.Property as const,
          fieldType: PropertyFieldType.Numeric as const,
          cypher: {
            clause: "e.yearsExperience >= $diag_yearsExperience_1",
            paramName: "diag_yearsExperience_1",
            paramValue: 6,
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const { query, params } = buildQueryWithConstraints(
      decomposed,
      new Set(["salary_0", "yearsExperience_1"])
    );

    expect(query).toContain("e.salary <= $diag_salary_0");
    expect(query).toContain("e.yearsExperience >= $diag_yearsExperience_1");
    expect(query).toContain("AND");
    expect(params.diag_salary_0).toBe(150000);
    expect(params.diag_yearsExperience_1).toBe(6);
  });

  it("handles timezone IN constraint as a single clause", () => {
    const decomposed = {
      constraints: [
        {
          id: "timezone_0",
          field: "timezone",
          operator: "IN",
          value: ["Eastern", "Central"],
          displayValue: '["Eastern", "Central"]',
          source: "user" as const,
          constraintType: ConstraintType.Property as const,
          fieldType: PropertyFieldType.StringArray as const,
          cypher: {
            clause: "e.timezone IN $diag_timezone_0",
            paramName: "diag_timezone_0",
            paramValue: ["Eastern", "Central"],
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const { query, params } = buildQueryWithConstraints(
      decomposed,
      new Set(["timezone_0"])
    );

    // Timezone zones use IN operator - single clause, no OR needed
    expect(query).toContain("e.timezone IN $diag_timezone_0");
    expect(params.diag_timezone_0).toEqual(["Eastern", "Central"]);
  });

  it("builds empty WHERE clause when no constraints selected", () => {
    const decomposed = {
      constraints: [
        {
          id: "salary_0",
          field: "salary",
          operator: "<=",
          value: 150000,
          displayValue: "salary <= 150000",
          source: "user" as const,
          constraintType: ConstraintType.Property as const,
          fieldType: PropertyFieldType.Numeric as const,
          cypher: {
            clause: "e.salary <= $diag_salary_0",
            paramName: "diag_salary_0",
            paramValue: 150000,
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const { query, params } = buildQueryWithConstraints(
      decomposed,
      new Set() // No constraints selected
    );

    expect(query).not.toContain("WHERE");
    expect(Object.keys(params)).toHaveLength(0);
  });

  it("ignores SkillTraversal constraints (handled separately)", () => {
    const decomposed = {
      constraints: [
        {
          id: "derived_scaling-requires-distributed",
          field: "derivedSkills",
          operator: "IN",
          value: ["skill_distributed"],
          displayValue: "Derived: Scaling requires distributed",
          source: "inference" as const,
          ruleId: "scaling-requires-distributed",
          constraintType: ConstraintType.SkillTraversal as const,
          origin: SkillConstraintOrigin.Derived as const,
          skillIds: ["skill_distributed"],
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const { query, params } = buildQueryWithConstraints(
      decomposed,
      new Set(["derived_scaling-requires-distributed"])
    );

    // SkillTraversal constraints shouldn't appear in WHERE clause
    expect(query).not.toContain("derivedSkills");
    expect(Object.keys(params)).toHaveLength(0);
  });
});

describe("buildPropertyConditions", () => {
  it("extracts WHERE clauses and params from property constraints", () => {
    const decomposed = {
      constraints: [
        {
          id: "salary_0",
          field: "salary",
          operator: "<=",
          value: 150000,
          displayValue: "salary <= 150000",
          source: "user" as const,
          constraintType: ConstraintType.Property as const,
          fieldType: PropertyFieldType.Numeric as const,
          cypher: {
            clause: "e.salary <= $diag_salary_0",
            paramName: "diag_salary_0",
            paramValue: 150000,
          },
        },
        {
          id: "yearsExperience_1",
          field: "yearsExperience",
          operator: ">=",
          value: 6,
          displayValue: "yearsExperience >= 6",
          source: "user" as const,
          constraintType: ConstraintType.Property as const,
          fieldType: PropertyFieldType.Numeric as const,
          cypher: {
            clause: "e.yearsExperience >= $diag_yearsExperience_1",
            paramName: "diag_yearsExperience_1",
            paramValue: 6,
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const result = buildPropertyConditions(
      decomposed,
      new Set(["salary_0", "yearsExperience_1"])
    );

    expect(result.whereClauses).toHaveLength(2);
    expect(result.whereClauses).toContain("e.salary <= $diag_salary_0");
    expect(result.whereClauses).toContain("e.yearsExperience >= $diag_yearsExperience_1");
    expect(result.params.diag_salary_0).toBe(150000);
    expect(result.params.diag_yearsExperience_1).toBe(6);
  });

  it("handles timezone IN constraint as single clause", () => {
    const decomposed = {
      constraints: [
        {
          id: "timezone_0",
          field: "timezone",
          operator: "IN",
          value: ["Eastern", "Central"],
          displayValue: '["Eastern", "Central"]',
          source: "user" as const,
          constraintType: ConstraintType.Property as const,
          fieldType: PropertyFieldType.StringArray as const,
          cypher: {
            clause: "e.timezone IN $diag_timezone_0",
            paramName: "diag_timezone_0",
            paramValue: ["Eastern", "Central"],
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const result = buildPropertyConditions(
      decomposed,
      new Set(["timezone_0"])
    );

    // Should have one clause for timezone IN
    expect(result.whereClauses).toHaveLength(1);
    expect(result.whereClauses[0]).toBe("e.timezone IN $diag_timezone_0");
    expect(result.params.diag_timezone_0).toEqual(["Eastern", "Central"]);
  });

  it("ignores skill traversal constraints", () => {
    const decomposed = {
      constraints: [
        {
          id: "salary_0",
          field: "salary",
          operator: "<=",
          value: 150000,
          displayValue: "salary <= 150000",
          source: "user" as const,
          constraintType: ConstraintType.Property as const,
          fieldType: PropertyFieldType.Numeric as const,
          cypher: {
            clause: "e.salary <= $diag_salary_0",
            paramName: "diag_salary_0",
            paramValue: 150000,
          },
        },
        {
          id: "derived_test-rule",
          field: "derivedSkills",
          operator: "IN",
          value: ["skill_distributed"],
          displayValue: "Derived: Test Rule",
          source: "inference" as const,
          ruleId: "test-rule",
          constraintType: ConstraintType.SkillTraversal as const,
          origin: SkillConstraintOrigin.Derived as const,
          skillIds: ["skill_distributed"],
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const result = buildPropertyConditions(
      decomposed,
      new Set(["salary_0", "derived_test-rule"])
    );

    // Should only include the property constraint
    expect(result.whereClauses).toHaveLength(1);
    expect(result.whereClauses[0]).toContain("salary");
    expect(result.whereClauses[0]).not.toContain("derivedSkills");
  });

  it("returns empty arrays when no constraints are selected", () => {
    const decomposed = {
      constraints: [
        {
          id: "salary_0",
          field: "salary",
          operator: "<=",
          value: 150000,
          displayValue: "salary <= 150000",
          source: "user" as const,
          constraintType: ConstraintType.Property as const,
          fieldType: PropertyFieldType.Numeric as const,
          cypher: {
            clause: "e.salary <= $diag_salary_0",
            paramName: "diag_salary_0",
            paramValue: 150000,
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const result = buildPropertyConditions(decomposed, new Set());

    expect(result.whereClauses).toHaveLength(0);
    expect(Object.keys(result.params)).toHaveLength(0);
  });
});
