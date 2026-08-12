import {
  IonContent,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  useIonViewWillEnter,
} from "@ionic/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  alertCircleOutline,
  calendarOutline,
  carOutline,
  cashOutline,
  checkmarkDoneOutline,
  closeOutline,
  documentOutline,
  logoWhatsapp,
  notificationsOffOutline,
  notificationsOutline,
} from "ionicons/icons";

import { RapagoAppBar } from "../../components/RapagoAppBar.js";
import { ROUTES } from "../../navigation/routes.js";
import {
  useRapagoSectionTheme,
  type RapagoSection,
} from "../../theme/rapagoTheme.js";
import {
  notificationsService,
  type NotificationData,
} from "../../features/notifications/notifications.service.js";
import { useAuth } from "../../features/auth/index.js";

/**
 * NOTIFICACIONES
 * ==============
 *
 * Era la última pantalla del proyecto con Ionic "en crudo": dos IonToolbar sin
 * tema, sin logo, sin fondo de marca y sin forma de salir. En un teléfono real
 * —donde no hay botón "atrás" del navegador— quien entraba aquí quedaba
 * atrapado.
 *
 * ── Cómo se resolvió la navegación ────────────────────────────────────────
 * `/notifications` vive fuera de los prefijos de rol, igual que
 * `/support-center`, así que se sigue EL MISMO patrón: la ruta se monta dentro
 * del layout del rol activo (ver AppRouter y los tres layouts), de modo que la
 * barra flotante inferior no desaparece al entrar. Esta pantalla, además, lleva
 * botón de volver en la barra superior, que es la salida para quien no tiene
 * barra inferior (visitante sin sesión, guía, arrendador).
 *
 * ── Por qué el rol decide tema y destino ──────────────────────────────────
 * Es la única pantalla compartida por pasajero, conductor y administración. Los
 * tres tienen ÁMBITOS DE TEMA SEPARADOS (rapagoTheme.ts) y tres inicios
 * distintos, así que ambas cosas se derivan del rol en vez de fijarse a
 * pasajero: sin eso, un conductor en modo noche entraría a sus avisos con el
 * tema del pasajero y el botón de volver lo sacaría del área donde trabaja.
 */

type Filter = "all" | "unread";

interface RoleConfig {
  sectionId: RapagoSection;
  homeHref: string;
  backLabel: string;
  roleLabel: string;
}

/* `driver-profile` y `admin` son ids ya existentes de cada ámbito: no se
   inventa uno nuevo porque el tema se guarda POR ÁMBITO, no por pantalla, y
   añadir un id suelto sólo crearía una preferencia huérfana. */
const ROLE_CONFIG: Record<string, RoleConfig> = {
  driver: {
    sectionId: "driver-profile",
    homeHref: ROUTES.DRIVER.HOME,
    backLabel: "Volver al inicio del conductor",
    roleLabel: "Conductor",
  },
  admin: {
    sectionId: "admin",
    homeHref: ROUTES.ADMIN.HOME,
    backLabel: "Volver al panel de administración",
    roleLabel: "Administración",
  },
};

const PASSENGER_CONFIG: RoleConfig = {
  sectionId: "profile",
  homeHref: ROUTES.PASSENGER.HOME,
  backLabel: "Volver al inicio",
  roleLabel: "Pasajero",
};

/** Aspecto de un aviso según su familia. La etiqueta es tan importante como el
 *  icono: un pictograma solo no dice si "Documento vencido" habla del carné o
 *  del seguro, y a 18px varios de ellos se parecen entre sí. */
interface TypeMeta {
  icon: string;
  label: string;
  /** Variante cromática del chip. Sale de la paleta semántica del tema. */
  tone: "" | "info" | "ok" | "warn";
}

function metaForType(type: string): TypeMeta {
  if (type.startsWith("ride")) {
    return { icon: carOutline, label: "Viaje", tone: "info" };
  }
  if (type.startsWith("rental")) {
    return { icon: cashOutline, label: "Arriendo", tone: "" };
  }
  if (type.startsWith("service")) {
    return { icon: calendarOutline, label: "Servicio", tone: "ok" };
  }
  if (type.startsWith("document")) {
    return { icon: documentOutline, label: "Documento", tone: "warn" };
  }
  return { icon: notificationsOutline, label: "Aviso", tone: "" };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `Hace ${h}h`;
  return `Hace ${Math.floor(h / 24)}d`;
}

/** Fecha completa para el `title` y para el lector de pantalla: "Hace 3d" es
 *  cómodo de ojear pero inútil cuando hay que decir cuándo pasó algo. */
function fullDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" });
}

export function NotificationPage(): JSX.Element {
  const { session, user } = useAuth();

  const role = String(user?.role ?? "");
  const config = ROLE_CONFIG[role] ?? PASSENGER_CONFIG;

  const { theme } = useRapagoSectionTheme(config.sectionId);

  const [items, setItems] = useState<NotificationData[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [unread, setUnread] = useState(0);
  /* Arranca en `true` para que la primera pintura sean esqueletos y no un hueco
     vacío indistinguible de "no tienes notificaciones". */
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = session?.accessToken;
    /* Sin token no hay nada que pedir, pero hay que apagar el esqueleto: si no,
       la pantalla se queda cargando para siempre. */
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await notificationsService.getMyNotifications(token);
      setItems(data.items);
      setUnread(data.unreadCount);
      setError(null);
    } catch {
      /* El fallo se contaba en silencio: la pantalla mostraba el estado vacío,
         que en la isla —donde la red se cae a menudo— hacía creer que no había
         avisos. Ahora se dice, y se dice cómo reintentar. */
      setError("No pudimos cargar tus notificaciones. Desliza hacia abajo para reintentar.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useIonViewWillEnter(() => {
    void load();
  }, [load]);

  /* AuthProvider restaura la sesión de forma asíncrona: en un arranque en frío
     sobre esta ruta, `useIonViewWillEnter` ya disparó su carga cuando todavía
     no había token y la pantalla se quedaría vacía para siempre. Este efecto
     reacciona sólo cuando el token APARECE —no en el montaje— para no duplicar
     la petición de entrada. */
  const lastToken = useRef<string | null>(session?.accessToken ?? null);
  useEffect(() => {
    const token = session?.accessToken ?? null;
    if (token === lastToken.current) return;

    lastToken.current = token;
    if (token) void load();
  }, [session?.accessToken, load]);

  const filtered = filter === "unread" ? items.filter((n) => !n.read) : items;
  const showSkeleton = loading && items.length === 0;

  const handleMarkRead = (id: string): void => {
    const token = session?.accessToken;
    if (!token) return;

    /* Optimista: el aviso se apaga al instante y la petición viaja detrás. El
       coste de equivocarse es que un aviso ya leído siga marcado en el
       servidor, y eso se corrige solo en la siguiente carga. */
    notificationsService.markRead(token, id).catch(() => {});
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async (): Promise<void> => {
    const token = session?.accessToken;
    if (!token) return;

    setMarkingAll(true);
    try {
      await notificationsService.markAllRead(token);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch {
      setError("No pudimos marcar todo como leído. Inténtalo otra vez.");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDismiss = async (notification: NotificationData): Promise<void> => {
    const token = session?.accessToken;
    if (!token || dismissingId) return;

    const previousItems = items;
    setDismissingId(notification.id);
    setItems((current) => current.filter((item) => item.id !== notification.id));
    if (!notification.read) setUnread((current) => Math.max(0, current - 1));

    try {
      await notificationsService.dismiss(token, notification.id);
    } catch {
      setItems(previousItems);
      setUnread(previousItems.filter((item) => !item.read).length);
      setError("No pudimos eliminar esta notificación. Inténtalo otra vez.");
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <IonPage
      className="rapago-section-page rapago-notifications-page"
      data-rapago-theme={theme}
    >
      {/* Misma barra que las otras once pantallas: logo, título, avatar de
          cuenta y el interruptor día/noche dentro del menú. El `backHref` es lo
          que devuelve la salida en un teléfono real. */}
      <RapagoAppBar
        sectionId={config.sectionId}
        title="Notificaciones"
        backHref={config.homeHref}
        backLabel={config.backLabel}
        roleLabel={config.roleLabel}
      />

      <IonContent>
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => void load().finally(() => event.detail.complete())}
        >
          <IonRefresherContent />
        </IonRefresher>

        <div className="rapago-shell" aria-busy={loading}>
          <div className="rp-notif-bar">
            <div
              className="rp-notif-filter"
              role="group"
              aria-label="Filtrar notificaciones"
            >
              <button
                type="button"
                className="rp-notif-filter__btn"
                aria-pressed={filter === "all"}
                disabled={loading}
                onClick={() => setFilter("all")}
              >
                Todas
                <em aria-hidden="true">{items.length}</em>
              </button>

              <button
                type="button"
                className="rp-notif-filter__btn"
                aria-pressed={filter === "unread"}
                disabled={loading}
                onClick={() => setFilter("unread")}
              >
                No leídas
                <em aria-hidden="true">{unread}</em>
              </button>
            </div>

            <div className="rp-notif-bar__foot">
              {/* `role="status"` = región viva cortés: cuando el usuario marca
                  un aviso como leído, el lector anuncia el nuevo recuento sin
                  interrumpir lo que esté leyendo. */}
              <p className="rp-notif-status" role="status">
                {loading
                  ? "Cargando notificaciones…"
                  : unread > 0
                  ? `${unread} sin leer de ${items.length}`
                  : "Estás al día"}
              </p>

              {unread > 0 && (
                <button
                  type="button"
                  className="rp-notif-btn"
                  disabled={markingAll}
                  onClick={() => {
                    void handleMarkAllRead();
                  }}
                >
                  <IonIcon icon={checkmarkDoneOutline} aria-hidden="true" />
                  <span>
                    {markingAll ? "Marcando…" : "Marcar todo como leído"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="rp-banner rp-banner--error" role="alert">
              <IonIcon icon={alertCircleOutline} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {showSkeleton ? (
            <>
              <p className="rp-sr-only" role="status">
                Cargando notificaciones…
              </p>

              {/* aria-hidden: el esqueleto es andamiaje visual. Lo que se
                  anuncia es el mensaje de arriba, no tres tarjetas huecas. */}
              <ul className="rp-notif-list" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <li key={index} className="rp-card rp-notif rp-notif--skeleton">
                    <div className="rp-notif__main">
                      <IonSkeletonText
                        animated
                        className="rp-notif__skeleton-icon"
                      />
                      <span className="rp-notif__copy">
                        <IonSkeletonText animated style={{ width: "38%", height: 10 }} />
                        <IonSkeletonText animated style={{ width: "82%", height: 14 }} />
                        <IonSkeletonText animated style={{ width: "60%", height: 12 }} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : error && items.length === 0 ? (
            <div className="rp-empty rp-notif-error-state" role="alert">
              <span className="rp-empty__icon">
                <IonIcon icon={alertCircleOutline} aria-hidden="true" />
              </span>
              <h2 className="rp-empty__title">No pudimos cargar tus avisos</h2>
              <p className="rp-empty__body">
                Revisa tu conexión e inténtalo nuevamente.
              </p>
              <button
                type="button"
                className="rp-notif-btn rp-notif-empty-action"
                onClick={() => void load()}
              >
                Reintentar
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rp-empty">
              <span className="rp-empty__icon">
                <IonIcon icon={notificationsOffOutline} aria-hidden="true" />
              </span>
              <h2 className="rp-empty__title">
                {filter === "unread" ? "Estás al día" : "Sin notificaciones"}
              </h2>
              <p className="rp-empty__body">
                {filter === "unread"
                  ? "No te queda ningún aviso por leer."
                  : "Aquí llegarán los avisos de tus viajes, arriendos y documentos."}
              </p>

              {filter === "unread" && items.length > 0 && (
                <button
                  type="button"
                  className="rp-notif-btn rp-notif-empty-action"
                  onClick={() => setFilter("all")}
                >
                  Ver todas
                </button>
              )}
            </div>
          ) : (
            <ul className="rp-notif-list">
              {filtered.map((n) => {
                const meta = metaForType(n.type);
                const stamp = fullDate(n.createdAt);

                /* Contenido de la tarjeta. Sólo elementos en línea: cuando la
                   notificación está sin leer este bloque va DENTRO de un
                   <button>, y un <button> no admite <p> ni <h3>. */
                const body = (
                  <>
                    <span className="rp-notif__icon" aria-hidden="true">
                      <IonIcon icon={meta.icon} />
                    </span>

                    <span className="rp-notif__copy">
                      <span className="rp-notif__head">
                        <span className="rp-notif__kind">{meta.label}</span>
                        <time
                          className="rp-notif__time"
                          dateTime={n.createdAt}
                          title={stamp}
                        >
                          {timeAgo(n.createdAt)}
                        </time>
                      </span>

                      <span className="rp-notif__title">{n.title}</span>
                      {n.message && <span className="rp-notif__msg">{n.message}</span>}
                    </span>

                    {!n.read && <span className="rp-notif__dot" aria-hidden="true" />}
                  </>
                );

                return (
                  <li
                    key={n.id}
                    className={`rp-card rp-notif ${n.read ? "is-read" : "is-unread"}${
                      meta.tone ? ` rp-notif--${meta.tone}` : ""
                    }`}
                  >
                    {n.read ? (
                      <div className="rp-notif__main">{body}</div>
                    ) : (
                      <button
                        type="button"
                        className="rp-notif__main rp-notif__main--tap"
                        /* El estado y la fecha completa van en la etiqueta
                           porque el punto dorado es sólo color, y "Hace 3d" no
                           dice cuándo. */
                        aria-label={`${meta.label}: ${n.title}. Sin leer, ${stamp}. Tocar para marcar como leída`}
                        onClick={() => handleMarkRead(n.id)}
                      >
                        {body}
                      </button>
                    )}

                    <button
                      type="button"
                      className="rp-notif__dismiss"
                      aria-label={`Eliminar notificación: ${n.title}`}
                      title="Eliminar notificación"
                      disabled={dismissingId === n.id}
                      onClick={() => void handleDismiss(n)}
                    >
                      <IonIcon icon={closeOutline} aria-hidden="true" />
                    </button>

                    {n.waMeUrl && (
                      <a
                        className="rp-notif__wa"
                        href={n.waMeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Continuar por WhatsApp: ${n.title}`}
                      >
                        <IonIcon icon={logoWhatsapp} aria-hidden="true" />
                        <span>Continuar por WhatsApp</span>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

export default NotificationPage;
