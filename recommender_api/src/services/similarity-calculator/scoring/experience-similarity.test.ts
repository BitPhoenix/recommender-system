import { describe, it, expect } from 'vitest';
import { calculateExperienceSimilarity } from './experience-similarity.js';

describe('calculateExperienceSimilarity', () => {
  describe('same years', () => {
    it('returns 1.0 for identical years', () => {
      const result = calculateExperienceSimilarity(5, 5);
      expect(result.score).toBe(1);
    });

    it('returns 1.0 for 0 years both', () => {
      const result = calculateExperienceSimilarity(0, 0);
      expect(result.score).toBe(1);
    });
  });

  describe('candidate has more experience (α=0.5 reduces penalty)', () => {
    it('reduces penalty by 50% for 5 year overshoot', () => {
      // With α=0.5, diff=5, max=20: score = 1 - (5/20 * 0.5) = 1 - 0.125 = 0.875
      const result = calculateExperienceSimilarity(5, 10);
      expect(result.score).toBeCloseTo(0.875, 3);
    });

    it('reduces penalty by 50% for 10 year overshoot', () => {
      // diff=10, max=20: score = 1 - (10/20 * 0.5) = 1 - 0.25 = 0.75
      const result = calculateExperienceSimilarity(5, 15);
      expect(result.score).toBeCloseTo(0.75, 3);
    });
  });

  describe('candidate has less experience (full penalty)', () => {
    it('applies full penalty for 5 year undershoot', () => {
      // diff=5, max=20: score = 1 - 5/20 = 0.75
      const result = calculateExperienceSimilarity(10, 5);
      expect(result.score).toBe(0.75);
    });

    it('applies full penalty for 10 year undershoot', () => {
      // diff=10, max=20: score = 1 - 10/20 = 0.5
      const result = calculateExperienceSimilarity(15, 5);
      expect(result.score).toBe(0.5);
    });

    it('returns 0 for max difference (20 years under)', () => {
      const result = calculateExperienceSimilarity(20, 0);
      expect(result.score).toBe(0);
    });
  });

  describe('asymmetry demonstration', () => {
    it('penalizes undershoot more than overshoot for same diff', () => {
      const undershoot = calculateExperienceSimilarity(10, 5); // candidate 5 years less
      const overshoot = calculateExperienceSimilarity(5, 10);  // candidate 5 years more

      expect(undershoot.score).toBeLessThan(overshoot.score);
    });
  });

  describe('edge cases', () => {
    it('handles 0 target years with more candidate years', () => {
      const result = calculateExperienceSimilarity(0, 5);
      // candidate has more, so penalty reduced
      expect(result.score).toBeGreaterThan(0.8);
    });

    it('handles max years normalization', () => {
      // 20 years difference should cap at some reasonable value
      const result = calculateExperienceSimilarity(0, 20);
      expect(result.score).toBe(0.5); // 1 - (20/20 * 0.5)
    });
  });
});
