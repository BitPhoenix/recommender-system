/**
 * Single-Property Critique Suggestion Generator
 *
 * Generates critique suggestions for individual critiquable properties using the shared
 * CritiqueAdjustmentCandidatePropertyConfig interface. A generic function iterates over
 * property configs, avoiding repetitive per-property functions.
 */

import type { EngineerMatch } from '../../types/search.types.js';
import type { DynamicCritiqueSuggestion } from '../../types/critique.types.js';
import {
  SINGLE_PROPERTY_CANDIDATE_CONFIGS,
  type CritiqueAdjustmentCandidatePropertyConfig,
  type CritiqueAdjustmentCandidateContext,
} from './critique-candidate-config.js';

/**
 * Generate all single-property critique suggestions.
 *
 * Iterates over all configured property types and generates suggestions for each.
 */
export function mineSinglePropertyPatterns(
  engineerMatches: EngineerMatch[],
  context: CritiqueAdjustmentCandidateContext
): DynamicCritiqueSuggestion[] {
  const allSinglePropertySuggestions: DynamicCritiqueSuggestion[] = [];

  for (const candidateConfig of SINGLE_PROPERTY_CANDIDATE_CONFIGS) {
    const suggestionsForProperty = generateCritiqueSuggestionsForProperty(
      engineerMatches,
      context,
      candidateConfig
    );
    allSinglePropertySuggestions.push(...suggestionsForProperty);
  }

  return allSinglePropertySuggestions;
}

/**
 * Generate critique suggestions for a single property type.
 *
 * For each candidate property value:
 * 1. Count engineers passing the filter
 * 2. Calculate support (percentage of matches)
 * 3. Build suggestion with adjustment, description, and rationale
 */
function generateCritiqueSuggestionsForProperty(
  engineerMatches: EngineerMatch[],
  context: CritiqueAdjustmentCandidateContext,
  candidateConfig: CritiqueAdjustmentCandidatePropertyConfig
): DynamicCritiqueSuggestion[] {
  const totalEngineerCount = engineerMatches.length;
  const suggestionsForProperty: DynamicCritiqueSuggestion[] = [];

  /*
   * Get candidate values for this property type. Examples:
   * - timezone: [{ id: 'Pacific', displayLabel: 'Pacific', matchValue: 'Pacific' }, { id: 'Eastern', ... }]
   * - seniority: [{ id: 'senior', displayLabel: 'Senior', matchValue: 6 }, { id: 'staff', displayLabel: 'Staff', matchValue: 10 }]
   * - skills: [{ id: 'skill-uuid-123', displayLabel: 'Python', matchValue: 'skill-uuid-123' }, ...]
   */
  const candidatePropertyValues = candidateConfig.getCritiqueAdjustmentCandidatePropertyValues(engineerMatches, context);

  for (const candidate of candidatePropertyValues) {
    const engineerCountPassingFilter = engineerMatches.filter(engineerMatch =>
      candidateConfig.doesEngineerPassFilter(engineerMatch, candidate)
    ).length;

    if (engineerCountPassingFilter > 0) {
      const supportRatio = engineerCountPassingFilter / totalEngineerCount;
      const supportPercentage = Math.round(supportRatio * 100);

      suggestionsForProperty.push({
        adjustments: [candidateConfig.buildCritiqueAdjustment(candidate)],
        description: candidateConfig.formatDescription(candidate),
        resultingMatches: engineerCountPassingFilter,
        support: supportRatio,
        rationale: candidateConfig.formatRationale(candidate, supportPercentage),
      });
    }
  }

  return suggestionsForProperty;
}
