/**
 * RAPA GO Mobile — Entry point stub
 *
 * This file is the minimum required for Vite to resolve the build entry.
 * The actual app (IonApp, router, screens) will be implemented in subsequent phases.
 * No business logic, no screens, no auth here.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>RAPA GO V2.0.0</h1>
      <p>Configuración base del monorepo. La app se implementará en la siguiente fase.</p>
    </div>
  </StrictMode>
);
