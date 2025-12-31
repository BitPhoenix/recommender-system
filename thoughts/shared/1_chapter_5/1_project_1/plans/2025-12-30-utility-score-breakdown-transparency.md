# Utility Score Breakdown Transparency Implementation Plan

## Overview

Add a `scoreBreakdown` field to the API response that explains **why** each engineer received their utility score. Currently, the response shows only an opaque `utilityScore: 0.58` with no visibility into how that score was computed.

## Current State Analysis

The `calculateUtilityScore` function in `utility-calculator.service.ts:46-97` computes 6 component scores:
- skillMatch (35% weight)
- confidence (20% weight)
- experience (15% weight)
- availability (15% weight)
- salary (10% weight)
- teamFocusBonus (5% weight)

But it only returns the final weighted sum. The `EngineerMatch` interface in `search.types.ts:59-70` has no breakdown field.

### Key Discoveries:
- Weights are defined in `knowledge-base.config.ts` under `utilityWeights`
- Bonus skills for teamFocus are tracked in `expanded.bonusSkillIds` (search.service.ts:133)
- The `scoreAndSortEngineers` function returns `ScoredEngineer` which only has `utilityScore` and `matchStrength`

## Desired End State

API responses include a `scoreBreakdown` field showing:
1. Each component's raw score (0-1)
2. The weight applied
3. The weighted contribution
4. For teamFocusBonus: which bonus skills matched

Example response:
```json
{
  "id": "eng_marcus",
  "name": "Marcus Chen",
  "utilityScore": 0.58,
  "matchStrength": "moderate",
  "scoreBreakdown": {
    "components": {
      "skillMatch":     { "raw": 0.50, "weight": 0.35, "weighted": 0.175 },
      "confidence":     { "raw": 0.80, "weight": 0.20, "weighted": 0.160 },
      "experience":     { "raw": 0.65, "weight": 0.15, "weighted": 0.098 },
      "availability":   { "raw": 1.00, "weight": 0.15, "weighted": 0.150 },
      "salary":         { "raw": 0.00, "weight": 0.10, "weighted": 0.000 },
      "teamFocusBonus": { "raw": 0.25, "weight": 0.05, "weighted": 0.013, "matchedSkills": ["System Design"] }
    },
    "total": 0.58
  }
}
```

### Verification:
- Run existing Postman tests - all should pass (backward compatible, adds field)
- Verify breakdown sums to utilityScore
- Verify matchedSkills in teamFocusBonus are populated correctly

## What We're NOT Doing

- Not adding a query parameter to optionally exclude breakdown (always include it)
- Not changing the ranking algorithm itself
- Not modifying how weights are configured

## Implementation Approach

1. Add types for the breakdown structure
2. Modify utility calculator to return breakdown alongside score
3. Update search service to pass breakdown through to response

---

## Phase 1: Add ScoreBreakdown Types

### Overview
Define TypeScript interfaces for the score breakdown structure.

### Changes Required:

#### 1. search.types.ts
**File**: `recommender_api/src/types/search.types.ts`
**Changes**: Add new interfaces and update `EngineerMatch`

```typescript
// Add after line 57 (after MatchedSkill interface)

export interface ScoreComponent {
  raw: number;      // Raw utility value (0-1)
  weight: number;   // Weight applied (from config)
  weighted: number; // raw * weight contribution to total
}

export interface TeamFocusBonusComponent extends ScoreComponent {
  matchedSkills: string[];  // Names of bonus skills the engineer has
}

export interface ScoreBreakdown {
  components: {
    skillMatch: ScoreComponent;
    confidence: ScoreComponent;
    experience: ScoreComponent;
    availability: ScoreComponent;
    salary: ScoreComponent;
    teamFocusBonus: TeamFocusBonusComponent;
  };
  total: number;  // Sum of all weighted scores (equals utilityScore)
}
```

```typescript
// Update EngineerMatch interface (line 59-70) to add scoreBreakdown:
export interface EngineerMatch {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  availability: string;
  timezone: string;
  matchedSkills: MatchedSkill[];
  utilityScore: number;
  matchStrength: MatchStrength;
  scoreBreakdown: ScoreBreakdown;  // NEW
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`

---

## Phase 2: Update Utility Calculator to Return Breakdown

### Overview
Modify the utility calculator to compute and return the full breakdown, not just the final score.

### Changes Required:

#### 1. utility-calculator.service.ts
**File**: `recommender_api/src/services/utility-calculator.service.ts`

**Change 1**: Update imports and add new return type

```typescript
// Update imports at top (line 11-16)
import type {
  MatchedSkill,
  MatchStrength,
  AvailabilityOption,
  ScoreBreakdown,
  ScoreComponent,
  TeamFocusBonusComponent,
} from '../types/search.types.js';
```

**Change 2**: Update ScoredEngineer interface (line 36-39)

```typescript
export interface ScoredEngineer extends EngineerData {
  utilityScore: number;
  matchStrength: MatchStrength;
  scoreBreakdown: ScoreBreakdown;  // NEW
}
```

**Change 3**: Create new function to calculate with breakdown (replaces calculateUtilityScore logic)

Add after line 41:

```typescript
export interface UtilityCalculationResult {
  utilityScore: number;
  scoreBreakdown: ScoreBreakdown;
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

  // Calculate individual utility components
  const skillMatchRaw = calculateSkillMatchUtility(
    engineer.matchedSkills,
    context.requestedSkillIds
  );

  const confidenceRaw = calculateConfidenceUtility(
    engineer.avgConfidence,
    params.confidenceMin,
    params.confidenceMax
  );

  const experienceRaw = calculateExperienceUtility(
    engineer.yearsExperience,
    params.yearsExperienceMax
  );

  const availabilityRaw = calculateAvailabilityUtility(
    engineer.availability as AvailabilityOption
  );

  const salaryRaw = calculateSalaryUtility(
    engineer.salary,
    context.maxSalaryBudget,
    params.salaryMin,
    params.salaryMax
  );

  const teamFocusResult = calculateTeamFocusBonusWithDetails(
    engineer.matchedSkills,
    context.bonusSkillIds,
    params.teamFocusBonusMax
  );

  // Build component breakdown
  const components = {
    skillMatch: buildComponent(skillMatchRaw, weights.skillMatch),
    confidence: buildComponent(confidenceRaw, weights.confidenceScore),
    experience: buildComponent(experienceRaw, weights.yearsExperience),
    availability: buildComponent(availabilityRaw, weights.availability),
    salary: buildComponent(salaryRaw, weights.salary),
    teamFocusBonus: {
      ...buildComponent(teamFocusResult.raw, weights.teamFocusBonus),
      matchedSkills: teamFocusResult.matchedSkillNames,
    } as TeamFocusBonusComponent,
  };

  // Sum weighted scores
  const total = Object.values(components).reduce(
    (sum, comp) => sum + comp.weighted,
    0
  );

  const utilityScore = Math.round(total * 100) / 100;

  return {
    utilityScore,
    scoreBreakdown: {
      components,
      total: utilityScore,
    },
  };
}

function buildComponent(raw: number, weight: number): ScoreComponent {
  return {
    raw: Math.round(raw * 100) / 100,
    weight,
    weighted: Math.round(raw * weight * 1000) / 1000,
  };
}
```

**Change 4**: Update teamFocusBonus function to also return matched skill names

Replace `calculateTeamFocusBonusUtility` (lines 197-214) with:

```typescript
interface TeamFocusBonusResult {
  raw: number;
  matchedSkillNames: string[];
}

/**
 * Calculates team focus bonus utility with matched skill details.
 */
function calculateTeamFocusBonusWithDetails(
  matchedSkills: MatchedSkill[],
  bonusSkillIds: string[],
  maxBonus: number
): TeamFocusBonusResult {
  if (bonusSkillIds.length === 0) {
    return { raw: 0, matchedSkillNames: [] };
  }

  // Find which bonus skills the engineer has
  const matchingBonusSkills = matchedSkills.filter((skill) =>
    bonusSkillIds.includes(skill.skillId)
  );

  // Normalize by the number of bonus skills, capped at maxBonus
  const bonusRatio = matchingBonusSkills.length / bonusSkillIds.length;
  const raw = Math.min(bonusRatio * maxBonus, maxBonus);

  return {
    raw,
    matchedSkillNames: matchingBonusSkills.map((s) => s.skillName),
  };
}

// Keep the old function for backward compatibility (though it won't be used)
function calculateTeamFocusBonusUtility(
  matchedSkills: MatchedSkill[],
  bonusSkillIds: string[],
  maxBonus: number
): number {
  return calculateTeamFocusBonusWithDetails(matchedSkills, bonusSkillIds, maxBonus).raw;
}
```

**Change 5**: Update `scoreAndSortEngineers` (lines 251-266) to use new function:

```typescript
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
      const matchStrength = classifyMatchStrength(utilityScore);
      return {
        ...engineer,
        utilityScore,
        matchStrength,
        scoreBreakdown,
      };
    })
    .sort((a, b) => b.utilityScore - a.utilityScore);
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`

---

## Phase 3: Update Search Service to Pass Breakdown Through

### Overview
Update the search service to include the score breakdown in the response.

### Changes Required:

#### 1. search.service.ts
**File**: `recommender_api/src/services/search.service.ts`

**Change 1**: Update the response mapping (lines 152-163):

```typescript
  // Step 7: Format response
  const matches: EngineerMatch[] = scoredEngineers.map((eng) => ({
    id: eng.id,
    name: eng.name,
    headline: eng.headline,
    salary: eng.salary,
    yearsExperience: eng.yearsExperience,
    availability: eng.availability,
    timezone: eng.timezone,
    matchedSkills: eng.matchedSkills,
    utilityScore: eng.utilityScore,
    matchStrength: eng.matchStrength,
    scoreBreakdown: eng.scoreBreakdown,  // NEW
  }));
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] API starts without errors: `npm run dev` (verify no crash)

#### Manual Verification:
- [ ] Send request `{ "teamFocus": "scaling" }` via Postman
- [ ] Verify response includes `scoreBreakdown` for each match
- [ ] Verify `teamFocusBonus.matchedSkills` is populated when engineer has bonus skills
- [ ] Verify `scoreBreakdown.total` equals `utilityScore`
- [ ] Verify component `weighted` values sum to `total`

---

## Testing Strategy

### Manual Testing Steps:
1. Send browse mode request `{}` - verify breakdown shows neutral scores for skillMatch/confidence
2. Send `{ "teamFocus": "scaling" }` - verify matchedSkills populated
3. Send `{ "requiredSkills": ["Node.js"] }` - verify skillMatch component reflects coverage
4. Send `{ "maxSalary": 150000 }` - verify salary component shows 0 for engineers over budget
5. Compare two engineers with different scores - verify breakdown explains the difference

## Files Modified

| File | Change |
|------|--------|
| `recommender_api/src/types/search.types.ts` | Add ScoreBreakdown interfaces, update EngineerMatch |
| `recommender_api/src/services/utility-calculator.service.ts` | Add calculateUtilityWithBreakdown, update scoreAndSortEngineers |
| `recommender_api/src/services/search.service.ts` | Pass scoreBreakdown through to response |

## References

- Utility weights defined in: `recommender_api/src/config/knowledge-base.config.ts:112-119`
- Textbook reference: Section 5.2.3 - Ranking the Matched Items
