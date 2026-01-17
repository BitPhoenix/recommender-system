/**
 * Similarity Routes
 * Route definitions for the similar engineers endpoint.
 */

import { Router } from 'express';
import { getSimilarEngineers } from '../controllers/similarity.controller.js';
import { validateParams, validateQuery } from '../middleware/zod-validate.middleware.js';
import { SimilarEngineersParamsSchema, SimilarEngineersQuerySchema } from '../schemas/similarity.schema.js';

const router = Router();

/**
 * GET /api/engineers/:id/similar
 * Find engineers similar to the specified target engineer.
 *
 * Implements Chapter 5.3.1 (Case-Based Recommender Systems)
 */
router.get(
  '/:id/similar',
  validateParams(SimilarEngineersParamsSchema),
  validateQuery(SimilarEngineersQuerySchema),
  getSimilarEngineers
);

export default router;
