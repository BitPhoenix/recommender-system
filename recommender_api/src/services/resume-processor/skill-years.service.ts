import { Session } from "neo4j-driver";
import { calculateYearsFromDateRanges } from "./date-interval-merger.js";

/*
 * WorkExperience date range for a skill.
 */
interface SkillWorkExperience {
  startDate: string;
  endDate: string;
}

/*
 * Calculate and update yearsUsed for all UserSkills of an engineer.
 *
 * For each UserSkill:
 * 1. Find all WorkExperiences linked via USED_AT
 * 2. Collect their date ranges
 * 3. Merge overlapping intervals
 * 4. Calculate total years
 * 5. Update the UserSkill node
 *
 * Skills with no USED_AT relationships (standalone skills from Skills section)
 * will have yearsUsed set to 0.
 */
export async function calculateAndStoreSkillYears(
  session: Session,
  engineerId: string
): Promise<void> {
  // Get all UserSkills for this engineer with their linked WorkExperience dates
  const result = await session.run(`
    MATCH (e:Engineer {id: $engineerId})-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    OPTIONAL MATCH (us)-[:USED_AT]->(w:WorkExperience)
    WITH us, s, collect({startDate: w.startDate, endDate: w.endDate}) AS workExperiences
    RETURN us.id AS userSkillId, s.name AS skillName, workExperiences
  `, { engineerId });

  for (const record of result.records) {
    const userSkillId = record.get("userSkillId") as string;
    const workExperiences = record.get("workExperiences") as SkillWorkExperience[];

    // Filter out null entries (from skills with no USED_AT relationships)
    const validWorkExperiences = workExperiences.filter(
      (we) => we.startDate !== null && we.endDate !== null
    );

    const yearsUsed = calculateYearsFromDateRanges(validWorkExperiences);

    // Update the UserSkill node
    await session.run(`
      MATCH (us:UserSkill {id: $userSkillId})
      SET us.yearsUsed = $yearsUsed
    `, { userSkillId, yearsUsed });
  }
}
