import { IonSkeletonText } from "@ionic/react";
import type { CSSProperties } from "react";

interface SkeletonCardProps {
  height?: string;
  count?: number;
}

/* El esqueleto de fábrica de Ionic es un gris fijo: sobre el fondo volcánico
   se veía como un parche claro y en modo día casi desaparecía. Estas variables
   lo atan a la superficie del tema, así que el placeholder ocupa exactamente el
   sitio que ocupará la tarjeta real, con su mismo color y su mismo borde. */
const skeletonSurface = {
  "--background": "var(--rp-surface-soft)",
  "--background-rgb": "var(--rp-skeleton-rgb)",
} as CSSProperties;

export function SkeletonCard({ height = "120px" }: { height?: string }): JSX.Element {
  return (
    <div style={{ padding: "6px 0" }}>
      <IonSkeletonText
        animated
        style={{
          ...skeletonSurface,
          height,
          borderRadius: "var(--rp-radius-sm, 16px)",
          width: "100%",
          margin: 0,
          border: "1px solid var(--rp-divider)",
        }}
      />
    </div>
  );
}

export function SkeletonList({ count = 3, height = "120px" }: SkeletonCardProps): JSX.Element {
  return (
    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} height={height} />
      ))}
    </div>
  );
}
