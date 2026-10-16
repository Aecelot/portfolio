/**
 * Hook for lead mutations (create, update, delete).
 * Uses TanStack Query mutations with automatic cache invalidation.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { leadsApi, type UpdateLeadData } from "@/api";
import type { Lead } from "@/types/lead";

export interface UseLeadMutationsReturn {
  /** Create a new lead */
  createLead: {
    mutate: (data: Omit<Lead, "id" | "createdAt" | "updatedAt" | "createdBy">) => void;
    mutateAsync: (data: Omit<Lead, "id" | "createdAt" | "updatedAt" | "createdBy">) => Promise<{ id: string }>;
    isPending: boolean;
    error: Error | null;
  };
  /** Update an existing lead */
  updateLead: {
    mutate: (params: { id: string; data: UpdateLeadData }) => void;
    mutateAsync: (params: { id: string; data: UpdateLeadData }) => Promise<{ id: string }>;
    isPending: boolean;
    error: Error | null;
  };
  /** Delete a lead */
  deleteLead: {
    mutate: (id: string) => void;
    mutateAsync: (id: string) => Promise<{ id: string }>;
    isPending: boolean;
    error: Error | null;
  };
}

/**
 * Hook providing mutations for lead operations.
 *
 * All mutations automatically invalidate relevant queries on success,
 * ensuring the UI stays in sync with the server.
 *
 * @example
 * const { createLead, updateLead, deleteLead } = useLeadMutations();
 *
 * // Create
 * createLead.mutate({ name: "New Lead", type: "studio", ... });
 *
 * // Update
 * updateLead.mutate({ id: "lead-id", data: { name: "Updated" } });
 *
 * // Delete
 * deleteLead.mutate("lead-id");
 */
export function useLeadMutations(): UseLeadMutationsReturn {
  const queryClient = useQueryClient();

  // Create mutation
  const create = useMutation({
    mutationFn: (data: Omit<Lead, "id" | "createdAt" | "updatedAt" | "createdBy">) =>
      leadsApi.createLead(data),
    onSuccess: () => {
      // Invalidate all lead lists to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.stats() });
    },
  });

  // Update mutation
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLeadData }) =>
      leadsApi.updateLead(id, data),
    onSuccess: (_result, variables) => {
      // Invalidate the specific lead detail
      queryClient.invalidateQueries({
        queryKey: queryKeys.leads.detail(variables.id),
      });
      // Invalidate all lists (in case name/status changed affecting display)
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.stats() });
    },
  });

  // Delete mutation
  const remove = useMutation({
    mutationFn: (id: string) => leadsApi.deleteLead(id),
    onSuccess: (_result, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.leads.detail(id) });
      // Invalidate all lists
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.stats() });
    },
  });

  return {
    createLead: {
      mutate: create.mutate,
      mutateAsync: async (data) => {
        const result = await create.mutateAsync(data);
        return result.data;
      },
      isPending: create.isPending,
      error: create.error,
    },
    updateLead: {
      mutate: update.mutate,
      mutateAsync: async (params) => {
        const result = await update.mutateAsync(params);
        return result.data;
      },
      isPending: update.isPending,
      error: update.error,
    },
    deleteLead: {
      mutate: remove.mutate,
      mutateAsync: async (id) => {
        const result = await remove.mutateAsync(id);
        return result.data;
      },
      isPending: remove.isPending,
      error: remove.error,
    },
  };
}

/**
 * Hook for updating a lead's pipeline stage.
 * Specialized mutation for drag-and-drop pipeline updates.
 */
export function useUpdateLeadStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      leadsApi.updateLead(id, { pipeline: { stageId } }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.leads.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
    },
  });
}
