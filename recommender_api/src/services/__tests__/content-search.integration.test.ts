import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import driver from '../../neo4j.js';
import type { Session } from 'neo4j-driver';
import { executeContentSearch } from '../content-search/content-search.service.js';
import { resetTfIdfIndex } from '../content-search/tfidf-index-manager.service.js';

/*
 * Integration tests for content search functionality.
 * These tests require Tilt to be running with a seeded database.
 *
 * Tests are skipped if Neo4j is not available.
 */
describe('Content Search Integration Tests', () => {
  let neo4jAvailable = false;
  let session: Session;

  beforeAll(async () => {
    try {
      session = driver.session();
      await session.run('RETURN 1');
      neo4jAvailable = true;
      // Reset the index so tests start fresh
      resetTfIdfIndex();
    } catch {
      console.warn('[Content Search Integration Tests] Neo4j not available - tests will be skipped');
    }
  });

  afterAll(async () => {
    if (session) {
      await session.close();
    }
    resetTfIdfIndex();
  });

  describe('executeContentSearch', () => {
    describe('keyword search', () => {
      it('finds engineers matching query keywords', { timeout: 15000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const response = await executeContentSearch(testSession, {
            queryText: 'React TypeScript frontend',
            limit: 10,
            offset: 0,
          });

          // Should find at least one match
          expect(response.matches.length).toBeGreaterThan(0);
          expect(response.totalCount).toBeGreaterThan(0);
          expect(response.searchMethod).toBe('tfidf');
        } finally {
          await testSession.close();
        }
      });

      it('returns results ranked by TF-IDF relevance', { timeout: 15000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const response = await executeContentSearch(testSession, {
            queryText: 'Python Django backend',
            limit: 10,
            offset: 0,
          });

          // Results should be sorted by score descending
          for (let i = 1; i < response.matches.length; i++) {
            expect(response.matches[i - 1].contentScore).toBeGreaterThanOrEqual(
              response.matches[i].contentScore
            );
          }
        } finally {
          await testSession.close();
        }
      });

      it('returns matching terms for each result', { timeout: 15000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const response = await executeContentSearch(testSession, {
            queryText: 'Kubernetes Docker DevOps',
            limit: 10,
            offset: 0,
          });

          // Each match should have matching terms
          for (const match of response.matches) {
            expect(match.contentScoreBreakdown).toBeDefined();
            expect(match.contentScoreBreakdown.tfidfMatchingTerms).toBeInstanceOf(Array);
            expect(match.contentScoreBreakdown.tfidfMatchingTerms!.length).toBeGreaterThan(0);
          }
        } finally {
          await testSession.close();
        }
      });

      it('handles queries with no matches (empty results)', { timeout: 15000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const response = await executeContentSearch(testSession, {
            queryText: 'xyzzynonexistentskillzzzz',
            limit: 10,
            offset: 0,
          });

          // Should return empty results, not error
          expect(response.matches).toEqual([]);
          expect(response.totalCount).toBe(0);
        } finally {
          await testSession.close();
        }
      });

      it('returns query metadata', { timeout: 15000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const response = await executeContentSearch(testSession, {
            queryText: 'JavaScript Node.js',
            limit: 10,
            offset: 0,
          });

          expect(response.queryMetadata).toBeDefined();
          expect(response.queryMetadata.executionTimeMs).toBeGreaterThanOrEqual(0);
          expect(response.queryMetadata.documentsSearched).toBeGreaterThan(0);
          expect(response.queryMetadata.queryTerms).toBeInstanceOf(Array);
        } finally {
          await testSession.close();
        }
      });
    });

    describe('similarity search', () => {
      it('similarToEngineerId finds engineers similar to given engineer', { timeout: 15000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const response = await executeContentSearch(testSession, {
            similarToEngineerId: 'eng_priya',
            limit: 5,
            offset: 0,
          });

          // Should find similar engineers
          expect(response.matches.length).toBeGreaterThan(0);

          // Should not include the target engineer in results
          const matchIds = response.matches.map((m) => m.id);
          expect(matchIds).not.toContain('eng_priya');
        } finally {
          await testSession.close();
        }
      });

      it('throws error for non-existent engineer', { timeout: 15000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          await expect(
            executeContentSearch(testSession, {
              similarToEngineerId: 'nonexistent_engineer_id',
              limit: 5,
              offset: 0,
            })
          ).rejects.toThrow('Engineer not found in index');
        } finally {
          await testSession.close();
        }
      });
    });

    describe('pagination', () => {
      it('respects limit parameter', { timeout: 15000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const response = await executeContentSearch(testSession, {
            queryText: 'software engineer developer',
            limit: 3,
            offset: 0,
          });

          expect(response.matches.length).toBeLessThanOrEqual(3);
        } finally {
          await testSession.close();
        }
      });

      it('respects offset parameter', { timeout: 15000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          // Get first page
          const firstPage = await executeContentSearch(testSession, {
            queryText: 'software engineer',
            limit: 2,
            offset: 0,
          });

          // Get second page
          const secondPage = await executeContentSearch(testSession, {
            queryText: 'software engineer',
            limit: 2,
            offset: 2,
          });

          // Pages should have different results (if there are enough results)
          if (firstPage.totalCount > 2) {
            const firstIds = firstPage.matches.map((m) => m.id);
            const secondIds = secondPage.matches.map((m) => m.id);
            expect(firstIds).not.toEqual(secondIds);
          }
        } finally {
          await testSession.close();
        }
      });
    });

    describe('ranking behavior', () => {
      it('ranks engineers with more keyword matches higher', { timeout: 15000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const response = await executeContentSearch(testSession, {
            queryText: 'Python Django backend API',
            limit: 10,
            offset: 0,
          });

          /*
           * Engineers matching all 4 terms should rank higher than engineers
           * matching only 2-3 terms. We verify this by checking that the top
           * result matches more terms than lower-ranked results.
           */
          expect(response.matches.length).toBeGreaterThan(1);

          const topMatch = response.matches[0];
          const lastMatch = response.matches[response.matches.length - 1];

          // Top match should have more matching terms or equal (with higher weights)
          expect(topMatch.contentScoreBreakdown.tfidfMatchingTerms!.length).toBeGreaterThanOrEqual(
            lastMatch.contentScoreBreakdown.tfidfMatchingTerms!.length
          );

          // Top match must have higher score
          expect(topMatch.contentScore).toBeGreaterThan(lastMatch.contentScore);
        } finally {
          await testSession.close();
        }
      });

      it('boosts rare/discriminative terms more than common terms', { timeout: 15000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          /*
           * "Django" is a rare/discriminative term (few engineers have it).
           * "backend" and "api" are common terms (many engineers have them).
           * Engineers with "Django" should score higher than engineers with
           * only common terms, even if common-term engineers have the same
           * number of matching terms.
           */
          const response = await executeContentSearch(testSession, {
            queryText: 'Python Django backend API',
            limit: 20,
            offset: 0,
          });

          // Find engineers with Django vs engineers with only backend/api
          const engineersWithDjango = response.matches.filter((m) =>
            m.contentScoreBreakdown.tfidfMatchingTerms?.includes('django')
          );
          const engineersWithoutDjango = response.matches.filter(
            (m) => !m.contentScoreBreakdown.tfidfMatchingTerms?.includes('django')
          );

          // Skip if we don't have both types of engineers in results
          if (engineersWithDjango.length === 0 || engineersWithoutDjango.length === 0) {
            console.log('Skipping: Need engineers with and without Django for this test');
            return;
          }

          // The highest-scoring engineer with Django should beat the highest
          // scoring engineer without Django (IDF gives discriminative terms more weight)
          const topWithDjango = engineersWithDjango[0];
          const topWithoutDjango = engineersWithoutDjango[0];

          expect(topWithDjango.contentScore).toBeGreaterThan(topWithoutDjango.contentScore);
        } finally {
          await testSession.close();
        }
      });
    });

    describe('match fields', () => {
      it('returns all expected fields for each match', { timeout: 15000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const response = await executeContentSearch(testSession, {
            queryText: 'backend developer',
            limit: 5,
            offset: 0,
          });

          for (const match of response.matches) {
            expect(match.id).toBeDefined();
            expect(match.name).toBeDefined();
            expect(match.headline).toBeDefined();
            expect(typeof match.salary).toBe('number');
            expect(typeof match.yearsExperience).toBe('number');
            expect(match.timezone).toBeDefined();
            expect(typeof match.contentScore).toBe('number');
            expect(match.contentScore).toBeGreaterThan(0);
            expect(match.contentScore).toBeLessThanOrEqual(1);
          }
        } finally {
          await testSession.close();
        }
      });
    });

    describe('vector index', () => {
      it('engineer_embedding_index exists in Neo4j', { timeout: 10000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const result = await testSession.run(`
            SHOW INDEXES
            YIELD name, type
            WHERE name = 'engineer_embedding_index'
            RETURN name, type
          `);

          expect(result.records.length).toBe(1);
          expect(result.records[0].get('name')).toBe('engineer_embedding_index');
          expect(result.records[0].get('type')).toBe('VECTOR');
        } finally {
          await testSession.close();
        }
      });
    });

    describe('embedding search', () => {
      /*
       * Embedding search tests require:
       * 1. The embedding model to be available via Ollama
       * 2. Engineers to have embeddings generated
       *
       * These tests will skip gracefully if embeddings are not available.
       */
      it('finds engineers matching query semantics', { timeout: 30000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const response = await executeContentSearch(testSession, {
            queryText: 'Full stack developer with cloud experience',
            method: 'embedding',
            limit: 10,
            offset: 0,
          });

          // If no embeddings exist, this will error - check for valid results
          if (response.matches.length > 0) {
            expect(response.searchMethod).toBe('embedding');
            // Each match should have profile embedding score
            for (const match of response.matches) {
              expect(match.contentScoreBreakdown.profileEmbeddingScore).toBeDefined();
              expect(typeof match.contentScoreBreakdown.profileEmbeddingScore).toBe('number');
            }
          }
        } catch (error) {
          // Expected if no embeddings or LLM unavailable
          if (error instanceof Error && error.message.includes('embedding')) {
            console.log('Skipping: Embeddings not available');
            return;
          }
          throw error;
        } finally {
          await testSession.close();
        }
      });

      it('similarToEngineerId finds semantically similar engineers', { timeout: 30000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const response = await executeContentSearch(testSession, {
            similarToEngineerId: 'eng_priya',
            method: 'embedding',
            limit: 5,
            offset: 0,
          });

          if (response.matches.length > 0) {
            expect(response.searchMethod).toBe('embedding');
            // Should not include the target engineer
            const matchIds = response.matches.map((m) => m.id);
            expect(matchIds).not.toContain('eng_priya');
          }
        } catch (error) {
          // Expected if no embeddings
          if (error instanceof Error && error.message.includes('embedding')) {
            console.log('Skipping: Embeddings not available');
            return;
          }
          throw error;
        } finally {
          await testSession.close();
        }
      });

      it('returns results ranked by embedding similarity', { timeout: 30000 }, async () => {
        if (!neo4jAvailable) {
          console.log('Skipping: Neo4j not available');
          return;
        }

        const testSession = driver.session();
        try {
          const response = await executeContentSearch(testSession, {
            queryText: 'Machine learning data scientist Python',
            method: 'embedding',
            limit: 10,
            offset: 0,
          });

          if (response.matches.length > 1) {
            // Results should be sorted by score descending
            for (let i = 1; i < response.matches.length; i++) {
              expect(response.matches[i - 1].contentScore).toBeGreaterThanOrEqual(
                response.matches[i].contentScore
              );
            }
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('embedding')) {
            console.log('Skipping: Embeddings not available');
            return;
          }
          throw error;
        } finally {
          await testSession.close();
        }
      });
    });
  });
});
