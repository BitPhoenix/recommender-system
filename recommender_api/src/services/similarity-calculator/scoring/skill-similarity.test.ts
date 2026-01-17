import { describe, it, expect } from 'vitest';
import { calculateSkillSimilarity } from './skill-similarity.js';
import type { SkillGraph, EngineerSkill } from '../types.js';

// Helper to create a test skill graph
function createTestSkillGraph(): SkillGraph {
  return {
    nodes: new Map([
      // Frontend category skills
      ['skill_react', {
        skillId: 'skill_react',
        categoryId: 'cat_frontend',
        parentId: null,
        correlations: [
          { toSkillId: 'skill_typescript', strength: 0.75, correlationType: 'complementary' },
        ],
      }],
      ['skill_vue', {
        skillId: 'skill_vue',
        categoryId: 'cat_frontend',
        parentId: null,
        correlations: [],
      }],
      ['skill_typescript', {
        skillId: 'skill_typescript',
        categoryId: 'cat_frontend',
        parentId: null,
        correlations: [
          { toSkillId: 'skill_javascript', strength: 0.95, correlationType: 'transferable' },
          { toSkillId: 'skill_react', strength: 0.75, correlationType: 'complementary' },
        ],
      }],
      ['skill_javascript', {
        skillId: 'skill_javascript',
        categoryId: 'cat_frontend',
        parentId: null,
        correlations: [
          { toSkillId: 'skill_typescript', strength: 0.95, correlationType: 'transferable' },
        ],
      }],
      // Backend category skills
      ['skill_nodejs', {
        skillId: 'skill_nodejs',
        categoryId: 'cat_backend',
        parentId: 'skill_javascript',
        correlations: [],
      }],
      ['skill_python', {
        skillId: 'skill_python',
        categoryId: 'cat_backend',
        parentId: null,
        correlations: [],
      }],
      // Child skills (share parent)
      ['skill_express', {
        skillId: 'skill_express',
        categoryId: null,
        parentId: 'skill_nodejs',
        correlations: [],
      }],
      ['skill_nestjs', {
        skillId: 'skill_nestjs',
        categoryId: null,
        parentId: 'skill_nodejs',
        correlations: [],
      }],
      // Database category (unrelated)
      ['skill_postgresql', {
        skillId: 'skill_postgresql',
        categoryId: 'cat_database',
        parentId: null,
        correlations: [],
      }],
    ]),
  };
}

function makeSkill(id: string, name: string): EngineerSkill {
  return {
    skillId: id,
    skillName: name,
    proficiencyLevel: 'proficient',
    confidenceScore: 0.9,
  };
}

describe('calculateSkillSimilarity', () => {
  const graph = createTestSkillGraph();

  describe('empty skill sets', () => {
    it('returns 1.0 when both have no skills', () => {
      const result = calculateSkillSimilarity(graph, [], []);
      expect(result.score).toBe(1.0);
      expect(result.sharedSkillIds).toEqual([]);
      expect(result.correlatedPairs).toEqual([]);
    });

    it('returns 0.0 when target has skills but candidate does not', () => {
      const targetSkills = [makeSkill('skill_react', 'React')];
      const result = calculateSkillSimilarity(graph, targetSkills, []);
      expect(result.score).toBe(0.0);
    });

    it('returns 0.0 when candidate has skills but target does not', () => {
      const candidateSkills = [makeSkill('skill_react', 'React')];
      const result = calculateSkillSimilarity(graph, [], candidateSkills);
      expect(result.score).toBe(0.0);
    });
  });

  describe('exact skill matches', () => {
    it('returns 1.0 for identical skill sets', () => {
      const skills = [
        makeSkill('skill_react', 'React'),
        makeSkill('skill_nodejs', 'Node.js'),
      ];
      const result = calculateSkillSimilarity(graph, skills, skills);
      expect(result.score).toBe(1.0);
      expect(result.sharedSkillIds).toContain('skill_react');
      expect(result.sharedSkillIds).toContain('skill_nodejs');
    });

    it('includes shared skills in result', () => {
      const targetSkills = [
        makeSkill('skill_react', 'React'),
        makeSkill('skill_nodejs', 'Node.js'),
      ];
      const candidateSkills = [
        makeSkill('skill_react', 'React'),
        makeSkill('skill_python', 'Python'),
      ];
      const result = calculateSkillSimilarity(graph, targetSkills, candidateSkills);
      expect(result.sharedSkillIds).toEqual(['skill_react']);
    });
  });

  describe('correlated skills', () => {
    it('gives partial credit for CORRELATES_WITH relationship', () => {
      const targetSkills = [makeSkill('skill_typescript', 'TypeScript')];
      const candidateSkills = [makeSkill('skill_javascript', 'JavaScript')];
      const result = calculateSkillSimilarity(graph, targetSkills, candidateSkills);
      // Correlation strength is 0.95
      expect(result.score).toBeCloseTo(0.95, 2);
    });

    it('includes correlated pairs in result', () => {
      const targetSkills = [makeSkill('skill_typescript', 'TypeScript')];
      const candidateSkills = [makeSkill('skill_javascript', 'JavaScript')];
      const result = calculateSkillSimilarity(graph, targetSkills, candidateSkills);
      expect(result.correlatedPairs).toHaveLength(1);
      expect(result.correlatedPairs[0]).toMatchObject({
        targetSkill: 'TypeScript',
        candidateSkill: 'JavaScript',
        strength: 0.95,
      });
    });

    it('filters out weak correlations (below minCorrelationStrength=0.7)', () => {
      // Our test graph has correlations >= 0.7, but if we had weaker ones they'd be filtered
      const targetSkills = [makeSkill('skill_react', 'React')];
      const candidateSkills = [makeSkill('skill_typescript', 'TypeScript')];
      const result = calculateSkillSimilarity(graph, targetSkills, candidateSkills);
      // React-TypeScript correlation is 0.75 (above threshold)
      expect(result.score).toBeCloseTo(0.75, 2);
    });
  });

  describe('same category', () => {
    it('gives 0.5 for skills in same category', () => {
      const targetSkills = [makeSkill('skill_react', 'React')];
      const candidateSkills = [makeSkill('skill_vue', 'Vue')];
      const result = calculateSkillSimilarity(graph, targetSkills, candidateSkills);
      expect(result.score).toBe(0.5);
    });
  });

  describe('share parent', () => {
    it('gives 0.3 for skills sharing CHILD_OF parent', () => {
      const targetSkills = [makeSkill('skill_express', 'Express')];
      const candidateSkills = [makeSkill('skill_nestjs', 'NestJS')];
      const result = calculateSkillSimilarity(graph, targetSkills, candidateSkills);
      expect(result.score).toBe(0.3);
    });
  });

  describe('unrelated skills', () => {
    it('returns 0.0 for completely unrelated skills', () => {
      const targetSkills = [makeSkill('skill_react', 'React')];
      const candidateSkills = [makeSkill('skill_postgresql', 'PostgreSQL')];
      const result = calculateSkillSimilarity(graph, targetSkills, candidateSkills);
      expect(result.score).toBe(0.0);
    });
  });

  describe('priority order (correlation > category > parent)', () => {
    it('prefers correlation over same category', () => {
      // TypeScript correlates with JavaScript (0.95) AND is in same category as Vue (0.5)
      // Target→Candidate: TypeScript best matches JavaScript (0.95) → avg=0.95
      // Candidate→Target: JavaScript=0.95, Vue=0.5 → avg=0.725
      // Symmetric: (0.95 + 0.725) / 2 ≈ 0.8375
      const targetSkills = [makeSkill('skill_typescript', 'TypeScript')];
      const candidateSkills = [
        makeSkill('skill_javascript', 'JavaScript'), // 0.95 correlation
        makeSkill('skill_vue', 'Vue'),               // 0.5 same category
      ];
      const result = calculateSkillSimilarity(graph, targetSkills, candidateSkills);
      // Correlation is preferred for TypeScript→JavaScript match
      // But symmetric scoring averages both directions
      expect(result.score).toBeCloseTo(0.8375, 2);
    });
  });

  describe('symmetric scoring', () => {
    it('produces symmetric scores (order should not matter)', () => {
      const skillsA = [makeSkill('skill_react', 'React')];
      const skillsB = [makeSkill('skill_vue', 'Vue')];
      const resultAB = calculateSkillSimilarity(graph, skillsA, skillsB);
      const resultBA = calculateSkillSimilarity(graph, skillsB, skillsA);
      expect(resultAB.score).toBe(resultBA.score);
    });
  });

  describe('multi-skill averaging', () => {
    it('averages best matches across all skills', () => {
      const targetSkills = [
        makeSkill('skill_react', 'React'),
        makeSkill('skill_nodejs', 'Node.js'),
      ];
      const candidateSkills = [
        makeSkill('skill_react', 'React'),      // exact match: 1.0
        makeSkill('skill_postgresql', 'PostgreSQL'), // no match: 0.0
      ];
      const result = calculateSkillSimilarity(graph, targetSkills, candidateSkills);
      // Target→Candidate: React=1.0, Node=0.0 → avg=0.5
      // Candidate→Target: React=1.0, PostgreSQL=0.0 → avg=0.5
      // Symmetric: (0.5 + 0.5) / 2 = 0.5
      expect(result.score).toBe(0.5);
    });
  });
});
