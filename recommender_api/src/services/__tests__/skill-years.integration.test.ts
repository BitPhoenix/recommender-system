import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Session } from "neo4j-driver";
import driver from "../../neo4j.js";
import { calculateAndStoreSkillYears } from "../resume-processor/skill-years.service.js";

describe("skill-years.service integration", () => {
  let session: Session;
  let neo4jAvailable = false;

  beforeAll(async () => {
    try {
      session = driver.session();
      await session.run("RETURN 1");
      neo4jAvailable = true;
    } catch {
      console.warn("[Skill Years Integration Tests] Neo4j not available - tests will be skipped");
    }
  });

  afterAll(async () => {
    if (session) {
      await session.close();
    }
  });

  beforeEach(async () => {
    if (!neo4jAvailable) return;

    // Clean up test data
    await session.run(`
      MATCH (e:Engineer {id: 'test_eng_skill_years'})
      DETACH DELETE e
    `);
    await session.run(`
      MATCH (us:UserSkill)
      WHERE us.id STARTS WITH 'test_us_'
      DETACH DELETE us
    `);
    await session.run(`
      MATCH (w:WorkExperience)
      WHERE w.id STARTS WITH 'test_we_'
      DETACH DELETE w
    `);
  });

  it("calculates yearsUsed from single work experience", { timeout: 10000 }, async () => {
    if (!neo4jAvailable) {
      console.log("Skipping: Neo4j not available");
      return;
    }

    // Setup: Create engineer, skill (using existing), UserSkill, WorkExperience, USED_AT
    await session.run(`
      CREATE (e:Engineer {id: 'test_eng_skill_years', name: 'Test Engineer'})
      WITH e
      MATCH (s:Skill {id: 'skill_react'})
      CREATE (e)-[:HAS]->(us:UserSkill {id: 'test_us_react', proficiencyLevel: 'proficient'})-[:FOR]->(s)
      CREATE (w:WorkExperience {id: 'test_we_1', startDate: '2020-01', endDate: '2022-12'})
      CREATE (e)-[:HAD_ROLE]->(w)
      CREATE (us)-[:USED_AT]->(w)
    `);

    await calculateAndStoreSkillYears(session, "test_eng_skill_years");

    const result = await session.run(`
      MATCH (us:UserSkill {id: 'test_us_react'})
      RETURN us.yearsUsed AS yearsUsed
    `);

    // 2020-01 to 2022-12 = 36 months = 3 years
    expect(result.records[0].get("yearsUsed")).toBe(3);
  });

  it("merges overlapping work experiences", { timeout: 10000 }, async () => {
    if (!neo4jAvailable) {
      console.log("Skipping: Neo4j not available");
      return;
    }

    await session.run(`
      CREATE (e:Engineer {id: 'test_eng_skill_years', name: 'Test Engineer'})
      WITH e
      MATCH (s:Skill {id: 'skill_react'})
      CREATE (e)-[:HAS]->(us:UserSkill {id: 'test_us_react', proficiencyLevel: 'proficient'})-[:FOR]->(s)
      CREATE (w1:WorkExperience {id: 'test_we_1', startDate: '2018-01', endDate: '2022-01'})
      CREATE (w2:WorkExperience {id: 'test_we_2', startDate: '2020-01', endDate: '2024-01'})
      CREATE (e)-[:HAD_ROLE]->(w1)
      CREATE (e)-[:HAD_ROLE]->(w2)
      CREATE (us)-[:USED_AT]->(w1)
      CREATE (us)-[:USED_AT]->(w2)
    `);

    await calculateAndStoreSkillYears(session, "test_eng_skill_years");

    const result = await session.run(`
      MATCH (us:UserSkill {id: 'test_us_react'})
      RETURN us.yearsUsed AS yearsUsed
    `);

    // Merged: 2018-01 to 2024-01 = 73 months ≈ 6.1 years (not 8 years)
    expect(result.records[0].get("yearsUsed")).toBe(6.1);
  });

  it("sets yearsUsed to 0 for standalone skills (no USED_AT)", { timeout: 10000 }, async () => {
    if (!neo4jAvailable) {
      console.log("Skipping: Neo4j not available");
      return;
    }

    await session.run(`
      CREATE (e:Engineer {id: 'test_eng_skill_years', name: 'Test Engineer'})
      WITH e
      MATCH (s:Skill {id: 'skill_react'})
      CREATE (e)-[:HAS]->(us:UserSkill {id: 'test_us_react', proficiencyLevel: 'proficient'})-[:FOR]->(s)
    `);

    await calculateAndStoreSkillYears(session, "test_eng_skill_years");

    const result = await session.run(`
      MATCH (us:UserSkill {id: 'test_us_react'})
      RETURN us.yearsUsed AS yearsUsed
    `);

    expect(result.records[0].get("yearsUsed")).toBe(0);
  });

  it("handles 'present' end dates", { timeout: 10000 }, async () => {
    if (!neo4jAvailable) {
      console.log("Skipping: Neo4j not available");
      return;
    }

    await session.run(`
      CREATE (e:Engineer {id: 'test_eng_skill_years', name: 'Test Engineer'})
      WITH e
      MATCH (s:Skill {id: 'skill_react'})
      CREATE (e)-[:HAS]->(us:UserSkill {id: 'test_us_react', proficiencyLevel: 'proficient'})-[:FOR]->(s)
      CREATE (w:WorkExperience {id: 'test_we_1', startDate: '2024-01', endDate: 'present'})
      CREATE (e)-[:HAD_ROLE]->(w)
      CREATE (us)-[:USED_AT]->(w)
    `);

    await calculateAndStoreSkillYears(session, "test_eng_skill_years");

    const result = await session.run(`
      MATCH (us:UserSkill {id: 'test_us_react'})
      RETURN us.yearsUsed AS yearsUsed
    `);

    // Should be > 0 (current date - Jan 2024)
    expect(result.records[0].get("yearsUsed")).toBeGreaterThan(0);
  });
});
