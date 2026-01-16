/*
 * Types for database statistics used in conflict explanations.
 * These stats provide the factual grounding for both templates and RAG context.
 *
 * Design: Unified per-constraint stats for ALL conflict types using discriminated unions.
 * Every constraint gets its individual count, with type-specific enrichment fields.
 * Base interface eliminates duplication; specific types add only unique fields.
 */

/*
 * Enum for constraint stats discriminant.
 * Maps to actual fields on Engineer nodes in Neo4j.
 */
export enum ConstraintStatsType {
  Skill = "skill",
  Salary = "salary",
  YearsExperience = "yearsExperience",
  Timezone = "timezone",
  StartTimeline = "startTimeline",
  Fallback = "fallback",
}

/*
 * Common fields for all constraint statistics.
 */
interface BaseConstraintStats {
  /* Human-readable description of the constraint */
  displayValue: string;
  /* Number of engineers matching this constraint alone */
  countMatching: number;
}

/*
 * Skill constraint stats - includes lower proficiency alternatives
 */
export interface SkillConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.Skill;
  skillId: string;
  proficiency: string;
  /* How many engineers have this skill at ANY lower proficiency level */
  countAtLowerProficiency: number;
}

/*
 * Salary/budget constraint stats - includes actual salary range in DB
 */
export interface SalaryConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.Salary;
  requestedMax: number;
  /* Actual min/max salaries in the database */
  minSalaryInDb: number;
  maxSalaryInDb: number;
}

/*
 * Years of experience constraint stats.
 * Note: User requests "seniority" but it's converted to yearsExperience range.
 * E.g., "staff" → yearsExperience >= 10
 */
export interface YearsExperienceConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.YearsExperience;
  /* The constraint bounds (from seniority mapping) */
  requestedMinYears: number;
  requestedMaxYears: number | null;
  /* Actual range in the database for context */
  minYearsInDb: number;
  maxYearsInDb: number;
  /*
   * Distribution by seniority bucket for richer context.
   * Bucket boundaries are defined in seniorityMapping (compatibility-constraints.config.ts).
   */
  countByRange: {
    junior: number;
    mid: number;
    senior: number;
    staffPlus: number;
  };
}

/*
 * Timezone constraint stats - shows matches per zone.
 * Note: Timezones are stored as US zones directly (Eastern, Central, Mountain, Pacific),
 * not IANA identifiers. The canonical list is in usTimezoneZones config.
 */
export interface TimezoneConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.Timezone;
  /* The requested timezone zones (e.g., ["Eastern", "Central"]) */
  requestedZones: string[];
  /* Count of engineers per timezone zone */
  countByZone: Record<string, number>;
}

/*
 * Start timeline constraint stats - shows availability distribution.
 * E.g., requiredMaxStartTime: "one_month" shows counts at each timeline.
 */
export interface StartTimelineConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.StartTimeline;
  /* The requested max start time threshold */
  requestedMaxTimeline: string;
  /* Count of engineers at each timeline value */
  countByTimeline: Record<string, number>;
}

/*
 * Fallback constraint stats - used for constraint types that don't have
 * specialized statistics queries. Returns only the base count without
 * type-specific enrichment (no distributions, ranges, or alternatives).
 */
export interface FallbackConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.Fallback;
}

/*
 * Discriminated union of all constraint stat types
 */
export type ConstraintStats =
  | SkillConstraintStats
  | SalaryConstraintStats
  | YearsExperienceConstraintStats
  | TimezoneConstraintStats
  | StartTimelineConstraintStats
  | FallbackConstraintStats;

export interface ConflictStats {
  /*
   * Total engineers matching ALL constraints from the full user query
   * (including derived constraints from inference engine).
   * This is what the user's actual search would return.
   */
  countMatchingAll: number;

  /*
   * Stats for ALL constraints in the user's request (full visibility).
   * Includes both user-specified and derived constraints.
   * Shows how each constraint individually narrows the candidate pool.
   */
  allConstraintStats: ConstraintStats[];

  /*
   * Stats for just the constraints in this specific conflict set.
   * This is the subset we're explaining - the minimal set causing the conflict.
   * Used by templates and LLM to focus the explanation on the actual problem.
   */
  conflictingConstraintStats: ConstraintStats[];
}
