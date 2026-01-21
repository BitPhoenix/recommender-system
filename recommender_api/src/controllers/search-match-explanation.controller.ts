import { Request, Response, NextFunction } from 'express';
import { ExplainRequestSchema } from '../schemas/search-match-explanation.schema.js';
import { generateSearchMatchExplanation } from '../services/search-match-explanation/search-match-explanation.service.js';
import driver from '../neo4j.js';
import { ZodError } from 'zod';

export async function explainFilterMatch(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const session = driver.session();

  try {
    const engineerId = req.params.engineerId;
    if (!engineerId) {
      res.status(400).json({ error: 'Engineer ID is required' });
      return;
    }

    const validatedBody = ExplainRequestSchema.parse(req.body);

    const explanation = await generateSearchMatchExplanation(session, {
      engineerId,
      searchCriteria: validatedBody.searchCriteria,
    });

    res.json(explanation);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    if (error instanceof Error && error.message.includes('does not match')) {
      res.status(404).json({ error: error.message });
      return;
    }

    next(error);
  } finally {
    await session.close();
  }
}
