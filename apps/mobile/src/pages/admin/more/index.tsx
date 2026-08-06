import { IonContent, IonIcon, IonPage } from "@ionic/react";
import {
  alertCircleOutline,
  bookOutline,
  carSportOutline,
  cashOutline,
  chevronForwardOutline,
  cloudOfflineOutline,
  documentTextOutline,
  giftOutline,
  helpBuoyOutline,
  listOutline,
  mapOutline,
  notificationsOutline,
  peopleOutline,
  pricetagsOutline,
  settingsOutline,
  shieldCheckmarkOutline,
  ticketOutline,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";

import { RapagoAppBar } from "../../../components/RapagoAppBar.js";
import { RELEASE_FEATURES } from "../../../config/releaseFeatures.js";
import { ROUTES } from "../../../navigation/routes.js";
import { useRapagoSectionTheme } from "../../../theme/rapagoTheme.js";

/**
 * HUB DE SECCIONES DEL PANEL
 * ==========================
 *
 * Por qué existe: la barra inferior del administrador tenía ONCE pestañas en
 * producción, contra las cuatro del pasajero y las cinco del conductor. La
 * píldora flotante mide como mucho 460px, así que cada celda quedaba en ~40px
 * —por debajo del mínimo táctil de 44pt/48dp— y etiquetas como "Postul." se
 * cortaban. Once destinos en una fila no son navegación: son una lista mal
 * dibujada.
 *
 * La barra se queda con los cinco destinos del trabajo diario y el resto vive
 * aquí, agrupado por dominio. Nada se pierde de vista: el Panel ya tenía sus
 * accesos rápidos, y ahora además hay un índice completo con una etiqueta
 * legible y una frase que dice qué hay dentro de cada sección.
 */

interface HubItem {
  label: string;
  description: string;
  icon: string;
  route: string;
}

interface HubGroup {
  title: string;
  items: HubItem[];
}

/* Las secciones de módulos futuros (turismo, arriendos, eventos) sólo aparecen
   si su bandera de release está activa: sus rutas están en DISABLED_ADMIN_PATHS
   y redirigen a "no encontrado", así que enseñarlas sería ofrecer un callejón
   sin salida. */
export const ADMIN_MORE_GROUPS: HubGroup[] = [
  {
    title: "Operación",
    items: [
      {
        label: "Conductores",
        description: "Disponibilidad, descansos y estado de flota",
        icon: carSportOutline,
        route: ROUTES.ADMIN.DRIVERS,
      },
      {
        label: "Documentos",
        description: "Revisión y vigencia de documentación",
        icon: documentTextOutline,
        route: ROUTES.ADMIN.DOCUMENTS,
      },
      {
        label: "Reservas offline",
        description: "Solicitudes tomadas sin conexión",
        icon: cloudOfflineOutline,
        route: ROUTES.ADMIN.OFFLINE_BOOKINGS,
      },
      {
        label: "Actividad",
        description: "Registro reciente de la plataforma",
        icon: listOutline,
        route: "/admin/activity",
      },
      {
        label: "Alertas",
        description: "Avisos críticos que requieren atención",
        icon: notificationsOutline,
        route: "/admin/alerts",
      },
      ...(RELEASE_FEATURES.tourism
        ? [
            {
              label: "Guías",
              description: "Guías turísticos habilitados",
              icon: mapOutline,
              route: ROUTES.ADMIN.GUIDES,
            },
          ]
        : []),
      ...(RELEASE_FEATURES.rentals
        ? [
            {
              label: "Arriendos",
              description: "Operadores y vehículos de arriendo",
              icon: bookOutline,
              route: ROUTES.ADMIN.RENTALS,
            },
          ]
        : []),
    ],
  },
  {
    title: "Finanzas",
    items: [
      {
        label: "Pagos",
        description: "Ingresos, cobros y liquidaciones",
        icon: cashOutline,
        route: ROUTES.ADMIN.PAYMENTS,
      },
      {
        label: "Tarifas",
        description: "Motor de precios y destinos fijos",
        icon: pricetagsOutline,
        route: ROUTES.ADMIN.FARE_SETTINGS,
      },
      ...(RELEASE_FEATURES.events
        ? [
            {
              label: "Entradas",
              description: "Eventos y venta de entradas",
              icon: ticketOutline,
              route: ROUTES.ADMIN.EVENT_TICKETS,
            },
          ]
        : []),
    ],
  },
  {
    title: "Contenido y soporte",
    items: [
      {
        label: "Documentos legales",
        description: "Términos, políticas y sus versiones",
        icon: shieldCheckmarkOutline,
        route: ROUTES.ADMIN.LEGAL_DOCUMENTS,
      },
      {
        label: "Referidos",
        description: "Códigos, campañas y recompensas",
        icon: giftOutline,
        route: ROUTES.ADMIN.REFERRALS,
      },
      {
        label: "Soporte",
        description: "Casos abiertos y respuestas al usuario",
        icon: helpBuoyOutline,
        route: ROUTES.ADMIN.SUPPORT,
      },
      {
        label: "Configuración",
        description: "Ajustes generales de la plataforma",
        icon: settingsOutline,
        route: ROUTES.ADMIN.SETTINGS,
      },
    ],
  },
];

export function AdminMorePage(): JSX.Element {
  const history = useHistory();
  const { theme } = useRapagoSectionTheme("admin");

  const groups = ADMIN_MORE_GROUPS.filter((group) => group.items.length > 0);

  return (
    <IonPage className="rapago-admin-page" data-rapago-theme={theme}>
      <RapagoAppBar
        sectionId="admin"
        title="Más secciones"
        roleLabel="Administrador"
      />

      <IonContent>
        <div className="rp-admin-shell">
          {groups.map((group) => (
            <section key={group.title} className="rp-hub__group">
              {/* El filete degradado de .rapago-section-label es el mismo que
                  separa secciones en Inicio y Perfil. */}
              <h2 className="rapago-section-label">{group.title}</h2>

              <div className="rp-hub__grid">
                {group.items.map((item) => (
                  <button
                    key={item.route}
                    type="button"
                    className="rp-hub__item"
                    onClick={() => history.push(item.route)}
                  >
                    <span className="rp-hub__icon">
                      <IonIcon icon={item.icon} aria-hidden="true" />
                    </span>

                    <span className="rp-hub__body">
                      <span className="rp-hub__title">{item.label}</span>
                      <span className="rp-hub__sub">{item.description}</span>
                    </span>

                    <IonIcon
                      icon={chevronForwardOutline}
                      className="rp-hub__arrow"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </section>
          ))}

          {/* Recordatorio del alcance: el panel decide sobre dinero y sobre
              habilitaciones, así que conviene que quien entra sepa que no está
              en una pantalla de consulta. */}
          <p
            className="rp-hub__sub"
            style={{ textAlign: "center", padding: "0 var(--rp-pad-x)" }}
          >
            <IonIcon icon={alertCircleOutline} aria-hidden="true" /> Las acciones
            de este panel afectan a cuentas, pagos y habilitaciones reales.
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default AdminMorePage;
