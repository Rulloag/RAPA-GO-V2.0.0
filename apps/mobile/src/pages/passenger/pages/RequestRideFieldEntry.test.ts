import { describe, expect, it } from "vitest";

import requestRideSource from "./RequestRidePage.tsx?raw";

describe("entrada de origen y destino tipo Uber", () => {
  it("deja los cuadros sin instrucciones internas y abre la búsqueda al tocarlos", () => {
    expect(requestRideSource).toContain(
      '"Abrir búsqueda y mapa para elegir el origen"',
    );
    expect(requestRideSource).toContain(
      '"Abrir búsqueda y mapa para elegir el destino"',
    );
    expect(requestRideSource).toContain("setPickerAutoFocusSearch(true);");
    expect(requestRideSource).toContain('setPickerTarget("origin");');
    expect(requestRideSource).toContain('setPickerTarget("destination");');
    expect(requestRideSource).toContain(
      "autoFocusSearch={pickerAutoFocusSearch}",
    );
    expect(requestRideSource).toContain(
      "searchInputRef.current?.setFocus();",
    );
    expect(requestRideSource).toContain("Elegir en mapa");
    expect(requestRideSource).toContain("Detectar con GPS");

    expect(requestRideSource).not.toContain(
      "Escribe 2 letras: hosp, aero, tah...",
    );
    expect(requestRideSource).not.toContain(
      "Escribe 2 letras: hosp, playa, mercado...",
    );
  });
});
