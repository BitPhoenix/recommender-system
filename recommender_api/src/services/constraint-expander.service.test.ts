import { describe, it, expect } from 'vitest';
import { expandSearchCriteria } from './constraint-expander.service.js';
import type { SearchFilterRequest } from '../types/search.types.js';
import { isPropertyPreference, AppliedFilterKind, AppliedPreferenceKind, isDerivedSkillFilter } from '../types/search.types.js';
import type { ResolvedSkillWithProficiency } from './skill-resolver.service.js';

/*
 * Helper to call expandSearchCriteria with configurable resolved skills.
 * Most tests don't need resolved skills - only skill-related tests do.
 */
interface ExpandOptions {
  resolvedRequiredSkills?: ResolvedSkillWithProficiency[];
  resolvedPreferredSkills?: ResolvedSkillWithProficiency[];
}

async function expand(
  request: Partial<SearchFilterRequest>,
  options: ExpandOptions = {}
) {
  return expandSearchCriteria(
    request,
    options.resolvedRequiredSkills ?? [],
    options.resolvedPreferredSkills ?? []
  );
}

describe('expandSearchCriteria', () => {
  describe('seniority expansion', () => {
    it('maps junior to 0-3 years', async () => {
      const result = await expand({ requiredSeniorityLevel: 'junior' });
      expect(result.minYearsExperience).toBe(0);
      expect(result.maxYearsExperience).toBe(3);
    });

    it('maps mid to 3-6 years', async () => {
      const result = await expand({ requiredSeniorityLevel: 'mid' });
      expect(result.minYearsExperience).toBe(3);
      expect(result.maxYearsExperience).toBe(6);
    });

    it('maps senior to 6-10 years', async () => {
      const result = await expand({ requiredSeniorityLevel: 'senior' });
      expect(result.minYearsExperience).toBe(6);
      expect(result.maxYearsExperience).toBe(10);
    });

    it('maps staff to 10+ years (no max)', async () => {
      const result = await expand({ requiredSeniorityLevel: 'staff' });
      expect(result.minYearsExperience).toBe(10);
      expect(result.maxYearsExperience).toBeNull();
    });

    it('maps principal to 15+ years (no max)', async () => {
      const result = await expand({ requiredSeniorityLevel: 'principal' });
      expect(result.minYearsExperience).toBe(15);
      expect(result.maxYearsExperience).toBeNull();
    });

    it('returns null years for no seniority level', async () => {
      const result = await expand({});
      expect(result.minYearsExperience).toBeNull();
      expect(result.maxYearsExperience).toBeNull();
    });
  });

  describe('start timeline expansion', () => {
    it('returns all timelines up to and including required', async () => {
      const result = await expand({ requiredMaxStartTime: 'one_month' });
      expect(result.startTimeline).toEqual(['immediate', 'two_weeks', 'one_month']);
    });

    it('returns only immediate for immediate requirement', async () => {
      const result = await expand({ requiredMaxStartTime: 'immediate' });
      expect(result.startTimeline).toEqual(['immediate']);
    });

    it('returns all timelines up to three_months', async () => {
      const result = await expand({ requiredMaxStartTime: 'three_months' });
      expect(result.startTimeline).toEqual(['immediate', 'two_weeks', 'one_month', 'three_months']);
    });

    it('uses default when no requirement specified', async () => {
      const result = await expand({});
      // Default is 'one_year' which includes all timelines
      expect(result.startTimeline).toBeDefined();
      expect(result.startTimeline.length).toBeGreaterThan(0);
      expect(result.defaultsApplied).toContain('requiredMaxStartTime');
    });
  });

  describe('timezone expansion', () => {
    it('returns empty array for no timezone requirement', async () => {
      const result = await expand({});
      expect(result.timezonePrefixes).toEqual([]);
    });

    it('expands America/* to America/ prefix', async () => {
      const result = await expand({ requiredTimezone: ['America/*'] });
      expect(result.timezonePrefixes).toEqual(['America/']);
    });

    it('expands Europe/* to Europe/ prefix', async () => {
      const result = await expand({ requiredTimezone: ['Europe/*'] });
      expect(result.timezonePrefixes).toEqual(['Europe/']);
    });

    it('keeps specific timezone as-is', async () => {
      const result = await expand({ requiredTimezone: ['America/New_York'] });
      expect(result.timezonePrefixes).toEqual(['America/New_York']);
    });

    it('handles multiple patterns', async () => {
      const result = await expand({ requiredTimezone: ['America/*', 'Europe/*'] });
      expect(result.timezonePrefixes).toEqual(['America/', 'Europe/']);
    });
  });

  describe('budget expansion', () => {
    it('returns null for no budget', async () => {
      const result = await expand({});
      expect(result.maxBudget).toBeNull();
      expect(result.stretchBudget).toBeNull();
    });

    it('sets maxBudget when provided', async () => {
      const result = await expand({ maxBudget: 200000 });
      expect(result.maxBudget).toBe(200000);
      expect(result.stretchBudget).toBeNull();
    });

    it('sets both budgets when provided', async () => {
      const result = await expand({ maxBudget: 200000, stretchBudget: 220000 });
      expect(result.maxBudget).toBe(200000);
      expect(result.stretchBudget).toBe(220000);
    });
  });

  describe('team focus expansion', () => {
    it('returns empty array for no team focus', async () => {
      const result = await expand({});
      expect(result.alignedSkillIds).toEqual([]);
    });

    it('returns skill IDs for greenfield focus', async () => {
      const result = await expand({ teamFocus: 'greenfield' });
      expect(result.alignedSkillIds).toBeDefined();
      expect(result.alignedSkillIds.length).toBeGreaterThan(0);
    });

    it('returns skill IDs for maintenance focus', async () => {
      const result = await expand({ teamFocus: 'maintenance' });
      expect(result.alignedSkillIds).toBeDefined();
      expect(result.alignedSkillIds.length).toBeGreaterThan(0);
    });
  });

  describe('pagination expansion', () => {
    it('uses defaults when not specified', async () => {
      const result = await expand({});
      expect(result.limit).toBe(20); // default
      expect(result.offset).toBe(0); // default
      expect(result.defaultsApplied).toContain('limit');
      expect(result.defaultsApplied).toContain('offset');
    });

    it('uses provided values', async () => {
      const result = await expand({ limit: 50, offset: 100 });
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(100);
    });

    it('caps limit at 100', async () => {
      const result = await expand({ limit: 500 });
      expect(result.limit).toBe(100);
    });
  });

  describe('applied filters tracking', () => {
    it('tracks seniority as a filter', async () => {
      const result = await expand({ requiredSeniorityLevel: 'senior' });
      const filter = result.appliedFilters.find((f) => f.field === 'yearsExperience');
      expect(filter).toBeDefined();
      expect(filter!.source).toBe('knowledge_base');
    });

    it('tracks timezone as a filter', async () => {
      const result = await expand({ requiredTimezone: ['America/*'] });
      const filter = result.appliedFilters.find((f) => f.field === 'timezone');
      expect(filter).toBeDefined();
      expect(filter!.source).toBe('user');
    });

    it('tracks budget as a filter', async () => {
      const result = await expand({ maxBudget: 200000 });
      const filter = result.appliedFilters.find((f) => f.field === 'salary');
      expect(filter).toBeDefined();
      expect(filter!.operator).toBe('<=');
    });
  });

  describe('applied preferences tracking', () => {
    it('tracks preferredMaxStartTime as a preference', async () => {
      const result = await expand({ preferredMaxStartTime: 'two_weeks' });
      const pref = result.appliedPreferences.find((p) => p.field === 'preferredMaxStartTime');
      expect(pref).toBeDefined();
      expect(isPropertyPreference(pref!)).toBe(true);
      if (isPropertyPreference(pref!)) {
        expect(pref.value).toBe('two_weeks');
      }
    });

    it('tracks preferredTimezone as a preference', async () => {
      const result = await expand({ preferredTimezone: ['America/New_York'] });
      const pref = result.appliedPreferences.find((p) => p.field === 'preferredTimezone');
      expect(pref).toBeDefined();
    });

    it('tracks preferredSeniorityLevel as a preference', async () => {
      const result = await expand({ preferredSeniorityLevel: 'senior' });
      const pref = result.appliedPreferences.find((p) => p.field === 'preferredSeniorityLevel');
      expect(pref).toBeDefined();
      expect(isPropertyPreference(pref!) && pref.value).toBe('senior');
    });

    it('tracks teamFocus as a preference', async () => {
      const result = await expand({ teamFocus: 'greenfield' });
      const pref = result.appliedPreferences.find((p) => p.field === 'teamFocusMatch');
      expect(pref).toBeDefined();
    });
  });

  describe('pass-through values', () => {
    it('passes through preferredSeniorityLevel', async () => {
      const result = await expand({ preferredSeniorityLevel: 'senior' });
      expect(result.preferredSeniorityLevel).toBe('senior');
    });

    it('passes through preferredMaxStartTime', async () => {
      const result = await expand({ preferredMaxStartTime: 'two_weeks' });
      expect(result.preferredMaxStartTime).toBe('two_weeks');
    });

    it('passes through preferredTimezone', async () => {
      const result = await expand({
        preferredTimezone: ['America/New_York', 'America/Chicago'],
      });
      expect(result.preferredTimezone).toEqual(['America/New_York', 'America/Chicago']);
    });

    it('sets requiredMaxStartTime from input or default', async () => {
      const withRequired = await expand({ requiredMaxStartTime: 'one_month' });
      expect(withRequired.requiredMaxStartTime).toBe('one_month');

      const withDefault = await expand({});
      expect(withDefault.requiredMaxStartTime).toBe('one_year'); // default
    });
  });

  describe('full request expansion', () => {
    it('expands a complete request correctly', async () => {
      const result = await expand({
        requiredSeniorityLevel: 'senior',
        requiredMaxStartTime: 'one_month',
        preferredMaxStartTime: 'two_weeks',
        requiredTimezone: ['America/*'],
        preferredTimezone: ['America/New_York', 'America/Chicago'],
        maxBudget: 200000,
        stretchBudget: 220000,
        teamFocus: 'greenfield',
        preferredSeniorityLevel: 'staff',
        limit: 50,
        offset: 0,
      });

      // Seniority expansion
      expect(result.minYearsExperience).toBe(6);
      expect(result.maxYearsExperience).toBe(10);

      // Timeline expansion
      expect(result.startTimeline).toEqual(['immediate', 'two_weeks', 'one_month']);

      // Timezone expansion
      expect(result.timezonePrefixes).toEqual(['America/']);

      // Budget pass-through
      expect(result.maxBudget).toBe(200000);
      expect(result.stretchBudget).toBe(220000);

      // Team focus expansion
      expect(result.alignedSkillIds.length).toBeGreaterThan(0);

      // Pagination
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);

      // Preferred values pass-through
      expect(result.preferredSeniorityLevel).toBe('staff');
      expect(result.preferredMaxStartTime).toBe('two_weeks');
      expect(result.requiredMaxStartTime).toBe('one_month');
      expect(result.preferredTimezone).toEqual(['America/New_York', 'America/Chicago']);
    });
  });

  describe('inference engine outputs', () => {
    it('includes derivedConstraints in result', async () => {
      const result = await expand({ teamFocus: 'scaling' });
      expect(result.derivedConstraints).toBeDefined();
      expect(Array.isArray(result.derivedConstraints)).toBe(true);
    });

    it('includes derivedRequiredSkillIds in result', async () => {
      const result = await expand({});
      expect(result.derivedRequiredSkillIds).toBeDefined();
      expect(Array.isArray(result.derivedRequiredSkillIds)).toBe(true);
    });

    it('includes derivedSkillBoosts in result', async () => {
      const result = await expand({});
      expect(result.derivedSkillBoosts).toBeDefined();
      expect(result.derivedSkillBoosts).toBeInstanceOf(Map);
    });
  });

  describe('inference integration', () => {
    describe('filter rule outputs', () => {
      it('populates derivedRequiredSkillIds for teamFocus: scaling', async () => {
        const result = await expand({ teamFocus: 'scaling' });

        // scaling-requires-distributed should add skill_distributed
        expect(result.derivedRequiredSkillIds).toContain('skill_distributed');
        // Chain: distributed-requires-observability adds skill_monitoring
        expect(result.derivedRequiredSkillIds).toContain('skill_monitoring');
      });

      it('populates derivedRequiredSkillIds for kubernetes skill', async () => {
        const result = await expand({
          requiredSkills: [{ skill: 'skill_kubernetes' }],
        });

        // kubernetes-requires-containers should add skill_docker
        expect(result.derivedRequiredSkillIds).toContain('skill_docker');
      });
    });

    describe('boost rule outputs', () => {
      it('populates derivedSkillBoosts for senior seniority', async () => {
        const result = await expand({
          requiredSeniorityLevel: 'senior',
        });

        // senior-prefers-leadership should boost mentorship
        expect(result.derivedSkillBoosts.get('skill_mentorship')).toBeGreaterThan(0);
      });

      it('populates derivedSkillBoosts for greenfield focus', async () => {
        const result = await expand({
          teamFocus: 'greenfield',
        });

        // greenfield-prefers-ambiguity-tolerance should boost prototyping
        expect(result.derivedSkillBoosts.get('skill_prototyping')).toBeGreaterThan(0);
      });

      it('takes max boost strength when multiple rules boost same skill', async () => {
        const result = await expand({
          requiredSeniorityLevel: 'senior',
          teamFocus: 'greenfield',
        });

        // Multiple rules may boost skills - verify we get reasonable values
        const boosts = result.derivedSkillBoosts;
        for (const [, strength] of boosts) {
          expect(strength).toBeGreaterThan(0);
          expect(strength).toBeLessThanOrEqual(1);
        }
      });
    });

    describe('derivedConstraints structure', () => {
      it('includes all required fields in derivedConstraints', async () => {
        const result = await expand({ teamFocus: 'scaling' });

        expect(result.derivedConstraints.length).toBeGreaterThan(0);

        for (const constraint of result.derivedConstraints) {
          // Rule info
          expect(constraint.rule).toBeDefined();
          expect(constraint.rule.id).toBeDefined();
          expect(constraint.rule.name).toBeDefined();

          // Action info
          expect(constraint.action).toBeDefined();
          expect(constraint.action.effect).toMatch(/^(filter|boost)$/);
          expect(constraint.action.targetField).toBeDefined();
          expect(constraint.action.targetValue).toBeDefined();

          // Provenance info
          expect(constraint.provenance).toBeDefined();
          expect(constraint.provenance.derivationChains).toBeDefined();
          expect(constraint.provenance.explanation).toBeDefined();

          // Override is optional (undefined when not overridden)
          expect(constraint.override === undefined || typeof constraint.override === 'object').toBe(true);
        }
      });

      it('includes boostStrength for boost rules only', async () => {
        const result = await expand({
          teamFocus: 'scaling',
          requiredSeniorityLevel: 'senior',
        });

        const filterConstraints = result.derivedConstraints.filter(
          (c) => c.action.effect === 'filter'
        );
        const boostConstraints = result.derivedConstraints.filter(
          (c) => c.action.effect === 'boost'
        );

        // Filter rules should NOT have boostStrength
        for (const c of filterConstraints) {
          expect(c.action.boostStrength).toBeUndefined();
        }

        // Boost rules SHOULD have boostStrength
        for (const c of boostConstraints) {
          expect(c.action.boostStrength).toBeGreaterThan(0);
        }
      });
    });

    describe('override mechanism', () => {
      it('excludes overridden filter rules from derivedRequiredSkillIds', async () => {
        const result = await expand({
          teamFocus: 'scaling',
          overriddenRuleIds: ['scaling-requires-distributed'],
        });

        // skill_distributed should NOT be in required skills
        expect(result.derivedRequiredSkillIds).not.toContain('skill_distributed');

        // Chain should also be broken - skill_monitoring should not appear
        expect(result.derivedRequiredSkillIds).not.toContain('skill_monitoring');
      });

      it('excludes overridden boost rules from derivedSkillBoosts', async () => {
        const result = await expand({
          requiredSeniorityLevel: 'senior',
          overriddenRuleIds: ['senior-prefers-leadership'],
        });

        // Boosted skills should NOT be in boosts map
        expect(result.derivedSkillBoosts.has('skill_mentorship')).toBe(false);
      });

      it('marks constraint as overridden in derivedConstraints', async () => {
        const result = await expand({
          teamFocus: 'scaling',
          overriddenRuleIds: ['scaling-requires-distributed'],
        });

        const scalingRule = result.derivedConstraints.find(
          (c) => c.rule.id === 'scaling-requires-distributed'
        );
        expect(scalingRule).toBeDefined();
        expect(scalingRule!.override?.overrideScope).toBe('FULL');
      });

      it('marks constraint as implicit-skill-override when user supplies target skills', async () => {
        /*
         * Implicit skill override: User specifies skill_distributed which matches
         * the scaling-requires-distributed rule's target.
         * Since user already requires all target skills, the rule is FULLY overridden.
         */
        const resolvedRequired: ResolvedSkillWithProficiency[] = [
          { skillId: 'skill_distributed', skillName: 'Distributed Systems', minProficiency: 'proficient', preferredMinProficiency: null },
        ];

        const result = await expand(
          {
            teamFocus: 'scaling',
            requiredSkills: [{ skill: 'skill_distributed', minProficiency: 'proficient' }],
          },
          { resolvedRequiredSkills: resolvedRequired }
        );

        const scalingRule = result.derivedConstraints.find(
          (c) => c.rule.id === 'scaling-requires-distributed'
        );
        expect(scalingRule).toBeDefined();
        // FULL override because user provides ALL target skills (rule only targets skill_distributed)
        expect(scalingRule!.override?.overrideScope).toBe('FULL');
        expect(scalingRule!.override?.reasonType).toBe('implicit-skill-override');
        expect(scalingRule!.override?.overriddenSkills).toContain('skill_distributed');
      });
    });

    describe('appliedFilters source tracking', () => {
      it('includes inference source for derived filter constraints as AppliedSkillFilter', async () => {
        const result = await expand({ teamFocus: 'scaling' });

        const inferenceFilters = result.appliedFilters.filter(
          (f) => f.source === 'inference'
        );

        // Should have at least one inference-derived filter
        expect(inferenceFilters.length).toBeGreaterThan(0);

        // Verify it's an AppliedDerivedSkillFilter with proper structure
        const skillFilter = inferenceFilters.find(
          (f) => f.kind === AppliedFilterKind.Skill && isDerivedSkillFilter(f)
        );
        expect(skillFilter).toBeDefined();
        expect(skillFilter?.kind).toBe(AppliedFilterKind.Skill);
        if (skillFilter?.kind === AppliedFilterKind.Skill && isDerivedSkillFilter(skillFilter)) {
          expect(skillFilter.field).toBe('derivedSkills');
          expect(skillFilter.ruleId).toBeDefined();
          expect(skillFilter.skills).toBeInstanceOf(Array);
          expect(skillFilter.skills.length).toBeGreaterThan(0);
        }
      });

      it('routes boost constraints to preferences, not filters', async () => {
        // Trigger a boost rule (senior-prefers-leadership)
        const result = await expand({ requiredSeniorityLevel: 'senior' });

        // Verify boost appears in preferences
        const boostPreference = result.appliedPreferences.find(
          (p) => p.source === 'inference' && p.field === 'derivedSkills'
        );
        expect(boostPreference).toBeDefined();

        // Verify NO AppliedSkillFilter was created for the boost in filters
        const boostAsFilter = result.appliedFilters.find(
          (f) => f.source === 'inference' &&
          f.kind === AppliedFilterKind.Skill &&
          f.field === 'derivedSkills'
        );
        expect(boostAsFilter).toBeUndefined();
      });
    });

    describe('appliedPreferences source tracking', () => {
      it('includes inference source for derived boost constraints', async () => {
        const result = await expand({
          requiredSeniorityLevel: 'senior',
        });

        const inferencePrefs = result.appliedPreferences.filter(
          (p) => p.source === 'inference'
        );

        // Should have at least one inference-derived preference
        expect(inferencePrefs.length).toBeGreaterThan(0);
      });
    });

    describe('AppliedDerivedSkillFilter structure for derived constraints', () => {
      it('teamFocus: scaling creates AppliedDerivedSkillFilter with correct structure', async () => {
        const result = await expand({ teamFocus: 'scaling' });

        // Find the scaling-requires-distributed filter
        const scalingFilter = result.appliedFilters.find(
          (f) => f.kind === AppliedFilterKind.Skill &&
                 isDerivedSkillFilter(f) &&
                 f.ruleId === 'scaling-requires-distributed'
        );

        expect(scalingFilter).toBeDefined();
        expect(scalingFilter?.kind).toBe(AppliedFilterKind.Skill);

        if (scalingFilter?.kind === AppliedFilterKind.Skill && isDerivedSkillFilter(scalingFilter)) {
          expect(scalingFilter.field).toBe('derivedSkills');
          expect(scalingFilter.ruleId).toBe('scaling-requires-distributed');
          expect(scalingFilter.source).toBe('inference');
          expect(scalingFilter.operator).toBe('HAS_ALL');
          expect(scalingFilter.skills).toBeInstanceOf(Array);
          expect(scalingFilter.skills.some(s => s.skillId === 'skill_distributed')).toBe(true);
        }
      });

      it('chain rules also create AppliedDerivedSkillFilter', async () => {
        const result = await expand({ teamFocus: 'scaling' });

        // Chain rule: distributed-requires-observability should also fire
        const chainFilter = result.appliedFilters.find(
          (f) => f.kind === AppliedFilterKind.Skill &&
                 isDerivedSkillFilter(f) &&
                 f.ruleId === 'distributed-requires-observability'
        );

        expect(chainFilter).toBeDefined();
        if (chainFilter?.kind === AppliedFilterKind.Skill && isDerivedSkillFilter(chainFilter)) {
          expect(chainFilter.field).toBe('derivedSkills');
          expect(chainFilter.source).toBe('inference');
        }
      });
    });
  });

  describe('user skill constraints with resolved skills', () => {
    it('creates AppliedSkillFilter with resolved skill data', async () => {
      const resolvedRequired: ResolvedSkillWithProficiency[] = [
        { skillId: 'skill_typescript', skillName: 'TypeScript', minProficiency: 'proficient', preferredMinProficiency: null },
      ];

      const result = await expand(
        { requiredSkills: [{ skill: 'typescript', minProficiency: 'proficient' }] },
        { resolvedRequiredSkills: resolvedRequired }
      );

      const skillFilter = result.appliedFilters.find(
        (f) => f.kind === AppliedFilterKind.Skill && f.field === 'requiredSkills'
      );
      expect(skillFilter).toBeDefined();
      expect(skillFilter?.kind).toBe(AppliedFilterKind.Skill);
      if (skillFilter?.kind === AppliedFilterKind.Skill && 'skills' in skillFilter) {
        expect(skillFilter.skills).toHaveLength(1);
        expect(skillFilter.skills[0].skillId).toBe('skill_typescript');
        expect(skillFilter.skills[0].minProficiency).toBe('proficient');
      }
    });

    it('creates AppliedSkillPreference with resolved preferred skills', async () => {
      const resolvedPreferred: ResolvedSkillWithProficiency[] = [
        { skillId: 'skill_react', skillName: 'React', minProficiency: 'learning', preferredMinProficiency: 'proficient' },
      ];

      const result = await expand(
        { preferredSkills: [{ skill: 'react', preferredMinProficiency: 'proficient' }] },
        { resolvedPreferredSkills: resolvedPreferred }
      );

      const skillPref = result.appliedPreferences.find(
        (p) => p.kind === AppliedPreferenceKind.Skill && p.field === 'preferredSkills'
      );
      expect(skillPref).toBeDefined();
      if (skillPref?.kind === AppliedPreferenceKind.Skill && 'skills' in skillPref) {
        expect(skillPref.skills).toHaveLength(1);
        expect(skillPref.skills[0].skillId).toBe('skill_react');
      }
    });

    it('includes both user and derived skill filters when both present', async () => {
      const resolvedRequired: ResolvedSkillWithProficiency[] = [
        { skillId: 'skill_typescript', skillName: 'TypeScript', minProficiency: 'proficient', preferredMinProficiency: null },
      ];

      const result = await expand(
        {
          requiredSkills: [{ skill: 'typescript', minProficiency: 'proficient' }],
          teamFocus: 'scaling', // Triggers derived skills
        },
        { resolvedRequiredSkills: resolvedRequired }
      );

      // Should have user skill filter
      const userSkillFilter = result.appliedFilters.find(
        (f) => f.kind === AppliedFilterKind.Skill && f.field === 'requiredSkills'
      );
      expect(userSkillFilter).toBeDefined();

      // Should also have derived skill filter from inference
      const derivedSkillFilter = result.appliedFilters.find(
        (f) => f.kind === AppliedFilterKind.Skill && f.field === 'derivedSkills'
      );
      expect(derivedSkillFilter).toBeDefined();
    });
  });
});
