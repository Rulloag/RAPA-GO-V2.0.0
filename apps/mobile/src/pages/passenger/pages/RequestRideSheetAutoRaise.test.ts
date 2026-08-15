/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import requestRideSource from "./RequestRidePage.tsx?raw";

/* Al llegar al paso 2 (Vehículo) origen y destino ya están decididos, así que
   el mapa detrás deja de ser lo que hay que mirar: la hoja sube del todo para
   mostrar el paso completo sin que el pasajero tenga que arrastrarla él mismo.
   No es una posición fija — solo un empujón al llegar — así que el arrastre
   normal (handleRequestGripPointerMove y el resto) sigue intacto después: el
   pasajero puede volver a bajarla si quiere ver el mapa, exactamente igual que
   en cualquier otro paso.

   Se comprueba sobre el código fuente, como el resto de invariantes
   estructurales de esta pantalla (ver RequestRideUberFlow.test.ts): un
   render completo necesitaría simular ResizeObserver, Google Maps y el gesto
   de arrastre entero para verificar una sola línea condicional. */
describe("la hoja sube sola al llegar al paso Vehículo", () => {
  it("goToWizardStep sube la hoja del todo (shift 0) al entrar al paso 2", () => {
    expect(requestRideSource).toContain("if (target === 1) setSheetShift(0);");
  });

  it("el arrastre manual de la hoja sigue siendo libre, sin bloqueo alguno", () => {
    /* La subida es un empujón puntual dentro de goToWizardStep, no un límite
       nuevo: los manejadores de arrastre no ganan ninguna condición sobre el
       paso actual. Si esta prueba fallara por aparecer "wizardStep" dentro de
       alguno de ellos, el arrastre habría dejado de ser libre en algún paso. */
    const dragHandlers = [
      "handleRequestGripPointerDown",
      "handleRequestGripPointerMove",
      "handleRequestGripPointerUp",
      "handleRequestGripKeyDown",
    ];

    for (const handlerName of dragHandlers) {
      const start = requestRideSource.indexOf(`function ${handlerName}(`);
      expect(start).toBeGreaterThan(-1);

      const body = requestRideSource.slice(start, start + 900);
      expect(body).not.toContain("wizardStep");
    }
  });
});
