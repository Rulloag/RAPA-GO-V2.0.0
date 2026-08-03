import { IonButton, IonIcon, IonText } from "@ionic/react";

interface EmptyStateProps {
  /* Opcional desde el rediseño: sin icono el estado vacío ya no queda mudo,
     porque la ilustración de horizonte hace de figura principal. Las llamadas
     existentes siguen pasándolo y no cambian de comportamiento. */
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/* Ilustración de marca: el perfil del Rano Kau sobre la línea del Pacífico.
   Va en `currentColor` a opacidad baja, así que no necesita contraparte de día
   ni de noche: hereda el color del texto del tema y funciona en ambos. Es un
   dibujo de línea a propósito — un estado vacío no debe competir con el
   contenido que sí existe en el resto de la app. */
function HorizonArt(): JSX.Element {
  return (
    <svg
      viewBox="0 0 200 110"
      role="presentation"
      focusable="false"
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        opacity: 0.35,
        color: "var(--rp-text)",
      }}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Ladera larga y cráter mellado: la silueta real del Rano Kau. */}
      <path d="M16 76C44 74 58 58 74 48l16 3 16-4c18 10 40 27 70 29" />
      {/* Línea de horizonte, cortada en los extremos para que se lea como mar
          abierto y no como un subrayado. */}
      <path d="M4 76h192" opacity="0.7" />
      {/* Tres trazos de oleaje, decrecientes, para dar profundidad sin ruido. */}
      <path d="M26 88q9-5 18 0t18 0" opacity="0.55" />
      <path d="M120 97q9-5 18 0t18 0" opacity="0.45" />
      <path d="M60 104q9-5 18 0t18 0" opacity="0.35" />
    </svg>
  );
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps): JSX.Element {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
      gap: "12px",
      textAlign: "center",
    }}>
      {/* El icono se apila SOBRE el cielo de la ilustración en lugar de ir
          encima: así los dos elementos leen como una sola pieza y el estado
          vacío deja de parecer un error de carga. */}
      <div
        aria-hidden
        style={{
          position: "relative",
          width: "min(200px, 62%)",
          marginBottom: "4px",
        }}
      >
        <HorizonArt />
        {icon && (
          <IonIcon
            icon={icon}
            style={{
              position: "absolute",
              left: "50%",
              top: "16%",
              transform: "translate(-50%, -50%)",
              fontSize: "2.6rem",
              color: "var(--rp-icon-fg)",
            }}
          />
        )}
      </div>
      <IonText>
        {/* --ion-color-dark es #222428: sobre el fondo volcánico quedaba negro
            sobre negro. Los tokens --rp-* ya traen contraparte día/noche. */}
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--rp-text)" }}>{title}</h3>
      </IonText>
      {subtitle && (
        <IonText>
          <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.5, color: "var(--rp-muted)" }}>{subtitle}</p>
        </IonText>
      )}
      {actionLabel && onAction && (
        <IonButton onClick={onAction} style={{ marginTop: "8px" }}>
          {actionLabel}
        </IonButton>
      )}
    </div>
  );
}
