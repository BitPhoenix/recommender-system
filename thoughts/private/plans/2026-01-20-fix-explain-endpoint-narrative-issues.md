# Fix Explain Endpoint Narrative Issues Implementation Plan

## Overview

The explain endpoint produces confusing narratives due to two bugs:
1. **Experience score shows 0 years** when engineers have 5-9 years of experience
2. **Preferred skills count shows expanded count** instead of requested count (e.g., "Has 0 of 3 preferred skills" when user requested 1)

This plan fixes both issues by ensuring the explanation generation uses the correct data.

## Current State Analysis

### Issue 1: Experience Score Shows 0 Years

**Data Flow**:
```
Engineer.yearsExperience (e.g., 7)
  → calculateExperienceUtility() → rawScore (e.g., 0.64)  [core-scoring.ts:65-72]
  → calculateWeighted() → weightedScore (e.g., 0.032)     [utility-calculator.ts:137]
  → scoreBreakdown.scores.experience = weightedScore       [utility-calculator.ts:230-231]
  → generateExperienceExplanation(weightedScore)           [score-explanation.service.ts:83]
  → Math.exp(0.032 * Math.log(21)) - 1 ≈ 0 years          [WRONG!]
```

**The Bug**: `generateExperienceExplanation()` receives a **weighted score** but treats it as a **raw normalized score** (0-1). The inverse formula produces 0 years for small weighted values.

**Correct Interpretation**:
- `rawScore = 0.64` means 64% of max experience utility
- `weightedScore = 0.032` means experience contributes 3.2% of total score
- The inverse formula should use rawScore (0.64), not weightedScore (0.032)

### Issue 2: Preferred Skills Count Shows Expanded Count

**Data Flow**:
```
User requests: preferredSkills: [{"skill": "Python"}]   (1 group)
  → Skill resolver expands "Python" descendants          [skill-resolver.service.ts]
  → resolvedPreferredSkillGroups: [{
      originalIdentifier: "Python",
      expandedSkillIds: ["python", "django", "flask"]  (3 skills)
    }]
  → constraint-expander FLATTENS groups into allPreferredSkills  [constraint-expander.service.ts:534-556]
  → preferredSkillIds = ["python", "django", "flask"]   (3 individual IDs)
  → detectMissingPreferredSkills() uses preferredSkillIds.length = 3
  → "Has 0 of 3 preferred skills" [WRONG - should be "0 of 1"]
```

**The Bug**: The original group count (1) is lost during flattening. The tradeoff detector counts expanded skill IDs (3) instead.

### Key Discoveries

1. **Score breakdown stores weighted scores, not raw scores** (`utility-calculator.ts:135-138`)
   - This is intentional for the breakdown display
   - But explanation generation needs raw scores to reverse the formula

2. **Required skills preserve groups, preferred skills flatten** (`constraint-expander.service.ts:508-556`)
   - Required: Creates per-group HAS_ANY filters with `originalSkillId`
   - Preferred: Flattens all groups, losing original count

3. **The skill hierarchy fix was applied to required skills only** (`thoughts/shared/1_chapter_5/6_project_6/plans/2026-01-20-fix-skill-hierarchy-expansion-bug.md`)
   - Preferred skills were not updated to preserve group counts

## Desired End State

After this fix:

1. **Experience explanations show correct years**:
   - Engineer with 7 years shows "Senior level experience (7 years)"
   - Inverse formula uses raw score, not weighted score

2. **Preferred skill tradeoffs show user-requested counts**:
   - User requests 1 skill → "Has 0 of 1 preferred skill groups"
   - OR: "Missing preferred skill: Python (matched 0 of 3 expanded skills)"

### Verification

```bash
# Test 1: Explain endpoint shows correct experience
curl -X POST http://localhost:4025/api/search/filter/eng_priya/explain \
  -H "Content-Type: application/json" \
  -d '{"searchCriteria": {"requiredSkills": [{"skill": "Python"}]}}'

# Expected: Score explanation shows "Senior level experience (7 years)" or similar
# NOT: "Junior level experience (0 years)"

# Test 2: Preferred skills show correct count
curl -X POST http://localhost:4025/api/search/filter/eng_marcus/explain \
  -H "Content-Type: application/json" \
  -d '{"searchCriteria": {"preferredSkills": [{"skill": "Python"}]}}'

# Expected: Tradeoff shows "Has X of 1 preferred skill groups"
# NOT: "Has 0 of 3 preferred skills"
```

## What We're NOT Doing

1. **Not changing the utility calculation itself** - the weighted scores are correct for ranking
2. **Not changing how scoreBreakdown is structured** - other consumers may depend on it
3. **Not changing required skills handling** - that was fixed in a previous plan
4. **Not modifying the skill hierarchy data** - CHILD_OF relationships remain unchanged

## Implementation Approach

### Issue 1 Strategy: Add Raw Scores to Score Breakdown

The cleanest fix is to include both raw and weighted scores in the breakdown structure. This allows explanation services to use raw scores for reverse calculations while preserving weighted scores for display.

### Issue 2 Strategy: Preserve Original Group Count

Pass the original number of preferred skill groups to the tradeoff detector, separate from the flattened skill IDs. This allows accurate messaging while maintaining the current flattening for ranking calculations.

---

## Phase 1: Fix Experience Score Explanation

### Overview

Add raw scores to the score breakdown so explanation generation can reverse formulas correctly.

### Changes Required

#### 1. Update CoreScores type to include raw scores

**File**: `recommender_api/src/types/search.types.ts`

```typescript
// Core scores (always present if > 0)
export interface CoreScores {
  skillMatch: number;      // weighted score
  confidence: number;      // weighted score
  experience: number;      // weighted score
}

// Add new type for raw scores
export interface RawCoreScores {
  skillMatch: number;      // 0-1 normalized
  confidence: number;      // 0-1 normalized
  experience: number;      // 0-1 normalized
}
```

#### 2. Update ScoreBreakdown to include raw scores

**File**: `recommender_api/src/types/search.types.ts`

```typescript
export interface ScoreBreakdown {
  scores: Partial<CoreScores>;
  rawScores?: Partial<RawCoreScores>;  // Add this
  preferenceMatches: PreferenceMatches;
  total: number;
}
```

#### 3. Update utility calculator to populate raw scores

**File**: `recommender_api/src/services/utility-calculator/utility-calculator.ts`

After calculating raw scores (around line 75), store them:

```typescript
// Store raw scores for explanation generation
const rawCoreScores: RawCoreScores = {
  skillMatch: skillMatchRaw,
  confidence: confidenceRaw,
  experience: experienceRaw,
};
```

Then include in the return (around line 230):

```typescript
return {
  utilityScore,
  scoreBreakdown: {
    scores,
    rawScores: {
      skillMatch: skillMatchRaw > 0 ? skillMatchRaw : undefined,
      confidence: confidenceRaw > 0 ? confidenceRaw : undefined,
      experience: experienceRaw > 0 ? experienceRaw : undefined,
    },
    preferenceMatches,
    total: utilityScore,
  },
};
```

#### 4. Update score explanation service to use raw scores

**File**: `recommender_api/src/services/search-match-explanation/score-explanation.service.ts`

Update the context interface and functions:

```typescript
interface ScoreContext {
  breakdown: ScoreBreakdown;
  engineerName: string;
}

export function generateScoreExplanations(context: ScoreContext): ScoreExplanation[] {
  const explanations: ScoreExplanation[] = [];

  // Use raw scores if available, fall back to weighted (for backwards compatibility)
  const rawScores = context.breakdown.rawScores ?? {};
  const weightedScores = context.breakdown.scores;

  if (weightedScores.skillMatch !== undefined) {
    const rawScore = rawScores.skillMatch ?? weightedScores.skillMatch;
    explanations.push(generateSkillMatchExplanation(rawScore, weightedScores.skillMatch));
  }
  if (weightedScores.confidence !== undefined) {
    const rawScore = rawScores.confidence ?? weightedScores.confidence;
    explanations.push(generateConfidenceExplanation(rawScore, weightedScores.confidence));
  }
  if (weightedScores.experience !== undefined) {
    const rawScore = rawScores.experience ?? weightedScores.experience;
    explanations.push(generateExperienceExplanation(rawScore, weightedScores.experience));
  }
  // ... rest unchanged
}

function generateExperienceExplanation(rawScore: number, weightedScore: number): ScoreExplanation {
  const weight = utilityWeights.yearsExperience;

  // Use raw score (0-1 normalized) for reverse formula
  // rawScore = log(1 + years) / log(1 + 20)
  const years = Math.round(Math.exp(rawScore * Math.log(21)) - 1);

  let explanation: string;
  if (years >= 10) {
    explanation = `Staff+ level experience (${years}+ years)`;
  } else if (years >= 6) {
    explanation = `Senior level experience (${years} years)`;
  } else if (years >= 3) {
    explanation = `Mid-level experience (${years} years)`;
  } else {
    explanation = `Junior level experience (${years} years)`;
  }

  return {
    component: 'experience',
    weight,
    rawScore,
    weightedScore,
    explanation,
    contributingFactors: [`${years} years of experience`],
  };
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Existing unit tests pass: `npm test`
- [x] New unit test for raw scores in breakdown

#### Manual Verification:
- [x] Explain endpoint shows correct years for engineer with known experience
- [x] Experience explanation matches actual yearsExperience from database

---

## Phase 2: Fix Preferred Skills Tradeoff Count

### Overview

Pass the original number of preferred skill groups to tradeoff detection, separate from the flattened skill IDs.

### Changes Required

#### 1. Update SearchPreferences to include original group count

**File**: `recommender_api/src/services/search-match-explanation/tradeoff-explanation.service.ts`

```typescript
interface SearchPreferences {
  preferredSeniorityLevel?: SeniorityLevel;
  maxBudget?: number;
  stretchBudget?: number;
  preferredMaxStartTime?: StartTimeline;
  preferredTimezone?: string[];
  preferredSkillIds?: string[];
  preferredSkillGroupCount?: number;  // Add this - original request count
}
```

#### 2. Update detectMissingPreferredSkills to use group count

**File**: `recommender_api/src/services/search-match-explanation/tradeoff-explanation.service.ts`

```typescript
function detectMissingPreferredSkills(
  engineerSkills: string[],
  preferredSkillIds: string[],
  originalGroupCount?: number
): TradeoffExplanation | null {
  const engineerSkillSet = new Set(engineerSkills);
  const missingSkills = preferredSkillIds.filter((id) => !engineerSkillSet.has(id));

  if (missingSkills.length === 0) {
    return null;
  }

  const matchedCount = preferredSkillIds.length - missingSkills.length;
  const totalCount = preferredSkillIds.length;

  /*
   * Two message formats:
   * 1. If we have original group count: Report in terms of user's request
   *    "Has 0 of 1 preferred skill groups (0 of 3 expanded skills matched)"
   * 2. If no group count (legacy): Use expanded count
   *    "Has 0 of 3 preferred skills"
   */
  let explanation: string;
  let requestedValue: number | string;

  if (originalGroupCount !== undefined && originalGroupCount !== totalCount) {
    // We know the original request had fewer groups than expanded skills
    // Calculate how many groups are satisfied (at least one skill matched per group)
    // For now, simplified: if ANY skill matched, report partial success
    const groupsMatched = matchedCount > 0 ? '1+' : '0';
    explanation = `Matched ${matchedCount} of ${totalCount} preferred skills (${originalGroupCount} skill group${originalGroupCount === 1 ? '' : 's'} requested)`;
    requestedValue = originalGroupCount;
  } else {
    explanation = `Has ${matchedCount} of ${totalCount} preferred skills`;
    requestedValue = totalCount;
  }

  return {
    attribute: 'preferredSkills',
    requested: requestedValue,
    actual: matchedCount,
    explanation,
  };
}
```

#### 3. Update detectTradeoffs signature

**File**: `recommender_api/src/services/search-match-explanation/tradeoff-explanation.service.ts`

```typescript
// Update the call to detectMissingPreferredSkills
if (preferences.preferredSkillIds && preferences.preferredSkillIds.length > 0) {
  const skillTradeoff = detectMissingPreferredSkills(
    engineer.skills,
    preferences.preferredSkillIds,
    preferences.preferredSkillGroupCount
  );
  if (skillTradeoff) tradeoffs.push(skillTradeoff);
}
```

#### 4. Update search-match-explanation.service to pass group count

**File**: `recommender_api/src/services/search-match-explanation/search-match-explanation.service.ts`

```typescript
// After line 122, calculate original group count from request
const originalPreferredSkillGroupCount = request.searchCriteria.preferredSkills?.length ?? 0;

const tradeoffExplanations = detectTradeoffs(
  {
    yearsExperience: engineerMatch.yearsExperience,
    salary: engineerMatch.salary,
    startTimeline: engineerMatch.startTimeline as StartTimeline,
    timezone: engineerMatch.timezone,
    skills: engineerMatch.matchedSkills.map((s) => s.skillId),
  },
  {
    preferredSeniorityLevel: request.searchCriteria.preferredSeniorityLevel,
    maxBudget: request.searchCriteria.maxBudget,
    stretchBudget: request.searchCriteria.stretchBudget,
    preferredMaxStartTime: request.searchCriteria.preferredMaxStartTime,
    preferredTimezone: request.searchCriteria.preferredTimezone,
    preferredSkillIds,
    preferredSkillGroupCount: originalPreferredSkillGroupCount,  // Add this
  }
);
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Existing unit tests pass: `npm test`
- [x] Update tradeoff-explanation.service.test.ts with new parameter

#### Manual Verification:
- [x] Explain endpoint shows "1 skill group requested" when user requests 1 preferred skill
- [x] Message clearly distinguishes between user's request and system expansion

---

## Phase 3: Update Tests

### Overview

Update unit tests to verify the fixes and cover edge cases.

### Changes Required

#### 1. Update utility-calculator.test.ts

Add tests for raw scores in breakdown:

```typescript
it('includes raw scores in breakdown', () => {
  const result = calculateUtilityWithBreakdown(baseEngineer, baseContext);

  expect(result.scoreBreakdown.rawScores).toBeDefined();
  expect(result.scoreBreakdown.rawScores?.experience).toBeGreaterThan(0);
  expect(result.scoreBreakdown.rawScores?.experience).toBeLessThanOrEqual(1);
});
```

#### 2. Update tradeoff-explanation.service.test.ts

Add tests for group count:

```typescript
it('reports original group count in preferred skills tradeoff', () => {
  const tradeoffs = detectTradeoffs(
    { ...baseEngineer, skills: ['skill_other'] },
    {
      preferredSkillIds: ['skill_python', 'skill_django', 'skill_flask'],
      preferredSkillGroupCount: 1,  // User requested 1 skill "Python"
    }
  );

  expect(tradeoffs[0].requested).toBe(1);
  expect(tradeoffs[0].explanation).toContain('1 skill group');
});
```

#### 3. Update score-explanation.service.test.ts (if exists)

Add tests for correct year calculation:

```typescript
it('calculates correct years from raw experience score', () => {
  // rawScore for 7 years: log(1 + 7) / log(1 + 20) ≈ 0.68
  const breakdown: ScoreBreakdown = {
    scores: { experience: 0.034 },  // weighted: 0.68 * 0.05
    rawScores: { experience: 0.68 },
    preferenceMatches: {},
    total: 0.034,
  };

  const explanations = generateScoreExplanations({ breakdown, engineerName: 'Test' });
  const experienceExplanation = explanations.find(e => e.component === 'experience');

  expect(experienceExplanation?.explanation).toContain('7 years');
});
```

### Success Criteria

#### Automated Verification:
- [x] All unit tests pass: `npm test`
- [x] New tests cover the fixed behavior

#### Manual Verification:
- [ ] None for this phase

---

## Testing Strategy

### Unit Tests

1. **Utility Calculator**:
   - Verify rawScores are populated in breakdown
   - Verify rawScores are in 0-1 range
   - Verify rawScores are filtered like weighted scores

2. **Score Explanation Service**:
   - Verify years calculation uses rawScore
   - Verify correct years for known experience values (0, 3, 7, 15)

3. **Tradeoff Explanation Service**:
   - Verify group count is used when provided
   - Verify backwards compatibility when group count is not provided

### Integration Tests

1. **Explain endpoint with experience**:
   - Request explain for engineer with known yearsExperience
   - Verify experience explanation shows correct years

2. **Explain endpoint with preferred skills**:
   - Request explain with 1 preferred skill that expands
   - Verify tradeoff message mentions original count

### E2E Tests

Update Postman collection if needed to verify:
- Experience explanations show realistic years
- Preferred skill tradeoffs show user-requested counts

## Performance Considerations

- Adding rawScores to breakdown has minimal memory impact (3 extra numbers per engineer)
- No additional database queries required
- No changes to scoring performance

## Migration Notes

- No database migration needed
- API response includes new `rawScores` field (backwards compatible addition)
- Existing consumers of `scores` field are unaffected
- Tradeoff messages may change wording (improved accuracy)

## References

- Research document: `thoughts/shared/1_chapter_5/6_project_6/research/2026-01-20-explain-endpoint-narrative-issues.md`
- Related plan (skill hierarchy): `thoughts/shared/1_chapter_5/6_project_6/plans/2026-01-20-fix-skill-hierarchy-expansion-bug.md`
- Score explanation: `recommender_api/src/services/search-match-explanation/score-explanation.service.ts`
- Tradeoff detection: `recommender_api/src/services/search-match-explanation/tradeoff-explanation.service.ts`
- Utility calculator: `recommender_api/src/services/utility-calculator/utility-calculator.ts`
