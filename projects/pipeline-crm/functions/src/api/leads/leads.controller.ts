/**
 * Leads controller - HTTP request handlers.
 * Thin layer that delegates to service and formats responses.
 */

import { Request, Response } from "express";
import * as leadsService from "./leads.service";
import { ListLeadsQuery, CreateLeadBody, UpdateLeadBody } from "./leads.schema";

/**
 * GET /api/leads
 * List leads with pagination and filtering.
 */
export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListLeadsQuery;

  const result = await leadsService.listLeads(query);

  res.json({
    success: true,
    ...result,
  });
}

/**
 * GET /api/leads/stats
 * Get aggregated lead statistics.
 */
export async function stats(req: Request, res: Response): Promise<void> {
  const { type } = req.query as { type?: string };

  const result = await leadsService.getLeadsStats(type);

  res.json({
    success: true,
    data: result,
  });
}

/**
 * GET /api/leads/:id
 * Get a single lead by ID.
 */
export async function get(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const lead = await leadsService.getLead(id);

  res.json({
    success: true,
    data: lead,
  });
}

/**
 * POST /api/leads
 * Create a new lead.
 */
export async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateLeadBody;
  const createdBy = req.user?.uid || "unknown";

  const result = await leadsService.createLead(body, createdBy);

  res.status(201).json({
    success: true,
    data: result,
  });
}

/**
 * PATCH /api/leads/:id
 * Update an existing lead.
 */
export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body as UpdateLeadBody;

  await leadsService.updateLead(id, body);

  res.json({
    success: true,
    data: { id },
  });
}

/**
 * DELETE /api/leads/:id
 * Delete a lead and its associated data.
 */
export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  await leadsService.deleteLead(id);

  res.json({
    success: true,
    data: { id },
  });
}
