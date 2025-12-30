# Required/Preferred Properties Implementation Plan

## Overview

Implement a consistent `required`/`preferred` naming pattern across all constraint properties in the Search Filter API. This involves renaming 7 existing properties to use the `required` prefix and adding 6 new `preferred` variants that provide ranking boosts without hard filtering.

## Current State Analysis

The API currently has inconsistent naming:
- **Consistent:** `requiredSkills`/`preferredSkills`, `requiredDomains`/`preferredDomains`
- **Inconsistent:** `seniorityLevel`, `availability`, `timezone`, `maxSalary`, `minSalary`, `riskTolerance`, `minProficiency`

Six property types only support hard constraints without preferred alternatives, limiting managers' ability to express nuanced requirements.

### Key Discoveries:
- Existing pattern for required/preferred in `search.types.ts:20-21, 37-38`
- Utility weights defined in `knowledge-base.config.ts:113-123` (currently sum to 1.0)
- Preferred skill bonus pattern in `utility-calculator.service.ts:84-106`
- Validation in `validate-search.middleware.ts:27-236`

## Desired End State

After implementation:
1. All hard constraint fields use `required` prefix consistently
2. Six new `preferred` properties provide ranking boosts
3. Utility weights remain normalized (sum to 1.0)
4. All tests pass and Postman collection updated

### Verification:
- `npm run typecheck` passes
- API accepts both required and preferred variants
- Preferred properties boost scores without filtering
- Postman collection tests work with new names

## What We're NOT Doing

- Backward compatibility aliases for old property names
- Changing the utility calculation formula structure
- Modifying Neo4j queries (preferred values only affect scoring)
- Adding new API endpoints

## Implementation Approach

Work through the data flow from types → validation → constraint expansion → utility calculation → response. Update Postman collection last.

---

## Phase 1: Types & Interfaces

### Overview
Update TypeScript interfaces to rename existing properties and add new preferred variants.

### Changes Required:

#### 1. Search Types
**File**: `recommender_api/src/types/search.types.ts`

**Rename existing properties and add new ones in `SearchFilterRequest`:**

```typescript
export interface PreferredSalaryRange {
  min: number;
  max: number;
}

export interface SearchFilterRequest {
  // Core constraints - RENAMED
  requiredSeniorityLevel?: SeniorityLevel;      // was: seniorityLevel
  requiredSkills?: string[];                     // unchanged
  preferredSkills?: string[];                    // unchanged
  requiredAvailability?: AvailabilityOption[];   // was: availability
  requiredTimezone?: string;                     // was: timezone

  // Budget constraints - RENAMED
  requiredMaxSalary?: number;   // was: maxSalary
  requiredMinSalary?: number;   // was: minSalary

  // Quality constraints - RENAMED
  requiredRiskTolerance?: RiskTolerance;         // was: riskTolerance
  requiredMinProficiency?: ProficiencyLevel;     // was: minProficiency

  // Context constraints (for ranking bonuses) - unchanged
  teamFocus?: TeamFocus;

  // Domain filtering - unchanged
  requiredDomains?: string[];
  preferredDomains?: string[];

  // NEW: Preferred properties for ranking boosts
  preferredSeniorityLevel?: SeniorityLevel;
  preferredAvailability?: AvailabilityOption[];  // ordered preference list
  preferredTimezone?: string[];                  // ordered preference list
  preferredSalaryRange?: PreferredSalaryRange;   // ideal salary range
  preferredConfidenceScore?: number;             // threshold for bonus (0-1)
  preferredProficiency?: ProficiencyLevel;

  // Pagination - unchanged
  limit?: number;
  offset?: number;
}
```

**Add new score breakdown components:**

```typescript
export interface AvailabilityBonusComponent extends ScoreComponent {
  matchedAvailability: string | null;  // Which preferred availability matched
  rank: number;                        // Position in preference list (0 = best)
}

export interface TimezoneBonusComponent extends ScoreComponent {
  matchedTimezone: string | null;
  rank: number;
}

export interface SeniorityBonusComponent extends ScoreComponent {
  matchedLevel: boolean;  // Whether engineer meets/exceeds preferred level
}

export interface SalaryRangeBonusComponent extends ScoreComponent {
  inPreferredRange: boolean;
}

export interface ConfidenceBonusComponent extends ScoreComponent {
  meetsPreferred: boolean;
}

export interface ProficiencyBonusComponent extends ScoreComponent {
  matchedLevel: boolean;
}
```

**Update `ScoreBreakdown.components`:**

```typescript
export interface ScoreBreakdown {
  components: {
    skillMatch: ScoreComponent;
    confidence: ScoreComponent;
    experience: ScoreComponent;
    availability: ScoreComponent;
    salary: ScoreComponent;
    preferredSkillsBonus: PreferredSkillsBonusComponent;
    teamFocusBonus: TeamFocusBonusComponent;
    relatedSkillsBonus: RelatedSkillsBonusComponent;
    domainBonus: DomainBonusComponent;
    // NEW components
    preferredAvailabilityBonus: AvailabilityBonusComponent;
    preferredTimezoneBonus: TimezoneBonusComponent;
    preferredSeniorityBonus: SeniorityBonusComponent;
    preferredSalaryRangeBonus: SalaryRangeBonusComponent;
    preferredConfidenceBonus: ConfidenceBonusComponent;
    preferredProficiencyBonus: ProficiencyBonusComponent;
  };
  total: number;
}
```

#### 2. Knowledge Base Types
**File**: `recommender_api/src/types/knowledge-base.types.ts`

**Update `UtilityWeights`:**

```typescript
export interface UtilityWeights {
  skillMatch: number;
  confidenceScore: number;
  yearsExperience: number;
  availability: number;
  salary: number;
  preferredSkillsBonus: number;
  teamFocusBonus: number;
  relatedSkillsBonus: number;
  domainBonus: number;
  // NEW weights
  preferredAvailabilityBonus: number;
  preferredTimezoneBonus: number;
  preferredSeniorityBonus: number;
  preferredSalaryRangeBonus: number;
  preferredConfidenceBonus: number;
  preferredProficiencyBonus: number;
}
```

**Update `UtilityFunctionParams`:**

```typescript
export interface UtilityFunctionParams {
  // Existing params...
  confidenceMin: number;
  confidenceMax: number;
  yearsExperienceMax: number;
  salaryMin: number;
  salaryMax: number;
  preferredSkillsBonusMax: number;
  teamFocusBonusMax: number;
  relatedSkillsBonusMax: number;
  domainBonusMax: number;
  // NEW params
  preferredAvailabilityBonusMax: number;
  preferredTimezoneBonusMax: number;
  preferredSeniorityBonusMax: number;
  preferredSalaryRangeBonusMax: number;
  preferredConfidenceBonusMax: number;
  preferredProficiencyBonusMax: number;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck` (will fail until other phases complete)

---

## Phase 2: Knowledge Base Configuration

### Overview
Add utility weights and parameters for the 6 new preferred bonuses. Rebalance weights to sum to 1.0.

### Changes Required:

#### 1. Knowledge Base Config
**File**: `recommender_api/src/config/knowledge-base.config.ts`

**Update `utilityWeights` (rebalanced to sum to 1.0):**

```typescript
utilityWeights: {
  // Core attributes (reduced slightly to make room for new bonuses)
  skillMatch: 0.22,              // was 0.25
  confidenceScore: 0.14,         // was 0.16
  yearsExperience: 0.11,         // was 0.13
  availability: 0.11,            // was 0.13
  salary: 0.07,                  // was 0.08
  // Existing bonuses
  preferredSkillsBonus: 0.08,    // was 0.10
  teamFocusBonus: 0.04,          // was 0.05
  relatedSkillsBonus: 0.04,      // was 0.05
  domainBonus: 0.04,             // was 0.05
  // NEW bonuses (total: 0.15)
  preferredAvailabilityBonus: 0.03,
  preferredTimezoneBonus: 0.02,
  preferredSeniorityBonus: 0.03,
  preferredSalaryRangeBonus: 0.03,
  preferredConfidenceBonus: 0.02,
  preferredProficiencyBonus: 0.02,
},
```

**Update `utilityParams`:**

```typescript
utilityParams: {
  // Existing params
  confidenceMin: 0.5,
  confidenceMax: 1.0,
  yearsExperienceMax: 20,
  salaryMin: 80000,
  salaryMax: 300000,
  preferredSkillsBonusMax: 1.0,
  teamFocusBonusMax: 0.5,
  relatedSkillsBonusMax: 5,
  domainBonusMax: 1.0,
  // NEW params
  preferredAvailabilityBonusMax: 1.0,   // Full bonus for top preference
  preferredTimezoneBonusMax: 1.0,
  preferredSeniorityBonusMax: 1.0,
  preferredSalaryRangeBonusMax: 1.0,
  preferredConfidenceBonusMax: 1.0,
  preferredProficiencyBonusMax: 1.0,
},
```

**Update `defaults` with renamed properties:**

```typescript
defaults: {
  requiredRiskTolerance: 'medium',      // was: riskTolerance
  requiredMinProficiency: 'proficient', // was: minProficiency
  requiredAvailability: ['immediate', 'two_weeks', 'one_month'],  // was: availability
  limit: 20,
  offset: 0,
},
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles after Phase 1+2: `npm run typecheck` (will still fail)

---

## Phase 3: Validation Middleware

### Overview
Update validation to use renamed properties and add validation for new preferred properties.

### Changes Required:

#### 1. Validate Search Middleware
**File**: `recommender_api/src/middleware/validate-search.middleware.ts`

**Rename all property references and add new validations:**

```typescript
// Validate requiredSeniorityLevel (was: seniorityLevel)
if (body.requiredSeniorityLevel !== undefined) {
  if (!VALID_SENIORITY_LEVELS.includes(body.requiredSeniorityLevel)) {
    errors.push({
      field: 'requiredSeniorityLevel',
      message: `Must be one of: ${VALID_SENIORITY_LEVELS.join(', ')}`,
    });
  }
}

// Validate preferredSeniorityLevel (NEW)
if (body.preferredSeniorityLevel !== undefined) {
  if (!VALID_SENIORITY_LEVELS.includes(body.preferredSeniorityLevel)) {
    errors.push({
      field: 'preferredSeniorityLevel',
      message: `Must be one of: ${VALID_SENIORITY_LEVELS.join(', ')}`,
    });
  }
}

// Validate requiredRiskTolerance (was: riskTolerance)
if (body.requiredRiskTolerance !== undefined) {
  if (!VALID_RISK_TOLERANCES.includes(body.requiredRiskTolerance)) {
    errors.push({
      field: 'requiredRiskTolerance',
      message: `Must be one of: ${VALID_RISK_TOLERANCES.join(', ')}`,
    });
  }
}

// Validate requiredMinProficiency (was: minProficiency)
if (body.requiredMinProficiency !== undefined) {
  if (!VALID_PROFICIENCY_LEVELS.includes(body.requiredMinProficiency)) {
    errors.push({
      field: 'requiredMinProficiency',
      message: `Must be one of: ${VALID_PROFICIENCY_LEVELS.join(', ')}`,
    });
  }
}

// Validate preferredProficiency (NEW)
if (body.preferredProficiency !== undefined) {
  if (!VALID_PROFICIENCY_LEVELS.includes(body.preferredProficiency)) {
    errors.push({
      field: 'preferredProficiency',
      message: `Must be one of: ${VALID_PROFICIENCY_LEVELS.join(', ')}`,
    });
  }
}

// Validate requiredAvailability (was: availability)
if (body.requiredAvailability !== undefined) {
  if (!Array.isArray(body.requiredAvailability)) {
    errors.push({
      field: 'requiredAvailability',
      message: 'Must be an array',
    });
  } else {
    const invalidOptions = body.requiredAvailability.filter(
      (opt) => !VALID_AVAILABILITY_OPTIONS.includes(opt)
    );
    if (invalidOptions.length > 0) {
      errors.push({
        field: 'requiredAvailability',
        message: `Invalid options: ${invalidOptions.join(', ')}. Must be one of: ${VALID_AVAILABILITY_OPTIONS.join(', ')}`,
      });
    }
  }
}

// Validate preferredAvailability (NEW)
if (body.preferredAvailability !== undefined) {
  if (!Array.isArray(body.preferredAvailability)) {
    errors.push({
      field: 'preferredAvailability',
      message: 'Must be an array (ordered preference list)',
    });
  } else {
    const invalidOptions = body.preferredAvailability.filter(
      (opt) => !VALID_AVAILABILITY_OPTIONS.includes(opt)
    );
    if (invalidOptions.length > 0) {
      errors.push({
        field: 'preferredAvailability',
        message: `Invalid options: ${invalidOptions.join(', ')}. Must be one of: ${VALID_AVAILABILITY_OPTIONS.join(', ')}`,
      });
    }
  }
}

// Validate requiredTimezone (was: timezone)
if (body.requiredTimezone !== undefined) {
  if (typeof body.requiredTimezone !== 'string') {
    errors.push({
      field: 'requiredTimezone',
      message: 'Must be a string',
    });
  }
}

// Validate preferredTimezone (NEW)
if (body.preferredTimezone !== undefined) {
  if (!Array.isArray(body.preferredTimezone)) {
    errors.push({
      field: 'preferredTimezone',
      message: 'Must be an array of strings (ordered preference list)',
    });
  } else if (!body.preferredTimezone.every((tz) => typeof tz === 'string')) {
    errors.push({
      field: 'preferredTimezone',
      message: 'All items must be strings',
    });
  }
}

// Validate requiredMaxSalary (was: maxSalary)
if (body.requiredMaxSalary !== undefined) {
  if (typeof body.requiredMaxSalary !== 'number' || body.requiredMaxSalary <= 0) {
    errors.push({
      field: 'requiredMaxSalary',
      message: 'Must be a positive number',
    });
  }
}

// Validate requiredMinSalary (was: minSalary)
if (body.requiredMinSalary !== undefined) {
  if (typeof body.requiredMinSalary !== 'number' || body.requiredMinSalary <= 0) {
    errors.push({
      field: 'requiredMinSalary',
      message: 'Must be a positive number',
    });
  }
}

// Validate requiredMinSalary <= requiredMaxSalary
if (body.requiredMinSalary !== undefined && body.requiredMaxSalary !== undefined) {
  if (body.requiredMinSalary > body.requiredMaxSalary) {
    errors.push({
      field: 'requiredMinSalary',
      message: 'Must be less than or equal to requiredMaxSalary',
    });
  }
}

// Validate preferredSalaryRange (NEW)
if (body.preferredSalaryRange !== undefined) {
  if (typeof body.preferredSalaryRange !== 'object' || body.preferredSalaryRange === null) {
    errors.push({
      field: 'preferredSalaryRange',
      message: 'Must be an object with min and max properties',
    });
  } else {
    const { min, max } = body.preferredSalaryRange;
    if (typeof min !== 'number' || min <= 0) {
      errors.push({
        field: 'preferredSalaryRange.min',
        message: 'Must be a positive number',
      });
    }
    if (typeof max !== 'number' || max <= 0) {
      errors.push({
        field: 'preferredSalaryRange.max',
        message: 'Must be a positive number',
      });
    }
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      errors.push({
        field: 'preferredSalaryRange',
        message: 'min must be less than or equal to max',
      });
    }
  }
}

// Validate preferredConfidenceScore (NEW)
if (body.preferredConfidenceScore !== undefined) {
  if (typeof body.preferredConfidenceScore !== 'number' ||
      body.preferredConfidenceScore < 0 ||
      body.preferredConfidenceScore > 1) {
    errors.push({
      field: 'preferredConfidenceScore',
      message: 'Must be a number between 0 and 1',
    });
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck` (will still fail)

---

## Phase 4: Constraint Expander Service

### Overview
Update field references to use renamed properties and pass through preferred values for utility calculation.

### Changes Required:

#### 1. Constraint Expander Service
**File**: `recommender_api/src/services/constraint-expander.service.ts`

**Update `ExpandedConstraints` interface:**

```typescript
export interface ExpandedConstraints {
  // Existing fields (unchanged names - these are internal)
  minYearsExperience: number;
  maxYearsExperience: number | null;
  minConfidenceScore: number;
  allowedProficiencyLevels: ProficiencyLevel[];
  availability: AvailabilityOption[];
  timezonePrefix: string | null;
  maxSalary: number | null;
  minSalary: number | null;
  bonusSkillIds: string[];
  limit: number;
  offset: number;
  appliedConstraints: AppliedConstraint[];
  defaultsApplied: string[];

  // NEW: Pass-through preferred values for utility calculation
  preferredSeniorityLevel: SeniorityLevel | null;
  preferredAvailability: AvailabilityOption[];
  preferredTimezone: string[];
  preferredSalaryRange: { min: number; max: number } | null;
  preferredConfidenceScore: number | null;
  preferredProficiency: ProficiencyLevel | null;
}
```

**Update `expandConstraints` function to use renamed properties:**

```typescript
export function expandConstraints(request: SearchFilterRequest): ExpandedConstraints {
  const appliedConstraints: AppliedConstraint[] = [];
  const defaultsApplied: string[] = [];
  const config = knowledgeBaseConfig;

  // ============================================
  // SENIORITY LEVEL -> YEARS EXPERIENCE
  // ============================================
  let minYearsExperience = 0;
  let maxYearsExperience: number | null = null;

  if (request.requiredSeniorityLevel) {  // RENAMED
    const mapping = config.seniorityMapping[request.requiredSeniorityLevel];
    minYearsExperience = mapping.minYears;
    maxYearsExperience = mapping.maxYears;

    const valueStr = maxYearsExperience !== null
      ? `${minYearsExperience} AND ${maxYearsExperience}`
      : `>= ${minYearsExperience}`;

    appliedConstraints.push({
      field: 'yearsExperience',
      operator: maxYearsExperience !== null ? 'BETWEEN' : '>=',
      value: valueStr,
      source: 'knowledge_base',
    });
  }

  // ============================================
  // RISK TOLERANCE -> CONFIDENCE SCORE
  // ============================================
  const riskTolerance = request.requiredRiskTolerance || config.defaults.requiredRiskTolerance;  // RENAMED
  if (!request.requiredRiskTolerance) {
    defaultsApplied.push('requiredRiskTolerance');
  }

  const confidenceMapping = config.riskToleranceMapping[riskTolerance];
  const minConfidenceScore = confidenceMapping.minConfidenceScore;

  appliedConstraints.push({
    field: 'confidenceScore',
    operator: '>=',
    value: minConfidenceScore.toFixed(2),
    source: request.requiredRiskTolerance ? 'user' : 'knowledge_base',
  });

  // ============================================
  // MIN PROFICIENCY -> ALLOWED LEVELS
  // ============================================
  const minProficiency = request.requiredMinProficiency || config.defaults.requiredMinProficiency;  // RENAMED
  if (!request.requiredMinProficiency) {
    defaultsApplied.push('requiredMinProficiency');
  }

  const allowedProficiencyLevels = config.proficiencyMapping[minProficiency];

  appliedConstraints.push({
    field: 'proficiencyLevel',
    operator: 'IN',
    value: JSON.stringify(allowedProficiencyLevels),
    source: request.requiredMinProficiency ? 'user' : 'knowledge_base',
  });

  // ============================================
  // AVAILABILITY
  // ============================================
  const availability = request.requiredAvailability || config.defaults.requiredAvailability;  // RENAMED
  if (!request.requiredAvailability) {
    defaultsApplied.push('requiredAvailability');
  }

  appliedConstraints.push({
    field: 'availability',
    operator: 'IN',
    value: JSON.stringify(availability),
    source: request.requiredAvailability ? 'user' : 'knowledge_base',
  });

  // ============================================
  // TIMEZONE
  // ============================================
  let timezonePrefix: string | null = null;

  if (request.requiredTimezone) {  // RENAMED
    timezonePrefix = request.requiredTimezone.replace(/\*$/, '');

    appliedConstraints.push({
      field: 'timezone',
      operator: 'STARTS WITH',
      value: timezonePrefix,
      source: 'user',
    });
  }

  // ============================================
  // SALARY CONSTRAINTS
  // ============================================
  const maxSalary = request.requiredMaxSalary ?? null;  // RENAMED
  const minSalary = request.requiredMinSalary ?? null;  // RENAMED

  if (maxSalary !== null) {
    appliedConstraints.push({
      field: 'salary',
      operator: '<=',
      value: maxSalary.toString(),
      source: 'user',
    });
  }

  if (minSalary !== null) {
    appliedConstraints.push({
      field: 'salary',
      operator: '>=',
      value: minSalary.toString(),
      source: 'user',
    });
  }

  // ============================================
  // TEAM FOCUS -> BONUS SKILLS (unchanged)
  // ============================================
  let bonusSkillIds: string[] = [];

  if (request.teamFocus) {
    const bonus = config.teamFocusBonusMapping[request.teamFocus];
    bonusSkillIds = bonus.bonusSkillIds;

    appliedConstraints.push({
      field: 'teamFocusBonus',
      operator: 'BOOST',
      value: bonusSkillIds.join(', '),
      source: 'knowledge_base',
    });
  }

  // ============================================
  // PAGINATION (unchanged)
  // ============================================
  const limit = Math.min(request.limit ?? config.defaults.limit, 100);
  const offset = request.offset ?? config.defaults.offset;

  if (!request.limit) {
    defaultsApplied.push('limit');
  }
  if (!request.offset) {
    defaultsApplied.push('offset');
  }

  // ============================================
  // REQUIRED SKILLS (tracked as constraint)
  // ============================================
  if (request.requiredSkills && request.requiredSkills.length > 0) {
    appliedConstraints.push({
      field: 'requiredSkills',
      operator: 'IN',
      value: JSON.stringify(request.requiredSkills),
      source: 'user',
    });
  }

  // ============================================
  // PREFERRED SKILLS (tracked as constraint)
  // ============================================
  if (request.preferredSkills && request.preferredSkills.length > 0) {
    appliedConstraints.push({
      field: 'preferredSkills',
      operator: 'BOOST',
      value: JSON.stringify(request.preferredSkills),
      source: 'user',
    });
  }

  // ============================================
  // NEW: PREFERRED VALUES (pass-through for utility)
  // ============================================
  if (request.preferredSeniorityLevel) {
    appliedConstraints.push({
      field: 'preferredSeniorityLevel',
      operator: 'BOOST',
      value: request.preferredSeniorityLevel,
      source: 'user',
    });
  }

  if (request.preferredAvailability && request.preferredAvailability.length > 0) {
    appliedConstraints.push({
      field: 'preferredAvailability',
      operator: 'BOOST',
      value: JSON.stringify(request.preferredAvailability),
      source: 'user',
    });
  }

  if (request.preferredTimezone && request.preferredTimezone.length > 0) {
    appliedConstraints.push({
      field: 'preferredTimezone',
      operator: 'BOOST',
      value: JSON.stringify(request.preferredTimezone),
      source: 'user',
    });
  }

  if (request.preferredSalaryRange) {
    appliedConstraints.push({
      field: 'preferredSalaryRange',
      operator: 'BOOST',
      value: JSON.stringify(request.preferredSalaryRange),
      source: 'user',
    });
  }

  if (request.preferredConfidenceScore !== undefined) {
    appliedConstraints.push({
      field: 'preferredConfidenceScore',
      operator: 'BOOST',
      value: request.preferredConfidenceScore.toString(),
      source: 'user',
    });
  }

  if (request.preferredProficiency) {
    appliedConstraints.push({
      field: 'preferredProficiency',
      operator: 'BOOST',
      value: request.preferredProficiency,
      source: 'user',
    });
  }

  return {
    minYearsExperience,
    maxYearsExperience,
    minConfidenceScore,
    allowedProficiencyLevels,
    availability,
    timezonePrefix,
    maxSalary,
    minSalary,
    bonusSkillIds,
    limit,
    offset,
    appliedConstraints,
    defaultsApplied,
    // NEW: Pass-through preferred values
    preferredSeniorityLevel: request.preferredSeniorityLevel ?? null,
    preferredAvailability: request.preferredAvailability ?? [],
    preferredTimezone: request.preferredTimezone ?? [],
    preferredSalaryRange: request.preferredSalaryRange ?? null,
    preferredConfidenceScore: request.preferredConfidenceScore ?? null,
    preferredProficiency: request.preferredProficiency ?? null,
  };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck` (will still fail)

---

## Phase 5: Utility Calculator Service

### Overview
Add 6 new bonus calculation functions and update score breakdown to include new components.

### Changes Required:

#### 1. Utility Calculator Service
**File**: `recommender_api/src/services/utility-calculator.service.ts`

**Update imports to include new types:**

```typescript
import type {
  MatchedSkill,
  UnmatchedRelatedSkill,
  MatchStrength,
  AvailabilityOption,
  ScoreBreakdown,
  ScoreComponent,
  TeamFocusBonusComponent,
  PreferredSkillsBonusComponent,
  RelatedSkillsBonusComponent,
  DomainBonusComponent,
  // NEW types
  AvailabilityBonusComponent,
  TimezoneBonusComponent,
  SeniorityBonusComponent,
  SalaryRangeBonusComponent,
  ConfidenceBonusComponent,
  ProficiencyBonusComponent,
  SeniorityLevel,
  ProficiencyLevel,
} from '../types/search.types.js';
```

**Update `UtilityContext` interface:**

```typescript
export interface UtilityContext {
  requestedSkillIds: string[];
  preferredSkillIds: string[];
  preferredDomainIds: string[];
  bonusSkillIds: string[];
  maxSalaryBudget: number | null;
  // NEW: Preferred values for bonus calculation
  preferredSeniorityLevel: SeniorityLevel | null;
  preferredAvailability: AvailabilityOption[];
  preferredTimezone: string[];
  preferredSalaryRange: { min: number; max: number } | null;
  preferredConfidenceScore: number | null;
  preferredProficiency: ProficiencyLevel | null;
}
```

**Add new bonus calculation functions:**

```typescript
/**
 * Calculates preferred availability bonus.
 * Higher bonus for earlier positions in preference list.
 */
function calculatePreferredAvailabilityBonus(
  engineerAvailability: AvailabilityOption,
  preferredAvailability: AvailabilityOption[],
  maxBonus: number
): { raw: number; matchedAvailability: string | null; rank: number } {
  if (preferredAvailability.length === 0) {
    return { raw: 0, matchedAvailability: null, rank: -1 };
  }

  const index = preferredAvailability.indexOf(engineerAvailability);
  if (index === -1) {
    return { raw: 0, matchedAvailability: null, rank: -1 };
  }

  // Higher bonus for earlier positions: 1st = full, 2nd = 75%, 3rd = 50%, 4th = 25%
  const positionMultiplier = 1 - (index / preferredAvailability.length);
  const raw = positionMultiplier * maxBonus;

  return { raw, matchedAvailability: engineerAvailability, rank: index };
}

/**
 * Calculates preferred timezone bonus.
 * Matches against prefix patterns in preference order.
 */
function calculatePreferredTimezoneBonus(
  engineerTimezone: string,
  preferredTimezone: string[],
  maxBonus: number
): { raw: number; matchedTimezone: string | null; rank: number } {
  if (preferredTimezone.length === 0) {
    return { raw: 0, matchedTimezone: null, rank: -1 };
  }

  for (let i = 0; i < preferredTimezone.length; i++) {
    const pattern = preferredTimezone[i].replace(/\*$/, '');
    if (engineerTimezone.startsWith(pattern) || engineerTimezone === preferredTimezone[i]) {
      const positionMultiplier = 1 - (i / preferredTimezone.length);
      const raw = positionMultiplier * maxBonus;
      return { raw, matchedTimezone: preferredTimezone[i], rank: i };
    }
  }

  return { raw: 0, matchedTimezone: null, rank: -1 };
}

/**
 * Calculates preferred seniority bonus.
 * Full bonus if engineer meets or exceeds preferred level.
 */
function calculatePreferredSeniorityBonus(
  engineerYearsExperience: number,
  preferredSeniorityLevel: SeniorityLevel | null,
  maxBonus: number
): { raw: number; matchedLevel: boolean } {
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

  return { raw: matchedLevel ? maxBonus : 0, matchedLevel };
}

/**
 * Calculates preferred salary range bonus.
 * Full bonus if salary is within preferred range.
 */
function calculatePreferredSalaryRangeBonus(
  engineerSalary: number,
  preferredSalaryRange: { min: number; max: number } | null,
  maxBonus: number
): { raw: number; inPreferredRange: boolean } {
  if (!preferredSalaryRange) {
    return { raw: 0, inPreferredRange: false };
  }

  const inPreferredRange = engineerSalary >= preferredSalaryRange.min &&
                           engineerSalary <= preferredSalaryRange.max;

  return { raw: inPreferredRange ? maxBonus : 0, inPreferredRange };
}

/**
 * Calculates preferred confidence score bonus.
 * Full bonus if engineer's average confidence meets threshold.
 */
function calculatePreferredConfidenceBonus(
  avgConfidence: number,
  preferredConfidenceScore: number | null,
  maxBonus: number
): { raw: number; meetsPreferred: boolean } {
  if (preferredConfidenceScore === null || avgConfidence <= 0) {
    return { raw: 0, meetsPreferred: false };
  }

  const meetsPreferred = avgConfidence >= preferredConfidenceScore;

  return { raw: meetsPreferred ? maxBonus : 0, meetsPreferred };
}

/**
 * Calculates preferred proficiency bonus.
 * Full bonus if engineer has skills at or above preferred level.
 */
function calculatePreferredProficiencyBonus(
  matchedSkills: MatchedSkill[],
  preferredProficiency: ProficiencyLevel | null,
  maxBonus: number
): { raw: number; matchedLevel: boolean } {
  if (!preferredProficiency || matchedSkills.length === 0) {
    return { raw: 0, matchedLevel: false };
  }

  const proficiencyOrder: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];
  const preferredIndex = proficiencyOrder.indexOf(preferredProficiency);

  // Check if any matched skill meets or exceeds preferred proficiency
  const matchedLevel = matchedSkills.some((skill) => {
    const skillIndex = proficiencyOrder.indexOf(skill.proficiencyLevel as ProficiencyLevel);
    return skillIndex >= preferredIndex;
  });

  return { raw: matchedLevel ? maxBonus : 0, matchedLevel };
}
```

**Update `calculateUtilityWithBreakdown` function:**

Add calculations for the 6 new bonuses after the existing ones:

```typescript
// NEW: Calculate preferred bonuses
const preferredAvailabilityResult = calculatePreferredAvailabilityBonus(
  engineer.availability as AvailabilityOption,
  context.preferredAvailability,
  params.preferredAvailabilityBonusMax
);

const preferredTimezoneResult = calculatePreferredTimezoneBonus(
  engineer.timezone,
  context.preferredTimezone,
  params.preferredTimezoneBonusMax
);

const preferredSeniorityResult = calculatePreferredSeniorityBonus(
  engineer.yearsExperience,
  context.preferredSeniorityLevel,
  params.preferredSeniorityBonusMax
);

const preferredSalaryRangeResult = calculatePreferredSalaryRangeBonus(
  engineer.salary,
  context.preferredSalaryRange,
  params.preferredSalaryRangeBonusMax
);

const preferredConfidenceResult = calculatePreferredConfidenceBonus(
  engineer.avgConfidence,
  context.preferredConfidenceScore,
  params.preferredConfidenceBonusMax
);

const preferredProficiencyResult = calculatePreferredProficiencyBonus(
  engineer.matchedSkills,
  context.preferredProficiency,
  params.preferredProficiencyBonusMax
);
```

**Update the components object:**

```typescript
const components = {
  // Existing components...
  skillMatch: buildComponent(skillMatchRaw, weights.skillMatch),
  confidence: buildComponent(confidenceRaw, weights.confidenceScore),
  experience: buildComponent(experienceRaw, weights.yearsExperience),
  availability: buildComponent(availabilityRaw, weights.availability),
  salary: buildComponent(salaryRaw, weights.salary),
  preferredSkillsBonus: {
    ...buildComponent(preferredSkillsResult.raw, weights.preferredSkillsBonus),
    matchedSkills: preferredSkillsResult.matchedSkillNames,
  } as PreferredSkillsBonusComponent,
  teamFocusBonus: {
    ...buildComponent(teamFocusResult.raw, weights.teamFocusBonus),
    matchedSkills: teamFocusResult.matchedSkillNames,
  } as TeamFocusBonusComponent,
  relatedSkillsBonus: {
    ...buildComponent(relatedSkillsResult.raw, weights.relatedSkillsBonus),
    count: relatedSkillsResult.count,
  } as RelatedSkillsBonusComponent,
  domainBonus: {
    ...buildComponent(domainBonusResult.raw, weights.domainBonus),
    matchedDomains: domainBonusResult.matchedDomainNames,
  } as DomainBonusComponent,
  // NEW components
  preferredAvailabilityBonus: {
    ...buildComponent(preferredAvailabilityResult.raw, weights.preferredAvailabilityBonus),
    matchedAvailability: preferredAvailabilityResult.matchedAvailability,
    rank: preferredAvailabilityResult.rank,
  } as AvailabilityBonusComponent,
  preferredTimezoneBonus: {
    ...buildComponent(preferredTimezoneResult.raw, weights.preferredTimezoneBonus),
    matchedTimezone: preferredTimezoneResult.matchedTimezone,
    rank: preferredTimezoneResult.rank,
  } as TimezoneBonusComponent,
  preferredSeniorityBonus: {
    ...buildComponent(preferredSeniorityResult.raw, weights.preferredSeniorityBonus),
    matchedLevel: preferredSeniorityResult.matchedLevel,
  } as SeniorityBonusComponent,
  preferredSalaryRangeBonus: {
    ...buildComponent(preferredSalaryRangeResult.raw, weights.preferredSalaryRangeBonus),
    inPreferredRange: preferredSalaryRangeResult.inPreferredRange,
  } as SalaryRangeBonusComponent,
  preferredConfidenceBonus: {
    ...buildComponent(preferredConfidenceResult.raw, weights.preferredConfidenceBonus),
    meetsPreferred: preferredConfidenceResult.meetsPreferred,
  } as ConfidenceBonusComponent,
  preferredProficiencyBonus: {
    ...buildComponent(preferredProficiencyResult.raw, weights.preferredProficiencyBonus),
    matchedLevel: preferredProficiencyResult.matchedLevel,
  } as ProficiencyBonusComponent,
};
```

**Also update `calculateUtilityScore` function** to include the new weights in the sum.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck` (will still fail)

---

## Phase 6: Search Service

### Overview
Wire up new preferred values from expanded constraints to utility context.

### Changes Required:

#### 1. Search Service
**File**: `recommender_api/src/services/search.service.ts`

**Update utility context creation:**

```typescript
// Step 6: Calculate utility scores and rank
const utilityContext: UtilityContext = {
  requestedSkillIds: targetSkillIds || [],
  preferredSkillIds,
  preferredDomainIds,
  bonusSkillIds: expanded.bonusSkillIds,
  maxSalaryBudget: expanded.maxSalary,
  // NEW: Pass through preferred values
  preferredSeniorityLevel: expanded.preferredSeniorityLevel,
  preferredAvailability: expanded.preferredAvailability,
  preferredTimezone: expanded.preferredTimezone,
  preferredSalaryRange: expanded.preferredSalaryRange,
  preferredConfidenceScore: expanded.preferredConfidenceScore,
  preferredProficiency: expanded.preferredProficiency,
};
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] No linting errors: `npm run lint` (if configured)

#### Manual Verification:
- [ ] API starts without errors: `npm run dev`
- [ ] Empty request still works (browse mode)
- [ ] Test with new preferred properties returns expected score breakdown

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the API is functioning before proceeding to Phase 7.

---

## Phase 7: Postman Collection

### Overview
Update all test requests to use renamed properties.

### Changes Required:

#### 1. Postman Collection
**File**: `postman/search-filter-tests.postman_collection.json`

**Property renames to apply across all requests:**

| Old Property | New Property |
|-------------|--------------|
| `seniorityLevel` | `requiredSeniorityLevel` |
| `availability` | `requiredAvailability` |
| `timezone` | `requiredTimezone` |
| `maxSalary` | `requiredMaxSalary` |
| `minSalary` | `requiredMinSalary` |
| `riskTolerance` | `requiredRiskTolerance` |
| `minProficiency` | `requiredMinProficiency` |

**Requests to update:**

1. **02 - Seniority Level: Senior**: `seniorityLevel` -> `requiredSeniorityLevel`
2. **03 - Seniority Level: Junior**: `seniorityLevel` -> `requiredSeniorityLevel`
3. **07 - Timezone Filter: America/***: `timezone` -> `requiredTimezone`
4. **08 - Timezone Filter: Europe/***: `timezone` -> `requiredTimezone`
5. **09 - Availability: Immediate Only**: `availability` -> `requiredAvailability`
6. **10 - Include Unavailable Engineers**: `availability` -> `requiredAvailability`
7. **11 - Risk Tolerance: Low**: `riskTolerance` -> `requiredRiskTolerance`
8. **12 - Risk Tolerance: High**: `riskTolerance` -> `requiredRiskTolerance`
9. **13 - Min Proficiency: Expert Only**: `minProficiency` -> `requiredMinProficiency`
10. **14 - Min Proficiency: Learning**: `minProficiency` -> `requiredMinProficiency`
11. **17 - Salary Range Filter**: `minSalary`/`maxSalary` -> `requiredMinSalary`/`requiredMaxSalary`
12. **18 - Max Salary Only**: `maxSalary` -> `requiredMaxSalary`
13. **21 - Combined: Senior Backend in America**: Update all renamed properties
14. **22 - Combined: Full Stack Scaling Team**: Update all renamed properties
15. **25 - Staff+ Seniority Levels**: `seniorityLevel` -> `requiredSeniorityLevel`
16. **26 - Principal Level Engineers**: Update all renamed properties

**Also update descriptions** to reference new property names in the "Expected appliedConstraints" tables and notes.

**Add new test requests for preferred properties:**

27. **27 - Preferred Availability (Ranking Boost)**
```json
{
  "requiredAvailability": ["immediate", "two_weeks", "one_month"],
  "preferredAvailability": ["immediate", "two_weeks"]
}
```

28. **28 - Preferred Timezone (Ranking Boost)**
```json
{
  "requiredTimezone": "America/*",
  "preferredTimezone": ["America/Los_Angeles", "America/Denver"]
}
```

29. **29 - Preferred Seniority (Staff Preferred)**
```json
{
  "requiredSeniorityLevel": "senior",
  "preferredSeniorityLevel": "staff"
}
```

30. **30 - Preferred Salary Range**
```json
{
  "requiredMaxSalary": 200000,
  "preferredSalaryRange": { "min": 150000, "max": 180000 }
}
```

31. **31 - Preferred Confidence Score**
```json
{
  "requiredRiskTolerance": "medium",
  "preferredConfidenceScore": 0.9
}
```

32. **32 - Preferred Proficiency (Expert Preferred)**
```json
{
  "requiredMinProficiency": "proficient",
  "preferredProficiency": "expert"
}
```

33. **33 - Combined: All Preferred Properties**
```json
{
  "requiredSkills": ["Backend"],
  "requiredSeniorityLevel": "senior",
  "requiredAvailability": ["immediate", "two_weeks"],
  "requiredTimezone": "America/*",
  "requiredMaxSalary": 200000,
  "preferredSeniorityLevel": "staff",
  "preferredAvailability": ["immediate"],
  "preferredTimezone": ["America/Los_Angeles"],
  "preferredSalaryRange": { "min": 150000, "max": 180000 },
  "preferredConfidenceScore": 0.85,
  "preferredProficiency": "expert"
}
```

### Success Criteria:

#### Automated Verification:
- [ ] JSON is valid (can be imported into Postman)

#### Manual Verification:
- [ ] Import collection into Postman
- [ ] Run test 01 (Browse Mode) - should pass
- [ ] Run test 02-26 with updated property names - should pass
- [ ] Run new tests 27-33 - verify preferred bonuses appear in score breakdown
- [ ] Verify score differences between requests with and without preferred properties

---

## Testing Strategy

### Unit Tests:
- Type compatibility for new interfaces
- Validation middleware rejects invalid preferred values
- Utility bonus calculations return correct values

### Integration Tests:
- End-to-end request with all new properties
- Verify preferred bonuses don't filter (only rank)
- Verify score breakdown includes all 15 components

### Manual Testing Steps:
1. Start API with `npm run dev`
2. Send browse mode request - verify defaults use new property names
3. Send request with `requiredSeniorityLevel: "senior"` - verify filtering works
4. Send request with `preferredSeniorityLevel: "staff"` - verify bonus in score breakdown
5. Compare scores between matched and unmatched preferred properties

## Performance Considerations

- 6 additional bonus calculations per engineer (minimal overhead)
- No additional database queries (preferred values evaluated post-query)
- Score breakdown object size increases by ~20%

## Migration Notes

This is a **breaking change**. Clients must update their request bodies to use the new property names. No backward compatibility aliases are provided.

**API Version Consideration**: If versioning is added in the future, this change could be isolated to v2.

## References

- Research: `thoughts/shared/research/2025-12-30-required-vs-preferred-properties-analysis.md`
- Original types: `recommender_api/src/types/search.types.ts:17-43`
- Utility weights: `recommender_api/src/config/knowledge-base.config.ts:113-123`
- Utility calculator: `recommender_api/src/services/utility-calculator.service.ts:193-291`
