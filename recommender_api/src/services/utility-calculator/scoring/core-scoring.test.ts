import { describe, it, expect } from 'vitest';
import {
  normalizeLinear,
  normalizeLinearInverse,
  calculateConfidenceUtility,
  calculateExperienceUtility,
} from './core-scoring.js';

describe('normalizeLinear', () => {
  it('returns 0 for value at min', () => {
    expect(normalizeLinear(0, 0, 10)).toBe(0);
  });

  it('returns 1 for value at max', () => {
    expect(normalizeLinear(10, 0, 10)).toBe(1);
  });

  it('returns 0.5 for midpoint', () => {
    expect(normalizeLinear(5, 0, 10)).toBe(0.5);
  });

  it('clamps values below min to 0', () => {
    expect(normalizeLinear(-5, 0, 10)).toBe(0);
  });

  it('clamps values above max to 1', () => {
    expect(normalizeLinear(15, 0, 10)).toBe(1);
  });

  it('returns 0.5 when min equals max', () => {
    expect(normalizeLinear(5, 5, 5)).toBe(0.5);
  });
});

describe('normalizeLinearInverse', () => {
  it('returns 1 for value at min (lower is better)', () => {
    expect(normalizeLinearInverse(0, 0, 10)).toBe(1);
  });

  it('returns 0 for value at max', () => {
    expect(normalizeLinearInverse(10, 0, 10)).toBe(0);
  });

  it('returns 0.5 for midpoint', () => {
    expect(normalizeLinearInverse(5, 0, 10)).toBe(0.5);
  });

  it('returns 0.5 when min equals max', () => {
    expect(normalizeLinearInverse(5, 5, 5)).toBe(0.5);
  });
});

describe('calculateConfidenceUtility', () => {
  it('returns 0 when avgConfidence is 0 (no skill filtering)', () => {
    expect(calculateConfidenceUtility(0, 0.5, 1.0)).toBe(0);
  });

  it('returns 0 for confidence at min threshold', () => {
    expect(calculateConfidenceUtility(0.5, 0.5, 1.0)).toBe(0);
  });

  it('returns 1 for confidence at max', () => {
    expect(calculateConfidenceUtility(1.0, 0.5, 1.0)).toBe(1);
  });

  it('returns 0.5 for confidence at midpoint', () => {
    expect(calculateConfidenceUtility(0.75, 0.5, 1.0)).toBe(0.5);
  });

  it('returns 0 for negative confidence', () => {
    expect(calculateConfidenceUtility(-0.1, 0.5, 1.0)).toBe(0);
  });
});

describe('calculateExperienceUtility', () => {
  it('returns 0 for 0 years experience', () => {
    expect(calculateExperienceUtility(0, 20)).toBe(0);
  });

  it('returns 1 for max years experience', () => {
    expect(calculateExperienceUtility(20, 20)).toBe(1);
  });

  it('shows diminishing returns (logarithmic)', () => {
    const utility5 = calculateExperienceUtility(5, 20);
    const utility10 = calculateExperienceUtility(10, 20);
    const utility15 = calculateExperienceUtility(15, 20);

    // Gain from 0->5 should be larger than 5->10
    const gain0to5 = utility5;
    const gain5to10 = utility10 - utility5;
    const gain10to15 = utility15 - utility10;

    expect(gain0to5).toBeGreaterThan(gain5to10);
    expect(gain5to10).toBeGreaterThan(gain10to15);
  });

  it('caps at 1 for experience exceeding max', () => {
    expect(calculateExperienceUtility(30, 20)).toBe(1);
  });
});
