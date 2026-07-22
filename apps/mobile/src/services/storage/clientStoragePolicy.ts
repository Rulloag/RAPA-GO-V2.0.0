/**
 * Política de almacenamiento del cliente.
 *
 * El backend es la única fuente de verdad para cuentas, viajes, pagos,
 * devoluciones, Beneficios y documentos. Al cerrar sesión se eliminan todas
 * las copias locales operacionales y personales, conservando solo preferencias
 * visuales no sensibles.
 */
const PERSISTENT_UI_KEYS = new Set([
  "rapago_language",
  "rapago_lang",
  "rapago_profile_language_v1",
  "rapago_ui_language",
  "rapago_ui_language_v1",
  "rapago_selected_language",
  "rapago_app_language",
  "rapago_active_role",
  "rapago_selected_role",
  "rapago_view_mode",
  "rapago_active_mode",
]);

const LEGACY_AUTH_KEYS = new Set([
  "rapago_session",
  "rapago_auth_session",
  "auth_session",
  "access_token",
  "refresh_token",
]);

function removeKeys(
  storage: Storage,
  shouldRemove: (key: string) => boolean,
): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && shouldRemove(key)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

export function clearSensitiveClientStorage(): void {
  try {
    removeKeys(localStorage, (key) => {
      if (LEGACY_AUTH_KEYS.has(key)) return true;
      if (!key.startsWith("rapago_")) return false;
      return !PERSISTENT_UI_KEYS.has(key);
    });
  } catch {
    // El cierre de sesión debe continuar aunque Web Storage esté bloqueado.
  }

  try {
    removeKeys(sessionStorage, (key) => {
      if (LEGACY_AUTH_KEYS.has(key)) return true;
      if (!key.startsWith("rapago_")) return false;
      return !PERSISTENT_UI_KEYS.has(key);
    });
  } catch {
    // El cierre de sesión debe continuar aunque Web Storage esté bloqueado.
  }
}

export function prepareClientStorageForAuthentication(): void {
  clearSensitiveClientStorage();
}

export const clientStoragePolicy = {
  clearSensitiveClientStorage,
  prepareClientStorageForAuthentication,
};
