import { IonSkeletonText } from "@ionic/react";

interface SkeletonCardProps {
  height?: string;
  count?: number;
}

export function SkeletonCard({ height = "120px" }: { height?: string }): JSX.Element {
  return (
    <div style={{ padding: "6px 0" }}>
      <IonSkeletonText
        animated
        style={{ height, borderRadius: "16px", width: "100%", margin: 0 }}
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
