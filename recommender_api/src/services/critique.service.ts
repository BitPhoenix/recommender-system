/**
 * Critique Service (Section 5.3.2)
 *
 * Orchestrates the full critique flow:
 * 1. Apply adjustments to base search
 * 2. Execute modified search (includes getting previous count)
 * 3. Generate dynamic critique suggestions
 * 4. Assemble response
 */

import type { Session } from 'neo4j-driver';
import type { CritiqueRequest, CritiqueResponse, DynamicCritiqueSuggestion } from '../types/critique.types.js';
import { applyAdjustmentsToSearchCriteria } from './critique-interpreter.service.js';
import { executeSearch, getSearchResultCount } from './search.service.js';
import { generateDynamicCritiques } from './critique-generator/dynamic-critique-generator.service.js';

/**
 * Execute a critique operation.
 *
 * Flow:
 * 1. Get baseline count from base search
 * 2. Apply critique adjustments to modify the search
 * 3. Execute modified search through existing pipeline
 * 4. Generate dynamic critique suggestions
 * 5. Assemble response with critique metadata
 */
export async function executeCritique(
  session: Session,
  request: CritiqueRequest
): Promise<CritiqueResponse> {
  const startTime = Date.now();

  // Step 1: Get baseline count (execute base search without modifications)
  const previousResultCount = await getSearchResultCount(session, request.baseSearch);

  // Step 2: Interpret critique adjustments into search criteria changes
  const { modifiedSearchFilterRequest, appliedCritiqueAdjustments, failedCritiqueAdjustments } = applyAdjustmentsToSearchCriteria(
    request.baseSearch,
    request.adjustments
  );

  // Step 3: Execute search with modified criteria
  const searchResult = await executeSearch(session, {
    ...modifiedSearchFilterRequest,
    limit: request.limit ?? 10,
    offset: request.offset ?? 0,
  });

  // Step 4: Generate dynamic critique suggestions
  let suggestedCritiques: DynamicCritiqueSuggestion[] | undefined;

  if (searchResult.matches.length > 0 && searchResult.expandedCriteria) {
    suggestedCritiques = generateDynamicCritiques(
      searchResult.matches,
      modifiedSearchFilterRequest,       // Modified request (for accessing requiredSkills, requiredBusinessDomains, etc.)
      searchResult.expandedCriteria      // Expanded/derived values (for timezoneZones, minYearsExperience, etc.)
    );
  }

  // Step 5: Assemble response
  const executionTimeMs = Date.now() - startTime;

  return {
    matches: searchResult.matches,
    totalCount: searchResult.totalCount,
    appliedFilters: searchResult.appliedFilters,
    appliedPreferences: searchResult.appliedPreferences,
    derivedConstraints: searchResult.derivedConstraints,
    appliedCritiqueAdjustments,
    failedCritiqueAdjustments,
    suggestedCritiques: suggestedCritiques?.length ? suggestedCritiques : undefined,
    relaxation: searchResult.relaxation,
    tightening: searchResult.tightening,
    queryMetadata: {
      ...searchResult.queryMetadata,
      executionTimeMs,
      previousResultCount,
      resultCountChange: searchResult.totalCount - previousResultCount,
    },
  };
}
