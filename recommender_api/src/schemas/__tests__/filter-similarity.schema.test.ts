import { describe, it, expect } from 'vitest';
import { FilterSimilarityRequestSchema } from '../filter-similarity.schema.js';

describe('FilterSimilarityRequestSchema', () => {
  describe('required fields', () => {
    it('requires referenceEngineerId', () => {
      const result = FilterSimilarityRequestSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('referenceEngineerId'))).toBe(true);
      }
    });

    it('accepts valid request with only referenceEngineerId', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('valid full request', () => {
    it('accepts request with all fields', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        requiredSkills: [{ skill: 'typescript', minProficiency: 'proficient' }],
        requiredSeniorityLevel: 'senior',
        requiredMaxStartTime: 'one_month',
        requiredTimezone: ['Eastern', 'Pacific'],
        maxBudget: 200000,
        stretchBudget: 220000,
        requiredBusinessDomains: [{ domain: 'fintech', minYears: 2 }],
        requiredTechnicalDomains: [{ domain: 'web', minYears: 3 }],
        overriddenRuleIds: ['rule_1', 'rule_2'],
        limit: 20,
        offset: 10,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('overriddenRuleIds', () => {
    it('accepts valid overriddenRuleIds array', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        overriddenRuleIds: ['inference_rule_frontend_stack', 'inference_rule_data_engineering'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.overriddenRuleIds).toEqual([
          'inference_rule_frontend_stack',
          'inference_rule_data_engineering',
        ]);
      }
    });

    it('accepts empty overriddenRuleIds array', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        overriddenRuleIds: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('stretchBudget refinement', () => {
    it('rejects stretchBudget without maxBudget', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        stretchBudget: 220000,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('stretchBudget'))).toBe(true);
        expect(result.error.issues.some(i => i.message.includes('maxBudget'))).toBe(true);
      }
    });

    it('rejects stretchBudget less than maxBudget', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        maxBudget: 200000,
        stretchBudget: 180000,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i =>
          i.message.includes('stretchBudget must be greater than or equal to maxBudget')
        )).toBe(true);
      }
    });

    it('accepts stretchBudget equal to maxBudget', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        maxBudget: 200000,
        stretchBudget: 200000,
      });
      expect(result.success).toBe(true);
    });

    it('accepts stretchBudget greater than maxBudget', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        maxBudget: 200000,
        stretchBudget: 250000,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('pagination defaults', () => {
    it('applies default limit of 10', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it('applies default offset of 0', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(0);
      }
    });

    it('enforces max limit of 100', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        limit: 150,
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid pagination values', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        limit: 50,
        offset: 100,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(100);
      }
    });
  });

  describe('constraint field validation', () => {
    it('validates seniority level enum', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        requiredSeniorityLevel: 'invalid_level',
      });
      expect(result.success).toBe(false);
    });

    it('validates startTimeline enum', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        requiredMaxStartTime: 'invalid_timeline',
      });
      expect(result.success).toBe(false);
    });

    it('validates timezone zone enum', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        requiredTimezone: ['InvalidZone'],
      });
      expect(result.success).toBe(false);
    });

    it('validates skill proficiency enum', () => {
      const result = FilterSimilarityRequestSchema.safeParse({
        referenceEngineerId: 'eng_marcus',
        requiredSkills: [{ skill: 'typescript', minProficiency: 'invalid_level' }],
      });
      expect(result.success).toBe(false);
    });
  });
});
