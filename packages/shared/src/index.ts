/**
 * @rapa-go/shared — Public API
 *
 * Export order:
 *  1. Constants   — static values used across the platform
 *  2. Types       — TypeScript interfaces and type aliases
 *  3. Schemas     — Zod schemas for validation (inferred types exported alongside)
 *
 * Business schemas and types (Trip, Wallet, Payment, etc.) will be added
 * here as each module is designed and reviewed.
 */

export * from "./constants/index.js";
export * from "./types/index.js";
export * from "./schemas/index.js";
