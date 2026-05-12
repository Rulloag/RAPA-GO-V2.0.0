import { useContext } from "react";
import { AuthContext } from "./AuthProvider.js";
import type { AuthContextValue } from "./auth.types.js";

/**
 * useAuth — access authentication state and actions anywhere in the app.
 * Must be used inside <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
