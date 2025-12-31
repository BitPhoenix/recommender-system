/**
 * Builds basic engineer filters (property-level WHERE conditions).
 * These are direct property comparisons on the Engineer node (availability,
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
    availability: params.availability,
    minYearsExperience: params.minYearsExperience,
  };

  const conditions: string[] = [
    "e.availability IN $availability",
    "e.yearsExperience >= $minYearsExperience",
  ];

  if (params.maxYearsExperience !== null) {
    conditions.push("e.yearsExperience < $maxYearsExperience");
    queryParams.maxYearsExperience = params.maxYearsExperience;
  }

  if (params.timezonePrefix !== null) {
    conditions.push("e.timezone STARTS WITH $timezonePrefix");
    queryParams.timezonePrefix = params.timezonePrefix;
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
