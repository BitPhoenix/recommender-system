import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildEngineerTfIdfIndex,
  getTfIdfIndex,
  updateTfIdfIndex,
  resetTfIdfIndex,
} from './tfidf-index-manager.service.js';
import { queryToVector, cosineSimilarity, getTopMatchingTerms } from './tfidf-vectorizer.service.js';
import { createMockSession, createMockQueryResult } from '../../__mocks__/neo4j-session.mock.js';

describe('tfidf-index-manager.service', () => {
  beforeEach(() => {
    // Reset index before each test
    resetTfIdfIndex();
  });

  afterEach(() => {
    resetTfIdfIndex();
  });

  const createEngineerMockData = (engineers: Array<{
    engineerId: string;
    headline: string;
    jobTitles: string[];
    skills: string[];
    domains: string[];
    jobHighlights: string[];
    resumeText: string;
  }>) => {
    return engineers.map((e) => ({
      engineerId: e.engineerId,
      headline: e.headline,
      jobTitles: e.jobTitles,
      skills: e.skills,
      domains: e.domains,
      jobHighlights: e.jobHighlights,
      resumeText: e.resumeText,
    }));
  };

  describe('buildEngineerTfIdfIndex', () => {
    it('builds index from engineer documents', async () => {
      const engineerData = createEngineerMockData([
        {
          engineerId: 'eng-1',
          headline: 'Senior React Developer',
          jobTitles: ['Software Engineer', 'Tech Lead'],
          skills: ['React', 'TypeScript', 'GraphQL'],
          domains: ['Fintech', 'Backend'],
          jobHighlights: ['Built scalable API'],
          resumeText: 'Experienced developer with React and TypeScript expertise.',
        },
        {
          engineerId: 'eng-2',
          headline: 'Python Backend Engineer',
          jobTitles: ['Backend Developer'],
          skills: ['Python', 'Django', 'PostgreSQL'],
          domains: ['Healthcare', 'Backend'],
          jobHighlights: ['Implemented data pipeline'],
          resumeText: 'Specialized in Python backend development and data engineering.',
        },
      ]);

      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: engineerData,
        },
      ]);

      const index = await buildEngineerTfIdfIndex(mockSession);

      expect(index.totalDocuments).toBe(2);
      expect(index.documentIdToVector.has('eng-1')).toBe(true);
      expect(index.documentIdToVector.has('eng-2')).toBe(true);
      expect(index.vocabulary.size).toBeGreaterThan(0);
    });

    it('creates vocabulary from all engineer text fields', async () => {
      const engineerData = createEngineerMockData([
        {
          engineerId: 'eng-1',
          headline: 'Kubernetes Expert',
          jobTitles: ['DevOps Engineer'],
          skills: ['Kubernetes', 'Docker', 'Terraform'],
          domains: ['Cloud', 'DevOps'],
          jobHighlights: ['Managed production clusters'],
          resumeText: 'Infrastructure specialist with cloud-native experience.',
        },
      ]);

      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: engineerData,
        },
      ]);

      const index = await buildEngineerTfIdfIndex(mockSession);

      // Check vocabulary includes terms from various fields
      expect(index.vocabulary.has('kubernetes')).toBe(true);
      expect(index.vocabulary.has('docker')).toBe(true);
      expect(index.vocabulary.has('terraform')).toBe(true);
      expect(index.vocabulary.has('devops')).toBe(true);
      expect(index.vocabulary.has('cloud')).toBe(true);
      expect(index.vocabulary.has('infrastructure')).toBe(true);
    });

    it('handles engineers with minimal data', async () => {
      const engineerData = createEngineerMockData([
        {
          engineerId: 'eng-minimal',
          headline: '',
          jobTitles: [],
          skills: [],
          domains: [],
          jobHighlights: [],
          resumeText: 'Software developer',
        },
      ]);

      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: engineerData,
        },
      ]);

      const index = await buildEngineerTfIdfIndex(mockSession);

      expect(index.totalDocuments).toBe(1);
      expect(index.documentIdToVector.has('eng-minimal')).toBe(true);
    });

    it('handles empty engineer corpus', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [],
        },
      ]);

      const index = await buildEngineerTfIdfIndex(mockSession);

      expect(index.totalDocuments).toBe(0);
      expect(index.vocabulary.size).toBe(0);
    });
  });

  describe('getTfIdfIndex', () => {
    it('builds index if not already built', async () => {
      const engineerData = createEngineerMockData([
        {
          engineerId: 'eng-1',
          headline: 'Developer',
          jobTitles: [],
          skills: ['React'],
          domains: [],
          jobHighlights: [],
          resumeText: 'React developer',
        },
      ]);

      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: engineerData,
        },
      ]);

      const index = await getTfIdfIndex(mockSession);

      expect(index.totalDocuments).toBe(1);
    });

    it('returns cached index if already built', async () => {
      const engineerData = createEngineerMockData([
        {
          engineerId: 'eng-1',
          headline: 'Developer',
          jobTitles: [],
          skills: ['React'],
          domains: [],
          jobHighlights: [],
          resumeText: 'React developer',
        },
      ]);

      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: engineerData,
        },
      ]);
      const runSpy = vi.spyOn(mockSession, 'run');

      // First call builds
      await getTfIdfIndex(mockSession);
      // Second call should use cache
      await getTfIdfIndex(mockSession);

      // Should only call run once (for the first build)
      expect(runSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateTfIdfIndex', () => {
    it('rebuilds index after engineer profile changes', async () => {
      const initialData = createEngineerMockData([
        {
          engineerId: 'eng-1',
          headline: 'Developer',
          jobTitles: [],
          skills: ['React'],
          domains: [],
          jobHighlights: [],
          resumeText: 'React developer',
        },
      ]);

      const updatedData = createEngineerMockData([
        {
          engineerId: 'eng-1',
          headline: 'Senior Developer',
          jobTitles: [],
          skills: ['React', 'TypeScript'],
          domains: [],
          jobHighlights: [],
          resumeText: 'React and TypeScript developer',
        },
      ]);

      let currentData = initialData;
      const mockSession = createMockSession();
      vi.spyOn(mockSession, 'run').mockImplementation(() => {
        return Promise.resolve(createMockQueryResult(currentData));
      });

      // Build initial index
      const initialIndex = await buildEngineerTfIdfIndex(mockSession);
      expect(initialIndex.vocabulary.has('typescript')).toBe(false);

      // Update data
      currentData = updatedData;

      // Rebuild index
      await updateTfIdfIndex(mockSession);

      // Get new index
      const updatedIndex = await getTfIdfIndex(mockSession);

      expect(updatedIndex.vocabulary.has('typescript')).toBe(true);
    });
  });

  describe('search functionality', () => {
    it('searches index and returns ranked results', async () => {
      const engineerData = createEngineerMockData([
        {
          engineerId: 'react-expert',
          headline: 'React Expert',
          jobTitles: ['Frontend Engineer'],
          skills: ['React', 'TypeScript', 'GraphQL'],
          domains: ['Frontend'],
          jobHighlights: ['Built React applications'],
          resumeText: 'Expert React developer with extensive frontend experience.',
        },
        {
          engineerId: 'python-expert',
          headline: 'Python Expert',
          jobTitles: ['Backend Engineer'],
          skills: ['Python', 'Django'],
          domains: ['Backend'],
          jobHighlights: ['Built Python APIs'],
          resumeText: 'Expert Python developer with backend experience.',
        },
        {
          engineerId: 'fullstack',
          headline: 'Fullstack Developer',
          jobTitles: ['Software Engineer'],
          skills: ['React', 'Python', 'Node.js'],
          domains: ['Fullstack'],
          jobHighlights: ['Built fullstack applications'],
          resumeText: 'Fullstack developer with React and Python experience.',
        },
      ]);

      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: engineerData,
        },
      ]);

      const index = await buildEngineerTfIdfIndex(mockSession);
      const queryVector = queryToVector('React frontend developer', index);

      // Calculate scores
      const scores: Array<{ id: string; score: number }> = [];
      for (const [docId, docVector] of index.documentIdToVector) {
        scores.push({
          id: docId,
          score: cosineSimilarity(queryVector, docVector),
        });
      }

      scores.sort((a, b) => b.score - a.score);

      // React expert should rank highest for React query
      expect(scores[0].id).toBe('react-expert');
      // Python expert should rank lowest
      expect(scores[scores.length - 1].id).toBe('python-expert');
    });

    it('returns matching terms in search results', async () => {
      const engineerData = createEngineerMockData([
        {
          engineerId: 'eng-1',
          headline: 'Kubernetes DevOps Engineer',
          jobTitles: ['DevOps Engineer'],
          skills: ['Kubernetes', 'Docker', 'AWS'],
          domains: ['Cloud'],
          jobHighlights: ['Managed Kubernetes clusters'],
          resumeText: 'DevOps engineer specializing in Kubernetes and cloud infrastructure.',
        },
      ]);

      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: engineerData,
        },
      ]);

      const index = await buildEngineerTfIdfIndex(mockSession);
      const queryVector = queryToVector('kubernetes docker cloud', index);
      const docVector = index.documentIdToVector.get('eng-1')!;

      const matchingTerms = getTopMatchingTerms(queryVector, docVector);

      // Should find matching terms
      expect(matchingTerms.length).toBeGreaterThan(0);

      const matchedTermNames = matchingTerms.map((t) => t.term);
      expect(matchedTermNames).toContain('kubernetes');
      expect(matchedTermNames).toContain('docker');
      expect(matchedTermNames).toContain('cloud');
    });
  });

  describe('resetTfIdfIndex', () => {
    it('clears the cached index', async () => {
      const engineerData = createEngineerMockData([
        {
          engineerId: 'eng-1',
          headline: 'Developer',
          jobTitles: [],
          skills: ['React'],
          domains: [],
          jobHighlights: [],
          resumeText: 'React developer',
        },
      ]);

      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: engineerData,
        },
      ]);
      const runSpy = vi.spyOn(mockSession, 'run');

      // Build index
      await getTfIdfIndex(mockSession);
      expect(runSpy).toHaveBeenCalledTimes(1);

      // Reset
      resetTfIdfIndex();

      // Should rebuild when getting index again
      await getTfIdfIndex(mockSession);
      expect(runSpy).toHaveBeenCalledTimes(2);
    });
  });
});
