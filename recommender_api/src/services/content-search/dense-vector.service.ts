/*
 * Dense vector utilities for embedding operations.
 *
 * Complements sparse-vector.service.ts which handles TF-IDF vectors.
 */

/*
 * Compute cosine similarity between two dense vectors.
 *
 * Returns value in range [-1, 1], where:
 * - 1.0 = identical direction
 * - 0.0 = orthogonal (unrelated)
 * - -1.0 = opposite direction (rare for embeddings)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same dimensions");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/*
 * Compute the centroid (mean) of a set of vectors.
 *
 * The centroid is the element-wise average - the "center point"
 * that represents the entire set. See thoughts/shared/2_chapter_4/
 * 0_foundational_info/6_centroids/centroids.md for details.
 */
export function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    throw new Error("Cannot compute centroid of empty vector set");
  }

  const dimensions = vectors[0].length;
  const centroid = new Array(dimensions).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += vector[i];
    }
  }

  for (let i = 0; i < dimensions; i++) {
    centroid[i] /= vectors.length;
  }

  return centroid;
}
