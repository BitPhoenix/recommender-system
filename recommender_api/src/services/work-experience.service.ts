import { Session } from "neo4j-driver";
import { v4 as uuidv4 } from "uuid";
import { ExtractedJob } from "./resume-processor/feature-extractor.service.js";
import { findOrCreateCompany } from "./company.service.js";

/*
 * Create work history: Company nodes and WorkExperience nodes.
 * Returns a map of jobIndex → workExperienceId for linking skills to jobs.
 */
export async function createWorkExperiencesFromExtractedJobs(
  session: Session,
  engineerId: string,
  jobs: ExtractedJob[]
): Promise<Map<number, string>> {
  const jobIndexToWorkExperienceId = new Map<number, string>();

  for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
    const job = jobs[jobIndex];

    // Step 1: Find or create the Company node
    const companyId = await findOrCreateCompany(session, job.company, job.companyType);

    // Step 2: Create WorkExperience node
    const workExperienceId = `wexp_${uuidv4().slice(0, 8)}`;
    jobIndexToWorkExperienceId.set(jobIndex, workExperienceId);

    await session.run(`
      CREATE (w:WorkExperience {
        id: $workExperienceId,
        title: $title,
        startDate: $startDate,
        endDate: $endDate,
        seniority: $seniority,
        highlights: $highlights
      })
    `, {
      workExperienceId,
      title: job.title,
      startDate: job.startDate,
      endDate: job.endDate,
      seniority: job.seniority,
      highlights: job.highlights,
    });

    // Step 3: Create relationships
    // Engineer -[:HAD_ROLE]-> WorkExperience
    await session.run(`
      MATCH (e:Engineer {id: $engineerId})
      MATCH (w:WorkExperience {id: $workExperienceId})
      CREATE (e)-[:HAD_ROLE]->(w)
    `, { engineerId, workExperienceId });

    // WorkExperience -[:AT_COMPANY]-> Company
    await session.run(`
      MATCH (w:WorkExperience {id: $workExperienceId})
      MATCH (c:Company {id: $companyId})
      CREATE (w)-[:AT_COMPANY]->(c)
    `, { workExperienceId, companyId });
  }

  return jobIndexToWorkExperienceId;
}
