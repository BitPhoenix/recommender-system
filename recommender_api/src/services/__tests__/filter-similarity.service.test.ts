import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeFilterSimilarity,
  EngineerNotFoundError,
} from '../filter-similarity.service.js';
import { createMockSession } from '../../__mocks__/neo4j-session.mock.js';

/*
 * Mock the dependencies.
 * We test the service orchestration - component behavior is tested separately.
 */

// Mock skill resolution
vi.mock('../skill-resolution.service.js', () => ({
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
}));

// Mock constraint expander
vi.mock('../constraint-expander.service.js', () => ({
  expandSearchCriteria: vi.fn().mockResolvedValue({
    minYearsExperience: null,
    maxYearsExperience: null,
    startTimeline: ['immediate', 'two_weeks', 'one_month', 'three_months'],
    timezoneZones: [],
    maxBudget: null,
    stretchBudget: null,
    alignedSkillIds: [],
    limit: 10,
    offset: 0,
    appliedFilters: [],
    appliedPreferences: [],
    defaultsApplied: [],
    preferredSeniorityLevel: null,
    requiredSeniorityLevel: null,
    preferredMaxStartTime: null,
    requiredMaxStartTime: 'three_months',
    preferredTimezone: [],
    derivedConstraints: [],
    derivedRequiredSkillIds: [],
    derivedSkillBoosts: new Map(),
  }),
}));

// Mock domain resolver
vi.mock('../domain-resolver.service.js', () => ({
  resolveBusinessDomains: vi.fn().mockResolvedValue([]),
  resolveTechnicalDomains: vi.fn().mockResolvedValue([]),
}));

// Mock query builder
vi.mock('../cypher-query-builder/search-query.builder.js', () => ({
  buildSearchQuery: vi.fn().mockReturnValue({
    query: 'MATCH (e:Engineer) RETURN e.id AS id, 2 AS totalCount',
    params: {},
  }),
}));

// Mock similarity service (only loadEngineerData is used now - candidates parsed from query result)
vi.mock('../similarity.service.js', () => ({
  loadEngineerData: vi.fn().mockImplementation((_session, engineerId) => {
    if (engineerId === 'eng_not_found') {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      id: engineerId,
      name: 'Reference Engineer',
      headline: 'Staff Engineer',
      yearsExperience: 10,
      timezone: 'Pacific',
      skills: [
        { skillId: 'skill_ts', skillName: 'TypeScript', proficiencyLevel: 'expert', confidenceScore: 0.9 },
      ],
      businessDomains: [],
      technicalDomains: [],
      salary: 200000,
      startTimeline: 'immediate',
    });
  }),
}));

// Mock similarity calculator
vi.mock('../similarity-calculator/index.js', () => ({
  loadSkillGraph: vi.fn().mockResolvedValue({ nodes: new Map() }),
  loadDomainGraph: vi.fn().mockResolvedValue({
    businessDomains: new Map(),
    technicalDomains: new Map(),
  }),
  scoreAndSortCandidates: vi.fn().mockReturnValue([
    {
      engineer: {
        id: 'eng_candidate_1',
        name: 'Candidate One',
        headline: 'Senior Engineer',
        yearsExperience: 7,
        timezone: 'Eastern',
        skills: [],
        businessDomains: [],
        technicalDomains: [],
        salary: 175000,
        startTimeline: 'two_weeks',
      },
      similarityScore: 0.85,
      breakdown: { skills: 0.9, yearsExperience: 0.7, domain: 0.8, timezone: 0.67 },
      sharedSkills: ['TypeScript'],
      correlatedSkills: [],
    },
    {
      engineer: {
        id: 'eng_candidate_2',
        name: 'Candidate Two',
        headline: 'Mid Engineer',
        yearsExperience: 4,
        timezone: 'Central',
        skills: [],
        businessDomains: [],
        technicalDomains: [],
        salary: 120000,
        startTimeline: 'one_month',
      },
      similarityScore: 0.55,
      breakdown: { skills: 0.3, yearsExperience: 0.6, domain: 0.5, timezone: 0.33 },
      sharedSkills: [],
      correlatedSkills: [],
    },
  ]),
  selectDiverseResults: vi.fn().mockImplementation(
    (_skillGraph, _domainGraph, candidates, limit) => candidates.slice(0, limit)
  ),
}));

// Mock constraint advisor
vi.mock('../constraint-advisor/index.js', () => ({
  getConstraintAdvice: vi.fn().mockResolvedValue({}),
}));

// Mock knowledge base config
vi.mock('../../config/knowledge-base/index.js', () => ({
  knowledgeBaseConfig: {
    defaults: {
      limit: 20,
      offset: 0,
      defaultMinProficiency: 'learning',
      requiredMaxStartTime: 'three_months',
    },
    seniorityMapping: {
      junior: { minYears: 0, maxYears: 2 },
      mid: { minYears: 2, maxYears: 5 },
      senior: { minYears: 5, maxYears: 10 },
      staff: { minYears: 10, maxYears: null },
      principal: { minYears: 15, maxYears: null },
    },
    teamFocusSkillAlignment: {},
  },
}));

import {
  loadSkillGraph,
  loadDomainGraph,
  scoreAndSortCandidates,
  selectDiverseResults,
} from '../similarity-calculator/index.js';
import { loadEngineerData } from '../similarity.service.js';
import { buildSearchQuery } from '../cypher-query-builder/search-query.builder.js';
import { getConstraintAdvice } from '../constraint-advisor/index.js';

/*
 * Helper to create mock query result records with all fields expected by the service.
 * The unified query returns full engineer data (with collectAllSkills: true).
 */
function createMockEngineerRecord(overrides: Partial<{
  id: string;
  name: string;
  headline: string;
  yearsExperience: number;
  timezone: string;
  salary: number;
  startTimeline: string;
  allRelevantSkills: unknown[];
  matchedBusinessDomains: unknown[];
  matchedTechnicalDomains: unknown[];
  totalCount: number;
}> = {}) {
  return {
    id: 'eng_candidate_1',
    name: 'Candidate One',
    headline: 'Senior Engineer',
    yearsExperience: 7,
    timezone: 'Eastern',
    salary: 175000,
    startTimeline: 'two_weeks',
    allRelevantSkills: [
      { skillId: 'skill_ts', skillName: 'TypeScript', proficiencyLevel: 'proficient', confidenceScore: 0.85 },
    ],
    matchedBusinessDomains: [],
    matchedTechnicalDomains: [],
    totalCount: 1,
    ...overrides,
  };
}

describe('executeFilterSimilarity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reference engineer validation', () => {
    it('throws EngineerNotFoundError for non-existent reference engineer', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [createMockEngineerRecord()],
        },
      ]);

      await expect(
        executeFilterSimilarity(mockSession, {
          referenceEngineerId: 'eng_not_found',
          limit: 10,
          offset: 0,
        })
      ).rejects.toThrow(EngineerNotFoundError);

      await expect(
        executeFilterSimilarity(mockSession, {
          referenceEngineerId: 'eng_not_found',
          limit: 10,
          offset: 0,
        })
      ).rejects.toThrow('Engineer not found: eng_not_found');
    });

    it('returns reference engineer info in response', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [
            createMockEngineerRecord({ id: 'eng_candidate_1', totalCount: 2 }),
            createMockEngineerRecord({ id: 'eng_candidate_2', name: 'Candidate Two', totalCount: 2 }),
          ],
        },
      ]);

      const result = await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        limit: 10,
        offset: 0,
      });

      expect(result.referenceEngineer).toEqual({
        id: 'eng_marcus',
        name: 'Reference Engineer',
        headline: 'Staff Engineer',
      });
    });
  });

  describe('orchestration flow', () => {
    it('loads skill and domain graphs for similarity calculation', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [createMockEngineerRecord()],
        },
      ]);

      await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        limit: 10,
        offset: 0,
      });

      expect(loadSkillGraph).toHaveBeenCalledWith(mockSession);
      expect(loadDomainGraph).toHaveBeenCalledWith(mockSession);
    });

    it('builds and executes filter query', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [createMockEngineerRecord()],
        },
      ]);

      await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        limit: 10,
        offset: 0,
      });

      expect(buildSearchQuery).toHaveBeenCalled();
      expect(mockSession.run).toHaveBeenCalled();
    });

    it('uses unified query with collectAllSkills option', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [
            createMockEngineerRecord({ id: 'eng_candidate_1', totalCount: 2 }),
            createMockEngineerRecord({ id: 'eng_candidate_2', name: 'Candidate Two', totalCount: 2 }),
          ],
        },
      ]);

      await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        limit: 10,
        offset: 0,
      });

      // Verify buildSearchQuery was called with collectAllSkills: true
      expect(buildSearchQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ collectAllSkills: true })
      );
    });

    it('calls similarity calculator with reference and candidates', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [createMockEngineerRecord()],
        },
      ]);

      await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        limit: 10,
        offset: 0,
      });

      expect(scoreAndSortCandidates).toHaveBeenCalled();
      // First arg is skill graph, second is domain graph,
      // third is reference engineer, fourth is candidates
      const scoreCall = vi.mocked(scoreAndSortCandidates).mock.calls[0];
      expect(scoreCall[2].id).toBe('eng_marcus');
    });

    it('applies diversity selection', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [createMockEngineerRecord()],
        },
      ]);

      await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        limit: 10,
        offset: 0,
      });

      expect(selectDiverseResults).toHaveBeenCalled();
    });

    it('gets constraint advice based on result count', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [createMockEngineerRecord()],
        },
      ]);

      await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        limit: 10,
        offset: 0,
      });

      expect(getConstraintAdvice).toHaveBeenCalledWith(
        expect.objectContaining({
          session: mockSession,
          totalCount: 1,
        })
      );
    });
  });

  describe('response structure', () => {
    it('returns matches with similarity scores and breakdowns', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [
            createMockEngineerRecord({ id: 'eng_candidate_1', totalCount: 2 }),
            createMockEngineerRecord({ id: 'eng_candidate_2', name: 'Candidate Two', totalCount: 2 }),
          ],
        },
      ]);

      const result = await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        limit: 10,
        offset: 0,
      });

      expect(result.matches).toHaveLength(2);
      expect(result.matches[0]).toMatchObject({
        id: 'eng_candidate_1',
        similarityScore: 0.85,
        scoreBreakdown: expect.objectContaining({
          skills: expect.any(Number),
          yearsExperience: expect.any(Number),
          domain: expect.any(Number),
          timezone: expect.any(Number),
        }),
        sharedSkills: expect.any(Array),
      });
    });

    it('includes totalCount in response', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [
            createMockEngineerRecord({ id: 'eng_candidate_1', totalCount: 25 }),
            createMockEngineerRecord({ id: 'eng_candidate_2', name: 'Candidate Two', totalCount: 25 }),
          ],
        },
      ]);

      const result = await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        limit: 10,
        offset: 0,
      });

      expect(result.totalCount).toBe(25);
    });

    it('includes appliedFilters in response', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [createMockEngineerRecord()],
        },
      ]);

      const result = await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        limit: 10,
        offset: 0,
      });

      expect(result.appliedFilters).toBeDefined();
      expect(Array.isArray(result.appliedFilters)).toBe(true);
    });

    it('includes queryMetadata with execution time', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [createMockEngineerRecord()],
        },
      ]);

      const result = await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        limit: 10,
        offset: 0,
      });

      expect(result.queryMetadata).toBeDefined();
      expect(result.queryMetadata.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.queryMetadata.candidatesBeforeDiversity).toBeDefined();
    });
  });

  describe('pagination', () => {
    it('respects limit parameter', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [
            createMockEngineerRecord({ id: 'eng_candidate_1', totalCount: 2 }),
            createMockEngineerRecord({ id: 'eng_candidate_2', name: 'Candidate Two', totalCount: 2 }),
          ],
        },
      ]);

      // Mock diversity selector to return 2 results
      vi.mocked(selectDiverseResults).mockReturnValueOnce([
        {
          engineer: { id: 'eng_candidate_1', name: 'One', headline: '', yearsExperience: 5, timezone: 'Eastern', skills: [], businessDomains: [], technicalDomains: [], salary: 100000, startTimeline: 'immediate' },
          similarityScore: 0.9,
          breakdown: { skills: 0.9, yearsExperience: 0.9, domain: 0.9, timezone: 1 },
          sharedSkills: [],
          correlatedSkills: [],
        },
        {
          engineer: { id: 'eng_candidate_2', name: 'Two', headline: '', yearsExperience: 4, timezone: 'Central', skills: [], businessDomains: [], technicalDomains: [], salary: 90000, startTimeline: 'two_weeks' },
          similarityScore: 0.8,
          breakdown: { skills: 0.8, yearsExperience: 0.8, domain: 0.8, timezone: 0.67 },
          sharedSkills: [],
          correlatedSkills: [],
        },
      ]);

      const result = await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        limit: 1,
        offset: 0,
      });

      expect(result.matches).toHaveLength(1);
    });
  });

  describe('overriddenRuleIds', () => {
    it('echoes back overriddenRuleIds in response', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [createMockEngineerRecord()],
        },
      ]);

      const result = await executeFilterSimilarity(mockSession, {
        referenceEngineerId: 'eng_marcus',
        overriddenRuleIds: ['rule_1', 'rule_2'],
        limit: 10,
        offset: 0,
      });

      expect(result.overriddenRuleIds).toEqual(['rule_1', 'rule_2']);
    });
  });
});
