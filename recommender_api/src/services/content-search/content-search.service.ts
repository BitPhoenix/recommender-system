import { Session } from "neo4j-driver";
import { getTfIdfIndex } from "./tfidf-index-manager.service.js";
import {
  queryToVector,
  cosineSimilarity,
  getTopMatchingTerms,
  type SparseVector,
} from "./tfidf-vectorizer.service.js";
import { generateEmbedding } from "../llm.service.js";
import {
  findSimilarByEmbedding,
  findSimilarToEngineer,
  findSimilarByEmbeddingWithFilter,
  getEngineerEmbedding,
} from "./embedding-index-manager.service.js";
import { loadEngineerInfo } from "../engineer.service.js";
import { getInvertedIndex, booleanFilter } from "./inverted-index.service.js";
import { computeSkillSimilarityForCandidates } from "./candidate-skill-similarity.service.js";
import type { SkillSetSimilarityResult } from "./skill-embedding-similarity.types.js";
import type { ContentSearchRequest, ContentSearchResponse } from "../../schemas/resume.schema.js";

/*
 * Input type for content search - method is optional and defaults to "tfidf".
 */
type ContentSearchInput = Omit<ContentSearchRequest, "method"> & {
  method?: ContentSearchRequest["method"];
};

/*
 * Execute content-based search using the specified method.
 *
 * Dispatches to the appropriate search implementation based on request.method:
 * - "tfidf": TF-IDF keyword-based similarity (default)
 * - "embedding": Dense embedding semantic similarity
 * - "hybrid": (Phase 3) Combination of TF-IDF and embedding
 */
export async function executeContentSearch(
  session: Session,
  request: ContentSearchInput
): Promise<ContentSearchResponse> {
  const method = request.method ?? "tfidf";

  switch (method) {
    case "embedding":
      return executeEmbeddingSearch(session, { ...request, method });
    case "hybrid":
      return executeHybridSearch(session, { ...request, method });
    case "tfidf":
    default:
      return executeTfIdfSearch(session, { ...request, method });
  }
}

/*
 * Execute TF-IDF keyword-based search.
 */
async function executeTfIdfSearch(
  session: Session,
  request: ContentSearchRequest
): Promise<ContentSearchResponse> {
  const startTime = Date.now();

  // Get or build the TF-IDF index
  const tfIdfIndex = await getTfIdfIndex(session);

  // Get query vector
  let queryVector: SparseVector;
  let queryText: string;

  if (request.similarToEngineerId) {
    // Find similar to an existing engineer
    // The TF-IDF index uses engineer IDs as document IDs
    const targetVector = tfIdfIndex.documentIdToVector.get(request.similarToEngineerId);
    if (!targetVector) {
      throw new Error(`Engineer not found in index: ${request.similarToEngineerId}`);
    }
    queryVector = targetVector;
    queryText = "";  // No query text for similarity search
  } else {
    queryText = request.queryText!;
    queryVector = queryToVector(queryText, tfIdfIndex);
  }

  // Score all documents
  const scored: Array<{ engineerId: string; score: number; tfidfMatchingTerms: string[] }> = [];

  for (const [engineerId, docVector] of tfIdfIndex.documentIdToVector) {
    // Skip self-match for similarity search
    if (request.similarToEngineerId && engineerId === request.similarToEngineerId) {
      continue;
    }

    const score = cosineSimilarity(queryVector, docVector);
    if (score > 0) {
      const matching = getTopMatchingTerms(queryVector, docVector, 5);
      scored.push({
        engineerId,
        score,
        tfidfMatchingTerms: matching.map((m) => m.term),
      });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Apply pagination
  const totalCount = scored.length;
  const paginatedResults = scored.slice(request.offset, request.offset + request.limit);

  // Load engineer details
  const engineerIds = paginatedResults.map((r) => r.engineerId);
  const engineerInfoMap = await loadEngineerInfo(session, engineerIds);

  // Build response
  const matches = paginatedResults
    .filter((result) => engineerInfoMap.has(result.engineerId))
    .map((result) => {
      const engineer = engineerInfoMap.get(result.engineerId)!;
      return {
        id: engineer.id,
        name: engineer.name,
        headline: engineer.headline,
        salary: engineer.salary,
        yearsExperience: engineer.yearsExperience,
        timezone: engineer.timezone,
        contentScore: result.score,
        contentScoreBreakdown: {
          tfidfScore: result.score,
          tfidfMatchingTerms: result.tfidfMatchingTerms,
        },
      };
    });

  const executionTimeMs = Date.now() - startTime;

  return {
    matches,
    totalCount,
    searchMethod: "tfidf",
    queryMetadata: {
      executionTimeMs,
      documentsSearched: tfIdfIndex.totalDocuments,
      queryTerms: queryVector.terms.slice(0, 10),  // Top query terms
    },
  };
}

/*
 * Weight for profile embedding vs skill embedding in combined score.
 * Profile embedding captures overall experience/seniority; skill embedding captures technical fit.
 * Equal weighting treats both signals as equally valuable for technical role matching.
 */
const PROFILE_EMBEDDING_WEIGHT = 0.5;
const SKILL_EMBEDDING_WEIGHT = 0.5;

/*
 * Execute embedding-based semantic similarity search.
 *
 * Uses dense embeddings generated by the LLM service and stored in Neo4j.
 * Queries are embedded at search time and matched via vector similarity.
 *
 * When searching for engineers similar to a target engineer, also computes
 * skill embedding similarity and combines scores for re-ranking.
 */
async function executeEmbeddingSearch(
  session: Session,
  request: ContentSearchRequest
): Promise<ContentSearchResponse> {
  const startTime = Date.now();

  let similarEngineers: Array<{ engineerId: string; score: number }>;
  let targetEngineerId: string | undefined;

  /*
   * Fetch more candidates than needed for re-ranking.
   * Re-ranking may promote candidates that were initially lower-ranked by profile
   * embedding but have high skill similarity. We fetch extra to ensure good coverage.
   */
  const candidatePoolSize = Math.max((request.limit + request.offset) * 2, 50);

  if (request.similarToEngineerId) {
    targetEngineerId = request.similarToEngineerId;
    similarEngineers = await findSimilarToEngineer(
      session,
      request.similarToEngineerId,
      candidatePoolSize
    );
  } else {
    const queryEmbedding = await generateEmbedding(request.queryText!);
    if (!queryEmbedding) {
      throw new Error("Failed to generate embedding for query. LLM may be unavailable.");
    }
    similarEngineers = await findSimilarByEmbedding(
      session,
      queryEmbedding,
      candidatePoolSize
    );
  }

  // Compute skill similarity for ALL candidates (before re-ranking)
  const allEngineerIds = similarEngineers.map((r) => r.engineerId);
  let skillSimilarityMap = new Map<string, SkillSetSimilarityResult>();
  if (targetEngineerId) {
    skillSimilarityMap = await computeSkillSimilarityForCandidates(
      session,
      targetEngineerId,
      allEngineerIds
    );
  }

  // Combine scores and re-rank
  const rerankedEngineers = similarEngineers
    .map((engineer) => {
      const skillSimilarity = skillSimilarityMap.get(engineer.engineerId);
      const skillScore = skillSimilarity?.skills.score ?? 0;

      // Combined score: weighted average of profile embedding and skill similarity
      const combinedScore = targetEngineerId
        ? PROFILE_EMBEDDING_WEIGHT * engineer.score + SKILL_EMBEDDING_WEIGHT * skillScore
        : engineer.score; // No skill re-ranking for text queries (no target engineer)

      return {
        engineerId: engineer.engineerId,
        profileEmbeddingScore: engineer.score,
        skillSimilarity,
        combinedScore,
      };
    })
    .sort((a, b) => b.combinedScore - a.combinedScore);

  // Apply pagination after re-ranking
  const totalCount = rerankedEngineers.length;
  const paginatedResults = rerankedEngineers.slice(request.offset, request.offset + request.limit);

  // Load engineer details
  const engineerIds = paginatedResults.map((r) => r.engineerId);
  const engineerInfoMap = await loadEngineerInfo(session, engineerIds);

  // Build response
  const matches = paginatedResults
    .filter((result) => engineerInfoMap.has(result.engineerId))
    .map((result) => {
      const engineer = engineerInfoMap.get(result.engineerId)!;

      return {
        id: engineer.id,
        name: engineer.name,
        headline: engineer.headline,
        salary: engineer.salary,
        yearsExperience: engineer.yearsExperience,
        timezone: engineer.timezone,
        contentScore: result.combinedScore,
        contentScoreBreakdown: {
          profileEmbeddingScore: result.profileEmbeddingScore,
          skillEmbeddingSimilarity: result.skillSimilarity?.skills.score ?? 0,
          recentSkillEmbeddingSimilarity: result.skillSimilarity?.recentSkills.score ?? 0,
          skillCount: result.skillSimilarity?.skills.count ?? 0,
          recentSkillCount: result.skillSimilarity?.recentSkills.count ?? 0,
        },
      };
    });

  const executionTimeMs = Date.now() - startTime;

  return {
    matches,
    totalCount,
    searchMethod: "embedding",
    queryMetadata: {
      executionTimeMs,
      documentsSearched: similarEngineers.length,
      queryTerms: [],
    },
  };
}

/*
 * Hybrid search: Boolean filter → Embedding ranking → TF-IDF explainability.
 *
 * Architecture rationale:
 * - Boolean filter guarantees required keywords are present (precision)
 * - Embedding ranking on ALL filtered candidates via HNSW (semantic quality)
 * - TF-IDF matching terms computed post-ranking for display only (explainability)
 *
 * We deliberately do NOT use TF-IDF to narrow candidates before embedding ranking.
 * TF-IDF filtering would penalize senior engineers who write concise resumes with
 * fewer keyword repetitions, potentially excluding them before embeddings get a
 * chance to recognize their experience depth. With HNSW's O(log n) performance,
 * the time savings (~10-20ms) don't justify this risk.
 */
async function executeHybridSearch(
  session: Session,
  request: ContentSearchRequest
): Promise<ContentSearchResponse> {
  const startTime = Date.now();

  // Get query text and determine if this is a similarity search
  let queryText: string;
  let targetEngineerId: string | undefined;

  if (request.similarToEngineerId) {
    targetEngineerId = request.similarToEngineerId;

    /*
     * For similarity search, we need both the embedding (for ranking) and
     * some text representation (for TF-IDF explainability). We use the
     * target engineer's top TF-IDF terms as a proxy for "what they're about".
     */
    const tfIdfIndex = await getTfIdfIndex(session);
    const targetVector = tfIdfIndex.documentIdToVector.get(targetEngineerId);
    if (!targetVector) {
      throw new Error(`Engineer not found in index: ${targetEngineerId}`);
    }
    queryText = targetVector.terms.slice(0, 50).join(" ");
  } else {
    queryText = request.queryText!;
  }

  /*
   * Stage 1: Boolean filter (guarantees required keywords are present)
   *
   * The caller specifies required terms via request.requiredTerms (e.g., ["react", "kafka"]).
   * Only engineers whose profiles contain ALL required terms pass this filter.
   * If no required terms are specified, all engineers are candidates.
   */
  const requiredTerms = request.requiredTerms ?? [];
  const invertedIndex = await getInvertedIndex(session);
  let candidateIds: Set<string>;

  if (requiredTerms.length > 0) {
    candidateIds = booleanFilter(requiredTerms, invertedIndex);
  } else {
    // No required terms - all engineers are candidates
    candidateIds = new Set(invertedIndex.allEngineerIds);
  }

  // Exclude self for similarity search
  if (targetEngineerId) {
    candidateIds.delete(targetEngineerId);
  }

  const candidatesAfterBooleanFilter = candidateIds.size;

  // Early exit if no candidates match the boolean filter
  if (candidateIds.size === 0) {
    const executionTimeMs = Date.now() - startTime;
    return {
      matches: [],
      totalCount: 0,
      searchMethod: "hybrid",
      queryMetadata: {
        executionTimeMs,
        documentsSearched: 0,
        requiredTerms,
        candidatesAfterBooleanFilter: 0,
      },
    };
  }

  /*
   * Stage 2: Embedding ranking on ALL boolean-filtered candidates
   *
   * We use Neo4j's HNSW vector index which provides O(log n) approximate
   * nearest neighbor search. This means searching 2,000 candidates takes
   * only ~10-20ms more than searching 100 candidates.
   *
   * By ranking ALL filtered candidates, we ensure that senior engineers
   * with concise, impactful resumes aren't excluded just because they
   * mention keywords fewer times than keyword-stuffed junior resumes.
   */
  let queryEmbedding: number[];

  if (targetEngineerId) {
    // For similarity search, use the target engineer's embedding
    const targetEmbedding = await getEngineerEmbedding(session, targetEngineerId);
    if (!targetEmbedding) {
      throw new Error(`Engineer embedding not found: ${targetEngineerId}`);
    }
    queryEmbedding = targetEmbedding;
  } else {
    // For text query, generate embedding
    const embedding = await generateEmbedding(queryText);
    if (!embedding) {
      throw new Error("Failed to generate embedding for query. LLM may be unavailable.");
    }
    queryEmbedding = embedding;
  }

  /*
   * Fetch more candidates for potential re-ranking with skill similarity.
   */
  const candidatePoolSize = Math.max((request.limit + request.offset) * 2, 50);

  // Use HNSW index to rank ALL candidates by semantic similarity
  // The candidateIds filter is applied within the vector search
  const embeddingResults = await findSimilarByEmbeddingWithFilter(
    session,
    queryEmbedding,
    candidatePoolSize,
    candidateIds,
    targetEngineerId
  );

  // Compute skill similarity for ALL candidates (before re-ranking)
  const allEngineerIds = embeddingResults.map((r) => r.engineerId);
  let skillSimilarityMap = new Map<string, SkillSetSimilarityResult>();
  if (targetEngineerId) {
    skillSimilarityMap = await computeSkillSimilarityForCandidates(
      session,
      targetEngineerId,
      allEngineerIds
    );
  }

  // Combine scores and re-rank
  const rerankedEngineers = embeddingResults
    .map((engineer) => {
      const skillSimilarity = skillSimilarityMap.get(engineer.engineerId);
      const skillScore = skillSimilarity?.skills.score ?? 0;

      // Combined score: weighted average of profile embedding and skill similarity
      const combinedScore = targetEngineerId
        ? PROFILE_EMBEDDING_WEIGHT * engineer.score + SKILL_EMBEDDING_WEIGHT * skillScore
        : engineer.score;

      return {
        engineerId: engineer.engineerId,
        profileEmbeddingScore: engineer.score,
        skillSimilarity,
        combinedScore,
      };
    })
    .sort((a, b) => b.combinedScore - a.combinedScore);

  // Apply pagination after re-ranking
  const totalCount = rerankedEngineers.length;
  const paginatedResults = rerankedEngineers.slice(request.offset, request.offset + request.limit);

  // Load engineer details
  const engineerIds = paginatedResults.map((r) => r.engineerId);
  const engineerInfoMap = await loadEngineerInfo(session, engineerIds);

  /*
   * Stage 3: TF-IDF matching terms for explainability (display only)
   *
   * TF-IDF is computed AFTER ranking, only for the results we're returning.
   * This gives us interpretable "Matched: react, kafka, distributed" without
   * affecting which candidates are considered or how they're ranked.
   */
  const tfIdfIndex = await getTfIdfIndex(session);
  const queryVector = queryToVector(queryText, tfIdfIndex);

  // Build response
  const matches = paginatedResults
    .filter((result) => engineerInfoMap.has(result.engineerId))
    .map((result) => {
      const engineer = engineerInfoMap.get(result.engineerId)!;
      const docVector = tfIdfIndex.documentIdToVector.get(result.engineerId);

      // Extract matching terms for explainability
      const matchingTerms = docVector
        ? getTopMatchingTerms(queryVector, docVector, 5).map((m) => m.term)
        : [];

      return {
        id: engineer.id,
        name: engineer.name,
        headline: engineer.headline,
        salary: engineer.salary,
        yearsExperience: engineer.yearsExperience,
        timezone: engineer.timezone,
        contentScore: result.combinedScore,
        contentScoreBreakdown: {
          profileEmbeddingScore: result.profileEmbeddingScore,
          tfidfMatchingTerms: matchingTerms,
          skillEmbeddingSimilarity: result.skillSimilarity?.skills.score ?? 0,
          recentSkillEmbeddingSimilarity: result.skillSimilarity?.recentSkills.score ?? 0,
          skillCount: result.skillSimilarity?.skills.count ?? 0,
          recentSkillCount: result.skillSimilarity?.recentSkills.count ?? 0,
        },
      };
    });

  const executionTimeMs = Date.now() - startTime;

  return {
    matches,
    totalCount,
    searchMethod: "hybrid",
    queryMetadata: {
      executionTimeMs,
      documentsSearched: candidatesAfterBooleanFilter,
      requiredTerms, // Echo back the boolean filter terms that were applied
      candidatesAfterBooleanFilter,
    },
  };
}
