/**
 * Search Routes
 * Route definitions for the search API.
 */

import { Router } from 'express';
import { filterSearch } from '../controllers/search.controller.js';
import { filterSimilarity } from '../controllers/filter-similarity.controller.js';
import { handleCritique } from '../controllers/critique.controller.js';
import { validate } from '../middleware/zod-validate.middleware.js';
import { SearchFilterRequestSchema } from '../schemas/search.schema.js';
import { FilterSimilarityRequestSchema } from '../schemas/filter-similarity.schema.js';
import { CritiqueRequestSchema } from '../schemas/critique.schema.js';

const router = Router();

/**
 * POST /api/search/filter
 * Search for engineers based on manager requirements.
 *
 * Implements Chapter 5.2.1-5.2.3 (Constraint-Based Recommender Systems)
 */
router.post('/filter', validate(SearchFilterRequestSchema), filterSearch);

/**
 * POST /api/search/filter-similarity
 * Search for engineers matching constraints, ranked by similarity to a reference engineer.
 *
 * Implements Chapter 5.2 + 5.3 (Hybrid: Constraint-Based + Case-Based)
 */
router.post('/filter-similarity', validate(FilterSimilarityRequestSchema), filterSimilarity);

/**
 * POST /api/search/critique
 * Apply critique adjustments to a base search and return refined results.
 *
 * Implements Chapter 5.3.2 (Critiquing Methods)
 */
router.post('/critique', validate(CritiqueRequestSchema), handleCritique);

export default router;
