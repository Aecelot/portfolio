/**
 * Leads API routes.
 */

import { Router } from "express";
import * as leadsController from "./leads.controller";
import { asyncHandler } from "../middleware/error-handler";
import { validate, validateMultiple } from "../middleware/validate";
import {
  listLeadsSchema,
  getLeadParamsSchema,
  createLeadSchema,
  updateLeadSchema,
  deleteLeadParamsSchema,
  leadsStatsSchema,
} from "./leads.schema";

const router = Router();

/**
 * GET /api/leads
 * List leads with pagination and filtering.
 */
router.get(
  "/",
  validate(listLeadsSchema, "query"),
  asyncHandler(leadsController.list)
);

/**
 * GET /api/leads/stats
 * Get aggregated lead statistics.
 * Note: Must be before /:id route to avoid matching "stats" as an ID.
 */
router.get(
  "/stats",
  validate(leadsStatsSchema, "query"),
  asyncHandler(leadsController.stats)
);

/**
 * GET /api/leads/:id
 * Get a single lead by ID.
 */
router.get(
  "/:id",
  validate(getLeadParamsSchema, "params"),
  asyncHandler(leadsController.get)
);

/**
 * POST /api/leads
 * Create a new lead.
 */
router.post(
  "/",
  validate(createLeadSchema, "body"),
  asyncHandler(leadsController.create)
);

/**
 * PATCH /api/leads/:id
 * Update an existing lead.
 */
router.patch(
  "/:id",
  validateMultiple({
    params: getLeadParamsSchema,
    body: updateLeadSchema,
  }),
  asyncHandler(leadsController.update)
);

/**
 * DELETE /api/leads/:id
 * Delete a lead and its associated data.
 */
router.delete(
  "/:id",
  validate(deleteLeadParamsSchema, "params"),
  asyncHandler(leadsController.remove)
);

export default router;
