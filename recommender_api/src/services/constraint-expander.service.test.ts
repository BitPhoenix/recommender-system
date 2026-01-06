import { describe, it, expect } from 'vitest';
import { expandSearchCriteria } from './constraint-expander.service.js';

describe('expandSearchCriteria', () => {
  describe('seniority expansion', () => {
    it('maps junior to 0-3 years', () => {
      const result = expandSearchCriteria({ requiredSeniorityLevel: 'junior' });
      expect(result.minYearsExperience).toBe(0);
      expect(result.maxYearsExperience).toBe(3);
    });

    it('maps mid to 3-6 years', () => {
      const result = expandSearchCriteria({ requiredSeniorityLevel: 'mid' });
      expect(result.minYearsExperience).toBe(3);
      expect(result.maxYearsExperience).toBe(6);
    });

    it('maps senior to 6-10 years', () => {
      const result = expandSearchCriteria({ requiredSeniorityLevel: 'senior' });
      expect(result.minYearsExperience).toBe(6);
      expect(result.maxYearsExperience).toBe(10);
    });

    it('maps staff to 10+ years (no max)', () => {
      const result = expandSearchCriteria({ requiredSeniorityLevel: 'staff' });
      expect(result.minYearsExperience).toBe(10);
      expect(result.maxYearsExperience).toBeNull();
    });

    it('maps principal to 15+ years (no max)', () => {
      const result = expandSearchCriteria({ requiredSeniorityLevel: 'principal' });
      expect(result.minYearsExperience).toBe(15);
      expect(result.maxYearsExperience).toBeNull();
    });

    it('returns null years for no seniority level', () => {
      const result = expandSearchCriteria({});
      expect(result.minYearsExperience).toBeNull();
      expect(result.maxYearsExperience).toBeNull();
    });
  });

  describe('start timeline expansion', () => {
    it('returns all timelines up to and including required', () => {
      const result = expandSearchCriteria({ requiredMaxStartTime: 'one_month' });
      expect(result.startTimeline).toEqual(['immediate', 'two_weeks', 'one_month']);
    });

    it('returns only immediate for immediate requirement', () => {
      const result = expandSearchCriteria({ requiredMaxStartTime: 'immediate' });
      expect(result.startTimeline).toEqual(['immediate']);
    });

    it('returns all timelines up to three_months', () => {
      const result = expandSearchCriteria({ requiredMaxStartTime: 'three_months' });
      expect(result.startTimeline).toEqual(['immediate', 'two_weeks', 'one_month', 'three_months']);
    });

    it('uses default when no requirement specified', () => {
      const result = expandSearchCriteria({});
      // Default is 'one_year' which includes all timelines
      expect(result.startTimeline).toBeDefined();
      expect(result.startTimeline.length).toBeGreaterThan(0);
      expect(result.defaultsApplied).toContain('requiredMaxStartTime');
    });
  });

  describe('timezone expansion', () => {
    it('returns empty array for no timezone requirement', () => {
      const result = expandSearchCriteria({});
      expect(result.timezonePrefixes).toEqual([]);
    });

    it('expands America/* to America/ prefix', () => {
      const result = expandSearchCriteria({ requiredTimezone: ['America/*'] });
      expect(result.timezonePrefixes).toEqual(['America/']);
    });

    it('expands Europe/* to Europe/ prefix', () => {
      const result = expandSearchCriteria({ requiredTimezone: ['Europe/*'] });
      expect(result.timezonePrefixes).toEqual(['Europe/']);
    });

    it('keeps specific timezone as-is', () => {
      const result = expandSearchCriteria({ requiredTimezone: ['America/New_York'] });
      expect(result.timezonePrefixes).toEqual(['America/New_York']);
    });

    it('handles multiple patterns', () => {
      const result = expandSearchCriteria({ requiredTimezone: ['America/*', 'Europe/*'] });
      expect(result.timezonePrefixes).toEqual(['America/', 'Europe/']);
    });
  });

  describe('budget expansion', () => {
    it('returns null for no budget', () => {
      const result = expandSearchCriteria({});
      expect(result.maxBudget).toBeNull();
      expect(result.stretchBudget).toBeNull();
    });

    it('sets maxBudget when provided', () => {
      const result = expandSearchCriteria({ maxBudget: 200000 });
      expect(result.maxBudget).toBe(200000);
      expect(result.stretchBudget).toBeNull();
    });

    it('sets both budgets when provided', () => {
      const result = expandSearchCriteria({ maxBudget: 200000, stretchBudget: 220000 });
      expect(result.maxBudget).toBe(200000);
      expect(result.stretchBudget).toBe(220000);
    });
  });

  describe('team focus expansion', () => {
    it('returns empty array for no team focus', () => {
      const result = expandSearchCriteria({});
      expect(result.alignedSkillIds).toEqual([]);
    });

    it('returns skill IDs for greenfield focus', () => {
      const result = expandSearchCriteria({ teamFocus: 'greenfield' });
      expect(result.alignedSkillIds).toBeDefined();
      expect(result.alignedSkillIds.length).toBeGreaterThan(0);
    });

    it('returns skill IDs for maintenance focus', () => {
      const result = expandSearchCriteria({ teamFocus: 'maintenance' });
      expect(result.alignedSkillIds).toBeDefined();
      expect(result.alignedSkillIds.length).toBeGreaterThan(0);
    });
  });

  describe('pagination expansion', () => {
    it('uses defaults when not specified', () => {
      const result = expandSearchCriteria({});
      expect(result.limit).toBe(20); // default
      expect(result.offset).toBe(0); // default
      expect(result.defaultsApplied).toContain('limit');
      expect(result.defaultsApplied).toContain('offset');
    });

    it('uses provided values', () => {
      const result = expandSearchCriteria({ limit: 50, offset: 100 });
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(100);
    });

    it('caps limit at 100', () => {
      const result = expandSearchCriteria({ limit: 500 });
      expect(result.limit).toBe(100);
    });
  });

  describe('applied filters tracking', () => {
    it('tracks seniority as a filter', () => {
      const result = expandSearchCriteria({ requiredSeniorityLevel: 'senior' });
      const filter = result.appliedFilters.find(f => f.field === 'yearsExperience');
      expect(filter).toBeDefined();
      expect(filter!.source).toBe('knowledge_base');
    });

    it('tracks timezone as a filter', () => {
      const result = expandSearchCriteria({ requiredTimezone: ['America/*'] });
      const filter = result.appliedFilters.find(f => f.field === 'timezone');
      expect(filter).toBeDefined();
      expect(filter!.source).toBe('user');
    });

    it('tracks budget as a filter', () => {
      const result = expandSearchCriteria({ maxBudget: 200000 });
      const filter = result.appliedFilters.find(f => f.field === 'salary');
      expect(filter).toBeDefined();
      expect(filter!.operator).toBe('<=');
    });
  });

  describe('applied preferences tracking', () => {
    it('tracks preferredMaxStartTime as a preference', () => {
      const result = expandSearchCriteria({ preferredMaxStartTime: 'two_weeks' });
      const pref = result.appliedPreferences.find(p => p.field === 'preferredMaxStartTime');
      expect(pref).toBeDefined();
      expect(pref!.value).toBe('two_weeks');
    });

    it('tracks preferredTimezone as a preference', () => {
      const result = expandSearchCriteria({ preferredTimezone: ['America/New_York'] });
      const pref = result.appliedPreferences.find(p => p.field === 'preferredTimezone');
      expect(pref).toBeDefined();
    });

    it('tracks preferredSeniorityLevel as a preference', () => {
      const result = expandSearchCriteria({ preferredSeniorityLevel: 'senior' });
      const pref = result.appliedPreferences.find(p => p.field === 'preferredSeniorityLevel');
      expect(pref).toBeDefined();
      expect(pref!.value).toBe('senior');
    });

    it('tracks teamFocus as a preference', () => {
      const result = expandSearchCriteria({ teamFocus: 'greenfield' });
      const pref = result.appliedPreferences.find(p => p.field === 'teamFocusMatch');
      expect(pref).toBeDefined();
    });
  });

  describe('pass-through values', () => {
    it('passes through preferredSeniorityLevel', () => {
      const result = expandSearchCriteria({ preferredSeniorityLevel: 'senior' });
      expect(result.preferredSeniorityLevel).toBe('senior');
    });

    it('passes through preferredMaxStartTime', () => {
      const result = expandSearchCriteria({ preferredMaxStartTime: 'two_weeks' });
      expect(result.preferredMaxStartTime).toBe('two_weeks');
    });

    it('passes through preferredTimezone', () => {
      const result = expandSearchCriteria({ preferredTimezone: ['America/New_York', 'America/Chicago'] });
      expect(result.preferredTimezone).toEqual(['America/New_York', 'America/Chicago']);
    });

    it('sets requiredMaxStartTime from input or default', () => {
      const withRequired = expandSearchCriteria({ requiredMaxStartTime: 'one_month' });
      expect(withRequired.requiredMaxStartTime).toBe('one_month');

      const withDefault = expandSearchCriteria({});
      expect(withDefault.requiredMaxStartTime).toBe('one_year'); // default
    });
  });

  describe('full request expansion', () => {
    it('expands a complete request correctly', () => {
      const result = expandSearchCriteria({
        requiredSeniorityLevel: 'senior',
        requiredMaxStartTime: 'one_month',
        preferredMaxStartTime: 'two_weeks',
        requiredTimezone: ['America/*'],
        preferredTimezone: ['America/New_York', 'America/Chicago'],
        maxBudget: 200000,
        stretchBudget: 220000,
        teamFocus: 'greenfield',
        preferredSeniorityLevel: 'staff',
        limit: 50,
        offset: 0,
      });

      // Seniority expansion
      expect(result.minYearsExperience).toBe(6);
      expect(result.maxYearsExperience).toBe(10);

      // Timeline expansion
      expect(result.startTimeline).toEqual(['immediate', 'two_weeks', 'one_month']);

      // Timezone expansion
      expect(result.timezonePrefixes).toEqual(['America/']);

      // Budget pass-through
      expect(result.maxBudget).toBe(200000);
      expect(result.stretchBudget).toBe(220000);

      // Team focus expansion
      expect(result.alignedSkillIds.length).toBeGreaterThan(0);

      // Pagination
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);

      // Preferred values pass-through
      expect(result.preferredSeniorityLevel).toBe('staff');
      expect(result.preferredMaxStartTime).toBe('two_weeks');
      expect(result.requiredMaxStartTime).toBe('one_month');
      expect(result.preferredTimezone).toEqual(['America/New_York', 'America/Chicago']);
    });
  });
});
