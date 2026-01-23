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
