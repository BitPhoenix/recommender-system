/**
 * Filter-Similarity API Schema
 * Combines constraint filtering (5.2) with similarity ranking (5.3).
 *
 * This endpoint takes hard constraints (required* fields) plus a reference
 * engineer ID, and returns candidates ranked by similarity to the reference.
 */

import { z } from 'zod';
import {
  SeniorityLevelSchema,
  StartTimelineSchema,
  USTimezoneZoneSchema,
  SkillRequirementSchema,
  BusinessDomainRequirementSchema,
  TechnicalDomainRequirementSchema,
  PaginationSchema,
  budgetRefinements,
} from './search.schema.js';

const FilterSimilarityBaseSchema = z.object({
  // Hard constraints (subset of /filter - no preferred* fields)
  requiredSkills: z.array(SkillRequirementSchema).optional(),
  requiredSeniorityLevel: SeniorityLevelSchema.optional(),
  requiredMaxStartTime: StartTimelineSchema.optional(),
  requiredTimezone: z.array(USTimezoneZoneSchema).optional(),
  maxBudget: z.number().positive().optional(),
  stretchBudget: z.number().positive().optional(),
  requiredBusinessDomains: z.array(BusinessDomainRequirementSchema).optional(),
  requiredTechnicalDomains: z.array(TechnicalDomainRequirementSchema).optional(),

  // Reference engineer (REQUIRED)
  referenceEngineerId: z.string().min(1, 'referenceEngineerId is required'),

  // Inference rule override (same as /filter)
  overriddenRuleIds: z.array(z.string()).optional(),
});

export const FilterSimilarityRequestSchema = FilterSimilarityBaseSchema
  .merge(PaginationSchema)
  .refine(
    budgetRefinements.stretchRequiresMax.refine,
    {
      message: budgetRefinements.stretchRequiresMax.message,
      path: [...budgetRefinements.stretchRequiresMax.path],
    }
  )
  .refine(
    budgetRefinements.stretchGteMax.refine,
    {
      message: budgetRefinements.stretchGteMax.message,
      path: [...budgetRefinements.stretchGteMax.path],
    }
  );

export type FilterSimilarityRequest = z.infer<typeof FilterSimilarityRequestSchema>;
