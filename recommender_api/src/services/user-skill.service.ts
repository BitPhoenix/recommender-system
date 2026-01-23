import { Session } from "neo4j-driver";
import { ExtractedJob } from "./resume-processor/feature-extractor.service.js";

/*
 * Build a map of skillName → workExperienceIds from job structure.
 * Pure function - no DB access.
 */
export function buildSkillNameToWorkExperienceIdMap(
  jobs: ExtractedJob[],
  jobIndexToWorkExperienceId: Map<number, string>
): Map<string, string[]> {
  const skillNameToWorkExperienceIds = new Map<string, string[]>();

  jobs.forEach((job, index) => {
    const workExperienceId = jobIndexToWorkExperienceId.get(index);
    if (!workExperienceId) return;

    for (const skill of job.skills) {
      const normalizedSkillName = skill.name.toLowerCase();
      const workExperienceIdsForSkill = skillNameToWorkExperienceIds.get(normalizedSkillName) || [];
      workExperienceIdsForSkill.push(workExperienceId);
      skillNameToWorkExperienceIds.set(normalizedSkillName, workExperienceIdsForSkill);
    }
  });

  return skillNameToWorkExperienceIds;
}

/*
 * Create UserSkill nodes for all resolved skills, with USED_AT links for job-specific skills.
 *
 * UserSkill is the single source of truth for "engineer knows skill".
 * USED_AT links connect UserSkills to WorkExperiences where the skill was used.
 * Skills from the standalone Skills section will have UserSkills but no USED_AT links.
 */
export async function createUserSkills(
  session: Session,
  engineerId: string,
  resolvedSkills: Array<{ originalName: string; canonicalSkillId: string | null }>,
  skillNameToWorkExperienceIds: Map<string, string[]>
): Promise<void> {
  for (const resolvedSkill of resolvedSkills) {
    if (!resolvedSkill.canonicalSkillId) continue;

    // Create UserSkill
    await session.run(`
      MATCH (e:Engineer {id: $engineerId})
      MATCH (s:Skill {id: $skillId})
      MERGE (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s)
      ON CREATE SET
        us.id = randomUUID(),
        us.proficiencyLevel = 'proficient',
        us.createdAt = datetime()
    `, {
      engineerId,
      skillId: resolvedSkill.canonicalSkillId,
    });

    // Create USED_AT links if this skill was used in jobs
    const workExperienceIds = skillNameToWorkExperienceIds.get(resolvedSkill.originalName.toLowerCase()) || [];
    for (const workExperienceId of workExperienceIds) {
      await session.run(`
        MATCH (e:Engineer {id: $engineerId})-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill {id: $skillId})
        MATCH (w:WorkExperience {id: $workExperienceId})
        MERGE (us)-[:USED_AT]->(w)
      `, {
        engineerId,
        skillId: resolvedSkill.canonicalSkillId,
        workExperienceId,
      });
    }
  }
}
