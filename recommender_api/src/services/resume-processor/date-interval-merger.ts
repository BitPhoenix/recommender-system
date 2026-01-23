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
