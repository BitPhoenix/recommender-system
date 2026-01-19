# Critique Naming Refactoring Implementation Plan

## Overview

Refactor the naming in the critique-generator module to use consistent, self-documenting names that accurately describe what each type represents. The core insight is that a "critique" is `property + operation + value`, but the current `CritiqueCandidate` type only represents the **value** part. Additionally, the codebase inconsistently uses "attribute" vs "property" - we'll standardize on "property" since `CritiquableProperty` is the canonical schema type.

## Current State Analysis

### The Problem

1. **`CritiqueCandidate` is misleading**: It sounds like it could be a full critique (`{ property, operation, value }`), but it's actually just a potential **property value** (e.g., "Pacific" for timezone, "senior" for seniority).

2. **Inconsistent terminology**: The schema uses `CritiquableProperty`, but the config uses `attributeKey` and exports like `SINGLE_ATTRIBUTE_CANDIDATE_CONFIGS`.

### Current Names → Proposed Names

| Current | Proposed | Rationale |
|---------|----------|-----------|
| `CritiqueCandidate` | `CritiqueAdjustmentCandidatePropertyValue` | A property value that is a candidate for becoming part of a CritiqueAdjustment |
| `CritiqueCandidateConfig` | `CritiqueAdjustmentCandidatePropertyValueConfig` | Config that generates candidate property values |
| `getCritiqueCandidates()` | `getCritiqueAdjustmentCandidatePropertyValues()` | Method returns candidate property values |
| `attributeKey` | `propertyKey` | Align with `CritiquableProperty` schema type |
| `SINGLE_ATTRIBUTE_CANDIDATE_CONFIGS` | `SINGLE_PROPERTY_CANDIDATE_CONFIGS` | Consistency with "property" terminology |
| `COMPOUND_ATTRIBUTE_PAIRS` | `COMPOUND_PROPERTY_PAIRS` | Consistency with "property" terminology |
| `CandidateContext` | `CritiqueAdjustmentCandidateContext` | Clarify what kind of candidate context |

## Desired End State

All types, interfaces, methods, and variables in the critique-generator module use consistent naming that:
1. Uses "Property" (not "Attribute") to align with the schema
2. Clearly indicates that the "candidate" is a **property value** for a **CritiqueAdjustment**
3. Is self-documenting - reading the name tells you exactly what it is

### Verification

```bash
cd recommender_api
npm run typecheck  # TypeScript compiles
npm test           # All 783 tests pass
npm run test:e2e   # All 85 E2E tests pass
```

## What We're NOT Doing

- Not changing the schema types (`CritiquableProperty`, `CritiqueAdjustment`, etc.)
- Not renaming the file `critique-candidate-config.ts` (the current name is fine)
- Not changing the individual config variable names (`timezoneCandidateConfig`, etc.) - they're clear in context
- Not changing local variables like `firstCandidate`, `secondCandidate` - clear in context

## Implementation Approach

This is a pure renaming refactoring. We'll update all names in a single phase, then verify with tests.

---

## Phase 1: Rename Types and Update All References

### Overview

Update all type names, interface names, method names, field names, and collection names in the critique-generator module and its consumers.

### Changes Required:

#### 1. critique-candidate-config.ts

**File**: `recommender_api/src/services/critique-generator/critique-candidate-config.ts`

**Changes**:
- Rename interface `CritiqueCandidate` → `CritiqueAdjustmentCandidatePropertyValue`
- Rename interface `CritiqueCandidateConfig` → `CritiqueAdjustmentCandidatePropertyValueConfig`
- Rename interface `CandidateContext` → `CritiqueAdjustmentCandidateContext`
- Rename field `attributeKey` → `propertyKey` in the config interface
- Rename method `getCritiqueCandidates()` → `getCritiqueAdjustmentCandidatePropertyValues()`
- Rename parameter `critiqueCandidate` → `candidatePropertyValue` in method signatures
- Rename constant `SINGLE_ATTRIBUTE_CANDIDATE_CONFIGS` → `SINGLE_PROPERTY_CANDIDATE_CONFIGS`
- Rename constant `COMPOUND_ATTRIBUTE_PAIRS` → `COMPOUND_PROPERTY_PAIRS`
- Update all doc comments to use "property" instead of "attribute"
- Update local variable `candidates` type annotation (line 317)
- Update all 7 config objects to use `propertyKey` instead of `attributeKey`

#### 2. single-attribute-critique-generator.ts

**File**: `recommender_api/src/services/critique-generator/single-attribute-critique-generator.ts`

**Changes**:
- Update imports to use new type names
- Update doc comment (line 5-6) to reference new config name
- Update function parameter types
- Rename local variable `critiqueCandidates` → `candidatePropertyValues` (line 56)

#### 3. compound-critique-generator.ts

**File**: `recommender_api/src/services/critique-generator/compound-critique-generator.ts`

**Changes**:
- Update imports to use new type names
- Update doc comment (line 7-8) to reference new config name
- Update function parameter types
- Rename local variables `firstCritiqueCandidates` → `firstCandidatePropertyValues` (line 70)
- Rename local variables `secondCritiqueCandidates` → `secondCandidatePropertyValues` (line 71)
- Update `formatCompoundDescription` parameter types and internal references to `propertyKey`

#### 4. dynamic-critique-generator.service.ts

**File**: `recommender_api/src/services/critique-generator/dynamic-critique-generator.service.ts`

**Changes**:
- Update import to use `CritiqueAdjustmentCandidateContext` instead of `CandidateContext`
- Update local variable type annotation (line 41)

### Success Criteria:

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck`
- [x] All unit tests pass: `npm test`
- [x] All E2E tests pass: `npm run test:e2e`

#### Manual Verification:

- [x] Review the renamed code to confirm naming is consistent and self-documenting

---

## Phase 2: Update Documentation

### Overview

Update the code walkthrough document to reflect the new naming.

### Changes Required:

#### 1. Code Walkthrough Document

**File**: `thoughts/shared/1_chapter_5/5_project_5/research/2026-01-19-project-5-critique-system-code-walkthrough.md`

**Changes**:
- Update all references to `CritiqueCandidate` → `CritiqueAdjustmentCandidatePropertyValue`
- Update all references to `CritiqueCandidateConfig` → `CritiqueAdjustmentCandidatePropertyValueConfig`
- Update all references to `CandidateContext` → `CritiqueAdjustmentCandidateContext`
- Update all references to `attributeKey` → `propertyKey`
- Update all references to `SINGLE_ATTRIBUTE_CANDIDATE_CONFIGS` → `SINGLE_PROPERTY_CANDIDATE_CONFIGS`
- Update all references to `COMPOUND_ATTRIBUTE_PAIRS` → `COMPOUND_PROPERTY_PAIRS`
- Update all references to `getCritiqueCandidates` → `getCritiqueAdjustmentCandidatePropertyValues`
- Update section 3.1 title from "Attribute Mining Configurations" to "Property Value Candidate Configurations"
- Update the Type Registries table
- Update the Key Concept explanations
- Update `last_updated` timestamp

### Success Criteria:

#### Automated Verification:

- [x] Document exists and is valid markdown

#### Manual Verification:

- [x] Document accurately reflects the new naming
- [x] No stale references to old names remain

---

## Testing Strategy

### Unit Tests:

No new tests needed - this is a pure renaming refactoring. Existing tests will verify the refactoring didn't break anything.

### Integration Tests:

The E2E tests exercise the full critique flow and will catch any broken references.

### Manual Testing Steps:

1. Read through the renamed code to verify naming is consistent
2. Spot-check the walkthrough document for accuracy

## Performance Considerations

None - this is a pure renaming refactoring with no runtime impact.

## References

- Code walkthrough to update: `thoughts/shared/1_chapter_5/5_project_5/research/2026-01-19-project-5-critique-system-code-walkthrough.md`
- Schema with canonical `CritiquableProperty` type: `recommender_api/src/schemas/critique.schema.ts`

---

## Post-Implementation

After completing this plan, update the code walkthrough document at:
`/Users/konrad/Documents/coding/software_devs/recommender_system/thoughts/shared/1_chapter_5/5_project_5/research/2026-01-19-project-5-critique-system-code-walkthrough.md`
