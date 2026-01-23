import { describe, it, expect } from 'vitest';
import {
  buildTfIdfIndex,
  queryToVector,
  cosineSimilarity,
  type Document,
} from './tfidf-vectorizer.service.js';

describe('tfidf-vectorizer.service', () => {
  describe('buildTfIdfIndex', () => {
    describe('vocabulary building', () => {
      it('builds vocabulary from document corpus', () => {
        const documents: Document[] = [
          { id: 'doc1', text: 'react typescript frontend' },
          { id: 'doc2', text: 'python django backend' },
        ];

        const index = buildTfIdfIndex(documents);

        // Note: "react" stays as "react", not "reactjs" - only "React.js" -> "reactjs"
        expect(index.vocabulary.has('react')).toBe(true);
        expect(index.vocabulary.has('typescript')).toBe(true);
        expect(index.vocabulary.has('frontend')).toBe(true);
        expect(index.vocabulary.has('python')).toBe(true);
        expect(index.vocabulary.has('django')).toBe(true);
        expect(index.vocabulary.has('backend')).toBe(true);
      });

      it('excludes stopwords from vocabulary', () => {
        const documents: Document[] = [
          { id: 'doc1', text: 'the react framework is great' },
        ];

        const index = buildTfIdfIndex(documents);

        expect(index.vocabulary.has('the')).toBe(false);
        expect(index.vocabulary.has('is')).toBe(false);
        // Note: "react" stays as "react", not "reactjs"
        expect(index.vocabulary.has('react')).toBe(true);
        expect(index.vocabulary.has('framework')).toBe(true);
        expect(index.vocabulary.has('great')).toBe(true);
      });

      it('tracks total document count', () => {
        const documents: Document[] = [
          { id: 'doc1', text: 'react' },
          { id: 'doc2', text: 'python' },
          { id: 'doc3', text: 'java' },
        ];

        const index = buildTfIdfIndex(documents);

        expect(index.totalDocuments).toBe(3);
      });
    });

    describe('TF calculation', () => {
      it('calculates TF (term frequency) correctly', () => {
        // Document with one term appearing twice, another once
        const documents: Document[] = [
          { id: 'doc1', text: 'react react typescript' },
        ];

        const index = buildTfIdfIndex(documents);
        const vector = index.documentIdToVector.get('doc1')!;

        // Get weights for both terms (react stays as "react", not "reactjs")
        const reactIndex = vector.terms.indexOf('react');
        const tsIndex = vector.terms.indexOf('typescript');

        // React appears 2/3 times, typescript 1/3 times
        // Before normalization, TF(react) = 2/3, TF(typescript) = 1/3
        // So react's TF-IDF weight should be higher
        expect(vector.weights[reactIndex]).toBeGreaterThan(vector.weights[tsIndex]);
      });
    });

    describe('IDF calculation', () => {
      it('calculates IDF (inverse document frequency) with smoothing', () => {
        const documents: Document[] = [
          { id: 'doc1', text: 'react typescript' },
          { id: 'doc2', text: 'react python' },
          { id: 'doc3', text: 'java spring' },
        ];

        const index = buildTfIdfIndex(documents);

        // "react" appears in 2 docs, "typescript" in 1, "java" in 1
        // IDF formula: ln(N/(df+1)) + 1
        // IDF(react) = ln(3/3) + 1 = 1
        // IDF(typescript) = ln(3/2) + 1 ≈ 1.405

        const idfReact = index.termToIdf.get('react')!;
        const idfTypescript = index.termToIdf.get('typescript')!;

        // Rare terms should have higher IDF
        expect(idfTypescript).toBeGreaterThan(idfReact);
      });

      it('applies smoothing to prevent division by zero', () => {
        const documents: Document[] = [
          { id: 'doc1', text: 'rare unique term' },
        ];

        const index = buildTfIdfIndex(documents);

        // With smoothing, IDF should always be positive
        for (const idf of index.termToIdf.values()) {
          expect(idf).toBeGreaterThan(0);
        }
      });
    });

    describe('TF-IDF vector production', () => {
      it('produces correct TF-IDF weights', () => {
        const documents: Document[] = [
          { id: 'doc1', text: 'react typescript react' },
          { id: 'doc2', text: 'react python' },
        ];

        const index = buildTfIdfIndex(documents);
        const vector1 = index.documentIdToVector.get('doc1')!;

        // Vector should have non-zero weights
        expect(vector1.weights.length).toBeGreaterThan(0);

        // All weights should be positive
        for (const weight of vector1.weights) {
          expect(weight).toBeGreaterThan(0);
        }
      });

      it('normalizes document vectors to unit length', () => {
        const documents: Document[] = [
          { id: 'doc1', text: 'react typescript nodejs graphql' },
        ];

        const index = buildTfIdfIndex(documents);
        const vector = index.documentIdToVector.get('doc1')!;

        // Calculate magnitude
        const magnitude = Math.sqrt(
          vector.weights.reduce((sum, w) => sum + w * w, 0)
        );

        expect(magnitude).toBeCloseTo(1, 5);
      });

      it('creates vectors for all documents', () => {
        const documents: Document[] = [
          { id: 'doc1', text: 'react' },
          { id: 'doc2', text: 'python' },
          { id: 'doc3', text: 'java' },
        ];

        const index = buildTfIdfIndex(documents);

        expect(index.documentIdToVector.has('doc1')).toBe(true);
        expect(index.documentIdToVector.has('doc2')).toBe(true);
        expect(index.documentIdToVector.has('doc3')).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('handles empty document corpus', () => {
        const index = buildTfIdfIndex([]);

        expect(index.vocabulary.size).toBe(0);
        expect(index.totalDocuments).toBe(0);
        expect(index.documentIdToVector.size).toBe(0);
      });

      it('handles document with only stopwords', () => {
        const documents: Document[] = [
          { id: 'doc1', text: 'the and is was are' },
        ];

        const index = buildTfIdfIndex(documents);
        const vector = index.documentIdToVector.get('doc1')!;

        expect(vector.terms.length).toBe(0);
        expect(vector.weights.length).toBe(0);
      });
    });
  });

  describe('queryToVector', () => {
    it('converts query string to TF-IDF vector using corpus IDF', () => {
      const documents: Document[] = [
        { id: 'doc1', text: 'react typescript' },
        { id: 'doc2', text: 'python django' },
      ];

      const index = buildTfIdfIndex(documents);
      const queryVector = queryToVector('react developer', index);

      // "react" is in vocabulary (stays as "react", not "reactjs")
      expect(queryVector.terms).toContain('react');
    });

    it('handles unseen terms in query (not in vocabulary)', () => {
      const documents: Document[] = [
        { id: 'doc1', text: 'react typescript' },
      ];

      const index = buildTfIdfIndex(documents);
      const queryVector = queryToVector('react golang', index);

      // "react" is in vocabulary, "golang" is not
      expect(queryVector.terms).toContain('react');
      expect(queryVector.terms).not.toContain('golang');
    });

    it('normalizes query vector to unit length', () => {
      const documents: Document[] = [
        { id: 'doc1', text: 'react typescript nodejs python' },
      ];

      const index = buildTfIdfIndex(documents);
      const queryVector = queryToVector('react typescript', index);

      const magnitude = Math.sqrt(
        queryVector.weights.reduce((sum, w) => sum + w * w, 0)
      );

      expect(magnitude).toBeCloseTo(1, 5);
    });

    it('applies same tokenization as documents', () => {
      const documents: Document[] = [
        { id: 'doc1', text: 'Node.js React.js' },
      ];

      const index = buildTfIdfIndex(documents);
      const queryVector = queryToVector('nodejs reactjs', index);

      // Both should be normalized to same tokens
      expect(queryVector.terms).toContain('nodejs');
      expect(queryVector.terms).toContain('reactjs');
    });

    it('returns empty vector for query with only unknown terms', () => {
      const documents: Document[] = [
        { id: 'doc1', text: 'react typescript' },
      ];

      const index = buildTfIdfIndex(documents);
      const queryVector = queryToVector('golang rust', index);

      expect(queryVector.terms.length).toBe(0);
    });
  });

  describe('search relevance', () => {
    it('ranks documents by keyword relevance', () => {
      const documents: Document[] = [
        { id: 'react-expert', text: 'react typescript frontend react react' },
        { id: 'python-expert', text: 'python django backend machine learning' },
        { id: 'fullstack', text: 'react python nodejs typescript' },
      ];

      const index = buildTfIdfIndex(documents);
      const queryVector = queryToVector('react typescript frontend', index);

      const scores: Array<{ id: string; score: number }> = [];
      for (const [docId, docVector] of index.documentIdToVector) {
        scores.push({
          id: docId,
          score: cosineSimilarity(queryVector, docVector),
        });
      }

      scores.sort((a, b) => b.score - a.score);

      // React-expert should rank highest (most term overlap and frequency)
      expect(scores[0].id).toBe('react-expert');
      // Python-expert should rank lowest (least overlap)
      expect(scores[scores.length - 1].id).toBe('python-expert');
    });

    it('gives higher scores to documents with rare matching terms', () => {
      const documents: Document[] = [
        { id: 'common', text: 'javascript javascript javascript' },
        { id: 'rare', text: 'javascript webassembly' },
        { id: 'other', text: 'python python python' },
      ];

      const index = buildTfIdfIndex(documents);
      // Query for the rare term
      const queryVector = queryToVector('webassembly', index);

      const commonScore = cosineSimilarity(
        queryVector,
        index.documentIdToVector.get('common')!
      );
      const rareScore = cosineSimilarity(
        queryVector,
        index.documentIdToVector.get('rare')!
      );

      // Document with the rare term should score higher
      expect(rareScore).toBeGreaterThan(commonScore);
    });
  });
});
