import { Session } from "neo4j-driver";

/**
 * Migration: Add vector index for job description embeddings.
 *
 * Uses the same configuration as skill_embedding_index:
 * - 1024 dimensions (mxbai-embed-large output size)
 * - Cosine similarity function
 */
export async function addJobDescriptionVectorIndex(session: Session): Promise<void> {
  console.log("[Migration] Creating job description embedding vector index...");

  await session.run(`
    CREATE VECTOR INDEX job_description_embedding_index IF NOT EXISTS
    FOR (j:JobDescription)
    ON (j.embedding)
    OPTIONS {
      indexConfig: {
        \`vector.dimensions\`: 1024,
        \`vector.similarity_function\`: 'cosine'
      }
    }
  `);

  console.log("[Migration] Job description vector index created.");
}
