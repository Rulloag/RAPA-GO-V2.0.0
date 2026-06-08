import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  carOutline,
  cashOutline,
  checkmarkCircleOutline,
  locationOutline,
  navigateOutline,
  shieldCheckmarkOutline,
  walkOutline,
  warningOutline,
} from "ionicons/icons";
import { useEffect, useState } from "react";
import { MapFallback } from "../../../components/MapFallback.js";
import { useAuth } from "../../../features/auth/index.js";
import {
  ridesService,
  type CreateRideInput,
  type RideRequestData,
} from "../../../features/rides/rides.service.js";
import { fareSettingsService } from "../../../features/fareSettings/fareSettings.service.js";
import {
  legalService,
  type LegalDocumentData,
  type UserAcceptanceData,
} from "../../../features/legal/legal.service.js";
import {
  RAPA_NUI_PLACES,
  getDistanceBetween,
  getEstimatedFare,
} from "@rapa-go/shared";
import { RIDE_STATUS_LABEL } from "../shared.js";

type Coords = {
  lat: number;
  lng: number;
};

export default function RequestRidePage(): JSX.Element {
  const { session } = useAuth();

  const [originInput, setOriginInput] = useState("");
  const [destInput, setDestInput] = useState("");
  const [notesInput, setNotesInput] = useState("");

  const [selectedOriginId, setSelectedOriginId] = useState<string>("");
  const [selectedDestId, setSelectedDestId] = useState<string>("");

  const [originCoords, setOriginCoords] = useState<Coords | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<RideRequestData | null>(null);

  const [farePreview, setFarePreview] = useState<{
    km: number;
    minutes: number;
    fare: number;
    isZoneFare: boolean;
  } | null>(null);

  const [docs, setDocs] = useState<LegalDocumentData[]>([]);
  const [acceptances, setAcceptances] = useState<UserAcceptanceData[]>([]);
  const [legalLoading, setLegalLoading] = useState(true);

  const sortedPlaces = [...RAPA_NUI_PLACES].sort((a, b) => {
    if (a.isPopular && !b.isPopular) return -1;
    if (!a.isPopular && b.isPopular) return 1;
    return a.sortOrder - b.sortOrder;
  });

  const getStatus = (doc: LegalDocumentData) => {
    const acc = acceptances.find((a) => a.legalDocumentId === doc.id);

    if (!acc) return "not_accepted";
    if (acc.versionAccepted !== doc.version) return "new_version";

    return "accepted";
  };

  const allAccepted =
    docs.length === 0 || docs.every((doc) => getStatus(doc) === "accepted");

  useEffect(() => {
    if (!session?.accessToken) return;

    setLegalLoading(true);

    Promise.all([
      legalService.getActive(),
      legalService.getMyAcceptances(session.accessToken),
    ])
      .then(([d, a]) => {
        setDocs(d);
        setAcceptances(a);
      })
      .catch(() => {
        setDocs([]);
        setAcceptances([]);
      })
      .finally(() => {
        setLegalLoading(false);
      });
  }, [session?.accessToken]);

  useEffect(() => {
    handleUseCurrentLocation();
  }, []);

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

    const originName =
      RAPA_NUI_PLACES.find((p) => p.id === selectedOriginId)?.name ??
      originInput;

    const destName =
      RAPA_NUI_PLACES.find((p) => p.id === selectedDestId)?.name ?? destInput;

    fareSettingsService
      .getZoneFares({
        zoneFrom: originName,
        zoneTo: destName,
      })
      .then((zones) => {
        const zone = zones.find((z) => z.isActive);

        if (zone) {
          setFarePreview({
            km: dist.km,
            minutes: dist.minutes,
            fare: zone.fare,
            isZoneFare: true,
          });
        } else {
          setFarePreview({
            km: dist.km,
            minutes: dist.minutes,
            fare: getEstimatedFare(dist.km),
            isZoneFare: false,
          });
        }
      })
      .catch(() => {
        setFarePreview({
          km: dist.km,
          minutes: dist.minutes,
          fare: getEstimatedFare(dist.km),
          isZoneFare: false,
        });
      });
  }, [selectedOriginId, selectedDestId, originInput, destInput]);

  function handleUseCurrentLocation(): void {
    if (!navigator.geolocation) return;

    setGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOriginCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });

        setOriginInput("Mi ubicación actual");
        setSelectedOriginId("");
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );
  }

  function handleOriginPlaceSelect(placeId: string): void {
    const place = RAPA_NUI_PLACES.find((p) => p.id === placeId);

    if (!place) return;

    setOriginInput(place.name);
    setSelectedOriginId(placeId);
    setOriginCoords(null);
  }

  function handleDestPlaceSelect(placeId: string): void {
    const place = RAPA_NUI_PLACES.find((p) => p.id === placeId);

    if (!place) return;

    setDestInput(place.name);
    setSelectedDestId(placeId);
  }

  async function handleAccept(doc: LegalDocumentData): Promise<void> {
    if (!session?.accessToken) return;

    await legalService.accept(session.accessToken, doc.id, doc.version);

    const newAcceptances = await legalService.getMyAcceptances(
      session.accessToken,
    );

    setAcceptances(newAcceptances);
  }

  async function handleRequest(): Promise<void> {
    if (!session?.accessToken) return;

    if (!allAccepted) {
      setSubmitError("Debes aceptar los documentos legales antes de solicitar.");
      return;
    }

    const origin = originInput.trim();
    const dest = destInput.trim();

    if (!origin || !dest) {
      setSubmitError("Debes seleccionar origen y destino.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const input: CreateRideInput = {
        originText: origin,
        destinationText: dest,
      };

      const cleanNotes = notesInput.trim();

      if (cleanNotes) {
        input.notes = cleanNotes;
      }

      const ride = await ridesService.createRideRequest(
        session.accessToken,
        input,
      );

      setSubmitted(ride);
      setNotesInput("");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Error al solicitar el viaje.",
      );
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

      <IonContent fullscreen>
        <div
          style={{
            maxWidth: "430px",
            minHeight: "100%",
            margin: "0 auto",
            background: "#1A1A1A",
            paddingBottom: "90px",
          }}
        >
          <div style={{ position: "relative" }}>
            <MapFallback
              origin={{
                ...(selectedOriginId ? { id: selectedOriginId } : {}),
                text: originInput.trim() || "Mi ubicación",
                lat: originCoords?.lat ?? null,
                lng: originCoords?.lng ?? null,
              }}
              destination={{
                ...(selectedDestId ? { id: selectedDestId } : {}),
                text: destInput.trim() || "Destino",
              }}
              height={360}
            />

            <div
              style={{
                position: "absolute",
                left: "14px",
                right: "14px",
                top: "14px",
                background: "rgba(255,255,255,.95)",
                borderRadius: "18px",
                padding: "12px 14px",
                boxShadow: "0 10px 25px rgba(0,0,0,.25)",
              }}
            >
              <div style={{ display: "flex", gap: "10px" }}>
                <div
                  style={{
                    width: "12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: "4px",
                  }}
                >
                  <span
                    style={{
                      width: "9px",
                      height: "9px",
                      borderRadius: "50%",
                      background: "#2BA84A",
                    }}
                  />
                  <span
                    style={{
                      width: "1px",
                      height: "28px",
                      background: "rgba(0,0,0,.18)",
                      margin: "4px 0",
                    }}
                  />
                  <span
                    style={{
                      width: "9px",
                      height: "9px",
                      borderRadius: "50%",
                      background: "#B84F2E",
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: ".72rem", color: "#777" }}>Origen</div>
                  <div
                    style={{
                      fontWeight: 900,
                      color: "#1A1A1A",
                      fontSize: ".88rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {originInput || "Mi ubicación"}
                  </div>

                  <div
                    style={{
                      height: "1px",
                      background: "rgba(0,0,0,.08)",
                      margin: "9px 0",
                    }}
                  />

                  <div style={{ fontSize: ".72rem", color: "#777" }}>
                    Destino
                  </div>
                  <div
                    style={{
                      fontWeight: 900,
                      color: "#1A1A1A",
                      fontSize: ".88rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {destInput || "Selecciona destino"}
                  </div>
                </div>
              </div>
            </div>

            <IonButton
              size="small"
              onClick={handleUseCurrentLocation}
              style={{
                position: "absolute",
                right: "16px",
                bottom: "18px",
                "--border-radius": "999px",
                "--background": "#1A1A1A",
                "--color": "#F6F2EC",
              }}
            >
              {gpsLoading ? (
                <IonSpinner name="dots" />
              ) : (
                <IonIcon icon={navigateOutline} slot="icon-only" />
              )}
            </IonButton>
          </div>

          <IonCard
            style={{
              margin: "-18px 10px 0",
              borderRadius: "28px 28px 20px 20px",
              position: "relative",
              zIndex: 5,
              boxShadow: "0 -8px 30px rgba(0,0,0,.35)",
            }}
          >
            <IonCardContent style={{ padding: "18px 16px" }}>
              <div
                style={{
                  width: "42px",
                  height: "4px",
                  borderRadius: "999px",
                  background: "rgba(0,0,0,.18)",
                  margin: "0 auto 14px",
                }}
              />

              <div
                style={{
                  background: "#FFF4D6",
                  borderRadius: "16px",
                  padding: "12px",
                  border: "1px solid rgba(200,155,60,.35)",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  <IonIcon
                    icon={warningOutline}
                    style={{
                      fontSize: "1.4rem",
                      color: "#B84F2E",
                      flexShrink: 0,
                    }}
                  />

                  <div>
                    <div
                      style={{
                        fontWeight: 900,
                        color: "#1A1A1A",
                        fontSize: ".9rem",
                      }}
                    >
                      Punto recomendado para recogida
                    </div>

                    <div
                      style={{
                        marginTop: "3px",
                        color: "rgba(26,26,26,.72)",
                        fontSize: ".78rem",
                        lineHeight: 1.4,
                      }}
                    >
                      Si el auto no puede entrar a una calle o pasaje, Rapa Go
                      recomendará el punto accesible más cercano.
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    background: "#F6F2EC",
                    borderRadius: "16px",
                    padding: "12px",
                    border: "1px solid rgba(200,155,60,.18)",
                  }}
                >
                  <IonIcon icon={walkOutline} style={{ color: "#C89B3C" }} />
                  <div style={{ fontWeight: 900, marginTop: "4px" }}>
                    Camina
                  </div>
                  <div style={{ fontSize: ".76rem", color: "#666" }}>
                    al punto seguro
                  </div>
                </div>

                <div
                  style={{
                    background: "#F6F2EC",
                    borderRadius: "16px",
                    padding: "12px",
                    border: "1px solid rgba(200,155,60,.18)",
                  }}
                >
                  <IonIcon icon={carOutline} style={{ color: "#C89B3C" }} />
                  <div style={{ fontWeight: 900, marginTop: "4px" }}>
                    Conductor
                  </div>
                  <div style={{ fontSize: ".76rem", color: "#666" }}>
                    llega al punto
                  </div>
                </div>
              </div>

              <IonItem lines="full">
                <IonIcon icon={locationOutline} slot="start" color="success" />
                <IonLabel>Lugar frecuente origen</IonLabel>
                <IonSelect
                  interface="action-sheet"
                  placeholder="Seleccionar"
                  value={selectedOriginId}
                  onIonChange={(e) =>
                    handleOriginPlaceSelect(e.detail.value as string)
                  }
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
                    setOriginCoords(null);
                  }}
                  placeholder="Ej: Hotel Hanga Roa"
                  maxlength={150}
                  clearInput
                />
              </IonItem>

              <IonItem lines="full" style={{ marginTop: "8px" }}>
                <IonIcon icon={locationOutline} slot="start" color="danger" />
                <IonLabel>Lugar frecuente destino</IonLabel>
                <IonSelect
                  interface="action-sheet"
                  placeholder="Seleccionar"
                  value={selectedDestId}
                  onIonChange={(e) =>
                    handleDestPlaceSelect(e.detail.value as string)
                  }
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
                <IonLabel position="stacked">Notas opcionales</IonLabel>
                <IonTextarea
                  value={notesInput}
                  onIonInput={(e) => setNotesInput(String(e.detail.value ?? ""))}
                  placeholder="Ej: Llevar maletas grandes"
                  maxlength={500}
                  rows={2}
                />
                <IonNote slot="helper" style={{ fontSize: "0.7rem" }}>
                  Máximo 500 caracteres.
                </IonNote>
              </IonItem>

              {farePreview && !submitted && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "14px",
                    background: "#F6F2EC",
                    borderRadius: "16px",
                    border: "1px solid rgba(200,155,60,.3)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "8px",
                      textAlign: "center",
                    }}
                  >
                    <div>
                      <IonIcon icon={navigateOutline} />
                      <div style={{ fontWeight: 900 }}>
                        {farePreview.minutes} min
                      </div>
                      <div style={{ fontSize: ".68rem", color: "#777" }}>
                        Tiempo
                      </div>
                    </div>

                    <div>
                      <IonIcon icon={locationOutline} />
                      <div style={{ fontWeight: 900 }}>
                        {farePreview.km.toFixed(1)} km
                      </div>
                      <div style={{ fontSize: ".68rem", color: "#777" }}>
                        Distancia
                      </div>
                    </div>

                    <div>
                      <IonIcon icon={cashOutline} />
                      <div style={{ fontWeight: 900 }}>
                        ${farePreview.fare.toLocaleString("es-CL")}
                      </div>
                      <div style={{ fontSize: ".68rem", color: "#777" }}>
                        Tarifa
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: 900,
                    marginBottom: "8px",
                  }}
                >
                  <IonIcon icon={shieldCheckmarkOutline} color="success" />
                  Documentos legales
                </div>

                {legalLoading && <IonSpinner name="dots" />}

                {!legalLoading &&
                  docs.map((doc) => {
                    const status = getStatus(doc);

                    return (
                      <IonItem
                        key={doc.id}
                        lines="full"
                        style={{
                          "--background": "#F6F2EC",
                          "--border-radius": "14px",
                          marginBottom: "8px",
                        }}
                      >
                        <IonLabel>
                          <h3>{doc.title}</h3>
                          <p>v{doc.version}</p>
                        </IonLabel>

                        {status === "accepted" ? (
                          <IonBadge color="success" slot="end">
                            Aceptado
                          </IonBadge>
                        ) : (
                          <IonButton
                            size="small"
                            color="danger"
                            slot="end"
                            onClick={() => void handleAccept(doc)}
                          >
                            Aceptar
                          </IonButton>
                        )}
                      </IonItem>
                    );
                  })}
              </div>

              {submitted && (
                <IonText color="success">
                  <p style={{ fontWeight: 800 }}>
                    <IonIcon icon={checkmarkCircleOutline} /> Solicitud enviada
                    — Estado:{" "}
                    {RIDE_STATUS_LABEL[submitted.status] ?? submitted.status}
                  </p>
                </IonText>
              )}

              {submitError && (
                <IonText color="danger">
                  <p style={{ fontWeight: 700 }}>{submitError}</p>
                </IonText>
              )}

              <IonButton
                expand="block"
                style={{
                  marginTop: "16px",
                  "--border-radius": "16px",
                  height: "52px",
                  fontWeight: 900,
                }}
                onClick={() => void handleRequest()}
                disabled={submitting || !allAccepted}
              >
                {submitting ? (
                  <IonSpinner name="dots" />
                ) : (
                  "Confirmar punto y solicitar viaje"
                )}
              </IonButton>

              <div
                style={{
                  textAlign: "center",
                  color: "#777",
                  fontSize: ".75rem",
                  marginTop: "12px",
                }}
              >
                <IonIcon icon={shieldCheckmarkOutline} /> Viaje seguro y
                protegido
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
}