/**
 * Similarity Controller
 * HTTP handlers for the similar engineers endpoint.
 */

import type { Request, Response } from 'express';
import driver from '../neo4j.js';
import { findSimilarEngineers } from '../services/similarity.service.js';
import type { SimilarEngineersParams, SimilarEngineersQuery } from '../schemas/similarity.schema.js';

/**
 * GET /api/engineers/:id/similar
 * Returns engineers similar to the specified target engineer.
 */
export async function getSimilarEngineers(
  req: Request,
  res: Response
): Promise<void> {
  const session = driver.session();

  try {
    const { id } = res.locals.params as SimilarEngineersParams;
    const { limit } = res.locals.query as SimilarEngineersQuery;

    const result = await findSimilarEngineers(session, id, limit);

    res.status(200).json(result);
  } catch (error) {
    console.error('getSimilarEngineers error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: {
          code: 'ENGINEER_NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'SIMILARITY_ERROR',
        message: 'Failed to find similar engineers',
        details: error instanceof Error ? [{ field: 'internal', message: error.message }] : undefined,
      },
    });
  } finally {
    await session.close();
  }
}
