import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import driver from '../../neo4j.js';
import type { Session } from 'neo4j-driver';

/*
 * Integration tests for skill synonym seeding.
 * These tests require Tilt to be running with a seeded database.
 *
 * Tests are skipped if Neo4j is not available.
 */
describe('Seed Synonyms Integration Tests', () => {
  let neo4jAvailable = false;
  let session: Session;

  beforeAll(async () => {
    try {
      session = driver.session();
      await session.run('RETURN 1');
      neo4jAvailable = true;
    } catch {
      console.warn('[Seed Synonyms Integration Tests] Neo4j not available - tests will be skipped');
    }
  });

  afterAll(async () => {
    if (session) {
      await session.close();
    }
  });

  describe('SkillSynonym nodes', () => {
    it('skill synonyms seeded correctly with ALIAS_FOR relationships', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        // Check that synonyms exist and have ALIAS_FOR relationships
        const result = await testSession.run(`
          MATCH (syn:SkillSynonym)-[:ALIAS_FOR]->(skill:Skill)
          RETURN count(syn) as synonymCount
        `);

        const synonymCount = result.records[0].get('synonymCount').toNumber();
        expect(synonymCount).toBeGreaterThan(0);
      } finally {
        await testSession.close();
      }
    });

    it('synonym lookup returns correct canonical skill', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        // Test well-known synonym: "k8s" -> skill_kubernetes
        const result = await testSession.run(`
          MATCH (syn:SkillSynonym {name: $name})-[:ALIAS_FOR]->(skill:Skill)
          RETURN skill.id AS skillId, skill.name AS skillName
        `, { name: 'k8s' });

        expect(result.records.length).toBe(1);
        expect(result.records[0].get('skillId')).toBe('skill_kubernetes');
        expect(result.records[0].get('skillName')).toBe('Kubernetes');
      } finally {
        await testSession.close();
      }
    });

    it('synonym lookup for reactjs returns React skill', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await testSession.run(`
          MATCH (syn:SkillSynonym {name: $name})-[:ALIAS_FOR]->(skill:Skill)
          RETURN skill.id AS skillId, skill.name AS skillName
        `, { name: 'reactjs' });

        expect(result.records.length).toBe(1);
        expect(result.records[0].get('skillId')).toBe('skill_react');
      } finally {
        await testSession.close();
      }
    });

    it('synonym lookup for postgres returns PostgreSQL skill', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await testSession.run(`
          MATCH (syn:SkillSynonym {name: $name})-[:ALIAS_FOR]->(skill:Skill)
          RETURN skill.id AS skillId, skill.name AS skillName
        `, { name: 'postgres' });

        expect(result.records.length).toBe(1);
        expect(result.records[0].get('skillId')).toBe('skill_postgresql');
      } finally {
        await testSession.close();
      }
    });

    it('unique constraint prevents duplicate synonyms', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        // Verify unique constraint exists on SkillSynonym.name
        const constraintResult = await testSession.run(`
          SHOW CONSTRAINTS
          YIELD name, labelsOrTypes, properties
          WHERE 'SkillSynonym' IN labelsOrTypes AND 'name' IN properties
          RETURN name
        `);

        // Should have at least one constraint on SkillSynonym.name
        expect(constraintResult.records.length).toBeGreaterThan(0);
      } finally {
        await testSession.close();
      }
    });

    it('all seeded synonyms are lowercase', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        // Check that no synonyms have uppercase letters
        const result = await testSession.run(`
          MATCH (syn:SkillSynonym)
          WHERE syn.name <> toLower(syn.name)
          RETURN count(syn) as uppercaseCount
        `);

        const uppercaseCount = result.records[0].get('uppercaseCount').toNumber();
        expect(uppercaseCount).toBe(0);
      } finally {
        await testSession.close();
      }
    });
  });
});
