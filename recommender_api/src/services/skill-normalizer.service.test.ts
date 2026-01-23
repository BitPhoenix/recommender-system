import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeExtractedSkill, normalizeExtractedSkills } from './skill-normalizer.service.js';
import { createMockSession, createMockQueryResult } from '../__mocks__/neo4j-session.mock.js';

describe('skill-normalizer.service', () => {
  const mockCanonicalSkills = [
    { id: 'skill_react', name: 'React' },
    { id: 'skill_typescript', name: 'TypeScript' },
    { id: 'skill_kubernetes', name: 'Kubernetes' },
    { id: 'skill_python', name: 'Python' },
    { id: 'skill_nodejs', name: 'Node.js' },
  ];

  describe('normalizeExtractedSkill', () => {
    describe('exact match', () => {
      it('matches exact skill name (confidence 1.0, method "exact")', async () => {
        const mockSession = createMockSession();

        const result = await normalizeExtractedSkill(
          mockSession,
          'React',
          mockCanonicalSkills
        );

        expect(result.canonicalSkillId).toBe('skill_react');
        expect(result.canonicalSkillName).toBe('React');
        expect(result.method).toBe('exact');
        expect(result.confidence).toBe(1.0);
        expect(result.originalName).toBe('React');
      });

      it('matches exact skill ID', async () => {
        const mockSession = createMockSession();

        const result = await normalizeExtractedSkill(
          mockSession,
          'skill_react',
          mockCanonicalSkills
        );

        expect(result.canonicalSkillId).toBe('skill_react');
        expect(result.method).toBe('exact');
        expect(result.confidence).toBe(1.0);
      });

      it('handles case insensitivity: "REACT", "react", "React" all resolve to same skill', async () => {
        const mockSession = createMockSession();

        const upperResult = await normalizeExtractedSkill(
          mockSession,
          'REACT',
          mockCanonicalSkills
        );
        const lowerResult = await normalizeExtractedSkill(
          mockSession,
          'react',
          mockCanonicalSkills
        );
        const mixedResult = await normalizeExtractedSkill(
          mockSession,
          'ReAcT',
          mockCanonicalSkills
        );

        expect(upperResult.canonicalSkillId).toBe('skill_react');
        expect(lowerResult.canonicalSkillId).toBe('skill_react');
        expect(mixedResult.canonicalSkillId).toBe('skill_react');

        expect(upperResult.method).toBe('exact');
        expect(lowerResult.method).toBe('exact');
        expect(mixedResult.method).toBe('exact');
      });
    });

    describe('synonym match', () => {
      it('matches synonym from Neo4j (confidence 0.95, method "synonym")', async () => {
        const mockSession = createMockSession([
          {
            pattern: 'SkillSynonym',
            result: [{ skillId: 'skill_react', skillName: 'React' }],
          },
        ]);

        const result = await normalizeExtractedSkill(
          mockSession,
          'reactjs',
          mockCanonicalSkills
        );

        expect(result.canonicalSkillId).toBe('skill_react');
        expect(result.canonicalSkillName).toBe('React');
        expect(result.method).toBe('synonym');
        expect(result.confidence).toBe(0.95);
        expect(result.originalName).toBe('reactjs');
      });

      it('queries Neo4j with lowercase name', async () => {
        const mockSession = createMockSession();
        const runSpy = vi.spyOn(mockSession, 'run');

        await normalizeExtractedSkill(
          mockSession,
          'ReactJS',
          [] // Empty canonical skills to force synonym lookup
        );

        expect(runSpy).toHaveBeenCalledWith(
          expect.stringContaining('SkillSynonym'),
          expect.objectContaining({ name: 'reactjs' })
        );
      });
    });

    describe('fuzzy match', () => {
      it('matches similar string via Levenshtein (confidence ≥0.8, method "fuzzy")', async () => {
        const mockSession = createMockSession();

        // "Kubernates" is a common typo for "Kubernetes" (1 character difference)
        const result = await normalizeExtractedSkill(
          mockSession,
          'Kubernates',
          mockCanonicalSkills
        );

        expect(result.canonicalSkillId).toBe('skill_kubernetes');
        expect(result.canonicalSkillName).toBe('Kubernetes');
        expect(result.method).toBe('fuzzy');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });

      it('does not match if similarity below threshold', async () => {
        const mockSession = createMockSession();

        // "xyz" is very different from all canonical skills
        const result = await normalizeExtractedSkill(
          mockSession,
          'xyz',
          mockCanonicalSkills
        );

        // Should not fuzzy match because similarity is too low
        expect(result.method).toBe('unresolved');
      });

      it('selects best fuzzy match among candidates', async () => {
        const mockSession = createMockSession();

        // "Pythn" should match "Python" better than other skills
        const result = await normalizeExtractedSkill(
          mockSession,
          'Pythn',
          mockCanonicalSkills
        );

        expect(result.canonicalSkillId).toBe('skill_python');
        expect(result.method).toBe('fuzzy');
      });
    });

    describe('unresolved', () => {
      it('returns null for unrecognized skill (method "unresolved")', async () => {
        const mockSession = createMockSession();

        const result = await normalizeExtractedSkill(
          mockSession,
          'FooBarBaz123',
          mockCanonicalSkills
        );

        expect(result.canonicalSkillId).toBeNull();
        expect(result.canonicalSkillName).toBeNull();
        expect(result.method).toBe('unresolved');
        expect(result.confidence).toBe(0);
        expect(result.originalName).toBe('FooBarBaz123');
      });

      it('returns unresolved for completely different strings', async () => {
        const mockSession = createMockSession();

        const result = await normalizeExtractedSkill(
          mockSession,
          'AbstractFactoryBeanManager',
          mockCanonicalSkills
        );

        expect(result.method).toBe('unresolved');
      });
    });

    describe('edge cases', () => {
      it('handles whitespace in input', async () => {
        const mockSession = createMockSession();

        const result = await normalizeExtractedSkill(
          mockSession,
          '  React  ',
          mockCanonicalSkills
        );

        expect(result.canonicalSkillId).toBe('skill_react');
        expect(result.method).toBe('exact');
      });
    });
  });

  describe('normalizeExtractedSkills', () => {
    it('separates resolved and unresolved skills', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'Skill',
          result: mockCanonicalSkills.map((s) => ({ id: s.id, name: s.name })),
        },
      ]);

      // Mock loadCanonicalSkills to return our test skills
      const runSpy = vi.spyOn(mockSession, 'run');
      runSpy.mockImplementation((query: string) => {
        if (query.includes('MATCH (s:Skill)')) {
          return Promise.resolve(
            createMockQueryResult(
              mockCanonicalSkills.map((s) => ({ id: s.id, name: s.name }))
            )
          );
        }
        return Promise.resolve(createMockQueryResult([]));
      });

      const result = await normalizeExtractedSkills(mockSession, [
        'React',
        'TypeScript',
        'FooBarBaz123',
      ]);

      expect(result.resolvedSkills).toHaveLength(2);
      expect(result.unresolvedSkills).toHaveLength(1);

      expect(result.resolvedSkills[0].canonicalSkillId).toBe('skill_react');
      expect(result.resolvedSkills[1].canonicalSkillId).toBe('skill_typescript');
      expect(result.unresolvedSkills[0].originalName).toBe('FooBarBaz123');
    });

    it('handles empty input array', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'Skill',
          result: mockCanonicalSkills.map((s) => ({ id: s.id, name: s.name })),
        },
      ]);

      const runSpy = vi.spyOn(mockSession, 'run');
      runSpy.mockResolvedValue(
        createMockQueryResult(
          mockCanonicalSkills.map((s) => ({ id: s.id, name: s.name }))
        )
      );

      const result = await normalizeExtractedSkills(mockSession, []);

      expect(result.resolvedSkills).toHaveLength(0);
      expect(result.unresolvedSkills).toHaveLength(0);
    });

    it('deduplicates skill lookups by loading canonical skills once', async () => {
      const mockSession = createMockSession();
      const runSpy = vi.spyOn(mockSession, 'run');

      runSpy.mockImplementation((query: string) => {
        if (query.includes('MATCH (s:Skill)')) {
          return Promise.resolve(
            createMockQueryResult(
              mockCanonicalSkills.map((s) => ({ id: s.id, name: s.name }))
            )
          );
        }
        return Promise.resolve(createMockQueryResult([]));
      });

      await normalizeExtractedSkills(mockSession, [
        'React',
        'TypeScript',
        'React', // Duplicate
      ]);

      // Should only query for canonical skills once
      const canonicalSkillQueries = runSpy.mock.calls.filter((call) =>
        (call[0] as string).includes('MATCH (s:Skill)')
      );
      expect(canonicalSkillQueries).toHaveLength(1);
    });
  });
});
