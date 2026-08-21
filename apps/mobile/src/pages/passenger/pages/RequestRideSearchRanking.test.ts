import { describe, expect, it } from "vitest";

import {
  autocompleteDebounceMs,
  getRapaNuiLocalAutocompleteMatches,
  getRapaNuiLocalAutocompletePredictions,
  mergeRapaNuiAutocompletePredictions,
  type GoogleSuggestion,
} from "./RequestRidePage";

/* El buscador junta dos fuentes: un catálogo local que responde al instante y
   Google, que responde por red pero conoce toda la isla. Lo que se fija aquí
   es CÓMO se juntan, que era donde estaban los dos defectos que veía el
   pasajero: el mismo lugar repetido dos veces seguidas, y una aproximación del
   catálogo sentada encima del resultado exacto de Google. */

function google(mainText: string, placeId = mainText): GoogleSuggestion {
  return {
    placeId,
    description: `${mainText}, Rapa Nui`,
    mainText,
    secondaryText: "Hanga Roa, Chile",
  };
}

function local(mainText: string, score: number) {
  return {
    score,
    suggestion: {
      placeId: `rapago-local:${mainText}`,
      description: `${mainText}, Rapa Nui`,
      mainText,
      secondaryText: "Sitio de la isla · Sugerencia RAPA GO",
    },
  };
}

describe("mergeRapaNuiAutocompletePredictions", () => {
  it("pone delante lo que el catálogo reconoce con seguridad", () => {
    const merged = mergeRapaNuiAutocompletePredictions(
      [local("Anakena", 1200)],
      [google("Anakena Beach Club"), google("Camping Anakena")],
    );

    expect(merged[0].mainText).toBe("Anakena");
  });

  it("deja pasar a Google por delante de una simple corazonada", () => {
    /* Este era el defecto: el catálogo entraba ENTERO por delante, así que un
       rescate de erratas —los tramos bajos existen solo para eso— tapaba el
       lugar exacto que Google sí tenía. */
    const merged = mergeRapaNuiAutocompletePredictions(
      [local("Ahu Tahai", 540)],
      [google("Hotel Taha Tai")],
    );

    expect(merged.map((item) => item.mainText)).toEqual([
      "Hotel Taha Tai",
      "Ahu Tahai",
    ]);
  });

  it("con búsqueda de hotel prioriza el place_id de Google sobre el catálogo", () => {
    const merged = mergeRapaNuiAutocompletePredictions(
      [local("Hotel Taha Tai", 1200)],
      [google("Hotel Taha Tai", "ChIJgoogle-taha-tai")],
      "Hotel Taha Tai",
    );

    expect(merged[0].mainText).toBe("Hotel Taha Tai");
    expect(merged[0].placeId).toBe("ChIJgoogle-taha-tai");
  });

  it("no descarta la corazonada, solo la baja", () => {
    /* Sigue estando: si Google no acertó, es la única salida que le queda al
       pasajero antes de tener que tocar el mapa. */
    const merged = mergeRapaNuiAutocompletePredictions(
      [local("Anakena", 600)],
      [google("Otro sitio")],
    );

    expect(merged.map((item) => item.mainText)).toContain("Anakena");
  });

  it("muestra una sola vez el lugar que está en las dos fuentes", () => {
    /* La clave de deduplicación incluía el subtítulo. El del catálogo termina
       en "· Sugerencia RAPA GO" y el de Google es la dirección, así que nunca
       coincidían y el mismo sitio salía repetido. */
    const merged = mergeRapaNuiAutocompletePredictions(
      [local("Anakena", 1200)],
      [google("Anakena")],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].secondaryText).toContain("Sugerencia RAPA GO");
  });

  it("colapsa aunque cambien tildes o mayúsculas", () => {
    const merged = mergeRapaNuiAutocompletePredictions(
      [local("Comisaría Rapa Nui", 1200)],
      [google("COMISARIA RAPA NUI")],
    );

    expect(merged).toHaveLength(1);
  });

  it("gana la ficha del catálogo, que ya trae coordenadas", () => {
    /* No es una preferencia estética: la del catálogo se puede seleccionar sin
       pedirle a Google los detalles, así que el viaje queda listo sin otra
       vuelta a la red. */
    const merged = mergeRapaNuiAutocompletePredictions(
      [local("Anakena", 1200)],
      [google("Anakena", "google-anakena")],
    );

    expect(merged[0].placeId).not.toBe("google-anakena");
  });

  it("en hoteles gana el place_id de Google aunque el catálogo también tenga el nombre", () => {
    const merged = mergeRapaNuiAutocompletePredictions(
      [
        {
          score: 1200,
          suggestion: {
            placeId: "rapago-local:hotel-taha-tai",
            description: "Hotel Taha Tai, Rapa Nui",
            mainText: "Hotel Taha Tai",
            secondaryText: "Hotel · Apina",
          },
        },
      ],
      [google("Hotel Taha Tai", "ChIJ-google-taha-tai")],
      "hotel taha tai",
    );

    expect(merged[0].placeId).toBe("ChIJ-google-taha-tai");
  });

  it("no devuelve más de dieciséis para no enterrar el resto de la pantalla", () => {
    const merged = mergeRapaNuiAutocompletePredictions(
      [local("Uno", 1200), local("Dos", 1200)],
      Array.from({ length: 20 }, (_, i) => google(`Google ${i}`)),
    );

    expect(merged).toHaveLength(16);
  });

  it("aguanta que una de las dos fuentes venga vacía", () => {
    expect(
      mergeRapaNuiAutocompletePredictions([], [google("Solo Google")]),
    ).toHaveLength(1);
    expect(
      mergeRapaNuiAutocompletePredictions([local("Solo local", 1200)], []),
    ).toHaveLength(1);
    expect(mergeRapaNuiAutocompletePredictions([], [])).toEqual([]);
  });
});

describe("coincidir con la dirección no es coincidir con el nombre", () => {
  /* Casi todo el catálogo lleva "Hanga Roa" en su dirección. Sin separar los
     campos, buscar el nombre de un barrio devolvía todo lo que hay dentro del
     barrio, y los sitios que de verdad se llaman así quedaban mezclados entre
     ellos. */
  it("antepone lo que SE LLAMA Hanga Roa a lo que solo ESTÁ en Hanga Roa", () => {
    const matches = getRapaNuiLocalAutocompleteMatches("hanga");
    const names = matches.map((match) => match.suggestion.mainText);

    expect(names[0]).toBe("Hospital de Hanga Roa");
    expect(names).toContain("Caleta Hanga Roa");

    const airport = matches.find(
      (match) => match.suggestion.mainText === "Aeropuerto Internacional Mataveri",
    );
    const hospital = matches.find(
      (match) => match.suggestion.mainText === "Hospital de Hanga Roa",
    );

    expect(airport?.score).toBeLessThan(hospital!.score);
  });

  it("baja lo que solo encaja por dirección hasta detrás de Google", () => {
    /* El aeropuerto aparece al buscar "hanga" únicamente porque su dirección
       dice Hanga Roa. Eso no puede ocupar los primeros puestos, que son los
       que el pasajero mira. */
    const airport = getRapaNuiLocalAutocompleteMatches("hanga").find(
      (match) => match.suggestion.mainText === "Aeropuerto Internacional Mataveri",
    );

    const merged = mergeRapaNuiAutocompletePredictions(
      [airport!],
      [google("Hanga Roa")],
    );

    expect(merged[0].mainText).toBe("Hanga Roa");
  });

  it("sigue encontrando el aeropuerto por su nombre y por sus alias", () => {
    /* Bajar la dirección no puede llevarse por delante las búsquedas que sí
       apuntaban ahí. */
    for (const query of ["aero", "mataveri", "aeropuerto", "terminal"]) {
      expect(getRapaNuiLocalAutocompletePredictions(query)[0]?.mainText).toBe(
        "Aeropuerto Internacional Mataveri",
      );
    }
  });
});

describe("búsqueda corta: 1–2 palabras, no el nombre oficial entero", () => {
  it('encuentra el lugar por el principio de una palabra ("hanga", "mataveri")', () => {
    expect(
      getRapaNuiLocalAutocompletePredictions("hanga").map(
        (item) => item.mainText,
      ),
    ).toEqual(
      expect.arrayContaining([
        "Hospital de Hanga Roa",
        "Caleta Hanga Roa",
      ]),
    );
    expect(
      getRapaNuiLocalAutocompletePredictions("mataveri")[0]?.mainText,
    ).toBe("Aeropuerto Internacional Mataveri");
  });

  it('encuentra Cabañas Tahonga sin escribir el nombre completo', () => {
    for (const query of ["tahonga", "taho", "cabanas tahonga"]) {
      expect(
        getRapaNuiLocalAutocompletePredictions(query)[0]?.mainText,
      ).toBe("Cabañas Tahonga");
    }
  });

  it('encuentra Casa Silvio escribiendo solo "silvio"', () => {
    for (const query of ["silvio", "silv", "casa silvio"]) {
      expect(
        getRapaNuiLocalAutocompletePredictions(query)[0]?.mainText,
      ).toBe("Casa Silvio");
    }
  });

  it("antepone el nombre a la dirección también en estas fichas nuevas", () => {
    const silvio = getRapaNuiLocalAutocompleteMatches("hanga").find(
      (match) => match.suggestion.mainText === "Casa Silvio",
    );
    const hospital = getRapaNuiLocalAutocompleteMatches("hanga").find(
      (match) => match.suggestion.mainText === "Hospital de Hanga Roa",
    );

    if (silvio && hospital) {
      expect(silvio.score).toBeLessThan(hospital.score);
    }
  });
});

describe("DGAC encuentra el aeropuerto sin depender de la red", () => {
  /* "DGAC" solo reescribía la búsqueda para pedírsela a Google con el nombre
     oficial completo ("DGAC Dirección General de Aeronáutica Civil"), y Google
     no tiene ningún establecimiento indexado con ese nombre en la isla: la
     lista quedaba vacía. La Dirección General de Aeronáutica Civil administra
     el Aeropuerto Mataveri y opera desde ahí mismo (Calle Hotu Matúa s/n, la
     misma dirección del aeropuerto), así que la respuesta correcta es que
     "dgac" encuentre esa ficha del catálogo —con sus coordenadas ya
     verificadas— igual que "aeropuerto" o "mataveri". */
  it('"dgac" encuentra el Aeropuerto Internacional Mataveri', () => {
    expect(
      getRapaNuiLocalAutocompletePredictions("dgac")[0]?.mainText,
    ).toBe("Aeropuerto Internacional Mataveri");
  });

  it("no distingue mayúsculas", () => {
    expect(
      getRapaNuiLocalAutocompletePredictions("DGAC")[0]?.mainText,
    ).toBe("Aeropuerto Internacional Mataveri");
  });

  it('también responde a "aeronautica", sin depender de la sigla', () => {
    expect(
      getRapaNuiLocalAutocompletePredictions("aeronautica")[0]?.mainText,
    ).toBe("Aeropuerto Internacional Mataveri");
  });
});

describe("filtro desde una letra del abecedario", () => {
  /* El pasajero escribe "h" y debe ver de inmediato los lugares de la isla
     cuyo nombre empieza por H (Hospital, Hanga, Hare…), sin teclear el
     nombre completo. */
  it('"h" lista lugares cuyo nombre empieza por H', () => {
    const names = getRapaNuiLocalAutocompletePredictions("h").map(
      (item) => item.mainText,
    );

    expect(names.length).toBeGreaterThan(0);
    expect(names).toEqual(
      expect.arrayContaining([
        "Hospital de Hanga Roa",
        "Caleta Hanga Roa",
        "Feria Artesanal Hare Umanga",
      ]),
    );
    /* No debe colarse algo que solo tenga "h" en medio (p. ej. Tahai vía includes). */
    expect(names).not.toContain("Ahu Tahai");
  });

  it("con el campo vacío no filtra (lista vacía del matcher)", () => {
    expect(getRapaNuiLocalAutocompletePredictions("")).toEqual([]);
    expect(getRapaNuiLocalAutocompletePredictions("   ")).toEqual([]);
  });
});

describe("hoteles de Rapa Nui no se confunden entre sí", () => {
  it('busca "Hotel Taha Tai" y no devuelve la feria ni Ahu Tahai primero', () => {
    const names = getRapaNuiLocalAutocompletePredictions("Hotel Taha Tai").map(
      (item) => item.mainText,
    );
    expect(names[0]).toBe("Hotel Taha Tai");
    expect(names[0]).not.toContain("Feria");
    expect(names[0]).not.toBe("Ahu Tahai");
  });

  it('busca "Hotel Hare Nua" sin confundirlo con Taha Tai ni la feria', () => {
    const names = getRapaNuiLocalAutocompletePredictions("Hotel Hare Nua").map(
      (item) => item.mainText,
    );
    expect(names[0]).toBe("Hotel Hare Nua");
    expect(names).not.toContain("Hotel Taha Tai");
  });

  it('busca "Hare Rapa Nui" sin caer en Hare Nua', () => {
    const names = getRapaNuiLocalAutocompletePredictions(
      "Hare Rapa Nui Hotel",
    ).map((item) => item.mainText);
    expect(names[0]).toContain("Hare Rapa Nui");
    expect(names[0]).not.toBe("Hotel Hare Nua");
  });

  it('con "hotel hare" prioriza alojamiento sobre la feria', () => {
    const names = getRapaNuiLocalAutocompletePredictions("hotel hare").map(
      (item) => item.mainText,
    );
    expect(names.length).toBeGreaterThan(0);
    expect(names[0]).not.toBe("Feria Artesanal Hare Umanga");
    expect(
      names.some((name) => /hotel|hare nua|hare uta|maea|rapa nui hotel/i.test(name)),
    ).toBe(true);
  });
});

describe("autocompleteDebounceMs", () => {
  /* Las pulsaciones no valen lo mismo. Con dos o tres letras el pasajero casi
     seguro sigue escribiendo, y esa consulta es además la más cara porque
     devuelve medio mapa. A partir de la cuarta ya está cerca del nombre que
     quiere y lo que toca es contestarle. */
  it("espera más mientras lo escrito es muy corto", () => {
    expect(autocompleteDebounceMs("an")).toBeGreaterThan(
      autocompleteDebounceMs("anake"),
    );
  });

  it("responde antes que la espera fija de 220 ms que había", () => {
    expect(autocompleteDebounceMs("anake")).toBeLessThan(220);
    expect(autocompleteDebounceMs("hospital")).toBeLessThan(220);
  });

  it("nunca deja la espera en cero", () => {
    /* Sin espera, cada pulsación sería una llamada a Google. */
    for (const query of ["an", "ana", "anak", "anakena", ""]) {
      expect(autocompleteDebounceMs(query)).toBeGreaterThan(0);
    }
  });

  it("mide sobre el texto normalizado, no sobre lo tecleado en bruto", () => {
    /* "Ana" con acento y espacios sobrantes es la misma consulta de tres
       letras: no puede caer en el tramo corto o en el largo según cómo se
       escribiera. */
    expect(autocompleteDebounceMs("  ANÁ  ")).toBe(autocompleteDebounceMs("ana"));
  });
});
