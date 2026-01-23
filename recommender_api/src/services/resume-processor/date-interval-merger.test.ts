import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
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
