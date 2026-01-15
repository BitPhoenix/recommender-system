import { describe, it, expect, vi } from "vitest";
import { findMinimalConflictSets } from "./quickxplain.service.js";
import {
  ConstraintType,
  PropertyFieldType,
  type DecomposedConstraints,
  type TestableConstraint,
  type NumericPropertyConstraint,
} from "./constraint.types.js";

/*
 * Mock session that returns different counts based on which constraints are active.
 * The countMap maps parameter keys (sorted) to result counts.
 */
function createMockSession(countMap: Map<string, number>) {
  return {
    run: vi
      .fn()
      .mockImplementation((query: string, params: Record<string, unknown>) => {
        // Determine which constraints are active based on params
        const activeConstraints = Object.keys(params)
          .filter((k) => k.startsWith("diag_"))
          .sort()
          .join(",");

        const count = countMap.get(activeConstraints) ?? 0;

        return {
          records: [
            {
              get: (field: string) => {
                if (field === "resultCount") {
                  return { toNumber: () => count };
                }
                return null;
              },
            },
          ],
        };
      }),
  };
}

describe("findMinimalConflictSets", () => {
  const makeConstraint = (id: string): NumericPropertyConstraint => ({
    id,
    field: id,
    operator: "=",
    value: 1,
    displayValue: `${id} = 1`,
    source: "user",
    constraintType: ConstraintType.Property,
    fieldType: PropertyFieldType.Numeric,
    cypher: {
      clause: `e.${id} = $diag_${id}`,
      paramName: `diag_${id}`,
      paramValue: 1,
    },
  });

  it("returns empty when constraints are consistent", async () => {
    const constraints: TestableConstraint[] = [makeConstraint("a"), makeConstraint("b")];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    // All combinations return sufficient results
    const countMap = new Map([
      ["diag_a,diag_b", 10], // full set
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed);

    expect(result.minimalSets).toHaveLength(0);
  });

  it("finds single-constraint conflict", async () => {
    const constraints: TestableConstraint[] = [makeConstraint("a")];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const countMap = new Map([
      ["diag_a", 0], // full set is inconsistent
      ["", 10], // empty set is consistent
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed);

    expect(result.minimalSets).toHaveLength(1);
    expect(result.minimalSets[0]).toHaveLength(1);
    expect(result.minimalSets[0][0].id).toBe("a");
  });

  it("finds two-constraint conflict", async () => {
    const constraints: TestableConstraint[] = [makeConstraint("a"), makeConstraint("b")];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const countMap = new Map([
      ["diag_a,diag_b", 0], // full set is inconsistent
      ["diag_a", 10], // a alone is consistent
      ["diag_b", 10], // b alone is consistent
      ["", 10], // empty set is consistent
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed);

    expect(result.minimalSets).toHaveLength(1);
    expect(result.minimalSets[0]).toHaveLength(2);
    const ids = result.minimalSets[0].map((c) => c.id).sort();
    expect(ids).toEqual(["a", "b"]);
  });

  it("respects maxSets configuration", async () => {
    const constraints: TestableConstraint[] = [
      makeConstraint("a"),
      makeConstraint("b"),
      makeConstraint("c"),
    ];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    // Setup: removing any single constraint yields results
    const countMap = new Map([
      ["diag_a,diag_b,diag_c", 0],
      ["diag_b,diag_c", 5],
      ["diag_a,diag_c", 5],
      ["diag_a,diag_b", 5],
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed, {
      maxSets: 2,
    });

    expect(result.minimalSets.length).toBeLessThanOrEqual(2);
  });

  it("finds multiple distinct minimal conflict sets using hitting set approach", async () => {
    /*
     * Test scenario: 4 constraints {A, B, C, D} with two distinct MCS:
     * - MCS_1 = {A, B} (A and B together cause 0 results)
     * - MCS_2 = {C, D} (C and D together cause 0 results)
     *
     * Full set {A,B,C,D} is inconsistent
     * {A,B} alone is inconsistent
     * {C,D} alone is inconsistent
     * {A,C}, {A,D}, {B,C}, {B,D} are all consistent
     */
    const constraints: TestableConstraint[] = [
      makeConstraint("a"),
      makeConstraint("b"),
      makeConstraint("c"),
      makeConstraint("d"),
    ];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const countMap = new Map([
      // Full set: inconsistent
      ["diag_a,diag_b,diag_c,diag_d", 0],
      // Remove one from {A,B}: still inconsistent due to {C,D}
      ["diag_a,diag_c,diag_d", 0],
      ["diag_b,diag_c,diag_d", 0],
      // Remove one from {C,D}: still inconsistent due to {A,B}
      ["diag_a,diag_b,diag_c", 0],
      ["diag_a,diag_b,diag_d", 0],
      // Remove one from each MCS: consistent
      ["diag_a,diag_c", 10],
      ["diag_a,diag_d", 10],
      ["diag_b,diag_c", 10],
      ["diag_b,diag_d", 10],
      // Pairs that are MCS
      ["diag_a,diag_b", 0],
      ["diag_c,diag_d", 0],
      // Singles: all consistent
      ["diag_a", 10],
      ["diag_b", 10],
      ["diag_c", 10],
      ["diag_d", 10],
      // Empty: consistent
      ["", 10],
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed, {
      maxSets: 3,
    });

    // Should find both MCS
    expect(result.minimalSets.length).toBeGreaterThanOrEqual(2);

    // Each MCS should have exactly 2 elements
    for (const mcs of result.minimalSets) {
      expect(mcs).toHaveLength(2);
    }

    // Verify we found both {A,B} and {C,D} (in some order)
    const setKeys = result.minimalSets.map((mcs) =>
      mcs
        .map((c) => c.id)
        .sort()
        .join(",")
    );
    expect(setKeys).toContain("a,b");
    expect(setKeys).toContain("c,d");
  });

  it("avoids duplicate MCS when hitting set exploration finds the same set", async () => {
    /*
     * Test scenario: 3 constraints {A, B, C} where all 3 together form
     * a single MCS (removing any one makes it consistent).
     *
     * The hitting set approach will try blocking each constraint in the MCS,
     * but should not find any new distinct MCS.
     */
    const constraints: TestableConstraint[] = [
      makeConstraint("a"),
      makeConstraint("b"),
      makeConstraint("c"),
    ];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const countMap = new Map([
      // Full set: inconsistent
      ["diag_a,diag_b,diag_c", 0],
      // Remove any one: consistent
      ["diag_a,diag_b", 10],
      ["diag_a,diag_c", 10],
      ["diag_b,diag_c", 10],
      // Singles: consistent
      ["diag_a", 10],
      ["diag_b", 10],
      ["diag_c", 10],
      ["", 10],
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed, {
      maxSets: 3,
    });

    // Should find exactly one MCS: {A, B, C}
    expect(result.minimalSets).toHaveLength(1);
    expect(result.minimalSets[0]).toHaveLength(3);
  });

  it("respects insufficientThreshold configuration", async () => {
    const constraints: TestableConstraint[] = [makeConstraint("a")];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    // With threshold=5, 2 results is still considered insufficient
    const countMap = new Map([
      ["diag_a", 2], // insufficient with threshold 5
      ["", 10], // sufficient
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed, {
      insufficientThreshold: 5,
    });

    expect(result.minimalSets).toHaveLength(1);
  });

  it("tracks query count", async () => {
    const constraints: TestableConstraint[] = [makeConstraint("a"), makeConstraint("b")];
    const decomposed: DecomposedConstraints = {
      constraints,
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const countMap = new Map([
      ["diag_a,diag_b", 10],
    ]);
    const session = createMockSession(countMap) as any;

    const result = await findMinimalConflictSets(session, decomposed);

    // At minimum, it should check the full constraint set
    expect(result.queryCount).toBeGreaterThanOrEqual(1);
  });

  it("handles empty constraint set", async () => {
    const decomposed: DecomposedConstraints = {
      constraints: [],
      baseMatchClause: "MATCH (e:Engineer)",
    };

    const session = createMockSession(new Map([["", 10]])) as any;

    const result = await findMinimalConflictSets(session, decomposed);

    expect(result.minimalSets).toHaveLength(0);
  });
});
