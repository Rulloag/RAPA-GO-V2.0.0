/**
 * RAPA GO — Preferencia de tema (claro / oscuro) POR PANTALLA
 *
 * El tema es una preferencia de interfaz no crítica, así que vive en
 * localStorage. Es uno de los usos que PROJECT_RULES.md R-STORE-02 permite
 * explícitamente ("tema (claro/oscuro), idioma seleccionado, preferencias de
 * UI locales"). No se guarda aquí ningún dato de sesión, wallet ni viajes.
 *
 * CADA PANTALLA ES INDEPENDIENTE
 * Antes había una sola preferencia para toda la app. El encargo cambió: cada
 * sección (Inicio, Perfil, Viajes, Beneficios, Ayuda…) tiene su propio
 * interruptor día/noche y recuerda su propio estado. Por eso:
 *
 * - La clave de storage lleva el id de la sección: `rapago_ui_theme_v1:home`.
 * - El atributo `data-rapago-theme` se pone en el ELEMENTO RAÍZ de la página
 *   (el IonPage), no solo en <html>. Los tokens de rapago-shell.css están
 *   definidos también a nivel de elemento, así que las variables CSS del
 *   subárbol de esa página resuelven a su propio tema.
 * - Al entrar a la página (y al alternar el tema) el valor se espeja en
 *   <html>: la barra de pestañas inferior vive FUERA de la página (es hermana
 *   del router outlet) y solo puede seguir el tema vía :root. Así la barra
 *   siempre acompaña a la pantalla activa.
 */

import { useIonViewWillEnter } from "@ionic/react";
import { useCallback, useEffect, useState } from "react";

export type RapagoTheme = "dark" | "light";

const STORAGE_KEY = "rapago_ui_theme_v1";
const THEME_EVENT = "rapago:theme-changed";
const THEME_ATTRIBUTE = "data-rapago-theme";

/** El modo noche es el look que hereda del Login, así que es el defecto. */
const DEFAULT_THEME: RapagoTheme = "dark";

function normalizeTheme(value: unknown): RapagoTheme {
  return String(value ?? "").toLowerCase() === "light" ? "light" : DEFAULT_THEME;
}

export function readStoredTheme(): RapagoTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeTheme(stored);
  } catch {
    // Modo privado o storage bloqueado: se usa el defecto.
  }

  return DEFAULT_THEME;
}

export function applyTheme(theme: RapagoTheme): void {
  try {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  } catch {
    // SSR o entorno sin DOM.
  }
}

export function persistTheme(theme: RapagoTheme): void {
  applyTheme(theme);

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // No bloquea el cambio visual si no se puede persistir.
  }

  try {
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
  } catch {
    // No bloquea la app.
  }
}

/**
 * Se llama una vez al arrancar, antes del primer render, para que el atributo
 * ya esté puesto y no haya un parpadeo de tema.
 */
export function initRapagoTheme(): void {
  applyTheme(readStoredTheme());
}

/**
 * Estado del tema sincronizado entre pantallas: el toggle de la Home y el de
 * Preferencias del perfil comparten la misma preferencia, y cada uno se entera
 * cuando el otro la cambia.
 */
export function useRapagoTheme(): {
  theme: RapagoTheme;
  isDark: boolean;
  setTheme: (next: RapagoTheme) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<RapagoTheme>(() => readStoredTheme());

  useEffect(() => {
    function syncFromEvent(): void {
      setThemeState(readStoredTheme());
    }

    window.addEventListener(THEME_EVENT, syncFromEvent as EventListener);
    // `storage` cubre el caso de otra pestaña del navegador.
    window.addEventListener("storage", syncFromEvent);

    return () => {
      window.removeEventListener(THEME_EVENT, syncFromEvent as EventListener);
      window.removeEventListener("storage", syncFromEvent);
    };
  }, []);

  const setTheme = useCallback((next: RapagoTheme) => {
    setThemeState(next);
    persistTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: RapagoTheme = current === "dark" ? "light" : "dark";
      persistTheme(next);
      return next;
    });
  }, []);

  return { theme, isDark: theme === "dark", setTheme, toggleTheme };
}

/* ==========================================================================
   TEMA POR SECCIÓN
   ========================================================================== */

/** Ids estables de sección. Centralizados para que no se inventen variantes. */
export type RapagoSection =
  | "home"
  | "profile"
  | "trips"
  | "wallet"
  | "support"
  | "request-ride"
  | "auth";

function sectionStorageKey(sectionId: RapagoSection): string {
  return `${STORAGE_KEY}:${sectionId}`;
}

export function readStoredSectionTheme(sectionId: RapagoSection): RapagoTheme {
  try {
    const stored = localStorage.getItem(sectionStorageKey(sectionId));
    if (stored) return normalizeTheme(stored);
  } catch {
    // Modo privado o storage bloqueado: cae al valor heredado.
  }

  // Migración suave: si la sección nunca eligió tema, hereda la preferencia
  // global antigua para que el cambio no "resetee" a nadie a modo noche.
  return readStoredTheme();
}

export function persistSectionTheme(
  sectionId: RapagoSection,
  theme: RapagoTheme,
): void {
  // La barra de pestañas inferior es hermana del router outlet: solo puede
  // seguir el tema vía :root, así que el de la pantalla activa se espeja ahí.
  applyTheme(theme);

  try {
    localStorage.setItem(sectionStorageKey(sectionId), theme);
  } catch {
    // No bloquea el cambio visual si no se puede persistir.
  }
}

/**
 * Tema independiente de una pantalla.
 *
 * La página debe poner `data-rapago-theme={theme}` en su IonPage raíz (los
 * tokens de rapago-shell.css también están definidos a nivel de elemento).
 * Este hook además espeja el tema en <html> al entrar a la vista y al
 * alternarlo, para que la barra inferior y los overlays (modales, que Ionic
 * monta fuera de la página) resuelvan al tema de la pantalla activa.
 */
export function useRapagoSectionTheme(sectionId: RapagoSection): {
  theme: RapagoTheme;
  isDark: boolean;
  setTheme: (next: RapagoTheme) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<RapagoTheme>(() =>
    readStoredSectionTheme(sectionId),
  );

  // Al volver a esta pantalla (Ionic mantiene las páginas montadas), el
  // espejo de :root debe volver a SU tema, no quedarse con el de la anterior.
  useIonViewWillEnter(() => {
    applyTheme(readStoredSectionTheme(sectionId));
  }, [sectionId]);

  // Primer montaje (useIonViewWillEnter no cubre rutas fuera de un outlet).
  useEffect(() => {
    applyTheme(readStoredSectionTheme(sectionId));
  }, [sectionId]);

  const setTheme = useCallback(
    (next: RapagoTheme) => {
      setThemeState(next);
      persistSectionTheme(sectionId, next);
    },
    [sectionId],
  );

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: RapagoTheme = current === "dark" ? "light" : "dark";
      persistSectionTheme(sectionId, next);
      return next;
    });
  }, [sectionId]);

  return { theme, isDark: theme === "dark", setTheme, toggleTheme };
}
