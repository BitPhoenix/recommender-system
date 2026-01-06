import { describe, it, expect, vi } from 'vitest';
import { resolveBusinessDomains, resolveTechnicalDomains } from './domain-resolver.service.js';
import { createMockSession } from '../__mocks__/neo4j-session.mock.js';
import type { BusinessDomainRequirement, TechnicalDomainRequirement } from '../types/search.types.js';

describe('resolveBusinessDomains', () => {
  describe('empty input handling', () => {
    it('returns empty array for undefined requirements', async () => {
      const mockSession = createMockSession();

      const result = await resolveBusinessDomains(mockSession, undefined);

      expect(result).toEqual([]);
    });

    it('returns empty array for empty requirements array', async () => {
      const mockSession = createMockSession();

      const result = await resolveBusinessDomains(mockSession, []);

      expect(result).toEqual([]);
    });
  });

  describe('domain hierarchy expansion', () => {
    it('returns resolved domain with expanded child IDs', async () => {
      const mockSession = createMockSession([
        {
          // Find domain by identifier
          pattern: 'MATCH (d:BusinessDomain)',
          result: [{ domainId: 'bd-finance' }],
        },
        {
          // Get descendants via CHILD_OF
          pattern: 'CHILD_OF',
          result: [
            {
              selfId: 'bd-finance',
              childIds: ['bd-banking', 'bd-insurance'],
            },
          ],
        },
      ]);

      const requirements: BusinessDomainRequirement[] = [
        { domain: 'finance', minYears: 2 },
      ];

      const result = await resolveBusinessDomains(mockSession, requirements);

      expect(result).toHaveLength(1);
      expect(result[0].domainId).toBe('bd-finance');
      expect(result[0].expandedDomainIds).toContain('bd-finance');
      expect(result[0].expandedDomainIds).toContain('bd-banking');
      expect(result[0].expandedDomainIds).toContain('bd-insurance');
      expect(result[0].minYears).toBe(2);
    });

    it('handles parent domain search returning all children', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:BusinessDomain)',
          result: [{ domainId: 'bd-healthcare' }],
        },
        {
          pattern: 'CHILD_OF',
          result: [
            {
              selfId: 'bd-healthcare',
              childIds: ['bd-pharma', 'bd-medical-devices', 'bd-health-tech'],
            },
          ],
        },
      ]);

      const requirements: BusinessDomainRequirement[] = [{ domain: 'healthcare' }];

      const result = await resolveBusinessDomains(mockSession, requirements);

      // Should have 4 domains: healthcare + 3 children
      expect(result[0].expandedDomainIds).toHaveLength(4);
    });

    it('handles domain with no children (leaf domain)', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:BusinessDomain)',
          result: [{ domainId: 'bd-banking' }],
        },
        {
          pattern: 'CHILD_OF',
          result: [
            {
              selfId: 'bd-banking',
              childIds: [], // No children
            },
          ],
        },
      ]);

      const requirements: BusinessDomainRequirement[] = [{ domain: 'banking' }];

      const result = await resolveBusinessDomains(mockSession, requirements);

      // Should only have the domain itself
      expect(result[0].expandedDomainIds).toEqual(['bd-banking']);
    });
  });

  describe('minYears filtering', () => {
    it('passes minYears to resolved domain', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:BusinessDomain)',
          result: [{ domainId: 'bd-finance' }],
        },
        {
          pattern: 'CHILD_OF',
          result: [{ selfId: 'bd-finance', childIds: [] }],
        },
      ]);

      const requirements: BusinessDomainRequirement[] = [
        { domain: 'finance', minYears: 5 },
      ];

      const result = await resolveBusinessDomains(mockSession, requirements);

      expect(result[0].minYears).toBe(5);
    });

    it('passes preferredMinYears to resolved domain', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:BusinessDomain)',
          result: [{ domainId: 'bd-finance' }],
        },
        {
          pattern: 'CHILD_OF',
          result: [{ selfId: 'bd-finance', childIds: [] }],
        },
      ]);

      const requirements: BusinessDomainRequirement[] = [
        { domain: 'finance', preferredMinYears: 3 },
      ];

      const result = await resolveBusinessDomains(mockSession, requirements);

      expect(result[0].preferredMinYears).toBe(3);
    });

    it('passes both minYears and preferredMinYears', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:BusinessDomain)',
          result: [{ domainId: 'bd-finance' }],
        },
        {
          pattern: 'CHILD_OF',
          result: [{ selfId: 'bd-finance', childIds: [] }],
        },
      ]);

      const requirements: BusinessDomainRequirement[] = [
        { domain: 'finance', minYears: 2, preferredMinYears: 5 },
      ];

      const result = await resolveBusinessDomains(mockSession, requirements);

      expect(result[0].minYears).toBe(2);
      expect(result[0].preferredMinYears).toBe(5);
    });
  });

  describe('unresolved domains', () => {
    it('skips unknown domain identifiers', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:BusinessDomain)',
          result: [], // No matching domain
        },
      ]);

      const requirements: BusinessDomainRequirement[] = [{ domain: 'nonexistent' }];

      const result = await resolveBusinessDomains(mockSession, requirements);

      expect(result).toHaveLength(0);
    });

    it('returns only resolved domains when some are unresolved', async () => {
      // First call for "finance" finds it, second call for "nonexistent" doesn't
      const mockSession = createMockSession();
      let callCount = 0;

      mockSession.run = vi.fn().mockImplementation((query: string) => {
        if (query.includes('MATCH (d:BusinessDomain)')) {
          callCount++;
          if (callCount === 1) {
            // finance found
            return Promise.resolve({
              records: [
                {
                  get: (key: string) => (key === 'domainId' ? 'bd-finance' : undefined),
                  has: () => true,
                  keys: ['domainId'],
                  toObject: () => ({ domainId: 'bd-finance' }),
                },
              ],
            });
          }
          // nonexistent not found
          return Promise.resolve({ records: [] });
        }
        if (query.includes('CHILD_OF')) {
          return Promise.resolve({
            records: [
              {
                get: (key: string) => {
                  if (key === 'selfId') return 'bd-finance';
                  if (key === 'childIds') return [];
                  return undefined;
                },
                has: () => true,
                keys: ['selfId', 'childIds'],
                toObject: () => ({ selfId: 'bd-finance', childIds: [] }),
              },
            ],
          });
        }
        return Promise.resolve({ records: [] });
      });

      const requirements: BusinessDomainRequirement[] = [
        { domain: 'finance' },
        { domain: 'nonexistent' },
      ];

      const result = await resolveBusinessDomains(mockSession, requirements);

      expect(result).toHaveLength(1);
      expect(result[0].domainId).toBe('bd-finance');
    });
  });

  describe('multiple domains', () => {
    it('resolves multiple business domains', async () => {
      let domainCallCount = 0;
      let childCallCount = 0;

      const mockSession = createMockSession();
      mockSession.run = vi.fn().mockImplementation((query: string) => {
        if (query.includes('MATCH (d:BusinessDomain)')) {
          domainCallCount++;
          const domainId = domainCallCount === 1 ? 'bd-finance' : 'bd-healthcare';
          return Promise.resolve({
            records: [
              {
                get: () => domainId,
                has: () => true,
                keys: ['domainId'],
                toObject: () => ({ domainId }),
              },
            ],
          });
        }
        if (query.includes('CHILD_OF')) {
          childCallCount++;
          const selfId = childCallCount === 1 ? 'bd-finance' : 'bd-healthcare';
          return Promise.resolve({
            records: [
              {
                get: (key: string) => {
                  if (key === 'selfId') return selfId;
                  if (key === 'childIds') return [];
                  return undefined;
                },
                has: () => true,
                keys: ['selfId', 'childIds'],
                toObject: () => ({ selfId, childIds: [] }),
              },
            ],
          });
        }
        return Promise.resolve({ records: [] });
      });

      const requirements: BusinessDomainRequirement[] = [
        { domain: 'finance' },
        { domain: 'healthcare' },
      ];

      const result = await resolveBusinessDomains(mockSession, requirements);

      expect(result).toHaveLength(2);
      expect(result[0].domainId).toBe('bd-finance');
      expect(result[1].domainId).toBe('bd-healthcare');
    });
  });
});

describe('resolveTechnicalDomains', () => {
  describe('empty input handling', () => {
    it('returns empty array for undefined requirements', async () => {
      const mockSession = createMockSession();

      const result = await resolveTechnicalDomains(mockSession, undefined);

      expect(result).toEqual([]);
    });

    it('returns empty array for empty requirements array', async () => {
      const mockSession = createMockSession();

      const result = await resolveTechnicalDomains(mockSession, []);

      expect(result).toEqual([]);
    });
  });

  describe('standard domain expansion', () => {
    it('expands domain via CHILD_OF relationship', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:TechnicalDomain)',
          result: [{ domainId: 'td-backend', isComposite: false }],
        },
        {
          pattern: 'CHILD_OF',
          result: [
            {
              selfId: 'td-backend',
              childIds: ['td-api', 'td-database'],
            },
          ],
        },
      ]);

      const requirements: TechnicalDomainRequirement[] = [{ domain: 'backend' }];

      const result = await resolveTechnicalDomains(mockSession, requirements);

      expect(result[0].expandedDomainIds).toContain('td-backend');
      expect(result[0].expandedDomainIds).toContain('td-api');
      expect(result[0].expandedDomainIds).toContain('td-database');
    });

    it('handles non-composite domain with no children', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:TechnicalDomain)',
          result: [{ domainId: 'td-api', isComposite: false }],
        },
        {
          pattern: 'CHILD_OF',
          result: [{ selfId: 'td-api', childIds: [] }],
        },
      ]);

      const requirements: TechnicalDomainRequirement[] = [{ domain: 'api' }];

      const result = await resolveTechnicalDomains(mockSession, requirements);

      expect(result[0].expandedDomainIds).toEqual(['td-api']);
    });
  });

  describe('composite domain handling', () => {
    it('expands composite domains via ENCOMPASSES relationship', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:TechnicalDomain)',
          result: [{ domainId: 'td-fullstack', isComposite: true }],
        },
        {
          pattern: 'ENCOMPASSES',
          result: [
            { encompassedId: 'td-frontend' },
            { encompassedId: 'td-backend' },
          ],
        },
      ]);

      const requirements: TechnicalDomainRequirement[] = [{ domain: 'fullstack' }];

      const result = await resolveTechnicalDomains(mockSession, requirements);

      expect(result[0].expandedDomainIds).toContain('td-fullstack');
      expect(result[0].expandedDomainIds).toContain('td-frontend');
      expect(result[0].expandedDomainIds).toContain('td-backend');
    });

    it('handles composite domain with single encompassed domain', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:TechnicalDomain)',
          result: [{ domainId: 'td-mobile', isComposite: true }],
        },
        {
          pattern: 'ENCOMPASSES',
          result: [{ encompassedId: 'td-ios' }],
        },
      ]);

      const requirements: TechnicalDomainRequirement[] = [{ domain: 'mobile' }];

      const result = await resolveTechnicalDomains(mockSession, requirements);

      expect(result[0].expandedDomainIds).toEqual(['td-mobile', 'td-ios']);
    });
  });

  describe('minYears filtering', () => {
    it('passes minYears to resolved technical domain', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:TechnicalDomain)',
          result: [{ domainId: 'td-backend', isComposite: false }],
        },
        {
          pattern: 'CHILD_OF',
          result: [{ selfId: 'td-backend', childIds: [] }],
        },
      ]);

      const requirements: TechnicalDomainRequirement[] = [
        { domain: 'backend', minYears: 5 },
      ];

      const result = await resolveTechnicalDomains(mockSession, requirements);

      expect(result[0].minYears).toBe(5);
    });

    it('passes preferredMinYears to resolved technical domain', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:TechnicalDomain)',
          result: [{ domainId: 'td-backend', isComposite: false }],
        },
        {
          pattern: 'CHILD_OF',
          result: [{ selfId: 'td-backend', childIds: [] }],
        },
      ]);

      const requirements: TechnicalDomainRequirement[] = [
        { domain: 'backend', preferredMinYears: 3 },
      ];

      const result = await resolveTechnicalDomains(mockSession, requirements);

      expect(result[0].preferredMinYears).toBe(3);
    });
  });

  describe('unresolved domains', () => {
    it('skips unknown domain identifiers', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:TechnicalDomain)',
          result: [], // No matching domain
        },
      ]);

      const requirements: TechnicalDomainRequirement[] = [{ domain: 'nonexistent' }];

      const result = await resolveTechnicalDomains(mockSession, requirements);

      expect(result).toHaveLength(0);
    });
  });

  describe('session query execution', () => {
    it('executes correct queries for non-composite domain', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:TechnicalDomain)',
          result: [{ domainId: 'td-backend', isComposite: false }],
        },
        {
          pattern: 'CHILD_OF',
          result: [{ selfId: 'td-backend', childIds: [] }],
        },
      ]);
      const runSpy = vi.spyOn(mockSession, 'run');

      await resolveTechnicalDomains(mockSession, [{ domain: 'backend' }]);

      // Should execute 2 queries: find domain + get children
      expect(runSpy).toHaveBeenCalledTimes(2);
    });

    it('executes correct queries for composite domain', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (d:TechnicalDomain)',
          result: [{ domainId: 'td-fullstack', isComposite: true }],
        },
        {
          pattern: 'ENCOMPASSES',
          result: [{ encompassedId: 'td-frontend' }],
        },
      ]);
      const runSpy = vi.spyOn(mockSession, 'run');

      await resolveTechnicalDomains(mockSession, [{ domain: 'fullstack' }]);

      // Should execute 2 queries: find domain + get encompassed
      expect(runSpy).toHaveBeenCalledTimes(2);
    });
  });
});
