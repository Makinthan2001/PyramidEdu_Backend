// ============================================================
// src/middleware/validate.ts
// Generic request-validation middleware.
// Usage: router.post('/login', validate(loginSchema), loginController)
//
// On success  → calls next() and the parsed data sits in req.body
// On failure  → returns 422 with a structured list of field errors
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Convert ZodError into a developer-friendly array of { field, message }
      const errors = (result.error as ZodError).errors.map((e) => ({
        field:   e.path.join('.'),
        message: e.message,
      }));

      res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors,
      });
      return;
    }

    // Replace req.body with the validated & coerced data
    req.body = result.data;
    next();
  };
}
