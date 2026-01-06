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
  // The ceiling is stretchBudget if set, otherwise maxBudget
  const budgetCeiling = params.stretchBudget ?? params.maxBudget;

  return combineFilters([
    buildTimelineFilter(params.startTimeline),
    buildExperienceFilter(params.minYearsExperience, params.maxYearsExperience),
    buildTimezoneFilter(params.timezonePrefixes),
    buildBudgetFilter(budgetCeiling),
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
  min: number | null,
  max: number | null
): FilterParts {
  const conditions: string[] = [];
  const queryParams: Record<string, unknown> = {};

  if (min !== null) {
    conditions.push("e.yearsExperience >= $minYearsExperience");
    queryParams.minYearsExperience = min;
  }

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

/**
 * Builds salary filter for budget constraint.
 * The ceiling is the hard filter - no engineers above this are returned.
 */
function buildBudgetFilter(
  filterCeiling: number | null
): FilterParts {
  const conditions: string[] = [];
  const queryParams: Record<string, unknown> = {};

  if (filterCeiling !== null) {
    conditions.push("e.salary <= $budgetCeiling");
    queryParams.budgetCeiling = filterCeiling;
  }

  return { conditions, queryParams };
}
