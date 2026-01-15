# SuggestedValue Discriminated Union Refactoring

## Overview

Refactor `suggestedValue: unknown` in `UserConstraintRelaxation` and `TighteningSuggestion` to use field-discriminated unions with proper typing. This eliminates type ambiguity and provides compile-time safety for all suggestion value types.

## Current State Analysis

### Problem
Both `UserConstraintRelaxation` and `TighteningSuggestion` use `suggestedValue: unknown`, which:
- Provides no type safety
- Requires consumers to cast/assert types
- Led to inconsistent skill value shapes (`{ moveToPreferred: true }` vs `{ remove: true }`)

### Root Cause

The relaxation and tightening generators were built with different mental models:

- **Tightening** was designed around "what can the user add to their request" → matches API schema
- **Relaxation** was designed around "how do internal constraints work" → does NOT match API schema

This led to `suggestedValue` types that don't correspond to what the API actually accepts:

| Field | Relaxation returns | Tightening returns | API expects |
|-------|-------------------|-------------------|-------------|
| `requiredMaxStartTime` | `string[]` | `string` | `string` |
| `yearsExperience` | `number` | — | **Field doesn't exist!** |

**The fix**: Align relaxation output with the API schema so clients can directly use `suggestedValue` to update their requests.

### Current Usage Patterns

**Relaxation suggestions** (`relaxation-generator.service.ts`):
| Strategy | Field in suggestion | suggestedValue type |
|----------|---------------------|---------------------|
| NumericStep | `yearsExperience` | `number` |
| NumericStep | `maxBudget` | `number` |
| EnumExpand | `requiredMaxStartTime` | `string[]` |
| Remove | `requiredTimezone` | `null` |
| SkillRelaxation | `requiredSkills` | `{ moveToPreferred: true, skill }` or `{ remove: true, skill }` etc. |

**Tightening suggestions** (`tightening-generator.service.ts`):
| Field | suggestedValue type |
|-------|---------------------|
| `requiredTimezone` | `string[]` |
| `requiredSeniorityLevel` | `string` |
| `maxBudget` | `number` |
| `requiredMaxStartTime` | `string` |
| `requiredSkills` | `{ skill, minProficiency }` |

**Note**: `requiredMaxStartTime` has different types in relaxation (`string[]` - expanded enum) vs tightening (`string` - single value).

## Desired End State

1. `UserConstraintRelaxation` becomes a discriminated union based on `field`
2. `TighteningSuggestion` becomes a discriminated union based on `field`
3. Skill relaxations use a proper `SkillRelaxationAction` enum instead of boolean flags
4. All consumers get compile-time type checking

### Verification
- `npm test` passes
- `npm run test:e2e` passes (if Tilt running)
- TypeScript compilation succeeds with no `unknown` casts in suggestion handling code

## What We're NOT Doing

- Refactoring the relaxation/tightening strategy pattern architecture
- Adding new fields or suggestion types
- Changing the tightening generator (already matches API)

## Breaking Changes

This refactoring introduces **breaking changes** to the API response format. Since this is an internal/development API without external consumers, we can proceed without versioning.

### Changed Response Shapes

| Change | Impact | Migration |
|--------|--------|-----------|
| Skill relaxation uses `action` enum | Clients checking `'remove' in suggestedValue` will break | Check `suggestedValue.action === 'remove'` instead |
| `requiredMaxStartTime` returns `string` not `string[]` | Clients expecting array will break | Each expanded value is now a separate suggestion |
| `yearsExperience` relaxations removed | No suggestions generated for this field | Field had no API equivalent anyway |

### Client Communication

Since this is an internal project:
1. All clients are updated in the same codebase
2. No external consumers need notification
3. Changes take effect immediately after deployment

If external consumers existed, we would need:
- API versioning (v1 → v2 endpoints)
- Deprecation notices with migration timeline
- Client SDK updates

## Implementation Approach

Use TypeScript discriminated unions with `field` as the discriminator. Each field gets its own interface with properly typed `suggestedValue` and `currentValue`.

---

## Phase 1: Define New Types in search.types.ts

### Overview
Add the discriminated union types for both relaxation and tightening suggestions.

### Changes Required:

#### 1. Add SkillRelaxationAction enum and skill value types

**File**: `recommender_api/src/types/search.types.ts`

Add after `RelaxationSuggestionType` enum (~line 336):

```typescript
/**
 * Action types for skill relaxation suggestions.
 * Used to discriminate between different skill modification strategies.
 */
export enum SkillRelaxationAction {
  /** Lower the required proficiency level (e.g., expert -> proficient) */
  LowerProficiency = 'lowerProficiency',
  /** Move skill from required to preferred (soft constraint) */
  MoveToPreferred = 'moveToPreferred',
  /** Remove the skill requirement entirely */
  Remove = 'remove',
}

/**
 * Skill relaxation value - discriminated by action.
 */
export type SkillRelaxationValue =
  | { action: SkillRelaxationAction.LowerProficiency; skill: string; minProficiency: string }
  | { action: SkillRelaxationAction.MoveToPreferred; skill: string }
  | { action: SkillRelaxationAction.Remove; skill: string };

/**
 * Skill requirement value for tightening suggestions (add a skill).
 */
export interface SkillRequirementValue {
  skill: string;
  minProficiency: string;
}
```

#### 2. Define field-specific relaxation types

**File**: `recommender_api/src/types/search.types.ts`

Replace the `UserConstraintRelaxation` interface with a discriminated union:

```typescript
/**
 * Base fields shared by all user constraint relaxations.
 */
interface BaseUserConstraintRelaxation extends BaseRelaxationSuggestion {
  type: RelaxationSuggestionType.UserConstraint;
}

/**
 * Relaxation for maxBudget field.
 * API: maxBudget: number
 */
export interface BudgetRelaxation extends BaseUserConstraintRelaxation {
  field: 'maxBudget';
  currentValue: number;
  suggestedValue: number;
}

/**
 * Relaxation for requiredMaxStartTime field.
 * API: requiredMaxStartTime: string (single enum value)
 *
 * Note: The EnumExpand strategy will be changed to suggest individual
 * expanded values, not arrays. Each expansion step becomes a separate suggestion.
 */
export interface StartTimeRelaxation extends BaseUserConstraintRelaxation {
  field: 'requiredMaxStartTime';
  currentValue: string;
  suggestedValue: string;
}

/**
 * Relaxation for requiredTimezone field (Remove strategy only).
 * API: requiredTimezone: string[]
 * suggestedValue is null since this uses Remove strategy.
 */
export interface TimezoneRelaxation extends BaseUserConstraintRelaxation {
  field: 'requiredTimezone';
  currentValue: string[];
  suggestedValue: null;
}

/**
 * Relaxation for skill requirements.
 * API: requiredSkills: SkillRequirement[]
 */
export interface SkillRelaxation extends BaseUserConstraintRelaxation {
  field: 'requiredSkills';
  currentValue: { skill: string; minProficiency?: string };
  suggestedValue: SkillRelaxationValue;
}

/**
 * Discriminated union of all user constraint relaxation types.
 * Discriminated by `field`.
 *
 * Note: yearsExperience was removed - there's no corresponding API field.
 * The salary constraint maps to maxBudget via suggestedField config.
 */
export type UserConstraintRelaxation =
  | BudgetRelaxation
  | StartTimeRelaxation
  | TimezoneRelaxation
  | SkillRelaxation;
```

#### 3. Define field-specific tightening types

**File**: `recommender_api/src/types/search.types.ts`

Replace the `TighteningSuggestion` interface with a discriminated union:

```typescript
/**
 * Base fields shared by all tightening suggestions.
 */
interface BaseTighteningSuggestion {
  rationale: string;
  resultingMatches: number;
  distributionInfo: string;
}

/**
 * Tightening for requiredTimezone field.
 */
export interface TimezoneTightening extends BaseTighteningSuggestion {
  field: 'requiredTimezone';
  suggestedValue: string[];
}

/**
 * Tightening for requiredSeniorityLevel field.
 */
export interface SeniorityTightening extends BaseTighteningSuggestion {
  field: 'requiredSeniorityLevel';
  suggestedValue: string;
}

/**
 * Tightening for maxBudget field.
 */
export interface BudgetTightening extends BaseTighteningSuggestion {
  field: 'maxBudget';
  suggestedValue: number;
}

/**
 * Tightening for requiredMaxStartTime field.
 * Note: single string (e.g., "immediate"), unlike relaxation which uses string[].
 */
export interface StartTimeTightening extends BaseTighteningSuggestion {
  field: 'requiredMaxStartTime';
  suggestedValue: string;
}

/**
 * Tightening for requiredSkills field.
 */
export interface SkillTightening extends BaseTighteningSuggestion {
  field: 'requiredSkills';
  suggestedValue: SkillRequirementValue;
}

/**
 * Discriminated union of all tightening suggestion types.
 * Discriminated by `field`.
 */
export type TighteningSuggestion =
  | TimezoneTightening
  | SeniorityTightening
  | BudgetTightening
  | StartTimeTightening
  | SkillTightening;
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck` (will have errors until Phase 2)

---

## Phase 2: Update relaxation-generator.service.ts

### Overview
Update the relaxation generator to:
1. Use the new types with `SkillRelaxationAction` enum
2. Fix `suggestedValue` to match API schema (not internal constraint representation)

### Changes Required:

#### 1. Add imports

**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`

Update imports:

```typescript
import {
  RelaxationSuggestionType,
  SkillRelaxationAction,
  type RelaxationSuggestion,
  type BudgetRelaxation,
  type StartTimeRelaxation,
  type TimezoneRelaxation,
  type SkillRelaxation,
  type DerivedConstraintOverride,
} from "../../types/search.types.js";
```

#### 2. Update applyNumericStepStrategy

**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`

The `yearsExperience` constraint has no corresponding API field, so we need to handle this.
Only the `salary` → `maxBudget` mapping produces actionable suggestions.

**Option A**: Skip yearsExperience constraints (return empty array)
**Option B**: Remove yearsExperience from `fieldToRelaxationStrategy` config

Recommended: Option B - update `relaxation-strategies.config.ts` to remove the yearsExperience entry.

```typescript
async function applyNumericStepStrategy(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: NumericPropertyConstraint,
  strategy: NumericStepStrategy
): Promise<BudgetRelaxation[]> {
  const suggestions: BudgetRelaxation[] = [];

  // Only maxBudget is a valid API field for numeric relaxation
  const field = strategy.suggestedField;
  if (field !== 'maxBudget') {
    // No valid API field - skip this constraint
    return [];
  }

  // ... existing logic for generating suggestions ...

  suggestions.push({
    type: RelaxationSuggestionType.UserConstraint,
    field: 'maxBudget',
    currentValue,
    suggestedValue: relaxedValue,
    rationale,
    resultingMatches: count,
  });
  // ...
}
```

#### 3. Update applyEnumExpandStrategy - CRITICAL FIX

**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`

**Problem**: Currently returns `string[]` but API expects single `string`.

**Fix**: Instead of suggesting "expand to include more values", suggest individual expanded values.
Each expansion step becomes a **separate suggestion** with a single string value.

```typescript
async function applyEnumExpandStrategy(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: StringArrayPropertyConstraint,
  strategy: EnumExpandStrategy
): Promise<StartTimeRelaxation[]> {
  const suggestions: StartTimeRelaxation[] = [];
  const currentValue = constraint.value[0]; // User's current single value

  // Find current position in enum order
  const currentIndex = strategy.enumOrder.indexOf(currentValue);
  if (currentIndex < 0) return [];

  /*
   * Suggest each expanded value individually.
   * e.g., if user has "immediate", suggest "two_weeks" then "one_month"
   * Each is a separate suggestion the user can apply directly.
   */
  for (
    let i = currentIndex + 1;
    i < Math.min(currentIndex + 1 + strategy.maxExpansion, strategy.enumOrder.length);
    i++
  ) {
    const expandedValue = strategy.enumOrder[i];

    // Test what count we'd get with this single expanded value
    const count = await testRelaxedValue(
      session,
      decomposedConstraints,
      constraint,
      [expandedValue] // Internal constraint still uses array
    );

    if (count > 0) {
      const rationale = fillTemplate(strategy.rationaleTemplate, {
        expanded: expandedValue,
      });

      suggestions.push({
        type: RelaxationSuggestionType.UserConstraint,
        field: 'requiredMaxStartTime',
        currentValue,           // string (API format)
        suggestedValue: expandedValue,  // string (API format)
        rationale,
        resultingMatches: count,
      });
    }
  }

  return suggestions;
}
```

#### 4. Update applyRemoveStrategy

**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`

Currently only used for `requiredTimezone` (Remove strategy):

```typescript
async function applyRemoveStrategy(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: TestableConstraint,
  strategy: RemoveStrategy
): Promise<TimezoneRelaxation[]> {
  // ... existing logic ...

  return [
    {
      type: RelaxationSuggestionType.UserConstraint,
      field: 'requiredTimezone',
      currentValue: getConstraintValue(constraint) as string[],
      suggestedValue: null,
      rationale,
      resultingMatches: count,
    },
  ];
}
```

#### 5. Update applySkillRelaxationStrategy to use SkillRelaxationAction

**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`

```typescript
async function applySkillRelaxationStrategy(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: UserSkillConstraint,
  strategy: SkillRelaxationStrategy
): Promise<SkillRelaxation[]> {
  const suggestions: SkillRelaxation[] = [];

  const skillReq = constraint.value;
  const skillName = skillReq.skill;
  const currentProficiency = skillReq.minProficiency;

  // 1. Lower proficiency threshold
  if (currentProficiency) {
    const currentIndex = strategy.proficiencyOrder.indexOf(currentProficiency);
    if (currentIndex >= 0 && currentIndex < strategy.proficiencyOrder.length - 1) {
      const lowerProficiency = strategy.proficiencyOrder[currentIndex + 1];

      const count = await testSkillRelaxation(session, decomposedConstraints, constraint, {
        ...skillReq,
        minProficiency: lowerProficiency,
      });

      if (count > 0) {
        suggestions.push({
          type: RelaxationSuggestionType.UserConstraint,
          field: 'requiredSkills',
          currentValue: { skill: skillName, minProficiency: currentProficiency },
          suggestedValue: {
            action: SkillRelaxationAction.LowerProficiency,
            skill: skillName,
            minProficiency: lowerProficiency,
          },
          rationale: fillTemplate(strategy.rationales.lowerProficiency, {
            skill: skillName,
            current: currentProficiency,
            suggested: lowerProficiency,
          }),
          resultingMatches: count,
        });
      }
    }
  }

  // 2. Move to preferred
  const countWithoutSkill = await testSkillRemoval(session, decomposedConstraints, constraint);
  if (countWithoutSkill > 0) {
    suggestions.push({
      type: RelaxationSuggestionType.UserConstraint,
      field: 'requiredSkills',
      currentValue: { skill: skillName, minProficiency: currentProficiency },
      suggestedValue: {
        action: SkillRelaxationAction.MoveToPreferred,
        skill: skillName,
      },
      rationale: fillTemplate(strategy.rationales.moveToPreferred, { skill: skillName }),
      resultingMatches: countWithoutSkill,
    });

    // 3. Remove skill entirely
    suggestions.push({
      type: RelaxationSuggestionType.UserConstraint,
      field: 'requiredSkills',
      currentValue: { skill: skillName, minProficiency: currentProficiency },
      suggestedValue: {
        action: SkillRelaxationAction.Remove,
        skill: skillName,
      },
      rationale: fillTemplate(strategy.rationales.removeSkill, { skill: skillName }),
      resultingMatches: countWithoutSkill,
    });
  }

  return suggestions;
}
```

#### 6. Remove yearsExperience from relaxation strategies config

**File**: `recommender_api/src/config/knowledge-base/relaxation-strategies.config.ts`

Remove the `yearsExperience` entry (lines 110-115) since there's no corresponding API field:

```typescript
// REMOVE this entry (lines 110-115):
yearsExperience: {
  type: RelaxationStrategyType.NumericStep,
  stepsDown: [0.7, 0.5],
  stepsUp: [1.3, 1.5],
  rationaleTemplate: "{direction} experience from {current} to {suggested} years",
},
```

Only `salary` (→ `maxBudget`) remains as a valid numeric relaxation.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test`

---

## Phase 3: Update tightening-generator.service.ts

### Overview
Update the tightening generator to use the new field-specific types.

### Changes Required:

#### 1. Update imports

**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

```typescript
import type {
  TighteningSuggestion,
  TimezoneTightening,
  SeniorityTightening,
  BudgetTightening,
  StartTimeTightening,
  SkillTightening,
  AppliedFilter,
} from "../../types/search.types.js";
```

#### 2. Update each analyze function return type

**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

Update function signatures:

```typescript
async function analyzeTimezoneDistribution(
  session: Session,
  expanded: ExpandedSearchCriteria
): Promise<TimezoneTightening[]> {
  // ...
}

async function analyzeExperienceDistribution(
  session: Session,
  expanded: ExpandedSearchCriteria
): Promise<SeniorityTightening[]> {
  // ...
}

async function analyzeSalaryDistribution(
  session: Session,
  expanded: ExpandedSearchCriteria
): Promise<BudgetTightening[]> {
  // ...
}

async function analyzeTimelineDistribution(
  session: Session,
  expanded: ExpandedSearchCriteria
): Promise<StartTimeTightening[]> {
  // ...
}

async function analyzeSkillDistribution(
  session: Session,
  expanded: ExpandedSearchCriteria
): Promise<SkillTightening[]> {
  // ...
}
```

Each suggestion construction is already correct, just needs the literal field value for type narrowing.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test`

---

## Phase 4: Update Tests

### Overview
Update test files to use the new types and verify correct discriminated union behavior.

### Changes Required:

#### 1. Update skill relaxation test patterns

**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.test.ts`

**Critical**: The current test at line 540 uses property existence to find removal suggestions:

```typescript
// BEFORE (line 540):
const removeSuggestion = suggestions.find(
  (s): s is UserConstraintRelaxation =>
    s.type === RelaxationSuggestionType.UserConstraint &&
    s.suggestedValue !== null &&
    typeof s.suggestedValue === 'object' &&
    'remove' in s.suggestedValue  // ← This pattern will break
);

// AFTER:
const removeSuggestion = suggestions.find(
  (s): s is SkillRelaxation =>
    s.type === RelaxationSuggestionType.UserConstraint &&
    s.field === 'requiredSkills' &&
    s.suggestedValue.action === SkillRelaxationAction.Remove
);
```

Similarly, update the lower proficiency check (line 484-488):

```typescript
// BEFORE:
const lowerProficiencySuggestion = suggestions.find(
  (s): s is UserConstraintRelaxation =>
    s.type === RelaxationSuggestionType.UserConstraint &&
    s.suggestedValue !== null &&
    typeof s.suggestedValue === 'object' &&
    'minProficiency' in s.suggestedValue
);

// AFTER:
const lowerProficiencySuggestion = suggestions.find(
  (s): s is SkillRelaxation =>
    s.type === RelaxationSuggestionType.UserConstraint &&
    s.field === 'requiredSkills' &&
    s.suggestedValue.action === SkillRelaxationAction.LowerProficiency
);
```

#### 2. Add explicit moveToPreferred test assertion

The current tests verify `remove` and `lowerProficiency` patterns but lack explicit coverage for `moveToPreferred`. Add:

```typescript
// Add explicit moveToPreferred test
const moveToPreferredSuggestion = suggestions.find(
  (s): s is SkillRelaxation =>
    s.type === RelaxationSuggestionType.UserConstraint &&
    s.field === 'requiredSkills' &&
    s.suggestedValue.action === SkillRelaxationAction.MoveToPreferred
);

expect(moveToPreferredSuggestion).toBeDefined();
expect(moveToPreferredSuggestion?.suggestedValue).toEqual({
  action: SkillRelaxationAction.MoveToPreferred,
  skill: expect.any(String),
});
```

#### 3. Update value assertions to use action enum

```typescript
// Instead of:
expect(suggestion.suggestedValue).toEqual({ moveToPreferred: true, skill: 'skill_react' });

// Use:
expect(suggestion.suggestedValue).toEqual({
  action: SkillRelaxationAction.MoveToPreferred,
  skill: 'skill_react',
});
```

#### 4. Update any integration tests checking response shapes

Review and update any tests that check the shape of `suggestedValue`.

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `npm test`
- [x] E2E tests pass: `npm run test:e2e`

---

## Phase 5: Export New Types

### Overview
Ensure all new types are properly exported from the types module.

### Changes Required:

#### 1. Verify exports in search.types.ts

**File**: `recommender_api/src/types/search.types.ts`

Ensure these are exported:
- `SkillRelaxationAction` (enum)
- `SkillRelaxationValue` (type)
- `SkillRequirementValue` (interface)
- Relaxation types:
  - `BudgetRelaxation` (interface)
  - `StartTimeRelaxation` (interface)
  - `TimezoneRelaxation` (interface)
  - `SkillRelaxation` (interface)
- Tightening types:
  - `TimezoneTightening` (interface)
  - `SeniorityTightening` (interface)
  - `BudgetTightening` (interface)
  - `StartTimeTightening` (interface)
  - `SkillTightening` (interface)

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles with no errors: `npm run typecheck`
- [x] All tests pass: `npm test && npm run test:e2e`

#### Manual Verification:
- [x] API responses contain correctly shaped `suggestedValue` objects
- [x] Skill relaxations have `action` field instead of boolean flags

---

## Phase 6: Update Documentation

### Overview
Update the Constraint Advisor walkthrough document to reflect the new discriminated union types and skill relaxation action enum.

**File**: `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-14-project-2-constraint-advisor-walkthrough.md`

### Changes Required:

#### 1. Update Section 3.2 - Relaxation Generator (Lines 305-344)

The current description references the old skill relaxation patterns. Update to reflect `SkillRelaxationAction` enum:

**Current (Lines 319-327):**
```markdown
**Type Mapping:**
| Strategy | Return Type | Key Fields |
|----------|-------------|------------|
| NumericStep | `UserConstraintRelaxation[]` | `field`, `currentValue`, `suggestedValue` |
| EnumExpand | `UserConstraintRelaxation[]` | `field`, `currentValue`, `suggestedValue` |
| Remove | `UserConstraintRelaxation[]` | `field`, `currentValue`, `suggestedValue: null` |
| DerivedOverride | `DerivedConstraintOverride[]` | `ruleId`, `ruleName`, `affectedConstraints` |
| SkillRelaxation | `UserConstraintRelaxation[]` | `field: "requiredSkills"`, skill-specific values |
```

**Updated:**
```markdown
**Type Mapping:**
| Strategy | Return Type | Key Fields |
|----------|-------------|------------|
| NumericStep | `BudgetRelaxation[]` | `field: 'maxBudget'`, `currentValue: number`, `suggestedValue: number` |
| EnumExpand | `StartTimeRelaxation[]` | `field: 'requiredMaxStartTime'`, `currentValue: string`, `suggestedValue: string` |
| Remove | `TimezoneRelaxation[]` | `field: 'requiredTimezone'`, `currentValue: string[]`, `suggestedValue: null` |
| DerivedOverride | `DerivedConstraintOverride[]` | `ruleId`, `ruleName`, `affectedConstraints` |
| SkillRelaxation | `SkillRelaxation[]` | `field: 'requiredSkills'`, `suggestedValue: SkillRelaxationValue` |

**Skill Relaxation Actions** (`SkillRelaxationAction` enum):
| Action | suggestedValue Shape |
|--------|---------------------|
| `LowerProficiency` | `{ action: 'lowerProficiency', skill: string, minProficiency: string }` |
| `MoveToPreferred` | `{ action: 'moveToPreferred', skill: string }` |
| `Remove` | `{ action: 'remove', skill: string }` |
```

#### 2. Update "Completed Post-Implementation" section (Lines 463-500)

Add entry for this refactoring:

```markdown
10. **SuggestedValue discriminated union refactoring** - `UserConstraintRelaxation` and `TighteningSuggestion` now use field-discriminated unions:
    - `UserConstraintRelaxation` split into: `BudgetRelaxation`, `StartTimeRelaxation`, `TimezoneRelaxation`, `SkillRelaxation`
    - `TighteningSuggestion` split into: `TimezoneTightening`, `SeniorityTightening`, `BudgetTightening`, `StartTimeTightening`, `SkillTightening`
    - Skill relaxations now use `SkillRelaxationAction` enum (`LowerProficiency`, `MoveToPreferred`, `Remove`) instead of boolean flags
    - `requiredMaxStartTime` relaxations return single `string` (multiple suggestions) instead of `string[]`
    - `yearsExperience` relaxations removed (no corresponding API field)
```

#### 3. Update Type Definitions section (Lines 523-531)

Add references to new types:

```markdown
- `recommender_api/src/types/search.types.ts:XXX-XXX` - SkillRelaxationAction enum and SkillRelaxationValue type
- `recommender_api/src/types/search.types.ts:XXX-XXX` - Field-specific relaxation types (BudgetRelaxation, StartTimeRelaxation, etc.)
- `recommender_api/src/types/search.types.ts:XXX-XXX` - Field-specific tightening types (TimezoneTightening, SeniorityTightening, etc.)
```

(Line numbers to be filled in after Phase 1 implementation)

#### 4. Update frontmatter

Update the `update_notes` field in the frontmatter to document this change:

```yaml
update_notes: "SuggestedValue discriminated union: UserConstraintRelaxation and TighteningSuggestion now use field-discriminated unions. Skill relaxations use SkillRelaxationAction enum instead of boolean flags."
```

### Success Criteria:

#### Manual Verification:
- [x] Walkthrough accurately describes the new discriminated union types
- [x] Type mapping table reflects actual return types from each strategy
- [x] Skill relaxation action patterns documented correctly
- [x] "Completed Post-Implementation" section includes this refactoring

---

## Testing Strategy

### Unit Tests:
- Verify each relaxation strategy produces correctly typed suggestions
- Verify skill relaxations use `SkillRelaxationAction` enum values
- Verify tightening suggestions have correct field-specific shapes

### Integration Tests:
- E2E tests via Newman should continue to pass (JSON shape unchanged for existing fields)

### Manual Testing:
1. Hit `/search` endpoint with constraints that trigger relaxation suggestions
2. Verify skill relaxation suggestions have `action: 'moveToPreferred'` instead of `moveToPreferred: true`
3. Hit `/search` with no constraints to trigger tightening suggestions
4. Verify response shapes match the new types

## Migration Notes

**API Response Changes:**

### 1. Skill relaxations use `action` enum

Before:
```json
{ "suggestedValue": { "moveToPreferred": true, "skill": "skill_react" } }
{ "suggestedValue": { "remove": true, "skill": "skill_react" } }
```

After:
```json
{ "suggestedValue": { "action": "moveToPreferred", "skill": "skill_react" } }
{ "suggestedValue": { "action": "remove", "skill": "skill_react" } }
{ "suggestedValue": { "action": "lowerProficiency", "skill": "skill_react", "minProficiency": "proficient" } }
```

### 2. requiredMaxStartTime relaxations now return single string

**Behavior change**: Instead of one suggestion with an array of expanded values, we now generate **multiple suggestions**, each with a single string value that can be directly applied to the API request.

**Rationale**: The API `requiredMaxStartTime` field accepts a single string value (e.g., `"two_weeks"`), not an array. The old format required clients to pick one value from the array. The new format presents each option as a distinct suggestion the user can apply directly.

Before (single suggestion with array):
```json
{
  "field": "requiredMaxStartTime",
  "suggestedValue": ["immediate", "two_weeks"],
  "rationale": "Expand timeline to include more options"
}
```

After (multiple suggestions, each directly applicable):
```json
{
  "field": "requiredMaxStartTime",
  "currentValue": "immediate",
  "suggestedValue": "two_weeks",
  "rationale": "Expand timeline from immediate to two_weeks"
}
```
```json
{
  "field": "requiredMaxStartTime",
  "currentValue": "immediate",
  "suggestedValue": "one_month",
  "rationale": "Expand timeline from immediate to one_month"
}
```

**Client impact**: Clients that previously iterated over the array to present options now receive pre-split suggestions. Each suggestion can be applied with a simple `request.requiredMaxStartTime = suggestion.suggestedValue`.

### 3. yearsExperience relaxations removed

Before:
```json
{ "field": "yearsExperience", "suggestedValue": 3 }
```

After: No suggestions generated (field doesn't exist in API).

**Client impact**: Clients can now directly use `suggestedValue` to update their API request without transformation.

## References

- Current types:
  - `UserConstraintRelaxation`: `recommender_api/src/types/search.types.ts:352-360`
  - `TighteningSuggestion`: `recommender_api/src/types/search.types.ts:401-412`
  - `BaseRelaxationSuggestion`: `recommender_api/src/types/search.types.ts:341-346`
  - `RelaxationSuggestionType`: `recommender_api/src/types/search.types.ts:331-336`
- Relaxation generator:
  - `applyNumericStepStrategy`: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts:115-157`
  - `applyEnumExpandStrategy`: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts:159-200`
  - `applyRemoveStrategy`: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts:202-234`
  - `applySkillRelaxationStrategy`: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts:283-370`
- Tightening generator: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`
- Relaxation strategies config: `recommender_api/src/config/knowledge-base/relaxation-strategies.config.ts:110-115` (yearsExperience to remove)
- Test file: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.test.ts:540` (remove pattern test)
- Walkthrough document: `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-14-project-2-constraint-advisor-walkthrough.md` (to update in Phase 6)
