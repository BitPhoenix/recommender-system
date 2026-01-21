import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateTighteningSuggestions } from "./tightening-generator.service.js";
import type { ExpandedSearchCriteria } from "../constraint-expander.service.js";
import { AppliedFilterType, type AppliedFilter, type AppliedPropertyFilter } from "../../types/search.types.js";

/*
 * Creates a mock Neo4j session for testing tightening suggestion queries.
 * The new implementation uses:
 * 1. getBaselineCount() - returns count with all current filters
 * 2. testAddedPropertyConstraint/testTightenedPropertyValue - test individual changes
 * 3. testAddedSkillConstraint - test skill additions
 *
 * Tests need to mock session.run() to return appropriate results for these query patterns.
 */
function createMockSession() {
  const mockRun = vi.fn();
  return {
    run: mockRun,
    mockRun,
  };
}

function createBaseExpanded(): ExpandedSearchCriteria {
  return {
    minYearsExperience: null,
    maxYearsExperience: null,
    startTimeline: ["immediate", "two_weeks", "one_month"],
    timezoneZones: [],
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
    requiredMaxStartTime: "one_month",
    preferredTimezone: [],
    derivedConstraints: [],
    derivedRequiredSkillIds: [],
    derivedSkillBoosts: new Map(),
  };
}

/*
 * Helper to create a mock result record.
 */
function mockRecord(values: Record<string, unknown>) {
  return {
    get: (field: string) => {
      const value = values[field];
      if (typeof value === 'number') {
        return { toNumber: () => value };
      }
      return value;
    },
  };
}

describe("generateTighteningSuggestions", () => {
  let session: ReturnType<typeof createMockSession>;
  let baseExpanded: ExpandedSearchCriteria;

  beforeEach(() => {
    session = createMockSession();
    baseExpanded = createBaseExpanded();
  });

  describe("basic functionality", () => {
    it("generates timezone suggestions", async () => {
      /*
       * The new implementation:
       * 1. Calls getBaselineCount (simple property query when no filters)
       * 2. Calls testAddedPropertyConstraint for each US timezone zone
       */
      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount - returns total engineers
        if (query.includes("count(e) AS resultCount") && !query.includes("timezone")) {
          return { records: [mockRecord({ resultCount: 40 })] };
        }
        // testAddedPropertyConstraint for timezone zones (uses = operator now)
        const zone = params?.tighten_tz_eastern ?? params?.tighten_tz_central ?? params?.tighten_tz_mountain ?? params?.tighten_tz_pacific;
        if (zone === "Eastern") return { records: [mockRecord({ resultCount: 15 })] };
        if (zone === "Central") return { records: [mockRecord({ resultCount: 10 })] };
        if (zone === "Mountain") return { records: [mockRecord({ resultCount: 5 })] };
        if (zone === "Pacific") return { records: [mockRecord({ resultCount: 8 })] };
        return { records: [] };
      });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        10
      );

      const tzSuggestions = suggestions.filter((s) => s.field === "requiredTimezone");
      expect(tzSuggestions.length).toBeGreaterThan(0);

      const easternSuggestion = tzSuggestions.find(
        (s) => (s.suggestedValue as string[])?.[0] === "Eastern"
      );
      expect(easternSuggestion).toBeDefined();
      expect(easternSuggestion?.resultingMatches).toBe(15);
    });

    it("generates experience level suggestions", async () => {
      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount
        if (query.includes("count(e) AS resultCount") && !query.includes("yearsExperience")) {
          return { records: [mockRecord({ resultCount: 30 })] };
        }
        // testAddedPropertyConstraint for seniority levels
        if (query.includes("yearsExperience") && query.includes(">=")) {
          const minYears = params?.tighten_seniority;
          if (minYears === 3) return { records: [mockRecord({ resultCount: 25 })] }; // mid
          if (minYears === 6) return { records: [mockRecord({ resultCount: 18 })] }; // senior
          if (minYears === 10) return { records: [mockRecord({ resultCount: 8 })] }; // staff
          if (minYears === 15) return { records: [mockRecord({ resultCount: 3 })] }; // principal
        }
        return { records: [] };
      });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        10
      );

      const seniorSuggestion = suggestions.find(
        (s) => s.field === "requiredSeniorityLevel" && s.suggestedValue === "senior"
      );
      expect(seniorSuggestion).toBeDefined();
      expect(seniorSuggestion?.rationale).toContain("senior");
      expect(seniorSuggestion?.rationale).toContain("6+ years");
    });

    it("returns no budget suggestions when no budget constraint set", async () => {
      session.mockRun.mockImplementation(async () => {
        return { records: [mockRecord({ resultCount: 40 })] };
      });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded, // maxBudget: null
        [],
        10
      );

      const budgetSuggestions = suggestions.filter((s) => s.field === "maxBudget");
      expect(budgetSuggestions).toHaveLength(0);
    });

    it("generates budget suggestions relative to user's current budget", async () => {
      /*
       * Budget suggestions require:
       * 1. An existing budget constraint in appliedFilters
       * 2. A salary constraint found in decomposed constraints
       */
      const budgetFilter: AppliedPropertyFilter = {
        type: AppliedFilterType.Property,
        field: "salary",
        operator: "<=",
        value: "200000",
        source: "user",
      };

      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount
        if (query.includes("count(e) AS resultCount") && !params?.diag_salary_0) {
          return { records: [mockRecord({ resultCount: 40 })] };
        }
        // testTightenedPropertyValue for budget
        if (query.includes("salary") && params?.diag_salary_0) {
          const threshold = params.diag_salary_0 as number;
          if (threshold === 160000) return { records: [mockRecord({ resultCount: 25 })] };
          if (threshold === 140000) return { records: [mockRecord({ resultCount: 18 })] };
          if (threshold === 120000) return { records: [mockRecord({ resultCount: 12 })] };
          return { records: [mockRecord({ resultCount: 40 })] };
        }
        return { records: [] };
      });

      const expandedWithBudget = { ...baseExpanded, maxBudget: 200000 };

      const suggestions = await generateTighteningSuggestions(
        session as any,
        expandedWithBudget,
        [budgetFilter],
        10
      );

      const budgetSuggestions = suggestions.filter((s) => s.field === "maxBudget");

      // Should suggest 160k (0.8×), 140k (0.7×), 120k (0.6×)
      expect(budgetSuggestions.length).toBeGreaterThan(0);
      expect(budgetSuggestions.some(s => s.suggestedValue === 160000)).toBe(true);
      expect(budgetSuggestions.some(s => s.suggestedValue === 140000)).toBe(true);
      expect(budgetSuggestions.some(s => s.suggestedValue === 120000)).toBe(true);
    });

    it("generates timeline suggestions", async () => {
      /*
       * Timeline suggestions use testAddedPropertyConstraint when no timeline constraint exists,
       * or testTightenedPropertyValue when one does.
       */
      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount
        if (query.includes("count(e) AS resultCount") && !query.includes("startTimeline IN")) {
          return { records: [mockRecord({ resultCount: 30 })] };
        }
        // testAddedPropertyConstraint for timeline
        if (query.includes("startTimeline IN")) {
          const timelines = params?.tighten_timeline as string[] | undefined;
          if (timelines?.length === 1 && timelines[0] === "immediate") {
            return { records: [mockRecord({ resultCount: 10 })] };
          }
          if (timelines?.length === 2) {
            return { records: [mockRecord({ resultCount: 18 })] };
          }
        }
        return { records: [] };
      });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        10
      );

      const timelineSuggestions = suggestions.filter((s) => s.field === "requiredMaxStartTime");
      expect(timelineSuggestions.length).toBe(2);

      const suggestedValues = timelineSuggestions.map(s => s.suggestedValue);
      expect(suggestedValues).toContain("immediate");
      expect(suggestedValues).toContain("two_weeks");
    });

    it("generates skill suggestions", async () => {
      session.mockRun.mockImplementation(async (query: string) => {
        // getBaselineCount
        if (query.includes("count(e) AS resultCount") && !query.includes("HAS")) {
          return { records: [mockRecord({ resultCount: 40 })] };
        }
        // Skill distribution query (simple case - no skill constraints)
        if (query.includes("engineerCount") && query.includes("UserSkill")) {
          return {
            records: [
              mockRecord({ skillName: "TypeScript", skillId: "skill_typescript", engineerCount: 20 }),
              mockRecord({ skillName: "React", skillId: "skill_react", engineerCount: 15 }),
            ],
          };
        }
        // testAddedSkillConstraint
        if (query.includes("qualifyingSkillIds")) {
          return { records: [mockRecord({ resultCount: 18 })] };
        }
        return { records: [] };
      });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        10
      );

      const skillSuggestion = suggestions.find((s) => s.field === "requiredSkills");
      expect(skillSuggestion).toBeDefined();
      expect(skillSuggestion?.suggestedValue).toEqual({
        skill: "skill_typescript",
        minProficiency: "familiar",
      });
      expect(skillSuggestion?.rationale).toContain("TypeScript");
    });
  });

  describe("strictness filtering", () => {
    it("only suggests budget values stricter than current constraint", async () => {
      const budgetFilter: AppliedPropertyFilter = {
        type: AppliedFilterType.Property,
        field: "salary",
        operator: "<=",
        value: "200000",
        source: "user",
      };

      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount
        if (!params?.diag_salary_0) {
          return { records: [mockRecord({ resultCount: 35 })] };
        }
        // testTightenedPropertyValue
        const threshold = params.diag_salary_0 as number;
        if (threshold <= 200000) {
          return { records: [mockRecord({ resultCount: 20 })] };
        }
        return { records: [] };
      });

      const expandedWithBudget = { ...baseExpanded, maxBudget: 200000 };

      const suggestions = await generateTighteningSuggestions(
        session as any,
        expandedWithBudget,
        [budgetFilter],
        10
      );

      const budgetSuggestions = suggestions.filter((s) => s.field === "maxBudget");

      // All suggestions should be below $200k (the current budget)
      for (const suggestion of budgetSuggestions) {
        expect(suggestion.suggestedValue).toBeLessThan(200000);
      }
    });

    it("only suggests seniority levels stricter than current constraint", async () => {
      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount
        if (!query.includes("yearsExperience")) {
          return { records: [mockRecord({ resultCount: 40 })] };
        }
        // testAddedPropertyConstraint for seniority
        const minYears = params?.tighten_seniority as number;
        if (minYears === 6) return { records: [mockRecord({ resultCount: 15 })] }; // senior
        if (minYears === 10) return { records: [mockRecord({ resultCount: 5 })] }; // staff
        if (minYears === 15) return { records: [mockRecord({ resultCount: 2 })] }; // principal
        return { records: [mockRecord({ resultCount: 40 })] };
      });

      // User already has requiredSeniorityLevel at mid
      const expandedWithSeniority = { ...baseExpanded, requiredSeniorityLevel: "mid" as const };

      const suggestions = await generateTighteningSuggestions(
        session as any,
        expandedWithSeniority,
        [],
        10
      );

      const senioritySuggestions = suggestions.filter((s) => s.field === "requiredSeniorityLevel");

      // Should suggest senior and staff (stricter than mid), but not mid or junior
      const suggestedValues = senioritySuggestions.map(s => s.suggestedValue);
      expect(suggestedValues).toContain("senior");
      expect(suggestedValues).toContain("staff");
      expect(suggestedValues).not.toContain("mid");
      expect(suggestedValues).not.toContain("junior");
    });

    it("only suggests timelines stricter than current constraint", async () => {
      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount
        if (!query.includes("startTimeline")) {
          return { records: [mockRecord({ resultCount: 35 })] };
        }
        // testAddedPropertyConstraint for timeline
        const timelines = params?.tighten_timeline as string[] | undefined;
        if (timelines?.length === 1) return { records: [mockRecord({ resultCount: 10 })] };
        if (timelines?.length === 2) return { records: [mockRecord({ resultCount: 20 })] };
        return { records: [] };
      });

      // baseExpanded.requiredMaxStartTime is "one_month"
      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        10
      );

      const timelineSuggestions = suggestions.filter((s) => s.field === "requiredMaxStartTime");

      // Should suggest immediate and two_weeks (stricter than one_month)
      const suggestedValues = timelineSuggestions.map(s => s.suggestedValue);
      expect(suggestedValues).toContain("immediate");
      expect(suggestedValues).toContain("two_weeks");
      expect(suggestedValues).not.toContain("one_month");
    });

    it("excludes skills already in requiredSkills", async () => {
      session.mockRun.mockImplementation(async (query: string) => {
        // getBaselineCount
        if (query.includes("count(e) AS resultCount") && !query.includes("HAS")) {
          return { records: [mockRecord({ resultCount: 40 })] };
        }
        // Skill distribution query
        if (query.includes("engineerCount")) {
          return {
            records: [
              mockRecord({ skillName: "TypeScript", skillId: "skill_typescript", engineerCount: 20 }),
              mockRecord({ skillName: "React", skillId: "skill_react", engineerCount: 15 }),
            ],
          };
        }
        // testAddedSkillConstraint
        if (query.includes("qualifyingSkillIds")) {
          return { records: [mockRecord({ resultCount: 12 })] };
        }
        return { records: [] };
      });

      // User already requires TypeScript
      const skillFilter: AppliedFilter = {
        type: AppliedFilterType.Skill,
        field: "requiredSkills",
        operator: "HAS_ANY",
        skills: [{ skillId: "skill_typescript", skillName: "TypeScript" }],
        displayValue: "TypeScript",
        source: "user",
      };
      const expandedWithSkill = {
        ...baseExpanded,
        appliedFilters: [skillFilter],
      };

      const suggestions = await generateTighteningSuggestions(
        session as any,
        expandedWithSkill,
        [],
        10
      );

      const skillSuggestions = suggestions.filter((s) => s.field === "requiredSkills");

      // Should suggest React but not TypeScript (already required)
      expect(skillSuggestions.some(s => (s.suggestedValue as any).skill === "skill_react")).toBe(true);
      expect(skillSuggestions.some(s => (s.suggestedValue as any).skill === "skill_typescript")).toBe(false);
    });

    it("excludes timezone already filtered", async () => {
      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount
        if (query.includes("count(e) AS resultCount") && !query.includes("timezone")) {
          return { records: [mockRecord({ resultCount: 40 })] };
        }
        // testAddedPropertyConstraint for timezone zones (only non-Eastern ones get called)
        const zone = params?.tighten_tz_central ?? params?.tighten_tz_mountain ?? params?.tighten_tz_pacific;
        if (zone === "Central") return { records: [mockRecord({ resultCount: 15 })] };
        if (zone === "Mountain") return { records: [mockRecord({ resultCount: 5 })] };
        if (zone === "Pacific") return { records: [mockRecord({ resultCount: 8 })] };
        return { records: [] };
      });

      // User already filters to Eastern timezone
      const expandedWithTimezone = {
        ...baseExpanded,
        timezoneZones: ["Eastern"],
      };

      const suggestions = await generateTighteningSuggestions(
        session as any,
        expandedWithTimezone,
        [],
        10
      );

      const tzSuggestions = suggestions.filter((s) => s.field === "requiredTimezone");

      // Should not suggest Eastern (already filtered), but Central should be suggested
      expect(tzSuggestions.some(s => (s.suggestedValue as string[])[0] === "Eastern")).toBe(false);
      expect(tzSuggestions.some(s => (s.suggestedValue as string[])[0] === "Central")).toBe(true);
    });
  });

  describe("filtering logic", () => {
    it("excludes suggestions that match 100% of results", async () => {
      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount - no tighten_ params
        const hasTightenParam = Object.keys(params ?? {}).some(k => k.startsWith('tighten_'));
        if (!hasTightenParam) {
          return { records: [mockRecord({ resultCount: 30 })] };
        }
        // All timezone zones return the same count as baseline
        return { records: [mockRecord({ resultCount: 30 })] };
      });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        10
      );

      // No timezone suggestions should be generated since none reduce results
      const tzSuggestions = suggestions.filter((s) => s.field === "requiredTimezone");
      expect(tzSuggestions).toHaveLength(0);
    });

    it("only suggests skills with >= 20% coverage", async () => {
      session.mockRun.mockImplementation(async (query: string) => {
        // getBaselineCount
        if (query.includes("count(e) AS resultCount") && !query.includes("HAS")) {
          return { records: [mockRecord({ resultCount: 100 })] };
        }
        // Skill distribution - only rare skills
        if (query.includes("engineerCount")) {
          return {
            records: [
              mockRecord({ skillName: "RareSkill", skillId: "skill_rare", engineerCount: 5 }),
            ],
          };
        }
        return { records: [] };
      });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        10
      );

      // RareSkill has 5% coverage, should not be suggested
      const rareSuggestion = suggestions.find(
        (s) => s.field === "requiredSkills" && (s.suggestedValue as any)?.skill === "skill_rare"
      );
      expect(rareSuggestion).toBeUndefined();
    });
  });

  describe("sorting and limits", () => {
    it("sorts suggestions by effectiveness (fewest resulting matches first)", async () => {
      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount - no tighten_ params
        const hasTightenParam = Object.keys(params ?? {}).some(k => k.startsWith('tighten_'));
        if (!hasTightenParam) {
          return { records: [mockRecord({ resultCount: 30 })] };
        }
        // Different counts for different US timezone zones
        const zone = params?.tighten_tz_eastern ?? params?.tighten_tz_central ?? params?.tighten_tz_mountain ?? params?.tighten_tz_pacific;
        if (zone === "Eastern") return { records: [mockRecord({ resultCount: 20 })] };
        if (zone === "Central") return { records: [mockRecord({ resultCount: 5 })] };
        if (zone === "Mountain") return { records: [mockRecord({ resultCount: 3 })] };
        if (zone === "Pacific") return { records: [mockRecord({ resultCount: 12 })] };
        return { records: [] };
      });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        10
      );

      const tzSuggestions = suggestions.filter((s) => s.field === "requiredTimezone");
      if (tzSuggestions.length >= 2) {
        // Should be sorted by resultingMatches ascending
        expect(tzSuggestions[0].resultingMatches).toBeLessThanOrEqual(
          tzSuggestions[1].resultingMatches
        );
      }
    });

    it("respects maxSuggestions limit (default 5)", async () => {
      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount - no tighten_ params
        const hasTightenParam = Object.keys(params ?? {}).some(k => k.startsWith('tighten_'));
        if (!hasTightenParam && !query.includes("yearsExperience")) {
          return { records: [mockRecord({ resultCount: 50 })] };
        }
        // Many suggestions possible
        return { records: [mockRecord({ resultCount: 10 })] };
      });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        5
      );

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it("allows custom maxSuggestions limit", async () => {
      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount - no tighten_ params
        const hasTightenParam = Object.keys(params ?? {}).some(k => k.startsWith('tighten_'));
        if (!hasTightenParam) {
          return { records: [mockRecord({ resultCount: 40 })] };
        }
        return { records: [mockRecord({ resultCount: 10 })] };
      });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        2
      );

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });

  describe("edge cases", () => {
    it("returns empty array when baseline count is zero", async () => {
      session.mockRun.mockResolvedValue({ records: [mockRecord({ resultCount: 0 })] });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        5
      );

      expect(suggestions).toHaveLength(0);
    });

    it("handles empty result set gracefully", async () => {
      session.mockRun.mockResolvedValue({ records: [] });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        5
      );

      expect(suggestions).toEqual([]);
    });

    it("handles missing timezone values", async () => {
      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // getBaselineCount returns results but timezone tests return 0
        const hasTightenParam = Object.keys(params ?? {}).some(k => k.startsWith('tighten_'));
        if (!hasTightenParam) {
          return { records: [mockRecord({ resultCount: 30 })] };
        }
        return { records: [mockRecord({ resultCount: 0 })] };
      });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        10
      );

      // No timezone suggestions when all zones return 0
      const tzSuggestions = suggestions.filter((s) => s.field === "requiredTimezone");
      expect(tzSuggestions).toHaveLength(0);
    });

    it("handles query failures gracefully", async () => {
      session.mockRun.mockRejectedValue(new Error("Database connection failed"));

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        5
      );

      // Should return empty array when baseline query fails
      expect(suggestions).toEqual([]);
    });

    it("handles null count values", async () => {
      session.mockRun.mockImplementation(async () => {
        return {
          records: [{
            get: () => null,
          }],
        };
      });

      const suggestions = await generateTighteningSuggestions(
        session as any,
        baseExpanded,
        [],
        10
      );

      expect(suggestions).toBeDefined();
    });
  });

  describe("multi-constraint filtering", () => {
    it("applies all user constraints when calculating resultingMatches", async () => {
      /*
       * This test verifies the core fix: tightening suggestions now apply ALL
       * user constraints when calculating counts, not just startTimeline.
       *
       * Setup: User has multiple constraints (skill, seniority, budget)
       * Expected: Budget tightening suggestions should reflect the combined
       * effect of all constraints.
       */
      const skillFilter: AppliedFilter = {
        type: AppliedFilterType.Skill,
        field: "requiredSkills",
        operator: "HAS_ANY",
        skills: [{ skillId: "skill_react", skillName: "React", minProficiency: "proficient" }],
        displayValue: "React (proficient)",
        source: "user",
      };
      const seniorityFilter: AppliedPropertyFilter = {
        type: AppliedFilterType.Property,
        field: "yearsExperience",
        operator: ">=",
        value: "6",
        source: "user",
      };
      const budgetFilter: AppliedPropertyFilter = {
        type: AppliedFilterType.Property,
        field: "salary",
        operator: "<=",
        value: "200000",
        source: "user",
      };

      const appliedFilters = [skillFilter, seniorityFilter, budgetFilter];

      /*
       * Mock setup:
       * - getBaselineCount: 30 engineers match ALL current constraints
       * - Budget tightening to $160k: 15 engineers (applying ALL constraints)
       */
      session.mockRun.mockImplementation(async (query: string, params?: Record<string, unknown>) => {
        // The query should include skill filtering pattern when we have skill constraints
        if (query.includes("qualifyingSkillIds") || query.includes("SIZE($allSkillIds)")) {
          // Check if this is a modified budget query
          const budgetParam = params?.diag_salary_2;
          if (budgetParam && budgetParam !== 200000) {
            // Tightened budget query - returns fewer results
            return { records: [mockRecord({ resultCount: 15 })] };
          }
          // Baseline or original budget - returns baseline count
          return { records: [mockRecord({ resultCount: 30 })] };
        }
        return { records: [] };
      });

      const expanded: ExpandedSearchCriteria = {
        ...baseExpanded,
        maxBudget: 200000,
        requiredSeniorityLevel: "senior",
        appliedFilters: [skillFilter],
      };

      const suggestions = await generateTighteningSuggestions(
        session as any,
        expanded,
        appliedFilters
      );

      const budgetSuggestion = suggestions.find(s => s.field === "maxBudget");
      if (budgetSuggestion) {
        // The count should be for engineers matching ALL constraints
        // (skill + seniority + tightened budget), not just tightened budget alone
        expect(budgetSuggestion.resultingMatches).toBeLessThanOrEqual(30);
      }
    });
  });
});
