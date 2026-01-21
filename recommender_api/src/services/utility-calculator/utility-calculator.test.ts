import { describe, it, expect } from 'vitest';
import {
  calculateUtilityWithBreakdown,
  calculateUtilityScore,
  scoreAndSortEngineers,
} from './utility-calculator.js';
import type { EngineerData, UtilityContext } from './types.js';

// Helper to create test engineer
const createEngineer = (overrides: Partial<EngineerData> = {}): EngineerData => ({
  id: 'eng-1',
  name: 'Test Engineer',
  headline: 'Senior Developer',
  salary: 150000,
  yearsExperience: 8,
  startTimeline: 'two_weeks',
  timezone: 'Eastern',
  avgConfidence: 0.85,
  matchedSkills: [],
  unmatchedRelatedSkills: [],
  matchedBusinessDomains: [],
  matchedTechnicalDomains: [],
  ...overrides,
});

// Helper to create scoring context
const createContext = (overrides: Partial<UtilityContext> = {}): UtilityContext => ({
  requiredSkillIds: [],
  preferredSkillIds: [],
  skillIdToPreferredProficiency: new Map(),
  alignedSkillIds: [],
  preferredBusinessDomains: [],
  preferredTechnicalDomains: [],
  preferredMaxStartTime: null,
  requiredMaxStartTime: 'three_months',
  preferredTimezone: [],
  preferredSeniorityLevel: null,
  maxBudget: null,
  stretchBudget: null,
  // Inference engine outputs (default to empty)
  derivedRequiredSkillIds: [],
  derivedSkillBoosts: new Map(),
  derivedConstraints: [],
  ...overrides,
});

describe('calculateUtilityWithBreakdown', () => {
  it('returns score and breakdown for basic engineer', () => {
    const engineer = createEngineer();
    const context = createContext();

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.utilityScore).toBeGreaterThanOrEqual(0);
    expect(result.utilityScore).toBeLessThanOrEqual(1);
    expect(result.scoreBreakdown).toBeDefined();
    expect(result.scoreBreakdown.scores).toBeDefined();
    expect(result.scoreBreakdown.preferenceMatches).toBeDefined();
  });

  it('includes confidence score when skills are filtered', () => {
    const engineer = createEngineer({
      avgConfidence: 0.9,
      matchedSkills: [
        {
          skillId: 's1',
          skillName: 'TypeScript',
          proficiencyLevel: 'expert',
          confidenceScore: 0.9,
          yearsUsed: 5,
          matchType: 'direct',
        },
      ],
    });
    const context = createContext({
      requiredSkillIds: ['s1'],
    });

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.scoreBreakdown.scores.confidence).toBeGreaterThan(0);
  });

  it('includes experience score', () => {
    const engineer = createEngineer({ yearsExperience: 10 });
    const context = createContext();

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.scoreBreakdown.scores.experience).toBeGreaterThan(0);
  });

  it('includes skill match score when required skills present', () => {
    const engineer = createEngineer({
      matchedSkills: [
        {
          skillId: 's1',
          skillName: 'TypeScript',
          proficiencyLevel: 'expert',
          confidenceScore: 0.9,
          yearsUsed: 5,
          matchType: 'direct',
        },
      ],
    });
    const context = createContext({
      requiredSkillIds: ['s1'],
      skillIdToPreferredProficiency: new Map([['s1', 'expert']]),
    });

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.scoreBreakdown.scores.skillMatch).toBeGreaterThan(0);
  });

  it('includes timeline match when preference specified', () => {
    const engineer = createEngineer({ startTimeline: 'immediate' });
    const context = createContext({
      preferredMaxStartTime: 'two_weeks',
      requiredMaxStartTime: 'one_month',
    });

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.scoreBreakdown.preferenceMatches.startTimelineMatch).toBeDefined();
    expect(result.scoreBreakdown.preferenceMatches.startTimelineMatch!.score).toBeGreaterThan(0);
    expect(result.scoreBreakdown.preferenceMatches.startTimelineMatch!.withinPreferred).toBe(true);
  });

  it('includes preferred timezone match', () => {
    const engineer = createEngineer({ timezone: 'Eastern' });
    const context = createContext({
      preferredTimezone: ['Eastern', 'Central'],
    });

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.scoreBreakdown.preferenceMatches.preferredTimezoneMatch).toBeDefined();
    expect(result.scoreBreakdown.preferenceMatches.preferredTimezoneMatch!.score).toBeGreaterThan(0);
  });

  it('includes preferred seniority match', () => {
    const engineer = createEngineer({ yearsExperience: 8 }); // senior level
    const context = createContext({
      preferredSeniorityLevel: 'senior', // requires 6 years
    });

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.scoreBreakdown.preferenceMatches.preferredSeniorityMatch).toBeDefined();
    expect(result.scoreBreakdown.preferenceMatches.preferredSeniorityMatch!.score).toBeGreaterThan(0);
  });

  it('only shows budgetMatch in stretch zone', () => {
    // Within budget - should NOT show budgetMatch
    const underBudget = createEngineer({ salary: 180000 });
    const underResult = calculateUtilityWithBreakdown(underBudget, createContext({
      maxBudget: 200000,
      stretchBudget: 220000,
    }));
    expect(underResult.scoreBreakdown.preferenceMatches.budgetMatch).toBeUndefined();

    // In stretch zone - SHOULD show budgetMatch
    const inStretchZone = createEngineer({ salary: 210000 });
    const stretchResult = calculateUtilityWithBreakdown(inStretchZone, createContext({
      maxBudget: 200000,
      stretchBudget: 220000,
    }));
    expect(stretchResult.scoreBreakdown.preferenceMatches.budgetMatch).toBeDefined();
    expect(stretchResult.scoreBreakdown.preferenceMatches.budgetMatch!.inStretchZone).toBe(true);
  });

  it('includes preferred skills match when specified', () => {
    const engineer = createEngineer({
      matchedSkills: [
        {
          skillId: 's1',
          skillName: 'TypeScript',
          proficiencyLevel: 'expert',
          confidenceScore: 0.9,
          yearsUsed: 5,
          matchType: 'direct',
        },
      ],
    });
    const context = createContext({
      preferredSkillIds: ['s1'],
    });

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.scoreBreakdown.preferenceMatches.preferredSkillsMatch).toBeDefined();
    expect(result.scoreBreakdown.preferenceMatches.preferredSkillsMatch!.matchedSkills).toContain('TypeScript');
  });

  it('includes related skills match for unmatched skills', () => {
    const engineer = createEngineer({
      unmatchedRelatedSkills: [
        {
          skillId: 's1',
          skillName: 'React',
          proficiencyLevel: 'proficient',
          confidenceScore: 0.8,
          yearsUsed: 3,
          matchType: 'direct',
          constraintViolations: ['proficiency_below_minimum'],
        },
      ],
    });
    const context = createContext();

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.scoreBreakdown.preferenceMatches.relatedSkillsMatch).toBeDefined();
    expect(result.scoreBreakdown.preferenceMatches.relatedSkillsMatch!.count).toBe(1);
  });

  it('breakdown total matches utilityScore', () => {
    const engineer = createEngineer({ yearsExperience: 10 });
    const context = createContext();

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.scoreBreakdown.total).toBe(result.utilityScore);
  });

  it('includes raw scores for explanation generation', () => {
    const engineer = createEngineer({
      yearsExperience: 7,
      avgConfidence: 0.85,
      matchedSkills: [
        {
          skillId: 's1',
          skillName: 'TypeScript',
          proficiencyLevel: 'expert',
          confidenceScore: 0.85,
          yearsUsed: 5,
          matchType: 'direct',
        },
      ],
    });
    const context = createContext({
      requiredSkillIds: ['s1'],
      skillIdToPreferredProficiency: new Map([['s1', 'expert']]),
    });

    const result = calculateUtilityWithBreakdown(engineer, context);

    // Raw scores should be present and in 0-1 range
    expect(result.scoreBreakdown.rawScores).toBeDefined();
    expect(result.scoreBreakdown.rawScores?.experience).toBeGreaterThan(0);
    expect(result.scoreBreakdown.rawScores?.experience).toBeLessThanOrEqual(1);
    expect(result.scoreBreakdown.rawScores?.confidence).toBeGreaterThan(0);
    expect(result.scoreBreakdown.rawScores?.confidence).toBeLessThanOrEqual(1);
    expect(result.scoreBreakdown.rawScores?.skillMatch).toBeGreaterThan(0);
    expect(result.scoreBreakdown.rawScores?.skillMatch).toBeLessThanOrEqual(1);
  });

  it('raw experience score can be reversed to get correct years', () => {
    const engineer = createEngineer({ yearsExperience: 7 });
    const context = createContext();

    const result = calculateUtilityWithBreakdown(engineer, context);

    // Reverse the logarithmic formula: rawScore = log(1 + years) / log(1 + 20)
    const rawScore = result.scoreBreakdown.rawScores?.experience ?? 0;
    const reversedYears = Math.round(Math.exp(rawScore * Math.log(21)) - 1);

    expect(reversedYears).toBe(7);
  });

  it('only includes non-zero raw scores in breakdown', () => {
    // Engineer with 0 years experience - experience raw score should be 0 and omitted
    // log(1 + 0) / log(21) = 0
    const engineer = createEngineer({
      yearsExperience: 0,
      avgConfidence: 0.5, // Minimum confidence gives 0 raw score (normalized from 0.5-1.0 range)
      matchedSkills: [],
    });
    const context = createContext({
      requiredSkillIds: [],
    });

    const result = calculateUtilityWithBreakdown(engineer, context);

    // With 0 experience and 0.5 confidence (min),
    // experience and confidence raw scores should be 0 and omitted
    if (result.scoreBreakdown.rawScores) {
      // Experience of 0 years gives log(1)/log(21) = 0
      expect(result.scoreBreakdown.rawScores.experience).toBeUndefined();
      // Confidence of 0.5 gives (0.5 - 0.5) / 0.5 = 0
      expect(result.scoreBreakdown.rawScores.confidence).toBeUndefined();
      // Note: skillMatch may have a default score even without required skills
    }
  });
});

describe('calculateUtilityScore', () => {
  it('returns just the total score', () => {
    const engineer = createEngineer();
    const context = createContext();

    const score = calculateUtilityScore(engineer, context);

    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns same value as calculateUtilityWithBreakdown', () => {
    const engineer = createEngineer();
    const context = createContext();

    const score = calculateUtilityScore(engineer, context);
    const breakdown = calculateUtilityWithBreakdown(engineer, context);

    expect(score).toBe(breakdown.utilityScore);
  });
});

describe('scoreAndSortEngineers', () => {
  it('sorts engineers by utility score descending', () => {
    const engineers = [
      createEngineer({ id: 'low', yearsExperience: 1 }),
      createEngineer({ id: 'high', yearsExperience: 15 }),
      createEngineer({ id: 'mid', yearsExperience: 5 }),
    ];
    const context = createContext();

    const results = scoreAndSortEngineers(engineers, context);

    expect(results[0].id).toBe('high');
    expect(results[2].id).toBe('low');
    expect(results[0].utilityScore).toBeGreaterThan(results[1].utilityScore);
    expect(results[1].utilityScore).toBeGreaterThan(results[2].utilityScore);
  });

  it('includes score breakdown for each engineer', () => {
    const engineers = [createEngineer()];
    const context = createContext();

    const results = scoreAndSortEngineers(engineers, context);

    expect(results[0].scoreBreakdown).toBeDefined();
    expect(results[0].scoreBreakdown.total).toBe(results[0].utilityScore);
  });

  it('handles empty array', () => {
    const results = scoreAndSortEngineers([], createContext());
    expect(results).toEqual([]);
  });

  it('preserves engineer data in results', () => {
    const engineer = createEngineer({
      id: 'test-123',
      name: 'Test Name',
      headline: 'Test Headline',
      salary: 123456,
    });
    const results = scoreAndSortEngineers([engineer], createContext());

    expect(results[0].id).toBe('test-123');
    expect(results[0].name).toBe('Test Name');
    expect(results[0].headline).toBe('Test Headline');
    expect(results[0].salary).toBe(123456);
  });
});
