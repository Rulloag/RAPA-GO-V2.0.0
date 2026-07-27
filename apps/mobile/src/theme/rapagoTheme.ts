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

/**
 * Defecto de última instancia (dato corrupto en storage, etc.). El modo
 * noche es el look que hereda del Login, así que se mantiene como red de
 * seguridad, pero YA NO es el fallback cuando simplemente no hay preferencia
 * guardada: en ese caso se prefiere `deriveThemeFromLocalTime()` (ver más
 * abajo) para que el arranque sea coherente con la hora del usuario.
 */
const DEFAULT_THEME: RapagoTheme = "dark";

function normalizeTheme(value: unknown): RapagoTheme {
  return String(value ?? "").toLowerCase() === "light" ? "light" : DEFAULT_THEME;
}

export function readStoredTheme(): RapagoTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeTheme(stored);
  } catch {
    // Modo privado o storage bloqueado: se usa el auto-derivado por hora.
  }

  // Sin preferencia global guardada: se auto-deriva por hora local en vez de
  // caer siempre en "dark" (ver `deriveThemeFromLocalTime` más abajo).
  return deriveThemeFromLocalTime();
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
  // Se lee el ámbito de pasajero, que es lo que realmente se persiste. Antes se
  // leía `rapago_ui_theme_v1` sin sufijo —una clave que ya nadie escribe—, así
  // que el arranque siempre caía en el derivado por hora y la barra inferior
  // parpadeaba al montarse la primera pantalla con su tema real.
  applyTheme(readScopeTheme("passenger"));
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
  | "driver-home"
  | "driver-requests"
  | "driver-trips"
  | "driver-earnings"
  | "driver-profile"
  | "auth";

/**
 * ÁMBITO DE TEMA
 * --------------
 * Antes cada sección guardaba su propio tema, así que cambiarlo en Inicio no
 * afectaba a Viajes, Beneficios ni Ayuda: el usuario tenía que repetir el mismo
 * gesto en cada pestaña y la app se veía a dos luces. Ahora las pantallas se
 * agrupan en ÁMBITOS y todas las del mismo ámbito comparten una preferencia.
 *
 * `auth` queda aparte a propósito: Login y Registro son previos a la sesión, no
 * se sabe todavía el rol de quien mira, y tienen su propia superficie visual.
 *
 * `driver` es un ámbito propio y no comparte con `passenger`: son dos sesiones
 * de uso distintas (el conductor trabaja de noche mucho más a menudo) y sus
 * pantallas viven en árboles de rutas separados, así que cada rol recuerda su
 * preferencia sin pisar la del otro.
 */
export type RapagoThemeScope = "passenger" | "driver" | "auth";

const SECTION_SCOPE: Record<RapagoSection, RapagoThemeScope> = {
  home: "passenger",
  profile: "passenger",
  trips: "passenger",
  wallet: "passenger",
  support: "passenger",
  "request-ride": "passenger",
  "driver-home": "driver",
  "driver-requests": "driver",
  "driver-trips": "driver",
  "driver-earnings": "driver",
  "driver-profile": "driver",
  auth: "auth",
};

/**
 * Claves antiguas (una por sección) de las que se migra la preferencia la
 * primera vez, para no resetear el tema a quien ya lo tenía elegido. Se lee en
 * este orden: Inicio manda, porque es donde vive el interruptor principal.
 */
const LEGACY_SECTIONS_BY_SCOPE: Record<RapagoThemeScope, RapagoSection[]> = {
  passenger: ["home", "profile", "trips", "wallet", "support", "request-ride"],
  driver: [
    "driver-home",
    "driver-requests",
    "driver-trips",
    "driver-earnings",
    "driver-profile",
  ],
  auth: ["auth"],
};

function scopeStorageKey(scope: RapagoThemeScope): string {
  return `${STORAGE_KEY}:${scope}`;
}

function legacySectionStorageKey(sectionId: RapagoSection): string {
  return `${STORAGE_KEY}:${sectionId}`;
}

export function scopeOfSection(sectionId: RapagoSection): RapagoThemeScope {
  return SECTION_SCOPE[sectionId] ?? "passenger";
}

/**
 * AUTO-DETECCIÓN DE TEMA POR HORA LOCAL DEL DISPOSITIVO
 * ------------------------------------------------------
 * El encargo pide que el tema "se auto-derive según dónde se encuentra el
 * usuario" para que la app arranque coherente con el día/noche real de esa
 * persona. La forma pragmática de lograrlo SIN pedir permisos de
 * geolocalización y SIN depender de red (la app debe funcionar offline) es
 * usar la hora local del dispositivo: `Date.getHours()` ya refleja la zona
 * horaria configurada en el teléfono, que en la enorme mayoría de los casos
 * coincide con la ubicación real del usuario.
 *
 * MEJORA FUTURA (fuera de alcance ahora): si algún día se cuenta con permiso
 * de geolocalización, se podría calcular el amanecer/atardecer exacto de las
 * coordenadas del usuario (p. ej. con una fórmula solar o una librería como
 * suncalc) para un umbral más preciso que estas horas fijas. Por ahora, hora
 * local es suficiente y no tiene costo de permisos ni de red.
 */

/** 07:00 (inclusive) es el inicio del rango "de día" → tema claro. */
const DAY_START_HOUR = 7;
/** 19:00 (inclusive) es el inicio del rango "de noche" → tema oscuro. */
const NIGHT_START_HOUR = 19;

/**
 * Deriva el tema a partir de la hora local, sin tocar storage ni el DOM
 * (función pura, fácil de probar). Rango día: [DAY_START_HOUR, NIGHT_START_HOUR)
 * → "light". Fuera de ese rango (noche/madrugada) → "dark".
 */
export function deriveThemeFromLocalTime(now: Date = new Date()): RapagoTheme {
  const hour = now.getHours();
  const isDaytime = hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR;
  return isDaytime ? "light" : "dark";
}

export function readScopeTheme(scope: RapagoThemeScope): RapagoTheme {
  try {
    const stored = localStorage.getItem(scopeStorageKey(scope));
    // Elección manual del usuario: gana siempre sobre la auto-detección.
    if (stored) return normalizeTheme(stored);

    // Migración desde el modelo anterior (una clave por sección). Se adopta la
    // primera preferencia encontrada y se reescribe ya en el formato nuevo, así
    // que esto ocurre una sola vez por dispositivo.
    for (const sectionId of LEGACY_SECTIONS_BY_SCOPE[scope]) {
      const heredado = localStorage.getItem(legacySectionStorageKey(sectionId));
      if (heredado) {
        const tema = normalizeTheme(heredado);
        localStorage.setItem(scopeStorageKey(scope), tema);
        return tema;
      }
    }
  } catch {
    // Modo privado o storage bloqueado: cae al auto-derivado por hora.
  }

  // Sin preferencia previa: se deriva de la hora local del dispositivo para que
  // la primera impresión sea coherente con el momento del día del usuario.
  return deriveThemeFromLocalTime();
}

export function readStoredSectionTheme(sectionId: RapagoSection): RapagoTheme {
  return readScopeTheme(scopeOfSection(sectionId));
}

export function persistSectionTheme(
  sectionId: RapagoSection,
  theme: RapagoTheme,
): void {
  const scope = scopeOfSection(sectionId);

  // La barra de pestañas inferior es hermana del router outlet: solo puede
  // seguir el tema vía :root, así que el de la pantalla activa se espeja ahí.
  applyTheme(theme);

  try {
    localStorage.setItem(scopeStorageKey(scope), theme);
  } catch {
    // No bloquea el cambio visual si no se puede persistir.
  }

  // Ionic mantiene montadas las pantallas ya visitadas: sin este aviso, Viajes
  // o Beneficios seguirían pintando el tema anterior hasta recargarlas.
  try {
    window.dispatchEvent(
      new CustomEvent(THEME_EVENT, { detail: { theme, scope } }),
    );
  } catch {
    // No bloquea la app.
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

  /**
   * Sincronización entre pantallas del mismo ámbito. Ionic no desmonta las
   * páginas ya visitadas, así que sin esto Viajes seguiría en el tema viejo
   * después de cambiarlo desde Inicio. Solo se reacciona a los cambios del
   * ámbito propio: el tema de Acceso no debe arrastrar al de pasajero.
   */
  useEffect(() => {
    const scope = scopeOfSection(sectionId);

    function sincronizar(event: Event): void {
      const detalle = (event as CustomEvent<{ scope?: RapagoThemeScope }>).detail;
      // El evento `storage` (otra pestaña del navegador) no trae detalle.
      if (detalle?.scope != null && detalle.scope !== scope) return;
      setThemeState(readScopeTheme(scope));
    }

    window.addEventListener(THEME_EVENT, sincronizar);
    window.addEventListener("storage", sincronizar);

    return () => {
      window.removeEventListener(THEME_EVENT, sincronizar);
      window.removeEventListener("storage", sincronizar);
    };
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
