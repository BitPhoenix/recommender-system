---
date: 2026-01-06T00:00:00-08:00
researcher: Claude
git_commit: bc75c7446425b86af35a1a5fb8dcaecaf7a6366a
branch: main
repository: recommender_system
topic: "Iterative Requirement Expansion Plan Updates"
tags: [research, codebase, inference-engine, project-1.5, plan-update]
status: complete
last_updated: 2026-01-06
last_updated_by: Claude
last_updated_note: "Added decisions from follow-up discussion"
---

# Research: Iterative Requirement Expansion Plan Updates

**Date**: 2026-01-06T00:00:00-08:00
**Researcher**: Claude
**Git Commit**: bc75c7446425b86af35a1a5fb8dcaecaf7a6366a
**Branch**: main
**Repository**: recommender_system

## Research Question

Compare the original implementation plan (`2025-12-31-iterative-requirement-expansion.md`) with the current codebase state and identify required updates to the plan.

## Summary

The codebase has evolved significantly since the plan was written. **None of the inference engine components from the plan have been implemented yet** - Project 1.5 is a fresh implementation. However, several structural changes in the codebase require updates to file paths, type names, and integration points in the plan.

### Key Finding Categories

1. **Type/Interface Naming**: Plan uses different names than codebase conventions
2. **File Organization**: Knowledge base and utility calculator use modular directory structures
3. **Existing Tracking**: `appliedFilters`/`appliedPreferences` exist but need extension
4. **Integration Points**: Different function signatures and return types than planned

## Detailed Findings

### Phase 1: Define Rule Format and Types

**Status**: NOT IMPLEMENTED - `inference-rule.types.ts` does not exist

**Required Plan Updates**:

| Plan Assumption | Current Reality | Update Needed |
|-----------------|-----------------|---------------|
| File: `types/inference-rule.types.ts` | Directory exists at `recommender_api/src/types/` | ✅ Path is correct |
| Import from `./search.types.js` | Types are re-exported from Zod schemas | Update imports to use schema-inferred types |
| Add to `KnowledgeBaseConfig` interface | Interface is in `types/knowledge-base.types.ts` | ✅ Correct location |

**Additional Consideration**: The plan's types import `SeniorityLevel`, `RiskTolerance`, etc. from `search.types.ts`. Current codebase re-exports these from Zod schemas. The imports should be:
```typescript
// Current pattern
import type { SeniorityLevel, TeamFocus, ProficiencyLevel } from '../schemas/search.schema.js';
```

---

### Phase 2: Create Initial Rule Set

**Status**: NOT IMPLEMENTED - No `inferenceRules` array exists

**Required Plan Updates**:

| Plan Assumption | Current Reality | Update Needed |
|-----------------|-----------------|---------------|
| File: `config/knowledge-base.config.ts` | Config split across `config/knowledge-base/` directory | **Update file path** |
| Single config file | Modular structure with index.ts, filter-conditions.config.ts, compatibility-constraints.config.ts, defaults.config.ts, utility.config.ts | Create new `inference-rules.config.ts` |
| Add to `knowledgeBaseConfig` object | Config assembled in `config/knowledge-base/index.ts` | Add to index.ts exports |

**New File Structure Recommendation**:
```
config/knowledge-base/
├── index.ts                    # Add inferenceRules export
├── filter-conditions.config.ts
├── compatibility-constraints.config.ts
├── defaults.config.ts
├── utility.config.ts
└── inference-rules.config.ts   # NEW FILE for rule definitions
```

**Rule Field Updates**: The plan references fields like `requiredRiskTolerance`. Current schema supports:
- `requiredSeniorityLevel` ✅
- `teamFocus` ✅
- `requiredMinProficiency` ✅
- `requiredAvailability` → Should be `requiredMaxStartTime` (timeline-based)
- `requiredRiskTolerance` → **DOES NOT EXIST** - This field is not in the current schema

**DECISION**: Remove risk-tolerance-based rules from the plan (see [Decisions Made](#decisions-made) section). Rules to remove:
- `low-risk-prefers-experience`
- `high-risk-accepts-learning`
- `low-risk-scaling-proven`

---

### Phase 3: Implement Forward-Chaining Inference Engine

**Status**: NOT IMPLEMENTED - No `inference-engine.service.ts` exists

**DECISION**: Rename from `rule-engine.service.ts` to `inference-engine.service.ts` (see [Decisions Made](#decisions-made) section)

**Required Plan Updates**:

| Plan Assumption | Current Reality | Update Needed |
|-----------------|-----------------|---------------|
| `SearchFilterRequest` type | Type is inferred from Zod schema | Import from `../schemas/search.schema.js` |
| Field `requiredMaxSalary` | Field is named `maxBudget` | Update field references |
| Field `requiredMinSalary` | Field is named `minBudget` (if exists) | Verify schema |
| Field `requiredAvailability` | Field is `requiredMaxStartTime` + `preferredMaxStartTime` | Update field mappings |

**Function Signature Updates**:

The plan's `extractUserExplicitFields` references fields that have different names:
```typescript
// Plan uses:
request.requiredMaxSalary
request.requiredMinSalary
request.requiredAvailability
request.preferredAvailability

// Should be:
request.maxBudget
request.stretchBudget
request.requiredMaxStartTime
request.preferredMaxStartTime
```

---

### Phase 4: Integrate with Constraint Expander

**Status**: PARTIALLY EXISTS - Different structure than planned

**Critical Differences**:

| Plan Assumption | Current Reality | Update Needed |
|-----------------|-----------------|---------------|
| Interface `ExpandedConstraints` | Interface is `ExpandedSearchCriteria` | **Rename in plan** |
| Add `derivedConstraints` field | No such field exists | Add to ExpandedSearchCriteria |
| Add `derivedSkillBoosts: Map<string, number>` | No such field exists | Add to ExpandedSearchCriteria |
| Function `expandConstraints()` | Function is `expandSearchCriteria()` | **Rename in plan** |

**Current ExpandedSearchCriteria Fields** (lines 25-72 of constraint-expander.service.ts):
```typescript
interface ExpandedSearchCriteria {
  minYearsExperience: number | null;
  maxYearsExperience: number | null;
  startTimeline: StartTimeline[];
  timezonePrefixes: string[];
  maxBudget: number | null;
  stretchBudget: number | null;
  alignedSkillIds: string[];
  limit: number;
  offset: number;
  appliedFilters: AppliedFilter[];
  appliedPreferences: AppliedPreference[];
  defaultsApplied: string[];
  preferredSeniorityLevel: SeniorityLevel | null;
  preferredMaxStartTime: StartTimeline | null;
  requiredMaxStartTime: StartTimeline | null;
  preferredTimezone: string[];
}
```

**Required Additions**:
```typescript
// Add these fields:
derivedConstraints: DerivedConstraint[];
derivedSkillBoosts: Map<string, number>;
```

**AppliedConstraint vs AppliedFilter**: The plan uses `AppliedConstraint` but codebase has separate `AppliedFilter` and `AppliedPreference` types. The plan should use the existing pattern and add a new source value:
```typescript
// Extend ConstraintSource type
type ConstraintSource = 'user' | 'knowledge_base' | 'inference';
```

---

### Phase 4 (continued): Utility Calculator Integration

**Status**: EXISTS with different structure than planned

**Critical Differences**:

| Plan Assumption | Current Reality | Update Needed |
|-----------------|-----------------|---------------|
| File: `utility-calculator.service.ts` | Directory: `utility-calculator/` with modular files | **Update paths** |
| Single `UtilityContext` interface | Interface in `utility-calculator/types.ts` | Correct location |
| Add `derivedSkillBoosts` field | No such field | Add to UtilityContext |
| Add `derivedConstraints` field | No such field | Add to UtilityContext |

**Current Utility Calculator Structure**:
```
utility-calculator/
├── index.ts                    # Public API exports
├── types.ts                    # Type definitions including UtilityContext
├── utility-calculator.ts       # Main orchestration
└── scoring/
    ├── core-scoring.ts         # Confidence, experience utilities
    ├── skill-scoring.ts        # Skill match calculations
    ├── domain-scoring.ts       # Business/technical domain matches
    └── logistics-scoring.ts    # Timeline, timezone, seniority, budget
```

**Current UtilityContext** (types.ts:40-67):
```typescript
export interface UtilityContext {
  requiredSkillIds: string[];
  preferredSkillIds: string[];
  preferredBusinessDomains: ResolvedBusinessDomain[];
  preferredTechnicalDomains: ResolvedTechnicalDomain[];
  alignedSkillIds: string[];
  maxBudget: number | null;
  stretchBudget: number | null;
  preferredSeniorityLevel: SeniorityLevel | null;
  preferredMaxStartTime: StartTimeline | null;
  requiredMaxStartTime: StartTimeline | null;
  preferredTimezone: string[];
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>;
}
```

**Recommended Addition Location**: The `applyDerivedSkillBoosts()` function from the plan should go in `scoring/skill-scoring.ts` to match the modular pattern.

---

### Phase 4 (continued): Search Service Integration

**Status**: EXISTS - needs integration point update

**File Location**: `recommender_api/src/services/search.service.ts`

**Integration Pattern**: The search service calls `expandSearchCriteria()` and passes results to the query builder and utility calculator. The plan's integration at "line 246" won't apply - need to find current integration points.

**Current Flow** (from investigation):
1. `expandSearchCriteria()` - Expands user requirements
2. Skill/Domain resolution - Resolves hierarchies
3. Query building - Constructs Cypher
4. Query execution - Runs against Neo4j
5. Utility calculation - Scores results
6. Response formatting - Returns ranked results

**Integration Point**: Inference should run after `expandSearchCriteria()` and before query building, OR be integrated into `expandSearchCriteria()` itself.

---

### Phase 4 (continued): API Response Updates

**Status**: Response type exists with different structure

**Current `SearchFilterResponse`** includes:
- `matches: EngineerMatch[]`
- `totalCount: number`
- `appliedFilters: AppliedFilter[]`
- `appliedPreferences: AppliedPreference[]`
- `queryMetadata: {...}`

**Required Addition**: Add `derivedConstraints` array to response:
```typescript
derivedConstraints: Array<{
  ruleName: string;
  boostField: string;
  boostValue: unknown;
  explanation: string;
  overriddenByUser: boolean;
}>;
```

---

### Phase 5: Add Comprehensive Tests

**Status**: Test infrastructure exists, inference tests need to be written

**Current Test Structure**:
- Framework: Vitest (unit/integration)
- E2E: Newman/Postman (47 scenarios, 172 assertions)
- Location: Tests alongside source files (`*.test.ts`)

**Existing Relevant Tests**:
- `constraint-expander.service.test.ts` - 11 test suites, 50+ test cases
- `utility-calculator/utility-calculator.test.ts` - 16+ test cases

**Required Test Files**:
```
services/
└── inference-engine.service.test.ts   # NEW - renamed from rule-engine.service.test.ts
```

**Test Pattern to Follow**: Current tests use Vitest with `describe`/`it`/`expect` pattern. The plan's test code is compatible.

---

### Phase 6: Documentation and API Updates

**Status**: Can proceed as planned

No structural changes needed - documentation updates are straightforward.

---

## Code References

- `recommender_api/src/types/search.types.ts` - Response types, AppliedFilter/AppliedPreference
- `recommender_api/src/types/knowledge-base.types.ts` - KnowledgeBaseConfig interface
- `recommender_api/src/config/knowledge-base/index.ts` - Config assembly point
- `recommender_api/src/services/constraint-expander.service.ts:25-72` - ExpandedSearchCriteria interface
- `recommender_api/src/services/utility-calculator/types.ts:40-67` - UtilityContext interface
- `recommender_api/src/services/search.service.ts` - Main orchestration service

## Architecture Insights

### Current Constraint-Based System

The codebase already implements a constraint-based recommender system (Section 5.2) with:

1. **Filter Conditions** (Direct Mappings): `proficiencyMapping`
2. **Compatibility Constraints** (Indirect Mappings): `seniorityMapping`, `teamFocusSkillAlignment`
3. **Defaults**: `defaultMinProficiency`, pagination defaults
4. **Utility Functions**: 12 weighted scoring dimensions

### What Project 1.5 Adds

The inference engine extends this with:

1. **Forward-Chaining Rules**: Multi-condition antecedents triggering consequents
2. **Boost Semantics**: Derived constraints affect ranking, not filtering
3. **User Override Protection**: Explicit user input blocks inference
4. **Provenance Tracking**: Explanation chains for transparency

### Integration Strategy (DECIDED)

The approved integration approach:
1. Keep inference engine as separate service (`inference-engine.service.ts`)
2. Call from within `expandSearchCriteria()` at the end - callers don't need to know about two-step process
3. Pass derived constraints through existing `appliedPreferences` pattern with new `source: 'inference'`
4. Extend utility calculator to accept derived boosts
5. Keep `derivedSkillBoosts` separate from `alignedSkillIds` (preserves provenance for UI explanations)

**Architecture**:
```
expandSearchCriteria()
├── Apply direct mappings (seniority → years, proficiency, etc.)
├── Apply compatibility constraints (team focus → aligned skills)
├── Apply defaults
└── Call runInference() from inference-engine.service.ts
    └── Return combined ExpandedSearchCriteria with derivedConstraints
```

**Naming Distinction**:
- `constraint-expander.service.ts` - One-pass knowledge base mappings (deterministic)
- `inference-engine.service.ts` - Iterative forward-chaining inference (until fixpoint)

## Summary of Required Plan Updates

### High Priority (Blocking)

1. **Rename `ExpandedConstraints` → `ExpandedSearchCriteria`** throughout Phase 4
2. **Rename `expandConstraints()` → `expandSearchCriteria()`** throughout Phase 4
3. **Update field names**: `requiredMaxSalary` → `maxBudget`, `requiredAvailability` → `requiredMaxStartTime`
4. **Remove `riskTolerance` rules** - field doesn't exist in schema (DECIDED: not needed)
5. **Rename `rule-engine.service.ts` → `inference-engine.service.ts`** (DECIDED: clearer naming)

### Medium Priority (Structural)

6. **Update config file path**: Single file → modular `config/knowledge-base/` directory
7. **Create `inference-rules.config.ts`** as new file in knowledge-base directory
8. **Update utility calculator paths**: Single file → `utility-calculator/` directory
9. **Place `applyDerivedSkillBoosts()` in `scoring/skill-scoring.ts`**

### Low Priority (Polish)

10. **Update imports** to use Zod schema re-exports
11. **Add `'inference'` to `ConstraintSource` type**
12. **Follow existing test patterns** (Vitest, co-located test files)

## Decisions Made

The following decisions were made during follow-up discussion:

### 1. Remove `riskTolerance` Rules

**Decision**: Remove all rules that depend on `riskTolerance` field.

**Rationale**: The field doesn't exist in the current schema and is no longer needed for the system's requirements.

**Rules to Remove from Plan**:
- `low-risk-prefers-experience`
- `high-risk-accepts-learning`
- `low-risk-scaling-proven`

Also remove `RiskTolerance` from the `ConstraintField` type definition.

---

### 2. Inference Engine Naming and Location

**Decision**:
- Rename `rule-engine.service.ts` → `inference-engine.service.ts`
- Keep as separate service, but call from within `expandSearchCriteria()`

**Rationale**:
- "Inference engine" is a well-defined term in knowledge-based systems (aligns with Section 5.2.1)
- Clearly distinguishes from constraint expander's one-pass mappings
- Calling from within `expandSearchCriteria()` encapsulates the two-step process from callers
- Maintains testability as a separate service

**File naming scheme**:
```
services/
├── constraint-expander.service.ts    # One-pass knowledge base mappings
└── inference-engine.service.ts       # Iterative forward-chaining inference

types/
└── inference-rule.types.ts           # Types for inference rules

config/knowledge-base/
└── inference-rules.config.ts         # Rule definitions
```

---

### 3. Derived Skills vs Aligned Skills

**Decision**: Keep `derivedSkillBoosts` separate from `alignedSkillIds`.

**Rationale**:
- Preserves provenance for UI explanations
  - "Boosted because team focus is greenfield" (alignedSkillIds)
  - "Boosted because senior + greenfield implies ownership skills" (derivedSkillBoosts)
- Inference rules have explicit `boostStrength` values (0.4-0.9) while aligned skills are uniform
- Transparency is a core design principle of the inference engine

**Implementation**:
```typescript
interface ExpandedSearchCriteria {
  // ... existing fields ...
  alignedSkillIds: string[];              // From team focus (uniform boost)
  derivedSkillBoosts: Map<string, number>; // From inference (variable strength)
}
```

---

### 4. Performance Budget

**Decision**: Remove the <10ms performance constraint.

**Rationale**: Premature optimization. Implement first, measure, optimize if needed.
