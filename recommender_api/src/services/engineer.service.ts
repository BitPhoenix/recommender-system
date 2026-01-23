import { Session } from "neo4j-driver";
import { v4 as uuidv4 } from "uuid";
import { ExtractedProfile } from "./resume-processor/feature-extractor.service.js";

export async function engineerExists(session: Session, engineerId: string): Promise<boolean> {
  const result = await session.run(
    `MATCH (e:Engineer {id: $engineerId}) RETURN e.id`,
    { engineerId }
  );
  return result.records.length > 0;
}

export async function createEngineer(
  session: Session,
  name: string,
  email: string
): Promise<string> {
  const engineerId = `eng_${uuidv4().slice(0, 8)}`;

  await session.run(
    `
    CREATE (e:Engineer {
      id: $engineerId,
      name: $name,
      email: $email,
      headline: '',
      salary: 0,
      yearsExperience: 0,
      startTimeline: 'immediate',
      timezone: 'Eastern',
      createdAt: datetime()
    })
    `,
    { engineerId, name, email }
  );

  return engineerId;
}

/*
 * Update simple engineer properties from extracted profile.
 * Domain linking is handled separately by normalizeExtractedDomains + linkEngineerToDomains.
 */
export async function updateEngineerProperties(
  session: Session,
  engineerId: string,
  profile: ExtractedProfile
): Promise<void> {
  // Compute seniority from most recent job (jobs are sorted oldest-first)
  const mostRecentJob = profile.jobs[profile.jobs.length - 1];
  const currentSeniority = mostRecentJob?.seniority || "mid";

  await session.run(`
    MATCH (e:Engineer {id: $engineerId})
    SET
      e.headline = COALESCE($headline, e.headline),
      e.yearsExperience = $yearsExperience,
      e.extractedSeniority = $seniority
  `, {
    engineerId,
    headline: profile.headline,
    yearsExperience: profile.totalYearsExperience,
    seniority: currentSeniority,
  });
}

export interface EngineerBasicInfo {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  timezone: string;
}

/*
 * Load basic info for a list of engineers by their IDs.
 */
export async function loadEngineerInfo(
  session: Session,
  engineerIds: string[]
): Promise<Map<string, EngineerBasicInfo>> {
  if (engineerIds.length === 0) {
    return new Map();
  }

  const result = await session.run(
    `
    MATCH (e:Engineer)
    WHERE e.id IN $engineerIds
    RETURN
      e.id AS id,
      e.name AS name,
      e.headline AS headline,
      e.salary AS salary,
      e.yearsExperience AS yearsExperience,
      e.timezone AS timezone
    `,
    { engineerIds }
  );

  const engineerIdToInfo = new Map<string, EngineerBasicInfo>();
  for (const record of result.records) {
    engineerIdToInfo.set(record.get("id"), {
      id: record.get("id"),
      name: record.get("name"),
      headline: record.get("headline") || "",
      salary: (record.get("salary") as { low: number })?.low || record.get("salary") || 0,
      yearsExperience: (record.get("yearsExperience") as { low: number })?.low || record.get("yearsExperience") || 0,
      timezone: record.get("timezone") || "Eastern",
    });
  }

  return engineerIdToInfo;
}
