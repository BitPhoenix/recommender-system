import { describe, it, expect } from 'vitest';
import { calculateSimilarityWithBreakdown, scoreAndSortCandidates } from './similarity-calculator.js';
import type { SkillGraph, DomainGraph, EngineerForSimilarity } from './types.js';

// Create minimal test graphs
function createEmptyGraphs(): { skillGraph: SkillGraph; domainGraph: DomainGraph } {
  return {
    skillGraph: { nodes: new Map() },
    domainGraph: {
      businessDomains: new Map(),
      technicalDomains: new Map(),
    },
  };
}

function createTestGraphs(): { skillGraph: SkillGraph; domainGraph: DomainGraph } {
  return {
    skillGraph: {
      nodes: new Map([
        ['skill_react', {
          skillId: 'skill_react',
          categoryId: 'cat_frontend',
          parentId: null,
          correlations: [],
        }],
        ['skill_vue', {
          skillId: 'skill_vue',
          categoryId: 'cat_frontend',
          parentId: null,
          correlations: [],
        }],
        ['skill_nodejs', {
          skillId: 'skill_nodejs',
          categoryId: 'cat_backend',
          parentId: null,
          correlations: [],
        }],
      ]),
    },
    domainGraph: {
      businessDomains: new Map([
        ['domain_fintech', { domainId: 'domain_fintech', parentId: null, encompassedBy: [] }],
      ]),
      technicalDomains: new Map([
        ['domain_backend', { domainId: 'domain_backend', parentId: null, encompassedBy: [] }],
      ]),
    },
  };
}

function createEngineer(overrides: Partial<EngineerForSimilarity> = {}): EngineerForSimilarity {
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

describe('calculateSimilarityWithBreakdown', () => {
  describe('self-similarity', () => {
    it('returns near 1.0 for engineer compared to themselves', () => {
      const { skillGraph, domainGraph } = createEmptyGraphs();
      const engineer = createEngineer();

      const result = calculateSimilarityWithBreakdown(skillGraph, domainGraph, engineer, engineer);

      // All components should be 1.0
      expect(result.breakdown.skills).toBe(1.0);
      expect(result.breakdown.yearsExperience).toBe(1.0);
      expect(result.breakdown.domain).toBe(1.0);
      expect(result.breakdown.timezone).toBe(1.0);
      expect(result.similarityScore).toBe(1.0);
    });
  });

  describe('breakdown scores', () => {
    it('includes raw (unweighted) scores in breakdown', () => {
      const { skillGraph, domainGraph } = createEmptyGraphs();
      const target = createEngineer({ yearsExperience: 10 });
      const candidate = createEngineer({ yearsExperience: 5 });

      const result = calculateSimilarityWithBreakdown(skillGraph, domainGraph, target, candidate);

      // Years: 5 year difference, max 20 → score = 0.75
      expect(result.breakdown.yearsExperience).toBe(0.75);
    });
  });

  describe('weighted total score', () => {
    it('applies weights correctly to compute total', () => {
      const { skillGraph, domainGraph } = createEmptyGraphs();

      // Target and candidate differ only in years (same timezone, no skills/domains)
      const target = createEngineer({ yearsExperience: 10 });
      const candidate = createEngineer({ yearsExperience: 5 });

      const result = calculateSimilarityWithBreakdown(skillGraph, domainGraph, target, candidate);

      // Skills: 1.0 (both empty), weight 0.45 → 0.45
      // Years: 0.75, weight 0.27 → 0.2025
      // Domain: 1.0 (both empty), weight 0.22 → 0.22
      // Timezone: 1.0 (same), weight 0.06 → 0.06
      // Total: 0.45 + 0.2025 + 0.22 + 0.06 = 0.9325 → rounded to 0.93
      expect(result.similarityScore).toBeCloseTo(0.93, 2);
    });
  });

  describe('shared skills', () => {
    it('includes shared skill names in result', () => {
      const { skillGraph, domainGraph } = createTestGraphs();

      const target = createEngineer({
        skills: [
          { skillId: 'skill_react', skillName: 'React', proficiencyLevel: 'expert', confidenceScore: 0.9 },
        ],
      });
      const candidate = createEngineer({
        skills: [
          { skillId: 'skill_react', skillName: 'React', proficiencyLevel: 'proficient', confidenceScore: 0.85 },
        ],
      });

      const result = calculateSimilarityWithBreakdown(skillGraph, domainGraph, target, candidate);

      expect(result.sharedSkills).toContain('React');
    });
  });
});

describe('scoreAndSortCandidates', () => {
  it('sorts candidates by similarity score descending', () => {
    const { skillGraph, domainGraph } = createEmptyGraphs();

    const target = createEngineer({ yearsExperience: 10 });
    const candidates = [
      createEngineer({ id: 'eng_low', yearsExperience: 0 }),    // Low similarity
      createEngineer({ id: 'eng_high', yearsExperience: 10 }), // High similarity (same)
      createEngineer({ id: 'eng_mid', yearsExperience: 5 }),   // Medium similarity
    ];

    const results = scoreAndSortCandidates(skillGraph, domainGraph, target, candidates);

    expect(results[0].engineer.id).toBe('eng_high');
    expect(results[1].engineer.id).toBe('eng_mid');
    expect(results[2].engineer.id).toBe('eng_low');
  });

  it('returns all candidates scored', () => {
    const { skillGraph, domainGraph } = createEmptyGraphs();
    const target = createEngineer();
    const candidates = [
      createEngineer({ id: 'eng_1' }),
      createEngineer({ id: 'eng_2' }),
      createEngineer({ id: 'eng_3' }),
    ];

    const results = scoreAndSortCandidates(skillGraph, domainGraph, target, candidates);

    expect(results).toHaveLength(3);
  });

  it('handles empty candidates list', () => {
    const { skillGraph, domainGraph } = createEmptyGraphs();
    const target = createEngineer();

    const results = scoreAndSortCandidates(skillGraph, domainGraph, target, []);

    expect(results).toEqual([]);
  });
});
