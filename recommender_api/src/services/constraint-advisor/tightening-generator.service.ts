import type { Session } from "neo4j-driver";
import type {
  TighteningSuggestion,
  TimezoneTightening,
  SeniorityTightening,
  BudgetTightening,
  StartTimeTightening,
  SkillTightening,
  AppliedSkillFilter,
  AppliedFilter,
} from "../../types/search.types.js";
import {
  AppliedFilterType,
  START_TIMELINE_ORDER,
  SENIORITY_LEVEL_ORDER,
} from "../../types/search.types.js";
import { seniorityMinYears } from "../../config/knowledge-base/utility.config.js";
import type { ExpandedSearchCriteria } from "../constraint-expander.service.js";
import {
  decomposeConstraints,
  buildPropertyConditions,
} from "./constraint-decomposer.service.js";
import {
  testTightenedPropertyValue,
  testAddedPropertyConstraint,
  testAddedSkillConstraint,
  getBaselineCount,
  type PropertyConditionSpec,
} from "./tightening-tester.service.js";
import {
  ConstraintType,
  type DecomposedConstraints,
  type PropertyConstraint,
} from "./constraint.types.js";
import { buildSkillDistributionQuery } from "../cypher-query-builder/index.js";
import { extractSkillConstraints } from "./skill-extraction.utils.js";

/*
 * US timezone zones for tightening suggestions.
 * These are the valid timezone values stored on Engineer nodes.
 *
 * Order: East to West (matches usTimezoneZones in compatibility-constraints.config.ts)
 */
const US_TIMEZONE_ZONES = ['Eastern', 'Central', 'Mountain', 'Pacific'] as const;

/**
 * All fields that can have tightening suggestions.
 * Derived from the TighteningSuggestion discriminated union.
 */
type TightenableField = TighteningSuggestion["field"];

/**
 * Function that analyzes result set distribution for a field and generates
 * tightening suggestions (ways to narrow down results).
 *
 * Generators now receive decomposed constraints and baseline count to enable
 * proper multi-constraint filtering.
 */
type TighteningSuggestionGenerator = (
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
) => Promise<TighteningSuggestion[]>;

/**
 * Registry mapping each tightenable field to its suggestion generator.
 *
 * Using Record<TightenableField, ...> ensures we have a generator for every
 * field defined in TighteningSuggestion. Adding a new TighteningSuggestion
 * variant (e.g., DomainTightening with field: 'requiredBusinessDomains') will
 * cause a compile error here until a generator is added.
 */
const fieldToTighteningSuggestionGenerator: Record<
  TightenableField,
  TighteningSuggestionGenerator
> = {
  requiredTimezone: generateTimezoneTighteningSuggestions,
  requiredSeniorityLevel: generateSeniorityTighteningSuggestions,
  maxBudget: generateBudgetTighteningSuggestions,
  requiredMaxStartTime: generateTimelineTighteningSuggestions,
  requiredSkills: generateSkillTighteningSuggestions,
};

/**
 * Generate tightening suggestions when results exceed threshold.
 * Each generator filters suggestions to only include values stricter than current constraints.
 *
 * IMPORTANT: All suggestions now apply ALL user constraints when calculating resultingMatches,
 * ensuring accurate counts that reflect the combined effect of existing filters.
 */
export async function generateTighteningSuggestions(
  session: Session,
  expandedSearchCriteria: ExpandedSearchCriteria,
  appliedFilters: AppliedFilter[],
  maxSuggestions: number = 5
): Promise<TighteningSuggestion[]> {
  // Decompose filters for query building
  const decomposed = decomposeConstraints(appliedFilters);

  // Get baseline count (with all current filters)
  let baselineCount: number;
  try {
    baselineCount = await getBaselineCount(session, decomposed);
    if (baselineCount === 0) {
      return []; // No results to tighten
    }
  } catch (error) {
    console.warn(
      "Failed to get baseline count for tightening suggestions:",
      error
    );
    return [];
  }

  /*
   * Run suggestion generators sequentially. Neo4j sessions serialize queries
   * internally anyway (parallel queries require multiple sessions), so sequential
   * execution is both clearer and matches actual behavior.
   *
   * Each generator analyzes the result set distribution for its field and returns
   * suggestions that are stricter than the user's current constraint.
   */
  const allSuggestions: TighteningSuggestion[] = [];

  for (const [field, generateForField] of Object.entries(
    fieldToTighteningSuggestionGenerator
  )) {
    try {
      const suggestions = await generateForField(
        session,
        expandedSearchCriteria,
        decomposed,
        baselineCount
      );
      allSuggestions.push(...suggestions);
    } catch (error) {
      console.warn(
        `Tightening suggestion generation failed for field "${field}":`,
        error
      );
    }
  }

  // Sort by effectiveness (biggest reduction in results)
  allSuggestions.sort((a, b) => a.resultingMatches - b.resultingMatches);

  return allSuggestions.slice(0, maxSuggestions);
}

/**
 * Analyze timezone distribution to suggest US timezone zone filters.
 * Groups engineers into Eastern, Central, Mountain, and Pacific zones.
 *
 * Uses testAddedPropertyConstraint to ensure counts reflect ALL user constraints.
 */
async function generateTimezoneTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
): Promise<TimezoneTightening[]> {
  const suggestions: TimezoneTightening[] = [];

  for (const zone of US_TIMEZONE_ZONES) {
    // Skip if user already has this timezone filter
    const alreadyFiltered = expanded.timezoneZones.includes(zone);
    if (alreadyFiltered) continue;

    const count = await testAddedPropertyConstraint(session, decomposed, {
      field: "timezone",
      operator: "=",
      value: zone,
      paramKey: `tz_${zone.toLowerCase()}`,
    });

    if (count > 0 && count < baselineCount) {
      const percentage = Math.round((count / baselineCount) * 100);
      suggestions.push({
        field: "requiredTimezone",
        suggestedValue: [zone],
        rationale: `Filter to ${zone} timezone engineers`,
        resultingMatches: count,
        distributionInfo: `${count} of ${baselineCount} matching engineers (${percentage}%) are in ${zone}`,
      });
    }
  }

  return suggestions;
}

/**
 * Analyze experience distribution to suggest seniority filters.
 * Buckets engineers by seniority level using thresholds from seniorityMinYears.
 *
 * Uses testTightenedPropertyValue or testAddedPropertyConstraint depending on
 * whether the user already has a seniority constraint.
 *
 * IMPORTANT: Keep Cypher CASE thresholds in sync with seniorityMinYears config.
 */
async function generateSeniorityTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
): Promise<SeniorityTightening[]> {
  /*
   * Determine minimum seniority index to suggest.
   * If user already has a seniority constraint, only suggest stricter (higher index).
   */
  const currentSeniority = expanded.requiredSeniorityLevel;
  const currentIndex = currentSeniority
    ? SENIORITY_LEVEL_ORDER.indexOf(currentSeniority)
    : -1;

  // Find existing experience constraint if any
  const experienceConstraint = decomposed.constraints.find(
    (c) =>
      c.constraintType === ConstraintType.Property &&
      c.field === "yearsExperience" &&
      c.operator === ">="
  ) as PropertyConstraint | undefined;

  const suggestions: SeniorityTightening[] = [];

  // Test each seniority level stricter than current
  for (let i = currentIndex + 1; i < SENIORITY_LEVEL_ORDER.length; i++) {
    const level = SENIORITY_LEVEL_ORDER[i];
    if (level === "junior") continue; // Never suggest downgrading

    const minYears = seniorityMinYears[level as keyof typeof seniorityMinYears];

    let count: number;
    if (experienceConstraint) {
      // Modify existing constraint
      count = await testTightenedPropertyValue(
        session,
        decomposed,
        experienceConstraint,
        minYears
      );
    } else {
      // Add new constraint
      count = await testAddedPropertyConstraint(session, decomposed, {
        field: "yearsExperience",
        operator: ">=",
        value: minYears,
        paramKey: "seniority",
      });
    }

    if (count > 0 && count < baselineCount) {
      const percentage = Math.round((count / baselineCount) * 100);
      suggestions.push({
        field: "requiredSeniorityLevel",
        suggestedValue: level,
        rationale: `Filter to ${level} level engineers (${minYears}+ years)`,
        resultingMatches: count,
        distributionInfo: `${count} of ${baselineCount} matching engineers (${percentage}%) are ${level} level`,
      });
    }
  }

  return suggestions;
}

/**
 * Suggest budget caps as step-downs from the user's current budget.
 * Uses relative multipliers (0.8, 0.7, 0.6) for contextual suggestions.
 *
 * Uses testTightenedPropertyValue to ensure counts reflect ALL user constraints.
 *
 * If no budget is set, returns empty (can't tighten what doesn't exist).
 */
async function generateBudgetTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
): Promise<BudgetTightening[]> {
  const currentBudget = expanded.maxBudget;

  // Can't tighten if no budget constraint exists
  if (currentBudget === null) {
    return [];
  }

  // Find the budget constraint in decomposed
  const budgetConstraint = decomposed.constraints.find(
    (c) => c.constraintType === ConstraintType.Property && c.field === "salary"
  ) as PropertyConstraint | undefined;

  if (!budgetConstraint) {
    return [];
  }

  // Step-down multipliers - suggest tighter budgets as fractions of current
  const stepDownMultipliers = [0.8, 0.7, 0.6];
  const thresholds = stepDownMultipliers
    .map((m) => Math.floor(currentBudget * m))
    .filter((t) => t > 0);

  const suggestions: BudgetTightening[] = [];

  for (const threshold of thresholds) {
    const count = await testTightenedPropertyValue(
      session,
      decomposed,
      budgetConstraint,
      threshold
    );

    // Only suggest if it would reduce results
    if (count > 0 && count < baselineCount) {
      const percentage = Math.round((count / baselineCount) * 100);
      suggestions.push({
        field: "maxBudget",
        suggestedValue: threshold,
        rationale: `Lower budget cap to $${threshold.toLocaleString()}`,
        resultingMatches: count,
        distributionInfo: `${count} of ${baselineCount} matching engineers (${percentage}%) earn ≤$${threshold.toLocaleString()}`,
      });
    }
  }

  return suggestions;
}

/**
 * Analyze start timeline distribution to suggest availability filters.
 * Suggests filtering to "immediate" availability when applicable.
 *
 * Uses testTightenedPropertyValue or testAddedPropertyConstraint depending on
 * whether the user already has a timeline constraint.
 */
async function generateTimelineTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
): Promise<StartTimeTightening[]> {
  /*
   * Determine maximum timeline index to suggest.
   * If user has a timeline constraint, only suggest stricter (lower index = faster).
   */
  const currentTimeline = expanded.requiredMaxStartTime;
  const currentIndex = currentTimeline
    ? START_TIMELINE_ORDER.indexOf(currentTimeline)
    : START_TIMELINE_ORDER.length; // No constraint = all timelines valid

  // Find existing startTimeline constraint
  const timelineConstraint = decomposed.constraints.find(
    (c) =>
      c.constraintType === ConstraintType.Property &&
      c.field === "startTimeline"
  ) as PropertyConstraint | undefined;

  const suggestions: StartTimeTightening[] = [];

  // Test each timeline stricter than current (lower index = faster)
  for (let i = 0; i < currentIndex; i++) {
    const timeline = START_TIMELINE_ORDER[i];

    // Build array of all timelines up to and including this one
    const allowedTimelines = START_TIMELINE_ORDER.slice(0, i + 1);

    let count: number;
    if (timelineConstraint) {
      count = await testTightenedPropertyValue(
        session,
        decomposed,
        timelineConstraint,
        allowedTimelines
      );
    } else {
      count = await testAddedPropertyConstraint(session, decomposed, {
        field: "startTimeline",
        operator: "IN",
        value: allowedTimelines,
        paramKey: "timeline",
      });
    }

    if (count > 0 && count < baselineCount) {
      const percentage = Math.round((count / baselineCount) * 100);
      suggestions.push({
        field: "requiredMaxStartTime",
        suggestedValue: timeline,
        rationale: `Filter to engineers available within ${timeline.replace(
          "_",
          " "
        )}`,
        resultingMatches: count,
        distributionInfo: `${count} of ${baselineCount} matching engineers (${percentage}%) are available within ${timeline.replace(
          "_",
          " "
        )}`,
      });
    }
  }

  return suggestions;
}

/**
 * Analyze skill distribution to suggest skill requirements.
 * Finds skills that are common in the result set but not required.
 *
 * Uses testAddedSkillConstraint to ensure counts reflect ALL user constraints.
 */
async function generateSkillTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
): Promise<SkillTightening[]> {
  /*
   * Get currently required skill IDs from appliedFilters.
   * We need to check appliedFilters because requiredSkills are stored there
   * as AppliedSkillFilter with the resolved skill IDs.
   */
  const requiredSkillFilter = expanded.appliedFilters.find(
    (f): f is AppliedSkillFilter =>
      f.type === AppliedFilterType.Skill && f.field === "requiredSkills"
  );
  const currentSkillIds =
    requiredSkillFilter?.skills.map((s) => s.skillId) ?? [];

  // Extract unified skill filter requirements
  const { skillFilterRequirements } = extractSkillConstraints(decomposed);

  // Build property conditions for the distribution query
  const propertyConstraintIds = new Set(
    decomposed.constraints
      .filter((c) => c.constraintType === ConstraintType.Property)
      .map((c) => c.id)
  );
  const propertyConditions = buildPropertyConditions(
    decomposed,
    propertyConstraintIds
  );

  // Build and run distribution query using unified requirements
  const { query: distributionQuery, params: distributionParams } =
    buildSkillDistributionQuery(
      skillFilterRequirements,
      propertyConditions
    );

  const result = await session.run(distributionQuery, distributionParams);
  const suggestions: SkillTightening[] = [];

  for (const record of result.records) {
    const skillName = record.get("skillName") as string;
    const skillId = record.get("skillId") as string;
    const frequencyCount = record.get("engineerCount")?.toNumber?.() ?? 0;
    const percentage = Math.round((frequencyCount / baselineCount) * 100);

    // Skip if already required or too rare
    if (currentSkillIds.includes(skillId) || percentage < 20) continue;

    /*
     * Test what we'd get if we added this skill as a requirement.
     * We use 'learning' (the lowest proficiency) for testing since that's the actual
     * ProficiencyLevel enum value. The suggestion displays "familiar" to match UI conventions.
     */
    const count = await testAddedSkillConstraint(
      session,
      decomposed,
      skillId,
      "learning"
    );

    if (count > 0 && count < baselineCount) {
      suggestions.push({
        field: "requiredSkills",
        suggestedValue: { skill: skillId, minProficiency: "familiar" },
        rationale: `Add ${skillName} as a required skill`,
        resultingMatches: count,
        distributionInfo: `${count} of ${baselineCount} matching engineers (${Math.round(
          (count / baselineCount) * 100
        )}%) have ${skillName}`,
      });
    }
  }

  return suggestions;
}
