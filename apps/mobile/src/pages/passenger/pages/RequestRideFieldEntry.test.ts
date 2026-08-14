import { describe, expect, it } from "vitest";

import requestRideSource from "./RequestRidePage.tsx?raw";

describe("entrada de origen y destino tipo Uber", () => {
  it("hace que la fila SEA el campo y abra la búsqueda debajo al enfocarla", () => {
    /* Las filas dejaron de ser botones que abrían un modal con su propio
       buscador: ahora son el campo de texto real, con la lista de resultados
       justo debajo. Por eso ya no se comprueban las etiquetas "Abrir búsqueda
       y mapa..." ni el botón "Elegir en mapa", que hacían de intermediarios. */
    expect(requestRideSource).toContain('aria-label="Origen del viaje"');
    expect(requestRideSource).toContain('aria-label="Destino del viaje"');
    expect(requestRideSource).toContain('className="rq-field__input"');

    expect(requestRideSource).toContain('setActiveSearchField("origin");');
    expect(requestRideSource).toContain('setActiveSearchField("destination");');
    expect(requestRideSource).toContain('className="rq-results"');

    /* Los cuadros no llevan instrucciones dentro: solo la pregunta. Ese era el
       punto original de esta prueba y sigue vigente. */
    expect(requestRideSource).toContain('"¿Dónde te recogemos?"');
    expect(requestRideSource).toContain('"¿A dónde vas?"');

    expect(requestRideSource).not.toContain(
      "Escribe 2 letras: hosp, aero, tah...",
    );
    expect(requestRideSource).not.toContain(
      "Escribe 2 letras: hosp, playa, mercado...",
    );
  });

  it("conserva el selector sobre el mapa para confirmar la recogida del GPS", () => {
    /* El modal no desapareció: es donde el pasajero confirma el punto que
       detectó el GPS, con el buscador ya enfocado. Es el único camino que
       queda hacia él, así que solo se abre para el origen. */
    expect(requestRideSource).toContain('setPickerTarget("origin");');
    expect(requestRideSource).toContain(
      "autoFocusSearch={pickerAutoFocusSearch}",
    );
    expect(requestRideSource).toContain("searchInputRef.current?.setFocus();");
    expect(requestRideSource).toContain("Detectar con GPS");
  });
});
