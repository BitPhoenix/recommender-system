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
import { buildCypherFragment } from "../../utils/cypher-fragment.builder.js";

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
  const fragment = buildCypherFragment("startTimeline", "IN", startTimeline, "startTimeline");
  return {
    conditions: [fragment.clause],
    queryParams: { [fragment.paramName]: fragment.paramValue },
  };
}

function buildExperienceFilter(
  min: number | null,
  max: number | null
): FilterParts {
  const conditions: string[] = [];
  const queryParams: Record<string, unknown> = {};

  if (min !== null) {
    const fragment = buildCypherFragment("yearsExperience", ">=", min, "minYearsExperience");
    conditions.push(fragment.clause);
    queryParams[fragment.paramName] = fragment.paramValue;
  }

  if (max !== null) {
    const fragment = buildCypherFragment("yearsExperience", "<", max, "maxYearsExperience");
    conditions.push(fragment.clause);
    queryParams[fragment.paramName] = fragment.paramValue;
  }

  return { conditions, queryParams };
}

function buildTimezoneFilter(timezonePrefixes: string[]): FilterParts {
  if (timezonePrefixes.length === 0) {
    return { conditions: [], queryParams: {} };
  }

  const fragments = timezonePrefixes.map((prefix, i) =>
    buildCypherFragment("timezone", "STARTS WITH", prefix, `tz${i}`)
  );

  const queryParams: Record<string, unknown> = {};
  fragments.forEach((fragment) => {
    queryParams[fragment.paramName] = fragment.paramValue;
  });

  return {
    conditions: [`(${fragments.map((f) => f.clause).join(" OR ")})`],
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
  if (filterCeiling === null) {
    return { conditions: [], queryParams: {} };
  }

  const fragment = buildCypherFragment("salary", "<=", filterCeiling, "budgetCeiling");
  return {
    conditions: [fragment.clause],
    queryParams: { [fragment.paramName]: fragment.paramValue },
  };
}
