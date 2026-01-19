/**
 * Critique Controller
 *
 * Handles HTTP requests for the critique endpoint.
 */

import type { Request, Response } from 'express';
import driver from '../neo4j.js';
import { executeCritique } from '../services/critique.service.js';
import type { CritiqueRequest } from '../types/critique.types.js';

/**
 * POST /api/search/critique
 * Apply critiques to a base search and return refined results.
 */
export async function handleCritique(req: Request, res: Response): Promise<void> {
  const session = driver.session();

  try {
    const request = req.body as CritiqueRequest;
    const result = await executeCritique(session, request);
    res.json(result);
  } catch (error) {
    console.error('Critique error:', error);
    res.status(500).json({
      error: {
        code: 'CRITIQUE_ERROR',
        message: 'Failed to apply critique to search',
        details: error instanceof Error ? [{ field: 'internal', message: error.message }] : undefined,
      },
    });
  } finally {
    await session.close();
  }
}
