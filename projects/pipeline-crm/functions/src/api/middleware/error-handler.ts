/**
 * Global error handler middleware for Express.
 * Provides consistent error responses across all API endpoints.
 */

import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

/**
 * Custom API error class for throwing typed errors.
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }

  static unauthorized(message = "Unauthorized"): ApiError {
    return new ApiError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "Forbidden"): ApiError {
    return new ApiError(403, "FORBIDDEN", message);
  }

  static notFound(resource = "Resource"): ApiError {
    return new ApiError(404, "NOT_FOUND", `${resource} not found`);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, "CONFLICT", message);
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError(500, "INTERNAL_ERROR", message);
  }
}

/**
 * Global error handler middleware.
 * Handles ApiError, ZodError, and unknown errors.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[API Error]", {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
  });

  // Handle custom API errors
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Handle Firebase errors
  if (err.name === "FirebaseError" || (err as unknown as { code?: string }).code?.startsWith("auth/")) {
    res.status(401).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Authentication failed",
      },
    });
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err.message,
    },
  });
}

/**
 * Async handler wrapper to catch async errors.
 * Wraps async route handlers to forward errors to error middleware.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
