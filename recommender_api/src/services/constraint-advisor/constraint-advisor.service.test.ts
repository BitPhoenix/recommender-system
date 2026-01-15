import { describe, it, expect, vi } from "vitest";
import { getConstraintAdvice } from "./constraint-advisor.service.js";
import type { ExpandedSearchCriteria } from "../constraint-expander.service.js";
import {
  AppliedFilterKind,
  RelaxationSuggestionType,
  type DerivedConstraintOverride,
  type AppliedFilter,
} from "../../types/search.types.js";

/*
 * Create a mock session that simulates Neo4j behavior.
 * The default implementation returns empty/error for unknown queries.
 */
function createMockSession(resultCounts: Map<string, number> = new Map()) {
  return {
    run: vi.fn().mockImplementation((query: string) => {
      // For tightening analysis queries, check if they match known patterns
      for (const [pattern, count] of resultCounts.entries()) {
        if (query.includes(pattern)) {
          return {
            records: [
              {
                get: (field: string) => {
                  /*
                   * Different constraint advisor queries use different field names:
                   * - resultCount: relaxation-generator, quickxplain (count queries)
                   * - count: tightening-generator (distribution queries)
                   * - total: tightening-generator (skill coverage analysis)
                   */
                  if (field === "resultCount" || field === "count" || field === "total") {
                    return { toNumber: () => count };
                  }
                  return null;
                },
              },
            ],
          };
        }
      }
      // Default: return empty records
      return { records: [] };
    }),
  } as any;
}

describe("getConstraintAdvice", () => {
  const baseExpanded: ExpandedSearchCriteria = {
    minYearsExperience: null,
    maxYearsExperience: null,
    startTimeline: ["immediate", "two_weeks"],
    timezonePrefixes: [],
    maxBudget: null,
    stretchBudget: null,
    alignedSkillIds: [],
    limit: 20,
    offset: 0,
    appliedFilters: [],
    appliedPreferences: [],
    defaultsApplied: [],
    preferredSeniorityLevel: null,
    requiredSeniorityLevel: null,
    preferredMaxStartTime: null,
    requiredMaxStartTime: "two_weeks",
    preferredTimezone: [],
    derivedConstraints: [],
    derivedRequiredSkillIds: [],
    derivedSkillBoosts: new Map(),
  };

  describe("sparse results (< 3)", () => {
    it("returns relaxation with conflict analysis for zero results", async () => {
      const session = createMockSession(new Map([["RETURN count", 0]]));

      const result = await getConstraintAdvice({
        session,
        totalCount: 0,
        expandedSearchCriteria: { ...baseExpanded, minYearsExperience: 10 },
        appliedFilters: [],
      });

      expect(result.relaxation).toBeDefined();
      expect(result.relaxation?.conflictAnalysis).toBeDefined();
      expect(result.tightening).toBeUndefined();
    });

    it("returns relaxation for sparse results (1-2)", async () => {
      const session = createMockSession(new Map([["RETURN count", 2]]));

      const result = await getConstraintAdvice({
        session,
        totalCount: 2,
        expandedSearchCriteria: baseExpanded,
        appliedFilters: [],
      });

      expect(result.relaxation).toBeDefined();
      expect(result.relaxation?.suggestions).toBeDefined();
    });

    it("includes conflictSets array in relaxation response", async () => {
      const session = createMockSession(new Map([["RETURN count", 0]]));

      const result = await getConstraintAdvice({
        session,
        totalCount: 0,
        expandedSearchCriteria: baseExpanded,
        appliedFilters: [
          { kind: AppliedFilterKind.Property, field: "salary", operator: "<=", value: "80000", source: "user" },
        ],
      });

      expect(result.relaxation?.conflictAnalysis.conflictSets).toBeDefined();
      expect(result.relaxation?.conflictAnalysis.conflictSets).toBeInstanceOf(Array);
    });
  });

  describe("many results (>= 25)", () => {
    it("returns tightening suggestions", async () => {
      /*
       * Create a mock that returns distribution data for tightening analysis.
       * These mocks simulate the tightening dimension queries.
       */
      const session = {
        run: vi.fn().mockResolvedValue({ records: [] }),
      } as any;

      const result = await getConstraintAdvice({
        session,
        totalCount: 30,
        expandedSearchCriteria: baseExpanded,
        appliedFilters: [],
      });

      expect(result.tightening).toBeDefined();
      expect(result.tightening?.suggestions).toBeDefined();
      expect(result.relaxation).toBeUndefined();
    });

    it("tightening suggestions is an array", async () => {
      const session = {
        run: vi.fn().mockResolvedValue({ records: [] }),
      } as any;

      const result = await getConstraintAdvice({
        session,
        totalCount: 30,
        expandedSearchCriteria: baseExpanded,
        appliedFilters: [],
      });

      expect(result.tightening?.suggestions).toBeInstanceOf(Array);
    });
  });

  describe("goldilocks zone (3-24)", () => {
    it("returns neither relaxation nor tightening", async () => {
      const session = createMockSession(new Map());

      const result = await getConstraintAdvice({
        session,
        totalCount: 15,
        expandedSearchCriteria: baseExpanded,
        appliedFilters: [],
      });

      expect(result.relaxation).toBeUndefined();
      expect(result.tightening).toBeUndefined();
    });

    it("returns empty object for exactly 3 results", async () => {
      const session = createMockSession(new Map());

      const result = await getConstraintAdvice({
        session,
        totalCount: 3,
        expandedSearchCriteria: baseExpanded,
        appliedFilters: [],
      });

      expect(result).toEqual({});
    });

    it("returns empty object for exactly 24 results", async () => {
      const session = createMockSession(new Map());

      const result = await getConstraintAdvice({
        session,
        totalCount: 24,
        expandedSearchCriteria: baseExpanded,
        appliedFilters: [],
      });

      expect(result).toEqual({});
    });
  });

  describe("threshold boundary cases", () => {
    it("triggers relaxation at exactly 2 results (< 3)", async () => {
      const session = createMockSession(new Map());

      const result = await getConstraintAdvice({
        session,
        totalCount: 2,
        expandedSearchCriteria: baseExpanded,
        appliedFilters: [],
      });

      expect(result.relaxation).toBeDefined();
      expect(result.tightening).toBeUndefined();
    });

    it("triggers tightening at exactly 25 results (>= 25)", async () => {
      const session = {
        run: vi.fn().mockResolvedValue({ records: [] }),
      } as any;

      const result = await getConstraintAdvice({
        session,
        totalCount: 25,
        expandedSearchCriteria: baseExpanded,
        appliedFilters: [],
      });

      expect(result.tightening).toBeDefined();
      expect(result.relaxation).toBeUndefined();
    });
  });

  describe("relaxation suggestion types", () => {
    it("suggests DerivedOverride for derived skill filters", async () => {
      const session = createMockSession(new Map([["RETURN count", 0]]));

      /*
       * Derived skill constraints now come through appliedFilters as AppliedSkillFilter
       * with a ruleId field, instead of a separate derivedConstraints parameter.
       */
      const derivedSkillFilter: AppliedFilter = {
        kind: AppliedFilterKind.Skill,
        field: 'derivedSkills',
        operator: 'HAS_ALL',
        skills: [{ skillId: 'skill_distributed', skillName: 'skill_distributed' }],
        displayValue: 'Derived: Scaling requires distributed',
        source: 'inference',
        ruleId: 'scaling-requires-distributed',
      };

      const result = await getConstraintAdvice({
        session,
        totalCount: 0,
        expandedSearchCriteria: baseExpanded,
        appliedFilters: [derivedSkillFilter],
      });

      expect(result.relaxation).toBeDefined();
      /*
       * The relaxation suggestions should include an option to override
       * the derived constraint via the discriminated union type.
       */
      const overrideSuggestion = result.relaxation?.suggestions.find(
        (s): s is DerivedConstraintOverride =>
          s.type === RelaxationSuggestionType.DerivedOverride &&
          s.ruleId === "scaling-requires-distributed"
      );
      expect(overrideSuggestion).toBeDefined();
      expect(overrideSuggestion?.ruleName).toBeDefined();
      expect(overrideSuggestion?.affectedConstraints).toBeDefined();
    });

    it("processes user property filters in relaxation analysis", async () => {
      const session = createMockSession(new Map([["RETURN count", 0]]));

      const userPropertyFilter: AppliedFilter = {
        kind: AppliedFilterKind.Property,
        field: 'salary',
        operator: '<=',
        value: '50000',
        source: 'user',
      };

      const result = await getConstraintAdvice({
        session,
        totalCount: 0,
        expandedSearchCriteria: baseExpanded,
        appliedFilters: [userPropertyFilter],
      });

      expect(result.relaxation).toBeDefined();
      expect(result.relaxation?.conflictAnalysis).toBeDefined();
      expect(result.relaxation?.suggestions).toBeInstanceOf(Array);
      /*
       * Verify NO DerivedOverride suggestions are generated for user constraints
       * (they should only be UserConstraint type when suggestions exist).
       */
      const derivedOverride = result.relaxation?.suggestions.find(
        (s) => s.type === RelaxationSuggestionType.DerivedOverride
      );
      expect(derivedOverride).toBeUndefined();
    });

    it("processes user skill filters (without ruleId) in relaxation analysis", async () => {
      const session = createMockSession(new Map([["RETURN count", 0]]));

      const userSkillFilter: AppliedFilter = {
        kind: AppliedFilterKind.Skill,
        field: 'requiredSkills',
        operator: 'HAS_ALL',
        skills: [{ skillId: 'skill_typescript', skillName: 'TypeScript' }],
        displayValue: 'TypeScript',
        source: 'user',
      };

      const result = await getConstraintAdvice({
        session,
        totalCount: 0,
        expandedSearchCriteria: baseExpanded,
        appliedFilters: [userSkillFilter],
      });

      expect(result.relaxation).toBeDefined();
      expect(result.relaxation?.conflictAnalysis).toBeDefined();
      /*
       * User skill filters (without ruleId) should NOT generate DerivedOverride
       * suggestions - only derived constraints with ruleId get override suggestions.
       */
      const derivedOverride = result.relaxation?.suggestions.find(
        (s) => s.type === RelaxationSuggestionType.DerivedOverride
      );
      expect(derivedOverride).toBeUndefined();
    });
  });
});
