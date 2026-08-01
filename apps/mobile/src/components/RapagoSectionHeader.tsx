import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { arrowBackOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";
import logoRapago from "../theme/img/logo-rapago.jpeg";

interface RapagoSectionHeaderProps {
  title: string;
  /** Ruta del botón volver. Si se omite, no se muestra. */
  backHref?: string;
  /** Alternativa a backHref para lógica propia de retroceso. */
  onBack?: () => void;
  backLabel?: string;
  /** Acción propia de la pantalla (ej. refrescar), a la izquierda del tema. */
  actionIcon?: string;
  actionLabel?: string;
  actionLoading?: boolean;
  onAction?: () => void;
}

/**
 * Cabecera común de las secciones del pasajero.
 *
 * Existe porque cada pantalla traía su propio toolbar y ninguno coincidía:
 * Mis viajes usaba `color="primary"` (dorado), Centro de ayuda
 * `color="warning"` (amarillo) y Beneficios un degradado inline. Al llevar
 * el color en el atributo `color` o en `style`, ninguno respondía al tema y
 * las tres cabeceras se veían distintas entre sí.
 *
 * Aquí el toolbar no lleva `color`: el fondo es transparente y deja ver el
 * de la página, igual que en Home, Perfil y Login.
 *
 * Esta cabecera YA NO lleva interruptor día/noche. Antes cada sección tenía el
 * suyo y su propia preferencia, así que cambiarlo en Viajes no afectaba a
 * Beneficios ni a Ayuda: el usuario repetía el gesto pantalla por pantalla y la
 * app se quedaba a dos luces. Ahora todas las pantallas de pasajero comparten un
 * único ámbito de tema (`scopeOfSection` en rapagoTheme.ts), gobernado desde el
 * botón del encabezado de Inicio, con Perfil → Preferencias como segundo punto
 * de acceso al mismo ajuste.
 */
export function RapagoSectionHeader({
  title,
  backHref,
  onBack,
  backLabel = "Volver",
  actionIcon,
  actionLabel,
  actionLoading = false,
  onAction,
}: RapagoSectionHeaderProps): JSX.Element {
  const history = useHistory();

  const showBack = Boolean(backHref) || typeof onBack === "function";

  function handleBack(): void {
    if (onBack) {
      onBack();
      return;
    }

    if (backHref) history.push(backHref);
  }

  return (
    <IonHeader className="rapago-section-header">
      <IonToolbar className="rapago-section-toolbar">
        {showBack && (
          <IonButtons slot="start">
            <IonButton
              className="rapago-chrome-btn"
              onClick={handleBack}
              aria-label={backLabel}
              title={backLabel}
            >
              <IonIcon icon={arrowBackOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        )}

        <IonTitle className="rapago-section-title">
          <span className="rapago-section-title__inner">
            <img
              src={logoRapago}
              alt=""
              aria-hidden="true"
              className="rapago-section-logo"
            />
            <span className="rapago-section-title__text">{title}</span>
          </span>
        </IonTitle>

        <IonButtons slot="end">
          {actionIcon && onAction && (
            <IonButton
              className="rapago-chrome-btn"
              onClick={onAction}
              disabled={actionLoading}
              aria-label={actionLabel}
              title={actionLabel}
            >
              {actionLoading ? (
                <IonSpinner name="dots" style={{ width: 18, height: 18 }} />
              ) : (
                <IonIcon icon={actionIcon} slot="icon-only" />
              )}
            </IonButton>
          )}
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
}
