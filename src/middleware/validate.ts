import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';

export function validate(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors,
      });
      return;
    }

    req.body = result.data;
    next();
  };
}