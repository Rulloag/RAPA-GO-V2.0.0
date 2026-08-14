import { describe, expect, it } from "vitest";

import { computeKeyboardInset } from "../../../hooks/useKeyboardInset.js";
import { computeFieldScrollTop } from "./RequestRidePage";

describe("computeKeyboardInset", () => {
  it("mide la franja que tapa el teclado cuando iOS no encoge el layout", () => {
    /* El caso que rompía la pantalla: el contenedor sigue llegando a 844px y
       solo el viewport visual baja a 508px. */
    expect(computeKeyboardInset(844, 508, 0)).toBe(336);
  });

  it("descuenta la barra de pestañas midiendo desde el contenedor", () => {
    /* La página vive dentro de unas pestañas de Ionic, así que su contenedor
       acaba en 788 y no en 844. El teclado solo tapa 280px de ella; restar los
       336 de la ventana entera abriría un hueco muerto de 56px. */
    expect(computeKeyboardInset(788, 508, 0)).toBe(280);
  });

  it("no descuenta nada cuando la WebView ya se encogió sola", () => {
    /* Android con adjustResize: el contenedor sube con el viewport visual, así
       que el layout ya se adaptó y volver a restar dejaría otro hueco muerto. */
    expect(computeKeyboardInset(508, 508, 0)).toBe(0);
  });

  it("ignora la barra del navegador retrayéndose", () => {
    /* ~88px en iOS Safari al hacer scroll: no es un teclado y mover la hoja
       por esto sería un salto sin motivo. */
    expect(computeKeyboardInset(844, 756, 0)).toBe(0);
  });

  it("descuenta el desplazamiento del viewport visual", () => {
    expect(computeKeyboardInset(844, 400, 120)).toBe(324);
  });

  it("no devuelve valores negativos", () => {
    expect(computeKeyboardInset(508, 844, 0)).toBe(0);
  });
});

describe("computeFieldScrollTop", () => {
  it("sube el campo activo al borde del scroll dejando sitio a los resultados", () => {
    /* Campo 180px por debajo del inicio del cuerpo: hay que desplazar esos
       180px menos el respiro de 12px. */
    expect(
      computeFieldScrollTop({
        currentScrollTop: 0,
        fieldTop: 380,
        bodyTop: 200,
        gap: 12,
      }),
    ).toBe(168);
  });

  it("acumula sobre el desplazamiento que ya tenía el cuerpo", () => {
    expect(
      computeFieldScrollTop({
        currentScrollTop: 40,
        fieldTop: 380,
        bodyTop: 200,
        gap: 12,
      }),
    ).toBe(208);
  });

  it("no desplaza por encima del principio cuando el campo ya está arriba", () => {
    expect(
      computeFieldScrollTop({
        currentScrollTop: 0,
        fieldTop: 204,
        bodyTop: 200,
        gap: 12,
      }),
    ).toBe(0);
  });
});
