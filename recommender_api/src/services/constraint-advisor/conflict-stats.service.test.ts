import { describe, it, expect, vi, beforeEach } from "vitest";
import { Session } from "neo4j-driver";
import {
  queryConstraintsStats,
  getCountMatchingAllConstraints,
} from "./conflict-stats.service.js";
import {
  ConstraintStatsType,
  type SkillConstraintStats,
  type SalaryConstraintStats,
  type YearsExperienceConstraintStats,
  type TimezoneConstraintStats,
  type StartTimelineConstraintStats,
} from "./conflict-stats.types.js";
import {
  type TestableConstraint,
  ConstraintType,
  PropertyFieldType,
  SkillConstraintOrigin,
} from "./constraint.types.js";

/*
 * Mock session factory for Neo4j queries.
 * Returns predictable results based on query pattern matching.
 */
function createMockSession(
  queryResults: Map<string, Record<string, unknown>[]>
): Session {
  return {
    run: vi.fn().mockImplementation((query: string) => {
      for (const [pattern, results] of queryResults.entries()) {
        if (query.includes(pattern)) {
          return Promise.resolve({
            records: results.map((data) => ({
              get: (key: string) => {
                const value = data[key];
                /* Handle Neo4j Integer simulation */
                if (typeof value === "number") {
                  return { toNumber: () => value };
                }
                return value;
              },
            })),
          });
        }
      }
      return Promise.resolve({ records: [] });
    }),
    close: vi.fn(),
  } as unknown as Session;
}

/*
 * Factory for creating testable skill constraints.
 */
function createSkillConstraint(
  overrides: Partial<TestableConstraint> = {}
): TestableConstraint {
  return {
    id: "skill_ts_0",
    constraintType: ConstraintType.SkillTraversal,
    skillIds: ["skill_typescript"],
    field: "skills",
    operator: "HAS_ANY",
    displayValue: "expert TypeScript",
    origin: SkillConstraintOrigin.User,
    source: "user",
    value: { skill: "skill_typescript", minProficiency: "expert" },
    ...overrides,
  } as TestableConstraint;
}

/*
 * Factory for creating testable property constraints.
 */
function createPropertyConstraint(
  field: string,
  value: unknown,
  overrides: Partial<TestableConstraint> = {}
): TestableConstraint {
  const fieldTypeMap: Record<string, PropertyFieldType> = {
    salary: PropertyFieldType.Numeric,
    yearsExperience: PropertyFieldType.Numeric,
    timezone: PropertyFieldType.String,
    startTimeline: PropertyFieldType.StringArray,
  };

  return {
    id: `${field}_0`,
    constraintType: ConstraintType.Property,
    fieldType: fieldTypeMap[field] || PropertyFieldType.Numeric,
    field,
    operator: "<=",
    value,
    displayValue: `${field} constraint`,
    source: "user",
    cypher: {
      clause: `e.${field} <= $${field}`,
      paramName: field,
      paramValue: value,
    },
    ...overrides,
  } as TestableConstraint;
}

describe("conflict-stats.service", () => {
  describe("queryConstraintsStats", () => {
    it("returns empty array for empty constraints", async () => {
      const session = createMockSession(new Map());
      const result = await queryConstraintsStats(session, []);
      expect(result).toEqual([]);
    });

    it("processes constraints sequentially and returns results in order", async () => {
      const session = createMockSession(
        new Map([
          ["HAS_SKILL", [{ exactCount: 10, lowerCount: 5 }]],
          ["e.salary", [{ countMatching: 20, minSalary: 50000, maxSalary: 200000 }]],
        ])
      );

      const constraints = [
        createSkillConstraint(),
        createPropertyConstraint("salary", 150000),
      ];

      const results = await queryConstraintsStats(session, constraints);

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe(ConstraintStatsType.Skill);
      expect(results[1].type).toBe(ConstraintStatsType.Salary);
    });
  });

  describe("getCountMatchingAllConstraints", () => {
    it("returns total engineer count when no constraints", async () => {
      const session = createMockSession(
        new Map([["MATCH (e:Engineer) RETURN count", [{ count: 100 }]]])
      );

      const result = await getCountMatchingAllConstraints(session, []);
      expect(result).toBe(100);
    });

    it("builds WHERE clause combining property constraints with AND", async () => {
      const session = createMockSession(new Map([["WHERE", [{ count: 5 }]]]));

      const constraints = [
        createPropertyConstraint("salary", 150000),
        createPropertyConstraint("yearsExperience", 5, { operator: ">=" }),
      ];

      const result = await getCountMatchingAllConstraints(session, constraints);
      expect(result).toBe(5);

      /* Verify the query was called with combined WHERE clause */
      const runCall = (session.run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(runCall[0]).toContain("AND");
    });

    it("handles skill constraints with EXISTS pattern", async () => {
      const session = createMockSession(new Map([["EXISTS", [{ count: 8 }]]]));

      const constraints = [createSkillConstraint()];

      const result = await getCountMatchingAllConstraints(session, constraints);
      expect(result).toBe(8);
    });

    it("returns 0 when no matches found", async () => {
      const session = createMockSession(new Map());

      const result = await getCountMatchingAllConstraints(session, [
        createPropertyConstraint("salary", 50000),
      ]);

      expect(result).toBe(0);
    });
  });

  describe("skill constraint stats", () => {
    it("returns exact and lower proficiency counts", async () => {
      const session = createMockSession(
        new Map([["HAS_SKILL", [{ exactCount: 15, lowerCount: 8 }]]])
      );

      const results = await queryConstraintsStats(session, [createSkillConstraint()]);
      const skillStats = results[0] as SkillConstraintStats;

      expect(skillStats.type).toBe(ConstraintStatsType.Skill);
      expect(skillStats.countMatching).toBe(15);
      expect(skillStats.countAtLowerProficiency).toBe(8);
      expect(skillStats.proficiency).toBe("expert");
      expect(skillStats.skillId).toBe("skill_typescript");
    });

    it("handles zero matches gracefully", async () => {
      const session = createMockSession(
        new Map([["HAS_SKILL", [{ exactCount: 0, lowerCount: 0 }]]])
      );

      const results = await queryConstraintsStats(session, [createSkillConstraint()]);
      const skillStats = results[0] as SkillConstraintStats;

      expect(skillStats.countMatching).toBe(0);
      expect(skillStats.countAtLowerProficiency).toBe(0);
    });

    it("handles skill without proficiency requirement", async () => {
      const session = createMockSession(
        new Map([["HAS_SKILL", [{ exactCount: 25, lowerCount: 0 }]]])
      );

      const constraint = createSkillConstraint({
        value: { skill: "skill_typescript" },
      } as any);

      const results = await queryConstraintsStats(session, [constraint]);
      const skillStats = results[0] as SkillConstraintStats;

      expect(skillStats.proficiency).toBe("any");
      expect(skillStats.countMatching).toBe(25);
    });
  });

  describe("salary constraint stats", () => {
    it("returns count and salary range from database", async () => {
      const session = createMockSession(
        new Map([
          ["e.salary", [{ countMatching: 25, minSalary: 75000, maxSalary: 350000 }]],
        ])
      );

      const results = await queryConstraintsStats(session, [
        createPropertyConstraint("salary", 150000),
      ]);
      const salaryStats = results[0] as SalaryConstraintStats;

      expect(salaryStats.type).toBe(ConstraintStatsType.Salary);
      expect(salaryStats.countMatching).toBe(25);
      expect(salaryStats.requestedMax).toBe(150000);
      expect(salaryStats.minSalaryInDb).toBe(75000);
      expect(salaryStats.maxSalaryInDb).toBe(350000);
    });

    it("handles empty database (null min/max)", async () => {
      const session = createMockSession(
        new Map([["e.salary", [{ countMatching: 0, minSalary: null, maxSalary: null }]]])
      );

      const results = await queryConstraintsStats(session, [
        createPropertyConstraint("salary", 100000),
      ]);
      const salaryStats = results[0] as SalaryConstraintStats;

      expect(salaryStats.countMatching).toBe(0);
      expect(salaryStats.minSalaryInDb).toBe(0);
      expect(salaryStats.maxSalaryInDb).toBe(0);
    });
  });

  describe("years experience constraint stats", () => {
    it("returns count and seniority bucket distribution", async () => {
      const session = createMockSession(
        new Map([
          [
            "yearsExperience",
            [
              {
                countMatching: 12,
                minYears: 0,
                maxYears: 25,
                junior: 5,
                mid: 10,
                senior: 15,
                staffPlus: 8,
              },
            ],
          ],
        ])
      );

      const constraint = createPropertyConstraint("yearsExperience", 10, {
        operator: ">=",
        displayValue: "10+ years (staff)",
      });

      const results = await queryConstraintsStats(session, [constraint]);
      const yoeStats = results[0] as YearsExperienceConstraintStats;

      expect(yoeStats.type).toBe(ConstraintStatsType.YearsExperience);
      expect(yoeStats.countMatching).toBe(12);
      expect(yoeStats.requestedMinYears).toBe(10);
      expect(yoeStats.requestedMaxYears).toBeNull();
      expect(yoeStats.countByRange).toEqual({
        junior: 5,
        mid: 10,
        senior: 15,
        staffPlus: 8,
      });
    });

    it("handles less-than operator for upper bound", async () => {
      const session = createMockSession(
        new Map([
          [
            "yearsExperience",
            [
              {
                countMatching: 15,
                minYears: 0,
                maxYears: 20,
                junior: 5,
                mid: 10,
                senior: 0,
                staffPlus: 0,
              },
            ],
          ],
        ])
      );

      const constraint = createPropertyConstraint("yearsExperience", 6, {
        operator: "<",
        displayValue: "< 6 years",
      });

      const results = await queryConstraintsStats(session, [constraint]);
      const yoeStats = results[0] as YearsExperienceConstraintStats;

      expect(yoeStats.requestedMinYears).toBe(0);
      expect(yoeStats.requestedMaxYears).toBe(6);
    });
  });

  describe("timezone constraint stats", () => {
    it("returns count and distribution by zone", async () => {
      const session = createMockSession(
        new Map([
          [
            "e.timezone",
            [
              { zone: "Eastern", count: 20 },
              { zone: "Central", count: 15 },
              { zone: "Mountain", count: 8 },
              { zone: "Pacific", count: 12 },
            ],
          ],
        ])
      );

      const constraint = createPropertyConstraint("timezone", ["Eastern", "Central"], {
        fieldType: PropertyFieldType.StringArray,
        displayValue: "Eastern or Central timezone",
      });

      const results = await queryConstraintsStats(session, [constraint]);
      const tzStats = results[0] as TimezoneConstraintStats;

      expect(tzStats.type).toBe(ConstraintStatsType.Timezone);
      expect(tzStats.countMatching).toBe(35); /* 20 + 15 */
      expect(tzStats.requestedZones).toEqual(["Eastern", "Central"]);
      expect(tzStats.countByZone).toEqual({
        Eastern: 20,
        Central: 15,
        Mountain: 8,
        Pacific: 12,
      });
    });

    it("handles single timezone value (not array)", async () => {
      const session = createMockSession(
        new Map([["e.timezone", [{ zone: "Pacific", count: 10 }]]])
      );

      const constraint = createPropertyConstraint("timezone", "Pacific", {
        fieldType: PropertyFieldType.String,
        displayValue: "Pacific timezone",
      });

      const results = await queryConstraintsStats(session, [constraint]);
      const tzStats = results[0] as TimezoneConstraintStats;

      expect(tzStats.requestedZones).toEqual(["Pacific"]);
      expect(tzStats.countMatching).toBe(10);
    });

    it("filters out null timezone values", async () => {
      const session = createMockSession(
        new Map([
          [
            "e.timezone",
            [
              { zone: "Eastern", count: 10 },
              { zone: null, count: 5 }, /* Should be filtered */
            ],
          ],
        ])
      );

      const constraint = createPropertyConstraint("timezone", ["Eastern"], {
        fieldType: PropertyFieldType.StringArray,
      });

      const results = await queryConstraintsStats(session, [constraint]);
      const tzStats = results[0] as TimezoneConstraintStats;

      expect(tzStats.countByZone).toEqual({ Eastern: 10 });
      expect(tzStats.countByZone).not.toHaveProperty("null");
    });
  });

  describe("start timeline constraint stats", () => {
    it("returns count and distribution by timeline", async () => {
      const session = createMockSession(
        new Map([
          [
            "e.startTimeline",
            [
              { timeline: "immediate", count: 25 },
              { timeline: "two_weeks", count: 20 },
              { timeline: "one_month", count: 10 },
              { timeline: "three_months", count: 5 },
            ],
          ],
        ])
      );

      const constraint = createPropertyConstraint(
        "startTimeline",
        ["immediate", "two_weeks"],
        { displayValue: "Available within 2 weeks" }
      );

      const results = await queryConstraintsStats(session, [constraint]);
      const stStats = results[0] as StartTimelineConstraintStats;

      expect(stStats.type).toBe(ConstraintStatsType.StartTimeline);
      expect(stStats.countMatching).toBe(45); /* 25 + 20 */
      expect(stStats.requestedMaxTimeline).toBe("two_weeks");
      expect(stStats.countByTimeline).toEqual({
        immediate: 25,
        two_weeks: 20,
        one_month: 10,
        three_months: 5,
      });
    });
  });

  describe("fallback constraint stats", () => {
    it("returns count for unhandled property fields", async () => {
      const session = createMockSession(new Map([["WHERE", [{ count: 7 }]]]));

      const constraint = createPropertyConstraint("unknownField", "someValue", {
        cypher: {
          clause: "e.unknownField = $value",
          paramName: "value",
          paramValue: "someValue",
        },
      });

      const results = await queryConstraintsStats(session, [constraint]);

      expect(results[0].type).toBe(ConstraintStatsType.Fallback);
      expect(results[0].countMatching).toBe(7);
    });
  });
});
