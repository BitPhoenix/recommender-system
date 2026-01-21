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

  const filters = [
    buildTimelineFilter(params.startTimeline),
    buildExperienceFilter(params.minYearsExperience, params.maxYearsExperience),
    buildTimezoneFilter(params.timezoneZones),
    buildBudgetFilter(budgetCeiling),
  ];

  // Add exclusion filter if specified (e.g., for filter-similarity endpoint)
  if (params.excludeEngineerId) {
    filters.push(buildExcludeEngineerFilter(params.excludeEngineerId));
  }

  // Add inclusion filter if specified (e.g., for explain endpoint)
  if (params.engineerId) {
    filters.push(buildIncludeEngineerFilter(params.engineerId));
  }

  return combineFilters(filters);
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

function buildTimezoneFilter(timezoneZones: string[]): FilterParts {
  if (timezoneZones.length === 0) {
    return { conditions: [], queryParams: {} };
  }

  // Timezone zones are stored directly (Eastern, Central, Mountain, Pacific)
  // Use IN for exact matching
  const fragment = buildCypherFragment("timezone", "IN", timezoneZones, "timezoneZones");
  return {
    conditions: [fragment.clause],
    queryParams: { [fragment.paramName]: fragment.paramValue },
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

/**
 * Builds exclusion filter for a specific engineer.
 * Used by filter-similarity to exclude the reference engineer from results.
 */
function buildExcludeEngineerFilter(engineerId: string): FilterParts {
  return {
    conditions: ['e.id <> $excludeEngineerId'],
    queryParams: { excludeEngineerId: engineerId },
  };
}

/**
 * Builds inclusion filter for a specific engineer.
 * Used by explain endpoint to run search pipeline for a single engineer.
 */
function buildIncludeEngineerFilter(engineerId: string): FilterParts {
  return {
    conditions: ['e.id = $engineerId'],
    queryParams: { engineerId },
  };
}
