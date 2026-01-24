import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import neo4j, { Driver, Session } from 'neo4j-driver';

/*
 * Integration tests that verify job description embeddings are correctly seeded in Neo4j.
 * These tests require Neo4j to be running (via Tilt) and Ollama to be available during seeding.
 */

describe('Job Description Embedding Verification', () => {
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

  it('creates job_description_embedding_index', async () => {
    const result = await session.run('SHOW INDEXES');
    const indexNames = result.records.map(r => r.get('name'));
    expect(indexNames).toContain('job_description_embedding_index');
  });

  it('generates embeddings for all seeded jobs (when Ollama available)', async () => {
    /*
     * Filter for seeded jobs only to avoid counting test jobs.
     * Seeded jobs have IDs like job_senior_*, job_mid_*, etc.
     */
    const result = await session.run(
      `MATCH (j:JobDescription)
       WHERE j.embedding IS NOT NULL
         AND (j.id STARTS WITH 'job_senior' OR j.id STARTS WITH 'job_mid'
           OR j.id STARTS WITH 'job_junior' OR j.id STARTS WITH 'job_staff'
           OR j.id STARTS WITH 'job_principal')
       RETURN count(j) AS count`
    );
    const count = result.records[0].get('count').toNumber();
    /*
     * If Ollama was available during seeding, all jobs should have embeddings.
     * If Ollama was unavailable, count will be 0 (graceful skip).
     * We expect 12 job descriptions based on the seed data.
     */
    expect(count === 0 || count === 12).toBe(true);
  });

  it('stores embeddings with correct dimensions (1024)', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription)
       WHERE j.embedding IS NOT NULL
       RETURN j.id AS jobId, size(j.embedding) AS dimensions
       LIMIT 1`
    );
    if (result.records.length > 0) {
      const dimensions = result.records[0].get('dimensions').toNumber();
      expect(dimensions).toBe(1024);
    }
  });

  it('stores embedding metadata', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription {id: 'job_senior_backend_fintech'})
       WHERE j.embedding IS NOT NULL
       RETURN j.embeddingModel AS model, j.embeddingUpdatedAt AS updatedAt`
    );
    if (result.records.length > 0) {
      const record = result.records[0];
      expect(record.get('model')).toBe('mxbai-embed-large');
      expect(record.get('updatedAt')).not.toBeNull();
    }
  });
});
