import { useCallback, useRef } from "react";
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonBadge, IonNote,
} from "@ionic/react";
import { MapView, useGoogleMaps } from "../../features/maps/index.js";
import type { GoogleMapInstance } from "../../features/maps/index.js";

const HANGA_ROA: { lat: number; lng: number } = { lat: -27.1500, lng: -109.4333 };

const STATUS_COLOR: Record<string, string> = {
  loaded:  "success",
  loading: "warning",
  idle:    "medium",
  error:   "danger",
  "no-key": "danger",
};

const STATUS_LABEL: Record<string, string> = {
  loaded:   "SDK cargado",
  loading:  "Cargando SDK…",
  idle:     "En espera",
  error:    "Error de carga",
  "no-key": "Key no configurada",
};

export function MapTestPage(): JSX.Element {
  const mapStatus  = useGoogleMaps();
  const mapRef     = useRef<GoogleMapInstance | null>(null);

  const handleMapReady = useCallback((map: GoogleMapInstance) => {
    mapRef.current = map;
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Test — Google Maps</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">

        {/* Status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <IonBadge color={STATUS_COLOR[mapStatus] ?? "medium"}>
            {STATUS_LABEL[mapStatus] ?? mapStatus}
          </IonBadge>
          <IonNote style={{ fontSize: "0.75rem" }}>
            features/maps — integración aislada
          </IonNote>
        </div>

        {/* Map */}
        <MapView
          center={HANGA_ROA}
          zoom={14}
          height="360px"
          markers={[
            {
              position: HANGA_ROA,
              title:    "Hanga Roa — RAPA GO",
            },
          ]}
          onMapReady={handleMapReady}
        />

        {/* Info card */}
        <IonCard style={{ marginTop: "16px" }}>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: "0.95rem" }}>Coordenadas de referencia</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.82rem" }}>
              <div><strong>Lugar:</strong> Hanga Roa, Isla de Pascua</div>
              <div><strong>Lat:</strong> {HANGA_ROA.lat}</div>
              <div><strong>Lng:</strong> {HANGA_ROA.lng}</div>
              <div><strong>Zoom:</strong> 14</div>
            </div>
          </IonCardContent>
        </IonCard>

        {/* Next steps note */}
        <IonCard style={{ marginTop: "8px", background: "var(--ion-color-light)" }}>
          <IonCardContent style={{ padding: "12px 16px" }}>
            <IonNote style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
              Esta página es temporal para validar la integración.
              La próxima fase conectará ubicación actual, origen/destino y cálculo de ruta.
            </IonNote>
          </IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  );
}
