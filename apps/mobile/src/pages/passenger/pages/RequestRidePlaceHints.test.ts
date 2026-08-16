import { describe, expect, it } from "vitest";

import { matchRapaNuiPlaceHint } from "./RequestRidePage";

/* Ocho lugares de la isla que Google conoce pero a los que no se llegaba sin
   teclear el nombre entero, más Tahonga y Casa Silvio que un tester tuvo que
   escribir completos.

   Estas pistas NO llevan coordenadas a propósito —las pone Google al
   seleccionar—, así que lo único que hay que fijar aquí es que reconozcan el
   nombre desde pocas letras y, sobre todo, que NO reescriban una búsqueda que
   iba a otra parte. */

describe("matchRapaNuiPlaceHint", () => {
  it("reconoce los nombres conocidos desde pocas letras", () => {
    expect(matchRapaNuiPlaceHint("haka")).toBe("Haka Piri Mana");
    expect(matchRapaNuiPlaceHint("maea")).toBe("Hotel Maea Hare Repa");
    expect(matchRapaNuiPlaceHint("omoto")).toBe("Omotohi");
    expect(matchRapaNuiPlaceHint("marae")).toBe("Marae Hanga Piko");
    expect(matchRapaNuiPlaceHint("planeta")).toBe("Planetario Rapa Nui");
    expect(matchRapaNuiPlaceHint("pou vae")).toBe("Pou Vae Tea");
    expect(matchRapaNuiPlaceHint("dgac")).toBe(
      "DGAC Dirección General de Aeronáutica Civil",
    );
    expect(matchRapaNuiPlaceHint("o te ahi")).toBe("O Te Ahi");
    expect(matchRapaNuiPlaceHint("tahonga")).toBe("Cabañas Tahonga");
    expect(matchRapaNuiPlaceHint("silvio")).toBe("Casa Silvio");
  });

  it("reconoce el nombre completo tal como lo escribiría el pasajero", () => {
    expect(matchRapaNuiPlaceHint("Hotel Maea Hare Repa")).toBe(
      "Hotel Maea Hare Repa",
    );
    expect(matchRapaNuiPlaceHint("hAKA Piri Mana")).toBe("Haka Piri Mana");
    expect(matchRapaNuiPlaceHint("PLanetario")).toBe("Planetario Rapa Nui");
    expect(matchRapaNuiPlaceHint("marae hanga piko")).toBe("Marae Hanga Piko");
  });

  it("no distingue mayúsculas ni tildes", () => {
    expect(matchRapaNuiPlaceHint("DGAC")).toBe(
      "DGAC Dirección General de Aeronáutica Civil",
    );
    expect(matchRapaNuiPlaceHint("dgac")).toBe(
      "DGAC Dirección General de Aeronáutica Civil",
    );
    expect(matchRapaNuiPlaceHint("aeronáutica")).toBe(
      "DGAC Dirección General de Aeronáutica Civil",
    );
  });

  it("tolera erratas en los nombres largos", () => {
    expect(matchRapaNuiPlaceHint("omotoi")).toBe("Omotohi");
    expect(matchRapaNuiPlaceHint("planetraio")).toBe("Planetario Rapa Nui");
    expect(matchRapaNuiPlaceHint("maae hare")).toBe("Hotel Maea Hare Repa");
  });

  it("no tolera erratas en claves de menos de cinco letras", () => {
    /* "dgca" por "DGAC" es una errata plausible, pero admitirla obliga a
       permitir una edición en CUALQUIER clave de cuatro letras, y ahí están
       "haka", "maea" o "pou". Una consulta reescrita hacia el sitio
       equivocado esconde lo que el pasajero buscaba, que es peor que pedirle
       cuatro letras bien escritas. */
    expect(matchRapaNuiPlaceHint("dgca")).toBeNull();
    expect(matchRapaNuiPlaceHint("hakr")).toBeNull();
  });

  it("acepta el nombre escrito todo junto", () => {
    expect(matchRapaNuiPlaceHint("oteahi")).toBe("O Te Ahi");
    expect(matchRapaNuiPlaceHint("pouvae")).toBe("Pou Vae Tea");
  });

  it("no reescribe búsquedas de menos de tres letras", () => {
    /* Con una o dos letras cualquier cosa es prefijo de algo. Reescribir ahí
       escondería justo lo que el pasajero estaba empezando a buscar. */
    expect(matchRapaNuiPlaceHint("d")).toBeNull();
    expect(matchRapaNuiPlaceHint("ha")).toBeNull();
    expect(matchRapaNuiPlaceHint("po")).toBeNull();
  });

  it("no secuestra búsquedas que iban a otro sitio", () => {
    /* El riesgo real de reescribir la consulta: que alguien busque el hospital
       y le salga un hotel. Estos tienen que pasar intactos a Google. */
    expect(matchRapaNuiPlaceHint("hospital")).toBeNull();
    expect(matchRapaNuiPlaceHint("aeropuerto")).toBeNull();
    expect(matchRapaNuiPlaceHint("anakena")).toBeNull();
    expect(matchRapaNuiPlaceHint("caleta")).toBeNull();
    expect(matchRapaNuiPlaceHint("mercado")).toBeNull();
    expect(matchRapaNuiPlaceHint("terevaka")).toBeNull();
    expect(matchRapaNuiPlaceHint("comisaria")).toBeNull();
    /* "tah" es el alias de Ahu Tahai. No puede reescribirse a Tahonga. */
    expect(matchRapaNuiPlaceHint("tah")).toBeNull();
  });

  it("no empareja por un trozo del medio de la palabra", () => {
    /* Solo vale como PREFIJO. Si bastara con aparecer por dentro, "ana" —que
       está en "Haka Piri Mana"— desviaría la búsqueda de Anakena. */
    expect(matchRapaNuiPlaceHint("ana")).toBeNull();
    expect(matchRapaNuiPlaceHint("repa")).toBeNull();
  });

  it("descarta entradas vacías", () => {
    expect(matchRapaNuiPlaceHint("")).toBeNull();
    expect(matchRapaNuiPlaceHint("   ")).toBeNull();
  });
});
