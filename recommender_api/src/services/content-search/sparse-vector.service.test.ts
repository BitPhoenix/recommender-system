import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  l2Normalize,
  getTopMatchingTerms,
  type SparseVector,
} from './sparse-vector.service.js';

describe('sparse-vector.service', () => {
  describe('l2Normalize', () => {
    it('normalizes a sparse vector to unit length', () => {
      const vector: SparseVector = {
        terms: ['a', 'b'],
        weights: [3, 4],
      };

      l2Normalize(vector);

      // Magnitude should now be 1
      const magnitude = Math.sqrt(
        vector.weights.reduce((sum, w) => sum + w * w, 0)
      );
      expect(magnitude).toBeCloseTo(1, 5);

      // Original proportions preserved: 3/5 and 4/5
      expect(vector.weights[0]).toBeCloseTo(0.6, 5);
      expect(vector.weights[1]).toBeCloseTo(0.8, 5);
    });

    it('handles zero vector (no weights)', () => {
      const vector: SparseVector = {
        terms: [],
        weights: [],
      };

      l2Normalize(vector);

      expect(vector.weights).toEqual([]);
    });

    it('handles single term vector', () => {
      const vector: SparseVector = {
        terms: ['react'],
        weights: [5],
      };

      l2Normalize(vector);

      expect(vector.weights[0]).toBe(1);
    });
  });

  describe('cosineSimilarity', () => {
    it('calculates cosine similarity between two sparse vectors', () => {
      // Pre-normalized vectors for testing
      const a: SparseVector = {
        terms: ['react', 'typescript'],
        weights: [0.8, 0.6],
      };
      l2Normalize(a);

      const b: SparseVector = {
        terms: ['react', 'nodejs'],
        weights: [0.7, 0.9],
      };
      l2Normalize(b);

      const similarity = cosineSimilarity(a, b);

      // Only "react" overlaps, so similarity is: a[react] * b[react]
      // After normalization: (0.8/1.0) * (0.7/sqrt(0.49+0.81)) = 0.8 * 0.614 ≈ 0.49
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('returns 1.0 for identical vectors (similarity = 1.0)', () => {
      const vector: SparseVector = {
        terms: ['react', 'typescript', 'nodejs'],
        weights: [0.5, 0.5, 0.5],
      };
      l2Normalize(vector);

      // Compare vector to itself
      const similarity = cosineSimilarity(vector, vector);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('returns 0 for orthogonal vectors (no common terms)', () => {
      const a: SparseVector = {
        terms: ['react', 'typescript'],
        weights: [0.8, 0.6],
      };
      l2Normalize(a);

      const b: SparseVector = {
        terms: ['python', 'django'],
        weights: [0.7, 0.9],
      };
      l2Normalize(b);

      const similarity = cosineSimilarity(a, b);

      expect(similarity).toBe(0);
    });

    it('handles empty vector (zero vector)', () => {
      const a: SparseVector = {
        terms: [],
        weights: [],
      };

      const b: SparseVector = {
        terms: ['react'],
        weights: [1],
      };

      const similarity = cosineSimilarity(a, b);

      expect(similarity).toBe(0);
    });

    it('handles both vectors empty', () => {
      const a: SparseVector = { terms: [], weights: [] };
      const b: SparseVector = { terms: [], weights: [] };

      const similarity = cosineSimilarity(a, b);

      expect(similarity).toBe(0);
    });

    it('handles partial overlap correctly', () => {
      // Vectors with 50% overlap
      const a: SparseVector = {
        terms: ['react', 'typescript', 'graphql', 'apollo'],
        weights: [1, 1, 1, 1],
      };
      l2Normalize(a);

      const b: SparseVector = {
        terms: ['react', 'typescript', 'python', 'django'],
        weights: [1, 1, 1, 1],
      };
      l2Normalize(b);

      const similarity = cosineSimilarity(a, b);

      // Both normalized to unit length, 2 terms match out of 4 in each
      // Similarity = 2 * (1/2)^2 = 0.5
      expect(similarity).toBeCloseTo(0.5, 5);
    });
  });

  describe('getTopMatchingTerms', () => {
    it('returns matching terms with their weights', () => {
      const queryVector: SparseVector = {
        terms: ['react', 'typescript', 'python'],
        weights: [0.8, 0.6, 0.4],
      };

      const docVector: SparseVector = {
        terms: ['react', 'typescript', 'nodejs'],
        weights: [0.9, 0.5, 0.3],
      };

      const matches = getTopMatchingTerms(queryVector, docVector);

      expect(matches).toHaveLength(2);
      expect(matches[0].term).toBe('react');
      expect(matches[0].queryWeight).toBe(0.8);
      expect(matches[0].docWeight).toBe(0.9);
      expect(matches[1].term).toBe('typescript');
    });

    it('orders matches by contribution (queryWeight * docWeight)', () => {
      const queryVector: SparseVector = {
        terms: ['a', 'b', 'c'],
        weights: [0.1, 0.9, 0.5],
      };

      const docVector: SparseVector = {
        terms: ['a', 'b', 'c'],
        weights: [0.1, 0.9, 0.5],
      };

      const matches = getTopMatchingTerms(queryVector, docVector);

      // Contributions: a=0.01, b=0.81, c=0.25
      expect(matches[0].term).toBe('b'); // highest contribution
      expect(matches[1].term).toBe('c');
      expect(matches[2].term).toBe('a');
    });

    it('respects limit parameter', () => {
      const queryVector: SparseVector = {
        terms: ['a', 'b', 'c', 'd', 'e'],
        weights: [0.5, 0.5, 0.5, 0.5, 0.5],
      };

      const docVector: SparseVector = {
        terms: ['a', 'b', 'c', 'd', 'e'],
        weights: [0.5, 0.5, 0.5, 0.5, 0.5],
      };

      const matches = getTopMatchingTerms(queryVector, docVector, 3);

      expect(matches).toHaveLength(3);
    });

    it('returns empty array when no terms match', () => {
      const queryVector: SparseVector = {
        terms: ['react', 'typescript'],
        weights: [0.8, 0.6],
      };

      const docVector: SparseVector = {
        terms: ['python', 'django'],
        weights: [0.7, 0.9],
      };

      const matches = getTopMatchingTerms(queryVector, docVector);

      expect(matches).toEqual([]);
    });

    it('handles empty query vector', () => {
      const queryVector: SparseVector = { terms: [], weights: [] };
      const docVector: SparseVector = {
        terms: ['react'],
        weights: [1],
      };

      const matches = getTopMatchingTerms(queryVector, docVector);

      expect(matches).toEqual([]);
    });
  });
});
