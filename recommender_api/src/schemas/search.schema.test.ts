import { describe, it, expect } from 'vitest';
import { SearchFilterRequestSchema } from './search.schema.js';

describe('SearchFilterRequestSchema', () => {
  describe('basic validation', () => {
    it('accepts empty object (unfiltered search)', () => {
      const result = SearchFilterRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts valid full request', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredSkills: [{ skill: 'typescript', minProficiency: 'proficient' }],
        preferredSkills: [{ skill: 'react' }],
        requiredSeniorityLevel: 'senior',
        requiredMaxStartTime: 'one_month',
        preferredMaxStartTime: 'two_weeks',
        requiredTimezone: ['America/*'],
        preferredTimezone: ['America/New_York'],
        maxBudget: 200000,
        stretchBudget: 220000,
        teamFocus: 'greenfield',
        limit: 20,
        offset: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('seniorityLevel validation', () => {
    it('accepts valid seniority levels', () => {
      const levels = ['junior', 'mid', 'senior', 'staff', 'principal'];
      for (const level of levels) {
        const result = SearchFilterRequestSchema.safeParse({ requiredSeniorityLevel: level });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid seniority level', () => {
      const result = SearchFilterRequestSchema.safeParse({ requiredSeniorityLevel: 'intern' });
      expect(result.success).toBe(false);
    });
  });

  describe('startTimeline validation', () => {
    it('accepts valid timeline values', () => {
      const timelines = ['immediate', 'two_weeks', 'one_month', 'three_months', 'six_months', 'one_year'];
      for (const timeline of timelines) {
        const result = SearchFilterRequestSchema.safeParse({ requiredMaxStartTime: timeline });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid timeline value', () => {
      const result = SearchFilterRequestSchema.safeParse({ requiredMaxStartTime: 'tomorrow' });
      expect(result.success).toBe(false);
    });
  });

  describe('proficiencyLevel validation', () => {
    it('accepts valid proficiency levels in skills', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredSkills: [
          { skill: 'ts', minProficiency: 'learning' },
          { skill: 'js', minProficiency: 'proficient' },
          { skill: 'py', minProficiency: 'expert' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid proficiency level', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredSkills: [{ skill: 'ts', minProficiency: 'beginner' }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('teamFocus validation', () => {
    it('accepts valid team focus values', () => {
      const focuses = ['greenfield', 'migration', 'maintenance', 'scaling'];
      for (const focus of focuses) {
        const result = SearchFilterRequestSchema.safeParse({ teamFocus: focus });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid team focus value', () => {
      const result = SearchFilterRequestSchema.safeParse({ teamFocus: 'frontend' });
      expect(result.success).toBe(false);
    });
  });

  describe('stretchBudget refinement: requires maxBudget', () => {
    it('rejects stretchBudget without maxBudget', () => {
      const result = SearchFilterRequestSchema.safeParse({
        stretchBudget: 220000,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('maxBudget');
      }
    });

    it('accepts stretchBudget with maxBudget', () => {
      const result = SearchFilterRequestSchema.safeParse({
        maxBudget: 200000,
        stretchBudget: 220000,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('stretchBudget refinement: must be >= maxBudget', () => {
    it('rejects stretchBudget less than maxBudget', () => {
      const result = SearchFilterRequestSchema.safeParse({
        maxBudget: 200000,
        stretchBudget: 180000,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('greater than or equal');
      }
    });

    it('accepts stretchBudget equal to maxBudget', () => {
      const result = SearchFilterRequestSchema.safeParse({
        maxBudget: 200000,
        stretchBudget: 200000,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('timeline refinement: preferred must be at or faster than required', () => {
    it('rejects preferredMaxStartTime slower than requiredMaxStartTime', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredMaxStartTime: 'two_weeks',
        preferredMaxStartTime: 'one_month',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at or faster');
      }
    });

    it('accepts preferredMaxStartTime faster than requiredMaxStartTime', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredMaxStartTime: 'one_month',
        preferredMaxStartTime: 'two_weeks',
      });
      expect(result.success).toBe(true);
    });

    it('accepts preferredMaxStartTime equal to requiredMaxStartTime', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredMaxStartTime: 'one_month',
        preferredMaxStartTime: 'one_month',
      });
      expect(result.success).toBe(true);
    });

    it('accepts preferredMaxStartTime without requiredMaxStartTime', () => {
      const result = SearchFilterRequestSchema.safeParse({
        preferredMaxStartTime: 'two_weeks',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('pagination validation', () => {
    it('accepts valid pagination values', () => {
      const result = SearchFilterRequestSchema.safeParse({
        limit: 50,
        offset: 100,
      });
      expect(result.success).toBe(true);
    });

    it('rejects limit below 1', () => {
      const result = SearchFilterRequestSchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects limit above 100', () => {
      const result = SearchFilterRequestSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    it('rejects negative offset', () => {
      const result = SearchFilterRequestSchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('skill requirement validation', () => {
    it('accepts skill with just name', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredSkills: [{ skill: 'typescript' }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts skill with minProficiency', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredSkills: [{ skill: 'typescript', minProficiency: 'proficient' }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts skill with preferredMinProficiency', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredSkills: [{ skill: 'typescript', preferredMinProficiency: 'expert' }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts skill with both proficiency fields', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredSkills: [{
          skill: 'typescript',
          minProficiency: 'proficient',
          preferredMinProficiency: 'expert',
        }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('domain requirement validation', () => {
    it('accepts business domain with just name', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredBusinessDomains: [{ domain: 'fintech' }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts business domain with years requirements', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredBusinessDomains: [{ domain: 'fintech', minYears: 2, preferredMinYears: 5 }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts technical domain with just name', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredTechnicalDomains: [{ domain: 'backend' }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative minYears', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredBusinessDomains: [{ domain: 'fintech', minYears: -1 }],
      });
      expect(result.success).toBe(false);
    });
  });
});
