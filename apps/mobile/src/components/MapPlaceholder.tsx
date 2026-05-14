import { IonText } from "@ionic/react";

interface MapPlaceholderProps {
  originText?:      string;
  destinationText?: string;
  height?:          number | string;
}

export function MapPlaceholder({
  originText,
  destinationText,
  height = 200,
}: MapPlaceholderProps): JSX.Element {
  return (
    <div
      style={{
        height,
        borderRadius:    "10px",
        overflow:        "hidden",
        border:          "1px solid var(--ion-color-medium-shade)",
        background:      "linear-gradient(135deg, #e8f0e9 0%, #d4e6d5 40%, #c8ddc9 100%)",
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        position:        "relative",
        gap:             "6px",
        padding:         "16px",
      }}
    >
      {/* Decorative grid lines simulating a map */}
      <svg
        style={{ position: "absolute", inset: 0, opacity: 0.15, width: "100%", height: "100%" }}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        {/* Horizontal lines */}
        {[0.2, 0.4, 0.6, 0.8].map((y) => (
          <line key={`h${y}`} x1="0%" y1={`${y * 100}%`} x2="100%" y2={`${y * 100}%`}
            stroke="#2d6a4f" strokeWidth="1" />
        ))}
        {/* Vertical lines */}
        {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((x) => (
          <line key={`v${x}`} x1={`${x * 100}%`} y1="0%" x2={`${x * 100}%`} y2="100%"
            stroke="#2d6a4f" strokeWidth="1" />
        ))}
        {/* Simulated road */}
        <path d="M 10% 80% Q 50% 30% 90% 20%"
          stroke="#74c69d" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>

      {/* Map pin icon top */}
      <div style={{ fontSize: "1.6rem", zIndex: 1 }}>📍</div>

      {/* Origin → Destination */}
      {(originText || destinationText) && (
        <div
          style={{
            zIndex:       1,
            background:   "rgba(255,255,255,0.88)",
            borderRadius: "8px",
            padding:      "6px 12px",
            textAlign:    "center",
            maxWidth:     "90%",
          }}
        >
          {originText && (
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ion-color-dark)" }}>
              <span style={{ color: "var(--ion-color-success-shade)" }}>▲</span>{" "}
              {originText}
            </div>
          )}
          {originText && destinationText && (
            <div style={{ fontSize: "0.7rem", color: "var(--ion-color-medium)", margin: "2px 0" }}>↓</div>
          )}
          {destinationText && (
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ion-color-dark)" }}>
              <span style={{ color: "var(--ion-color-danger)" }}>▼</span>{" "}
              {destinationText}
            </div>
          )}
        </div>
      )}

      {/* Placeholder notice */}
      <IonText color="medium">
        <p
          style={{
            zIndex:     1,
            margin:     0,
            fontSize:   "0.68rem",
            textAlign:  "center",
            background: "rgba(255,255,255,0.75)",
            borderRadius: "6px",
            padding:    "3px 8px",
          }}
        >
          Mapa real con ubicación se implementará en fase futura.
        </p>
      </IonText>
    </div>
  );
}
