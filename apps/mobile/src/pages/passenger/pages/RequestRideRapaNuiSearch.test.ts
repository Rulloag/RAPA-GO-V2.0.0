import { describe, expect, it } from "vitest";

import {
  getRapaNuiLocalAutocompletePredictions,
  isGoogleSuggestionMainlandChile,
  mergeRapaNuiAutocompletePredictions,
  type GoogleSuggestion,
} from "./RequestRidePage";

function google(
  mainText: string,
  secondaryText: string,
  placeId = mainText,
): GoogleSuggestion {
  return {
    placeId,
    description: `${mainText}, ${secondaryText}`,
    mainText,
    secondaryText,
  };
}

describe("búsquedas clave en Rapa Nui", () => {
  it('"comisaria" prioriza Comisaría Rapa Nui del catálogo local', () => {
    expect(
      getRapaNuiLocalAutocompletePredictions("comisaria")[0]?.mainText,
    ).toBe("Comisaría Rapa Nui");
  });

  it('"hospital" prioriza Hospital de Hanga Roa', () => {
    expect(
      getRapaNuiLocalAutocompletePredictions("hospital")[0]?.mainText,
    ).toBe("Hospital de Hanga Roa");
  });

  it('"aeropuerto" prioriza Aeropuerto Internacional Mataveri', () => {
    expect(
      getRapaNuiLocalAutocompletePredictions("aeropuerto")[0]?.mainText,
    ).toBe("Aeropuerto Internacional Mataveri");
  });

  it('"anakena" prioriza Anakena', () => {
    expect(getRapaNuiLocalAutocompletePredictions("anakena")[0]?.mainText).toBe(
      "Anakena",
    );
  });

  it('"tahai" prioriza Ahu Tahai', () => {
    expect(getRapaNuiLocalAutocompletePredictions("tahai")[0]?.mainText).toBe(
      "Ahu Tahai",
    );
  });
});

describe("isGoogleSuggestionMainlandChile", () => {
  it("detecta comisarías del continente", () => {
    expect(
      isGoogleSuggestionMainlandChile(
        google("Comisaría", "Santiago, Región Metropolitana, Chile"),
      ),
    ).toBe(true);
  });

  it("no marca resultados de la isla", () => {
    expect(
      isGoogleSuggestionMainlandChile(
        google("Comisaría Rapa Nui", "Hanga Roa, Isla de Pascua, Chile"),
      ),
    ).toBe(false);
  });
});

describe("mergeRapaNuiAutocompletePredictions filtra continente", () => {
  it("no deja pasar una comisaría de Santiago por delante del catálogo", () => {
    const local = getRapaNuiLocalAutocompletePredictions("comisaria");
    const merged = mergeRapaNuiAutocompletePredictions(
      local.map((suggestion, index) => ({
        score: 1200 - index,
        suggestion,
      })),
      [
        google(
          "Comisaría",
          "Providencia, Santiago, Región Metropolitana, Chile",
          "google-santiago",
        ),
      ],
    );

    expect(merged[0]?.mainText).toBe("Comisaría Rapa Nui");
    expect(merged.some((item) => item.placeId === "google-santiago")).toBe(
      false,
    );
  });
});
