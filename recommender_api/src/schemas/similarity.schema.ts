/**
 * Similarity Request Schema
 */

import { z } from 'zod';

export const SimilarEngineersParamsSchema = z.object({
  id: z.string().min(1, 'Engineer ID is required'),
});

export const SimilarEngineersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type SimilarEngineersParams = z.infer<typeof SimilarEngineersParamsSchema>;
export type SimilarEngineersQuery = z.infer<typeof SimilarEngineersQuerySchema>;
