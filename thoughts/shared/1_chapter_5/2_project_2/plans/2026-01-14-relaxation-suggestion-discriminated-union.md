# RelaxationSuggestion Discriminated Union Refactoring

## Overview

Refactor `RelaxationSuggestion` from a single interface with an optional `ruleIdToOverride` field into a discriminated union that clearly separates user constraint relaxations from derived constraint overrides. This makes the API contract explicit and prevents confusion about what action the client should take.

## Current State Analysis

The current `RelaxationSuggestion` interface mixes two fundamentally different suggestion types:

```typescript
// Current (problematic)
export interface RelaxationSuggestion {
  field: string;
  currentValue: unknown;
  suggestedValue: unknown;
  rationale: string;
  resultingMatches: number;
  ruleIdToOverride?: string;  // Presence changes semantics entirely
}
```

**Problems:**
1. `ruleIdToOverride` being optional obscures the fundamental difference between suggestion types
2. For derived overrides, `currentValue`/`suggestedValue` don't make semantic sense
3. `resultingMatches: -1` is a sentinel value that's not self-documenting
4. Clients must check `ruleIdToOverride` to know what action to take

### Key Discoveries:
- `applyDerivedOverrideStrategy` in `relaxation-generator.service.ts:193-214` is the only place that sets `ruleIdToOverride`
- It currently doesn't query the DB, returning `resultingMatches: -1`
- All other strategies test actual result counts via Neo4j queries
- The `constraint.ruleId` comes from `constraint-decomposer.service.ts:208` when processing derived constraints

## Desired End State

A discriminated union that makes the two suggestion types explicit:

```typescript
type RelaxationSuggestion = UserConstraintRelaxation | DerivedConstraintOverride;
```

With:
- Clear `type` discriminator for easy client-side switching
- Type-appropriate fields for each variant
- Actual `resultingMatches` computed for derived overrides (not -1)

**Verification:**
- All tests pass: `npm test`
- Postman collection tests pass: `npm run test:e2e`
- TypeScript compiles without errors

## What We're NOT Doing

- Not changing the relaxation strategy configuration (`relaxation-strategies.config.ts`)
- Not modifying the conflict detection logic (QUICKXPLAIN)
- Not changing how derived constraints are decomposed
- Not adding new relaxation strategies

## Implementation Approach

The refactoring follows a bottom-up approach:
1. Define new types
2. Update the generator to produce new types (with actual DB testing for derived overrides)
3. Update tests
4. Update Postman collection

---

## Phase 1: Define New Types

### Overview
Add the discriminated union types to `search.types.ts`.

### Changes Required:

#### 1. Type Definitions
**File**: `recommender_api/src/types/search.types.ts`
**Changes**: Replace `RelaxationSuggestion` interface with discriminated union

```typescript
// ============================================
// RELAXATION SUGGESTION TYPES (Discriminated Union)
// ============================================

/**
 * Base fields shared by all relaxation suggestions.
 */
interface BaseRelaxationSuggestion {
  /** Why this relaxation helps */
  rationale: string;
  /** How many results this would yield */
  resultingMatches: number;
}

/**
 * User constraint relaxation - suggests modifying a user-provided value.
 * Action: Client adjusts request parameters and re-submits.
 */
export interface UserConstraintRelaxation extends BaseRelaxationSuggestion {
  type: 'user-constraint';
  /** The constraint field being relaxed */
  field: string;
  /** Current constraint value */
  currentValue: unknown;
  /** Suggested relaxed value (null = remove constraint entirely) */
  suggestedValue: unknown;
}

/**
 * Derived constraint override - suggests bypassing an inference rule.
 * Action: Client adds ruleId to overriddenRuleIds array and re-submits.
 */
export interface DerivedConstraintOverride extends BaseRelaxationSuggestion {
  type: 'derived-override';
  /** The inference rule ID to add to overriddenRuleIds */
  ruleId: string;
  /** Human-readable rule name for UI display */
  ruleName: string;
  /** What constraints this rule added (for transparency) */
  affectedConstraints: Array<{
    field: string;
    value: unknown;
  }>;
}

/**
 * Discriminated union of all relaxation suggestion types.
 * Use `suggestion.type` to determine how to handle each suggestion.
 */
export type RelaxationSuggestion = UserConstraintRelaxation | DerivedConstraintOverride;
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `cd recommender_api && npx tsc --noEmit`

#### Manual Verification:
- [ ] None for this phase

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Update Relaxation Generator

### Overview
Update `relaxation-generator.service.ts` to produce the new discriminated union types and compute actual result counts for derived overrides.

### Changes Required:

#### 1. Update applyDerivedOverrideStrategy
**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`
**Changes**:
- Add `session` and `decomposed` parameters
- Query DB to get actual result count when rule is overridden
- Return `DerivedConstraintOverride` type

```typescript
async function applyDerivedOverrideStrategy(
  session: Session,
  decomposed: DecomposedConstraints,
  constraint: TestableConstraint,
  strategy: DerivedOverrideStrategy
): Promise<DerivedConstraintOverride[]> {
  if (!constraint.ruleId) return [];

  /*
   * Test result count with this derived constraint removed.
   * This tells the user how many results they'd get by overriding the rule.
   */
  const allIds = new Set(decomposed.constraints.map((c) => c.id));
  allIds.delete(constraint.id);
  const { query, params } = buildQueryWithConstraints(decomposed, allIds);

  const result = await session.run(query, params);
  const count = result.records[0]?.get("resultCount")?.toNumber() ?? 0;

  const rationale = strategy.rationaleTemplate.replace(
    "{displayValue}",
    constraint.displayValue
  );

  // Extract rule name from displayValue (format: "Derived: Rule Name")
  const ruleName = constraint.displayValue.replace(/^Derived:\s*/, "");

  return [
    {
      type: "derived-override",
      ruleId: constraint.ruleId,
      ruleName,
      affectedConstraints: [
        {
          field: constraint.field,
          value: constraint.value,
        },
      ],
      rationale,
      resultingMatches: count,
    },
  ];
}
```

#### 2. Update generateRelaxationsForConstraint switch statement
**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`
**Changes**: Pass `session` and `decomposed` to `applyDerivedOverrideStrategy`

```typescript
case RelaxationStrategyType.DerivedOverride:
  return applyDerivedOverrideStrategy(session, decomposed, constraint, strategy);
```

#### 3. Update other strategy functions to return UserConstraintRelaxation
**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts`
**Changes**: Add `type: 'user-constraint'` to all suggestions from:
- `applyNumericStepStrategy`
- `applyEnumExpandStrategy`
- `applyRemoveStrategy`
- `applySkillRelaxationStrategy`

Example for `applyNumericStepStrategy`:
```typescript
suggestions.push({
  type: "user-constraint",  // Add this line
  field: strategy.suggestedField ?? constraint.field,
  currentValue,
  suggestedValue: relaxedValue,
  rationale,
  resultingMatches: count,
});
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `cd recommender_api && npx tsc --noEmit`

#### Manual Verification:
- [ ] None for this phase

**Implementation Note**: After completing this phase, proceed to Phase 3.

---

## Phase 3: Update Unit Tests

### Overview
Update the relaxation generator tests to use the new discriminated union types.

### Changes Required:

#### 1. Update test assertions
**File**: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.test.ts`
**Changes**: Update assertions to check `type` field and use type-specific properties

For user constraint tests (numeric, enum, remove, skill):
```typescript
expect(suggestions[0].type).toBe("user-constraint");
expect(suggestions[0].field).toBe("yearsExperience");
// ... rest of assertions
```

For derived override test:
```typescript
it("generates derived override relaxation for inference-derived constraints", async () => {
  // ... existing setup ...

  // Add mock for the DB query that tests removal
  session.run.mockResolvedValue({
    records: [{ get: () => ({ toNumber: () => 12 }) }],
  });

  const suggestions = await generateRelaxationSuggestions(
    session,
    decomposed,
    decomposed.constraints
  );

  expect(suggestions).toHaveLength(1);
  expect(suggestions[0].type).toBe("derived-override");

  // Type narrowing for type-safe access
  const suggestion = suggestions[0] as DerivedConstraintOverride;
  expect(suggestion.ruleId).toBe("scaling-requires-distributed");
  expect(suggestion.ruleName).toBe("Scaling requires distributed");
  expect(suggestion.affectedConstraints).toEqual([
    { field: "derivedSkills", value: ["skill_distributed"] }
  ]);
  expect(suggestion.rationale).toContain("Override inference rule");
  expect(suggestion.resultingMatches).toBe(12); // Now actual count, not -1
});
```

#### 2. Update constraint-advisor.service.test.ts
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.test.ts`
**Changes**: Update assertions to use new type structure

```typescript
const overrideSuggestion = result.relaxation?.suggestions.find(
  (s): s is DerivedConstraintOverride =>
    s.type === "derived-override" && s.ruleId === "scaling-requires-distributed"
);
expect(overrideSuggestion).toBeDefined();
```

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `cd recommender_api && npm test`

#### Manual Verification:
- [ ] None for this phase

**Implementation Note**: After completing this phase, proceed to Phase 4.

---

## Phase 4: Update Postman Collection

### Overview
Update the E2E test assertions in the Postman collection to match the new response structure.

### Changes Required:

#### 1. Update relaxation suggestion assertions
**File**: `postman/collections/search-filter-tests.postman_collection.json`
**Changes**: Find and update any tests that assert on `relaxation.suggestions` to:
- Check for `type` field (`user-constraint` or `derived-override`)
- Use type-appropriate field names (`ruleId` instead of `ruleIdToOverride`)
- Update `resultingMatches` assertions for derived overrides (no longer -1)

Example test script update:
```javascript
// Old
pm.expect(suggestion.ruleIdToOverride).to.equal("scaling-requires-distributed");
pm.expect(suggestion.resultingMatches).to.equal(-1);

// New
pm.expect(suggestion.type).to.equal("derived-override");
pm.expect(suggestion.ruleId).to.equal("scaling-requires-distributed");
pm.expect(suggestion.resultingMatches).to.be.a("number").and.to.be.at.least(0);
```

### Success Criteria:

#### Automated Verification:
- [x] E2E tests pass: `cd recommender_api && npm run test:e2e`

#### Manual Verification:
- [x] Review a sample API response to confirm structure looks correct

**Implementation Note**: After completing this phase, the refactoring is complete.

---

## Testing Strategy

### Unit Tests:
- Verify `type` discriminator is present on all suggestions
- Verify user constraint suggestions have `field`, `currentValue`, `suggestedValue`
- Verify derived override suggestions have `ruleId`, `ruleName`, `affectedConstraints`
- Verify derived overrides now return actual result counts (not -1)

### Integration Tests:
- Test that mixed suggestion arrays (user + derived) are properly typed
- Test sorting still works correctly with discriminated union

### E2E Tests (Postman):
- Sparse result scenarios return properly typed suggestions
- Override suggestions include actual impact counts

## Performance Considerations

The change to compute actual result counts for derived overrides adds one DB query per derived constraint in the conflict set. This is acceptable because:
1. Conflict sets are typically small (1-3 constraints)
2. The query is simple (COUNT with constraint removed)
3. Consistency with other strategies outweighs the minor overhead

## References

- Original discussion: This conversation
- Type definition: `recommender_api/src/types/search.types.ts:249-262`
- Generator implementation: `recommender_api/src/services/constraint-advisor/relaxation-generator.service.ts:193-214`
- Existing discriminated union pattern: `recommender_api/src/services/constraint-advisor/constraint.types.ts:57`
