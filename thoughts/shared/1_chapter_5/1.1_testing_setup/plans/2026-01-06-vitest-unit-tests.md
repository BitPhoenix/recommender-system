# Vitest Unit Testing Setup Implementation Plan

## Overview

Add Vitest testing framework to the recommender_api and create comprehensive unit tests for all pure business logic functions. This establishes a testing foundation that can be extended with integration tests later.

## Current State Analysis

- **No testing framework**: The project has no test dependencies or test files
- **ESM + TypeScript**: Project uses `"type": "module"` with TypeScript (ES2020 target)
- **Pure functions**: Most business logic is in pure functions, ideal for unit testing
- **Zod validation**: Request validation uses Zod schemas with custom refinements

### Key Discoveries:
- 13+ pure scoring functions in `utility-calculator/scoring/` (no dependencies)
- 10+ pure constraint expansion functions in `constraint-expander.service.ts`
- 3 Zod refinement rules in `search.schema.ts` for cross-field validation
- All scoring functions have well-documented formulas in comments

## Desired End State

A fully configured Vitest testing setup with:
- Unit tests for all pure scoring functions (~13 functions)
- Unit tests for all constraint expansion functions (~10 functions)
- Unit tests for Zod validation schemas (3 refinement rules + field validations)
- Unit tests for the utility calculator orchestration

### Verification:
```bash
npm test        # All tests pass
npm run test:coverage  # Coverage report shows tested modules
```

## What We're NOT Doing

- Integration tests requiring Neo4j mocking (separate task)
- E2E/API tests (covered by existing Postman/Newman)
- Tests for database-dependent services (skill-resolver, domain-resolver, search.service)
- Tests for HTTP controller/middleware layer

## Implementation Approach

Start with Vitest setup, then test in order of complexity: pure math functions → constraint expansion → validation schemas → utility calculator orchestration.

---

## Phase 1: Vitest Setup

### Overview
Install and configure Vitest for ESM + TypeScript project.

### Changes Required:

#### 1. Install Dependencies
```bash
cd recommender_api
npm install -D vitest @vitest/coverage-v8
```

#### 2. Create Vitest Config
**File**: `recommender_api/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/neo4j.ts',
        'src/config.ts',
        'src/**/*.test.ts',
      ],
    },
  },
});
```

#### 3. Update package.json Scripts
**File**: `recommender_api/package.json`
**Changes**: Add test scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

#### 4. Update tsconfig.json (add test types)
**File**: `recommender_api/tsconfig.json`
**Changes**: Add vitest types for globals

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] `npm test` runs without errors (even with no tests yet)
- [x] `npm run typecheck` passes with new config

---

## Phase 2: Pure Scoring Function Tests

### Overview
Test all 13 pure scoring functions. These have no dependencies and clear mathematical specifications.

### Changes Required:

#### 1. Core Scoring Tests
**File**: `recommender_api/src/services/utility-calculator/scoring/core-scoring.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizeLinear,
  normalizeLinearInverse,
  calculateConfidenceUtility,
  calculateExperienceUtility,
} from './core-scoring.js';

describe('normalizeLinear', () => {
  it('returns 0 for value at min', () => {
    expect(normalizeLinear(0, 0, 10)).toBe(0);
  });

  it('returns 1 for value at max', () => {
    expect(normalizeLinear(10, 0, 10)).toBe(1);
  });

  it('returns 0.5 for midpoint', () => {
    expect(normalizeLinear(5, 0, 10)).toBe(0.5);
  });

  it('clamps values below min to 0', () => {
    expect(normalizeLinear(-5, 0, 10)).toBe(0);
  });

  it('clamps values above max to 1', () => {
    expect(normalizeLinear(15, 0, 10)).toBe(1);
  });

  it('returns 0.5 when min equals max', () => {
    expect(normalizeLinear(5, 5, 5)).toBe(0.5);
  });
});

describe('normalizeLinearInverse', () => {
  it('returns 1 for value at min (lower is better)', () => {
    expect(normalizeLinearInverse(0, 0, 10)).toBe(1);
  });

  it('returns 0 for value at max', () => {
    expect(normalizeLinearInverse(10, 0, 10)).toBe(0);
  });

  it('returns 0.5 for midpoint', () => {
    expect(normalizeLinearInverse(5, 0, 10)).toBe(0.5);
  });
});

describe('calculateConfidenceUtility', () => {
  it('returns 0 when avgConfidence is 0 (no skill filtering)', () => {
    expect(calculateConfidenceUtility(0, 0.5, 1.0)).toBe(0);
  });

  it('returns 0 for confidence at min threshold', () => {
    expect(calculateConfidenceUtility(0.5, 0.5, 1.0)).toBe(0);
  });

  it('returns 1 for confidence at max', () => {
    expect(calculateConfidenceUtility(1.0, 0.5, 1.0)).toBe(1);
  });

  it('returns 0.5 for confidence at midpoint', () => {
    expect(calculateConfidenceUtility(0.75, 0.5, 1.0)).toBe(0.5);
  });
});

describe('calculateExperienceUtility', () => {
  it('returns 0 for 0 years experience', () => {
    expect(calculateExperienceUtility(0, 20)).toBe(0);
  });

  it('returns 1 for max years experience', () => {
    expect(calculateExperienceUtility(20, 20)).toBe(1);
  });

  it('shows diminishing returns (logarithmic)', () => {
    const utility5 = calculateExperienceUtility(5, 20);
    const utility10 = calculateExperienceUtility(10, 20);
    const utility15 = calculateExperienceUtility(15, 20);

    // Gain from 0->5 should be larger than 5->10
    const gain0to5 = utility5;
    const gain5to10 = utility10 - utility5;
    const gain10to15 = utility15 - utility10;

    expect(gain0to5).toBeGreaterThan(gain5to10);
    expect(gain5to10).toBeGreaterThan(gain10to15);
  });

  it('caps at 1 for experience exceeding max', () => {
    expect(calculateExperienceUtility(30, 20)).toBe(1);
  });
});
```

#### 2. Skill Scoring Tests
**File**: `recommender_api/src/services/utility-calculator/scoring/skill-scoring.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateRequiredSkillsProficiencyMatch,
  calculatePreferredSkillsMatch,
  calculateTeamFocusMatch,
  calculateRelatedSkillsMatch,
} from './skill-scoring.js';
import type { MatchedSkill, UnmatchedRelatedSkill } from '../../../types/search.types.js';

describe('calculateRequiredSkillsProficiencyMatch', () => {
  const createMatchedSkill = (
    skillId: string,
    proficiencyLevel: 'learning' | 'proficient' | 'expert'
  ): MatchedSkill => ({
    skillId,
    name: skillId,
    proficiencyLevel,
    confidence: 0.9,
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
    expect(result).toBe(1.0);
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
    // proficient (2) vs expert (3): (2+1)/(3+1) = 0.75
    expect(result).toBeCloseTo(0.75);
  });

  it('returns 1.0 when no proficiency preferences specified', () => {
    const skills = [createMatchedSkill('s1', 'learning')];
    const requiredSkillIds = ['s1'];
    const skillIdToPreferredProficiency = new Map<string, 'learning' | 'proficient' | 'expert'>();

    const result = calculateRequiredSkillsProficiencyMatch(
      skills,
      requiredSkillIds,
      skillIdToPreferredProficiency
    );
    expect(result).toBe(1.0);
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
    // s1: 1.0, s2: (1+1)/(3+1) = 0.5, avg = 0.75
    expect(result).toBeCloseTo(0.75);
  });

  it('returns 0 when no required skills specified', () => {
    const skills = [createMatchedSkill('s1', 'expert')];
    const result = calculateRequiredSkillsProficiencyMatch(skills, [], new Map());
    expect(result).toBe(0);
  });
});

describe('calculatePreferredSkillsMatch', () => {
  const createMatchedSkill = (skillId: string): MatchedSkill => ({
    skillId,
    name: skillId,
    proficiencyLevel: 'proficient',
    confidence: 0.9,
    yearsUsed: 3,
    matchType: 'direct',
  });

  it('returns maxMatch when all preferred skills matched', () => {
    const skills = [createMatchedSkill('s1'), createMatchedSkill('s2')];
    const preferredSkillIds = ['s1', 's2'];

    const result = calculatePreferredSkillsMatch(skills, preferredSkillIds, 0.08);
    expect(result.score).toBe(0.08);
    expect(result.matchedSkills).toEqual(['s1', 's2']);
  });

  it('returns proportional score for partial match', () => {
    const skills = [createMatchedSkill('s1')];
    const preferredSkillIds = ['s1', 's2'];

    const result = calculatePreferredSkillsMatch(skills, preferredSkillIds, 0.08);
    expect(result.score).toBe(0.04); // 1/2 * 0.08
  });

  it('returns 0 when no preferred skills specified', () => {
    const skills = [createMatchedSkill('s1')];
    const result = calculatePreferredSkillsMatch(skills, [], 0.08);
    expect(result.score).toBe(0);
  });
});

describe('calculateTeamFocusMatch', () => {
  const createMatchedSkill = (skillId: string): MatchedSkill => ({
    skillId,
    name: skillId,
    proficiencyLevel: 'proficient',
    confidence: 0.9,
    yearsUsed: 3,
    matchType: 'direct',
  });

  it('returns maxMatch when all aligned skills matched', () => {
    const skills = [createMatchedSkill('s1'), createMatchedSkill('s2')];
    const alignedSkillIds = ['s1', 's2'];

    const result = calculateTeamFocusMatch(skills, alignedSkillIds, 0.04);
    expect(result.score).toBe(0.04);
  });

  it('returns 0 when no team focus specified', () => {
    const skills = [createMatchedSkill('s1')];
    const result = calculateTeamFocusMatch(skills, [], 0.04);
    expect(result.score).toBe(0);
  });
});

describe('calculateRelatedSkillsMatch', () => {
  const createUnmatchedSkill = (skillId: string): UnmatchedRelatedSkill => ({
    skillId,
    name: skillId,
    proficiencyLevel: 'proficient',
    confidence: 0.9,
    yearsUsed: 3,
    matchType: 'direct',
    constraintViolations: ['below_min_proficiency'],
  });

  it('returns 0 for no related skills', () => {
    const result = calculateRelatedSkillsMatch([], 0.04);
    expect(result.score).toBe(0);
    expect(result.count).toBe(0);
  });

  it('shows exponential growth with diminishing returns', () => {
    const skills1 = [createUnmatchedSkill('s1')];
    const skills5 = Array.from({ length: 5 }, (_, i) => createUnmatchedSkill(`s${i}`));
    const skills10 = Array.from({ length: 10 }, (_, i) => createUnmatchedSkill(`s${i}`));

    const result1 = calculateRelatedSkillsMatch(skills1, 0.04);
    const result5 = calculateRelatedSkillsMatch(skills5, 0.04);
    const result10 = calculateRelatedSkillsMatch(skills10, 0.04);

    // Scores should increase but with diminishing returns
    expect(result5.score).toBeGreaterThan(result1.score);
    expect(result10.score).toBeGreaterThan(result5.score);

    // Gain from 1->5 should be larger than 5->10
    const gain1to5 = result5.score - result1.score;
    const gain5to10 = result10.score - result5.score;
    expect(gain1to5).toBeGreaterThan(gain5to10);
  });

  it('caps at maxMatch', () => {
    const manySkills = Array.from({ length: 100 }, (_, i) => createUnmatchedSkill(`s${i}`));
    const result = calculateRelatedSkillsMatch(manySkills, 0.04);
    expect(result.score).toBeLessThanOrEqual(0.04);
  });
});
```

#### 3. Logistics Scoring Tests
**File**: `recommender_api/src/services/utility-calculator/scoring/logistics-scoring.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateStartTimelineMatch,
  calculatePreferredTimezoneMatch,
  calculatePreferredSeniorityMatch,
  calculateBudgetMatch,
} from './logistics-scoring.js';

describe('calculateStartTimelineMatch', () => {
  it('returns maxMatch when engineer timeline <= preferred', () => {
    const result = calculateStartTimelineMatch('immediate', 'two_weeks', 'one_month', 0.10);
    expect(result.score).toBe(0.10);
    expect(result.withinPreferred).toBe(true);
  });

  it('returns maxMatch when engineer exactly at preferred', () => {
    const result = calculateStartTimelineMatch('two_weeks', 'two_weeks', 'one_month', 0.10);
    expect(result.score).toBe(0.10);
    expect(result.withinPreferred).toBe(true);
  });

  it('returns degraded score between preferred and required', () => {
    // Timeline order: immediate < two_weeks < one_month < two_months < three_months
    const result = calculateStartTimelineMatch('one_month', 'two_weeks', 'two_months', 0.10);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(0.10);
    expect(result.withinPreferred).toBe(false);
  });

  it('returns 0 when engineer timeline > required', () => {
    const result = calculateStartTimelineMatch('three_months', 'two_weeks', 'one_month', 0.10);
    expect(result.score).toBe(0);
  });

  it('returns 0 when no preferred timeline specified', () => {
    const result = calculateStartTimelineMatch('immediate', undefined, 'one_month', 0.10);
    expect(result.score).toBe(0);
  });
});

describe('calculatePreferredTimezoneMatch', () => {
  it('returns maxMatch for first preference', () => {
    const result = calculatePreferredTimezoneMatch(
      'America/New_York',
      ['America/New_York', 'America/Chicago'],
      0.03
    );
    expect(result.score).toBe(0.03);
    expect(result.rank).toBe(1);
  });

  it('returns reduced score for second preference', () => {
    const result = calculatePreferredTimezoneMatch(
      'America/Chicago',
      ['America/New_York', 'America/Chicago'],
      0.03
    );
    expect(result.score).toBe(0.015); // (1 - 1/2) * 0.03
    expect(result.rank).toBe(2);
  });

  it('returns 0 for non-matching timezone', () => {
    const result = calculatePreferredTimezoneMatch(
      'Europe/London',
      ['America/New_York', 'America/Chicago'],
      0.03
    );
    expect(result.score).toBe(0);
    expect(result.rank).toBeUndefined();
  });

  it('returns 0 when no preferred timezones specified', () => {
    const result = calculatePreferredTimezoneMatch('America/New_York', [], 0.03);
    expect(result.score).toBe(0);
  });

  it('matches timezone prefix patterns', () => {
    const result = calculatePreferredTimezoneMatch(
      'America/New_York',
      ['America/'], // Prefix match
      0.03
    );
    expect(result.score).toBe(0.03);
  });
});

describe('calculatePreferredSeniorityMatch', () => {
  it('returns maxMatch when engineer meets seniority threshold', () => {
    // senior requires 6 years
    const result = calculatePreferredSeniorityMatch(8, 'senior', 0.03);
    expect(result.score).toBe(0.03);
  });

  it('returns 0 when engineer below seniority threshold', () => {
    const result = calculatePreferredSeniorityMatch(4, 'senior', 0.03);
    expect(result.score).toBe(0);
  });

  it('returns 0 when no preferred seniority specified', () => {
    const result = calculatePreferredSeniorityMatch(10, undefined, 0.03);
    expect(result.score).toBe(0);
  });

  it('handles all seniority levels correctly', () => {
    // junior: 0, mid: 3, senior: 6, staff: 10, principal: 15
    expect(calculatePreferredSeniorityMatch(0, 'junior', 0.03).score).toBe(0.03);
    expect(calculatePreferredSeniorityMatch(2, 'mid', 0.03).score).toBe(0);
    expect(calculatePreferredSeniorityMatch(3, 'mid', 0.03).score).toBe(0.03);
    expect(calculatePreferredSeniorityMatch(15, 'principal', 0.03).score).toBe(0.03);
  });
});

describe('calculateBudgetMatch', () => {
  it('returns maxMatch when no budget specified (fairness)', () => {
    const result = calculateBudgetMatch(150000, undefined, undefined, 0.02);
    expect(result.score).toBe(0.02);
    expect(result.inStretchZone).toBe(false);
  });

  it('returns maxMatch when salary at or below maxBudget', () => {
    const result = calculateBudgetMatch(180000, 200000, 220000, 0.02);
    expect(result.score).toBe(0.02);
    expect(result.inStretchZone).toBe(false);
  });

  it('returns degraded score in stretch zone', () => {
    const result = calculateBudgetMatch(210000, 200000, 220000, 0.02);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(0.02);
    expect(result.inStretchZone).toBe(true);
  });

  it('returns minimum score at stretch budget boundary', () => {
    const result = calculateBudgetMatch(220000, 200000, 220000, 0.02);
    expect(result.score).toBe(0.01); // 0.5 * maxMatch at stretch boundary
    expect(result.inStretchZone).toBe(true);
  });

  it('returns 0 when salary exceeds stretch budget', () => {
    const result = calculateBudgetMatch(250000, 200000, 220000, 0.02);
    expect(result.score).toBe(0);
  });

  it('handles maxBudget without stretchBudget', () => {
    const result = calculateBudgetMatch(180000, 200000, undefined, 0.02);
    expect(result.score).toBe(0.02);

    const overBudget = calculateBudgetMatch(220000, 200000, undefined, 0.02);
    expect(overBudget.score).toBe(0);
  });
});
```

#### 4. Domain Scoring Tests
**File**: `recommender_api/src/services/utility-calculator/scoring/domain-scoring.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculatePreferredBusinessDomainMatch,
  calculatePreferredTechnicalDomainMatch,
} from './domain-scoring.js';
import type { BusinessDomainMatch, TechnicalDomainMatch } from '../../../types/search.types.js';

describe('calculatePreferredBusinessDomainMatch', () => {
  const createBusinessDomain = (domainId: string): BusinessDomainMatch => ({
    domainId,
    name: domainId,
    engineerYears: 3,
    meetsRequired: true,
    meetsPreferred: true,
  });

  it('returns maxMatch when all preferred domains matched', () => {
    const domains = [createBusinessDomain('d1'), createBusinessDomain('d2')];
    const preferredDomains = [{ identifier: 'd1' }, { identifier: 'd2' }];

    const result = calculatePreferredBusinessDomainMatch(domains, preferredDomains, 0.02);
    expect(result.score).toBe(0.02);
    expect(result.matchedDomains).toEqual(['d1', 'd2']);
  });

  it('returns proportional score for partial match', () => {
    const domains = [createBusinessDomain('d1')];
    const preferredDomains = [{ identifier: 'd1' }, { identifier: 'd2' }];

    const result = calculatePreferredBusinessDomainMatch(domains, preferredDomains, 0.02);
    expect(result.score).toBe(0.01); // 1/2 * 0.02
  });

  it('returns 0 when no preferred domains specified', () => {
    const domains = [createBusinessDomain('d1')];
    const result = calculatePreferredBusinessDomainMatch(domains, [], 0.02);
    expect(result.score).toBe(0);
  });
});

describe('calculatePreferredTechnicalDomainMatch', () => {
  const createTechnicalDomain = (domainId: string): TechnicalDomainMatch => ({
    domainId,
    name: domainId,
    engineerYears: 3,
    meetsRequired: true,
    meetsPreferred: true,
    matchType: 'direct',
  });

  it('returns maxMatch when all preferred domains matched', () => {
    const domains = [createTechnicalDomain('t1'), createTechnicalDomain('t2')];
    const preferredDomains = [{ identifier: 't1' }, { identifier: 't2' }];

    const result = calculatePreferredTechnicalDomainMatch(domains, preferredDomains, 0.02);
    expect(result.score).toBe(0.02);
  });

  it('returns proportional score for partial match', () => {
    const domains = [createTechnicalDomain('t1')];
    const preferredDomains = [{ identifier: 't1' }, { identifier: 't2' }];

    const result = calculatePreferredTechnicalDomainMatch(domains, preferredDomains, 0.02);
    expect(result.score).toBe(0.01);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `npm test` passes with all scoring tests
- [x] `npm run typecheck` passes

---

## Phase 3: Constraint Expansion Tests

### Overview
Test all pure functions in constraint-expander.service.ts that transform user requirements to database constraints.

### Changes Required:

#### 1. Constraint Expansion Tests
**File**: `recommender_api/src/services/constraint-expander.service.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  expandSearchCriteria,
  expandSeniorityToYearsExperience,
  expandStartTimelineConstraint,
  expandTimezoneToPrefixes,
  expandBudgetConstraints,
  expandTeamFocusToAlignedSkills,
  expandPaginationConstraints,
} from './constraint-expander.service.js';
import { knowledgeBaseConfig } from '../config/knowledge-base/index.js';

describe('expandSeniorityToYearsExperience', () => {
  it('returns undefined for no seniority level', () => {
    const result = expandSeniorityToYearsExperience(undefined, knowledgeBaseConfig);
    expect(result).toBeUndefined();
  });

  it('maps junior to 0-3 years', () => {
    const result = expandSeniorityToYearsExperience('junior', knowledgeBaseConfig);
    expect(result).toEqual({ min: 0, max: 3 });
  });

  it('maps mid to 3-6 years', () => {
    const result = expandSeniorityToYearsExperience('mid', knowledgeBaseConfig);
    expect(result).toEqual({ min: 3, max: 6 });
  });

  it('maps senior to 6-10 years', () => {
    const result = expandSeniorityToYearsExperience('senior', knowledgeBaseConfig);
    expect(result).toEqual({ min: 6, max: 10 });
  });

  it('maps staff to 10-15 years', () => {
    const result = expandSeniorityToYearsExperience('staff', knowledgeBaseConfig);
    expect(result).toEqual({ min: 10, max: 15 });
  });

  it('maps principal to 15+ years (no max)', () => {
    const result = expandSeniorityToYearsExperience('principal', knowledgeBaseConfig);
    expect(result).toEqual({ min: 15, max: undefined });
  });
});

describe('expandStartTimelineConstraint', () => {
  it('returns all timelines up to and including required', () => {
    const result = expandStartTimelineConstraint('one_month', knowledgeBaseConfig);
    expect(result).toEqual(['immediate', 'two_weeks', 'one_month']);
  });

  it('returns only immediate for immediate requirement', () => {
    const result = expandStartTimelineConstraint('immediate', knowledgeBaseConfig);
    expect(result).toEqual(['immediate']);
  });

  it('returns all timelines for three_months', () => {
    const result = expandStartTimelineConstraint('three_months', knowledgeBaseConfig);
    expect(result).toEqual(['immediate', 'two_weeks', 'one_month', 'two_months', 'three_months']);
  });

  it('uses default when no requirement specified', () => {
    const result = expandStartTimelineConstraint(undefined, knowledgeBaseConfig);
    // Should use config default (requiredMaxStartTime)
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('expandTimezoneToPrefixes', () => {
  it('returns undefined for no timezone requirement', () => {
    const result = expandTimezoneToPrefixes(undefined);
    expect(result).toBeUndefined();
  });

  it('expands America/* to America/ prefix', () => {
    const result = expandTimezoneToPrefixes('America/*');
    expect(result).toEqual(['America/']);
  });

  it('expands Europe/* to Europe/ prefix', () => {
    const result = expandTimezoneToPrefixes('Europe/*');
    expect(result).toEqual(['Europe/']);
  });

  it('keeps specific timezone as-is', () => {
    const result = expandTimezoneToPrefixes('America/New_York');
    expect(result).toEqual(['America/New_York']);
  });

  it('handles multiple patterns (comma-separated)', () => {
    const result = expandTimezoneToPrefixes('America/*,Europe/*');
    expect(result).toEqual(['America/', 'Europe/']);
  });
});

describe('expandBudgetConstraints', () => {
  it('returns undefined for no budget', () => {
    const result = expandBudgetConstraints(undefined, undefined);
    expect(result).toBeUndefined();
  });

  it('uses maxBudget as ceiling when no stretch', () => {
    const result = expandBudgetConstraints(200000, undefined);
    expect(result).toEqual({ ceiling: 200000 });
  });

  it('uses stretchBudget as ceiling when provided', () => {
    const result = expandBudgetConstraints(200000, 220000);
    expect(result).toEqual({ ceiling: 220000 });
  });
});

describe('expandTeamFocusToAlignedSkills', () => {
  it('returns undefined for no team focus', () => {
    const result = expandTeamFocusToAlignedSkills(undefined, knowledgeBaseConfig);
    expect(result).toBeUndefined();
  });

  it('returns frontend skill IDs for frontend focus', () => {
    const result = expandTeamFocusToAlignedSkills('frontend', knowledgeBaseConfig);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result!.length).toBeGreaterThan(0);
  });

  it('returns backend skill IDs for backend focus', () => {
    const result = expandTeamFocusToAlignedSkills('backend', knowledgeBaseConfig);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns fullstack skill IDs for fullstack focus', () => {
    const result = expandTeamFocusToAlignedSkills('fullstack', knowledgeBaseConfig);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('expandPaginationConstraints', () => {
  it('uses defaults when not specified', () => {
    const result = expandPaginationConstraints(undefined, undefined, knowledgeBaseConfig);
    expect(result.limit).toBe(knowledgeBaseConfig.defaults.limit);
    expect(result.offset).toBe(knowledgeBaseConfig.defaults.offset);
  });

  it('uses provided values', () => {
    const result = expandPaginationConstraints(50, 100, knowledgeBaseConfig);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(100);
  });

  it('handles partial specification', () => {
    const result = expandPaginationConstraints(25, undefined, knowledgeBaseConfig);
    expect(result.limit).toBe(25);
    expect(result.offset).toBe(knowledgeBaseConfig.defaults.offset);
  });
});

describe('expandSearchCriteria (integration)', () => {
  it('expands minimal request with defaults', () => {
    const result = expandSearchCriteria({});

    expect(result.startTimeline).toBeDefined();
    expect(result.pagination).toBeDefined();
    expect(result.appliedFilters).toBeDefined();
    expect(result.appliedPreferences).toBeDefined();
  });

  it('expands full request with all constraints', () => {
    const result = expandSearchCriteria({
      seniorityLevel: 'senior',
      requiredMaxStartTime: 'one_month',
      preferredMaxStartTime: 'two_weeks',
      requiredTimezone: 'America/*',
      preferredTimezone: ['America/New_York', 'America/Chicago'],
      maxBudget: 200000,
      stretchBudget: 220000,
      teamFocus: 'backend',
      limit: 50,
      offset: 0,
    });

    expect(result.yearsExperience).toEqual({ min: 6, max: 10 });
    expect(result.startTimeline).toEqual(['immediate', 'two_weeks', 'one_month']);
    expect(result.timezonePrefixes).toEqual(['America/']);
    expect(result.budget).toEqual({ ceiling: 220000 });
    expect(result.alignedSkillIds).toBeDefined();
    expect(result.pagination).toEqual({ limit: 50, offset: 0 });
  });

  it('tracks applied filters correctly', () => {
    const result = expandSearchCriteria({
      seniorityLevel: 'senior',
      requiredTimezone: 'America/*',
    });

    const filterNames = result.appliedFilters.map((f) => f.name);
    expect(filterNames).toContain('seniorityLevel');
    expect(filterNames).toContain('requiredTimezone');
  });

  it('tracks applied preferences correctly', () => {
    const result = expandSearchCriteria({
      preferredMaxStartTime: 'two_weeks',
      preferredTimezone: ['America/New_York'],
      preferredSeniorityLevel: 'senior',
    });

    const prefNames = result.appliedPreferences.map((p) => p.name);
    expect(prefNames).toContain('preferredMaxStartTime');
    expect(prefNames).toContain('preferredTimezone');
    expect(prefNames).toContain('preferredSeniorityLevel');
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `npm test` passes with all constraint expansion tests
- [x] `npm run typecheck` passes

---

## Phase 4: Validation Schema Tests

### Overview
Test Zod schema validations including cross-field refinement rules.

### Changes Required:

#### 1. Schema Validation Tests
**File**: `recommender_api/src/schemas/search.schema.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { SearchFilterRequestSchema } from './search.schema.js';

describe('SearchFilterRequestSchema', () => {
  describe('basic validation', () => {
    it('accepts empty object (unfiltered search)', () => {
      const result = SearchFilterRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts valid full request', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredSkills: [{ identifier: 'typescript', minProficiency: 'proficient' }],
        preferredSkills: [{ identifier: 'react' }],
        seniorityLevel: 'senior',
        requiredMaxStartTime: 'one_month',
        preferredMaxStartTime: 'two_weeks',
        requiredTimezone: 'America/*',
        preferredTimezone: ['America/New_York'],
        maxBudget: 200000,
        stretchBudget: 220000,
        teamFocus: 'backend',
        limit: 20,
        offset: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('seniorityLevel validation', () => {
    it('accepts valid seniority levels', () => {
      const levels = ['junior', 'mid', 'senior', 'staff', 'principal'];
      for (const level of levels) {
        const result = SearchFilterRequestSchema.safeParse({ seniorityLevel: level });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid seniority level', () => {
      const result = SearchFilterRequestSchema.safeParse({ seniorityLevel: 'intern' });
      expect(result.success).toBe(false);
    });
  });

  describe('startTimeline validation', () => {
    it('accepts valid timeline values', () => {
      const timelines = ['immediate', 'two_weeks', 'one_month', 'two_months', 'three_months'];
      for (const timeline of timelines) {
        const result = SearchFilterRequestSchema.safeParse({ requiredMaxStartTime: timeline });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('proficiencyLevel validation', () => {
    it('accepts valid proficiency levels in skills', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredSkills: [
          { identifier: 'ts', minProficiency: 'learning' },
          { identifier: 'js', minProficiency: 'proficient' },
          { identifier: 'py', minProficiency: 'expert' },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('teamFocus validation', () => {
    it('accepts valid team focus values', () => {
      const focuses = ['frontend', 'backend', 'fullstack'];
      for (const focus of focuses) {
        const result = SearchFilterRequestSchema.safeParse({ teamFocus: focus });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('stretchBudget refinement: requires maxBudget', () => {
    it('rejects stretchBudget without maxBudget', () => {
      const result = SearchFilterRequestSchema.safeParse({
        stretchBudget: 220000,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('maxBudget');
      }
    });

    it('accepts stretchBudget with maxBudget', () => {
      const result = SearchFilterRequestSchema.safeParse({
        maxBudget: 200000,
        stretchBudget: 220000,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('stretchBudget refinement: must be >= maxBudget', () => {
    it('rejects stretchBudget less than maxBudget', () => {
      const result = SearchFilterRequestSchema.safeParse({
        maxBudget: 200000,
        stretchBudget: 180000,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('greater than or equal');
      }
    });

    it('accepts stretchBudget equal to maxBudget', () => {
      const result = SearchFilterRequestSchema.safeParse({
        maxBudget: 200000,
        stretchBudget: 200000,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('timeline refinement: preferred must be <= required', () => {
    it('rejects preferredMaxStartTime later than requiredMaxStartTime', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredMaxStartTime: 'two_weeks',
        preferredMaxStartTime: 'one_month',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('earlier than or equal');
      }
    });

    it('accepts preferredMaxStartTime earlier than requiredMaxStartTime', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredMaxStartTime: 'one_month',
        preferredMaxStartTime: 'two_weeks',
      });
      expect(result.success).toBe(true);
    });

    it('accepts preferredMaxStartTime equal to requiredMaxStartTime', () => {
      const result = SearchFilterRequestSchema.safeParse({
        requiredMaxStartTime: 'one_month',
        preferredMaxStartTime: 'one_month',
      });
      expect(result.success).toBe(true);
    });

    it('accepts preferredMaxStartTime without requiredMaxStartTime', () => {
      const result = SearchFilterRequestSchema.safeParse({
        preferredMaxStartTime: 'two_weeks',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('pagination validation', () => {
    it('accepts valid pagination values', () => {
      const result = SearchFilterRequestSchema.safeParse({
        limit: 50,
        offset: 100,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative limit', () => {
      const result = SearchFilterRequestSchema.safeParse({ limit: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects negative offset', () => {
      const result = SearchFilterRequestSchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `npm test` passes with all schema validation tests
- [x] `npm run typecheck` passes

---

## Phase 5: Utility Calculator Integration Tests

### Overview
Test the main utility calculator that orchestrates all scoring functions.

### Changes Required:

#### 1. Utility Calculator Tests
**File**: `recommender_api/src/services/utility-calculator/utility-calculator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateUtilityWithBreakdown,
  calculateUtilityScore,
  scoreAndSortEngineers,
} from './utility-calculator.js';
import type { ParsedEngineer } from './types.js';
import type { UtilityScoringContext } from '../../types/search.types.js';

// Helper to create test engineer
const createEngineer = (overrides: Partial<ParsedEngineer> = {}): ParsedEngineer => ({
  id: 'eng-1',
  name: 'Test Engineer',
  headline: 'Senior Developer',
  salary: 150000,
  yearsExperience: 8,
  startTimeline: 'two_weeks',
  timezone: 'America/New_York',
  avgConfidence: 0.85,
  matchedSkills: [],
  unmatchedRelatedSkills: [],
  matchedBusinessDomains: [],
  matchedTechnicalDomains: [],
  ...overrides,
});

// Helper to create scoring context
const createContext = (overrides: Partial<UtilityScoringContext> = {}): UtilityScoringContext => ({
  expandedSkillIds: [],
  preferredSkillIds: [],
  skillIdToPreferredProficiency: new Map(),
  alignedSkillIds: [],
  preferredBusinessDomains: [],
  preferredTechnicalDomains: [],
  preferredMaxStartTime: undefined,
  requiredMaxStartTime: 'three_months',
  preferredTimezone: [],
  preferredSeniorityLevel: undefined,
  maxBudget: undefined,
  stretchBudget: undefined,
  ...overrides,
});

describe('calculateUtilityWithBreakdown', () => {
  it('returns score and breakdown for basic engineer', () => {
    const engineer = createEngineer();
    const context = createContext();

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(1);
    expect(result.scores).toBeDefined();
    expect(result.preferenceMatches).toBeDefined();
  });

  it('includes confidence score when skills are filtered', () => {
    const engineer = createEngineer({
      avgConfidence: 0.9,
      matchedSkills: [
        {
          skillId: 's1',
          name: 'TypeScript',
          proficiencyLevel: 'expert',
          confidence: 0.9,
          yearsUsed: 5,
          matchType: 'direct',
        },
      ],
    });
    const context = createContext({
      expandedSkillIds: ['s1'],
    });

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.scores.confidence).toBeGreaterThan(0);
  });

  it('includes experience score', () => {
    const engineer = createEngineer({ yearsExperience: 10 });
    const context = createContext();

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.scores.experience).toBeGreaterThan(0);
  });

  it('includes skill match score when required skills present', () => {
    const engineer = createEngineer({
      matchedSkills: [
        {
          skillId: 's1',
          name: 'TypeScript',
          proficiencyLevel: 'expert',
          confidence: 0.9,
          yearsUsed: 5,
          matchType: 'direct',
        },
      ],
    });
    const context = createContext({
      expandedSkillIds: ['s1'],
      skillIdToPreferredProficiency: new Map([['s1', 'expert']]),
    });

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.scores.skillMatch).toBe(1.0);
  });

  it('includes timeline match when preference specified', () => {
    const engineer = createEngineer({ startTimeline: 'immediate' });
    const context = createContext({
      preferredMaxStartTime: 'two_weeks',
      requiredMaxStartTime: 'one_month',
    });

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.preferenceMatches.startTimelineMatch).toBeDefined();
    expect(result.preferenceMatches.startTimelineMatch!.score).toBeGreaterThan(0);
    expect(result.preferenceMatches.startTimelineMatch!.withinPreferred).toBe(true);
  });

  it('includes budget match when budget specified', () => {
    const engineer = createEngineer({ salary: 180000 });
    const context = createContext({
      maxBudget: 200000,
      stretchBudget: 220000,
    });

    const result = calculateUtilityWithBreakdown(engineer, context);

    expect(result.preferenceMatches.budgetMatch).toBeDefined();
    expect(result.preferenceMatches.budgetMatch!.score).toBeGreaterThan(0);
  });

  it('penalizes salary in stretch zone', () => {
    const underBudget = createEngineer({ salary: 180000 });
    const inStretchZone = createEngineer({ salary: 210000 });
    const context = createContext({
      maxBudget: 200000,
      stretchBudget: 220000,
    });

    const underResult = calculateUtilityWithBreakdown(underBudget, context);
    const stretchResult = calculateUtilityWithBreakdown(inStretchZone, context);

    expect(underResult.preferenceMatches.budgetMatch!.score).toBeGreaterThan(
      stretchResult.preferenceMatches.budgetMatch!.score
    );
    expect(stretchResult.preferenceMatches.budgetMatch!.inStretchZone).toBe(true);
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
});
```

### Success Criteria:

#### Automated Verification:
- [x] `npm test` passes with all utility calculator tests
- [x] `npm run test:coverage` shows coverage for utility-calculator module
- [x] `npm run typecheck` passes

---

## Testing Strategy

### Unit Tests (This Plan):
- Pure scoring functions (13 functions)
- Constraint expansion functions (10+ functions)
- Zod validation schemas (3 refinements + field validations)
- Utility calculator orchestration

### Integration Tests (Future Task):
- Neo4j-dependent services with mocked sessions
- API endpoint tests with supertest
- Full request/response flow tests

## Performance Considerations

- All tests are unit tests with no I/O, should run in <5 seconds total
- No database connections or network calls
- Vitest's parallel execution will speed up test runs

## References

- Vitest documentation: https://vitest.dev/
- Current scoring functions: `recommender_api/src/services/utility-calculator/scoring/`
- Constraint expansion: `recommender_api/src/services/constraint-expander.service.ts`
- Validation schemas: `recommender_api/src/schemas/search.schema.ts`
