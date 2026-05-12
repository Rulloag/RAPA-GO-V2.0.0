/**
 * Shared domain types.
 * Types for Trip, Wallet, Payment, Guide, Rental, etc. will be added here
 * as each module enters the implementation phase.
 *
 * Current state: foundational utility types only.
 */

import type { UserRole } from "../constants/index.js";

export type { UserRole };

/** Standard error shape returned by the API. */
export type ApiError = {
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
};

/** Standard paginated response wrapper from the API. */
export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};
