# Fix LLM Integration Test Gaps - Implementation Plan

## Overview

The Local LLM Integration feature (Project 2.5) has significant testing gaps. Two new services (`conflict-stats.service.ts` and `conflict-explanation.service.ts`) have zero unit tests, and the E2E tests are checking for an outdated field name (`explanation` instead of `dataAwareExplanation`/`llmExplanation`).

## Current State Analysis

### Testing Gap Summary

| Component | Unit Tests | Integration Tests | E2E Coverage |
|-----------|------------|-------------------|--------------|
| `llm.service.ts` | ✅ Mocked | ✅ Real Ollama | N/A |
| `conflict-stats.service.ts` | ❌ **None** | ❌ None | Indirect |
| `conflict-explanation.service.ts` | ❌ **None** | ❌ None | ❌ **Outdated** |
| `constraint-advisor.service.ts` | ✅ But mocks explanation service | ❌ None | ❌ **Outdated** |

### Key Problems

1. **No unit tests for `conflict-explanation.service.ts`**
   - Template generation logic (`generateDataAwareExplanation`) untested
   - RAG context building (`buildRAGContext`) untested
   - Type-specific formatting untested

2. **No unit tests for `conflict-stats.service.ts`**
   - 5 type-specific query functions untested
   - Neo4j query patterns untested
   - Edge cases (empty results, null values) untested

3. **E2E tests check wrong field name**
   - Line 4336 in Postman collection: `pm.expect(firstConflict).to.have.property('explanation');`
   - Actual API returns: `dataAwareExplanation`, `llmExplanation`, `stats`
   - This test would currently fail or pass incorrectly

### Key Discoveries

- **Existing mock infrastructure**: `src/__mocks__/neo4j-session.mock.ts` provides `createMockSession()` and `mockData` factories
- **Test pattern**: Services use `vi.mock()` to mock dependencies
- **Sequential Neo4j queries**: `conflict-stats.service.ts` processes constraints sequentially (not parallel) due to session thread-safety

## Desired End State

After implementation:
1. `conflict-explanation.service.ts` has comprehensive unit tests covering all code paths
2. `conflict-stats.service.ts` has comprehensive unit tests for all query functions
3. E2E tests verify the correct dual-explanation fields
4. Integration gap is documented (constraint-advisor → conflict-explanation is mocked, which is acceptable for unit tests)

### Verification

- `npm test` passes with new tests
- `npm run test:coverage` shows >80% coverage for new service files
- `npm run test:e2e` passes with updated assertions

## What We're NOT Doing

- **Not adding integration tests for Neo4j queries** - Unit tests with mocked session are sufficient for this layer
- **Not adding integration tests for constraint-advisor → conflict-explanation** - The services are well-typed; mocking at service boundaries is standard practice
- **Not testing LLM response quality** - That's subjective and covered by the existing `llm.integration.test.ts`

## Implementation Approach

Create focused unit tests that verify:
1. Each code path in template generation
2. Each constraint type's formatting
3. RAG context structure
4. Neo4j query parameter handling
5. Edge cases (empty arrays, null values, zero counts)

---

## Phase 1: Add Unit Tests for `conflict-stats.service.ts`

### Overview
Add comprehensive unit tests for all query functions in the conflict stats service.

### Changes Required

#### 1. Create Test File
**File**: `recommender_api/src/services/constraint-advisor/conflict-stats.service.test.ts` (new file)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Session } from "neo4j-driver";
import {
  queryConstraintsStats,
  getCountMatchingAllConstraints,
} from "./conflict-stats.service.js";
import {
  ConstraintStatsType,
  SkillConstraintStats,
  SalaryConstraintStats,
  YearsExperienceConstraintStats,
  TimezoneConstraintStats,
  StartTimelineConstraintStats,
} from "./conflict-stats.types.js";
import {
  TestableConstraint,
  ConstraintType,
  PropertyFieldCategory,
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
                // Handle Neo4j Integer simulation
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
    displayValue: "expert TypeScript",
    origin: SkillConstraintOrigin.User,
    cypherFragment: '(e)-[:HAS_SKILL {proficiencyLevel: "expert"}]->(:Skill {id: "skill_typescript"})',
    source: "user",
    value: { minProficiency: "expert" },
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
  return {
    id: `${field}_0`,
    constraintType: ConstraintType.Property,
    field,
    fieldCategory: PropertyFieldCategory.Numeric,
    operator: "<=",
    value,
    displayValue: `${field} constraint`,
    cypherFragment: `e.${field} <= ${value}`,
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
      const session = createMockSession(
        new Map([["WHERE", [{ count: 5 }]]])
      );

      const constraints = [
        createPropertyConstraint("salary", 150000),
        createPropertyConstraint("yearsExperience", 5, { operator: ">=" }),
      ];

      const result = await getCountMatchingAllConstraints(session, constraints);
      expect(result).toBe(5);

      // Verify the query was called with combined WHERE clause
      const runCall = (session.run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(runCall[0]).toContain("AND");
    });

    it("handles skill constraints with EXISTS pattern", async () => {
      const session = createMockSession(
        new Map([["EXISTS", [{ count: 8 }]]])
      );

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
        displayValue: "Eastern or Central timezone",
      });

      const results = await queryConstraintsStats(session, [constraint]);
      const tzStats = results[0] as TimezoneConstraintStats;

      expect(tzStats.type).toBe(ConstraintStatsType.Timezone);
      expect(tzStats.countMatching).toBe(35); // 20 + 15
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
              { zone: null, count: 5 }, // Should be filtered
            ],
          ],
        ])
      );

      const constraint = createPropertyConstraint("timezone", ["Eastern"], {});

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
      expect(stStats.countMatching).toBe(45); // 25 + 20
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
      const session = createMockSession(
        new Map([["WHERE", [{ count: 7 }]]])
      );

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
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] New tests pass: `npm test -- src/services/constraint-advisor/conflict-stats.service.test.ts`
- [x] All existing tests still pass: `npm test`

---

## Phase 2: Add Unit Tests for `conflict-explanation.service.ts`

### Overview
Add comprehensive unit tests for the dual explanation generator, covering both template and RAG context formatting.

### Changes Required

#### 1. Create Test File
**File**: `recommender_api/src/services/constraint-advisor/conflict-explanation.service.test.ts` (new file)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Session } from "neo4j-driver";
import { generateConflictExplanations } from "./conflict-explanation.service.js";
import {
  ConflictStats,
  ConstraintStatsType,
  SkillConstraintStats,
  SalaryConstraintStats,
  YearsExperienceConstraintStats,
  TimezoneConstraintStats,
  StartTimelineConstraintStats,
  FallbackConstraintStats,
} from "./conflict-stats.types.js";

// Mock LLM service
vi.mock("../llm.service.js", () => ({
  generateCompletion: vi.fn(),
}));

// Mock conflict-stats service
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
function createSkillStats(overrides: Partial<SkillConstraintStats> = {}): SkillConstraintStats {
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

function createSalaryStats(overrides: Partial<SalaryConstraintStats> = {}): SalaryConstraintStats {
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
        .mockResolvedValueOnce([createSkillStats(), createSalaryStats(), createTimezoneStats()])
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
        .mockResolvedValueOnce([createSkillStats(), createSalaryStats(), createTimezoneStats()])
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
        expect(result.dataAwareExplanation).toContain("DB distribution:");
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
      vi.mocked(queryConstraintsStats).mockResolvedValue([createSkillStats({ countMatching: 0 })]);
      vi.mocked(generateCompletion).mockResolvedValue(null);

      const result = await generateConflictExplanations(mockSession, [], []);

      expect(result.dataAwareExplanation).toContain("0 engineers");
    });
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] New tests pass: `npm test -- src/services/constraint-advisor/conflict-explanation.service.test.ts`
- [x] All existing tests still pass: `npm test`

---

## Phase 3: Update E2E Tests for Dual Explanations

### Overview
Update the Postman collection to check for the correct field names (`dataAwareExplanation`, `llmExplanation`, `stats`) instead of the outdated `explanation` field.

### Changes Required

#### 1. Update Postman Collection
**File**: `postman/collections/search-filter-tests.postman_collection.json`

**Test 61 (lines ~4328-4337)**: Update conflict analysis assertions

Change from:
```javascript
pm.test('Conflict analysis identifies restrictive constraints', function() {
  const json = pm.response.json();
  pm.expect(json.relaxation.conflictAnalysis).to.have.property('conflictSets');
  pm.expect(json.relaxation.conflictAnalysis.conflictSets).to.be.an('array');
  pm.expect(json.relaxation.conflictAnalysis.conflictSets.length).to.be.at.least(1);
  const firstConflict = json.relaxation.conflictAnalysis.conflictSets[0];
  pm.expect(firstConflict).to.have.property('constraints');
  pm.expect(firstConflict).to.have.property('explanation');
});
```

To:
```javascript
pm.test('Conflict analysis identifies restrictive constraints', function() {
  const json = pm.response.json();
  pm.expect(json.relaxation.conflictAnalysis).to.have.property('conflictSets');
  pm.expect(json.relaxation.conflictAnalysis.conflictSets).to.be.an('array');
  pm.expect(json.relaxation.conflictAnalysis.conflictSets.length).to.be.at.least(1);
  const firstConflict = json.relaxation.conflictAnalysis.conflictSets[0];
  pm.expect(firstConflict).to.have.property('constraints');
  // Dual explanation fields (Project 2.5: Local LLM Integration)
  pm.expect(firstConflict).to.have.property('dataAwareExplanation');
  pm.expect(firstConflict.dataAwareExplanation).to.be.a('string').and.not.empty;
  // llmExplanation may be null if Ollama unavailable
  pm.expect(firstConflict).to.have.property('llmExplanation');
  // Stats provide transparency into constraint matching
  pm.expect(firstConflict).to.have.property('stats');
  pm.expect(firstConflict.stats).to.have.property('countMatchingAll');
  pm.expect(firstConflict.stats).to.have.property('conflictingConstraintStats');
});
```

### Success Criteria

#### Automated Verification:
- [x] E2E tests pass: `npm run test:e2e` (requires Tilt running)

#### Manual Verification:
- [x] Review Postman collection in Postman app to confirm assertions look correct (skipped - trusting automated tests)

**Implementation Note**: After completing this phase and automated verification passes, pause here for manual confirmation that E2E tests pass with Tilt running.

---

## Testing Strategy

### Unit Tests (Phases 1-2)
- Mock Neo4j sessions using established patterns from `neo4j-session.mock.ts`
- Mock LLM service to isolate explanation generation logic
- Cover all 6 constraint stat types with type-specific assertions
- Test edge cases: empty arrays, zero counts, null values

### E2E Tests (Phase 3)
- Verify API response structure matches updated types
- Confirm `dataAwareExplanation` is always present
- Accept `llmExplanation` being null (Ollama may not be running)

### Integration Testing Philosophy
The mocking of `conflict-explanation.service` in `constraint-advisor.service.test.ts` is **acceptable** because:
1. Both services have strong TypeScript types
2. Unit tests verify each service in isolation
3. E2E tests verify the full integration path
4. The services have clearly defined contracts (interfaces)

---

## Performance Considerations

- New unit tests add ~50 test cases, estimated +2-3 seconds to test suite
- No performance impact on production code

## References

- Implementation plan: `thoughts/shared/1_chapter_5/2.5_project_2.5/plans/2026-01-15-local-llm-integration-for-explanations.md`
- Walkthrough: `thoughts/shared/1_chapter_5/2.5_project_2.5/research/2026-01-16-local-llm-integration-walkthrough.md`
- Mock utilities: `recommender_api/src/__mocks__/neo4j-session.mock.ts`
