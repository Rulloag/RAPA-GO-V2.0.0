import { describe, expect, it } from "vitest";

import { ADMIN_TABS, ADMIN_ALLOWED_PATHS } from "../../layouts/AdminLayout";
import { ADMIN_MORE_GROUPS } from "./more/index";
import { ROUTES } from "../../navigation/routes";
import { DISABLED_ADMIN_PATHS } from "../../config/releaseFeatures";
import { scopeOfSection } from "../../theme/rapagoTheme";

/**
 * Regresiones de la navegación del panel.
 *
 * Las tres cosas que este módulo puede volver a romper en silencio —porque no
 * fallan al compilar ni al renderizar— son: que la barra inferior vuelva a
 * crecer, que el hub ofrezca un destino que el guardián de rutas rechaza, y que
 * el panel deje de tener ámbito de tema propio.
 */

describe("barra inferior del panel", () => {
  /* El límite no es estético. La píldora flotante mide 460px como máximo
     (rapago-shell.css) menos 16px de padding: con seis celdas cada una baja de
     los 44pt/48dp que iOS y Android exigen como objetivo táctil. Once celdas
     —lo que había— dejaban ~40px y la etiqueta recortada. */
  it("no supera las cinco pestañas", () => {
    expect(ADMIN_TABS.length).toBeLessThanOrEqual(5);
  });

  it("no depende de banderas de release: las pestañas existen siempre", () => {
    const disabled = new Set<string>(DISABLED_ADMIN_PATHS);

    for (const tab of ADMIN_TABS) {
      expect(disabled.has(tab.path)).toBe(false);
    }
  });

  it("apunta sólo a rutas que el guardián de rol permite", () => {
    const allowed = new Set<string>(ADMIN_ALLOWED_PATHS);

    for (const tab of ADMIN_TABS) {
      expect(allowed.has(tab.path)).toBe(true);
    }
  });
});

describe("hub de secciones", () => {
  const hubItems = ADMIN_MORE_GROUPS.flatMap((group) => group.items);

  it("apunta sólo a rutas que el guardián de rol permite", () => {
    const allowed = new Set<string>(ADMIN_ALLOWED_PATHS);

    for (const item of hubItems) {
      expect(allowed.has(item.route)).toBe(true);
    }
  });

  /* Un destino desactivado por bandera redirige a "no encontrado": ofrecerlo
     sería un callejón sin salida. */
  it("no ofrece rutas desactivadas por bandera de release", () => {
    const disabled = new Set<string>(DISABLED_ADMIN_PATHS);

    for (const item of hubItems) {
      expect(disabled.has(item.route)).toBe(false);
    }
  });

  it("no repite en el hub lo que ya es pestaña", () => {
    const tabPaths = new Set<string>(ADMIN_TABS.map((tab) => tab.path));

    for (const item of hubItems) {
      expect(tabPaths.has(item.route)).toBe(false);
    }
  });

  it("no lista dos veces el mismo destino", () => {
    const routes = hubItems.map((item) => item.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  /* Entre las pestañas y el hub deben quedar cubiertas todas las secciones del
     panel: al reducir la barra de once a cinco, lo que salió tenía que entrar
     aquí. Sin esta prueba, una sección puede quedar sin ningún acceso. */
  it("entre pestañas y hub cubre todas las secciones del panel", () => {
    const reachable = new Set<string>([
      ...ADMIN_TABS.map((tab) => tab.path),
      ...hubItems.map((item) => item.route),
    ]);

    const disabled = new Set<string>(DISABLED_ADMIN_PATHS);
    const sinAcceso = ADMIN_ALLOWED_PATHS.filter(
      (path) =>
        path !== ROUTES.ADMIN.BASE &&
        !disabled.has(path) &&
        !reachable.has(path),
    );

    expect(sinAcceso).toEqual([]);
  });
});

describe("ámbito de tema del panel", () => {
  /* Un mismo dispositivo puede alternar entre la cuenta de operación y la de
     administración; el tema de una no debe arrastrar al de la otra. */
  it("no comparte preferencia con pasajero ni conductor", () => {
    expect(scopeOfSection("admin")).toBe("admin");
    expect(scopeOfSection("admin")).not.toBe(scopeOfSection("home"));
    expect(scopeOfSection("admin")).not.toBe(scopeOfSection("driver-home"));
  });
});
