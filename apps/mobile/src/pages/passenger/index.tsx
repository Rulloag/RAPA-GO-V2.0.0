import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useState, useCallback } from "react";
import {
  carOutline,
  compassOutline,
  keyOutline,
  personOutline,
  walletOutline,
} from "ionicons/icons";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { passengerProfileService, type PassengerProfileData } from "../../features/passengers/passengerProfile.service.js";
import { HomeHeader } from "../../components/HomeHeader";
import { ActionCard } from "../../components/ActionCard";
import { useConnectivity } from "../../hooks/useConnectivity";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { ridesService, type RideRequestData } from "../../features/rides/rides.service";
import { MapFallback } from "../../components/MapFallback";
import { DriverSummaryCard } from "../../components/DriverSummaryCard";
import { RAPA_NUI_PLACES, RAPAGO_CONTACT, WA_MESSAGES } from "@rapa-go/shared";
import { WhatsAppButton } from "../../components/WhatsAppButton";

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "4px", margin: "8px 0" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          onClick={() => onChange(s)}
          style={{ fontSize: "1.6rem", cursor: "pointer", color: s <= value ? "#f4c430" : "#ccc" }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

const RIDE_STATUS_LABEL: Record<string, string> = {
  requested:       "Solicitado",
  accepted:        "Conductor asignado",
  driver_en_route: "Conductor en camino",
  driver_arrived:  "Conductor llegó",
  in_progress:     "En curso",
  completed:       "Completado",
  cancelled:       "Cancelado",
};

const RIDE_STATUS_COLOR: Record<string, string> = {
  requested:       "warning",
  accepted:        "primary",
  driver_en_route: "tertiary",
  driver_arrived:  "secondary",
  in_progress:     "success",
  completed:       "medium",
  cancelled:       "danger",
};

export function PassengerHomePage(): JSX.Element {
  const isOnline = useConnectivity();

  return (
    <IonPage>
      <HomeHeader title="Inicio" />
      <IonContent className="ion-padding">
        {!isOnline && (
          <IonCard style={{ margin: "0 0 12px", background: "#fff3cd", border: "1px solid #ffc107" }}>
            <IonCardContent style={{ padding: "8px 14px" }}>
              <IonText>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b4700" }}>
                  Modo offline — tus viajes se sincronizarán cuando recuperes conexión.
                </p>
              </IonText>
              <WhatsAppButton
                phone={RAPAGO_CONTACT.adminPhone}
                message={WA_MESSAGES.passengerToAdmin({ origin: "mi ubicación", destination: "mi destino", name: "pasajero" })}
                label="Contactar operador por WhatsApp"
                size="small"
                fill="solid"
                style={{ marginTop: "8px" }}
              />
            </IonCardContent>
          </IonCard>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          <ActionCard
            icon={carOutline}
            title="Solicitar Viaje"
            subtitle="Reserva tu traslado en Rapa Nui"
            route={ROUTES.PASSENGER.REQUEST_RIDE}
            color="primary"
          />
          <ActionCard
            icon={carOutline}
            title="Mis Viajes"
            subtitle="Historial y viajes activos"
            route={ROUTES.PASSENGER.TRIPS}
            color="primary"
          />
          <ActionCard
            icon={compassOutline}
            title="Guías Turísticos"
            subtitle="Tours y guías locales"
            route={ROUTES.PASSENGER.GUIDES}
            color="primary"
          />
          <ActionCard
            icon={keyOutline}
            title="Arriendo"
            subtitle="Vehículos disponibles"
            route={ROUTES.PASSENGER.RENTALS}
            color="primary"
          />
          <ActionCard
            icon={walletOutline}
            title="Wallet"
            subtitle="Saldo y transacciones"
            route={ROUTES.PASSENGER.WALLET}
            color="primary"
          />
          <ActionCard
            icon={personOutline}
            title="Perfil"
            subtitle="Datos personales y documentos"
            route={ROUTES.PROFILE.INDEX}
            color="medium"
          />
        </div>
      </IonContent>
    </IonPage>
  );
}

export function PassengerRequestRidePage(): JSX.Element {
  return <RequestRidePage />;
}

function RequestRidePage(): JSX.Element {
  const { session } = useAuth();

  const [originInput,       setOriginInput]       = useState("");
  const [destInput,         setDestInput]         = useState("");
  const [notesInput,        setNotesInput]        = useState("");
  const [selectedOriginId,  setSelectedOriginId]  = useState<string>("");
  const [selectedDestId,    setSelectedDestId]    = useState<string>("");
  const [submitting,        setSubmitting]        = useState(false);
  const [submitError,       setSubmitError]       = useState<string | null>(null);
  const [submitted,         setSubmitted]         = useState<RideRequestData | null>(null);

  const sortedPlaces = [...RAPA_NUI_PLACES].sort((a, b) => {
    if (a.isPopular && !b.isPopular) return -1;
    if (!a.isPopular && b.isPopular) return 1;
    return a.sortOrder - b.sortOrder;
  });

  function handleOriginPlaceSelect(placeId: string) {
    const place = RAPA_NUI_PLACES.find(p => p.id === placeId);
    if (place) {
      setOriginInput(place.name);
      setSelectedOriginId(placeId);
    }
  }

  function handleDestPlaceSelect(placeId: string) {
    const place = RAPA_NUI_PLACES.find(p => p.id === placeId);
    if (place) {
      setDestInput(place.name);
      setSelectedDestId(placeId);
    }
  }

  async function handleRequest() {
    if (!session?.accessToken) return;
    const origin = originInput.trim();
    const dest   = destInput.trim();
    if (!origin || !dest) {
      setSubmitError("Origen y destino son requeridos.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const input: import("../../features/rides/rides.service").CreateRideInput = {
        originText:      origin,
        destinationText: dest,
      };
      const trimNotes = notesInput.trim();
      if (trimNotes) input.notes = trimNotes;
      const ride = await ridesService.createRideRequest(session.accessToken, input);
      setSubmitted(ride);
      setOriginInput("");
      setDestInput("");
      setNotesInput("");
      setSelectedOriginId("");
      setSelectedDestId("");
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
              <IonSelect
                interface="action-sheet"
                placeholder="Seleccionar origen frecuente"
                value={selectedOriginId}
                onIonChange={(e) => handleOriginPlaceSelect(e.detail.value as string)}
              >
                {sortedPlaces.map(place => (
                  <IonSelectOption key={place.id} value={place.id}>
                    {place.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Origen</IonLabel>
              <IonInput
                value={originInput}
                onIonInput={(e) => { setOriginInput(String(e.detail.value ?? "")); setSelectedOriginId(""); }}
                placeholder="Ej: Hotel Hanga Roa Eco Village"
                maxlength={150}
                clearInput
              />
            </IonItem>

            <IonItem lines="full" style={{ marginTop: "8px" }}>
              <IonLabel>Lugar frecuente (destino)</IonLabel>
              <IonSelect
                interface="action-sheet"
                placeholder="Seleccionar destino frecuente"
                value={selectedDestId}
                onIonChange={(e) => handleDestPlaceSelect(e.detail.value as string)}
              >
                {sortedPlaces.map(place => (
                  <IonSelectOption key={place.id} value={place.id}>
                    {place.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonItem lines="full" style={{ marginTop: "8px" }}>
              <IonLabel position="stacked">Destino</IonLabel>
              <IonInput
                value={destInput}
                onIonInput={(e) => { setDestInput(String(e.detail.value ?? "")); setSelectedDestId(""); }}
                placeholder="Ej: Aeropuerto Mataveri"
                maxlength={150}
                clearInput
              />
            </IonItem>

            <IonItem lines="none" style={{ marginTop: "8px" }}>
              <IonLabel position="stacked">Notas (opcional)</IonLabel>
              <IonTextarea
                value={notesInput}
                onIonInput={(e) => setNotesInput(String(e.detail.value ?? ""))}
                placeholder="Ej: Llevar maletas grandes"
                maxlength={500}
                rows={3}
              />
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
                  <div style={{
                    marginTop: "8px",
                    padding: "8px 12px",
                    background: "var(--ion-color-light)",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                  }}>
                    <strong>Tarifa estimada: ${submitted.estimatedFareClp.toLocaleString("es-CL")} CLP</strong>
                    <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                      Tarifa referencial. El cálculo real se implementará en fase futura.
                    </div>
                  </div>
                )}
              </div>
            )}
            {submitError && (
              <IonText color="danger">
                <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>{submitError}</p>
              </IonText>
            )}

            <IonButton
              expand="block"
              style={{ marginTop: "16px" }}
              onClick={() => void handleRequest()}
              disabled={submitting}
            >
              {submitting ? <IonSpinner name="dots" /> : "Solicitar viaje"}
            </IonButton>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
}

export function PassengerTripsPage(): JSX.Element {
  return <TripsPage />;
}

function TripsPage(): JSX.Element {
  const { session } = useAuth();

  const [rides,       setRides]       = useState<RideRequestData[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [ratingRideId,  setRatingRideId]  = useState<string | null>(null);
  const [ratingStars,   setRatingStars]   = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError,   setRatingError]   = useState<string | null>(null);
  const [ratedIds,      setRatedIds]      = useState<Set<string>>(new Set());

  const loadRides = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await ridesService.listMyRides(session.accessToken);
      setRides(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar tus viajes.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadRides(); }, [loadRides]);

  async function handleCancel(rideId: string) {
    if (!session?.accessToken) return;
    setCancelling(rideId);
    setCancelError(null);
    try {
      const updated = await ridesService.cancelRideRequest(session.accessToken, rideId);
      setRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error al cancelar el viaje.");
    } finally {
      setCancelling(null);
    }
  }

  async function handleSubmitRating() {
    if (!session?.accessToken || !ratingRideId) return;
    setSubmittingRating(true);
    setRatingError(null);
    try {
      await ridesService.rateRide(session.accessToken, ratingRideId, ratingStars, ratingComment.trim() || undefined);
      setRatedIds((prev) => new Set([...prev, ratingRideId]));
      setRatingRideId(null);
      setRatingStars(5);
      setRatingComment("");
    } catch (err) {
      setRatingError(err instanceof Error ? err.message : "Error al calificar el viaje.");
    } finally {
      setSubmittingRating(false);
    }
  }

  async function handleCancelAccepted(rideId: string) {
    if (!session?.accessToken) return;
    setCancelling(rideId);
    setCancelError(null);
    try {
      const updated = await ridesService.cancelAcceptedRide(session.accessToken, rideId);
      setRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error al cancelar el viaje.");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mis Viajes</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void loadRides().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && rides.length === 0 && (
          <IonText color="medium"><p>No tienes solicitudes de viaje todavía.</p></IonText>
        )}

        {!loading && rides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {rides.map((ride) => {
              const color = RIDE_STATUS_COLOR[ride.status] ?? "medium";
              const label = RIDE_STATUS_LABEL[ride.status] ?? ride.status;
              const ts = (label: string, iso: string | null) =>
                iso ? <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "3px" }}>{label}: {new Date(iso).toLocaleString("es-CL")}</div> : null;
              return (
                <IonCard key={ride.id} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "14px 16px" }}>
                    <MapFallback
                      origin={{ text: ride.originText }}
                      destination={{ text: ride.destinationText }}
                      height={130}
                    />
                    {ride.driverName && ["accepted", "driver_en_route", "driver_arrived", "in_progress", "completed"].includes(ride.status) && (
                      <DriverSummaryCard
                        driverName={ride.driverName}
                        driverRatingAverage={ride.driverRatingAverage}
                        driverRatingCount={ride.driverRatingCount}
                        status={ride.status}
                      />
                    )}
                    {!ride.driverName && ride.status === "requested" && (
                      <div style={{ marginTop: "10px", fontSize: "0.82rem", color: "var(--ion-color-medium)", fontStyle: "italic" }}>
                        Esperando asignación de conductor.
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginTop: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px" }}>
                          {ride.originText} → {ride.destinationText}
                        </div>
                        <IonBadge color={color} style={{ fontSize: "0.7rem" }}>{label}</IonBadge>
                        {ride.isOfflineBooking && (
                          <IonBadge color="warning" style={{ fontSize: "0.7rem", marginLeft: "6px" }}>Reserva telefónica</IonBadge>
                        )}
                        {ride.estimatedFareClp != null && (
                          <div style={{ marginTop: "4px", fontSize: "0.78rem", color: "var(--ion-color-dark)", fontWeight: 500 }}>
                            Tarifa est.: ${ride.estimatedFareClp.toLocaleString("es-CL")} CLP
                          </div>
                        )}
                        {ride.notes && (
                          <div style={{ marginTop: "5px", fontSize: "0.8rem", color: "var(--ion-color-medium)" }}>
                            {ride.notes}
                          </div>
                        )}
                        <div style={{ marginTop: "5px" }}>
                          {ts("Solicitado", ride.requestedAt)}
                          {ride.acceptedAt && ts("Conductor asignado", ride.acceptedAt)}
                          {ride.enRouteAt  && ts("Conductor en camino", ride.enRouteAt)}
                          {ride.arrivedAt  && ts("Conductor llegó", ride.arrivedAt)}
                          {(ride.status === "in_progress" || ride.status === "completed") && ts("Iniciado", ride.startedAt)}
                          {ride.status === "completed" && ts("Completado", ride.completedAt)}
                          {ride.status === "cancelled" && ts("Cancelado", ride.cancelledAt)}
                        </div>
                        {ride.status === "cancelled" && ride.cancellationReason && (
                          <div style={{ marginTop: "5px", fontSize: "0.75rem", color: "var(--ion-color-danger)" }}>
                            Motivo: {ride.cancellationReason}
                          </div>
                        )}
                        {ride.status === "cancelled" && ride.cancelledByRole && (
                          <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)" }}>
                            Cancelado por: {ride.cancelledByRole === "passenger" ? "pasajero" : "conductor"}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                        {(ride.status === "requested" || ride.status === "accepted") && (
                          <IonButton
                            size="small"
                            fill="outline"
                            color="danger"
                            disabled={cancelling === ride.id}
                            onClick={() => void (ride.status === "requested" ? handleCancel(ride.id) : handleCancelAccepted(ride.id))}
                          >
                            {cancelling === ride.id ? <IonSpinner name="dots" /> : "Cancelar"}
                          </IonButton>
                        )}
                        {ride.status === "completed" && !ratedIds.has(ride.id) && ratingRideId !== ride.id && (
                          <IonButton
                            size="small"
                            fill="outline"
                            color="warning"
                            onClick={() => { setRatingRideId(ride.id); setRatingStars(5); setRatingComment(""); setRatingError(null); }}
                          >
                            Calificar
                          </IonButton>
                        )}
                        {ride.status === "completed" && ratedIds.has(ride.id) && (
                          <IonText color="success" style={{ fontSize: "0.75rem" }}>✓ Calificado</IonText>
                        )}
                        {ride.status === "completed" && (
                          <WhatsAppButton
                            phone={RAPAGO_CONTACT.adminPhone}
                            message={WA_MESSAGES.passengerToAdmin({ origin: ride.originText, destination: ride.destinationText, name: "pasajero" })}
                            label="Soporte"
                          />
                        )}
                        {ride.driverName && ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(ride.status) && (
                          <WhatsAppButton
                            phone={RAPAGO_CONTACT.adminPhone}
                            message={WA_MESSAGES.passengerToAdmin({ origin: ride.originText, destination: ride.destinationText, name: "pasajero" })}
                            label="Operador"
                          />
                        )}
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        {cancelError && (
          <IonText color="danger">
            <p style={{ marginTop: "12px", fontSize: "0.85rem" }}>{cancelError}</p>
          </IonText>
        )}

        {ratingRideId && (
          <IonCard style={{ margin: "12px 0 0" }}>
            <IonCardContent style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>Calificar conductor</div>
              <StarRatingInput value={ratingStars} onChange={setRatingStars} />
              <IonItem lines="none" style={{ "--padding-start": "0" }}>
                <IonTextarea
                  value={ratingComment}
                  onIonInput={(e) => setRatingComment(String(e.detail.value ?? ""))}
                  placeholder="Comentario opcional"
                  maxlength={500}
                  rows={2}
                />
              </IonItem>
              {ratingError && <IonText color="danger"><p style={{ fontSize: "0.82rem", margin: "4px 0" }}>{ratingError}</p></IonText>}
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <IonButton size="small" onClick={() => void handleSubmitRating()} disabled={submittingRating}>
                  {submittingRating ? <IonSpinner name="dots" /> : "Enviar"}
                </IonButton>
                <IonButton size="small" fill="outline" color="medium" onClick={() => setRatingRideId(null)}>
                  Cancelar
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
}

export function PassengerGuidesPage(): JSX.Element {
  const m = meta("/passenger/guides");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function PassengerRentalsPage(): JSX.Element {
  const m = meta("/passenger/rentals");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function PassengerWalletPage(): JSX.Element {
  const m = meta("/passenger/wallet");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function PassengerProfilePage(): JSX.Element {
  const { session } = useAuth();

  const [profile,   setProfile]   = useState<PassengerProfileData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk,    setSaveOk]    = useState(false);

  // editable fields
  const [phone,                 setPhone]                 = useState("");
  const [preferredLanguage,     setPreferredLanguage]     = useState("es");
  const [notificationEnabled,   setNotificationEnabled]   = useState(true);
  const [emailNotifications,    setEmailNotifications]    = useState(true);
  const [smsNotifications,      setSmsNotifications]      = useState(false);
  const [emergencyContactName,  setEmergencyContactName]  = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const loadProfile = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await passengerProfileService.getMyProfile(session.accessToken);
      setProfile(data);
      setPhone(data.phone ?? "");
      setPreferredLanguage(data.preferredLanguage);
      setNotificationEnabled(data.notificationEnabled);
      setEmailNotifications(data.emailNotifications);
      setSmsNotifications(data.smsNotifications);
      setEmergencyContactName(data.emergencyContactName ?? "");
      setEmergencyContactPhone(data.emergencyContactPhone ?? "");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar el perfil.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  async function handleSave() {
    if (!session?.accessToken) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const payload: import("../../features/passengers/passengerProfile.service.js").UpsertPassengerProfilePayload = {
        preferredLanguage,
        notificationEnabled,
        emailNotifications,
        smsNotifications,
      };
      const trimPhone = phone.trim();
      if (trimPhone) payload.phone = trimPhone;
      const trimEmName = emergencyContactName.trim();
      if (trimEmName) payload.emergencyContactName = trimEmName;
      const trimEmPhone = emergencyContactPhone.trim();
      if (trimEmPhone) payload.emergencyContactPhone = trimEmPhone;

      const updated = await passengerProfileService.upsertMyProfile(session.accessToken, payload);
      setProfile(updated);
      setSaveOk(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  const userName = session?.user?.name ?? "";
  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mi Perfil</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void loadProfile().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && (
          <IonText color="danger"><p>{loadError}</p></IonText>
        )}

        {!loading && profile && (
          <>
            {!profile.phone && (
              <IonCard style={{ margin: "0 0 12px", background: "#fff3cd", border: "1px solid #ffc107" }}>
                <IonCardContent style={{ padding: "8px 14px" }}>
                  <IonText>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b4700" }}>
                      Complete su teléfono para solicitar viajes
                    </p>
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

            {/* Avatar */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <div style={{
                width: "72px", height: "72px", borderRadius: "50%",
                background: "var(--ion-color-primary)", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: "1.6rem", fontWeight: 700, color: "#fff",
              }}>
                {initials || "?"}
              </div>
            </div>

            {/* Personal data */}
            <IonList>
              <IonListHeader>
                <IonLabel><strong>Datos personales</strong></IonLabel>
              </IonListHeader>
              <IonItem lines="full">
                <IonLabel position="stacked">Nombre</IonLabel>
                <IonInput value={userName} readonly />
              </IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Email</IonLabel>
                <IonInput value={session?.user?.email ?? ""} readonly />
              </IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Teléfono</IonLabel>
                <IonInput
                  value={phone}
                  onIonInput={(e) => setPhone(String(e.detail.value ?? ""))}
                  placeholder="+56 9 1234 5678"
                  type="tel"
                  maxlength={20}
                  clearInput
                />
              </IonItem>
            </IonList>

            {/* Preferred language */}
            <IonList style={{ marginTop: "16px" }}>
              <IonListHeader>
                <IonLabel><strong>Idioma preferido</strong></IonLabel>
              </IonListHeader>
              <IonItem lines="none">
                <IonLabel>Idioma</IonLabel>
                <IonSelect
                  interface="action-sheet"
                  value={preferredLanguage}
                  onIonChange={(e) => setPreferredLanguage(e.detail.value as string)}
                >
                  <IonSelectOption value="es">Español</IonSelectOption>
                  <IonSelectOption value="en">English</IonSelectOption>
                  <IonSelectOption value="rapa_nui">Rapa Nui</IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonList>

            {/* Notifications */}
            <IonList style={{ marginTop: "16px" }}>
              <IonListHeader>
                <IonLabel><strong>Notificaciones</strong></IonLabel>
              </IonListHeader>
              <IonItem lines="full">
                <IonLabel>Notificaciones activas</IonLabel>
                <IonToggle
                  slot="end"
                  checked={notificationEnabled}
                  onIonChange={(e) => setNotificationEnabled(e.detail.checked)}
                />
              </IonItem>
              <IonItem lines="full">
                <IonLabel>Notificaciones por email</IonLabel>
                <IonToggle
                  slot="end"
                  checked={emailNotifications}
                  onIonChange={(e) => setEmailNotifications(e.detail.checked)}
                />
              </IonItem>
              <IonItem lines="none">
                <IonLabel>Notificaciones por SMS</IonLabel>
                <IonToggle
                  slot="end"
                  checked={smsNotifications}
                  onIonChange={(e) => setSmsNotifications(e.detail.checked)}
                />
              </IonItem>
            </IonList>

            {/* Emergency contact */}
            <IonList style={{ marginTop: "16px" }}>
              <IonListHeader>
                <IonLabel><strong>Contacto de emergencia</strong></IonLabel>
              </IonListHeader>
              <IonItem lines="full">
                <IonLabel position="stacked">Nombre</IonLabel>
                <IonInput
                  value={emergencyContactName}
                  onIonInput={(e) => setEmergencyContactName(String(e.detail.value ?? ""))}
                  placeholder="Nombre del contacto"
                  maxlength={100}
                  clearInput
                />
              </IonItem>
              <IonItem lines="none">
                <IonLabel position="stacked">Teléfono</IonLabel>
                <IonInput
                  value={emergencyContactPhone}
                  onIonInput={(e) => setEmergencyContactPhone(String(e.detail.value ?? ""))}
                  placeholder="+56 9 1234 5678"
                  type="tel"
                  maxlength={20}
                  clearInput
                />
              </IonItem>
            </IonList>

            {saveOk && (
              <IonText color="success">
                <p style={{ margin: "12px 0 0", fontSize: "0.85rem" }}>Perfil guardado correctamente.</p>
              </IonText>
            )}
            {saveError && (
              <IonText color="danger">
                <p style={{ margin: "12px 0 0", fontSize: "0.85rem" }}>{saveError}</p>
              </IonText>
            )}

            <IonButton
              expand="block"
              style={{ marginTop: "20px" }}
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? <IonSpinner name="dots" /> : "Guardar cambios"}
            </IonButton>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
