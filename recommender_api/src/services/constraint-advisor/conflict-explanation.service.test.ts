import { describe, it, expect, vi, beforeEach } from "vitest";
import { Session } from "neo4j-driver";
import { generateConflictExplanations } from "./conflict-explanation.service.js";
import {
  type ConflictStats,
  ConstraintStatsType,
  type SkillConstraintStats,
  type SalaryConstraintStats,
  type YearsExperienceConstraintStats,
  type TimezoneConstraintStats,
  type StartTimelineConstraintStats,
  type FallbackConstraintStats,
} from "./conflict-stats.types.js";

/* Mock LLM service */
vi.mock("../llm.service.js", () => ({
  generateCompletion: vi.fn(),
}));

/* Mock conflict-stats service */
vi.mock("./conflict-stats.service.js", () => ({
  queryConstraintsStats: vi.fn(),
  getCountMatchingAllConstraints: vi.fn(),
}));

import { generateCompletion } from "../llm.service.js";
import {
  queryConstraintsStats,
  getCountMatchingAllConstraints,
} from "./conflict-stats.service.js";

/*
 * Factory functions for creating test stats
 */
function createSkillStats(
  overrides: Partial<SkillConstraintStats> = {}
): SkillConstraintStats {
  return {
    type: ConstraintStatsType.Skill,
    displayValue: "expert TypeScript",
    countMatching: 25,
    skillId: "skill_typescript",
    proficiency: "expert",
    countAtLowerProficiency: 10,
    ...overrides,
  };
}

function createSalaryStats(
  overrides: Partial<SalaryConstraintStats> = {}
): SalaryConstraintStats {
  return {
    type: ConstraintStatsType.Salary,
    displayValue: "salary ≤ $150,000",
    countMatching: 30,
    requestedMax: 150000,
    minSalaryInDb: 75000,
    maxSalaryInDb: 350000,
    ...overrides,
  };
}

function createYearsExperienceStats(
  overrides: Partial<YearsExperienceConstraintStats> = {}
): YearsExperienceConstraintStats {
  return {
    type: ConstraintStatsType.YearsExperience,
    displayValue: "10+ years (staff)",
    countMatching: 12,
    requestedMinYears: 10,
    requestedMaxYears: null,
    minYearsInDb: 0,
    maxYearsInDb: 25,
    countByRange: {
      junior: 5,
      mid: 12,
      senior: 15,
      staffPlus: 8,
    },
    ...overrides,
  };
}

function createTimezoneStats(
  overrides: Partial<TimezoneConstraintStats> = {}
): TimezoneConstraintStats {
  return {
    type: ConstraintStatsType.Timezone,
    displayValue: "Eastern timezone",
    countMatching: 20,
    requestedZones: ["Eastern"],
    countByZone: {
      Eastern: 20,
      Central: 15,
      Mountain: 8,
      Pacific: 12,
    },
    ...overrides,
  };
}

function createStartTimelineStats(
  overrides: Partial<StartTimelineConstraintStats> = {}
): StartTimelineConstraintStats {
  return {
    type: ConstraintStatsType.StartTimeline,
    displayValue: "available within 2 weeks",
    countMatching: 45,
    requestedMaxTimeline: "two_weeks",
    countByTimeline: {
      immediate: 25,
      two_weeks: 20,
      one_month: 10,
      three_months: 5,
    },
    ...overrides,
  };
}

function createFallbackStats(
  overrides: Partial<FallbackConstraintStats> = {}
): FallbackConstraintStats {
  return {
    type: ConstraintStatsType.Fallback,
    displayValue: "custom filter",
    countMatching: 8,
    ...overrides,
  };
}

describe("conflict-explanation.service", () => {
  const mockSession = {} as Session;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateConflictExplanations", () => {
    it("returns all three fields: dataAwareExplanation, llmExplanation, stats", async () => {
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
      vi.mocked(queryConstraintsStats)
        .mockResolvedValueOnce([createSkillStats(), createSalaryStats()])
        .mockResolvedValueOnce([createSkillStats(), createSalaryStats()]);
      vi.mocked(generateCompletion).mockResolvedValue("LLM explanation here");

      const result = await generateConflictExplanations(mockSession, [], []);

      expect(result).toHaveProperty("dataAwareExplanation");
      expect(result).toHaveProperty("llmExplanation");
      expect(result).toHaveProperty("stats");
      expect(result.llmExplanation).toBe("LLM explanation here");
    });

    it("returns null llmExplanation when LLM unavailable", async () => {
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
      vi.mocked(queryConstraintsStats).mockResolvedValue([]);
      vi.mocked(generateCompletion).mockResolvedValue(null);

      const result = await generateConflictExplanations(mockSession, [], []);

      expect(result.dataAwareExplanation).toBeTruthy();
      expect(result.llmExplanation).toBeNull();
    });

    it("queries stats for both all constraints and conflict set", async () => {
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(5);
      vi.mocked(queryConstraintsStats)
        .mockResolvedValueOnce([
          createSkillStats(),
          createSalaryStats(),
          createTimezoneStats(),
        ])
        .mockResolvedValueOnce([createSkillStats(), createSalaryStats()]);
      vi.mocked(generateCompletion).mockResolvedValue(null);

      const allConstraints = [{}, {}, {}] as any;
      const conflictSetConstraints = [{}, {}] as any;

      const result = await generateConflictExplanations(
        mockSession,
        allConstraints,
        conflictSetConstraints
      );

      expect(queryConstraintsStats).toHaveBeenCalledTimes(2);
      expect(result.stats.allConstraintStats).toHaveLength(3);
      expect(result.stats.conflictingConstraintStats).toHaveLength(2);
    });
  });

  describe("dataAwareExplanation formatting", () => {
    beforeEach(() => {
      vi.mocked(generateCompletion).mockResolvedValue(null);
    });

    it("includes total matching count", async () => {
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(42);
      vi.mocked(queryConstraintsStats).mockResolvedValue([]);

      const result = await generateConflictExplanations(mockSession, [], []);

      expect(result.dataAwareExplanation).toContain("42 engineers");
    });

    it("includes 'The conflict:' section when conflicting constraints exist", async () => {
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
      vi.mocked(queryConstraintsStats)
        .mockResolvedValueOnce([createSkillStats()])
        .mockResolvedValueOnce([createSkillStats()]);

      const result = await generateConflictExplanations(mockSession, [], []);

      expect(result.dataAwareExplanation).toContain("The conflict:");
    });

    it("includes 'Full query breakdown:' when all constraints > conflicting constraints", async () => {
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
      vi.mocked(queryConstraintsStats)
        .mockResolvedValueOnce([
          createSkillStats(),
          createSalaryStats(),
          createTimezoneStats(),
        ])
        .mockResolvedValueOnce([createSkillStats()]);

      const result = await generateConflictExplanations(mockSession, [], []);

      expect(result.dataAwareExplanation).toContain("Full query breakdown:");
    });

    it("omits 'Full query breakdown:' when arrays are same length", async () => {
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
      vi.mocked(queryConstraintsStats).mockResolvedValue([createSkillStats()]);

      const result = await generateConflictExplanations(mockSession, [], []);

      expect(result.dataAwareExplanation).not.toContain("Full query breakdown:");
    });

    describe("constraint type formatting", () => {
      it("formats skill stats with proficiency and lower alternatives", async () => {
        vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
        vi.mocked(queryConstraintsStats).mockResolvedValue([
          createSkillStats({ countMatching: 25, countAtLowerProficiency: 10 }),
        ]);

        const result = await generateConflictExplanations(mockSession, [], []);

        expect(result.dataAwareExplanation).toContain("25 with expert");
        expect(result.dataAwareExplanation).toContain("(10 at lower proficiency)");
      });

      it("omits lower proficiency when zero", async () => {
        vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
        vi.mocked(queryConstraintsStats).mockResolvedValue([
          createSkillStats({ countAtLowerProficiency: 0 }),
        ]);

        const result = await generateConflictExplanations(mockSession, [], []);

        expect(result.dataAwareExplanation).not.toContain("at lower proficiency");
      });

      it("formats salary stats with budget and range", async () => {
        vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
        vi.mocked(queryConstraintsStats).mockResolvedValue([
          createSalaryStats({
            countMatching: 30,
            requestedMax: 150000,
            minSalaryInDb: 75000,
            maxSalaryInDb: 350000,
          }),
        ]);

        const result = await generateConflictExplanations(mockSession, [], []);

        expect(result.dataAwareExplanation).toContain("30 within $150,000 budget");
        expect(result.dataAwareExplanation).toContain("$75,000-$350,000");
      });

      it("formats years experience with range and distribution", async () => {
        vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
        vi.mocked(queryConstraintsStats).mockResolvedValue([
          createYearsExperienceStats({ requestedMaxYears: null }),
        ]);

        const result = await generateConflictExplanations(mockSession, [], []);

        expect(result.dataAwareExplanation).toContain("10+ years");
        expect(result.dataAwareExplanation).toContain("junior:");
        expect(result.dataAwareExplanation).toContain("staff+:");
      });

      it("formats years experience with bounded range", async () => {
        vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
        vi.mocked(queryConstraintsStats).mockResolvedValue([
          createYearsExperienceStats({ requestedMinYears: 3, requestedMaxYears: 6 }),
        ]);

        const result = await generateConflictExplanations(mockSession, [], []);

        expect(result.dataAwareExplanation).toContain("3-6 years");
      });

      it("formats timezone stats with zones and distribution", async () => {
        vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
        vi.mocked(queryConstraintsStats).mockResolvedValue([
          createTimezoneStats({ requestedZones: ["Eastern", "Central"] }),
        ]);

        const result = await generateConflictExplanations(mockSession, [], []);

        expect(result.dataAwareExplanation).toContain("in Eastern or Central");
        expect(result.dataAwareExplanation).toContain("distribution:");
      });

      it("formats start timeline stats with availability", async () => {
        vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
        vi.mocked(queryConstraintsStats).mockResolvedValue([createStartTimelineStats()]);

        const result = await generateConflictExplanations(mockSession, [], []);

        expect(result.dataAwareExplanation).toContain("available within two_weeks");
        expect(result.dataAwareExplanation).toContain("immediate:");
      });

      it("formats fallback stats with basic count", async () => {
        vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
        vi.mocked(queryConstraintsStats).mockResolvedValue([createFallbackStats()]);

        const result = await generateConflictExplanations(mockSession, [], []);

        expect(result.dataAwareExplanation).toContain('8 matching "custom filter"');
      });
    });
  });

  describe("RAG context for LLM", () => {
    it("passes structured markdown context to LLM", async () => {
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
      vi.mocked(queryConstraintsStats)
        .mockResolvedValueOnce([createSkillStats()])
        .mockResolvedValueOnce([createSkillStats()]);
      vi.mocked(generateCompletion).mockResolvedValue("LLM response");

      await generateConflictExplanations(mockSession, [], []);

      const [ragContext] = vi.mocked(generateCompletion).mock.calls[0];

      expect(ragContext).toContain("# Search Query Analysis");
      expect(ragContext).toContain("## Conflicting Constraints");
      expect(ragContext).toContain("## Full Query Breakdown");
    });

    it("includes system prompt for talent acquisition expert", async () => {
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
      vi.mocked(queryConstraintsStats).mockResolvedValue([]);
      vi.mocked(generateCompletion).mockResolvedValue(null);

      await generateConflictExplanations(mockSession, [], []);

      const [, options] = vi.mocked(generateCompletion).mock.calls[0];

      expect(options?.systemPrompt).toContain("tech talent acquisition");
      expect(options?.systemPrompt).toContain("2-4 sentences");
    });
  });

  describe("edge cases", () => {
    it("handles empty constraint arrays", async () => {
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(100);
      vi.mocked(queryConstraintsStats).mockResolvedValue([]);
      vi.mocked(generateCompletion).mockResolvedValue(null);

      const result = await generateConflictExplanations(mockSession, [], []);

      expect(result.dataAwareExplanation).toContain("100 engineers");
      expect(result.stats.conflictingConstraintStats).toEqual([]);
    });

    it("handles zero matching engineers", async () => {
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);
      vi.mocked(queryConstraintsStats).mockResolvedValue([
        createSkillStats({ countMatching: 0 }),
      ]);
      vi.mocked(generateCompletion).mockResolvedValue(null);

      const result = await generateConflictExplanations(mockSession, [], []);

      expect(result.dataAwareExplanation).toContain("0 engineers");
    });
  });
});
