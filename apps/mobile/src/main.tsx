import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";
import { App } from "./app/App";

const SENTRY_DSN = import.meta.env["VITE_SENTRY_DSN"] as string | undefined;

if (SENTRY_DSN) {
  Sentry.init(
    {
      dsn: SENTRY_DSN,
      environment: import.meta.env["VITE_ENV"] as string ?? "production",
      tracesSampleRate: 0.2,
    },
    SentryReact.init,
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
