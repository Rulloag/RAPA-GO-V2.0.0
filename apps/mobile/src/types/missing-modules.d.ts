declare module "@capacitor/splash-screen" {
  export const SplashScreen: { hide(opts?: { fadeOutDuration?: number }): Promise<void> };
}

declare module "@aparajita/capacitor-secure-storage" {
  export const SecureStorage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
    clear(): Promise<void>;
  };
}

declare module "@sentry/capacitor" {
  import type * as SentryReact from "@sentry/react";
  export function init(opts: SentryReact.BrowserOptions, reactInit?: typeof SentryReact.init): void;
  export * from "@sentry/react";
}

declare module "@sentry/react" {
  export interface BrowserOptions { dsn?: string; environment?: string; tracesSampleRate?: number; [key: string]: unknown }
  export function init(opts: BrowserOptions): void;
  export function captureException(err: unknown): string;
  export function captureMessage(msg: string): string;
  export const ErrorBoundary: React.ComponentType<{ fallback?: React.ReactNode; children?: React.ReactNode }>;
}
