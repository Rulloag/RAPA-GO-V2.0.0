/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import requestRideSource from "./RequestRidePage.tsx?raw";

describe("flujo de solicitud tipo Uber en Rapa Nui", () => {
  it("sugiere lugares locales desde dos caracteres y prioriza RAPA GO", () => {
    expect(requestRideSource).toContain(
      'name: "Hospital de Hanga Roa"',
    );
    expect(requestRideSource).toContain(
      'aliases: ["hospital", "hosp", "urgencia"',
    );
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

  it("pregunta primero ahora o reserva y luego guía la ubicación", () => {
    expect(requestRideSource).toContain('header="¿Cuándo quieres viajar?"');
    expect(requestRideSource).toContain('text: "Viajar ahora"');
    expect(requestRideSource).toContain('text: "Reservar para después"');
    expect(requestRideSource).toContain('header="¿Desde dónde te recogemos?"');
    expect(requestRideSource).toContain('text: "Usar mi ubicación"');
    expect(requestRideSource).toContain('text: "Elegir otro lugar"');
    expect(requestRideSource).toContain(
      "Puedes escribir el origen o elegirlo manualmente en el mapa.",
    );
  });
});
