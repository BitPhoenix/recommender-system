---
date: 2026-01-16T14:30:00-06:00
researcher: Claude
git_commit: 4ad1d903fa07194281bc05c13f4c3b95a3114a66
branch: project_3
repository: BitPhoenix/recommender-system
topic: "Project 3: Similarity Scoring - Plan Validation"
tags: [research, codebase, similarity, plan-validation, project-3]
status: complete
last_updated: 2026-01-16
last_updated_by: Claude
---

# Research: Project 3 Plan Validation

**Date**: 2026-01-16T14:30:00-06:00
**Researcher**: Claude
**Git Commit**: 4ad1d903fa07194281bc05c13f4c3b95a3114a66
**Branch**: project_3
**Repository**: BitPhoenix/recommender-system

## Research Question

Validate the implementation plan at `thoughts/shared/plans/2026-01-16-project-3-similarity-scoring.md` against the actual codebase to identify any adjustments needed.

## Summary

The plan is **well-designed and aligns closely with existing codebase patterns**. The research identified **3 minor adjustments needed** and **1 potential enhancement** to consider. The plan correctly identifies the module structure, weight application patterns, and error handling conventions. The main correction is around Neo4j session handling (no `getSession()` function exists).

---

## Detailed Findings

### 1. Utility-Calculator Module Structure ✅ CORRECT

**Plan Assumption:** Create parallel `similarity-calculator/` module mirroring `utility-calculator/` structure.

**Codebase Reality:** The plan accurately describes the utility-calculator structure:
```
recommender_api/src/services/utility-calculator/
├── index.ts                    (Public API exports)
├── types.ts                    (Type definitions)
├── utility-calculator.ts       (Main orchestrator)
└── scoring/
    ├── core-scoring.ts
    ├── skill-scoring.ts
    ├── domain-scoring.ts
    └── logistics-scoring.ts
```

**Patterns Confirmed:**
- `utility-calculator.ts:44-46` — Weight application uses `Math.round(raw * weight * 1000) / 1000` (3-decimal rounding)
- `utility-calculator.ts:226` — Final score uses `Math.round(total * 100) / 100` (2-decimal rounding)
- Scoring functions return `{ raw: number, ...metadata }` pattern
- Types separated into public API types and internal result types in `types.ts`

**Assessment:** Plan's module structure is correct. No changes needed.

---

### 2. Neo4j Session Handling ⚠️ ADJUSTMENT NEEDED

**Plan Assumption (Phase 5, lines 852-854):**
```typescript
import { getSession } from '../db/neo4j.js';
// ...
const session = getSession();
```

**Codebase Reality:** There is **no `getSession()` function**. The pattern is:
- `neo4j.ts` exports the driver as default: `export default driver`
- Controllers call `driver.session()` directly
- Located at: `recommender_api/src/neo4j.ts` (not `db/neo4j.ts`)

**Correct Pattern (from `search.controller.ts:15-39`):**
```typescript
import driver from '../neo4j.js';

export async function getSimilarEngineers(req: Request, res: Response): Promise<void> {
  const session = driver.session();

  try {
    // ... use session
  } catch (error) {
    // ... handle error
  } finally {
    await session.close();
  }
}
```

**Required Change:** Update Phase 5 controller to:
1. Import `driver` from `../neo4j.js` (not `getSession` from `../db/neo4j.js`)
2. Use `driver.session()` instead of `getSession()`

---

### 3. Middleware Functions ⚠️ ADJUSTMENT NEEDED

**Plan Assumption (Phase 5, lines 938-984):**
Plan provides implementations for `validateParams` and `validateQuery` functions, implying they don't exist.

**Codebase Reality:** The plan is **correct** — these functions do NOT exist. Only `validate(schema)` for body validation exists at `zod-validate.middleware.ts:13-38`.

**Current State:**
- `validate(schema)` — validates `req.body` ✅ exists
- `validateParams(schema)` — validates `req.params` ❌ needs creation
- `validateQuery(schema)` — validates `req.query` ❌ needs creation

**Assessment:** Plan correctly identifies these need to be created. The implementations provided in the plan (lines 943-983) are correct and follow the existing error format.

---

### 4. Route Mounting Pattern ✅ CORRECT

**Plan Assumption (Phase 5, lines 927-935):**
```typescript
// In app.ts
import similarityRoutes from './routes/similarity.routes.js';
app.use('/api/engineers', similarityRoutes);
```

**Codebase Reality:** Route mounting in `app.ts:36`:
```typescript
app.use('/api/search', searchRoutes);
```

**Assessment:** Pattern is correct. The plan uses `/api/engineers` as the base path which is appropriate for the endpoint `GET /api/engineers/:id/similar`.

---

### 5. Skill Graph Relationships ✅ CORRECT

**Plan Assumption:** Uses CHILD_OF, BELONGS_TO, CORRELATES_WITH relationships with priority order: exact (1.0) → correlation (strength) → category (0.5) → parent (0.3) → 0.

**Codebase Reality:**
- `seeds/skills.ts:147-191` — 170+ CHILD_OF relationships (hierarchy)
- `seeds/skills.ts:197-270` — 270+ CORRELATES_WITH with strength values
- `seeds/skills.ts:278-405` — 100+ BELONGS_TO relationships (categories)
- `skill-resolver.service.ts:105-132` — Dual-path traversal patterns exist

**Correlation Data Confirmed:**
- TypeScript ↔ JavaScript: 0.95 strength (transferable)
- Kubernetes ↔ Docker: 0.9 strength (complementary)
- Monitoring ↔ Logging: 0.8 strength (co_occurring)

**Assessment:** Plan's skill similarity algorithm correctly leverages existing graph structure.

---

### 6. Domain Graph Relationships ✅ CORRECT

**Plan Assumption:** Domain similarity uses CHILD_OF (siblings = 0.5, parent-child = 0.4) and ENCOMPASSES (0.4).

**Codebase Reality:**
- `seeds/domains.ts:47-63` — Business domain CHILD_OF (Finance → Fintech, Banking, etc.)
- `seeds/domains.ts:105-124` — Technical domain CHILD_OF (Backend → API Development, etc.)
- `seeds/domains.ts:132-135` — ENCOMPASSES (Full Stack → Backend, Frontend)
- `domain-resolver.service.ts:27-147` — Expansion patterns exist for both relationship types

**Assessment:** Plan correctly describes domain hierarchy. The composite domain handling (Full Stack) is accurate.

---

### 7. Config Export Pattern ✅ CORRECT

**Plan Assumption (Phase 1, lines 144-159):**
```typescript
// config/knowledge-base/index.ts
export { similarityWeights, similarityParams } from './similarity.config.js';
```

**Codebase Reality (from `config/knowledge-base/index.ts`):**
- Existing pattern exports from utility.config.ts
- Index.ts re-exports for clean public API

**Assessment:** Plan follows existing pattern correctly.

---

### 8. Error Response Format ✅ CORRECT

**Plan Assumption (Phase 5, lines 876-893):**
```typescript
res.status(404).json({
  error: {
    code: 'ENGINEER_NOT_FOUND',
    message: error.message,
  },
});
```

**Codebase Reality (from `search.controller.ts:26-35`):**
```typescript
const errorResponse: SearchErrorResponse = {
  error: {
    code: 'SEARCH_ERROR',
    message: 'An error occurred...',
    details: error instanceof Error ? [{ field: 'internal', message: error.message }] : undefined,
  },
};
```

**Assessment:** Plan follows existing error response pattern. Consider adding optional `details` array for consistency.

---

### 9. Testing Patterns ✅ CORRECT

**Plan Assumption (Phase 6):** Create unit tests with factory helpers for test data.

**Codebase Reality:** `utility-calculator.test.ts:10-45` uses factory pattern:
```typescript
function createEngineer(overrides: Partial<EngineerData> = {}): EngineerData {
  return {
    id: 'test-eng',
    name: 'Test Engineer',
    // ... comprehensive defaults
    ...overrides,
  };
}
```

**Assessment:** Plan's testing approach matches codebase conventions.

---

## Required Adjustments

### Adjustment 1: Fix Neo4j Import Path and Pattern

**Location:** Phase 5, Controller (lines 852-854)

**Current Plan:**
```typescript
import { getSession } from '../db/neo4j.js';
const session = getSession();
```

**Corrected:**
```typescript
import driver from '../neo4j.js';
const session = driver.session();
```

### Adjustment 2: Remove `getSession` Reference from Service

**Location:** Phase 4, Service (lines 713-714)

The plan's service function signature is correct (receives session as parameter), but ensure no reference to `getSession` anywhere in the service layer. Services should **never** acquire sessions.

### Adjustment 3: Add Optional Error Details

**Location:** Phase 5, Controller error handling (lines 884-893)

**Enhancement for consistency:**
```typescript
res.status(500).json({
  error: {
    code: 'SIMILARITY_ERROR',
    message: 'Failed to find similar engineers',
    details: error instanceof Error
      ? [{ field: 'internal', message: error.message }]
      : undefined,
  },
});
```

---

## Potential Enhancements (Optional)

### Enhancement 1: Consider Caching Graph Data

The plan notes (lines 1148-1149) that graphs can be cached. Given the research showing:
- Skill graph: 170+ CHILD_OF, 270+ CORRELATES_WITH, 100+ BELONGS_TO
- Domain graph: 10 business CHILD_OF, 10 technical CHILD_OF, 2 ENCOMPASSES

These are relatively static. Consider implementing in-memory caching with TTL for production performance. This is correctly identified as a future optimization in the plan.

### Enhancement 2: Consider Session Threading Warning

Multiple places in codebase note Neo4j sessions are not thread-safe:
- `conflict-stats.service.ts:24-29`
- `search.service.ts:76-77`

The plan's graph loading uses `Promise.all()` for parallel loading:
```typescript
const [skillGraph, domainGraph] = await Promise.all([
  loadSkillGraph(session),
  loadDomainGraph(session),
]);
```

**Recommendation:** If both functions use the same session, run sequentially instead:
```typescript
const skillGraph = await loadSkillGraph(session);
const domainGraph = await loadDomainGraph(session);
```

Or pass separate sessions to enable true parallelism (but adds complexity).

---

## Architecture Insights

### Pattern Consistency

The plan demonstrates strong alignment with existing architecture:

| Aspect | Existing (utility-calculator) | Proposed (similarity-calculator) | Match |
|--------|-------------------------------|----------------------------------|-------|
| Module structure | index/types/main + scoring/ | index/types/main + scoring/ | ✅ |
| Weight application | `Math.round(x * weight * 1000) / 1000` | Same formula | ✅ |
| Score rounding | 2 decimal places | Same | ✅ |
| Return types | `{ raw, ...metadata }` | Same pattern | ✅ |
| Config location | `config/knowledge-base/` | Same | ✅ |
| Session handling | Passed as parameter | Same | ✅ |
| Error responses | `{ error: { code, message, details? } }` | Same | ✅ |

### Design Quality

The plan makes several correct architectural decisions:
1. **Separate module** — Similarity has different semantics than utility (engineer-to-engineer vs engineer-to-requirements)
2. **Graph-aware scoring** — Leverages existing CORRELATES_WITH, CHILD_OF, BELONGS_TO instead of simple Jaccard
3. **Diversity selection** — Bounded greedy selection prevents homogeneous results
4. **Excluded timeline** — Correctly identifies timeline as transient, not a capability attribute

---

## Code References

| Component | File | Line Numbers |
|-----------|------|--------------|
| Utility module structure | `services/utility-calculator/` | (directory) |
| Weight application | `utility-calculator/utility-calculator.ts` | 44-46 |
| Score rounding | `utility-calculator/utility-calculator.ts` | 226 |
| Neo4j driver export | `neo4j.ts` | 1-9 |
| Controller session pattern | `controllers/search.controller.ts` | 15-39 |
| Validation middleware | `middleware/zod-validate.middleware.ts` | 13-38 |
| Route mounting | `app.ts` | 36 |
| Skill relationships | `seeds/skills.ts` | 147-405 |
| Domain relationships | `seeds/domains.ts` | 47-135 |
| Domain resolver | `services/domain-resolver.service.ts` | 27-147 |
| Skill resolver | `services/skill-resolver.service.ts` | 74-240 |
| Sequential query note | `services/constraint-advisor/conflict-stats.service.ts` | 24-29 |

---

## Open Questions

1. **Graph loading parallelism:** Should `loadSkillGraph` and `loadDomainGraph` use separate sessions for true parallel execution, or should they run sequentially on the same session?

2. **Correlation bidirectionality:** CORRELATES_WITH relationships appear to be stored unidirectionally in seeds but should be treated as bidirectional for similarity. Confirm the graph loader queries both directions.

---

## Conclusion

**The plan is well-designed and ready for implementation with minor adjustments:**

1. ✅ Module structure correct
2. ⚠️ Fix Neo4j import (use `driver.session()` not `getSession()`)
3. ⚠️ Create `validateParams` and `validateQuery` middleware (correctly identified in plan)
4. ✅ Skill/domain graph algorithms align with existing data
5. ✅ Config, testing, and error patterns match codebase conventions

**Recommendation:** Proceed with implementation, applying the three adjustments noted above.
