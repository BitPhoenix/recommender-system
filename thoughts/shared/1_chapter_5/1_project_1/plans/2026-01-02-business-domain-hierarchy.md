# Business Domain Hierarchy Implementation Plan

## Overview

Add CHILD_OF hierarchy support to business domains, matching the pattern already used for technical domains. This enables searching for "Finance" to also match engineers with experience in child domains like "Fintech", "Banking", "Payments", etc.

## Current State Analysis

### What Exists Now
- `BusinessDomain` nodes are flat with no hierarchy relationships
- `resolveBusinessDomains()` does simple identifier→ID resolution (no expansion)
- `ResolvedBusinessDomain` type only has `domainId` - no `expandedDomainIds`
- Query builder matches business domains exactly (no hierarchy traversal)

### Reference Pattern (Technical Domains)
Technical domains already support hierarchy via:
- `TechnicalDomainHierarchy` type with CHILD_OF relationships
- `ResolvedTechnicalDomain` includes `expandedDomainIds`
- `resolveTechnicalDomains()` expands to include self + descendants
- Query builder uses `expandedDomainIds` for matching

### Key Discoveries:
- `seeds/types.ts:216-219` - `TechnicalDomainHierarchy` type to mirror
- `seeds/domains.ts:65-84` - Technical domain hierarchy seed data pattern
- `domain-resolver.service.ts:76-138` - Expansion logic to replicate
- `query-domain-filter.builder.ts:91-109` - Business domain filter uses exact match

## Desired End State

1. Business domains support CHILD_OF hierarchy relationships
2. Searching for parent domains (e.g., "Finance") matches engineers with child domain experience (e.g., "Fintech")
3. Hierarchy expansion logic mirrors technical domains
4. Seed data includes realistic hierarchies (Finance→Fintech/Banking/Payments/Insurance, Healthcare→Pharma/Medical Devices/Telemedicine)

### Verification:
- Search for `requiredBusinessDomains: [{ domain: "Finance", minYears: 2 }]` returns engineers with Fintech, Banking, Payments, or Insurance experience ≥2 years
- Postman collection tests pass with hierarchy scenarios

## What We're NOT Doing

- **No ENCOMPASSES relationship for business domains** - Unlike technical domains (Full Stack encompasses Backend + Frontend), business domains don't have composite concepts that warrant this
- **No skill inference for business domains** - Technical domains can be inferred from skills via SkillCategory chain; business domains remain explicit experience claims only

## Implementation Approach

Mirror the technical domain hierarchy pattern:
1. Add type + seed data for business domain hierarchy
2. Update resolver to expand business domains
3. Update query builder to use expanded IDs
4. Update Postman tests

---

## Phase 1: Type Definitions and Seed Data

### Overview
Add the `BusinessDomainHierarchy` type and update seed data with realistic hierarchies.

### Changes Required:

#### 1. Add BusinessDomainHierarchy Type
**File**: `seeds/types.ts`
**Changes**: Add new interface after `BusinessDomain`

```typescript
export interface BusinessDomainHierarchy {
  childDomainId: string;
  parentDomainId: string;
}
```

#### 2. Update Business Domain Seed Data
**File**: `seeds/domains.ts`
**Changes**:
- Add parent domains (Finance, Healthcare, Retail)
- Reorganize existing domains as children where appropriate
- Add hierarchy relationships

```typescript
// BUSINESS DOMAINS - now with hierarchy
export const businessDomains: BusinessDomain[] = [
  // Top-level parent domains
  { id: 'bd_finance', name: 'Finance', description: 'Financial services and technology' },
  { id: 'bd_healthcare', name: 'Healthcare', description: 'Healthcare and medical technology' },
  { id: 'bd_retail', name: 'Retail', description: 'Retail and commerce' },

  // Finance children
  { id: 'bd_fintech', name: 'Fintech', description: 'Financial technology startups and innovation' },
  { id: 'bd_banking', name: 'Banking', description: 'Traditional banking and financial institutions' },
  { id: 'bd_payments', name: 'Payments', description: 'Payment processing and infrastructure' },
  { id: 'bd_insurance', name: 'Insurance', description: 'Insurance technology' },

  // Healthcare children
  { id: 'bd_pharma', name: 'Pharmaceuticals', description: 'Drug development and pharma tech' },
  { id: 'bd_medical_devices', name: 'Medical Devices', description: 'Medical device software and hardware' },
  { id: 'bd_telemedicine', name: 'Telemedicine', description: 'Remote healthcare and telehealth' },
  { id: 'bd_health_insurance', name: 'Health Insurance', description: 'Health insurance technology' },

  // Retail children
  { id: 'bd_ecommerce', name: 'E-commerce', description: 'Online retail and marketplaces' },
  { id: 'bd_marketplace', name: 'Marketplace', description: 'Multi-vendor marketplace platforms' },

  // Standalone domains (no parent)
  { id: 'bd_saas', name: 'SaaS', description: 'Software as a Service products' },
  { id: 'bd_gaming', name: 'Gaming', description: 'Video games and interactive entertainment' },
  { id: 'bd_edtech', name: 'EdTech', description: 'Education technology' },
  { id: 'bd_logistics', name: 'Logistics', description: 'Supply chain and logistics' },
];

// BUSINESS DOMAIN HIERARCHY (CHILD_OF)
// Child domain experience satisfies parent domain requirements
export const businessDomainHierarchy: BusinessDomainHierarchy[] = [
  // Finance children
  { childDomainId: 'bd_fintech', parentDomainId: 'bd_finance' },
  { childDomainId: 'bd_banking', parentDomainId: 'bd_finance' },
  { childDomainId: 'bd_payments', parentDomainId: 'bd_finance' },
  { childDomainId: 'bd_insurance', parentDomainId: 'bd_finance' },

  // Healthcare children
  { childDomainId: 'bd_pharma', parentDomainId: 'bd_healthcare' },
  { childDomainId: 'bd_medical_devices', parentDomainId: 'bd_healthcare' },
  { childDomainId: 'bd_telemedicine', parentDomainId: 'bd_healthcare' },
  { childDomainId: 'bd_health_insurance', parentDomainId: 'bd_healthcare' },

  // Retail children
  { childDomainId: 'bd_ecommerce', parentDomainId: 'bd_retail' },
  { childDomainId: 'bd_marketplace', parentDomainId: 'bd_retail' },
];
```

#### 3. Export Hierarchy from domains.ts
**File**: `seeds/domains.ts`
**Changes**: Ensure export of `businessDomainHierarchy`

#### 4. Update seed.ts to Seed Hierarchy
**File**: `seeds/seed.ts`
**Changes**:
- Import `businessDomainHierarchy`
- Add `seedBusinessDomainHierarchy()` function
- Call it in the domains seeding section

```typescript
import {
  businessDomains,
  businessDomainHierarchy,  // Add this
  technicalDomains,
  // ...
} from './domains';

async function seedBusinessDomainHierarchy(session: Session): Promise<void> {
  console.log('🌳 Seeding business domain hierarchy (CHILD_OF)...');
  for (const rel of businessDomainHierarchy) {
    await session.run(
      `MATCH (child:BusinessDomain {id: $childDomainId})
       MATCH (parent:BusinessDomain {id: $parentDomainId})
       MERGE (child)-[:CHILD_OF]->(parent)`,
      rel
    );
  }
  console.log(`   ✓ Seeded ${businessDomainHierarchy.length} CHILD_OF relationships`);
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck` in seeds directory
- [x] Seed script runs successfully: `npx tsx seeds/seed.ts`
- [x] Neo4j shows CHILD_OF relationships:
  ```cypher
  MATCH (c:BusinessDomain)-[:CHILD_OF]->(p:BusinessDomain) RETURN c.name, p.name
  ```

#### Manual Verification:
- [x] Verify in Neo4j browser that Finance has 4 children, Healthcare has 4, Retail has 2

---

## Phase 2: Update ResolvedBusinessDomain Type

### Overview
Add `expandedDomainIds` to the resolved type to match technical domain pattern.

### Changes Required:

#### 1. Update ResolvedBusinessDomain
**File**: `recommender_api/src/services/cypher-query-builder/query-types.ts`
**Changes**: Add `expandedDomainIds` field

```typescript
/**
 * Resolved business domain with hierarchy expansion and years requirements.
 */
export interface ResolvedBusinessDomain {
  domainId: string;
  expandedDomainIds: string[];  // includes self + descendants via CHILD_OF
  minYears?: number;
  preferredMinYears?: number;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`

---

## Phase 3: Update Domain Resolver Service

### Overview
Modify `resolveBusinessDomains()` to expand business domains to include descendants, matching the technical domain pattern.

### Changes Required:

#### 1. Update resolveBusinessDomains Function
**File**: `recommender_api/src/services/domain-resolver.service.ts`
**Changes**: Add hierarchy expansion logic

```typescript
/**
 * Resolves business domain identifiers with hierarchy expansion.
 *
 * For CHILD_OF: If user requests "Finance", expands to include Finance + all children
 * (Fintech, Banking, Payments, Insurance) so engineers with child experience match.
 */
export async function resolveBusinessDomains(
  session: Session,
  requirements: BusinessDomainRequirement[] | undefined
): Promise<ResolvedBusinessDomain[]> {
  if (!requirements || requirements.length === 0) {
    return [];
  }

  const resolved: ResolvedBusinessDomain[] = [];

  for (const req of requirements) {
    // Find the domain by ID or name
    const domainResult = await session.run(
      `MATCH (d:BusinessDomain)
       WHERE d.id = $identifier OR d.name = $identifier
       RETURN d.id AS domainId`,
      { identifier: req.domain }
    );

    if (domainResult.records.length === 0) continue;

    const domainId = domainResult.records[0].get('domainId') as string;

    // Get self + all descendants (CHILD_OF)
    const descendantsResult = await session.run(
      `MATCH (d:BusinessDomain {id: $domainId})
       OPTIONAL MATCH (child:BusinessDomain)-[:CHILD_OF*1..]->(d)
       RETURN d.id AS selfId, COLLECT(DISTINCT child.id) AS childIds`,
      { domainId }
    );

    const record = descendantsResult.records[0];
    const childIds = (record.get('childIds') as string[]).filter(
      (id) => id !== null
    );
    const expandedDomainIds = [domainId, ...childIds];

    resolved.push({
      domainId,
      expandedDomainIds,
      minYears: req.minYears,
      preferredMinYears: req.preferredMinYears,
    });
  }

  return resolved;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass (if any exist for domain resolver)

---

## Phase 4: Update Query Builder

### Overview
Modify the business domain filter to use `expandedDomainIds` instead of exact `domainId` matching.

### Changes Required:

#### 1. Update addDomainQueryParams
**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`
**Changes**: Use expandedDomainIds for business domains (matching technical domain pattern)

```typescript
export function addDomainQueryParams(
  queryParams: Record<string, unknown>,
  params: CypherQueryParams,
  context: DomainFilterContext
): void {
  // Business domain params - now with expansion
  if (context.hasRequiredBusinessDomains && params.requiredBusinessDomains) {
    queryParams.requiredBusinessDomainExpandedIds = params.requiredBusinessDomains.map(
      (d) => d.expandedDomainIds
    );
    queryParams.requiredBusinessMinYears = params.requiredBusinessDomains.map(
      (d) => d.minYears ?? null
    );
  }

  if (context.hasPreferredBusinessDomains && params.preferredBusinessDomains) {
    queryParams.preferredBusinessDomainIds =
      params.preferredBusinessDomains.map((d) => d.domainId);
    queryParams.preferredBusinessDomainExpandedIds =
      params.preferredBusinessDomains.map((d) => d.expandedDomainIds);
    queryParams.preferredBusinessMinYears =
      params.preferredBusinessDomains.map((d) => d.preferredMinYears ?? null);
  }

  // Technical domain params (unchanged)
  // ...
}
```

#### 2. Update buildRequiredBusinessDomainFilter
**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`
**Changes**: Use expandedDomainIds for matching

```typescript
/**
 * Builds required business domain filter with hierarchy support.
 * Engineer must have experience in ANY of the expanded domain IDs with >= minYears.
 */
export function buildRequiredBusinessDomainFilter(
  context: DomainFilterContext
): string {
  if (!context.hasRequiredBusinessDomains) return '';

  return `
// Business domain filter: must have experience in ALL required domains (via hierarchy)
WITH e
WHERE ALL(idx IN range(0, size($requiredBusinessDomainExpandedIds) - 1) WHERE
  EXISTS {
    MATCH (e)-[exp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    WHERE bd.id IN $requiredBusinessDomainExpandedIds[idx]
    AND (
      $requiredBusinessMinYears[idx] IS NULL
      OR exp.years >= $requiredBusinessMinYears[idx]
    )
  }
)`;
}
```

#### 3. Update buildBusinessDomainCollection
**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`
**Changes**: Use expandedDomainIds for preferred domain matching

```typescript
export function buildBusinessDomainCollection(
  context: DomainFilterContext,
  carryoverFields: string[]
): string {
  const carryover = carryoverFields.join(', ');

  if (context.hasPreferredBusinessDomains) {
    return `
// Collect matched preferred business domains for scoring (with hierarchy)
OPTIONAL MATCH (e)-[bdExp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
WHERE ANY(idx IN range(0, size($preferredBusinessDomainExpandedIds) - 1) WHERE
  bd.id IN $preferredBusinessDomainExpandedIds[idx]
)
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

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] API starts without errors

---

## Phase 5: Update Engineer Seed Data

### Overview
Update engineer business domain experience to use new child domains where appropriate.

### Changes Required:

#### 1. Review and Update Engineer Domain Experience
**File**: `seeds/engineers.ts`
**Changes**: Ensure engineers have experience in child domains (Fintech, Banking, etc.) so hierarchy searches work

Example: An engineer with `bd_fintech` experience should be found when searching for `Finance` requirement.

### Success Criteria:

#### Automated Verification:
- [x] Seed script runs: `npx tsx seeds/seed.ts`

---

## Phase 6: Update Postman Tests

### Overview
Add test cases for business domain hierarchy searches.

### Changes Required:

#### 1. Add Hierarchy Test Cases
**File**: `postman/collections/search-filter-tests.postman_collection.json`
**Changes**: Add tests for:
- Search for "Finance" returns engineers with Fintech experience
- Search for "Healthcare" returns engineers with Pharma/Telemedicine experience
- Verify minYears is respected across hierarchy

### Success Criteria:

#### Automated Verification:
- [x] Newman tests pass:
  ```bash
  npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json
  ```

#### Manual Verification:
- [x] API returns expected results for hierarchy searches
- [x] Engineers with child domain experience appear in parent domain searches

---

## Testing Strategy

### Unit Tests:
- Test `resolveBusinessDomains()` returns expanded IDs
- Test query builder generates correct Cypher with expandedDomainIds

### Integration Tests:
- Search for "Finance" with minYears:2 returns engineers with Fintech/Banking experience ≥2 years
- Search for specific child domain still works (exact match within expanded set)

### Manual Testing Steps:
1. Seed database with new hierarchy
2. Search API with `requiredBusinessDomains: [{ domain: "Finance" }]`
3. Verify engineers with Fintech, Banking, Payments, Insurance experience are returned
4. Search with `minYears: 3` and verify years filter works across hierarchy

## Performance Considerations

- Business domain hierarchy expansion adds one additional query per domain requirement
- This matches the technical domain pattern and should have similar performance
- Hierarchy depth is shallow (typically 1 level) so expansion is fast

## Migration Notes

- Existing `bd_fintech`, `bd_banking`, etc. IDs are preserved
- New parent domains (`bd_finance`, `bd_healthcare`, `bd_retail`) are added
- No breaking changes to API - searches for existing domains continue to work
- Engineers with existing domain experience will now also match parent domain searches

## References

- Technical domain hierarchy implementation: `recommender_api/src/services/domain-resolver.service.ts:76-138`
- Technical domain seed data: `seeds/domains.ts:65-95`
- Query builder pattern: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`
