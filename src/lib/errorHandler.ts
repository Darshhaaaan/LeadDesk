import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../lib/errors';
import { sendError } from '../lib/response';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  next(new ApiError(404, 'NOT_FOUND', 'Route not found.'));
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ApiError) {
    sendError(res, err);
    return;
  }

  console.error('Unhandled error:', err instanceof Error ? err.message : err);
  sendError(res, new ApiError(500, 'INTERNAL_ERROR', 'Internal server error.'));
};
