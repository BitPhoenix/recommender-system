/*
 * =============================================================================
 * TYPES
 * =============================================================================
 */

export interface SparseVector {
  terms: string[];
  weights: number[];
}

export interface MatchingTerm {
  term: string;
  queryWeight: number;
  docWeight: number;
}

/*
 * =============================================================================
 * MAIN API
 * =============================================================================
 */

/*
 * Calculate cosine similarity between two sparse vectors.
 * Assumes vectors are already L2-normalized.
 */
export function cosineSimilarity(a: SparseVector, b: SparseVector): number {
  /*
   * Sparse vectors only store non-zero terms, so computing the dot product
   * requires finding the intersection of terms present in both vectors.
   *
   * Naive approach: For each term in a, scan all terms in b → O(n × m)
   * Map approach: Build a lookup map from b, then iterate a → O(n + m)
   *
   * Example with vectors:
   *   a: { terms: ["react", "typescript"], weights: [0.8, 0.6] }
   *   b: { terms: ["react", "nodejs"],     weights: [0.7, 0.9] }
   *
   * bTermToWeight = Map { "react" → 0.7, "nodejs" → 0.9 }
   *
   * Iterate a's terms:
   *   "react"      → found in map → 0.8 × 0.7 = 0.56
   *   "typescript" → not in map   → skip
   *
   * Result: 0.56 (only overlapping terms contribute)
   */
  const bTermToWeight = buildTermToWeightMap(b);
  return calculateDotProduct(a, bTermToWeight);
}

/*
 * Get the top matching terms between query and document for explainability.
 */
export function getTopMatchingTerms(
  queryVector: SparseVector,
  docVector: SparseVector,
  limit: number = 10
): MatchingTerm[] {
  const docTermToWeight = buildTermToWeightMap(docVector);
  const matches = findMatchingTermsWithContribution(queryVector, docTermToWeight);
  return sortAndLimitMatches(matches, limit);
}

/*
 * L2 normalize a sparse vector in place.
 */
export function l2Normalize(vector: SparseVector): SparseVector {
  const magnitude = calculateMagnitude(vector.weights);
  if (magnitude > 0) {
    for (let i = 0; i < vector.weights.length; i++) {
      vector.weights[i] /= magnitude;
    }
  }
  return vector;
}

/*
 * =============================================================================
 * HELPERS
 * =============================================================================
 */

function buildTermToWeightMap(vector: SparseVector): Map<string, number> {
  const termToWeight = new Map<string, number>();
  for (let i = 0; i < vector.terms.length; i++) {
    termToWeight.set(vector.terms[i], vector.weights[i]);
  }
  return termToWeight;
}

function calculateDotProduct(
  vector: SparseVector,
  otherTermToWeight: Map<string, number>
): number {
  let dotProduct = 0;
  for (let i = 0; i < vector.terms.length; i++) {
    const otherWeight = otherTermToWeight.get(vector.terms[i]);
    if (otherWeight !== undefined) {
      dotProduct += vector.weights[i] * otherWeight;
    }
  }
  return dotProduct;
}

function calculateMagnitude(weights: number[]): number {
  return Math.sqrt(weights.reduce((sum, w) => sum + w * w, 0));
}

interface MatchWithContribution extends MatchingTerm {
  contribution: number;
}

function findMatchingTermsWithContribution(
  queryVector: SparseVector,
  docTermToWeight: Map<string, number>
): MatchWithContribution[] {
  const matches: MatchWithContribution[] = [];

  for (let i = 0; i < queryVector.terms.length; i++) {
    const term = queryVector.terms[i];
    const docWeight = docTermToWeight.get(term);
    if (docWeight !== undefined) {
      matches.push({
        term,
        queryWeight: queryVector.weights[i],
        docWeight,
        contribution: queryVector.weights[i] * docWeight,
      });
    }
  }

  return matches;
}

function sortAndLimitMatches(
  matches: MatchWithContribution[],
  limit: number
): MatchingTerm[] {
  return matches
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, limit)
    .map(({ term, queryWeight, docWeight }) => ({ term, queryWeight, docWeight }));
}
