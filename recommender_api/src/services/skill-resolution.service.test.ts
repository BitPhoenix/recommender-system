import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { groupSkillsByProficiency, resolveAllSkills } from './skill-resolution.service.js';
import { createMockSession } from '../__mocks__/neo4j-session.mock.js';
import type { ResolvedSkillWithProficiency } from './skill-resolver.service.js';

// Mock the underlying skill-resolver.service
vi.mock('./skill-resolver.service.js', () => ({
  resolveSkillRequirements: vi.fn().mockResolvedValue({
    resolvedSkills: [],
    expandedSkillNames: [],
    originalIdentifiers: [],
    unresolvedIdentifiers: [],
  }),
}));

import { resolveSkillRequirements } from './skill-resolver.service.js';

describe('groupSkillsByProficiency', () => {
  it('groups skills by minProficiency level', () => {
    const skills: ResolvedSkillWithProficiency[] = [
      { skillId: 's1', skillName: 'Skill1', minProficiency: 'learning', preferredMinProficiency: null },
      { skillId: 's2', skillName: 'Skill2', minProficiency: 'proficient', preferredMinProficiency: null },
      { skillId: 's3', skillName: 'Skill3', minProficiency: 'expert', preferredMinProficiency: null },
      { skillId: 's4', skillName: 'Skill4', minProficiency: 'learning', preferredMinProficiency: null },
    ];

    const result = groupSkillsByProficiency(skills);

    expect(result.learningLevelSkillIds).toEqual(['s1', 's4']);
    expect(result.proficientLevelSkillIds).toEqual(['s2']);
    expect(result.expertLevelSkillIds).toEqual(['s3']);
  });

  it('returns empty arrays for no skills', () => {
    const result = groupSkillsByProficiency([]);

    expect(result.learningLevelSkillIds).toEqual([]);
    expect(result.proficientLevelSkillIds).toEqual([]);
    expect(result.expertLevelSkillIds).toEqual([]);
  });

  it('handles all skills at same proficiency', () => {
    const skills: ResolvedSkillWithProficiency[] = [
      { skillId: 's1', skillName: 'Skill1', minProficiency: 'proficient', preferredMinProficiency: null },
      { skillId: 's2', skillName: 'Skill2', minProficiency: 'proficient', preferredMinProficiency: null },
    ];

    const result = groupSkillsByProficiency(skills);

    expect(result.learningLevelSkillIds).toEqual([]);
    expect(result.proficientLevelSkillIds).toEqual(['s1', 's2']);
    expect(result.expertLevelSkillIds).toEqual([]);
  });
});

describe('resolveAllSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default
    (resolveSkillRequirements as Mock).mockResolvedValue({
      resolvedSkills: [],
      expandedSkillNames: [],
      originalIdentifiers: [],
      unresolvedIdentifiers: [],
    });
  });

  describe('when no skills provided', () => {
    it('returns empty result without calling resolver', async () => {
      const mockSession = createMockSession();

      const result = await resolveAllSkills(mockSession, undefined, undefined, 'learning');

      expect(resolveSkillRequirements).not.toHaveBeenCalled();
      expect(result.skillGroups.learningLevelSkillIds).toEqual([]);
      expect(result.requiredSkillIds).toEqual([]);
      expect(result.preferredSkillIds).toEqual([]);
    });

    it('returns empty result for empty arrays', async () => {
      const mockSession = createMockSession();

      const result = await resolveAllSkills(mockSession, [], [], 'learning');

      expect(resolveSkillRequirements).not.toHaveBeenCalled();
      expect(result.requiredSkillIds).toEqual([]);
    });
  });

  describe('required skills resolution', () => {
    it('resolves required skills and groups by proficiency', async () => {
      (resolveSkillRequirements as Mock).mockResolvedValue({
        resolvedSkills: [
          { skillId: 'ts', skillName: 'TypeScript', minProficiency: 'proficient', preferredMinProficiency: null },
          { skillId: 'js', skillName: 'JavaScript', minProficiency: 'learning', preferredMinProficiency: null },
        ],
        expandedSkillNames: ['TypeScript', 'JavaScript'],
        originalIdentifiers: ['typescript'],
        unresolvedIdentifiers: [],
      });

      const mockSession = createMockSession();
      const result = await resolveAllSkills(
        mockSession,
        [{ skill: 'typescript' }],
        undefined,
        'learning'
      );

      expect(resolveSkillRequirements).toHaveBeenCalledWith(
        mockSession,
        [{ skill: 'typescript' }],
        'learning'
      );
      expect(result.skillGroups.proficientLevelSkillIds).toEqual(['ts']);
      expect(result.skillGroups.learningLevelSkillIds).toEqual(['js']);
      expect(result.requiredSkillIds).toEqual(['ts', 'js']);
      expect(result.expandedSkillNames).toEqual(['TypeScript', 'JavaScript']);
    });

    it('extracts preferred proficiency from required skills', async () => {
      (resolveSkillRequirements as Mock).mockResolvedValue({
        resolvedSkills: [
          { skillId: 'ts', skillName: 'TypeScript', minProficiency: 'proficient', preferredMinProficiency: 'expert' },
        ],
        expandedSkillNames: ['TypeScript'],
        originalIdentifiers: ['typescript'],
        unresolvedIdentifiers: [],
      });

      const mockSession = createMockSession();
      const result = await resolveAllSkills(
        mockSession,
        [{ skill: 'typescript', minProficiency: 'proficient', preferredMinProficiency: 'expert' }],
        undefined,
        'learning'
      );

      expect(result.skillIdToPreferredProficiency.get('ts')).toBe('expert');
    });
  });

  describe('preferred skills resolution', () => {
    it('resolves preferred skills separately', async () => {
      let callCount = 0;
      (resolveSkillRequirements as Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Required skills call
          return Promise.resolve({
            resolvedSkills: [
              { skillId: 'ts', skillName: 'TypeScript', minProficiency: 'proficient', preferredMinProficiency: null },
            ],
            expandedSkillNames: ['TypeScript'],
            originalIdentifiers: ['typescript'],
            unresolvedIdentifiers: [],
          });
        }
        // Preferred skills call
        return Promise.resolve({
          resolvedSkills: [
            { skillId: 'react', skillName: 'React', minProficiency: 'learning', preferredMinProficiency: null },
          ],
          expandedSkillNames: ['React'],
          originalIdentifiers: ['react'],
          unresolvedIdentifiers: [],
        });
      });

      const mockSession = createMockSession();
      const result = await resolveAllSkills(
        mockSession,
        [{ skill: 'typescript' }],
        [{ skill: 'react' }],
        'learning'
      );

      expect(resolveSkillRequirements).toHaveBeenCalledTimes(2);
      expect(result.requiredSkillIds).toEqual(['ts']);
      expect(result.preferredSkillIds).toEqual(['react']);
    });

    it('does not override required skill preferred proficiency with preferred skill', async () => {
      let callCount = 0;
      (resolveSkillRequirements as Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Required skills - has preferred proficiency
          return Promise.resolve({
            resolvedSkills: [
              { skillId: 'ts', skillName: 'TypeScript', minProficiency: 'proficient', preferredMinProficiency: 'expert' },
            ],
            expandedSkillNames: ['TypeScript'],
            originalIdentifiers: ['typescript'],
            unresolvedIdentifiers: [],
          });
        }
        // Preferred skills - same skill with different preferred proficiency
        return Promise.resolve({
          resolvedSkills: [
            { skillId: 'ts', skillName: 'TypeScript', minProficiency: 'learning', preferredMinProficiency: 'proficient' },
          ],
          expandedSkillNames: ['TypeScript'],
          originalIdentifiers: ['typescript'],
          unresolvedIdentifiers: [],
        });
      });

      const mockSession = createMockSession();
      const result = await resolveAllSkills(
        mockSession,
        [{ skill: 'typescript', preferredMinProficiency: 'expert' }],
        [{ skill: 'typescript', preferredMinProficiency: 'proficient' }],
        'learning'
      );

      // Required skill's preferred proficiency should be kept
      expect(result.skillIdToPreferredProficiency.get('ts')).toBe('expert');
    });
  });

  describe('unresolved skills', () => {
    it('passes through unresolved identifiers', async () => {
      (resolveSkillRequirements as Mock).mockResolvedValue({
        resolvedSkills: [],
        expandedSkillNames: [],
        originalIdentifiers: ['unknown'],
        unresolvedIdentifiers: ['unknown'],
      });

      const mockSession = createMockSession();
      const result = await resolveAllSkills(
        mockSession,
        [{ skill: 'unknown' }],
        undefined,
        'learning'
      );

      expect(result.unresolvedSkills).toEqual(['unknown']);
      expect(result.originalSkillIdentifiers).toEqual(['unknown']);
    });
  });
});
