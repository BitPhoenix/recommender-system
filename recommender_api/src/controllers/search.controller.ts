/**
 * Search Controller
 * HTTP handlers for the search API endpoints.
 */

import type { Request, Response } from 'express';
import driver from '../neo4j.js';
import { executeSearch } from '../services/search.service.js';
import type { SearchFilterRequest, SearchErrorResponse } from '../types/search.types.js';

/**
 * POST /api/search/filter
 * Searches for engineers based on manager requirements.
 */
export async function filterSearch(req: Request, res: Response): Promise<void> {
  const session = driver.session();

  try {
    const request: SearchFilterRequest = req.body;

    const response = await executeSearch(session, request);

    res.status(200).json(response);
  } catch (error) {
    console.error('Search error:', error);

    const errorResponse: SearchErrorResponse = {
      error: {
        code: 'SEARCH_ERROR',
        message: 'An error occurred while processing the search request',
        details: error instanceof Error ? [{ field: 'internal', message: error.message }] : undefined,
      },
    };

    res.status(500).json(errorResponse);
  } finally {
    await session.close();
  }
}
