import { describe, it, expect } from 'vitest';
import { calculateTimezoneSimilarity } from './timezone-similarity.js';

describe('calculateTimezoneSimilarity', () => {
  describe('same timezone', () => {
    it('returns 1.0 for same timezone (Eastern)', () => {
      const result = calculateTimezoneSimilarity('Eastern', 'Eastern');
      expect(result.score).toBe(1);
    });

    it('returns 1.0 for same timezone (Pacific)', () => {
      const result = calculateTimezoneSimilarity('Pacific', 'Pacific');
      expect(result.score).toBe(1);
    });
  });

  describe('adjacent timezones', () => {
    it('returns ~0.67 for Eastern-Central (1 zone apart)', () => {
      // maxDist = 3, distance = 1: 1 - 1/3 ≈ 0.667
      const result = calculateTimezoneSimilarity('Eastern', 'Central');
      expect(result.score).toBeCloseTo(0.667, 2);
    });

    it('returns ~0.67 for Central-Mountain (1 zone apart)', () => {
      const result = calculateTimezoneSimilarity('Central', 'Mountain');
      expect(result.score).toBeCloseTo(0.667, 2);
    });

    it('returns ~0.67 for Mountain-Pacific (1 zone apart)', () => {
      const result = calculateTimezoneSimilarity('Mountain', 'Pacific');
      expect(result.score).toBeCloseTo(0.667, 2);
    });
  });

  describe('two zones apart', () => {
    it('returns ~0.33 for Eastern-Mountain (2 zones apart)', () => {
      // maxDist = 3, distance = 2: 1 - 2/3 ≈ 0.333
      const result = calculateTimezoneSimilarity('Eastern', 'Mountain');
      expect(result.score).toBeCloseTo(0.333, 2);
    });

    it('returns ~0.33 for Central-Pacific (2 zones apart)', () => {
      const result = calculateTimezoneSimilarity('Central', 'Pacific');
      expect(result.score).toBeCloseTo(0.333, 2);
    });
  });

  describe('opposite timezones', () => {
    it('returns 0 for Eastern-Pacific (3 zones apart)', () => {
      // maxDist = 3, distance = 3: 1 - 3/3 = 0
      const result = calculateTimezoneSimilarity('Eastern', 'Pacific');
      expect(result.score).toBe(0);
    });

    it('returns 0 for Pacific-Eastern (3 zones apart)', () => {
      const result = calculateTimezoneSimilarity('Pacific', 'Eastern');
      expect(result.score).toBe(0);
    });
  });

  describe('invalid timezones', () => {
    it('returns 0 for invalid target timezone', () => {
      const result = calculateTimezoneSimilarity('InvalidTZ', 'Eastern');
      expect(result.score).toBe(0);
    });

    it('returns 0 for invalid candidate timezone', () => {
      const result = calculateTimezoneSimilarity('Eastern', 'InvalidTZ');
      expect(result.score).toBe(0);
    });

    it('returns 0 for both invalid timezones', () => {
      const result = calculateTimezoneSimilarity('InvalidA', 'InvalidB');
      expect(result.score).toBe(0);
    });
  });

  describe('symmetry', () => {
    it('is symmetric (A→B = B→A)', () => {
      const ab = calculateTimezoneSimilarity('Eastern', 'Mountain');
      const ba = calculateTimezoneSimilarity('Mountain', 'Eastern');
      expect(ab.score).toBe(ba.score);
    });
  });
});
