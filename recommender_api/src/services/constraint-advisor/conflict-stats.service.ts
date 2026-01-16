import type { Session } from "neo4j-driver";
import {
  type TestableConstraint,
  ConstraintType,
  PropertyFieldType,
  SkillConstraintOrigin,
  isPropertyConstraint,
  isSkillTraversalConstraint,
  isUserSkillConstraint,
} from "./constraint.types.js";
import {
  type ConstraintStats,
  ConstraintStatsType,
  type SkillConstraintStats,
  type SalaryConstraintStats,
  type YearsExperienceConstraintStats,
  type TimezoneConstraintStats,
  type StartTimelineConstraintStats,
  type FallbackConstraintStats,
} from "./conflict-stats.types.js";
import { seniorityMapping } from "../../config/knowledge-base/compatibility-constraints.config.js";
import { toNumber } from "../engineer-record-parser.js";

/*
 * Query statistics for a list of constraints.
 * Returns per-constraint stats showing how each constraint individually narrows the pool.
 *
 * Note: Neo4j sessions are not thread-safe for concurrent queries,
 * so we run these sequentially rather than with Promise.all.
 */
export async function queryConstraintsStats(
  session: Session,
  constraints: TestableConstraint[]
): Promise<ConstraintStats[]> {
  const results: ConstraintStats[] = [];
  for (const c of constraints) {
    results.push(await queryConstraintStats(session, c));
  }
  return results;
}

/*
 * Get the count of engineers matching ALL given constraints (combined with AND).
 */
export async function getCountMatchingAllConstraints(
  session: Session,
  constraints: TestableConstraint[]
): Promise<number> {
  if (constraints.length === 0) {
    const result = await session.run(`MATCH (e:Engineer) RETURN count(e) as count`);
    return toNumber(result.records[0]?.get("count"));
  }

  /*
   * Build WHERE clause from all constraint cypher fragments.
   * For property constraints, use their cypher.clause.
   * For skill constraints, we need to build the pattern match.
   */
  const whereClauses: string[] = [];
  const params: Record<string, unknown> = {};

  for (const c of constraints) {
    if (isPropertyConstraint(c)) {
      whereClauses.push(c.cypher.clause);
      params[c.cypher.paramName] = c.cypher.paramValue;
    } else if (isSkillTraversalConstraint(c)) {
      /*
       * For skills, we need EXISTS pattern.
       * Note: skill constraints in QUICKXPLAIN already have individual skills split out.
       */
      const skillId = c.skillIds[0];
      const paramName = `skill_${c.id.replace(/[^a-zA-Z0-9]/g, "_")}`;

      if (isUserSkillConstraint(c) && c.value.minProficiency) {
        const profParam = `${paramName}_prof`;
        whereClauses.push(
          `EXISTS { (e)-[r:HAS_SKILL]->(s:Skill {id: $${paramName}}) WHERE r.proficiencyLevel = $${profParam} }`
        );
        params[paramName] = skillId;
        params[profParam] = c.value.minProficiency;
      } else {
        whereClauses.push(`EXISTS { (e)-[:HAS_SKILL]->(:Skill {id: $${paramName}}) }`);
        params[paramName] = skillId;
      }
    }
  }

  const whereClause = whereClauses.join(" AND ");
  const result = await session.run(
    `MATCH (e:Engineer) WHERE ${whereClause} RETURN count(e) as count`,
    params
  );

  return toNumber(result.records[0]?.get("count"));
}

/*
 * Route to the appropriate stats query based on constraint type and field.
 */
async function queryConstraintStats(
  session: Session,
  constraint: TestableConstraint
): Promise<ConstraintStats> {
  if (isSkillTraversalConstraint(constraint)) {
    return querySkillStats(session, constraint);
  }

  if (isPropertyConstraint(constraint)) {
    switch (constraint.field) {
      case "yearsExperience":
        return queryYearsExperienceStats(session, constraint);

      case "salary":
        return querySalaryStats(session, constraint);

      case "timezone":
        return queryTimezoneStats(session, constraint);

      case "startTimeline":
        return queryStartTimelineStats(session, constraint);

      default:
        return queryFallbackStats(session, constraint);
    }
  }

  return queryFallbackStats(session, constraint);
}

async function querySkillStats(
  session: Session,
  constraint: TestableConstraint
): Promise<SkillConstraintStats> {
  if (!isSkillTraversalConstraint(constraint)) {
    throw new Error("Expected skill traversal constraint");
  }

  const skillId = constraint.skillIds[0];
  const proficiency =
    isUserSkillConstraint(constraint) && constraint.value.minProficiency
      ? constraint.value.minProficiency
      : "any";

  const result = await session.run(
    `
    MATCH (e:Engineer)-[r:HAS_SKILL]->(s:Skill {id: $skillId})
    WITH s,
      sum(CASE WHEN $proficiency = 'any' OR r.proficiencyLevel = $proficiency THEN 1 ELSE 0 END) as exactCount,
      sum(CASE WHEN $proficiency <> 'any' AND r.proficiencyLevel <> $proficiency THEN 1 ELSE 0 END) as lowerCount
    RETURN exactCount, lowerCount
  `,
    { skillId, proficiency }
  );

  const record = result.records[0];
  return {
    type: ConstraintStatsType.Skill,
    displayValue: constraint.displayValue,
    countMatching: toNumber(record?.get("exactCount")),
    skillId,
    proficiency,
    countAtLowerProficiency: toNumber(record?.get("lowerCount")),
  };
}

async function querySalaryStats(
  session: Session,
  constraint: TestableConstraint
): Promise<SalaryConstraintStats> {
  if (!isPropertyConstraint(constraint)) {
    throw new Error("Expected property constraint");
  }

  const maxBudget = constraint.value as number;

  const result = await session.run(
    `
    MATCH (e:Engineer)
    RETURN
      sum(CASE WHEN e.salary <= $maxBudget THEN 1 ELSE 0 END) as countMatching,
      min(e.salary) as minSalary,
      max(e.salary) as maxSalary
  `,
    { maxBudget }
  );

  const record = result.records[0];
  return {
    type: ConstraintStatsType.Salary,
    displayValue: constraint.displayValue,
    countMatching: toNumber(record?.get("countMatching")),
    requestedMax: maxBudget,
    minSalaryInDb: toNumber(record?.get("minSalary")),
    maxSalaryInDb: toNumber(record?.get("maxSalary")),
  };
}

/*
 * Query stats for yearsExperience constraint.
 * Uses seniorityMapping from config to ensure consistent bucket boundaries.
 */
async function queryYearsExperienceStats(
  session: Session,
  constraint: TestableConstraint
): Promise<YearsExperienceConstraintStats> {
  if (!isPropertyConstraint(constraint)) {
    throw new Error("Expected property constraint");
  }

  const { minYears, maxYears } = extractYearsExperienceRange(constraint);
  const { junior, mid, senior, staff } = seniorityMapping;

  const result = await session.run(
    `
    MATCH (e:Engineer)
    RETURN
      min(e.yearsExperience) as minYears,
      max(e.yearsExperience) as maxYears,
      sum(CASE WHEN e.yearsExperience >= $minYears
               AND ($maxYears IS NULL OR e.yearsExperience < $maxYears)
          THEN 1 ELSE 0 END) as countMatching,
      sum(CASE WHEN e.yearsExperience >= $juniorMin AND e.yearsExperience < $juniorMax THEN 1 ELSE 0 END) as junior,
      sum(CASE WHEN e.yearsExperience >= $midMin AND e.yearsExperience < $midMax THEN 1 ELSE 0 END) as mid,
      sum(CASE WHEN e.yearsExperience >= $seniorMin AND e.yearsExperience < $seniorMax THEN 1 ELSE 0 END) as senior,
      sum(CASE WHEN e.yearsExperience >= $staffMin THEN 1 ELSE 0 END) as staffPlus
  `,
    {
      minYears,
      maxYears,
      juniorMin: junior.minYears,
      juniorMax: junior.maxYears,
      midMin: mid.minYears,
      midMax: mid.maxYears,
      seniorMin: senior.minYears,
      seniorMax: senior.maxYears,
      staffMin: staff.minYears,
    }
  );

  const record = result.records[0];
  return {
    type: ConstraintStatsType.YearsExperience,
    displayValue: constraint.displayValue,
    countMatching: toNumber(record?.get("countMatching")),
    requestedMinYears: minYears,
    requestedMaxYears: maxYears,
    minYearsInDb: toNumber(record?.get("minYears")),
    maxYearsInDb: toNumber(record?.get("maxYears")),
    countByRange: {
      junior: toNumber(record?.get("junior")),
      mid: toNumber(record?.get("mid")),
      senior: toNumber(record?.get("senior")),
      staffPlus: toNumber(record?.get("staffPlus")),
    },
  };
}

/*
 * Query stats for timezone constraint.
 * Shows distribution across US timezone zones.
 */
async function queryTimezoneStats(
  session: Session,
  constraint: TestableConstraint
): Promise<TimezoneConstraintStats> {
  if (!isPropertyConstraint(constraint)) {
    throw new Error("Expected property constraint");
  }

  const requestedZones = Array.isArray(constraint.value)
    ? (constraint.value as string[])
    : [constraint.value as string];

  const result = await session.run(`
    MATCH (e:Engineer)
    RETURN e.timezone as zone, count(e) as count
  `);

  const countByZone: Record<string, number> = {};
  let countMatching = 0;

  for (const record of result.records) {
    const zone = record.get("zone") as string | null;
    const countValue = record.get("count");
    if (zone) {
      const count = toNumber(countValue);
      countByZone[zone] = count;
      if (requestedZones.includes(zone)) {
        countMatching += count;
      }
    }
  }

  return {
    type: ConstraintStatsType.Timezone,
    displayValue: constraint.displayValue,
    countMatching,
    requestedZones,
    countByZone,
  };
}

/*
 * Query stats for startTimeline constraint.
 * Shows distribution across all timeline values.
 */
async function queryStartTimelineStats(
  session: Session,
  constraint: TestableConstraint
): Promise<StartTimelineConstraintStats> {
  if (!isPropertyConstraint(constraint)) {
    throw new Error("Expected property constraint");
  }

  const requestedTimelines = Array.isArray(constraint.value)
    ? (constraint.value as string[])
    : [constraint.value as string];

  const result = await session.run(`
    MATCH (e:Engineer)
    RETURN e.startTimeline as timeline, count(e) as count
  `);

  const countByTimeline: Record<string, number> = {};
  let countMatching = 0;

  for (const record of result.records) {
    const timeline = record.get("timeline") as string | null;
    const countValue = record.get("count");
    if (timeline) {
      const count = toNumber(countValue);
      countByTimeline[timeline] = count;
      if (requestedTimelines.includes(timeline)) {
        countMatching += count;
      }
    }
  }

  return {
    type: ConstraintStatsType.StartTimeline,
    displayValue: constraint.displayValue,
    countMatching,
    requestedMaxTimeline: requestedTimelines[requestedTimelines.length - 1],
    countByTimeline,
  };
}

async function queryFallbackStats(
  session: Session,
  constraint: TestableConstraint
): Promise<FallbackConstraintStats> {
  if (!isPropertyConstraint(constraint)) {
    /*
     * For non-property constraints without specific handling,
     * return a simple count based on the constraint's full query.
     */
    return {
      type: ConstraintStatsType.Fallback,
      displayValue: constraint.displayValue,
      countMatching: 0,
    };
  }

  const result = await session.run(
    `
    MATCH (e:Engineer)
    WHERE ${constraint.cypher.clause}
    RETURN count(e) as count
  `,
    { [constraint.cypher.paramName]: constraint.cypher.paramValue }
  );

  return {
    type: ConstraintStatsType.Fallback,
    displayValue: constraint.displayValue,
    countMatching: toNumber(result.records[0]?.get("count")),
  };
}

/*
 * Extract years experience range from constraint.
 * yearsExperience constraints typically come with >= operator.
 */
function extractYearsExperienceRange(constraint: TestableConstraint): {
  minYears: number;
  maxYears: number | null;
} {
  if (!isPropertyConstraint(constraint)) {
    return { minYears: 0, maxYears: null };
  }

  if (constraint.operator === ">=") {
    return { minYears: constraint.value as number, maxYears: null };
  }
  if (constraint.operator === "<") {
    return { minYears: 0, maxYears: constraint.value as number };
  }

  return { minYears: 0, maxYears: null };
}
