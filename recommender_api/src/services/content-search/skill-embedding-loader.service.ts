import { Session } from "neo4j-driver";
import type { SkillWithEmbedding, SkillWithRecency } from "./skill-embedding-similarity.types.js";

/*
 * Load skill embeddings for an engineer from Neo4j.
 *
 * Joins Engineer → UserSkill → Skill to get all skills with their embeddings.
 * Also joins UserSkill → WorkExperience to determine recency.
 */
export async function loadEngineerSkillsWithEmbeddings(
  session: Session,
  engineerId: string
): Promise<SkillWithRecency[]> {
  const result = await session.run(`
    MATCH (e:Engineer {id: $engineerId})-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    WHERE s.embedding IS NOT NULL

    // Get the most recent work experience where this skill was used
    OPTIONAL MATCH (us)-[:USED_AT]->(w:WorkExperience)
    WITH us, s, w
    ORDER BY w.endDate DESC
    WITH us, s, collect(w)[0] AS latestWork

    RETURN
      s.id AS skillId,
      s.name AS skillName,
      s.embedding AS embedding,
      latestWork.endDate AS lastUsedDate,
      us.yearsUsed AS yearsUsed
  `, { engineerId });

  return result.records.map((record) => ({
    skillId: record.get("skillId") as string,
    skillName: record.get("skillName") as string,
    embedding: record.get("embedding") as number[],
    lastUsedDate: record.get("lastUsedDate") as string | null,
    yearsUsed: (record.get("yearsUsed") as number) || 0,
  }));
}

/*
 * Load skill embeddings for multiple skills by ID.
 *
 * Used when computing similarity against a query skill set
 * (e.g., job requirements or another engineer's skills).
 */
export async function loadSkillEmbeddingsByIds(
  session: Session,
  skillIds: string[]
): Promise<SkillWithEmbedding[]> {
  if (skillIds.length === 0) {
    return [];
  }

  const result = await session.run(`
    MATCH (s:Skill)
    WHERE s.id IN $skillIds AND s.embedding IS NOT NULL
    RETURN s.id AS skillId, s.name AS skillName, s.embedding AS embedding
  `, { skillIds });

  return result.records.map((record) => ({
    skillId: record.get("skillId") as string,
    skillName: record.get("skillName") as string,
    embedding: record.get("embedding") as number[],
  }));
}
