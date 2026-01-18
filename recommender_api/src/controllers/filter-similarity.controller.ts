/**
 * Filter-Similarity Controller
 * Handles HTTP layer for POST /api/search/filter-similarity
 */

import type { Request, Response } from 'express';
import driver from '../neo4j.js';
import {
  executeFilterSimilarity,
  EngineerNotFoundError,
} from '../services/filter-similarity.service.js';
import type { FilterSimilarityRequest } from '../schemas/filter-similarity.schema.js';

/**
 * POST /api/search/filter-similarity
 * Searches for engineers matching constraints, ranked by similarity to a reference engineer.
 */
export async function filterSimilarity(req: Request, res: Response): Promise<void> {
  const session = driver.session();

  try {
    const request = req.body as FilterSimilarityRequest;
    const result = await executeFilterSimilarity(session, request);
    res.json(result);
  } catch (error) {
    if (error instanceof EngineerNotFoundError) {
      res.status(404).json({
        error: {
          code: 'ENGINEER_NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }

    console.error('Filter-similarity error:', error);
    res.status(500).json({
      error: {
        code: 'FILTER_SIMILARITY_ERROR',
        message: 'Failed to find similar engineers matching constraints',
        details: error instanceof Error ? [{ field: 'internal', message: error.message }] : undefined,
      },
    });
  } finally {
    await session.close();
  }
}
