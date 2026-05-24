import {
  IonAlert,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonDatetime,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonToast,
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
import { touristService, type GuidePublicData, type TouristServiceData, type ServiceBookingData } from "../../features/tourist/tourist.service.js";
import { useIonViewWillEnter } from "@ionic/react";
import { rentalService } from "../../features/rental/rental.service.js";
import type { RentalVehicleData as RentalVehicleDataType, RentalBookingData as RentalBookingDataType } from "../../features/rental/rental.service.js";

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
  const isOnline  = useConnectivity();
  const { session } = useAuth();
  const [profile, setProfile] = useState<PassengerProfileData | null>(null);

  useEffect(() => {
    if (!session?.accessToken) return;
    void passengerProfileService.getMyProfile(session.accessToken)
      .then(setProfile)
      .catch(() => {/* silently ignore */});
  }, [session?.accessToken]);

  const name     = session?.user?.name ?? "";
  const initials = name.trim().split(/\s+/).map((p: string) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "P";
  const hasPhone = !!profile?.phone;

  return (
    <IonPage>
      <HomeHeader title="Inicio" />
      <IonContent className="ion-padding">
        {/* Avatar + greeting */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "50%",
            background: "var(--ion-color-primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: "1rem", flexShrink: 0, overflow: "hidden",
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Hola, {name.split(" ")[0] || "pasajero"}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>Bienvenido a Rapa Go</div>
          </div>
        </div>

        {/* Phone warning */}
        {profile !== null && !hasPhone && (
          <IonCard style={{ margin: "0 0 12px", background: "#fff3cd", border: "1px solid #ffc107" }}>
            <IonCardContent style={{ padding: "8px 14px" }}>
              <IonText>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b4700" }}>
                  ⚠️ Complete su teléfono en el perfil para solicitar viajes.
                </p>
              </IonText>
            </IonCardContent>
          </IonCard>
        )}

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

        <IonCard style={{ marginTop: "20px" }}>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: "1rem" }}>¿Quieres unirte a Rapa Go?</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonButton expand="block" routerLink="/apply/driver" color="primary">
              Inscríbete como conductor
            </IonButton>
            <IonButton expand="block" routerLink="/apply/guide" color="secondary" style={{ marginTop: "8px" }}>
              Inscríbete como guía
            </IonButton>
            <IonButton expand="block" fill="outline" routerLink="/apply/status" color="medium" style={{ marginTop: "8px" }}>
              Estado de mi postulación
            </IonButton>
          </IonCardContent>
        </IonCard>
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
                          ride.driverPhone ? (
                            <WhatsAppButton
                              phone={ride.driverPhone}
                              message={WA_MESSAGES.passengerToDriver({ driverName: ride.driverName, passengerName: "pasajero", origin: ride.originText })}
                              label="Conductor"
                            />
                          ) : (
                            <WhatsAppButton
                              phone={RAPAGO_CONTACT.adminPhone}
                              message={WA_MESSAGES.passengerToAdmin({ origin: ride.originText, destination: ride.destinationText, name: "pasajero" })}
                              label="Operador"
                            />
                          )
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

const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const BOOKING_STATUS_COLOR: Record<string, string> = {
  pending:   "warning",
  confirmed: "success",
  completed: "medium",
  cancelled: "danger",
};

const SERVICE_TYPE_LABEL: Record<string, string> = {
  tour:     "Tour",
  transfer: "Traslado",
  workshop: "Taller",
  custom:   "Personalizado",
};

export function PassengerGuidesPage(): JSX.Element {
  const { session } = useAuth();
  const [guides,       setGuides]       = useState<GuidePublicData[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [searchName,   setSearchName]   = useState("");
  const [filterLang,   setFilterLang]   = useState("");
  const [selectedGuide, setSelectedGuide] = useState<GuidePublicData | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const filters: { name?: string; language?: string } = {};
      if (searchName.trim()) filters.name = searchName.trim();
      if (filterLang) filters.language = filterLang;
      const data = await touristService.listGuides(session.accessToken, filters);
      setGuides(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar guías.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, searchName, filterLang]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  if (selectedGuide) {
    return (
      <PassengerGuideDetailPage
        guide={selectedGuide}
        onBack={() => setSelectedGuide(null)}
      />
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Guías Turísticos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        <IonSearchbar
          value={searchName}
          onIonInput={(e) => setSearchName(String(e.detail.value ?? ""))}
          onIonChange={() => void load()}
          placeholder="Buscar por nombre..."
          debounce={400}
        />

        <IonItem lines="none" style={{ marginBottom: "8px" }}>
          <IonLabel>Idioma</IonLabel>
          <IonSelect
            interface="action-sheet"
            value={filterLang}
            onIonChange={(e) => setFilterLang(String(e.detail.value ?? ""))}
            placeholder="Todos"
          >
            <IonSelectOption value="">Todos</IonSelectOption>
            <IonSelectOption value="es">Español</IonSelectOption>
            <IonSelectOption value="en">English</IonSelectOption>
            <IonSelectOption value="rapa_nui">Rapa Nui</IonSelectOption>
          </IonSelect>
        </IonItem>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && guides.length === 0 && (
          <IonText color="medium"><p>No hay guías disponibles.</p></IonText>
        )}

        {!loading && guides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {guides.map((guide) => {
              const initials = guide.name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase();
              const stars = guide.ratingAverage ? Math.round(guide.ratingAverage) : 0;
              return (
                <IonCard key={guide.id} style={{ margin: 0, cursor: "pointer" }} onClick={() => setSelectedGuide(guide)}>
                  <IonCardContent style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div style={{
                        width: "48px", height: "48px", borderRadius: "50%",
                        background: "var(--ion-color-warning)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontWeight: 700, fontSize: "1rem", flexShrink: 0,
                      }}>
                        {initials || "G"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{guide.name}</div>
                        {guide.bio && (
                          <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                            {guide.bio.slice(0, 80)}{guide.bio.length > 80 ? "…" : ""}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                          {(guide.languages ?? []).map((lang) => (
                            <IonChip key={lang} style={{ fontSize: "0.7rem", height: "22px", margin: 0 }}>
                              <IonLabel>{lang.toUpperCase()}</IonLabel>
                            </IonChip>
                          ))}
                        </div>
                        <div style={{ marginTop: "4px", fontSize: "0.78rem", color: "#f4c430" }}>
                          {"★".repeat(stars)}{"☆".repeat(5 - stars)}
                          <span style={{ color: "var(--ion-color-medium)", marginLeft: "4px" }}>
                            ({guide.ratingCount})
                          </span>
                        </div>
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

function PassengerGuideDetailPage({ guide, onBack }: { guide: GuidePublicData; onBack: () => void }): JSX.Element {
  const { session } = useAuth();
  const [services,     setServices]     = useState<TouristServiceData[]>(guide.services ?? []);
  const [loading,      setLoading]      = useState(!guide.services);
  const [bookingService, setBookingService] = useState<TouristServiceData | null>(null);
  const [bookingDate,  setBookingDate]  = useState(new Date().toISOString().slice(0, 10));
  const [bookingTime,  setBookingTime]  = useState("");
  const [numPeople,    setNumPeople]    = useState(1);
  const [notes,        setNotes]        = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [pricingData,  setPricingData]  = useState<import("../../features/tourist/tourist.service.js").ServicePricingData | null>(null);

  useEffect(() => {
    if (guide.services) return;
    if (!session?.accessToken) return;
    setLoading(true);
    touristService.listGuideServices(session.accessToken, guide.id)
      .then((data) => setServices(data))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, [guide.id, guide.services, session?.accessToken]);

  useEffect(() => {
    if (!bookingService || !session?.accessToken) return;
    touristService.getServicePricing(session.accessToken, bookingService.id)
      .then((data) => setPricingData(data))
      .catch(() => setPricingData(null));
  }, [bookingService?.id, session?.accessToken]);

  const initials = guide.name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase();
  const stars = guide.ratingAverage ? Math.round(guide.ratingAverage) : 0;

  function computePrice(): { display: string; valid: boolean } {
    if (!bookingService) return { display: "", valid: false };
    if (pricingData && pricingData.tiers.length > 0) {
      const tier = pricingData.tiers.find((t) => t.minPeople <= numPeople && t.maxPeople >= numPeople);
      if (tier) return { display: `$${(tier.price / 100).toLocaleString("es-CL")} CLP`, valid: true };
      return { display: `Contactar operador para grupos de ${numPeople} personas`, valid: false };
    }
    if (bookingService.price !== null) {
      return { display: `$${((bookingService.price * numPeople) / 100).toLocaleString("es-CL")} CLP`, valid: true };
    }
    return { display: "", valid: true };
  }

  async function handleBook() {
    if (!session?.accessToken || !bookingService) return;
    setSubmitting(true);
    try {
      const input: import("../../features/tourist/tourist.service.js").CreateBookingInput = {
        serviceId:      bookingService.id,
        bookingDate,
        numberOfPeople: numPeople,
      };
      if (bookingTime) input.bookingTime = bookingTime;
      if (notes.trim()) input.notes = notes.trim();
      await touristService.createBooking(session.accessToken, input);
      setToastMsg("Reserva creada correctamente.");
      setBookingService(null);
      setNotes("");
      setNumPeople(1);
      setPricingData(null);
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "Error al reservar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButton slot="start" fill="clear" color="light" onClick={onBack}>← Volver</IonButton>
          <IonTitle>{guide.name}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "16px" }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            background: "var(--ion-color-warning)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: "1.6rem",
          }}>
            {initials || "G"}
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: "8px" }}>{guide.name}</div>
          <div style={{ fontSize: "0.82rem", color: "#f4c430", margin: "4px 0" }}>
            {"★".repeat(stars)}{"☆".repeat(5 - stars)}
            <span style={{ color: "var(--ion-color-medium)", marginLeft: "4px" }}>({guide.ratingCount} valoraciones)</span>
          </div>
          {guide.bio && (
            <div style={{ fontSize: "0.85rem", color: "var(--ion-color-medium)", textAlign: "center", marginTop: "4px" }}>
              {guide.bio}
            </div>
          )}
          {(guide.languages ?? []).length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}>
              {(guide.languages ?? []).map((lang) => (
                <IonChip key={lang} color="primary" style={{ fontSize: "0.72rem", height: "22px" }}>
                  <IonLabel>{lang.toUpperCase()}</IonLabel>
                </IonChip>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "10px" }}>Servicios disponibles</div>

        {loading && <IonSpinner name="crescent" />}

        {!loading && services.length === 0 && (
          <IonText color="medium"><p>Este guía no tiene servicios activos.</p></IonText>
        )}

        {!loading && services.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {services.map((svc) => (
              <IonCard key={svc.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", flex: 1 }}>{svc.title}</div>
                    <IonBadge color="tertiary" style={{ fontSize: "0.68rem", marginLeft: "8px", flexShrink: 0 }}>
                      {SERVICE_TYPE_LABEL[svc.type] ?? svc.type}
                    </IonBadge>
                  </div>
                  {svc.description && (
                    <div style={{ fontSize: "0.8rem", color: "var(--ion-color-medium)", marginBottom: "6px" }}>
                      {svc.description}
                    </div>
                  )}
                  <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)" }}>
                    {svc.durationMinutes && <span>{svc.durationMinutes} min · </span>}
                    {svc.maxPeople && <span>Máx {svc.maxPeople} personas · </span>}
                    {svc.meetingPoint && <span>📍 {svc.meetingPoint}</span>}
                  </div>
                  {svc.includesVehicle && (
                    <div style={{ fontSize: "0.78rem", color: "var(--ion-color-primary)", marginTop: "4px" }}>✓ Incluye vehículo</div>
                  )}
                  {!svc.includesVehicle && (
                    <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginTop: "4px" }}>Sin vehículo incluido</div>
                  )}
                  {svc.price !== null && (
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", marginTop: "6px", color: "var(--ion-color-success)" }}>
                      ${(svc.price / 100).toLocaleString("es-CL")} CLP / persona
                    </div>
                  )}
                  {(svc.includes ?? []).length > 0 && (
                    <div style={{ marginTop: "6px", fontSize: "0.78rem" }}>
                      <strong>Incluye:</strong> {(svc.includes ?? []).join(", ")}
                    </div>
                  )}
                  <IonButton
                    expand="block"
                    size="small"
                    style={{ marginTop: "10px" }}
                    onClick={() => { setBookingService(svc); setBookingDate(new Date().toISOString().slice(0, 10)); }}
                  >
                    Reservar
                  </IonButton>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}

        <IonModal isOpen={bookingService !== null} onDidDismiss={() => setBookingService(null)}>
          <IonHeader>
            <IonToolbar color="primary">
              <IonTitle>Reservar servicio</IonTitle>
              <IonButton slot="end" fill="clear" color="light" onClick={() => setBookingService(null)}>Cerrar</IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {bookingService && (
              <>
                <div style={{ fontWeight: 600, marginBottom: "12px" }}>{bookingService.title}</div>
                <IonItem lines="full">
                  <IonLabel position="stacked">Fecha</IonLabel>
                  <IonInput
                    type="date"
                    value={bookingDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onIonInput={(e) => setBookingDate(String(e.detail.value ?? ""))}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Hora (opcional)</IonLabel>
                  <IonSelect
                    interface="action-sheet"
                    value={bookingTime}
                    onIonChange={(e) => setBookingTime(String(e.detail.value ?? ""))}
                    placeholder="Sin hora específica"
                  >
                    <IonSelectOption value="">Sin hora</IonSelectOption>
                    {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"].map((t) => (
                      <IonSelectOption key={t} value={t}>{t}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem lines="full">
                  <IonLabel position="stacked">Número de personas</IonLabel>
                  <IonInput
                    type="number"
                    value={numPeople}
                    min={1}
                    max={bookingService.maxPeople ?? 20}
                    onIonInput={(e) => setNumPeople(Math.max(1, parseInt(String(e.detail.value ?? "1"), 10)))}
                  />
                </IonItem>
                <IonItem lines="none">
                  <IonLabel position="stacked">Notas (opcional)</IonLabel>
                  <IonTextarea
                    value={notes}
                    onIonInput={(e) => setNotes(String(e.detail.value ?? ""))}
                    placeholder="Indicaciones especiales..."
                    rows={3}
                    maxlength={500}
                  />
                </IonItem>
                {(() => {
                  const pr = computePrice();
                  return pr.display ? (
                    <div style={{ padding: "12px 0", fontWeight: 600, color: pr.valid ? "inherit" : "var(--ion-color-warning)" }}>
                      {pr.valid ? `Total estimado: ${pr.display}` : pr.display}
                    </div>
                  ) : null;
                })()}
                {pricingData?.conditions && (
                  <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginBottom: "6px" }}>
                    <strong>Condiciones:</strong> {pricingData.conditions}
                  </div>
                )}
                {pricingData?.cancellationPolicy && (
                  <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginBottom: "8px" }}>
                    <strong>Cancelación:</strong> {pricingData.cancellationPolicy}
                  </div>
                )}
                <IonButton
                  expand="block"
                  onClick={() => void handleBook()}
                  disabled={submitting || (pricingData !== null && pricingData.tiers.length > 0 && !pricingData.tiers.find((t) => t.minPeople <= numPeople && t.maxPeople >= numPeople))}
                  style={{ marginTop: "8px" }}
                >
                  {submitting ? <IonSpinner name="dots" /> : "Confirmar reserva"}
                </IonButton>
              </>
            )}
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={toastMsg !== null}
          message={toastMsg ?? ""}
          duration={3000}
          onDidDismiss={() => setToastMsg(null)}
          color={toastMsg?.includes("Error") || toastMsg?.includes("Error") ? "danger" : "success"}
        />
      </IonContent>
    </IonPage>
  );
}

function getBookingCountdown(createdAt: string): string {
  const expires  = new Date(createdAt).getTime() + 4 * 60 * 60 * 1000;
  const remaining = expires - Date.now();
  if (remaining <= 0) return "expired";
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function PassengerServiceBookingsPage(): JSX.Element {
  const { session } = useAuth();
  const [bookings,   setBookings]   = useState<ServiceBookingData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmId,  setConfirmId]  = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { items } = await touristService.getMyBookings(session.accessToken);
      setBookings(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar reservas.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  async function handleCancel(bookingId: string) {
    if (!session?.accessToken) return;
    setCancelling(bookingId);
    try {
      const updated = await touristService.cancelBooking(session.accessToken, bookingId);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cancelar.");
    } finally {
      setCancelling(null);
      setConfirmId(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mis Reservas de Servicios</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && bookings.length === 0 && (
          <IonText color="medium"><p>No tienes reservas de servicios turísticos.</p></IonText>
        )}

        {!loading && bookings.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {bookings.map((b) => (
              <IonCard key={b.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Reserva #{b.id.slice(0, 8)}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                        Fecha: {b.bookingDate}{b.bookingTime ? ` ${b.bookingTime}` : ""}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)" }}>
                        {b.numberOfPeople} persona{b.numberOfPeople !== 1 ? "s" : ""}
                        {b.totalPrice !== null && ` · $${(b.totalPrice / 100).toLocaleString("es-CL")} CLP`}
                      </div>
                      {b.notes && (
                        <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>{b.notes}</div>
                      )}
                      <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <IonBadge color={BOOKING_STATUS_COLOR[b.status] ?? "medium"} style={{ fontSize: "0.7rem" }}>
                          {BOOKING_STATUS_LABEL[b.status] ?? b.status}
                        </IonBadge>
                        {b.status === "pending" && (() => {
                          const cd = getBookingCountdown(b.createdAt);
                          return cd === "expired"
                            ? <IonBadge color="danger" style={{ fontSize: "0.7rem" }}>Expirada</IonBadge>
                            : <IonBadge color="warning" style={{ fontSize: "0.7rem" }}>Confirmar antes: {cd}</IonBadge>;
                        })()}
                      </div>
                      {b.cancellationReason && (
                        <div style={{ fontSize: "0.72rem", color: "var(--ion-color-danger)", marginTop: "4px" }}>
                          Motivo: {b.cancellationReason}
                        </div>
                      )}
                    </div>
                    {b.status === "pending" && (
                      <IonButton
                        size="small"
                        fill="outline"
                        color="danger"
                        disabled={cancelling === b.id}
                        onClick={() => setConfirmId(b.id)}
                      >
                        {cancelling === b.id ? <IonSpinner name="dots" /> : "Cancelar"}
                      </IonButton>
                    )}
                  </div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}

        <IonAlert
          isOpen={confirmId !== null}
          header="¿Cancelar reserva?"
          message="Esta acción no se puede deshacer."
          buttons={[
            { text: "No", role: "cancel", handler: () => setConfirmId(null) },
            { text: "Sí, cancelar", role: "confirm", handler: () => { if (confirmId) void handleCancel(confirmId); } },
          ]}
          onDidDismiss={() => setConfirmId(null)}
        />
      </IonContent>
    </IonPage>
  );
}

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  car:        "Auto",
  suv:        "SUV",
  van:        "Van",
  motorcycle: "Moto",
  bicycle:    "Bicicleta",
  quad:       "Quad",
};

const RENTAL_STATUS_COLOR: Record<string, string> = {
  pending:   "warning",
  confirmed: "success",
  active:    "primary",
  completed: "medium",
  cancelled: "danger",
};

const RENTAL_STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente",
  confirmed: "Confirmada",
  active:    "Activa",
  completed: "Completada",
  cancelled: "Cancelada",
};

export function PassengerRentalsPage(): JSX.Element {
  const { session } = useAuth();
  const [vehicles,       setVehicles]       = useState<RentalVehicleDataType[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [loadError,      setLoadError]      = useState<string | null>(null);
  const [searchText,     setSearchText]     = useState("");
  const [filterType,     setFilterType]     = useState("");
  const [selectedId,     setSelectedId]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const filters: { type?: string } = {};
      if (filterType) filters.type = filterType;
      const data = await rentalService.listAvailableVehicles(session.accessToken, filters);
      setVehicles(data.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar vehículos.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, filterType]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  const filtered = vehicles.filter((v) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return v.brand.toLowerCase().includes(q) || v.model.toLowerCase().includes(q);
  });

  if (selectedId) {
    return <PassengerRentalDetailPage vehicleId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Arriendo de Vehículos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        <IonSearchbar
          value={searchText}
          onIonInput={(e) => setSearchText(String(e.detail.value ?? ""))}
          placeholder="Buscar por marca o modelo..."
          debounce={300}
        />

        <IonItem lines="none" style={{ marginBottom: "8px" }}>
          <IonLabel>Tipo</IonLabel>
          <IonSelect
            interface="action-sheet"
            value={filterType}
            onIonChange={(e) => setFilterType(String(e.detail.value ?? ""))}
            placeholder="Todos"
          >
            <IonSelectOption value="">Todos</IonSelectOption>
            <IonSelectOption value="car">Auto</IonSelectOption>
            <IonSelectOption value="suv">SUV</IonSelectOption>
            <IonSelectOption value="van">Van</IonSelectOption>
            <IonSelectOption value="motorcycle">Moto</IonSelectOption>
            <IonSelectOption value="bicycle">Bicicleta</IonSelectOption>
            <IonSelectOption value="quad">Quad</IonSelectOption>
          </IonSelect>
        </IonItem>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && filtered.length === 0 && (
          <IonText color="medium"><p>No hay vehículos disponibles.</p></IonText>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filtered.map((v) => (
              <IonCard key={v.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                      {v.brand} {v.model}{v.year ? ` (${v.year})` : ""}
                    </div>
                    <IonBadge color="tertiary" style={{ fontSize: "0.68rem", flexShrink: 0, marginLeft: "6px" }}>
                      {VEHICLE_TYPE_LABEL[v.type] ?? v.type}
                    </IonBadge>
                  </div>

                  {v.photos && v.photos.length > 0 ? (
                    <img
                      src={v.photos[0]}
                      alt={`${v.brand} ${v.model}`}
                      style={{ width: "100%", height: "140px", objectFit: "cover", borderRadius: "6px", marginBottom: "8px" }}
                    />
                  ) : (
                    <div style={{
                      width: "100%", height: "100px", borderRadius: "6px",
                      background: "var(--ion-color-light)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: "8px", color: "var(--ion-color-medium)", fontSize: "0.85rem",
                    }}>
                      Sin foto
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", marginBottom: "8px", fontSize: "0.78rem", color: "var(--ion-color-medium)" }}>
                    {v.seats    && <span>{v.seats} asientos</span>}
                    {v.transmission && <span>{v.transmission === "manual" ? "Manual" : "Automático"}</span>}
                    {v.fuelType && <span>{v.fuelType === "gasoline" ? "Bencina" : v.fuelType === "diesel" ? "Diésel" : v.fuelType === "electric" ? "Eléctrico" : "Híbrido"}</span>}
                  </div>

                  {(v.features ?? []).length > 0 && (
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "8px" }}>
                      {(v.features ?? []).slice(0, 3).map((f) => (
                        <IonChip key={f} style={{ fontSize: "0.68rem", height: "20px", margin: 0 }}>
                          <IonLabel>{f}</IonLabel>
                        </IonChip>
                      ))}
                      {(v.features ?? []).length > 3 && (
                        <IonChip style={{ fontSize: "0.68rem", height: "20px", margin: 0 }}>
                          <IonLabel>+{(v.features ?? []).length - 3}</IonLabel>
                        </IonChip>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--ion-color-success)" }}>
                      ${(v.dailyPrice / 100).toLocaleString("es-CL")}/día
                    </div>
                    <IonButton size="small" onClick={() => setSelectedId(v.id)}>Ver detalles</IonButton>
                  </div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

function PassengerRentalDetailPage({ vehicleId, onBack }: { vehicleId: string; onBack: () => void }): JSX.Element {
  const { session } = useAuth();
  const [vehicle,   setVehicle]   = useState<RentalVehicleDataType | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [returnLocation, setReturnLocation] = useState("");
  const [notes,     setNotes]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg,  setToastMsg]  = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!session?.accessToken) return;
    void rentalService.getVehicle(session.accessToken, vehicleId)
      .then(setVehicle)
      .catch(() => setVehicle(null))
      .finally(() => setLoading(false));
  }, [session?.accessToken, vehicleId]);

  const days = (startDate && endDate && endDate > startDate)
    ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  async function handleBook() {
    if (!session?.accessToken || !vehicle) return;
    if (!startDate || !endDate) { setToastMsg("Selecciona fechas de inicio y fin."); return; }
    setSubmitting(true);
    try {
      const input: import("../../features/rental/rental.service.js").CreateBookingInput = {
        vehicleId: vehicle.id,
        startDate,
        endDate,
      };
      if (pickupTime)     input.pickupTime     = pickupTime;
      if (returnTime)     input.returnTime     = returnTime;
      if (pickupLocation.trim()) input.pickupLocation = pickupLocation.trim();
      if (returnLocation.trim()) input.returnLocation = returnLocation.trim();
      if (notes.trim())   input.notes          = notes.trim();
      await rentalService.createRentalBooking(session.accessToken, input);
      setToastMsg("Reserva creada correctamente.");
      setStartDate(""); setEndDate(""); setNotes(""); setPickupTime(""); setReturnTime("");
      setPickupLocation(""); setReturnLocation("");
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "Error al reservar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <IonPage>
        <IonHeader><IonToolbar color="primary"><IonButton slot="start" fill="clear" color="light" onClick={onBack}>← Volver</IonButton><IonTitle>Vehículo</IonTitle></IonToolbar></IonHeader>
        <IonContent><div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}><IonSpinner name="crescent" /></div></IonContent>
      </IonPage>
    );
  }

  if (!vehicle) {
    return (
      <IonPage>
        <IonHeader><IonToolbar color="primary"><IonButton slot="start" fill="clear" color="light" onClick={onBack}>← Volver</IonButton><IonTitle>Vehículo</IonTitle></IonToolbar></IonHeader>
        <IonContent className="ion-padding"><IonText color="danger"><p>No se pudo cargar el vehículo.</p></IonText></IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButton slot="start" fill="clear" color="light" onClick={onBack}>← Volver</IonButton>
          <IonTitle>{vehicle.brand} {vehicle.model}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {vehicle.photos && vehicle.photos.length > 0 ? (
          <img
            src={vehicle.photos[0]}
            alt={`${vehicle.brand} ${vehicle.model}`}
            style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "8px", marginBottom: "12px" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "120px", borderRadius: "8px",
            background: "var(--ion-color-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: "12px", color: "var(--ion-color-medium)",
          }}>
            Sin foto
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{vehicle.brand} {vehicle.model}</div>
            <IonBadge color="tertiary" style={{ fontSize: "0.68rem" }}>{VEHICLE_TYPE_LABEL[vehicle.type] ?? vehicle.type}</IonBadge>
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--ion-color-success)" }}>
            ${(vehicle.dailyPrice / 100).toLocaleString("es-CL")}/día
          </div>
        </div>

        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "12px 14px" }}>
            <div style={{ fontWeight: 600, marginBottom: "8px", fontSize: "0.9rem" }}>Especificaciones</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "0.82rem" }}>
              {vehicle.year         && <span><strong>Año:</strong> {vehicle.year}</span>}
              {vehicle.plate        && <span><strong>Patente:</strong> {vehicle.plate}</span>}
              {vehicle.color        && <span><strong>Color:</strong> {vehicle.color}</span>}
              {vehicle.seats        && <span><strong>Asientos:</strong> {vehicle.seats}</span>}
              {vehicle.transmission && <span><strong>Trans.:</strong> {vehicle.transmission === "manual" ? "Manual" : "Automático"}</span>}
              {vehicle.fuelType     && <span><strong>Combustible:</strong> {vehicle.fuelType === "gasoline" ? "Bencina" : vehicle.fuelType === "diesel" ? "Diésel" : vehicle.fuelType === "electric" ? "Eléctrico" : "Híbrido"}</span>}
            </div>
          </IonCardContent>
        </IonCard>

        {vehicle.description && (
          <IonCard style={{ margin: "0 0 12px" }}>
            <IonCardContent style={{ padding: "12px 14px", fontSize: "0.85rem" }}>
              {vehicle.description}
            </IonCardContent>
          </IonCard>
        )}

        {(vehicle.features ?? []).length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
            {(vehicle.features ?? []).map((f) => (
              <IonChip key={f} color="primary" style={{ fontSize: "0.72rem", height: "24px" }}>
                <IonLabel>{f}</IonLabel>
              </IonChip>
            ))}
          </div>
        )}

        {(vehicle.operatorName || vehicle.operatorPhone) && (
          <IonCard style={{ margin: "0 0 12px" }}>
            <IonCardContent style={{ padding: "12px 14px" }}>
              <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "0.9rem" }}>Operador</div>
              {vehicle.operatorName  && <div style={{ fontSize: "0.85rem" }}>{vehicle.operatorName}</div>}
              {vehicle.operatorPhone && <div style={{ fontSize: "0.82rem", color: "var(--ion-color-medium)" }}>{vehicle.operatorPhone}</div>}
            </IonCardContent>
          </IonCard>
        )}

        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "12px 14px" }}>
            <div style={{ fontWeight: 600, marginBottom: "10px", fontSize: "0.9rem" }}>Reservar</div>

            <IonItem lines="full">
              <IonLabel position="stacked">Fecha inicio</IonLabel>
              <IonInput
                type="date"
                value={startDate}
                min={today}
                onIonInput={(e) => { setStartDate(String(e.detail.value ?? "")); }}
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Fecha fin</IonLabel>
              <IonInput
                type="date"
                value={endDate}
                min={startDate || today}
                onIonInput={(e) => setEndDate(String(e.detail.value ?? ""))}
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Hora recogida (opcional)</IonLabel>
              <IonInput type="time" value={pickupTime} onIonInput={(e) => setPickupTime(String(e.detail.value ?? ""))} />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Hora devolución (opcional)</IonLabel>
              <IonInput type="time" value={returnTime} onIonInput={(e) => setReturnTime(String(e.detail.value ?? ""))} />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Lugar recogida (opcional)</IonLabel>
              <IonInput value={pickupLocation} onIonInput={(e) => setPickupLocation(String(e.detail.value ?? ""))} placeholder="Ej: Aeropuerto" maxlength={200} clearInput />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Lugar devolución (opcional)</IonLabel>
              <IonInput value={returnLocation} onIonInput={(e) => setReturnLocation(String(e.detail.value ?? ""))} placeholder="Ej: Hotel" maxlength={200} clearInput />
            </IonItem>

            <IonItem lines="none">
              <IonLabel position="stacked">Notas (opcional)</IonLabel>
              <IonTextarea value={notes} onIonInput={(e) => setNotes(String(e.detail.value ?? ""))} placeholder="Indicaciones especiales..." rows={2} maxlength={500} />
            </IonItem>

            {days !== null && (
              <div style={{ padding: "10px 0", fontWeight: 600, fontSize: "0.9rem" }}>
                {days} día{days !== 1 ? "s" : ""} × ${(vehicle.dailyPrice / 100).toLocaleString("es-CL")} = ${((vehicle.dailyPrice * days) / 100).toLocaleString("es-CL")} total
              </div>
            )}

            <IonButton expand="block" style={{ marginTop: "8px" }} onClick={() => void handleBook()} disabled={submitting}>
              {submitting ? <IonSpinner name="dots" /> : "Confirmar reserva"}
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonToast
          isOpen={toastMsg !== null}
          message={toastMsg ?? ""}
          duration={3000}
          onDidDismiss={() => setToastMsg(null)}
          color={toastMsg?.includes("Error") || toastMsg?.includes("error") ? "danger" : "success"}
        />
      </IonContent>
    </IonPage>
  );
}

export function PassengerRentalBookingsPage(): JSX.Element {
  const { session } = useAuth();
  const [bookings,   setBookings]   = useState<RentalBookingDataType[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmId,  setConfirmId]  = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await rentalService.getMyRentalBookings(session.accessToken);
      setBookings(data.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar reservas.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  async function handleCancel(bookingId: string) {
    if (!session?.accessToken) return;
    setCancelling(bookingId);
    try {
      const updated = await rentalService.cancelRentalBooking(session.accessToken, bookingId);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cancelar.");
    } finally {
      setCancelling(null);
      setConfirmId(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mis Arriendos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && bookings.length === 0 && (
          <IonText color="medium"><p>No tienes reservas de arriendo.</p></IonText>
        )}

        {!loading && bookings.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {bookings.map((b) => {
              const days = Math.max(1, Math.round((new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / (1000 * 60 * 60 * 24)));
              return (
                <IonCard key={b.id} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                          {b.vehicleBrand ?? ""} {b.vehicleModel ?? ""} {b.vehiclePlate ? `(${b.vehiclePlate})` : ""}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                          {b.startDate} → {b.endDate} · {days} día{days !== 1 ? "s" : ""}
                        </div>
                        {b.totalPrice !== null && (
                          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ion-color-success)", marginTop: "2px" }}>
                            ${(b.totalPrice / 100).toLocaleString("es-CL")} total
                          </div>
                        )}
                        <div style={{ marginTop: "6px" }}>
                          <IonBadge color={RENTAL_STATUS_COLOR[b.status] ?? "medium"} style={{ fontSize: "0.7rem" }}>
                            {RENTAL_STATUS_LABEL[b.status] ?? b.status}
                          </IonBadge>
                        </div>
                        {b.cancellationReason && (
                          <div style={{ fontSize: "0.72rem", color: "var(--ion-color-danger)", marginTop: "4px" }}>
                            Motivo: {b.cancellationReason}
                          </div>
                        )}
                      </div>
                      {b.status === "pending" && (
                        <IonButton
                          size="small"
                          fill="outline"
                          color="danger"
                          disabled={cancelling === b.id}
                          onClick={() => setConfirmId(b.id)}
                        >
                          {cancelling === b.id ? <IonSpinner name="dots" /> : "Cancelar"}
                        </IonButton>
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        <IonAlert
          isOpen={confirmId !== null}
          header="¿Cancelar reserva?"
          message="Esta acción no se puede deshacer."
          buttons={[
            { text: "No", role: "cancel", handler: () => setConfirmId(null) },
            { text: "Sí, cancelar", role: "confirm", handler: () => { if (confirmId) void handleCancel(confirmId); } },
          ]}
          onDidDismiss={() => setConfirmId(null)}
        />
      </IonContent>
    </IonPage>
  );
}

export function PassengerWalletPage(): JSX.Element {
  return <WalletPage />;
}

function WalletPage(): JSX.Element {
  const { session } = useAuth();
  const [wallet,       setWallet]       = useState<import("../../features/wallet/wallet.service").WalletData | null>(null);
  const [transactions, setTransactions] = useState<import("../../features/wallet/wallet.service").TransactionData[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { walletService } = await import("../../features/wallet/wallet.service.js");
      const [w, tx] = await Promise.all([
        walletService.getMyWallet(session.accessToken),
        walletService.getMyTransactions(session.accessToken, 1, 20),
      ]);
      setWallet(w);
      setTransactions(tx.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar la billetera.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void load(); }, [load]);

  const TX_TYPE_LABEL: Record<string, string> = {
    payment:  "Débito",
    credit:   "Crédito",
    refund:   "Reembolso",
    topup:    "Crédito",
  };
  const TX_TYPE_COLOR: Record<string, string> = {
    payment:  "danger",
    credit:   "success",
    refund:   "tertiary",
    topup:    "success",
  };
  const TX_STATUS_COLOR: Record<string, string> = {
    completed: "success",
    pending:   "warning",
    failed:    "danger",
    cancelled: "medium",
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mi Billetera</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && wallet && (
          <>
            {/* Balance card */}
            <IonCard style={{ margin: "0 0 16px", background: "var(--ion-color-primary)", color: "#fff" }}>
              <IonCardContent style={{ padding: "20px 24px" }}>
                <div style={{ fontSize: "0.8rem", opacity: 0.85, marginBottom: "4px" }}>Saldo disponible</div>
                <div style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "8px" }}>
                  ${(wallet.balance / 100).toLocaleString("es-CL")} {wallet.currency}
                </div>
                <IonBadge color={wallet.status === "active" ? "success" : "medium"} style={{ fontSize: "0.7rem" }}>
                  {wallet.status === "active" ? "Activa" : wallet.status}
                </IonBadge>
              </IonCardContent>
            </IonCard>

            {/* Quick actions */}
            <IonCard style={{ margin: "0 0 16px" }}>
              <IonCardContent style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 600, marginBottom: "10px", fontSize: "0.9rem" }}>Acciones rápidas</div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <IonButton expand="block" fill="outline" disabled style={{ flex: 1 }}>
                    Recargar
                  </IonButton>
                  <IonButton expand="block" fill="outline" disabled style={{ flex: 1 }}>
                    Retirar
                  </IonButton>
                </div>
                <IonNote style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", display: "block", marginTop: "6px" }}>
                  Próximamente disponible
                </IonNote>
              </IonCardContent>
            </IonCard>

            {/* Payment methods */}
            <IonCard style={{ margin: "0 0 16px" }}>
              <IonCardContent style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 600, marginBottom: "6px", fontSize: "0.9rem" }}>Métodos de pago</div>
                <IonText color="medium">
                  <p style={{ margin: 0, fontSize: "0.82rem" }}>Métodos de pago disponibles próximamente</p>
                </IonText>
              </IonCardContent>
            </IonCard>

            {/* Transactions */}
            <IonList>
              <IonListHeader>
                <IonLabel><strong>Movimientos</strong></IonLabel>
              </IonListHeader>

              {transactions.length === 0 && (
                <IonItem lines="none">
                  <IonText color="medium">
                    <p style={{ fontSize: "0.85rem", margin: "8px 0" }}>No hay movimientos todavía.</p>
                  </IonText>
                </IonItem>
              )}

              {transactions.map((tx) => (
                <IonItem key={tx.id} lines="full">
                  <IonLabel>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>
                          {new Date(tx.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                        </div>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
                          <IonBadge color={TX_TYPE_COLOR[tx.type] ?? "medium"} style={{ fontSize: "0.65rem" }}>
                            {TX_TYPE_LABEL[tx.type] ?? tx.type}
                          </IonBadge>
                          <IonBadge color={TX_STATUS_COLOR[tx.status] ?? "medium"} style={{ fontSize: "0.65rem" }}>
                            {tx.status}
                          </IonBadge>
                        </div>
                        {tx.description && (
                          <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                            {tx.description}
                          </div>
                        )}
                      </div>
                      <div style={{
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        color: tx.type === "payment" ? "var(--ion-color-danger)" : "var(--ion-color-success)",
                        marginLeft: "12px",
                        flexShrink: 0,
                      }}>
                        {tx.type === "payment" ? "-" : "+"}${(tx.amount / 100).toLocaleString("es-CL")}
                      </div>
                    </div>
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
          </>
        )}
      </IonContent>
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
