import {
  IonAlert,
  IonHeader,
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
  /** Título de pantalla. En "root" se sustituye por el saludo personal. */
  title?: string;
  variant?: RapagoAppBarVariant;
  /** Segunda línea de la variante "root", bajo el saludo. Debe ser una frase
   *  con intención —"¿A dónde quieres ir?"—, no la etiqueta del rol: el rol ya
   *  lo sabe quien usa la app, y repetirlo en cada pantalla es ruido. */
  subtitle?: string;
  /** Etiqueta del rol. Sólo se usa DENTRO del menú de cuenta, donde sí aporta
   *  contexto ("con qué cuenta estoy dentro"). Nunca en la barra visible. */
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

/** Marca completa. El lockup original mantiene el moái y el wordmark RAPA GO
 * dentro del mismo asset; mostrarlo completo evita que el encabezado parezca
 * usar un logo distinto al de Welcome y Login.
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
  subtitle,
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

  /* Destino de la entrada de cuenta del menú.
     Antes era un ternario conductor/pasajero, así que el administrador —que no
     tiene pantalla de perfil personal— acababa en `/passenger/profile`: una
     ruta que su rol no puede abrir y de la que el guardián de rutas lo expulsa.
     El panel no tiene "mi perfil" que enseñar; lo equivalente para quien
     administra es la configuración de la plataforma, y así se nombra. */
  const account =
    role === "driver"
      ? { href: ROUTES.DRIVER.PROFILE, label: "Mi perfil" }
      : role === "admin"
        ? { href: ROUTES.ADMIN.SETTINGS, label: "Configuración" }
        : { href: ROUTES.PASSENGER.PROFILE, label: "Mi perfil" };

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
            <RapagoMark size={44} />
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
                history.push(account.href);
              }}
            >
              <IonIcon icon={personOutline} aria-hidden="true" />
              <span>{account.label}</span>
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
            <RapagoMark size={44} />
          {title && <span className="rp-appbar__overlay-title">{title}</span>}
          {accountButton}
        </div>
        {accountMenu}
      </>
    );
  }

  /* ── Por qué se auto-envuelve en <IonHeader> ─────────────────────────────
     Antes esta variante devolvía un <header> plano y dejaba que quien la usara
     lo metiera dentro de un <IonHeader>. Las páginas del conductor lo hacían a
     mano y funcionaban bien; las del pasajero (vía RapagoSectionHeader y
     HomePage) no, y ahí apareció el bug: en "Mis Viajes" la barra terminaba
     renderizada DEBAJO de los chips de filtro en vez de encima.

     La causa: `ion-page` sólo reserva el hueco "fuera del scroll" para
     elementos <ion-header> reales — un <header> normal no cuenta, así que
     cuando había un <IonHeader> de verdad compitiendo por esa posición (los
     chips de "Mis Viajes"), a él le tocaba el sitio fijo y a nuestra barra le
     tocaba flotar donde el layout la dejara. Envolverse aquí adentro es lo que
     garantiza la misma posición —arriba, fija, fuera del scroll— en las once
     pantallas, sin depender de que cada llamada se acuerde de envolverla. */
  return (
    <IonHeader className="ion-no-border">
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
            <RapagoMark size={44} />
          )}

          {/* Zona B: identidad de pantalla. La ÚNICA que encoge, y por eso la
              única con `min-width: 0` — sin él flexbox no permite encoger y el
              título empuja los botones fuera del viewport. */}
          <div className="rp-appbar__identity">
            {isRoot ? (
              /* El saludo ES el título de Inicio, en una sola fila junto al
                 logo. Antes aquí decía "RAPA GO / PASAJERO" y el saludo vivía
                 en una segunda banda aparte — tres problemas a la vez: el rol
                 salía DOS veces (aquí y en una pastilla junto al saludo),
                 escribir el nombre de la app compite con el logo que ya lo
                 dice, y separar el saludo del logo lo dejaba huérfano.
                 La marca la pone el logo; la calidez, el nombre de quien
                 entra. */
              <>
                <span className="rp-appbar__greeting">
                  Hola, <strong>{name}</strong>
                </span>
                {subtitle && (
                  <span className="rp-appbar__subtitle">{subtitle}</span>
                )}
              </>
            ) : (
              <>
                {showBack && <RapagoMark size={44} />}
                {/* h1 único de la pantalla y enfocable: es lo que anuncia el
                    lector al entrar. Alineado a la izquierda para que la
                    elipsis se coma el final del título y no el principio. */}
                <h1 id="rp-appbar-title" tabIndex={-1}>
                  {title}
                </h1>
              </>
            )}
          </div>

          {/* Zona C: acciones. Como mucho dos, y la última siempre la más
              "de identidad" — la cuenta cuando no hay campana, o la campana
              cuando sí la hay (el aviso nuevo es lo más reciente, se lee al
              final, más cerca del borde). El avatar va primero: es "quién
              soy", ancla la lectura antes que "qué me avisan". */}
          <div className="rp-appbar__actions">
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
          </div>
        </div>

      </header>

      {accountMenu}
    </IonHeader>
  );
}

/** Envoltura de compatibilidad.
 *
 *  Las ocho llamadas existentes de `RapagoSectionHeader` siguen funcionando sin
 *  tocar una línea, y de paso ganan el logo recortado, el botón de cuenta y el
 *  cierre de sesión con confirmación. Mantener la firma intacta es lo que
 *  permite migrar once pantallas sin reescribir once llamadas. */
export type { RapagoAppBarProps };
