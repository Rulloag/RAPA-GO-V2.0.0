import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonContent, IonIcon, IonLabel, IonPage, IonText } from "@ionic/react";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { carOutline, carSportOutline, chevronForwardOutline, ellipseOutline, giftOutline, locationOutline, mapOutline, ticketOutline, walletOutline } from "ionicons/icons";
import { ServiceCard } from "../../../components/ServiceCard.js";
import { WhatsAppButton } from "../../../components/WhatsAppButton.js";
import { passengerProfileService, type PassengerProfileData } from "../../../features/passengers/passengerProfile.service.js";
import { useConnectivity } from "../../../hooks/useConnectivity.js";
import { ROUTES } from "../../../navigation/routes.js";
import { useAuth } from "../../../features/auth/index.js";
import { RAPAGO_CONTACT, WA_MESSAGES } from "@rapa-go/shared";
import { FREQUENT_DESTINATIONS } from "../shared.js";

export default function HomePage(): JSX.Element {
  const history = useHistory();
  const isOnline = useConnectivity();
  const { session } = useAuth();
  const [profile, setProfile] = useState<PassengerProfileData | null>(null);

  useEffect(() => {
    if (!session?.accessToken) return;
    void passengerProfileService.getMyProfile(session.accessToken)
      .then(setProfile)
      .catch(() => {});
  }, [session?.accessToken]);

  const name      = session?.user?.name ?? "";
  const firstName = name.split(" ")[0] || "pasajero";
  const initials  = name.trim().split(/\s+/).map((p: string) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "P";
  const hasPhone  = !!profile?.phone;

  return (
    <IonPage>
      <div style={{
        background: "linear-gradient(145deg, var(--ion-color-primary) 0%, var(--ion-color-primary-shade) 100%)",
        padding: "calc(env(safe-area-inset-top) + 12px) 16px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: "1.1rem", flexShrink: 0,
            }}
              aria-label={`Avatar de ${name || "pasajero"}`}
            >
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
          <div style={{ color: "#fff" }}>
            <IonIcon icon={ellipseOutline} style={{ fontSize: "1.6rem", opacity: 0.7 }} />
          </div>
        </div>
      </div>

      <IonContent>
        <div style={{ padding: "0 16px 80px" }}>

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
            <div style={{ margin: "12px 0 0", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "12px", padding: "10px 14px" }}
              role="alert" aria-label="Sin conexión a internet"
            >
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

          <div style={{ marginTop: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "12px", color: "var(--ion-text-color)" }}>
              Servicios
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
              <ServiceCard icon={carOutline}      title="Viaje"    subtitle="Solicitar ahora"   color="primary"   onClick={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)} />
              <ServiceCard icon={mapOutline}       title="Tours"    subtitle="Con guías locales" color="secondary" onClick={() => history.push(ROUTES.PASSENGER.GUIDES)} />
              <ServiceCard icon={carSportOutline}  title="Arriendo" subtitle="Vehículos"         color="tertiary"  onClick={() => history.push(ROUTES.PASSENGER.RENTALS)} />
              <ServiceCard icon={ticketOutline}    title="Eventos"  subtitle="Cultura"           color="warning"   onClick={() => history.push(ROUTES.PASSENGER.EVENTS)} />
            </div>
          </div>

          <div style={{ marginTop: "24px" }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "10px", color: "var(--ion-text-color)" }}>
              Destinos frecuentes
            </div>
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
              {FREQUENT_DESTINATIONS.map((dest) => (
                <IonChip
                  key={dest}
                  aria-label={`Destino frecuente: ${dest}`}
                  style={{ flexShrink: 0, "--background": "var(--ion-color-light)", fontSize: "0.8rem", height: "36px" }}
                  onClick={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
                >
                  <IonIcon icon={locationOutline} style={{ marginRight: "4px", fontSize: "0.9rem" }} />
                  <IonLabel>{dest}</IonLabel>
                </IonChip>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <IonCard className="ion-activatable" style={{ margin: 0, borderRadius: "14px", cursor: "pointer" }} routerLink={ROUTES.PASSENGER.TRIPS}>
              <IonCardContent style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <IonIcon icon={carOutline} style={{ fontSize: "1.4rem", color: "var(--ion-color-primary)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Mis Viajes</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)" }}>Historial</div>
                </div>
              </IonCardContent>
            </IonCard>
            <IonCard className="ion-activatable" style={{ margin: 0, borderRadius: "14px", cursor: "pointer" }} routerLink={ROUTES.PASSENGER.WALLET}>
              <IonCardContent style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <IonIcon icon={walletOutline} style={{ fontSize: "1.4rem", color: "var(--ion-color-success)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Wallet</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)" }}>Saldo y pagos</div>
                </div>
              </IonCardContent>
            </IonCard>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="Banner referidos: invita amigos y gana crédito"
            style={{
              marginTop: "20px",
              background: "linear-gradient(135deg, var(--ion-color-secondary) 0%, var(--ion-color-secondary-shade) 100%)",
              borderRadius: "16px", padding: "16px 18px",
              display: "flex", alignItems: "center", gap: "14px", cursor: "pointer",
            }}
            onClick={() => history.push(ROUTES.PROFILE.INDEX)}
            onKeyDown={(e) => { if (e.key === "Enter") history.push(ROUTES.PROFILE.INDEX); }}
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
