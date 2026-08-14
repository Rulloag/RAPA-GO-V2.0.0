/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import requestRideSource from "./RequestRidePage.tsx?raw";

describe("flujo de solicitud tipo Uber en Rapa Nui", () => {
  it("sugiere lugares locales desde dos caracteres y prioriza RAPA GO", () => {
    expect(requestRideSource).toContain(
      'name: "Hospital de Hanga Roa"',
    );
    /* Los alias se comprueban uno a uno: el arreglo pasó a ocupar varias
       líneas y buscarlo entero ataba la prueba al formato, no al contenido.
       Lo que importa es que escribir "hosp" siga encontrando el hospital. */
    for (const alias of ['"hospital"', '"hosp"', '"urgencia"']) {
      expect(requestRideSource).toContain(alias);
    }
    expect(requestRideSource).toContain("query.length < 2");
    expect(requestRideSource).toContain(
      "for (const suggestion of [...localSuggestions, ...googleSuggestions])",
    );
    expect(requestRideSource).toContain(
      "normalizeRapaNuiAutocompleteText(value).length < 2",
    );
    expect(requestRideSource).toContain("}, 220);");
  });

  it("mantiene Google restringido a Rapa Nui y acepta lugares locales", () => {
    expect(requestRideSource).toContain("bounds: getRapaNuiMapBounds()");
    expect(requestRideSource).toContain("radius: 22000");
    expect(requestRideSource).toContain(
      "filterGoogleSuggestionsToRapaNui(rawSuggestions)",
    );
    expect(requestRideSource).toContain(
      "getRapaNuiLocalAutocompletePlace(placeId)",
    );
    expect(requestRideSource).toContain("localRapaNuiPlaceToPickerResult");
  });

  it("usa los controles visibles de ahora, reserva y ubicación sin avisos duplicados", () => {
    expect(requestRideSource).not.toContain('header="¿Cuándo quieres viajar?"');
    expect(requestRideSource).not.toContain('text: "Viajar ahora"');
    expect(requestRideSource).not.toContain('text: "Reservar para después"');
    expect(requestRideSource).not.toContain('header="¿Desde dónde te recogemos?"');
    expect(requestRideSource).not.toContain('text: "Usar mi ubicación"');
    expect(requestRideSource).not.toContain('text: "Elegir otro lugar"');
    expect(requestRideSource).toContain("AHORA");
    expect(requestRideSource).toContain("RESERVAR");
    /* "Elegir en mapa" se retiró a propósito: hacía lo mismo que tocar la fila
       de origen, que ahora ES el campo de búsqueda. Queda el único atajo que
       la fila no cubre, rellenar el origen con el GPS. */
    expect(requestRideSource).not.toContain("Elegir en mapa");
    expect(requestRideSource).toContain("Usar mi ubicación actual");
    expect(requestRideSource).toContain("Mi ubicación");
    expect(requestRideSource).toContain("onClick={selectRideModeNow}");
    expect(requestRideSource).toContain("onClick={selectRideModeScheduled}");
    expect(requestRideSource).toContain(
      "Puedes escribir el origen o elegirlo manualmente en el mapa.",
    );
  });
});
