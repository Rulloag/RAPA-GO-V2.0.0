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
    expect(requestRideSource).toContain("query.length < 1");
    /* El catálogo ya no va entero por delante de Google: solo sus
       coincidencias fuertes. Las flojas —las que existen para rescatar
       erratas— van detrás, donde no desplazan a un resultado exacto.
       En búsquedas de hotel Google va primero (coords oficiales). */
    expect(requestRideSource).toContain("mustResolvePlaceViaGoogle");
    expect(requestRideSource).toContain("findGooglePlaceInRapaNuiByQuery");
    expect(requestRideSource).toContain(
      "normalizeRapaNuiAutocompleteText(value).length < 1",
    );
    /* La espera antes de preguntarle a Google dejó de ser un número fijo:
       depende de cuánto se lleve escrito (ver autocompleteDebounceMs). */
    expect(requestRideSource).toContain("autocompleteDebounceMs(value)");
  });

  it("mantiene Google restringido a Rapa Nui y acepta lugares locales", () => {
    // locationRestriction es una restricción dura de Google (no un sesgo
    // como los deprecados bounds/location/radius), así que ya no hace falta
    // verificar cada sugerencia con getDetails() antes de mostrarla — esa
    // verificación sigue igual de estricta en getPlaceDetailsExact() al
    // seleccionar (ver test RequestRideAutocompleteLocationRestriction).
    expect(requestRideSource).toContain(
      "locationRestriction: getRapaNuiMapBounds()",
    );
    expect(requestRideSource).toContain("findGooglePlaceInRapaNuiByQuery");
    expect(requestRideSource).toContain("mustResolvePlaceViaGoogle");
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
    expect(requestRideSource).not.toContain(
      "Viaje inmediato para moverte ahora por Rapa Nui.",
    );
    expect(requestRideSource).not.toContain("<strong>Solo ida</strong>");
  });
});
