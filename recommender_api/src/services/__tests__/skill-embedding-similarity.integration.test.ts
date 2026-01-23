import { describe, it, expect, beforeAll, afterAll } from "vitest";
import driver from "../../neo4j.js";
import type { Session } from "neo4j-driver";
import {
  loadEngineerSkillsWithEmbeddings,
  loadSkillEmbeddingsByIds,
} from "../content-search/skill-embedding-loader.service.js";
import {
  computeSkillSimilarityForCandidates,
  clearCachedEngineerSkillsWithEmbeddings,
} from "../content-search/candidate-skill-similarity.service.js";
import { executeContentSearch } from "../content-search/content-search.service.js";

/*
 * Integration tests for skill embedding similarity functionality.
 * These tests require Tilt to be running with a seeded database that has skill embeddings.
 */
describe("Skill Embedding Similarity Integration Tests", () => {
  let neo4jAvailable = false;
  let session: Session;

  beforeAll(async () => {
    try {
      session = driver.session();
      await session.run("RETURN 1");
      neo4jAvailable = true;
      // Clear cache for fresh test state
      clearCachedEngineerSkillsWithEmbeddings();
    } catch {
      console.warn("[Skill Embedding Integration Tests] Neo4j not available - tests will be skipped");
    }
  });

  afterAll(async () => {
    if (session) {
      await session.close();
    }
    clearCachedEngineerSkillsWithEmbeddings();
  });

  describe("Skill Embedding Infrastructure", () => {
    it("skill_embedding_index exists in Neo4j", { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        const result = await testSession.run(`
          SHOW INDEXES
          YIELD name, type
          WHERE name = 'skill_embedding_index'
          RETURN name, type
        `);

        expect(result.records.length).toBe(1);
        expect(result.records[0].get("name")).toBe("skill_embedding_index");
        expect(result.records[0].get("type")).toBe("VECTOR");
      } finally {
        await testSession.close();
      }
    });

    it("skills have embeddings with 1024 dimensions", { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        const result = await testSession.run(`
          MATCH (s:Skill)
          WHERE s.embedding IS NOT NULL
          RETURN s.name AS name, size(s.embedding) AS dimensions
          LIMIT 5
        `);

        expect(result.records.length).toBeGreaterThan(0);
        for (const record of result.records) {
          // Neo4j returns Integer type, convert to number
          const dimensions = record.get("dimensions");
          const dimensionsAsNumber = typeof dimensions === "number" ? dimensions : dimensions.toNumber();
          expect(dimensionsAsNumber).toBe(1024);
        }
      } finally {
        await testSession.close();
      }
    });

    it("all skills have embeddings", { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        const result = await testSession.run(`
          MATCH (s:Skill)
          WITH count(s) AS totalSkills,
               sum(CASE WHEN s.embedding IS NOT NULL THEN 1 ELSE 0 END) AS withEmbeddings
          RETURN totalSkills, withEmbeddings
        `);

        const totalSkills = result.records[0].get("totalSkills").toNumber();
        const withEmbeddings = result.records[0].get("withEmbeddings").toNumber();

        expect(withEmbeddings).toBe(totalSkills);
      } finally {
        await testSession.close();
      }
    });

    it("similar skills have similar embeddings (semantic sanity check)", { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        /*
         * React and Vue are both frontend frameworks, so they should have
         * more similar embeddings than React and PostgreSQL (unrelated domains).
         */
        const result = await testSession.run(`
          MATCH (react:Skill {name: 'React'}), (vue:Skill {name: 'Vue.js'}), (postgres:Skill {name: 'PostgreSQL'})
          WHERE react.embedding IS NOT NULL AND vue.embedding IS NOT NULL AND postgres.embedding IS NOT NULL
          RETURN
            gds.similarity.cosine(react.embedding, vue.embedding) AS reactVueSimilarity,
            gds.similarity.cosine(react.embedding, postgres.embedding) AS reactPostgresSimilarity
        `);

        if (result.records.length === 0) {
          console.log("Skipping: Required skills not found or no GDS");
          return;
        }

        const reactVueSimilarity = result.records[0].get("reactVueSimilarity") as number;
        const reactPostgresSimilarity = result.records[0].get("reactPostgresSimilarity") as number;

        // React should be more similar to Vue than to PostgreSQL
        expect(reactVueSimilarity).toBeGreaterThan(reactPostgresSimilarity);
      } catch (error) {
        // GDS may not be available - skip gracefully
        if (error instanceof Error && error.message.includes("gds")) {
          console.log("Skipping: GDS not available for similarity computation");
          return;
        }
        throw error;
      } finally {
        await testSession.close();
      }
    });
  });

  describe("loadEngineerSkillsWithEmbeddings", () => {
    it("loads skills with embeddings for an existing engineer", { timeout: 15000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        // Find an engineer with skills
        const engineerResult = await testSession.run(`
          MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
          WHERE s.embedding IS NOT NULL
          RETURN e.id AS engineerId
          LIMIT 1
        `);

        if (engineerResult.records.length === 0) {
          console.log("Skipping: No engineer with skills found");
          return;
        }

        const engineerId = engineerResult.records[0].get("engineerId") as string;
        const skills = await loadEngineerSkillsWithEmbeddings(testSession, engineerId);

        expect(skills.length).toBeGreaterThan(0);
        expect(skills[0]).toHaveProperty("skillId");
        expect(skills[0]).toHaveProperty("skillName");
        expect(skills[0]).toHaveProperty("embedding");
        expect(skills[0].embedding.length).toBe(1024);
      } finally {
        await testSession.close();
      }
    });

    it("returns empty array for non-existent engineer", { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        const skills = await loadEngineerSkillsWithEmbeddings(testSession, "eng_nonexistent_xyz");
        expect(skills).toEqual([]);
      } finally {
        await testSession.close();
      }
    });

    it("includes recency information when available", { timeout: 15000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        // Find an engineer with work experience links
        const engineerResult = await testSession.run(`
          MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:USED_AT]->(w:WorkExperience)
          WHERE w.endDate IS NOT NULL
          RETURN e.id AS engineerId
          LIMIT 1
        `);

        if (engineerResult.records.length === 0) {
          console.log("Skipping: No engineer with work experience links found");
          return;
        }

        const engineerId = engineerResult.records[0].get("engineerId") as string;
        const skills = await loadEngineerSkillsWithEmbeddings(testSession, engineerId);

        expect(skills.length).toBeGreaterThan(0);
        // At least some skills should have recency info
        expect(skills[0]).toHaveProperty("lastUsedDate");
        expect(skills[0]).toHaveProperty("yearsUsed");
      } finally {
        await testSession.close();
      }
    });
  });

  describe("loadSkillEmbeddingsByIds", () => {
    it("loads embeddings for existing skills", { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        // First get some skill IDs from the database
        const result = await testSession.run(`
          MATCH (s:Skill) WHERE s.embedding IS NOT NULL
          RETURN s.id AS skillId LIMIT 3
        `);
        const skillIds = result.records.map((r) => r.get("skillId") as string);

        const skills = await loadSkillEmbeddingsByIds(testSession, skillIds);

        expect(skills.length).toBe(skillIds.length);
        skills.forEach((skill) => {
          expect(skill.embedding.length).toBe(1024);
          expect(skillIds).toContain(skill.skillId);
        });
      } finally {
        await testSession.close();
      }
    });

    it("returns empty array for empty input", { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        const skills = await loadSkillEmbeddingsByIds(testSession, []);
        expect(skills).toEqual([]);
      } finally {
        await testSession.close();
      }
    });

    it("filters out non-existent skill IDs", { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        const skills = await loadSkillEmbeddingsByIds(testSession, ["nonexistent_skill_id_xyz"]);
        expect(skills).toEqual([]);
      } finally {
        await testSession.close();
      }
    });
  });

  describe("computeSkillSimilarityForCandidates", () => {
    it("computes similarity between two engineers", { timeout: 15000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        // Find two engineers with skills
        const engineerResult = await testSession.run(`
          MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
          WHERE s.embedding IS NOT NULL
          WITH e, count(s) AS skillCount
          WHERE skillCount > 2
          RETURN e.id AS engineerId
          LIMIT 3
        `);

        if (engineerResult.records.length < 2) {
          console.log("Skipping: Not enough engineers with skills found");
          return;
        }

        const targetEngineerId = engineerResult.records[0].get("engineerId") as string;
        const candidateIds = engineerResult.records.slice(1).map((r) => r.get("engineerId") as string);

        const results = await computeSkillSimilarityForCandidates(
          testSession,
          targetEngineerId,
          candidateIds
        );

        expect(results.size).toBe(candidateIds.length);

        for (const candidateId of candidateIds) {
          const result = results.get(candidateId);
          expect(result).toBeDefined();
          expect(result!.skills.score).toBeGreaterThanOrEqual(0);
          expect(result!.skills.score).toBeLessThanOrEqual(1);
        }
      } finally {
        await testSession.close();
      }
    });

    it("returns zeros when target engineer has no skills", { timeout: 10000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        // Find an engineer with skills to use as candidate
        const engineerResult = await testSession.run(`
          MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
          WHERE s.embedding IS NOT NULL
          RETURN e.id AS engineerId
          LIMIT 1
        `);

        if (engineerResult.records.length === 0) {
          console.log("Skipping: No engineer with skills found");
          return;
        }

        const candidateId = engineerResult.records[0].get("engineerId") as string;

        // Use a non-existent engineer as target
        const results = await computeSkillSimilarityForCandidates(
          testSession,
          "eng_nonexistent_xyz",
          [candidateId]
        );

        const result = results.get(candidateId);
        expect(result).toBeDefined();
        expect(result!.skills.score).toBe(0);
        expect(result!.skills.count).toBe(0);
      } finally {
        await testSession.close();
      }
    });

    it("includes recent skill similarity", { timeout: 15000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        // Find two engineers with skills
        const engineerResult = await testSession.run(`
          MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
          WHERE s.embedding IS NOT NULL
          WITH e, count(s) AS skillCount
          WHERE skillCount > 2
          RETURN e.id AS engineerId
          LIMIT 2
        `);

        if (engineerResult.records.length < 2) {
          console.log("Skipping: Not enough engineers with skills found");
          return;
        }

        const targetEngineerId = engineerResult.records[0].get("engineerId") as string;
        const candidateId = engineerResult.records[1].get("engineerId") as string;

        const results = await computeSkillSimilarityForCandidates(
          testSession,
          targetEngineerId,
          [candidateId]
        );

        const result = results.get(candidateId);
        expect(result).toBeDefined();
        expect(result!.recentSkills).toHaveProperty("score");
        expect(result!.recentSkills).toHaveProperty("count");
      } finally {
        await testSession.close();
      }
    });
  });

  describe("Content Search Integration", () => {
    it("embedding search includes skill similarity fields", { timeout: 30000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        // Find an engineer to use as similarity target
        const engineerResult = await testSession.run(`
          MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
          WHERE s.embedding IS NOT NULL AND e.embedding IS NOT NULL
          WITH e, count(s) AS skillCount
          WHERE skillCount > 2
          RETURN e.id AS engineerId
          LIMIT 1
        `);

        if (engineerResult.records.length === 0) {
          console.log("Skipping: No engineer with skills and embedding found");
          return;
        }

        const targetEngineerId = engineerResult.records[0].get("engineerId") as string;

        const response = await executeContentSearch(testSession, {
          similarToEngineerId: targetEngineerId,
          method: "embedding",
          limit: 5,
          offset: 0,
        });

        expect(response.searchMethod).toBe("embedding");
        expect(response.matches.length).toBeGreaterThan(0);

        for (const match of response.matches) {
          expect(match.contentScoreBreakdown).toHaveProperty("skillEmbeddingSimilarity");
          expect(match.contentScoreBreakdown).toHaveProperty("recentSkillEmbeddingSimilarity");
          expect(match.contentScoreBreakdown).toHaveProperty("skillCount");
          expect(match.contentScoreBreakdown).toHaveProperty("recentSkillCount");
          expect(typeof match.contentScoreBreakdown.skillEmbeddingSimilarity).toBe("number");
          expect(typeof match.contentScoreBreakdown.recentSkillEmbeddingSimilarity).toBe("number");
        }
      } finally {
        await testSession.close();
      }
    });

    it("skill similarity scores are between 0 and 1", { timeout: 30000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        const engineerResult = await testSession.run(`
          MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
          WHERE s.embedding IS NOT NULL AND e.embedding IS NOT NULL
          WITH e, count(s) AS skillCount
          WHERE skillCount > 2
          RETURN e.id AS engineerId
          LIMIT 1
        `);

        if (engineerResult.records.length === 0) {
          console.log("Skipping: No suitable engineer found");
          return;
        }

        const targetEngineerId = engineerResult.records[0].get("engineerId") as string;

        const response = await executeContentSearch(testSession, {
          similarToEngineerId: targetEngineerId,
          method: "embedding",
          limit: 10,
          offset: 0,
        });

        for (const match of response.matches) {
          const skillSim = match.contentScoreBreakdown.skillEmbeddingSimilarity!;
          const recentSkillSim = match.contentScoreBreakdown.recentSkillEmbeddingSimilarity!;

          expect(skillSim).toBeGreaterThanOrEqual(0);
          expect(skillSim).toBeLessThanOrEqual(1);
          expect(recentSkillSim).toBeGreaterThanOrEqual(0);
          expect(recentSkillSim).toBeLessThanOrEqual(1);
        }
      } finally {
        await testSession.close();
      }
    });

    it("combined content score reflects both profile and skill embedding", { timeout: 30000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        const engineerResult = await testSession.run(`
          MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
          WHERE s.embedding IS NOT NULL AND e.embedding IS NOT NULL
          WITH e, count(s) AS skillCount
          WHERE skillCount > 2
          RETURN e.id AS engineerId
          LIMIT 1
        `);

        if (engineerResult.records.length === 0) {
          console.log("Skipping: No suitable engineer found");
          return;
        }

        const targetEngineerId = engineerResult.records[0].get("engineerId") as string;

        const response = await executeContentSearch(testSession, {
          similarToEngineerId: targetEngineerId,
          method: "embedding",
          limit: 5,
          offset: 0,
        });

        for (const match of response.matches) {
          const breakdown = match.contentScoreBreakdown;
          // Combined score = 0.5 * profileEmbeddingScore + 0.5 * skillEmbeddingSimilarity
          const expectedCombined = 0.5 * breakdown.profileEmbeddingScore! + 0.5 * breakdown.skillEmbeddingSimilarity!;
          // Allow small floating point tolerance
          expect(Math.abs(match.contentScore - expectedCombined)).toBeLessThan(0.001);
        }
      } finally {
        await testSession.close();
      }
    });

    it("hybrid search also includes skill similarity fields", { timeout: 30000 }, async () => {
      if (!neo4jAvailable) {
        console.log("Skipping: Neo4j not available");
        return;
      }

      const testSession = driver.session();
      try {
        const engineerResult = await testSession.run(`
          MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
          WHERE s.embedding IS NOT NULL AND e.embedding IS NOT NULL
          WITH e, count(s) AS skillCount
          WHERE skillCount > 2
          RETURN e.id AS engineerId
          LIMIT 1
        `);

        if (engineerResult.records.length === 0) {
          console.log("Skipping: No suitable engineer found");
          return;
        }

        const targetEngineerId = engineerResult.records[0].get("engineerId") as string;

        const response = await executeContentSearch(testSession, {
          similarToEngineerId: targetEngineerId,
          method: "hybrid",
          limit: 5,
          offset: 0,
        });

        expect(response.searchMethod).toBe("hybrid");

        if (response.matches.length > 0) {
          for (const match of response.matches) {
            expect(match.contentScoreBreakdown).toHaveProperty("skillEmbeddingSimilarity");
            expect(match.contentScoreBreakdown).toHaveProperty("recentSkillEmbeddingSimilarity");
          }
        }
      } finally {
        await testSession.close();
      }
    });
  });
});
