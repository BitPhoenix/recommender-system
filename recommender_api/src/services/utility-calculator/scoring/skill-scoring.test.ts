import { describe, it, expect } from 'vitest';
import {
  calculateRequiredSkillsProficiencyMatch,
  calculatePreferredSkillsMatch,
  calculateTeamFocusMatch,
  calculateRelatedSkillsMatch,
} from './skill-scoring.js';
import type { MatchedSkill, UnmatchedRelatedSkill, ProficiencyLevel } from '../../../types/search.types.js';

describe('calculateRequiredSkillsProficiencyMatch', () => {
  const createMatchedSkill = (
    skillId: string,
    proficiencyLevel: 'learning' | 'proficient' | 'expert'
  ): MatchedSkill => ({
    skillId,
    skillName: skillId,
    proficiencyLevel,
    confidenceScore: 0.9,
    yearsUsed: 3,
    matchType: 'direct',
  });

  it('returns 1.0 when engineer meets all preferred proficiency levels', () => {
    const skills = [createMatchedSkill('s1', 'expert')];
    const requiredSkillIds = ['s1'];
    const skillIdToPreferredProficiency = new Map([['s1', 'expert' as const]]);

    const result = calculateRequiredSkillsProficiencyMatch(
      skills,
      requiredSkillIds,
      skillIdToPreferredProficiency
    );
    expect(result.score).toBe(1.0);
  });

  it('returns graduated score when engineer is below preferred level', () => {
    const skills = [createMatchedSkill('s1', 'proficient')];
    const requiredSkillIds = ['s1'];
    const skillIdToPreferredProficiency = new Map([['s1', 'expert' as const]]);

    const result = calculateRequiredSkillsProficiencyMatch(
      skills,
      requiredSkillIds,
      skillIdToPreferredProficiency
    );
    // proficient (index 1, +1=2) vs expert (index 2, +1=3): 2/3 = 0.666...
    expect(result.score).toBeCloseTo(2 / 3);
  });

  it('returns 1.0 when no proficiency preferences specified', () => {
    const skills = [createMatchedSkill('s1', 'learning')];
    const requiredSkillIds = ['s1'];
    const skillIdToPreferredProficiency = new Map<string, ProficiencyLevel>();

    const result = calculateRequiredSkillsProficiencyMatch(
      skills,
      requiredSkillIds,
      skillIdToPreferredProficiency
    );
    expect(result.score).toBe(1.0);
  });

  it('averages scores across multiple skills', () => {
    const skills = [
      createMatchedSkill('s1', 'expert'),
      createMatchedSkill('s2', 'learning'),
    ];
    const requiredSkillIds = ['s1', 's2'];
    const skillIdToPreferredProficiency = new Map([
      ['s1', 'expert' as const],
      ['s2', 'expert' as const],
    ]);

    const result = calculateRequiredSkillsProficiencyMatch(
      skills,
      requiredSkillIds,
      skillIdToPreferredProficiency
    );
    // s1: 3/3 = 1.0, s2: 1/3 = 0.333..., avg = (1 + 0.333) / 2 = 0.666...
    expect(result.score).toBeCloseTo((1 + 1 / 3) / 2);
  });

  it('returns 0.5 when no required skills specified', () => {
    const skills = [createMatchedSkill('s1', 'expert')];
    const result = calculateRequiredSkillsProficiencyMatch(skills, [], new Map());
    expect(result.score).toBe(0.5);
  });

  it('tracks skills exceeding preferred proficiency', () => {
    const skills = [createMatchedSkill('s1', 'expert')];
    const requiredSkillIds = ['s1'];
    const skillIdToPreferredProficiency = new Map([['s1', 'proficient' as const]]);

    const result = calculateRequiredSkillsProficiencyMatch(
      skills,
      requiredSkillIds,
      skillIdToPreferredProficiency
    );
    expect(result.skillsExceedingPreferred).toContain('s1');
  });
});

describe('calculatePreferredSkillsMatch', () => {
  const createMatchedSkill = (skillId: string): MatchedSkill => ({
    skillId,
    skillName: skillId,
    proficiencyLevel: 'proficient',
    confidenceScore: 0.9,
    yearsUsed: 3,
    matchType: 'direct',
  });

  it('returns maxMatch when all preferred skills matched', () => {
    const skills = [createMatchedSkill('s1'), createMatchedSkill('s2')];
    const preferredSkillIds = ['s1', 's2'];

    const result = calculatePreferredSkillsMatch(skills, preferredSkillIds, 0.08);
    expect(result.raw).toBe(0.08);
    expect(result.matchedSkillNames).toEqual(['s1', 's2']);
  });

  it('returns proportional score for partial match', () => {
    const skills = [createMatchedSkill('s1')];
    const preferredSkillIds = ['s1', 's2'];

    const result = calculatePreferredSkillsMatch(skills, preferredSkillIds, 0.08);
    expect(result.raw).toBe(0.04); // 1/2 * 0.08
  });

  it('returns 0 when no preferred skills specified', () => {
    const skills = [createMatchedSkill('s1')];
    const result = calculatePreferredSkillsMatch(skills, [], 0.08);
    expect(result.raw).toBe(0);
  });
});

describe('calculateTeamFocusMatch', () => {
  const createMatchedSkill = (skillId: string): MatchedSkill => ({
    skillId,
    skillName: skillId,
    proficiencyLevel: 'proficient',
    confidenceScore: 0.9,
    yearsUsed: 3,
    matchType: 'direct',
  });

  it('returns maxMatch when all aligned skills matched', () => {
    const skills = [createMatchedSkill('s1'), createMatchedSkill('s2')];
    const alignedSkillIds = ['s1', 's2'];

    const result = calculateTeamFocusMatch(skills, alignedSkillIds, 0.04);
    expect(result.raw).toBe(0.04);
  });

  it('returns 0 when no team focus specified', () => {
    const skills = [createMatchedSkill('s1')];
    const result = calculateTeamFocusMatch(skills, [], 0.04);
    expect(result.raw).toBe(0);
  });
});

describe('calculateRelatedSkillsMatch', () => {
  const createUnmatchedSkill = (skillId: string): UnmatchedRelatedSkill => ({
    skillId,
    skillName: skillId,
    proficiencyLevel: 'proficient',
    confidenceScore: 0.9,
    yearsUsed: 3,
    matchType: 'direct',
    constraintViolations: ['proficiency_below_minimum'],
  });

  it('returns 0 for no related skills', () => {
    const result = calculateRelatedSkillsMatch([], 0.04);
    expect(result.raw).toBe(0);
    expect(result.count).toBe(0);
  });

  it('shows exponential growth with diminishing returns', () => {
    // Use a larger maxMatch to see the curve more clearly
    const maxMatch = 1.0;
    const skills1 = [createUnmatchedSkill('s1')];
    const skills3 = Array.from({ length: 3 }, (_, i) => createUnmatchedSkill(`s${i}`));
    const skills6 = Array.from({ length: 6 }, (_, i) => createUnmatchedSkill(`s${i}`));

    const result1 = calculateRelatedSkillsMatch(skills1, maxMatch);
    const result3 = calculateRelatedSkillsMatch(skills3, maxMatch);
    const result6 = calculateRelatedSkillsMatch(skills6, maxMatch);

    // Scores should increase but with diminishing returns
    expect(result3.raw).toBeGreaterThan(result1.raw);
    expect(result6.raw).toBeGreaterThan(result3.raw);

    // Gain from 1->3 should be larger than 3->6
    const gain1to3 = result3.raw - result1.raw;
    const gain3to6 = result6.raw - result3.raw;
    expect(gain1to3).toBeGreaterThan(gain3to6);
  });

  it('caps at maxMatch', () => {
    const manySkills = Array.from({ length: 100 }, (_, i) => createUnmatchedSkill(`s${i}`));
    const result = calculateRelatedSkillsMatch(manySkills, 0.04);
    expect(result.raw).toBeLessThanOrEqual(0.04);
  });
});
