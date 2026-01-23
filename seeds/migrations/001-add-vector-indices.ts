import { Session } from "neo4j-driver";

/*
 * Migration: Create Neo4j vector index for engineer embeddings.
 *
 * This enables efficient approximate nearest neighbor (ANN) search
 * for finding similar engineers based on their dense embedding vectors.
 *
 * Index configuration:
 * - Dimensions: 1024 (matches mxbai-embed-large output)
 * - Similarity: cosine (standard for normalized embeddings)
 */
export async function createVectorIndices(session: Session): Promise<void> {
  console.log("[Migration] Creating engineer embedding vector index...");

  await session.run(`
    CREATE VECTOR INDEX engineer_embedding_index IF NOT EXISTS
    FOR (e:Engineer)
    ON (e.embedding)
    OPTIONS {
      indexConfig: {
        \`vector.dimensions\`: 1024,
        \`vector.similarity_function\`: 'cosine'
      }
    }
  `);

  console.log("[Migration] Created engineer_embedding_index (1024 dimensions, cosine similarity)");
}

/*
 * Check if the vector index exists.
 */
export async function vectorIndexExists(session: Session): Promise<boolean> {
  const result = await session.run(`
    SHOW INDEXES
    YIELD name
    WHERE name = 'engineer_embedding_index'
    RETURN count(*) AS count
  `);

  const count = result.records[0]?.get("count")?.toNumber() ?? 0;
  return count > 0;
}
