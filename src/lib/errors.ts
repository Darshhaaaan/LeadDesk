export class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }
}

export const badRequest = (code: string, message: string): ApiError => new ApiError(400, code, message);

export const unauthorized = (code: string, message: string): ApiError => new ApiError(401, code, message);

export const forbidden = (code: string, message: string): ApiError => new ApiError(403, code, message);

export const conflict = (code: string, message: string): ApiError => new ApiError(409, code, message);

export const notFound = (code: string, message: string): ApiError => new ApiError(404, code, message);

export const tooManyRequests = (message = 'Too many requests. Please try again later.'): ApiError =>
  new ApiError(429, 'RATE_LIMITED', message);
