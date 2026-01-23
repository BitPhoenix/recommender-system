import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import driver from '../../neo4j.js';
import type { Session } from 'neo4j-driver';
import { storeResume } from '../resume.service.js';

/*
 * Integration tests for resume upload functionality.
 * These tests require Tilt to be running with a seeded database.
 *
 * Tests are skipped if Neo4j is not available.
 */
describe('Resume Upload Integration Tests', () => {
  let neo4jAvailable = false;
  let session: Session;

  beforeAll(async () => {
    try {
      session = driver.session();
      await session.run('RETURN 1');
      neo4jAvailable = true;
    } catch {
      console.warn('[Resume Upload Integration Tests] Neo4j not available - tests will be skipped');
    }
  });

  afterAll(async () => {
    if (session) {
      await session.close();
    }
  });

  describe('storeResume', () => {
    it('stores resume text for an existing engineer', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const testResume = 'Test resume for integration testing. Software engineer with React and TypeScript experience.';

        // Store resume for a known engineer
        await storeResume(testSession, 'eng_james', testResume);

        // Verify the resume was stored
        const result = await testSession.run(`
          MATCH (e:Engineer {id: $engineerId})-[:HAS_RESUME]->(r:Resume)
          RETURN r.rawText AS rawText, r.processedAt AS processedAt
        `, { engineerId: 'eng_james' });

        expect(result.records.length).toBe(1);
        expect(result.records[0].get('rawText')).toBe(testResume);
        expect(result.records[0].get('processedAt')).toBeDefined();
      } finally {
        await testSession.close();
      }
    });

    it('updates existing resume when called again', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const firstResume = 'First version of resume';
        const secondResume = 'Updated resume with more experience';

        // Store first version
        await storeResume(testSession, 'eng_priya', firstResume);

        // Store second version
        await storeResume(testSession, 'eng_priya', secondResume);

        // Verify only one resume node exists and it has the updated text
        const countResult = await testSession.run(`
          MATCH (e:Engineer {id: $engineerId})-[:HAS_RESUME]->(r:Resume)
          RETURN count(r) AS resumeCount, r.rawText AS rawText
        `, { engineerId: 'eng_priya' });

        expect(countResult.records.length).toBe(1);
        expect(countResult.records[0].get('resumeCount').toNumber()).toBe(1);
        expect(countResult.records[0].get('rawText')).toBe(secondResume);
      } finally {
        await testSession.close();
      }
    });

    it('creates Resume node with required fields', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const testResume = 'Backend developer skilled in Python and Django';

        await storeResume(testSession, 'eng_marcus', testResume);

        // Verify Resume node has all required fields
        const result = await testSession.run(`
          MATCH (e:Engineer {id: $engineerId})-[:HAS_RESUME]->(r:Resume)
          RETURN r.id AS id, r.rawText AS rawText, r.engineerId AS engineerId, r.processedAt AS processedAt
        `, { engineerId: 'eng_marcus' });

        expect(result.records.length).toBe(1);
        const record = result.records[0];
        expect(record.get('id')).toBeDefined();
        expect(record.get('id')).toMatch(/^resume_/);
        expect(record.get('rawText')).toBe(testResume);
        expect(record.get('engineerId')).toBe('eng_marcus');
        expect(record.get('processedAt')).toBeDefined();
      } finally {
        await testSession.close();
      }
    });
  });

  describe('Resume retrieval', () => {
    it('can retrieve stored resume by engineer ID', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const testResume = 'Full stack developer with 5 years experience';
        await storeResume(testSession, 'eng_sofia', testResume);

        // Query the resume back
        const result = await testSession.run(`
          MATCH (e:Engineer {id: $engineerId})-[:HAS_RESUME]->(r:Resume)
          RETURN e.name AS engineerName, r.rawText AS resumeText
        `, { engineerId: 'eng_sofia' });

        expect(result.records.length).toBe(1);
        expect(result.records[0].get('engineerName')).toBe('Sofia Rodriguez');
        expect(result.records[0].get('resumeText')).toBe(testResume);
      } finally {
        await testSession.close();
      }
    });
  });
});
