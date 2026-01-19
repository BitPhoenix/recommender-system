/**
 * Critique Filter
 *
 * Filters and ranks dynamic critique suggestions per Section 5.3.2.3.
 */

import type { DynamicCritiqueSuggestion } from '../../types/critique.types.js';

interface FilterConfig {
  minSupportThreshold: number;
  maxSuggestions: number;
}

/**
 * Filter and rank critique suggestions.
 *
 * Per textbook (p.193):
 * - Filter by minimum support threshold
 * - Order by ascending support (low-support patterns first)
 * - Return top N suggestions
 */
export function filterAndRankCritiqueSuggestions(
  config: FilterConfig,
  suggestions: DynamicCritiqueSuggestion[]
): DynamicCritiqueSuggestion[] {
  return suggestions
    .filter(suggestion => suggestion.support >= config.minSupportThreshold)
    .sort((a, b) => a.support - b.support)  // Ascending: low support first
    .slice(0, config.maxSuggestions);
}
