/**
 * TanStack Query configuration.
 * Central query client setup with default options.
 */

import { QueryClient } from "@tanstack/react-query";

/**
 * Default stale time for queries (15 seconds).
 * Data is considered fresh for this duration.
 */
export const DEFAULT_STALE_TIME = 15_000;

/**
 * Default refetch interval (15 seconds).
 * Automatically refetch data at this interval when the window is focused.
 */
export const DEFAULT_REFETCH_INTERVAL = 15_000;

/**
 * Create the query client with default options.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 15 seconds
      staleTime: DEFAULT_STALE_TIME,

      // Refetch every 15 seconds when window is focused
      refetchInterval: DEFAULT_REFETCH_INTERVAL,

      // Refetch when window regains focus
      refetchOnWindowFocus: true,

      // Refetch when reconnecting
      refetchOnReconnect: true,

      // Retry failed requests twice
      retry: 2,

      // Exponential backoff for retries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Keep previous data while fetching new data
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});

/**
 * Query key factory for type-safe and consistent query keys.
 * Using a factory pattern ensures keys are consistent across the app.
 *
 * Key structure:
 * - ["leads"] - All lead queries (for invalidation)
 * - ["leads", "list", {...params}] - Specific list query
 * - ["leads", "detail", id] - Specific lead detail
 * - ["leads", "stats", type?] - Lead statistics
 */
export const queryKeys = {
  // Leads
  leads: {
    all: ["leads"] as const,
    lists: () => [...queryKeys.leads.all, "list"] as const,
    list: <T extends object>(params: T) =>
      [...queryKeys.leads.lists(), params] as const,
    details: () => [...queryKeys.leads.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.leads.details(), id] as const,
    stats: (type?: string) => [...queryKeys.leads.all, "stats", type] as const,
  },

  // Contacts (for future use)
  contacts: {
    all: ["contacts"] as const,
    lists: () => [...queryKeys.contacts.all, "list"] as const,
    list: <T extends object>(params: T) =>
      [...queryKeys.contacts.lists(), params] as const,
    details: () => [...queryKeys.contacts.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.contacts.details(), id] as const,
  },

  // Activities (for future use)
  activities: {
    all: ["activities"] as const,
    forLead: (leadId: string) =>
      [...queryKeys.activities.all, "lead", leadId] as const,
  },

  // Pipelines
  pipelines: {
    all: ["pipelines"] as const,
  },

  // Tags
  tags: {
    all: ["tags"] as const,
  },
};
