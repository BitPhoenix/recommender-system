import { Session } from "neo4j-driver";
import { tokenize, NORMALIZATION_STRATEGY } from "./text-normalizer.service.js";
import { loadEngineerTextContent, concatenateEngineerText } from "./engineer-text-loader.service.js";

/*
 * =============================================================================
 * TYPES
 * =============================================================================
 */

export interface InvertedIndex {
  postings: Map<string, Set<string>>; // term → set of engineerIds
  allEngineerIds: Set<string>; // All engineers in the index
}

// In-memory index (rebuilt on startup, updated on resume upload)
let invertedIndex: InvertedIndex | null = null;

/*
 * =============================================================================
 * INDEX BUILDING
 * =============================================================================
 */

/*
 * Build an inverted index mapping each token to the set of engineers whose
 * profiles contain that token.
 *
 * Structure:
 *   "react"  → { engineer_1, engineer_5, engineer_12, ... }
 *   "kafka"  → { engineer_5, engineer_8, engineer_12, ... }
 *   "python" → { engineer_2, engineer_5, engineer_9, ... }
 *
 * This enables fast boolean filtering. For a query like "React AND Kafka":
 *   1. Look up "react" → { engineer_1, engineer_5, engineer_12 }
 *   2. Look up "kafka" → { engineer_5, engineer_8, engineer_12 }
 *   3. Intersect the sets → { engineer_5, engineer_12 }
 *
 * Set intersection is O(min(m, n)) where m and n are the set sizes, making
 * boolean queries very fast regardless of corpus size. This guarantees that
 * all results contain the required keywords before we run expensive embedding
 * similarity.
 */
export async function buildInvertedIndex(session: Session): Promise<InvertedIndex> {
  const contents = await loadEngineerTextContent(session);

  const postings = new Map<string, Set<string>>();
  const allEngineerIds = new Set<string>();

  for (const content of contents) {
    const combinedText = concatenateEngineerText(content);
    const tokens = tokenize(combinedText, NORMALIZATION_STRATEGY);
    const uniqueTokens = new Set(tokens);

    allEngineerIds.add(content.engineerId);

    for (const token of uniqueTokens) {
      if (!postings.has(token)) {
        postings.set(token, new Set());
      }
      postings.get(token)!.add(content.engineerId);
    }
  }

  invertedIndex = { postings, allEngineerIds };
  console.log(
    `[InvertedIndex] Built index with ${postings.size} terms, ` +
    `${allEngineerIds.size} engineers`
  );

  return invertedIndex;
}

/*
 * Get the current inverted index, building it if necessary.
 */
export async function getInvertedIndex(session: Session): Promise<InvertedIndex> {
  if (!invertedIndex) {
    return buildInvertedIndex(session);
  }
  return invertedIndex;
}

/*
 * Update the inverted index after a new or updated engineer document.
 *
 * Currently rebuilds the entire index for simplicity. This is acceptable because:
 * 1. Corpus is small (hundreds of engineers)
 * 2. Resume uploads are infrequent
 * 3. Rebuild is fast at this scale
 */
export async function updateInvertedIndex(session: Session): Promise<void> {
  await buildInvertedIndex(session);
}

/*
 * Reset the index (for testing).
 */
export function resetInvertedIndex(): void {
  invertedIndex = null;
}

/*
 * =============================================================================
 * BOOLEAN FILTERING
 * =============================================================================
 */

/*
 * Boolean AND filter - returns engineers containing ALL required terms.
 *
 * For ["react", "kafka"], this intersects the posting lists:
 *   postings["react"] ∩ postings["kafka"] → engineers with BOTH terms
 *
 * If any term has no posting list (not in any engineer's profile), the
 * result is empty—no engineer can satisfy a requirement for a term that
 * doesn't exist in the corpus.
 */
export function booleanFilter(
  requiredTerms: string[],
  index: InvertedIndex
): Set<string> {
  if (requiredTerms.length === 0) {
    // No required terms - return all engineer IDs in the index
    return new Set(index.allEngineerIds);
  }

  let matchingEngineerIds: Set<string> | null = null;

  for (const term of requiredTerms) {
    // Normalize the term the same way we normalize document text
    const normalizedTerms = tokenize(term, NORMALIZATION_STRATEGY);

    /*
     * A multi-word term like "machine learning" becomes ["machinelearning"]
     * after phrase replacement. A simple term like "react" stays ["react"].
     * We require ALL resulting tokens to be present.
     */
    for (const normalizedTerm of normalizedTerms) {
      const engineerIdsWithTerm = index.postings.get(normalizedTerm);

      if (!engineerIdsWithTerm || engineerIdsWithTerm.size === 0) {
        // Term not in any engineer's profile - no engineer can match
        return new Set();
      }

      if (matchingEngineerIds === null) {
        // First term: start with all engineers who have this term
        matchingEngineerIds = new Set(engineerIdsWithTerm);
      } else {
        // Subsequent terms: intersect to keep only engineers with ALL terms
        matchingEngineerIds = setIntersection(matchingEngineerIds, engineerIdsWithTerm);
      }

      if (matchingEngineerIds.size === 0) {
        return matchingEngineerIds;
      }
    }
  }

  return matchingEngineerIds || new Set();
}

/*
 * Set intersection helper for compatibility with older Node.js versions.
 */
function setIntersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const item of setA) {
    if (setB.has(item)) {
      result.add(item);
    }
  }
  return result;
}
