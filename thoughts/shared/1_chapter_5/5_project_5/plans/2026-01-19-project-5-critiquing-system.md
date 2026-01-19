# Project 5: Critiquing System Implementation Plan

## Overview

Implement a critiquing system (Section 5.3.2) that allows users to iteratively refine search results through directional adjustments ("more experience"), replacement values ("change timezone to Pacific"), and skill modifications. The system also generates dynamic critique suggestions by mining patterns from current results.

## Current State Analysis

### Existing Infrastructure (90%+ Reusable)

The codebase has substantial infrastructure from Projects 1-4 that directly supports critiquing:

| Component | Reuse Level | Purpose |
|-----------|-------------|---------|
| `search.service.ts` | Full | Core search pipeline (constraint expansion → query → score) |
| `constraint-expander.service.ts` | Full | Translates user constraints to DB filters |
| `inference-engine.service.ts` | Full | Forward-chaining rule expansion |
| `utility-calculator/` | Full | Scores results after critique |
| `tightening-generator.service.ts` | Adapt | Distribution analysis pattern for dynamic critiques |
| `tightening-tester.service.ts` | Adapt | What-if queries for critique impact |
| Zod schema patterns | Pattern | Discriminated unions, refinements |
| Type system patterns | Pattern | AppliedFilter, RelaxationSuggestion |

### What's Missing

1. **Critique types and schema** - No request/response types for critique operations
2. **Critique configuration** - No config file for tuning parameters (adjustment factors, thresholds)
3. **Critique interpreter** - No translation layer from directional adjustments to constraint modifications
4. **Dynamic critique generator** - No pattern mining for suggestion generation
5. **Critique endpoint** - No `POST /api/search/critique` route

## Desired End State

A fully functional critiquing endpoint that:

1. Accepts a base search plus one or more adjustments
2. Translates adjustments into modified SearchFilterRequest
3. Executes the modified search through existing pipeline
4. Generates dynamic critique suggestions (Section 5.3.2.3)
5. Returns results with full transparency (what changed, why)

### Verification Criteria

- `npm run typecheck` passes
- `npm test` passes (unit tests for critique interpreter, generator)
- `npm run test:e2e` passes (new E2E tests for critique endpoint)
- Manual testing: critique endpoint accepts requests and returns expected results

## What We're NOT Doing

- **Session persistence**: Client tracks history, no server-side sessions (stateless design)
- **LLM explanations for critiques**: Reuse existing explanation infrastructure if needed
- **UI components**: API-only implementation

---

## Implementation Approach

### Core Insight

Critiques are fundamentally **constraint modifications**. The textbook presents critiquing as a distinct paradigm, but in our implementation:

1. User provides adjustment (e.g., "more experience")
2. Interpreter translates to constraint change (e.g., `requiredSeniorityLevel: 'mid' → 'senior'`)
3. Modified request goes through existing search pipeline
4. Results scored and returned with critique metadata

### Architecture

```
POST /api/search/critique
       │
       ▼
┌────────────────────────────────────────────────────┐
│              critique.service.ts                    │
│                                                     │
│  1. Validate request (Zod schema)                   │
│  2. Parse baseSearch                                │
│  3. Apply critique adjustments                      │
│     └─ critique-interpreter.service.ts             │
│  4. Execute modified search                         │
│     └─ REUSE: search.service.ts executeSearch()    │
│  5. Generate dynamic critique suggestions           │
│     └─ dynamic-critique-generator.service.ts       │
│  6. Get constraint advice (if sparse/many)          │
│     └─ REUSE: constraint-advisor.service.ts        │
│  7. Assemble response                               │
│                                                     │
└────────────────────────────────────────────────────┘
       │
       ▼
CritiqueResponse
```

---

## Phase 1: Types and Schema

### Overview

Define the type system for critique requests and responses following existing patterns.

### Changes Required

#### 1. Critique Schema
**File**: `recommender_api/src/schemas/critique.schema.ts` (NEW)

```typescript
/**
 * Critique API Schema (Section 5.3.2)
 *
 * A unified adjustments[] array handles both simple (1 item) and compound (2+ items) critiques.
 *
 * Mental model: Every adjustment is { property, operation, direction?, value?, item? }
 * - property: WHAT we're targeting
 * - operation: WHAT we're doing (adjust, set, add, remove)
 * - direction: HOW to adjust (for 'adjust' operation)
 * - value: the new value (for 'set', 'add' operations)
 * - item: which item to target (for 'remove', or 'adjust' on collection items)
 */

import { z } from 'zod';
import {
  SeniorityLevelSchema,
  StartTimelineSchema,
  USTimezoneZoneSchema,
  ProficiencyLevelSchema,
  SearchFilterRequestSchema,
  PaginationSchema,
} from './search.schema.js';

// ============================================
// CRITIQUE PROPERTY & OPERATION SCHEMAS
// ============================================

/**
 * Properties that can be critiqued.
 * These map to fields in SearchFilterRequest.
 */
export const CritiquablePropertySchema = z.enum([
  'seniority',         // → requiredSeniorityLevel
  'budget',            // → maxBudget
  'timeline',          // → requiredMaxStartTime
  'timezone',          // → requiredTimezone
  'skills',            // → requiredSkills
  'businessDomains',   // → requiredBusinessDomains
  'technicalDomains',  // → requiredTechnicalDomains
]);

export type CritiquableProperty = z.infer<typeof CritiquablePropertySchema>;

/**
 * Operations that can be performed on a property.
 */
export const CritiqueOperationSchema = z.enum([
  'adjust',  // Directional change (requires direction)
  'set',     // Replace with specific value (requires value)
  'add',     // Add to collection (requires value)
  'remove',  // Remove from collection (requires item)
]);

export type CritiqueOperation = z.infer<typeof CritiqueOperationSchema>;

/**
 * Direction words for 'adjust' operations.
 * Semantic meaning depends on property:
 * - seniority: more = senior+, less = junior-
 * - budget: more = higher, less = lower
 * - timeline: sooner = faster, later = slower
 * - timezone: narrower = fewer zones, wider = more zones
 * - skills (with item): more = strengthen proficiency, less = weaken proficiency
 */
export const DirectionSchema = z.enum([
  'more',     // seniority↑, budget↑, skill proficiency↑
  'less',     // seniority↓, budget↓, skill proficiency↓
  'sooner',   // timeline↑ (faster availability)
  'later',    // timeline↓ (slower availability)
  'narrower', // timezone↓ (fewer zones)
  'wider',    // timezone↑ (more zones)
]);

export type Direction = z.infer<typeof DirectionSchema>;

// ============================================
// VALUE SCHEMAS FOR 'set' AND 'add' OPERATIONS
// ============================================

export const SkillValueSchema = z.object({
  skill: z.string(),
  proficiency: ProficiencyLevelSchema.optional(),
});

export type SkillValue = z.infer<typeof SkillValueSchema>;

export const DomainValueSchema = z.object({
  domain: z.string(),
  minYears: z.number().int().min(0).optional(),
});

export type DomainValue = z.infer<typeof DomainValueSchema>;

// ============================================
// CRITIQUE ADJUSTMENT SCHEMAS (Base + Extensions)
// ============================================

/**
 * Base schema with the common field shared by all operations.
 */
const CritiqueAdjustmentBaseSchema = z.object({
  property: CritiquablePropertySchema,
});

/**
 * Valid directions per property (used for validation).
 */
const propertyToValidDirections: Record<string, readonly string[]> = {
  seniority: ['more', 'less'],
  budget: ['more', 'less'],
  timeline: ['sooner', 'later'],
  timezone: ['narrower', 'wider'],
  skills: ['more', 'less'],
  businessDomains: ['more', 'less'],
  technicalDomains: ['more', 'less'],
} as const;

/**
 * Adjust operation: directional changes (more/less, sooner/later, etc.)
 *
 * Examples:
 * - More experience: { property: 'seniority', operation: 'adjust', direction: 'more' }
 * - Sooner timeline: { property: 'timeline', operation: 'adjust', direction: 'sooner' }
 * - Strengthen Python: { property: 'skills', operation: 'adjust', direction: 'more', item: 'Python' }
 */
const AdjustOperationSchema = CritiqueAdjustmentBaseSchema.extend({
  operation: z.literal('adjust'),
  direction: DirectionSchema,
  item: z.string().optional(),  // Required for collection properties (skills, domains)
}).refine(
  (data) => {
    const valid = propertyToValidDirections[data.property] ?? [];
    return valid.includes(data.direction);
  },
  (data) => ({
    message: `Invalid direction '${data.direction}' for property '${data.property}'. Valid: ${(propertyToValidDirections[data.property] ?? []).join(', ')}`,
    path: ['direction'],
  })
).refine(
  (data) => {
    // Collections require 'item' to specify what to adjust
    const isCollection = ['skills', 'businessDomains', 'technicalDomains'].includes(data.property);
    return !isCollection || data.item !== undefined;
  },
  (data) => ({
    message: `'adjust' on '${data.property}' requires 'item' to specify which item to adjust`,
    path: ['item'],
  })
);

/**
 * Set operation: replace with a specific value.
 *
 * Examples:
 * - Set to senior: { property: 'seniority', operation: 'set', value: 'senior' }
 * - Set budget: { property: 'budget', operation: 'set', value: 150000 }
 * - Set timezone: { property: 'timezone', operation: 'set', value: ['Eastern', 'Central'] }
 */
const SetOperationSchema = CritiqueAdjustmentBaseSchema.extend({
  operation: z.literal('set'),
  value: z.union([
    SeniorityLevelSchema,           // seniority
    z.number().positive(),          // budget
    StartTimelineSchema,            // timeline
    z.array(USTimezoneZoneSchema),  // timezone array
    USTimezoneZoneSchema,           // single timezone (convenience)
    SkillValueSchema,               // single skill (replaces all - rare)
    DomainValueSchema,              // single domain (replaces all - rare)
  ]),
});

/**
 * Add operation: add to a collection property.
 *
 * Examples:
 * - Add Python: { property: 'skills', operation: 'add', value: { skill: 'Python', proficiency: 'proficient' } }
 * - Add FinTech domain: { property: 'businessDomains', operation: 'add', value: { domain: 'FinTech', minYears: 2 } }
 */
const AddOperationSchema = CritiqueAdjustmentBaseSchema.extend({
  operation: z.literal('add'),
  value: z.union([SkillValueSchema, DomainValueSchema]),
}).refine(
  (data) => ['skills', 'businessDomains', 'technicalDomains'].includes(data.property),
  {
    message: "'add' operation only valid for collection properties (skills, businessDomains, technicalDomains)",
    path: ['property'],
  }
);

/**
 * Remove operation: remove from a collection property.
 *
 * Examples:
 * - Remove React: { property: 'skills', operation: 'remove', item: 'React' }
 * - Remove FinTech: { property: 'businessDomains', operation: 'remove', item: 'FinTech' }
 */
const RemoveOperationSchema = CritiqueAdjustmentBaseSchema.extend({
  operation: z.literal('remove'),
  item: z.string().min(1),
}).refine(
  (data) => ['skills', 'businessDomains', 'technicalDomains'].includes(data.property),
  {
    message: "'remove' operation only valid for collection properties (skills, businessDomains, technicalDomains)",
    path: ['property'],
  }
);

/**
 * Combined critique adjustment schema using discriminated union.
 * Discriminates on 'operation' field for type-safe handling.
 */
export const CritiqueAdjustmentSchema = z.discriminatedUnion('operation', [
  AdjustOperationSchema,
  SetOperationSchema,
  AddOperationSchema,
  RemoveOperationSchema,
]);

export type CritiqueAdjustment = z.infer<typeof CritiqueAdjustmentSchema>;

// Export individual operation types for precise typing in handlers
export type AdjustOperation = z.infer<typeof AdjustOperationSchema>;
export type SetOperation = z.infer<typeof SetOperationSchema>;
export type AddOperation = z.infer<typeof AddOperationSchema>;
export type RemoveOperation = z.infer<typeof RemoveOperationSchema>;

// ============================================
// MAIN REQUEST SCHEMA
// ============================================

export const CritiqueRequestSchema = z.object({
  /**
   * The base search to critique.
   * This is the full SearchFilterRequest from the previous search.
   */
  baseSearch: SearchFilterRequestSchema,

  /**
   * Adjustments to apply. Array length determines critique type:
   * - 1 item = simple critique (5.3.2.1)
   * - 2+ items = compound critique (5.3.2.2)
   */
  adjustments: z.array(CritiqueAdjustmentSchema).min(1, 'At least one adjustment is required'),
}).merge(PaginationSchema);

export type CritiqueRequest = z.infer<typeof CritiqueRequestSchema>;
```

#### 2. Critique Types
**File**: `recommender_api/src/types/critique.types.ts` (NEW)

```typescript
/**
 * Critique API Types (Section 5.3.2)
 *
 * Implements conversational refinement of search results through
 * directional, replacement, and skill-based critiques.
 */

import type {
  EngineerMatch,
  AppliedFilter,
  AppliedPreference,
  DerivedConstraintInfo,
  RelaxationResult,
  TighteningResult,
} from './search.types.js';

// Re-export schema types
export type {
  CritiquableProperty,
  CritiqueOperation,
  Direction,
  SkillValue,
  DomainValue,
  CritiqueAdjustment,
  CritiqueRequest,
  // Individual operation types for type-safe handling
  AdjustOperation,
  SetOperation,
  AddOperation,
  RemoveOperation,
} from '../schemas/critique.schema.js';

// Export local types
export type { AppliedCritiqueAdjustment, FailedCritiqueAdjustment };

// ============================================
// APPLIED CRITIQUE TYPES
// ============================================

/**
 * Records what adjustment was actually applied.
 * Combines the request fields with the result for a flat, readable structure.
 */
export interface AppliedCritiqueAdjustment {
  // What was requested
  property: string;
  operation: string;
  direction?: string;
  value?: unknown;
  item?: string;

  // What happened
  /** The field that was modified in the base search (e.g., 'requiredSeniorityLevel') */
  modifiedField: string;
  /** The previous value (from baseSearch) */
  previousValue: unknown;
  /** The new value (after critique) */
  newValue: unknown;
  /** Warning if critique was applied but hit a boundary (e.g., already at maximum) */
  warning?: string;
}

/**
 * Records an adjustment that could not be applied.
 * Separated from AppliedCritiqueAdjustment for semantic clarity.
 */
export interface FailedCritiqueAdjustment {
  // What was requested
  property: string;
  operation: string;
  direction?: string;
  value?: unknown;
  item?: string;

  // Why it failed
  /** The field that would have been modified */
  targetField: string;
  /** Reason the adjustment couldn't be applied */
  reason: string;
}

// ============================================
// DYNAMIC CRITIQUE SUGGESTION TYPES
// ============================================

/**
 * A dynamic critique suggestion mined from current results.
 * Ordered by ascending support (low-support patterns first per Section 5.3.2.3).
 *
 * Uses the same unified adjustment structure as CritiqueAdjustment.
 */
export interface DynamicCritiqueSuggestion {
  /** The suggested critique adjustments (uses unified structure) */
  adjustments: Array<{
    property: string;
    operation: string;
    direction?: string;
    value?: unknown;
    item?: string;
  }>;
  /** Human-readable description */
  description: string;
  /** How many results this yields */
  resultingMatches: number;
  /** What percentage of current results have this pattern (0-1) */
  support: number;
  /** Rationale for why this suggestion is useful */
  rationale: string;
}

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Critique metadata - what was changed and the impact.
 */
export interface CritiqueMetadata {
  /** Adjustments that were successfully applied */
  appliedCritiqueAdjustments: AppliedCritiqueAdjustment[];
  /** Adjustments that could not be applied (e.g., no budget to adjust) */
  failedCritiqueAdjustments: FailedCritiqueAdjustment[];
  /** Result count before critique */
  previousResultCount: number;
  /** Change in result count (+/-) */
  resultCountChange: number;
}

/**
 * Query metadata for critique operations.
 */
export interface CritiqueQueryMetadata {
  executionTimeMs: number;
  skillsExpanded: string[];
  defaultsApplied: string[];
  unresolvedSkills: string[];
}

/**
 * Full critique response.
 */
export interface CritiqueResponse {
  /** Results after applying critique */
  matches: EngineerMatch[];
  totalCount: number;

  /** What was applied (transparency) */
  appliedFilters: AppliedFilter[];
  appliedPreferences: AppliedPreference[];
  derivedConstraints: DerivedConstraintInfo[];

  /** Critique-specific metadata */
  critique: CritiqueMetadata;

  /** Dynamic critique suggestions (Section 5.3.2.3) */
  suggestedCritiques?: DynamicCritiqueSuggestion[];

  /** Constraint advice (reuse existing) */
  relaxation?: RelaxationResult;
  tightening?: TighteningResult;

  queryMetadata: CritiqueQueryMetadata;
}
```

### Success Criteria

#### Automated Verification:
- [x] `npm run typecheck` passes with new types
- [ ] Schema validates test requests correctly (unit test)

#### Manual Verification:
- [ ] Types follow existing discriminated union patterns
- [ ] Schema is aligned with research document design

---

## Phase 2: Critique Interpreter Service

### Overview

Build the translation layer that converts critique adjustments into modified SearchFilterRequest. The interpreter leverages the discriminated union on `operation` for type-safe handling, then dispatches by `property`.

### Changes Required

#### 1. Critique Configuration
**File**: `recommender_api/src/config/knowledge-base/critique.config.ts` (NEW)

```typescript
/**
 * Critique Configuration
 *
 * Tuning parameters for critique adjustments.
 * Extracted here for visibility and easy modification.
 */

export const critiqueConfig = {
  /**
   * Budget adjustment settings
   */
  budget: {
    /** Percentage change per directional adjustment (0.20 = 20%) */
    adjustmentFactor: 0.20,
    /** Minimum allowed budget value */
    floorValue: 30_000,
  },

  /**
   * Dynamic critique generation settings
   */
  dynamicCritiques: {
    /** Minimum support threshold for suggestions (0.15 = 15%) */
    minSupportThreshold: 0.15,
    /** Maximum number of suggestions to return */
    maxSuggestions: 5,
  },
} as const;

export type CritiqueConfig = typeof critiqueConfig;
```

#### 2. Critique Interpreter Service
**File**: `recommender_api/src/services/critique-interpreter.service.ts` (NEW)

```typescript
/**
 * Critique Interpreter Service
 *
 * Translates CritiqueAdjustment[] into modified SearchFilterRequest.
 * Leverages the discriminated union on 'operation' for type-safe handling.
 *
 * Section 5.3.2.1 (Simple Critiques): Single adjustment
 * Section 5.3.2.2 (Compound Critiques): Multiple adjustments
 */

import type { SearchFilterRequest, SkillRequirement } from '../types/search.types.js';
import type {
  CritiqueAdjustment,
  AppliedCritiqueAdjustment,
  FailedCritiqueAdjustment,
  AdjustOperation,
  SetOperation,
  AddOperation,
  RemoveOperation,
  SkillValue,
  DomainValue,
} from '../types/critique.types.js';
import {
  SENIORITY_LEVEL_ORDER,
  PROFICIENCY_LEVEL_ORDER,
  START_TIMELINE_ORDER,
} from '../schemas/search.schema.js';
import { US_TIMEZONE_ZONE_ORDER } from '../schemas/search.schema.js';
import { critiqueConfig } from '../config/knowledge-base/critique.config.js';

/**
 * Result of interpreting critique adjustments.
 */
export interface InterpretedCritiques {
  searchCriteria: SearchFilterRequest;
  appliedCritiqueAdjustments: AppliedCritiqueAdjustment[];
  failedCritiqueAdjustments: FailedCritiqueAdjustment[];
}

/**
 * Interpret critique adjustments and apply them to search criteria.
 *
 * Takes user-facing adjustments (e.g., "more experience") and translates
 * them into concrete changes to the SearchFilterRequest.
 */
export function applyAdjustmentsToSearchCriteria(
  baseCriteria: SearchFilterRequest,
  adjustments: CritiqueAdjustment[]
): InterpretedCritiques {
  let searchCriteria = { ...baseCriteria };
  const appliedCritiqueAdjustments: AppliedCritiqueAdjustment[] = [];
  const failedCritiqueAdjustments: FailedCritiqueAdjustment[] = [];

  for (const adjustment of adjustments) {
    const result = applyAdjustmentToSearchCriteria(searchCriteria, adjustment);
    if (result.type === 'applied') {
      searchCriteria = result.searchCriteria;
      appliedCritiqueAdjustments.push(result.applied);
    } else {
      failedCritiqueAdjustments.push(result.failed);
    }
  }

  return { searchCriteria, appliedCritiqueAdjustments, failedCritiqueAdjustments };
}

/** Result type for individual adjustment application */
type AdjustmentResult =
  | { type: 'applied'; searchCriteria: SearchFilterRequest; applied: AppliedCritiqueAdjustment }
  | { type: 'failed'; failed: FailedCritiqueAdjustment };

/**
 * Apply a single adjustment to search criteria.
 *
 * Dispatches by property, then uses TypeScript's discriminated union
 * narrowing on 'operation' within each handler for type-safe access
 * to operation-specific fields (direction, value, item).
 */
function applyAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment
): AdjustmentResult {
  switch (adjustment.property) {
    case 'seniority':
      return applySeniorityAdjustmentToSearchCriteria(searchCriteria, adjustment);
    case 'budget':
      return applyBudgetAdjustmentToSearchCriteria(searchCriteria, adjustment);
    case 'timeline':
      return applyTimelineAdjustmentToSearchCriteria(searchCriteria, adjustment);
    case 'timezone':
      return applyTimezoneAdjustmentToSearchCriteria(searchCriteria, adjustment);
    case 'skills':
      return applySkillsAdjustmentToSearchCriteria(searchCriteria, adjustment);
    case 'businessDomains':
      return applyDomainAdjustmentToSearchCriteria(searchCriteria, adjustment, 'business');
    case 'technicalDomains':
      return applyDomainAdjustmentToSearchCriteria(searchCriteria, adjustment, 'technical');
  }
}

// ============================================
// PROPERTY HANDLERS
// ============================================

function applySeniorityAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment
): AdjustmentResult {
  const currentLevel = searchCriteria.requiredSeniorityLevel;
  const currentIndex = currentLevel ? SENIORITY_LEVEL_ORDER.indexOf(currentLevel) : -1;
  let newLevel: typeof currentLevel;
  let warning: string | undefined;

  /*
   * Type narrowing via discriminated union:
   * When adjustment.operation === 'set', TypeScript knows adjustment is SetOperation,
   * so adjustment.value is guaranteed to exist and is typed.
   * When adjustment.operation === 'adjust', TypeScript knows adjustment is AdjustOperation,
   * so adjustment.direction is guaranteed to exist.
   */
  switch (adjustment.operation) {
    case 'set':
      // adjustment is narrowed to SetOperation, adjustment.value is required
      newLevel = adjustment.value as typeof currentLevel;
      break;

    case 'adjust': {
      // adjustment is narrowed to AdjustOperation, adjustment.direction is required
      let newIndex: number;
      if (adjustment.direction === 'more') {
        newIndex = Math.min(currentIndex + 1, SENIORITY_LEVEL_ORDER.length - 1);
        if (currentIndex === SENIORITY_LEVEL_ORDER.length - 1) {
          warning = 'Already at maximum seniority (principal)';
        }
      } else {
        newIndex = Math.max(currentIndex - 1, 0);
        if (currentIndex <= 0) {
          warning = 'Already at minimum seniority (junior)';
        }
      }
      newLevel = SENIORITY_LEVEL_ORDER[Math.max(0, newIndex)] as typeof currentLevel;
      break;
    }

    default:
      // 'add' and 'remove' not valid for seniority (enforced by schema)
      throw new Error(`Invalid operation '${(adjustment as CritiqueAdjustment).operation}' for seniority`);
  }

  return {
    type: 'applied',
    searchCriteria: { ...searchCriteria, requiredSeniorityLevel: newLevel },
    applied: {
      property: adjustment.property,
      operation: adjustment.operation,
      direction: adjustment.operation === 'adjust' ? adjustment.direction : undefined,
      value: adjustment.operation === 'set' ? adjustment.value : undefined,
      modifiedField: 'requiredSeniorityLevel',
      previousValue: currentLevel ?? null,
      newValue: newLevel,
      warning,
    },
  };
}

function applyBudgetAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment
): AdjustmentResult {
  const currentBudget = searchCriteria.maxBudget;
  let newBudget: number | undefined;
  let warning: string | undefined;

  if (adjustment.operation === 'set') {
    newBudget = adjustment.value as number;
  } else if (adjustment.operation === 'adjust') {
    if (!currentBudget) {
      // Cannot adjust a budget that doesn't exist - this is a failed adjustment
      return {
        type: 'failed',
        failed: {
          property: 'budget',
          operation: 'adjust',
          direction: adjustment.direction,
          targetField: 'maxBudget',
          reason: 'No budget constraint set - cannot adjust a non-existent value',
        },
      };
    }
    const { adjustmentFactor, floorValue } = critiqueConfig.budget;
    if (adjustment.direction === 'more') {
      newBudget = Math.round(currentBudget * (1 + adjustmentFactor));
    } else {
      newBudget = Math.round(currentBudget * (1 - adjustmentFactor));
      if (newBudget < floorValue) {
        newBudget = floorValue;
        warning = `Budget floor reached ($${floorValue.toLocaleString()})`;
      }
    }
  } else {
    throw new Error(`Invalid operation '${adjustment.operation}' for budget`);
  }

  return {
    type: 'applied',
    searchCriteria: { ...searchCriteria, maxBudget: newBudget },
    applied: {
      property: 'budget',
      operation: adjustment.operation,
      direction: adjustment.operation === 'adjust' ? adjustment.direction : undefined,
      value: adjustment.operation === 'set' ? adjustment.value : undefined,
      modifiedField: 'maxBudget',
      previousValue: currentBudget ?? null,
      newValue: newBudget,
      warning,
    },
  };
}

function applyTimelineAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment
): AdjustmentResult {
  const currentTimeline = searchCriteria.requiredMaxStartTime;
  const currentIndex = currentTimeline
    ? START_TIMELINE_ORDER.indexOf(currentTimeline)
    : START_TIMELINE_ORDER.length - 1;
  let newTimeline: typeof currentTimeline;
  let warning: string | undefined;

  if (adjustment.operation === 'set') {
    newTimeline = adjustment.value as typeof currentTimeline;
  } else if (adjustment.operation === 'adjust') {
    let newIndex: number;
    if (adjustment.direction === 'sooner') {
      newIndex = Math.max(currentIndex - 1, 0);
      if (currentIndex === 0) warning = 'Already at fastest timeline (immediate)';
    } else {
      newIndex = Math.min(currentIndex + 1, START_TIMELINE_ORDER.length - 1);
      if (currentIndex === START_TIMELINE_ORDER.length - 1) warning = 'Already at slowest timeline';
    }
    newTimeline = START_TIMELINE_ORDER[newIndex] as typeof currentTimeline;
  } else {
    throw new Error(`Invalid operation '${adjustment.operation}' for timeline`);
  }

  return {
    type: 'applied',
    searchCriteria: { ...searchCriteria, requiredMaxStartTime: newTimeline },
    applied: {
      property: 'timeline',
      operation: adjustment.operation,
      direction: adjustment.operation === 'adjust' ? adjustment.direction : undefined,
      value: adjustment.operation === 'set' ? adjustment.value : undefined,
      modifiedField: 'requiredMaxStartTime',
      previousValue: currentTimeline ?? null,
      newValue: newTimeline,
      warning,
    },
  };
}

function applyTimezoneAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment
): AdjustmentResult {
  const currentTimezones = searchCriteria.requiredTimezone ?? [];
  let newTimezones: typeof searchCriteria.requiredTimezone;
  let warning: string | undefined;

  if (adjustment.operation === 'set') {
    const value = adjustment.value;
    newTimezones = Array.isArray(value) ? value as typeof newTimezones : [value as string] as typeof newTimezones;
  } else if (adjustment.operation === 'adjust') {
    if (adjustment.direction === 'narrower') {
      if (currentTimezones.length === 0) {
        // Cannot narrow a non-existent constraint
        return {
          type: 'failed',
          failed: {
            property: 'timezone',
            operation: 'adjust',
            direction: adjustment.direction,
            targetField: 'requiredTimezone',
            reason: 'No timezone constraint set - cannot narrow a non-existent constraint',
          },
        };
      } else if (currentTimezones.length === 1) {
        warning = 'Already at single timezone';
        newTimezones = [...currentTimezones];
      } else {
        // Remove outermost timezones
        const timezoneIndices = currentTimezones
          .map(timezone => US_TIMEZONE_ZONE_ORDER.indexOf(timezone))
          .sort((a, b) => a - b);
        const middleIndices = timezoneIndices.slice(1, -1);
        newTimezones = middleIndices.length > 0
          ? middleIndices.map(index => US_TIMEZONE_ZONE_ORDER[index]) as typeof newTimezones
          : [US_TIMEZONE_ZONE_ORDER[timezoneIndices[0]]] as typeof newTimezones;
      }
    } else {  // wider
      if (currentTimezones.length === 0) {
        // Cannot widen a non-existent constraint
        return {
          type: 'failed',
          failed: {
            property: 'timezone',
            operation: 'adjust',
            direction: adjustment.direction,
            targetField: 'requiredTimezone',
            reason: 'No timezone constraint set - cannot widen a non-existent constraint',
          },
        };
      } else if (currentTimezones.length >= US_TIMEZONE_ZONE_ORDER.length) {
        warning = 'Already includes all timezones';
        newTimezones = [...currentTimezones];
      } else {
        const timezoneIndices = currentTimezones.map(timezone => US_TIMEZONE_ZONE_ORDER.indexOf(timezone));
        const expandedIndices = new Set(timezoneIndices);
        const minIndex = Math.min(...timezoneIndices);
        const maxIndex = Math.max(...timezoneIndices);
        if (minIndex > 0) expandedIndices.add(minIndex - 1);
        if (maxIndex < US_TIMEZONE_ZONE_ORDER.length - 1) expandedIndices.add(maxIndex + 1);
        newTimezones = Array.from(expandedIndices)
          .sort((a, b) => a - b)
          .map(index => US_TIMEZONE_ZONE_ORDER[index]) as typeof newTimezones;
      }
    }
  } else {
    throw new Error(`Invalid operation '${adjustment.operation}' for timezone`);
  }

  return {
    type: 'applied',
    searchCriteria: { ...searchCriteria, requiredTimezone: newTimezones },
    applied: {
      property: 'timezone',
      operation: adjustment.operation,
      direction: adjustment.operation === 'adjust' ? adjustment.direction : undefined,
      value: adjustment.operation === 'set' ? adjustment.value : undefined,
      modifiedField: 'requiredTimezone',
      previousValue: currentTimezones.length > 0 ? currentTimezones : null,
      newValue: newTimezones ?? null,
      warning,
    },
  };
}

function applySkillsAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment
): AdjustmentResult {
  const currentSkills = searchCriteria.requiredSkills ?? [];
  let newSkills = [...currentSkills];
  let warning: string | undefined;

  if (adjustment.operation === 'add') {
    const skillVal = adjustment.value as SkillValue;
    const existingIdx = currentSkills.findIndex(s => s.skill === skillVal.skill);
    if (existingIdx >= 0) {
      warning = `Skill "${skillVal.skill}" already required - updating proficiency`;
      newSkills[existingIdx] = { ...newSkills[existingIdx], minProficiency: skillVal.proficiency ?? 'learning' };
    } else {
      newSkills.push({ skill: skillVal.skill, minProficiency: skillVal.proficiency ?? 'learning' });
    }
  } else if (adjustment.operation === 'remove') {
    const skillName = adjustment.item!;
    const existingIdx = currentSkills.findIndex(s => s.skill === skillName);
    if (existingIdx < 0) {
      // Cannot remove a skill that isn't in requirements
      return {
        type: 'failed',
        failed: {
          property: 'skills',
          operation: 'remove',
          item: skillName,
          targetField: 'requiredSkills',
          reason: `Skill "${skillName}" not in requirements - cannot remove`,
        },
      };
    }
    newSkills = newSkills.filter((_, i) => i !== existingIdx);
  } else if (adjustment.operation === 'adjust') {
    // Adjust proficiency of specific skill (strengthen/weaken)
    const skillName = adjustment.item!;
    const existingIdx = currentSkills.findIndex(s => s.skill === skillName);
    if (existingIdx < 0) {
      warning = `Skill "${skillName}" not in requirements - adding it`;
      newSkills.push({ skill: skillName, minProficiency: adjustment.direction === 'more' ? 'proficient' : 'learning' });
    } else {
      const currentProf = currentSkills[existingIdx].minProficiency ?? 'learning';
      const currentProfIdx = PROFICIENCY_LEVEL_ORDER.indexOf(currentProf);
      let newProfIdx: number;
      if (adjustment.direction === 'more') {
        newProfIdx = Math.min(currentProfIdx + 1, PROFICIENCY_LEVEL_ORDER.length - 1);
        if (currentProfIdx === PROFICIENCY_LEVEL_ORDER.length - 1) warning = `Skill "${skillName}" already at expert`;
      } else {
        newProfIdx = Math.max(currentProfIdx - 1, 0);
        if (currentProfIdx === 0) warning = `Skill "${skillName}" already at learning`;
      }
      newSkills[existingIdx] = { ...newSkills[existingIdx], minProficiency: PROFICIENCY_LEVEL_ORDER[newProfIdx] };
    }
  } else if (adjustment.operation === 'set') {
    // Replace entire skills array (rare but supported)
    const skillVal = adjustment.value as SkillValue;
    newSkills = [{ skill: skillVal.skill, minProficiency: skillVal.proficiency ?? 'learning' }];
  }

  return {
    type: 'applied',
    searchCriteria: { ...searchCriteria, requiredSkills: newSkills.length > 0 ? newSkills : undefined },
    applied: {
      property: 'skills',
      operation: adjustment.operation,
      direction: adjustment.operation === 'adjust' ? adjustment.direction : undefined,
      value: adjustment.operation === 'add' || adjustment.operation === 'set' ? adjustment.value : undefined,
      item: adjustment.operation === 'remove' || adjustment.operation === 'adjust' ? adjustment.item : undefined,
      modifiedField: 'requiredSkills',
      previousValue: currentSkills.length > 0 ? currentSkills : null,
      newValue: newSkills.length > 0 ? newSkills : null,
      warning,
    },
  };
}

function applyDomainAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment,
  domainType: 'business' | 'technical'
): AdjustmentResult {
  const fieldName = domainType === 'business' ? 'requiredBusinessDomains' : 'requiredTechnicalDomains';
  const currentDomains = domainType === 'business'
    ? (searchCriteria.requiredBusinessDomains ?? [])
    : (searchCriteria.requiredTechnicalDomains ?? []);
  let newDomains = [...currentDomains];
  let warning: string | undefined;

  if (adjustment.operation === 'add') {
    const domainVal = adjustment.value as DomainValue;
    const existingIdx = currentDomains.findIndex(d => d.domain === domainVal.domain);
    if (existingIdx >= 0) {
      warning = `Domain "${domainVal.domain}" already required - updating minYears`;
      newDomains[existingIdx] = { ...newDomains[existingIdx], minYears: domainVal.minYears };
    } else {
      newDomains.push({ domain: domainVal.domain, minYears: domainVal.minYears });
    }
  } else if (adjustment.operation === 'remove') {
    const domainName = adjustment.item!;
    const existingIdx = currentDomains.findIndex(d => d.domain === domainName);
    if (existingIdx < 0) {
      // Cannot remove a domain that isn't in requirements
      return {
        type: 'failed',
        failed: {
          property: adjustment.property,
          operation: 'remove',
          item: domainName,
          targetField: fieldName,
          reason: `Domain "${domainName}" not in requirements - cannot remove`,
        },
      };
    }
    newDomains = newDomains.filter((_, i) => i !== existingIdx);
  } else {
    throw new Error(`Invalid operation '${adjustment.operation}' for ${domainType}Domains`);
  }

  const updatedCriteria = domainType === 'business'
    ? { ...searchCriteria, requiredBusinessDomains: newDomains.length > 0 ? newDomains : undefined }
    : { ...searchCriteria, requiredTechnicalDomains: newDomains.length > 0 ? newDomains : undefined };

  return {
    type: 'applied',
    searchCriteria: updatedCriteria,
    applied: {
      property: adjustment.property,
      operation: adjustment.operation,
      value: adjustment.operation === 'add' ? adjustment.value : undefined,
      item: adjustment.operation === 'remove' ? adjustment.item : undefined,
      modifiedField: fieldName,
      previousValue: currentDomains.length > 0 ? currentDomains : null,
      newValue: newDomains.length > 0 ? newDomains : null,
      warning,
    },
  };
}
```

### Success Criteria

#### Automated Verification:
- [x] `npm run typecheck` passes
- [ ] Unit tests for all property handlers (seniority, budget, timeline, timezone, skills, domains)
- [ ] Unit tests for all operations (adjust, set, add, remove)
- [ ] Edge case tests (already at max/min, missing fields, etc.)

#### Manual Verification:
- [ ] Interpreter correctly modifies base search for all adjustment types

---

## Phase 3: Dynamic Critique Generator

### Overview

Build the pattern mining service that analyzes current results and suggests useful critiques (Section 5.3.2.3). This includes both **single-attribute patterns** (e.g., "Add Python") and **compound patterns** (e.g., "Senior + Pacific timezone") per the textbook's definition that dynamic critiques are "by definition" compound.

### Algorithm Design Rationale

The algorithm is **support-based frequent pattern mining** adapted for critique suggestion—a simplified Apriori-style approach tailored for critiquing:

1. **Support calculation**: `support = count(matches with pattern) / total_matches`
2. **Minimum support threshold** (15%): Filters out rare patterns
3. **Ascending support ordering**: Textbook-recommended heuristic (p.193)

The key insight from the textbook is that **low-support patterns are more valuable** because they're less obvious and can eliminate more candidates when applied.

#### Efficiency Analysis

| Pattern Type | Complexity | With typical values (n=100) |
|--------------|------------|------------------------------|
| Single-attribute | O(n) per attribute | ~500 ops |
| Compound (zone × seniority) | O(\|zones\| × \|levels\| × n) | 4 × 5 × 100 = 2,000 ops |
| Compound (skill × zone) | O(top_k × \|zones\| × n) | 5 × 4 × 100 = 2,000 ops |
| Compound (skill × seniority) | O(top_k × \|levels\| × n) | 5 × 5 × 100 = 2,500 ops |

**Total**: O(n) linear in result count, which is paginated (typically 10-100). This is efficient for the use case.

#### Alternative Approaches (Not Implemented)

| Approach | Pros | Cons |
|----------|------|------|
| **Support-based** (chosen) | Simple, transparent, no training data | Doesn't predict purchase likelihood |
| **MLP (Most Likely to Purchase)** | Optimizes for conversion | Requires training data, less transparent |
| **MAUT-based** | Theoretically grounded | Computationally heavier |
| **Explanation-based** | Highlights differentiating features | More complex to implement |

The support-based approach is the canonical textbook method (Section 5.3.2.3), computationally cheap, and provides transparent rationales ("X% of matches have this property"). More sophisticated methods could be layered on later if needed.

### Changes Required

#### 1. Dynamic Critique Generator Service
**File**: `recommender_api/src/services/critique-generator/dynamic-critique-generator.service.ts` (NEW)

The generator follows the textbook algorithm:
1. Mine **single-attribute patterns** from current results (timezone, seniority, timeline, skills)
2. Mine **compound patterns** (2-attribute combinations) - these are often the most valuable
3. Filter by minimum support threshold
4. Order by ascending support (low-support first) - non-obvious patterns are more useful
5. Return top N suggestions

**File structure** (SRP-compliant):
- `dynamic-critique-generator.service.ts` - Main orchestration (public API)
- `attribute-mining-config.ts` - Shared configs defining how each attribute type is mined
- `single-attribute-critique-generator.ts` - Single-attribute pattern mining (uses shared configs)
- `compound-critique-generator.ts` - Compound pattern mining (uses shared configs)
- `critique-filter.ts` - Filtering and ranking logic
- `pattern-mining-utils.ts` - Shared utilities (skill counting, capitalize)

```typescript
/**
 * Dynamic Critique Generator (Section 5.3.2.3)
 *
 * Mines patterns from current search results and suggests useful critiques.
 *
 * Key insight from textbook (p.193):
 * "Many recommender systems order the critiques to the user in ascending order
 * of support. The logic for this approach is that low support critiques are
 * often less obvious patterns that can be used to eliminate a larger number
 * of items from the candidate list."
 */

import type { EngineerMatch } from '../../types/search.types.js';
import type { SearchFilterRequest } from '../../schemas/search.schema.js';
import type { DynamicCritiqueSuggestion } from '../../types/critique.types.js';
import type { ExpandedSearchCriteria } from '../constraint-expander.service.js';
import { mineSingleAttributePatterns } from './single-attribute-critique-generator.js';
import { mineCompoundPatterns } from './compound-critique-generator.js';
import { filterAndRankCritiqueSuggestions } from './critique-filter.js';
import { critiqueConfig } from '../../config/knowledge-base/critique.config.js';
import type { MiningContext } from './attribute-mining-config.js';

/**
 * Generate dynamic critique suggestions from current results.
 *
 * Algorithm:
 * 1. Mine single-attribute patterns (timezone, seniority, timeline, skills, budget, domains)
 * 2. Mine compound patterns (2-attribute combinations)
 * 3. Filter by minimum support threshold (15%)
 * 4. Order by ascending support (non-obvious patterns first)
 * 5. Return top 5 suggestions
 */
export function generateDynamicCritiques(
  currentMatches: EngineerMatch[],
  request: SearchFilterRequest,
  expanded: ExpandedSearchCriteria
): DynamicCritiqueSuggestion[] {
  if (currentMatches.length === 0) {
    return [];
  }

  const context: MiningContext = { request, expanded };

  // Step 1: Mine single-attribute patterns
  const singleAttributeCritiqueSuggestions = mineSingleAttributePatterns(
    currentMatches,
    context
  );

  // Step 2: Mine compound patterns (2-attribute combinations)
  const compoundCritiqueSuggestions = mineCompoundPatterns(
    currentMatches,
    context
  );

  // Step 3: Filter and rank
  const allMinedCritiqueSuggestions = [
    ...singleAttributeCritiqueSuggestions,
    ...compoundCritiqueSuggestions,
  ];
  return filterAndRankCritiqueSuggestions(
    critiqueConfig.dynamicCritiques,
    allMinedCritiqueSuggestions
  );
}

```

#### 2. Add getSeniorityLevelFromYears to Canonical Config
**File**: `recommender_api/src/config/knowledge-base/utility.config.ts` (MODIFY)

Add this function right after `seniorityMinYears` - it's the inverse lookup and belongs with the config it derives from. This makes it reusable by other services (tightening-generator, etc.).

```typescript
/**
 * Derive seniority level from years of experience.
 *
 * Inverse of seniorityMinYears: given years, returns the highest seniority level
 * the engineer qualifies for.
 *
 * Example: 7 years → 'senior' (meets 6+ threshold, doesn't meet 10+ for staff)
 */
export function getSeniorityLevelFromYears(years: number): SeniorityLevel {
  /*
   * Walk seniority levels in reverse order (highest first).
   * Return the first level where years >= minYears.
   */
  for (let i = SENIORITY_LEVEL_ORDER.length - 1; i >= 0; i--) {
    const level = SENIORITY_LEVEL_ORDER[i];
    if (years >= seniorityMinYears[level]) {
      return level;
    }
  }
  return SENIORITY_LEVEL_ORDER[0]; // junior (0+ years)
}
```

#### 3. Pattern Mining Utilities
**File**: `recommender_api/src/services/critique-generator/pattern-mining-utils.ts` (NEW)

Shared utilities used by both single-attribute and compound critique generators.

```typescript
/**
 * Pattern Mining Utilities
 *
 * Shared functions for dynamic critique generation.
 */

import type { EngineerMatch } from '../../types/search.types.js';

/**
 * Count skill occurrences across engineer matches.
 * Used by both single-attribute skill mining and compound pattern mining.
 */
export function countSkillOccurrencesAcrossEngineerMatches(
  engineerMatches: EngineerMatch[]
): Map<string, { count: number; name: string }> {
  const skillOccurrences = new Map<string, { count: number; name: string }>();

  for (const engineerMatch of engineerMatches) {
    for (const skill of engineerMatch.matchedSkills) {
      const existing = skillOccurrences.get(skill.skillId);
      if (existing) {
        existing.count++;
      } else {
        skillOccurrences.set(skill.skillId, { count: 1, name: skill.skillName });
      }
    }
  }

  return skillOccurrences;
}

/**
 * Capitalize first letter of a string.
 */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

#### 4. Critique Filter
**File**: `recommender_api/src/services/critique-generator/critique-filter.ts` (NEW)

Filtering and ranking logic, separated for testability.

```typescript
/**
 * Critique Filter
 *
 * Filters and ranks dynamic critique suggestions per Section 5.3.2.3.
 */

import type { DynamicCritiqueSuggestion } from '../../types/critique.types.js';

interface FilterConfig {
  minSupportThreshold: number;
  maxSuggestions: number;
}

/**
 * Filter and rank critique suggestions.
 *
 * Per textbook (p.193):
 * - Filter by minimum support threshold
 * - Order by ascending support (low-support patterns first)
 * - Return top N suggestions
 */
export function filterAndRankCritiqueSuggestions(
  config: FilterConfig,
  suggestions: DynamicCritiqueSuggestion[]
): DynamicCritiqueSuggestion[] {
  return suggestions
    .filter(suggestion => suggestion.support >= config.minSupportThreshold)
    .sort((a, b) => a.support - b.support)  // Ascending: low support first
    .slice(0, config.maxSuggestions);
}
```

#### 5. Attribute Mining Configurations (Shared)
**File**: `recommender_api/src/services/critique-generator/attribute-mining-config.ts` (NEW)

This module defines the shared `AttributeMiningConfig` interface and configurations for each attribute type. Both single-attribute and compound critique suggestion generators use these configs, ensuring consistent behavior and DRY code.

```typescript
/**
 * Attribute Mining Configurations
 *
 * Shared configurations for generating critique suggestions. Each attribute type
 * (timezone, seniority, skill, timeline, budget, domains) has a config that defines:
 * - How to get critique candidates to evaluate
 * - How to check if an engineer passes the filter
 * - How to build the critique adjustment
 * - How to format descriptions for single-attribute suggestions
 *
 * Used by both single-attribute and compound critique suggestion generators.
 */

import type { EngineerMatch, SearchFilterRequest } from '../../types/search.types.js';
import type { ExpandedSearchCriteria } from '../constraint-expander.service.js';
import type { CritiquableProperty } from '../../types/critique.types.js';
import { SENIORITY_LEVEL_ORDER, START_TIMELINE_ORDER } from '../../schemas/search.schema.js';
import { US_TIMEZONE_ZONE_ORDER } from '../../schemas/search.schema.js';
import { seniorityMinYears } from '../../config/knowledge-base/utility.config.js';
import { countSkillOccurrencesAcrossEngineerMatches, capitalize } from './pattern-mining-utils.js';

// ============================================
// TYPES
// ============================================

/**
 * A potential critique that could be suggested for an attribute.
 * Example: { id: 'Pacific', displayLabel: 'Pacific', matchValue: 'Pacific' }
 */
export interface CritiqueCandidate {
  /** Unique identifier for this critique candidate */
  id: string;
  /** Human-readable label for descriptions (e.g., "Pacific", "Senior", "Python") */
  displayLabel: string;
  /**
   * Data needed to check if an engineer passes this filter.
   * Type depends on attribute:
   * - Timezone: the zone name (string), e.g., "Pacific"
   * - Seniority: minimum years threshold (number), e.g., 6
   * - Timeline: index in START_TIMELINE_ORDER (number), e.g., 1
   * - Skills: the skillId (string), e.g., "skill-uuid-123"
   * - Budget: salary threshold (number), e.g., 150000
   * - BusinessDomains: the domainId (string), e.g., "domain-fintech-123"
   * - TechnicalDomains: the domainId (string), e.g., "domain-cloud-456"
   */
  matchValue: string | number;
}

/**
 * Context passed to mining configs containing both the original request
 * and expanded criteria. Mining configs can access what they need from each:
 * - request: original user constraints (skills, domains, seniority level, etc.)
 * - expanded: derived values (minYearsExperience, timezoneZones, startTimeline, etc.)
 */
export interface MiningContext {
  request: SearchFilterRequest;
  expanded: ExpandedSearchCriteria;
}

/**
 * Configuration for generating critique suggestions for a specific attribute type.
 * Each critiquable property has its own config defining how to:
 * - Get critique candidates to evaluate
 * - Check if an engineer passes the filter
 * - Build the critique adjustment
 * - Format descriptions for single-attribute suggestions
 */
export interface AttributeMiningConfig {
  /** Which critiquable property this config handles */
  attributeKey: CritiquableProperty;

  /**
   * Get critique candidates that could be suggested for this attribute.
   * Should exclude values already constrained by the current search.
   */
  getCritiqueCandidates(
    engineerMatches: EngineerMatch[],
    context: MiningContext
  ): CritiqueCandidate[];

  /**
   * Check if an engineer passes the filter for this critique candidate.
   */
  doesEngineerPassFilter(
    engineerMatch: EngineerMatch,
    critiqueCandidate: CritiqueCandidate
  ): boolean;

  /**
   * Build the critique adjustment for this critique candidate.
   */
  buildCritiqueAdjustment(
    critiqueCandidate: CritiqueCandidate
  ): { property: string; operation: string; direction?: string; value?: unknown };

  /**
   * Format description for a single-attribute suggestion.
   * Example: "Require Pacific timezone", "Add Python requirement"
   */
  formatSingleDescription(critiqueCandidate: CritiqueCandidate): string;

  /**
   * Format rationale for a single-attribute suggestion.
   * Example: "45% of current engineers are in Pacific timezone"
   */
  formatSingleRationale(critiqueCandidate: CritiqueCandidate, supportPercentage: number): string;
}

// ============================================
// ATTRIBUTE MINING CONFIGURATIONS
// ============================================

/**
 * Mining configuration for timezone attribute.
 * Candidates are US timezone zones not already required.
 */
export const timezoneMiningConfig: AttributeMiningConfig = {
  attributeKey: 'timezone',

  getCritiqueCandidates(_engineerMatches, context) {
    const alreadyRequiredTimezones = context.expanded.timezoneZones ?? [];

    return US_TIMEZONE_ZONE_ORDER
      .filter(timezone => !alreadyRequiredTimezones.includes(timezone))
      .map(timezone => ({
        id: timezone,
        displayLabel: timezone,
        matchValue: timezone,
      }));
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    return engineerMatch.timezone === candidate.matchValue;
  },

  buildCritiqueAdjustment(candidate) {
    return { property: 'timezone', operation: 'set', value: candidate.matchValue };
  },

  formatSingleDescription(candidate) {
    return `Require ${candidate.displayLabel} timezone`;
  },

  formatSingleRationale(candidate, supportPercentage) {
    return `${supportPercentage}% of current engineers are in ${candidate.displayLabel} timezone`;
  },
};

/**
 * Mining configuration for seniority attribute.
 * Candidates are seniority levels stricter than the current constraint.
 */
export const seniorityMiningConfig: AttributeMiningConfig = {
  attributeKey: 'seniority',

  getCritiqueCandidates(_engineerMatches, context) {
    const currentMinYearsRequired = context.expanded.minYearsExperience ?? 0;

    return SENIORITY_LEVEL_ORDER
      .filter(level => seniorityMinYears[level] > currentMinYearsRequired)
      .map(level => ({
        id: level,
        displayLabel: capitalize(level),
        matchValue: seniorityMinYears[level],  // Store minYears for matching
      }));
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    const requiredMinYears = candidate.matchValue as number;
    return engineerMatch.yearsExperience >= requiredMinYears;
  },

  buildCritiqueAdjustment(candidate) {
    return { property: 'seniority', operation: 'set', value: candidate.id };
  },

  formatSingleDescription(candidate) {
    const minYears = candidate.matchValue as number;
    return `Require ${candidate.displayLabel.toLowerCase()}-level experience (${minYears}+ years)`;
  },

  formatSingleRationale(candidate, supportPercentage) {
    const minYears = candidate.matchValue as number;
    return `${supportPercentage}% of current engineers have ${minYears}+ years experience`;
  },
};

/**
 * Mining configuration for timeline attribute.
 * Candidates are timelines stricter (earlier) than the current constraint.
 *
 * Timeline matching is cumulative: an engineer "matches" a timeline if they
 * can start at or before that timeline (e.g., "immediate" matches "two_weeks").
 */
export const timelineMiningConfig: AttributeMiningConfig = {
  attributeKey: 'timeline',

  getCritiqueCandidates(_engineerMatches, context) {
    const currentAllowedTimelines = context.expanded.startTimeline ?? START_TIMELINE_ORDER;

    /*
     * Find the loosest currently allowed timeline (latest in order).
     * We suggest stricter timelines (earlier ones) as tightening options.
     */
    const loosestCurrentIndex = Math.max(
      ...currentAllowedTimelines.map(timeline => START_TIMELINE_ORDER.indexOf(timeline))
    );

    // Return timelines stricter than current (earlier in the order, excluding the loosest)
    return START_TIMELINE_ORDER
      .slice(0, loosestCurrentIndex)  // All timelines before the loosest allowed
      .map(timeline => ({
        id: timeline,
        displayLabel: timeline.replace(/_/g, ' '),  // "two_weeks" -> "two weeks"
        matchValue: START_TIMELINE_ORDER.indexOf(timeline),  // Store index for matching
      }));
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    const candidateTimelineIndex = candidate.matchValue as number;
    const engineerTimelineIndex = START_TIMELINE_ORDER.indexOf(engineerMatch.startTimeline);
    // Engineer matches if they can start at or before the candidate timeline
    return engineerTimelineIndex <= candidateTimelineIndex;
  },

  buildCritiqueAdjustment(candidate) {
    return { property: 'timeline', operation: 'set', value: candidate.id };
  },

  formatSingleDescription(candidate) {
    return `Require ${candidate.displayLabel} or sooner`;
  },

  formatSingleRationale(candidate, supportPercentage) {
    return `${supportPercentage}% of current engineers available ${candidate.displayLabel} or sooner`;
  },
};

/**
 * Mining configuration for skills attribute.
 * Candidates are top skills (by occurrence) not already required.
 *
 * We exclude skills already in requirements because suggesting them would be
 * redundant - the user has already applied that constraint. Dynamic critiques
 * should help users discover NEW refinements, not remind them of existing ones.
 */
export const skillsMiningConfig: AttributeMiningConfig = {
  attributeKey: 'skills',

  getCritiqueCandidates(engineerMatches, context) {
    const skillOccurrences = countSkillOccurrencesAcrossEngineerMatches(engineerMatches);
    /*
     * Extract already-required skill names from the original request.
     * The request contains SkillRequirement objects with a 'skill' (name) field.
     */
    const alreadyRequiredSkillNames = new Set(
      context.request.requiredSkills?.map(skillReq => skillReq.skill) ?? []
    );

    const TOP_SKILLS_LIMIT = 5;

    return Array.from(skillOccurrences.entries())
      .filter(([_skillId, { name }]) => !alreadyRequiredSkillNames.has(name))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TOP_SKILLS_LIMIT)
      .map(([skillId, { name: skillName }]) => ({
        id: skillId,
        displayLabel: skillName,
        matchValue: skillId,  // Store skillId for matching
      }));
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    const targetSkillId = candidate.matchValue as string;
    return engineerMatch.matchedSkills.some(skill => skill.skillId === targetSkillId);
  },

  buildCritiqueAdjustment(candidate) {
    return {
      property: 'skills',
      operation: 'add',
      value: { skill: candidate.displayLabel, proficiency: 'learning' },
    };
  },

  formatSingleDescription(candidate) {
    return `Add ${candidate.displayLabel} requirement`;
  },

  formatSingleRationale(candidate, supportPercentage) {
    return `${supportPercentage}% of current engineers have ${candidate.displayLabel}`;
  },
};

/**
 * Mining configuration for budget attribute.
 * Suggests tightening budget based on salary distribution of current matches.
 *
 * Uses salary percentiles to find natural breakpoints where a significant
 * portion of engineers fall below a threshold.
 */
export const budgetMiningConfig: AttributeMiningConfig = {
  attributeKey: 'budget',

  getCritiqueCandidates(engineerMatches, context) {
    const currentMaxBudget = context.expanded.maxBudget;

    // Get all salaries and sort ascending
    const salaries = engineerMatches
      .map(em => em.salary)
      .filter((s): s is number => s != null)
      .sort((a, b) => a - b);

    if (salaries.length === 0) return [];

    // Generate candidates at 25th, 50th, 75th percentiles
    const percentiles = [0.25, 0.5, 0.75];
    const candidates: CritiqueCandidate[] = [];

    for (const percentile of percentiles) {
      const index = Math.floor(salaries.length * percentile);
      const salaryThreshold = salaries[index];

      // Only suggest if it's stricter than current budget
      if (currentMaxBudget == null || salaryThreshold < currentMaxBudget) {
        candidates.push({
          id: `budget-${salaryThreshold}`,
          displayLabel: `$${salaryThreshold.toLocaleString()}`,
          matchValue: salaryThreshold,
        });
      }
    }

    // Deduplicate (in case percentiles land on same value)
    const seen = new Set<number>();
    return candidates.filter(c => {
      const salary = c.matchValue as number;
      if (seen.has(salary)) return false;
      seen.add(salary);
      return true;
    });
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    const budgetThreshold = candidate.matchValue as number;
    return engineerMatch.salary != null && engineerMatch.salary <= budgetThreshold;
  },

  buildCritiqueAdjustment(candidate) {
    return {
      property: 'budget',
      operation: 'set',
      value: candidate.matchValue,
    };
  },

  formatSingleDescription(candidate) {
    return `Lower budget to ${candidate.displayLabel}`;
  },

  formatSingleRationale(candidate, supportPercentage) {
    return `${supportPercentage}% of current engineers have salaries at or below ${candidate.displayLabel}`;
  },
};

/**
 * Mining configuration for businessDomains attribute.
 * Candidates are business domains common among current matches but not required.
 *
 * Uses matchedBusinessDomains from EngineerMatch, which contains BusinessDomainMatch
 * objects with domainId, domainName, engineerYears, etc.
 */
export const businessDomainsMiningConfig: AttributeMiningConfig = {
  attributeKey: 'businessDomains',

  getCritiqueCandidates(engineerMatches, context) {
    // Count domain occurrences across matches
    const domainOccurrences = new Map<string, { count: number; name: string }>();
    for (const engineerMatch of engineerMatches) {
      for (const domainMatch of engineerMatch.matchedBusinessDomains ?? []) {
        const existing = domainOccurrences.get(domainMatch.domainId);
        if (existing) {
          existing.count++;
        } else {
          domainOccurrences.set(domainMatch.domainId, { count: 1, name: domainMatch.domainName });
        }
      }
    }

    /*
     * Extract already-required domain names from the original request.
     * The request contains BusinessDomainRequirement objects with a 'domain' (name) field.
     */
    const alreadyRequiredDomainNames = new Set(
      context.request.requiredBusinessDomains?.map(domainReq => domainReq.domain) ?? []
    );

    const TOP_DOMAINS_LIMIT = 5;

    return Array.from(domainOccurrences.entries())
      .filter(([_domainId, { name }]) => !alreadyRequiredDomainNames.has(name))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TOP_DOMAINS_LIMIT)
      .map(([domainId, { name }]) => ({
        id: domainId,
        displayLabel: name,
        matchValue: domainId,  // Store domainId for matching
      }));
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    const targetDomainId = candidate.matchValue as string;
    return engineerMatch.matchedBusinessDomains?.some(d => d.domainId === targetDomainId) ?? false;
  },

  buildCritiqueAdjustment(candidate) {
    return {
      property: 'businessDomains',
      operation: 'add',
      value: { domain: candidate.displayLabel },
    };
  },

  formatSingleDescription(candidate) {
    return `Add ${candidate.displayLabel} business domain requirement`;
  },

  formatSingleRationale(candidate, supportPercentage) {
    return `${supportPercentage}% of current engineers have ${candidate.displayLabel} experience`;
  },
};

/**
 * Mining configuration for technicalDomains attribute.
 * Candidates are technical domains common among current matches but not required.
 *
 * Uses matchedTechnicalDomains from EngineerMatch, which contains TechnicalDomainMatch
 * objects with domainId, domainName, engineerYears, matchType, etc.
 */
export const technicalDomainsMiningConfig: AttributeMiningConfig = {
  attributeKey: 'technicalDomains',

  getCritiqueCandidates(engineerMatches, context) {
    // Count domain occurrences across matches
    const domainOccurrences = new Map<string, { count: number; name: string }>();
    for (const engineerMatch of engineerMatches) {
      for (const domainMatch of engineerMatch.matchedTechnicalDomains ?? []) {
        const existing = domainOccurrences.get(domainMatch.domainId);
        if (existing) {
          existing.count++;
        } else {
          domainOccurrences.set(domainMatch.domainId, { count: 1, name: domainMatch.domainName });
        }
      }
    }

    /*
     * Extract already-required domain names from the original request.
     * The request contains TechnicalDomainRequirement objects with a 'domain' (name) field.
     */
    const alreadyRequiredDomainNames = new Set(
      context.request.requiredTechnicalDomains?.map(domainReq => domainReq.domain) ?? []
    );

    const TOP_DOMAINS_LIMIT = 5;

    return Array.from(domainOccurrences.entries())
      .filter(([_domainId, { name }]) => !alreadyRequiredDomainNames.has(name))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TOP_DOMAINS_LIMIT)
      .map(([domainId, { name }]) => ({
        id: domainId,
        displayLabel: name,
        matchValue: domainId,  // Store domainId for matching
      }));
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    const targetDomainId = candidate.matchValue as string;
    return engineerMatch.matchedTechnicalDomains?.some(d => d.domainId === targetDomainId) ?? false;
  },

  buildCritiqueAdjustment(candidate) {
    return {
      property: 'technicalDomains',
      operation: 'add',
      value: { domain: candidate.displayLabel },
    };
  },

  formatSingleDescription(candidate) {
    return `Add ${candidate.displayLabel} technical domain requirement`;
  },

  formatSingleRationale(candidate, supportPercentage) {
    return `${supportPercentage}% of current engineers have ${candidate.displayLabel} experience`;
  },
};

// ============================================
// CONFIG COLLECTIONS
// ============================================

/**
 * Configs for single-attribute pattern mining.
 * All critiquable properties are mined for single-attribute suggestions.
 */
export const SINGLE_ATTRIBUTE_MINING_CONFIGS: AttributeMiningConfig[] = [
  timezoneMiningConfig,
  seniorityMiningConfig,
  timelineMiningConfig,
  skillsMiningConfig,
  budgetMiningConfig,
  businessDomainsMiningConfig,
  technicalDomainsMiningConfig,
];

/**
 * Pairs of configs for compound pattern mining.
 * Each pair produces suggestions like "Senior + Pacific" or "Python + Eastern".
 *
 * We focus on the most useful combinations. Additional pairs could be added
 * (e.g., skills + domains) if valuable patterns emerge in practice.
 */
export const COMPOUND_ATTRIBUTE_PAIRS: [AttributeMiningConfig, AttributeMiningConfig][] = [
  [timezoneMiningConfig, seniorityMiningConfig],   // "Senior engineers in Pacific timezone"
  [skillsMiningConfig, timezoneMiningConfig],      // "Python developers in Eastern timezone"
  [skillsMiningConfig, seniorityMiningConfig],     // "Senior Python developers"
];
```

#### 6. Single-Attribute Critique Generator
**File**: `recommender_api/src/services/critique-generator/single-attribute-critique-generator.ts` (NEW)

This module uses the shared `AttributeMiningConfig` interface to mine single-attribute patterns with a generic function.

```typescript
/**
 * Single-Attribute Critique Suggestion Generator
 *
 * Mines patterns for individual critiquable attributes using the shared
 * AttributeMiningConfig interface. A generic mining function iterates over
 * attribute configs, avoiding repetitive per-attribute functions.
 */

import type { EngineerMatch } from '../../types/search.types.js';
import type { DynamicCritiqueSuggestion } from '../../types/critique.types.js';
import {
  SINGLE_ATTRIBUTE_MINING_CONFIGS,
  type AttributeMiningConfig,
  type MiningContext,
} from './attribute-mining-config.js';

/**
 * Mine all single-attribute patterns.
 *
 * Iterates over all configured attribute types and mines patterns for each.
 */
export function mineSingleAttributePatterns(
  engineerMatches: EngineerMatch[],
  context: MiningContext
): DynamicCritiqueSuggestion[] {
  const allSingleAttributeSuggestions: DynamicCritiqueSuggestion[] = [];

  for (const attributeConfig of SINGLE_ATTRIBUTE_MINING_CONFIGS) {
    const suggestionsForAttribute = generateCritiqueSuggestionsForAttribute(
      engineerMatches,
      context,
      attributeConfig
    );
    allSingleAttributeSuggestions.push(...suggestionsForAttribute);
  }

  return allSingleAttributeSuggestions;
}

/**
 * Generate critique suggestions for a single attribute type.
 *
 * For each critique candidate:
 * 1. Count engineers passing the filter
 * 2. Calculate support (percentage of matches)
 * 3. Build suggestion with adjustment, description, and rationale
 */
function generateCritiqueSuggestionsForAttribute(
  engineerMatches: EngineerMatch[],
  context: MiningContext,
  attributeConfig: AttributeMiningConfig
): DynamicCritiqueSuggestion[] {
  const totalEngineerCount = engineerMatches.length;
  const suggestionsForAttribute: DynamicCritiqueSuggestion[] = [];

  const critiqueCandidates = attributeConfig.getCritiqueCandidates(engineerMatches, context);

  for (const candidate of critiqueCandidates) {
    const engineerCountPassingFilter = engineerMatches.filter(engineerMatch =>
      attributeConfig.doesEngineerPassFilter(engineerMatch, candidate)
    ).length;

    if (engineerCountPassingFilter > 0) {
      const supportRatio = engineerCountPassingFilter / totalEngineerCount;
      const supportPercentage = Math.round(supportRatio * 100);

      suggestionsForAttribute.push({
        adjustments: [attributeConfig.buildCritiqueAdjustment(candidate)],
        description: attributeConfig.formatSingleDescription(candidate),
        resultingMatches: engineerCountPassingFilter,
        support: supportRatio,
        rationale: attributeConfig.formatSingleRationale(candidate, supportPercentage),
      });
    }
  }

  return suggestionsForAttribute;
}
```

#### 7. Compound Critique Generator
**File**: `recommender_api/src/services/critique-generator/compound-critique-generator.ts` (NEW)

This module imports the shared attribute configurations and uses them to mine compound (2-attribute) patterns.

```typescript
/**
 * Compound Critique Generator
 *
 * Mines 2-attribute combination patterns for dynamic critiques.
 * Per textbook p.193, dynamic critiques are "by definition" compound.
 *
 * Uses the shared AttributeMiningConfig from attribute-mining-config.ts,
 * which defines how each attribute type is mined.
 */

import type { EngineerMatch } from '../../types/search.types.js';
import type { DynamicCritiqueSuggestion } from '../../types/critique.types.js';
import {
  COMPOUND_ATTRIBUTE_PAIRS,
  type AttributeMiningConfig,
  type CritiqueCandidate,
  type MiningContext,
} from './attribute-mining-config.js';

// ============================================
// PUBLIC API
// ============================================

/**
 * Mine compound patterns (2-attribute combinations).
 *
 * Compound patterns like "Senior + Pacific timezone" are often more valuable
 * because they're less obvious and eliminate more items.
 *
 * We limit to 2-attribute combinations to avoid combinatorial explosion.
 */
export function mineCompoundPatterns(
  engineerMatches: EngineerMatch[],
  context: MiningContext
): DynamicCritiqueSuggestion[] {
  const allCompoundSuggestions: DynamicCritiqueSuggestion[] = [];

  for (const [firstAttributeConfig, secondAttributeConfig] of COMPOUND_ATTRIBUTE_PAIRS) {
    const suggestionsForPair = generateCompoundCritiqueSuggestionsForAttributePair(
      engineerMatches,
      context,
      firstAttributeConfig,
      secondAttributeConfig
    );
    allCompoundSuggestions.push(...suggestionsForPair);
  }

  return allCompoundSuggestions;
}

// ============================================
// COMPOUND CRITIQUE SUGGESTION GENERATOR
// ============================================

/**
 * Generate compound critique suggestions for a specific pair of attributes.
 *
 * Iterates over the cartesian product of critique candidates from both attributes,
 * counting engineers that pass both filters and building suggestions.
 */
function generateCompoundCritiqueSuggestionsForAttributePair(
  engineerMatches: EngineerMatch[],
  context: MiningContext,
  firstAttributeConfig: AttributeMiningConfig,
  secondAttributeConfig: AttributeMiningConfig
): DynamicCritiqueSuggestion[] {
  const totalEngineerCount = engineerMatches.length;
  const suggestionsForPair: DynamicCritiqueSuggestion[] = [];

  const firstCritiqueCandidates = firstAttributeConfig.getCritiqueCandidates(engineerMatches, context);
  const secondCritiqueCandidates = secondAttributeConfig.getCritiqueCandidates(engineerMatches, context);

  for (const firstCandidate of firstCritiqueCandidates) {
    for (const secondCandidate of secondCritiqueCandidates) {
      const engineerCountPassingBothFilters = engineerMatches.filter(engineerMatch =>
        firstAttributeConfig.doesEngineerPassFilter(engineerMatch, firstCandidate) &&
        secondAttributeConfig.doesEngineerPassFilter(engineerMatch, secondCandidate)
      ).length;

      if (engineerCountPassingBothFilters > 0) {
        const supportRatio = engineerCountPassingBothFilters / totalEngineerCount;
        const supportPercentage = Math.round(supportRatio * 100);

        suggestionsForPair.push({
          adjustments: [
            firstAttributeConfig.buildCritiqueAdjustment(firstCandidate),
            secondAttributeConfig.buildCritiqueAdjustment(secondCandidate),
          ],
          description: formatCompoundDescription(firstCandidate, secondCandidate, firstAttributeConfig, secondAttributeConfig),
          resultingMatches: engineerCountPassingBothFilters,
          support: supportRatio,
          rationale: `${supportPercentage}% of engineers match both ${firstCandidate.displayLabel} and ${secondCandidate.displayLabel}`,
        });
      }
    }
  }

  return suggestionsForPair;
}

/**
 * Format a human-readable description for a compound suggestion.
 *
 * Produces natural descriptions like:
 * - "Senior-level engineers in Pacific timezone" (seniority + timezone)
 * - "Python developers in Eastern timezone" (skills + timezone)
 * - "Senior-level Python developers" (seniority + skills)
 */
function formatCompoundDescription(
  firstCandidate: CritiqueCandidate,
  secondCandidate: CritiqueCandidate,
  firstConfig: AttributeMiningConfig,
  secondConfig: AttributeMiningConfig
): string {
  const firstKey = firstConfig.attributeKey;
  const secondKey = secondConfig.attributeKey;

  /*
   * Order matters for readability. We want descriptions like:
   * - "Senior Python developers" not "Python senior developers"
   * - "Python developers in Pacific" not "Pacific Python developers"
   */
  if (firstKey === 'timezone' && secondKey === 'seniority') {
    return `${secondCandidate.displayLabel}-level engineers in ${firstCandidate.displayLabel} timezone`;
  }
  if (firstKey === 'skills' && secondKey === 'timezone') {
    return `${firstCandidate.displayLabel} developers in ${secondCandidate.displayLabel} timezone`;
  }
  if (firstKey === 'skills' && secondKey === 'seniority') {
    return `${secondCandidate.displayLabel}-level ${firstCandidate.displayLabel} developers`;
  }

  // Fallback for any future attribute combinations
  return `${firstCandidate.displayLabel} + ${secondCandidate.displayLabel}`;
}
```

### Success Criteria

#### Automated Verification:
- [x] `npm run typecheck` passes
- [ ] Unit tests for single-attribute critique generation
- [ ] Unit tests for compound critique generation (timezone+seniority, skill+timezone, skill+seniority)
- [ ] Tests verify ascending support ordering (compound patterns often have lower support, so they should appear first)

#### Manual Verification:
- [ ] Generated suggestions make sense for sample result sets
- [ ] Compound patterns appear in suggestions when data supports them

---

## Phase 4: Critique Service and Endpoint

### Overview

Build the main orchestration service and HTTP endpoint.

### Changes Required

#### 1. Critique Service
**File**: `recommender_api/src/services/critique.service.ts` (NEW)

```typescript
/**
 * Critique Service (Section 5.3.2)
 *
 * Orchestrates the full critique flow:
 * 1. Apply adjustments to base search
 * 2. Execute modified search
 * 3. Generate dynamic critique suggestions
 * 4. Get constraint advice if needed
 * 5. Assemble response
 */

import { Session } from 'neo4j-driver';
import type { CritiqueRequest, CritiqueResponse, DynamicCritiqueSuggestion } from '../types/critique.types.js';
import type { SearchFilterResponse } from '../types/search.types.js';
import { applyAdjustmentsToSearchCriteria } from './critique-interpreter.service.js';
import { executeSearch } from './search.service.js';
import { generateDynamicCritiques } from './critique-generator/dynamic-critique-generator.service.js';
import { expandSearchCriteria } from './constraint-expander.service.js';

/**
 * Execute a critique operation.
 *
 * Flow:
 * 1. Get baseline count from base search
 * 2. Apply critique adjustments to modify the search
 * 3. Execute modified search through existing pipeline
 * 4. Generate dynamic critique suggestions
 * 5. Assemble response with critique metadata
 */
export async function executeCritique(
  session: Session,
  request: CritiqueRequest
): Promise<CritiqueResponse> {
  const startTime = Date.now();

  // Step 1: Get baseline count (execute base search without modifications)
  const baselineResult = await executeSearch(session, {
    ...request.baseSearch,
    limit: 0,  // Just get count
    offset: 0,
  });
  const previousResultCount = baselineResult.totalCount;

  // Step 2: Interpret critique adjustments into search criteria changes
  const { searchCriteria, appliedCritiqueAdjustments, failedCritiqueAdjustments } = applyAdjustmentsToSearchCriteria(
    request.baseSearch,
    request.adjustments
  );

  // Step 3: Execute search with modified criteria
  const searchResult = await executeSearch(session, {
    ...searchCriteria,
    limit: request.limit ?? 10,
    offset: request.offset ?? 0,
  });

  // Step 4: Generate dynamic critique suggestions
  let suggestedCritiques: DynamicCritiqueSuggestion[] | undefined;

  if (searchResult.matches.length > 0) {
    const expandedCriteria = await expandSearchCriteria(session, searchCriteria);
    suggestedCritiques = generateDynamicCritiques(
      searchResult.matches,
      searchCriteria,   // Original request (for accessing requiredSkills, requiredBusinessDomains, etc.)
      expandedCriteria  // Expanded/derived values (for timezoneZones, minYearsExperience, etc.)
    );
  }

  // Step 5: Assemble response
  const executionTimeMs = Date.now() - startTime;

  return {
    matches: searchResult.matches,
    totalCount: searchResult.totalCount,
    appliedFilters: searchResult.appliedFilters,
    appliedPreferences: searchResult.appliedPreferences,
    derivedConstraints: searchResult.derivedConstraints,
    critique: {
      appliedCritiqueAdjustments,
      failedCritiqueAdjustments,
      previousResultCount,
      resultCountChange: searchResult.totalCount - previousResultCount,
    },
    suggestedCritiques: suggestedCritiques?.length ? suggestedCritiques : undefined,
    relaxation: searchResult.relaxation,
    tightening: searchResult.tightening,
    queryMetadata: {
      ...searchResult.queryMetadata,
      executionTimeMs,
    },
  };
}
```

#### 2. Critique Controller
**File**: `recommender_api/src/controllers/critique.controller.ts` (NEW)

```typescript
/**
 * Critique Controller
 *
 * Handles HTTP requests for the critique endpoint.
 */

import { Request, Response } from 'express';
import { getDriver } from '../db/neo4j.js';
import { CritiqueRequestSchema } from '../schemas/critique.schema.js';
import { executeCritique } from '../services/critique.service.js';

export async function handleCritique(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  // Validate request
  const parseResult = CritiqueRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: parseResult.error.errors.map(validationError => ({
          field: validationError.path.join('.'),
          message: validationError.message,
        })),
      },
    });
    return;
  }

  const driver = getDriver();
  const session = driver.session();

  try {
    const result = await executeCritique(session, parseResult.data);
    res.json(result);
  } catch (error) {
    console.error('Critique error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  } finally {
    await session.close();
  }
}
```

#### 3. Update Routes
**File**: `recommender_api/src/routes/search.routes.ts`

Add new route:
```typescript
import { handleCritique } from '../controllers/critique.controller.js';

// ... existing routes ...

// POST /api/search/critique - Critique-based refinement (Chapter 5.3.2)
router.post('/critique', handleCritique);
```

### Success Criteria

#### Automated Verification:
- [x] `npm run typecheck` passes
- [ ] Unit tests for critique service orchestration
- [ ] E2E tests for critique endpoint

#### Manual Verification:
- [ ] Endpoint accepts requests and returns expected response structure
- [ ] Dynamic suggestions appear in response when results exist

---

## Phase 5: Testing

### Overview

Add comprehensive tests for the critique system.

### Changes Required

#### 1. Unit Tests for Critique Interpreter
**File**: `recommender_api/src/services/critique-interpreter.service.test.ts` (NEW)

Test cases:
- Directional critiques (all attributes, both directions)
- Edge cases (already at max/min) - should return `applied` with warning
- Failed adjustments (no constraint to adjust) - should return `failed`
- Replacement critiques (all attributes)
- Skill critiques (add, remove, strengthen, weaken)
- Domain critiques (add, remove)
- Compound critiques (multiple adjustments, including mix of applied/failed)

#### 2. Unit Tests for Dynamic Critique Generator (per module)

**File**: `recommender_api/src/config/knowledge-base/utility.config.test.ts` (MODIFY)
- `getSeniorityLevelFromYears` - uses canonical config, boundary cases (0, 3, 6, 10, 15 years)

**File**: `recommender_api/src/services/critique-generator/pattern-mining-utils.test.ts` (NEW)
- `countSkillOccurrencesAcrossEngineerMatches` - counts correctly, handles empty matches
- `capitalize` - basic string utility

**File**: `recommender_api/src/services/critique-generator/attribute-mining-config.test.ts` (NEW)
- Each config's `getCritiqueCandidates` - excludes already-constrained values
- Each config's `doesEngineerPassFilter` - correct matching logic
- Each config's `formatSingleDescription` and `formatSingleRationale` - correct formatting
- Timeline config - cumulative matching (engineer available "at or before")

**File**: `recommender_api/src/services/critique-generator/critique-filter.test.ts` (NEW)
- Filters below threshold
- Sorts by ascending support
- Limits to max suggestions
- Empty input handling

**File**: `recommender_api/src/services/critique-generator/single-attribute-critique-generator.test.ts` (NEW)
- Timezone patterns - excludes already-required zones
- Seniority patterns - only suggests stricter levels
- Timeline patterns - sooner timelines
- Skill patterns - excludes required skills
- Empty matches handling

**File**: `recommender_api/src/services/critique-generator/compound-critique-generator.test.ts` (NEW)
- Timezone + Seniority combinations
- Skill + Timezone combinations
- Skill + Seniority combinations
- Top-5 skill limiting
- Uses shared `countSkillOccurrencesAcrossEngineerMatches` utility

**File**: `recommender_api/src/services/critique-generator/dynamic-critique-generator.service.test.ts` (NEW)
- Integration test: orchestrates all critique generators correctly
- Empty results returns empty array
- Ascending support ordering in final output

#### 3. E2E Tests
**File**: Update Postman collection `postman/collections/search-filter-tests.postman_collection.json`

Add test folder: "Critique Endpoint Tests"
- Basic simple critique
- Compound critique (user-provided multiple adjustments)
- All adjustment types
- Failed adjustments (e.g., adjust budget with no budget set) - verify in `failedCritiqueAdjustments` array
- Mixed success/failure (some adjustments applied, some failed)
- Dynamic suggestions returned (verify both single and compound patterns)
- Compound pattern suggestions (verify 2-attribute combinations appear)
- Edge cases (no results, already at max with warning)
- Validation errors

### Success Criteria

#### Automated Verification:
- [x] `npm test` passes (all new unit tests)
- [x] `npm run test:e2e` passes (all new E2E tests)
- [x] Test coverage for critique interpreter >= 90%

#### Manual Verification:
- [x] E2E tests cover realistic critique scenarios

---

## Testing Strategy

### Unit Tests

| Component | Test File | Coverage |
|-----------|-----------|----------|
| Critique Schema | `critique.schema.test.ts` | Validation, edge cases |
| Critique Interpreter | `critique-interpreter.service.test.ts` | All adjustment types, applied vs failed distinction, warnings |
| Seniority Level Lookup | `utility.config.test.ts` | `getSeniorityLevelFromYears` boundary cases |
| Pattern Mining Utils | `pattern-mining-utils.test.ts` | Skill counting, capitalize |
| Attribute Mining Configs | `attribute-mining-config.test.ts` | Candidate generation, matching, formatting |
| Critique Filter | `critique-filter.test.ts` | Threshold filtering, ascending sort, limit |
| Single-Attribute Critique Generator | `single-attribute-critique-generator.test.ts` | Generic mining, config integration |
| Compound Critique Generator | `compound-critique-generator.test.ts` | Pair mining, description formatting |
| Dynamic Generator | `dynamic-critique-generator.service.test.ts` | Integration/orchestration |

### Integration Tests

| Scenario | Description |
|----------|-------------|
| Full critique flow | Base search → critique → verify modified results |
| Dynamic suggestions | Verify suggestions ordered by ascending support |
| Constraint advice | Relaxation/tightening still works after critique |

### E2E Tests (Newman)

| Folder | Scenarios |
|--------|-----------|
| Critique - Basic | Simple critiques, response structure |
| Critique - Compound | Multiple adjustments in one request |
| Critique - Failed | Failed adjustments (no constraint to adjust), mixed success/failure |
| Critique - Dynamic | Single + compound pattern suggestions, ascending support ordering |
| Critique - Edge Cases | Max/min boundaries with warnings, empty results |
| Critique - Validation | Invalid requests, missing fields |

---

## Performance Considerations

1. **Baseline count query**: Getting previous result count adds one query. Could cache or skip if not needed.

2. **Dynamic critique generation**: Pattern mining iterates over results. For large result sets (100+), consider:
   - Sampling instead of full enumeration
   - Caching skill distributions
   - Limiting pattern depth

3. **Compound pattern combinatorics**: To avoid exponential growth:
   - Limited to 2-attribute combinations (not 3+)
   - Top-5 skills only used for skill-based compound patterns
   - 4 timezones × 5 seniority levels × 5 skills = manageable ~100 compound candidates max
   - All filtered by support threshold before sorting

4. **Query reuse**: The modified search goes through the full pipeline. This is intentional - ensures consistency with regular search.

---

## References

- Research document: `thoughts/shared/research/2026-01-19-project-5-critiquing-foundational-research.md`
- Learning path: `docs/chapter_5/chapter5_reading_and_learning_path.md`
- Textbook: Section 5.3.2 (Critiquing Methods)
- Similar implementation: `filter-similarity.service.ts` (hybrid endpoint pattern)
