import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveSkillRequirements } from './skill-resolver.service.js';
import { createMockSession, createMockQueryResult } from '../__mocks__/neo4j-session.mock.js';
import type { SkillRequirement } from '../types/search.types.js';

describe('resolveSkillRequirements', () => {
  describe('empty input handling', () => {
    it('returns empty result for empty requirements array', async () => {
      const mockSession = createMockSession();

      const result = await resolveSkillRequirements(mockSession, []);

      expect(result.resolvedSkills).toHaveLength(0);
      expect(result.expandedSkillNames).toHaveLength(0);
      expect(result.originalIdentifiers).toHaveLength(0);
      expect(result.unresolvedIdentifiers).toHaveLength(0);
    });

    it('returns empty result for undefined requirements', async () => {
      const mockSession = createMockSession();

      const result = await resolveSkillRequirements(
        mockSession,
        undefined as unknown as SkillRequirement[]
      );

      expect(result.resolvedSkills).toHaveLength(0);
    });
  });

  describe('skill hierarchy expansion', () => {
    it('returns resolved skills with expanded leaf IDs', async () => {
      const mockSession = createMockSession([
        {
          // Leaf skill query (matches BELONGS_TO pattern)
          pattern: 'BELONGS_TO',
          result: [
            {
              identifier: 'typescript',
              skillId: 'skill-ts',
              skillName: 'TypeScript',
            },
          ],
        },
        {
          // Matched skill query (validates identifiers exist)
          pattern: 'WHERE s.id = identifier OR s.name = identifier',
          result: [{ identifier: 'typescript' }],
        },
      ]);

      const requirements: SkillRequirement[] = [
        { skill: 'typescript', minProficiency: 'proficient' },
      ];

      const result = await resolveSkillRequirements(mockSession, requirements);

      expect(result.resolvedSkills).toHaveLength(1);
      expect(result.resolvedSkills[0].skillId).toBe('skill-ts');
      expect(result.resolvedSkills[0].minProficiency).toBe('proficient');
    });

    it('expands parent skills to include all descendants', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [
            { identifier: 'frontend', skillId: 'skill-react', skillName: 'React' },
            { identifier: 'frontend', skillId: 'skill-vue', skillName: 'Vue' },
            { identifier: 'frontend', skillId: 'skill-angular', skillName: 'Angular' },
          ],
        },
        {
          pattern: 'WHERE s.id = identifier OR s.name = identifier',
          result: [{ identifier: 'frontend' }],
        },
      ]);

      const requirements: SkillRequirement[] = [{ skill: 'frontend' }];

      const result = await resolveSkillRequirements(mockSession, requirements);

      expect(result.resolvedSkills).toHaveLength(3);
      const skillIds = result.resolvedSkills.map((s) => s.skillId);
      expect(skillIds).toContain('skill-react');
      expect(skillIds).toContain('skill-vue');
      expect(skillIds).toContain('skill-angular');
    });
  });

  describe('proficiency inheritance', () => {
    it('inherits minProficiency to all expanded skills', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [
            { identifier: 'js-framework', skillId: 'skill-react', skillName: 'React' },
            { identifier: 'js-framework', skillId: 'skill-vue', skillName: 'Vue' },
          ],
        },
        {
          pattern: 'WHERE s.id = identifier OR s.name = identifier',
          result: [{ identifier: 'js-framework' }],
        },
      ]);

      const requirements: SkillRequirement[] = [
        { skill: 'js-framework', minProficiency: 'expert' },
      ];

      const result = await resolveSkillRequirements(mockSession, requirements);

      // All leaf skills should inherit the expert proficiency requirement
      for (const skill of result.resolvedSkills) {
        expect(skill.minProficiency).toBe('expert');
      }
    });

    it('handles overlapping skill hierarchies with highest proficiency', async () => {
      // If skill A requires 'proficient' and skill B (which includes A) requires 'expert',
      // the skill should require 'expert'
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [
            // React appears in both paths
            { identifier: 'react', skillId: 'skill-react', skillName: 'React' },
            { identifier: 'frontend', skillId: 'skill-react', skillName: 'React' },
            { identifier: 'frontend', skillId: 'skill-vue', skillName: 'Vue' },
          ],
        },
        {
          pattern: 'WHERE s.id = identifier OR s.name = identifier',
          result: [{ identifier: 'react' }, { identifier: 'frontend' }],
        },
      ]);

      const requirements: SkillRequirement[] = [
        { skill: 'react', minProficiency: 'learning' },
        { skill: 'frontend', minProficiency: 'expert' },
      ];

      const result = await resolveSkillRequirements(mockSession, requirements);

      // React should have the higher proficiency requirement (expert from frontend)
      const reactSkill = result.resolvedSkills.find((s) => s.skillId === 'skill-react');
      expect(reactSkill?.minProficiency).toBe('expert');
    });

    it('uses default proficiency when none specified', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [
            { identifier: 'typescript', skillId: 'skill-ts', skillName: 'TypeScript' },
          ],
        },
        {
          pattern: 'WHERE s.id = identifier OR s.name = identifier',
          result: [{ identifier: 'typescript' }],
        },
      ]);

      // No minProficiency specified
      const requirements: SkillRequirement[] = [{ skill: 'typescript' }];

      const result = await resolveSkillRequirements(mockSession, requirements, 'learning');

      expect(result.resolvedSkills[0].minProficiency).toBe('learning');
    });
  });

  describe('preferred proficiency handling', () => {
    it('includes preferredMinProficiency in resolved skills', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [
            { identifier: 'typescript', skillId: 'skill-ts', skillName: 'TypeScript' },
          ],
        },
        {
          pattern: 'WHERE s.id = identifier OR s.name = identifier',
          result: [{ identifier: 'typescript' }],
        },
      ]);

      const requirements: SkillRequirement[] = [
        {
          skill: 'typescript',
          minProficiency: 'proficient',
          preferredMinProficiency: 'expert',
        },
      ];

      const result = await resolveSkillRequirements(mockSession, requirements);

      expect(result.resolvedSkills[0].preferredMinProficiency).toBe('expert');
    });
  });

  describe('unresolved skills', () => {
    it('tracks unresolved skill identifiers', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [], // No matching skills found
        },
        {
          pattern: 'WHERE s.id = identifier OR s.name = identifier',
          result: [], // Identifier doesn't exist in graph
        },
      ]);

      const requirements: SkillRequirement[] = [{ skill: 'nonexistent-skill' }];

      const result = await resolveSkillRequirements(mockSession, requirements);

      expect(result.unresolvedIdentifiers).toContain('nonexistent-skill');
    });

    it('returns both resolved and unresolved when mixed', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [
            { identifier: 'typescript', skillId: 'skill-ts', skillName: 'TypeScript' },
            // nonexistent returns nothing
          ],
        },
        {
          pattern: 'WHERE s.id = identifier OR s.name = identifier',
          result: [{ identifier: 'typescript' }], // Only typescript exists
        },
      ]);

      const requirements: SkillRequirement[] = [
        { skill: 'typescript' },
        { skill: 'nonexistent-skill' },
      ];

      const result = await resolveSkillRequirements(mockSession, requirements);

      expect(result.resolvedSkills).toHaveLength(1);
      expect(result.unresolvedIdentifiers).toContain('nonexistent-skill');
      expect(result.originalIdentifiers).toEqual(['typescript', 'nonexistent-skill']);
    });
  });

  describe('case insensitivity', () => {
    it('handles case-insensitive skill matching', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [
            { identifier: 'TypeScript', skillId: 'skill-ts', skillName: 'TypeScript' },
          ],
        },
        {
          pattern: 'WHERE s.id = identifier OR s.name = identifier',
          result: [{ identifier: 'TypeScript' }],
        },
      ]);

      // User types lowercase
      const requirements: SkillRequirement[] = [
        { skill: 'TypeScript', minProficiency: 'proficient' },
      ];

      const result = await resolveSkillRequirements(mockSession, requirements);

      expect(result.resolvedSkills).toHaveLength(1);
      expect(result.resolvedSkills[0].minProficiency).toBe('proficient');
    });
  });

  describe('session usage', () => {
    it('executes expected number of queries', async () => {
      const mockSession = createMockSession([
        { pattern: 'BELONGS_TO', result: [] },
        { pattern: 'WHERE s.id = identifier OR s.name = identifier', result: [] },
      ]);
      const runSpy = vi.spyOn(mockSession, 'run');

      await resolveSkillRequirements(mockSession, [{ skill: 'test' }]);

      // Should execute 2 queries (leaf expansion + validation)
      expect(runSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('expanded skill names', () => {
    it('returns expanded skill names for display', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [
            { identifier: 'backend', skillId: 'skill-node', skillName: 'Node.js' },
            { identifier: 'backend', skillId: 'skill-python', skillName: 'Python' },
          ],
        },
        {
          pattern: 'WHERE s.id = identifier OR s.name = identifier',
          result: [{ identifier: 'backend' }],
        },
      ]);

      const requirements: SkillRequirement[] = [{ skill: 'backend' }];

      const result = await resolveSkillRequirements(mockSession, requirements);

      expect(result.expandedSkillNames).toContain('Node.js');
      expect(result.expandedSkillNames).toContain('Python');
    });
  });
});
