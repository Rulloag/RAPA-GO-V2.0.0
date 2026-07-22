import React, { useMemo, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonNote,
  IonSpinner,
  IonBadge,
  IonModal,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonToast,
  IonRefresher,
  IonRefresherContent,
} from "@ionic/react";
import {
  ticketOutline,
  addOutline,
  closeOutline,
  calendarOutline,
  locationOutline,
  cashOutline,
  peopleOutline,
  checkmarkCircleOutline,
} from "ionicons/icons";
import { EXTERNAL_SYSTEMS } from "@rapa-go/shared";
import { useIonViewWillEnter } from "@ionic/react";
import { useAuth } from "../../../features/auth";
import {
  eventTicketsService,
  type EventTicketData,
} from "../../../features/eventTickets/eventTickets.service.js";

type PassengerPublicEvent = {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  date: string;
  time: string;
  priceClp: number;
  availableSeats: number;
  imageEmoji: string;
};

const RAPA_GO_EVENTS: PassengerPublicEvent[] = [
  {
    id: "EVT-DANZA-RN-001",
    name: "Show de danza Rapa Nui",
    category: "Cultura",
    description:
      "Presentación cultural con música, danza y relatos tradicionales de Rapa Nui.",
    location: "Hanga Vare Vare",
    date: "2026-07-05",
    time: "20:00",
    priceClp: 15000,
    availableSeats: 28,
    imageEmoji: "💃",
  },
  {
    id: "EVT-ARTESANIA-002",
    name: "Taller de artesanía local",
    category: "Taller",
    description:
      "Aprende técnicas básicas de artesanía local junto a monitores de la isla.",
    location: "Centro Cultural Rapa Nui",
    date: "2026-07-06",
    time: "11:00",
    priceClp: 12000,
    availableSeats: 16,
    imageEmoji: "🗿",
  },
  {
    id: "EVT-ASTRO-003",
    name: "Experiencia astronómica",
    category: "Experiencia",
    description:
      "Observación del cielo nocturno, constelaciones y relatos ancestrales.",
    location: "Ahu Tahai",
    date: "2026-07-07",
    time: "21:30",
    priceClp: 18000,
    availableSeats: 20,
    imageEmoji: "✨",
  },
  {
    id: "EVT-CAMINATA-004",
    name: "Caminata arqueológica guiada",
    category: "Tour",
    description:
      "Recorrido patrimonial con guía local por puntos históricos cercanos.",
    location: "Ahu Akivi",
    date: "2026-07-08",
    time: "09:30",
    priceClp: 25000,
    availableSeats: 12,
    imageEmoji: "🥾",
  },
];

function formatClp(value: number): string {
  return `$${Math.round(value).toLocaleString("es-CL")} CLP`;
}

function formatEventDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return value;

  return date.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

const STATUS_COLOR: Record<string, string> = {
  active: "success",
  used: "medium",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  used: "Usada",
};

export function PassengerEventsPage(): React.ReactElement {
  const { session } = useAuth();

  const [showEvents, setShowEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PassengerPublicEvent | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const total = useMemo(() => {
    if (!selectedEvent) return 0;
    return selectedEvent.priceClp * quantity;
  }, [selectedEvent, quantity]);

  function openReserve(event: PassengerPublicEvent): void {
    setSelectedEvent(event);
    setQuantity(1);
  }

  async function handleReserve(): Promise<void> {
    if (!selectedEvent) return;

    if (!session?.accessToken) {
      setToast("Debes iniciar sesión para reservar un evento.");
      return;
    }

    setSaving(true);

    try {
      await eventTicketsService.createTicket(session.accessToken, {
        externalEventId: selectedEvent.id,
        externalBookingId: `RPG-${Date.now()}`,
        eventName: `${selectedEvent.name} x${quantity}`,
        eventDate: `${selectedEvent.date} ${selectedEvent.time}`,
        eventLocation: selectedEvent.location,
      });

      setSelectedEvent(null);
      setShowEvents(false);
      setToast("Reserva creada correctamente. Revisa tu QR en Mis entradas.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "No se pudo crear la reserva.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Eventos y Experiencias</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ textAlign: "center", padding: "1rem 0 2rem" }}>
          <IonIcon
            icon={ticketOutline}
            style={{ fontSize: "4rem", color: "var(--ion-color-secondary)" }}
          />
          <h2 style={{ margin: "0.5rem 0 0.25rem" }}>
            {EXTERNAL_SYSTEMS.events.name}
          </h2>
          <IonNote>{EXTERNAL_SYSTEMS.events.description}</IonNote>
        </div>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Reserva tu lugar</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p>
              Shows de danza, talleres de artesanía, caminatas arqueológicas,
              astronomía y mucho más.
            </p>
            <IonButton
              expand="block"
              color="secondary"
              onClick={() => setShowEvents(true)}
              style={{ marginTop: "1rem", fontWeight: 900 }}
            >
              <IonIcon icon={ticketOutline} slot="start" />
              Ver eventos disponibles
            </IonButton>
            <p style={{ textAlign: "center", marginTop: "0.75rem" }}>
              <IonNote>Elige y reserva sin salir de Rapa Go</IonNote>
            </p>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>¿Ya tienes una reserva?</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p>
              Registra tu código de reserva para obtener tu comprobante QR digital.
            </p>
            <IonButton
              expand="block"
              fill="outline"
              routerLink="/passenger/event-tickets"
              style={{ marginTop: "0.5rem", fontWeight: 900 }}
            >
              <IonIcon icon={ticketOutline} slot="start" />
              Mis entradas
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonModal isOpen={showEvents} onDidDismiss={() => setShowEvents(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Eventos disponibles</IonTitle>
              <IonButton slot="end" fill="clear" onClick={() => setShowEvents(false)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            <div style={{ display: "grid", gap: 12, paddingBottom: 24 }}>
              {RAPA_GO_EVENTS.map((event) => (
                <IonCard
                  key={event.id}
                  style={{
                    margin: 0,
                    borderRadius: 22,
                    overflow: "hidden",
                    border: "1px solid rgba(210,164,58,.32)",
                    boxShadow: "0 12px 28px rgba(0,0,0,.14)",
                  }}
                >
                  <IonCardContent style={{ padding: 14 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 18,
                          background:
                            "linear-gradient(135deg,#fff4d2 0%,#d8a83e 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "2rem",
                          flexShrink: 0,
                        }}
                      >
                        {event.imageEmoji}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 950 }}>
                            {event.name}
                          </h3>
                          <IonBadge color="warning">{event.category}</IonBadge>
                        </div>

                        <p
                          style={{
                            margin: "6px 0 10px",
                            color: "var(--ion-color-medium)",
                            fontSize: ".82rem",
                            lineHeight: 1.35,
                          }}
                        >
                          {event.description}
                        </p>

                        <div style={{ display: "grid", gap: 6, fontSize: ".8rem" }}>
                          <span>
                            <IonIcon icon={locationOutline} /> {event.location}
                          </span>
                          <span>
                            <IonIcon icon={calendarOutline} /> {formatEventDate(event.date)} · {event.time}
                          </span>
                          <span>
                            <IonIcon icon={peopleOutline} /> {event.availableSeats} cupos disponibles
                          </span>
                          <strong>
                            <IonIcon icon={cashOutline} /> {formatClp(event.priceClp)} por persona
                          </strong>
                        </div>

                        <IonButton
                          expand="block"
                          color="secondary"
                          onClick={() => openReserve(event)}
                          style={{ marginTop: 12, fontWeight: 900 }}
                        >
                          Reservar
                        </IonButton>
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </div>
          </IonContent>
        </IonModal>

        <IonModal isOpen={selectedEvent !== null} onDidDismiss={() => setSelectedEvent(null)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Confirmar reserva</IonTitle>
              <IonButton slot="end" fill="clear" onClick={() => setSelectedEvent(null)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            {selectedEvent && (
              <IonCard style={{ margin: 0, borderRadius: 22 }}>
                <IonCardContent>
                  <div style={{ textAlign: "center", fontSize: "3rem" }}>
                    {selectedEvent.imageEmoji}
                  </div>
                  <h2 style={{ margin: "8px 0 4px", fontWeight: 950 }}>
                    {selectedEvent.name}
                  </h2>
                  <IonNote>
                    {selectedEvent.location} · {formatEventDate(selectedEvent.date)} · {selectedEvent.time}
                  </IonNote>

                  <IonItem style={{ marginTop: 16 }}>
                    <IonLabel position="stacked">Cantidad de personas</IonLabel>
                    <IonInput
                      type="number"
                      min="1"
                      max={selectedEvent.availableSeats}
                      value={quantity}
                      onIonInput={(e) => {
                        const next = Number(e.detail.value ?? 1);
                        const safe = Math.min(
                          selectedEvent.availableSeats,
                          Math.max(1, Number.isFinite(next) ? next : 1),
                        );
                        setQuantity(safe);
                      }}
                    />
                  </IonItem>

                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      borderRadius: 18,
                      background: "linear-gradient(135deg,#fffdf8,#ecd29a)",
                      border: "1px solid rgba(216,168,62,.5)",
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: ".78rem" }}>TOTAL</div>
                    <div style={{ fontWeight: 950, fontSize: "1.6rem" }}>
                      {formatClp(total)}
                    </div>
                    <IonNote>
                      {quantity} persona{quantity !== 1 ? "s" : ""} · {formatClp(selectedEvent.priceClp)} c/u
                    </IonNote>
                  </div>

                  <IonButton
                    expand="block"
                    color="secondary"
                    onClick={() => void handleReserve()}
                    disabled={saving}
                    style={{ marginTop: 16, fontWeight: 900 }}
                  >
                    {saving ? <IonSpinner name="crescent" /> : "Confirmar reserva"}
                  </IonButton>
                </IonCardContent>
              </IonCard>
            )}
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={toast !== null}
          message={toast ?? ""}
          duration={3000}
          onDidDismiss={() => setToast(null)}
        />
      </IonContent>
    </IonPage>
  );
}

export function PassengerEventTicketsPage(): React.ReactElement {
  const { session } = useAuth();
  const [tickets, setTickets] = useState<EventTicketData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<EventTicketData | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState({
    externalBookingId: "",
    externalEventId: "",
    eventName: "",
    eventDate: "",
    eventLocation: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const items = await eventTicketsService.getMyTickets(session.accessToken);
      setTickets(items);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error al cargar entradas");
    } finally {
      setLoading(false);
    }
  };

  useIonViewWillEnter(() => {
    void load();
  });

  const handleSave = async () => {
    if (!session?.accessToken) return;
    if (!form.externalBookingId || !form.externalEventId || !form.eventName) {
      setToast("Completa los campos obligatorios");
      return;
    }
    setSaving(true);
    try {
      const input: {
        externalEventId: string;
        externalBookingId: string;
        eventName: string;
        eventDate?: string;
        eventLocation?: string;
      } = {
        externalEventId: form.externalEventId,
        externalBookingId: form.externalBookingId,
        eventName: form.eventName,
      };
      if (form.eventDate) input.eventDate = form.eventDate;
      if (form.eventLocation) input.eventLocation = form.eventLocation;
      await eventTicketsService.createTicket(session.accessToken, input);
      setShowAdd(false);
      setForm({
        externalBookingId: "",
        externalEventId: "",
        eventName: "",
        eventDate: "",
        eventLocation: "",
      });
      await load();
      setToast("Entrada registrada exitosamente");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Mis Entradas</IonTitle>
          <IonButton slot="end" fill="clear" onClick={() => setShowAdd(true)}>
            <IonIcon icon={addOutline} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher
          slot="fixed"
          onIonRefresh={(e) => {
            void load().then(() => e.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <IonSpinner />
          </div>
        )}

        {!loading && tickets.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
            <IonIcon
              icon={ticketOutline}
              style={{ fontSize: "3rem", color: "var(--ion-color-medium)" }}
            />
            <p>No tienes entradas registradas</p>
            <IonButton onClick={() => setShowAdd(true)}>
              <IonIcon icon={addOutline} slot="start" />
              Agregar entrada
            </IonButton>
          </div>
        )}

        {tickets.map((ticket) => (
          <IonCard key={ticket.id}>
            <IonCardContent>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong>{ticket.eventName}</strong>
                  {ticket.eventDate && (
                    <p style={{ margin: "0.25rem 0", color: "var(--ion-color-medium)" }}>
                      {ticket.eventDate}
                    </p>
                  )}
                  <p style={{ fontFamily: "monospace", margin: "0.25rem 0", fontSize: "0.9rem" }}>
                    {ticket.ticketCode}
                  </p>
                </div>
                <IonBadge color={STATUS_COLOR[ticket.status] ?? "medium"}>
                  {STATUS_LABEL[ticket.status] ?? ticket.status}
                </IonBadge>
              </div>
              <IonButton
                expand="block"
                fill="outline"
                style={{ marginTop: "0.75rem" }}
                onClick={() => setSelectedTicket(ticket)}
              >
                <IonIcon icon={ticketOutline} slot="start" />
                Ver QR
              </IonButton>
            </IonCardContent>
          </IonCard>
        ))}

        <IonModal isOpen={selectedTicket !== null} onDidDismiss={() => setSelectedTicket(null)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Comprobante QR</IonTitle>
              <IonButton slot="end" fill="clear" onClick={() => setSelectedTicket(null)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {selectedTicket && (
              <div style={{ textAlign: "center", padding: "1rem" }}>
                <h2>{selectedTicket.eventName}</h2>
                {selectedTicket.eventDate && (
                  <p style={{ color: "var(--ion-color-medium)" }}>{selectedTicket.eventDate}</p>
                )}
                {selectedTicket.eventLocation && (
                  <p style={{ color: "var(--ion-color-medium)" }}>{selectedTicket.eventLocation}</p>
                )}
                <div style={{ margin: "1.5rem auto", maxWidth: "260px" }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                      selectedTicket.qrData,
                    )}&size=250x250`}
                    alt="QR Code"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                    style={{ width: "100%", borderRadius: "8px" }}
                  />
                </div>
                <p
                  style={{
                    fontFamily: "monospace",
                    fontSize: "1.4rem",
                    fontWeight: "bold",
                    letterSpacing: "0.1rem",
                  }}
                >
                  {selectedTicket.ticketCode}
                </p>
                <IonBadge
                  color={STATUS_COLOR[selectedTicket.status] ?? "medium"}
                  style={{ marginTop: "0.5rem" }}
                >
                  {STATUS_LABEL[selectedTicket.status] ?? selectedTicket.status}
                </IonBadge>
              </div>
            )}
          </IonContent>
        </IonModal>

        <IonModal isOpen={showAdd} onDidDismiss={() => setShowAdd(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Agregar reserva</IonTitle>
              <IonButton slot="end" fill="clear" onClick={() => setShowAdd(false)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonList>
              <IonItem>
                <IonLabel position="stacked">Nombre del evento *</IonLabel>
                <IonInput
                  value={form.eventName}
                  onIonInput={(e) => setForm({ ...form, eventName: e.detail.value ?? "" })}
                  placeholder="Ej: Show de danza Rapa Nui"
                />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Código de reserva externo *</IonLabel>
                <IonInput
                  value={form.externalBookingId}
                  onIonInput={(e) => setForm({ ...form, externalBookingId: e.detail.value ?? "" })}
                  placeholder="Ej: BK-12345"
                />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">ID de evento *</IonLabel>
                <IonInput
                  value={form.externalEventId}
                  onIonInput={(e) => setForm({ ...form, externalEventId: e.detail.value ?? "" })}
                  placeholder="Ej: EVT-001"
                />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Fecha del evento</IonLabel>
                <IonInput
                  type="date"
                  value={form.eventDate}
                  onIonInput={(e) => setForm({ ...form, eventDate: e.detail.value ?? "" })}
                />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Lugar</IonLabel>
                <IonInput
                  value={form.eventLocation}
                  onIonInput={(e) => setForm({ ...form, eventLocation: e.detail.value ?? "" })}
                  placeholder="Ej: Ahu Tongariki"
                />
              </IonItem>
            </IonList>
            <IonButton expand="block" style={{ margin: "1rem" }} onClick={handleSave} disabled={saving}>
              {saving ? <IonSpinner name="crescent" /> : "Guardar"}
            </IonButton>
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={toast !== null}
          message={toast ?? ""}
          duration={3000}
          onDidDismiss={() => setToast(null)}
        />
      </IonContent>
    </IonPage>
  );
}
