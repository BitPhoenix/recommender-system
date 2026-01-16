/*
 * QuickXplain Algorithm Implementation
 *
 * For a detailed walkthrough of how this algorithm works with a worked example,
 * see: docs/quickxplain_explanation.md
 */

import type { Session } from "neo4j-driver";
import type {
  TestableConstraint,
  DecomposedConstraints,
} from "./constraint.types.js";
import { buildQueryWithConstraints } from "./constraint-decomposer.service.js";
import { toNumber } from "../engineer-record-parser.js";

/**
 * Result of QUICKXPLAIN analysis.
 */
export interface QuickXplainResult {
  /** Minimal inconsistent sets found (up to maxSets) */
  minimalSets: TestableConstraint[][];
  /** Number of queries executed during analysis */
  queryCount: number;
}

/**
 * Configuration for QUICKXPLAIN execution.
 */
interface QuickXplainConfig {
  /** Maximum number of minimal sets to find */
  maxSets: number;
  /** Threshold below which results are considered "insufficient" */
  insufficientThreshold: number;
}

const DEFAULT_CONFIG: QuickXplainConfig = {
  maxSets: 3,
  insufficientThreshold: 3,
};

/**
 * Executes QUICKXPLAIN algorithm to find minimal inconsistent constraint sets.
 *
 * Based on: Junker, U. (2004). "QuickXPlain: Preferred explanations and
 * relaxations for over-constrained problems." AAAI-04.
 *
 * @param session Neo4j session for executing count queries
 * @param decomposed Decomposed constraints from the search request
 * @param config Algorithm configuration
 * @returns Minimal inconsistent sets found
 */
export async function findMinimalConflictSets(
  session: Session,
  decomposed: DecomposedConstraints,
  config: Partial<QuickXplainConfig> = {}
): Promise<QuickXplainResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const constraints = decomposed.constraints;

  let queryCount = 0;
  const minimalSets: TestableConstraint[][] = [];

  // Helper: count results with given constraint IDs
  async function countResults(constraintIds: Set<string>): Promise<number> {
    queryCount++;
    const { query, params } = buildQueryWithConstraints(
      decomposed,
      constraintIds
    );
    const result = await session.run(query, params);
    return toNumber(result.records[0]?.get("resultCount"));
  }

  // Helper: check if constraint set is consistent (returns sufficient results)
  async function isConsistent(constraintIds: Set<string>): Promise<boolean> {
    const count = await countResults(constraintIds);
    return count >= cfg.insufficientThreshold;
  }

  /*
   * QUICKXPLAIN recursive function - finds a minimal subset of candidates that,
   * combined with background, creates an inconsistency.
   *
   * Parameters explained:
   *
   * BACKGROUND (B): Constraints we've already committed to as part of the
   *   conflict we're building. Always included in consistency tests. Grows
   *   as we recurse deeper and confirm constraints belong in the minimal set.
   *
   * DELTA (Δ): The constraints most recently moved from candidates into
   *   background. Enables the key optimization: if B alone is inconsistent
   *   after adding Δ, we can stop early—the conflict was already minimal
   *   before we even looked at the current candidates.
   *
   * CANDIDATES (C): Constraints we're still searching through. Each recursive
   *   call splits these in half, achieving O(k·log(n/k)) queries where k is
   *   the minimal conflict size and n is total constraints.
   *
   * The algorithm: Split candidates into left/right halves. First search
   * right half (with left added to background). Whatever we find from right,
   * add to background and search left. Combine results.
   */
  async function quickXplain(
    background: TestableConstraint[],
    delta: TestableConstraint[],
    candidates: TestableConstraint[]
  ): Promise<TestableConstraint[] | null> {
    /*
     * Early termination check (the "delta optimization"):
     * If we just added delta to background and background alone is now
     * inconsistent, we can return [] immediately. Why? Because we've been
     * searching candidates to find what makes things inconsistent, but the
     * inconsistency is already in background—no candidates needed.
     *
     * We only check when delta is non-empty to avoid redundant checks at
     * the top level (where background starts empty anyway).
     */
    if (delta.length > 0) {
      const bgIds = new Set(background.map((c) => c.id));
      if (!(await isConsistent(bgIds))) {
        return [];
      }
    }

    /* Base case: single candidate must be the culprit */
    if (candidates.length === 1) {
      return candidates;
    }

    /* Base case: no candidates means no conflict found in this branch */
    if (candidates.length === 0) {
      return null;
    }

    /* Divide and conquer: split candidates in half */
    const mid = Math.floor(candidates.length / 2);
    const left = candidates.slice(0, mid);
    const right = candidates.slice(mid);

    /*
     * Step 1: Search the RIGHT half for conflicts.
     * We add LEFT to background (assume left is needed) and search right.
     * Delta = left, meaning "we just added left to background."
     */
    const rightResult = await quickXplain(
      [...background, ...left],
      left,
      right
    );

    if (rightResult === null) {
      return null;
    }

    /*
     * Step 2: Search the LEFT half for conflicts.
     * Now add rightResult to background (confirmed from step 1) and search left.
     * This finds which constraints from left are actually needed.
     */
    const leftResult = await quickXplain(
      [...background, ...rightResult],
      rightResult,
      left
    );

    if (leftResult === null) {
      return rightResult;
    }

    /* Combine: constraints from both halves form the minimal set */
    return [...leftResult, ...rightResult];
  }

  /* Pre-check: verify the full constraint set is actually inconsistent */
  const allIds = new Set(constraints.map((c) => c.id));
  if (await isConsistent(allIds)) {
    return { minimalSets: [], queryCount };
  }

  /*
   * Find the first minimal conflict set.
   * Initial call: B=[] (no committed constraints yet), Δ=[] (nothing just added),
   * C=all constraints (search through everything).
   */
  const firstSet = await quickXplain([], [], constraints);
  if (firstSet && firstSet.length > 0) {
    minimalSets.push(firstSet);
  }

  /*
   * Find additional minimal conflict sets using the "hitting set" approach.
   *
   * After finding MCS_1, we need to find MCS_2 such that MCS_2 ≠ MCS_1.
   * The key insight: any solution must "hit" (include at least one constraint from)
   * every MCS. So to find a different MCS, we block the first one by requiring
   * at least one of its constraints to be absent.
   *
   * Algorithm: For each constraint c_i in MCS_1:
   *   - Remove c_i from the candidate set
   *   - Run QUICKXPLAIN on remaining constraints
   *   - If a new MCS is found and it's not a duplicate, add it
   *
   * This guarantees we find true minimal conflict sets, not approximations.
   */
  if (minimalSets.length < cfg.maxSets && firstSet && firstSet.length > 0) {
    const foundSetKeys = new Set<string>();
    foundSetKeys.add(serializeConstraintSet(firstSet));

    for (const blockedConstraint of firstSet) {
      if (minimalSets.length >= cfg.maxSets) break;

      /*
       * To find a different MCS, we "block" the first one by excluding
       * one of its constraints. Any MCS found in the remaining constraints
       * must be different from MCS₁ (since it can't contain blockedConstraint).
       *
       * Example: If MCS₁ = {A, B}, we try:
       *   - Search {B, C, D, E, ...} (without A) → might find MCS₂
       *   - Search {A, C, D, E, ...} (without B) → might find MCS₃
       */
      const remainingConstraints = constraints.filter(
        (c) => c.id !== blockedConstraint.id
      );

      /*
       * Optimization: Before running QUICKXPLAIN, check if the remaining
       * constraints are even inconsistent. If removing blockedConstraint
       * makes everything consistent (>= threshold results), then there's
       * no conflict to find in this subset - skip it.
       */
      const remainingIds = new Set(remainingConstraints.map((c) => c.id));
      if (await isConsistent(remainingIds)) {
        continue;
      }

      // The remaining set is still inconsistent - find the MCS within it
      const newSet = await quickXplain([], [], remainingConstraints);
      if (newSet && newSet.length > 0) {
        const setKey = serializeConstraintSet(newSet);
        if (!foundSetKeys.has(setKey)) {
          foundSetKeys.add(setKey);
          minimalSets.push(newSet);
        }
      }
    }
  }

  return { minimalSets: minimalSets.slice(0, cfg.maxSets), queryCount };
}

/**
 * Serialize a constraint set to a string for deduplication.
 * Sorted by ID to ensure consistent ordering.
 */
function serializeConstraintSet(constraints: TestableConstraint[]): string {
  return constraints
    .map((c) => c.id)
    .sort()
    .join(",");
}
