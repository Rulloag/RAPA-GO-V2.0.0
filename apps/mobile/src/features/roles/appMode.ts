import { ROUTES } from "../../navigation/routes.js";
import type { RapagoSection } from "../../theme/rapagoTheme.js";

/**
 * MODO ACTIVO vs ROL REGISTRADO
 * =============================
 *
 * Son dos cosas distintas y la app las estaba mezclando:
 *
 * - ROL REGISTRADO: lo que la cuenta ES en el backend (`user.role`). Un
 *   conductor aprobado tiene `role === "driver"` para siempre, esté usando la
 *   app como conductor o como pasajero. Es lo que la API exige para abrir
 *   `/drivers/me/*`, así que es la única fuente válida de "ya es conductor".
 *
 * - MODO ACTIVO: cómo está usando la app AHORA. Un conductor puede estar
 *   pidiendo un viaje como pasajero; en ese momento su modo es pasajero
 *   aunque su rol siga siendo conductor.
 *
 * Leer el rol donde tocaba leer el modo era la causa de que "Mi perfil"
 * expulsara al pasajero a la vista de conductor.
 */

export type AppMode = "passenger" | "driver" | "admin";

/* Mismas llaves que ya escribe el cambio de modo del conductor (perfil del
   conductor → "Cambiar a modo pasajero") y el del pasajero. No se inventan
   nuevas: esto solo las lee. */
const ACTIVE_MODE_KEYS = [
  "rapago_active_mode",
  "rapago_active_role",
  "rapago_role_mode",
  "rapago_selected_role",
  "rapago_view_mode",
] as const;

function normalizeMode(value: unknown): AppMode | null {
  const text = String(value ?? "").trim().toLowerCase();

  if (!text) return null;
  if (text === "driver" || text === "conductor") return "driver";
  if (text === "admin" || text === "administrador") return "admin";
  if (text === "passenger" || text === "pasajero") return "passenger";

  return null;
}

function isPathInside(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Modo guardado por el mecanismo de cambio de modo, si hay alguno. */
export function readStoredAppMode(): AppMode | null {
  for (const store of [
    typeof sessionStorage !== "undefined" ? sessionStorage : null,
    typeof localStorage !== "undefined" ? localStorage : null,
  ]) {
    if (!store) continue;

    for (const key of ACTIVE_MODE_KEYS) {
      try {
        const mode = normalizeMode(store.getItem(key));
        if (mode) return mode;
      } catch {
        /* Navegador con almacenamiento bloqueado: se sigue con las otras
           señales en vez de romper la pantalla. */
      }
    }
  }

  return null;
}

/**
 * En qué modo está el usuario ahora mismo.
 *
 * Manda la pantalla en la que está, porque es lo único que no puede mentir:
 * si el usuario está dentro de `/passenger`, su modo es pasajero aunque su
 * cuenta sea de conductor. Solo cuando la pantalla es compartida (ayuda,
 * notificaciones, legales) se recurre al modo guardado, y el rol de la cuenta
 * queda como último recurso.
 */
export function resolveActiveAppMode({
  pathname,
  sectionId,
  accountRole,
}: {
  pathname: string;
  sectionId?: RapagoSection;
  accountRole?: unknown;
}): AppMode {
  if (isPathInside(pathname, ROUTES.DRIVER.BASE)) return "driver";
  if (isPathInside(pathname, ROUTES.ADMIN.BASE)) return "admin";
  if (isPathInside(pathname, ROUTES.PASSENGER.BASE)) return "passenger";

  /* Ámbitos de tema que solo existen en un modo. "profile", "support" y "auth"
     quedan fuera a propósito: los usan pantallas de más de un modo. */
  if (sectionId?.startsWith("driver-")) return "driver";
  if (sectionId === "admin") return "admin";
  if (
    sectionId === "home" ||
    sectionId === "trips" ||
    sectionId === "wallet" ||
    sectionId === "request-ride"
  ) {
    return "passenger";
  }

  return readStoredAppMode() ?? normalizeMode(accountRole) ?? "passenger";
}

/**
 * Si la CUENTA está habilitada como conductor. No dice en qué modo está el
 * usuario: dice qué puede hacer. Es la misma condición que aplica la API
 * (`auth.role !== "driver"` → 403 en `/drivers/me/profile`), y la que el
 * panel de administración activa al aprobar una postulación.
 */
export function isRegisteredDriver(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;

  return normalizeMode((user as Record<string, unknown>).role) === "driver";
}

/**
 * Mecanismo ÚNICO para pasar a modo conductor: deja las mismas llaves que lee
 * el resto de la app y que escribe el camino inverso (perfil del conductor →
 * "Cambiar a modo pasajero"). No navega: eso lo decide quien lo llama.
 *
 * No cambia el rol de nadie —eso solo lo hace el backend al aprobar la
 * postulación—, únicamente marca con qué cara de la app quiere trabajar.
 */
export function activateDriverMode(): void {
  try {
    for (const key of ACTIVE_MODE_KEYS) {
      localStorage.setItem(key, "driver");
      sessionStorage.setItem(key, "driver");
    }

    const currentRaw = localStorage.getItem("rapago_registration_profile");
    const current = currentRaw
      ? (JSON.parse(currentRaw) as Record<string, unknown>)
      : {};
    const currentRoles = Array.isArray(current.roles)
      ? current.roles.map((item) => String(item))
      : [];

    localStorage.setItem(
      "rapago_registration_profile",
      JSON.stringify({
        ...current,
        activeRole: "driver",
        currentRole: "driver",
        roles: Array.from(new Set(["passenger", "driver", ...currentRoles])),
      }),
    );
  } catch {
    /* Sin almacenamiento el cambio de modo no se recuerda, pero la navegación
       del llamador sigue funcionando. */
  }
}
