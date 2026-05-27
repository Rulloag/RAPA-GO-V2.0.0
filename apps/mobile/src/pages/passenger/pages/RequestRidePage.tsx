import { IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonNote, IonPage, IonSelect, IonSelectOption, IonSpinner, IonText, IonTextarea, IonTitle, IonToolbar } from "@ionic/react";
import { useState, useEffect } from "react";
import { MapFallback } from "../../../components/MapFallback.js";
import { useAuth } from "../../../features/auth/index.js";
import { ridesService, type RideRequestData, type CreateRideInput } from "../../../features/rides/rides.service.js";
import { fareSettingsService } from "../../../features/fareSettings/fareSettings.service.js";
import { RAPA_NUI_PLACES, getDistanceBetween, getEstimatedFare } from "@rapa-go/shared";
import { RIDE_STATUS_LABEL } from "../shared.js";

export default function RequestRidePage(): JSX.Element {
  const { session } = useAuth();

  const [originInput,      setOriginInput]      = useState("");
  const [destInput,        setDestInput]        = useState("");
  const [notesInput,       setNotesInput]       = useState("");
  const [selectedOriginId, setSelectedOriginId] = useState<string>("");
  const [selectedDestId,   setSelectedDestId]   = useState<string>("");
  const [submitting,       setSubmitting]       = useState(false);
  const [submitError,      setSubmitError]      = useState<string | null>(null);
  const [submitted,        setSubmitted]        = useState<RideRequestData | null>(null);
  const [farePreview,      setFarePreview]      = useState<{ km: number; minutes: number; fare: number; isZoneFare: boolean } | null>(null);

  useEffect(() => {
    if (!selectedOriginId || !selectedDestId) { setFarePreview(null); return; }
    const dist = getDistanceBetween(selectedOriginId, selectedDestId);
    if (!dist) { setFarePreview(null); return; }
    const originName = RAPA_NUI_PLACES.find(p => p.id === selectedOriginId)?.name ?? originInput;
    const destName   = RAPA_NUI_PLACES.find(p => p.id === selectedDestId)?.name ?? destInput;
    fareSettingsService.getZoneFares({ zoneFrom: originName, zoneTo: destName }).then(zones => {
      const zone = zones.find(z => z.isActive);
      if (zone) {
        setFarePreview({ km: dist.km, minutes: dist.minutes, fare: zone.fare, isZoneFare: true });
      } else {
        setFarePreview({ km: dist.km, minutes: dist.minutes, fare: getEstimatedFare(dist.km), isZoneFare: false });
      }
    }).catch(() => {
      setFarePreview({ km: dist.km, minutes: dist.minutes, fare: getEstimatedFare(dist.km), isZoneFare: false });
    });
  }, [selectedOriginId, selectedDestId, originInput, destInput]);

  const sortedPlaces = [...RAPA_NUI_PLACES].sort((a, b) => {
    if (a.isPopular && !b.isPopular) return -1;
    if (!a.isPopular && b.isPopular) return 1;
    return a.sortOrder - b.sortOrder;
  });

  function handleOriginPlaceSelect(placeId: string) {
    const place = RAPA_NUI_PLACES.find(p => p.id === placeId);
    if (place) { setOriginInput(place.name); setSelectedOriginId(placeId); }
  }

  function handleDestPlaceSelect(placeId: string) {
    const place = RAPA_NUI_PLACES.find(p => p.id === placeId);
    if (place) { setDestInput(place.name); setSelectedDestId(placeId); }
  }

  async function handleRequest() {
    if (!session?.accessToken) return;
    const origin = originInput.trim();
    const dest   = destInput.trim();
    if (!origin || !dest) { setSubmitError("Origen y destino son requeridos."); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const input: CreateRideInput = { originText: origin, destinationText: dest };
      const trimNotes = notesInput.trim();
      if (trimNotes) input.notes = trimNotes;
      const ride = await ridesService.createRideRequest(session.accessToken, input);
      setSubmitted(ride);
      setOriginInput(""); setDestInput(""); setNotesInput("");
      setSelectedOriginId(""); setSelectedDestId("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al solicitar el viaje.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Solicitar Viaje</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <MapFallback
          origin={{ ...(selectedOriginId ? { id: selectedOriginId } : {}), text: originInput.trim() || "Origen" }}
          destination={{ ...(selectedDestId ? { id: selectedDestId } : {}), text: destInput.trim() || "Destino" }}
          height={180}
        />

        <IonCard style={{ marginTop: "12px" }}>
          <IonCardContent style={{ paddingTop: "12px" }}>
            <IonItem lines="full">
              <IonLabel>Lugar frecuente (origen)</IonLabel>
              <IonSelect interface="action-sheet" placeholder="Seleccionar origen frecuente" value={selectedOriginId}
                onIonChange={(e) => handleOriginPlaceSelect(e.detail.value as string)}>
                {sortedPlaces.map(place => <IonSelectOption key={place.id} value={place.id}>{place.name}</IonSelectOption>)}
              </IonSelect>
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Origen</IonLabel>
              <IonInput value={originInput} onIonInput={(e) => { setOriginInput(String(e.detail.value ?? "")); setSelectedOriginId(""); }}
                placeholder="Ej: Hotel Hanga Roa Eco Village" maxlength={150} clearInput />
            </IonItem>
            <IonItem lines="full" style={{ marginTop: "8px" }}>
              <IonLabel>Lugar frecuente (destino)</IonLabel>
              <IonSelect interface="action-sheet" placeholder="Seleccionar destino frecuente" value={selectedDestId}
                onIonChange={(e) => handleDestPlaceSelect(e.detail.value as string)}>
                {sortedPlaces.map(place => <IonSelectOption key={place.id} value={place.id}>{place.name}</IonSelectOption>)}
              </IonSelect>
            </IonItem>
            <IonItem lines="full" style={{ marginTop: "8px" }}>
              <IonLabel position="stacked">Destino</IonLabel>
              <IonInput value={destInput} onIonInput={(e) => { setDestInput(String(e.detail.value ?? "")); setSelectedDestId(""); }}
                placeholder="Ej: Aeropuerto Mataveri" maxlength={150} clearInput />
            </IonItem>
            <IonItem lines="none" style={{ marginTop: "8px" }}>
              <IonLabel position="stacked">Notas (opcional)</IonLabel>
              <IonTextarea value={notesInput} onIonInput={(e) => setNotesInput(String(e.detail.value ?? ""))}
                placeholder="Ej: Llevar maletas grandes" maxlength={500} rows={3} />
              <IonNote slot="helper" style={{ fontSize: "0.7rem" }}>Máximo 500 caracteres.</IonNote>
            </IonItem>

            {submitted && (
              <div style={{ margin: "10px 0 0" }}>
                <IonText color="success">
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>
                    ✓ Solicitud enviada — Estado: {RIDE_STATUS_LABEL[submitted.status] ?? submitted.status}
                  </p>
                </IonText>
                {submitted.estimatedFareClp != null && (
                  <div style={{ marginTop: "8px", padding: "8px 12px", background: "var(--ion-color-light)", borderRadius: "6px", fontSize: "0.85rem" }}>
                    {submitted.discountApplied && submitted.originalFareClp != null ? (
                      <>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <strong>${submitted.estimatedFareClp.toLocaleString("es-CL")} CLP</strong>
                          <span style={{ background: "var(--ion-color-success)", color: "#fff", borderRadius: "4px", padding: "1px 6px", fontSize: "0.72rem" }}>
                            -{submitted.discountPercent}% referido
                          </span>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                          Precio original: ${submitted.originalFareClp.toLocaleString("es-CL")} CLP
                        </div>
                      </>
                    ) : (
                      <strong>Tarifa estimada: ${submitted.estimatedFareClp.toLocaleString("es-CL")} CLP</strong>
                    )}
                    <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                      Tarifa referencial. El precio final lo acuerda con el conductor.
                    </div>
                  </div>
                )}
              </div>
            )}

            {farePreview && !submitted && (
              <div style={{ margin: "12px 0 0", padding: "10px 14px", background: "var(--ion-color-light)", borderRadius: "8px", fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--ion-color-medium)" }}>
                    {farePreview.km.toFixed(1)} km · ~{farePreview.minutes} min
                  </span>
                  <strong style={{ fontSize: "1rem" }}>${farePreview.fare.toLocaleString("es-CL")} CLP</strong>
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "3px" }}>
                  {farePreview.isZoneFare ? "Tarifa fija de ruta" : "Tarifa estimada por km"}
                </div>
              </div>
            )}

            {submitError && (
              <IonText color="danger">
                <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>{submitError}</p>
              </IonText>
            )}

            <IonButton expand="block" style={{ marginTop: "16px" }} onClick={() => void handleRequest()} disabled={submitting}>
              {submitting ? <IonSpinner name="dots" /> : "Solicitar viaje"}
            </IonButton>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
}
