---
date: 2026-01-02T14:30:00-08:00
researcher: Claude
git_commit: fd5064e47c64196be8d8630f999a1d8305dcc598
branch: chapter_5_project_1
repository: recommender_system
topic: "Domain Model Redesign Development Batch Summary"
tags: [research, codebase, domain-model, refactoring, neo4j, business-domains, technical-domains]
status: complete
last_updated: 2026-01-02
last_updated_by: Claude
---

# Research: Domain Model Redesign Development Batch Summary

**Date**: 2026-01-02T14:30:00-08:00
**Researcher**: Claude
**Git Commit**: fd5064e47c64196be8d8630f999a1d8305dcc598
**Branch**: chapter_5_project_1
**Repository**: recommender_system

## Research Question

Analyze the staged changes and recent plans to summarize what was accomplished in this development batch.

## Summary

This development batch represents a **major architectural refactoring** of the domain model, transitioning from a skill-based domain approach to a proper domain node model. The work touched **24 files** with **+4,840/-402 lines changed**, implementing:

1. **New Graph Model**: Separate `BusinessDomain` and `TechnicalDomain` node types with hierarchical relationships
2. **Domain Experience Claims**: New `HAS_EXPERIENCE_IN` relationship with years of experience
3. **Skill Inference Chain**: `Skill → SkillCategory → TechnicalDomain` for automatic domain experience derivation
4. **Breaking API Change**: Restructured domain filtering from simple string arrays to structured objects with years requirements

---

## Detailed Findings

### 1. Domain Model Redesign (Complete)

**Plan**: `thoughts/shared/1_chapter_5/1_project_1/plans/2026-01-01-domain-model-redesign.md`

#### Before (Old Model)
```
(:Skill {skillType: 'domain_knowledge'})  // Domains were just special skills
(:Engineer)-[:HAS]->(:UserSkill)-[:FOR]->(:Skill)  // Same path as skills
```

#### After (New Model)
```
(:BusinessDomain {id: 'bd_fintech', name: 'Fintech'})
(:TechnicalDomain {id: 'td_backend', name: 'Backend'})
(:TechnicalDomain)-[:CHILD_OF]->(:TechnicalDomain)  // Hierarchy
(:TechnicalDomain)-[:ENCOMPASSES]->(:TechnicalDomain)  // Composite (Full Stack)
(:Engineer)-[:HAS_EXPERIENCE_IN {years: 5}]->(:Domain)  // Explicit claims
(:Skill)-[:BELONGS_TO]->(:SkillCategory)-[:BELONGS_TO]->(:TechnicalDomain)  // Inference
```

#### Key Behaviors Implemented
| Scenario | Behavior |
|----------|----------|
| API Development (3y) | Implies Backend experience (via CHILD_OF) |
| Full Stack (4y) | Implies Backend AND Frontend (via ENCOMPASSES) |
| React skill (4y) | Implies Frontend experience (via SkillCategory chain) |
| Backend (5y) | Does NOT imply Full Stack (no upward inference) |

#### Files Created/Modified
- **New**: `recommender_api/src/services/domain-resolver.service.ts` - Resolves domain identifiers with hierarchy expansion
- **New**: `seeds/domains.ts` - Business and technical domain seed data
- **New**: `seeds/skill-categories.ts` - SkillCategory node definitions
- **Modified**: `seeds/types.ts` - New domain and hierarchy types
- **Modified**: `seeds/seed.ts` - Seeding functions for new node types

---

### 2. Business Domain Hierarchy (Complete)

**Plan**: `thoughts/shared/1_chapter_5/1_project_1/plans/2026-01-02-business-domain-hierarchy.md`

Added `CHILD_OF` hierarchy support to business domains, mirroring the technical domain pattern:

```
Finance
├── Fintech
├── Banking
├── Payments
└── Insurance

Healthcare
├── Pharmaceuticals
├── Medical Devices
├── Telemedicine
└── Health Insurance

Retail
├── E-commerce
└── Marketplace
```

**Impact**: Searching for "Finance" now matches engineers with Fintech, Banking, Payments, or Insurance experience.

---

### 3. API Schema Changes (Breaking Change)

**Old API**:
```json
{
  "requiredDomains": ["fintech", "backend"],
  "preferredDomains": ["ml"]
}
```

**New API**:
```json
{
  "requiredBusinessDomains": [
    { "domain": "fintech", "minYears": 2 }
  ],
  "preferredBusinessDomains": [
    { "domain": "payments", "preferredMinYears": 3 }
  ],
  "requiredTechnicalDomains": [
    { "domain": "backend", "minYears": 3 }
  ],
  "preferredTechnicalDomains": [
    { "domain": "ml", "preferredMinYears": 1 }
  ]
}
```

**File**: `recommender_api/src/schemas/search.schema.ts:48-72`

---

### 4. Domain Flag Computation Fix

**Plan**: `thoughts/shared/1_chapter_5/1_project_1/plans/2026-01-02-fix-domain-meetsRequired-meetsPreferred.md`

**Problem**: `meetsRequired` was always `false`, `meetsPreferred` was always `true` (hardcoded).

**Solution**:
1. Domain collection now triggers for either required OR preferred constraints
2. Flags computed by checking membership in resolved constraint sets
3. Added `allBusinessDomainIds` and `allTechDomainIds` combined arrays for collection

**File**: `recommender_api/src/services/search.service.ts:517-563`

---

### 5. Code Quality Refactoring

#### Flatten Domain Constraint Sets
**Plan**: `thoughts/shared/1_chapter_5/1_project_1/plans/2026-01-02-flatten-domain-constraint-sets.md`

**Before**:
```typescript
meetsRequired: domainContext.requiredBusinessDomains.some((constraint) =>
  constraint.expandedDomainIds.includes(raw.domainId)
),
```

**After**:
```typescript
meetsRequired: allRequiredBusinessDomainIds.has(raw.domainId),
```

#### Parallel Arrays → Map Iteration
**Plan**: `thoughts/shared/1_chapter_5/1_project_1/plans/2026-01-02-refactor-parallel-arrays-to-map-iteration.md`

**Before** (fragile parallel arrays):
```typescript
queryParams.requiredBusinessDomainExpandedIds = domains.map(d => d.expandedDomainIds);
queryParams.requiredBusinessMinYears = domains.map(d => d.minYears ?? null);
// Cypher: $requiredBusinessDomainExpandedIds[idx] and $requiredBusinessMinYears[idx]
```

**After** (objects with map iteration):
```typescript
queryParams.requiredBusinessDomains = domains.map(d => ({
  expandedDomainIds: d.expandedDomainIds,
  minYears: d.minYears ?? null,
}));
// Cypher: ALL(constraint IN $requiredBusinessDomains WHERE constraint.expandedDomainIds ...)
```

---

### 6. Utility Scoring Updates

**File**: `recommender_api/src/config/knowledge-base/utility.config.ts`

Split single domain weight into separate business/technical weights:
- `preferredDomainMatch: 0.04` → `preferredBusinessDomainMatch: 0.02` + `preferredTechnicalDomainMatch: 0.02`

**File**: `recommender_api/src/services/utility-calculator.service.ts`
- Updated scoring functions to handle new domain structure
- Separate `calculateBusinessDomainScore` and `calculateTechnicalDomainScore` functions

---

## Code References

### New Files
- `recommender_api/src/services/domain-resolver.service.ts` - Domain resolution with hierarchy
- `seeds/domains.ts` - Business and technical domain definitions
- `seeds/skill-categories.ts` - SkillCategory node definitions

### Key Modified Files
- `recommender_api/src/schemas/search.schema.ts:48-72` - New domain requirement schemas
- `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts` - Complete rewrite
- `recommender_api/src/services/cypher-query-builder/query-types.ts:43-71` - New domain types
- `recommender_api/src/services/search.service.ts:485-590` - Domain parsing and flag computation
- `recommender_api/src/services/utility-calculator.service.ts` - Domain scoring updates

---

## Architecture Insights

### Inference Rules Rationale

1. **CHILD_OF implies parent**: API Development experience IS Backend experience (specialization subset)
2. **ENCOMPASSES implies encompassed**: Full Stack experience implies both Backend AND Frontend
3. **Skill → SkillCategory → Domain**: Concrete skills prove domain activity (React → Frontend)

### Why Separate Business and Technical Domains?

- **Business Domains** (Fintech, Healthcare): Industry experience, flat hierarchy, explicit claims only
- **Technical Domains** (Backend, Frontend, ML): Technical expertise, hierarchical, can be inferred from skills

### Performance Consideration

Domain hierarchy expansion adds one additional query per domain requirement, but hierarchy depth is shallow (typically 1 level) making expansion fast.

---

## Historical Context

This development batch builds on previous work in Chapter 5 Project 1:

- `2025-12-30-project-1-basic-constraint-search-api.md` - Initial search API
- `2025-12-30-domain-filtering-implementation.md` - Original domain filtering
- `2025-12-31-consolidate-count-into-search-query.md` - Query consolidation
- `2026-01-01-rename-expanded-constraints-split-filters-preferences.md` - API restructuring

---

## Related Research

- This is the first comprehensive research document for this development batch

---

## Open Questions

None - all planned work was completed successfully. The staged changes are ready for commit.

---

## Migration Notes

This is a **breaking change**. Old API fields removed:
- `requiredDomains: string[]` → Use `requiredBusinessDomains` + `requiredTechnicalDomains`
- `preferredDomains: string[]` → Use `preferredBusinessDomains` + `preferredTechnicalDomains`

Database migration sequence (already implemented in seed.ts):
1. `cleanupOldDomainData()` - Remove old domain_knowledge skills
2. Seed BusinessDomain and TechnicalDomain nodes
3. Seed hierarchy relationships (CHILD_OF, ENCOMPASSES)
4. Seed SkillCategory nodes
5. Seed Skill → SkillCategory → TechnicalDomain chains
6. Seed engineer domain experience (HAS_EXPERIENCE_IN)
