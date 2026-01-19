/**
 * Compound Critique Generator
 *
 * Generates 2-property combination critique suggestions.
 * Per textbook p.193, dynamic critiques are "by definition" compound.
 *
 * Uses the shared CritiqueAdjustmentCandidatePropertyConfig from critique-candidate-config.ts,
 * which defines how each property type generates candidate values.
 */

import type { EngineerMatch } from '../../types/search.types.js';
import type { DynamicCritiqueSuggestion } from '../../types/critique.types.js';
import {
  COMPOUND_PROPERTY_PAIRS,
  type CritiqueAdjustmentCandidatePropertyConfig,
  type CritiqueAdjustmentCandidatePropertyValue,
  type CritiqueAdjustmentCandidateContext,
} from './critique-candidate-config.js';

// ============================================
// PUBLIC API
// ============================================

/**
 * Generate compound critique suggestions (2-property combinations).
 *
 * Compound patterns like "Senior + Pacific timezone" are often more valuable
 * because they're less obvious and eliminate more items.
 *
 * We limit to 2-property combinations to avoid combinatorial explosion.
 */
export function mineCompoundPatterns(
  engineerMatches: EngineerMatch[],
  context: CritiqueAdjustmentCandidateContext
): DynamicCritiqueSuggestion[] {
  const allCompoundSuggestions: DynamicCritiqueSuggestion[] = [];

  for (const [firstCandidateConfig, secondCandidateConfig] of COMPOUND_PROPERTY_PAIRS) {
    const suggestionsForPair = generateCompoundCritiqueSuggestionsForPropertyPair(
      engineerMatches,
      context,
      firstCandidateConfig,
      secondCandidateConfig
    );
    allCompoundSuggestions.push(...suggestionsForPair);
  }

  return allCompoundSuggestions;
}

// ============================================
// COMPOUND CRITIQUE SUGGESTION GENERATOR
// ============================================

/**
 * Generate compound critique suggestions for a specific pair of properties.
 *
 * Iterates over the cartesian product of candidate property values from both properties,
 * counting engineers that pass both filters and building suggestions.
 */
function generateCompoundCritiqueSuggestionsForPropertyPair(
  engineerMatches: EngineerMatch[],
  context: CritiqueAdjustmentCandidateContext,
  firstCandidateConfig: CritiqueAdjustmentCandidatePropertyConfig,
  secondCandidateConfig: CritiqueAdjustmentCandidatePropertyConfig
): DynamicCritiqueSuggestion[] {
  const totalEngineerCount = engineerMatches.length;
  const suggestionsForPair: DynamicCritiqueSuggestion[] = [];

  const firstCandidatePropertyValues = firstCandidateConfig.getCritiqueAdjustmentCandidatePropertyValues(engineerMatches, context);
  const secondCandidatePropertyValues = secondCandidateConfig.getCritiqueAdjustmentCandidatePropertyValues(engineerMatches, context);

  for (const firstCandidate of firstCandidatePropertyValues) {
    for (const secondCandidate of secondCandidatePropertyValues) {
      const engineerCountPassingBothFilters = engineerMatches.filter(engineerMatch =>
        firstCandidateConfig.doesEngineerPassFilter(engineerMatch, firstCandidate) &&
        secondCandidateConfig.doesEngineerPassFilter(engineerMatch, secondCandidate)
      ).length;

      if (engineerCountPassingBothFilters > 0) {
        const supportRatio = engineerCountPassingBothFilters / totalEngineerCount;
        const supportPercentage = Math.round(supportRatio * 100);

        suggestionsForPair.push({
          adjustments: [
            firstCandidateConfig.buildCritiqueAdjustment(firstCandidate),
            secondCandidateConfig.buildCritiqueAdjustment(secondCandidate),
          ],
          description: formatCompoundDescription(firstCandidate, secondCandidate, firstCandidateConfig, secondCandidateConfig),
          resultingMatches: engineerCountPassingBothFilters,
          support: supportRatio,
          rationale: `${supportPercentage}% of engineers match both ${firstCandidate.displayLabel} and ${secondCandidate.displayLabel}`,
        });
      }
    }
  }

  return suggestionsForPair;
}

/**
 * Format a human-readable description for a compound suggestion.
 *
 * Produces natural descriptions like:
 * - "Senior-level engineers in Pacific timezone" (seniority + timezone)
 * - "Python developers in Eastern timezone" (skills + timezone)
 * - "Senior-level Python developers" (seniority + skills)
 */
function formatCompoundDescription(
  firstCandidate: CritiqueAdjustmentCandidatePropertyValue,
  secondCandidate: CritiqueAdjustmentCandidatePropertyValue,
  firstConfig: CritiqueAdjustmentCandidatePropertyConfig,
  secondConfig: CritiqueAdjustmentCandidatePropertyConfig
): string {
  const firstKey = firstConfig.propertyKey;
  const secondKey = secondConfig.propertyKey;

  /*
   * Order matters for readability. We want descriptions like:
   * - "Senior Python developers" not "Python senior developers"
   * - "Python developers in Pacific" not "Pacific Python developers"
   */
  if (firstKey === 'timezone' && secondKey === 'seniority') {
    return `${secondCandidate.displayLabel}-level engineers in ${firstCandidate.displayLabel} timezone`;
  }
  if (firstKey === 'skills' && secondKey === 'timezone') {
    return `${firstCandidate.displayLabel} developers in ${secondCandidate.displayLabel} timezone`;
  }
  if (firstKey === 'skills' && secondKey === 'seniority') {
    return `${secondCandidate.displayLabel}-level ${firstCandidate.displayLabel} developers`;
  }

  // Fallback for any future attribute combinations
  return `${firstCandidate.displayLabel} + ${secondCandidate.displayLabel}`;
}
