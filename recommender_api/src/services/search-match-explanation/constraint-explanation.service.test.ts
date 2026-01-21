import { describe, it, expect } from 'vitest';
import { generateConstraintExplanations } from './constraint-explanation.service.js';
import {
  AppliedFilterType,
  type EngineerMatch,
  type AppliedFilter,
  type AppliedPropertyFilter,
  type AppliedSkillFilter,
  type MatchedSkill,
} from '../../types/search.types.js';

describe('generateConstraintExplanations', () => {
  const createMockEngineer = (overrides: Partial<EngineerMatch> = {}): EngineerMatch => ({
    id: 'eng_test',
    name: 'Test Engineer',
    headline: 'Software Engineer',
    salary: 150000,
    yearsExperience: 7,
    startTimeline: 'two_weeks',
    timezone: 'Eastern',
    matchedSkills: [],
    unmatchedRelatedSkills: [],
    matchedBusinessDomains: [],
    matchedTechnicalDomains: [],
    utilityScore: 0.8,
    scoreBreakdown: {
      scores: {},
      preferenceMatches: {},
      total: 0.8,
    },
    ...overrides,
  });

  describe('skill constraints', () => {
    it('generates explanation for satisfied skill constraint with direct match', () => {
      const filter: AppliedSkillFilter = {
        type: AppliedFilterType.Skill,
        field: 'requiredSkills',
        operator: 'HAS_ANY',
        skills: [{ skillId: 'skill_typescript', skillName: 'TypeScript' }],
        displayValue: 'TypeScript',
        source: 'user',
      };

      const matchedSkills: MatchedSkill[] = [
        {
          skillId: 'skill_typescript',
          skillName: 'TypeScript',
          proficiencyLevel: 'expert',
          confidenceScore: 0.95,
          yearsUsed: 5,
          matchType: 'direct',
        },
      ];

      const engineer = createMockEngineer({ matchedSkills });
      const explanations = generateConstraintExplanations([filter], engineer);

      expect(explanations).toHaveLength(1);
      expect(explanations[0].satisfied).toBe(true);
      expect(explanations[0].matchType).toBe('direct');
      expect(explanations[0].explanation).toContain('Has required skill');
      expect(explanations[0].matchedValues).toHaveLength(1);
      expect(explanations[0].matchedValues[0]).toContain('TypeScript');
    });

    it('generates explanation for satisfied skill constraint with descendant match', () => {
      const filter: AppliedSkillFilter = {
        type: AppliedFilterType.Skill,
        field: 'requiredSkills',
        operator: 'HAS_ANY',
        skills: [{ skillId: 'skill_backend', skillName: 'Backend' }],
        displayValue: 'Backend',
        source: 'user',
      };

      const matchedSkills: MatchedSkill[] = [
        {
          skillId: 'skill_backend',
          skillName: 'Node.js',
          proficiencyLevel: 'proficient',
          confidenceScore: 0.88,
          yearsUsed: 3,
          matchType: 'descendant',
        },
      ];

      const engineer = createMockEngineer({ matchedSkills });
      const explanations = generateConstraintExplanations([filter], engineer);

      expect(explanations).toHaveLength(1);
      expect(explanations[0].satisfied).toBe(true);
      expect(explanations[0].matchType).toBe('descendant');
      expect(explanations[0].explanation).toContain('Has descendant skill');
    });

    it('generates explanation for unsatisfied skill constraint', () => {
      const filter: AppliedSkillFilter = {
        type: AppliedFilterType.Skill,
        field: 'requiredSkills',
        operator: 'HAS_ANY',
        skills: [{ skillId: 'skill_kubernetes', skillName: 'Kubernetes' }],
        displayValue: 'Kubernetes',
        source: 'user',
      };

      const engineer = createMockEngineer({ matchedSkills: [] });
      const explanations = generateConstraintExplanations([filter], engineer);

      expect(explanations).toHaveLength(1);
      expect(explanations[0].satisfied).toBe(false);
      expect(explanations[0].explanation).toContain('Lacks required skills in Kubernetes');
      expect(explanations[0].explanation).toContain('needs at least one of');
    });
  });

  describe('property constraints', () => {
    it('generates explanation for satisfied years experience constraint', () => {
      const filter: AppliedPropertyFilter = {
        type: AppliedFilterType.Property,
        field: 'yearsExperience',
        operator: '>=',
        value: '5',
        source: 'user',
      };

      const engineer = createMockEngineer({ yearsExperience: 7 });
      const explanations = generateConstraintExplanations([filter], engineer);

      expect(explanations).toHaveLength(1);
      expect(explanations[0].satisfied).toBe(true);
      expect(explanations[0].explanation).toContain('Has 7 years of experience');
      expect(explanations[0].explanation).toContain('≥5');
    });

    it('generates explanation for satisfied timezone constraint', () => {
      const filter: AppliedPropertyFilter = {
        type: AppliedFilterType.Property,
        field: 'timezone',
        operator: 'IN',
        value: '["Eastern","Central"]',
        source: 'user',
      };

      const engineer = createMockEngineer({ timezone: 'Eastern' });
      const explanations = generateConstraintExplanations([filter], engineer);

      expect(explanations).toHaveLength(1);
      expect(explanations[0].satisfied).toBe(true);
      expect(explanations[0].explanation).toContain('In Eastern timezone');
    });

    it('generates explanation for unsatisfied budget constraint', () => {
      const filter: AppliedPropertyFilter = {
        type: AppliedFilterType.Property,
        field: 'salary',
        operator: '<=',
        value: '100000',
        source: 'user',
      };

      const engineer = createMockEngineer({ salary: 150000 });
      const explanations = generateConstraintExplanations([filter], engineer);

      expect(explanations).toHaveLength(1);
      expect(explanations[0].satisfied).toBe(false);
      expect(explanations[0].explanation).toContain('exceeds budget');
    });
  });

  describe('multiple constraints', () => {
    it('generates explanations for multiple constraints', () => {
      const filters: AppliedFilter[] = [
        {
          type: AppliedFilterType.Skill,
          field: 'requiredSkills',
          operator: 'HAS_ANY',
          skills: [{ skillId: 'skill_typescript', skillName: 'TypeScript' }],
          displayValue: 'TypeScript',
          source: 'user',
        },
        {
          type: AppliedFilterType.Property,
          field: 'yearsExperience',
          operator: '>=',
          value: '5',
          source: 'user',
        },
      ];

      const matchedSkills: MatchedSkill[] = [
        {
          skillId: 'skill_typescript',
          skillName: 'TypeScript',
          proficiencyLevel: 'expert',
          confidenceScore: 0.95,
          yearsUsed: 5,
          matchType: 'direct',
        },
      ];

      const engineer = createMockEngineer({
        matchedSkills,
        yearsExperience: 7,
      });

      const explanations = generateConstraintExplanations(filters, engineer);

      expect(explanations).toHaveLength(2);
      expect(explanations.every((e) => e.satisfied)).toBe(true);
    });
  });
});
