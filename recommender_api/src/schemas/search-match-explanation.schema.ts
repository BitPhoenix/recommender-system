import { z } from 'zod';
import { SearchFilterRequestSchema } from './search.schema.js';

export const ExplainRequestSchema = z.object({
  searchCriteria: SearchFilterRequestSchema,
});

export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;
