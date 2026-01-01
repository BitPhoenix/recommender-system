/**
 * Builds basic engineer filters (property-level WHERE conditions).
 * These are direct property comparisons on the Engineer node (startTimeline,
 * experience, timezone, salary) - separate from skill-matching filters.
 */

import type {
  CypherQueryParams,
  BasicEngineerFilters,
} from "./query-types.js";

export function buildBasicEngineerFilters(
  params: CypherQueryParams
): BasicEngineerFilters {
  const queryParams: Record<string, unknown> = {
    startTimeline: params.startTimeline,
    minYearsExperience: params.minYearsExperience,
  };

  const conditions: string[] = [
    "e.startTimeline IN $startTimeline",
    "e.yearsExperience >= $minYearsExperience",
  ];

  if (params.maxYearsExperience !== null) {
    conditions.push("e.yearsExperience < $maxYearsExperience");
    queryParams.maxYearsExperience = params.maxYearsExperience;
  }

  if (params.timezonePrefixes.length > 0) {
    const tzConditions = params.timezonePrefixes.map((_, i) => `e.timezone STARTS WITH $tz${i}`);
    conditions.push(`(${tzConditions.join(' OR ')})`);
    params.timezonePrefixes.forEach((tz, i) => {
      queryParams[`tz${i}`] = tz;
    });
  }

  if (params.maxSalary !== null) {
    conditions.push("e.salary <= $maxSalary");
    queryParams.maxSalary = params.maxSalary;
  }

  if (params.minSalary !== null) {
    conditions.push("e.salary >= $minSalary");
    queryParams.minSalary = params.minSalary;
  }

  return { conditions, queryParams };
}
