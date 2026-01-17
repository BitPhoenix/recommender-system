import { describe, it, expect } from 'vitest';
import { selectDiverseResults } from './diversity-selector.js';
import type {
  SimilarityResult,
  EngineerForSimilarity,
  SkillGraph,
  DomainGraph,
  SkillGraphNode,
} from './types.js';

/*
 * Creates a mock skill graph with skills in the same category being related.
 * Skills with the same prefix (e.g., 'frontend_react', 'frontend_vue') share
 * a category and will be considered similar (0.5).
 */
function createMockSkillGraph(skillIds: string[]): SkillGraph {
  const nodes = new Map<string, SkillGraphNode>();

  for (const skillId of skillIds) {
    // Extract category from skill ID (e.g., 'frontend' from 'frontend_react')
    const parts = skillId.split('_');
    const categoryId = parts.length > 1 ? parts[0] : null;

    nodes.set(skillId, {
      skillId,
      categoryId,
      parentId: null,
      correlations: [],
    });
  }

  return { nodes };
}

function createEmptyDomainGraph(): DomainGraph {
  return {
    businessDomains: new Map(),
    technicalDomains: new Map(),
  };
}

function createMockEngineer(id: string, skillIds: string[] = []): EngineerForSimilarity {
  return {
    id,
    name: `Engineer ${id}`,
    headline: 'Software Engineer',
    yearsExperience: 5,
    timezone: 'Eastern',
    skills: skillIds.map(skillId => ({
      skillId,
      skillName: skillId,
      proficiencyLevel: 'proficient',
      confidenceScore: 0.9,
    })),
    businessDomains: [],
    technicalDomains: [],
  };
}

function createMockResult(
  id: string,
  score: number,
  skillIds: string[] = []
): SimilarityResult {
  return {
    engineer: createMockEngineer(id, skillIds),
    similarityScore: score,
    breakdown: { skills: score, yearsExperience: score, domain: score, timezone: score },
    sharedSkills: [],
    correlatedSkills: [],
  };
}

describe('selectDiverseResults', () => {
  // Create graphs that cover all skills used in tests
  const allSkills = [
    'frontend_react', 'frontend_nodejs', 'frontend_typescript',
    'frontend_vue', 'backend_python', 'backend_django',
    'backend_angular', 'backend_java', 'backend_spring',
    'skill_a', 'skill_b', 'skill_c',
  ];
  const mockSkillGraph = createMockSkillGraph(allSkills);
  const mockDomainGraph = createEmptyDomainGraph();

  describe('first selection', () => {
    it('picks the highest similarity candidate first', () => {
      const candidates = [
        createMockResult('eng_low', 0.5),
        createMockResult('eng_high', 0.95),
        createMockResult('eng_mid', 0.7),
      ];

      const results = selectDiverseResults(
        mockSkillGraph, mockDomainGraph, candidates, 1
      );

      expect(results).toHaveLength(1);
      expect(results[0].engineer.id).toBe('eng_high');
    });
  });

  describe('diversity selection', () => {
    it('balances similarity with diversity for subsequent picks', () => {
      /*
       * Create candidates where some are very similar to each other.
       * Skills with same prefix (frontend_*) share a category and are
       * considered similar (0.5) by the graph-aware scorer.
       */
      const candidates = [
        createMockResult('eng_a', 0.95, ['frontend_react', 'frontend_nodejs', 'frontend_typescript']),
        createMockResult('eng_b', 0.94, ['frontend_react', 'frontend_nodejs', 'frontend_typescript']), // Identical to eng_a
        createMockResult('eng_c', 0.85, ['frontend_vue', 'backend_python', 'backend_django']),         // Mix of categories
        createMockResult('eng_d', 0.80, ['backend_angular', 'backend_java', 'backend_spring']),        // Different category
      ];

      const results = selectDiverseResults(
        mockSkillGraph, mockDomainGraph, candidates, 3
      );

      // First should be eng_a (highest score)
      expect(results[0].engineer.id).toBe('eng_a');

      // Second should NOT be eng_b (identical skills to eng_a despite high score)
      // Should prefer eng_c or eng_d (different skills, decent score)
      expect(results[1].engineer.id).not.toBe('eng_b');
    });

    it('penalizes candidates with same-category skills as already selected', () => {
      /*
       * All frontend_* skills share a category, so engineers with only
       * frontend skills should be penalized when a frontend engineer
       * is already selected.
       */
      const candidates = [
        createMockResult('eng_frontend_1', 0.95, ['frontend_react', 'frontend_typescript']),
        createMockResult('eng_frontend_2', 0.90, ['frontend_vue', 'frontend_nodejs']),      // Same category
        createMockResult('eng_backend', 0.85, ['backend_python', 'backend_java']),          // Different category
      ];

      const results = selectDiverseResults(
        mockSkillGraph, mockDomainGraph, candidates, 2
      );

      expect(results[0].engineer.id).toBe('eng_frontend_1');
      // eng_backend should be chosen over eng_frontend_2 despite lower score
      // because it provides more diversity (different skill category)
      expect(results[1].engineer.id).toBe('eng_backend');
    });
  });

  describe('respects limit', () => {
    it('returns exactly targetCount results when pool is sufficient', () => {
      const candidates = [
        createMockResult('eng_1', 0.9),
        createMockResult('eng_2', 0.8),
        createMockResult('eng_3', 0.7),
        createMockResult('eng_4', 0.6),
        createMockResult('eng_5', 0.5),
      ];

      const results = selectDiverseResults(
        mockSkillGraph, mockDomainGraph, candidates, 3
      );

      expect(results).toHaveLength(3);
    });

    it('returns fewer results if pool is smaller than targetCount', () => {
      const candidates = [
        createMockResult('eng_1', 0.9),
        createMockResult('eng_2', 0.8),
      ];

      const results = selectDiverseResults(
        mockSkillGraph, mockDomainGraph, candidates, 5
      );

      expect(results).toHaveLength(2);
    });
  });

  describe('bounded pool (diversityMultiplier=3)', () => {
    it('only considers top poolSize candidates', () => {
      // With limit=2 and multiplier=3, pool=6
      // Candidates beyond position 6 should not be considered
      const candidates = [
        createMockResult('eng_1', 0.95),
        createMockResult('eng_2', 0.90),
        createMockResult('eng_3', 0.85),
        createMockResult('eng_4', 0.80),
        createMockResult('eng_5', 0.75),
        createMockResult('eng_6', 0.70),
        createMockResult('eng_7', 0.65), // Beyond pool
        createMockResult('eng_8', 0.60), // Beyond pool
      ];

      const results = selectDiverseResults(
        mockSkillGraph, mockDomainGraph, candidates, 2
      );

      // eng_7 and eng_8 should never be selected
      const resultIds = results.map(r => r.engineer.id);
      expect(resultIds).not.toContain('eng_7');
      expect(resultIds).not.toContain('eng_8');
    });
  });

  describe('edge cases', () => {
    it('handles empty candidates', () => {
      const results = selectDiverseResults(
        mockSkillGraph, mockDomainGraph, [], 5
      );
      expect(results).toEqual([]);
    });

    it('handles targetCount of 0', () => {
      const candidates = [createMockResult('eng_1', 0.9)];
      const results = selectDiverseResults(
        mockSkillGraph, mockDomainGraph, candidates, 0
      );
      expect(results).toEqual([]);
    });

    it('handles single candidate', () => {
      const candidates = [createMockResult('eng_1', 0.9)];
      const results = selectDiverseResults(
        mockSkillGraph, mockDomainGraph, candidates, 3
      );
      expect(results).toHaveLength(1);
      expect(results[0].engineer.id).toBe('eng_1');
    });

    it('handles candidates with no skills (empty skill graph lookup)', () => {
      const candidates = [
        createMockResult('eng_no_skills_1', 0.9, []),
        createMockResult('eng_no_skills_2', 0.8, []),
      ];

      const results = selectDiverseResults(
        mockSkillGraph, mockDomainGraph, candidates, 2
      );

      // Should still work - engineers with no skills are maximally diverse from each other
      expect(results).toHaveLength(2);
    });
  });
});
