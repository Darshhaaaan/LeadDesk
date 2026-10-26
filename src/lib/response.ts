import type { Response } from 'express';
import { ApiError } from './errors';

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

export const sendSuccess = <T>(res: Response, status: number, data: T): void => {
  res.status(status).json({ success: true, data } satisfies ApiSuccessBody<T>);
};

export const sendError = (res: Response, error: ApiError): void => {
  res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message } } satisfies ApiErrorBody);
};
