/**
 * Builds basic engineer filters (property-level WHERE conditions).
 * These are direct property comparisons on the Engineer node (startTimeline,
 * experience, timezone, salary) - separate from skill-matching filters.
 */

import type { StartTimeline } from "../../types/search.types.js";
import type {
  CypherQueryParams,
  BasicEngineerFilters,
} from "./query-types.js";

type FilterParts = { conditions: string[]; queryParams: Record<string, unknown> };

export function buildBasicEngineerFilters(
  params: CypherQueryParams
): BasicEngineerFilters {
  return combineFilters([
    buildTimelineFilter(params.startTimeline),
    buildExperienceFilter(params.minYearsExperience, params.maxYearsExperience),
    buildTimezoneFilter(params.timezonePrefixes),
    buildSalaryFilter(params.minSalary, params.maxSalary),
  ]);
}

function combineFilters(filters: FilterParts[]): BasicEngineerFilters {
  const conditions: string[] = [];
  const queryParams: Record<string, unknown> = {};

  for (const filter of filters) {
    conditions.push(...filter.conditions);
    Object.assign(queryParams, filter.queryParams);
  }

  return { conditions, queryParams };
}

function buildTimelineFilter(startTimeline: StartTimeline[]): FilterParts {
  return {
    conditions: ["e.startTimeline IN $startTimeline"],
    queryParams: { startTimeline },
  };
}

function buildExperienceFilter(
  min: number,
  max: number | null
): FilterParts {
  const conditions = ["e.yearsExperience >= $minYearsExperience"];
  const queryParams: Record<string, unknown> = { minYearsExperience: min };

  if (max !== null) {
    conditions.push("e.yearsExperience < $maxYearsExperience");
    queryParams.maxYearsExperience = max;
  }

  return { conditions, queryParams };
}

function buildTimezoneFilter(timezonePrefixes: string[]): FilterParts {
  if (timezonePrefixes.length === 0) {
    return { conditions: [], queryParams: {} };
  }

  const tzConditions = timezonePrefixes.map((_, i) => `e.timezone STARTS WITH $tz${i}`);
  const queryParams: Record<string, unknown> = {};
  timezonePrefixes.forEach((tz, i) => {
    queryParams[`tz${i}`] = tz;
  });

  return {
    conditions: [`(${tzConditions.join(" OR ")})`],
    queryParams,
  };
}

function buildSalaryFilter(
  min: number | null,
  max: number | null
): FilterParts {
  const conditions: string[] = [];
  const queryParams: Record<string, unknown> = {};

  if (max !== null) {
    conditions.push("e.salary <= $maxSalary");
    queryParams.maxSalary = max;
  }

  if (min !== null) {
    conditions.push("e.salary >= $minSalary");
    queryParams.minSalary = min;
  }

  return { conditions, queryParams };
}
