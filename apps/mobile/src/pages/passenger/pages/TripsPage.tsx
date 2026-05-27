import {
  IonBadge, IonButton, IonCard, IonCardContent, IonChip, IonContent, IonHeader,
  IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonLabel, IonPage,
  IonRefresher, IonRefresherContent, IonSpinner, IonText, IonTextarea, IonTitle,
  IonToolbar, IonItem, IonToast,
} from "@ionic/react";
import { useState, useCallback, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { carOutline } from "ionicons/icons";
import { EmptyState } from "../../../components/EmptyState.js";
import { TripTimeline } from "../../../components/TripTimeline.js";
import { DriverInfoCard } from "../../../components/DriverInfoCard.js";
import { SkeletonList } from "../../../components/SkeletonCard.js";
import { WhatsAppButton } from "../../../components/WhatsAppButton.js";
import { useAuth } from "../../../features/auth/index.js";
import { ridesService, type RideRequestData } from "../../../features/rides/rides.service.js";
import { ROUTES } from "../../../navigation/routes.js";
import { RAPAGO_CONTACT, WA_MESSAGES } from "@rapa-go/shared";
import { RIDE_STATUS_LABEL, RIDE_STATUS_COLOR } from "../shared.js";

const PAGE_SIZE = 20;
const ACTIVE_STATUSES = ["requested", "accepted", "driver_en_route", "driver_arrived", "in_progress"];

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "4px", margin: "8px 0" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} onClick={() => onChange(s)}
          style={{ fontSize: "1.6rem", cursor: "pointer", color: s <= value ? "#f4c430" : "#ccc" }}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function TripsPage(): JSX.Element {
  const history = useHistory();
  const { session } = useAuth();

  const [allRides,    setAllRides]    = useState<RideRequestData[]>([]);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [ratingRideId,     setRatingRideId]     = useState<string | null>(null);
  const [ratingStars,      setRatingStars]      = useState(5);
  const [ratingComment,    setRatingComment]    = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError,      setRatingError]      = useState<string | null>(null);
  const [ratedIds,         setRatedIds]         = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "cancelled">("all");

  const loadRides = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await ridesService.listMyRides(session.accessToken);
      setAllRides(data);
      setPage(1);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar tus viajes.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadRides(); }, [loadRides]);

  const rides = allRides.slice(0, page * PAGE_SIZE);

  async function handleCancel(rideId: string) {
    if (!session?.accessToken) return;
    setCancelling(rideId);
    setCancelError(null);
    try {
      const updated = await ridesService.cancelRideRequest(session.accessToken, rideId);
      setAllRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error al cancelar el viaje.");
    } finally {
      setCancelling(null);
    }
  }

  async function handleCancelAccepted(rideId: string) {
    if (!session?.accessToken) return;
    setCancelling(rideId);
    setCancelError(null);
    try {
      const updated = await ridesService.cancelAcceptedRide(session.accessToken, rideId);
      setAllRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
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

  const filtered = rides.filter((r) => {
    if (statusFilter === "all")       return true;
    if (statusFilter === "active")    return ACTIVE_STATUSES.includes(r.status);
    if (statusFilter === "completed") return r.status === "completed";
    if (statusFilter === "cancelled") return r.status === "cancelled";
    return true;
  });

  const counts = {
    all:       allRides.length,
    active:    allRides.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
    completed: allRides.filter((r) => r.status === "completed").length,
    cancelled: allRides.filter((r) => r.status === "cancelled").length,
  };

  const hasMore = page * PAGE_SIZE < allRides.length;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mis Viajes</IonTitle>
        </IonToolbar>
        <IonToolbar style={{ "--background": "var(--ion-color-primary)", "--border-width": "0" }}>
          <div style={{ display: "flex", gap: "8px", padding: "0 12px 10px", overflowX: "auto" }}>
            {(["all", "active", "completed", "cancelled"] as const).map((f) => {
              const labels = { all: "Todos", active: "En curso", completed: "Completados", cancelled: "Cancelados" };
              const active = statusFilter === f;
              return (
                <IonChip key={f}
                  aria-label={`Filtrar por ${labels[f]}`}
                  style={{
                    flexShrink: 0,
                    "--background": active ? "#fff" : "rgba(255,255,255,0.2)",
                    "--color": active ? "var(--ion-color-primary)" : "#fff",
                    fontSize: "0.78rem", height: "36px",
                    fontWeight: active ? 700 : 400,
                  }}
                  onClick={() => setStatusFilter(f)}
                >
                  {labels[f]}{counts[f] > 0 ? ` (${counts[f]})` : ""}
                </IonChip>
              );
            })}
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void loadRides().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && <SkeletonList count={3} height="140px" />}

        {loadError && (
          <div style={{ padding: "16px" }}>
            <IonText color="danger"><p>{loadError}</p></IonText>
          </div>
        )}

        {!loading && allRides.length === 0 && (
          <EmptyState icon={carOutline} title="Sin viajes todavía"
            subtitle="Solicita tu primer traslado en Rapa Nui"
            actionLabel="Solicitar viaje"
            onAction={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
          />
        )}

        {!loading && allRides.length > 0 && filtered.length === 0 && (
          <EmptyState icon={carOutline} title="Sin resultados" subtitle="No hay viajes en esta categoría" />
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px 16px 16px" }}>
            {filtered.map((ride) => {
              const color    = RIDE_STATUS_COLOR[ride.status] ?? "medium";
              const label    = RIDE_STATUS_LABEL[ride.status] ?? ride.status;
              const isActive = ACTIVE_STATUSES.includes(ride.status);

              const timelineSteps = [
                { status: "requested",       label: "Solicitado",          time: ride.requestedAt, completed: !!ride.requestedAt, active: ride.status === "requested" },
                { status: "accepted",        label: "Conductor asignado",  time: ride.acceptedAt,  completed: !!ride.acceptedAt,  active: ride.status === "accepted" },
                { status: "driver_en_route", label: "Conductor en camino", time: ride.enRouteAt,   completed: !!ride.enRouteAt,   active: ride.status === "driver_en_route" },
                { status: "driver_arrived",  label: "Conductor llegó",     time: ride.arrivedAt,   completed: !!ride.arrivedAt,   active: ride.status === "driver_arrived" },
                { status: "in_progress",     label: "Viaje en curso",      time: ride.startedAt,   completed: !!ride.startedAt,   active: ride.status === "in_progress" },
                { status: "completed",       label: "Completado",          time: ride.completedAt, completed: !!ride.completedAt, active: false },
              ];

              return (
                <IonCard key={ride.id}
                  aria-label={`Viaje ${label} de ${ride.originText} a ${ride.destinationText}`}
                  style={{ margin: 0, borderRadius: "16px", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
                >
                  <div style={{ height: "4px", background: `var(--ion-color-${color})` }} />
                  <IonCardContent style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--ion-color-success)", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ride.originText}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--ion-color-danger)", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ride.destinationText}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0, marginLeft: "8px" }}>
                        <IonBadge color={color} style={{ fontSize: "0.7rem" }}>{label}</IonBadge>
                        {ride.isOfflineBooking && <IonBadge color="warning" style={{ fontSize: "0.68rem" }}>Telefónica</IonBadge>}
                      </div>
                    </div>

                    {ride.estimatedFareClp != null && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                        <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ion-color-primary)" }}>
                          ${ride.estimatedFareClp.toLocaleString("es-CL")} CLP
                        </span>
                        {ride.discountApplied && ride.originalFareClp != null && (
                          <>
                            <IonBadge color="success" style={{ fontSize: "0.65rem" }}>-{ride.discountPercent}%</IonBadge>
                            <span style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", textDecoration: "line-through" }}>
                              ${ride.originalFareClp.toLocaleString("es-CL")}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {ride.driverName && ["accepted","driver_en_route","driver_arrived","in_progress","completed"].includes(ride.status) && (
                      <div style={{ marginBottom: "10px" }}>
                        <DriverInfoCard
                          name={ride.driverName}
                          rating={ride.driverRatingAverage}
                          ratingCount={ride.driverRatingCount}
                          vehicleBrand={ride.driverVehicleBrand}
                          vehicleModel={ride.driverVehicleModel}
                          vehicleColor={ride.driverVehicleColor}
                          vehiclePlate={ride.driverVehiclePlate}
                          vehicleYear={ride.driverVehicleYear}
                          phone={isActive ? ride.driverPhone : null}
                          waMessage={isActive && ride.driverPhone && ride.driverName
                            ? WA_MESSAGES.passengerToDriver({ driverName: ride.driverName, passengerName: "pasajero", origin: ride.originText })
                            : null}
                        />
                      </div>
                    )}

                    {!ride.driverName && ride.status === "requested" && (
                      <div style={{ marginBottom: "10px", fontSize: "0.82rem", color: "var(--ion-color-medium)", fontStyle: "italic", display: "flex", alignItems: "center", gap: "6px" }}>
                        <IonSpinner name="dots" style={{ width: "16px", height: "16px" }} />
                        Esperando asignación de conductor...
                      </div>
                    )}

                    {(isActive || ride.status === "completed") && (
                      <div style={{ marginBottom: "10px", borderTop: "1px solid var(--ion-color-light-shade)", paddingTop: "10px" }}>
                        <TripTimeline steps={timelineSteps} />
                      </div>
                    )}

                    {ride.status === "cancelled" && (
                      <div style={{ background: "var(--ion-color-danger-tint)", borderRadius: "8px", padding: "8px 12px", marginBottom: "10px" }}>
                        {ride.cancellationReason && <div style={{ fontSize: "0.78rem", color: "var(--ion-color-danger-shade)", fontWeight: 500 }}>Motivo: {ride.cancellationReason}</div>}
                        {ride.cancelledByRole && <div style={{ fontSize: "0.72rem", color: "var(--ion-color-danger-shade)", marginTop: "2px" }}>Cancelado por: {ride.cancelledByRole === "passenger" ? "pasajero" : "conductor"}</div>}
                        {ride.cancelledAt && <div style={{ fontSize: "0.7rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>{new Date(ride.cancelledAt).toLocaleString("es-CL")}</div>}
                      </div>
                    )}

                    {ride.notes && <div style={{ fontSize: "0.8rem", color: "var(--ion-color-medium)", marginBottom: "8px" }}>{ride.notes}</div>}

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                      {(ride.status === "requested" || ride.status === "accepted") && (
                        <IonButton size="small" fill="outline" color="danger"
                          disabled={cancelling === ride.id}
                          onClick={() => void (ride.status === "requested" ? handleCancel(ride.id) : handleCancelAccepted(ride.id))}>
                          {cancelling === ride.id ? <IonSpinner name="dots" /> : "Cancelar"}
                        </IonButton>
                      )}
                      {ride.status === "completed" && !ratedIds.has(ride.id) && ratingRideId !== ride.id && (
                        <IonButton size="small" fill="outline" color="warning"
                          onClick={() => { setRatingRideId(ride.id); setRatingStars(5); setRatingComment(""); setRatingError(null); }}>
                          ⭐ Calificar
                        </IonButton>
                      )}
                      {ride.status === "completed" && ratedIds.has(ride.id) && (
                        <IonBadge color="success" style={{ fontSize: "0.72rem", padding: "4px 8px" }}>✓ Calificado</IonBadge>
                      )}
                      {ride.status === "completed" && (
                        <WhatsAppButton phone={RAPAGO_CONTACT.adminPhone}
                          message={WA_MESSAGES.passengerToAdmin({ origin: ride.originText, destination: ride.destinationText, name: "pasajero" })}
                          label="Soporte" size="small" />
                      )}
                      {ride.driverName && isActive && !ride.driverPhone && (
                        <WhatsAppButton phone={RAPAGO_CONTACT.adminPhone}
                          message={WA_MESSAGES.passengerToAdmin({ origin: ride.originText, destination: ride.destinationText, name: "pasajero" })}
                          label="Operador" size="small" />
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        <IonInfiniteScroll threshold="100px" disabled={!hasMore || loading}
          onIonInfinite={(ev) => {
            setPage((p) => p + 1);
            void (ev.target as HTMLIonInfiniteScrollElement).complete();
          }}>
          <IonInfiniteScrollContent loadingText="Cargando más viajes..." />
        </IonInfiniteScroll>

        {cancelError && (
          <div style={{ padding: "0 16px" }}>
            <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{cancelError}</p></IonText>
          </div>
        )}

        {ratingRideId && (
          <IonCard style={{ margin: "12px 16px" }}>
            <IonCardContent style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 600, marginBottom: "8px" }}>⭐ Calificar conductor</div>
              <StarRatingInput value={ratingStars} onChange={setRatingStars} />
              <IonItem lines="none" style={{ "--padding-start": "0", marginTop: "8px" }}>
                <IonTextarea value={ratingComment} onIonInput={(e) => setRatingComment(String(e.detail.value ?? ""))}
                  placeholder="Comentario opcional" maxlength={500} rows={2} />
              </IonItem>
              {ratingError && <IonText color="danger"><p style={{ fontSize: "0.82rem", margin: "4px 0" }}>{ratingError}</p></IonText>}
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <IonButton size="small" onClick={() => void handleSubmitRating()} disabled={submittingRating}>
                  {submittingRating ? <IonSpinner name="dots" /> : "Enviar"}
                </IonButton>
                <IonButton size="small" fill="outline" color="medium" onClick={() => setRatingRideId(null)}>Cancelar</IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
}
