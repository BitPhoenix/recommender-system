/**
 * Builds shared engineer-level WHERE conditions and query params.
 */

import type {
  CypherQueryParams,
  EngineerConditionsResult,
} from "./query-types.js";

export function buildEngineerQueryConditions(
  params: CypherQueryParams
): EngineerConditionsResult {
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
