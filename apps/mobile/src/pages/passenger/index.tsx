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
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
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
import { useHistory } from "react-router-dom";
import {
  carOutline,
  carSportOutline,
  chevronForwardOutline,
  compassOutline,
  ellipseOutline,
  giftOutline,
  locationOutline,
  mapOutline,
  ticketOutline,
  walletOutline,
} from "ionicons/icons";
import { ServiceCard } from "../../components/ServiceCard.js";
import { EmptyState } from "../../components/EmptyState.js";
import { TripTimeline } from "../../components/TripTimeline.js";
import { DriverInfoCard } from "../../components/DriverInfoCard.js";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { passengerProfileService, type PassengerProfileData } from "../../features/passengers/passengerProfile.service.js";
import { useConnectivity } from "../../hooks/useConnectivity";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { ridesService, type RideRequestData } from "../../features/rides/rides.service";
import { MapFallback } from "../../components/MapFallback";
import { RAPA_NUI_PLACES, RAPAGO_CONTACT, WA_MESSAGES, getDistanceBetween, getEstimatedFare } from "@rapa-go/shared";
import { fareSettingsService } from "../../features/fareSettings/fareSettings.service.js";
import { WhatsAppButton } from "../../components/WhatsAppButton";
import { touristService, type GuidePublicData, type TouristServiceData, type ServiceBookingData } from "../../features/tourist/tourist.service.js";
import { useIonViewWillEnter } from "@ionic/react";
import { rentalService } from "../../features/rental/rental.service.js";
import type { RentalVehicleData as RentalVehicleDataType, RentalBookingData as RentalBookingDataType } from "../../features/rental/rental.service.js";
import { legalService, type LegalDocumentData, type UserAcceptanceData } from "../../features/legal/legal.service.js";

function LegalStatusSection({ token }: { token: string }): React.ReactElement {
  const [docs,        setDocs]        = useState<LegalDocumentData[]>([]);
  const [acceptances, setAcceptances] = useState<UserAcceptanceData[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([legalService.getActive(), legalService.getMyAcceptances(token)])
      .then(([d, a]) => { setDocs(d); setAcceptances(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const getStatus = (doc: LegalDocumentData) => {
    const acc = acceptances.find((a) => a.legalDocumentId === doc.id);
    if (!acc) return "not_accepted";
    if (acc.versionAccepted !== doc.version) return "new_version";
    return "accepted";
  };

  const handleAccept = (doc: LegalDocumentData) => {
    void legalService.accept(token, doc.id, doc.version).then(() => {
      legalService.getMyAcceptances(token).then(setAcceptances).catch(() => {});
    });
  };

  return (
    <IonCard style={{ marginTop: "24px" }}>
      <IonCardHeader>
        <IonCardTitle style={{ fontSize: "1rem" }}>Documentos Legales</IonCardTitle>
      </IonCardHeader>
      <IonCardContent style={{ padding: 0 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
            <IonSpinner name="dots" />
          </div>
        ) : (
          <IonList>
            {docs.map((doc) => {
              const status = getStatus(doc);
              return (
                <IonItem key={doc.id}>
                  <IonLabel>
                    <h3>{doc.title}</h3>
                    <p>v{doc.version}</p>
                  </IonLabel>
                  {status === "accepted" && <IonBadge color="success" slot="end">Aceptado</IonBadge>}
                  {status === "new_version" && <IonBadge color="warning" slot="end">Nueva versión</IonBadge>}
                  {status === "not_accepted" && <IonBadge color="danger" slot="end">Pendiente</IonBadge>}
                  {(status === "not_accepted" || status === "new_version") && (
                    <IonButton fill="clear" size="small" slot="end" onClick={() => handleAccept(doc)}>
                      Aceptar
                    </IonButton>
                  )}
                </IonItem>
              );
            })}
          </IonList>
        )}
      </IonCardContent>
    </IonCard>
  );
}

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

const FREQUENT_DESTINATIONS = ["Aeropuerto", "Anakena", "Tongariki", "Ahu Akivi", "Orongo", "Rano Raraku"];

export function PassengerHomePage(): JSX.Element {
  const history = useHistory();
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
  const firstName = name.split(" ")[0] || "pasajero";
  const initials  = name.trim().split(/\s+/).map((p: string) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "P";
  const hasPhone  = !!profile?.phone;

  return (
    <IonPage>
      {/* Branded header — no IonHeader to allow full custom gradient */}
      <div style={{
        background: "linear-gradient(145deg, var(--ion-color-primary) 0%, var(--ion-color-primary-shade) 100%)",
        padding: "calc(env(safe-area-inset-top) + 12px) 16px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Avatar */}
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              border: "2px solid rgba(255,255,255,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: "1.1rem", flexShrink: 0,
              overflow: "hidden",
            }}>
              {initials}
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.2 }}>
                Hola, {firstName} 👋
              </div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.8rem", marginTop: "2px" }}>
                ¿A dónde vamos hoy?
              </div>
            </div>
          </div>
          {/* Notification bell */}
          <div style={{ color: "#fff" }}>
            <IonIcon
              icon={ellipseOutline}
              style={{ fontSize: "1.6rem", opacity: 0.7 }}
            />
          </div>
        </div>
      </div>

      <IonContent>
        <div style={{ padding: "0 16px 80px" }}>

          {/* Offline / phone warnings */}
          {profile !== null && !hasPhone && (
            <div style={{ margin: "12px 0 0", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "12px", padding: "10px 14px" }}>
              <IonText>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b4700" }}>
                  ⚠️ Completa tu teléfono en el perfil para solicitar viajes.
                </p>
              </IonText>
            </div>
          )}
          {!isOnline && (
            <div style={{ margin: "12px 0 0", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "12px", padding: "10px 14px" }}>
              <IonText>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b4700" }}>
                  Modo offline — tus viajes se sincronizarán cuando recuperes conexión.
                </p>
              </IonText>
              <WhatsAppButton
                phone={RAPAGO_CONTACT.adminPhone}
                message={WA_MESSAGES.passengerToAdmin({ origin: "mi ubicación", destination: "mi destino", name: "pasajero" })}
                label="Contactar operador"
                size="small"
                fill="solid"
                style={{ marginTop: "8px" }}
              />
            </div>
          )}

          {/* ── Servicios rápidos ── */}
          <div style={{ marginTop: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "12px", color: "var(--ion-text-color)" }}>
              Servicios
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "10px",
            }}>
              <ServiceCard
                icon={carOutline}
                title="Viaje"
                subtitle="Solicitar ahora"
                color="primary"
                onClick={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
              />
              <ServiceCard
                icon={mapOutline}
                title="Tours"
                subtitle="Con guías locales"
                color="secondary"
                onClick={() => history.push(ROUTES.PASSENGER.GUIDES)}
              />
              <ServiceCard
                icon={carSportOutline}
                title="Arriendo"
                subtitle="Vehículos"
                color="tertiary"
                onClick={() => history.push(ROUTES.PASSENGER.RENTALS)}
              />
              <ServiceCard
                icon={ticketOutline}
                title="Eventos"
                subtitle="Cultura"
                color="warning"
                onClick={() => history.push(ROUTES.PASSENGER.EVENTS)}
              />
            </div>
          </div>

          {/* ── Destinos frecuentes ── */}
          <div style={{ marginTop: "24px" }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "10px", color: "var(--ion-text-color)" }}>
              Destinos frecuentes
            </div>
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
              {FREQUENT_DESTINATIONS.map((dest) => (
                <IonChip
                  key={dest}
                  style={{ flexShrink: 0, "--background": "var(--ion-color-light)", fontSize: "0.8rem" }}
                  onClick={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
                >
                  <IonIcon icon={locationOutline} style={{ marginRight: "4px", fontSize: "0.9rem" }} />
                  <IonLabel>{dest}</IonLabel>
                </IonChip>
              ))}
            </div>
          </div>

          {/* ── Accesos secundarios ── */}
          <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <IonCard
              className="ion-activatable"
              style={{ margin: 0, borderRadius: "14px", cursor: "pointer" }}
              routerLink={ROUTES.PASSENGER.TRIPS}
            >
              <IonCardContent style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <IonIcon icon={carOutline} style={{ fontSize: "1.4rem", color: "var(--ion-color-primary)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Mis Viajes</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)" }}>Historial</div>
                </div>
              </IonCardContent>
            </IonCard>
            <IonCard
              className="ion-activatable"
              style={{ margin: 0, borderRadius: "14px", cursor: "pointer" }}
              routerLink={ROUTES.PASSENGER.WALLET}
            >
              <IonCardContent style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <IonIcon icon={walletOutline} style={{ fontSize: "1.4rem", color: "var(--ion-color-success)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Wallet</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)" }}>Saldo y pagos</div>
                </div>
              </IonCardContent>
            </IonCard>
          </div>

          {/* ── Banner referidos ── */}
          <div
            style={{
              marginTop: "20px",
              background: "linear-gradient(135deg, var(--ion-color-secondary) 0%, var(--ion-color-secondary-shade) 100%)",
              borderRadius: "16px",
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              cursor: "pointer",
            }}
            onClick={() => history.push(ROUTES.PROFILE.INDEX)}
          >
            <IonIcon icon={giftOutline} style={{ fontSize: "2rem", color: "#fff", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Invita amigos y gana</div>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.78rem", marginTop: "2px" }}>
                Comparte tu código y obtén descuentos en tus próximos viajes
              </div>
            </div>
            <IonIcon icon={chevronForwardOutline} style={{ color: "rgba(255,255,255,0.7)", fontSize: "1.2rem", flexShrink: 0 }} />
          </div>

          {/* ── Unirse a Rapa Go ── */}
          <IonCard style={{ marginTop: "20px", borderRadius: "14px" }}>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: "0.95rem" }}>¿Quieres unirte a Rapa Go?</IonCardTitle>
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
  const [farePreview,       setFarePreview]       = useState<{ km: number; minutes: number; fare: number; isZoneFare: boolean } | null>(null);

  const [currentLat,        setCurrentLat]        = useState<number | null>(null);
  const [currentLng,        setCurrentLng]        = useState<number | null>(null);
  const [locating,          setLocating]          = useState(false);
  const [locationError,     setLocationError]     = useState<string | null>(null);
  const [pickupConfirmed,   setPickupConfirmed]   = useState(false);

  useEffect(() => {
    if (!selectedOriginId || !selectedDestId) {
      setFarePreview(null);
      return;
    }

    const dist = getDistanceBetween(selectedOriginId, selectedDestId);
    if (!dist) {
      setFarePreview(null);
      return;
    }

    const originName = RAPA_NUI_PLACES.find((p) => p.id === selectedOriginId)?.name ?? originInput;
    const destName   = RAPA_NUI_PLACES.find((p) => p.id === selectedDestId)?.name ?? destInput;

    fareSettingsService
      .getZoneFares({ zoneFrom: originName, zoneTo: destName })
      .then((zones) => {
        const zone = zones.find((z) => z.isActive);
        if (zone) {
          setFarePreview({ km: dist.km, minutes: dist.minutes, fare: zone.fare, isZoneFare: true });
        } else {
          setFarePreview({ km: dist.km, minutes: dist.minutes, fare: getEstimatedFare(dist.km), isZoneFare: false });
        }
      })
      .catch(() => {
        setFarePreview({ km: dist.km, minutes: dist.minutes, fare: getEstimatedFare(dist.km), isZoneFare: false });
      });
  }, [selectedOriginId, selectedDestId, originInput, destInput]);

  const sortedPlaces = [...RAPA_NUI_PLACES].sort((a, b) => {
    if (a.isPopular && !b.isPopular) return -1;
    if (!a.isPopular && b.isPopular) return 1;
    return a.sortOrder - b.sortOrder;
  });

  function getPlaceCoordinates(placeId: string): { lat?: number | null; lng?: number | null } {
    const place = RAPA_NUI_PLACES.find((p) => p.id === placeId) as
      | ({ lat?: number | null; lng?: number | null; latitude?: number | null; longitude?: number | null })
      | undefined;

    if (!place) return {};

    return {
      lat: place.lat ?? place.latitude ?? null,
      lng: place.lng ?? place.longitude ?? null,
    };
  }

  function handleOriginPlaceSelect(placeId: string) {
    const place = RAPA_NUI_PLACES.find((p) => p.id === placeId);
    if (place) {
      setOriginInput(place.name);
      setSelectedOriginId(placeId);
      setPickupConfirmed(false);
    }
  }

  function handleDestPlaceSelect(placeId: string) {
    const place = RAPA_NUI_PLACES.find((p) => p.id === placeId);
    if (place) {
      setDestInput(place.name);
      setSelectedDestId(placeId);
    }
  }

  function handleUseCurrentLocation() {
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Tu navegador no permite obtener ubicación.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLat(position.coords.latitude);
        setCurrentLng(position.coords.longitude);
        setOriginInput("Mi ubicación actual");
        setSelectedOriginId("");
        setPickupConfirmed(false);
        setLocating(false);
      },
      () => {
        setLocationError("No se pudo obtener tu ubicación. Activa el GPS y vuelve a intentar.");
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      },
    );
  }

  async function handleRequest() {
    if (!session?.accessToken) return;

    const origin = originInput.trim();
    const dest   = destInput.trim();

    if (!origin || !dest) {
      setSubmitError("Origen y destino son requeridos.");
      return;
    }

    if (!pickupConfirmed) {
      setSubmitError("Confirma primero el punto de partida recomendado.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const input: import("../../features/rides/rides.service").CreateRideInput = {
        originText:      origin,
        destinationText: dest,
      };

      const notes: string[] = [];

      if (currentLat !== null && currentLng !== null) {
        notes.push(`Ubicación GPS pasajero: ${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}.`);
      }

      notes.push("Punto de partida confirmado por pasajero. Si la calle no es accesible, recoger en el punto recomendado por la app.");

      const trimNotes = notesInput.trim();
      if (trimNotes) notes.push(trimNotes);

      input.notes = notes.join(" ");

      const ride = await ridesService.createRideRequest(session.accessToken, input);

      setSubmitted(ride);
      setOriginInput("");
      setDestInput("");
      setNotesInput("");
      setSelectedOriginId("");
      setSelectedDestId("");
      setCurrentLat(null);
      setCurrentLng(null);
      setPickupConfirmed(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al solicitar el viaje.");
    } finally {
      setSubmitting(false);
    }
  }

  const originCoords = selectedOriginId ? getPlaceCoordinates(selectedOriginId) : {};
  const destCoords   = selectedDestId ? getPlaceCoordinates(selectedDestId) : {};

  const mapOrigin = {
    ...(selectedOriginId ? { id: selectedOriginId } : {}),
    text: originInput.trim() || "Mi ubicación",
    lat: currentLat ?? originCoords.lat ?? null,
    lng: currentLng ?? originCoords.lng ?? null,
  };

  const mapDestination = {
    ...(selectedDestId ? { id: selectedDestId } : {}),
    text: destInput.trim() || "Destino",
    lat: destCoords.lat ?? null,
    lng: destCoords.lng ?? null,
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Solicitar Viaje</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingBottom: "90px" }}>
          <IonCard style={{ margin: 0, borderRadius: "24px", overflow: "hidden" }}>
            <IonCardContent style={{ padding: 0 }}>
              <MapFallback
                origin={mapOrigin}
                destination={mapDestination}
                height={320}
                showRoute
              />

              <div style={{ padding: "14px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "16px",
                    background: pickupConfirmed
                      ? "rgba(42, 168, 74, 0.12)"
                      : "rgba(200, 155, 60, 0.14)",
                    border: pickupConfirmed
                      ? "1px solid rgba(42, 168, 74, 0.28)"
                      : "1px solid rgba(200, 155, 60, 0.28)",
                  }}
                >
                  <div style={{ fontSize: "1.3rem" }}>{pickupConfirmed ? "✅" : "🚶"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: "0.88rem", color: "#1A1A1A" }}>
                      {pickupConfirmed ? "Punto de partida confirmado" : "Confirma el punto de partida"}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(26,26,26,.68)", marginTop: "2px", lineHeight: 1.35 }}>
                      En sectores con pasajes, condominios o calles interiores, Rapa Go recomendará una calle principal accesible para el conductor.
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" }}>
                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={handleUseCurrentLocation}
                    disabled={locating}
                    style={{ margin: 0 }}
                  >
                    {locating ? <IonSpinner name="dots" /> : "Usar GPS"}
                  </IonButton>

                  <IonButton
                    expand="block"
                    color={pickupConfirmed ? "success" : "primary"}
                    onClick={() => setPickupConfirmed(true)}
                    disabled={!originInput.trim()}
                    style={{ margin: 0 }}
                  >
                    Confirmar punto
                  </IonButton>
                </div>

                {locationError && (
                  <IonText color="danger">
                    <p style={{ margin: "8px 0 0", fontSize: "0.78rem" }}>{locationError}</p>
                  </IonText>
                )}
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard style={{ margin: 0, borderRadius: "24px" }}>
            <IonCardContent style={{ padding: "16px" }}>
              <IonItem lines="full">
                <IonLabel>Lugar frecuente (origen)</IonLabel>
                <IonSelect
                  interface="action-sheet"
                  placeholder="Seleccionar origen frecuente"
                  value={selectedOriginId}
                  onIonChange={(e) => handleOriginPlaceSelect(e.detail.value as string)}
                >
                  {sortedPlaces.map((place) => (
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
                  onIonInput={(e) => {
                    setOriginInput(String(e.detail.value ?? ""));
                    setSelectedOriginId("");
                    setPickupConfirmed(false);
                  }}
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
                  {sortedPlaces.map((place) => (
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
                  onIonInput={(e) => {
                    setDestInput(String(e.detail.value ?? ""));
                    setSelectedDestId("");
                  }}
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
                <IonNote slot="helper" style={{ fontSize: "0.7rem" }}>
                  Máximo 500 caracteres.
                </IonNote>
              </IonItem>

              {farePreview && !submitted && (
                <div
                  style={{
                    margin: "12px 0 0",
                    padding: "12px 14px",
                    background: "linear-gradient(135deg, rgba(246,242,236,.96), rgba(217,195,160,.72))",
                    border: "1px solid rgba(200,155,60,.28)",
                    borderRadius: "16px",
                    fontSize: "0.85rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "rgba(26,26,26,.72)", fontWeight: 800 }}>
                      {farePreview.km.toFixed(1)} km · ~{farePreview.minutes} min
                    </span>
                    <strong style={{ fontSize: "1rem", color: "#1A1A1A" }}>
                      ${farePreview.fare.toLocaleString("es-CL")} CLP
                    </strong>
                  </div>

                  <div style={{ fontSize: "0.72rem", color: "rgba(26,26,26,.64)", marginTop: "4px" }}>
                    {farePreview.isZoneFare ? "Tarifa fija de ruta" : "Tarifa estimada por km"}
                  </div>
                </div>
              )}

              {submitted && (
                <div style={{ margin: "12px 0 0" }}>
                  <IonText color="success">
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 800 }}>
                      ✓ Solicitud enviada — Estado: {RIDE_STATUS_LABEL[submitted.status] ?? submitted.status}
                    </p>
                  </IonText>

                  {submitted.estimatedFareClp != null && (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "10px 12px",
                        background: "var(--ion-color-light)",
                        borderRadius: "12px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {submitted.discountApplied && submitted.originalFareClp != null ? (
                        <>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <strong>${submitted.estimatedFareClp.toLocaleString("es-CL")} CLP</strong>
                            <span
                              style={{
                                background: "var(--ion-color-success)",
                                color: "#fff",
                                borderRadius: "999px",
                                padding: "2px 7px",
                                fontSize: "0.72rem",
                                fontWeight: 800,
                              }}
                            >
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

              {session?.accessToken && (
                <LegalStatusSection token={session.accessToken} />
              )}

              {submitError && (
                <IonText color="danger">
                  <p style={{ margin: "10px 0 0", fontSize: "0.85rem" }}>{submitError}</p>
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

              {!pickupConfirmed && (
                <IonNote style={{ display: "block", marginTop: "8px", fontSize: "0.72rem", textAlign: "center" }}>
                  Debes confirmar el punto de partida antes de solicitar el viaje.
                </IonNote>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
}
export function PassengerTripsPage(): JSX.Element {
  return <TripsPage />;
}

const PAGE_SIZE = 20;

function TripsPage(): JSX.Element {
  const history = useHistory();
  const { session } = useAuth();

  const [allRides,    setAllRides]    = useState<RideRequestData[]>([]);
  const [page,        setPage]        = useState(1);
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
  const [statusFilter,  setStatusFilter]  = useState<"all" | "active" | "completed" | "cancelled">("all");

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

  // Client-side pagination slice
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
      setAllRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error al cancelar el viaje.");
    } finally {
      setCancelling(null);
    }
  }

  const ACTIVE_STATUSES   = ["requested", "accepted", "driver_en_route", "driver_arrived", "in_progress"];
  const filtered = rides.filter((r) => {
    if (statusFilter === "all")       return true;
    if (statusFilter === "active")    return ACTIVE_STATUSES.includes(r.status);
    if (statusFilter === "completed") return r.status === "completed";
    if (statusFilter === "cancelled") return r.status === "cancelled";
    return true;
  });

  // Counts use the full dataset so chips always show accurate numbers
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
        {/* Filter chips */}
        <IonToolbar style={{ "--background": "var(--ion-color-primary)", "--border-width": "0" }}>
          <div style={{ display: "flex", gap: "8px", padding: "0 12px 10px", overflowX: "auto" }}>
            {(["all", "active", "completed", "cancelled"] as const).map((f) => {
              const labels = { all: "Todos", active: "En curso", completed: "Completados", cancelled: "Cancelados" };
              const active = statusFilter === f;
              return (
                <IonChip
                  key={f}
                  style={{
                    flexShrink: 0,
                    "--background": active ? "#fff" : "rgba(255,255,255,0.2)",
                    "--color": active ? "var(--ion-color-primary)" : "#fff",
                    fontSize: "0.78rem",
                    height: "28px",
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

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && (
          <div style={{ padding: "16px" }}>
            <IonText color="danger"><p>{loadError}</p></IonText>
          </div>
        )}

        {!loading && allRides.length === 0 && (
          <EmptyState
            icon={carOutline}
            title="Sin viajes todavía"
            subtitle="Solicita tu primer traslado en Rapa Nui"
            actionLabel="Solicitar viaje"
            onAction={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
          />
        )}

        {!loading && allRides.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={carOutline}
            title="Sin resultados"
            subtitle="No hay viajes en esta categoría"
          />
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px 16px 16px" }}>
            {filtered.map((ride) => {
              const color = RIDE_STATUS_COLOR[ride.status] ?? "medium";
              const label = RIDE_STATUS_LABEL[ride.status] ?? ride.status;
              const isActive = ACTIVE_STATUSES.includes(ride.status);

              const timelineSteps = [
                { status: "requested",       label: "Solicitado",            time: ride.requestedAt,  completed: !!ride.requestedAt,  active: ride.status === "requested" },
                { status: "accepted",        label: "Conductor asignado",    time: ride.acceptedAt,   completed: !!ride.acceptedAt,   active: ride.status === "accepted" },
                { status: "driver_en_route", label: "Conductor en camino",   time: ride.enRouteAt,    completed: !!ride.enRouteAt,    active: ride.status === "driver_en_route" },
                { status: "driver_arrived",  label: "Conductor llegó",       time: ride.arrivedAt,    completed: !!ride.arrivedAt,    active: ride.status === "driver_arrived" },
                { status: "in_progress",     label: "Viaje en curso",        time: ride.startedAt,    completed: !!ride.startedAt,    active: ride.status === "in_progress" },
                { status: "completed",       label: "Completado",            time: ride.completedAt,  completed: !!ride.completedAt,  active: false },
              ];

              return (
                <IonCard key={ride.id} style={{ margin: 0, borderRadius: "16px", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                  {/* Status bar */}
                  <div style={{
                    height: "4px",
                    background: `var(--ion-color-${color})`,
                  }} />
                  <IonCardContent style={{ padding: "14px 16px" }}>

                    {/* Route header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--ion-color-success)", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--ion-text-color)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ride.originText}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--ion-color-danger)", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--ion-text-color)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ride.destinationText}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0, marginLeft: "8px" }}>
                        <IonBadge color={color} style={{ fontSize: "0.7rem" }}>{label}</IonBadge>
                        {ride.isOfflineBooking && (
                          <IonBadge color="warning" style={{ fontSize: "0.68rem" }}>Telefónica</IonBadge>
                        )}
                      </div>
                    </div>

                    {/* Fare */}
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

                    {/* Driver card */}
                    {ride.driverName && ["accepted", "driver_en_route", "driver_arrived", "in_progress", "completed"].includes(ride.status) && (
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
                            : null
                          }
                        />
                      </div>
                    )}

                    {!ride.driverName && ride.status === "requested" && (
                      <div style={{ marginBottom: "10px", fontSize: "0.82rem", color: "var(--ion-color-medium)", fontStyle: "italic", display: "flex", alignItems: "center", gap: "6px" }}>
                        <IonSpinner name="dots" style={{ width: "16px", height: "16px" }} />
                        Esperando asignación de conductor...
                      </div>
                    )}

                    {/* Timeline — solo si activo o completado */}
                    {(isActive || ride.status === "completed") && (
                      <div style={{ marginBottom: "10px", borderTop: "1px solid var(--ion-color-light-shade)", paddingTop: "10px" }}>
                        <TripTimeline steps={timelineSteps} />
                      </div>
                    )}

                    {/* Cancellation info */}
                    {ride.status === "cancelled" && (
                      <div style={{ background: "var(--ion-color-danger-tint)", borderRadius: "8px", padding: "8px 12px", marginBottom: "10px" }}>
                        {ride.cancellationReason && (
                          <div style={{ fontSize: "0.78rem", color: "var(--ion-color-danger-shade)", fontWeight: 500 }}>
                            Motivo: {ride.cancellationReason}
                          </div>
                        )}
                        {ride.cancelledByRole && (
                          <div style={{ fontSize: "0.72rem", color: "var(--ion-color-danger-shade)", marginTop: "2px" }}>
                            Cancelado por: {ride.cancelledByRole === "passenger" ? "pasajero" : "conductor"}
                          </div>
                        )}
                        {ride.cancelledAt && (
                          <div style={{ fontSize: "0.7rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                            {new Date(ride.cancelledAt).toLocaleString("es-CL")}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {ride.notes && (
                      <div style={{ fontSize: "0.8rem", color: "var(--ion-color-medium)", marginBottom: "8px" }}>
                        {ride.notes}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
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
                          ⭐ Calificar
                        </IonButton>
                      )}
                      {ride.status === "completed" && ratedIds.has(ride.id) && (
                        <IonBadge color="success" style={{ fontSize: "0.72rem", padding: "4px 8px" }}>✓ Calificado</IonBadge>
                      )}
                      {ride.status === "completed" && (
                        <WhatsAppButton
                          phone={RAPAGO_CONTACT.adminPhone}
                          message={WA_MESSAGES.passengerToAdmin({ origin: ride.originText, destination: ride.destinationText, name: "pasajero" })}
                          label="Soporte"
                          size="small"
                        />
                      )}
                      {ride.driverName && isActive && !ride.driverPhone && (
                        <WhatsAppButton
                          phone={RAPAGO_CONTACT.adminPhone}
                          message={WA_MESSAGES.passengerToAdmin({ origin: ride.originText, destination: ride.destinationText, name: "pasajero" })}
                          label="Operador"
                          size="small"
                        />
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        <IonInfiniteScroll
          threshold="100px"
          disabled={!hasMore || loading}
          onIonInfinite={(ev) => {
            setPage((p) => p + 1);
            void (ev.target as HTMLIonInfiniteScrollElement).complete();
          }}
        >
          <IonInfiniteScrollContent loadingText="Cargando más viajes..." />
        </IonInfiniteScroll>

        {cancelError && (
          <div style={{ padding: "0 16px" }}>
            <IonText color="danger">
              <p style={{ fontSize: "0.85rem" }}>{cancelError}</p>
            </IonText>
          </div>
        )}

        {ratingRideId && (
          <IonCard style={{ margin: "12px 16px" }}>
            <IonCardContent style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 600, marginBottom: "8px" }}>⭐ Calificar conductor</div>
              <StarRatingInput value={ratingStars} onChange={setRatingStars} />
              <IonItem lines="none" style={{ "--padding-start": "0", marginTop: "8px" }}>
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

  const LANG_LABEL: Record<string, string> = { es: "🇨🇱 ES", en: "🇺🇸 EN", rapa_nui: "🗿 RP" };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Guías locales</IonTitle>
        </IonToolbar>
        <IonToolbar style={{ "--background": "var(--ion-color-primary)", "--border-width": "0" }}>
          <div style={{ padding: "0 12px 10px" }}>
            <IonSearchbar
              value={searchName}
              onIonInput={(e) => setSearchName(String(e.detail.value ?? ""))}
              onIonChange={() => void load()}
              placeholder="Buscar guía..."
              debounce={400}
              style={{ "--background": "rgba(255,255,255,0.15)", "--color": "#fff", "--placeholder-color": "rgba(255,255,255,0.7)", "--icon-color": "rgba(255,255,255,0.8)", padding: 0 }}
            />
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "2px" }}>
              {(["", "es", "en", "rapa_nui"] as const).map((lang) => (
                <IonChip
                  key={lang}
                  style={{
                    flexShrink: 0,
                    "--background": filterLang === lang ? "#fff" : "rgba(255,255,255,0.2)",
                    "--color": filterLang === lang ? "var(--ion-color-primary)" : "#fff",
                    fontSize: "0.76rem", height: "26px",
                    fontWeight: filterLang === lang ? 700 : 400,
                  }}
                  onClick={() => setFilterLang(lang)}
                >
                  {lang === "" ? "Todos" : LANG_LABEL[lang] ?? lang}
                </IonChip>
              ))}
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}
        {loadError && <div style={{ padding: "16px" }}><IonText color="danger"><p>{loadError}</p></IonText></div>}

        {!loading && guides.length === 0 && (
          <EmptyState icon={compassOutline} title="Sin guías disponibles" subtitle="Vuelve a intentarlo más tarde" />
        )}

        {!loading && guides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px 16px 80px" }}>
            {guides.map((guide) => {
              const initials = guide.name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase();
              const rating = guide.ratingAverage ?? 0;
              return (
                <IonCard
                  key={guide.id}
                  className="ion-activatable"
                  style={{ margin: 0, borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", cursor: "pointer", overflow: "hidden" }}
                  onClick={() => setSelectedGuide(guide)}
                >
                  <IonCardContent style={{ padding: "16px" }}>
                    <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                      {/* Avatar */}
                      <div style={{
                        width: "60px", height: "60px", borderRadius: "50%", flexShrink: 0,
                        background: "var(--ion-color-warning-tint)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: "2px solid var(--ion-color-warning)",
                      }}>
                        <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--ion-color-warning-shade)" }}>
                          {initials || "G"}
                        </span>
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: "1rem" }}>{guide.name}</span>
                        </div>
                        {/* Rating */}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                          {[1,2,3,4,5].map((n) => (
                            <span key={n} style={{ fontSize: "0.85rem", color: n <= Math.round(rating) ? "#f4c430" : "var(--ion-color-light-shade)" }}>★</span>
                          ))}
                          <span style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginLeft: "4px" }}>
                            {rating > 0 ? rating.toFixed(1) : "Sin calificaciones"}{guide.ratingCount ? ` (${guide.ratingCount})` : ""}
                          </span>
                        </div>
                        {/* Bio */}
                        {guide.bio && (
                          <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginTop: "4px", lineHeight: 1.4 }}>
                            {guide.bio.slice(0, 90)}{guide.bio.length > 90 ? "…" : ""}
                          </div>
                        )}
                        {/* Languages */}
                        {(guide.languages ?? []).length > 0 && (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                            {(guide.languages ?? []).map((lang) => (
                              <IonChip key={lang} color="warning" style={{ fontSize: "0.68rem", height: "20px", margin: 0 }}>
                                <IonLabel>{LANG_LABEL[lang] ?? lang.toUpperCase()}</IonLabel>
                              </IonChip>
                            ))}
                          </div>
                        )}
                      </div>
                      <IonIcon icon={chevronForwardOutline} style={{ color: "var(--ion-color-medium)", fontSize: "1.1rem", flexShrink: 0, marginTop: "4px" }} />
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

  const LANG_LABEL_DETAIL: Record<string, string> = { es: "🇨🇱 Español", en: "🇺🇸 English", rapa_nui: "🗿 Rapa Nui" };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButton slot="start" fill="clear" color="light" onClick={onBack}>
            <IonIcon slot="icon-only" icon={chevronForwardOutline} style={{ transform: "rotate(180deg)" }} />
          </IonButton>
          <IonTitle>Perfil del guía</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {/* Cover / hero */}
        <div style={{
          background: "linear-gradient(145deg, var(--ion-color-warning-shade) 0%, var(--ion-color-warning) 100%)",
          padding: "28px 20px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
        }}>
          <div style={{
            width: "84px", height: "84px", borderRadius: "50%",
            background: "rgba(255,255,255,0.25)",
            border: "3px solid rgba(255,255,255,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: "1.8rem",
          }}>
            {initials || "G"}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: "1.15rem" }}>{guide.name}</div>
          </div>
          {/* Rating row */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {[1,2,3,4,5].map((n) => (
              <span key={n} style={{ fontSize: "1rem", color: n <= stars ? "#fff" : "rgba(255,255,255,0.4)" }}>★</span>
            ))}
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.8rem", marginLeft: "4px" }}>
              {guide.ratingAverage ? guide.ratingAverage.toFixed(1) : "Sin calificaciones"}
              {guide.ratingCount ? ` · ${guide.ratingCount} valoraciones` : ""}
            </span>
          </div>
          {/* Languages */}
          {(guide.languages ?? []).length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
              {(guide.languages ?? []).map((lang) => (
                <span key={lang} style={{
                  background: "rgba(255,255,255,0.2)",
                  color: "#fff",
                  borderRadius: "12px",
                  padding: "2px 10px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                }}>
                  {LANG_LABEL_DETAIL[lang] ?? lang.toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 16px 80px" }}>
          {/* Bio */}
          {guide.bio && (
            <IonCard style={{ margin: "0 0 16px", borderRadius: "14px" }}>
              <IonCardContent style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--ion-color-medium)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sobre mí</div>
                <div style={{ fontSize: "0.88rem", lineHeight: 1.6, color: "var(--ion-text-color)" }}>{guide.bio}</div>
              </IonCardContent>
            </IonCard>
          )}

          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "12px" }}>Servicios disponibles</div>

          {loading && <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}><IonSpinner name="crescent" /></div>}

          {!loading && services.length === 0 && (
            <EmptyState icon={compassOutline} title="Sin servicios activos" subtitle="Este guía no tiene servicios publicados aún" />
          )}

          {!loading && services.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {services.map((svc) => {
                const priceDisplay = svc.price !== null
                  ? `$${(svc.price / 100).toLocaleString("es-CL")} CLP/persona`
                  : "Consultar precio";
                return (
                  <IonCard key={svc.id} style={{ margin: 0, borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                    <IonCardContent style={{ padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", flex: 1 }}>{svc.title}</div>
                        <IonBadge color="tertiary" style={{ fontSize: "0.65rem", marginLeft: "8px", flexShrink: 0 }}>
                          {SERVICE_TYPE_LABEL[svc.type] ?? svc.type}
                        </IonBadge>
                      </div>
                      {svc.description && (
                        <div style={{ fontSize: "0.8rem", color: "var(--ion-color-medium)", marginBottom: "10px", lineHeight: 1.4 }}>
                          {svc.description}
                        </div>
                      )}
                      {/* Meta row */}
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "0.78rem", color: "var(--ion-color-medium)", marginBottom: "8px" }}>
                        {svc.durationMinutes && <span>⏱ {svc.durationMinutes} min</span>}
                        {svc.maxPeople && <span>👥 Máx {svc.maxPeople}</span>}
                        {svc.meetingPoint && <span>📍 {svc.meetingPoint}</span>}
                        <span style={{ color: svc.includesVehicle ? "var(--ion-color-primary)" : "var(--ion-color-medium)" }}>
                          🚗 {svc.includesVehicle ? "Incluye vehículo" : "Sin vehículo"}
                        </span>
                      </div>
                      {/* Includes */}
                      {(svc.includes ?? []).length > 0 && (
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
                          {(svc.includes ?? []).map((inc) => (
                            <span key={inc} style={{ background: "var(--ion-color-success-tint)", color: "var(--ion-color-success-shade)", borderRadius: "10px", padding: "2px 8px", fontSize: "0.7rem" }}>
                              ✓ {inc}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Price + CTA */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                        <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--ion-color-success)" }}>
                          {priceDisplay}
                        </div>
                        <IonButton
                          size="small"
                          style={{ "--border-radius": "10px" }}
                          onClick={() => { setBookingService(svc); setBookingDate(new Date().toISOString().slice(0, 10)); }}
                        >
                          Reservar
                        </IonButton>
                      </div>
                    </IonCardContent>
                  </IonCard>
                );
              })}
            </div>
          )}
        </div>

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
        {loadError && <div style={{ padding: "16px" }}><IonText color="danger"><p>{loadError}</p></IonText></div>}
        {!loading && filtered.length === 0 && (
          <EmptyState icon={carSportOutline} title="Sin vehículos disponibles" subtitle="Vuelve a intentarlo más tarde" />
        )}
        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "12px 16px 80px" }}>
            {filtered.map((v) => (
              <IonCard
                key={v.id}
                className="ion-activatable"
                style={{ margin: 0, borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", overflow: "hidden", cursor: "pointer" }}
                onClick={() => setSelectedId(v.id)}
              >
                {/* Photo */}
                {v.photos && v.photos.length > 0 ? (
                  <img
                    src={v.photos[0]}
                    alt={`${v.brand} ${v.model}`}
                    style={{ width: "100%", height: "160px", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{
                    width: "100%", height: "120px",
                    background: "linear-gradient(135deg, var(--ion-color-tertiary-tint) 0%, var(--ion-color-tertiary-shade) 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <IonIcon icon={carSportOutline} style={{ fontSize: "3rem", color: "rgba(255,255,255,0.6)" }} />
                  </div>
                )}
                <IonCardContent style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                      {v.brand} {v.model}{v.year ? ` (${v.year})` : ""}
                    </div>
                    <IonBadge color="tertiary" style={{ fontSize: "0.65rem", flexShrink: 0, marginLeft: "6px" }}>
                      {VEHICLE_TYPE_LABEL[v.type] ?? v.type}
                    </IonBadge>
                  </div>
                  {/* Specs row */}
                  <div style={{ display: "flex", gap: "10px", fontSize: "0.76rem", color: "var(--ion-color-medium)", marginBottom: "8px", flexWrap: "wrap" }}>
                    {v.seats    && <span>💺 {v.seats} asientos</span>}
                    {v.transmission && <span>⚙️ {v.transmission === "manual" ? "Manual" : "Auto"}</span>}
                    {v.fuelType && <span>⛽ {v.fuelType === "gasoline" ? "Bencina" : v.fuelType === "diesel" ? "Diésel" : v.fuelType === "electric" ? "Eléctrico" : "Híbrido"}</span>}
                    {v.color && <span>🎨 {v.color}</span>}
                  </div>
                  {/* Features */}
                  {(v.features ?? []).length > 0 && (
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
                      {(v.features ?? []).slice(0, 4).map((f) => (
                        <span key={f} style={{ background: "var(--ion-color-light)", borderRadius: "8px", padding: "2px 8px", fontSize: "0.68rem", color: "var(--ion-color-dark)" }}>
                          {f}
                        </span>
                      ))}
                      {(v.features ?? []).length > 4 && (
                        <span style={{ background: "var(--ion-color-light)", borderRadius: "8px", padding: "2px 8px", fontSize: "0.68rem", color: "var(--ion-color-medium)" }}>
                          +{(v.features ?? []).length - 4}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Price + CTA */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--ion-color-success)" }}>
                        ${(v.dailyPrice / 100).toLocaleString("es-CL")}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)" }}> /día</span>
                    </div>
                    <IonButton size="small" style={{ "--border-radius": "10px" }}>Ver detalles</IonButton>
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
          <div style={{ paddingBottom: "80px" }}>
            {/* Balance hero */}
            <div style={{
              background: "linear-gradient(145deg, var(--ion-color-primary) 0%, var(--ion-color-primary-shade) 100%)",
              padding: "32px 24px 28px",
              textAlign: "center",
            }}>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.82rem", marginBottom: "6px" }}>Saldo disponible</div>
              <div style={{ color: "#fff", fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-1px" }}>
                ${(wallet.balance / 100).toLocaleString("es-CL")}
                <span style={{ fontSize: "1rem", fontWeight: 400, marginLeft: "6px", opacity: 0.8 }}>{wallet.currency}</span>
              </div>
              <div style={{ marginTop: "10px" }}>
                <IonBadge
                  color={wallet.status === "active" ? "success" : "medium"}
                  style={{ fontSize: "0.72rem" }}
                >
                  {wallet.status === "active" ? "✓ Billetera activa" : wallet.status}
                </IonBadge>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ padding: "16px 16px 0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "6px" }}>
                <IonButton expand="block" fill="outline" disabled style={{ "--border-radius": "12px" }}>
                  ↑ Recargar
                </IonButton>
                <IonButton expand="block" fill="outline" disabled style={{ "--border-radius": "12px" }}>
                  ↓ Retirar
                </IonButton>
              </div>
              <IonNote style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", display: "block", marginBottom: "20px", textAlign: "center" }}>
                Recarga y retiro disponibles próximamente
              </IonNote>

              <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "12px" }}>Movimientos</div>

              {transactions.length === 0 && (
                <EmptyState icon={walletOutline} title="Sin movimientos" subtitle="Tus transacciones aparecerán aquí" />
              )}

              {transactions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--ion-color-light-shade)", borderRadius: "14px", overflow: "hidden" }}>
                  {transactions.map((tx, idx) => {
                    const isDebit = tx.type === "payment";
                    const txIcon = tx.type === "payment" ? "🚗" : tx.type === "refund" ? "↩️" : "💰";
                    return (
                      <div
                        key={tx.id}
                        style={{
                          background: "var(--ion-card-background, #fff)",
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          borderBottom: idx < transactions.length - 1 ? "1px solid var(--ion-color-light-shade)" : "none",
                        }}
                      >
                        <div style={{
                          width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
                          background: isDebit ? "var(--ion-color-danger-tint)" : "var(--ion-color-success-tint)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "1.1rem",
                        }}>
                          {txIcon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--ion-text-color)" }}>
                            {TX_TYPE_LABEL[tx.type] ?? tx.type}
                          </div>
                          {tx.description && (
                            <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {tx.description}
                            </div>
                          )}
                          <div style={{ fontSize: "0.68rem", color: "var(--ion-color-medium)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                            {new Date(tx.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                            <IonBadge color={TX_STATUS_COLOR[tx.status] ?? "medium"} style={{ fontSize: "0.6rem" }}>
                              {tx.status}
                            </IonBadge>
                          </div>
                        </div>
                        <div style={{
                          fontWeight: 800, fontSize: "0.95rem",
                          color: isDebit ? "var(--ion-color-danger)" : "var(--ion-color-success)",
                          flexShrink: 0,
                        }}>
                          {isDebit ? "−" : "+"}${(tx.amount / 100).toLocaleString("es-CL")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
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

            {session?.accessToken && <LegalStatusSection token={session.accessToken} />}
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
