import React, { useState } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonIcon, IonNote, IonSpinner, IonBadge,
  IonModal, IonInput, IonItem, IonLabel, IonList, IonToast,
  IonRefresher, IonRefresherContent,
} from "@ionic/react";
import { ticketOutline, globeOutline, addOutline, closeOutline } from "ionicons/icons";
import { EXTERNAL_SYSTEMS } from "@rapa-go/shared";
import { useIonViewWillEnter } from "@ionic/react";
import { useAuth } from "../../../features/auth";
import { eventTicketsService, type EventTicketData } from "../../../features/eventTickets/eventTickets.service.js";

export function PassengerEventsPage(): React.ReactElement {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Eventos y Experiencias</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ textAlign: "center", padding: "1rem 0 2rem" }}>
          <IonIcon icon={ticketOutline} style={{ fontSize: "4rem", color: "var(--ion-color-secondary)" }} />
          <h2 style={{ margin: "0.5rem 0 0.25rem" }}>{EXTERNAL_SYSTEMS.events.name}</h2>
          <IonNote>{EXTERNAL_SYSTEMS.events.description}</IonNote>
        </div>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Reserva tu lugar</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p>Shows de danza, talleres de artesanía, caminatas arqueológicas, astronomía y mucho más.</p>
            <IonButton
              expand="block"
              color="secondary"
              href={EXTERNAL_SYSTEMS.events.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: "1rem" }}
            >
              <IonIcon icon={globeOutline} slot="start" />
              Ver eventos disponibles
            </IonButton>
            <p style={{ textAlign: "center", marginTop: "0.75rem" }}>
              <IonNote>Serás redirigido al sistema de reservas de eventos</IonNote>
            </p>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>¿Ya tienes una reserva?</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p>Registra tu código de reserva para obtener tu comprobante QR digital.</p>
            <IonButton expand="block" fill="outline" routerLink="/passenger/event-tickets" style={{ marginTop: "0.5rem" }}>
              <IonIcon icon={ticketOutline} slot="start" />
              Mis entradas
            </IonButton>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
}

const STATUS_COLOR: Record<string, string> = {
  active: "success",
  used:   "medium",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  used:   "Usada",
};

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

  useIonViewWillEnter(() => { void load(); });

  const handleSave = async () => {
    if (!session?.accessToken) return;
    if (!form.externalBookingId || !form.externalEventId || !form.eventName) {
      setToast("Completa los campos obligatorios");
      return;
    }
    setSaving(true);
    try {
      const input: { externalEventId: string; externalBookingId: string; eventName: string; eventDate?: string; eventLocation?: string } = {
        externalEventId: form.externalEventId,
        externalBookingId: form.externalBookingId,
        eventName: form.eventName,
      };
      if (form.eventDate) input.eventDate = form.eventDate;
      if (form.eventLocation) input.eventLocation = form.eventLocation;
      await eventTicketsService.createTicket(session.accessToken, input);
      setShowAdd(false);
      setForm({ externalBookingId: "", externalEventId: "", eventName: "", eventDate: "", eventLocation: "" });
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
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <IonSpinner />
          </div>
        )}

        {!loading && tickets.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
            <IonIcon icon={ticketOutline} style={{ fontSize: "3rem", color: "var(--ion-color-medium)" }} />
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
                  {ticket.eventDate && <p style={{ margin: "0.25rem 0", color: "var(--ion-color-medium)" }}>{ticket.eventDate}</p>}
                  <p style={{ fontFamily: "monospace", margin: "0.25rem 0", fontSize: "0.9rem" }}>{ticket.ticketCode}</p>
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
                {selectedTicket.eventDate && <p style={{ color: "var(--ion-color-medium)" }}>{selectedTicket.eventDate}</p>}
                {selectedTicket.eventLocation && <p style={{ color: "var(--ion-color-medium)" }}>{selectedTicket.eventLocation}</p>}
                <div style={{ margin: "1.5rem auto", maxWidth: "260px" }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(selectedTicket.qrData)}&size=250x250`}
                    alt="QR Code"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    style={{ width: "100%", borderRadius: "8px" }}
                  />
                </div>
                <p style={{ fontFamily: "monospace", fontSize: "1.4rem", fontWeight: "bold", letterSpacing: "0.1rem" }}>
                  {selectedTicket.ticketCode}
                </p>
                <IonBadge color={STATUS_COLOR[selectedTicket.status] ?? "medium"} style={{ marginTop: "0.5rem" }}>
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
