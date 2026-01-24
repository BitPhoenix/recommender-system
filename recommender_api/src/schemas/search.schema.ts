/**
 * Search API Schemas
 * Zod schemas are the single source of truth for both validation and types.
 */

import { z } from 'zod';
import {
  SENIORITY_LEVEL_ORDER,
  SeniorityLevelSchema,
  START_TIMELINE_ORDER,
  StartTimelineSchema,
  PROFICIENCY_LEVEL_ORDER,
  ProficiencyLevelSchema,
  TeamFocusSchema,
  US_TIMEZONE_ZONE_ORDER,
  USTimezoneZoneSchema,
} from './enums.schema.js';

// Re-export enum schemas and constants for backward compatibility
export {
  SENIORITY_LEVEL_ORDER,
  SeniorityLevelSchema,
  START_TIMELINE_ORDER,
  StartTimelineSchema,
  PROFICIENCY_LEVEL_ORDER,
  ProficiencyLevelSchema,
  TeamFocusSchema,
  US_TIMEZONE_ZONE_ORDER,
  USTimezoneZoneSchema,
};

// ============================================
// SHARED BASE SCHEMAS
// ============================================

/**
 * Pagination fields used by multiple endpoints.
 */
export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

/**
 * Budget constraint fields.
 */
export const BudgetFieldsSchema = z.object({
  maxBudget: z.number().positive().optional(),
  stretchBudget: z.number().positive().optional(),
});

/**
 * Rule override field.
 */
export const OverriddenRuleIdsSchema = z.object({
  overriddenRuleIds: z.array(z.string()).optional(),
});

/**
 * Reusable budget refinement configurations.
 * Apply these to any schema containing budget fields.
 */
export const budgetRefinements = {
  stretchRequiresMax: {
    refine: (data: { stretchBudget?: number; maxBudget?: number }) =>
      !(data.stretchBudget !== undefined && data.maxBudget === undefined),
    message: 'stretchBudget requires maxBudget to be set',
    path: ['stretchBudget'],
  },
  stretchGteMax: {
    refine: (data: { stretchBudget?: number; maxBudget?: number }) =>
      !(data.stretchBudget !== undefined && data.maxBudget !== undefined) ||
      data.stretchBudget! >= data.maxBudget!,
    message: 'stretchBudget must be greater than or equal to maxBudget',
    path: ['stretchBudget'],
  },
} as const;

// ============================================
// NESTED OBJECT SCHEMAS
// ============================================

/**
 * Skill requirement with per-skill proficiency thresholds.
 * - minProficiency: Hard filter (defaults to 'learning' = any level)
 * - preferredMinProficiency: Ranking boost if exceeded
 */
export const SkillRequirementSchema = z.object({
  skill: z.string(),
  minProficiency: ProficiencyLevelSchema.optional(),
  preferredMinProficiency: ProficiencyLevelSchema.optional(),
});

/**
 * Domain requirement with years of experience thresholds.
 * - minYears: Hard filter (must have at least this many years)
 * - preferredMinYears: Ranking boost if exceeded
 */
export const BusinessDomainRequirementSchema = z.object({
  domain: z.string(),
  minYears: z.number().int().min(0).optional(),
  preferredMinYears: z.number().int().min(0).optional(),
});

export const TechnicalDomainRequirementSchema = z.object({
  domain: z.string(),
  minYears: z.number().int().min(0).optional(),
  preferredMinYears: z.number().int().min(0).optional(),
});

// ============================================
// MAIN REQUEST SCHEMA
// ============================================

export const SearchFilterRequestSchema = z.object({
  // Seniority
  requiredSeniorityLevel: SeniorityLevelSchema.optional(),
  preferredSeniorityLevel: SeniorityLevelSchema.optional(),

  // Skills - now with per-skill proficiency requirements
  requiredSkills: z.array(SkillRequirementSchema).optional(),
  preferredSkills: z.array(SkillRequirementSchema).optional(),

  // Start timeline (threshold-based: "I need someone within X time")
  requiredMaxStartTime: StartTimelineSchema.optional(),
  preferredMaxStartTime: StartTimelineSchema.optional(),

  // Timezone (US zones: Eastern, Central, Mountain, Pacific)
  requiredTimezone: z.array(USTimezoneZoneSchema).optional(),
  preferredTimezone: z.array(USTimezoneZoneSchema).optional(),

  // Budget (job-centric, not engineer-centric)
  maxBudget: z.number().positive().optional(),
  stretchBudget: z.number().positive().optional(),

  // Context
  teamFocus: TeamFocusSchema.optional(),

  // Business Domains (Fintech, Healthcare, E-commerce, etc.)
  requiredBusinessDomains: z.array(BusinessDomainRequirementSchema).optional(),
  preferredBusinessDomains: z.array(BusinessDomainRequirementSchema).optional(),

  // Technical Domains (Backend, Frontend, ML, DevOps, etc.)
  requiredTechnicalDomains: z.array(TechnicalDomainRequirementSchema).optional(),
  preferredTechnicalDomains: z.array(TechnicalDomainRequirementSchema).optional(),

  // Rule Override - explicitly override inference rules by ID
  overriddenRuleIds: z.array(z.string()).optional(),

  // Optional: filter to a specific engineer (used by /explain endpoint)
  engineerId: z.string().optional(),

  // Pagination
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
}).refine(
  budgetRefinements.stretchRequiresMax.refine,
  {
    message: budgetRefinements.stretchRequiresMax.message,
    path: [...budgetRefinements.stretchRequiresMax.path],
  }
).refine(
  budgetRefinements.stretchGteMax.refine,
  {
    message: budgetRefinements.stretchGteMax.message,
    path: [...budgetRefinements.stretchGteMax.path],
  }
).refine(
  (data) => {
    if (data.preferredMaxStartTime && data.requiredMaxStartTime) {
      const order = START_TIMELINE_ORDER;
      return order.indexOf(data.preferredMaxStartTime) <= order.indexOf(data.requiredMaxStartTime);
    }
    return true;
  },
  {
    message: 'preferredMaxStartTime must be at or faster than requiredMaxStartTime',
    path: ['preferredMaxStartTime'],
  }
);

// ============================================
// INFERRED TYPES
// ============================================

export type SeniorityLevel = z.infer<typeof SeniorityLevelSchema>;
export type StartTimeline = z.infer<typeof StartTimelineSchema>;
export type ProficiencyLevel = z.infer<typeof ProficiencyLevelSchema>;
export type TeamFocus = z.infer<typeof TeamFocusSchema>;
export type USTimezoneZone = z.infer<typeof USTimezoneZoneSchema>;
export type SkillRequirement = z.infer<typeof SkillRequirementSchema>;
export type BusinessDomainRequirement = z.infer<typeof BusinessDomainRequirementSchema>;
export type TechnicalDomainRequirement = z.infer<typeof TechnicalDomainRequirementSchema>;
export type SearchFilterRequest = z.infer<typeof SearchFilterRequestSchema>;
