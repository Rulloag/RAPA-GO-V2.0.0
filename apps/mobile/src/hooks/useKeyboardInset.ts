import { useEffect, useState, type RefObject } from "react";

/* Cuánto tapa el teclado virtual del borde inferior de un elemento. Sirve para
   apartar de él lo que haga falta: normalmente, relleno al final de un scroll.

   Hace falta medirlo a mano porque el teclado NO encoge el viewport de layout
   en iOS: `100dvh` sigue midiendo la pantalla entera, así que lo que esté
   anclado abajo —la hoja del formulario, sus campos y la lista de resultados—
   se dibuja debajo del teclado y se escribe a ciegas. El único que sí se entera
   es `visualViewport`, de modo que la medida sale de ahí.

   Se mide contra el CONTENEDOR del elemento y no contra `window.innerHeight`,
   que es la fórmula que suele verse. La página vive dentro de unas pestañas de
   Ionic, así que su borde inferior ya está por encima del de la ventana: restar
   el teclado entero la subiría de más y abriría una franja muerta del alto de
   la barra de pestañas entre el contenido y el teclado. Midiendo desde el
   contenedor salen descontados solos la barra, la cabecera y el área segura,
   sin constantes ni suposiciones sobre su alto.

   En Android con `adjustResize` la WebView se encoge sola: el contenedor sube
   con ella y la resta da ~0, que es lo correcto, porque allí el layout ya se
   adaptó por su cuenta. La misma fórmula sirve para los dos casos. */

/* Por debajo de esto no es el teclado: es la barra del navegador retrayéndose
   al hacer scroll (~44-88px en iOS Safari) o el redondeo del zoom. Los teclados
   reales no bajan de ~200px ni en las pantallas más pequeñas. */
const KEYBOARD_MIN_INSET = 90;

/** Solapamiento entre el teclado y el borde inferior del contenedor.
 *  Separada de la suscripción para poder comprobarla sin navegador. */
export function computeKeyboardInset(
  hostBottom: number,
  viewportHeight: number,
  viewportOffsetTop: number,
): number {
  /* Ambos valores van en coordenadas del viewport de layout: getBoundingClientRect
     mide desde ahí, y offsetTop es justo lo que separa uno del otro. */
  const keyboardTop = viewportHeight + viewportOffsetTop;
  const overlap = hostBottom - keyboardTop;

  if (!Number.isFinite(overlap) || overlap < KEYBOARD_MIN_INSET) return 0;
  return Math.round(overlap);
}

/** @param ref Elemento posicionado cuyo borde inferior debe quedar despejado.
 *             Se mide su bloque contenedor y no él mismo: así la medida no
 *             depende de lo que se haga con el resultado y no se realimenta. */
export function useKeyboardInset(
  ref: RefObject<HTMLElement | null>,
): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    /* iOS emite decenas de `resize` mientras el teclado sube. Sin agrupar por
       frame cada uno provocaría su propio render y la hoja daría tirones. */
    let frame = 0;

    const measure = (): void => {
      if (frame) return;

      frame = window.requestAnimationFrame(() => {
        frame = 0;

        const element = ref.current;
        if (!element) return;

        /* El bloque contenedor del elemento, que es quien no se mueve al
           aplicar el resultado. Si aún no está posicionado se cae al propio
           elemento: peor medida, pero nunca una excepción. */
        const host = (element.offsetParent as HTMLElement | null) ?? element;

        setInset(
          computeKeyboardInset(
            host.getBoundingClientRect().bottom,
            viewport.height,
            viewport.offsetTop,
          ),
        );
      });
    };

    /* `scroll` además de `resize`: al desplazar con el teclado abierto iOS
       mueve el viewport visual sin cambiar su alto, y sin este listener la
       franja calculada se quedaría desfasada. */
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    measure();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, [ref]);

  return inset;
}
