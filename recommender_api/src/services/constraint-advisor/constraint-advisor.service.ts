import type { Session } from "neo4j-driver";
import type {
  RelaxationResult,
  TighteningResult,
  ConflictSet,
} from "../../types/search.types.js";
import type { ExpandedSearchCriteria } from "../constraint-expander.service.js";
import {
  AppliedFilterKind,
  type AppliedFilter,
} from "../../types/search.types.js";
import { decomposeConstraints } from "./constraint-decomposer.service.js";
import { findMinimalConflictSets } from "./quickxplain.service.js";
import { generateRelaxationSuggestions } from "./relaxation-generator.service.js";
import { generateTighteningSuggestions } from "./tightening-generator.service.js";
import {
  type TestableConstraint,
  isSkillTraversalConstraint,
} from "./constraint.types.js";
import { generateConflictExplanations } from "./conflict-explanation.service.js";

/** Threshold below which relaxation advice is triggered */
const SPARSE_RESULTS_THRESHOLD = 3;

/** Threshold above which tightening suggestions are provided */
const MANY_RESULTS_THRESHOLD = 25;

export interface ConstraintAdviceInput {
  session: Session;
  totalCount: number;
  expandedSearchCriteria: ExpandedSearchCriteria;
  appliedFilters: AppliedFilter[];
}

export interface ConstraintAdviceOutput {
  relaxation?: RelaxationResult;
  tightening?: TighteningResult;
}

/**
 * Get constraint advice based on result count.
 * - If totalCount < SPARSE_RESULTS_THRESHOLD: return relaxation advice (conflicts + suggestions)
 * - If totalCount >= MANY_RESULTS_THRESHOLD: return tightening suggestions
 */
export async function getConstraintAdvice(
  input: ConstraintAdviceInput
): Promise<ConstraintAdviceOutput> {
  const { session, totalCount, expandedSearchCriteria, appliedFilters } = input;

  // Case 1: Sparse results - run conflict detection and relaxation
  if (totalCount < SPARSE_RESULTS_THRESHOLD) {
    const relaxation = await runRelaxationAnalysis(session, appliedFilters);
    return { relaxation };
  }

  // Case 2: Many results - suggest tightening
  if (totalCount >= MANY_RESULTS_THRESHOLD) {
    const tightening = await runTighteningAnalysis(session, expandedSearchCriteria, appliedFilters);
    return { tightening };
  }

  // Case 3: Goldilocks zone - no suggestions needed
  return {};
}

async function runRelaxationAnalysis(
  session: Session,
  appliedFilters: AppliedFilter[]
): Promise<RelaxationResult> {
  // Step 1: Decompose constraints - skill IDs now embedded in AppliedSkillFilter
  const decomposed = decomposeConstraints(appliedFilters);

  // Step 2: Find minimal conflict sets using QUICKXPLAIN
  const { minimalSets } = await findMinimalConflictSets(session, decomposed, {
    maxSets: 3,
    insufficientThreshold: SPARSE_RESULTS_THRESHOLD,
  });

  // Step 3: Format conflict sets for API response with dual explanations
  const conflictSets = await formatConflictSets(
    session,
    decomposed.constraints,
    minimalSets
  );

  // Step 4: Get unique constraints for relaxation suggestions
  const uniqueConstraints = [
    ...new Map(minimalSets.flat().map((c) => [c.id, c])).values(),
  ];

  // Step 5: Generate relaxation suggestions
  const suggestions = await generateRelaxationSuggestions(
    session,
    decomposed,
    uniqueConstraints
  );

  return {
    conflictAnalysis: { conflictSets },
    suggestions,
  };
}

/**
 * Format minimal conflict sets into API response format.
 * Generates dual explanations (data-aware + LLM) for each conflict set.
 *
 * Note: Neo4j sessions are not thread-safe for concurrent queries,
 * so we process conflict sets sequentially rather than with Promise.all.
 */
async function formatConflictSets(
  session: Session,
  allConstraints: TestableConstraint[],
  minimalSets: TestableConstraint[][]
): Promise<ConflictSet[]> {
  const results: ConflictSet[] = [];

  for (const conflictSetConstraints of minimalSets) {
    const { dataAwareExplanation, llmExplanation, stats } =
      await generateConflictExplanations(
        session,
        allConstraints,
        conflictSetConstraints
      );

    results.push({
      constraints: conflictSetConstraints.map((c): AppliedFilter => {
        if (isSkillTraversalConstraint(c)) {
          return {
            kind: AppliedFilterKind.Skill,
            field: "requiredSkills",
            operator: "HAS_ALL",
            skills: c.skillIds.map((id: string) => ({
              skillId: id,
              skillName: id,
            })),
            displayValue: c.displayValue,
            source: c.source,
          };
        }

        return {
          kind: AppliedFilterKind.Property,
          field: c.field,
          operator: c.operator,
          value: stringifyConstraintValue(c.value),
          source: c.source,
        };
      }),
      dataAwareExplanation,
      llmExplanation,
      stats,
    });
  }

  return results;
}

/**
 * Convert constraint value to string for AppliedFilter.
 * Arrays are JSON-stringified to match existing AppliedFilter conventions.
 */
function stringifyConstraintValue(value: number | string | string[]): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return String(value);
}

async function runTighteningAnalysis(
  session: Session,
  expandedSearchCriteria: ExpandedSearchCriteria,
  appliedFilters: AppliedFilter[]
): Promise<TighteningResult> {
  const suggestions = await generateTighteningSuggestions(
    session,
    expandedSearchCriteria,
    appliedFilters
  );

  return { suggestions };
}

