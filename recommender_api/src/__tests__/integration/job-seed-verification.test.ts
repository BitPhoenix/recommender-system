import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import neo4j, { Driver, Session } from 'neo4j-driver';

/*
 * Integration tests that verify job descriptions are correctly seeded in Neo4j.
 * These tests require Neo4j to be running (via Tilt).
 */

describe('Job Description Seed Verification', () => {
  let driver: Driver;
  let session: Session;

  beforeAll(async () => {
    driver = neo4j.driver(
      process.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4j.auth.basic(
        process.env.NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD || 'password'
      )
    );
    session = driver.session();
  });

  afterAll(async () => {
    await session.close();
    await driver.close();
  });

  /*
   * Note: These tests filter for seeded job IDs to avoid counting test jobs
   * created by other integration tests. Seeded jobs have IDs like job_senior_*,
   * job_mid_*, job_junior_*, job_staff_*, job_principal_*.
   */
  const SEEDED_JOB_FILTER = `
    WHERE j.id STARTS WITH 'job_senior' OR j.id STARTS WITH 'job_mid'
       OR j.id STARTS WITH 'job_junior' OR j.id STARTS WITH 'job_staff'
       OR j.id STARTS WITH 'job_principal'
  `;

  it('seeds all job descriptions', async () => {
    const result = await session.run(`MATCH (j:JobDescription) ${SEEDED_JOB_FILTER} RETURN count(j) AS count`);
    const count = result.records[0].get('count').toNumber();
    // We expect 12 job descriptions based on the seed data
    expect(count).toBe(12);
  });

  it('creates REQUIRES_SKILL relationships', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription)-[:REQUIRES_SKILL]->(s:Skill) ${SEEDED_JOB_FILTER} RETURN count(*) AS count`
    );
    const count = result.records[0].get('count').toNumber();
    // We expect 37 required skill relationships based on the seed data
    expect(count).toBe(37);
  });

  it('creates PREFERS_SKILL relationships', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription)-[:PREFERS_SKILL]->(s:Skill) ${SEEDED_JOB_FILTER} RETURN count(*) AS count`
    );
    const count = result.records[0].get('count').toNumber();
    // We expect 24 preferred skill relationships based on the seed data
    expect(count).toBe(24);
  });

  it('creates REQUIRES_BUSINESS_DOMAIN relationships', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription)-[:REQUIRES_BUSINESS_DOMAIN]->(d:BusinessDomain) ${SEEDED_JOB_FILTER} RETURN count(*) AS count`
    );
    const count = result.records[0].get('count').toNumber();
    // We expect 7 required business domain relationships based on the seed data
    expect(count).toBe(7);
  });

  it('creates PREFERS_BUSINESS_DOMAIN relationships', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription)-[:PREFERS_BUSINESS_DOMAIN]->(d:BusinessDomain) ${SEEDED_JOB_FILTER} RETURN count(*) AS count`
    );
    const count = result.records[0].get('count').toNumber();
    // We expect 6 preferred business domain relationships based on the seed data
    expect(count).toBe(6);
  });

  it('creates REQUIRES_TECHNICAL_DOMAIN relationships', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription)-[:REQUIRES_TECHNICAL_DOMAIN]->(d:TechnicalDomain) ${SEEDED_JOB_FILTER} RETURN count(*) AS count`
    );
    const count = result.records[0].get('count').toNumber();
    // We expect 12 required technical domain relationships based on the seed data
    expect(count).toBe(12);
  });

  it('creates PREFERS_TECHNICAL_DOMAIN relationships', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription)-[:PREFERS_TECHNICAL_DOMAIN]->(d:TechnicalDomain) ${SEEDED_JOB_FILTER} RETURN count(*) AS count`
    );
    const count = result.records[0].get('count').toNumber();
    // We expect 5 preferred technical domain relationships based on the seed data
    expect(count).toBe(5);
  });

  it('sets correct properties on job_senior_backend_fintech', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription {id: 'job_senior_backend_fintech'})
       RETURN j.title AS title, j.seniority AS seniority, j.minBudget AS minBudget, j.maxBudget AS maxBudget`
    );
    expect(result.records.length).toBe(1);
    const record = result.records[0];
    expect(record.get('title')).toBe('Senior Backend Engineer - Payments Platform');
    expect(record.get('seniority')).toBe('senior');
    const minBudget = record.get('minBudget');
    const maxBudget = record.get('maxBudget');
    // Neo4j may return integers as neo4j.Integer or regular JS numbers depending on value
    expect(typeof minBudget.toNumber === 'function' ? minBudget.toNumber() : minBudget).toBe(180000);
    expect(typeof maxBudget.toNumber === 'function' ? maxBudget.toNumber() : maxBudget).toBe(220000);
  });

  it('links correct skills to job_senior_backend_fintech', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription {id: 'job_senior_backend_fintech'})-[:REQUIRES_SKILL]->(s:Skill)
       RETURN s.id AS skillId ORDER BY skillId`
    );
    const skillIds = result.records.map(r => r.get('skillId'));
    expect(skillIds).toContain('skill_typescript');
    expect(skillIds).toContain('skill_nodejs');
    expect(skillIds).toContain('skill_postgresql');
    expect(skillIds).toContain('skill_kafka');
  });

  it('links correct business domain to job_senior_backend_fintech', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription {id: 'job_senior_backend_fintech'})-[r:REQUIRES_BUSINESS_DOMAIN]->(d:BusinessDomain)
       RETURN d.id AS domainId, r.minYears AS minYears`
    );
    expect(result.records.length).toBe(1);
    const record = result.records[0];
    expect(record.get('domainId')).toBe('bd_fintech');
    const minYears = record.get('minYears');
    // Neo4j may return integers as neo4j.Integer or regular JS numbers depending on value
    expect(typeof minYears.toNumber === 'function' ? minYears.toNumber() : minYears).toBe(3);
  });

  it('links correct technical domain to job_senior_backend_fintech', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription {id: 'job_senior_backend_fintech'})-[:REQUIRES_TECHNICAL_DOMAIN]->(d:TechnicalDomain)
       RETURN d.id AS domainId`
    );
    expect(result.records.length).toBe(1);
    expect(result.records[0].get('domainId')).toBe('td_backend');
  });
});
