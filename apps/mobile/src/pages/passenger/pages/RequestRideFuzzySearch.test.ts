import { describe, expect, it } from "vitest";

import {
  boundedEditDistance,
  fuzzyAutocompleteScore,
  getRapaNuiLocalAutocompletePredictions,
} from "./RequestRidePage";

/* El catálogo local de destinos emparejaba solo por subcadena exacta, así que
   una letra de más o de menos vaciaba la lista: "anakna", "hopital" o
   "hangaroa" no devolvían nada. Estas pruebas fijan la tolerancia que se
   añadió y, sobre todo, sus LÍMITES: una búsqueda difusa demasiado generosa
   es peor que ninguna, porque llena la lista de lugares que nadie pidió. */

describe("boundedEditDistance", () => {
  it("cuenta como una sola edición el intercambio de dos letras contiguas", () => {
    /* Es de las erratas más comunes al teclear. La Levenshtein clásica la
       cobraría como dos ediciones y se saldría del tope permitido. */
    expect(boundedEditDistance("tahai", "tahia", 2)).toBe(1);
    expect(boundedEditDistance("mercado", "mecrado", 2)).toBe(1);
  });

  it("cuenta una edición por letra que falta, sobra o cambia", () => {
    expect(boundedEditDistance("hospital", "hopital", 2)).toBe(1);
    expect(boundedEditDistance("anakena", "anakna", 2)).toBe(1);
    expect(boundedEditDistance("mataveri", "matavery", 2)).toBe(1);
  });

  it("devuelve 0 para textos idénticos", () => {
    expect(boundedEditDistance("anakena", "anakena", 2)).toBe(0);
  });

  it("corta en cuanto supera el tope en vez de calcular la distancia real", () => {
    /* Lo que importa no es cuánto se pasa, sino que se pasó: el corte temprano
       es lo que mantiene barata la búsqueda en cada pulsación de tecla. */
    expect(boundedEditDistance("anakena", "terevaka", 2)).toBe(3);
    expect(boundedEditDistance("a", "abcdefghij", 2)).toBe(3);
  });

  it("no se dispara con textos largos pegados", () => {
    const largo = "a".repeat(5000);
    const otro = "b".repeat(5000);

    /* Si no estuviera acotado por longitud, esto sería una matriz de 25
       millones de casillas. */
    expect(boundedEditDistance(largo, otro, 2)).toBe(3);
  });
});

describe("fuzzyAutocompleteScore", () => {
  it("rescata las erratas que antes dejaban la lista vacía", () => {
    expect(fuzzyAutocompleteScore("anakena", "anakna")).toBeGreaterThan(0);
    expect(fuzzyAutocompleteScore("hospital de hanga roa", "hopital"))
      .toBeGreaterThan(0);
    expect(fuzzyAutocompleteScore("aeropuerto", "aeropuedto")).toBeGreaterThan(
      0,
    );
    expect(fuzzyAutocompleteScore("mataveri", "matavery")).toBeGreaterThan(0);
  });

  it("acepta el nombre escrito todo junto", () => {
    /* "hangaroa" no es una errata: es otra forma de escribir lo mismo. Se
       resuelve comparando sin espacios a los dos lados. */
    expect(fuzzyAutocompleteScore("caleta hanga roa", "hangaroa"))
      .toBeGreaterThan(0);
  });

  it("acepta erratas dentro de una búsqueda de varias palabras", () => {
    expect(fuzzyAutocompleteScore("jardin botanico taukiani", "jardin botaniko"))
      .toBeGreaterThan(0);
  });

  it("puntúa siempre por debajo de la subcadena exacta", () => {
    /* 720 es el tramo de `includes()`. Si lo difuso pudiera igualarlo, una
       aproximación llegaría a desplazar a una coincidencia literal. */
    expect(fuzzyAutocompleteScore("anakena", "anakna")).toBeLessThan(720);
    expect(fuzzyAutocompleteScore("caleta hanga roa", "hangaroa")).toBeLessThan(
      720,
    );
    expect(
      fuzzyAutocompleteScore("jardin botanico taukiani", "jardin botaniko"),
    ).toBeLessThan(720);
  });

  it("puntúa mejor cuantas menos erratas haya", () => {
    const unaErrata = fuzzyAutocompleteScore("aeropuerto", "aeropuertos");
    const dosErratas = fuzzyAutocompleteScore("aeropuerto", "aeropuertos ");

    expect(unaErrata).toBeGreaterThanOrEqual(dosErratas);
  });

  it("no tolera erratas en búsquedas de menos de 5 letras", () => {
    /* Permitir una errata con cuatro letras engancha casi cualquier nombre de
       la isla. Y no hace falta cubrirlo aquí: "pea", "tah", "aero" o "tere"
       son alias literales del catálogo, así que los tramos exactos —que van
       por encima de este— ya los resuelven. */
    expect(fuzzyAutocompleteScore("anakena", "ana")).toBe(-1);
    expect(fuzzyAutocompleteScore("terevaka", "tere")).toBe(-1);
    expect(fuzzyAutocompleteScore("playa pea", "peaa")).toBe(-1);
  });

  it("no empareja lugares que no se parecen", () => {
    /* El riesgo real de la búsqueda difusa es este: llenar la lista de sitios
       que nadie pidió. */
    expect(fuzzyAutocompleteScore("anakena", "terevaka")).toBe(-1);
    expect(fuzzyAutocompleteScore("hospital de hanga roa", "aeropuerto")).toBe(
      -1,
    );
    expect(fuzzyAutocompleteScore("playa pea", "comisaria")).toBe(-1);
  });

  it("no empareja una palabra corta contra uno de los conectores del nombre", () => {
    /* "de" está dentro de "Hospital de Hanga Roa". Sin el filtro de longitud
       parecida, cualquier palabra de dos letras engancharía ahí. */
    expect(fuzzyAutocompleteScore("hospital de hanga roa", "dxe")).toBe(-1);
  });

  it("descarta texto vacío", () => {
    expect(fuzzyAutocompleteScore("", "anakena")).toBe(-1);
    expect(fuzzyAutocompleteScore("anakena", "")).toBe(-1);
  });
});

describe("catálogo local con erratas", () => {
  /* De punta a punta sobre el catálogo real. Antes de la tolerancia, siete de
     estas ocho búsquedas devolvían la lista vacía. */
  const casos: [string, string][] = [
    ["hangaroa", "Caleta Hanga Roa"],
    ["anakna", "Anakena"],
    ["matavery", "Aeropuerto Internacional Mataveri"],
    ["aeropuedto", "Aeropuerto Internacional Mataveri"],
    ["hopital", "Hospital de Hanga Roa"],
    ["mercdo", "Mercado Artesanal Rapa Nui"],
    ["ahu tahia", "Ahu Tahai"],
    ["jardin botaniko", "Jardín Botánico TauKiani"],
  ];

  for (const [escrito, esperado] of casos) {
    it(`"${escrito}" encuentra ${esperado}`, () => {
      const resultados = getRapaNuiLocalAutocompletePredictions(escrito);
      expect(resultados[0]?.mainText).toBe(esperado);
    });
  }

  it("no antepone un lugar que solo comparte la dirección", () => {
    /* Casi todo el catálogo tiene "Hanga Roa" en su dirección. Sin penalizar
       ese campo, el aeropuerto empataba con la Caleta y el desempate
       alfabético lo dejaba primero al buscar "hangaroa". */
    const resultados = getRapaNuiLocalAutocompletePredictions("hangaroa");
    expect(resultados[0]?.mainText).not.toBe(
      "Aeropuerto Internacional Mataveri",
    );
  });

  it("sigue dando prioridad a la coincidencia literal", () => {
    /* Lo difuso nunca debe desplazar a lo exacto: "anakena" bien escrito tiene
       que seguir devolviendo Anakena en primer lugar. */
    expect(
      getRapaNuiLocalAutocompletePredictions("anakena")[0]?.mainText,
    ).toBe("Anakena");
    expect(
      getRapaNuiLocalAutocompletePredictions("mataveri")[0]?.mainText,
    ).toBe("Aeropuerto Internacional Mataveri");
  });

  it("mantiene los alias cortos de dos y tres letras", () => {
    /* El umbral difuso empieza en 5 letras justamente porque estos alias ya
       resuelven las búsquedas cortas por la vía exacta. */
    expect(getRapaNuiLocalAutocompletePredictions("aero").length).toBeGreaterThan(
      0,
    );
    expect(getRapaNuiLocalAutocompletePredictions("tah").length).toBeGreaterThan(
      0,
    );
  });
});
