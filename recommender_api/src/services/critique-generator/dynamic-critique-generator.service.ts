/**
 * Dynamic Critique Generator (Section 5.3.2.3)
 *
 * Mines patterns from current search results and suggests useful critiques.
 *
 * Key insight from textbook (p.193):
 * "Many recommender systems order the critiques to the user in ascending order
 * of support. The logic for this approach is that low support critiques are
 * often less obvious patterns that can be used to eliminate a larger number
 * of items from the candidate list."
 */

import type { EngineerMatch, SearchFilterRequest } from '../../types/search.types.js';
import type { DynamicCritiqueSuggestion } from '../../types/critique.types.js';
import type { ExpandedSearchCriteria } from '../constraint-expander.service.js';
import { mineSinglePropertyPatterns } from './single-attribute-critique-generator.js';
import { mineCompoundPatterns } from './compound-critique-generator.js';
import { filterAndRankCritiqueSuggestions } from './critique-filter.js';
import { critiqueConfig } from '../../config/knowledge-base/critique.config.js';
import type { CritiqueAdjustmentCandidateContext } from './critique-candidate-config.js';

/**
 * Generate dynamic critique suggestions from current results.
 *
 * Algorithm:
 * 1. Mine single-attribute patterns (timezone, seniority, timeline, skills, budget, domains)
 * 2. Mine compound patterns (2-attribute combinations)
 * 3. Filter by minimum support threshold (15%)
 * 4. Order by ascending support (non-obvious patterns first)
 * 5. Return top 5 suggestions
 */
export function generateDynamicCritiques(
  currentMatches: EngineerMatch[],
  request: SearchFilterRequest,
  expanded: ExpandedSearchCriteria
): DynamicCritiqueSuggestion[] {
  if (currentMatches.length === 0) {
    return [];
  }

  const context: CritiqueAdjustmentCandidateContext = {
    searchFilterRequest: request,
    expandedSearchCriteria: expanded,
  };

  // Step 1: Mine single-property patterns
  const singlePropertyCritiqueSuggestions = mineSinglePropertyPatterns(
    currentMatches,
    context
  );

  // Step 2: Mine compound patterns (2-property combinations)
  const compoundCritiqueSuggestions = mineCompoundPatterns(
    currentMatches,
    context
  );

  // Step 3: Filter and rank
  const allMinedCritiqueSuggestions = [
    ...singlePropertyCritiqueSuggestions,
    ...compoundCritiqueSuggestions,
  ];
  return filterAndRankCritiqueSuggestions(
    critiqueConfig.dynamicCritiques,
    allMinedCritiqueSuggestions
  );
}
