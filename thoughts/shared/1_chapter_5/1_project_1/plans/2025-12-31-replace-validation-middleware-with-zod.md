---
date: 2025-12-31T12:00:00+00:00
researcher: Claude
git_commit: b8a749f3844ca79908f80cede3878a2d4f124583
branch: chapter_5_project_1
repository: recommender_system
topic: "Replace Manual Validation Middleware with Zod"
tags: [research, codebase, validation, zod, middleware, typescript]
status: complete
last_updated: 2025-12-31
last_updated_by: Claude
---

# Plan: Replace Manual Validation Middleware with Zod

**Date**: 2025-12-31
**Git Commit**: b8a749f3844ca79908f80cede3878a2d4f124583
**Branch**: chapter_5_project_1
**Repository**: recommender_system

## Research Question

Can we replace `recommender_api/src/middleware/validate-search.middleware.ts` with Zod schemas for validation?

## Summary

**Yes, strongly recommended.** The current 334-line manual validation middleware has significant duplication between TypeScript types and runtime validation arrays. Migrating to Zod will:

1. Reduce code from ~334 lines to ~70 lines
2. Eliminate type/validation duplication (single source of truth)
3. Use industry-standard patterns for TypeScript + validation
4. Maintain backward compatibility with existing imports

---

## Current State Analysis

### Existing Validation Middleware
**File**: `recommender_api/src/middleware/validate-search.middleware.ts` (334 lines)

**Problems**:
- Repetitive manual validation for ~20+ fields
- Hardcoded enum arrays that duplicate TypeScript type definitions
- Verbose if/else chains for each field
- Custom error response format

**Current validation constants (duplicated from types)**:
```typescript
const VALID_SENIORITY_LEVELS: SeniorityLevel[] = ['junior', 'mid', 'senior', 'staff', 'principal'];
const VALID_RISK_TOLERANCES: RiskTolerance[] = ['low', 'medium', 'high'];
const VALID_TEAM_FOCUSES: TeamFocus[] = ['greenfield', 'migration', 'maintenance', 'scaling'];
const VALID_PROFICIENCY_LEVELS: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];
const VALID_AVAILABILITY_OPTIONS: AvailabilityOption[] = ['immediate', 'two_weeks', 'one_month', 'not_available'];
```

### Type Definitions
**File**: `recommender_api/src/types/search.types.ts`

Contains:
- `SearchFilterRequest` interface with ~20 optional fields
- String literal union types for all enums
- Response types (not validated on input)

**Used by**:
- `search.controller.ts` - Controller handler
- `search.service.ts` - Service layer
- `constraint-expander.service.ts` - Constraint expansion
- `knowledge-base.types.ts` - Re-uses enum types

### Dependencies
**File**: `recommender_api/package.json`

**Current state**: No validation libraries installed
- No Zod, Joi, Yup, or class-validator

### Route Usage
**File**: `recommender_api/src/routes/search.routes.ts`

```typescript
import { validateSearchRequest } from '../middleware/validate-search.middleware.js';
router.post('/filter', validateSearchRequest, filterSearch);
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Type source of truth | Zod schemas | Industry standard - types inferred via `z.infer<>` |
| Error format | Zod default | API contract change acceptable per user |
| Tests | Not required | Per user decision |

---

## Implementation Plan

### Files to Create

#### 1. `recommender_api/src/schemas/search.schema.ts`

```typescript
/**
 * Search API Schemas
 * Zod schemas are the single source of truth for both validation and types.
 */

import { z } from 'zod';

// ============================================
// ENUM SCHEMAS
// ============================================

export const SeniorityLevelSchema = z.enum([
  'junior', 'mid', 'senior', 'staff', 'principal'
]);

export const AvailabilityOptionSchema = z.enum([
  'immediate', 'two_weeks', 'one_month', 'not_available'
]);

export const RiskToleranceSchema = z.enum(['low', 'medium', 'high']);

export const ProficiencyLevelSchema = z.enum(['learning', 'proficient', 'expert']);

export const TeamFocusSchema = z.enum([
  'greenfield', 'migration', 'maintenance', 'scaling'
]);

// ============================================
// NESTED OBJECT SCHEMAS
// ============================================

export const PreferredSalaryRangeSchema = z.object({
  min: z.number().positive(),
  max: z.number().positive(),
}).refine(
  (data) => data.min <= data.max,
  { message: 'min must be less than or equal to max' }
);

// ============================================
// MAIN REQUEST SCHEMA
// ============================================

export const SearchFilterRequestSchema = z.object({
  // Seniority
  requiredSeniorityLevel: SeniorityLevelSchema.optional(),
  preferredSeniorityLevel: SeniorityLevelSchema.optional(),

  // Skills
  requiredSkills: z.array(z.string()).optional(),
  preferredSkills: z.array(z.string()).optional(),

  // Availability
  requiredAvailability: z.array(AvailabilityOptionSchema).optional(),
  preferredAvailability: z.array(AvailabilityOptionSchema).optional(),

  // Timezone
  requiredTimezone: z.string().optional(),
  preferredTimezone: z.array(z.string()).optional(),

  // Salary (hard constraints)
  requiredMaxSalary: z.number().positive().optional(),
  requiredMinSalary: z.number().positive().optional(),
  preferredSalaryRange: PreferredSalaryRangeSchema.optional(),

  // Quality metrics
  requiredRiskTolerance: RiskToleranceSchema.optional(),
  requiredMinProficiency: ProficiencyLevelSchema.optional(),
  preferredProficiency: ProficiencyLevelSchema.optional(),
  preferredConfidenceScore: z.number().min(0).max(1).optional(),

  // Context
  teamFocus: TeamFocusSchema.optional(),

  // Domains
  requiredDomains: z.array(z.string()).optional(),
  preferredDomains: z.array(z.string()).optional(),

  // Pagination
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
}).refine(
  (data) => {
    if (data.requiredMinSalary !== undefined && data.requiredMaxSalary !== undefined) {
      return data.requiredMinSalary <= data.requiredMaxSalary;
    }
    return true;
  },
  {
    message: 'requiredMinSalary must be less than or equal to requiredMaxSalary',
    path: ['requiredMinSalary'],
  }
);

// ============================================
// INFERRED TYPES
// ============================================

export type SeniorityLevel = z.infer<typeof SeniorityLevelSchema>;
export type AvailabilityOption = z.infer<typeof AvailabilityOptionSchema>;
export type RiskTolerance = z.infer<typeof RiskToleranceSchema>;
export type ProficiencyLevel = z.infer<typeof ProficiencyLevelSchema>;
export type TeamFocus = z.infer<typeof TeamFocusSchema>;
export type PreferredSalaryRange = z.infer<typeof PreferredSalaryRangeSchema>;
export type SearchFilterRequest = z.infer<typeof SearchFilterRequestSchema>;
```

#### 2. `recommender_api/src/middleware/zod-validate.middleware.ts`

```typescript
/**
 * Generic Zod Validation Middleware
 * Creates Express middleware from Zod schemas.
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Creates a validation middleware for Express using a Zod schema.
 * Uses Zod's default error format.
 */
export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Empty objects are valid (browse mode)
      const body = req.body && Object.keys(req.body).length > 0
        ? req.body
        : {};

      // Parse and replace req.body with validated/typed data
      req.body = schema.parse(body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            issues: error.issues,
            name: 'ZodError',
          },
        });
        return;
      }
      throw error;
    }
  };
}
```

---

### Files to Modify

#### 3. `recommender_api/src/types/search.types.ts`

**Change**: Remove enum/interface definitions, re-export from schemas

```typescript
/**
 * Search API Types
 * Types are now inferred from Zod schemas (single source of truth).
 */

// Re-export types from schemas
export type {
  SeniorityLevel,
  AvailabilityOption,
  RiskTolerance,
  ProficiencyLevel,
  TeamFocus,
  PreferredSalaryRange,
  SearchFilterRequest,
} from '../schemas/search.schema.js';

// Response types remain here (output, not validated input)
export type MatchType = 'direct' | 'descendant' | 'correlated' | 'none';
export type ConstraintSource = 'user' | 'knowledge_base';
// ... rest of response types unchanged
```

#### 4. `recommender_api/src/routes/search.routes.ts`

**Change**: Replace middleware import and usage

```typescript
import { Router } from 'express';
import { filterSearch } from '../controllers/search.controller.js';
import { validate } from '../middleware/zod-validate.middleware.js';
import { SearchFilterRequestSchema } from '../schemas/search.schema.js';

const router = Router();

router.post(
  '/filter',
  validate(SearchFilterRequestSchema),
  filterSearch
);

export default router;
```

#### 5. `recommender_api/package.json`

**Change**: Add zod dependency

```bash
npm install zod
```

---

### Files to Delete

#### 6. `recommender_api/src/middleware/validate-search.middleware.ts`

**Reason**: Replaced by Zod validation (334 lines no longer needed)

---

## Validation Rule Mapping

| Original Check | Zod Equivalent |
|----------------|----------------|
| `VALID_SENIORITY_LEVELS.includes(val)` | `z.enum(['junior', ...])` |
| `Array.isArray(x) && x.every(s => typeof s === 'string')` | `z.array(z.string())` |
| `typeof x === 'number' && x >= 1 && x <= 100` | `z.number().int().min(1).max(100)` |
| `typeof x === 'number' && x >= 0` | `z.number().int().min(0)` |
| `typeof x === 'number' && x > 0` | `z.number().positive()` |
| `typeof x === 'number' && x >= 0 && x <= 1` | `z.number().min(0).max(1)` |
| `min <= max` (nested) | `.refine(data => data.min <= data.max)` |
| `requiredMinSalary <= requiredMaxSalary` | Root `.refine()` |
| Empty body allowed | All fields optional (works by default) |

---

## Error Format Change

**Old format**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "limit", "message": "Must be a number between 1 and 100" }]
  }
}
```

**New format (Zod default)**:
```json
{
  "success": false,
  "error": {
    "issues": [{
      "code": "too_small",
      "minimum": 1,
      "type": "number",
      "inclusive": true,
      "message": "Number must be greater than or equal to 1",
      "path": ["limit"]
    }],
    "name": "ZodError"
  }
}
```

---

## Implementation Checklist

1. [x] `cd recommender_api && npm install zod`
2. [x] Create `src/schemas/search.schema.ts` with all schemas
3. [x] Create `src/middleware/zod-validate.middleware.ts`
4. [x] Update `src/types/search.types.ts` to re-export from schemas
5. [x] Update `src/routes/search.routes.ts` to use new middleware
6. [x] Delete `src/middleware/validate-search.middleware.ts`
7. [x] Run `npm run typecheck` to verify no type errors
8. [ ] Manual test with valid/invalid requests

---

## Code References

- `recommender_api/src/middleware/validate-search.middleware.ts:1-334` - Current validation (to delete)
- `recommender_api/src/types/search.types.ts:1-100` - Current type definitions (to update)
- `recommender_api/src/types/knowledge-base.types.ts:1-50` - Imports enum types (compatible via re-export)
- `recommender_api/src/routes/search.routes.ts:18` - Route using middleware
- `recommender_api/package.json` - Add zod dependency

---

## Architecture Insights

### Why Zod as Single Source of Truth

Most production TypeScript teams use Zod schemas as the source of truth because:

1. **No drift** - Types can't get out of sync with validation
2. **DRY** - Define enums once, reuse everywhere
3. **Recommended by Zod docs** - This is the documented approach
4. **Used by major projects** - tRPC, Next.js apps, most TypeScript backends

### Backward Compatibility

The migration maintains backward compatibility:
- Re-exporting types from `search.types.ts` means all existing imports continue to work
- `knowledge-base.types.ts` and other dependent files need no changes
- Only the route file needs to change its middleware import
