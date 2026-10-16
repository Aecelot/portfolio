/**
 * Hook for fetching paginated leads list.
 * Uses TanStack Query for caching, polling, and state management.
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { leadsApi, type LeadsListParams, type LeadsListResponse } from "@/api";

export interface UseLeadsListOptions extends LeadsListParams {
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
}

export interface UseLeadsListReturn {
  /** List of leads for the current page */
  leads: LeadsListResponse["data"];
  /** Pagination metadata */
  pagination: LeadsListResponse["pagination"] | undefined;
  /** Loading state (initial load) */
  isLoading: boolean;
  /** Fetching state (includes background refetches) */
  isFetching: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => void;
}

/**
 * Hook for fetching a paginated list of leads.
 *
 * Features:
 * - Automatic polling every 15 seconds
 * - Keeps previous data while fetching new page
 * - Type-safe parameters and response
 *
 * @example
 * const { leads, pagination, isLoading } = useLeadsList({
 *   page: 1,
 *   limit: 50,
 *   type: "studio",
 * });
 */
export function useLeadsList(
  options: UseLeadsListOptions = {}
): UseLeadsListReturn {
  const { enabled = true, ...params } = options;

  // Build query params with defaults
  const queryParams: LeadsListParams = {
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
  };

  const query = useQuery({
    queryKey: queryKeys.leads.list(queryParams),
    queryFn: () => leadsApi.listLeads(queryParams),
    enabled,
    // Keep showing previous page data while loading new page
    placeholderData: keepPreviousData,
  });

  return {
    leads: query.data?.data ?? [],
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for fetching lead statistics.
 */
export function useLeadsStats(type?: "studio" | "publisher" | "investor" | "community") {
  return useQuery({
    queryKey: queryKeys.leads.stats(type),
    queryFn: () => leadsApi.getLeadsStats(type),
  });
}
