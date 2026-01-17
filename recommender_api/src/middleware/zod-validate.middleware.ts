/**
 * Generic Zod Validation Middleware
 * Creates Express middleware from Zod schemas.
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Creates a validation middleware for Express using a Zod schema.
 * Uses Zod's default error format.
 */
export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Empty objects are valid (unfiltered search)
      const body = req.body && Object.keys(req.body).length > 0
        ? req.body
        : {};

      // Parse and replace req.body with validated/typed data
      req.body = schema.parse(body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            issues: error.issues,
            name: 'ZodError',
          },
        });
        return;
      }
      throw error;
    }
  };
}

/**
 * Creates a validation middleware for URL params using a Zod schema.
 * Validates params and stores parsed result in res.locals.params.
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.params);
      res.locals.params = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            issues: error.issues,
            name: 'ZodError',
          },
        });
        return;
      }
      throw error;
    }
  };
}

/**
 * Creates a validation middleware for query params using a Zod schema.
 * Validates query and stores parsed result in res.locals.query.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query);
      res.locals.query = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            issues: error.issues,
            name: 'ZodError',
          },
        });
        return;
      }
      throw error;
    }
  };
}
