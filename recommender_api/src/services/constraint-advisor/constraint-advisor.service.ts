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
  isPropertyConstraint,
} from "./constraint.types.js";

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

  // Step 3: Format conflict sets for API response
  const conflictSets = formatConflictSets(minimalSets);

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
 */
function formatConflictSets(minimalSets: TestableConstraint[][]): ConflictSet[] {
  return minimalSets.map((constraints) => ({
    constraints: constraints.map((c): AppliedFilter => {
      // Handle skill traversal constraints (have skillIds)
      if (isSkillTraversalConstraint(c)) {
        return {
          kind: AppliedFilterKind.Skill,
          field: 'requiredSkills',
          operator: 'HAS_ALL',
          skills: c.skillIds.map((id: string) => ({ skillId: id, skillName: id })),
          displayValue: c.displayValue,
          source: c.source,
        };
      }

      // Property constraints - c is now narrowed to PropertyConstraint
      return {
        kind: AppliedFilterKind.Property,
        field: c.field,
        operator: c.operator,
        value: stringifyConstraintValue(c.value),
        source: c.source,
      };
    }),
    explanation: generateConflictExplanation(constraints),
  }));
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

function generateConflictExplanation(constraints: TestableConstraint[]): string {
  if (constraints.length === 1) {
    return `The constraint "${constraints[0].displayValue}" alone is too restrictive.`;
  }

  const descriptions = constraints.map((c) => c.displayValue);
  const lastDescription = descriptions.pop();
  return `The combination of ${descriptions.join(
    ", "
  )} and ${lastDescription} is too restrictive.`;
}
