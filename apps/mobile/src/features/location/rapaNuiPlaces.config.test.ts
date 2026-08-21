import { describe, expect, it } from "vitest";

import {
  findLocalRapaNuiPlaceByName,
  RAPA_NUI_LOCAL_PLACES,
} from "./rapaNuiPlaces.config.js";

describe("RAPA_NUI_LOCAL_PLACES", () => {
  it("tiene coordenadas únicas por POI (sin duplicados accidentales)", () => {
    const keys = RAPA_NUI_LOCAL_PLACES.map(
      (place) => `${place.lat.toFixed(4)}:${place.lng.toFixed(4)}`,
    );
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("Comisaría está en Manutara (OSM)", () => {
    const place = findLocalRapaNuiPlaceByName("Comisaría Rapa Nui");
    expect(place?.lat).toBeCloseTo(-27.16073, 3);
    expect(place?.lng).toBeCloseTo(-109.43719, 3);
  });

  it("Hospital no comparte coordenadas con Comisaría", () => {
    const hospital = findLocalRapaNuiPlaceByName("Hospital de Hanga Roa");
    const comisaria = findLocalRapaNuiPlaceByName("Comisaría Rapa Nui");
    expect(hospital).not.toBeNull();
    expect(comisaria).not.toBeNull();
    expect(hospital!.lat).not.toBeCloseTo(comisaria!.lat, 2);
  });

  it("Aeropuerto Mataveri usa terminal verificada", () => {
    const airport = findLocalRapaNuiPlaceByName("Aeropuerto Internacional Mataveri");
    expect(airport?.lat).toBeCloseTo(-27.16467, 3);
    expect(airport?.lng).toBeCloseTo(-109.42133, 3);
  });

  it("Jardín TauKiani no queda en el centro de Hanga Roa por error", () => {
    const garden = findLocalRapaNuiPlaceByName("Jardín Botánico TauKiani");
    expect(garden?.lat).toBeCloseTo(-27.14117, 3);
    expect(garden?.lng).toBeCloseTo(-109.4115, 3);
  });

  it("encuentra Cárcel Rapa Nui por alias", () => {
    expect(findLocalRapaNuiPlaceByName("carcel")?.name).toContain("Cárcel");
  });

  it("encuentra Ahu Huri A Urenga", () => {
    expect(findLocalRapaNuiPlaceByName("Huri a Urenga")?.name).toContain(
      "Huri",
    );
  });

  it("encuentra calles principales por nombre o alias", () => {
    expect(findLocalRapaNuiPlaceByName("Atamu Tekena")?.name).toBe(
      "Atamu Tekena",
    );
    expect(findLocalRapaNuiPlaceByName("atamu")?.name).toBe("Atamu Tekena");
    expect(findLocalRapaNuiPlaceByName("Manutara")?.name).toBe("Manutara");
    expect(findLocalRapaNuiPlaceByName("petero")?.name).toBe("Petero Atamu");
  });

  it("no confunde Hotel Taha Tai con Ahu Tahai", () => {
    expect(findLocalRapaNuiPlaceByName("Hotel Taha Tai")?.name).toBe(
      "Hotel Taha Tai",
    );
    expect(findLocalRapaNuiPlaceByName("Taha Tai Hotel")?.name).toBe(
      "Hotel Taha Tai",
    );
    expect(findLocalRapaNuiPlaceByName("Hotel Taha Tai")?.id).not.toBe(
      "ahu-tahai",
    );
  });

  it("distingue hoteles Hare sin caer en la feria", () => {
    expect(findLocalRapaNuiPlaceByName("Hotel Hare Nua")?.name).toBe(
      "Hotel Hare Nua",
    );
    expect(findLocalRapaNuiPlaceByName("Hotel Hare Uta")?.name).toBe(
      "Hotel Hare Uta",
    );
    expect(
      findLocalRapaNuiPlaceByName("Hare Rapa Nui Hotel by Chez Joseph")?.name,
    ).toContain("Hare Rapa Nui");
    expect(findLocalRapaNuiPlaceByName("Hotel Hare Nua")?.id).not.toBe(
      "feria-hare-umanga",
    );
  });

  it("la feria solo responde a feria/umanga, no a hotel hare", () => {
    expect(findLocalRapaNuiPlaceByName("Feria Artesanal Hare Umanga")?.id).toBe(
      "feria-hare-umanga",
    );
    expect(findLocalRapaNuiPlaceByName("hotel hare")?.id).not.toBe(
      "feria-hare-umanga",
    );
  });
});
