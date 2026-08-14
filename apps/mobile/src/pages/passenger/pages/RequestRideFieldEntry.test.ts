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

  it("abre el selector sobre el mapa para los dos extremos del viaje", () => {
    /* El modal se abre ahora por dos caminos, no uno.

       Antes esta prueba fijaba que "solo se abre para el origen", porque el
       único acceso era confirmar el punto del GPS. El componente siempre supo
       trabajar en modo destino —lo que faltaba era la puerta de entrada—, así
       que se añadió el atajo "Elegir en el mapa" junto al de ubicación. */
    expect(requestRideSource).toContain('setPickerTarget("origin");');
    expect(requestRideSource).toContain('setPickerTarget("destination");');
    expect(requestRideSource).toContain(
      "autoFocusSearch={pickerAutoFocusSearch}",
    );
    expect(requestRideSource).toContain("searchInputRef.current?.setFocus();");

    /* Los dos atajos, con su nombre accesible. */
    expect(requestRideSource).toContain(
      'aria-label="Usar mi ubicación actual como origen"',
    );
    expect(requestRideSource).toContain(
      'aria-label="Elegir el destino en el mapa"',
    );
  });

  it("no deja elegir el destino en el mapa antes que el origen", () => {
    /* El atajo del mapa reutiliza el mismo guardia que el campo de destino, en
       vez de abrir un camino que se saltara la regla de orden. */
    expect(requestRideSource).toContain("setRouteOrderHint(true);");
  });
});
