/**
 * Request validation middleware using Zod.
 * Validates query params, body, and path params.
 */

import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

type ValidationTarget = "query" | "body" | "params";

/**
 * Create a validation middleware for a specific request target.
 *
 * @param schema - Zod schema to validate against
 * @param target - Which part of the request to validate
 * @returns Express middleware function
 *
 * @example
 * router.get('/leads', validate(listLeadsSchema, 'query'), leadsController.list);
 * router.post('/leads', validate(createLeadSchema, 'body'), leadsController.create);
 */
export function validate(schema: ZodSchema, target: ValidationTarget = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[target];
      const parsed = schema.parse(data);

      // Replace target data with parsed (and transformed) values
      // This ensures coerced values (e.g., string "1" to number 1) are available
      (req as unknown as Record<string, unknown>)[target] = parsed;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: error.errors.map((e) => ({
              path: e.path.join("."),
              message: e.message,
              code: e.code,
            })),
          },
        });
        return;
      }

      // Re-throw non-Zod errors
      next(error);
    }
  };
}

/**
 * Validate multiple targets at once.
 *
 * @example
 * router.put('/leads/:id',
 *   validateMultiple({
 *     params: idParamSchema,
 *     body: updateLeadSchema,
 *   }),
 *   leadsController.update
 * );
 */
export function validateMultiple(
  schemas: Partial<Record<ValidationTarget, ZodSchema>>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Array<{ target: string; path: string; message: string }> = [];

    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      try {
        const data = req[target as ValidationTarget];
        const parsed = schema.parse(data);
        (req as unknown as Record<string, unknown>)[target] = parsed;
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...error.errors.map((e) => ({
              target,
              path: e.path.join("."),
              message: e.message,
            }))
          );
        } else {
          // Re-throw non-Zod errors immediately
          next(error);
          return;
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: errors,
        },
      });
      return;
    }

    next();
  };
}
