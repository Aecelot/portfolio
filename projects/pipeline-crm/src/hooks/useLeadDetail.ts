/**
 * Hook for fetching a single lead with real-time updates.
 * Uses Firestore real-time subscription for instant updates.
 */

import { useState, useEffect } from "react";
import { getLeadRealtime } from "@/lib/firestore";
import type { Lead } from "@/types/lead";

export interface UseLeadDetailOptions {
  /** Whether to enable the subscription (default: true) */
  enabled?: boolean;
}

export interface UseLeadDetailReturn {
  /** The lead data */
  lead: Lead | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Hook for fetching a single lead with real-time updates.
 *
 * Uses Firestore onSnapshot for instant updates when the lead changes.
 * This is preferred over polling for detail views where real-time
 * updates matter (e.g., viewing a specific lead while editing).
 *
 * @example
 * const { lead, isLoading, error } = useLeadDetail("lead-id");
 */
export function useLeadDetail(
  id: string | undefined,
  options: UseLeadDetailOptions = {}
): UseLeadDetailReturn {
  const { enabled = true } = options;

  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Skip if no ID or disabled
    if (!id || !enabled) {
      setLead(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Subscribe to real-time updates
    const unsubscribe = getLeadRealtime(id, (leadData) => {
      setLead(leadData);
      setIsLoading(false);

      if (!leadData) {
        setError(new Error("Lead not found"));
      }
    });

    // Cleanup subscription on unmount or ID change
    return () => {
      unsubscribe();
    };
  }, [id, enabled]);

  return {
    lead,
    isLoading,
    error,
  };
}

/**
 * Hook for prefetching a lead into the query cache.
 * Useful for optimistic UI when navigating to a lead detail page.
 */
export function usePrefetchLead() {
  // This could be enhanced to prefetch into React Query cache
  // For now, Firestore handles caching at the SDK level
  return {
    prefetch: (_id: string) => {
      // Firestore SDK handles caching automatically
      // Could add React Query prefetching here if needed
    },
  };
}
