import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEngine,
  createInferenceContext,
  eventToDerivedConstraint,
  mergeDerivedSkillsIntoInferenceContext,
  computeContextHash,
  clearEngineCache,
  extractDerivedTriggers,
  buildDerivationChains,
} from './rule-engine-adapter.js';
import type { SearchFilterRequest } from '../schemas/search.schema.js';
import type { InferenceRuleDefinition, InferenceContext } from '../types/rule-engine.types.js';
import type { DerivedConstraint } from '../types/inference-rule.types.js';

/**
 * Helper to create a minimal mock InferenceContext for tests.
 * Provides defaults for all required fields.
 */
function createMockContext(overrides: {
  skills?: string[];
  allSkills?: string[];
  requiredProperties?: Record<string, string>;
  preferredProperties?: Record<string, string>;
  userExplicitFields?: string[];
  overriddenRuleIds?: string[];
  userExplicitSkills?: string[];
} = {}): InferenceContext {
  const skills = overrides.skills ?? [];
  const allSkills = overrides.allSkills ?? [...skills];
  return {
    request: { skills } as InferenceContext['request'],
    derived: {
      allSkills,
      requiredProperties: overrides.requiredProperties ?? {},
      preferredProperties: overrides.preferredProperties ?? {},
      skillProvenance: new Map(),
      requiredPropertyProvenance: new Map(),
      preferredPropertyProvenance: new Map(),
    },
    meta: {
      userExplicitFields: overrides.userExplicitFields ?? [],
      overriddenRuleIds: overrides.overriddenRuleIds ?? [],
      userExplicitSkills: overrides.userExplicitSkills ?? [],
    },
  };
}

// Clear engine cache before each test to ensure isolation
beforeEach(() => {
  clearEngineCache();
});

describe('createInferenceContext', () => {
  it('extracts skill names from requiredSkills', () => {
    const request: SearchFilterRequest = {
      requiredSkills: [
        { skill: 'typescript' },
        { skill: 'react', minProficiency: 'proficient' },
      ],
    };

    const context = createInferenceContext(request);

    expect(context.request.skills).toEqual(['typescript', 'react']);
    expect(context.derived.allSkills).toEqual(['typescript', 'react']);
  });

  it('extracts requiredSeniorityLevel', () => {
    const request: SearchFilterRequest = {
      requiredSeniorityLevel: 'senior',
    };

    const context = createInferenceContext(request);

    expect(context.request.requiredSeniorityLevel).toBe('senior');
  });

  it('extracts teamFocus', () => {
    const request: SearchFilterRequest = {
      teamFocus: 'scaling',
    };

    const context = createInferenceContext(request);

    expect(context.request.teamFocus).toBe('scaling');
  });

  it('extracts budget constraints', () => {
    const request: SearchFilterRequest = {
      maxBudget: 200000,
      stretchBudget: 220000,
    };

    const context = createInferenceContext(request);

    expect(context.request.maxBudget).toBe(200000);
    expect(context.request.stretchBudget).toBe(220000);
  });

  it('tracks user explicit fields for override detection', () => {
    const request: SearchFilterRequest = {
      preferredSkills: [{ skill: 'python' }],
      preferredSeniorityLevel: 'staff',
      preferredMaxStartTime: 'two_weeks',
    };

    const context = createInferenceContext(request);

    expect(context.meta.userExplicitFields).toContain('preferredSkills');
    expect(context.meta.userExplicitFields).toContain('preferredSeniorityLevel');
    expect(context.meta.userExplicitFields).toContain('preferredMaxStartTime');
  });

  it('returns empty array for no required skills', () => {
    const request: SearchFilterRequest = {};

    const context = createInferenceContext(request);

    expect(context.request.skills).toEqual([]);
    expect(context.derived.allSkills).toEqual([]);
  });

  it('extracts userExplicitSkills from both requiredSkills and preferredSkills', () => {
    const request: SearchFilterRequest = {
      requiredSkills: [{ skill: 'skill_required' }],
      preferredSkills: [{ skill: 'skill_preferred' }],
    };

    const context = createInferenceContext(request);

    expect(context.meta.userExplicitSkills).toContain('skill_required');
    expect(context.meta.userExplicitSkills).toContain('skill_preferred');
  });

  it('includes only requiredSkills in allSkills (not preferredSkills)', () => {
    const request: SearchFilterRequest = {
      requiredSkills: [{ skill: 'skill_required' }],
      preferredSkills: [{ skill: 'skill_preferred' }],
    };

    const context = createInferenceContext(request);

    expect(context.derived.allSkills).toContain('skill_required');
    expect(context.derived.allSkills).not.toContain('skill_preferred');
  });
});

describe('eventToDerivedConstraint', () => {
  const mockRules: InferenceRuleDefinition[] = [
    {
      name: 'Test Filter Rule',
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'test-filter',
          targetField: 'derivedSkills',
          targetValue: ['skill_test'],
          rationale: 'Test rationale',
        },
      },
      conditions: { all: [] },
    },
    {
      name: 'Test Boost Rule',
      event: {
        type: 'derived-boost',
        params: {
          ruleId: 'test-boost',
          targetField: 'derivedSkills',
          targetValue: ['skill_boost'],
          boostStrength: 0.5,
          rationale: 'Boost rationale',
        },
      },
      conditions: { all: [] },
    },
  ];

  it('creates filter constraint from derived-filter event', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-filter',
        targetField: 'derivedSkills',
        targetValue: ['skill_test'],
        rationale: 'Test rationale',
      },
    };

    const constraint = eventToDerivedConstraint(event, [], mockRules);

    expect(constraint.action.effect).toBe('filter');
    expect(constraint.rule.id).toBe('test-filter');
    expect(constraint.rule.name).toBe('Test Filter Rule');
    expect(constraint.action.targetValue).toEqual(['skill_test']);
    expect(constraint.override).toBeUndefined();
  });

  it('creates boost constraint from derived-boost event', () => {
    const event = {
      type: 'derived-boost',
      params: {
        ruleId: 'test-boost',
        targetField: 'derivedSkills',
        targetValue: ['skill_boost'],
        boostStrength: 0.5,
        rationale: 'Boost rationale',
      },
    };

    const constraint = eventToDerivedConstraint(event, [], mockRules);

    expect(constraint.action.effect).toBe('boost');
    expect(constraint.action.boostStrength).toBe(0.5);
  });

  it('marks boost as overridden when user explicitly set that field', () => {
    const event = {
      type: 'derived-boost',
      params: {
        ruleId: 'test-boost',
        targetField: 'preferredSkills',
        targetValue: ['skill_boost'],
        boostStrength: 0.5,
        rationale: 'Boost rationale',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      ['preferredSkills'], // user explicit field
      mockRules
    );

    expect(constraint.override?.overrideScope).toBe('FULL');
  });

  it('marks filter as overridden when user set the target field (defense in depth)', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-filter',
        targetField: 'derivedSkills',
        targetValue: ['skill_test'],
        rationale: 'Test rationale',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      ['derivedSkills'], // user explicitly set this field
      mockRules
    );

    // Defense in depth: protects ALL user-set fields from rules, not just for boosts
    expect(constraint.override?.overrideScope).toBe('FULL');
  });

  describe('explicit overriddenRuleIds', () => {
    it('marks filter rule as overridden when in overriddenRuleIds', () => {
      const event = {
        type: 'derived-filter',
        params: {
          ruleId: 'test-filter',
          targetField: 'derivedSkills',
          targetValue: ['skill_test'],
          rationale: 'Test rationale',
        },
      };

      const constraint = eventToDerivedConstraint(
        event,
        [], // no implicit overrides
        mockRules,
        ['test-filter'] // explicitly overridden
      );

      expect(constraint.override?.overrideScope).toBe('FULL');
      expect(constraint.action.effect).toBe('filter');
    });

    it('marks boost rule as overridden when in overriddenRuleIds', () => {
      const event = {
        type: 'derived-boost',
        params: {
          ruleId: 'test-boost',
          targetField: 'derivedSkills',
          targetValue: ['skill_boost'],
          boostStrength: 0.5,
          rationale: 'Boost rationale',
        },
      };

      const constraint = eventToDerivedConstraint(
        event,
        [],
        mockRules,
        ['test-boost']
      );

      expect(constraint.override?.overrideScope).toBe('FULL');
      expect(constraint.action.effect).toBe('boost');
    });

    it('does not mark rules as overridden when not in overriddenRuleIds', () => {
      const event = {
        type: 'derived-filter',
        params: {
          ruleId: 'test-filter',
          targetField: 'derivedSkills',
          targetValue: ['skill_test'],
          rationale: 'Test rationale',
        },
      };

      const constraint = eventToDerivedConstraint(
        event,
        [],
        mockRules,
        ['some-other-rule'] // different rule overridden
      );

      expect(constraint.override).toBeUndefined();
    });

    it('handles empty overriddenRuleIds gracefully', () => {
      const event = {
        type: 'derived-filter',
        params: {
          ruleId: 'test-filter',
          targetField: 'derivedSkills',
          targetValue: ['skill_test'],
          rationale: 'Test rationale',
        },
      };

      const constraint = eventToDerivedConstraint(
        event,
        [],
        mockRules,
        [] // empty overridden list
      );

      expect(constraint.override).toBeUndefined();
    });
  });
});

describe('mergeDerivedSkillsIntoInferenceContext', () => {
  it('adds derived skills to allSkills', () => {
    const context = createMockContext({
      skills: ['skill_typescript'],
      allSkills: ['skill_typescript'],
    });

    const constraints = [
      {
        rule: { id: 'test', name: 'Test' },
        action: {
          effect: 'filter' as const,
          targetField: 'derivedSkills' as const,
          targetValue: ['skill_react', 'skill_node'],
        },
        provenance: { derivationChains: [['test']], explanation: 'test' },
      },
    ];

    const merged = mergeDerivedSkillsIntoInferenceContext(context, constraints);

    expect(merged.derived.allSkills).toContain('skill_typescript');
    expect(merged.derived.allSkills).toContain('skill_react');
    expect(merged.derived.allSkills).toContain('skill_node');
  });

  it('skips fully overridden constraints', () => {
    const context = createMockContext();

    const constraints = [
      {
        rule: { id: 'test', name: 'Test' },
        action: {
          effect: 'boost' as const,
          targetField: 'derivedSkills' as const,
          targetValue: ['skill_should_skip'],
        },
        provenance: { derivationChains: [['test']], explanation: 'test' },
        override: { overrideScope: 'FULL' as const, overriddenSkills: ['skill_should_skip'], reasonType: 'explicit-rule-override' as const },
      },
    ];

    const merged = mergeDerivedSkillsIntoInferenceContext(context, constraints);

    expect(merged.derived.allSkills).not.toContain('skill_should_skip');
  });

  it('deduplicates skills', () => {
    const context = createMockContext({
      skills: ['skill_typescript'],
      allSkills: ['skill_typescript'],
    });

    const constraints = [
      {
        rule: { id: 'test', name: 'Test' },
        action: {
          effect: 'filter' as const,
          targetField: 'derivedSkills' as const,
          targetValue: ['skill_typescript'], // duplicate
        },
        provenance: { derivationChains: [['test']], explanation: 'test' },
      },
    ];

    const merged = mergeDerivedSkillsIntoInferenceContext(context, constraints);

    const typescriptCount = merged.derived.allSkills.filter(
      (s) => s === 'skill_typescript'
    ).length;
    expect(typescriptCount).toBe(1);
  });
});

describe('computeContextHash', () => {
  it('produces same hash for same skills regardless of order', () => {
    const context1 = createMockContext({ allSkills: ['skill_a', 'skill_b', 'skill_c'] });
    const context2 = createMockContext({ allSkills: ['skill_c', 'skill_a', 'skill_b'] });

    expect(computeContextHash(context1)).toBe(computeContextHash(context2));
  });

  it('produces different hash for different skills', () => {
    const context1 = createMockContext({ allSkills: ['skill_a'] });
    const context2 = createMockContext({ allSkills: ['skill_b'] });

    expect(computeContextHash(context1)).not.toBe(computeContextHash(context2));
  });
});

describe('createInferenceContext edge cases', () => {
  it('extracts overriddenRuleIds to meta.overriddenRuleIds', () => {
    const request: SearchFilterRequest = {
      overriddenRuleIds: ['rule-a', 'rule-b'],
    };

    const context = createInferenceContext(request);

    expect(context.meta.overriddenRuleIds).toEqual(['rule-a', 'rule-b']);
  });

  it('handles empty preferredSkills array (NOT in userExplicitFields)', () => {
    const request: SearchFilterRequest = {
      preferredSkills: [],
    };

    const context = createInferenceContext(request);

    // Empty array should not be considered "user explicit"
    expect(context.meta.userExplicitFields).not.toContain('preferredSkills');
  });

  it('handles undefined preferredSkills', () => {
    const request: SearchFilterRequest = {};

    const context = createInferenceContext(request);

    expect(context.meta.userExplicitFields).not.toContain('preferredSkills');
    expect(context.request.skills).toEqual([]);
  });

  it('spreads all request fields to request fact', () => {
    const request: SearchFilterRequest = {
      requiredSeniorityLevel: 'senior',
      teamFocus: 'scaling',
      maxBudget: 200000,
      requiredTimezone: ['Eastern'],
      limit: 50,
    };

    const context = createInferenceContext(request);

    expect(context.request.requiredSeniorityLevel).toBe('senior');
    expect(context.request.teamFocus).toBe('scaling');
    expect(context.request.maxBudget).toBe(200000);
    expect(context.request.requiredTimezone).toEqual(['Eastern']);
    expect(context.request.limit).toBe(50);
  });
});

describe('eventToDerivedConstraint edge cases', () => {
  it('handles unknown event type gracefully', () => {
    const event = {
      type: 'unknown-type',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_test'],
        rationale: 'Test',
      },
    };

    // Should still create constraint, effect will be derived from type
    const constraint = eventToDerivedConstraint(event, [], []);

    expect(constraint.rule.id).toBe('test-rule');
    // Unknown type defaults to 'boost' (since it's not 'derived-filter')
    expect(constraint.action.effect).toBe('boost');
  });

  it('uses ruleId as fallback name when rule not found', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'nonexistent-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_test'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(event, [], []); // Empty rules array

    expect(constraint.rule.id).toBe('nonexistent-rule');
    expect(constraint.rule.name).toBe('nonexistent-rule'); // Falls back to ID
  });

  it('handles targetValue as single string', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: 'single_skill', // Not an array
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(event, [], []);

    expect(constraint.action.targetValue).toBe('single_skill');
  });
});

describe('mergeDerivedSkillsIntoInferenceContext edge cases', () => {
  it('ignores non-derivedSkills targetField', () => {
    const context = createMockContext();

    const constraints = [
      {
        rule: { id: 'test', name: 'Test' },
        action: {
          effect: 'boost' as const,
          targetField: 'preferredSeniorityLevel' as const, // Not derivedSkills
          targetValue: 'senior',
        },
        provenance: { derivationChains: [['test']], explanation: 'test' },
      },
    ];

    const merged = mergeDerivedSkillsIntoInferenceContext(context, constraints);

    expect(merged.derived.allSkills).toEqual([]);
  });

  it('returns new context object (immutability)', () => {
    const context = createMockContext({
      skills: ['skill_a'],
      allSkills: ['skill_a'],
    });

    const constraints = [
      {
        rule: { id: 'test', name: 'Test' },
        action: {
          effect: 'filter' as const,
          targetField: 'derivedSkills' as const,
          targetValue: ['skill_b'],
        },
        provenance: { derivationChains: [['test']], explanation: 'test' },
      },
    ];

    const merged = mergeDerivedSkillsIntoInferenceContext(context, constraints);

    // Original context unchanged
    expect(context.derived.allSkills).toEqual(['skill_a']);
    // Merged context has new skills
    expect(merged.derived.allSkills).toContain('skill_b');
    // Different object reference
    expect(merged).not.toBe(context);
  });
});

describe('mergeDerivedValuesIntoContext property handling', () => {
  it('routes boost rule preferredSeniorityLevel to preferredProperties', () => {
    const context = createMockContext();

    const constraints: DerivedConstraint[] = [
      {
        rule: { id: 'greenfield-prefers-senior', name: 'Test' },
        action: {
          effect: 'boost' as const,
          targetField: 'preferredSeniorityLevel' as const,
          targetValue: 'senior',
          boostStrength: 0.4,
        },
        provenance: { derivationChains: [['greenfield-prefers-senior']], explanation: 'test' },
      },
    ];

    const merged = mergeDerivedSkillsIntoInferenceContext(context, constraints);

    expect(merged.derived.preferredProperties.seniorityLevel).toBe('senior');
    // Should NOT be in requiredProperties (boost rule → preferred)
    expect(merged.derived.requiredProperties.seniorityLevel).toBeUndefined();
  });

  it('routes filter rule preferredX to requiredProperties', () => {
    const context = createMockContext();

    const constraints: DerivedConstraint[] = [
      {
        rule: { id: 'test-filter', name: 'Test' },
        action: {
          effect: 'filter' as const,
          targetField: 'preferredSeniorityLevel' as const,  // Unusual but valid
          targetValue: 'senior',
        },
        provenance: { derivationChains: [['test-filter']], explanation: 'test' },
      },
    ];

    const merged = mergeDerivedSkillsIntoInferenceContext(context, constraints);

    // Filter rules produce hard constraints → requiredProperties
    expect(merged.derived.requiredProperties.seniorityLevel).toBe('senior');
  });

  it('maintains property provenance for chaining', () => {
    const context = createMockContext();

    const constraints: DerivedConstraint[] = [
      {
        rule: { id: 'greenfield-prefers-senior', name: 'Test' },
        action: {
          effect: 'boost' as const,
          targetField: 'preferredSeniorityLevel' as const,
          targetValue: 'senior',
          boostStrength: 0.4,
        },
        provenance: { derivationChains: [['greenfield-prefers-senior']], explanation: 'test' },
      },
    ];

    const merged = mergeDerivedSkillsIntoInferenceContext(context, constraints);

    expect(merged.derived.preferredPropertyProvenance.get('seniorityLevel')).toEqual([
      ['greenfield-prefers-senior'],
    ]);
  });
});

describe('createEngine caching', () => {
  it('returns same engine instance for same rules', () => {
    const rules: InferenceRuleDefinition[] = [];

    const engine1 = createEngine(rules);
    const engine2 = createEngine(rules);

    expect(engine1).toBe(engine2);
  });
});

describe('eventToDerivedConstraint with implicit filter override', () => {
  const mockRules: InferenceRuleDefinition[] = [
    {
      name: 'Test Rule',
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'test-rule',
          targetField: 'derivedSkills',
          targetValue: ['skill_test'],
          rationale: 'Test rationale',
        },
      },
      conditions: { all: [] },
    },
  ];

  it('marks filter rule as overridden when target skill in userExplicitSkills', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_distributed'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],  // userExplicitFields
      mockRules,
      [],  // overriddenRuleIds
      ['skill_distributed']  // userExplicitSkills - user has this skill
    );

    expect(constraint.override?.overrideScope).toBe('FULL');
    expect(constraint.override?.overriddenSkills).toEqual(['skill_distributed']);
  });

  it('does not override filter when target skill NOT in userExplicitSkills', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_distributed'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      mockRules,
      [],
      ['skill_python']  // Different skill
    );

    expect(constraint.override).toBeUndefined();
  });

  it('handles partial override - reduces targetValue to non-overridden skills', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_monitoring', 'skill_tracing', 'skill_logging'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      mockRules,
      [],
      ['skill_monitoring']  // User only handles one skill
    );

    expect(constraint.override?.overrideScope).toBe('PARTIAL');
    expect(constraint.action.targetValue).toEqual(['skill_tracing', 'skill_logging']);
    expect(constraint.override?.overriddenSkills).toEqual(['skill_monitoring']);
  });

  it('fully overrides when all target skills in userExplicitSkills', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_a', 'skill_b'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      mockRules,
      [],
      ['skill_a', 'skill_b', 'skill_c']  // User handles both (and more)
    );

    expect(constraint.override?.overrideScope).toBe('FULL');
    expect(constraint.override?.overriddenSkills).toEqual(['skill_a', 'skill_b']);
  });

  it('does not apply implicit filter override to boost rules', () => {
    const event = {
      type: 'derived-boost',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_distributed'],
        boostStrength: 0.6,
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      mockRules,
      [],
      ['skill_distributed']  // User has skill, but it's a boost rule
    );

    // Boost rules use implicit boost override (via userExplicitFields), not filter override
    expect(constraint.override).toBeUndefined();
  });

  it('does not apply implicit filter override to non-derivedSkills targets', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'preferredSeniorityLevel',  // Not derivedSkills
        targetValue: 'senior',
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      mockRules,
      [],
      ['senior']  // Even if value matches somehow
    );

    expect(constraint.override).toBeUndefined();
  });
});

describe('override reasonType', () => {
  const mockRules: InferenceRuleDefinition[] = [
    {
      name: 'Test Rule',
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'test-rule',
          targetField: 'derivedSkills',
          targetValue: ['skill_test'],
          rationale: 'Test rationale',
        },
      },
      conditions: { all: [] },
    },
  ];

  it('sets reasonType to explicit-rule-override when rule in overriddenRuleIds', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_test'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      mockRules,
      ['test-rule'],  // explicitly overridden
      []
    );

    expect(constraint.override?.reasonType).toBe('explicit-rule-override');
  });

  it('sets reasonType to implicit-field-override when user set target field', () => {
    const event = {
      type: 'derived-boost',
      params: {
        ruleId: 'test-rule',
        targetField: 'preferredSkills',
        targetValue: ['skill_test'],
        boostStrength: 0.5,
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      ['preferredSkills'],  // user explicit field
      mockRules,
      [],
      []
    );

    expect(constraint.override?.reasonType).toBe('implicit-field-override');
  });

  it('sets reasonType to implicit-skill-override when user handles skill (FULL)', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_distributed'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      mockRules,
      [],
      ['skill_distributed']  // user has this skill
    );

    expect(constraint.override?.reasonType).toBe('implicit-skill-override');
    expect(constraint.override?.overrideScope).toBe('FULL');
  });

  it('sets reasonType to implicit-skill-override when user handles some skills (PARTIAL)', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_a', 'skill_b', 'skill_c'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      [],
      mockRules,
      [],
      ['skill_a']  // user handles only one
    );

    expect(constraint.override?.reasonType).toBe('implicit-skill-override');
    expect(constraint.override?.overrideScope).toBe('PARTIAL');
  });

  it('explicit override takes precedence over implicit field override', () => {
    const event = {
      type: 'derived-filter',
      params: {
        ruleId: 'test-rule',
        targetField: 'derivedSkills',
        targetValue: ['skill_test'],
        rationale: 'Test',
      },
    };

    const constraint = eventToDerivedConstraint(
      event,
      ['derivedSkills'],  // would trigger implicit-field
      mockRules,
      ['test-rule'],      // AND explicit override
      []
    );

    // Explicit takes precedence
    expect(constraint.override?.reasonType).toBe('explicit-rule-override');
  });
});

describe('Tier 3 edge cases', () => {
  it('computeContextHash is deterministic', () => {
    const context = createMockContext({
      skills: ['a', 'b', 'c'],
      allSkills: ['a', 'b', 'c'],
    });

    const hash1 = computeContextHash(context);
    const hash2 = computeContextHash(context);

    expect(hash1).toBe(hash2);
  });

  it('handles deeply nested request fields', () => {
    const request: SearchFilterRequest = {
      requiredSkills: [
        { skill: 'typescript', minProficiency: 'expert' },
        { skill: 'react', minProficiency: 'proficient' },
      ],
      requiredBusinessDomains: [{ domain: 'finance' }],
      requiredTechnicalDomains: [{ domain: 'backend' }],
    };

    const context = createInferenceContext(request);

    expect(context.request.requiredSkills).toEqual(request.requiredSkills);
    expect(context.request.requiredBusinessDomains).toEqual(request.requiredBusinessDomains);
  });
});

describe('contains operator edge cases', () => {
  it('returns false for non-array fact value', async () => {
    const rules: InferenceRuleDefinition[] = [
      {
        name: 'Test Contains',
        priority: 50,
        conditions: {
          all: [
            {
              fact: 'derived',
              path: '$.allSkills',
              operator: 'contains',
              value: 'skill_test',
            },
          ],
        },
        event: {
          type: 'derived-filter',
          params: {
            ruleId: 'contains-test',
            targetField: 'derivedSkills',
            targetValue: ['skill_derived'],
            rationale: 'Test contains operator',
          },
        },
      },
    ];

    const engine = createEngine(rules);

    // allSkills is a string, not an array
    const { events } = await engine.run({
      derived: { allSkills: 'skill_test' }, // String, not array
    });

    // Should not match since contains expects array
    expect(events.length).toBe(0);
  });

  it('returns false for null fact value', async () => {
    const rules: InferenceRuleDefinition[] = [
      {
        name: 'Test Contains',
        priority: 50,
        conditions: {
          all: [
            {
              fact: 'derived',
              path: '$.allSkills',
              operator: 'contains',
              value: 'skill_test',
            },
          ],
        },
        event: {
          type: 'derived-filter',
          params: {
            ruleId: 'contains-test',
            targetField: 'derivedSkills',
            targetValue: ['skill_derived'],
            rationale: 'Test contains operator',
          },
        },
      },
    ];

    const engine = createEngine(rules);

    const { events } = await engine.run({
      derived: { allSkills: null },
    });

    expect(events.length).toBe(0);
  });
});

describe('createEngine', () => {
  it('creates engine with custom contains operator', async () => {
    const rules: InferenceRuleDefinition[] = [
      {
        name: 'Test Contains',
        priority: 50,
        conditions: {
          all: [
            {
              fact: 'derived',
              path: '$.allSkills',
              operator: 'contains',
              value: 'skill_test',
            },
          ],
        },
        event: {
          type: 'derived-filter',
          params: {
            ruleId: 'contains-test',
            targetField: 'derivedSkills',
            targetValue: ['skill_derived'],
            rationale: 'Test contains operator',
          },
        },
      },
    ];

    const engine = createEngine(rules);

    // Test that contains operator works
    const { events } = await engine.run({
      derived: { allSkills: ['skill_test', 'skill_other'] },
    });

    expect(events.length).toBe(1);
    expect((events[0].params as { ruleId: string }).ruleId).toBe('contains-test');
  });

  it('does not fire when skill not present', async () => {
    const rules: InferenceRuleDefinition[] = [
      {
        name: 'Test Contains',
        priority: 50,
        conditions: {
          all: [
            {
              fact: 'derived',
              path: '$.allSkills',
              operator: 'contains',
              value: 'skill_test',
            },
          ],
        },
        event: {
          type: 'derived-filter',
          params: {
            ruleId: 'contains-test',
            targetField: 'derivedSkills',
            targetValue: ['skill_derived'],
            rationale: 'Test contains operator',
          },
        },
      },
    ];

    const engine = createEngine(rules);

    const { events } = await engine.run({
      derived: { allSkills: ['skill_other'] },
    });

    expect(events.length).toBe(0);
  });
});

describe('extractDerivedTriggers', () => {
  const mockRulesWithChains: InferenceRuleDefinition[] = [
    // First-hop rule (no derived triggers)
    {
      name: 'Scaling Requires Distributed',
      conditions: {
        all: [{ fact: 'request', path: '$.teamFocus', operator: 'equal', value: 'scaling' }],
      },
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'scaling-requires-distributed',
          targetField: 'derivedSkills',
          targetValue: ['skill_distributed'],
          rationale: 'Test',
        },
      },
    },
    // Skill chain rule
    {
      name: 'Distributed Requires Observability',
      conditions: {
        all: [
          { fact: 'derived', path: '$.allSkills', operator: 'contains', value: 'skill_distributed' },
        ],
      },
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'distributed-requires-observability',
          targetField: 'derivedSkills',
          targetValue: ['skill_monitoring'],
          rationale: 'Test',
        },
      },
    },
    // Property chain rule (fires from either container)
    {
      name: 'Senior Prefers Leadership',
      conditions: {
        any: [
          { fact: 'derived', path: '$.requiredProperties.seniorityLevel', operator: 'in', value: ['senior'] },
          { fact: 'derived', path: '$.preferredProperties.seniorityLevel', operator: 'in', value: ['senior'] },
        ],
      },
      event: {
        type: 'derived-boost',
        params: {
          ruleId: 'senior-prefers-leadership',
          targetField: 'derivedSkills',
          targetValue: ['skill_mentorship'],
          boostStrength: 0.6,
          rationale: 'Test',
        },
      },
    },
  ];

  it('returns empty array for first-hop rules (no derived triggers)', () => {
    const triggers = extractDerivedTriggers(mockRulesWithChains, 'scaling-requires-distributed');
    expect(triggers).toEqual([]);
  });

  it('detects skill trigger from allSkills contains', () => {
    const triggers = extractDerivedTriggers(mockRulesWithChains, 'distributed-requires-observability');
    expect(triggers).toEqual([
      { type: 'skill', provenanceKey: 'skill_distributed' },
    ]);
  });

  it('detects property triggers from BOTH containers (any condition)', () => {
    const triggers = extractDerivedTriggers(mockRulesWithChains, 'senior-prefers-leadership');
    expect(triggers).toContainEqual({ type: 'requiredProperty', provenanceKey: 'seniorityLevel' });
    expect(triggers).toContainEqual({ type: 'preferredProperty', provenanceKey: 'seniorityLevel' });
  });

  it('returns empty array for unknown rule', () => {
    const triggers = extractDerivedTriggers(mockRulesWithChains, 'nonexistent-rule');
    expect(triggers).toEqual([]);
  });
});

describe('buildDerivationChains', () => {
  const mockRulesForChains: InferenceRuleDefinition[] = [
    // First-hop rule
    {
      name: 'Scaling Requires Distributed',
      conditions: {
        all: [{ fact: 'request', path: '$.teamFocus', operator: 'equal', value: 'scaling' }],
      },
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'scaling-requires-distributed',
          targetField: 'derivedSkills',
          targetValue: ['skill_distributed'],
          rationale: 'Test',
        },
      },
    },
    // Skill chain rule
    {
      name: 'Distributed Requires Observability',
      conditions: {
        all: [
          { fact: 'derived', path: '$.allSkills', operator: 'contains', value: 'skill_distributed' },
        ],
      },
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'distributed-requires-observability',
          targetField: 'derivedSkills',
          targetValue: ['skill_monitoring'],
          rationale: 'Test',
        },
      },
    },
  ];

  it('returns single-element chain for first-hop rule', () => {
    const chains = buildDerivationChains(
      'scaling-requires-distributed',
      mockRulesForChains,
      new Map(),
      new Map(),
      new Map()
    );

    expect(chains).toEqual([['scaling-requires-distributed']]);
  });

  it('builds multi-hop chain from skill provenance', () => {
    const skillProvenance = new Map([
      ['skill_distributed', [['scaling-requires-distributed']]],
    ]);

    const chains = buildDerivationChains(
      'distributed-requires-observability',
      mockRulesForChains,
      skillProvenance,
      new Map(),
      new Map()
    );

    expect(chains).toEqual([
      ['scaling-requires-distributed', 'distributed-requires-observability'],
    ]);
  });

  it('filters out user-input sentinel from chains', () => {
    const skillProvenance = new Map([
      ['skill_distributed', [['user-input']]],  // User provided skill
    ]);

    const chains = buildDerivationChains(
      'distributed-requires-observability',
      mockRulesForChains,
      skillProvenance,
      new Map(),
      new Map()
    );

    // Should filter 'user-input' and result in single-element chain
    expect(chains).toEqual([['distributed-requires-observability']]);
  });

  it('builds multiple chains for multiple trigger sources', () => {
    /*
     * Simulates a rule triggered by BOTH skill_a and skill_b,
     * each with their own provenance.
     */
    const multiTriggerRule: InferenceRuleDefinition = {
      name: 'Multi Trigger Rule',
      conditions: {
        all: [
          { fact: 'derived', path: '$.allSkills', operator: 'contains', value: 'skill_a' },
          { fact: 'derived', path: '$.allSkills', operator: 'contains', value: 'skill_b' },
        ],
      },
      event: {
        type: 'derived-filter',
        params: {
          ruleId: 'multi-trigger-rule',
          targetField: 'derivedSkills',
          targetValue: ['skill_result'],
          rationale: 'Test',
        },
      },
    };

    const skillProvenance = new Map([
      ['skill_a', [['rule-1']]],
      ['skill_b', [['rule-2']]],
    ]);

    const chains = buildDerivationChains(
      'multi-trigger-rule',
      [multiTriggerRule],
      skillProvenance,
      new Map(),
      new Map()
    );

    expect(chains.length).toBe(2);
    expect(chains).toContainEqual(['rule-1', 'multi-trigger-rule']);
    expect(chains).toContainEqual(['rule-2', 'multi-trigger-rule']);
  });

  it('deduplicates identical chains', () => {
    const skillProvenance = new Map([
      ['skill_distributed', [
        ['scaling-requires-distributed'],
        ['scaling-requires-distributed'],  // Duplicate
      ]],
    ]);

    const chains = buildDerivationChains(
      'distributed-requires-observability',
      mockRulesForChains,
      skillProvenance,
      new Map(),
      new Map()
    );

    expect(chains.length).toBe(1);
    expect(chains).toEqual([
      ['scaling-requires-distributed', 'distributed-requires-observability'],
    ]);
  });
});
