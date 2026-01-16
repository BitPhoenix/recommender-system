# AppliedFilter & AppliedPreference Discriminated Union Refactoring

## Overview

Refactor `AppliedFilter` and `AppliedPreference` types from simple interfaces with `value: string` to discriminated unions that support structured skill data. This eliminates the parallel data paths where skill information flows through both `appliedFilters` (display strings) and `requiredSkillIds` (resolved IDs) separately.

## Current State Analysis

### The Problem

Currently, skill constraints create **parallel data paths**:

1. `appliedFilters`: Contains display strings like `["JavaScript | min:proficient"]`
2. `requiredSkillIds`: Contains resolved IDs like `["skill_javascript"]`

This causes the workaround in `constraint-decomposer.service.ts:175-178`:
```typescript
if (filter.field === "requiredSkills") {
  // Skip - appliedFilters contains display strings, actual skill IDs come from requiredSkillIds parameter
  continue;
}
```

### Key Files Involved

| File | Role | Changes Required |
|------|------|------------------|
| `types/search.types.ts:157-176` | Type definitions | Major - add discriminated unions |
| `services/constraint-expander.service.ts:431-462` | Creates AppliedFilter/AppliedPreference | Major - produce structured types |
| `services/constraint-advisor/constraint-decomposer.service.ts` | Parses AppliedFilter values | Major - remove workaround |
| `services/constraint-advisor/constraint-advisor.service.ts:22-29` | Interface + orchestration | Major - remove `requiredSkillIds` param |
| `services/constraint-advisor/relaxation-generator.service.ts:249-316` | Skill relaxation logic | Minor - adapt to new structure |
| `services/constraint-advisor/tightening-generator.service.ts:30-37` | Uses `appliedFilters.field` | Minor - works with both kinds |
| `services/search.service.ts:167-174` | Passes `requiredSkillIds` separately | Major - simplify interface |
| `services/skill-resolution.service.ts` | Returns `requiredSkillIds` | Keep - still needed for query building |

## Desired End State

### New Type Structure

```typescript
// Kind discriminators
export enum AppliedFilterKind {
  Property = 'property',
  Skill = 'skill',
}

export enum AppliedPreferenceKind {
  Property = 'property',
  Skill = 'skill',
}

// Structured skill constraint
export interface ResolvedSkillConstraint {
  skillId: string;
  skillName: string;
  minProficiency?: ProficiencyLevel;
  preferredMinProficiency?: ProficiencyLevel;
}

// AppliedFilter discriminated union
export interface AppliedPropertyFilter {
  kind: AppliedFilterKind.Property;
  field: string;
  operator: string;
  value: string;
  source: ConstraintSource;
}

export interface AppliedSkillFilter {
  kind: AppliedFilterKind.Skill;
  field: 'requiredSkills';
  operator: 'HAS_ALL';
  skills: ResolvedSkillConstraint[];
  displayValue: string;
  source: ConstraintSource;
}

export type AppliedFilter = AppliedPropertyFilter | AppliedSkillFilter;

// AppliedPreference discriminated union
export interface AppliedPropertyPreference {
  kind: AppliedPreferenceKind.Property;
  field: string;
  value: string;
  source: ConstraintSource;
}

export interface AppliedSkillPreference {
  kind: AppliedPreferenceKind.Skill;
  field: 'preferredSkills';
  skills: ResolvedSkillConstraint[];
  displayValue: string;
  source: ConstraintSource;
}

export type AppliedPreference = AppliedPropertyPreference | AppliedSkillPreference;
```

### API Response Format Change

**Before:**
```json
{
  "appliedFilters": [
    { "field": "requiredSkills", "operator": "IN", "value": "[\"JavaScript | min:proficient\"]", "source": "user" }
  ],
  "appliedPreferences": [
    { "field": "preferredSkills", "value": "[\"Node.js\"]", "source": "user" }
  ]
}
```

**After:**
```json
{
  "appliedFilters": [
    {
      "kind": "skill",
      "field": "requiredSkills",
      "operator": "HAS_ALL",
      "skills": [{ "skillId": "skill_javascript", "skillName": "JavaScript", "minProficiency": "proficient" }],
      "displayValue": "JavaScript | min:proficient",
      "source": "user"
    }
  ],
  "appliedPreferences": [
    {
      "kind": "skill",
      "field": "preferredSkills",
      "skills": [{ "skillId": "skill_nodejs", "skillName": "Node.js" }],
      "displayValue": "Node.js",
      "source": "user"
    }
  ]
}
```

### Verification

After implementation:
1. Run `npm test` - all tests pass
2. Run `npm run test:e2e` - E2E tests pass (after updating Postman collection)
3. The workaround at `constraint-decomposer.service.ts:175-178` is removed
4. `requiredSkillIds` parameter is removed from `ConstraintAdviceInput`

## What We're NOT Doing

- Changing the skill resolution service (`skill-resolution.service.ts`) - it still returns `requiredSkillIds` for query building
- Changing the Cypher query builder - it still uses `skillGroups` for proficiency bucketing
- Adding versioning to the API - this is a breaking change (acceptable for this project)

## Implementation Approach

The refactoring follows this strategy:
1. Add new types alongside existing ones (non-breaking)
2. Update producers (constraint-expander) to emit new types
3. Update consumers to handle discriminated unions
4. Remove old workarounds and parallel parameters

---

## Phase 1: Add New Type Definitions ✅

### Overview
Add the discriminated union types to `search.types.ts`. This is additive and won't break existing code.

### Changes Required

#### 1. Add Types to search.types.ts
**File**: `recommender_api/src/types/search.types.ts`

Add after line 29 (after `ConstraintSource`):

```typescript
// ============================================
// APPLIED FILTER/PREFERENCE DISCRIMINATED UNIONS
// ============================================

/**
 * Kind discriminator for applied filter types.
 */
export enum AppliedFilterKind {
  /** Standard property constraint (salary, timezone, etc.) */
  Property = 'property',
  /** Skill constraint with resolved skill data */
  Skill = 'skill',
}

/**
 * Kind discriminator for applied preference types.
 */
export enum AppliedPreferenceKind {
  /** Standard property preference (preferredTimezone, etc.) */
  Property = 'property',
  /** Skill preference with resolved skill data */
  Skill = 'skill',
}

/**
 * Resolved skill constraint with full structured data.
 * Contains both ID (for queries) and name (for display).
 */
export interface ResolvedSkillConstraint {
  skillId: string;
  skillName: string;
  minProficiency?: ProficiencyLevel;
  preferredMinProficiency?: ProficiencyLevel;
}
```

Replace the existing `AppliedFilter` interface (lines 157-166) with:

```typescript
/**
 * AppliedFilter - hard constraints that filter candidates (WHERE clauses).
 * Discriminated union: use `filter.kind` to narrow the type.
 */
export interface AppliedPropertyFilter {
  kind: AppliedFilterKind.Property;
  field: string;
  operator: string;
  value: string;
  source: ConstraintSource;
}

export interface AppliedSkillFilter {
  kind: AppliedFilterKind.Skill;
  field: 'requiredSkills';
  operator: 'HAS_ALL';
  skills: ResolvedSkillConstraint[];
  displayValue: string;
  source: ConstraintSource;
}

export type AppliedFilter = AppliedPropertyFilter | AppliedSkillFilter;
```

Replace the existing `AppliedPreference` interface (lines 168-176) with:

```typescript
/**
 * AppliedPreference - soft boosts for ranking (utility scoring).
 * Discriminated union: use `preference.kind` to narrow the type.
 */
export interface AppliedPropertyPreference {
  kind: AppliedPreferenceKind.Property;
  field: string;
  value: string;
  source: ConstraintSource;
}

export interface AppliedSkillPreference {
  kind: AppliedPreferenceKind.Skill;
  field: 'preferredSkills';
  skills: ResolvedSkillConstraint[];
  displayValue: string;
  source: ConstraintSource;
}

export type AppliedPreference = AppliedPropertyPreference | AppliedSkillPreference;
```

#### 2. Add Type Guards (Optional but Recommended)
**File**: `recommender_api/src/types/search.types.ts`

Add helper functions:

```typescript
// Type guards for AppliedFilter
export function isSkillFilter(filter: AppliedFilter): filter is AppliedSkillFilter {
  return filter.kind === AppliedFilterKind.Skill;
}

export function isPropertyFilter(filter: AppliedFilter): filter is AppliedPropertyFilter {
  return filter.kind === AppliedFilterKind.Property;
}

// Type guards for AppliedPreference
export function isSkillPreference(pref: AppliedPreference): pref is AppliedSkillPreference {
  return pref.kind === AppliedPreferenceKind.Skill;
}

export function isPropertyPreference(pref: AppliedPreference): pref is AppliedPropertyPreference {
  return pref.kind === AppliedPreferenceKind.Property;
}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run typecheck` (will have errors until Phase 2)
- [ ] Types are exported correctly

**Implementation Note**: Type errors are expected after this phase - proceed immediately to Phase 2.

---

## Phase 2: Update Filter/Preference Producers ✅

### Overview
Update `constraint-expander.service.ts` to produce the new discriminated union types. This requires passing resolved skill data into the function.

### Changes Required

#### 1. Update trackSkillsAsConstraints Function
**File**: `recommender_api/src/services/constraint-expander.service.ts`

Import new types (add to imports at top):
```typescript
import type {
  // ... existing imports
  AppliedFilterKind,
  AppliedPreferenceKind,
  AppliedSkillFilter,
  AppliedSkillPreference,
  ResolvedSkillConstraint,
} from "../types/search.types.js";
```

Update `trackSkillsAsConstraints` function signature and implementation (replace lines 431-462):

```typescript
function trackSkillsAsConstraints(
  requiredSkills: SkillRequirement[] | undefined,
  preferredSkills: SkillRequirement[] | undefined,
  resolvedRequiredSkills: ResolvedSkillWithProficiency[],
  resolvedPreferredSkills: ResolvedSkillWithProficiency[]
): ExpansionContext {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  if (requiredSkills?.length && resolvedRequiredSkills.length) {
    const skills: ResolvedSkillConstraint[] = resolvedRequiredSkills.map((resolved, idx) => ({
      skillId: resolved.skillId,
      skillName: requiredSkills[idx]?.skill ?? resolved.skillId,
      minProficiency: resolved.minProficiency,
      preferredMinProficiency: resolved.preferredMinProficiency,
    }));

    const skillFilter: AppliedSkillFilter = {
      kind: AppliedFilterKind.Skill,
      field: 'requiredSkills',
      operator: 'HAS_ALL',
      skills,
      displayValue: requiredSkills.map(s => formatSkillSummary(s, true)).join(', '),
      source: 'user',
    };
    context.filters.push(skillFilter);
  }

  if (preferredSkills?.length && resolvedPreferredSkills.length) {
    const skills: ResolvedSkillConstraint[] = resolvedPreferredSkills.map((resolved, idx) => ({
      skillId: resolved.skillId,
      skillName: preferredSkills[idx]?.skill ?? resolved.skillId,
      minProficiency: resolved.minProficiency,
      preferredMinProficiency: resolved.preferredMinProficiency,
    }));

    const skillPreference: AppliedSkillPreference = {
      kind: AppliedPreferenceKind.Skill,
      field: 'preferredSkills',
      skills,
      displayValue: preferredSkills.map(s => formatSkillSummary(s, false)).join(', '),
      source: 'user',
    };
    context.preferences.push(skillPreference);
  }

  return context;
}
```

#### 2. Update All Other Filter Producers
**File**: `recommender_api/src/services/constraint-expander.service.ts`

Update `expandSeniorityToYearsExperience` (around line 245):
```typescript
context.filters.push({
  kind: AppliedFilterKind.Property,
  field: "yearsExperience",
  operator: maxYears !== null ? "BETWEEN" : ">=",
  value: valueStr,
  source: "knowledge_base",
});
```

Update `expandStartTimelineConstraint` (around line 283):
```typescript
context.filters.push({
  kind: AppliedFilterKind.Property,
  field: "startTimeline",
  operator: "IN",
  value: JSON.stringify(allowedTimelines),
  source: requiredMaxStartTime ? "user" : "knowledge_base",
});
```

Update `expandTimezoneToPrefixes` (around line 317):
```typescript
context.filters.push({
  kind: AppliedFilterKind.Property,
  field: "timezone",
  operator: "STARTS WITH (any of)",
  value: JSON.stringify(requiredTimezone),
  source: "user",
});
```

Update `expandBudgetConstraints` (around line 354):
```typescript
context.filters.push({
  kind: AppliedFilterKind.Property,
  field: "salary",
  operator: "<=",
  value: filterCeiling.toString(),
  source: "user",
});
```

Update `expandTeamFocusToAlignedSkills` (around line 386):
```typescript
context.preferences.push({
  kind: AppliedPreferenceKind.Property,
  field: "teamFocusMatch",
  value: alignedSkillIds.join(", "),
  source: "knowledge_base",
});
```

Update `trackPreferredValuesAsPreferences` (around lines 474-496):
```typescript
function trackPreferredValuesAsPreferences(
  request: SearchFilterRequest
): ExpansionContext {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  if (request.preferredSeniorityLevel) {
    context.preferences.push({
      kind: AppliedPreferenceKind.Property,
      field: "preferredSeniorityLevel",
      value: request.preferredSeniorityLevel,
      source: "user",
    });
  }

  if (request.preferredMaxStartTime) {
    context.preferences.push({
      kind: AppliedPreferenceKind.Property,
      field: "preferredMaxStartTime",
      value: request.preferredMaxStartTime,
      source: "user",
    });
  }

  if (request.preferredTimezone && request.preferredTimezone.length > 0) {
    context.preferences.push({
      kind: AppliedPreferenceKind.Property,
      field: "preferredTimezone",
      value: JSON.stringify(request.preferredTimezone),
      source: "user",
    });
  }

  return context;
}
```

Update inference context creation (around lines 163-175):
```typescript
if (isFilterConstraint(derivedConstraint)) {
  inferenceContext.filters.push({
    kind: AppliedFilterKind.Property,
    field: derivedConstraint.action.targetField,
    operator: "IN",
    value: JSON.stringify(derivedConstraint.action.targetValue),
    source: "inference",
  });
} else {
  inferenceContext.preferences.push({
    kind: AppliedPreferenceKind.Property,
    field: derivedConstraint.action.targetField,
    value: JSON.stringify(derivedConstraint.action.targetValue),
    source: "inference",
  });
}
```

#### 3. Update expandSearchCriteria Function Signature
**File**: `recommender_api/src/services/constraint-expander.service.ts`

The function needs resolved skills as input. Update signature:

```typescript
export async function expandSearchCriteria(
  request: SearchFilterRequest,
  resolvedRequiredSkills: ResolvedSkillWithProficiency[],
  resolvedPreferredSkills: ResolvedSkillWithProficiency[]
): Promise<ExpandedSearchCriteria> {
```

Update call to `trackSkillsAsConstraints` (around line 141):
```typescript
const skillsContext = trackSkillsAsConstraints(
  request.requiredSkills,
  request.preferredSkills,
  resolvedRequiredSkills,
  resolvedPreferredSkills
);
```

Add import for `ResolvedSkillWithProficiency`:
```typescript
import type { ResolvedSkillWithProficiency } from "./skill-resolver.service.js";
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run typecheck` (still may have errors until Phase 3)

---

## Phase 3: Update search.service.ts Orchestration ✅

### Overview
Update the search service to pass resolved skills to the constraint expander.

### Changes Required

#### 1. Update executeSearch Function
**File**: `recommender_api/src/services/search.service.ts`

Add import for `ResolvedSkillWithProficiency`:
```typescript
import type { ResolvedSkillWithProficiency } from "./skill-resolver.service.js";
```

Update the orchestration (reorder steps so skill resolution happens before expansion):

```typescript
export async function executeSearch(
  session: Session,
  request: SearchFilterRequest
): Promise<SearchFilterResponse> {
  const startTime = Date.now();
  const config = knowledgeBaseConfig;

  // Step 1: Resolve all skill requirements FIRST (needed for constraint expansion)
  const {
    skillGroups,
    requiredSkillIds,
    expandedSkillNames,
    unresolvedSkills,
    originalSkillIdentifiers,
    preferredSkillIds,
    skillIdToPreferredProficiency,
    resolvedRequiredSkills,    // NEW: expose this
    resolvedPreferredSkills,   // NEW: expose this
  } = await resolveAllSkills(
    session,
    request.requiredSkills,
    request.preferredSkills,
    config.defaults.defaultMinProficiency
  );

  // Step 2: Expand search criteria using knowledge base rules
  // Now receives resolved skills for structured AppliedFilter creation
  const expanded = await expandSearchCriteria(
    request,
    resolvedRequiredSkills,
    resolvedPreferredSkills
  );

  // ... rest of the function unchanged until getConstraintAdvice call
```

Update the `getConstraintAdvice` call (around line 167) to remove `requiredSkillIds`:

```typescript
const constraintAdviceOutput = await getConstraintAdvice({
  session,
  totalCount,
  expandedSearchCriteria: expanded,
  appliedFilters: expanded.appliedFilters,
  derivedConstraints: expanded.derivedConstraints,
  // REMOVED: requiredSkillIds - now embedded in appliedFilters
});
```

#### 2. Update SkillResolutionResult Interface
**File**: `recommender_api/src/services/skill-resolution.service.ts`

Expose the resolved skill arrays:

```typescript
export interface SkillResolutionResult {
  // ... existing fields
  /** Raw resolved required skills (for constraint expander) */
  resolvedRequiredSkills: ResolvedSkillWithProficiency[];
  /** Raw resolved preferred skills (for constraint expander) */
  resolvedPreferredSkills: ResolvedSkillWithProficiency[];
}
```

Update `resolveAllSkills` return statement (around line 135):

```typescript
return {
  skillGroups,
  requiredSkillIds,
  expandedSkillNames,
  unresolvedSkills,
  originalSkillIdentifiers,
  preferredSkillIds,
  skillIdToPreferredProficiency,
  resolvedRequiredSkills,     // NEW
  resolvedPreferredSkills: preferredSkills?.length
    ? (await resolveSkillRequirements(session, preferredSkills, defaultProficiency)).resolvedSkills
    : [],  // NEW - need to capture this
};
```

Note: The function needs refactoring to capture `resolvedPreferredSkills`. Update the preferred skills resolution block:

```typescript
let resolvedPreferredSkills: ResolvedSkillWithProficiency[] = [];

// Resolve preferred skills
if (preferredSkills && preferredSkills.length > 0) {
  const result = await resolveSkillRequirements(
    session,
    preferredSkills,
    defaultProficiency
  );
  resolvedPreferredSkills = result.resolvedSkills;  // Capture this
  preferredSkillIds = result.resolvedSkills.map((s) => s.skillId);
  // ... rest unchanged
}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run typecheck`

---

## Phase 4: Update Constraint Advisor Consumers ✅

### Overview
Update all constraint advisor services to handle the discriminated union types and remove the `requiredSkillIds` parallel parameter.

### Changes Required

#### 1. Update constraint-advisor.service.ts
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`

Remove `requiredSkillIds` from interface (line 28):

```typescript
export interface ConstraintAdviceInput {
  session: Session;
  totalCount: number;
  expandedSearchCriteria: ExpandedSearchCriteria;
  appliedFilters: AppliedFilter[];
  derivedConstraints: DerivedConstraint[];
  // REMOVED: requiredSkillIds: string[];
}
```

Update `getConstraintAdvice` function (line 44):
```typescript
const { session, totalCount, expandedSearchCriteria, appliedFilters, derivedConstraints } = input;
// REMOVED: requiredSkillIds from destructuring
```

Update `runRelaxationAnalysis` call (line 53):
```typescript
const relaxation = await runRelaxationAnalysis(
  session,
  appliedFilters,
  derivedConstraints
  // REMOVED: requiredSkillIds parameter
);
```

Update `runRelaxationAnalysis` function signature (line 68):
```typescript
async function runRelaxationAnalysis(
  session: Session,
  appliedFilters: AppliedFilter[],
  derivedConstraints: DerivedConstraint[]
  // REMOVED: requiredSkillIds: string[]
): Promise<RelaxationResult> {
```

Update `decomposeConstraints` call (line 75):
```typescript
const decomposed = decomposeConstraints(appliedFilters, derivedConstraints);
// REMOVED: requiredSkillIds parameter
```

Update `formatConflictSets` to handle discriminated union (lines 107-116):
```typescript
import { AppliedFilterKind, isSkillFilter } from "../../types/search.types.js";

function formatConflictSets(minimalSets: TestableConstraint[][]): ConflictSet[] {
  return minimalSets.map((constraints) => ({
    constraints: constraints.map((c): AppliedFilter => {
      // Check if this is a skill constraint based on field
      if (c.field === "requiredSkills" || c.field === "derivedSkills") {
        return {
          kind: AppliedFilterKind.Skill,
          field: 'requiredSkills',
          operator: 'HAS_ALL',
          skills: c.skillIds?.map(id => ({ skillId: id, skillName: id })) ?? [],
          displayValue: c.displayValue,
          source: c.source,
        };
      }
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
```

#### 2. Update constraint-decomposer.service.ts
**File**: `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.ts`

Import new types:
```typescript
import {
  AppliedFilterKind,
  isSkillFilter,
  isPropertyFilter,
  type AppliedPropertyFilter
} from "../../types/search.types.js";
```

Update `decomposeConstraints` signature - remove `requiredSkillIds`:
```typescript
export function decomposeConstraints(
  appliedFilters: AppliedFilter[],
  derivedConstraints: DerivedConstraint[]
  // REMOVED: requiredSkillIds: string[]
): DecomposedConstraints {
```

Update the main loop to handle discriminated union:
```typescript
for (let index = 0; index < appliedFilters.length; index++) {
  const filter = appliedFilters[index];

  // Handle skill filters directly (no more workaround!)
  if (isSkillFilter(filter)) {
    for (const skill of filter.skills) {
      constraints.push({
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
        skillIds: [skill.skillId],
      });
    }
    continue;
  }

  // Property filter handling (existing logic)
  const parsedValue = parseFilterValue(filter);
  // ... rest of existing property handling
}

// REMOVE the loop at lines 216-228 that adds user skill constraints from requiredSkillIds
```

Update `parseFilterValue` to only accept property filters:
```typescript
function parseFilterValue(filter: AppliedPropertyFilter): unknown {
  // ... existing logic unchanged, but now type-safe
}
```

**REMOVE** the workaround at lines 175-178:
```typescript
// DELETE THIS BLOCK:
// if (filter.field === "requiredSkills") {
//   continue;
// }
```

**REMOVE** the user skill constraint loop at lines 216-228:
```typescript
// DELETE THIS BLOCK:
// for (const skillId of requiredSkillIds) {
//   constraints.push({ ... });
// }
```

#### 3. Update tightening-generator.service.ts
**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

The existing code uses `appliedFilters.map(f => f.field)` which still works with the union type since both variants have `field`. No changes needed unless we want stricter typing.

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run typecheck`
- [ ] Unit tests pass: `npm test`

---

## Phase 5: Update Tests and E2E Collection ✅

### Overview
Update all test files and the Postman collection to reflect the new API response format.

### Changes Required

#### 1. Update Unit Tests
**Files**:
- `recommender_api/src/services/constraint-advisor/constraint-decomposer.service.test.ts`
- `recommender_api/src/services/constraint-advisor/constraint-advisor.service.test.ts`
- `recommender_api/src/services/constraint-expander.service.test.ts`

Update test fixtures to use new discriminated union format:

```typescript
// Example fixture update
const mockAppliedFilters: AppliedFilter[] = [
  {
    kind: AppliedFilterKind.Property,
    field: "yearsExperience",
    operator: "BETWEEN",
    value: "6 AND 10",
    source: "knowledge_base",
  },
  {
    kind: AppliedFilterKind.Skill,
    field: "requiredSkills",
    operator: "HAS_ALL",
    skills: [{ skillId: "skill_typescript", skillName: "TypeScript", minProficiency: "proficient" }],
    displayValue: "TypeScript | min:proficient",
    source: "user",
  },
];
```

Remove `requiredSkillIds` from test inputs to `decomposeConstraints` and `getConstraintAdvice`.

#### 2. Update Postman Collection
**File**: `postman/collections/search-filter-tests.postman_collection.json`

Update expected response assertions to check for new format:
- Add checks for `kind` field in appliedFilters and appliedPreferences
- Update skill filter assertions to check `skills` array structure
- Update any string comparisons on `value` field for skill filters

Example assertion updates:
```javascript
// Old assertion
pm.expect(appliedFilters[0].value).to.contain("JavaScript");

// New assertion
pm.expect(appliedFilters[0].kind).to.equal("skill");
pm.expect(appliedFilters[0].skills[0].skillName).to.equal("JavaScript");
```

### Success Criteria

#### Automated Verification:
- [ ] All unit tests pass: `npm test`
- [ ] E2E tests pass: `npm run test:e2e`

#### Manual Verification:
- [ ] API response format is correct (inspect via Postman or curl)
- [ ] Skills appear with structured data in appliedFilters
- [ ] Constraint advisor still provides accurate conflict detection

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests
- Verify `decomposeConstraints` correctly handles `AppliedSkillFilter`
- Verify skill constraints are extracted without needing separate `requiredSkillIds`
- Verify property filters continue to work unchanged
- Verify type guards work correctly

### Integration Tests
- Search with required skills returns proper `AppliedSkillFilter` in response
- Search with preferred skills returns proper `AppliedSkillPreference` in response
- Constraint advisor identifies skill conflicts correctly
- Relaxation suggestions for skills are generated properly

### E2E Tests (Postman)
- All existing test scenarios pass with updated assertions
- Skill-based searches return structured skill data
- Mixed searches (skills + properties) return correct filter kinds

---

## Performance Considerations

- No performance impact expected - this is purely a type restructuring
- The discriminated union pattern has no runtime overhead when compiled to JavaScript
- Type guards are simple property checks (`O(1)`)

---

## Migration Notes

This is a **breaking API change**. The response format for `appliedFilters` and `appliedPreferences` changes when skills are involved:
- Old: `{ field: "requiredSkills", value: "[\"JavaScript | min:proficient\"]" }`
- New: `{ kind: "skill", skills: [{ skillId: "...", skillName: "JavaScript", ... }] }`

Clients consuming the API will need to update their parsing logic to handle the `kind` discriminator.

---

## References

- Existing discriminated union patterns in codebase:
  - `TestableConstraint` in `constraint.types.ts`
  - `RelaxationSuggestion` in `search.types.ts:253-305`
- Original exploration notes from conversation
- TypeScript handbook on discriminated unions
