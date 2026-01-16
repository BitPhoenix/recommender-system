import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { executeSearch } from './search.service.js';
import { createMockSession, mockData } from '../__mocks__/neo4j-session.mock.js';
import {
  isPropertyFilter,
  isPropertyPreference,
  type SearchFilterRequest,
} from '../types/search.types.js';

// Mock all dependent services
vi.mock('./skill-resolution.service.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    resolveAllSkills: vi.fn().mockResolvedValue({
      skillGroups: {
        learningLevelSkillIds: [],
        proficientLevelSkillIds: [],
        expertLevelSkillIds: [],
      },
      requiredSkillIds: [],
      expandedSkillNames: [],
      unresolvedSkills: [],
      originalSkillIdentifiers: [],
      preferredSkillIds: [],
      skillIdToPreferredProficiency: new Map(),
      resolvedRequiredSkills: [],
      resolvedPreferredSkills: [],
    }),
  };
});

vi.mock('./domain-resolver.service.js', () => ({
  resolveBusinessDomains: vi.fn().mockResolvedValue([]),
  resolveTechnicalDomains: vi.fn().mockResolvedValue([]),
}));

import { resolveAllSkills } from './skill-resolution.service.js';
import { resolveBusinessDomains, resolveTechnicalDomains } from './domain-resolver.service.js';

// Default mock return value for resolveAllSkills
const defaultSkillResolutionResult = {
  skillGroups: {
    learningLevelSkillIds: [],
    proficientLevelSkillIds: [],
    expertLevelSkillIds: [],
  },
  requiredSkillIds: [],
  expandedSkillNames: [],
  unresolvedSkills: [],
  originalSkillIdentifiers: [],
  preferredSkillIds: [],
  skillIdToPreferredProficiency: new Map(),
  resolvedRequiredSkills: [],
  resolvedPreferredSkills: [],
};

describe('executeSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations to default behavior
    (resolveAllSkills as Mock).mockResolvedValue(defaultSkillResolutionResult);
    (resolveBusinessDomains as Mock).mockResolvedValue([]);
    (resolveTechnicalDomains as Mock).mockResolvedValue([]);
  });

  describe('browse mode (empty request)', () => {
    it('returns all engineers without filters', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [
            mockData.createEngineerRecord({ id: 'eng-1', name: 'Alice', totalCount: 2 }),
            mockData.createEngineerRecord({ id: 'eng-2', name: 'Bob', totalCount: 2 }),
          ],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.matches).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });

    it('includes applied filters as empty array', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [mockData.createEngineerRecord()],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.appliedFilters).toBeDefined();
      expect(Array.isArray(result.appliedFilters)).toBe(true);
    });

    it('includes query metadata', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [mockData.createEngineerRecord()],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.queryMetadata).toBeDefined();
      expect(result.queryMetadata.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.queryMetadata.skillsExpanded).toBeDefined();
      expect(result.queryMetadata.defaultsApplied).toBeDefined();
    });
  });

  describe('skill-filtered search', () => {
    it('calls skill resolver with required skills', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [] },
      ]);

      (resolveAllSkills as Mock).mockResolvedValue({
        skillGroups: {
          learningLevelSkillIds: [],
          proficientLevelSkillIds: ['skill-ts'],
          expertLevelSkillIds: [],
        },
        requiredSkillIds: ['skill-ts'],
        expandedSkillNames: ['TypeScript'],
        unresolvedSkills: [],
        originalSkillIdentifiers: ['typescript'],
        preferredSkillIds: [],
        skillIdToPreferredProficiency: new Map(),
        resolvedRequiredSkills: [{ skillId: 'skill-ts', minProficiency: 'proficient', preferredMinProficiency: null }],
        resolvedPreferredSkills: [],
      });

      const request: SearchFilterRequest = {
        requiredSkills: [{ skill: 'typescript', minProficiency: 'proficient' }],
      };

      await executeSearch(mockSession, request);

      expect(resolveAllSkills).toHaveBeenCalledWith(
        mockSession,
        request.requiredSkills,
        undefined, // preferredSkills
        expect.any(String) // defaultProficiency
      );
    });

    it('includes expanded skill names in metadata', async () => {
      (resolveAllSkills as Mock).mockResolvedValue({
        skillGroups: {
          learningLevelSkillIds: [],
          proficientLevelSkillIds: ['skill-ts'],
          expertLevelSkillIds: [],
        },
        requiredSkillIds: ['skill-ts'],
        expandedSkillNames: ['TypeScript', 'JavaScript'],
        unresolvedSkills: [],
        originalSkillIdentifiers: ['typescript'],
        preferredSkillIds: [],
        skillIdToPreferredProficiency: new Map(),
        resolvedRequiredSkills: [{ skillId: 'skill-ts', minProficiency: 'proficient', preferredMinProficiency: null }],
        resolvedPreferredSkills: [],
      });

      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        requiredSkills: [{ skill: 'typescript' }],
      });

      expect(result.queryMetadata.skillsExpanded).toContain('TypeScript');
      expect(result.queryMetadata.skillsExpanded).toContain('JavaScript');
    });

    it('reports unresolved skills in metadata', async () => {
      (resolveAllSkills as Mock).mockResolvedValue({
        skillGroups: {
          learningLevelSkillIds: [],
          proficientLevelSkillIds: [],
          expertLevelSkillIds: [],
        },
        requiredSkillIds: [],
        expandedSkillNames: [],
        unresolvedSkills: ['nonexistent-skill'],
        originalSkillIdentifiers: ['nonexistent-skill'],
        preferredSkillIds: [],
        skillIdToPreferredProficiency: new Map(),
        resolvedRequiredSkills: [],
        resolvedPreferredSkills: [],
      });

      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [] },
      ]);

      const result = await executeSearch(mockSession, {
        requiredSkills: [{ skill: 'nonexistent-skill' }],
      });

      expect(result.queryMetadata.unresolvedSkills).toContain('nonexistent-skill');
    });
  });

  describe('domain-filtered search', () => {
    it('calls domain resolver with business domains', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [] },
      ]);

      (resolveBusinessDomains as Mock).mockResolvedValue([
        { domainId: 'bd-finance', expandedDomainIds: ['bd-finance'] },
      ]);

      const request: SearchFilterRequest = {
        requiredBusinessDomains: [{ domain: 'finance' }],
      };

      await executeSearch(mockSession, request);

      expect(resolveBusinessDomains).toHaveBeenCalledWith(
        mockSession,
        request.requiredBusinessDomains
      );
    });

    it('calls domain resolver with preferred business domains', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [] },
      ]);

      (resolveBusinessDomains as Mock).mockResolvedValue([
        { domainId: 'bd-finance', expandedDomainIds: ['bd-finance'] },
      ]);

      const request: SearchFilterRequest = {
        preferredBusinessDomains: [{ domain: 'finance' }],
      };

      await executeSearch(mockSession, request);

      // resolveBusinessDomains is called twice: once for required, once for preferred
      expect(resolveBusinessDomains).toHaveBeenCalledTimes(2);
    });

    it('calls domain resolver with technical domains', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [] },
      ]);

      (resolveTechnicalDomains as Mock).mockResolvedValue([
        { domainId: 'td-backend', expandedDomainIds: ['td-backend'] },
      ]);

      const request: SearchFilterRequest = {
        requiredTechnicalDomains: [{ domain: 'backend' }],
      };

      await executeSearch(mockSession, request);

      expect(resolveTechnicalDomains).toHaveBeenCalledWith(
        mockSession,
        request.requiredTechnicalDomains
      );
    });
  });

  describe('pagination', () => {
    it('respects limit and offset parameters', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: Array.from({ length: 5 }, (_, i) =>
            mockData.createEngineerRecord({ id: `eng-${i}`, totalCount: 100 })
          ),
        },
      ]);

      const result = await executeSearch(mockSession, {
        limit: 5,
        offset: 10,
      });

      expect(result.matches).toHaveLength(5);
    });

    it('returns totalCount from query results', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [
            mockData.createEngineerRecord({ totalCount: 150 }),
            mockData.createEngineerRecord({ totalCount: 150 }),
          ],
        },
      ]);

      const result = await executeSearch(mockSession, { limit: 2 });

      expect(result.totalCount).toBe(150);
    });

    it('returns 0 totalCount for empty results', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [] },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.totalCount).toBe(0);
    });
  });

  describe('utility scoring', () => {
    it('includes utilityScore in each match', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [
            mockData.createEngineerRecord({ id: 'eng-1', yearsExperience: 5 }),
          ],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.matches[0].utilityScore).toBeDefined();
      expect(typeof result.matches[0].utilityScore).toBe('number');
    });

    it('includes score breakdown in results', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [mockData.createEngineerRecord()],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.matches[0].scoreBreakdown).toBeDefined();
      expect(result.matches[0].scoreBreakdown.total).toBe(result.matches[0].utilityScore);
    });

    it('sorts engineers by utility score descending', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [
            mockData.createEngineerRecord({ id: 'junior', yearsExperience: 1 }),
            mockData.createEngineerRecord({ id: 'senior', yearsExperience: 15 }),
            mockData.createEngineerRecord({ id: 'mid', yearsExperience: 5 }),
          ],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      // Each result should have a utility score
      expect(result.matches.length).toBe(3);
      // Verify sorted descending by utilityScore
      for (let i = 0; i < result.matches.length - 1; i++) {
        expect(result.matches[i].utilityScore).toBeGreaterThanOrEqual(
          result.matches[i + 1].utilityScore
        );
      }
    });
  });

  describe('engineer data transformation', () => {
    it('includes all engineer fields in response', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [
            mockData.createEngineerRecord({
              id: 'eng-1',
              name: 'Alice',
              headline: 'Senior Developer',
              salary: 150000,
              yearsExperience: 8,
              startTimeline: 'two_weeks',
              timezone: 'America/New_York',
            }),
          ],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      const match = result.matches[0];
      expect(match.id).toBe('eng-1');
      expect(match.name).toBe('Alice');
      expect(match.headline).toBe('Senior Developer');
      expect(match.salary).toBe(150000);
      expect(match.yearsExperience).toBe(8);
      expect(match.startTimeline).toBe('two_weeks');
      expect(match.timezone).toBe('America/New_York');
    });

    it('includes skill arrays in response', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [mockData.createEngineerRecord()],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.matches[0].matchedSkills).toBeDefined();
      expect(Array.isArray(result.matches[0].matchedSkills)).toBe(true);
      expect(result.matches[0].unmatchedRelatedSkills).toBeDefined();
      expect(Array.isArray(result.matches[0].unmatchedRelatedSkills)).toBe(true);
    });

    it('includes domain arrays in response', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [mockData.createEngineerRecord()],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.matches[0].matchedBusinessDomains).toBeDefined();
      expect(Array.isArray(result.matches[0].matchedBusinessDomains)).toBe(true);
      expect(result.matches[0].matchedTechnicalDomains).toBeDefined();
      expect(Array.isArray(result.matches[0].matchedTechnicalDomains)).toBe(true);
    });
  });

  describe('applied filters tracking', () => {
    it('tracks seniority level as applied filter', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        requiredSeniorityLevel: 'senior',
      });

      const seniorityFilter = result.appliedFilters.find(
        (f) => f.field === 'yearsExperience'
      );
      expect(seniorityFilter).toBeDefined();
      expect(seniorityFilter?.source).toBe('knowledge_base');
    });

    it('tracks timezone as applied filter', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        requiredTimezone: ['America/*'],
      });

      const tzFilter = result.appliedFilters.find((f) => f.field === 'timezone');
      expect(tzFilter).toBeDefined();
      expect(tzFilter?.source).toBe('user');
    });

    it('tracks budget as applied filter', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        maxBudget: 200000,
      });

      const budgetFilter = result.appliedFilters.find((f) => f.field === 'salary');
      expect(budgetFilter).toBeDefined();
      expect(isPropertyFilter(budgetFilter!)).toBe(true);
      if (isPropertyFilter(budgetFilter!)) {
        expect(budgetFilter.value).toBe('200000');
      }
    });
  });

  describe('applied preferences tracking', () => {
    it('tracks preferred seniority as preference', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        preferredSeniorityLevel: 'senior',
      });

      const seniorityPref = result.appliedPreferences.find(
        (p) => p.field === 'preferredSeniorityLevel'
      );
      expect(seniorityPref).toBeDefined();
      expect(isPropertyPreference(seniorityPref!)).toBe(true);
      if (isPropertyPreference(seniorityPref!)) {
        expect(seniorityPref.value).toBe('senior');
      }
    });

    it('tracks preferred timeline as preference', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        preferredMaxStartTime: 'immediate',
      });

      const timelinePref = result.appliedPreferences.find(
        (p) => p.field === 'preferredMaxStartTime'
      );
      expect(timelinePref).toBeDefined();
      expect(isPropertyPreference(timelinePref!)).toBe(true);
      if (isPropertyPreference(timelinePref!)) {
        expect(timelinePref.value).toBe('immediate');
      }
    });

    it('tracks team focus as preference', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        teamFocus: 'greenfield',
      });

      const teamFocusPref = result.appliedPreferences.find(
        (p) => p.field === 'teamFocusMatch'
      );
      expect(teamFocusPref).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('propagates Neo4j errors', async () => {
      const mockSession = createMockSession();
      mockSession.run = vi.fn().mockRejectedValue(new Error('Connection lost'));

      await expect(executeSearch(mockSession, {})).rejects.toThrow('Connection lost');
    });

    it('propagates skill resolution errors', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [] },
      ]);

      (resolveAllSkills as Mock).mockRejectedValue(new Error('Skill resolution failed'));

      await expect(
        executeSearch(mockSession, { requiredSkills: [{ skill: 'test' }] })
      ).rejects.toThrow('Skill resolution failed');
    });

    it('propagates domain resolution errors', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [] },
      ]);

      (resolveBusinessDomains as Mock).mockRejectedValue(
        new Error('Domain resolution failed')
      );

      await expect(
        executeSearch(mockSession, { requiredBusinessDomains: [{ domain: 'test' }] })
      ).rejects.toThrow('Domain resolution failed');
    });
  });

  describe('overriddenRuleIds handling', () => {
    it('echoes back overriddenRuleIds in response', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        teamFocus: 'scaling',
        overriddenRuleIds: ['scaling-requires-distributed'],
      });

      expect(result.overriddenRuleIds).toEqual(['scaling-requires-distributed']);
    });

    it('returns empty array when no overriddenRuleIds provided', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.overriddenRuleIds).toEqual([]);
    });

    it('marks filter rule as overridden when in overriddenRuleIds', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        teamFocus: 'scaling',
        overriddenRuleIds: ['scaling-requires-distributed'],
      });

      // Find the scaling-requires-distributed rule in derivedConstraints
      const scalingRule = result.derivedConstraints.find(
        (dc) => dc.rule.id === 'scaling-requires-distributed'
      );
      expect(scalingRule).toBeDefined();
      expect(scalingRule!.override?.overrideScope).toBe('FULL');
    });

    it('marks boost rule as overridden when in overriddenRuleIds', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        requiredSeniorityLevel: 'senior',
        overriddenRuleIds: ['senior-prefers-leadership'],
      });

      const leadershipRule = result.derivedConstraints.find(
        (dc) => dc.rule.id === 'senior-prefers-leadership'
      );
      expect(leadershipRule).toBeDefined();
      expect(leadershipRule!.override?.overrideScope).toBe('FULL');
    });

    it('prevents rule chaining when parent filter rule is overridden', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      // Without override: scaling -> distributed -> observability chain fires
      const resultWithoutOverride = await executeSearch(mockSession, {
        teamFocus: 'scaling',
      });

      const observabilityWithoutOverride = resultWithoutOverride.derivedConstraints.find(
        (dc) => dc.rule.id === 'distributed-requires-observability'
      );
      expect(observabilityWithoutOverride).toBeDefined();

      // With override: chain should be broken
      const resultWithOverride = await executeSearch(mockSession, {
        teamFocus: 'scaling',
        overriddenRuleIds: ['scaling-requires-distributed'],
      });

      const observabilityWithOverride = resultWithOverride.derivedConstraints.find(
        (dc) => dc.rule.id === 'distributed-requires-observability'
      );
      expect(observabilityWithOverride).toBeUndefined();
    });

    it('handles unknown rule IDs gracefully (no-op)', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      // Should not throw, unknown IDs are silently ignored
      const result = await executeSearch(mockSession, {
        teamFocus: 'scaling',
        overriddenRuleIds: ['nonexistent-rule-id'],
      });

      // The scaling rule should still fire and NOT be overridden
      const scalingRule = result.derivedConstraints.find(
        (dc) => dc.rule.id === 'scaling-requires-distributed'
      );
      expect(scalingRule).toBeDefined();
      expect(scalingRule!.override).toBeUndefined();
    });
  });

  describe('defaults applied tracking', () => {
    it('tracks when default requiredMaxStartTime is used', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.queryMetadata.defaultsApplied).toContain('requiredMaxStartTime');
    });

    it('tracks when default limit is used', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.queryMetadata.defaultsApplied).toContain('limit');
    });

    it('does not track defaults when user specifies values', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        requiredMaxStartTime: 'immediate',
        limit: 10,
      });

      expect(result.queryMetadata.defaultsApplied).not.toContain('requiredMaxStartTime');
      expect(result.queryMetadata.defaultsApplied).not.toContain('limit');
    });
  });

  describe('derivedConstraints in response', () => {
    it('includes derivedConstraints array in response', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, { teamFocus: 'scaling' });

      expect(result.derivedConstraints).toBeDefined();
      expect(Array.isArray(result.derivedConstraints)).toBe(true);
      expect(result.derivedConstraints.length).toBeGreaterThan(0);
    });

    it('includes filter rules in derivedConstraints for scaling', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, { teamFocus: 'scaling' });

      const scalingRule = result.derivedConstraints.find(
        (dc) => dc.rule.id === 'scaling-requires-distributed'
      );
      expect(scalingRule).toBeDefined();
      expect(scalingRule!.action.effect).toBe('filter');
      expect(scalingRule!.action.targetValue).toContain('skill_distributed');
    });

    it('includes boost rules in derivedConstraints for senior', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        requiredSeniorityLevel: 'senior',
      });

      const leadershipRule = result.derivedConstraints.find(
        (dc) => dc.rule.id === 'senior-prefers-leadership'
      );
      expect(leadershipRule).toBeDefined();
      expect(leadershipRule!.action.effect).toBe('boost');
      expect(leadershipRule!.action.boostStrength).toBeGreaterThan(0);
    });

    it('includes chain rules in derivedConstraints', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, { teamFocus: 'scaling' });

      // Chain: scaling → distributed → observability
      const observabilityRule = result.derivedConstraints.find(
        (dc) => dc.rule.id === 'distributed-requires-observability'
      );
      expect(observabilityRule).toBeDefined();
    });

    it('includes provenance in derivedConstraints', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, { teamFocus: 'scaling' });

      for (const constraint of result.derivedConstraints) {
        expect(constraint.provenance).toBeDefined();
        expect(constraint.provenance.derivationChains).toBeDefined();
        expect(constraint.provenance.explanation).toBeDefined();
      }
    });
  });

  describe('derived skills affect query', () => {
    it('includes derived required skills in query context', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      // We can't directly verify Cypher query parameters with current mock,
      // but we can verify the derivedConstraints contain the right skills
      const result = await executeSearch(mockSession, { teamFocus: 'scaling' });

      // Find filter constraints (exclude fully overridden ones)
      const filterConstraints = result.derivedConstraints.filter(
        (dc) => dc.action.effect === 'filter' && dc.override?.overrideScope !== 'FULL'
      );

      expect(filterConstraints.length).toBeGreaterThan(0);

      // All filter constraints should target derivedSkills
      for (const fc of filterConstraints) {
        expect(fc.action.targetField).toBe('derivedSkills');
      }
    });
  });

  describe('multiple overriddenRuleIds', () => {
    it('handles multiple overridden rules correctly', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        teamFocus: 'scaling',
        requiredSeniorityLevel: 'senior',
        overriddenRuleIds: [
          'scaling-requires-distributed',
          'senior-prefers-leadership',
        ],
      });

      // Both rules should be marked as overridden
      const scalingRule = result.derivedConstraints.find(
        (dc) => dc.rule.id === 'scaling-requires-distributed'
      );
      const leadershipRule = result.derivedConstraints.find(
        (dc) => dc.rule.id === 'senior-prefers-leadership'
      );

      expect(scalingRule?.override?.overrideScope).toBe('FULL');
      expect(leadershipRule?.override?.overrideScope).toBe('FULL');

      // Response should echo back all overriddenRuleIds
      expect(result.overriddenRuleIds).toContain('scaling-requires-distributed');
      expect(result.overriddenRuleIds).toContain('senior-prefers-leadership');
    });
  });

  describe('empty derivedConstraints', () => {
    it('returns empty array when no rules fire', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      // Junior seniority doesn't trigger any rules
      const result = await executeSearch(mockSession, {
        requiredSeniorityLevel: 'junior',
      });

      // May have empty or minimal derivedConstraints
      // The key is that it doesn't error
      expect(result.derivedConstraints).toBeDefined();
      expect(Array.isArray(result.derivedConstraints)).toBe(true);
    });
  });

  describe('constraint advisor integration', () => {
    /*
     * Note: Full constraint advisor integration requires complex mocking.
     * These tests verify the response structure includes advisor fields.
     * E2E tests cover actual relaxation/tightening logic.
     */
    it('includes relaxation field in response for sparse results', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [] }, // Empty results trigger relaxation
      ]);

      const result = await executeSearch(mockSession, {
        requiredSeniorityLevel: 'principal', // Very restrictive
        requiredTimezone: ['Antarctica/*'], // Very restrictive
      });

      // Response should include relaxation field when results are sparse
      expect(result).toHaveProperty('relaxation');
      expect(result.relaxation).toBeDefined();
      expect(result.relaxation?.suggestions).toBeDefined();
    });

    it('includes tightening field in response for broad search', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: Array.from({ length: 30 }, (_, i) =>
            mockData.createEngineerRecord({ id: `eng-${i}`, totalCount: 30 })
          ),
        },
      ]);

      const result = await executeSearch(mockSession, {}); // Very broad search

      // Response should include tightening field when results are abundant
      expect(result).toHaveProperty('tightening');
      expect(result.tightening).toBeDefined();
      expect(result.tightening?.suggestions).toBeDefined();
    });
  });

  describe('compound rules', () => {
    it('fires compound rule when all conditions met', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [mockData.createEngineerRecord()] },
      ]);

      const result = await executeSearch(mockSession, {
        requiredSeniorityLevel: 'senior',
        teamFocus: 'greenfield',
      });

      const ownershipRule = result.derivedConstraints.find(
        (dc) => dc.rule.id === 'senior-greenfield-prefers-ownership'
      );
      expect(ownershipRule).toBeDefined();
      expect(ownershipRule!.action.targetValue).toContain('skill_ownership');
    });
  });
});
