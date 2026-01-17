import { describe, it, expect } from 'vitest';
import { calculateDomainSimilarity } from './domain-similarity.js';
import type { DomainGraph, DomainExperience } from '../types.js';

// Helper to create a test domain graph
function createTestDomainGraph(): DomainGraph {
  return {
    businessDomains: new Map([
      // Finance parent
      ['domain_finance', { domainId: 'domain_finance', parentId: null, encompassedBy: [] }],
      // Finance children
      ['domain_fintech', { domainId: 'domain_fintech', parentId: 'domain_finance', encompassedBy: [] }],
      ['domain_banking', { domainId: 'domain_banking', parentId: 'domain_finance', encompassedBy: [] }],
      // Healthcare (unrelated to finance)
      ['domain_healthcare', { domainId: 'domain_healthcare', parentId: null, encompassedBy: [] }],
    ]),
    technicalDomains: new Map([
      // Full Stack encompasses Backend and Frontend
      ['domain_fullstack', { domainId: 'domain_fullstack', parentId: null, encompassedBy: [] }],
      ['domain_backend', { domainId: 'domain_backend', parentId: null, encompassedBy: ['domain_fullstack'] }],
      ['domain_frontend', { domainId: 'domain_frontend', parentId: null, encompassedBy: ['domain_fullstack'] }],
      // Backend children
      ['domain_api', { domainId: 'domain_api', parentId: 'domain_backend', encompassedBy: [] }],
    ]),
  };
}

describe('calculateDomainSimilarity', () => {
  const graph = createTestDomainGraph();

  describe('empty domain sets', () => {
    it('returns 1.0 when both have no domains', () => {
      const result = calculateDomainSimilarity(graph, [], [], [], []);
      expect(result.score).toBe(1.0);
    });

    it('returns 0.0 when target has domains but candidate does not', () => {
      const targetBusiness: DomainExperience[] = [
        { domainId: 'domain_fintech', domainName: 'Fintech', years: 3 },
      ];
      const result = calculateDomainSimilarity(graph, targetBusiness, [], [], []);
      expect(result.score).toBe(0.0);
    });

    it('returns 0.0 when candidate has domains but target does not', () => {
      const candidateBusiness: DomainExperience[] = [
        { domainId: 'domain_fintech', domainName: 'Fintech', years: 3 },
      ];
      const result = calculateDomainSimilarity(graph, [], [], candidateBusiness, []);
      expect(result.score).toBe(0.0);
    });
  });

  describe('exact domain matches', () => {
    it('returns 1.0 for identical domain with same years', () => {
      const targetBusiness: DomainExperience[] = [
        { domainId: 'domain_fintech', domainName: 'Fintech', years: 5 },
      ];
      const candidateBusiness: DomainExperience[] = [
        { domainId: 'domain_fintech', domainName: 'Fintech', years: 5 },
      ];
      const result = calculateDomainSimilarity(graph, targetBusiness, [], candidateBusiness, []);
      expect(result.score).toBe(1.0);
    });

    it('applies years adjustment for same domain with different years', () => {
      const targetBusiness: DomainExperience[] = [
        { domainId: 'domain_fintech', domainName: 'Fintech', years: 5 },
      ];
      const candidateBusiness: DomainExperience[] = [
        { domainId: 'domain_fintech', domainName: 'Fintech', years: 2 },
      ];
      const result = calculateDomainSimilarity(graph, targetBusiness, [], candidateBusiness, []);
      // 3 years diff, baseSim=1.0, yearsSim=0.7, final=0.7
      expect(result.score).toBeCloseTo(0.7, 1);
    });
  });

  describe('sibling domains (share parent)', () => {
    it('returns 0.5 for sibling domains with same years', () => {
      const targetBusiness: DomainExperience[] = [
        { domainId: 'domain_fintech', domainName: 'Fintech', years: 5 },
      ];
      const candidateBusiness: DomainExperience[] = [
        { domainId: 'domain_banking', domainName: 'Banking', years: 5 },
      ];
      const result = calculateDomainSimilarity(graph, targetBusiness, [], candidateBusiness, []);
      expect(result.score).toBe(0.5);
    });
  });

  describe('parent-child relationship', () => {
    it('returns 0.4 for parent-child domains', () => {
      const targetTech: DomainExperience[] = [
        { domainId: 'domain_backend', domainName: 'Backend', years: 5 },
      ];
      const candidateTech: DomainExperience[] = [
        { domainId: 'domain_api', domainName: 'API Development', years: 5 },
      ];
      const result = calculateDomainSimilarity(graph, [], targetTech, [], candidateTech);
      expect(result.score).toBe(0.4);
    });
  });

  describe('encompasses relationship', () => {
    it('returns 0.4 for encompasses relationship', () => {
      const targetTech: DomainExperience[] = [
        { domainId: 'domain_backend', domainName: 'Backend', years: 5 },
      ];
      const candidateTech: DomainExperience[] = [
        { domainId: 'domain_fullstack', domainName: 'Full Stack', years: 5 },
      ];
      const result = calculateDomainSimilarity(graph, [], targetTech, [], candidateTech);
      expect(result.score).toBe(0.4);
    });
  });

  describe('unrelated domains', () => {
    it('returns 0.0 for completely unrelated domains', () => {
      const targetBusiness: DomainExperience[] = [
        { domainId: 'domain_fintech', domainName: 'Fintech', years: 5 },
      ];
      const candidateBusiness: DomainExperience[] = [
        { domainId: 'domain_healthcare', domainName: 'Healthcare', years: 5 },
      ];
      const result = calculateDomainSimilarity(graph, targetBusiness, [], candidateBusiness, []);
      expect(result.score).toBe(0.0);
    });
  });

  describe('years similarity floor', () => {
    it('applies 0.5 floor for large years differences', () => {
      const targetBusiness: DomainExperience[] = [
        { domainId: 'domain_fintech', domainName: 'Fintech', years: 1 },
      ];
      const candidateBusiness: DomainExperience[] = [
        { domainId: 'domain_fintech', domainName: 'Fintech', years: 10 },
      ];
      const result = calculateDomainSimilarity(graph, targetBusiness, [], candidateBusiness, []);
      // 9 years diff, baseSim=1.0, yearsSim=0.1 but floored to 0.5
      expect(result.score).toBe(0.5);
    });
  });

  describe('mixed business and technical domains', () => {
    it('combines both domain types for similarity', () => {
      const targetBusiness: DomainExperience[] = [
        { domainId: 'domain_fintech', domainName: 'Fintech', years: 5 },
      ];
      const targetTech: DomainExperience[] = [
        { domainId: 'domain_backend', domainName: 'Backend', years: 5 },
      ];
      const candidateBusiness: DomainExperience[] = [
        { domainId: 'domain_fintech', domainName: 'Fintech', years: 5 },
      ];
      const candidateTech: DomainExperience[] = [
        { domainId: 'domain_backend', domainName: 'Backend', years: 5 },
      ];
      const result = calculateDomainSimilarity(graph, targetBusiness, targetTech, candidateBusiness, candidateTech);
      expect(result.score).toBe(1.0);
    });
  });
});
