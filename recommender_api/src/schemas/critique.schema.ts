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

/**
 * Collection properties that support add/remove operations and require 'item' for adjust.
 */
const collectionProperties = ['skills', 'businessDomains', 'technicalDomains'] as const;

function isCollectionProperty(property: CritiquableProperty): boolean {
  return (collectionProperties as readonly string[]).includes(property);
}

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
const propertyToValidDirections: Record<CritiquableProperty, readonly Direction[]> = {
  seniority: ['more', 'less'],
  budget: ['more', 'less'],
  timeline: ['sooner', 'later'],
  timezone: ['narrower', 'wider'],
  skills: ['more', 'less'],
  businessDomains: ['more', 'less'],
  technicalDomains: ['more', 'less'],
};

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
}).superRefine((data, ctx) => {
  // Validate direction is valid for property
  const valid = propertyToValidDirections[data.property] ?? [];
  if (!valid.includes(data.direction)) {
    ctx.addIssue({
      code: 'custom',
      message: `Invalid direction '${data.direction}' for property '${data.property}'. Valid: ${valid.join(', ')}`,
      path: ['direction'],
    });
  }

  // Collections require 'item' to specify what to adjust
  if (isCollectionProperty(data.property) && data.item === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: `'adjust' on '${data.property}' requires 'item' to specify which item to adjust`,
      path: ['item'],
    });
  }
});

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
  (data) => isCollectionProperty(data.property),
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
  (data) => isCollectionProperty(data.property),
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
