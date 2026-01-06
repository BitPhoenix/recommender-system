# Plan: Implement Domain Filtering (requiredDomains + preferredDomains)

## Problem
The `domainPreference` field is declared but never used. We need to implement domain filtering with both hard filter and ranking boost modes.

## Data Model
Domain experience is modeled as **skills with `skillType: 'domain_knowledge'`**:
- Skills: `skill_fintech`, `skill_healthcare`, `skill_ecommerce`, `skill_saas`, `skill_ai_ml`, `skill_blockchain`, `skill_marketplace`
- Engineers have domains via `(Engineer)-[:HAS_SKILL]->(Skill)` relationships
- Current test data: Priya/James have fintech, Marcus has saas, Emily has ecommerce

## API Design (user confirmed)
Replace `domainPreference` with two fields following the `requiredSkills`/`preferredSkills` pattern:
```typescript
{
  "requiredDomains": ["fintech"],      // Hard filter - must match at least one
  "preferredDomains": ["healthcare"]   // Ranking boost - optional, increases score
}
```

## Implementation Steps

### Step 1: Update Types ✅
**File: `recommender_api/src/types/search.types.ts`**
- [x] Replace `domainPreference?: string[]` with:
  - `requiredDomains?: string[]` - Hard filter
  - `preferredDomains?: string[]` - Ranking boost
- [x] Add `DomainBonusComponent` interface
- [x] Add `domainBonus` to `ScoreBreakdown.components`
- [x] Add `matchedDomains: string[]` to `EngineerMatch`

### Step 2: Update Validation ✅
**File: `recommender_api/src/middleware/validate-search.middleware.ts`**
- [x] Replace `domainPreference` validation with `requiredDomains` and `preferredDomains`
- [x] Same validation logic (array of strings)

### Step 3: Update CypherQueryParams ✅
**File: `recommender_api/src/services/cypher-builder.service.ts`**
- [x] Add to interface:
  - `requiredDomainIds?: string[]`
  - `preferredDomainIds?: string[]`

### Step 4: Map Domains to Skill IDs in Search Service ✅
**File: `recommender_api/src/services/search.service.ts`**
- [x] Use skill resolver to convert domain names → skill IDs
- [x] Pass to cypher builder as `requiredDomainIds`/`preferredDomainIds`
- [x] Add `preferredDomainIds` to `UtilityContext`
- [x] Extract `matchedDomainNames` from query results

### Step 5: Implement Cypher Query Logic ✅
**File: `recommender_api/src/services/cypher-builder.service.ts`**
- [x] **requiredDomains**: Add WHERE clause filtering engineers with HAS_SKILL to domain skills
- [x] **preferredDomains**: Add OPTIONAL MATCH and collect matched domains for scoring
- [x] Update both skill search mode and browse mode queries
- [x] Update count query to respect domain filter

### Step 6: Update Utility Calculator ✅
**File: `recommender_api/src/services/utility-calculator.service.ts`**

- [x] Add `preferredDomainIds: string[]` to `UtilityContext`
- [x] Add `matchedDomainNames: string[]` to `EngineerData`
- [x] Add `calculateDomainBonusWithDetails()` function
- [x] Add `calculateDomainBonusUtility()` function
- [x] Add `domainBonus` to breakdown components

**File: `recommender_api/src/config/knowledge-base.config.ts`**
- [x] Add `domainBonus: 0.05` weight
- [x] Add `domainBonusMax: 1.0` param

**File: `recommender_api/src/types/knowledge-base.types.ts`**
- [x] Add `domainBonus` to `UtilityWeights`
- [x] Add `domainBonusMax` to `UtilityFunctionParams`

### Step 7: TypeScript Compilation ✅
- [x] `npx tsc --noEmit` passes

### Step 8: Test
- Test `requiredDomains: ["fintech"]` → returns only Priya & James
- Test `preferredDomains: ["fintech"]` → returns all, Priya & James boosted
- Test both together → hard filter + boost scoring

## Files to Modify
1. `recommender_api/src/types/search.types.ts` - Request/response types
2. `recommender_api/src/middleware/validate-search.middleware.ts` - Validation rules
3. `recommender_api/src/services/search.service.ts` - Domain name → skill ID mapping
4. `recommender_api/src/services/cypher-builder.service.ts` - Cypher query filtering
5. `recommender_api/src/services/utility-calculator.service.ts` - Domain bonus scoring
6. `recommender_api/src/config/knowledge-base.config.ts` - Add domainBonus weight/params
