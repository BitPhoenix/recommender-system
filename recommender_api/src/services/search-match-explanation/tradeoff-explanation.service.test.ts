import { describe, it, expect } from 'vitest';
import { detectTradeoffs, summarizeTradeoffs } from './tradeoff-explanation.service.js';

describe('detectTradeoffs', () => {
  const baseEngineer = {
    yearsExperience: 5,
    salary: 100000,
    startTimeline: 'two_weeks' as const,
    timezone: 'Eastern',
    skills: ['skill_typescript', 'skill_react'],
  };

  describe('experience tradeoffs', () => {
    it('detects under-experience tradeoff', () => {
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, yearsExperience: 3 },
        { preferredSeniorityLevel: 'senior' }
      );

      expect(tradeoffs).toHaveLength(1);
      expect(tradeoffs[0].attribute).toBe('yearsExperience');
      expect(tradeoffs[0].explanation).toContain('3 years experience');
      expect(tradeoffs[0].explanation).toContain('senior level expects 6+ years');
    });

    it('does not detect tradeoff when experience matches', () => {
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, yearsExperience: 7 },
        { preferredSeniorityLevel: 'senior' }
      );

      expect(tradeoffs).toHaveLength(0);
    });
  });

  describe('salary tradeoffs', () => {
    it('detects over-budget tradeoff', () => {
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, salary: 120000 },
        { maxBudget: 100000 }
      );

      expect(tradeoffs).toHaveLength(1);
      expect(tradeoffs[0].attribute).toBe('salary');
      expect(tradeoffs[0].explanation).toContain('$120,000');
      expect(tradeoffs[0].explanation).toContain('$20,000 over budget');
    });

    it('indicates when in stretch zone', () => {
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, salary: 120000 },
        { maxBudget: 100000, stretchBudget: 150000 }
      );

      expect(tradeoffs).toHaveLength(1);
      expect(tradeoffs[0].explanation).toContain('within stretch range');
    });

    it('does not detect tradeoff when within budget', () => {
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, salary: 90000 },
        { maxBudget: 100000 }
      );

      expect(tradeoffs).toHaveLength(0);
    });
  });

  describe('timeline tradeoffs', () => {
    it('detects later availability tradeoff', () => {
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, startTimeline: 'three_months' },
        { preferredMaxStartTime: 'two_weeks' }
      );

      expect(tradeoffs).toHaveLength(1);
      expect(tradeoffs[0].attribute).toBe('startTimeline');
      expect(tradeoffs[0].explanation).toContain('in 3 months');
      expect(tradeoffs[0].explanation).toContain('preferred: in 2 weeks');
    });

    it('does not detect tradeoff when available sooner', () => {
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, startTimeline: 'immediate' },
        { preferredMaxStartTime: 'two_weeks' }
      );

      expect(tradeoffs).toHaveLength(0);
    });
  });

  describe('timezone tradeoffs', () => {
    it('detects non-preferred timezone tradeoff', () => {
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, timezone: 'Pacific' },
        { preferredTimezone: ['Eastern', 'Central'] }
      );

      expect(tradeoffs).toHaveLength(1);
      expect(tradeoffs[0].attribute).toBe('timezone');
      expect(tradeoffs[0].explanation).toContain('Pacific timezone');
      expect(tradeoffs[0].explanation).toContain('preferred: Eastern or Central');
    });

    it('does not detect tradeoff when in preferred timezone', () => {
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, timezone: 'Eastern' },
        { preferredTimezone: ['Eastern', 'Central'] }
      );

      expect(tradeoffs).toHaveLength(0);
    });
  });

  describe('preferred skills tradeoffs', () => {
    it('detects tradeoff when engineer has none of the preferred skills', () => {
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, skills: ['skill_other'] },
        {
          preferredSkillIds: ['skill_python', 'skill_django', 'skill_flask'],
          preferredSkillNames: ['Python'],
        }
      );

      expect(tradeoffs).toHaveLength(1);
      expect(tradeoffs[0].attribute).toBe('preferredSkills');
      expect(tradeoffs[0].requested).toBe('Python');
      expect(tradeoffs[0].actual).toBe('none');
      expect(tradeoffs[0].explanation).toBe('Missing preferred skill: Python');
    });

    it('does not detect tradeoff when engineer has at least one preferred skill', () => {
      // Engineer has skill_typescript which is one of the expanded skills
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, skills: ['skill_typescript'] },
        {
          preferredSkillIds: ['skill_typescript', 'skill_react', 'skill_nodejs'],
          preferredSkillNames: ['TypeScript', 'React', 'Node.js'],
        }
      );

      expect(tradeoffs).toHaveLength(0);
    });

    it('uses plural form for multiple missing preferred skills', () => {
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, skills: ['skill_other'] },
        {
          preferredSkillIds: ['skill_python', 'skill_react'],
          preferredSkillNames: ['Python', 'React'],
        }
      );

      expect(tradeoffs).toHaveLength(1);
      expect(tradeoffs[0].requested).toBe('Python, React');
      expect(tradeoffs[0].explanation).toBe('Missing preferred skills: Python, React');
    });

    it('falls back to generic text when skill names not provided', () => {
      const tradeoffs = detectTradeoffs(
        { ...baseEngineer, skills: ['skill_other'] },
        {
          preferredSkillIds: ['skill_python', 'skill_django'],
        }
      );

      expect(tradeoffs).toHaveLength(1);
      expect(tradeoffs[0].requested).toBe('requested skills');
      expect(tradeoffs[0].explanation).toBe('Missing preferred skills: requested skills');
    });
  });

  describe('multiple tradeoffs', () => {
    it('detects multiple tradeoffs simultaneously', () => {
      const tradeoffs = detectTradeoffs(
        {
          yearsExperience: 3,
          salary: 120000,
          startTimeline: 'three_months',
          timezone: 'Pacific',
          skills: ['skill_other'],
        },
        {
          preferredSeniorityLevel: 'senior',
          maxBudget: 100000,
          preferredMaxStartTime: 'immediate',
          preferredTimezone: ['Eastern'],
          preferredSkillIds: ['skill_typescript', 'skill_react'],
          preferredSkillNames: ['TypeScript', 'React'],
        }
      );

      expect(tradeoffs).toHaveLength(5);
      const attributes = tradeoffs.map((t) => t.attribute);
      expect(attributes).toContain('yearsExperience');
      expect(attributes).toContain('salary');
      expect(attributes).toContain('startTimeline');
      expect(attributes).toContain('timezone');
      expect(attributes).toContain('preferredSkills');
    });
  });
});

describe('summarizeTradeoffs', () => {
  it('returns appropriate message when no tradeoffs', () => {
    const summary = summarizeTradeoffs([]);
    expect(summary).toBe('No tradeoffs detected');
  });

  it('summarizes single tradeoff', () => {
    const summary = summarizeTradeoffs([
      { attribute: 'salary', requested: 100000, actual: 120000, explanation: 'test' },
    ]);
    expect(summary).toBe('1 tradeoff: salary');
  });

  it('summarizes multiple tradeoffs', () => {
    const summary = summarizeTradeoffs([
      { attribute: 'salary', requested: 100000, actual: 120000, explanation: 'test' },
      { attribute: 'yearsExperience', requested: 6, actual: 3, explanation: 'test' },
    ]);
    expect(summary).toBe('2 tradeoffs: salary, yearsExperience');
  });
});
