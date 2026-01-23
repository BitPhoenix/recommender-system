import { describe, it, expect } from "vitest";
import { computeSkillSetSimilarity } from "./skill-embedding-similarity.service.js";
import type { SkillWithEmbedding, SkillWithRecency } from "./skill-embedding-similarity.types.js";

describe("computeSkillSetSimilarity", () => {
  // Simple test vectors (3 dimensions for readability)
  const frontendVector = [1, 0, 0];
  const backendVector = [0, 1, 0];
  const hybridVector = [0.7, 0.7, 0]; // Fullstack-ish

  it("returns 0 for empty skill sets", () => {
    const result = computeSkillSetSimilarity([], []);
    expect(result.skills.score).toBe(0);
    expect(result.recentSkills.score).toBe(0);
  });

  it("returns 0 when source is empty", () => {
    const target: SkillWithEmbedding[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector },
    ];
    const result = computeSkillSetSimilarity([], target);
    expect(result.skills.score).toBe(0);
    expect(result.skills.count).toBe(0);
  });

  it("returns 0 when target is empty", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector, lastUsedDate: "present", yearsUsed: 5 },
    ];
    const result = computeSkillSetSimilarity(source, []);
    expect(result.skills.score).toBe(0);
    expect(result.skills.count).toBe(1);
  });

  it("returns 1.0 for identical skill sets", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector, lastUsedDate: "present", yearsUsed: 5 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector },
    ];

    const result = computeSkillSetSimilarity(source, target);
    expect(result.skills.score).toBeCloseTo(1.0, 5);
  });

  it("returns 0 for orthogonal skill sets", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector, lastUsedDate: "present", yearsUsed: 5 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "s2", skillName: "Django", embedding: backendVector },
    ];

    const result = computeSkillSetSimilarity(source, target);
    expect(result.skills.score).toBe(0);
  });

  it("computes centroid correctly for multiple skills", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector, lastUsedDate: "present", yearsUsed: 5 },
      { skillId: "s2", skillName: "Django", embedding: backendVector, lastUsedDate: "present", yearsUsed: 3 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "s3", skillName: "Fullstack", embedding: hybridVector },
    ];

    const result = computeSkillSetSimilarity(source, target);
    // Source centroid = [0.5, 0.5, 0], target = [0.7, 0.7, 0]
    // Both point in same general direction, high similarity
    expect(result.skills.score).toBeGreaterThan(0.9);
  });

  it("excludes old skills from recent calculation", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector, lastUsedDate: "present", yearsUsed: 5 },
      { skillId: "s2", skillName: "jQuery", embedding: [0.8, 0.2, 0], lastUsedDate: "2015-01", yearsUsed: 3 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector },
    ];

    const result = computeSkillSetSimilarity(source, target);
    // All-time includes both (centroid leans toward frontend)
    // Recent only includes React (exact match)
    expect(result.skills.count).toBe(2);
    expect(result.recentSkills.count).toBe(1);
    expect(result.recentSkills.score).toBeCloseTo(1.0, 5);
  });

  it("handles skills without work experience links", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "Rust", embedding: backendVector, lastUsedDate: null, yearsUsed: 1 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "s1", skillName: "Rust", embedding: backendVector },
    ];

    const result = computeSkillSetSimilarity(source, target);
    expect(result.skills.score).toBeCloseTo(1.0, 5);
    expect(result.recentSkills.score).toBe(0); // No recency data
    expect(result.recentSkills.count).toBe(0);
  });

  it("handles year-only date format for recency", () => {
    const currentYear = new Date().getFullYear();
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "TypeScript", embedding: frontendVector, lastUsedDate: `${currentYear}`, yearsUsed: 2 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "s1", skillName: "TypeScript", embedding: frontendVector },
    ];

    const result = computeSkillSetSimilarity(source, target);
    expect(result.recentSkills.count).toBe(1);
    expect(result.recentSkills.score).toBeCloseTo(1.0, 5);
  });

  it("handles mixed recent and old skills correctly", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "React", embedding: [1, 0, 0], lastUsedDate: "present", yearsUsed: 5 },
      { skillId: "s2", skillName: "Angular", embedding: [0.9, 0.1, 0], lastUsedDate: "2020-06", yearsUsed: 3 },
      { skillId: "s3", skillName: "jQuery", embedding: [0.5, 0.5, 0], lastUsedDate: "2010-01", yearsUsed: 2 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "t1", skillName: "Vue", embedding: [0.95, 0.05, 0] },
    ];

    const result = computeSkillSetSimilarity(source, target);

    // All skills count
    expect(result.skills.count).toBe(3);

    // Only "present" skills are recent (2020-06 is more than 3 years ago from 2026)
    expect(result.recentSkills.count).toBe(1);

    // Recent should have higher similarity since React (recent) is closest to Vue
    expect(result.recentSkills.score).toBeGreaterThan(result.skills.score);
  });

  it("returns correct counts in result", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "A", embedding: [1, 0], lastUsedDate: "present", yearsUsed: 1 },
      { skillId: "s2", skillName: "B", embedding: [0, 1], lastUsedDate: "present", yearsUsed: 1 },
      { skillId: "s3", skillName: "C", embedding: [1, 1], lastUsedDate: null, yearsUsed: 1 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "t1", skillName: "X", embedding: [1, 0] },
    ];

    const result = computeSkillSetSimilarity(source, target);
    expect(result.skills.count).toBe(3);
    expect(result.recentSkills.count).toBe(2); // Only skills with lastUsedDate
  });
});
