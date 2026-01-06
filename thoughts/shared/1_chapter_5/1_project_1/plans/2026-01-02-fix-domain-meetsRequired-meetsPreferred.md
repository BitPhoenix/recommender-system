# Fix Domain meetsRequired/meetsPreferred Flag Computation

## Overview

The `meetsRequired` and `meetsPreferred` flags on `BusinessDomainMatch` and `TechnicalDomainMatch` are currently hardcoded incorrectly. These flags should indicate whether a matched domain satisfies a required constraint, a preferred constraint, or both. Currently:
- `meetsRequired` is always `false`
- `meetsPreferred` is always `true`

This is incorrect because:
1. The Cypher query only collects domains matching **preferred** domain IDs
2. If only required domains are specified (no preferred), no domains are collected at all
3. A domain could satisfy both required AND preferred constraints (should have both flags true)

## Current State Analysis

### Problem 1: Collection Only Triggers for Preferred Domains

**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`

```typescript
// Lines 158-182: buildBusinessDomainCollection
if (context.hasPreferredBusinessDomains) {  // ← Only triggers for preferred!
  return `
    OPTIONAL MATCH (e)-[bdExp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    WHERE ANY(idx IN range(0, size($preferredBusinessDomainExpandedIds) - 1) WHERE
      bd.id IN $preferredBusinessDomainExpandedIds[idx]
    )
    ...`;
}
return `... [] AS matchedBusinessDomains`;  // ← Empty if no preferred domains!
```

If a request has `requiredBusinessDomains: ["Finance"]` but no `preferredBusinessDomains`, the collection returns `[]` and no domain matching data appears in the response.

### Problem 2: Hardcoded Flags in Service Layer

**File**: `recommender_api/src/services/search.service.ts`

```typescript
// Lines 510-523
const matchedBusinessDomains = parseDomainMatches<...>(
  record.get("matchedBusinessDomains") as RawBusinessDomainMatch[] | null,
  (raw) => ({
    domainId: raw.domainId,
    domainName: raw.domainName,
    engineerYears: toNumber(raw.years),
    meetsRequired: false,  // ← Always false!
    meetsPreferred: true,  // ← Always true!
  })
);
```

### Problem 3: Utility Calculator Relies on Incorrect Flags

**File**: `recommender_api/src/services/utility-calculator.service.ts`

```typescript
// Lines 197-198
const matchingDomains = matchedBusinessDomains.filter((d) => d.meetsPreferred);
```

The utility calculator filters by `meetsPreferred`, but since it's always `true`, this filter is meaningless. The correct behavior should be:
- Count domains where `meetsPreferred === true` for the preferred domain match score
- (Future) Could also use `meetsRequired` for validation/display purposes

## Desired End State

After implementation:

1. **Collection**: The Cypher query collects domains matching **either** required OR preferred constraints
2. **Flag computation**: Each domain is correctly flagged based on constraint membership:
   - `meetsRequired: true` if the domain ID appears in any required constraint's `expandedDomainIds`
   - `meetsPreferred: true` if the domain ID appears in any preferred constraint's `expandedDomainIds`
   - Both can be `true` if the same domain is in both required and preferred lists
3. **Utility scoring**: Works correctly with accurate flags

### Verification

- Request with only `requiredBusinessDomains` → domains collected and flagged with `meetsRequired: true`
- Request with only `preferredBusinessDomains` → domains collected and flagged with `meetsPreferred: true`
- Request with both → domains collected and flagged appropriately for each constraint
- Newman tests pass with correct domain flags in responses

## What We're NOT Doing

- Changing the **filter** behavior (required domains remain hard filters)
- Adding new API request/response fields
- Changing how utility scores are calculated (just fixing the input data)
- Modifying domain resolution logic

## Implementation Approach

The fix requires changes in three layers:
1. **Query Builder**: Add combined domain ID arrays and update collection to trigger for either required or preferred
2. **Query Params**: Pass context needed for flag computation to the service layer
3. **Service Layer**: Compute flags by checking membership in required vs preferred constraint sets

## Phase 1: Update DomainFilterContext and Query Params

### Overview
Add `hasAnyBusinessDomains` and `hasAnyTechnicalDomains` flags to the context, and add combined domain ID arrays for collection matching.

### Changes Required:

#### 1. Update DomainFilterContext Interface
**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`

```typescript
export interface DomainFilterContext {
  hasRequiredBusinessDomains: boolean;
  hasPreferredBusinessDomains: boolean;
  hasRequiredTechnicalDomains: boolean;
  hasPreferredTechnicalDomains: boolean;
  /** True if either required or preferred business domains exist */
  hasAnyBusinessDomains: boolean;
  /** True if either required or preferred technical domains exist */
  hasAnyTechnicalDomains: boolean;
}
```

#### 2. Update getDomainFilterContext Function
**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`

```typescript
export function getDomainFilterContext(
  params: CypherQueryParams
): DomainFilterContext {
  const hasRequiredBusinessDomains =
    (params.requiredBusinessDomains?.length ?? 0) > 0;
  const hasPreferredBusinessDomains =
    (params.preferredBusinessDomains?.length ?? 0) > 0;
  const hasRequiredTechnicalDomains =
    (params.requiredTechnicalDomains?.length ?? 0) > 0;
  const hasPreferredTechnicalDomains =
    (params.preferredTechnicalDomains?.length ?? 0) > 0;

  return {
    hasRequiredBusinessDomains,
    hasPreferredBusinessDomains,
    hasRequiredTechnicalDomains,
    hasPreferredTechnicalDomains,
    hasAnyBusinessDomains: hasRequiredBusinessDomains || hasPreferredBusinessDomains,
    hasAnyTechnicalDomains: hasRequiredTechnicalDomains || hasPreferredTechnicalDomains,
  };
}
```

#### 3. Update addDomainQueryParams to Add Combined Arrays
**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`

Add combined flat arrays for collection matching:

```typescript
export function addDomainQueryParams(
  queryParams: Record<string, unknown>,
  params: CypherQueryParams,
  context: DomainFilterContext
): void {
  // ... existing code for required/preferred params ...

  // Add combined flat arrays for collection (union of required + preferred expanded IDs)
  if (context.hasAnyBusinessDomains) {
    const allBusinessExpandedIds: string[] = [];
    if (params.requiredBusinessDomains) {
      for (const d of params.requiredBusinessDomains) {
        allBusinessExpandedIds.push(...d.expandedDomainIds);
      }
    }
    if (params.preferredBusinessDomains) {
      for (const d of params.preferredBusinessDomains) {
        allBusinessExpandedIds.push(...d.expandedDomainIds);
      }
    }
    // Dedupe
    queryParams.allBusinessDomainIds = [...new Set(allBusinessExpandedIds)];
  }

  if (context.hasAnyTechnicalDomains) {
    const allTechExpandedIds: string[] = [];
    if (params.requiredTechnicalDomains) {
      for (const d of params.requiredTechnicalDomains) {
        allTechExpandedIds.push(...d.expandedDomainIds);
      }
    }
    if (params.preferredTechnicalDomains) {
      for (const d of params.preferredTechnicalDomains) {
        allTechExpandedIds.push(...d.expandedDomainIds);
      }
    }
    // Dedupe
    queryParams.allTechDomainIds = [...new Set(allTechExpandedIds)];
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint` (no lint script configured, skipped)

---

## Phase 2: Update Domain Collection Queries

### Overview
Modify `buildBusinessDomainCollection` and `buildTechnicalDomainCollection` to:
1. Trigger when ANY domain constraints exist (not just preferred)
2. Match against the combined `allBusinessDomainIds` / `allTechDomainIds` arrays

### Changes Required:

#### 1. Update buildBusinessDomainCollection
**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`

```typescript
/**
 * Collects matched business domains for scoring (with hierarchy).
 * Collects domains matching EITHER required OR preferred constraints.
 */
export function buildBusinessDomainCollection(
  context: DomainFilterContext,
  carryoverFields: string[]
): string {
  const carryover = carryoverFields.join(', ');

  if (context.hasAnyBusinessDomains) {
    return `
// Collect matched business domains (required OR preferred) for scoring
OPTIONAL MATCH (e)-[bdExp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
WHERE bd.id IN $allBusinessDomainIds
WITH e, ${carryover},
     COLLECT(DISTINCT {
       domainId: bd.id,
       domainName: bd.name,
       years: bdExp.years
     }) AS matchedBusinessDomains`;
  }

  return `
WITH e, ${carryover},
     [] AS matchedBusinessDomains`;
}
```

#### 2. Update buildTechnicalDomainCollection
**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`

```typescript
/**
 * Collects matched technical domains for scoring.
 * Includes both explicit claims AND skill-inferred experience via SkillCategory.
 * Collects domains matching EITHER required OR preferred constraints.
 */
export function buildTechnicalDomainCollection(
  context: DomainFilterContext,
  carryoverFields: string[]
): string {
  const carryover = carryoverFields.join(', ');

  if (context.hasAnyTechnicalDomains) {
    return `
// Collect explicit domain claims (required OR preferred)
OPTIONAL MATCH (e)-[explicitExp:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
WHERE td.id IN $allTechDomainIds
WITH e, ${carryover},
     COLLECT(DISTINCT CASE WHEN td IS NOT NULL THEN {
       domainId: td.id,
       domainName: td.name,
       years: explicitExp.years,
       source: 'explicit'
     } END) AS explicitDomains

// Collect skill-inferred domain experience via SkillCategory → TechnicalDomain
OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(:Skill)-[:BELONGS_TO]->(:SkillCategory)-[:BELONGS_TO]->(td:TechnicalDomain)
WHERE td.id IN $allTechDomainIds
WITH e, ${carryover}, explicitDomains,
     td.id AS inferredDomainId,
     td.name AS inferredDomainName,
     MAX(us.yearsUsed) AS inferredYears
WITH e, ${carryover}, explicitDomains,
     COLLECT(DISTINCT CASE WHEN inferredDomainId IS NOT NULL THEN {
       domainId: inferredDomainId,
       domainName: inferredDomainName,
       years: inferredYears,
       source: 'inferred'
     } END) AS inferredDomains

// Merge: explicit claims take precedence over inferred
WITH e, ${carryover},
     [d IN explicitDomains WHERE d IS NOT NULL] +
     [d IN inferredDomains WHERE d IS NOT NULL AND NOT d.domainId IN [x IN explicitDomains WHERE x IS NOT NULL | x.domainId]]
     AS matchedTechnicalDomains`;
  }

  return `
WITH e, ${carryover},
     [] AS matchedTechnicalDomains`;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Basic API call returns domain data when only required domains are specified (test 24)

---

## Phase 3: Fix Flag Computation in Service Layer

### Overview
Update `parseEngineerFromRecord` to compute `meetsRequired` and `meetsPreferred` by checking each domain's membership in the resolved constraint arrays.

### Changes Required:

#### 1. Update parseEngineerFromRecord Signature and Logic
**File**: `recommender_api/src/services/search.service.ts`

First, update the function to accept the resolved domain constraints:

```typescript
interface DomainConstraintContext {
  requiredBusinessDomains: ResolvedBusinessDomain[];
  preferredBusinessDomains: ResolvedBusinessDomain[];
  requiredTechnicalDomains: ResolvedTechnicalDomain[];
  preferredTechnicalDomains: ResolvedTechnicalDomain[];
}

function parseEngineerFromRecord(
  record: { get: (key: string) => unknown },
  options: {
    shouldClearSkills: boolean;
    isTeamFocusOnlyMode: boolean;
    alignedSkillIds: string[];
  },
  domainContext: DomainConstraintContext
): RawEngineerRecord {
  // ... existing skill parsing code ...

  // Extract matched domains with correct flag computation
  const matchedBusinessDomains = parseDomainMatches<
    BusinessDomainMatch,
    RawBusinessDomainMatch
  >(
    record.get("matchedBusinessDomains") as RawBusinessDomainMatch[] | null,
    (raw) => ({
      domainId: raw.domainId,
      domainName: raw.domainName,
      engineerYears: toNumber(raw.years),
      meetsRequired: domainContext.requiredBusinessDomains.some(
        (constraint) => constraint.expandedDomainIds.includes(raw.domainId)
      ),
      meetsPreferred: domainContext.preferredBusinessDomains.some(
        (constraint) => constraint.expandedDomainIds.includes(raw.domainId)
      ),
    })
  );

  const matchedTechnicalDomains = parseDomainMatches<
    TechnicalDomainMatch,
    RawTechnicalDomainMatch
  >(
    record.get("matchedTechnicalDomains") as RawTechnicalDomainMatch[] | null,
    (raw) => ({
      domainId: raw.domainId,
      domainName: raw.domainName,
      engineerYears: toNumber(raw.years),
      matchType: (raw.source === "inferred"
        ? "skill_inferred"
        : "direct") as TechnicalDomainMatchType,
      meetsRequired: domainContext.requiredTechnicalDomains.some(
        (constraint) => constraint.expandedDomainIds.includes(raw.domainId)
      ),
      meetsPreferred: domainContext.preferredTechnicalDomains.some(
        (constraint) => constraint.expandedDomainIds.includes(raw.domainId)
      ),
    })
  );

  // ... rest of function ...
}
```

#### 2. Update executeSearch to Pass Domain Context
**File**: `recommender_api/src/services/search.service.ts`

Update the call site around line 208:

```typescript
// Build domain context for flag computation
const domainContext: DomainConstraintContext = {
  requiredBusinessDomains,
  preferredBusinessDomains,
  requiredTechnicalDomains,
  preferredTechnicalDomains,
};

const rawEngineers: RawEngineerRecord[] = mainResult.records.map((record) =>
  parseEngineerFromRecord(record, parseOptions, domainContext)
);
```

#### 3. Add Import for ResolvedTechnicalDomain
**File**: `recommender_api/src/services/search.service.ts`

Ensure the import at line 34 includes `ResolvedBusinessDomain`:

```typescript
import {
  buildSearchQuery,
  type CypherQueryParams,
  type SkillProficiencyGroups,
  type ResolvedTechnicalDomain,
  type ResolvedBusinessDomain,
} from "./cypher-query-builder/index.js";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint` (no lint script configured, skipped)
- [x] Newman tests pass: `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json`

#### Manual Verification (automated via Newman tests):
- [x] API response shows `meetsRequired: true` for domains matching required constraints (tests 24, 35)
- [x] API response shows `meetsPreferred: true` for domains matching preferred constraints (tests 25, 36)
- [x] Domains in both required and preferred show both flags as `true` (test 42)

---

## Phase 4: Update Cypher Query Builder Index Export (Already Complete)

### Overview
Ensure `ResolvedBusinessDomain` is exported from the index file.

### Changes Required:

#### 1. Update Index Exports
**File**: `recommender_api/src/services/cypher-query-builder/index.ts`

```typescript
export type {
  CypherQueryParams,
  SkillProficiencyGroups,
  ResolvedTechnicalDomain,
  ResolvedBusinessDomain,  // Add this export
  CypherQuery,
  BasicEngineerFilters,
} from './query-types.js';
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Already exported in current codebase - no changes needed

---

## Testing Strategy

### Unit Tests:
- Test `getDomainFilterContext` returns correct `hasAny*` flags
- Test flag computation logic for edge cases:
  - Domain in required only → `meetsRequired: true, meetsPreferred: false`
  - Domain in preferred only → `meetsRequired: false, meetsPreferred: true`
  - Domain in both → `meetsRequired: true, meetsPreferred: true`
  - Domain matching via hierarchy expansion

### Integration Tests (Newman):
- Existing tests should continue to pass
- Consider adding specific tests for:
  - Request with only `requiredBusinessDomains` → verify domain data returned
  - Request with only `preferredBusinessDomains` → verify domain data returned
  - Request with both → verify correct flags

### Manual Testing Steps:
1. Make API request with only `requiredBusinessDomains: [{ identifier: "Finance" }]`
   - Verify matching engineers have domain data in response
   - Verify `meetsRequired: true` for Finance-related domains
2. Make API request with only `preferredBusinessDomains: [{ identifier: "Healthcare" }]`
   - Verify `meetsPreferred: true` for Healthcare domains
3. Make API request with both required and preferred domains
   - Verify domains appearing in both lists have both flags set correctly

## References

- Conversation context where this bug was identified
- `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts` - Query building logic
- `recommender_api/src/services/search.service.ts` - Service layer parsing
- `recommender_api/src/types/search.types.ts` - Type definitions
