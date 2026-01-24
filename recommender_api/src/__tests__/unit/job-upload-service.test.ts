import { describe, it, expect } from "vitest";

/*
 * Test the joinNormalizedWithExtracted helper function.
 * Since it's not exported, we test its behavior indirectly through a local implementation.
 * This validates the algorithm used in job-upload.service.ts.
 */

function joinNormalizedWithExtracted<TNormalized extends { originalName: string }, TExtracted, TRelationship>(
  normalizedItems: TNormalized[],
  extractedLookup: Map<string, TExtracted>,
  buildRelationship: (normalized: TNormalized, extracted: TExtracted) => TRelationship | null
): TRelationship[] {
  return normalizedItems
    .map((normalized) => {
      const extracted = extractedLookup.get(normalized.originalName.toLowerCase());
      if (!extracted) return null;
      return buildRelationship(normalized, extracted);
    })
    .filter((item): item is TRelationship => item !== null);
}

describe("Job Upload Service Helpers", () => {
  describe("joinNormalizedWithExtracted", () => {
    it("joins normalized items with extracted info", () => {
      const normalizedItems = [
        { originalName: "TypeScript", canonicalId: "skill_typescript" },
        { originalName: "React", canonicalId: "skill_react" },
      ];
      const extractedLookup = new Map([
        ["typescript", { isRequired: true, minProficiency: "expert" }],
        ["react", { isRequired: false, minProficiency: "proficient" }],
      ]);

      const result = joinNormalizedWithExtracted(
        normalizedItems,
        extractedLookup,
        (normalized, extracted) => ({
          canonicalId: normalized.canonicalId,
          isRequired: extracted.isRequired,
          minProficiency: extracted.minProficiency,
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        canonicalId: "skill_typescript",
        isRequired: true,
        minProficiency: "expert",
      });
      expect(result[1]).toEqual({
        canonicalId: "skill_react",
        isRequired: false,
        minProficiency: "proficient",
      });
    });

    it("filters out items not found in extractedLookup", () => {
      const normalizedItems = [
        { originalName: "TypeScript", canonicalId: "skill_typescript" },
        { originalName: "Unknown", canonicalId: "skill_unknown" },
      ];
      const extractedLookup = new Map([
        ["typescript", { isRequired: true }],
        // "unknown" not in lookup
      ]);

      const result = joinNormalizedWithExtracted(
        normalizedItems,
        extractedLookup,
        (normalized, extracted) => ({
          canonicalId: normalized.canonicalId,
          isRequired: extracted.isRequired,
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].canonicalId).toBe("skill_typescript");
    });

    it("filters out items when buildRelationship returns null", () => {
      const normalizedItems = [
        { originalName: "TypeScript", canonicalId: "skill_typescript" },
        { originalName: "React", canonicalId: null }, // No canonical ID
      ];
      const extractedLookup = new Map([
        ["typescript", { isRequired: true }],
        ["react", { isRequired: false }],
      ]);

      const result = joinNormalizedWithExtracted(
        normalizedItems,
        extractedLookup,
        (normalized, extracted) => {
          if (!normalized.canonicalId) return null;
          return {
            canonicalId: normalized.canonicalId,
            isRequired: extracted.isRequired,
          };
        }
      );

      expect(result).toHaveLength(1);
      expect(result[0].canonicalId).toBe("skill_typescript");
    });

    it("handles case-insensitive lookup", () => {
      const normalizedItems = [
        { originalName: "TYPESCRIPT", canonicalId: "skill_typescript" },
      ];
      const extractedLookup = new Map([
        ["typescript", { isRequired: true }], // lowercase key
      ]);

      const result = joinNormalizedWithExtracted(
        normalizedItems,
        extractedLookup,
        (normalized, extracted) => ({
          canonicalId: normalized.canonicalId,
          isRequired: extracted.isRequired,
        })
      );

      expect(result).toHaveLength(1);
    });

    it("returns empty array when no matches", () => {
      const normalizedItems = [
        { originalName: "TypeScript", canonicalId: "skill_typescript" },
      ];
      const extractedLookup = new Map<string, { isRequired: boolean }>();

      const result = joinNormalizedWithExtracted(
        normalizedItems,
        extractedLookup,
        (normalized, extracted) => ({
          canonicalId: normalized.canonicalId,
          isRequired: extracted.isRequired,
        })
      );

      expect(result).toHaveLength(0);
    });
  });
});
