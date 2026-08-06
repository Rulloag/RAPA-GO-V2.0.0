/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import requestRideSource from "./RequestRidePage.tsx?raw";

describe("entrada de origen y destino tipo Uber", () => {
  it("deja los cuadros sin instrucciones internas y abre la búsqueda al tocarlos", () => {
    expect(requestRideSource).toContain(
      'aria-label={\n                canChooseOrigin\n                  ? "Abrir búsqueda y mapa para elegir el origen"',
    );
    expect(requestRideSource).toContain(
      ': "Abrir búsqueda y mapa para elegir el destino"',
    );
    expect(requestRideSource).toContain(
      '{originInput.trim() || "\\u00A0"}',
    );
    expect(requestRideSource).toContain(
      '{destInput.trim() || "\\u00A0"}',
    );
    expect(requestRideSource).not.toContain(
      'placeholder="Escribe 2 letras: hosp, aero, tah..."',
    );
    expect(requestRideSource).not.toContain(
      'placeholder="Escribe 2 letras: hosp, playa, mercado..."',
    );
  });

  it("abre el selector con el buscador enfocado cuando se toca el cuadro", () => {
    expect(requestRideSource).toContain(
      "const [pickerAutoFocusSearch, setPickerAutoFocusSearch] = useState(false)",
    );
    expect(requestRideSource).toContain("setPickerAutoFocusSearch(true)");
    expect(requestRideSource).toContain("autoFocusSearch={pickerAutoFocusSearch}");
    expect(requestRideSource).toContain("searchInputRef.current?.setFocus()");
    expect(requestRideSource).toContain(
      '"Busca origen: hospital, aeropuerto, hotel..."',
    );
    expect(requestRideSource).toContain(
      '"Busca destino: hospital, playa, mercado..."',
    );
  });

  it("mantiene botones grandes para mapa y GPS", () => {
    expect(requestRideSource).toContain("Elegir en mapa");
    expect(requestRideSource).toContain("Buscar o mover punto");
    expect(requestRideSource).toContain("Mi ubicación");
    expect(requestRideSource).toContain("Detectar con GPS");
    expect(requestRideSource).toContain("Elegir destino");
    expect(requestRideSource).toContain(
      "Buscar un lugar o marcarlo directamente en el mapa",
    );
  });
});
