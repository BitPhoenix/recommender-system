/**
 * Search Routes
 * Route definitions for the search API.
 */

import { Router } from 'express';
import { filterSearch } from '../controllers/search.controller.js';
import { validateSearchRequest } from '../middleware/validate-search.middleware.js';

const router = Router();

/**
 * POST /api/search/filter
 * Search for engineers based on manager requirements.
 *
 * Implements Chapter 5.2.1-5.2.3 (Constraint-Based Recommender Systems)
 */
router.post('/filter', validateSearchRequest, filterSearch);

export default router;
