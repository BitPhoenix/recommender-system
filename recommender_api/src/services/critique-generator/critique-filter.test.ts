/**
 * Critique Filter Tests
 */

import { describe, it, expect } from 'vitest';
import { filterAndRankCritiqueSuggestions } from './critique-filter.js';
import type { DynamicCritiqueSuggestion } from '../../types/critique.types.js';

describe('critique-filter', () => {
  describe('filterAndRankCritiqueSuggestions', () => {
    const config = {
      minSupportThreshold: 0.15,
      maxSuggestions: 5,
    };

    it('should filter out suggestions below minimum support threshold', () => {
      const suggestions: DynamicCritiqueSuggestion[] = [
        {
          adjustments: [{ property: 'timezone', operation: 'set', value: 'Pacific' }],
          description: 'Require Pacific timezone',
          resultingMatches: 3,
          support: 0.10, // Below 15% threshold
          rationale: '10% of engineers',
        },
        {
          adjustments: [{ property: 'timezone', operation: 'set', value: 'Eastern' }],
          description: 'Require Eastern timezone',
          resultingMatches: 5,
          support: 0.25, // Above threshold
          rationale: '25% of engineers',
        },
      ];

      const result = filterAndRankCritiqueSuggestions(config, suggestions);

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Require Eastern timezone');
    });

    it('should sort by ascending support (low support first)', () => {
      const suggestions: DynamicCritiqueSuggestion[] = [
        {
          adjustments: [{ property: 'timezone', operation: 'set', value: 'Pacific' }],
          description: 'High support',
          resultingMatches: 10,
          support: 0.50,
          rationale: '50%',
        },
        {
          adjustments: [{ property: 'timezone', operation: 'set', value: 'Eastern' }],
          description: 'Low support',
          resultingMatches: 4,
          support: 0.20,
          rationale: '20%',
        },
        {
          adjustments: [{ property: 'timezone', operation: 'set', value: 'Central' }],
          description: 'Medium support',
          resultingMatches: 6,
          support: 0.30,
          rationale: '30%',
        },
      ];

      const result = filterAndRankCritiqueSuggestions(config, suggestions);

      expect(result).toHaveLength(3);
      expect(result[0].support).toBe(0.20); // Low support first
      expect(result[1].support).toBe(0.30);
      expect(result[2].support).toBe(0.50);
    });

    it('should limit to maxSuggestions', () => {
      const suggestions: DynamicCritiqueSuggestion[] = Array.from({ length: 10 }, (_, index) => ({
        adjustments: [{ property: 'seniority', operation: 'set', value: 'senior' }],
        description: `Suggestion ${index}`,
        resultingMatches: 5,
        support: 0.20 + index * 0.05,
        rationale: `${20 + index * 5}%`,
      }));

      const result = filterAndRankCritiqueSuggestions(config, suggestions);

      expect(result).toHaveLength(5); // maxSuggestions
    });

    it('should return empty array for empty input', () => {
      const result = filterAndRankCritiqueSuggestions(config, []);

      expect(result).toHaveLength(0);
    });

    it('should return empty array when all suggestions below threshold', () => {
      const suggestions: DynamicCritiqueSuggestion[] = [
        {
          adjustments: [{ property: 'timezone', operation: 'set', value: 'Pacific' }],
          description: 'Too low',
          resultingMatches: 1,
          support: 0.05,
          rationale: '5%',
        },
        {
          adjustments: [{ property: 'timezone', operation: 'set', value: 'Eastern' }],
          description: 'Also too low',
          resultingMatches: 2,
          support: 0.10,
          rationale: '10%',
        },
      ];

      const result = filterAndRankCritiqueSuggestions(config, suggestions);

      expect(result).toHaveLength(0);
    });

    it('should include suggestions exactly at threshold', () => {
      const suggestions: DynamicCritiqueSuggestion[] = [
        {
          adjustments: [{ property: 'timezone', operation: 'set', value: 'Pacific' }],
          description: 'Exactly at threshold',
          resultingMatches: 3,
          support: 0.15, // Exactly at threshold
          rationale: '15%',
        },
      ];

      const result = filterAndRankCritiqueSuggestions(config, suggestions);

      expect(result).toHaveLength(1);
    });
  });
});
