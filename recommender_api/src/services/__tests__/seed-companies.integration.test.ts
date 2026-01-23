import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import driver from '../../neo4j.js';
import type { Session } from 'neo4j-driver';

/*
 * Integration tests for company seeding.
 * These tests require Tilt to be running with a seeded database.
 *
 * Tests are skipped if Neo4j is not available.
 */
describe('Seed Companies Integration Tests', () => {
  let neo4jAvailable = false;
  let session: Session;

  beforeAll(async () => {
    try {
      session = driver.session();
      await session.run('RETURN 1');
      neo4jAvailable = true;
    } catch {
      console.warn('[Seed Companies Integration Tests] Neo4j not available - tests will be skipped');
    }
  });

  afterAll(async () => {
    if (session) {
      await session.close();
    }
  });

  describe('Company nodes', () => {
    it('known companies seeded with correct types', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        // Check that known companies exist with correct types
        const googleResult = await testSession.run(`
          MATCH (c:Company {id: 'company_google'})
          RETURN c.name AS name, c.type AS type
        `);

        expect(googleResult.records.length).toBe(1);
        expect(googleResult.records[0].get('name')).toBe('Google');
        expect(googleResult.records[0].get('type')).toBe('faang');

        const stripeResult = await testSession.run(`
          MATCH (c:Company {id: 'company_stripe'})
          RETURN c.name AS name, c.type AS type
        `);

        expect(stripeResult.records.length).toBe(1);
        expect(stripeResult.records[0].get('name')).toBe('Stripe');
        expect(stripeResult.records[0].get('type')).toBe('startup');

        const ibmResult = await testSession.run(`
          MATCH (c:Company {id: 'company_ibm'})
          RETURN c.name AS name, c.type AS type
        `);

        expect(ibmResult.records.length).toBe(1);
        expect(ibmResult.records[0].get('name')).toBe('IBM');
        expect(ibmResult.records[0].get('type')).toBe('enterprise');
      } finally {
        await testSession.close();
      }
    });

    it('all known companies have normalizedName set', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await testSession.run(`
          MATCH (c:Company)
          WHERE c.normalizedName IS NULL OR c.normalizedName = ''
          RETURN count(c) as missingCount
        `);

        const missingCount = result.records[0].get('missingCount').toNumber();
        expect(missingCount).toBe(0);
      } finally {
        await testSession.close();
      }
    });
  });

  describe('CompanyAlias nodes', () => {
    it('company aliases seeded with ALIAS_FOR relationships', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await testSession.run(`
          MATCH (a:CompanyAlias)-[:ALIAS_FOR]->(c:Company)
          RETURN count(a) as aliasCount
        `);

        const aliasCount = result.records[0].get('aliasCount').toNumber();
        expect(aliasCount).toBeGreaterThan(0);
      } finally {
        await testSession.close();
      }
    });

    it('alias lookup returns correct canonical company', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        // Test well-known alias: "facebook" -> company_meta
        const result = await testSession.run(`
          MATCH (a:CompanyAlias {name: $name})-[:ALIAS_FOR]->(c:Company)
          RETURN c.id AS companyId, c.name AS companyName
        `, { name: 'facebook' });

        expect(result.records.length).toBe(1);
        expect(result.records[0].get('companyId')).toBe('company_meta');
        expect(result.records[0].get('companyName')).toBe('Meta');
      } finally {
        await testSession.close();
      }
    });

    it('alias lookup for AWS returns Amazon', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await testSession.run(`
          MATCH (a:CompanyAlias {name: $name})-[:ALIAS_FOR]->(c:Company)
          RETURN c.id AS companyId, c.name AS companyName
        `, { name: 'aws' });

        expect(result.records.length).toBe(1);
        expect(result.records[0].get('companyId')).toBe('company_amazon');
        expect(result.records[0].get('companyName')).toBe('Amazon');
      } finally {
        await testSession.close();
      }
    });

    it('alias lookup for azure returns Microsoft', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await testSession.run(`
          MATCH (a:CompanyAlias {name: $name})-[:ALIAS_FOR]->(c:Company)
          RETURN c.id AS companyId, c.name AS companyName
        `, { name: 'azure' });

        expect(result.records.length).toBe(1);
        expect(result.records[0].get('companyId')).toBe('company_microsoft');
      } finally {
        await testSession.close();
      }
    });

    it('unique constraint prevents duplicate aliases', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        // Verify unique constraint exists on CompanyAlias.name
        const constraintResult = await testSession.run(`
          SHOW CONSTRAINTS
          YIELD name, labelsOrTypes, properties
          WHERE 'CompanyAlias' IN labelsOrTypes AND 'name' IN properties
          RETURN name
        `);

        // Should have at least one constraint on CompanyAlias.name
        expect(constraintResult.records.length).toBeGreaterThan(0);
      } finally {
        await testSession.close();
      }
    });
  });

  describe('Company type distribution', () => {
    it('has companies of different types', { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log('Skipping: Neo4j not available');
        return;
      }

      const testSession = driver.session();
      try {
        const result = await testSession.run(`
          MATCH (c:Company)
          RETURN c.type AS type, count(c) AS count
          ORDER BY count DESC
        `);

        const types = result.records.map(r => r.get('type'));

        // Should have multiple company types
        expect(types).toContain('faang');
        expect(types).toContain('startup');
        expect(types).toContain('enterprise');
      } finally {
        await testSession.close();
      }
    });
  });
});
