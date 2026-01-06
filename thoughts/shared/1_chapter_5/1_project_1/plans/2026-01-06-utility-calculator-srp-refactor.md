# Utility Calculator SRP Refactor Implementation Plan

## Overview

Refactor `utility-calculator.service.ts` (~980 lines) into a well-organized module structure following Single Responsibility Principle. The current file mixes type definitions, multiple scoring concerns, and orchestration logic with block comments as separators.

## Current State Analysis

### File Structure Issues
1. **Interfaces scattered throughout** (lines 30-104, 240-260, 389-394) - not at the top
2. **Block comments as section separators** (line 236-238) - code smell indicating natural split points
3. **Duplication** - `WithDetails` and non-`WithDetails` variants doing nearly the same work
4. **Two orchestration functions** - `calculateUtilityScore` and `calculateUtilityWithBreakdown` duplicate most logic

### Current Responsibilities
| Concern | Lines | Functions |
|---------|-------|-----------|
| Type definitions | ~80 | 9 interfaces |
| Skill scoring | ~100 | `calculateSkillMatch`, `calculatePreferredSkillsMatch*`, `calculateTeamFocusMatch*`, `calculateRelatedSkillsMatch*` |
| Domain scoring | ~80 | `calculatePreferredBusinessDomainMatch*`, `calculatePreferredTechnicalDomainMatch*` |
| Preference scoring | ~130 | `calculateStartTimelineMatch`, `calculatePreferredTimezoneMatch`, `calculatePreferredSeniorityMatch`, `calculatePreferredSalaryRangeMatch` |
| Core attribute scoring | ~70 | `calculateConfidenceUtility`, `calculateExperienceUtility`, `calculateSalaryUtility`, `normalizeLinear`, `normalizeLinearInverse` |
| Orchestration | ~250 | `calculateUtilityWithBreakdown`, `calculateUtilityScore`, `scoreAndSortEngineers`, `calculateWeighted` |

### Key Discovery
The codebase already has a pattern for module organization: `cypher-query-builder/` uses an `index.ts` barrel file that re-exports types and functions from specialized files. We should follow this pattern.

## Desired End State

```
recommender_api/src/services/utility-calculator/
├── index.ts                    # Barrel file - exports public API
├── types.ts                    # All interfaces (~80 lines)
├── scoring/
│   ├── skill-scoring.ts        # Skill match calculations (~120 lines)
│   ├── domain-scoring.ts       # Business/technical domain (~80 lines)
│   ├── preference-scoring.ts   # Timeline, timezone, seniority, salary (~130 lines)
│   └── core-scoring.ts         # Confidence, experience, salary normalization (~70 lines)
└── utility-calculator.ts       # Orchestration only (~150 lines)
```

### Verification
- `npm run typecheck` passes
- `npm run build` passes
- `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json` passes (API behavior unchanged)
- Only export surface: `scoreAndSortEngineers`, `calculateUtilityWithBreakdown`, `EngineerData`, `UtilityContext`, `ScoredEngineer`

## What We're NOT Doing

- **Not changing any scoring logic** - pure structural refactor
- **Not changing the config structure** - `utility.config.ts` stays as-is
- **Not adding new functionality**
- **Not renaming exported types/functions** - import paths change but API surface remains identical

## Implementation Approach

Extract from inside-out: types first, then leaf scoring functions, then orchestration. Each phase is independently verifiable.

---

## Phase 1: Create Directory Structure and Types Module

### Overview
Create the new directory structure and extract all interfaces to `types.ts`.

### Changes Required:

#### 1. Create directory structure
```bash
mkdir -p recommender_api/src/services/utility-calculator/scoring
```

#### 2. Create `types.ts`
**File**: `recommender_api/src/services/utility-calculator/types.ts`

Extract these interfaces from `utility-calculator.service.ts`:
- `EngineerData` (lines 30-43)
- `UtilityContext` (lines 45-67)
- `ScoredEngineer` (lines 69-72)
- `UtilityCalculationResult` (lines 76-79)
- `TeamFocusMatchResult` (lines 81-84)
- `PreferredSkillsMatchResult` (lines 86-89)
- `RelatedSkillsMatchResult` (lines 91-94)
- `PreferredBusinessDomainMatchResult` (lines 96-99)
- `PreferredTechnicalDomainMatchResult` (lines 101-104)
- `StartTimelineMatchResult` (lines 240-244)
- `PreferredTimezoneMatchResult` (lines 246-250)
- `PreferredSeniorityMatchResult` (lines 252-255)
- `PreferredSalaryRangeMatchResult` (lines 257-260)
- `SkillMatchResult` (lines 389-394)

```typescript
/**
 * Utility Calculator Types
 * Type definitions for utility scoring calculations.
 */

import type {
  MatchedSkill,
  UnmatchedRelatedSkill,
  ScoreBreakdown,
  SeniorityLevel,
  ProficiencyLevel,
  StartTimeline,
  BusinessDomainMatch,
  TechnicalDomainMatch,
} from '../../types/search.types.js';
import type {
  ResolvedBusinessDomain,
  ResolvedTechnicalDomain,
} from '../cypher-query-builder/query-types.js';

// ============================================
// PUBLIC API TYPES (exported from index.ts)
// ============================================

export interface EngineerData {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  startTimeline: string;
  timezone: string;
  matchedSkills: MatchedSkill[];
  unmatchedRelatedSkills: UnmatchedRelatedSkill[];
  avgConfidence: number;
  matchedBusinessDomains: BusinessDomainMatch[];
  matchedTechnicalDomains: TechnicalDomainMatch[];
}

export interface UtilityContext {
  requiredSkillIds: string[];
  preferredSkillIds: string[];
  preferredBusinessDomains: ResolvedBusinessDomain[];
  preferredTechnicalDomains: ResolvedTechnicalDomain[];
  alignedSkillIds: string[];
  maxSalaryBudget: number | null;
  preferredSeniorityLevel: SeniorityLevel | null;
  preferredMaxStartTime: StartTimeline | null;
  requiredMaxStartTime: StartTimeline | null;
  preferredTimezone: string[];
  preferredSalaryRange: { min: number; max: number } | null;
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>;
}

export interface ScoredEngineer extends EngineerData {
  utilityScore: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface UtilityCalculationResult {
  utilityScore: number;
  scoreBreakdown: ScoreBreakdown;
}

// ============================================
// INTERNAL RESULT TYPES (used by scoring modules)
// ============================================

export interface SkillMatchResult {
  score: number;
  skillsExceedingPreferred: string[];
}

export interface PreferredSkillsMatchResult {
  raw: number;
  matchedSkillNames: string[];
}

export interface TeamFocusMatchResult {
  raw: number;
  matchedSkillNames: string[];
}

export interface RelatedSkillsMatchResult {
  raw: number;
  count: number;
}

export interface PreferredBusinessDomainMatchResult {
  raw: number;
  matchedDomainNames: string[];
}

export interface PreferredTechnicalDomainMatchResult {
  raw: number;
  matchedDomainNames: string[];
}

export interface StartTimelineMatchResult {
  raw: number;
  matchedStartTimeline: string | null;
  withinPreferred: boolean;
}

export interface PreferredTimezoneMatchResult {
  raw: number;
  matchedTimezone: string | null;
  rank: number;
}

export interface PreferredSeniorityMatchResult {
  raw: number;
  matchedLevel: boolean;
}

export interface PreferredSalaryRangeMatchResult {
  raw: number;
  inPreferredRange: boolean;
}
```

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] File exists at `recommender_api/src/services/utility-calculator/types.ts`

---

## Phase 2: Extract Core Scoring Functions

### Overview
Extract normalization and core attribute utility functions.

### Changes Required:

**File**: `recommender_api/src/services/utility-calculator/scoring/core-scoring.ts`

```typescript
/**
 * Core Scoring Functions
 * Normalization utilities and core attribute utility calculations.
 */

/**
 * Normalizes a value to [0, 1] using linear scaling.
 */
export function normalizeLinear(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Normalizes a value to [0, 1] using inverse linear scaling.
 * Lower values get higher scores.
 */
export function normalizeLinearInverse(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (max - value) / (max - min)));
}

/**
 * Calculates confidence score utility.
 * Linear function between min and max.
 */
export function calculateConfidenceUtility(
  avgConfidence: number,
  min: number,
  max: number
): number {
  if (avgConfidence <= 0) {
    return 0.5; // Neutral when no skill filtering is applied
  }
  return normalizeLinear(avgConfidence, min, max);
}

/**
 * Calculates years of experience utility.
 * Logarithmic function with diminishing returns.
 */
export function calculateExperienceUtility(
  yearsExperience: number,
  maxYears: number
): number {
  const logYears = Math.log(1 + yearsExperience);
  const logMax = Math.log(1 + maxYears);
  return Math.min(logYears / logMax, 1);
}

/**
 * Calculates salary utility.
 * Inverse linear: lower salary = higher utility (budget fit).
 */
export function calculateSalaryUtility(
  salary: number,
  maxBudget: number | null,
  minSalary: number,
  maxSalary: number
): number {
  if (maxBudget === null) {
    return normalizeLinearInverse(salary, minSalary, maxSalary);
  }
  if (salary > maxBudget) {
    return 0;
  }
  return normalizeLinearInverse(salary, minSalary, maxBudget);
}
```

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] File exists at `recommender_api/src/services/utility-calculator/scoring/core-scoring.ts`

---

## Phase 3: Extract Skill Scoring Functions

### Overview
Extract all skill-related scoring calculations. Remove duplicate non-`WithDetails` functions - use `WithDetails` versions only.

### Changes Required:

**File**: `recommender_api/src/services/utility-calculator/scoring/skill-scoring.ts`

```typescript
/**
 * Skill Scoring Functions
 * Calculates utility scores for skill matches.
 */

import type { MatchedSkill, UnmatchedRelatedSkill, ProficiencyLevel } from '../../../types/search.types.js';
import type {
  SkillMatchResult,
  PreferredSkillsMatchResult,
  TeamFocusMatchResult,
  RelatedSkillsMatchResult,
} from '../types.js';

/**
 * Unified skill match scoring that combines coverage and proficiency matching.
 */
export function calculateSkillMatch(
  matchedSkills: MatchedSkill[],
  requiredSkillIds: string[],
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>
): SkillMatchResult {
  if (requiredSkillIds.length === 0) {
    return { score: 0.5, skillsExceedingPreferred: [] };
  }

  const proficiencyOrder: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];
  const skillsExceedingPreferred: string[] = [];
  let totalCredit = 0;

  const matchedSkillMap = new Map(matchedSkills.map(s => [s.skillId, s]));

  for (const skillId of requiredSkillIds) {
    const matchedSkill = matchedSkillMap.get(skillId);

    if (!matchedSkill) {
      continue;
    }

    const preferredLevel = skillIdToPreferredProficiency.get(skillId);

    if (preferredLevel) {
      const preferredIndex = proficiencyOrder.indexOf(preferredLevel);
      const actualIndex = proficiencyOrder.indexOf(matchedSkill.proficiencyLevel as ProficiencyLevel);
      const credit = Math.min(1.0, (actualIndex + 1) / (preferredIndex + 1));
      totalCredit += credit;

      if (actualIndex >= preferredIndex) {
        skillsExceedingPreferred.push(matchedSkill.skillName);
      }
    } else {
      totalCredit += 1.0;
    }
  }

  const score = totalCredit / requiredSkillIds.length;

  return { score, skillsExceedingPreferred };
}

/**
 * Calculates preferred skills match utility with matched skill details.
 */
export function calculatePreferredSkillsMatch(
  matchedSkills: MatchedSkill[],
  preferredSkillIds: string[],
  maxMatch: number
): PreferredSkillsMatchResult {
  if (preferredSkillIds.length === 0) {
    return { raw: 0, matchedSkillNames: [] };
  }

  const matchingPreferredSkills = matchedSkills.filter((skill) =>
    preferredSkillIds.includes(skill.skillId)
  );

  const matchRatio = matchingPreferredSkills.length / preferredSkillIds.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedSkillNames: matchingPreferredSkills.map((s) => s.skillName),
  };
}

/**
 * Calculates team focus match utility with matched skill details.
 */
export function calculateTeamFocusMatch(
  matchedSkills: MatchedSkill[],
  alignedSkillIds: string[],
  maxMatch: number
): TeamFocusMatchResult {
  if (alignedSkillIds.length === 0) {
    return { raw: 0, matchedSkillNames: [] };
  }

  const matchingAlignedSkills = matchedSkills.filter((skill) =>
    alignedSkillIds.includes(skill.skillId)
  );

  const matchRatio = matchingAlignedSkills.length / alignedSkillIds.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedSkillNames: matchingAlignedSkills.map((s) => s.skillName),
  };
}

/**
 * Calculates related skills match utility.
 * Uses diminishing returns curve for breadth of experience.
 */
export function calculateRelatedSkillsMatch(
  unmatchedRelatedSkills: UnmatchedRelatedSkill[],
  maxMatch: number
): RelatedSkillsMatchResult {
  const count = unmatchedRelatedSkills.length;

  if (count === 0) {
    return { raw: 0, count: 0 };
  }

  const raw = Math.min((1 - Math.exp(-count / maxMatch)) * maxMatch, maxMatch);

  return { raw, count };
}
```

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] File exists at `recommender_api/src/services/utility-calculator/scoring/skill-scoring.ts`

---

## Phase 4: Extract Domain Scoring Functions

### Overview
Extract business and technical domain scoring calculations.

### Changes Required:

**File**: `recommender_api/src/services/utility-calculator/scoring/domain-scoring.ts`

```typescript
/**
 * Domain Scoring Functions
 * Calculates utility scores for business and technical domain matches.
 */

import type { BusinessDomainMatch, TechnicalDomainMatch } from '../../../types/search.types.js';
import type { ResolvedBusinessDomain, ResolvedTechnicalDomain } from '../../cypher-query-builder/query-types.js';
import type {
  PreferredBusinessDomainMatchResult,
  PreferredTechnicalDomainMatchResult,
} from '../types.js';

/**
 * Calculates preferred business domain match utility with matched domain details.
 */
export function calculatePreferredBusinessDomainMatch(
  matchedBusinessDomains: BusinessDomainMatch[],
  preferredBusinessDomains: ResolvedBusinessDomain[],
  maxMatch: number
): PreferredBusinessDomainMatchResult {
  if (preferredBusinessDomains.length === 0) {
    return { raw: 0, matchedDomainNames: [] };
  }

  const matchingDomains = matchedBusinessDomains.filter((d) => d.meetsPreferred);

  const matchRatio = matchingDomains.length / preferredBusinessDomains.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedDomainNames: matchingDomains.map((d) => d.domainName),
  };
}

/**
 * Calculates preferred technical domain match utility with matched domain details.
 */
export function calculatePreferredTechnicalDomainMatch(
  matchedTechnicalDomains: TechnicalDomainMatch[],
  preferredTechnicalDomains: ResolvedTechnicalDomain[],
  maxMatch: number
): PreferredTechnicalDomainMatchResult {
  if (preferredTechnicalDomains.length === 0) {
    return { raw: 0, matchedDomainNames: [] };
  }

  const matchingDomains = matchedTechnicalDomains.filter((d) => d.meetsPreferred);

  const matchRatio = matchingDomains.length / preferredTechnicalDomains.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedDomainNames: matchingDomains.map((d) => d.domainName),
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] File exists at `recommender_api/src/services/utility-calculator/scoring/domain-scoring.ts`

---

## Phase 5: Extract Preference Scoring Functions

### Overview
Extract timeline, timezone, seniority, and salary preference scoring.

### Changes Required:

**File**: `recommender_api/src/services/utility-calculator/scoring/preference-scoring.ts`

```typescript
/**
 * Preference Scoring Functions
 * Calculates utility scores for user preference matches.
 */

import type { SeniorityLevel, StartTimeline } from '../../../types/search.types.js';
import { START_TIMELINE_ORDER } from '../../../types/search.types.js';
import type {
  StartTimelineMatchResult,
  PreferredTimezoneMatchResult,
  PreferredSeniorityMatchResult,
  PreferredSalaryRangeMatchResult,
} from '../types.js';

/**
 * Calculates start timeline match using threshold-based scoring.
 */
export function calculateStartTimelineMatch(
  engineerStartTimeline: StartTimeline,
  preferredMaxStartTime: StartTimeline | null,
  requiredMaxStartTime: StartTimeline | null,
  maxMatch: number
): StartTimelineMatchResult {
  if (!preferredMaxStartTime && !requiredMaxStartTime) {
    return { raw: 0, matchedStartTimeline: null, withinPreferred: false };
  }

  const engineerIdx = START_TIMELINE_ORDER.indexOf(engineerStartTimeline);

  if (preferredMaxStartTime && !requiredMaxStartTime) {
    const preferredIdx = START_TIMELINE_ORDER.indexOf(preferredMaxStartTime);
    const withinPreferred = engineerIdx <= preferredIdx;
    return {
      raw: withinPreferred ? maxMatch : 0,
      matchedStartTimeline: engineerStartTimeline,
      withinPreferred,
    };
  }

  if (!preferredMaxStartTime && requiredMaxStartTime) {
    return { raw: 0, matchedStartTimeline: engineerStartTimeline, withinPreferred: false };
  }

  const preferredIdx = START_TIMELINE_ORDER.indexOf(preferredMaxStartTime!);
  const requiredIdx = START_TIMELINE_ORDER.indexOf(requiredMaxStartTime!);

  if (engineerIdx <= preferredIdx) {
    return { raw: maxMatch, matchedStartTimeline: engineerStartTimeline, withinPreferred: true };
  } else if (engineerIdx <= requiredIdx) {
    const score = maxMatch * (1 - (engineerIdx - preferredIdx) / (requiredIdx - preferredIdx));
    return { raw: score, matchedStartTimeline: engineerStartTimeline, withinPreferred: false };
  }

  return { raw: 0, matchedStartTimeline: engineerStartTimeline, withinPreferred: false };
}

/**
 * Calculates preferred timezone match.
 * Matches against prefix patterns in preference order.
 */
export function calculatePreferredTimezoneMatch(
  engineerTimezone: string,
  preferredTimezone: string[],
  maxMatch: number
): PreferredTimezoneMatchResult {
  if (preferredTimezone.length === 0) {
    return { raw: 0, matchedTimezone: null, rank: -1 };
  }

  for (let i = 0; i < preferredTimezone.length; i++) {
    const pattern = preferredTimezone[i].replace(/\*$/, '');
    if (engineerTimezone.startsWith(pattern) || engineerTimezone === preferredTimezone[i]) {
      const positionMultiplier = 1 - (i / preferredTimezone.length);
      const raw = positionMultiplier * maxMatch;
      return { raw, matchedTimezone: preferredTimezone[i], rank: i };
    }
  }

  return { raw: 0, matchedTimezone: null, rank: -1 };
}

/**
 * Calculates preferred seniority match.
 * Full score if engineer meets or exceeds preferred level.
 */
export function calculatePreferredSeniorityMatch(
  engineerYearsExperience: number,
  preferredSeniorityLevel: SeniorityLevel | null,
  maxMatch: number
): PreferredSeniorityMatchResult {
  if (!preferredSeniorityLevel) {
    return { raw: 0, matchedLevel: false };
  }

  const seniorityMinYears: Record<SeniorityLevel, number> = {
    junior: 0,
    mid: 3,
    senior: 6,
    staff: 10,
    principal: 15,
  };

  const requiredYears = seniorityMinYears[preferredSeniorityLevel];
  const matchedLevel = engineerYearsExperience >= requiredYears;

  return { raw: matchedLevel ? maxMatch : 0, matchedLevel };
}

/**
 * Calculates preferred salary range match.
 * Full score if salary is within preferred range.
 */
export function calculatePreferredSalaryRangeMatch(
  engineerSalary: number,
  preferredSalaryRange: { min: number; max: number } | null,
  maxMatch: number
): PreferredSalaryRangeMatchResult {
  if (!preferredSalaryRange) {
    return { raw: 0, inPreferredRange: false };
  }

  const inPreferredRange = engineerSalary >= preferredSalaryRange.min &&
                           engineerSalary <= preferredSalaryRange.max;

  return { raw: inPreferredRange ? maxMatch : 0, inPreferredRange };
}
```

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] File exists at `recommender_api/src/services/utility-calculator/scoring/preference-scoring.ts`

---

## Phase 6: Create Main Orchestration Module

### Overview
Create the main `utility-calculator.ts` with orchestration logic only. Remove duplicate `calculateUtilityScore` function - have it call `calculateUtilityWithBreakdown` instead.

### Changes Required:

**File**: `recommender_api/src/services/utility-calculator/utility-calculator.ts`

```typescript
/**
 * Utility Calculator Service
 * Implements Section 5.2.3 - Ranking the Matched Items
 *
 * Formula: U(V) = Σ w_j * f_j(v_j)
 * Where:
 *   w_j = weight of attribute j
 *   f_j(v_j) = utility function applied to attribute value
 */

import type { CoreScores, PreferenceMatches, StartTimeline } from '../../types/search.types.js';
import { knowledgeBaseConfig } from '../../config/knowledge-base/index.js';
import type {
  EngineerData,
  UtilityContext,
  ScoredEngineer,
  UtilityCalculationResult,
} from './types.js';

// Import scoring functions
import {
  calculateConfidenceUtility,
  calculateExperienceUtility,
  calculateSalaryUtility,
} from './scoring/core-scoring.js';
import {
  calculateSkillMatch,
  calculatePreferredSkillsMatch,
  calculateTeamFocusMatch,
  calculateRelatedSkillsMatch,
} from './scoring/skill-scoring.js';
import {
  calculatePreferredBusinessDomainMatch,
  calculatePreferredTechnicalDomainMatch,
} from './scoring/domain-scoring.js';
import {
  calculateStartTimelineMatch,
  calculatePreferredTimezoneMatch,
  calculatePreferredSeniorityMatch,
  calculatePreferredSalaryRangeMatch,
} from './scoring/preference-scoring.js';

const config = knowledgeBaseConfig;

function calculateWeighted(raw: number, weight: number): number {
  return Math.round(raw * weight * 1000) / 1000;
}

/**
 * Calculates utility score with full breakdown for transparency.
 */
export function calculateUtilityWithBreakdown(
  engineer: EngineerData,
  context: UtilityContext
): UtilityCalculationResult {
  const weights = config.utilityWeights;
  const params = config.utilityParams;

  // Calculate unified skill match (coverage + proficiency in one score)
  const skillMatchResult = calculateSkillMatch(
    engineer.matchedSkills,
    context.requiredSkillIds,
    context.skillIdToPreferredProficiency
  );
  const skillMatchRaw = skillMatchResult.score;

  const confidenceRaw = calculateConfidenceUtility(
    engineer.avgConfidence,
    params.confidenceMin,
    params.confidenceMax
  );

  const experienceRaw = calculateExperienceUtility(
    engineer.yearsExperience,
    params.yearsExperienceMax
  );

  const salaryRaw = calculateSalaryUtility(
    engineer.salary,
    context.maxSalaryBudget,
    params.salaryMin,
    params.salaryMax
  );

  const preferredSkillsResult = calculatePreferredSkillsMatch(
    engineer.matchedSkills,
    context.preferredSkillIds,
    params.preferredSkillsMatchMax
  );

  const teamFocusResult = calculateTeamFocusMatch(
    engineer.matchedSkills,
    context.alignedSkillIds,
    params.teamFocusMatchMax
  );

  const relatedSkillsResult = calculateRelatedSkillsMatch(
    engineer.unmatchedRelatedSkills,
    params.relatedSkillsMatchMax
  );

  const preferredBusinessDomainResult = calculatePreferredBusinessDomainMatch(
    engineer.matchedBusinessDomains,
    context.preferredBusinessDomains,
    params.preferredBusinessDomainMatchMax
  );

  const preferredTechnicalDomainResult = calculatePreferredTechnicalDomainMatch(
    engineer.matchedTechnicalDomains,
    context.preferredTechnicalDomains,
    params.preferredTechnicalDomainMatchMax
  );

  const startTimelineResult = calculateStartTimelineMatch(
    engineer.startTimeline as StartTimeline,
    context.preferredMaxStartTime,
    context.requiredMaxStartTime,
    params.startTimelineMatchMax
  );

  const preferredTimezoneResult = calculatePreferredTimezoneMatch(
    engineer.timezone,
    context.preferredTimezone,
    params.preferredTimezoneMatchMax
  );

  const preferredSeniorityResult = calculatePreferredSeniorityMatch(
    engineer.yearsExperience,
    context.preferredSeniorityLevel,
    params.preferredSeniorityMatchMax
  );

  const preferredSalaryRangeResult = calculatePreferredSalaryRangeMatch(
    engineer.salary,
    context.preferredSalaryRange,
    params.preferredSalaryRangeMatchMax
  );

  // Calculate core weighted scores
  const coreScores: CoreScores = {
    skillMatch: calculateWeighted(skillMatchRaw, weights.skillMatch),
    confidence: calculateWeighted(confidenceRaw, weights.confidenceScore),
    experience: calculateWeighted(experienceRaw, weights.yearsExperience),
    salary: calculateWeighted(salaryRaw, weights.salary),
  };

  // Calculate match weighted scores
  const matchScores = {
    preferredSkillsMatch: calculateWeighted(preferredSkillsResult.raw, weights.preferredSkillsMatch),
    teamFocusMatch: calculateWeighted(teamFocusResult.raw, weights.teamFocusMatch),
    relatedSkillsMatch: calculateWeighted(relatedSkillsResult.raw, weights.relatedSkillsMatch),
    preferredBusinessDomainMatch: calculateWeighted(preferredBusinessDomainResult.raw, weights.preferredBusinessDomainMatch),
    preferredTechnicalDomainMatch: calculateWeighted(preferredTechnicalDomainResult.raw, weights.preferredTechnicalDomainMatch),
    startTimelineMatch: calculateWeighted(startTimelineResult.raw, weights.startTimelineMatch),
    preferredTimezoneMatch: calculateWeighted(preferredTimezoneResult.raw, weights.preferredTimezoneMatch),
    preferredSeniorityMatch: calculateWeighted(preferredSeniorityResult.raw, weights.preferredSeniorityMatch),
    preferredSalaryRangeMatch: calculateWeighted(preferredSalaryRangeResult.raw, weights.preferredSalaryRangeMatch),
  };

  // Sum all weighted scores
  const total = Object.values(coreScores).reduce((sum, score) => sum + score, 0)
    + Object.values(matchScores).reduce((sum, score) => sum + score, 0);

  // Filter core scores - only include non-zero values
  const scores: Partial<CoreScores> = {};
  for (const [key, value] of Object.entries(coreScores)) {
    if (value > 0) {
      scores[key as keyof CoreScores] = value;
    }
  }

  // Build preference matches - only include non-zero matches with their data
  const preferenceMatches: PreferenceMatches = {};

  if (matchScores.preferredSkillsMatch > 0) {
    preferenceMatches.preferredSkillsMatch = {
      score: matchScores.preferredSkillsMatch,
      matchedSkills: preferredSkillsResult.matchedSkillNames,
    };
  }
  if (matchScores.teamFocusMatch > 0) {
    preferenceMatches.teamFocusMatch = {
      score: matchScores.teamFocusMatch,
      matchedSkills: teamFocusResult.matchedSkillNames,
    };
  }
  if (matchScores.relatedSkillsMatch > 0) {
    preferenceMatches.relatedSkillsMatch = {
      score: matchScores.relatedSkillsMatch,
      count: relatedSkillsResult.count,
    };
  }
  if (matchScores.preferredBusinessDomainMatch > 0) {
    preferenceMatches.preferredBusinessDomainMatch = {
      score: matchScores.preferredBusinessDomainMatch,
      matchedDomains: preferredBusinessDomainResult.matchedDomainNames,
    };
  }
  if (matchScores.preferredTechnicalDomainMatch > 0) {
    preferenceMatches.preferredTechnicalDomainMatch = {
      score: matchScores.preferredTechnicalDomainMatch,
      matchedDomains: preferredTechnicalDomainResult.matchedDomainNames,
    };
  }
  if (matchScores.startTimelineMatch > 0) {
    preferenceMatches.startTimelineMatch = {
      score: matchScores.startTimelineMatch,
      matchedStartTimeline: startTimelineResult.matchedStartTimeline!,
      withinPreferred: startTimelineResult.withinPreferred,
    };
  }
  if (matchScores.preferredTimezoneMatch > 0) {
    preferenceMatches.preferredTimezoneMatch = {
      score: matchScores.preferredTimezoneMatch,
      matchedTimezone: preferredTimezoneResult.matchedTimezone!,
      rank: preferredTimezoneResult.rank,
    };
  }
  if (matchScores.preferredSeniorityMatch > 0) {
    preferenceMatches.preferredSeniorityMatch = {
      score: matchScores.preferredSeniorityMatch,
    };
  }
  if (matchScores.preferredSalaryRangeMatch > 0) {
    preferenceMatches.preferredSalaryRangeMatch = {
      score: matchScores.preferredSalaryRangeMatch,
    };
  }

  const utilityScore = Math.round(total * 100) / 100;

  return {
    utilityScore,
    scoreBreakdown: {
      scores,
      preferenceMatches,
      total: utilityScore,
    },
  };
}

/**
 * Calculates utility score for a single engineer.
 * Delegates to calculateUtilityWithBreakdown and extracts the score.
 */
export function calculateUtilityScore(
  engineer: EngineerData,
  context: UtilityContext
): number {
  return calculateUtilityWithBreakdown(engineer, context).utilityScore;
}

/**
 * Scores and sorts a list of engineers by utility score.
 */
export function scoreAndSortEngineers(
  engineers: EngineerData[],
  context: UtilityContext
): ScoredEngineer[] {
  return engineers
    .map((engineer) => {
      const { utilityScore, scoreBreakdown } = calculateUtilityWithBreakdown(
        engineer,
        context
      );
      return {
        ...engineer,
        utilityScore,
        scoreBreakdown,
      };
    })
    .sort((a, b) => b.utilityScore - a.utilityScore);
}
```

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] File exists at `recommender_api/src/services/utility-calculator/utility-calculator.ts`

---

## Phase 7: Create Barrel File and Update Imports

### Overview
Create `index.ts` barrel file that maintains backward-compatible exports, then update `search.service.ts` import path.

### Changes Required:

#### 1. Create barrel file
**File**: `recommender_api/src/services/utility-calculator/index.ts`

```typescript
/**
 * Utility Calculator Module
 * Exports the public API for utility score calculation.
 */

// Re-export public types
export type {
  EngineerData,
  UtilityContext,
  ScoredEngineer,
  UtilityCalculationResult,
} from './types.js';

// Re-export public functions
export {
  calculateUtilityWithBreakdown,
  calculateUtilityScore,
  scoreAndSortEngineers,
} from './utility-calculator.js';
```

#### 2. Update import in search.service.ts
**File**: `recommender_api/src/services/search.service.ts`

Change line 25-29 from:
```typescript
import {
  scoreAndSortEngineers,
  type EngineerData,
  type UtilityContext,
} from "./utility-calculator.service.js";
```

To:
```typescript
import {
  scoreAndSortEngineers,
  type EngineerData,
  type UtilityContext,
} from "./utility-calculator/index.js";
```

#### 3. Delete old file
Delete `recommender_api/src/services/utility-calculator.service.ts`

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] `npm run build` passes
- [x] `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json` passes
- [x] Old file `utility-calculator.service.ts` is deleted
- [x] `index.ts` barrel file exists

#### Manual Verification:
- [x] API returns identical responses before and after refactor (compare a few search queries)

---

## Testing Strategy

### Automated Tests
The existing Newman/Postman tests validate API behavior end-to-end. Since this is a pure structural refactor with no logic changes, passing tests confirm correctness.

### Manual Verification
1. Run a search query before refactor, save response
2. Complete refactor
3. Run same search query, compare response matches expected

---

## Summary of Changes

| Before | After |
|--------|-------|
| 1 file, 980 lines | 7 files, ~600 lines total |
| Interfaces scattered | All types in `types.ts` |
| Block comment separators | Natural module boundaries |
| Duplicate WithDetails/non-WithDetails | Single implementation per function |
| Duplicate calculateUtilityScore | Delegates to calculateUtilityWithBreakdown |

### Final File Structure
```
utility-calculator/
├── index.ts                    (~15 lines)
├── types.ts                    (~100 lines)
├── utility-calculator.ts       (~200 lines)
└── scoring/
    ├── core-scoring.ts         (~60 lines)
    ├── skill-scoring.ts        (~100 lines)
    ├── domain-scoring.ts       (~50 lines)
    └── preference-scoring.ts   (~100 lines)
```

## References

- Current file: `recommender_api/src/services/utility-calculator.service.ts`
- Similar pattern: `recommender_api/src/services/cypher-query-builder/` (barrel file organization)
- Config: `recommender_api/src/config/knowledge-base/utility.config.ts`
- Consumer: `recommender_api/src/services/search.service.ts:25-29`
