/**
 * Shared API types for pagination, requests, and responses.
 * These types are used by both backend (Cloud Functions) and frontend.
 */

// =============================================================================
// PAGINATION
// =============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// =============================================================================
// LEAD FILTERS
// =============================================================================

export interface LeadFiltersParams {
  type?: 'studio' | 'publisher' | 'investor' | 'community';
  category?: 'prospect' | 'lead';
  status?: string;
  priority?: 'high' | 'medium' | 'low' | 'none';
  owner?: string;
  search?: string;
  pipelineStage?: string;
}

export interface LeadsListParams extends PaginationParams {
  filters?: LeadFiltersParams;
}

// =============================================================================
// API RESPONSES
// =============================================================================

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// =============================================================================
// LEAD API TYPES
// =============================================================================

export interface LeadListItem {
  id: string;
  type: 'studio' | 'publisher' | 'investor' | 'community';
  name: string;
  status: string;
  priority: 'high' | 'medium' | 'low' | 'none';
  category?: 'prospect' | 'lead';
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
  // Type-specific summary fields
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
  createdAt: string;
  updatedAt: string;
}

export interface LeadStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  recentlyUpdated: number;
}

// =============================================================================
// MUTATION TYPES
// =============================================================================

export interface CreateLeadRequest {
  type: 'studio' | 'publisher' | 'investor' | 'community';
  name: string;
  status: string;
  priority: 'high' | 'medium' | 'low' | 'none';
  category?: 'prospect' | 'lead';
  owner: string;
  website?: string;
  country?: string;
  location?: string;
  tags?: string[];
  notes?: string;
  contact?: {
    name: string;
    role: string;
    email: string;
    phone: string;
    linkedin: string;
  };
  studio?: unknown;
  investor?: unknown;
  community?: unknown;
  pipeline?: {
    pipelineId: string;
    stageId: string;
  };
}

export interface UpdateLeadRequest {
  name?: string;
  status?: string;
  priority?: 'high' | 'medium' | 'low' | 'none';
  category?: 'prospect' | 'lead';
  owner?: string;
  website?: string;
  country?: string;
  location?: string;
  tags?: string[];
  notes?: string;
  contact?: {
    name?: string;
    role?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
  };
  studio?: unknown;
  investor?: unknown;
  community?: unknown;
  pipeline?: {
    pipelineId?: string;
    stageId?: string;
  };
}
