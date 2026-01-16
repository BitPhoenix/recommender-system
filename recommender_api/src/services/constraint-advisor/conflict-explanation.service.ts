import type { Session } from "neo4j-driver";
import type { TestableConstraint } from "./constraint.types.js";
import { generateCompletion } from "../llm.service.js";
import {
  type ConflictStats,
  type ConstraintStats,
  ConstraintStatsType,
  type SkillConstraintStats,
  type SalaryConstraintStats,
  type YearsExperienceConstraintStats,
  type TimezoneConstraintStats,
  type StartTimelineConstraintStats,
} from "./conflict-stats.types.js";
import {
  queryConstraintsStats,
  getCountMatchingAllConstraints,
} from "./conflict-stats.service.js";
import { seniorityMapping } from "../../config/knowledge-base/compatibility-constraints.config.js";

export interface ConflictExplanations {
  /* Data-aware template explanation (always present) */
  dataAwareExplanation: string;
  /* RAG-enhanced LLM explanation (null if LLM unavailable) */
  llmExplanation: string | null;
  /* Full statistics for each constraint */
  stats: ConflictStats;
}

const LLM_SYSTEM_PROMPT = `You are an expert in tech talent acquisition. You will be given:
1. A set of search constraints that produced few/no results
2. Actual statistics from our engineer database (individual counts per constraint + combined count)

Your task: Explain WHY these constraints conflict. Use the provided statistics as facts, but add your knowledge of:
- Market dynamics (salary ranges, skill rarity)
- Career path patterns (which skills tend to co-occur)
- Hiring realities

Also suggest specific alternatives based on the data provided.

Keep your response concise (2-4 sentences).`;

/*
 * Generate both template and LLM explanations for a conflict.
 * Template uses actual database statistics. LLM receives RAG context.
 *
 * Note: Neo4j sessions are not thread-safe for concurrent queries,
 * so we run these sequentially rather than with Promise.all.
 */
export async function generateConflictExplanations(
  session: Session,
  allConstraints: TestableConstraint[],
  conflictSetConstraints: TestableConstraint[]
): Promise<ConflictExplanations> {
  const countMatchingAll = await getCountMatchingAllConstraints(session, allConstraints);
  const allConstraintStats = await queryConstraintsStats(session, allConstraints);
  const conflictingConstraintStats = await queryConstraintsStats(session, conflictSetConstraints);

  const stats: ConflictStats = {
    countMatchingAll,
    allConstraintStats,
    conflictingConstraintStats,
  };

  const dataAwareExplanation = generateDataAwareExplanation(stats);
  const llmExplanation = await generateLLMExplanation(stats);

  return {
    dataAwareExplanation,
    llmExplanation,
    stats,
  };
}

/*
 * Generate explanation using actual database statistics.
 * No assumptions—only facts from our data.
 */
function generateDataAwareExplanation(stats: ConflictStats): string {
  const parts: string[] = [];

  parts.push(`Your search returns ${stats.countMatchingAll} engineers.`);

  if (stats.conflictingConstraintStats.length > 0) {
    parts.push("The conflict:");
    for (const cs of stats.conflictingConstraintStats) {
      parts.push(formatConstraintStats(cs));
    }
  }

  if (stats.allConstraintStats.length > stats.conflictingConstraintStats.length) {
    parts.push("Full query breakdown:");
    for (const cs of stats.allConstraintStats) {
      parts.push(formatConstraintStats(cs));
    }
  }

  return parts.join(" ");
}

/*
 * Format a single constraint's stats with type-specific enrichment.
 */
function formatConstraintStats(cs: ConstraintStats): string {
  switch (cs.type) {
    case ConstraintStatsType.Skill: {
      const skill = cs as SkillConstraintStats;
      let line = `${skill.countMatching} with ${skill.proficiency} ${skill.displayValue}`;
      if (skill.countAtLowerProficiency > 0) {
        line += ` (${skill.countAtLowerProficiency} at lower proficiency)`;
      }
      return line + ".";
    }

    case ConstraintStatsType.Salary: {
      const salary = cs as SalaryConstraintStats;
      return (
        `${salary.countMatching} within $${salary.requestedMax.toLocaleString()} budget ` +
        `(salaries in DB range $${salary.minSalaryInDb.toLocaleString()}-$${salary.maxSalaryInDb.toLocaleString()}).`
      );
    }

    case ConstraintStatsType.YearsExperience: {
      const yoe = cs as YearsExperienceConstraintStats;
      const { countByRange } = yoe;
      const rangeStr = yoe.requestedMaxYears
        ? `${yoe.requestedMinYears}-${yoe.requestedMaxYears} years`
        : `${yoe.requestedMinYears}+ years`;
      const distribution =
        `junior: ${countByRange.junior}, mid: ${countByRange.mid}, ` +
        `senior: ${countByRange.senior}, staff+: ${countByRange.staffPlus}`;
      return `${yoe.countMatching} with ${rangeStr} experience (DB distribution: ${distribution}).`;
    }

    case ConstraintStatsType.Timezone: {
      const tz = cs as TimezoneConstraintStats;
      const zoneStr = Object.entries(tz.countByZone)
        .map(([zone, count]) => `${zone}: ${count}`)
        .join(", ");
      return `${tz.countMatching} in ${tz.requestedZones.join(" or ")} (DB distribution: ${zoneStr}).`;
    }

    case ConstraintStatsType.StartTimeline: {
      const st = cs as StartTimelineConstraintStats;
      const timelineStr = Object.entries(st.countByTimeline)
        .map(([timeline, count]) => `${timeline}: ${count}`)
        .join(", ");
      return `${st.countMatching} available within ${st.requestedMaxTimeline} (DB distribution: ${timelineStr}).`;
    }

    case ConstraintStatsType.Fallback:
    default:
      return `${cs.countMatching} matching "${cs.displayValue}".`;
  }
}

/*
 * Build RAG context for the LLM from database statistics.
 */
function buildRAGContext(stats: ConflictStats): string {
  const lines: string[] = [
    "# Search Query Analysis",
    "",
    `Total engineers matching the full query: ${stats.countMatchingAll}`,
    "",
    "## Conflicting Constraints (the problem)",
    "These constraints together produce insufficient results:",
  ];

  for (const cs of stats.conflictingConstraintStats) {
    lines.push(formatConstraintStatsForRAG(cs));
  }

  lines.push("");
  lines.push("## Full Query Breakdown (all constraints)");
  lines.push("Complete visibility into how each constraint narrows the pool:");

  for (const cs of stats.allConstraintStats) {
    lines.push(formatConstraintStatsForRAG(cs));
  }

  return lines.join("\n");
}

/*
 * Format constraint stats for RAG context (more verbose than template).
 */
function formatConstraintStatsForRAG(cs: ConstraintStats): string {
  switch (cs.type) {
    case ConstraintStatsType.Skill: {
      const skill = cs as SkillConstraintStats;
      return (
        `- "${skill.displayValue}": ${skill.countMatching} engineers at ${skill.proficiency} level, ` +
        `${skill.countAtLowerProficiency} at lower proficiency levels`
      );
    }

    case ConstraintStatsType.Salary: {
      const salary = cs as SalaryConstraintStats;
      return (
        `- "${salary.displayValue}": ${salary.countMatching} engineers within $${salary.requestedMax.toLocaleString()} budget. ` +
        `Database salary range: $${salary.minSalaryInDb.toLocaleString()} - $${salary.maxSalaryInDb.toLocaleString()}`
      );
    }

    case ConstraintStatsType.YearsExperience: {
      const yoe = cs as YearsExperienceConstraintStats;
      const { countByRange } = yoe;
      const rangeStr = yoe.requestedMaxYears
        ? `${yoe.requestedMinYears}-${yoe.requestedMaxYears} years`
        : `${yoe.requestedMinYears}+ years`;
      const { junior, mid, senior, staff } = seniorityMapping;
      return (
        `- "${yoe.displayValue}": ${yoe.countMatching} engineers with ${rangeStr} experience. ` +
        `Experience distribution: junior (${junior.minYears}-${junior.maxYears}y): ${countByRange.junior}, ` +
        `mid (${mid.minYears}-${mid.maxYears}y): ${countByRange.mid}, ` +
        `senior (${senior.minYears}-${senior.maxYears}y): ${countByRange.senior}, ` +
        `staff+ (${staff.minYears}+y): ${countByRange.staffPlus}`
      );
    }

    case ConstraintStatsType.Timezone: {
      const tz = cs as TimezoneConstraintStats;
      const zoneBreakdown = Object.entries(tz.countByZone)
        .map(([zone, count]) => `${zone}: ${count}`)
        .join(", ");
      return (
        `- "${tz.displayValue}": ${tz.countMatching} engineers in ${tz.requestedZones.join(" or ")}. ` +
        `Timezone distribution: ${zoneBreakdown}`
      );
    }

    case ConstraintStatsType.StartTimeline: {
      const st = cs as StartTimelineConstraintStats;
      const timelineBreakdown = Object.entries(st.countByTimeline)
        .map(([timeline, count]) => `${timeline}: ${count}`)
        .join(", ");
      return (
        `- "${st.displayValue}": ${st.countMatching} engineers available within ${st.requestedMaxTimeline}. ` +
        `Availability distribution: ${timelineBreakdown}`
      );
    }

    case ConstraintStatsType.Fallback:
    default:
      return `- "${cs.displayValue}": ${cs.countMatching} engineers`;
  }
}

/*
 * Generate LLM explanation with RAG context.
 * Returns null if LLM is unavailable.
 */
async function generateLLMExplanation(
  stats: ConflictStats
): Promise<string | null> {
  const ragContext = buildRAGContext(stats);

  return generateCompletion(ragContext, {
    systemPrompt: LLM_SYSTEM_PROMPT,
  });
}
