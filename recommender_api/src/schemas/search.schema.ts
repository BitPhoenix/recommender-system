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

export const StartTimelineSchema = z.enum([
  'immediate', 'two_weeks', 'one_month', 'three_months', 'six_months', 'one_year'
]);

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

  // Salary (hard constraints)
  requiredMaxSalary: z.number().positive().optional(),
  requiredMinSalary: z.number().positive().optional(),
  preferredSalaryRange: PreferredSalaryRangeSchema.optional(),

  // Context
  teamFocus: TeamFocusSchema.optional(),

  // Domains (no per-domain proficiency)
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
).refine(
  (data) => {
    if (data.preferredMaxStartTime && data.requiredMaxStartTime) {
      const order = ['immediate', 'two_weeks', 'one_month', 'three_months', 'six_months', 'one_year'];
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
export type PreferredSalaryRange = z.infer<typeof PreferredSalaryRangeSchema>;
export type SkillRequirement = z.infer<typeof SkillRequirementSchema>;
export type SearchFilterRequest = z.infer<typeof SearchFilterRequestSchema>;
