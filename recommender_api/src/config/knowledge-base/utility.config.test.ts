/**
 * Utility Configuration Tests
 */

import { describe, it, expect } from 'vitest';
import { getSeniorityLevelFromYears, seniorityMinYears } from './utility.config.js';

describe('utility.config', () => {
  describe('getSeniorityLevelFromYears', () => {
    it('should return junior for 0 years', () => {
      expect(getSeniorityLevelFromYears(0)).toBe('junior');
    });

    it('should return junior for 2 years', () => {
      expect(getSeniorityLevelFromYears(2)).toBe('junior');
    });

    it('should return mid for 3 years (boundary)', () => {
      expect(getSeniorityLevelFromYears(3)).toBe('mid');
    });

    it('should return mid for 5 years', () => {
      expect(getSeniorityLevelFromYears(5)).toBe('mid');
    });

    it('should return senior for 6 years (boundary)', () => {
      expect(getSeniorityLevelFromYears(6)).toBe('senior');
    });

    it('should return senior for 9 years', () => {
      expect(getSeniorityLevelFromYears(9)).toBe('senior');
    });

    it('should return staff for 10 years (boundary)', () => {
      expect(getSeniorityLevelFromYears(10)).toBe('staff');
    });

    it('should return staff for 14 years', () => {
      expect(getSeniorityLevelFromYears(14)).toBe('staff');
    });

    it('should return principal for 15 years (boundary)', () => {
      expect(getSeniorityLevelFromYears(15)).toBe('principal');
    });

    it('should return principal for 25 years', () => {
      expect(getSeniorityLevelFromYears(25)).toBe('principal');
    });

    it('should be consistent with seniorityMinYears boundaries', () => {
      // Each level should match exactly at its minYears boundary
      expect(getSeniorityLevelFromYears(seniorityMinYears.junior)).toBe('junior');
      expect(getSeniorityLevelFromYears(seniorityMinYears.mid)).toBe('mid');
      expect(getSeniorityLevelFromYears(seniorityMinYears.senior)).toBe('senior');
      expect(getSeniorityLevelFromYears(seniorityMinYears.staff)).toBe('staff');
      expect(getSeniorityLevelFromYears(seniorityMinYears.principal)).toBe('principal');
    });
  });
});
