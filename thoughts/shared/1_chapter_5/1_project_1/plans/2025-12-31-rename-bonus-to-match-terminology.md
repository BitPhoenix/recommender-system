# Rename "Bonus" to "Match" Terminology Implementation Plan

## Overview

Refactor the utility function terminology from "bonus" to "match" to better reflect the conceptual model. The current "bonus" framing implies extra credit on top of a base score, but these are actually weighted attribute contributions in a multi-attribute utility function (MAUT). The new terminology clarifies that these are **preference match scores**—measuring how well candidates align with expressed preferences.

## Current State Analysis

The term "Bonus" appears ~150+ times across 6 files:
- `knowledge-base.types.ts` - Type definitions
- `knowledge-base.config.ts` - Configuration values
- `search.types.ts` - API response types
- `utility-calculator.service.ts` - Core calculation logic
- `constraint-expander.service.ts` - Constraint expansion
- `skill-resolver.service.ts` - Skill resolution

### Key Discoveries:
- `teamFocusBonusMapping` and `bonusSkillIds` refer to "skills that align with team context", not score contributions
- The `Bonuses` interface in search.types.ts is exposed in the API response
- All `*BonusMax` params in utility config need renaming

## Desired End State

After this plan is complete:

1. **Terminology is consistent**: All references to "bonus" in the utility function context are renamed to "match"
2. **Categorization is clear**: The utility weights are organized into three categories:
   - Candidate attributes (always evaluated)
   - Preference matches (conditional on request specifying them)
   - Team context alignment
3. **API response updated**: The `Bonuses` interface becomes `PreferenceMatches`
4. **Team focus uses "alignment"**: `teamFocusBonusMapping` → `teamFocusSkillAlignment`, `bonusSkillIds` → `alignedSkillIds`

### Verification:
- `npm run typecheck` passes with no errors
- `npm run build` succeeds
- All existing tests pass (if any)
- Grep for "Bonus" in `*.ts` files returns no matches in utility/scoring context

## What We're NOT Doing

- NOT changing the mathematical formulas or weights
- NOT modifying the API request schema (only response types)
- NOT changing the behavior of any calculations
- NOT renaming `UtilityContext.bonusSkillIds` to avoid breaking the service interface (will rename in Phase 2)

## Implementation Approach

Rename in dependency order: types first, then config, then services. This ensures each file compiles before moving to the next.

---

## Phase 1: Update Type Definitions

### Overview
Update the foundational type definitions that other files depend on.

### Changes Required:

#### 1. knowledge-base.types.ts

**File**: `recommender_api/src/types/knowledge-base.types.ts`

**Changes**:
- Rename `TeamFocusBonus` → `TeamFocusSkillAlignment`
- Rename `TeamFocusBonusMapping` → `TeamFocusSkillAlignmentMapping`
- Update `bonusSkillIds` → `alignedSkillIds` inside the interface
- Rename all `*Bonus` properties in `UtilityWeights` to `*Match`
- Rename all `*BonusMax` properties in `UtilityFunctionParams` to `*MatchMax`

```typescript
// Line ~54-62: Rename interface and property
export interface TeamFocusSkillAlignment {
  alignedSkillIds: string[];  // was: bonusSkillIds
  rationale: string;
}

export type TeamFocusSkillAlignmentMapping = Record<TeamFocus, TeamFocusSkillAlignment>;
```

```typescript
// Line ~86-103: Rename UtilityWeights properties
export interface UtilityWeights {
  // Candidate attributes (always evaluated)
  skillMatch: number;
  relatedSkillsMatch: number;  // was: relatedSkillsBonus
  confidenceScore: number;
  yearsExperience: number;
  availability: number;
  salary: number;

  // Preference matches (conditional on request specifying them)
  preferredSkillsMatch: number;           // was: preferredSkillsBonus
  preferredDomainMatch: number;           // was: domainBonus
  preferredAvailabilityMatch: number;     // was: preferredAvailabilityBonus
  preferredTimezoneMatch: number;         // was: preferredTimezoneBonus
  preferredSeniorityMatch: number;        // was: preferredSeniorityBonus
  preferredSalaryRangeMatch: number;      // was: preferredSalaryRangeBonus
  preferredConfidenceMatch: number;       // was: preferredConfidenceBonus
  preferredProficiencyMatch: number;      // was: preferredProficiencyBonus

  // Team context alignment
  teamFocusMatch: number;                 // was: teamFocusBonus
}
```

```typescript
// Line ~108-133: Rename UtilityFunctionParams properties
export interface UtilityFunctionParams {
  confidenceMin: number;
  confidenceMax: number;
  yearsExperienceMax: number;
  salaryMin: number;
  salaryMax: number;
  // Preference match maximums
  preferredSkillsMatchMax: number;        // was: preferredSkillsBonusMax
  teamFocusMatchMax: number;              // was: teamFocusBonusMax
  relatedSkillsMatchMax: number;          // was: relatedSkillsBonusMax
  preferredDomainMatchMax: number;        // was: domainBonusMax
  preferredAvailabilityMatchMax: number;  // was: preferredAvailabilityBonusMax
  preferredTimezoneMatchMax: number;      // was: preferredTimezoneBonusMax
  preferredSeniorityMatchMax: number;     // was: preferredSeniorityBonusMax
  preferredSalaryRangeMatchMax: number;   // was: preferredSalaryRangeBonusMax
  preferredConfidenceMatchMax: number;    // was: preferredConfidenceBonusMax
  preferredProficiencyMatchMax: number;   // was: preferredProficiencyBonusMax
}
```

```typescript
// Line ~152-159: Update KnowledgeBaseConfig
export interface KnowledgeBaseConfig {
  seniorityMapping: SeniorityMapping;
  riskToleranceMapping: RiskToleranceMapping;
  proficiencyMapping: ProficiencyMapping;
  teamFocusSkillAlignment: TeamFocusSkillAlignmentMapping;  // was: teamFocusBonusMapping
  defaults: SearchDefaults;
  utilityWeights: UtilityWeights;
  utilityParams: UtilityFunctionParams;
  availabilityUtility: AvailabilityUtility;
  matchStrengthThresholds: MatchStrengthThresholds;
}
```

#### 2. search.types.ts

**File**: `recommender_api/src/types/search.types.ts`

**Changes**:
- Rename all `*Bonus` interfaces to `*Match`
- Rename `Bonuses` interface to `PreferenceMatches`
- Update `ScoreBreakdown` to use `preferenceMatches` instead of `bonuses`

```typescript
// Line ~89-136: Rename all bonus interfaces to match
export interface PreferredSkillsMatch {
  score: number;
  matchedSkills: string[];
}

export interface TeamFocusMatch {
  score: number;
  matchedSkills: string[];
}

export interface RelatedSkillsMatch {
  score: number;
  count: number;
}

export interface PreferredDomainMatch {
  score: number;
  matchedDomains: string[];
}

export interface PreferredAvailabilityMatch {
  score: number;
  matchedAvailability: string;
  rank: number;
}

export interface PreferredTimezoneMatch {
  score: number;
  matchedTimezone: string;
  rank: number;
}

export interface PreferredSeniorityMatch {
  score: number;
}

export interface PreferredSalaryRangeMatch {
  score: number;
}

export interface PreferredConfidenceMatch {
  score: number;
}

export interface PreferredProficiencyMatch {
  score: number;
}
```

```typescript
// Line ~138-149: Rename Bonuses to PreferenceMatches
export interface PreferenceMatches {
  preferredSkillsMatch?: PreferredSkillsMatch;
  teamFocusMatch?: TeamFocusMatch;
  relatedSkillsMatch?: RelatedSkillsMatch;
  preferredDomainMatch?: PreferredDomainMatch;
  preferredAvailabilityMatch?: PreferredAvailabilityMatch;
  preferredTimezoneMatch?: PreferredTimezoneMatch;
  preferredSeniorityMatch?: PreferredSeniorityMatch;
  preferredSalaryRangeMatch?: PreferredSalaryRangeMatch;
  preferredConfidenceMatch?: PreferredConfidenceMatch;
  preferredProficiencyMatch?: PreferredProficiencyMatch;
}
```

```typescript
// Line ~151-155: Update ScoreBreakdown
export interface ScoreBreakdown {
  scores: Partial<CoreScores>;
  preferenceMatches: PreferenceMatches;  // was: bonuses: Bonuses
  total: number;
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck` (will fail until Phase 2 completes)

#### Manual Verification:
- [x] All interface names follow the new naming convention

**Implementation Note**: Types will not compile until config is updated. Proceed immediately to Phase 2.

---

## Phase 2: Update Configuration

### Overview
Update the knowledge base configuration to use new property names.

### Changes Required:

#### 1. knowledge-base.config.ts

**File**: `recommender_api/src/config/knowledge-base.config.ts`

**Changes**:
- Rename `teamFocusBonusMapping` → `teamFocusSkillAlignment`
- Rename `bonusSkillIds` → `alignedSkillIds` in each team focus entry
- Reorganize and rename `utilityWeights` properties
- Rename `utilityParams` properties

```typescript
// Line ~67-109: Rename teamFocusBonusMapping
/**
 * Team Focus Skill Alignment
 * Maps team focus to skills that are contextually relevant.
 * Indirect mapping: teamFocus=greenfield ⇒ boost for ambiguity/creativity skills
 */
teamFocusSkillAlignment: {
  greenfield: {
    alignedSkillIds: [
      'skill_ambiguity',
      'skill_creativity',
      'skill_ownership',
      'skill_system_design',
    ],
    rationale: 'New projects require navigating unclear requirements',
  },
  migration: {
    alignedSkillIds: [
      'skill_system_design',
      'skill_debugging',
      'skill_attention_detail',
      'skill_documentation',
    ],
    rationale: 'Understanding both old and new systems',
  },
  maintenance: {
    alignedSkillIds: [
      'skill_debugging',
      'skill_root_cause',
      'skill_documentation',
      'skill_code_review',
    ],
    rationale: 'Bug fixing and quality gates',
  },
  scaling: {
    alignedSkillIds: [
      'skill_distributed',
      'skill_system_design',
      'skill_monitoring',
      'skill_kafka',
    ],
    rationale: 'Performance and scalability expertise',
  },
},
```

```typescript
// Line ~137-156: Reorganize utilityWeights
utilityWeights: {
  // Candidate attributes (always evaluated)
  skillMatch: 0.22,
  relatedSkillsMatch: 0.04,       // was: relatedSkillsBonus
  confidenceScore: 0.14,
  yearsExperience: 0.11,
  availability: 0.11,
  salary: 0.07,

  // Preference matches (conditional on request specifying them)
  preferredSkillsMatch: 0.08,           // was: preferredSkillsBonus
  preferredDomainMatch: 0.04,           // was: domainBonus
  preferredAvailabilityMatch: 0.03,     // was: preferredAvailabilityBonus
  preferredTimezoneMatch: 0.02,         // was: preferredTimezoneBonus
  preferredSeniorityMatch: 0.03,        // was: preferredSeniorityBonus
  preferredSalaryRangeMatch: 0.03,      // was: preferredSalaryRangeBonus
  preferredConfidenceMatch: 0.02,       // was: preferredConfidenceBonus
  preferredProficiencyMatch: 0.02,      // was: preferredProficiencyBonus

  // Team context alignment
  teamFocusMatch: 0.04,                 // was: teamFocusBonus
},
```

```typescript
// Line ~163-187: Rename utilityParams
utilityParams: {
  confidenceMin: 0.5,
  confidenceMax: 1.0,
  yearsExperienceMax: 20,
  salaryMin: 80000,
  salaryMax: 300000,
  // Preference match maximums
  preferredSkillsMatchMax: 1.0,         // was: preferredSkillsBonusMax
  teamFocusMatchMax: 0.5,               // was: teamFocusBonusMax
  relatedSkillsMatchMax: 5,             // was: relatedSkillsBonusMax
  preferredDomainMatchMax: 1.0,         // was: domainBonusMax
  preferredAvailabilityMatchMax: 1.0,   // was: preferredAvailabilityBonusMax
  preferredTimezoneMatchMax: 1.0,       // was: preferredTimezoneBonusMax
  preferredSeniorityMatchMax: 1.0,      // was: preferredSeniorityBonusMax
  preferredSalaryRangeMatchMax: 1.0,    // was: preferredSalaryRangeBonusMax
  preferredConfidenceMatchMax: 1.0,     // was: preferredConfidenceBonusMax
  preferredProficiencyMatchMax: 1.0,    // was: preferredProficiencyBonusMax
},
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck` (will fail until Phase 3 completes)

---

## Phase 3: Update Services

### Overview
Update service files to use new property names.

### Changes Required:

#### 1. constraint-expander.service.ts

**File**: `recommender_api/src/services/constraint-expander.service.ts`

**Changes**:
- Rename `bonusSkillIds` → `alignedSkillIds` in `ExpandedConstraints` interface
- Update reference to `config.teamFocusBonusMapping` → `config.teamFocusSkillAlignment`
- Update `bonus.bonusSkillIds` → `alignment.alignedSkillIds`
- Update applied constraint field name

```typescript
// Line ~37-38: Rename in ExpandedConstraints
// Team focus aligned skills
alignedSkillIds: string[];  // was: bonusSkillIds
```

```typescript
// Line ~183-195: Update team focus section
let alignedSkillIds: string[] = [];  // was: bonusSkillIds

if (request.teamFocus) {
  const alignment = config.teamFocusSkillAlignment[request.teamFocus];  // was: teamFocusBonusMapping
  alignedSkillIds = alignment.alignedSkillIds;  // was: bonus.bonusSkillIds

  appliedConstraints.push({
    field: 'teamFocusMatch',  // was: teamFocusBonus
    operator: 'BOOST',
    value: alignedSkillIds.join(', '),
    source: 'knowledge_base',
  });
}
```

```typescript
// Line ~291-303: Update return statement
return {
  // ... other fields
  alignedSkillIds,  // was: bonusSkillIds
  // ... rest
};
```

#### 2. skill-resolver.service.ts

**File**: `recommender_api/src/services/skill-resolver.service.ts`

**Changes**:
- Rename function `resolveBonusSkills` → `resolveAlignedSkills`
- Rename parameter `bonusSkillIds` → `alignedSkillIds`

```typescript
// Line ~125-145: Rename function and parameter
/**
 * Gets aligned skill IDs for team focus, validating they exist in the database.
 */
export async function resolveAlignedSkills(
  session: Session,
  alignedSkillIds: string[]
): Promise<string[]> {
  if (!alignedSkillIds || alignedSkillIds.length === 0) {
    return [];
  }

  const query = `
MATCH (s:Skill)
WHERE s.id IN $alignedSkillIds
RETURN s.id AS skillId
`;

  const result = await session.run(query, { alignedSkillIds });

  return result.records.map((record) => record.get('skillId') as string);
}
```

#### 3. utility-calculator.service.ts

**File**: `recommender_api/src/services/utility-calculator.service.ts`

**Changes**: This is the largest file. Rename:
- Import `Bonuses` → `PreferenceMatches`
- All `*BonusResult` interfaces → `*MatchResult`
- All `calculate*Bonus*` functions → `calculate*Match*`
- All local variables using `bonus` terminology
- `context.bonusSkillIds` → `context.alignedSkillIds` in `UtilityContext`
- Update `scoreBreakdown.bonuses` → `scoreBreakdown.preferenceMatches`

Key renames (representative examples):

```typescript
// Line ~18: Update import
import type {
  // ...
  PreferenceMatches,  // was: Bonuses
  // ...
} from '../types/search.types.js';
```

```typescript
// Line ~42: Rename in UtilityContext
alignedSkillIds: string[];  // was: bonusSkillIds
```

```typescript
// Line ~66-84: Rename result interfaces
interface TeamFocusMatchResult {      // was: TeamFocusBonusResult
  raw: number;
  matchedSkillNames: string[];
}

interface PreferredSkillsMatchResult {  // was: PreferredSkillsBonusResult
  raw: number;
  matchedSkillNames: string[];
}

interface RelatedSkillsMatchResult {    // was: RelatedSkillsBonusResult
  raw: number;
  count: number;
}

interface PreferredDomainMatchResult {  // was: DomainBonusResult
  raw: number;
  matchedDomainNames: string[];
}

// ... similar for all other *BonusResult interfaces
```

```typescript
// Line ~90-112: Rename function
function calculatePreferredSkillsMatchWithDetails(  // was: calculatePreferredSkillsBonusWithDetails
  matchedSkills: MatchedSkill[],
  preferredSkillIds: string[],
  maxMatch: number  // was: maxBonus
): PreferredSkillsMatchResult {
  // ... implementation (rename internal maxBonus → maxMatch)
}
```

```typescript
// Line ~117-139: Rename function
function calculateTeamFocusMatchWithDetails(  // was: calculateTeamFocusBonusWithDetails
  matchedSkills: MatchedSkill[],
  alignedSkillIds: string[],  // was: bonusSkillIds
  maxMatch: number
): TeamFocusMatchResult {
  // ... implementation
}
```

Continue same pattern for all other functions.

```typescript
// Line ~474-486: Rename matchScores object
const matchScores = {  // was: bonusScores
  preferredSkillsMatch: calculateWeighted(preferredSkillsResult.raw, weights.preferredSkillsMatch),
  teamFocusMatch: calculateWeighted(teamFocusResult.raw, weights.teamFocusMatch),
  relatedSkillsMatch: calculateWeighted(relatedSkillsResult.raw, weights.relatedSkillsMatch),
  preferredDomainMatch: calculateWeighted(domainMatchResult.raw, weights.preferredDomainMatch),
  // ... etc
};
```

```typescript
// Line ~500-560: Rename preferenceMatches object
const preferenceMatches: PreferenceMatches = {};  // was: bonuses: Bonuses

if (matchScores.preferredSkillsMatch > 0) {
  preferenceMatches.preferredSkillsMatch = {
    score: matchScores.preferredSkillsMatch,
    matchedSkills: preferredSkillsResult.matchedSkillNames,
  };
}
// ... etc for all match types
```

```typescript
// Line ~566-571: Update return
return {
  utilityScore,
  scoreBreakdown: {
    scores,
    preferenceMatches,  // was: bonuses
    total: utilityScore,
  },
};
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck`
- [x] Build succeeds: `npm run build`

---

## Phase 4: Update Any Remaining References

### Overview
Search for any remaining "Bonus" or "bonus" references and update them.

### Changes Required:

#### 1. Search and update any callers

**Commands to run**:
```bash
grep -r "bonusSkillIds" recommender_api/src/
grep -r "Bonus" recommender_api/src/ --include="*.ts"
grep -r "bonus" recommender_api/src/ --include="*.ts"
```

Update any files that still reference the old names (likely in route handlers or other services that call these functions).

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck`
- [x] Build succeeds: `npm run build`
- [x] No "Bonus" references remain: `grep -r "Bonus" recommender_api/src/ --include="*.ts"` returns empty (except internal `proficiencyBonus` in skill match calculation)

#### Manual Verification:
- [ ] API still returns correct response structure
- [ ] Score breakdowns show `preferenceMatches` instead of `bonuses`

**Implementation Note**: After completing this phase and all automated verification passes, the refactoring is complete.

---

## Testing Strategy

### Unit Tests:
- If existing tests reference `bonuses` or `Bonus` types, update them to use new names
- Verify utility calculation produces same numeric results

### Integration Tests:
- API response should have `scoreBreakdown.preferenceMatches` instead of `scoreBreakdown.bonuses`

### Manual Testing Steps:
1. Make a search request with `preferredSkills` specified
2. Verify response contains `preferenceMatches.preferredSkillsMatch`
3. Verify scores are calculated correctly

## Performance Considerations

No performance impact - this is purely a rename refactor with no algorithmic changes.

## Migration Notes

This is a breaking API change for the response schema:
- `scoreBreakdown.bonuses` → `scoreBreakdown.preferenceMatches`
- All `*Bonus` properties → `*Match`

If there are API consumers, coordinate the release.

## References

- Conversation context: Discussion about "bonus" vs "match" mental model
- Multi-Attribute Utility Theory (MAUT): Section 5.2.3, p.178 of textbook
