import { Request, Response, NextFunction } from 'express';

function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  // Basic structured error logging - adapt to your logger if needed
  console.error('Error:', err?.message ?? err);

  const status = err?.status || 500;
  const message = err?.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    // In non-production environments include stack for debugging
    ...(process.env.NODE_ENV !== 'production' && { stack: err?.stack }),
  });
}

export default errorHandler;
