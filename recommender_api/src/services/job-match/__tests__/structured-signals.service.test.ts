import { describe, it, expect } from "vitest";
import {
  calculateSeniorityMatch,
  calculateTimezoneMatch,
  calculateBudgetMatch,
  calculateSkillCoverage,
} from "../structured-signals.service.js";

describe("structured-signals.service", () => {
  describe("calculateSeniorityMatch", () => {
    it("returns 1.0 for exact match", () => {
      // 7 years = senior (6-10 years range per seniorityMapping)
      expect(calculateSeniorityMatch("senior", 7)).toBe(1.0);
    });

    it("returns 1.0 for junior with 1 year experience", () => {
      expect(calculateSeniorityMatch("junior", 1)).toBe(1.0);
    });

    it("returns 1.0 for mid with 4 years experience", () => {
      expect(calculateSeniorityMatch("mid", 4)).toBe(1.0);
    });

    it("returns 1.0 for staff with 12 years experience", () => {
      expect(calculateSeniorityMatch("staff", 12)).toBe(1.0);
    });

    it("returns 0.5 for adjacent level - engineer senior, job mid", () => {
      // 7 years = senior, job wants mid -> adjacent
      expect(calculateSeniorityMatch("mid", 7)).toBe(0.5);
    });

    it("returns 0.5 for adjacent level - engineer mid, job senior", () => {
      // 4 years = mid, job wants senior -> adjacent
      expect(calculateSeniorityMatch("senior", 4)).toBe(0.5);
    });

    it("returns 0.0 for non-adjacent levels", () => {
      // 2 years = junior, job wants staff -> 3 levels apart
      expect(calculateSeniorityMatch("staff", 2)).toBe(0.0);
    });

    it("returns 0.0 for junior with staff job", () => {
      expect(calculateSeniorityMatch("staff", 1)).toBe(0.0);
    });

    it("returns 0 for invalid seniority level", () => {
      expect(calculateSeniorityMatch("invalid_level", 5)).toBe(0);
    });
  });

  describe("calculateTimezoneMatch", () => {
    it("returns 1.0 when engineer timezone is in job list", () => {
      expect(calculateTimezoneMatch(["Eastern", "Central"], "Eastern")).toBe(1.0);
    });

    it("returns 1.0 when engineer timezone is second in list", () => {
      expect(calculateTimezoneMatch(["Eastern", "Central"], "Central")).toBe(1.0);
    });

    it("returns 0.0 when engineer timezone not in job list", () => {
      expect(calculateTimezoneMatch(["Eastern", "Central"], "Pacific")).toBe(0.0);
    });

    it("returns 1.0 when job has no timezone restriction", () => {
      expect(calculateTimezoneMatch([], "Pacific")).toBe(1.0);
    });

    it("returns 1.0 for single matching timezone", () => {
      expect(calculateTimezoneMatch(["Pacific"], "Pacific")).toBe(1.0);
    });
  });

  describe("calculateBudgetMatch", () => {
    it("returns 1.0 when salary within budget", () => {
      expect(calculateBudgetMatch(100000, 150000, 140000)).toBe(1.0);
    });

    it("returns 1.0 when salary equals maxBudget exactly", () => {
      expect(calculateBudgetMatch(100000, 150000, 150000)).toBe(1.0);
    });

    it("returns 1.0 when salary below minBudget", () => {
      expect(calculateBudgetMatch(100000, 150000, 90000)).toBe(1.0);
    });

    it("returns graduated score within stretch range", () => {
      // 160000 is 10k over 150000 maxBudget (within 20% stretch to 180000)
      const score = calculateBudgetMatch(100000, 150000, 160000);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
      // At 10k over max with 30k stretch range, should be ~0.667
      expect(score).toBeCloseTo(0.667, 2);
    });

    it("returns 0.5 at midpoint of stretch range", () => {
      // Stretch limit is 180000 (150000 * 1.2), midpoint is 165000
      const score = calculateBudgetMatch(100000, 150000, 165000);
      expect(score).toBeCloseTo(0.5, 2);
    });

    it("returns 0.0 when salary exceeds stretch range", () => {
      // 200000 is beyond 180000 stretch limit (150000 * 1.2)
      expect(calculateBudgetMatch(100000, 150000, 200000)).toBe(0.0);
    });

    it("returns 0.0 when salary at stretch limit boundary", () => {
      // 180000 is exactly at stretch limit (150000 * 1.2)
      expect(calculateBudgetMatch(100000, 150000, 180000)).toBe(0.0);
    });

    it("returns 1.0 when no budget constraint (null maxBudget)", () => {
      expect(calculateBudgetMatch(null, null, 500000)).toBe(1.0);
    });

    it("returns 1.0 when only minBudget specified (null maxBudget)", () => {
      expect(calculateBudgetMatch(100000, null, 500000)).toBe(1.0);
    });
  });

  describe("calculateSkillCoverage", () => {
    it("returns 1.0 when engineer has all job skills", () => {
      const result = calculateSkillCoverage(
        ["skill_react", "skill_typescript"],
        new Set(["skill_react", "skill_typescript", "skill_nodejs"])
      );
      expect(result.coverage).toBe(1.0);
      expect(result.matchingSkillIds).toEqual(["skill_react", "skill_typescript"]);
      expect(result.missingSkillIds).toEqual([]);
    });

    it("returns partial coverage when engineer missing some skills", () => {
      const result = calculateSkillCoverage(
        ["skill_react", "skill_typescript", "skill_graphql"],
        new Set(["skill_react", "skill_nodejs"])
      );
      expect(result.coverage).toBeCloseTo(1/3);
      expect(result.matchingSkillIds).toEqual(["skill_react"]);
      expect(result.missingSkillIds).toEqual(["skill_typescript", "skill_graphql"]);
    });

    it("returns 0 coverage when engineer has none of the required skills", () => {
      const result = calculateSkillCoverage(
        ["skill_react", "skill_typescript"],
        new Set(["skill_python", "skill_java"])
      );
      expect(result.coverage).toBe(0);
      expect(result.matchingSkillIds).toEqual([]);
      expect(result.missingSkillIds).toEqual(["skill_react", "skill_typescript"]);
    });

    it("returns 1.0 when job has no skill requirements", () => {
      const result = calculateSkillCoverage([], new Set(["skill_react"]));
      expect(result.coverage).toBe(1.0);
      expect(result.matchingSkillIds).toEqual([]);
      expect(result.missingSkillIds).toEqual([]);
    });

    it("handles empty engineer skills", () => {
      const result = calculateSkillCoverage(
        ["skill_react", "skill_typescript"],
        new Set()
      );
      expect(result.coverage).toBe(0);
      expect(result.matchingSkillIds).toEqual([]);
      expect(result.missingSkillIds).toEqual(["skill_react", "skill_typescript"]);
    });

    it("returns 0.5 when engineer has half the skills", () => {
      const result = calculateSkillCoverage(
        ["skill_react", "skill_typescript"],
        new Set(["skill_react"])
      );
      expect(result.coverage).toBe(0.5);
      expect(result.matchingSkillIds).toEqual(["skill_react"]);
      expect(result.missingSkillIds).toEqual(["skill_typescript"]);
    });
  });
});
