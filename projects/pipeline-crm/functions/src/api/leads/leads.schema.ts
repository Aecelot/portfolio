/**
 * Zod validation schemas for leads API endpoints.
 */

import { z } from "zod";

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

const leadTypeSchema = z.enum(["studio", "publisher", "investor", "community"]);
const prioritySchema = z.enum(["high", "medium", "low", "none"]);
const categorySchema = z.enum(["prospect", "lead"]);
const orderSchema = z.enum(["asc", "desc"]);

const contactSchema = z.object({
  name: z.string(),
  role: z.string(),
  email: z.string().email().or(z.literal("")),
  phone: z.string(),
  linkedin: z.string(),
});

const pipelineSchema = z.object({
  pipelineId: z.string(),
  stageId: z.string(),
});

// =============================================================================
// LIST LEADS
// =============================================================================

export const listLeadsSchema = z.object({
  // Pagination
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sort: z.enum(["createdAt", "updatedAt", "name", "priority"]).default("createdAt"),
  order: orderSchema.default("desc"),

  // Filters
  type: leadTypeSchema.optional(),
  category: categorySchema.optional(),
  status: z.string().optional(),
  priority: prioritySchema.optional(),
  owner: z.string().optional(),
  search: z.string().optional(),
  pipelineStage: z.string().optional(),
});

export type ListLeadsQuery = z.infer<typeof listLeadsSchema>;

// =============================================================================
// GET LEAD BY ID
// =============================================================================

export const getLeadParamsSchema = z.object({
  id: z.string().min(1, "Lead ID is required"),
});

export type GetLeadParams = z.infer<typeof getLeadParamsSchema>;

// =============================================================================
// CREATE LEAD
// =============================================================================

export const createLeadSchema = z.object({
  type: leadTypeSchema,
  name: z.string().min(1, "Name is required"),
  status: z.string().min(1, "Status is required"),
  priority: prioritySchema,
  category: categorySchema.optional(),
  owner: z.string().min(1, "Owner is required"),
  website: z.string().optional().default(""),
  country: z.string().optional().default(""),
  location: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().optional().default(""),
  contact: contactSchema.optional(),
  pipeline: pipelineSchema.optional(),

  // Type-specific info (validated loosely, full validation in service)
  studio: z.record(z.unknown()).optional(),
  investor: z.record(z.unknown()).optional(),
  community: z.record(z.unknown()).optional(),
});

export type CreateLeadBody = z.infer<typeof createLeadSchema>;

// =============================================================================
// UPDATE LEAD
// =============================================================================

export const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  type: leadTypeSchema.optional(),
  status: z.string().optional(),
  priority: prioritySchema.optional(),
  category: categorySchema.optional(),
  owner: z.string().optional(),
  website: z.string().optional(),
  country: z.string().optional(),
  location: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  contact: contactSchema.partial().optional(),
  pipeline: pipelineSchema.partial().optional(),
  ownerNotes: z.array(z.object({
    author: z.string(),
    content: z.string(),
    updatedAt: z.unknown(),
  })).optional(),

  // Type-specific info
  studio: z.record(z.unknown()).optional(),
  investor: z.record(z.unknown()).optional(),
  community: z.record(z.unknown()).optional(),
});

export type UpdateLeadBody = z.infer<typeof updateLeadSchema>;

// =============================================================================
// DELETE LEAD
// =============================================================================

export const deleteLeadParamsSchema = z.object({
  id: z.string().min(1, "Lead ID is required"),
});

export type DeleteLeadParams = z.infer<typeof deleteLeadParamsSchema>;

// =============================================================================
// STATS
// =============================================================================

export const leadsStatsSchema = z.object({
  type: leadTypeSchema.optional(),
});

export type LeadsStatsQuery = z.infer<typeof leadsStatsSchema>;
