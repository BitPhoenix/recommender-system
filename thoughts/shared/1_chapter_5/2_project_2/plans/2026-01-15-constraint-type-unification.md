# Constraint Type Unification Implementation Plan

## Overview

Refactor the constraint system to eliminate `value: unknown` in `BaseConstraint` by using properly typed discriminated unions, and evaluate whether `TestableConstraint` and `AppliedFilter` can be unified into a single type hierarchy.

## Current State Analysis

### Two Parallel Type Hierarchies

**1. AppliedFilter (API-facing, in `search.types.ts`)**
- Well-typed discriminated union using `kind` discriminator
- `AppliedPropertyFilter`: `value: string` (always stringified)
- `AppliedSkillFilter`: `skills: ResolvedSkillConstraint[]` (no `value` field)
- Has type guards: `isSkillFilter()`, `isPropertyFilter()`, etc.

**2. TestableConstraint (internal, in `constraint.types.ts`)**
- Discriminated union using `constraintType` discriminator
- `PropertyConstraint`: `value: unknown` + `cypher: CypherFragment`
- `SkillTraversalConstraint`: `value: unknown` + `skillIds: string[]`
- Forces unsafe `as` casts in 4 locations in `relaxation-generator.service.ts`

### Key Differences Between the Types

| Aspect | AppliedFilter | TestableConstraint |
|--------|---------------|-------------------|
| Purpose | API contract (client-visible) | Internal QUICKXPLAIN testing |
| Discriminator | `kind` | `constraintType` |
| Value storage | String (always) | Typed (`unknown` currently) |
| Unique ID | None | `id` field for constraint tracking |
| Cypher generation | None | `cypher: CypherFragment` on property |
| Skill representation | `skills: ResolvedSkillConstraint[]` | `skillIds: string[]` + `value` object |
| Rule tracking | `ruleId` (on derived only) | `ruleId?` (optional) |

### Where `as` Casts Occur

All in `relaxation-generator.service.ts`:
1. Line 97: `constraint.value as number` (numeric step strategy)
2. Line 140: `constraint.value as string[]` (enum expand strategy)
3. Line 272: `constraint.value as { skill: string; minProficiency?: string }` (skill relaxation)
4. Line 346: Same skill cast in `buildSkillsFromConstraints()`

### Value Types Inventory

From decomposer analysis, `TestableConstraint.value` can be:
- `number` - for salary, yearsExperience with `>=`, `<` operators
- `string` - for timezone prefix with `STARTS WITH`
- `string[]` - for startTimeline with `IN`, or derived skill IDs
- `{ skill: string; minProficiency?: string }` - for user skill requirements

## Desired End State

### Decision: Keep Separate Types (Recommended)

After analysis, **unification is not recommended** because:

1. **Different purposes**: `AppliedFilter` is for API serialization (human-readable strings), `TestableConstraint` is for query building (typed values + Cypher fragments)

2. **Different cardinality**: One `AppliedSkillFilter` with 3 skills becomes 3 `TestableConstraint` objects (one per skill for independent testing)

3. **Cypher fragments**: `TestableConstraint` carries pre-computed Cypher - this is internal implementation detail that shouldn't leak to API

4. **Transformation is intentional**: The decomposer does real work (parsing strings → typed values, splitting BETWEEN into two constraints, generating Cypher)

### What We Will Do

1. **Add proper typing to `TestableConstraint`** using discriminated unions
2. **Keep the two-type architecture** but ensure both are well-typed
3. **Eliminate all `as` casts** by narrowing on constraint type/field

## What We're NOT Doing

- Not unifying `TestableConstraint` and `AppliedFilter` into one type
- Not changing the API contract (`AppliedFilter` stays as-is)
- Not changing the decomposition logic flow
- Not changing `AppliedFilter.value` from `string` to typed (it's intentionally stringified for JSON)

## Implementation Approach

Extend the existing discriminated union pattern. Currently we discriminate on `constraintType` (Property vs SkillTraversal). We'll add a secondary discriminator for property constraints based on field type.

## Phase 1: Define Typed Constraint Value Types

### Overview
Create specific value types and extend the discriminated union to include field-based discrimination for property constraints.

### Changes Required:

#### 1. Update `constraint.types.ts`

**File**: `recommender_api/src/services/constraint-advisor/constraint.types.ts`

Replace the current types with:

```typescript
import type { CypherFragment } from "../../utils/cypher-fragment.builder.js";
import type { ConstraintSource } from "../../types/search.types.js";

/**
 * Enum for constraint types - determines how the constraint is evaluated.
 */
export enum ConstraintType {
  /** Simple property constraint that maps to a WHERE clause */
  Property = "property",
  /** Skill traversal constraint requiring graph pattern matching */
  SkillTraversal = "skill-traversal",
}

/**
 * Property field categories for type discrimination.
 */
export enum PropertyFieldType {
  /** Numeric fields: salary, yearsExperience */
  Numeric = "numeric",
  /** String fields: timezone (with STARTS WITH) */
  String = "string",
  /** Array fields: startTimeline (with IN) */
  StringArray = "string-array",
}

/**
 * Skill constraint origin for type discrimination.
 */
export enum SkillConstraintOrigin {
  /** User-specified skill requirement */
  User = "user",
  /** Derived from inference rule */
  Derived = "derived",
}

// ============================================
// BASE FIELDS (shared, no `value` field)
// ============================================

interface ConstraintBase {
  /** Unique identifier for this constraint */
  id: string;
  /** Field being constrained */
  field: string;
  /** Operator used (IN, >=, <=, STARTS WITH, etc.) */
  operator: string;
  /** Human-readable description */
  displayValue: string;
  /** Source of the constraint */
  source: ConstraintSource;
  /** For derived constraints, the rule ID to override */
  ruleId?: string;
}

// ============================================
// PROPERTY CONSTRAINTS (with typed values)
// ============================================

interface PropertyConstraintBase extends ConstraintBase {
  constraintType: ConstraintType.Property;
  /** Generated Cypher fragment for this constraint */
  cypher: CypherFragment;
}

/**
 * Numeric property constraint (salary, yearsExperience).
 */
export interface NumericPropertyConstraint extends PropertyConstraintBase {
  fieldType: PropertyFieldType.Numeric;
  value: number;
}

/**
 * String property constraint (timezone with STARTS WITH).
 */
export interface StringPropertyConstraint extends PropertyConstraintBase {
  fieldType: PropertyFieldType.String;
  value: string;
}

/**
 * String array property constraint (startTimeline with IN).
 */
export interface StringArrayPropertyConstraint extends PropertyConstraintBase {
  fieldType: PropertyFieldType.StringArray;
  value: string[];
}

/**
 * Union of all property constraint types.
 */
export type PropertyConstraint =
  | NumericPropertyConstraint
  | StringPropertyConstraint
  | StringArrayPropertyConstraint;

// ============================================
// SKILL TRAVERSAL CONSTRAINTS (with typed values)
// ============================================

interface SkillTraversalConstraintBase extends ConstraintBase {
  constraintType: ConstraintType.SkillTraversal;
  /** Skill IDs that must be matched via relationship traversal */
  skillIds: string[];
}

/**
 * User skill requirement with optional proficiency.
 */
export interface UserSkillRequirement {
  skill: string;
  minProficiency?: string;
}

/**
 * User-specified skill constraint (one per skill for independent testing).
 */
export interface UserSkillConstraint extends SkillTraversalConstraintBase {
  origin: SkillConstraintOrigin.User;
  value: UserSkillRequirement;
}

/**
 * Derived skill constraint (grouped by rule).
 */
export interface DerivedSkillConstraint extends SkillTraversalConstraintBase {
  origin: SkillConstraintOrigin.Derived;
  /** Derived constraints group skill IDs, not individual requirements */
  value: string[];
  /** Rule ID is required for derived constraints */
  ruleId: string;
}

/**
 * Union of all skill traversal constraint types.
 */
export type SkillTraversalConstraint = UserSkillConstraint | DerivedSkillConstraint;

// ============================================
// TESTABLE CONSTRAINT (top-level union)
// ============================================

/**
 * Discriminated union of all constraint types.
 *
 * Discrimination hierarchy:
 * 1. constraintType: Property | SkillTraversal
 * 2. For Property: fieldType: Numeric | String | StringArray
 * 3. For SkillTraversal: origin: User | Derived
 */
export type TestableConstraint = PropertyConstraint | SkillTraversalConstraint;

// ============================================
// TYPE GUARDS
// ============================================

export function isPropertyConstraint(c: TestableConstraint): c is PropertyConstraint {
  return c.constraintType === ConstraintType.Property;
}

export function isSkillTraversalConstraint(c: TestableConstraint): c is SkillTraversalConstraint {
  return c.constraintType === ConstraintType.SkillTraversal;
}

export function isNumericPropertyConstraint(c: PropertyConstraint): c is NumericPropertyConstraint {
  return c.fieldType === PropertyFieldType.Numeric;
}

export function isStringPropertyConstraint(c: PropertyConstraint): c is StringPropertyConstraint {
  return c.fieldType === PropertyFieldType.String;
}

export function isStringArrayPropertyConstraint(c: PropertyConstraint): c is StringArrayPropertyConstraint {
  return c.fieldType === PropertyFieldType.StringArray;
}

export function isUserSkillConstraint(c: SkillTraversalConstraint): c is UserSkillConstraint {
  return c.origin === SkillConstraintOrigin.User;
}

export function isDerivedSkillConstraint(c: SkillTraversalConstraint): c is DerivedSkillConstraint {
  return c.origin === SkillConstraintOrigin.Derived;
}

// ============================================
// RESULT TYPES
// ============================================

/**
 * Result of decomposing a search request into testable constraints.
 */
export interface DecomposedConstraints {
  /** All constraints extracted from the request */
  constraints: TestableConstraint[];
  /** The base MATCH clause (without WHERE) */
  baseMatchClause: string;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck` (from recommender_api/)
- [x] Existing tests still pass: `npm test`

#### Manual Verification:
- [x] Type definitions accurately reflect all constraint shapes found in codebase

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Update Constraint Decomposer

### Overview
Update `constraint-decomposer.service.ts` to produce the new typed constraints with `fieldType` and `origin` discriminators.

### Changes Required:

#### 1. Update `decomposeSkillFilter()`

**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`

```typescript
import {
  ConstraintType,
  PropertyFieldType,
  SkillConstraintOrigin,
  type TestableConstraint,
  type DecomposedConstraints,
  type PropertyConstraint,
  type UserSkillConstraint,
  type DerivedSkillConstraint,
} from "./constraint.types.js";

function decomposeSkillFilter(filter: AppliedSkillFilter): TestableConstraint[] {
  if (isDerivedSkillFilter(filter)) {
    const constraint: DerivedSkillConstraint = {
      id: `derived_${filter.ruleId}`,
      field: filter.field,
      operator: 'IN',
      value: filter.skills.map(s => s.skillId),
      displayValue: filter.displayValue,
      source: filter.source,
      ruleId: filter.ruleId,
      constraintType: ConstraintType.SkillTraversal,
      origin: SkillConstraintOrigin.Derived,
      skillIds: filter.skills.map(s => s.skillId),
    };
    return [constraint];
  }

  // User skill filter: ONE constraint per skill
  return filter.skills.map((skill): UserSkillConstraint => ({
    id: `user_skill_${skill.skillId}`,
    field: 'requiredSkills',
    operator: 'IN',
    value: {
      skill: skill.skillId,
      minProficiency: skill.minProficiency,
    },
    displayValue: `Required skill: ${skill.skillName}`,
    source: filter.source,
    constraintType: ConstraintType.SkillTraversal,
    origin: SkillConstraintOrigin.User,
    skillIds: [skill.skillId],
  }));
}
```

#### 2. Update `decomposePropertyFilter()` and helpers

Add `fieldType` to all property constraint creation:

```typescript
function decomposePropertyFilter(
  filter: AppliedPropertyFilter,
  index: number,
  nextParam: (prefix: string) => string
): TestableConstraint[] {
  const parsedValue = parseFilterValue(filter);
  const normalizedOperator = normalizeOperator(filter.operator);

  // BETWEEN creates two constraints (min and max)
  if (filter.operator === "BETWEEN" && typeof parsedValue === "object" && parsedValue !== null) {
    const betweenValue = parsedValue as { min: number; max: number };
    return decomposeBetweenFilter(filter, index, betweenValue, nextParam);
  }

  // Timezone STARTS WITH creates one constraint per prefix
  if (filter.field === "timezone" && normalizedOperator === "STARTS WITH") {
    return decomposeTimezoneFilter(filter, index, parsedValue, nextParam);
  }

  // Determine field type for discrimination
  const fieldType = getPropertyFieldType(filter.field, normalizedOperator);

  // Standard property constraint - type varies by fieldType
  return [createPropertyConstraint(filter, index, parsedValue, normalizedOperator, fieldType, nextParam)];
}

function getPropertyFieldType(field: string, operator: string): PropertyFieldType {
  if (field === "yearsExperience" || field === "salary") {
    return PropertyFieldType.Numeric;
  }
  if (field === "timezone" && operator === "STARTS WITH") {
    return PropertyFieldType.String;
  }
  if (field === "startTimeline" || operator === "IN") {
    return PropertyFieldType.StringArray;
  }
  // Default to string for unknown fields
  return PropertyFieldType.String;
}

function createPropertyConstraint(
  filter: AppliedPropertyFilter,
  index: number,
  parsedValue: unknown,
  operator: string,
  fieldType: PropertyFieldType,
  nextParam: (prefix: string) => string
): PropertyConstraint {
  const base = {
    id: `${filter.field}_${index}`,
    field: filter.field,
    operator,
    displayValue: filter.value,
    source: filter.source,
    constraintType: ConstraintType.Property as const,
    cypher: buildCypherFragment(filter.field, operator, parsedValue, nextParam(filter.field)),
  };

  switch (fieldType) {
    case PropertyFieldType.Numeric:
      return { ...base, fieldType, value: parsedValue as number };
    case PropertyFieldType.String:
      return { ...base, fieldType, value: parsedValue as string };
    case PropertyFieldType.StringArray:
      return { ...base, fieldType, value: parsedValue as string[] };
  }
}
```

#### 3. Update `decomposeBetweenFilter()`

```typescript
function decomposeBetweenFilter(
  filter: AppliedPropertyFilter,
  index: number,
  betweenValue: { min: number; max: number },
  nextParam: (prefix: string) => string
): PropertyConstraint[] {
  return [
    {
      id: `${filter.field}_min_${index}`,
      field: filter.field,
      operator: ">=",
      value: betweenValue.min,
      displayValue: `${filter.field} >= ${betweenValue.min}`,
      source: filter.source,
      constraintType: ConstraintType.Property,
      fieldType: PropertyFieldType.Numeric,
      cypher: buildCypherFragment(filter.field, ">=", betweenValue.min, nextParam(`${filter.field}_min`)),
    },
    {
      id: `${filter.field}_max_${index}`,
      field: filter.field,
      operator: "<",
      value: betweenValue.max,
      displayValue: `${filter.field} < ${betweenValue.max}`,
      source: filter.source,
      constraintType: ConstraintType.Property,
      fieldType: PropertyFieldType.Numeric,
      cypher: buildCypherFragment(filter.field, "<", betweenValue.max, nextParam(`${filter.field}_max`)),
    },
  ];
}
```

#### 4. Update `decomposeTimezoneFilter()`

```typescript
function decomposeTimezoneFilter(
  filter: AppliedPropertyFilter,
  index: number,
  parsedValue: unknown,
  nextParam: (prefix: string) => string
): PropertyConstraint[] {
  if (Array.isArray(parsedValue)) {
    return parsedValue.map((val, i): StringPropertyConstraint => {
      const prefix = String(val).replace(/\*$/, "");
      return {
        id: `timezone_${index}_${i}`,
        field: "timezone",
        operator: "STARTS WITH",
        value: prefix,
        displayValue: `timezone ${val}`,
        source: filter.source,
        constraintType: ConstraintType.Property,
        fieldType: PropertyFieldType.String,
        cypher: buildCypherFragment("timezone", "STARTS WITH", prefix, nextParam(`tz_${i}`)),
      };
    });
  }

  // Single timezone prefix
  const prefix = String(parsedValue).replace(/\*$/, "");
  return [{
    id: `timezone_${index}`,
    field: "timezone",
    operator: "STARTS WITH",
    value: prefix,
    displayValue: `timezone ${parsedValue}`,
    source: filter.source,
    constraintType: ConstraintType.Property,
    fieldType: PropertyFieldType.String,
    cypher: buildCypherFragment("timezone", "STARTS WITH", prefix, nextParam("tz")),
  }];
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Decomposer tests pass: `npm test -- constraint-decomposer`
- [x] All unit tests pass: `npm test`

#### Manual Verification:
- [x] Constraints produced have correct `fieldType` and `origin` values

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Update Relaxation Generator (Remove `as` Casts)

### Overview
Update `relaxation-generator.service.ts` to use type guards instead of `as` casts.

### Changes Required:

#### 1. Update imports

**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`

```typescript
import {
  ConstraintType,
  PropertyFieldType,
  SkillConstraintOrigin,
  type TestableConstraint,
  type DecomposedConstraints,
  type PropertyConstraint,
  type NumericPropertyConstraint,
  type StringArrayPropertyConstraint,
  type UserSkillConstraint,
  isPropertyConstraint,
  isSkillTraversalConstraint,
  isNumericPropertyConstraint,
  isStringArrayPropertyConstraint,
  isUserSkillConstraint,
} from "./constraint.types.js";
```

#### 2. Update `applyNumericStepStrategy()`

Before (line 97):
```typescript
const currentValue = constraint.value as number;
```

After:
```typescript
async function applyNumericStepStrategy(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: NumericPropertyConstraint,  // Now typed!
  strategy: NumericStepStrategy
): Promise<UserConstraintRelaxation[]> {
  const currentValue = constraint.value;  // No cast needed, it's number
  // ... rest unchanged
}
```

#### 3. Update `applyEnumExpandStrategy()`

Before (line 140):
```typescript
const currentValues = constraint.value as string[];
```

After:
```typescript
async function applyEnumExpandStrategy(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: StringArrayPropertyConstraint,  // Now typed!
  strategy: EnumExpandStrategy
): Promise<UserConstraintRelaxation[]> {
  const currentValues = constraint.value;  // No cast needed, it's string[]
  // ... rest unchanged
}
```

#### 4. Update `applySkillRelaxationStrategy()`

Before (line 272):
```typescript
const skillReq = constraint.value as { skill: string; minProficiency?: string };
```

After:
```typescript
async function applySkillRelaxationStrategy(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  constraint: UserSkillConstraint,  // Now typed!
  strategy: SkillRelaxationStrategy
): Promise<RelaxationSuggestion[]> {
  const skillReq = constraint.value;  // No cast needed, it's UserSkillRequirement
  // ... rest unchanged
}
```

#### 5. Update `generateRelaxationsForConstraint()` with type narrowing

```typescript
async function generateRelaxationsForConstraint(
  session: Session,
  decomposedConstraints: DecomposedConstraints,
  conflictingConstraint: TestableConstraint
): Promise<RelaxationSuggestion[]> {
  const strategy = fieldToRelaxationStrategy[conflictingConstraint.field];

  if (!strategy) {
    return [];
  }

  switch (strategy.type) {
    case RelaxationStrategyType.NumericStep:
      if (isPropertyConstraint(conflictingConstraint) &&
          isNumericPropertyConstraint(conflictingConstraint)) {
        return applyNumericStepStrategy(session, decomposedConstraints, conflictingConstraint, strategy);
      }
      return [];

    case RelaxationStrategyType.EnumExpand:
      if (isPropertyConstraint(conflictingConstraint) &&
          isStringArrayPropertyConstraint(conflictingConstraint)) {
        return applyEnumExpandStrategy(session, decomposedConstraints, conflictingConstraint, strategy);
      }
      return [];

    case RelaxationStrategyType.Remove:
      return applyRemoveStrategy(session, decomposedConstraints, conflictingConstraint, strategy);

    case RelaxationStrategyType.DerivedOverride:
      return applyDerivedOverrideStrategy(session, decomposedConstraints, conflictingConstraint, strategy);

    case RelaxationStrategyType.SkillRelaxation:
      if (isSkillTraversalConstraint(conflictingConstraint) &&
          isUserSkillConstraint(conflictingConstraint)) {
        return applySkillRelaxationStrategy(session, decomposedConstraints, conflictingConstraint, strategy);
      }
      return [];
  }
}
```

#### 6. Update `buildSkillsFromConstraints()` (line 346)

Before:
```typescript
const skillReq = constraint.value as { skill: string; minProficiency?: string };
```

After:
```typescript
function buildSkillsFromConstraints(
  decomposed: DecomposedConstraints,
  constraintIds: Set<string>
): ResolvedSkillWithProficiency[] {
  const skills: ResolvedSkillWithProficiency[] = [];

  for (const constraint of decomposed.constraints) {
    if (!constraintIds.has(constraint.id)) continue;

    if (isSkillTraversalConstraint(constraint) && isUserSkillConstraint(constraint)) {
      const skillReq = constraint.value;  // No cast needed
      skills.push({
        skillId: skillReq.skill,
        skillName: skillReq.skill,
        minProficiency: skillReq.minProficiency,
      });
    }
  }

  return skills;
}
```

### Success Criteria:

#### Automated Verification:
- [x] No `as` casts remain in relaxation-generator.service.ts: `grep "as {" relaxation-generator.service.ts` returns empty
- [x] TypeScript compiles: `npm run typecheck`
- [x] Relaxation tests pass: `npm test -- relaxation-generator`
- [x] All unit tests pass: `npm test`

#### Manual Verification:
- [x] Relaxation suggestions are correctly generated for all constraint types

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Update Remaining Consumers

### Overview
Update any other files that consume `TestableConstraint` to use the new type guards.

### Changes Required:

#### 1. Update `constraint-advisor.service.ts`

**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`

The `formatConflictSets()` function already discriminates on `constraintType`, but we can make it cleaner:

```typescript
import {
  ConstraintType,
  type TestableConstraint,
  isPropertyConstraint,
  isSkillTraversalConstraint,
} from "./constraint.types.js";

function formatConflictSets(minimalSets: TestableConstraint[][]): ConflictSet[] {
  return minimalSets.map((constraints) => ({
    constraints: constraints.map((c): AppliedFilter => {
      if (isSkillTraversalConstraint(c)) {
        return {
          kind: AppliedFilterKind.Skill,
          field: 'requiredSkills',
          operator: 'HAS_ALL',
          skills: c.skillIds.map((id: string) => ({ skillId: id, skillName: id })),
          displayValue: c.displayValue,
          source: c.source,
        };
      }

      // Property constraints - c is now narrowed to PropertyConstraint
      return {
        kind: AppliedFilterKind.Property,
        field: c.field,
        operator: c.operator,
        value: stringifyConstraintValue(c.value),
        source: c.source,
      };
    }),
    explanation: generateConflictExplanation(constraints),
  }));
}

function stringifyConstraintValue(value: number | string | string[]): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return String(value);
}
```

#### 2. Update `quickxplain.service.ts` if needed

Review and update any type assertions.

#### 3. Update test files

Update test mocks to include the new `fieldType` and `origin` fields.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All unit tests pass: `npm test`
- [x] E2E tests pass: `npm run test:e2e` (62 tests, 215 assertions)
- [x] No remaining `as` casts on constraint values: `grep -r "constraint.value as" src/services/constraint-advisor/`

#### Manual Verification:
- [x] API responses are unchanged (no breaking changes) - verified by E2E tests
- [x] Constraint advice works correctly for sparse and many results - verified by tests 58-62

**Implementation Note**: After completing this phase and all automated verification passes, pause here for final review.

---

## Testing Strategy

### Unit Tests

Update existing tests in:
- `constraint-decomposer.service.test.ts` - Verify `fieldType` and `origin` are set correctly
- `relaxation-generator.service.test.ts` - Ensure no `as any` needed in mocks
- `constraint-advisor.service.test.ts` - Verify formatting still works

### Integration Tests

- Verify full flow from `AppliedFilter[]` → decomposition → QUICKXPLAIN → relaxation

### E2E Tests

- Run existing Postman collection to verify no API changes

## Performance Considerations

- No performance impact expected - this is purely a compile-time type safety improvement
- Runtime behavior is unchanged

## Migration Notes

- No database changes
- No API changes
- Pure internal refactoring
- Tests may need mock updates to include new discriminator fields

## References

- Current types: `recommender_api/src/services/constraint-advisor/constraint.types.ts`
- API types: `recommender_api/src/types/search.types.ts`
- Decomposer: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`
- Relaxation generator: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`
