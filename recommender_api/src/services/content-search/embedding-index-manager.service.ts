import { Session } from "neo4j-driver";
import { generateEmbedding, getEmbeddingModelName } from "../llm.service.js";
import { loadEngineerTextContent, concatenateEngineerText } from "./engineer-text-loader.service.js";

/*
 * Generate and store embedding for an engineer.
 *
 * Uses the shared text loader to get engineer content, then generates
 * a dense embedding vector via the LLM service.
 *
 * @returns true if embedding was generated and stored, false otherwise
 */
export async function updateEngineerEmbedding(
  session: Session,
  engineerId: string
): Promise<boolean> {
  const contents = await loadEngineerTextContent(session, engineerId);
  if (contents.length === 0) {
    console.warn(`[Embedding] Engineer not found: ${engineerId}`);
    return false;
  }

  const content = contents[0];
  const combinedText = concatenateEngineerText(content);

  if (!combinedText.trim()) {
    console.warn(`[Embedding] No text content for engineer: ${engineerId}`);
    return false;
  }

  // Generate embedding
  const embedding = await generateEmbedding(combinedText);
  if (!embedding) {
    console.warn(`[Embedding] Failed to generate embedding for engineer: ${engineerId}`);
    return false;
  }

  // Store embedding on Engineer node
  await session.run(`
    MATCH (e:Engineer {id: $engineerId})
    SET e.embedding = $embedding,
        e.embeddingModel = $model,
        e.embeddingUpdatedAt = datetime()
  `, {
    engineerId,
    embedding,
    model: getEmbeddingModelName(),
  });

  return true;
}

/*
 * Find engineers similar to a query using Neo4j vector similarity search.
 *
 * Uses the engineer_embedding_index for efficient ANN search.
 */
export async function findSimilarEngineersByEmbedding(
  session: Session,
  queryEmbedding: number[],
  limit: number = 20,
  excludeEngineerId?: string
): Promise<Array<{ engineerId: string; score: number }>> {
  /*
   * Neo4j vector search returns results sorted by similarity.
   * We request more than we need to account for potential exclusion.
   */
  const fetchLimit = excludeEngineerId ? limit + 1 : limit;

  const result = await session.run(`
    CALL db.index.vector.queryNodes('engineer_embedding_index', $limit, $queryEmbedding)
    YIELD node AS e, score
    WHERE e.embedding IS NOT NULL
    RETURN e.id AS engineerId, score
    ORDER BY score DESC
  `, {
    queryEmbedding,
    limit: fetchLimit,
  });

  let results = result.records.map((record) => ({
    engineerId: record.get("engineerId") as string,
    score: record.get("score") as number,
  }));

  // Exclude the specified engineer (for similarity search)
  if (excludeEngineerId) {
    results = results.filter((r) => r.engineerId !== excludeEngineerId);
  }

  return results.slice(0, limit);
}

/*
 * Find engineers similar to a query, filtering to only consider a specific set of candidates.
 *
 * This is used by hybrid search where boolean filtering has already narrowed the
 * candidate set. We use Neo4j's HNSW vector index for efficient ANN search, then
 * filter to only include candidates from the pre-filtered set.
 *
 * Architecture note: We query the full index and filter client-side rather than
 * passing the filter to Neo4j. This is intentional because:
 * 1. HNSW index queries are O(log n) regardless of corpus size
 * 2. Neo4j's vector index doesn't support pre-filtering in the index scan
 * 3. Post-filtering is fast and keeps the query simple
 *
 * For very large candidate sets (100K+), this could be revisited with a hybrid
 * approach using Neo4j's filtering capabilities on the indexed scan.
 */
export async function findSimilarEngineersByEmbeddingWithFilter(
  session: Session,
  queryEmbedding: number[],
  limit: number,
  candidateIds: Set<string>,
  excludeEngineerId?: string
): Promise<Array<{ engineerId: string; score: number }>> {
  /*
   * Query strategy: Fetch more results than needed to account for filtering.
   *
   * The multiplier (5x) is a heuristic. If the candidate set is a small fraction
   * of the total corpus, we may need to fetch many results to find enough matches.
   * In practice, boolean filters typically retain 10-50% of the corpus, so 5x
   * provides a reasonable buffer.
   *
   * If we don't get enough results, we could do a second pass with a larger limit,
   * but for typical workloads this should be unnecessary.
   */
  const fetchLimit = Math.min(limit * 5, 500);

  const result = await session.run(`
    CALL db.index.vector.queryNodes('engineer_embedding_index', $limit, $queryEmbedding)
    YIELD node AS e, score
    WHERE e.embedding IS NOT NULL
    RETURN e.id AS engineerId, score
    ORDER BY score DESC
  `, {
    queryEmbedding,
    limit: fetchLimit,
  });

  let results = result.records
    .map((record) => ({
      engineerId: record.get("engineerId") as string,
      score: record.get("score") as number,
    }))
    .filter((r) => candidateIds.has(r.engineerId));

  // Exclude the specified engineer (for similarity search)
  if (excludeEngineerId) {
    results = results.filter((r) => r.engineerId !== excludeEngineerId);
  }

  return results.slice(0, limit);
}

/*
 * Get an engineer's embedding vector.
 */
export async function getEngineerEmbedding(
  session: Session,
  engineerId: string
): Promise<number[] | null> {
  const result = await session.run(`
    MATCH (e:Engineer {id: $engineerId})
    RETURN e.embedding AS embedding
  `, { engineerId });

  if (result.records.length === 0) {
    return null;
  }

  return result.records[0].get("embedding") as number[] | null;
}

/*
 * Find engineers similar to another engineer by their embedding.
 */
export async function findSimilarToEngineer(
  session: Session,
  engineerId: string,
  limit: number = 20
): Promise<Array<{ engineerId: string; score: number }>> {
  // Get target engineer's embedding
  const embeddingResult = await session.run(`
    MATCH (e:Engineer {id: $engineerId})
    RETURN e.embedding AS embedding
  `, { engineerId });

  if (embeddingResult.records.length === 0) {
    throw new Error(`Engineer not found: ${engineerId}`);
  }

  const embedding = embeddingResult.records[0].get("embedding") as number[];
  if (!embedding) {
    throw new Error(`Engineer has no embedding: ${engineerId}`);
  }

  return findSimilarEngineersByEmbedding(session, embedding, limit, engineerId);
}

/*
 * Check if an engineer has an embedding.
 */
export async function hasEngineerEmbedding(
  session: Session,
  engineerId: string
): Promise<boolean> {
  const result = await session.run(`
    MATCH (e:Engineer {id: $engineerId})
    RETURN e.embedding IS NOT NULL AS hasEmbedding
  `, { engineerId });

  if (result.records.length === 0) {
    return false;
  }

  return result.records[0].get("hasEmbedding") as boolean;
}

/*
 * Get the embedding model info stored on an engineer.
 */
export async function getEngineerEmbeddingInfo(
  session: Session,
  engineerId: string
): Promise<{ model: string; updatedAt: string } | null> {
  const result = await session.run(`
    MATCH (e:Engineer {id: $engineerId})
    WHERE e.embedding IS NOT NULL
    RETURN e.embeddingModel AS model, toString(e.embeddingUpdatedAt) AS updatedAt
  `, { engineerId });

  if (result.records.length === 0) {
    return null;
  }

  return {
    model: result.records[0].get("model") as string,
    updatedAt: result.records[0].get("updatedAt") as string,
  };
}
