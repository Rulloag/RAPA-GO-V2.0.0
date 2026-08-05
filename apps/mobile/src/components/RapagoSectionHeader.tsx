import { RapagoAppBar } from "./RapagoAppBar.js";
import type { RapagoSection } from "../theme/rapagoTheme";

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
  /** Ámbito de tema de la pantalla. Por omisión "trips", que es el que ya
   *  declaraban de hecho varias secciones de pasajero (Guías y Arriendo lo
   *  reutilizan explícitamente). */
  sectionId?: RapagoSection;
}

/**
 * Cabecera común de las secciones del pasajero.
 *
 * AHORA ES UNA ENVOLTURA de `RapagoAppBar`, la barra única de la app.
 *
 * Existía porque cada pantalla traía su propio toolbar y ninguno coincidía:
 * Mis viajes usaba `color="primary"` (dorado), Centro de ayuda
 * `color="warning"` (amarillo) y Beneficios un degradado inline. Al llevar el
 * color en el atributo `color` o en `style`, ninguno respondía al tema y las
 * tres cabeceras se veían distintas entre sí. Ese diagnóstico sigue vigente y
 * es el que gobierna la barra nueva: fondo transparente, cero `color` de Ionic.
 *
 * Se conserva la firma EXACTA para que las ocho llamadas existentes sigan
 * funcionando sin tocar una línea, y de paso ganen las tres cosas que les
 * faltaban: el logo legible (recortado al moái), el acceso a la cuenta y el
 * cierre de sesión con confirmación.
 *
 * Esta cabecera SIGUE SIN llevar interruptor día/noche en la barra. Antes cada
 * sección tenía el suyo y su propia preferencia, así que cambiarlo en Viajes no
 * afectaba a Beneficios ni a Ayuda: el usuario repetía el gesto pantalla por
 * pantalla y la app se quedaba a dos luces. El interruptor vive ahora dentro
 * del menú de cuenta — un único punto de control sobre un único ámbito.
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
  sectionId = "trips",
}: RapagoSectionHeaderProps): JSX.Element {
  return (
    <RapagoAppBar
      sectionId={sectionId}
      title={title}
      variant="standard"
      {...(backHref !== undefined ? { backHref } : {})}
      {...(onBack !== undefined ? { onBack } : {})}
      backLabel={backLabel}
      {...(actionIcon !== undefined ? { actionIcon } : {})}
      {...(actionLabel !== undefined ? { actionLabel } : {})}
      actionLoading={actionLoading}
      {...(onAction !== undefined ? { onAction } : {})}
    />
  );
}
