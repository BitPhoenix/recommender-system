# Deterministic Skill Years Calculation Implementation Plan

## Overview

Calculate `yearsUsed` for each UserSkill by summing the duration of WorkExperiences where that skill was used, with proper interval merging to avoid double-counting overlapping jobs.

## Current State Analysis

### What Exists

- **UserSkill.yearsUsed** is already defined in the type system (`seeds/types.ts:58`) and expected by search queries (`us.yearsUsed` in Cypher)
- **Seeded engineers** have `yearsUsed` manually specified in seed data
- **Resume-uploaded engineers** create UserSkill nodes WITHOUT `yearsUsed` (defaults to null)
- **WorkExperience nodes** have `startDate` and `endDate` properties (normalized by LLM)
- **USED_AT relationships** link UserSkills to WorkExperiences where the skill was used
- **Feature extraction** already normalizes dates to 3 formats: `"YYYY-MM"`, `"YYYY"`, `"present"`

### Key Code Locations

- `recommender_api/src/services/user-skill.service.ts:36-73` - Creates UserSkills and USED_AT relationships (no yearsUsed)
- `recommender_api/src/services/work-experience.service.ts:10-62` - Creates WorkExperiences with startDate/endDate
- `recommender_api/src/services/resume-processor/feature-extractor.service.ts:121-172` - LLM prompt normalizes dates
- `recommender_api/src/services/cypher-query-builder/search-query.builder.ts:652,683,718` - Reads `us.yearsUsed`

## Desired End State

After resume upload:
1. Each UserSkill node has a `yearsUsed` property reflecting total calendar years using that skill
2. Overlapping job durations are merged (not double-counted)
3. Search results correctly show years of experience per matched skill

### Design Decision: What NOT to Store

**Per-job skill duration** (e.g., "2.5 years of React at Company X") will NOT be stored separately because:
- It's derivable from existing data: `UserSkill -[:USED_AT]-> WorkExperience { startDate, endDate }`
- Storing it creates sync issues if dates are corrected
- No current use case requires it

When needed (e.g., for richer explanations or recency weighting), compute at query time. The merged total `yearsUsed` IS worth storing because:
- Interval merging is non-trivial computation
- It's used in search ranking on every query
- Recomputing on every search would be wasteful

### Verification

- All automated tests pass (`npm test`, `npm run typecheck`)
- Resume upload correctly calculates yearsUsed for each skill
- Overlapping jobs are merged correctly (no double-counting)
- Skills only in standalone Skills section (no USED_AT links) get `yearsUsed: 0`

## What We're NOT Doing

- Modifying the LLM extraction prompt (dates already normalized)
- Storing per-job skill duration on USED_AT relationships
- Implementing recency weighting or decay functions (future enhancement)
- Changing WorkExperience or search query schemas

## Implementation Approach

Three phases, each building on the previous:

1. **Phase 1: Date Utilities** - Parse normalized date strings, calculate month differences
2. **Phase 2: Interval Merging** - Merge overlapping date ranges, sum total months
3. **Phase 3: Pipeline Integration** - Calculate and store yearsUsed during resume upload

---

## Phase 1: Date Utilities

### Overview

Create utility functions to parse the LLM-normalized date formats and calculate durations.

### Changes Required

#### 1.1 New Date Utility Module

**File**: `recommender_api/src/services/resume-processor/date-utils.ts` (new)

```typescript
/*
 * Date utilities for calculating skill years from WorkExperience date ranges.
 *
 * IMPORTANT: These functions expect LLM-normalized date formats only:
 * - "YYYY-MM" (e.g., "2020-01")
 * - "YYYY" (e.g., "2020")
 * - "present"
 *
 * Raw resume date formats are normalized by the LLM during feature extraction.
 * See feature-extractor.service.ts for the extraction prompt.
 */

/*
 * A date represented as year and month (1-indexed).
 * Using a simple object instead of Date to avoid timezone issues.
 */
export interface YearMonth {
  year: number;
  month: number; // 1-12
}

/*
 * Parse a normalized date string into YearMonth.
 *
 * Handles three formats from LLM extraction:
 * - "YYYY-MM" → exact year and month
 * - "YYYY" → defaults to January (for start) or December (for end)
 * - "present" → current year and month
 *
 * @param dateString - The normalized date string
 * @param isEndDate - If true and format is "YYYY", defaults to December
 */
export function parseDateString(dateString: string, isEndDate: boolean = false): YearMonth {
  const normalized = dateString.toLowerCase().trim();

  if (normalized === "present") {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  // Try YYYY-MM format
  const yearMonthMatch = normalized.match(/^(\d{4})-(\d{2})$/);
  if (yearMonthMatch) {
    return {
      year: parseInt(yearMonthMatch[1], 10),
      month: parseInt(yearMonthMatch[2], 10),
    };
  }

  // Try YYYY format
  const yearOnlyMatch = normalized.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    return {
      year: parseInt(yearOnlyMatch[1], 10),
      month: isEndDate ? 12 : 1,
    };
  }

  // Fail fast: unexpected format indicates a bug in LLM extraction
  throw new Error(`[date-utils] Unexpected date format: "${dateString}". Expected "YYYY-MM", "YYYY", or "present".`);
}

/*
 * Calculate the number of months between two YearMonth values (inclusive).
 *
 * Examples:
 * - 2020-01 to 2020-01 → 1 month (same month counts as 1)
 * - 2020-01 to 2020-12 → 12 months
 * - 2020-01 to 2021-01 → 13 months
 *
 * If end is before start, returns 0.
 */
export function monthsBetween(start: YearMonth, end: YearMonth): number {
  /*
   * +1 for inclusive counting of both start and end months.
   * Example: Jan 2020 to Dec 2020
   *   - Without +1: 12 - 1 = 11 months (wrong)
   *   - With +1: 12 - 1 + 1 = 12 months (correct)
   * Example: Jan 2020 to Jan 2020 (same month)
   *   - Without +1: 1 - 1 = 0 months (wrong - they worked that month!)
   *   - With +1: 1 - 1 + 1 = 1 month (correct)
   */
  const diff = toMonthNumber(end) - toMonthNumber(start) + 1;
  return Math.max(0, diff);
}

/*
 * Convert YearMonth to a comparable number (months since year 0).
 * Used for sorting and comparing intervals.
 */
export function toMonthNumber(date: YearMonth): number {
  return date.year * 12 + date.month;
}

/*
 * Convert months to years, rounded to 1 decimal place.
 */
export function monthsToYears(months: number): number {
  return Math.round((months / 12) * 10) / 10;
}
```

#### 1.2 Unit Tests for Date Utilities

**File**: `recommender_api/src/services/resume-processor/date-utils.test.ts` (new)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseDateString,
  monthsBetween,
  toMonthNumber,
  monthsToYears,
  type YearMonth,
} from "./date-utils.js";

describe("date-utils", () => {
  describe("parseDateString", () => {
    it("parses YYYY-MM format", () => {
      expect(parseDateString("2020-01")).toEqual({ year: 2020, month: 1 });
      expect(parseDateString("2023-12")).toEqual({ year: 2023, month: 12 });
    });

    it("parses YYYY format with default months", () => {
      // Start date defaults to January
      expect(parseDateString("2020", false)).toEqual({ year: 2020, month: 1 });
      // End date defaults to December
      expect(parseDateString("2020", true)).toEqual({ year: 2020, month: 12 });
    });

    it("parses 'present' as current date", () => {
      // Mock current date to 2026-01-23
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 23)); // January is month 0

      expect(parseDateString("present")).toEqual({ year: 2026, month: 1 });
      expect(parseDateString("PRESENT")).toEqual({ year: 2026, month: 1 });

      vi.useRealTimers();
    });

    it("throws error for unexpected formats", () => {
      expect(() => parseDateString("invalid")).toThrow(
        '[date-utils] Unexpected date format: "invalid"'
      );
      expect(() => parseDateString("Jan 2020")).toThrow(
        '[date-utils] Unexpected date format: "Jan 2020"'
      );
      expect(() => parseDateString("2020/01")).toThrow(
        '[date-utils] Unexpected date format: "2020/01"'
      );
    });
  });

  describe("monthsBetween", () => {
    it("calculates months for same month (minimum 1)", () => {
      expect(monthsBetween({ year: 2020, month: 1 }, { year: 2020, month: 1 })).toBe(1);
    });

    it("calculates months within same year", () => {
      expect(monthsBetween({ year: 2020, month: 1 }, { year: 2020, month: 12 })).toBe(12);
    });

    it("calculates months across years", () => {
      expect(monthsBetween({ year: 2020, month: 1 }, { year: 2021, month: 1 })).toBe(13);
      expect(monthsBetween({ year: 2020, month: 6 }, { year: 2022, month: 6 })).toBe(25);
    });

    it("returns 0 if end is before start", () => {
      expect(monthsBetween({ year: 2022, month: 1 }, { year: 2020, month: 1 })).toBe(0);
    });
  });

  describe("toMonthNumber", () => {
    it("converts YearMonth to comparable number", () => {
      const jan2020 = toMonthNumber({ year: 2020, month: 1 });
      const dec2020 = toMonthNumber({ year: 2020, month: 12 });
      const jan2021 = toMonthNumber({ year: 2021, month: 1 });

      expect(jan2020).toBeLessThan(dec2020);
      expect(dec2020).toBeLessThan(jan2021);
    });
  });

  describe("monthsToYears", () => {
    it("converts months to years with 1 decimal", () => {
      expect(monthsToYears(12)).toBe(1);
      expect(monthsToYears(24)).toBe(2);
      expect(monthsToYears(18)).toBe(1.5);
      expect(monthsToYears(6)).toBe(0.5);
      expect(monthsToYears(0)).toBe(0);
    });
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test -- date-utils`
- [x] Linting passes: `npm run lint` (no lint script configured)

---

## Phase 2: Interval Merging

### Overview

Create a function to merge overlapping date intervals and calculate total duration. This ensures concurrent jobs don't double-count experience.

### Changes Required

#### 2.1 Interval Merging Module

**File**: `recommender_api/src/services/resume-processor/date-date-interval-merger.ts` (new)

```typescript
import {
  parseDateString,
  monthsBetween,
  toMonthNumber,
  monthsToYears,
  type YearMonth,
} from "./date-utils.js";

/*
 * A date interval with start and end.
 */
export interface DateInterval {
  start: YearMonth;
  end: YearMonth;
}

/*
 * Merge overlapping intervals into non-overlapping spans.
 *
 * Algorithm:
 * 1. Sort intervals by start date
 * 2. Iterate through, merging overlapping intervals
 * 3. Return merged list
 *
 * Example:
 * Input:  [(2018-01, 2022-01), (2020-01, 2024-01)]
 * Output: [(2018-01, 2024-01)]
 */
export function mergeIntervals(intervals: DateInterval[]): DateInterval[] {
  if (intervals.length === 0) {
    return [];
  }

  // Sort by start date
  const sorted = [...intervals].sort(
    (a, b) => toMonthNumber(a.start) - toMonthNumber(b.start)
  );

  const merged: DateInterval[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const lastMerged = merged[merged.length - 1];

    // Check if current overlaps with or is adjacent to lastMerged
    // Adjacent means current.start is at most 1 month after lastMerged.end
    if (toMonthNumber(current.start) <= toMonthNumber(lastMerged.end) + 1) {
      // Merge: extend lastMerged.end if current.end is later
      if (toMonthNumber(current.end) > toMonthNumber(lastMerged.end)) {
        lastMerged.end = current.end;
      }
    } else {
      // No overlap: add current as new interval
      merged.push(current);
    }
  }

  return merged;
}

/*
 * Calculate total months from a list of intervals after merging.
 */
export function calculateTotalMonths(intervals: DateInterval[]): number {
  const merged = mergeIntervals(intervals);

  let totalMonths = 0;
  for (const interval of merged) {
    totalMonths += monthsBetween(interval.start, interval.end);
  }

  return totalMonths;
}

/*
 * Parse WorkExperience date strings and calculate total years.
 *
 * This is the main entry point for skill years calculation.
 *
 * @param dateRanges - Array of [startDate, endDate] string pairs from WorkExperiences
 * @returns Total years (merged, not double-counted), rounded to 1 decimal
 */
export function calculateYearsFromDateRanges(
  dateRanges: Array<{ startDate: string; endDate: string }>
): number {
  if (dateRanges.length === 0) {
    return 0;
  }

  const intervals: DateInterval[] = dateRanges.map(({ startDate, endDate }) => ({
    start: parseDateString(startDate, false),
    end: parseDateString(endDate, true),
  }));

  const totalMonths = calculateTotalMonths(intervals);
  return monthsToYears(totalMonths);
}
```

#### 2.2 Unit Tests for Interval Merging

**File**: `recommender_api/src/services/resume-processor/date-interval-merger.test.ts` (new)

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  mergeIntervals,
  calculateTotalMonths,
  calculateYearsFromDateRanges,
  type DateInterval,
} from "./date-interval-merger.js";

describe("date-interval-merger", () => {
  describe("mergeIntervals", () => {
    it("returns empty array for empty input", () => {
      expect(mergeIntervals([])).toEqual([]);
    });

    it("returns single interval unchanged", () => {
      const intervals: DateInterval[] = [
        { start: { year: 2020, month: 1 }, end: { year: 2022, month: 12 } },
      ];
      expect(mergeIntervals(intervals)).toEqual(intervals);
    });

    it("merges overlapping intervals", () => {
      const intervals: DateInterval[] = [
        { start: { year: 2018, month: 1 }, end: { year: 2022, month: 1 } },
        { start: { year: 2020, month: 1 }, end: { year: 2024, month: 1 } },
      ];
      const merged = mergeIntervals(intervals);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual({
        start: { year: 2018, month: 1 },
        end: { year: 2024, month: 1 },
      });
    });

    it("merges adjacent intervals (1 month gap)", () => {
      const intervals: DateInterval[] = [
        { start: { year: 2020, month: 1 }, end: { year: 2020, month: 6 } },
        { start: { year: 2020, month: 7 }, end: { year: 2020, month: 12 } },
      ];
      const merged = mergeIntervals(intervals);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual({
        start: { year: 2020, month: 1 },
        end: { year: 2020, month: 12 },
      });
    });

    it("keeps non-overlapping intervals separate", () => {
      const intervals: DateInterval[] = [
        { start: { year: 2018, month: 1 }, end: { year: 2019, month: 12 } },
        { start: { year: 2022, month: 1 }, end: { year: 2024, month: 1 } },
      ];
      const merged = mergeIntervals(intervals);

      expect(merged).toHaveLength(2);
    });

    it("handles unsorted input", () => {
      const intervals: DateInterval[] = [
        { start: { year: 2022, month: 1 }, end: { year: 2024, month: 1 } },
        { start: { year: 2018, month: 1 }, end: { year: 2020, month: 1 } },
      ];
      const merged = mergeIntervals(intervals);

      // Should be sorted and kept separate (no overlap)
      expect(merged).toHaveLength(2);
      expect(merged[0].start.year).toBe(2018);
      expect(merged[1].start.year).toBe(2022);
    });

    it("merges multiple overlapping intervals into one", () => {
      const intervals: DateInterval[] = [
        { start: { year: 2018, month: 1 }, end: { year: 2020, month: 1 } },
        { start: { year: 2019, month: 6 }, end: { year: 2021, month: 1 } },
        { start: { year: 2020, month: 6 }, end: { year: 2023, month: 1 } },
      ];
      const merged = mergeIntervals(intervals);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual({
        start: { year: 2018, month: 1 },
        end: { year: 2023, month: 1 },
      });
    });
  });

  describe("calculateTotalMonths", () => {
    it("returns 0 for empty input", () => {
      expect(calculateTotalMonths([])).toBe(0);
    });

    it("calculates months for single interval", () => {
      const intervals: DateInterval[] = [
        { start: { year: 2020, month: 1 }, end: { year: 2020, month: 12 } },
      ];
      expect(calculateTotalMonths(intervals)).toBe(12);
    });

    it("sums non-overlapping intervals", () => {
      const intervals: DateInterval[] = [
        { start: { year: 2018, month: 1 }, end: { year: 2018, month: 12 } }, // 12 months
        { start: { year: 2022, month: 1 }, end: { year: 2022, month: 12 } }, // 12 months
      ];
      expect(calculateTotalMonths(intervals)).toBe(24);
    });

    it("does not double-count overlapping intervals", () => {
      const intervals: DateInterval[] = [
        { start: { year: 2018, month: 1 }, end: { year: 2022, month: 1 } }, // 49 months
        { start: { year: 2020, month: 1 }, end: { year: 2024, month: 1 } }, // 49 months if separate
      ];
      // Merged: 2018-01 to 2024-01 = 73 months
      expect(calculateTotalMonths(intervals)).toBe(73);
    });
  });

  describe("calculateYearsFromDateRanges", () => {
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 23));
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("returns 0 for empty input", () => {
      expect(calculateYearsFromDateRanges([])).toBe(0);
    });

    it("calculates years from date strings", () => {
      const dateRanges = [
        { startDate: "2020-01", endDate: "2021-12" }, // 24 months = 2 years
      ];
      expect(calculateYearsFromDateRanges(dateRanges)).toBe(2);
    });

    it("handles 'present' end date", () => {
      const dateRanges = [
        { startDate: "2025-02", endDate: "present" }, // Feb 2025 to Jan 2026 = 12 months = 1 year
      ];
      expect(calculateYearsFromDateRanges(dateRanges)).toBe(1);
    });

    it("handles year-only dates", () => {
      const dateRanges = [
        { startDate: "2020", endDate: "2021" }, // Jan 2020 to Dec 2021 = 24 months = 2 years
      ];
      expect(calculateYearsFromDateRanges(dateRanges)).toBe(2);
    });

    it("merges overlapping ranges from concurrent jobs", () => {
      const dateRanges = [
        { startDate: "2018-01", endDate: "2022-01" }, // Job A
        { startDate: "2020-01", endDate: "2024-01" }, // Job B (overlaps)
      ];
      // Merged: 2018-01 to 2024-01 = 73 months ≈ 6.1 years
      expect(calculateYearsFromDateRanges(dateRanges)).toBe(6.1);
    });
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test -- date-interval-merger`
- [x] Linting passes: `npm run lint` (no lint script configured)

---

## Phase 3: Pipeline Integration

### Overview

Integrate skill years calculation into the resume upload pipeline. After UserSkills and USED_AT relationships are created, calculate yearsUsed for each skill.

### Changes Required

#### 3.1 Skill Years Calculation Service

**File**: `recommender_api/src/services/resume-processor/skill-years.service.ts` (new)

```typescript
import { Session } from "neo4j-driver";
import { calculateYearsFromDateRanges } from "./date-interval-merger.js";

/*
 * WorkExperience date range for a skill.
 */
interface SkillWorkExperience {
  startDate: string;
  endDate: string;
}

/*
 * Calculate and update yearsUsed for all UserSkills of an engineer.
 *
 * For each UserSkill:
 * 1. Find all WorkExperiences linked via USED_AT
 * 2. Collect their date ranges
 * 3. Merge overlapping intervals
 * 4. Calculate total years
 * 5. Update the UserSkill node
 *
 * Skills with no USED_AT relationships (standalone skills from Skills section)
 * will have yearsUsed set to 0.
 */
export async function calculateAndStoreSkillYears(
  session: Session,
  engineerId: string
): Promise<void> {
  // Get all UserSkills for this engineer with their linked WorkExperience dates
  const result = await session.run(`
    MATCH (e:Engineer {id: $engineerId})-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    OPTIONAL MATCH (us)-[:USED_AT]->(w:WorkExperience)
    WITH us, s, collect({startDate: w.startDate, endDate: w.endDate}) AS workExperiences
    RETURN us.id AS userSkillId, s.name AS skillName, workExperiences
  `, { engineerId });

  for (const record of result.records) {
    const userSkillId = record.get("userSkillId") as string;
    const skillName = record.get("skillName") as string;
    const workExperiences = record.get("workExperiences") as SkillWorkExperience[];

    // Filter out null entries (from skills with no USED_AT relationships)
    const validWorkExperiences = workExperiences.filter(
      (we) => we.startDate !== null && we.endDate !== null
    );

    const yearsUsed = calculateYearsFromDateRanges(validWorkExperiences);

    // Update the UserSkill node
    await session.run(`
      MATCH (us:UserSkill {id: $userSkillId})
      SET us.yearsUsed = $yearsUsed
    `, { userSkillId, yearsUsed });
  }
}
```

#### 3.2 Update Resume Upload Service

**File**: `recommender_api/src/services/resume-processor/resume-upload.service.ts`

**Changes**: Add call to `calculateAndStoreSkillYears` after creating UserSkills.

```typescript
// Add import at top of file
import { calculateAndStoreSkillYears } from "./skill-years.service.js";

// In processResumeUpload function, after createUserSkills call (around line 127):

      /*
       * Create UserSkills with USED_AT links in a single pass.
       * ... existing comment ...
       */
      await createUserSkills(session, engineerId, resolvedSkills, skillNameToWorkExperienceIds);

      /*
       * Calculate yearsUsed for each UserSkill based on linked WorkExperience durations.
       * This must happen AFTER createUserSkills since it reads USED_AT relationships.
       * Overlapping job durations are merged to avoid double-counting.
       */
      await calculateAndStoreSkillYears(session, engineerId);

      validationResults = {
        // ... rest unchanged
```

#### 3.3 Integration Test

**File**: `recommender_api/src/services/__tests__/skill-years.integration.test.ts` (new)

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Session } from "neo4j-driver";
import { getSession } from "../../test/neo4j-test-utils.js";
import { calculateAndStoreSkillYears } from "../resume-processor/skill-years.service.js";

describe("skill-years.service integration", () => {
  let session: Session;

  beforeAll(async () => {
    session = await getSession();
  });

  afterAll(async () => {
    await session.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await session.run(`
      MATCH (e:Engineer {id: 'test_eng_skill_years'})
      DETACH DELETE e
    `);
    await session.run(`
      MATCH (us:UserSkill)
      WHERE us.id STARTS WITH 'test_us_'
      DETACH DELETE us
    `);
    await session.run(`
      MATCH (w:WorkExperience)
      WHERE w.id STARTS WITH 'test_we_'
      DETACH DELETE w
    `);
  });

  it("calculates yearsUsed from single work experience", async () => {
    // Setup: Create engineer, skill (using existing), UserSkill, WorkExperience, USED_AT
    await session.run(`
      CREATE (e:Engineer {id: 'test_eng_skill_years', name: 'Test Engineer'})
      WITH e
      MATCH (s:Skill {id: 'skill_react'})
      CREATE (e)-[:HAS]->(us:UserSkill {id: 'test_us_react', proficiencyLevel: 'proficient'})-[:FOR]->(s)
      CREATE (w:WorkExperience {id: 'test_we_1', startDate: '2020-01', endDate: '2022-12'})
      CREATE (e)-[:HAD_ROLE]->(w)
      CREATE (us)-[:USED_AT]->(w)
    `);

    await calculateAndStoreSkillYears(session, "test_eng_skill_years");

    const result = await session.run(`
      MATCH (us:UserSkill {id: 'test_us_react'})
      RETURN us.yearsUsed AS yearsUsed
    `);

    // 2020-01 to 2022-12 = 36 months = 3 years
    expect(result.records[0].get("yearsUsed")).toBe(3);
  });

  it("merges overlapping work experiences", async () => {
    await session.run(`
      CREATE (e:Engineer {id: 'test_eng_skill_years', name: 'Test Engineer'})
      WITH e
      MATCH (s:Skill {id: 'skill_react'})
      CREATE (e)-[:HAS]->(us:UserSkill {id: 'test_us_react', proficiencyLevel: 'proficient'})-[:FOR]->(s)
      CREATE (w1:WorkExperience {id: 'test_we_1', startDate: '2018-01', endDate: '2022-01'})
      CREATE (w2:WorkExperience {id: 'test_we_2', startDate: '2020-01', endDate: '2024-01'})
      CREATE (e)-[:HAD_ROLE]->(w1)
      CREATE (e)-[:HAD_ROLE]->(w2)
      CREATE (us)-[:USED_AT]->(w1)
      CREATE (us)-[:USED_AT]->(w2)
    `);

    await calculateAndStoreSkillYears(session, "test_eng_skill_years");

    const result = await session.run(`
      MATCH (us:UserSkill {id: 'test_us_react'})
      RETURN us.yearsUsed AS yearsUsed
    `);

    // Merged: 2018-01 to 2024-01 = 73 months ≈ 6.1 years (not 8 years)
    expect(result.records[0].get("yearsUsed")).toBe(6.1);
  });

  it("sets yearsUsed to 0 for standalone skills (no USED_AT)", async () => {
    await session.run(`
      CREATE (e:Engineer {id: 'test_eng_skill_years', name: 'Test Engineer'})
      WITH e
      MATCH (s:Skill {id: 'skill_react'})
      CREATE (e)-[:HAS]->(us:UserSkill {id: 'test_us_react', proficiencyLevel: 'proficient'})-[:FOR]->(s)
    `);

    await calculateAndStoreSkillYears(session, "test_eng_skill_years");

    const result = await session.run(`
      MATCH (us:UserSkill {id: 'test_us_react'})
      RETURN us.yearsUsed AS yearsUsed
    `);

    expect(result.records[0].get("yearsUsed")).toBe(0);
  });

  it("handles 'present' end dates", async () => {
    await session.run(`
      CREATE (e:Engineer {id: 'test_eng_skill_years', name: 'Test Engineer'})
      WITH e
      MATCH (s:Skill {id: 'skill_react'})
      CREATE (e)-[:HAS]->(us:UserSkill {id: 'test_us_react', proficiencyLevel: 'proficient'})-[:FOR]->(s)
      CREATE (w:WorkExperience {id: 'test_we_1', startDate: '2024-01', endDate: 'present'})
      CREATE (e)-[:HAD_ROLE]->(w)
      CREATE (us)-[:USED_AT]->(w)
    `);

    await calculateAndStoreSkillYears(session, "test_eng_skill_years");

    const result = await session.run(`
      MATCH (us:UserSkill {id: 'test_us_react'})
      RETURN us.yearsUsed AS yearsUsed
    `);

    // Should be > 0 (current date - Jan 2024)
    expect(result.records[0].get("yearsUsed")).toBeGreaterThan(0);
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All unit tests pass: `npm test`
- [x] Integration tests pass: `npm test -- skill-years.integration`
- [x] Linting passes: `npm run lint` (no lint script configured)

#### Manual Verification:
- [ ] Upload a resume via POST /api/resume/upload
- [ ] Query Neo4j to verify UserSkill nodes have yearsUsed populated
- [ ] Verify search results show correct yearsUsed in matchedSkills

---

## Testing Strategy

### Unit Tests
- `date-utils.test.ts`: Date parsing for all 3 formats, edge cases
- `date-interval-merger.test.ts`: Interval merging, overlap detection, year calculation

### Integration Tests
- `skill-years.integration.test.ts`: Full pipeline with Neo4j
- Existing `resume-upload.integration.test.ts`: Should continue to pass

### Manual Testing Steps
1. Upload a resume with multiple jobs using the same skill
2. Verify yearsUsed is the merged total (not sum of individual durations)
3. Upload a resume with concurrent jobs - verify no double-counting
4. Search for engineers - verify yearsUsed appears in matchedSkills response

## Files Changed Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `recommender_api/src/services/resume-processor/date-utils.ts` | New | Date parsing utilities |
| `recommender_api/src/services/resume-processor/date-utils.test.ts` | New | Unit tests for date utils |
| `recommender_api/src/services/resume-processor/date-date-interval-merger.ts` | New | Interval merging logic |
| `recommender_api/src/services/resume-processor/date-interval-merger.test.ts` | New | Unit tests for interval merging |
| `recommender_api/src/services/resume-processor/skill-years.service.ts` | New | Calculate and store skill years |
| `recommender_api/src/services/__tests__/skill-years.integration.test.ts` | New | Integration tests |
| `recommender_api/src/services/resume-processor/resume-upload.service.ts` | Modified | Add skill years calculation call |

## References

- Discussion context: Deterministic calculation vs LLM estimation
- Related file: `recommender_api/src/services/resume-processor/feature-extractor.service.ts` (date format contract)
- Related file: `recommender_api/src/services/user-skill.service.ts` (UserSkill creation)
- Related file: `seeds/types.ts:58` (UserSkill.yearsUsed type definition)
