import {
  IonAlert,
  IonButton,
  IonIcon,
  IonPopover,
  IonSpinner,
} from "@ionic/react";
import {
  arrowBackOutline,
  logOutOutline,
  moonOutline,
  notificationsOutline,
  personOutline,
  sunnyOutline,
} from "ionicons/icons";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../features/auth";
import {
  getDriverActiveRideFlag,
  subscribeDriverActiveRideFlag,
} from "../features/rides/driverActiveRideFlag.js";
import { ROUTES } from "../navigation/routes";
import type { RapagoSection } from "../theme/rapagoTheme";
import { useRapagoSectionTheme } from "../theme/rapagoTheme";
import logoRapago from "../theme/img/logo-rapago.jpeg";

/**
 * BARRA SUPERIOR ÚNICA DE RAPA GO
 * ===============================
 *
 * Sustituye a las nueve cabeceras distintas que tenían las once pantallas de
 * conductor y pasajero: `HomeHeader`, `RapagoSectionHeader`, los cuatro
 * `IonToolbar color="success"` del conductor y los dos bloques de marca hechos
 * a mano en cada Inicio.
 *
 * ── Por qué se monta DENTRO de cada IonPage y no en el layout ──────────────
 * El atributo `data-rapago-theme` se pone en el IonPage (ver rapagoTheme.ts).
 * Una barra montada en `RoleLayout` sería hermana del outlet, quedaría fuera de
 * ese atributo y sus tokens `--rp-*` caerían a `:root` — es decir, dejaría de
 * seguir el tema justo en la mitad de la app. Además conductor y pasajero
 * tienen ÁMBITOS DE TEMA SEPARADOS a propósito, así que la barra necesita saber
 * en qué sección está: de ahí la prop `sectionId`.
 *
 * ── Por qué no caben todos los controles en una fila ───────────────────────
 * Logo + saludo + título + perfil + cerrar sesión + campana + acción + volver
 * suman ~554px en un lienzo de 390. Sobra un 42%: no es cuestión de apretar.
 * La barra conserva marca + identidad de pantalla + acceso a la cuenta; el
 * saludo y el cierre de sesión viven detrás del avatar, que es el mismo control
 * en todas las pantallas. El saludo sí sale visible en Inicio (variante
 * "root"), porque ahí es contenido —la app reconoce a quien entra— y no cromo.
 */

export type RapagoAppBarVariant = "root" | "standard" | "overlay";

interface RapagoAppBarProps {
  /** Ámbito de tema al que pertenece la pantalla. Obligatorio: sin él la barra
   *  no sabe si debe leer la preferencia del conductor o la del pasajero. */
  sectionId: RapagoSection;
  /** Título de pantalla. En "root" se sustituye por el wordmark de marca. */
  title?: string;
  variant?: RapagoAppBarVariant;
  /** Texto bajo el wordmark en "root" (ej. "Conductor"). */
  roleLabel?: string;
  backHref?: string;
  onBack?: () => void;
  /** Describe el DESTINO, no la acción: veinte controles llamados "Volver" no
   *  orientan a nadie en el rotor de un lector de pantalla. */
  backLabel?: string;
  actionIcon?: string;
  actionLabel?: string;
  /** Texto corto junto al icono de la acción (ej. "EN"). Sólo para casos donde
   *  el icono por sí solo no dice cuál es el estado actual — el selector de
   *  idioma necesita mostrar a qué idioma cambia, no sólo que hay idiomas. */
  actionText?: string;
  actionLoading?: boolean;
  onAction?: () => void;
  /** Muestra la campana junto al avatar. Sólo se activa en Inicio, donde hay
   *  ancho de sobra: un punto rojo permanente en las once pantallas competiría
   *  con la acción principal de cada una. */
  showNotifications?: boolean;
  unreadCount?: number;
}

/** Iniciales para el avatar. Dos como mucho: a 32px no cabe una tercera. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";

  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + second).toUpperCase() || "?";
}

/** Nombre a mostrar. `session.user.name` es el único campo del modelo — no
 *  existen `fullName` ni `driverName` en la sesión. El fallback al usuario del
 *  correo lo traía sólo el conductor; aquí se unifica para los dos roles. */
function displayNameOf(name: unknown, email: unknown): string {
  const clean = String(name ?? "").trim();
  if (clean) return clean.split(/\s+/)[0] ?? clean;

  const fromEmail = String(email ?? "").split("@")[0] ?? "";
  return fromEmail || "usuario";
}

/** Marca recortada: sólo el moái, sin las letras del archivo.
 *
 *  El logo original es un lockup horizontal (moái + "RAPA GO" en dos líneas) de
 *  1254×1254. A 32px las letras miden ~5px de alto: una mancha marrón con un
 *  punto rojo. Recortando el moái (x=105, y=145, 540×540 — dentro del squircle
 *  impreso, así que las esquinas las pone el CSS y no quedan dobles) la marca
 *  se lee a cualquier tamaño, y el wordmark se compone en tipografía.
 *
 *  Efecto secundario útil: como el recorte deja fuera las letras del archivo,
 *  logotipo impreso y wordmark tipográfico NUNCA aparecen juntos, así que no
 *  importa que la fuente del sistema no sea la del original.
 */
function RapagoMark({ size }: { size: number }): JSX.Element {
  return (
    <span
      className="rp-appbar__mark"
      /* aria-hidden a propósito: en once pantallas, etiquetar el logo obliga al
         lector a pronunciar "Rapa Go, imagen" antes de cada título. El nombre
         de la app ya lo dan el sistema y el document.title. */
      aria-hidden="true"
      style={{ "--rp-mark": `${size}px` } as React.CSSProperties}
    >
      <img src={logoRapago} alt="" />
    </span>
  );
}

export function RapagoAppBar({
  sectionId,
  title,
  variant = "standard",
  roleLabel,
  backHref,
  onBack,
  backLabel = "Volver",
  actionIcon,
  actionLabel,
  actionText,
  actionLoading = false,
  onAction,
  showNotifications = false,
  unreadCount = 0,
}: RapagoAppBarProps): JSX.Element {
  const history = useHistory();
  const { session, logout } = useAuth();
  const { isDark, toggleTheme } = useRapagoSectionTheme(sectionId);

  const [menuEvent, setMenuEvent] = useState<Event | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  /* La señal de viaje activo la publica la pantalla de solicitudes. Si nunca se
     publica, es `false` y cerrar sesión funciona como siempre. */
  const hasActiveRide = useSyncExternalStore(
    subscribeDriverActiveRideFlag,
    getDriverActiveRideFlag,
    () => false,
  );

  const user = session?.user as Record<string, unknown> | undefined;
  const name = displayNameOf(user?.name, user?.email);
  const initials = initialsOf(String(user?.name ?? user?.email ?? ""));
  const role = String(user?.role ?? "");
  const isDriver = role === "driver";

  const profileHref = isDriver
    ? ROUTES.DRIVER.PROFILE
    : ROUTES.PASSENGER.PROFILE;

  const showBack = Boolean(backHref) || typeof onBack === "function";
  const isRoot = variant === "root";
  const isOverlay = variant === "overlay";

  /* Cerrar sesión pasa por AuthProvider.logout(), que es la ÚNICA de las cinco
     implementaciones que había que revoca el token en el backend y emite el
     evento del aviso. Las otras cuatro eran copias a mano con ramas muertas. */
  const runLogout = useCallback(async () => {
    setMenuOpen(false);
    try {
      await logout();
    } finally {
      history.replace(ROUTES.AUTH.LOGIN);
    }
  }, [history, logout]);

  /* Al navegar, Ionic sustituye el DOM sin mover el foco: los lectores de
     pantalla se quedan callados y el usuario no sabe que cambió de pantalla.
     Poner el título como <h1> enfocable y llevarle el foco hace que se anuncie
     "«Mis viajes», encabezado nivel 1", y además deja el foco al principio de
     la pantalla, que es donde debe estar tras navegar. */
  useEffect(() => {
    if (isOverlay || !title) return;

    document.title = `${title} · RAPA GO`;
  }, [isOverlay, title]);

  function handleBack(): void {
    if (onBack) {
      onBack();
      return;
    }

    if (backHref) history.push(backHref);
  }

  const accountButton = (
    <button
      type="button"
      className="rp-appbar__avatar"
      aria-label={`Cuenta de ${name}. Abrir menú`}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onClick={(event) => {
        setMenuEvent(event.nativeEvent);
        setMenuOpen(true);
      }}
    >
      <span aria-hidden="true">{initials}</span>
    </button>
  );

  const accountMenu = (
    <>
      <IonPopover
        isOpen={menuOpen}
        {...(menuEvent !== undefined ? { event: menuEvent } : {})}
        onDidDismiss={() => setMenuOpen(false)}
        className="rp-account-menu"
      >
        <div className="rp-account-menu__card" role="menu">
          <div className="rp-account-menu__head">
            <RapagoMark size={40} />
            <div className="rp-account-menu__who">
              <strong>Hola, {name}</strong>
              {roleLabel && <small>{roleLabel}</small>}
            </div>
          </div>

          <div className="rp-account-menu__items">
            <button
              type="button"
              role="menuitem"
              className="rp-account-menu__item"
              onClick={() => {
                setMenuOpen(false);
                history.push("/notifications");
              }}
            >
              <IonIcon icon={notificationsOutline} aria-hidden="true" />
              <span>Notificaciones</span>
              {unreadCount > 0 && (
                <em aria-label={`${unreadCount} sin leer`}>{unreadCount}</em>
              )}
            </button>

            <button
              type="button"
              role="menuitem"
              className="rp-account-menu__item"
              onClick={() => {
                setMenuOpen(false);
                history.push(profileHref);
              }}
            >
              <IonIcon icon={personOutline} aria-hidden="true" />
              <span>Mi perfil</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className="rp-account-menu__item"
              onClick={() => toggleTheme()}
            >
              <IonIcon icon={isDark ? sunnyOutline : moonOutline} aria-hidden="true" />
              <span>{isDark ? "Modo día" : "Modo nocturno"}</span>
            </button>
          </div>

          {/* Cerrar sesión: separado por un filete, con etiqueta de texto
              completa y en color de peligro. Antes era un icono dorado más en
              una fila de tres iconos dorados idénticos separados por 6px —
              menos que el radio de contacto de un pulgar— y se ejecutaba sin
              confirmación. Esta barra lo llevaría de 6 pantallas a 45, así que
              la exposición al toque accidental se multiplicaba por siete. */}
          <div className="rp-account-menu__danger">
            <button
              type="button"
              role="menuitem"
              className="rp-account-menu__item rp-account-menu__item--danger"
              disabled={hasActiveRide}
              onClick={() => {
                setMenuOpen(false);
                setConfirmLogout(true);
              }}
            >
              <IonIcon icon={logOutOutline} aria-hidden="true" />
              <span>Cerrar sesión</span>
            </button>

            {hasActiveRide && (
              <p className="rp-account-menu__note">
                Termina o cancela el viaje para cerrar sesión.
              </p>
            )}
          </div>
        </div>
      </IonPopover>

      <IonAlert
        isOpen={confirmLogout}
        header="¿Cerrar sesión?"
        message="Tendrás que volver a ingresar tu correo y contraseña."
        onDidDismiss={() => setConfirmLogout(false)}
        buttons={[
          { text: "Cancelar", role: "cancel" },
          {
            text: "Cerrar sesión",
            role: "destructive",
            handler: () => {
              void runLogout();
            },
          },
        ]}
      />
    </>
  );

  /* ── Variante overlay ────────────────────────────────────────────────────
     Píldora flotante para pantallas con mapa a pantalla completa. Coste en el
     flujo: CERO — es `position:absolute`, el mapa pasa por debajo. Sin campana
     (una notificación no debe robarle la vista a quien conduce) y sin acción
     (durante un viaje activo no hay nada que refrescar). Fondo opaco y no
     translúcido: sobre un mapa que alterna carreteras claras y polígonos
     oscuros, un velo degradado no garantiza contraste. */
  if (isOverlay) {
    return (
      <>
        <div className="rp-appbar rp-appbar--overlay" role="banner">
          <RapagoMark size={28} />
          {title && <span className="rp-appbar__overlay-title">{title}</span>}
          {accountButton}
        </div>
        {accountMenu}
      </>
    );
  }

  return (
    <>
      <header
        className={`rp-appbar rp-appbar--${variant}`}
        role="banner"
        aria-label="Barra de RAPA GO"
      >
        <div className="rp-appbar__row">
          {/* Zona A: navegación o marca. Sólo una de las dos — pero el chip
              nunca se pierde: cuando hay "volver", baja a 24px y se pega al
              título en la zona B. */}
          {showBack ? (
            <button
              type="button"
              className="rp-appbar__btn"
              onClick={handleBack}
              aria-label={backLabel}
              title={backLabel}
            >
              <IonIcon icon={arrowBackOutline} aria-hidden="true" />
            </button>
          ) : (
            <RapagoMark size={32} />
          )}

          {/* Zona B: identidad de pantalla. La ÚNICA que encoge, y por eso la
              única con `min-width: 0` — sin él flexbox no permite encoger y el
              título empuja los botones fuera del viewport. */}
          <div className="rp-appbar__identity">
            {isRoot ? (
              <>
                <span className="rp-appbar__wordmark">RAPA GO</span>
                {roleLabel && (
                  <span className="rp-appbar__eyebrow">{roleLabel}</span>
                )}
              </>
            ) : (
              <>
                {showBack && <RapagoMark size={24} />}
                {/* h1 único de la pantalla y enfocable: es lo que anuncia el
                    lector al entrar. Alineado a la izquierda para que la
                    elipsis se coma el final del título y no el principio. */}
                <h1 id="rp-appbar-title" tabIndex={-1}>
                  {title}
                </h1>
              </>
            )}
          </div>

          {/* Zona C: acciones. Como mucho dos, y la última siempre la cuenta. */}
          <div className="rp-appbar__actions">
            {showNotifications && (
              <button
                type="button"
                className="rp-appbar__btn"
                aria-label={
                  unreadCount > 0
                    ? `Notificaciones, ${unreadCount} sin leer`
                    : "Notificaciones"
                }
                onClick={() => history.push("/notifications")}
              >
                <IonIcon icon={notificationsOutline} aria-hidden="true" />
                {unreadCount > 0 && (
                  <em className="rp-appbar__dot" aria-hidden="true">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </em>
                )}
              </button>
            )}

            {actionIcon && onAction && (
              <button
                type="button"
                className={`rp-appbar__btn${actionText ? " rp-appbar__btn--wide" : ""}`}
                onClick={onAction}
                disabled={actionLoading}
                aria-label={actionLabel}
                title={actionLabel}
              >
                {actionLoading ? (
                  <IonSpinner name="dots" style={{ width: 18, height: 18 }} />
                ) : (
                  <>
                    <IonIcon icon={actionIcon} aria-hidden="true" />
                    {actionText && <b aria-hidden="true">{actionText}</b>}
                  </>
                )}
              </button>
            )}

            {accountButton}
          </div>
        </div>

        {/* Segunda fila sólo en Inicio: ahí el saludo es contenido, el momento
            en que la app reconoce a quien entra. En las demás pantallas sería
            cromo repetido — información de sesión, que pertenece al menú de
            sesión, no a la barra. */}
        {isRoot && (
          <div className="rp-appbar__greeting">
            <span>Hola, {name}</span>
            {roleLabel && <em>{roleLabel}</em>}
          </div>
        )}
      </header>

      {accountMenu}
    </>
  );
}

/** Envoltura de compatibilidad.
 *
 *  Las ocho llamadas existentes de `RapagoSectionHeader` siguen funcionando sin
 *  tocar una línea, y de paso ganan el logo recortado, el botón de cuenta y el
 *  cierre de sesión con confirmación. Mantener la firma intacta es lo que
 *  permite migrar once pantallas sin reescribir once llamadas. */
export type { RapagoAppBarProps };
