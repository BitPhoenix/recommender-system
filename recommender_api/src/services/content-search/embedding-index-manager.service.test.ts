import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Session, Result, Record as Neo4jRecord, QueryResult } from 'neo4j-driver';

/*
 * Unit tests for embedding index manager.
 *
 * These tests mock Neo4j and LLM service to verify the embedding logic
 * without requiring actual infrastructure.
 */

// Mock the LLM service module
vi.mock('../llm.service.js', () => ({
  generateEmbedding: vi.fn(),
  getEmbeddingModelName: vi.fn(() => 'mxbai-embed-large'),
}));

// Mock the engineer text loader
vi.mock('./engineer-text-loader.service.js', () => ({
  loadEngineerTextContent: vi.fn(),
  concatenateEngineerText: vi.fn(),
}));

describe('Embedding Index Manager', () => {
  let mockSession: Session;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSession = {
      run: vi.fn(),
      close: vi.fn(),
    } as unknown as Session;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('updateEngineerEmbedding', () => {
    it('generates and stores embedding for engineer with content', async () => {
      // Import after mocks are set up
      const { updateEngineerEmbedding } = await import('./embedding-index-manager.service.js');
      const { loadEngineerTextContent, concatenateEngineerText } = await import('./engineer-text-loader.service.js');
      const { generateEmbedding } = await import('../llm.service.js');

      // Mock engineer text content
      vi.mocked(loadEngineerTextContent).mockResolvedValue([{
        engineerId: 'eng_test',
        headline: 'Senior Engineer',
        jobTitles: ['Staff Engineer'],
        skills: ['Python', 'Kubernetes'],
        domains: ['Backend'],
        jobHighlights: ['Led team of 5'],
        companyNames: ['TechCorp'],
        resumeText: 'Experienced engineer with 10 years...',
      }]);

      vi.mocked(concatenateEngineerText).mockReturnValue(
        'Senior Engineer Staff Engineer Python Kubernetes Backend TechCorp Led team of 5'
      );

      // Mock embedding generation
      const fakeEmbedding = new Array(1024).fill(0.1);
      vi.mocked(generateEmbedding).mockResolvedValue(fakeEmbedding);

      // Mock Neo4j session run
      vi.mocked(mockSession.run).mockResolvedValue({ records: [] } as unknown as QueryResult);

      const result = await updateEngineerEmbedding(mockSession, 'eng_test');

      expect(result).toBe(true);
      expect(generateEmbedding).toHaveBeenCalledWith(
        'Senior Engineer Staff Engineer Python Kubernetes Backend TechCorp Led team of 5'
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET e.embedding'),
        expect.objectContaining({
          engineerId: 'eng_test',
          embedding: fakeEmbedding,
          model: 'mxbai-embed-large',
        })
      );
    });

    it('returns false when engineer has no content', async () => {
      const { updateEngineerEmbedding } = await import('./embedding-index-manager.service.js');
      const { loadEngineerTextContent, concatenateEngineerText } = await import('./engineer-text-loader.service.js');

      vi.mocked(loadEngineerTextContent).mockResolvedValue([{
        engineerId: 'eng_empty',
        headline: '',
        jobTitles: [],
        skills: [],
        domains: [],
        jobHighlights: [],
        companyNames: [],
        resumeText: '',
      }]);

      vi.mocked(concatenateEngineerText).mockReturnValue('');

      const result = await updateEngineerEmbedding(mockSession, 'eng_empty');

      expect(result).toBe(false);
    });

    it('returns false when LLM is unavailable', async () => {
      const { updateEngineerEmbedding } = await import('./embedding-index-manager.service.js');
      const { loadEngineerTextContent, concatenateEngineerText } = await import('./engineer-text-loader.service.js');
      const { generateEmbedding } = await import('../llm.service.js');

      vi.mocked(loadEngineerTextContent).mockResolvedValue([{
        engineerId: 'eng_test',
        headline: 'Engineer',
        jobTitles: ['Developer'],
        skills: ['Python'],
        domains: [],
        jobHighlights: [],
        companyNames: [],
        resumeText: 'Some content',
      }]);

      vi.mocked(concatenateEngineerText).mockReturnValue('Engineer Developer Python Some content');
      vi.mocked(generateEmbedding).mockResolvedValue(null);

      const result = await updateEngineerEmbedding(mockSession, 'eng_test');

      expect(result).toBe(false);
    });

    it('returns false when engineer not found', async () => {
      const { updateEngineerEmbedding } = await import('./embedding-index-manager.service.js');
      const { loadEngineerTextContent } = await import('./engineer-text-loader.service.js');

      vi.mocked(loadEngineerTextContent).mockResolvedValue([]);

      const result = await updateEngineerEmbedding(mockSession, 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('findSimilarByEmbedding', () => {
    it('returns engineers sorted by similarity score', async () => {
      const { findSimilarByEmbedding } = await import('./embedding-index-manager.service.js');

      const mockRecords = [
        { get: vi.fn((key) => key === 'engineerId' ? 'eng_1' : 0.95) },
        { get: vi.fn((key) => key === 'engineerId' ? 'eng_2' : 0.85) },
        { get: vi.fn((key) => key === 'engineerId' ? 'eng_3' : 0.75) },
      ] as unknown as Neo4jRecord[];

      vi.mocked(mockSession.run).mockResolvedValue({
        records: mockRecords,
      } as unknown as QueryResult);

      const queryEmbedding = new Array(1024).fill(0.1);
      const results = await findSimilarByEmbedding(mockSession, queryEmbedding, 10);

      expect(results).toHaveLength(3);
      expect(results[0].engineerId).toBe('eng_1');
      expect(results[0].score).toBe(0.95);
      expect(results[2].engineerId).toBe('eng_3');
      expect(results[2].score).toBe(0.75);
    });

    it('excludes specified engineer from results', async () => {
      const { findSimilarByEmbedding } = await import('./embedding-index-manager.service.js');

      const mockRecords = [
        { get: vi.fn((key) => key === 'engineerId' ? 'eng_1' : 0.95) },
        { get: vi.fn((key) => key === 'engineerId' ? 'eng_2' : 0.85) },
        { get: vi.fn((key) => key === 'engineerId' ? 'eng_target' : 0.80) },
      ] as unknown as Neo4jRecord[];

      vi.mocked(mockSession.run).mockResolvedValue({
        records: mockRecords,
      } as unknown as QueryResult);

      const queryEmbedding = new Array(1024).fill(0.1);
      const results = await findSimilarByEmbedding(mockSession, queryEmbedding, 10, 'eng_target');

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.engineerId)).not.toContain('eng_target');
    });

    it('respects limit parameter', async () => {
      const { findSimilarByEmbedding } = await import('./embedding-index-manager.service.js');

      const mockRecords = [
        { get: vi.fn((key) => key === 'engineerId' ? 'eng_1' : 0.95) },
        { get: vi.fn((key) => key === 'engineerId' ? 'eng_2' : 0.85) },
        { get: vi.fn((key) => key === 'engineerId' ? 'eng_3' : 0.75) },
        { get: vi.fn((key) => key === 'engineerId' ? 'eng_4' : 0.65) },
        { get: vi.fn((key) => key === 'engineerId' ? 'eng_5' : 0.55) },
      ] as unknown as Neo4jRecord[];

      vi.mocked(mockSession.run).mockResolvedValue({
        records: mockRecords,
      } as unknown as QueryResult);

      const queryEmbedding = new Array(1024).fill(0.1);
      const results = await findSimilarByEmbedding(mockSession, queryEmbedding, 3);

      expect(results).toHaveLength(3);
    });
  });

  describe('findSimilarToEngineer', () => {
    it('throws error when engineer not found', async () => {
      const { findSimilarToEngineer } = await import('./embedding-index-manager.service.js');

      vi.mocked(mockSession.run).mockResolvedValue({
        records: [],
      } as unknown as QueryResult);

      await expect(findSimilarToEngineer(mockSession, 'nonexistent')).rejects.toThrow(
        'Engineer not found: nonexistent'
      );
    });

    it('throws error when engineer has no embedding', async () => {
      const { findSimilarToEngineer } = await import('./embedding-index-manager.service.js');

      const mockRecords = [
        { get: vi.fn(() => null) },
      ] as unknown as Neo4jRecord[];

      vi.mocked(mockSession.run).mockResolvedValue({
        records: mockRecords,
      } as unknown as QueryResult);

      await expect(findSimilarToEngineer(mockSession, 'eng_no_embedding')).rejects.toThrow(
        'Engineer has no embedding: eng_no_embedding'
      );
    });
  });
});
