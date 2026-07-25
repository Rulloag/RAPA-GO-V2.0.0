import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { arrowBackOutline, moonOutline, sunnyOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";

interface RapagoSectionHeaderProps {
  title: string;
  /** Estado del tema de ESTA pantalla (useRapagoSectionTheme). */
  isDark: boolean;
  /** Alterna el tema de ESTA pantalla, no el de la app entera. */
  onToggleTheme: () => void;
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
 * El interruptor día/noche es POR PANTALLA: el estado llega por props desde
 * la página (useRapagoSectionTheme), de modo que cada sección recuerda su
 * propio modo y cambiarlo aquí no toca a las demás.
 */
export function RapagoSectionHeader({
  title,
  isDark,
  onToggleTheme,
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

        <IonTitle className="rapago-section-title">{title}</IonTitle>

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

          <IonButton
            className="rapago-chrome-btn"
            onClick={onToggleTheme}
            aria-label={isDark ? "Activar modo día" : "Activar modo nocturno"}
            title={isDark ? "Modo día" : "Modo nocturno"}
          >
            <IonIcon icon={isDark ? sunnyOutline : moonOutline} slot="icon-only" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
}
