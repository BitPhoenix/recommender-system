import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validate } from './zod-validate.middleware.js';
import type { Request, Response, NextFunction } from 'express';

// Helper to create mock request/response
const createMockRequest = (body: unknown = {}): Partial<Request> => ({
  body,
});

const createMockResponse = (): Partial<Response> & { jsonData: unknown; statusCode: number } => {
  const res: Partial<Response> & { jsonData: unknown; statusCode: number } = {
    jsonData: null,
    statusCode: 200,
  };
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockImplementation((data: unknown) => {
    res.jsonData = data;
    return res;
  });
  return res;
};

describe('validate middleware', () => {
  const testSchema = z.object({
    name: z.string(),
    age: z.number().optional(),
  });

  it('calls next() for valid request body', () => {
    const middleware = validate(testSchema);
    const req = createMockRequest({ name: 'test' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('transforms body with parsed schema data', () => {
    const schemaWithTransform = z.object({
      name: z.string().transform(s => s.toUpperCase()),
    });
    const middleware = validate(schemaWithTransform);
    const req = createMockRequest({ name: 'test' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(req.body).toEqual({ name: 'TEST' });
  });

  it('returns 400 for invalid request body', () => {
    const middleware = validate(testSchema);
    const req = createMockRequest({ age: 'not a number' }); // missing required 'name'
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns ZodError details in response', () => {
    const middleware = validate(testSchema);
    const req = createMockRequest({ name: 123 }); // wrong type
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(res.jsonData).toMatchObject({
      success: false,
      error: {
        name: 'ZodError',
        issues: expect.any(Array),
      },
    });
  });

  it('treats empty object as valid for optional schemas', () => {
    const optionalSchema = z.object({
      name: z.string().optional(),
    });
    const middleware = validate(optionalSchema);
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('treats undefined body as empty object', () => {
    const optionalSchema = z.object({
      name: z.string().optional(),
    });
    const middleware = validate(optionalSchema);
    const req = createMockRequest(undefined);
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('includes all validation issues in error response', () => {
    const strictSchema = z.object({
      name: z.string().min(3),
      email: z.string().email(),
    });
    const middleware = validate(strictSchema);
    const req = createMockRequest({ name: 'ab', email: 'not-an-email' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(res.jsonData).toMatchObject({
      success: false,
      error: {
        name: 'ZodError',
        issues: expect.any(Array),
      },
    });
    // Should have issues for both fields
    const issues = (res.jsonData as { error: { issues: unknown[] } }).error.issues;
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });

  it('handles nested object validation', () => {
    const nestedSchema = z.object({
      user: z.object({
        name: z.string(),
        settings: z.object({
          theme: z.enum(['light', 'dark']),
        }),
      }),
    });
    const middleware = validate(nestedSchema);

    // Valid nested object
    const validReq = createMockRequest({
      user: { name: 'test', settings: { theme: 'dark' } },
    });
    const validRes = createMockResponse();
    const validNext = vi.fn();

    middleware(validReq as Request, validRes as Response, validNext);
    expect(validNext).toHaveBeenCalled();

    // Invalid nested object
    const invalidReq = createMockRequest({
      user: { name: 'test', settings: { theme: 'blue' } },
    });
    const invalidRes = createMockResponse();
    const invalidNext = vi.fn();

    middleware(invalidReq as Request, invalidRes as Response, invalidNext);
    expect(invalidRes.status).toHaveBeenCalledWith(400);
    expect(invalidNext).not.toHaveBeenCalled();
  });

  it('handles array validation', () => {
    const arraySchema = z.object({
      items: z.array(z.string()),
    });
    const middleware = validate(arraySchema);

    // Valid array
    const validReq = createMockRequest({ items: ['a', 'b', 'c'] });
    const validRes = createMockResponse();
    const validNext = vi.fn();

    middleware(validReq as Request, validRes as Response, validNext);
    expect(validNext).toHaveBeenCalled();

    // Invalid array (contains non-string)
    const invalidReq = createMockRequest({ items: ['a', 123, 'c'] });
    const invalidRes = createMockResponse();
    const invalidNext = vi.fn();

    middleware(invalidReq as Request, invalidRes as Response, invalidNext);
    expect(invalidRes.status).toHaveBeenCalledWith(400);
  });

  it('handles refinements (cross-field validation)', () => {
    const refinedSchema = z.object({
      password: z.string(),
      confirmPassword: z.string(),
    }).refine(data => data.password === data.confirmPassword, {
      message: 'Passwords must match',
      path: ['confirmPassword'],
    });
    const middleware = validate(refinedSchema);

    // Valid (matching passwords)
    const validReq = createMockRequest({ password: 'secret', confirmPassword: 'secret' });
    const validRes = createMockResponse();
    const validNext = vi.fn();

    middleware(validReq as Request, validRes as Response, validNext);
    expect(validNext).toHaveBeenCalled();

    // Invalid (non-matching passwords)
    const invalidReq = createMockRequest({ password: 'secret', confirmPassword: 'different' });
    const invalidRes = createMockResponse();
    const invalidNext = vi.fn();

    middleware(invalidReq as Request, invalidRes as Response, invalidNext);
    expect(invalidRes.status).toHaveBeenCalledWith(400);
    const issues = (invalidRes.jsonData as { error: { issues: Array<{ message: string }> } }).error.issues;
    expect(issues.some(i => i.message === 'Passwords must match')).toBe(true);
  });

  it('strips unknown keys (default Zod behavior)', () => {
    const strictSchema = z.object({
      name: z.string(),
    });
    const middleware = validate(strictSchema);
    const req = createMockRequest({ name: 'test', unknownKey: 'should be stripped' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'test' });
    expect(req.body).not.toHaveProperty('unknownKey');
  });

  it('provides meaningful path information in error', () => {
    const nestedSchema = z.object({
      user: z.object({
        contact: z.object({
          email: z.string().email(),
        }),
      }),
    });
    const middleware = validate(nestedSchema);
    const req = createMockRequest({
      user: { contact: { email: 'invalid' } },
    });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    const issues = (res.jsonData as { error: { issues: Array<{ path: (string | number)[] }> } }).error.issues;
    expect(issues[0].path).toEqual(['user', 'contact', 'email']);
  });
});
