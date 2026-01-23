import { Session } from "neo4j-driver";

/*
 * Migration: Add vector index for skill embeddings.
 *
 * Uses the same configuration as engineer_embedding_index:
 * - 1024 dimensions (mxbai-embed-large output size)
 * - Cosine similarity function
 */
export async function addSkillVectorIndex(session: Session): Promise<void> {
  console.log("[Migration] Creating skill embedding vector index...");

  await session.run(`
    CREATE VECTOR INDEX skill_embedding_index IF NOT EXISTS
    FOR (s:Skill)
    ON (s.embedding)
    OPTIONS {
      indexConfig: {
        \`vector.dimensions\`: 1024,
        \`vector.similarity_function\`: 'cosine'
      }
    }
  `);

  console.log("[Migration] Created skill_embedding_index (1024 dimensions, cosine similarity)");
}
