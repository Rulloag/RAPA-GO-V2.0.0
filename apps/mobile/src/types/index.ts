/**
 * Re-exports shared domain types for use within the mobile app.
 * Business logic types (Trip, Wallet, Payment, etc.) will be imported
 * from @rapa-go/shared once that package is implemented.
 *
 * Local UI-only types can be added here.
 */

export type AsyncState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
};
