import { beforeEach, describe, expect, it } from "vitest";
import {
  deriveThemeFromLocalTime,
  persistSectionTheme,
  readScopeTheme,
  readStoredSectionTheme,
  scopeOfSection,
} from "./rapagoTheme.js";

const CLAVE = "rapago_ui_theme_v1";

beforeEach(() => {
  localStorage.clear();
});

describe("ámbitos de tema", () => {
  it("agrupa todas las pantallas de pasajero en un solo ámbito", () => {
    for (const seccion of ["home", "profile", "trips", "wallet", "support", "request-ride"] as const) {
      expect(scopeOfSection(seccion)).toBe("passenger");
    }
  });

  it("mantiene Acceso en un ámbito aparte", () => {
    expect(scopeOfSection("auth")).toBe("auth");
  });

  it("propaga a las demás pantallas de pasajero lo que se elige en Inicio", () => {
    persistSectionTheme("home", "light");

    expect(readStoredSectionTheme("trips")).toBe("light");
    expect(readStoredSectionTheme("wallet")).toBe("light");
    expect(readStoredSectionTheme("support")).toBe("light");
    expect(readStoredSectionTheme("request-ride")).toBe("light");
  });

  it("no deja que el tema de Acceso arrastre al de pasajero", () => {
    persistSectionTheme("home", "light");
    persistSectionTheme("auth", "dark");

    expect(readStoredSectionTheme("home")).toBe("light");
    expect(readStoredSectionTheme("auth")).toBe("dark");
  });

  it("avisa del cambio para que las pantallas ya montadas se enteren", () => {
    let recibido: { theme?: string; scope?: string } | null = null;
    const escucha = (evento: Event): void => {
      recibido = (evento as CustomEvent<{ theme: string; scope: string }>).detail;
    };

    window.addEventListener("rapago:theme-changed", escucha);
    persistSectionTheme("home", "light");
    window.removeEventListener("rapago:theme-changed", escucha);

    expect(recibido).toEqual({ theme: "light", scope: "passenger" });
  });
});

describe("migración desde el modelo anterior (una clave por sección)", () => {
  it("adopta la preferencia que el usuario ya tenía en Inicio", () => {
    localStorage.setItem(`${CLAVE}:home`, "light");

    expect(readScopeTheme("passenger")).toBe("light");
  });

  it("reescribe la clave nueva para migrar una sola vez", () => {
    localStorage.setItem(`${CLAVE}:home`, "light");
    readScopeTheme("passenger");

    expect(localStorage.getItem(`${CLAVE}:passenger`)).toBe("light");
  });

  it("da prioridad a Inicio cuando varias secciones tenían tema distinto", () => {
    localStorage.setItem(`${CLAVE}:trips`, "dark");
    localStorage.setItem(`${CLAVE}:home`, "light");

    expect(readScopeTheme("passenger")).toBe("light");
  });

  it("una preferencia ya migrada gana sobre las claves antiguas", () => {
    localStorage.setItem(`${CLAVE}:passenger`, "dark");
    localStorage.setItem(`${CLAVE}:home`, "light");

    expect(readScopeTheme("passenger")).toBe("dark");
  });

  it("sin ninguna preferencia previa, deriva de la hora local", () => {
    expect(readScopeTheme("passenger")).toBe(deriveThemeFromLocalTime());
  });
});

describe("derivación por hora local", () => {
  it("es de día entre las 07:00 y las 18:59", () => {
    expect(deriveThemeFromLocalTime(new Date(2026, 6, 25, 7, 0))).toBe("light");
    expect(deriveThemeFromLocalTime(new Date(2026, 6, 25, 18, 59))).toBe("light");
  });

  it("es de noche desde las 19:00 y de madrugada", () => {
    expect(deriveThemeFromLocalTime(new Date(2026, 6, 25, 19, 0))).toBe("dark");
    expect(deriveThemeFromLocalTime(new Date(2026, 6, 25, 3, 0))).toBe("dark");
    expect(deriveThemeFromLocalTime(new Date(2026, 6, 25, 6, 59))).toBe("dark");
  });
});
