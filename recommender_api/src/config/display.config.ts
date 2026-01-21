/**
 * Display Configuration
 *
 * Contains canonical mappings for displaying domain values in human-readable format.
 * Import from here rather than redefining these mappings in individual services.
 */

/**
 * Human-readable labels for start timeline values.
 * Keys are the enum values stored in the database, values are display labels.
 */
export const startTimelineLabels = {
  immediate: 'immediately',
  two_weeks: '2 weeks',
  one_month: '1 month',
  three_months: '3 months',
  six_months: '6 months',
  one_year: '1 year',
} as const;

export type StartTimelineKey = keyof typeof startTimelineLabels;

/**
 * Format a start timeline value for display.
 *
 * @param timeline - The timeline value (e.g., 'two_weeks')
 * @param withPrefix - Whether to include "in" prefix (e.g., "in 2 weeks" vs "2 weeks").
 *                     Note: 'immediately' never gets a prefix regardless of this setting.
 * @returns Human-readable string (e.g., "in 2 weeks" or "2 weeks")
 */
export function formatStartTimeline(timeline: string, withPrefix: boolean = true): string {
  const label = startTimelineLabels[timeline as StartTimelineKey];
  if (!label) return timeline;
  if (!withPrefix || label === 'immediately') return label;
  return `in ${label}`;
}
