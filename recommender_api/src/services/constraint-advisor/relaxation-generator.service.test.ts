import { describe, it, expect, vi } from "vitest";
import { generateRelaxationSuggestions } from "./relaxation-generator.service.js";
import {
  ConstraintType,
  PropertyFieldType,
  SkillConstraintOrigin,
  type DecomposedConstraints,
  type NumericPropertyConstraint,
  type StringPropertyConstraint,
  type StringArrayPropertyConstraint,
  type UserSkillConstraint,
  type DerivedSkillConstraint,
} from "./constraint.types.js";
import {
  RelaxationSuggestionType,
  SkillRelaxationAction,
  type UserConstraintRelaxation,
  type DerivedConstraintOverride,
  type SkillRelaxation,
  type BudgetRelaxation,
  type StartTimeRelaxation,
} from "../../types/search.types.js";

function createMockSession(countMap: Map<string, number>) {
  return {
    run: vi.fn().mockImplementation((query: string, params: Record<string, unknown>) => {
      const activeParams = Object.keys(params)
        .filter((k) => k.startsWith("diag_"))
        .sort()
        .join(",");

      const count = countMap.get(activeParams) ?? 0;

      return {
        records: [
          {
            get: (field: string) => {
              if (field === "resultCount") {
                return { toNumber: () => count };
              }
              return null;
            },
          },
        ],
      };
    }),
  };
}

describe("generateRelaxationSuggestions", () => {
  it("returns empty for yearsExperience constraint (no corresponding API field)", async () => {
    /*
     * yearsExperience has no corresponding API field, so we no longer generate
     * relaxation suggestions for it. This test verifies the field is skipped.
     */
    const decomposed: DecomposedConstraints = {
      constraints: [
        {
          id: "yearsExperience_min_0",
          field: "yearsExperience",
          operator: ">=",
          value: 10,
          displayValue: "yearsExperience >= 10",
          source: "knowledge_base",
          constraintType: ConstraintType.Property,
          fieldType: PropertyFieldType.Numeric,
          cypher: {
            clause: "e.yearsExperience >= $diag_yearsExperience_min_0",
            paramName: "diag_yearsExperience_min_0",
            paramValue: 10,
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const session = createMockSession(new Map()) as any;

    // Mock to return results for relaxed values
    session.run.mockImplementation(() => {
      return {
        records: [{ get: () => ({ toNumber: () => 5 }) }],
      };
    });

    const suggestions = await generateRelaxationSuggestions(
      session,
      decomposed,
      decomposed.constraints
    );

    // yearsExperience has no corresponding API field - returns empty
    expect(suggestions).toHaveLength(0);
  });

  it("generates numeric-step relaxations for salary constraint (upper bound)", async () => {
    const decomposed: DecomposedConstraints = {
      constraints: [
        {
          id: "salary_0",
          field: "salary",
          operator: "<=",
          value: 100000,
          displayValue: "salary <= 100000",
          source: "user",
          constraintType: ConstraintType.Property,
          fieldType: PropertyFieldType.Numeric,
          cypher: {
            clause: "e.salary <= $diag_salary_0",
            paramName: "diag_salary_0",
            paramValue: 100000,
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const session = createMockSession(new Map()) as any;

    // Mock to return results for relaxed (higher) values
    session.run.mockImplementation((query: string, params: Record<string, unknown>) => {
      const salaryValue = params.diag_salary_0 as number;
      const count = salaryValue >= 120000 ? 8 : 0;
      return {
        records: [{ get: () => ({ toNumber: () => count }) }],
      };
    });

    const suggestions = await generateRelaxationSuggestions(
      session,
      decomposed,
      decomposed.constraints
    );

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].type).toBe(RelaxationSuggestionType.UserConstraint);

    // Type narrowing for type-safe access
    const suggestion = suggestions[0] as BudgetRelaxation;
    expect(suggestion.field).toBe("maxBudget"); // suggestedField from config
    expect(suggestion.suggestedValue).toBeGreaterThan(100000);
    expect(suggestion.rationale).toContain("Increase budget");
  });

  it("generates remove relaxation for timezone constraint", async () => {
    const decomposed: DecomposedConstraints = {
      constraints: [
        {
          id: "timezone_0",
          field: "timezone",
          operator: "STARTS WITH",
          value: "Europe/",
          displayValue: "timezone Europe/*",
          source: "user",
          constraintType: ConstraintType.Property,
          fieldType: PropertyFieldType.String,
          cypher: {
            clause: "e.timezone STARTS WITH $diag_tz_0",
            paramName: "diag_tz_0",
            paramValue: "Europe/",
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const session = createMockSession(new Map()) as any;
    session.run.mockResolvedValue({
      records: [{ get: () => ({ toNumber: () => 15 }) }],
    });

    const suggestions = await generateRelaxationSuggestions(
      session,
      decomposed,
      decomposed.constraints
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].type).toBe(RelaxationSuggestionType.UserConstraint);

    // Type narrowing for type-safe access
    const suggestion = suggestions[0] as UserConstraintRelaxation;
    expect(suggestion.field).toBe("requiredTimezone");
    expect(suggestion.suggestedValue).toBeNull();
    expect(suggestion.rationale).toContain("Remove");
  });

  it("generates derived override relaxation for inference-derived constraints", async () => {
    const decomposed: DecomposedConstraints = {
      constraints: [
        {
          id: "derived_scaling-requires-distributed",
          field: "derivedSkills",
          operator: "IN",
          value: ["skill_distributed"],
          displayValue: "Derived: Scaling requires distributed",
          source: "inference",
          ruleId: "scaling-requires-distributed",
          constraintType: ConstraintType.SkillTraversal,
          origin: SkillConstraintOrigin.Derived,
          skillIds: ["skill_distributed"],
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const session = createMockSession(new Map()) as any;

    // Add mock for the DB query that tests removal
    session.run.mockResolvedValue({
      records: [{ get: () => ({ toNumber: () => 12 }) }],
    });

    const suggestions = await generateRelaxationSuggestions(
      session,
      decomposed,
      decomposed.constraints
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].type).toBe(RelaxationSuggestionType.DerivedOverride);

    // Type narrowing for type-safe access
    const suggestion = suggestions[0] as DerivedConstraintOverride;
    expect(suggestion.ruleId).toBe("scaling-requires-distributed");
    expect(suggestion.ruleName).toBe("Scaling requires distributed");
    expect(suggestion.affectedConstraints).toEqual([
      { field: "derivedSkills", value: ["skill_distributed"] }
    ]);
    expect(suggestion.rationale).toContain("Override inference rule");
    expect(suggestion.resultingMatches).toBe(12); // Now actual count, not -1
  });

  it("returns empty for unknown field", async () => {
    const decomposed: DecomposedConstraints = {
      constraints: [
        {
          id: "unknownField_0",
          field: "unknownField",
          operator: "=",
          value: "foo",
          displayValue: "unknownField = foo",
          source: "user",
          constraintType: ConstraintType.Property,
          fieldType: PropertyFieldType.String,
          cypher: {
            clause: "e.unknownField = $diag_unknownField_0",
            paramName: "diag_unknownField_0",
            paramValue: "foo",
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const session = createMockSession(new Map()) as any;

    const suggestions = await generateRelaxationSuggestions(
      session,
      decomposed,
      decomposed.constraints
    );

    expect(suggestions).toHaveLength(0);
  });

  it("sorts suggestions by impact (most results first)", async () => {
    /*
     * Updated to use salary instead of yearsExperience since yearsExperience
     * no longer generates relaxation suggestions (no corresponding API field).
     */
    const decomposed: DecomposedConstraints = {
      constraints: [
        {
          id: "salary_0",
          field: "salary",
          operator: "<=",
          value: 100000,
          displayValue: "salary <= 100000",
          source: "user",
          constraintType: ConstraintType.Property,
          fieldType: PropertyFieldType.Numeric,
          cypher: {
            clause: "e.salary <= $diag_salary_0",
            paramName: "diag_salary_0",
            paramValue: 100000,
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const session = createMockSession(new Map()) as any;

    // Mock to return different counts for different relaxed values
    let callCount = 0;
    session.run.mockImplementation(() => {
      callCount++;
      // First relaxation (120%) returns more results than second (150%)
      const count = callCount === 1 ? 10 : 5;
      return {
        records: [{ get: () => ({ toNumber: () => count }) }],
      };
    });

    const suggestions = await generateRelaxationSuggestions(
      session,
      decomposed,
      decomposed.constraints
    );

    // Should be sorted by resultingMatches descending
    if (suggestions.length > 1) {
      expect(suggestions[0].resultingMatches).toBeGreaterThanOrEqual(
        suggestions[1].resultingMatches
      );
    }
  });

  it("generates enum expansion for startTimeline constraint", async () => {
    const decomposed: DecomposedConstraints = {
      constraints: [
        {
          id: "startTimeline_0",
          field: "startTimeline",
          operator: "IN",
          value: ["immediate", "two_weeks"],
          displayValue: '["immediate", "two_weeks"]',
          source: "user",
          constraintType: ConstraintType.Property,
          fieldType: PropertyFieldType.StringArray,
          cypher: {
            clause: "e.startTimeline IN $diag_startTimeline_0",
            paramName: "diag_startTimeline_0",
            paramValue: ["immediate", "two_weeks"],
          },
        },
      ],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const session = createMockSession(new Map()) as any;

    // Mock to return results when expanding to include one_month
    session.run.mockImplementation((query: string, params: Record<string, unknown>) => {
      const timelines = params.diag_startTimeline_0 as string[];
      const count = timelines.includes("one_month") ? 12 : 0;
      return {
        records: [{ get: () => ({ toNumber: () => count }) }],
      };
    });

    const suggestions = await generateRelaxationSuggestions(
      session,
      decomposed,
      decomposed.constraints
    );

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].type).toBe(RelaxationSuggestionType.UserConstraint);

    /*
     * Enum expansion now returns individual string values (API format)
     * instead of arrays. Each expansion is a separate suggestion.
     */
    const suggestion = suggestions[0] as StartTimeRelaxation;
    expect(suggestion.field).toBe("requiredMaxStartTime");
    expect(suggestion.rationale).toContain("Expand");
    expect(suggestion.currentValue).toBe("immediate"); // First value from original array
    expect(suggestion.suggestedValue).toBe("one_month"); // Single string, not array
  });

  it("handles multiple constraints from conflict sets", async () => {
    /*
     * Updated to use salary instead of yearsExperience since yearsExperience
     * no longer generates relaxation suggestions (no corresponding API field).
     */
    const salaryConstraint: NumericPropertyConstraint = {
      id: "salary_0",
      field: "salary",
      operator: "<=",
      value: 100000,
      displayValue: "salary <= 100000",
      source: "user",
      constraintType: ConstraintType.Property,
      fieldType: PropertyFieldType.Numeric,
      cypher: {
        clause: "e.salary <= $diag_salary_0",
        paramName: "diag_salary_0",
        paramValue: 100000,
      },
    };

    const tzConstraint: StringPropertyConstraint = {
      id: "timezone_0",
      field: "timezone",
      operator: "STARTS WITH",
      value: "Asia/",
      displayValue: "timezone Asia/*",
      source: "user",
      constraintType: ConstraintType.Property,
      fieldType: PropertyFieldType.String,
      cypher: {
        clause: "e.timezone STARTS WITH $diag_tz_0",
        paramName: "diag_tz_0",
        paramValue: "Asia/",
      },
    };

    const decomposed: DecomposedConstraints = {
      constraints: [salaryConstraint, tzConstraint],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const session = createMockSession(new Map()) as any;
    session.run.mockResolvedValue({
      records: [{ get: () => ({ toNumber: () => 5 }) }],
    });

    const suggestions = await generateRelaxationSuggestions(
      session,
      decomposed,
      [salaryConstraint, tzConstraint]
    );

    // Should have suggestions for both constraints (all should be UserConstraint type)
    const userConstraintSuggestions = suggestions.filter(
      (s): s is UserConstraintRelaxation => s.type === RelaxationSuggestionType.UserConstraint
    );
    const fields = userConstraintSuggestions.map((s) => s.field);
    expect(fields).toContain("maxBudget"); // salary maps to maxBudget
    expect(fields).toContain("requiredTimezone");
  });

  describe("skill relaxation with proficiency-aware queries", () => {
    it("generates lower proficiency suggestion that decreases from expert toward learning", async () => {
      const skillConstraint: UserSkillConstraint = {
        id: "user_skill_skill_typescript",
        field: "requiredSkills",
        operator: "HAS",
        value: { skill: "skill_typescript", minProficiency: "expert" },
        displayValue: "TypeScript|min:expert",
        source: "user",
        constraintType: ConstraintType.SkillTraversal,
        origin: SkillConstraintOrigin.User,
        skillIds: ["skill_typescript"],
      };

      const decomposed: DecomposedConstraints = {
        constraints: [skillConstraint],
        baseMatchClause: "MATCH (e:Engineer)",
      };

      const session = createMockSession(new Map()) as any;

      /*
       * Mock returns more results for lower proficiency levels.
       * This verifies the relaxation direction: expert → proficient → learning
       */
      session.run.mockImplementation((query: string, params: Record<string, unknown>) => {
        const learningIds = params.learningLevelSkillIds as string[] || [];
        const proficientIds = params.proficientLevelSkillIds as string[] || [];
        const expertIds = params.expertLevelSkillIds as string[] || [];

        // More results when proficiency is lowered
        if (learningIds.includes("skill_typescript")) {
          return { records: [{ get: () => ({ toNumber: () => 20 }) }] };
        }
        if (proficientIds.includes("skill_typescript")) {
          return { records: [{ get: () => ({ toNumber: () => 10 }) }] };
        }
        if (expertIds.includes("skill_typescript")) {
          return { records: [{ get: () => ({ toNumber: () => 2 }) }] };
        }
        return { records: [{ get: () => ({ toNumber: () => 0 }) }] };
      });

      const suggestions = await generateRelaxationSuggestions(
        session,
        decomposed,
        [skillConstraint]
      );

      const skillSuggestions = suggestions.filter(
        (s): s is SkillRelaxation =>
          s.type === RelaxationSuggestionType.UserConstraint && s.field === "requiredSkills"
      );

      expect(skillSuggestions.length).toBeGreaterThan(0);

      /*
       * Verify proficiency direction: suggestions should lower the requirement.
       * Original: expert. Valid relaxations: proficient or familiar (via SkillRelaxationAction.LowerProficiency).
       */
      const lowerProficiencySuggestion = skillSuggestions.find(
        (s) => s.suggestedValue.action === SkillRelaxationAction.LowerProficiency
      );

      expect(lowerProficiencySuggestion).toBeDefined();
      expect(lowerProficiencySuggestion!.suggestedValue).toEqual({
        action: SkillRelaxationAction.LowerProficiency,
        skill: "skill_typescript",
        minProficiency: "proficient", // One level down from expert
      });
      expect(lowerProficiencySuggestion!.resultingMatches).toBeGreaterThan(2); // More than expert-only
    });

    it("generates remove skill suggestion with non-zero results", async () => {
      const skillConstraint: UserSkillConstraint = {
        id: "user_skill_skill_react",
        field: "requiredSkills",
        operator: "HAS",
        value: { skill: "skill_react", minProficiency: "proficient" },
        displayValue: "React|min:proficient",
        source: "user",
        constraintType: ConstraintType.SkillTraversal,
        origin: SkillConstraintOrigin.User,
        skillIds: ["skill_react"],
      };

      const decomposed: DecomposedConstraints = {
        constraints: [skillConstraint],
        baseMatchClause: "MATCH (e:Engineer)",
      };

      const session = createMockSession(new Map()) as any;

      // For skill removal, query should return results when the skill is removed
      session.run.mockImplementation((query: string, params: Record<string, unknown>) => {
        const allSkillIds = params.allSkillIds as string[] | undefined;

        // If allSkillIds is empty or undefined, we're testing skill removal
        if (!allSkillIds || allSkillIds.length === 0) {
          return { records: [{ get: () => ({ toNumber: () => 20 }) }] };
        }

        // With skill constraint
        return { records: [{ get: () => ({ toNumber: () => 3 }) }] };
      });

      const suggestions = await generateRelaxationSuggestions(
        session,
        decomposed,
        [skillConstraint]
      );

      // Should have a remove skill suggestion using SkillRelaxationAction enum
      const removeSuggestion = suggestions.find(
        (s): s is SkillRelaxation =>
          s.type === RelaxationSuggestionType.UserConstraint &&
          s.field === 'requiredSkills' &&
          s.suggestedValue.action === SkillRelaxationAction.Remove
      );

      expect(removeSuggestion).toBeDefined();
      expect(removeSuggestion!.suggestedValue).toEqual({
        action: SkillRelaxationAction.Remove,
        skill: "skill_react",
      });
      expect(removeSuggestion!.resultingMatches).toBeGreaterThan(0);
      expect(removeSuggestion!.rationale).toContain("Remove");

      // Also verify moveToPreferred suggestion is generated
      const moveToPreferredSuggestion = suggestions.find(
        (s): s is SkillRelaxation =>
          s.type === RelaxationSuggestionType.UserConstraint &&
          s.field === 'requiredSkills' &&
          s.suggestedValue.action === SkillRelaxationAction.MoveToPreferred
      );

      expect(moveToPreferredSuggestion).toBeDefined();
      expect(moveToPreferredSuggestion!.suggestedValue).toEqual({
        action: SkillRelaxationAction.MoveToPreferred,
        skill: "skill_react",
      });
    });

    it("uses correct proficiency CASE pattern in generated query", async () => {
      const skillConstraint: UserSkillConstraint = {
        id: "user_skill_skill_python",
        field: "requiredSkills",
        operator: "HAS",
        value: { skill: "skill_python", minProficiency: "expert" },
        displayValue: "Python|min:expert",
        source: "user",
        constraintType: ConstraintType.SkillTraversal,
        origin: SkillConstraintOrigin.User,
        skillIds: ["skill_python"],
      };

      const decomposed: DecomposedConstraints = {
        constraints: [skillConstraint],
        baseMatchClause: "MATCH (e:Engineer)",
      };

      const session = createMockSession(new Map()) as any;
      const capturedQueries: string[] = [];

      session.run.mockImplementation((query: string) => {
        capturedQueries.push(query);
        return { records: [{ get: () => ({ toNumber: () => 5 }) }] };
      });

      await generateRelaxationSuggestions(
        session,
        decomposed,
        [skillConstraint]
      );

      // Verify that at least one query uses the proficiency CASE pattern
      const proficiencyQuery = capturedQueries.find(q =>
        q.includes("$learningLevelSkillIds") &&
        q.includes("$proficientLevelSkillIds") &&
        q.includes("$expertLevelSkillIds") &&
        q.includes("COLLECT(DISTINCT CASE")
      );

      expect(proficiencyQuery).toBeDefined();
      // Verify the proficiency check pattern
      expect(proficiencyQuery).toContain("us.proficiencyLevel");
    });

    it("generates suggestions for both skill and property constraints", async () => {
      const skillConstraint: UserSkillConstraint = {
        id: "user_skill_skill_go",
        field: "requiredSkills",
        operator: "HAS",
        value: { skill: "skill_go", minProficiency: "proficient" },
        displayValue: "Go|min:proficient",
        source: "user",
        constraintType: ConstraintType.SkillTraversal,
        origin: SkillConstraintOrigin.User,
        skillIds: ["skill_go"],
      };

      const salaryConstraint: NumericPropertyConstraint = {
        id: "salary_0",
        field: "salary",
        operator: "<=",
        value: 120000,
        displayValue: "salary <= 120000",
        source: "user",
        constraintType: ConstraintType.Property,
        fieldType: PropertyFieldType.Numeric,
        cypher: {
          clause: "e.salary <= $diag_salary_0",
          paramName: "diag_salary_0",
          paramValue: 120000,
        },
      };

      const decomposed: DecomposedConstraints = {
        constraints: [skillConstraint, salaryConstraint],
        baseMatchClause: "MATCH (e:Engineer)",
      };

      const session = createMockSession(new Map()) as any;

      session.run.mockResolvedValue({
        records: [{ get: () => ({ toNumber: () => 10 }) }],
      });

      const suggestions = await generateRelaxationSuggestions(
        session,
        decomposed,
        [skillConstraint, salaryConstraint]
      );

      // Should have suggestions for both constraints
      const skillSuggestions = suggestions.filter(
        (s): s is SkillRelaxation =>
          s.type === RelaxationSuggestionType.UserConstraint && s.field === "requiredSkills"
      );
      const salarySuggestions = suggestions.filter(
        (s): s is BudgetRelaxation =>
          s.type === RelaxationSuggestionType.UserConstraint && s.field === "maxBudget"
      );

      expect(skillSuggestions.length).toBeGreaterThan(0);
      expect(salarySuggestions.length).toBeGreaterThan(0);

      // All skill suggestions should have non-zero results (not the old 0 behavior)
      for (const suggestion of skillSuggestions) {
        expect(suggestion.resultingMatches).toBeGreaterThan(0);
      }
    });

    it("handles multiple skill constraints with different proficiencies", async () => {
      const tsConstraint: UserSkillConstraint = {
        id: "user_skill_skill_typescript",
        field: "requiredSkills",
        operator: "HAS",
        value: { skill: "skill_typescript", minProficiency: "expert" },
        displayValue: "TypeScript|min:expert",
        source: "user",
        constraintType: ConstraintType.SkillTraversal,
        origin: SkillConstraintOrigin.User,
        skillIds: ["skill_typescript"],
      };

      const reactConstraint: UserSkillConstraint = {
        id: "user_skill_skill_react",
        field: "requiredSkills",
        operator: "HAS",
        value: { skill: "skill_react", minProficiency: "learning" },
        displayValue: "React|min:learning",
        source: "user",
        constraintType: ConstraintType.SkillTraversal,
        origin: SkillConstraintOrigin.User,
        skillIds: ["skill_react"],
      };

      const decomposed: DecomposedConstraints = {
        constraints: [tsConstraint, reactConstraint],
        baseMatchClause: "MATCH (e:Engineer)",
      };

      const session = createMockSession(new Map()) as any;

      session.run.mockImplementation((query: string, params: Record<string, unknown>) => {
        const expertIds = params.expertLevelSkillIds as string[] || [];
        const learningIds = params.learningLevelSkillIds as string[] || [];

        // More results when TS is lowered from expert
        if (!expertIds.includes("skill_typescript") && learningIds.includes("skill_typescript")) {
          return { records: [{ get: () => ({ toNumber: () => 12 }) }] };
        }

        return { records: [{ get: () => ({ toNumber: () => 3 }) }] };
      });

      const suggestions = await generateRelaxationSuggestions(
        session,
        decomposed,
        [tsConstraint, reactConstraint]
      );

      // Should have suggestions for both skills
      const skillSuggestions = suggestions.filter(
        (s): s is SkillRelaxation =>
          s.type === RelaxationSuggestionType.UserConstraint && s.field === "requiredSkills"
      );

      // TypeScript (expert) should have lower proficiency suggestions
      // React (learning) is already at minimum, so mainly remove suggestions
      expect(skillSuggestions.length).toBeGreaterThan(0);

      // Verify skill suggestions use the proper action enum
      for (const suggestion of skillSuggestions) {
        expect([
          SkillRelaxationAction.LowerProficiency,
          SkillRelaxationAction.MoveToPreferred,
          SkillRelaxationAction.Remove,
        ]).toContain(suggestion.suggestedValue.action);
      }
    });

    it("includes derived skill requirements in proficiency relaxation test queries", async () => {
      /*
       * Regression test: When testing skill proficiency relaxation, the query should
       * ALSO enforce derived skill constraints. Previously, derived skills were excluded,
       * leading to inflated result counts.
       */
      const userSkillConstraint: UserSkillConstraint = {
        id: "user_skill_skill_kubernetes",
        field: "requiredSkills",
        operator: "HAS",
        value: { skill: "skill_kubernetes", minProficiency: "expert" },
        displayValue: "Kubernetes|min:expert",
        source: "user",
        constraintType: ConstraintType.SkillTraversal,
        origin: SkillConstraintOrigin.User,
        skillIds: ["skill_kubernetes"],
      };

      const derivedSkillConstraint: DerivedSkillConstraint = {
        id: "derived_scaling-requires-distributed",
        field: "derivedSkills",
        operator: "HAS_ALL",
        value: ["skill_distributed"],
        displayValue: "Derived: Scaling requires distributed",
        source: "inference",
        ruleId: "scaling-requires-distributed",
        constraintType: ConstraintType.SkillTraversal,
        origin: SkillConstraintOrigin.Derived,
        skillIds: ["skill_distributed"],
      };

      const decomposed: DecomposedConstraints = {
        constraints: [userSkillConstraint, derivedSkillConstraint],
        baseMatchClause: "MATCH (e:Engineer)",
      };

      const session = createMockSession(new Map()) as any;
      const capturedParams: Record<string, unknown>[] = [];

      session.run.mockImplementation((query: string, params: Record<string, unknown>) => {
        capturedParams.push(params);
        return { records: [{ get: () => ({ toNumber: () => 5 }) }] };
      });

      await generateRelaxationSuggestions(
        session,
        decomposed,
        [userSkillConstraint]
      );

      // Find the query that tests proficiency relaxation (has proficiency buckets)
      const proficiencyTestParams = capturedParams.find(p =>
        p.learningLevelSkillIds !== undefined &&
        p.proficientLevelSkillIds !== undefined &&
        p.expertLevelSkillIds !== undefined
      );

      expect(proficiencyTestParams).toBeDefined();

      // KEY ASSERTION: derivedSkillIds should include the derived constraint's skills
      expect(proficiencyTestParams!.derivedSkillIds).toEqual(["skill_distributed"]);
    });
  });
});
