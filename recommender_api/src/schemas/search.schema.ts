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

export const START_TIMELINE_ORDER = [
  'immediate', 'two_weeks', 'one_month', 'three_months', 'six_months', 'one_year'
] as const;

export const StartTimelineSchema = z.enum(START_TIMELINE_ORDER);

export const PROFICIENCY_LEVEL_ORDER = ['learning', 'proficient', 'expert'] as const;

export const ProficiencyLevelSchema = z.enum(PROFICIENCY_LEVEL_ORDER);

export const TeamFocusSchema = z.enum([
  'greenfield', 'migration', 'maintenance', 'scaling'
]);

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

  // Timezone (glob patterns, e.g., "America/*" for any US timezone)
  requiredTimezone: z.array(z.string()).optional(),
  preferredTimezone: z.array(z.string()).optional(),

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

  // Pagination
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
}).refine(
  (data) => {
    if (data.stretchBudget !== undefined && data.maxBudget === undefined) {
      return false;  // stretchBudget requires maxBudget
    }
    return true;
  },
  {
    message: 'stretchBudget requires maxBudget to be set',
    path: ['stretchBudget'],
  }
).refine(
  (data) => {
    if (data.stretchBudget !== undefined && data.maxBudget !== undefined) {
      return data.stretchBudget >= data.maxBudget;
    }
    return true;
  },
  {
    message: 'stretchBudget must be greater than or equal to maxBudget',
    path: ['stretchBudget'],
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
export type SkillRequirement = z.infer<typeof SkillRequirementSchema>;
export type BusinessDomainRequirement = z.infer<typeof BusinessDomainRequirementSchema>;
export type TechnicalDomainRequirement = z.infer<typeof TechnicalDomainRequirementSchema>;
export type SearchFilterRequest = z.infer<typeof SearchFilterRequestSchema>;
