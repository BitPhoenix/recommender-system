import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findSimilarEngineers } from './similarity.service.js';
import { createMockSession, createMockRecord } from '../__mocks__/neo4j-session.mock.js';
import type { Session } from 'neo4j-driver';

/*
 * Mock the similarity calculator module.
 * We test the calculator separately - here we verify the service orchestration.
 */
vi.mock('./similarity-calculator/index.js', () => ({
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
        headline: 'Engineer',
        yearsExperience: 5,
        timezone: 'Eastern',
        skills: [],
        businessDomains: [],
        technicalDomains: [],
      },
      similarityScore: 0.85,
      breakdown: { skills: 0.9, yearsExperience: 0.8, domain: 0.7, timezone: 1.0 },
      sharedSkills: ['TypeScript'],
      correlatedSkills: [],
    },
    {
      engineer: {
        id: 'eng_candidate_2',
        name: 'Candidate Two',
        headline: 'Developer',
        yearsExperience: 3,
        timezone: 'Pacific',
        skills: [],
        businessDomains: [],
        technicalDomains: [],
      },
      similarityScore: 0.72,
      breakdown: { skills: 0.6, yearsExperience: 0.9, domain: 0.5, timezone: 0.67 },
      sharedSkills: [],
      correlatedSkills: [],
    },
  ]),
  selectDiverseResults: vi.fn().mockImplementation(
    (_skillGraph, _domainGraph, candidates, limit) => candidates.slice(0, limit)
  ),
}));

import {
  loadSkillGraph,
  loadDomainGraph,
  scoreAndSortCandidates,
  selectDiverseResults,
} from './similarity-calculator/index.js';

// Helper to create mock engineer data matching the service query shape
function createMockEngineerData(overrides: Partial<{
  id: string;
  name: string;
  headline: string;
  yearsExperience: number;
  timezone: string;
  skills: Array<{ skillId: string; skillName: string; proficiencyLevel: string; confidenceScore: number } | null>;
  businessDomains: Array<{ domainId: string; domainName: string; years: number } | null>;
  technicalDomains: Array<{ domainId: string; domainName: string; years: number } | null>;
}> = {}) {
  return {
    id: 'eng_test',
    name: 'Test Engineer',
    headline: 'Software Engineer',
    yearsExperience: 5,
    timezone: 'Eastern',
    skills: [],
    businessDomains: [],
    technicalDomains: [],
    ...overrides,
  };
}

describe('findSimilarEngineers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful requests', () => {
    it('returns target and similar engineers', async () => {
      const mockSession = createMockSession([
        {
          // Target engineer query
          pattern: 'MATCH (e:Engineer {id: $engineerId})',
          result: [createMockEngineerData({ id: 'eng_target', name: 'Target Engineer' })],
        },
        {
          // All other engineers query
          pattern: 'WHERE e.id <> $excludeId',
          result: [
            createMockEngineerData({ id: 'eng_1', name: 'Engineer One' }),
            createMockEngineerData({ id: 'eng_2', name: 'Engineer Two' }),
          ],
        },
      ]);

      const result = await findSimilarEngineers(mockSession, 'eng_target', 5);

      expect(result.target.id).toBe('eng_target');
      expect(result.target.name).toBe('Target Engineer');
      expect(result.similar).toHaveLength(2);
    });

    it('calls graph loaders', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer {id: $engineerId})',
          result: [createMockEngineerData()],
        },
        {
          pattern: 'WHERE e.id <> $excludeId',
          result: [],
        },
      ]);

      await findSimilarEngineers(mockSession, 'eng_test', 5);

      expect(loadSkillGraph).toHaveBeenCalledWith(mockSession);
      expect(loadDomainGraph).toHaveBeenCalledWith(mockSession);
    });

    it('calls similarity calculator with loaded data', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer {id: $engineerId})',
          result: [createMockEngineerData({ id: 'eng_target' })],
        },
        {
          pattern: 'WHERE e.id <> $excludeId',
          result: [
            createMockEngineerData({ id: 'eng_candidate' }),
          ],
        },
      ]);

      await findSimilarEngineers(mockSession, 'eng_target', 5);

      expect(scoreAndSortCandidates).toHaveBeenCalled();
      expect(selectDiverseResults).toHaveBeenCalledWith(
        expect.any(Object), // skillGraph
        expect.any(Object), // domainGraph
        expect.any(Array),  // candidates
        5                   // limit
      );
    });

    it('respects limit parameter', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer {id: $engineerId})',
          result: [createMockEngineerData()],
        },
        {
          pattern: 'WHERE e.id <> $excludeId',
          result: [],
        },
      ]);

      await findSimilarEngineers(mockSession, 'eng_test', 3);

      expect(selectDiverseResults).toHaveBeenCalledWith(
        expect.any(Object), // skillGraph
        expect.any(Object), // domainGraph
        expect.any(Array),  // candidates
        3                   // limit
      );
    });

    it('uses default limit of 5', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer {id: $engineerId})',
          result: [createMockEngineerData()],
        },
        {
          pattern: 'WHERE e.id <> $excludeId',
          result: [],
        },
      ]);

      await findSimilarEngineers(mockSession, 'eng_test');

      expect(selectDiverseResults).toHaveBeenCalledWith(
        expect.any(Object), // skillGraph
        expect.any(Object), // domainGraph
        expect.any(Array),  // candidates
        5                   // limit (default)
      );
    });
  });

  describe('error handling', () => {
    it('throws error when target engineer not found', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer {id: $engineerId})',
          result: [], // No engineer found
        },
      ]);

      await expect(findSimilarEngineers(mockSession, 'nonexistent_id', 5))
        .rejects
        .toThrow('Engineer not found: nonexistent_id');
    });
  });

  describe('data parsing', () => {
    it('parses engineer skills correctly', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer {id: $engineerId})',
          result: [createMockEngineerData({
            id: 'eng_target',
            skills: [
              { skillId: 'skill_ts', skillName: 'TypeScript', proficiencyLevel: 'expert', confidenceScore: 0.95 },
              { skillId: 'skill_react', skillName: 'React', proficiencyLevel: 'proficient', confidenceScore: 0.85 },
              null, // Should be filtered out
            ],
          })],
        },
        {
          pattern: 'WHERE e.id <> $excludeId',
          result: [],
        },
      ]);

      const result = await findSimilarEngineers(mockSession, 'eng_target', 5);

      expect(result.target.skills).toHaveLength(2);
      expect(result.target.skills[0].skillId).toBe('skill_ts');
      expect(result.target.skills[1].skillId).toBe('skill_react');
    });

    it('parses business domains correctly', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer {id: $engineerId})',
          result: [createMockEngineerData({
            id: 'eng_target',
            businessDomains: [
              { domainId: 'domain_fintech', domainName: 'Fintech', years: 5 },
              null, // Should be filtered out
            ],
          })],
        },
        {
          pattern: 'WHERE e.id <> $excludeId',
          result: [],
        },
      ]);

      const result = await findSimilarEngineers(mockSession, 'eng_target', 5);

      expect(result.target.businessDomains).toHaveLength(1);
      expect(result.target.businessDomains[0].domainId).toBe('domain_fintech');
    });

    it('parses technical domains correctly', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer {id: $engineerId})',
          result: [createMockEngineerData({
            id: 'eng_target',
            technicalDomains: [
              { domainId: 'domain_backend', domainName: 'Backend', years: 3 },
              null, // Should be filtered out
            ],
          })],
        },
        {
          pattern: 'WHERE e.id <> $excludeId',
          result: [],
        },
      ]);

      const result = await findSimilarEngineers(mockSession, 'eng_target', 5);

      expect(result.target.technicalDomains).toHaveLength(1);
      expect(result.target.technicalDomains[0].domainId).toBe('domain_backend');
    });

    it('handles Neo4j integer types for yearsExperience', async () => {
      // Neo4j returns integers as objects with toNumber() method
      const neo4jInteger = {
        toNumber: () => 8,
        low: 8,
        high: 0,
      };

      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer {id: $engineerId})',
          result: [{
            ...createMockEngineerData({ id: 'eng_target' }),
            yearsExperience: neo4jInteger,
          }],
        },
        {
          pattern: 'WHERE e.id <> $excludeId',
          result: [],
        },
      ]);

      const result = await findSimilarEngineers(mockSession, 'eng_target', 5);

      expect(result.target.yearsExperience).toBe(8);
      expect(typeof result.target.yearsExperience).toBe('number');
    });
  });

  describe('empty candidates', () => {
    it('returns empty similar array when no other engineers exist', async () => {
      // Reset mock to return empty for this test
      vi.mocked(scoreAndSortCandidates).mockReturnValueOnce([]);
      vi.mocked(selectDiverseResults).mockReturnValueOnce([]);

      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer {id: $engineerId})',
          result: [createMockEngineerData({ id: 'eng_lonely' })],
        },
        {
          pattern: 'WHERE e.id <> $excludeId',
          result: [], // No other engineers
        },
      ]);

      const result = await findSimilarEngineers(mockSession, 'eng_lonely', 5);

      expect(result.target.id).toBe('eng_lonely');
      expect(result.similar).toHaveLength(0);
    });
  });
});
