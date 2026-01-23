import { Session } from "neo4j-driver";
import { v4 as uuidv4 } from "uuid";

/*
 * Store or update a resume for an engineer.
 * Uses MERGE to handle both creation and updates.
 */
export async function storeResume(
  session: Session,
  engineerId: string,
  resumeText: string
): Promise<void> {
  const snapshotId = `resume_${uuidv4().slice(0, 8)}`;

  await session.run(
    `
    MATCH (e:Engineer {id: $engineerId})
    MERGE (e)-[:HAS_RESUME]->(r:Resume {engineerId: $engineerId})
    ON CREATE SET
      r.id = $snapshotId,
      r.rawText = $resumeText,
      r.processedAt = datetime()
    ON MATCH SET
      r.rawText = $resumeText,
      r.processedAt = datetime()
    `,
    { engineerId, snapshotId, resumeText }
  );
}
