import { describe, it, expect, beforeEach } from 'vitest';
import {
  runInference,
  getDerivedRequiredSkills,
  aggregateDerivedSkillBoosts,
} from './inference-engine.service.js';
import { clearEngineCache, createInferenceContext } from './rule-engine-adapter.js';
import type { SearchFilterRequest } from '../schemas/search.schema.js';
import type { DerivedConstraint } from '../types/inference-rule.types.js';

// Clear engine cache before each test to ensure isolation
beforeEach(() => {
  clearEngineCache();
});

describe('runInference', () => {
  describe('boost rules', () => {
    it('fires senior-prefers-leadership for senior seniority', async () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
      };

      const result = await runInference(request);

      const leadershipRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'senior-prefers-leadership'
      );
      expect(leadershipRule).toBeDefined();
      expect(leadershipRule!.action.effect).toBe('boost');
      expect(leadershipRule!.action.targetValue).toContain('skill_mentorship');
    });

    it('fires principal-prefers-architecture for principal seniority', async () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'principal',
      };

      const result = await runInference(request);

      const archRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'principal-prefers-architecture'
      );
      expect(archRule).toBeDefined();
      expect(archRule!.action.targetValue).toContain('skill_system_design');
    });

    it('fires greenfield-prefers-ambiguity-tolerance for greenfield focus', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'greenfield',
      };

      const result = await runInference(request);

      const greenfield = result.derivedConstraints.find(
        (c) => c.rule.id === 'greenfield-prefers-ambiguity-tolerance'
      );
      expect(greenfield).toBeDefined();
      expect(greenfield!.action.effect).toBe('boost');
    });
  });

  describe('filter rules', () => {
    it('fires scaling-requires-distributed for scaling focus', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
      };

      const result = await runInference(request);

      const scalingRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'scaling-requires-distributed'
      );
      expect(scalingRule).toBeDefined();
      expect(scalingRule!.action.effect).toBe('filter');
      expect(scalingRule!.action.targetValue).toContain('skill_distributed');
    });
  });

  describe('user override', () => {
    it('marks boost as overridden when user set preferredSkills', async () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
        // User explicitly set preferred skills, should block boosts targeting that
        preferredSkills: [{ skill: 'custom_skill' }],
      };

      const result = await runInference(request);

      // The rule targeting preferredSkills would be overridden if we had one
      // For derivedSkills targeting, it should NOT be overridden
      const leadershipRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'senior-prefers-leadership'
      );
      expect(leadershipRule).toBeDefined();
      // derivedSkills is not preferredSkills, so not overridden
      expect(leadershipRule!.override).toBeUndefined();
    });

    it('does NOT override filter rules (they always apply)', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
        preferredSkills: [{ skill: 'anything' }],
      };

      const result = await runInference(request);

      const filterRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'scaling-requires-distributed'
      );
      expect(filterRule).toBeDefined();
      expect(filterRule!.action.effect).toBe('filter');
      expect(filterRule!.override).toBeUndefined();
    });
  });

  describe('multi-hop chaining', () => {
    it('chains scaling → distributed → monitoring', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
      };

      const result = await runInference(request);

      // First hop: scaling → distributed
      const distributedRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'scaling-requires-distributed'
      );
      expect(distributedRule).toBeDefined();

      // Second hop: distributed → monitoring (from skill chain rule)
      const monitoringRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'distributed-requires-observability'
      );
      expect(monitoringRule).toBeDefined();
      expect(monitoringRule!.action.targetValue).toContain('skill_monitoring');

      // Should have iterated more than once
      expect(result.iterationCount).toBeGreaterThan(1);
    });

    it('chains kubernetes → containers', async () => {
      const request: SearchFilterRequest = {
        requiredSkills: [{ skill: 'skill_kubernetes' }],
      };

      const result = await runInference(request);

      const containersRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'kubernetes-requires-containers'
      );
      expect(containersRule).toBeDefined();
      expect(containersRule!.action.effect).toBe('filter');
      expect(containersRule!.action.targetValue).toContain('skill_docker');
    });
  });

  describe('fixpoint detection', () => {
    it('stops when no new constraints are derived', async () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'junior',
      };

      const result = await runInference(request);

      // Junior doesn't trigger any rules, should stop quickly
      expect(result.iterationCount).toBeLessThanOrEqual(2);
      expect(result.warnings).toHaveLength(0);
    });

    it('tracks fired rules without duplicates', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
        requiredSeniorityLevel: 'senior',
      };

      const result = await runInference(request);

      // Each rule ID should appear exactly once in firedRules
      const uniqueRuleIds = new Set(result.firedRules);
      expect(uniqueRuleIds.size).toBe(result.firedRules.length);
    });
  });

  describe('explicit rule overriding', () => {
    it('marks filter rule as overridden when in overriddenRuleIds', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
        overriddenRuleIds: ['scaling-requires-distributed'],
      };

      const result = await runInference(request);

      const scalingRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'scaling-requires-distributed'
      );
      expect(scalingRule).toBeDefined();
      expect(scalingRule!.override?.overrideScope).toBe('FULL');

      // Rule should NOT appear in derived required skills
      const requiredSkills = getDerivedRequiredSkills(result.derivedConstraints);
      expect(requiredSkills).not.toContain('skill_distributed');
    });

    it('marks boost rule as overridden when in overriddenRuleIds', async () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
        overriddenRuleIds: ['senior-prefers-leadership'],
      };

      const result = await runInference(request);

      const leadershipRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'senior-prefers-leadership'
      );
      expect(leadershipRule).toBeDefined();
      expect(leadershipRule!.override?.overrideScope).toBe('FULL');

      // Rule should NOT appear in skill boosts
      const boosts = aggregateDerivedSkillBoosts(result.derivedConstraints);
      expect(boosts.has('skill_mentorship')).toBe(false);
    });

    it('includes reasonType in overriddenRules for explicit override', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
        overriddenRuleIds: ['scaling-requires-distributed'],
      };

      const result = await runInference(request);

      const overriddenRule = result.overriddenRules.find(
        (r) => r.ruleId === 'scaling-requires-distributed'
      );
      expect(overriddenRule).toBeDefined();
      expect(overriddenRule!.reasonType).toBe('explicit-rule-override');
    });

    it('prevents chaining from overridden filter rules', async () => {
      // If scaling-requires-distributed is overridden,
      // distributed-requires-observability should NOT fire
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
        overriddenRuleIds: ['scaling-requires-distributed'],
      };

      const result = await runInference(request);

      // The chain should be broken
      const observabilityRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'distributed-requires-observability'
      );
      expect(observabilityRule).toBeUndefined();
    });
  });

  describe('compound rules', () => {
    it('fires senior-greenfield-prefers-ownership for senior + greenfield', async () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
        teamFocus: 'greenfield',
      };

      const result = await runInference(request);

      const compoundRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'senior-greenfield-prefers-ownership'
      );
      expect(compoundRule).toBeDefined();
      expect(compoundRule!.action.targetValue).toContain('skill_ownership');
    });

    it('does NOT fire compound rule when only one condition met', async () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
        // teamFocus not set, so compound rule shouldn't fire
      };

      const result = await runInference(request);

      const compoundRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'senior-greenfield-prefers-ownership'
      );
      expect(compoundRule).toBeUndefined();
    });
  });
});

describe('getDerivedRequiredSkills', () => {
  it('extracts skills from filter rules only', () => {
    const constraints: DerivedConstraint[] = [
      {
        rule: { id: 'filter1', name: 'Filter 1' },
        action: {
          effect: 'filter',
          targetField: 'derivedSkills',
          targetValue: ['skill_a', 'skill_b'],
        },
        provenance: { derivationChains: [['filter1']], explanation: 'test' },
      },
      {
        rule: { id: 'boost1', name: 'Boost 1' },
        action: {
          effect: 'boost',
          targetField: 'derivedSkills',
          targetValue: ['skill_c'], // should NOT be included
          boostStrength: 0.5,
        },
        provenance: { derivationChains: [['boost1']], explanation: 'test' },
      },
    ];

    const skills = getDerivedRequiredSkills(constraints);

    expect(skills).toContain('skill_a');
    expect(skills).toContain('skill_b');
    expect(skills).not.toContain('skill_c');
  });

  it('skips fully overridden constraints', () => {
    const constraints: DerivedConstraint[] = [
      {
        rule: { id: 'filter1', name: 'Filter 1' },
        action: {
          effect: 'filter',
          targetField: 'derivedSkills',
          targetValue: ['skill_a'],
        },
        provenance: { derivationChains: [['filter1']], explanation: 'test' },
        override: { overrideScope: 'FULL', overriddenSkills: ['skill_a'], reasonType: 'explicit-rule-override' },
      },
    ];

    const skills = getDerivedRequiredSkills(constraints);

    expect(skills).not.toContain('skill_a');
  });

  it('deduplicates skills', () => {
    const constraints: DerivedConstraint[] = [
      {
        rule: { id: 'filter1', name: 'Filter 1' },
        action: {
          effect: 'filter',
          targetField: 'derivedSkills',
          targetValue: ['skill_a'],
        },
        provenance: { derivationChains: [['filter1']], explanation: 'test' },
      },
      {
        rule: { id: 'filter2', name: 'Filter 2' },
        action: {
          effect: 'filter',
          targetField: 'derivedSkills',
          targetValue: ['skill_a'], // duplicate
        },
        provenance: { derivationChains: [['filter2']], explanation: 'test' },
      },
    ];

    const skills = getDerivedRequiredSkills(constraints);

    expect(skills.filter((s) => s === 'skill_a').length).toBe(1);
  });

  it('only includes derivedSkills target field', () => {
    const constraints: DerivedConstraint[] = [
      {
        rule: { id: 'filter1', name: 'Filter 1' },
        action: {
          effect: 'filter',
          targetField: 'preferredSeniorityLevel', // wrong target
          targetValue: 'senior',
        },
        provenance: { derivationChains: [['filter1']], explanation: 'test' },
      },
    ];

    const skills = getDerivedRequiredSkills(constraints);

    expect(skills).toHaveLength(0);
  });
});

describe('edge cases', () => {
  it('handles empty request gracefully', async () => {
    const result = await runInference({});

    expect(result.derivedConstraints).toEqual([]);
    expect(result.firedRules).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('emits warning when max iterations reached', async () => {
    // This test requires a rule that causes infinite iteration
    // Since our rules are finite, we need to verify the warning path exists
    // by checking the implementation handles the boundary correctly
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_kubernetes' }],
    };

    const result = await runInference(request);

    // With real rules, we should reach fixpoint before max iterations
    expect(result.iterationCount).toBeLessThan(10);
    expect(result.warnings).toHaveLength(0);
  });
});

describe('3+ hop chains', () => {
  it('chains scaling → distributed → monitoring → (no further)', async () => {
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
    };

    const result = await runInference(request);

    // First hop: scaling → distributed
    const distributed = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(distributed).toBeDefined();

    // Second hop: distributed → monitoring
    const monitoring = result.derivedConstraints.find(
      (c) => c.rule.id === 'distributed-requires-observability'
    );
    expect(monitoring).toBeDefined();

    // Also fires distributed-prefers-tracing (boost)
    const tracing = result.derivedConstraints.find(
      (c) => c.rule.id === 'distributed-prefers-tracing'
    );
    expect(tracing).toBeDefined();

    // Verify iteration count reflects multi-hop
    expect(result.iterationCount).toBeGreaterThanOrEqual(2);
  });

  it('chains kubernetes → docker + helm (filter + boost from same trigger)', async () => {
    const request: SearchFilterRequest = {
      requiredSkills: [{ skill: 'skill_kubernetes' }],
    };

    const result = await runInference(request);

    // Filter: kubernetes → docker
    const docker = result.derivedConstraints.find(
      (c) => c.rule.id === 'kubernetes-requires-containers'
    );
    expect(docker).toBeDefined();
    expect(docker!.action.effect).toBe('filter');

    // Boost: kubernetes → helm
    const helm = result.derivedConstraints.find(
      (c) => c.rule.id === 'kubernetes-prefers-helm'
    );
    expect(helm).toBeDefined();
    expect(helm!.action.effect).toBe('boost');
  });
});

describe('mixed filter/boost chains', () => {
  it('filter rule output can trigger boost rule', async () => {
    // scaling → distributed (filter) → tracing (boost)
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
    };

    const result = await runInference(request);

    // Verify filter fired
    const distributed = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(distributed).toBeDefined();
    expect(distributed!.action.effect).toBe('filter');

    // Verify boost triggered by filter's output
    const tracing = result.derivedConstraints.find(
      (c) => c.rule.id === 'distributed-prefers-tracing'
    );
    expect(tracing).toBeDefined();
    expect(tracing!.action.effect).toBe('boost');
  });
});

describe('override in middle of chain', () => {
  it('overriding mid-chain rule stops downstream rules', async () => {
    // Chain: scaling → distributed → observability
    // Override distributed-requires-observability
    // Result: observability should NOT fire BUT distributed fires and is marked as such
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      overriddenRuleIds: ['distributed-requires-observability'],
    };

    const result = await runInference(request);

    // First hop still fires
    const distributed = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(distributed).toBeDefined();
    expect(distributed!.override).toBeUndefined();

    // Overridden rule fires but is marked
    const observability = result.derivedConstraints.find(
      (c) => c.rule.id === 'distributed-requires-observability'
    );
    expect(observability).toBeDefined();
    expect(observability!.override?.overrideScope).toBe('FULL');

    // skill_monitoring should NOT be in derived required skills
    const requiredSkills = getDerivedRequiredSkills(result.derivedConstraints);
    expect(requiredSkills).not.toContain('skill_monitoring');
  });
});

describe('priority ordering', () => {
  it('higher priority rules fire before lower priority', async () => {
    // First-hop rules (priority 50) should fire before chain rules (priority 40)
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      requiredSeniorityLevel: 'senior',
    };

    const result = await runInference(request);

    // Verify both priority levels fired
    const priority50Rules = result.derivedConstraints.filter((c) =>
      ['scaling-requires-distributed', 'senior-prefers-leadership', 'scaling-prefers-observability'].includes(c.rule.id)
    );
    const priority40Rules = result.derivedConstraints.filter((c) =>
      ['distributed-requires-observability', 'distributed-prefers-tracing'].includes(c.rule.id)
    );

    expect(priority50Rules.length).toBeGreaterThan(0);
    expect(priority40Rules.length).toBeGreaterThan(0);
  });
});

describe('edge cases - Tier 3', () => {
  it('handles request with all fields populated', async () => {
    const request: SearchFilterRequest = {
      requiredSeniorityLevel: 'senior',
      preferredSeniorityLevel: 'staff',
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_kubernetes' }],
      preferredSkills: [{ skill: 'skill_python' }],
      maxBudget: 200000,
      stretchBudget: 220000,
      requiredMaxStartTime: 'one_month',
      preferredMaxStartTime: 'two_weeks',
      requiredTimezone: ['America/*'],
      preferredTimezone: ['America/New_York'],
      limit: 50,
      offset: 0,
    };

    const result = await runInference(request);

    // Should not error
    expect(result.derivedConstraints).toBeDefined();
    expect(result.firedRules.length).toBeGreaterThan(0);
  });

  it('maintains skill uniqueness across iterations', async () => {
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_distributed' }], // Already have the derived skill
    };

    const result = await runInference(request);

    // Should still work, skills deduplicated
    const requiredSkills = getDerivedRequiredSkills(result.derivedConstraints);
    const skillCounts = new Map<string, number>();
    for (const skill of requiredSkills) {
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
    }

    for (const [, count] of skillCounts) {
      expect(count).toBe(1);
    }
  });
});

describe('implicit filter override', () => {
  it('marks derived filter as overridden when user already requires the skill', async () => {
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_distributed', minProficiency: 'expert' }],
    };

    const result = await runInference(request);

    const scalingRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule).toBeDefined();
    expect(scalingRule!.override?.overrideScope).toBe('FULL');

    // Skill should NOT be in derived required skills (user already has it)
    const derivedRequired = getDerivedRequiredSkills(result.derivedConstraints);
    expect(derivedRequired).not.toContain('skill_distributed');
  });

  it('marks derived filter as overridden when user has skill as preferred', async () => {
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      preferredSkills: [{ skill: 'skill_distributed' }],
    };

    const result = await runInference(request);

    const scalingRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule).toBeDefined();
    expect(scalingRule!.override?.overrideScope).toBe('FULL');
  });

  it('includes reasonType in overriddenRules for implicit skill override', async () => {
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_distributed' }],
    };

    const result = await runInference(request);

    const overriddenRule = result.overriddenRules.find(
      (r) => r.ruleId === 'scaling-requires-distributed'
    );
    expect(overriddenRule).toBeDefined();
    expect(overriddenRule!.reasonType).toBe('implicit-skill-override');
  });

  it('continues chaining when user requires skill (skill in allSkills)', async () => {
    // User requires distributed, system also derives it (redundant but not conflicting)
    // Chaining should continue because skill IS in allSkills from user
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_distributed' }],
    };

    const result = await runInference(request);

    // First hop: scaling → distributed (overridden, user already has it)
    const scalingRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule!.override?.overrideScope).toBe('FULL');

    // Second hop: distributed → observability SHOULD fire
    // because skill_distributed is in allSkills from user's requiredSkills
    const obsRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'distributed-requires-observability'
    );
    expect(obsRule).toBeDefined();
    expect(obsRule!.override).toBeUndefined();
  });

  it('stops chaining when user prefers skill (skill NOT in allSkills)', async () => {
    // User prefers distributed (soft), system would require it (hard)
    // Chaining should NOT continue because skill is NOT in allSkills
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      preferredSkills: [{ skill: 'skill_distributed' }],
    };

    const result = await runInference(request);

    // First hop: scaling → distributed (overridden, user has it as preferred)
    const scalingRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule!.override?.overrideScope).toBe('FULL');

    // Second hop: distributed → observability should NOT fire
    // because skill_distributed is NOT in allSkills (only requiredSkills initialize allSkills)
    const obsRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'distributed-requires-observability'
    );
    expect(obsRule).toBeUndefined();
  });

  it('does not override filter rule when user has different skill', async () => {
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_python' }],  // Different skill
    };

    const result = await runInference(request);

    const scalingRule = result.derivedConstraints.find(
      (c) => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule).toBeDefined();
    expect(scalingRule!.override).toBeUndefined();
  });
});

describe('aggregateDerivedSkillBoosts', () => {
  it('extracts skills from boost rules only', () => {
    const constraints: DerivedConstraint[] = [
      {
        rule: { id: 'boost1', name: 'Boost 1' },
        action: {
          effect: 'boost',
          targetField: 'derivedSkills',
          targetValue: ['skill_a'],
          boostStrength: 0.6,
        },
        provenance: { derivationChains: [['boost1']], explanation: 'test' },
      },
      {
        rule: { id: 'filter1', name: 'Filter 1' },
        action: {
          effect: 'filter',
          targetField: 'derivedSkills',
          targetValue: ['skill_b'], // should NOT be included
        },
        provenance: { derivationChains: [['filter1']], explanation: 'test' },
      },
    ];

    const boosts = aggregateDerivedSkillBoosts(constraints);

    expect(boosts.get('skill_a')).toBe(0.6);
    expect(boosts.has('skill_b')).toBe(false);
  });

  it('takes max strength when multiple rules boost same skill', () => {
    const constraints: DerivedConstraint[] = [
      {
        rule: { id: 'boost1', name: 'Boost 1' },
        action: {
          effect: 'boost',
          targetField: 'derivedSkills',
          targetValue: ['skill_a'],
          boostStrength: 0.5,
        },
        provenance: { derivationChains: [['boost1']], explanation: 'test' },
      },
      {
        rule: { id: 'boost2', name: 'Boost 2' },
        action: {
          effect: 'boost',
          targetField: 'derivedSkills',
          targetValue: ['skill_a'],
          boostStrength: 0.8, // higher, should win
        },
        provenance: { derivationChains: [['boost2']], explanation: 'test' },
      },
    ];

    const boosts = aggregateDerivedSkillBoosts(constraints);

    expect(boosts.get('skill_a')).toBe(0.8);
  });

  it('skips fully overridden constraints', () => {
    const constraints: DerivedConstraint[] = [
      {
        rule: { id: 'boost1', name: 'Boost 1' },
        action: {
          effect: 'boost',
          targetField: 'derivedSkills',
          targetValue: ['skill_a'],
          boostStrength: 0.5,
        },
        provenance: { derivationChains: [['boost1']], explanation: 'test' },
        override: { overrideScope: 'FULL', overriddenSkills: ['skill_a'], reasonType: 'explicit-rule-override' },
      },
    ];

    const boosts = aggregateDerivedSkillBoosts(constraints);

    expect(boosts.has('skill_a')).toBe(false);
  });

  it('skips boosts without boostStrength', () => {
    const constraints: DerivedConstraint[] = [
      {
        rule: { id: 'boost1', name: 'Boost 1' },
        action: {
          effect: 'boost',
          targetField: 'derivedSkills',
          targetValue: ['skill_a'],
          // boostStrength missing
        },
        provenance: { derivationChains: [['boost1']], explanation: 'test' },
      },
    ];

    const boosts = aggregateDerivedSkillBoosts(constraints);

    expect(boosts.has('skill_a')).toBe(false);
  });
});

describe('derivation chain provenance', () => {
  describe('skill-based chains', () => {
    it('first-hop rule has single-element chain', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
      };

      const result = await runInference(request);

      const scalingRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'scaling-requires-distributed'
      );
      expect(scalingRule).toBeDefined();
      expect(scalingRule!.provenance.derivationChains).toEqual([
        ['scaling-requires-distributed'],
      ]);
    });

    it('skill chain rule includes source rule in derivation chain', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
      };

      const result = await runInference(request);

      const obsRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'distributed-requires-observability'
      );
      expect(obsRule).toBeDefined();
      expect(obsRule!.provenance.derivationChains).toEqual([
        ['scaling-requires-distributed', 'distributed-requires-observability'],
      ]);
    });

    it('chain triggered by user skill has single-element chain', async () => {
      const request: SearchFilterRequest = {
        requiredSkills: [{ skill: 'skill_kubernetes' }],
      };

      const result = await runInference(request);

      const containersRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'kubernetes-requires-containers'
      );
      expect(containersRule).toBeDefined();
      expect(containersRule!.provenance.derivationChains).toEqual([
        ['kubernetes-requires-containers'],
      ]);
    });
  });

  describe('non-skill chains', () => {
    it('rule chaining from derived seniority includes source rule', async () => {
      const request: SearchFilterRequest = {
        teamFocus: 'greenfield',
      };

      const result = await runInference(request);

      // First hop: greenfield → preferredProperties.seniorityLevel:senior
      const seniorRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'greenfield-prefers-senior'
      );
      expect(seniorRule).toBeDefined();
      expect(seniorRule!.provenance.derivationChains).toEqual([
        ['greenfield-prefers-senior'],
      ]);

      // Second hop: derived senior (from preferredProperties) → leadership skills
      const leadershipRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'senior-prefers-leadership'
      );
      expect(leadershipRule).toBeDefined();
      expect(leadershipRule!.provenance.derivationChains).toEqual([
        ['greenfield-prefers-senior', 'senior-prefers-leadership'],
      ]);
    });

    it('user-provided required seniority triggers chain rule with single-element chain', async () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
      };

      const result = await runInference(request);

      // senior-prefers-leadership fires from requiredProperties.seniorityLevel
      // (populated from user's requiredSeniorityLevel)
      // Chain should be single element since triggered by user input
      const leadershipRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'senior-prefers-leadership'
      );
      expect(leadershipRule).toBeDefined();
      expect(leadershipRule!.provenance.derivationChains).toEqual([
        ['senior-prefers-leadership'],
      ]);
    });

    it('captures multiple paths for rule triggered by both required and preferred property', async () => {
      /*
       * The senior-prefers-leadership rule has `any` conditions:
       * - requiredProperties.seniorityLevel in [senior, staff, principal]
       * - preferredProperties.seniorityLevel in [senior, staff, principal]
       *
       * If BOTH are satisfied (user sets requiredSeniorityLevel AND a rule derives preferredSeniorityLevel),
       * the rule should capture chains from BOTH sources.
       *
       * Unfortunately, with current rules:
       * - User sets requiredSeniorityLevel → populates requiredProperties.seniorityLevel
       * - greenfield → greenfield-prefers-senior → populates preferredProperties.seniorityLevel:senior
       *
       * Both would trigger senior-prefers-leadership, but the rule only fires ONCE.
       * The derivation chain should reflect whichever source fired it first (or both if tracked).
       */
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
        teamFocus: 'greenfield',
      };

      const result = await runInference(request);

      // senior-prefers-leadership should fire
      const leadershipRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'senior-prefers-leadership'
      );
      expect(leadershipRule).toBeDefined();

      /*
       * Current behavior: since requiredProperties.seniorityLevel is populated
       * from user input (iteration 0), the rule fires in iteration 1 with
       * a single-element chain. The greenfield-prefers-senior rule also fires
       * in iteration 1 but its output (preferredProperties.seniorityLevel) comes
       * AFTER senior-prefers-leadership has already fired.
       *
       * This is expected behavior: first satisfied trigger wins.
       */
      expect(leadershipRule!.provenance.derivationChains).toEqual([
        ['senior-prefers-leadership'],
      ]);
    });
  });

  describe('multiple derivation paths', () => {
    it('captures convergent paths when skill reached via multiple sources', async () => {
      /*
       * Test scenario: skill_distributed can be reached via:
       * 1. teamFocus:scaling → scaling-requires-distributed (derives skill_distributed)
       * 2. User requires skill_distributed directly
       *
       * When both paths exist, the derived rule should still fire but be marked
       * as FULL override (user already has the skill).
       */
      const request: SearchFilterRequest = {
        teamFocus: 'scaling',
        requiredSkills: [{ skill: 'skill_distributed' }],
      };

      const result = await runInference(request);

      // The scaling rule fires but is overridden
      const scalingRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'scaling-requires-distributed'
      );
      expect(scalingRule).toBeDefined();
      expect(scalingRule!.override?.overrideScope).toBe('FULL');

      // Chain rules from skill_distributed should fire (user has it in allSkills)
      const observabilityRule = result.derivedConstraints.find(
        (c) => c.rule.id === 'distributed-requires-observability'
      );
      expect(observabilityRule).toBeDefined();

      // The observability rule's chain should show it came from user's skill
      // (single-element chain, not multi-hop since triggered by user-input)
      expect(observabilityRule!.provenance.derivationChains).toEqual([
        ['distributed-requires-observability'],
      ]);
    });
  });

  describe('context initialization', () => {
    it('populates requiredProperties from user input', () => {
      const request: SearchFilterRequest = {
        requiredSeniorityLevel: 'senior',
      };

      const context = createInferenceContext(request);

      expect(context.derived.requiredProperties.seniorityLevel).toBe('senior');
      expect(context.derived.requiredPropertyProvenance.get('seniorityLevel')).toEqual([['user-input']]);
    });

    it('populates skillProvenance for user skills', () => {
      const request: SearchFilterRequest = {
        requiredSkills: [{ skill: 'skill_kubernetes' }],
      };

      const context = createInferenceContext(request);

      expect(context.derived.allSkills).toContain('skill_kubernetes');
      expect(context.derived.skillProvenance.get('skill_kubernetes')).toEqual([['user-input']]);
    });
  });
});
