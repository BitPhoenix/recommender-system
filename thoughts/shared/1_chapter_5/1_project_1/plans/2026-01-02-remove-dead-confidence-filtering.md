# Remove Dead Confidence Filtering Code

## Overview

Remove dead code related to confidence-based skill filtering. Confidence is still used for **ranking** (14% utility weight), but no longer used for **filtering/exclusion**. The filtering infrastructure remains but serves no purpose.

## Current State Analysis

### What Confidence IS Used For (Keep)
- `confidenceScore` on each skill - displayed in API responses
- `avgConfidence` - average across matched skills, used in utility calculation
- `calculateConfidenceUtility()` - converts avgConfidence to 0-1 score with 14% weight

### What's Dead Code (Remove)

| Location | Code | Problem |
|----------|------|---------|
| `search-query.builder.ts:244` | `meetsConfidence: true` | Hardcoded `true`, never evaluates anything |
| `search.service.ts:53` | `meetsConfidence?: boolean` in `RawSkillData` | Field is always `true` when present |
| `search.service.ts:382` | `if (!skill.meetsConfidence) violations.push(...)` | Check always passes (true or undefined) |
| `search.types.ts:31` | `'confidence_below_threshold'` in `ConstraintViolation` | Value never produced |

### How Confidence Scores Are Derived

The `confidenceScore` on a `UserSkill` is a **computed aggregate** representing how confident the system is that an engineer truly has a skill at the claimed proficiency. It's derived from multiple evidence types:

#### 1. Assessments (Coding Challenges, System Design)
- Engineers take timed assessments (see `seeds/assessments.ts`)
- Each question tests specific skills with weights (e.g., a React question tests React at 0.9 weight, TypeScript at 0.5)
- Each attempt gets scored with `score` (0-1) and `technicalDepth` ('surface' | 'working' | 'deep' | 'expert')
- Performance on questions contributes to confidence for the skills they test

#### 2. AI Voice Interviews (Stories)
- Engineers tell STAR-format stories during interviews (transcribed in `interviewStories`)
- An AI model analyzes each story for clarity, impact, ownership (`storyAnalyses`)
- Stories are linked to skills via `storyDemonstrations` with a `strength` score (e.g., "Designed API contracts" → `skill_api_design` at strength 0.92)

#### 3. Certifications
- Verified certifications from AWS, CNCF, HashiCorp, etc.
- Each cert validates certain skills (`certificationValidations`: CKA → Kubernetes, Docker)

#### 4. Evidence Aggregation
The `skillEvidence` table links `UserSkill` records to their supporting evidence:
```typescript
// Sofia's Kubernetes skill has three evidence sources:
{ userSkillId: 'es_sofia_kubernetes', evidenceId: 'perf_sofia_q1', evidenceType: 'performance', relevanceScore: 0.95, isPrimary: true }
{ userSkillId: 'es_sofia_kubernetes', evidenceId: 'cert_cka', evidenceType: 'certification', relevanceScore: 0.90, isPrimary: false }
{ userSkillId: 'es_sofia_kubernetes', evidenceId: 'story_sofia_1', evidenceType: 'story', relevanceScore: 0.92, isPrimary: false }
```

The final `confidenceScore` aggregates this evidence:
- Engineer with assessment score 0.95 + story demonstration 0.92 + certification → high confidence (~0.90)
- Engineer who only self-reported a skill with no evidence → low confidence (~0.5)

The system tracks `lastValidated` to let confidence decay over time without fresh evidence.

#### Why Keep Confidence for Ranking But Remove Filtering

Confidence filtering was removed because:
1. It's more useful for **ranking** (14% utility weight) than hard exclusion
2. You don't want to exclude someone who self-reports "expert" in TypeScript just because they haven't completed an assessment yet - you'd rather rank them lower while still showing them
3. As the platform matures and more engineers complete assessments/interviews, confidence scores will naturally improve

### Evidence This Is Intentional

Comments in the codebase confirm confidence filtering was deliberately removed:

```typescript
// defaults.config.ts:19-20
"Note: Confidence score is no longer used for filtering - it only affects
ranking via the utility calculation (14% weight)."

// search-query.builder.ts:229
"Confidence score is collected for ranking but not used to filter/exclude engineers"
```

## Desired End State

After this change:
- `meetsConfidence` field no longer exists anywhere
- `confidence_below_threshold` is not a possible constraint violation
- Skills are categorized as matched/unmatched based **only** on proficiency
- Confidence continues to affect **ranking** through `avgConfidence` utility (unchanged)

### How to Verify

API responses should show:
- `unmatchedRelatedSkills[].constraintViolations` can only contain `proficiency_below_minimum`
- Skills with high confidence but wrong proficiency still go to `unmatchedRelatedSkills`
- Skills with correct proficiency go to `matchedSkills` regardless of confidence
- `avgConfidence` still appears and affects ranking

## What We're NOT Doing

- **Not removing confidence from ranking** - `avgConfidence` and 14% utility weight stay
- **Not removing `confidenceScore` from skill display** - API still shows per-skill confidence
- **Not changing utility calculation** - `calculateConfidenceUtility()` unchanged

## Phase 1: Remove Dead Confidence Filtering Infrastructure

### Overview

Remove all code paths that check `meetsConfidence` since it's always `true` and serves no purpose.

### Changes Required

#### 1. Remove meetsConfidence from Cypher Query Output
**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`
**Lines**: 244

Remove the `meetsConfidence: true` line from the skill collection COLLECT:

```diff
      COLLECT({
        skillId: s2.id,
        skillName: s2.name,
        proficiencyLevel: us2.proficiencyLevel,
        confidenceScore: us2.confidenceScore,
        yearsUsed: us2.yearsUsed,
        matchType: CASE
          WHEN s2.id IN $originalSkillIdentifiers OR s2.name IN $originalSkillIdentifiers THEN 'direct'
          ELSE 'descendant'
        END,
-       meetsConfidence: true,
        meetsProficiency: CASE
```

#### 2. Remove meetsConfidence from RawSkillData Interface
**File**: `recommender_api/src/services/search.service.ts`
**Lines**: 52-53

```diff
  matchType: "direct" | "descendant" | "none";
- // These fields only exist when skill filtering is active
- meetsConfidence?: boolean;
+ // This field only exists when skill filtering is active
  meetsProficiency?: boolean;
```

#### 3. Remove Confidence Check in categorizeSkillsByConstraints
**File**: `recommender_api/src/services/search.service.ts`
**Lines**: 381-382

```diff
  for (const skill of allSkills) {
    const violations: ConstraintViolation[] = [];
-   if (!skill.meetsConfidence) violations.push("confidence_below_threshold");
    if (!skill.meetsProficiency) violations.push("proficiency_below_minimum");
```

#### 4. Remove confidence_below_threshold from ConstraintViolation Type
**File**: `recommender_api/src/types/search.types.ts`
**Line**: 31

```diff
- export type ConstraintViolation = 'confidence_below_threshold' | 'proficiency_below_minimum';
+ export type ConstraintViolation = 'proficiency_below_minimum';
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `cd recommender_api && npx tsc --noEmit`
- [x] Newman API tests pass: `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json`

#### Manual Verification:
- [x] Search results show `unmatchedRelatedSkills` only with `proficiency_below_minimum` violations (never `confidence_below_threshold`)
- [x] Skills with correct proficiency appear in `matchedSkills` regardless of their `confidenceScore`
- [x] `avgConfidence` still appears in API and affects ranking scores

## Testing Strategy

### Automated Tests
Existing Newman tests should pass since this removes dead code - behavior doesn't change.

### Manual Testing Steps
1. POST to `/api/search/filter` with `{"requiredSkills": [{"skill": "TypeScript", "minProficiency": "learning"}]}`
2. Check response: all TypeScript skills (any confidence) should be in `matchedSkills`
3. Check `unmatchedRelatedSkills` for descendants - they should only have `proficiency_below_minimum` if applicable

## References

- Related change: `thoughts/shared/1_chapter_5/1_project_1/plans/2026-01-02-graduated-proficiency-scoring.md`
- Utility config: `recommender_api/src/config/knowledge-base/utility.config.ts` (confidenceScore: 0.14)
