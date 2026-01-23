import { describe, it, expect, vi } from "vitest";
import {
  parseDateString,
  monthsBetween,
  toMonthNumber,
  monthsToYears,
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
