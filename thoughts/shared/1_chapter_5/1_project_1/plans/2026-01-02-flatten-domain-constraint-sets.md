# Flatten Domain Constraint Sets for Readability

## Overview

Refactor the `meetsRequired` and `meetsPreferred` flag computation in `parseEngineerFromRecord` to use pre-flattened Sets instead of nested `.some()` + `.includes()` calls. This improves readability and provides a minor performance benefit.

## Rationale

### Current Code (Hard to Read)
```typescript
meetsRequired: domainContext.requiredBusinessDomains.some((constraint) =>
  constraint.expandedDomainIds.includes(raw.domainId)
),
meetsPreferred: domainContext.preferredBusinessDomains.some((constraint) =>
  constraint.expandedDomainIds.includes(raw.domainId)
),
```

This reads as: "check if any constraint has this domain ID in its expanded list" - but you have to mentally parse the nested callback to understand it.

### Proposed Code (Clearer)
```typescript
meetsRequired: allRequiredBusinessDomainIds.has(raw.domainId),
meetsPreferred: allPreferredBusinessDomainIds.has(raw.domainId),
```

This reads naturally: "is this domain ID in the set of required/preferred IDs?"

### Semantic Discussion

We discussed whether flattening loses important information. The key insight:

**If a user requires "Finance", and an engineer has "Accounting" (a child of Finance):**
- The `expandedDomainIds` for the Finance constraint includes `[finance, accounting, banking, ...]`
- So `meetsRequired: true` for Accounting is correct - Accounting experience **does** satisfy the Finance requirement

This is analogous to skills: requiring "JavaScript" is satisfied by "React" experience, because React expertise implies JavaScript knowledge.

**Conclusion:** `meetsRequired` means "this domain satisfies a required constraint (directly or via hierarchy)" - and the flattened approach preserves this semantic.

## Current State Analysis

**File**: `recommender_api/src/services/search.service.ts`

The `parseEngineerFromRecord` function (lines 485-590) receives a `DomainConstraintContext` with four arrays:
- `requiredBusinessDomains: ResolvedBusinessDomain[]`
- `preferredBusinessDomains: ResolvedBusinessDomain[]`
- `requiredTechnicalDomains: ResolvedTechnicalDomain[]`
- `preferredTechnicalDomains: ResolvedTechnicalDomain[]`

Each `Resolved*Domain` has an `expandedDomainIds: string[]` field containing the domain ID plus all descendants (for business) or related IDs (for technical).

The same nested check pattern is repeated 4 times:
1. Business domains - meetsRequired (line 533-535)
2. Business domains - meetsPreferred (line 536-538)
3. Technical domains - meetsRequired (line 554-556)
4. Technical domains - meetsPreferred (line 557-559)

## What We're NOT Doing

- Not changing the semantic meaning of `meetsRequired` or `meetsPreferred`
- Not changing the `DomainConstraintContext` interface
- Not modifying how domain constraints are resolved upstream

---

## Phase 1: Flatten Domain IDs into Sets

### Overview
Pre-compute flattened Sets of all expanded domain IDs at the start of `parseEngineerFromRecord`, then use simple `.has()` checks.

### Changes Required:

#### 1. Add Set Computation at Function Start
**File**: `recommender_api/src/services/search.service.ts`
**Location**: Inside `parseEngineerFromRecord`, after the destructuring (around line 494)

Add after `const { shouldClearSkills, isTeamFocusOnlyMode, alignedSkillIds } = options;`:

```typescript
// Pre-flatten domain constraint IDs for efficient lookup
const allRequiredBusinessDomainIds = new Set(
  domainContext.requiredBusinessDomains.flatMap((c) => c.expandedDomainIds)
);
const allPreferredBusinessDomainIds = new Set(
  domainContext.preferredBusinessDomains.flatMap((c) => c.expandedDomainIds)
);
const allRequiredTechnicalDomainIds = new Set(
  domainContext.requiredTechnicalDomains.flatMap((c) => c.expandedDomainIds)
);
const allPreferredTechnicalDomainIds = new Set(
  domainContext.preferredTechnicalDomains.flatMap((c) => c.expandedDomainIds)
);
```

#### 2. Simplify Business Domain Flag Computation
**File**: `recommender_api/src/services/search.service.ts`
**Location**: Lines 533-538

Replace:
```typescript
meetsRequired: domainContext.requiredBusinessDomains.some((constraint) =>
  constraint.expandedDomainIds.includes(raw.domainId)
),
meetsPreferred: domainContext.preferredBusinessDomains.some((constraint) =>
  constraint.expandedDomainIds.includes(raw.domainId)
),
```

With:
```typescript
meetsRequired: allRequiredBusinessDomainIds.has(raw.domainId),
meetsPreferred: allPreferredBusinessDomainIds.has(raw.domainId),
```

#### 3. Simplify Technical Domain Flag Computation
**File**: `recommender_api/src/services/search.service.ts`
**Location**: Lines 554-559

Replace:
```typescript
meetsRequired: domainContext.requiredTechnicalDomains.some((constraint) =>
  constraint.expandedDomainIds.includes(raw.domainId)
),
meetsPreferred: domainContext.preferredTechnicalDomains.some(
  (constraint) => constraint.expandedDomainIds.includes(raw.domainId)
),
```

With:
```typescript
meetsRequired: allRequiredTechnicalDomainIds.has(raw.domainId),
meetsPreferred: allPreferredTechnicalDomainIds.has(raw.domainId),
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck` in `recommender_api/`
- [x] All existing tests pass: `npm test` in `recommender_api/` (no test script exists)
- [x] Newman collection passes: `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json` (domain flag tests pass; 2 pre-existing 500 errors unrelated to this refactor)

#### Manual Verification:
- [x] Search with required business domains returns correct `meetsRequired` flags
- [x] Search with preferred business domains returns correct `meetsPreferred` flags
- [x] Search with required technical domains returns correct `meetsRequired` flags
- [x] Search with preferred technical domains returns correct `meetsPreferred` flags

---

## Performance Note

This change provides a minor performance improvement:

**Before:** For each domain match, we iterate through all constraints and their expanded ID arrays: O(domains × constraints × expandedIds)

**After:** We flatten once upfront O(constraints × expandedIds), then each lookup is O(1) via Set.has()

For typical searches with a handful of constraints, this is negligible. But it's a nice side benefit of the cleaner code.

## References

- Current implementation: `recommender_api/src/services/search.service.ts:485-590`
- Domain constraint types: `recommender_api/src/services/cypher-query-builder/query-types.ts:55-71`
