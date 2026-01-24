import { describe, it, expect } from "vitest";
import { getUniqueSkillNames } from "../../services/job-description-processor/job-description-feature-extractor.service.js";
import type { ExtractedJobDescription } from "../../services/job-description-processor/job-description-feature-extractor.service.js";

describe("Job Description Feature Extractor", () => {
  describe("getUniqueSkillNames", () => {
    it("returns unique skill names", () => {
      const extractedJob: ExtractedJobDescription = {
        title: "Senior Engineer",
        companyName: "Test Co",
        location: "Remote",
        seniority: "senior",
        minBudget: 150000,
        maxBudget: 200000,
        startTimeline: "one_month",
        timezone: ["Eastern"],
        skills: [
          { name: "React", isRequired: true },
          { name: "TypeScript", isRequired: true },
          { name: "react", isRequired: false },  // Duplicate, different case
          { name: "Node.js", isRequired: false },
        ],
        businessDomains: [],
        technicalDomains: [],
      };

      const uniqueSkills = getUniqueSkillNames(extractedJob);
      expect(uniqueSkills).toHaveLength(3);
      expect(uniqueSkills).toContain("React");
      expect(uniqueSkills).toContain("TypeScript");
      expect(uniqueSkills).toContain("Node.js");
    });

    it("preserves original casing for first occurrence", () => {
      const extractedJob: ExtractedJobDescription = {
        title: "Engineer",
        companyName: null,
        location: null,
        seniority: "mid",
        minBudget: null,
        maxBudget: null,
        startTimeline: "one_month",
        timezone: ["Eastern"],
        skills: [
          { name: "JavaScript", isRequired: true },
          { name: "javascript", isRequired: false },
        ],
        businessDomains: [],
        technicalDomains: [],
      };

      const uniqueSkills = getUniqueSkillNames(extractedJob);
      expect(uniqueSkills).toHaveLength(1);
      expect(uniqueSkills[0]).toBe("JavaScript");  // First occurrence preserved
    });
  });
});
