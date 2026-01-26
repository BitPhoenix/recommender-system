import { describe, it, expect, beforeAll, afterAll } from "vitest";
import driver from "../../../neo4j.js";
import { findEngineersForJob } from "../job-match.service.js";
import type { Session } from "neo4j-driver";

describe("job-match.service integration", () => {
  let session: Session;

  beforeAll(() => {
    session = driver.session();
  });

  afterAll(async () => {
    await session.close();
  });

  it("finds matching engineers for a seeded job", async () => {
    const result = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 10,
      offset: 0,
    });

    expect(result.jobId).toBe("job_senior_backend_fintech");
    expect(result.jobTitle).toContain("Backend");
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.length).toBeLessThanOrEqual(10);

    // Verify score breakdown structure
    const firstMatch = result.matches[0];
    expect(firstMatch.matchScore).toBeGreaterThan(0);
    expect(firstMatch.matchScore).toBeLessThanOrEqual(1);
    expect(firstMatch.scoreBreakdown).toHaveProperty("semanticSimilarity");
    expect(firstMatch.scoreBreakdown).toHaveProperty("skillSimilarity");
    expect(firstMatch.scoreBreakdown).toHaveProperty("requiredSkillCoverage");
    expect(firstMatch.scoreBreakdown).toHaveProperty("matchingSkills");
  });

  it("returns results sorted by match score descending", async () => {
    const result = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 20,
      offset: 0,
    });

    for (let i = 1; i < result.matches.length; i++) {
      expect(result.matches[i].matchScore).toBeLessThanOrEqual(
        result.matches[i - 1].matchScore
      );
    }
  });

  it("respects pagination - first page", async () => {
    const firstPage = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 5,
      offset: 0,
    });

    expect(firstPage.matches.length).toBeLessThanOrEqual(5);
    expect(firstPage.totalCount).toBeGreaterThan(0);
  });

  it("respects pagination - second page has different results", async () => {
    const firstPage = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 5,
      offset: 0,
    });

    const secondPage = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 5,
      offset: 5,
    });

    // No overlap between pages (if we have enough results)
    if (secondPage.matches.length > 0) {
      const firstPageIds = new Set(firstPage.matches.map(m => m.id));
      for (const match of secondPage.matches) {
        expect(firstPageIds.has(match.id)).toBe(false);
      }
    }
  });

  it("throws error for non-existent job", async () => {
    await expect(
      findEngineersForJob(session, {
        jobId: "job_nonexistent",
        limit: 10,
        offset: 0,
      })
    ).rejects.toThrow("Job not found");
  });

  it("returns score breakdown with all required fields", async () => {
    const result = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 5,
      offset: 0,
    });

    expect(result.matches.length).toBeGreaterThan(0);
    const breakdown = result.matches[0].scoreBreakdown;

    // All numeric signals should be between 0 and 1
    expect(breakdown.semanticSimilarity).toBeGreaterThanOrEqual(0);
    expect(breakdown.semanticSimilarity).toBeLessThanOrEqual(1);
    expect(breakdown.skillSimilarity).toBeGreaterThanOrEqual(0);
    expect(breakdown.skillSimilarity).toBeLessThanOrEqual(1);
    expect(breakdown.recentSkillSimilarity).toBeGreaterThanOrEqual(0);
    expect(breakdown.recentSkillSimilarity).toBeLessThanOrEqual(1);
    expect(breakdown.requiredSkillCoverage).toBeGreaterThanOrEqual(0);
    expect(breakdown.requiredSkillCoverage).toBeLessThanOrEqual(1);
    expect(breakdown.preferredSkillCoverage).toBeGreaterThanOrEqual(0);
    expect(breakdown.preferredSkillCoverage).toBeLessThanOrEqual(1);
    expect(breakdown.seniorityMatch).toBeGreaterThanOrEqual(0);
    expect(breakdown.seniorityMatch).toBeLessThanOrEqual(1);
    expect(breakdown.timezoneMatch).toBeGreaterThanOrEqual(0);
    expect(breakdown.timezoneMatch).toBeLessThanOrEqual(1);
    expect(breakdown.budgetMatch).toBeGreaterThanOrEqual(0);
    expect(breakdown.budgetMatch).toBeLessThanOrEqual(1);

    // Explainability arrays should be present
    expect(Array.isArray(breakdown.matchingSkills)).toBe(true);
    expect(Array.isArray(breakdown.missingRequiredSkills)).toBe(true);
  });

  it("populates matchingSkills with skill names", async () => {
    const result = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 10,
      offset: 0,
    });

    // At least one engineer should have some matching skills
    const engineerWithMatchingSkills = result.matches.find(
      m => m.scoreBreakdown.matchingSkills.length > 0
    );

    if (engineerWithMatchingSkills) {
      // Matching skills should be strings (skill names)
      for (const skill of engineerWithMatchingSkills.scoreBreakdown.matchingSkills) {
        expect(typeof skill).toBe("string");
        expect(skill.length).toBeGreaterThan(0);
      }
    }
  });

  it("populates missingRequiredSkills correctly", async () => {
    const result = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 10,
      offset: 0,
    });

    // Engineers with requiredSkillCoverage < 1.0 should have missing skills
    for (const match of result.matches) {
      if (match.scoreBreakdown.requiredSkillCoverage < 1.0) {
        expect(match.scoreBreakdown.missingRequiredSkills.length).toBeGreaterThan(0);
      }
    }
  });

  it("returns different results for different job types", async () => {
    const backendJob = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 10,
      offset: 0,
    });

    const frontendJob = await findEngineersForJob(session, {
      jobId: "job_mid_frontend_saas",
      limit: 10,
      offset: 0,
    });

    // Both should have results
    expect(backendJob.matches.length).toBeGreaterThan(0);
    expect(frontendJob.matches.length).toBeGreaterThan(0);

    // Top matches should differ between different job types
    // (Not necessarily all different, but at least some)
    const backendTopIds = new Set(backendJob.matches.slice(0, 3).map(m => m.id));
    const frontendTopIds = new Set(frontendJob.matches.slice(0, 3).map(m => m.id));

    // At least some difference in top 3 (not all the same)
    const overlap = [...backendTopIds].filter(id => frontendTopIds.has(id));
    expect(overlap.length).toBeLessThan(3);
  });

  it("includes query metadata with execution time and weights", async () => {
    const result = await findEngineersForJob(session, {
      jobId: "job_senior_backend_fintech",
      limit: 10,
      offset: 0,
    });

    expect(result.queryMetadata.executionTimeMs).toBeGreaterThan(0);
    expect(result.queryMetadata.candidatesEvaluated).toBeGreaterThan(0);
    expect(result.queryMetadata.scoringWeights).toBeDefined();
    expect(result.queryMetadata.scoringWeights.skillSimilarity).toBe(0.25);
  });
});
