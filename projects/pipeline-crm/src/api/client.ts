/**
 * API client for making authenticated requests to Cloud Functions.
 * Handles authentication, error handling, and response parsing.
 */

import { auth } from "@/lib/firebase";

// API base URL
// In production: use Cloud Run URL directly (hosting rewrites don't work well with Gen 2)
// In development: use local emulator URL
const API_BASE_URL = import.meta.env.PROD
  ? "https://api-g5d6t76p3q-uc.a.run.app"
  : "http://127.0.0.1:5001/pipeline-crm-demo/us-central1/api";

/**
 * API error class for typed error handling.
 */
export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Generic API response type.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Request options for the API client.
 */
interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Make an authenticated API request.
 *
 * @param endpoint - API endpoint (e.g., "/leads")
 * @param options - Request options (method, body, params, etc.)
 * @returns Parsed response data
 * @throws ApiError on failure
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, params, ...fetchOptions } = options;

  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Get auth token
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "User not authenticated");
  }

  const token = await user.getIdToken();

  // Build headers
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Make request
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Parse response
  const data: ApiResponse<T> = await response.json();

  // Handle error responses
  if (!response.ok || !data.success) {
    throw new ApiError(
      response.status,
      data.error?.code || "UNKNOWN_ERROR",
      data.error?.message || "An unknown error occurred",
      data.error?.details
    );
  }

  // Return data (or full response for paginated endpoints)
  return data as T;
}

/**
 * GET request helper.
 */
export function get<T>(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  return apiClient<T>(endpoint, { method: "GET", params });
}

/**
 * POST request helper.
 */
export function post<T>(endpoint: string, body?: unknown): Promise<T> {
  return apiClient<T>(endpoint, { method: "POST", body });
}

/**
 * PATCH request helper.
 */
export function patch<T>(endpoint: string, body?: unknown): Promise<T> {
  return apiClient<T>(endpoint, { method: "PATCH", body });
}

/**
 * DELETE request helper.
 */
export function del<T>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: "DELETE" });
}
