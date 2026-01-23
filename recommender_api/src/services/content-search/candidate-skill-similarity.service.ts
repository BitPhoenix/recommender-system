import { Session } from "neo4j-driver";
import { loadEngineerSkillsWithEmbeddings } from "./skill-embedding-loader.service.js";
import { computeSkillSetSimilarity } from "./skill-embedding-similarity.service.js";
import type { SkillSetSimilarityResult } from "./skill-embedding-similarity.types.js";

/*
 * Cache for engineer skill embeddings to avoid repeated Neo4j queries.
 *
 * Key: engineerId
 * Value: Array of skills with embeddings and recency info
 *
 * Note: This is a simple in-memory cache. For production, consider
 * using a proper caching solution with TTL and memory limits.
 */
const engineerIdToSkillEmbeddingsCache = new Map<string, Awaited<ReturnType<typeof loadEngineerSkillsWithEmbeddings>>>();

/*
 * Compute skill embedding similarity between a target engineer and multiple candidates.
 *
 * Used by content search to add skill-based features to the ranking.
 *
 * @param session Neo4j session
 * @param targetEngineerId The engineer to compare against (or query skill set)
 * @param candidateEngineerIds Engineers to score
 * @returns Map of engineerId → similarity result
 */
export async function computeSkillSimilarityForCandidates(
  session: Session,
  targetEngineerId: string,
  candidateEngineerIds: string[]
): Promise<Map<string, SkillSetSimilarityResult>> {
  // Load target engineer's skills (as the reference set)
  const targetSkills = await getCachedEngineerSkillsWithEmbeddings(session, targetEngineerId);
  if (targetSkills.length === 0) {
    // Target has no skills with embeddings - return zeros for all candidates
    return new Map(
      candidateEngineerIds.map((id) => [
        id,
        { skills: { score: 0, count: 0 }, recentSkills: { score: 0, count: 0 } },
      ])
    );
  }

  // Compute similarity for each candidate
  const candidateIdToSimilarity = new Map<string, SkillSetSimilarityResult>();

  for (const candidateId of candidateEngineerIds) {
    const candidateSkills = await getCachedEngineerSkillsWithEmbeddings(session, candidateId);
    const similarity = computeSkillSetSimilarity(candidateSkills, targetSkills);
    candidateIdToSimilarity.set(candidateId, similarity);
  }

  return candidateIdToSimilarity;
}

/*
 * Get engineer skills with caching.
 */
async function getCachedEngineerSkillsWithEmbeddings(
  session: Session,
  engineerId: string
): Promise<Awaited<ReturnType<typeof loadEngineerSkillsWithEmbeddings>>> {
  if (!engineerIdToSkillEmbeddingsCache.has(engineerId)) {
    const skills = await loadEngineerSkillsWithEmbeddings(session, engineerId);
    engineerIdToSkillEmbeddingsCache.set(engineerId, skills);
  }
  return engineerIdToSkillEmbeddingsCache.get(engineerId)!;
}

/*
 * Clear the skill embedding cache.
 *
 * Call this when skills are updated (e.g., after resume upload).
 */
export function clearCachedEngineerSkillsWithEmbeddings(engineerId?: string): void {
  if (engineerId) {
    engineerIdToSkillEmbeddingsCache.delete(engineerId);
  } else {
    engineerIdToSkillEmbeddingsCache.clear();
  }
}
