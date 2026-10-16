/**
 * Leads API functions.
 * Type-safe API calls for lead operations.
 */

import { get, post, patch, del } from "./client";
import type { Lead } from "@/types/lead";

// =============================================================================
// TYPES
// =============================================================================

export interface LeadListItem {
  id: string;
  type: "studio" | "publisher" | "investor" | "community" | "competition";
  name: string;
  status: string;
  priority: "high" | "medium" | "low" | "none";
  category?: "prospect" | "lead";
  owner: string;
  website: string;
  country: string;
  tags: string[];
  pipeline: {
    pipelineId: string;
    stageId: string;
  };
  contact?: {
    name: string;
    email: string;
  };
  studio?: {
    size: string;
    fitScore: number;
  };
  investor?: {
    type: string;
    fitScore?: number;
  };
  community?: {
    platform: string;
    estimatedReach: number;
    fitScore: number;
  };
  competition?: {
    targetMarket: string;
    threatLevel: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface LeadsListResponse {
  success: boolean;
  data: LeadListItem[];
  pagination: PaginationMeta;
}

export interface LeadResponse {
  success: boolean;
  data: Lead;
}

export interface CreateLeadResponse {
  success: boolean;
  data: { id: string };
}

export interface LeadsStatsResponse {
  success: boolean;
  data: {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    recentlyUpdated: number;
  };
}

export interface LeadsListParams {
  page?: number;
  limit?: number;
  sort?: "createdAt" | "updatedAt" | "name" | "priority";
  order?: "asc" | "desc";
  type?: "studio" | "publisher" | "investor" | "community" | "competition";
  category?: "prospect" | "lead";
  status?: string;
  priority?: "high" | "medium" | "low" | "none";
  owner?: string;
  search?: string;
  pipelineStage?: string;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * List leads with pagination and filtering.
 */
export function listLeads(params: LeadsListParams = {}): Promise<LeadsListResponse> {
  return get<LeadsListResponse>("/leads", {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    sort: params.sort ?? "createdAt",
    order: params.order ?? "desc",
    type: params.type,
    category: params.category,
    status: params.status,
    priority: params.priority,
    owner: params.owner,
    search: params.search,
    pipelineStage: params.pipelineStage,
  });
}

/**
 * Get a single lead by ID.
 */
export function getLead(id: string): Promise<LeadResponse> {
  return get<LeadResponse>(`/leads/${id}`);
}

/**
 * Create a new lead.
 */
export function createLead(
  data: Omit<Lead, "id" | "createdAt" | "updatedAt" | "createdBy">
): Promise<CreateLeadResponse> {
  return post<CreateLeadResponse>("/leads", data);
}

/**
 * Update data type - allows partial updates including nested objects.
 */
export type UpdateLeadData = {
  [K in keyof Lead]?: Lead[K] extends object
    ? Partial<Lead[K]>
    : Lead[K];
};

/**
 * Update an existing lead.
 */
export function updateLead(
  id: string,
  data: UpdateLeadData
): Promise<{ success: boolean; data: { id: string } }> {
  return patch(`/leads/${id}`, data);
}

/**
 * Delete a lead.
 */
export function deleteLead(
  id: string
): Promise<{ success: boolean; data: { id: string } }> {
  return del(`/leads/${id}`);
}

/**
 * Get lead statistics.
 */
export function getLeadsStats(
  type?: "studio" | "publisher" | "investor" | "community"
): Promise<LeadsStatsResponse> {
  return get<LeadsStatsResponse>("/leads/stats", { type });
}
