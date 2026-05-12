import type { ApiResponse, ApiSuccessResponse, ApiErrorResponse, ApiErrorCode } from "@rapa-go/shared";

export type { ApiResponse, ApiSuccessResponse, ApiErrorResponse, ApiErrorCode };

/** Options accepted by every apiClient method. */
export interface RequestOptions {
  /** Authorization Bearer token from memory — never from localStorage. */
  token?: string;
  /** Additional headers merged with defaults. */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds. Defaults to 10_000. */
  timeoutMs?: number;
}
