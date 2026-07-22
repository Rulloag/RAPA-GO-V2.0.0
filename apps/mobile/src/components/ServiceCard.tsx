import { IonIcon, IonRippleEffect } from "@ionic/react";

interface ServiceCardProps {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
  /** Destaca visualmente la tarjeta como acción principal */
  featured?: boolean;
  /** Muestra la tarjeta como deshabilitada (próximamente) */
  disabled?: boolean;
  /** Texto del badge de estado */
  badge?: string;
}

export function ServiceCard({
  icon,
  title,
  subtitle,
  color,
  onClick,
  featured,
  disabled,
  badge,
}: ServiceCardProps): JSX.Element {
  return (
    <div
      className={`rapago-service-card${featured ? " rapago-service-card--featured" : ""}${disabled ? " rapago-service-card--disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={0}
      aria-label={disabled ? `${title} — Próximamente` : `${title}: ${subtitle}`}
      aria-disabled={disabled}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <IonRippleEffect />

      {badge && (
        <span className="rapago-service-card__badge">{badge}</span>
      )}

      <div
        className={`rapago-service-card__icon-wrap rapago-service-card__icon-wrap--${color}`}
      >
        <IonIcon
          icon={icon}
          className={`rapago-service-card__icon rapago-service-card__icon--${color}`}
        />
      </div>

      <div className="rapago-service-card__title">{title}</div>
      <div className="rapago-service-card__subtitle">{subtitle}</div>
    </div>
  );
}