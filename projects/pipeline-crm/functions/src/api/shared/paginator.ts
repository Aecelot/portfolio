/**
 * Generic Firestore pagination utility.
 * Handles cursor-based pagination with offset calculation for page numbers.
 */

import { Query, CollectionReference } from "firebase-admin/firestore";
import { PaginationParams, PaginatedResponse, PaginationMeta } from "./types";

export interface PaginateOptions<T> {
  /** Base query or collection reference */
  query: Query | CollectionReference;
  /** Pagination parameters */
  params: PaginationParams;
  /** Field to sort by (must match params.sort) */
  sortField: string;
  /** Transform function to convert Firestore doc to response type */
  transform: (doc: FirebaseFirestore.QueryDocumentSnapshot) => T;
  /** Optional: Pre-counted total (skips count query if provided) */
  preCountedTotal?: number;
}

/**
 * Execute a paginated Firestore query with page number support.
 * Uses offset-based pagination for simplicity with page numbers.
 *
 * Note: For very large datasets (100k+), consider cursor-based pagination
 * with startAfter() for better performance. Offset works well up to ~50k docs.
 */
export async function paginate<T>(
  options: PaginateOptions<T>
): Promise<PaginatedResponse<T>> {
  const { query, params, sortField, transform, preCountedTotal } = options;
  const { page, limit, order = "desc" } = params;

  // Calculate offset for page number
  const offset = (page - 1) * limit;

  // Get total count (use preCountedTotal if available to save a query)
  let total: number;
  if (preCountedTotal !== undefined) {
    total = preCountedTotal;
  } else {
    const countSnapshot = await query.count().get();
    total = countSnapshot.data().count;
  }

  // If no results, return early
  if (total === 0) {
    return {
      data: [],
      pagination: createPaginationMeta(page, limit, 0),
    };
  }

  // Execute paginated query
  const paginatedQuery = query
    .orderBy(sortField, order)
    .offset(offset)
    .limit(limit);

  const snapshot = await paginatedQuery.get();

  // Transform documents
  const data = snapshot.docs.map(transform);

  return {
    data,
    pagination: createPaginationMeta(page, limit, total),
  };
}

/**
 * Create pagination metadata from page, limit, and total count.
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Apply filters to a Firestore query.
 * Returns a new query with filters applied.
 */
export function applyFilters(
  query: Query | CollectionReference,
  filters: Record<string, unknown>
): Query {
  let filteredQuery: Query = query;

  for (const [field, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      filteredQuery = filteredQuery.where(field, "==", value);
    }
  }

  return filteredQuery;
}

/**
 * Build sort field from params, with fallback to default.
 */
export function getSortField(
  sort: string | undefined,
  allowedFields: string[],
  defaultField: string
): string {
  if (sort && allowedFields.includes(sort)) {
    return sort;
  }
  return defaultField;
}
