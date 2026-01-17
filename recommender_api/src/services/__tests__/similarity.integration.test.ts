import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import driver from '../../neo4j.js';
import { findSimilarEngineers } from '../similarity.service.js';
import { loadSkillGraph, loadDomainGraph } from '../similarity-calculator/index.js';
import type { Session } from 'neo4j-driver';

/*
 * Integration tests that hit real Neo4j.
 * These tests require Tilt to be running with a seeded database.
 *
 * Tests are skipped if Neo4j is not available.
 */

describe('Similarity Integration Tests', () => {
  let neo4jAvailable = false;
  let session: Session;

  beforeAll(async () => {
    try {
      session = driver.session();
      await session.run('RETURN 1');
      neo4jAvailable = true;
    } catch {
      console.warn('[Similarity Integration Tests] Neo4j not available - tests will be skipped');
    }
  });

  afterAll(async () => {
    if (session) {
      await session.close();
    }
  });

  describe('loadSkillGraph', () => {
    it('loads skill nodes with correlations', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const graph = await loadSkillGraph(testSession);

        expect(graph.nodes).toBeInstanceOf(Map);
        expect(graph.nodes.size).toBeGreaterThan(0);

        // Check that nodes have expected structure
        const firstNode = graph.nodes.values().next().value;
        expect(firstNode).toBeDefined();
        if (firstNode) {
          expect(firstNode).toHaveProperty('skillId');
          expect(firstNode).toHaveProperty('correlations');
          expect(Array.isArray(firstNode.correlations)).toBe(true);
        }
      } finally {
        await testSession.close();
      }
    });

    it('filters correlations by minimum strength', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const graph = await loadSkillGraph(testSession);

        // All correlations should be >= minCorrelationStrength (0.7)
        for (const node of graph.nodes.values()) {
          for (const corr of node.correlations) {
            expect(corr.strength).toBeGreaterThanOrEqual(0.7);
          }
        }
      } finally {
        await testSession.close();
      }
    });
  });

  describe('loadDomainGraph', () => {
    it('loads business and technical domains', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const graph = await loadDomainGraph(testSession);

        expect(graph.businessDomains).toBeInstanceOf(Map);
        expect(graph.technicalDomains).toBeInstanceOf(Map);

        // Should have some domains
        expect(graph.businessDomains.size + graph.technicalDomains.size).toBeGreaterThan(0);
      } finally {
        await testSession.close();
      }
    });

    it('loads domain hierarchy (parentId)', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const graph = await loadDomainGraph(testSession);

        // Check structure of domain nodes
        const allDomains = [
          ...graph.businessDomains.values(),
          ...graph.technicalDomains.values(),
        ];

        for (const domain of allDomains) {
          expect(domain).toHaveProperty('domainId');
          expect(domain).toHaveProperty('parentId');
          expect(domain).toHaveProperty('encompassedBy');
        }
      } finally {
        await testSession.close();
      }
    });
  });

  describe('findSimilarEngineers', () => {
    it('returns similar engineers for known engineer', { timeout: 15000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await findSimilarEngineers(testSession, 'eng_priya', 5);

        expect(result.target).toBeDefined();
        expect(result.target.id).toBe('eng_priya');
        expect(result.target.name).toBe('Priya Sharma');
        expect(result.similar).toBeInstanceOf(Array);
        expect(result.similar.length).toBeLessThanOrEqual(5);
      } finally {
        await testSession.close();
      }
    });

    it('excludes target from similar results', { timeout: 15000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await findSimilarEngineers(testSession, 'eng_marcus', 10);

        const similarIds = result.similar.map(r => r.engineer.id);
        expect(similarIds).not.toContain('eng_marcus');
      } finally {
        await testSession.close();
      }
    });

    it('first result has highest similarity score (diversity reorders others)', { timeout: 15000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await findSimilarEngineers(testSession, 'eng_sofia', 5);

        // Diversity selector may reorder results, but first should have highest score
        if (result.similar.length > 1) {
          const firstScore = result.similar[0].similarityScore;
          const maxScore = Math.max(...result.similar.map(r => r.similarityScore));
          expect(firstScore).toBe(maxScore);
        }
      } finally {
        await testSession.close();
      }
    });

    it('includes breakdown scores between 0 and 1', { timeout: 15000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await findSimilarEngineers(testSession, 'eng_james', 5);

        for (const similar of result.similar) {
          expect(similar.breakdown.skills).toBeGreaterThanOrEqual(0);
          expect(similar.breakdown.skills).toBeLessThanOrEqual(1);
          expect(similar.breakdown.yearsExperience).toBeGreaterThanOrEqual(0);
          expect(similar.breakdown.yearsExperience).toBeLessThanOrEqual(1);
          expect(similar.breakdown.domain).toBeGreaterThanOrEqual(0);
          expect(similar.breakdown.domain).toBeLessThanOrEqual(1);
          expect(similar.breakdown.timezone).toBeGreaterThanOrEqual(0);
          expect(similar.breakdown.timezone).toBeLessThanOrEqual(1);
        }
      } finally {
        await testSession.close();
      }
    });

    it('throws error for non-existent engineer', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        await expect(findSimilarEngineers(testSession, 'nonexistent_id', 5))
          .rejects
          .toThrow('Engineer not found: nonexistent_id');
      } finally {
        await testSession.close();
      }
    });

    it('respects limit parameter', { timeout: 15000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await findSimilarEngineers(testSession, 'eng_emily', 3);

        expect(result.similar.length).toBeLessThanOrEqual(3);
      } finally {
        await testSession.close();
      }
    });

    it('populates sharedSkills for similar engineers', { timeout: 15000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await findSimilarEngineers(testSession, 'eng_priya', 10);

        // At least one result should have shared skills
        const hasSharedSkills = result.similar.some(r => r.sharedSkills.length > 0);
        expect(hasSharedSkills).toBe(true);
      } finally {
        await testSession.close();
      }
    });

    it('completes within performance threshold', { timeout: 15000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const startTime = Date.now();
        await findSimilarEngineers(testSession, 'eng_priya', 5);
        const duration = Date.now() - startTime;

        // Should complete within 2 seconds for ~40 engineers
        expect(duration).toBeLessThan(2000);
      } finally {
        await testSession.close();
      }
    });
  });
});
