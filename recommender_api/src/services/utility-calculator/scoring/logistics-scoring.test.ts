import { describe, it, expect } from 'vitest';
import {
  calculateStartTimelineMatch,
  calculatePreferredTimezoneMatch,
  calculatePreferredSeniorityMatch,
  calculateBudgetMatch,
} from './logistics-scoring.js';

describe('calculateStartTimelineMatch', () => {
  it('returns maxMatch when engineer timeline <= preferred', () => {
    const result = calculateStartTimelineMatch('immediate', 'two_weeks', 'one_month', 0.10);
    expect(result.raw).toBe(0.10);
    expect(result.withinPreferred).toBe(true);
  });

  it('returns maxMatch when engineer exactly at preferred', () => {
    const result = calculateStartTimelineMatch('two_weeks', 'two_weeks', 'one_month', 0.10);
    expect(result.raw).toBe(0.10);
    expect(result.withinPreferred).toBe(true);
  });

  it('returns degraded score between preferred and required', () => {
    // Timeline order: immediate < two_weeks < one_month < three_months < six_months < one_year
    const result = calculateStartTimelineMatch('one_month', 'two_weeks', 'three_months', 0.10);
    expect(result.raw).toBeGreaterThan(0);
    expect(result.raw).toBeLessThan(0.10);
    expect(result.withinPreferred).toBe(false);
  });

  it('returns 0 when engineer timeline > required', () => {
    const result = calculateStartTimelineMatch('three_months', 'two_weeks', 'one_month', 0.10);
    expect(result.raw).toBe(0);
  });

  it('returns 0 when no preferred timeline specified but required is set', () => {
    const result = calculateStartTimelineMatch('immediate', null, 'one_month', 0.10);
    expect(result.raw).toBe(0);
  });

  it('returns 0 when neither preferred nor required is specified', () => {
    const result = calculateStartTimelineMatch('immediate', null, null, 0.10);
    expect(result.raw).toBe(0);
  });

  it('handles only preferred specified', () => {
    const withinPreferred = calculateStartTimelineMatch('immediate', 'two_weeks', null, 0.10);
    expect(withinPreferred.raw).toBe(0.10);
    expect(withinPreferred.withinPreferred).toBe(true);

    const beyondPreferred = calculateStartTimelineMatch('one_month', 'two_weeks', null, 0.10);
    expect(beyondPreferred.raw).toBe(0);
    expect(beyondPreferred.withinPreferred).toBe(false);
  });
});

describe('calculatePreferredTimezoneMatch', () => {
  it('returns maxMatch for first preference', () => {
    const result = calculatePreferredTimezoneMatch(
      'Eastern',
      ['Eastern', 'Central'],
      0.03
    );
    expect(result.raw).toBe(0.03);
    expect(result.rank).toBe(0);
  });

  it('returns reduced score for second preference', () => {
    const result = calculatePreferredTimezoneMatch(
      'Central',
      ['Eastern', 'Central'],
      0.03
    );
    expect(result.raw).toBe(0.015); // (1 - 1/2) * 0.03
    expect(result.rank).toBe(1);
  });

  it('returns 0 for non-matching timezone', () => {
    const result = calculatePreferredTimezoneMatch(
      'Pacific',
      ['Eastern', 'Central'],
      0.03
    );
    expect(result.raw).toBe(0);
    expect(result.rank).toBe(-1);
  });

  it('returns 0 when no preferred timezones specified', () => {
    const result = calculatePreferredTimezoneMatch('Eastern', [], 0.03);
    expect(result.raw).toBe(0);
  });

  it('matches timezone zone exactly', () => {
    const result = calculatePreferredTimezoneMatch(
      'Mountain',
      ['Mountain'],
      0.03
    );
    expect(result.raw).toBe(0.03);
  });
});

describe('calculatePreferredSeniorityMatch', () => {
  it('returns maxMatch when engineer meets seniority threshold', () => {
    // senior requires 6 years
    const result = calculatePreferredSeniorityMatch(8, 'senior', 0.03);
    expect(result.raw).toBe(0.03);
    expect(result.matchedLevel).toBe(true);
  });

  it('returns 0 when engineer below seniority threshold', () => {
    const result = calculatePreferredSeniorityMatch(4, 'senior', 0.03);
    expect(result.raw).toBe(0);
    expect(result.matchedLevel).toBe(false);
  });

  it('returns 0 when no preferred seniority specified', () => {
    const result = calculatePreferredSeniorityMatch(10, null, 0.03);
    expect(result.raw).toBe(0);
  });

  it('handles all seniority levels correctly', () => {
    // junior: 0, mid: 3, senior: 6, staff: 10, principal: 15
    expect(calculatePreferredSeniorityMatch(0, 'junior', 0.03).raw).toBe(0.03);
    expect(calculatePreferredSeniorityMatch(2, 'mid', 0.03).raw).toBe(0);
    expect(calculatePreferredSeniorityMatch(3, 'mid', 0.03).raw).toBe(0.03);
    expect(calculatePreferredSeniorityMatch(15, 'principal', 0.03).raw).toBe(0.03);
    expect(calculatePreferredSeniorityMatch(14, 'principal', 0.03).raw).toBe(0);
  });
});

describe('calculateBudgetMatch', () => {
  it('returns maxMatch when no budget specified (fairness)', () => {
    const result = calculateBudgetMatch(150000, null, null, 0.02);
    expect(result.raw).toBe(0.02);
    expect(result.inStretchZone).toBe(false);
  });

  it('returns maxMatch when salary at or below maxBudget', () => {
    const result = calculateBudgetMatch(180000, 200000, 220000, 0.02);
    expect(result.raw).toBe(0.02);
    expect(result.inStretchZone).toBe(false);
    expect(result.inBudget).toBe(true);
  });

  it('returns degraded score in stretch zone', () => {
    const result = calculateBudgetMatch(210000, 200000, 220000, 0.02);
    expect(result.raw).toBeGreaterThan(0);
    expect(result.raw).toBeLessThan(0.02);
    expect(result.inStretchZone).toBe(true);
  });

  it('returns minimum score at stretch budget boundary', () => {
    const result = calculateBudgetMatch(220000, 200000, 220000, 0.02);
    expect(result.raw).toBe(0.01); // 0.5 * maxMatch at stretch boundary
    expect(result.inStretchZone).toBe(true);
  });

  it('handles maxBudget without stretchBudget', () => {
    const result = calculateBudgetMatch(180000, 200000, null, 0.02);
    expect(result.raw).toBe(0.02);

    const overBudget = calculateBudgetMatch(220000, 200000, null, 0.02);
    expect(overBudget.raw).toBe(0);
  });
});
