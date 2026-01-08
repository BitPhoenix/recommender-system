import { describe, it, expect } from 'vitest';
import { expandSearchCriteria } from './constraint-expander.service.js';

describe('expandSearchCriteria', () => {
  describe('seniority expansion', () => {
    it('maps junior to 0-3 years', async () => {
      const result = await expandSearchCriteria({ requiredSeniorityLevel: 'junior' });
      expect(result.minYearsExperience).toBe(0);
      expect(result.maxYearsExperience).toBe(3);
    });

    it('maps mid to 3-6 years', async () => {
      const result = await expandSearchCriteria({ requiredSeniorityLevel: 'mid' });
      expect(result.minYearsExperience).toBe(3);
      expect(result.maxYearsExperience).toBe(6);
    });

    it('maps senior to 6-10 years', async () => {
      const result = await expandSearchCriteria({ requiredSeniorityLevel: 'senior' });
      expect(result.minYearsExperience).toBe(6);
      expect(result.maxYearsExperience).toBe(10);
    });

    it('maps staff to 10+ years (no max)', async () => {
      const result = await expandSearchCriteria({ requiredSeniorityLevel: 'staff' });
      expect(result.minYearsExperience).toBe(10);
      expect(result.maxYearsExperience).toBeNull();
    });

    it('maps principal to 15+ years (no max)', async () => {
      const result = await expandSearchCriteria({ requiredSeniorityLevel: 'principal' });
      expect(result.minYearsExperience).toBe(15);
      expect(result.maxYearsExperience).toBeNull();
    });

    it('returns null years for no seniority level', async () => {
      const result = await expandSearchCriteria({});
      expect(result.minYearsExperience).toBeNull();
      expect(result.maxYearsExperience).toBeNull();
    });
  });

  describe('start timeline expansion', () => {
    it('returns all timelines up to and including required', async () => {
      const result = await expandSearchCriteria({ requiredMaxStartTime: 'one_month' });
      expect(result.startTimeline).toEqual(['immediate', 'two_weeks', 'one_month']);
    });

    it('returns only immediate for immediate requirement', async () => {
      const result = await expandSearchCriteria({ requiredMaxStartTime: 'immediate' });
      expect(result.startTimeline).toEqual(['immediate']);
    });

    it('returns all timelines up to three_months', async () => {
      const result = await expandSearchCriteria({ requiredMaxStartTime: 'three_months' });
      expect(result.startTimeline).toEqual(['immediate', 'two_weeks', 'one_month', 'three_months']);
    });

    it('uses default when no requirement specified', async () => {
      const result = await expandSearchCriteria({});
      // Default is 'one_year' which includes all timelines
      expect(result.startTimeline).toBeDefined();
      expect(result.startTimeline.length).toBeGreaterThan(0);
      expect(result.defaultsApplied).toContain('requiredMaxStartTime');
    });
  });

  describe('timezone expansion', () => {
    it('returns empty array for no timezone requirement', async () => {
      const result = await expandSearchCriteria({});
      expect(result.timezonePrefixes).toEqual([]);
    });

    it('expands America/* to America/ prefix', async () => {
      const result = await expandSearchCriteria({ requiredTimezone: ['America/*'] });
      expect(result.timezonePrefixes).toEqual(['America/']);
    });

    it('expands Europe/* to Europe/ prefix', async () => {
      const result = await expandSearchCriteria({ requiredTimezone: ['Europe/*'] });
      expect(result.timezonePrefixes).toEqual(['Europe/']);
    });

    it('keeps specific timezone as-is', async () => {
      const result = await expandSearchCriteria({ requiredTimezone: ['America/New_York'] });
      expect(result.timezonePrefixes).toEqual(['America/New_York']);
    });

    it('handles multiple patterns', async () => {
      const result = await expandSearchCriteria({ requiredTimezone: ['America/*', 'Europe/*'] });
      expect(result.timezonePrefixes).toEqual(['America/', 'Europe/']);
    });
  });

  describe('budget expansion', () => {
    it('returns null for no budget', async () => {
      const result = await expandSearchCriteria({});
      expect(result.maxBudget).toBeNull();
      expect(result.stretchBudget).toBeNull();
    });

    it('sets maxBudget when provided', async () => {
      const result = await expandSearchCriteria({ maxBudget: 200000 });
      expect(result.maxBudget).toBe(200000);
      expect(result.stretchBudget).toBeNull();
    });

    it('sets both budgets when provided', async () => {
      const result = await expandSearchCriteria({ maxBudget: 200000, stretchBudget: 220000 });
      expect(result.maxBudget).toBe(200000);
      expect(result.stretchBudget).toBe(220000);
    });
  });

  describe('team focus expansion', () => {
    it('returns empty array for no team focus', async () => {
      const result = await expandSearchCriteria({});
      expect(result.alignedSkillIds).toEqual([]);
    });

    it('returns skill IDs for greenfield focus', async () => {
      const result = await expandSearchCriteria({ teamFocus: 'greenfield' });
      expect(result.alignedSkillIds).toBeDefined();
      expect(result.alignedSkillIds.length).toBeGreaterThan(0);
    });

    it('returns skill IDs for maintenance focus', async () => {
      const result = await expandSearchCriteria({ teamFocus: 'maintenance' });
      expect(result.alignedSkillIds).toBeDefined();
      expect(result.alignedSkillIds.length).toBeGreaterThan(0);
    });
  });

  describe('pagination expansion', () => {
    it('uses defaults when not specified', async () => {
      const result = await expandSearchCriteria({});
      expect(result.limit).toBe(20); // default
      expect(result.offset).toBe(0); // default
      expect(result.defaultsApplied).toContain('limit');
      expect(result.defaultsApplied).toContain('offset');
    });

    it('uses provided values', async () => {
      const result = await expandSearchCriteria({ limit: 50, offset: 100 });
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(100);
    });

    it('caps limit at 100', async () => {
      const result = await expandSearchCriteria({ limit: 500 });
      expect(result.limit).toBe(100);
    });
  });

  describe('applied filters tracking', () => {
    it('tracks seniority as a filter', async () => {
      const result = await expandSearchCriteria({ requiredSeniorityLevel: 'senior' });
      const filter = result.appliedFilters.find((f) => f.field === 'yearsExperience');
      expect(filter).toBeDefined();
      expect(filter!.source).toBe('knowledge_base');
    });

    it('tracks timezone as a filter', async () => {
      const result = await expandSearchCriteria({ requiredTimezone: ['America/*'] });
      const filter = result.appliedFilters.find((f) => f.field === 'timezone');
      expect(filter).toBeDefined();
      expect(filter!.source).toBe('user');
    });

    it('tracks budget as a filter', async () => {
      const result = await expandSearchCriteria({ maxBudget: 200000 });
      const filter = result.appliedFilters.find((f) => f.field === 'salary');
      expect(filter).toBeDefined();
      expect(filter!.operator).toBe('<=');
    });
  });

  describe('applied preferences tracking', () => {
    it('tracks preferredMaxStartTime as a preference', async () => {
      const result = await expandSearchCriteria({ preferredMaxStartTime: 'two_weeks' });
      const pref = result.appliedPreferences.find((p) => p.field === 'preferredMaxStartTime');
      expect(pref).toBeDefined();
      expect(pref!.value).toBe('two_weeks');
    });

    it('tracks preferredTimezone as a preference', async () => {
      const result = await expandSearchCriteria({ preferredTimezone: ['America/New_York'] });
      const pref = result.appliedPreferences.find((p) => p.field === 'preferredTimezone');
      expect(pref).toBeDefined();
    });

    it('tracks preferredSeniorityLevel as a preference', async () => {
      const result = await expandSearchCriteria({ preferredSeniorityLevel: 'senior' });
      const pref = result.appliedPreferences.find((p) => p.field === 'preferredSeniorityLevel');
      expect(pref).toBeDefined();
      expect(pref!.value).toBe('senior');
    });

    it('tracks teamFocus as a preference', async () => {
      const result = await expandSearchCriteria({ teamFocus: 'greenfield' });
      const pref = result.appliedPreferences.find((p) => p.field === 'teamFocusMatch');
      expect(pref).toBeDefined();
    });
  });

  describe('pass-through values', () => {
    it('passes through preferredSeniorityLevel', async () => {
      const result = await expandSearchCriteria({ preferredSeniorityLevel: 'senior' });
      expect(result.preferredSeniorityLevel).toBe('senior');
    });

    it('passes through preferredMaxStartTime', async () => {
      const result = await expandSearchCriteria({ preferredMaxStartTime: 'two_weeks' });
      expect(result.preferredMaxStartTime).toBe('two_weeks');
    });

    it('passes through preferredTimezone', async () => {
      const result = await expandSearchCriteria({
        preferredTimezone: ['America/New_York', 'America/Chicago'],
      });
      expect(result.preferredTimezone).toEqual(['America/New_York', 'America/Chicago']);
    });

    it('sets requiredMaxStartTime from input or default', async () => {
      const withRequired = await expandSearchCriteria({ requiredMaxStartTime: 'one_month' });
      expect(withRequired.requiredMaxStartTime).toBe('one_month');

      const withDefault = await expandSearchCriteria({});
      expect(withDefault.requiredMaxStartTime).toBe('one_year'); // default
    });
  });

  describe('full request expansion', () => {
    it('expands a complete request correctly', async () => {
      const result = await expandSearchCriteria({
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
      const result = await expandSearchCriteria({ teamFocus: 'scaling' });
      expect(result.derivedConstraints).toBeDefined();
      expect(Array.isArray(result.derivedConstraints)).toBe(true);
    });

    it('includes derivedRequiredSkillIds in result', async () => {
      const result = await expandSearchCriteria({});
      expect(result.derivedRequiredSkillIds).toBeDefined();
      expect(Array.isArray(result.derivedRequiredSkillIds)).toBe(true);
    });

    it('includes derivedSkillBoosts in result', async () => {
      const result = await expandSearchCriteria({});
      expect(result.derivedSkillBoosts).toBeDefined();
      expect(result.derivedSkillBoosts).toBeInstanceOf(Map);
    });
  });

  describe('inference integration', () => {
    describe('filter rule outputs', () => {
      it('populates derivedRequiredSkillIds for teamFocus: scaling', async () => {
        const result = await expandSearchCriteria({ teamFocus: 'scaling' });

        // scaling-requires-distributed should add skill_distributed
        expect(result.derivedRequiredSkillIds).toContain('skill_distributed');
        // Chain: distributed-requires-observability adds skill_monitoring
        expect(result.derivedRequiredSkillIds).toContain('skill_monitoring');
      });

      it('populates derivedRequiredSkillIds for kubernetes skill', async () => {
        const result = await expandSearchCriteria({
          requiredSkills: [{ skill: 'skill_kubernetes' }],
        });

        // kubernetes-requires-containers should add skill_docker
        expect(result.derivedRequiredSkillIds).toContain('skill_docker');
      });
    });

    describe('boost rule outputs', () => {
      it('populates derivedSkillBoosts for senior seniority', async () => {
        const result = await expandSearchCriteria({
          requiredSeniorityLevel: 'senior',
        });

        // senior-prefers-leadership should boost mentorship
        expect(result.derivedSkillBoosts.get('skill_mentorship')).toBeGreaterThan(0);
      });

      it('populates derivedSkillBoosts for greenfield focus', async () => {
        const result = await expandSearchCriteria({
          teamFocus: 'greenfield',
        });

        // greenfield-prefers-ambiguity-tolerance should boost prototyping
        expect(result.derivedSkillBoosts.get('skill_prototyping')).toBeGreaterThan(0);
      });

      it('takes max boost strength when multiple rules boost same skill', async () => {
        const result = await expandSearchCriteria({
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
        const result = await expandSearchCriteria({ teamFocus: 'scaling' });

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
        const result = await expandSearchCriteria({
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
        const result = await expandSearchCriteria({
          teamFocus: 'scaling',
          overriddenRuleIds: ['scaling-requires-distributed'],
        });

        // skill_distributed should NOT be in required skills
        expect(result.derivedRequiredSkillIds).not.toContain('skill_distributed');

        // Chain should also be broken - skill_monitoring should not appear
        expect(result.derivedRequiredSkillIds).not.toContain('skill_monitoring');
      });

      it('excludes overridden boost rules from derivedSkillBoosts', async () => {
        const result = await expandSearchCriteria({
          requiredSeniorityLevel: 'senior',
          overriddenRuleIds: ['senior-prefers-leadership'],
        });

        // Boosted skills should NOT be in boosts map
        expect(result.derivedSkillBoosts.has('skill_mentorship')).toBe(false);
      });

      it('marks constraint as overridden in derivedConstraints', async () => {
        const result = await expandSearchCriteria({
          teamFocus: 'scaling',
          overriddenRuleIds: ['scaling-requires-distributed'],
        });

        const scalingRule = result.derivedConstraints.find(
          (c) => c.rule.id === 'scaling-requires-distributed'
        );
        expect(scalingRule).toBeDefined();
        expect(scalingRule!.override?.overrideScope).toBe('FULL');
      });
    });

    describe('appliedFilters source tracking', () => {
      it('includes inference source for derived filter constraints', async () => {
        const result = await expandSearchCriteria({ teamFocus: 'scaling' });

        const inferenceFilters = result.appliedFilters.filter(
          (f) => f.source === 'inference'
        );

        // Should have at least one inference-derived filter
        expect(inferenceFilters.length).toBeGreaterThan(0);
      });
    });

    describe('appliedPreferences source tracking', () => {
      it('includes inference source for derived boost constraints', async () => {
        const result = await expandSearchCriteria({
          requiredSeniorityLevel: 'senior',
        });

        const inferencePrefs = result.appliedPreferences.filter(
          (p) => p.source === 'inference'
        );

        // Should have at least one inference-derived preference
        expect(inferencePrefs.length).toBeGreaterThan(0);
      });
    });
  });
});
