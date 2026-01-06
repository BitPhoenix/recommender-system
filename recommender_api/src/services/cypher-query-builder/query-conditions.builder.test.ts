import { describe, it, expect } from 'vitest';
import { buildBasicEngineerFilters } from './query-conditions.builder.js';
import type { CypherQueryParams } from './query-types.js';

const createQueryParams = (overrides: Partial<CypherQueryParams> = {}): CypherQueryParams => ({
  learningLevelSkillIds: [],
  proficientLevelSkillIds: [],
  expertLevelSkillIds: [],
  originalSkillIdentifiers: null,
  startTimeline: [],
  minYearsExperience: null,
  maxYearsExperience: null,
  timezonePrefixes: [],
  maxBudget: null,
  stretchBudget: null,
  offset: 0,
  limit: 20,
  ...overrides,
});

describe('buildBasicEngineerFilters', () => {
  describe('timeline filter', () => {
    it('creates IN condition for timeline values', () => {
      const params = createQueryParams({ startTimeline: ['immediate', 'two_weeks'] });
      const result = buildBasicEngineerFilters(params);

      const timelineCondition = result.conditions.find(c => c.includes('startTimeline'));
      expect(timelineCondition).toContain('IN');
      expect(result.queryParams.startTimeline).toEqual(['immediate', 'two_weeks']);
    });

    it('always includes timeline filter (even when empty array)', () => {
      const params = createQueryParams({ startTimeline: [] });
      const result = buildBasicEngineerFilters(params);

      // Timeline filter is always added even with empty array
      const hasTimelineCondition = result.conditions.some(c => c.includes('startTimeline'));
      expect(hasTimelineCondition).toBe(true);
    });
  });

  describe('experience filter', () => {
    it('returns empty conditions when no experience range specified', () => {
      const params = createQueryParams({
        minYearsExperience: null,
        maxYearsExperience: null,
      });
      const result = buildBasicEngineerFilters(params);

      const hasExperienceCondition = result.conditions.some(c => c.includes('yearsExperience'));
      expect(hasExperienceCondition).toBe(false);
    });

    it('creates >= condition for minYearsExperience', () => {
      const params = createQueryParams({ minYearsExperience: 5 });
      const result = buildBasicEngineerFilters(params);

      const minCondition = result.conditions.find(c => c.includes('>='));
      expect(minCondition).toBeDefined();
      expect(result.queryParams.minYearsExperience).toBe(5);
    });

    it('creates < condition for maxYearsExperience', () => {
      const params = createQueryParams({ maxYearsExperience: 10 });
      const result = buildBasicEngineerFilters(params);

      // Note: The actual implementation uses '<' not '<=' for max
      const maxCondition = result.conditions.find(c => c.includes('<') && c.includes('yearsExperience'));
      expect(maxCondition).toBeDefined();
      expect(result.queryParams.maxYearsExperience).toBe(10);
    });

    it('creates both conditions when range specified', () => {
      const params = createQueryParams({
        minYearsExperience: 3,
        maxYearsExperience: 8,
      });
      const result = buildBasicEngineerFilters(params);

      const experienceConditions = result.conditions.filter(c => c.includes('yearsExperience'));
      expect(experienceConditions.length).toBe(2);
    });
  });

  describe('timezone filter', () => {
    it('returns empty conditions when no timezone specified', () => {
      const params = createQueryParams({ timezonePrefixes: [] });
      const result = buildBasicEngineerFilters(params);

      const hasTimezoneCondition = result.conditions.some(c => c.includes('timezone'));
      expect(hasTimezoneCondition).toBe(false);
    });

    it('creates STARTS WITH condition for single timezone prefix', () => {
      const params = createQueryParams({ timezonePrefixes: ['America/'] });
      const result = buildBasicEngineerFilters(params);

      const tzCondition = result.conditions.find(c => c.includes('timezone'));
      expect(tzCondition).toContain('STARTS WITH');
      expect(result.queryParams.tz0).toBe('America/');
    });

    it('creates OR condition for multiple timezone prefixes', () => {
      const params = createQueryParams({ timezonePrefixes: ['America/', 'Europe/'] });
      const result = buildBasicEngineerFilters(params);

      const tzCondition = result.conditions.find(c => c.includes('timezone'));
      expect(tzCondition).toContain('OR');
      expect(result.queryParams.tz0).toBe('America/');
      expect(result.queryParams.tz1).toBe('Europe/');
    });

    it('wraps multiple timezone conditions in parentheses', () => {
      const params = createQueryParams({ timezonePrefixes: ['America/', 'Europe/'] });
      const result = buildBasicEngineerFilters(params);

      const tzCondition = result.conditions.find(c => c.includes('timezone'));
      expect(tzCondition).toMatch(/^\(.*\)$/);
    });
  });

  describe('budget filter', () => {
    it('returns empty conditions when no budget specified', () => {
      const params = createQueryParams({ maxBudget: null });
      const result = buildBasicEngineerFilters(params);

      const hasBudgetCondition = result.conditions.some(c => c.includes('salary'));
      expect(hasBudgetCondition).toBe(false);
    });

    it('creates <= condition using maxBudget as ceiling', () => {
      const params = createQueryParams({ maxBudget: 200000 });
      const result = buildBasicEngineerFilters(params);

      const budgetCondition = result.conditions.find(c => c.includes('salary'));
      expect(budgetCondition).toContain('<=');
      expect(result.queryParams.budgetCeiling).toBe(200000);
    });

    it('uses stretchBudget as ceiling when provided', () => {
      const params = createQueryParams({
        maxBudget: 200000,
        stretchBudget: 220000,
      });
      const result = buildBasicEngineerFilters(params);

      expect(result.queryParams.budgetCeiling).toBe(220000);
    });

    it('uses stretchBudget alone when only stretchBudget provided', () => {
      // Edge case: stretchBudget without maxBudget (validation would normally prevent this)
      const params = createQueryParams({
        maxBudget: null,
        stretchBudget: 220000,
      });
      const result = buildBasicEngineerFilters(params);

      // stretchBudget ?? maxBudget = stretchBudget
      expect(result.queryParams.budgetCeiling).toBe(220000);
    });
  });

  describe('combined filters', () => {
    it('combines multiple filter conditions', () => {
      const params = createQueryParams({
        startTimeline: ['immediate'],
        minYearsExperience: 3,
        maxBudget: 200000,
        timezonePrefixes: ['America/'],
      });
      const result = buildBasicEngineerFilters(params);

      // Should have conditions for: timeline, experience, budget, timezone
      expect(result.conditions.length).toBeGreaterThanOrEqual(4);
    });

    it('returns proper structure with conditions array and queryParams object', () => {
      const params = createQueryParams();
      const result = buildBasicEngineerFilters(params);

      expect(result.conditions).toBeInstanceOf(Array);
      expect(result.queryParams).toBeDefined();
      expect(typeof result.queryParams).toBe('object');
    });

    it('does not include duplicate query params', () => {
      const params = createQueryParams({
        startTimeline: ['immediate'],
        minYearsExperience: 5,
        maxYearsExperience: 10,
      });
      const result = buildBasicEngineerFilters(params);

      // Each param key should appear only once
      const keys = Object.keys(result.queryParams);
      const uniqueKeys = [...new Set(keys)];
      expect(keys.length).toBe(uniqueKeys.length);
    });
  });

  describe('condition formatting', () => {
    it('formats timeline condition with e. prefix', () => {
      const params = createQueryParams({ startTimeline: ['immediate'] });
      const result = buildBasicEngineerFilters(params);

      const timelineCondition = result.conditions.find(c => c.includes('startTimeline'));
      expect(timelineCondition).toContain('e.startTimeline');
    });

    it('formats experience condition with e. prefix', () => {
      const params = createQueryParams({ minYearsExperience: 5 });
      const result = buildBasicEngineerFilters(params);

      const expCondition = result.conditions.find(c => c.includes('yearsExperience'));
      expect(expCondition).toContain('e.yearsExperience');
    });

    it('formats timezone condition with e. prefix', () => {
      const params = createQueryParams({ timezonePrefixes: ['America/'] });
      const result = buildBasicEngineerFilters(params);

      const tzCondition = result.conditions.find(c => c.includes('timezone'));
      expect(tzCondition).toContain('e.timezone');
    });

    it('formats salary condition with e. prefix', () => {
      const params = createQueryParams({ maxBudget: 200000 });
      const result = buildBasicEngineerFilters(params);

      const salaryCondition = result.conditions.find(c => c.includes('salary'));
      expect(salaryCondition).toContain('e.salary');
    });
  });
});
