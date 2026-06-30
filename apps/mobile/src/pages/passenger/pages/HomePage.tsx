import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonPage,
  IonText,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  carOutline,
  carSportOutline,
  chevronForwardOutline,
  giftOutline,
  mapOutline,
  newspaperOutline,
  ticketOutline,
  walletOutline,
} from "ionicons/icons";

import { ServiceCard } from "../../../components/ServiceCard.js";
import { WhatsAppButton } from "../../../components/WhatsAppButton.js";
import {
  passengerProfileService,
  type PassengerProfileData,
} from "../../../features/passengers/passengerProfile.service.js";
import { useConnectivity } from "../../../hooks/useConnectivity.js";
import { ROUTES } from "../../../navigation/routes.js";
import { useAuth } from "../../../features/auth/index.js";
import { RAPAGO_CONTACT, WA_MESSAGES } from "@rapa-go/shared";

import rapaNuiMain from "../../../theme/img/rapanui.jpg";
import rapaNuiOne from "../../../theme/img/imgen-rapuni1.jpeg";
import rapaNuiTwo from "../../../theme/img/imgen-rapanui2.jpeg";
import logoRapago from "../../../theme/img/logo-rapago.jpeg";

const HOME_CAROUSEL_IMAGES = [
  {
    src: rapaNuiMain,
    title: "Rapa Nui",
    subtitle: "Viajes, tours y experiencias locales",
  },
  {
    src: rapaNuiOne,
    title: "Explora la isla",
    subtitle: "Muévete seguro por Rapa Nui",
  },
  {
    src: rapaNuiTwo,
    title: "Cultura y aventura",
    subtitle: "Conecta con guías y conductores locales",
  },
];

const RAPA_NUI_NEWS = [
  {
    title: "Noticias y avisos locales",
    subtitle: "Información útil para moverte mejor por Hanga Roa y sectores turísticos.",
    tag: "Actualidad",
    icon: newspaperOutline,
    route: ROUTES.PASSENGER.EVENTS,
  },
  {
    title: "Actividades culturales",
    subtitle: "Revisa eventos, experiencias y panoramas disponibles en Rapa Nui.",
    tag: "Cultura",
    icon: ticketOutline,
    route: ROUTES.PASSENGER.EVENTS,
  },
  {
    title: "Consejos para visitantes",
    subtitle: "Planifica tus traslados con anticipación y respeta los espacios patrimoniales.",
    tag: "Turismo",
    icon: mapOutline,
    route: ROUTES.PASSENGER.GUIDES,
  },
];

export default function HomePage(): JSX.Element {
  const history = useHistory();
  const isOnline = useConnectivity();
  const { session } = useAuth();

  const [profile, setProfile] = useState<PassengerProfileData | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if (!session?.accessToken) return;

    void passengerProfileService
      .getMyProfile(session.accessToken)
      .then(setProfile)
      .catch(() => {});
  }, [session?.accessToken]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCarouselIndex((current) =>
        current === HOME_CAROUSEL_IMAGES.length - 1 ? 0 : current + 1,
      );
    }, 3800);

    return () => window.clearInterval(interval);
  }, []);

  const name = session?.user?.name ?? "";
  const firstName = name.split(" ")[0] || "pasajero";

  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((p: string) => p[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "P";

  const hasPhone = !!profile?.phone;
  const activeImage = HOME_CAROUSEL_IMAGES[carouselIndex];

  const goToProfile = () => {
    history.push(ROUTES.PASSENGER.PROFILE);
  };

  return (
    <IonPage>
      <div className="passenger-home-header">
        <div className="passenger-home-header-row">
          <div className="passenger-home-user">
            <img src={logoRapago} alt="Rapa Go" className="passenger-home-logo" />

            <div className="passenger-home-user-text">
              <div className="passenger-home-greeting">Hola, {firstName} 👋</div>
              <div className="passenger-home-question">¿A dónde vamos hoy?</div>
            </div>
          </div>

          <div
            className="profile-top-button"
            role="button"
            tabIndex={0}
            aria-label="Ir al perfil"
            onClick={goToProfile}
            onKeyDown={(e) => {
              if (e.key === "Enter") goToProfile();
            }}
          >
            <div className="profile-top-avatar">{initials}</div>
            <span className="profile-top-text">Perfil</span>
          </div>
        </div>
      </div>

      <IonContent>
        <div className="passenger-home-content">
          <section className="home-image-carousel">
            <img
              src={activeImage.src}
              alt={activeImage.title}
              className="home-image-carousel-img"
            />

            <div className="home-image-carousel-overlay" />

            <div className="home-image-carousel-text">
              <div className="home-image-carousel-title">{activeImage.title}</div>
              <div className="home-image-carousel-subtitle">
                {activeImage.subtitle}
              </div>
            </div>

            <div className="home-image-carousel-dots">
              {HOME_CAROUSEL_IMAGES.map((img, index) => (
                <button
                  key={img.src}
                  type="button"
                  aria-label={`Ver imagen ${index + 1}`}
                  className={
                    carouselIndex === index
                      ? "home-image-carousel-dot active"
                      : "home-image-carousel-dot"
                  }
                  onClick={() => setCarouselIndex(index)}
                />
              ))}
            </div>
          </section>

          {profile !== null && !hasPhone && (
            <div className="passenger-warning-box">
              <IonText>
                <p className="passenger-warning-text">
               
                </p>
              </IonText>
            </div>
          )}

          {!isOnline && (
            <div className="passenger-warning-box" role="alert">
              <IonText>
                <p className="passenger-warning-text">
                  Modo offline — tus viajes se sincronizarán cuando recuperes conexión.
                </p>
              </IonText>

              <WhatsAppButton
                phone={RAPAGO_CONTACT.adminPhone}
                message={WA_MESSAGES.passengerToAdmin({
                  origin: "mi ubicación",
                  destination: "mi destino",
                  name: "pasajero",
                })}
                label="Contactar operador"
                size="small"
                fill="solid"
                style={{ marginTop: "12px" }}
              />
            </div>
          )}

          <section className="passenger-home-section">
            <h2 className="passenger-home-section-title">Servicios</h2>

            <div className="services-grid">
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
          </section>

          <section className="passenger-home-section">
            <h2 className="passenger-home-section-title">Noticias de Rapa Nui</h2>

            <div
              style={{
                display: "flex",
                gap: "12px",
                overflowX: "auto",
                padding: "2px 2px 8px",
                scrollSnapType: "x mandatory",
              }}
            >
              {RAPA_NUI_NEWS.map((news) => (
                <IonCard
                  key={news.title}
                  button
                  className="ion-activatable"
                  onClick={() => history.push(news.route)}
                  style={{
                    minWidth: "255px",
                    maxWidth: "280px",
                    margin: 0,
                    borderRadius: "22px",
                    background: "linear-gradient(135deg, rgba(255,255,255,.96), rgba(244,226,185,.96))",
                    color: "#181818",
                    boxShadow: "0 14px 28px rgba(0,0,0,.18)",
                    scrollSnapAlign: "start",
                  }}
                >
                  <IonCardContent
                    style={{
                      padding: "16px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "16px",
                        background: "linear-gradient(135deg,#C89B3C,#F3D891)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: "0 10px 22px rgba(200,155,60,.28)",
                      }}
                    >
                      <IonIcon
                        icon={news.icon}
                        style={{ fontSize: "1.35rem", color: "#111" }}
                      />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: ".68rem",
                          fontWeight: 950,
                          letterSpacing: ".05em",
                          textTransform: "uppercase",
                          color: "#9A6A16",
                          marginBottom: "5px",
                        }}
                      >
                        {news.tag}
                      </div>

                      <div
                        style={{
                          fontSize: ".92rem",
                          fontWeight: 950,
                          lineHeight: 1.15,
                          color: "#151515",
                        }}
                      >
                        {news.title}
                      </div>

                      <div
                        style={{
                          marginTop: "6px",
                          fontSize: ".74rem",
                          lineHeight: 1.35,
                          color: "rgba(20,20,20,.68)",
                        }}
                      >
                        {news.subtitle}
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </div>
          </section>

          <div className="quick-access-grid">
            <IonCard className="quick-access-card ion-activatable" routerLink={ROUTES.PASSENGER.TRIPS}>
              <IonCardContent className="quick-access-content">
                <IonIcon icon={carOutline} className="quick-access-icon trips" />
                <div>
                  <div className="quick-access-title">Mis Viajes</div>
                  <div className="quick-access-subtitle">Historial</div>
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard className="quick-access-card ion-activatable" routerLink={ROUTES.PASSENGER.WALLET}>
              <IonCardContent className="quick-access-content">
                <IonIcon icon={walletOutline} className="quick-access-icon wallet" />
                <div>
                  <div className="quick-access-title">Wallet</div>
                  <div className="quick-access-subtitle">Saldo y pagos</div>
                </div>
              </IonCardContent>
            </IonCard>
          </div>

          <div
            className="referral-banner"
            role="button"
            tabIndex={0}
            aria-label="Banner referidos: invita amigos y gana crédito"
            onClick={() => history.push(ROUTES.PROFILE.INDEX)}
            onKeyDown={(e) => {
              if (e.key === "Enter") history.push(ROUTES.PROFILE.INDEX);
            }}
          >
            <IonIcon icon={giftOutline} className="referral-icon" />

            <div className="referral-content">
              <div className="referral-title">Invita amigos y gana</div>
              <div className="referral-subtitle">
                Comparte tu código y obtén descuentos en tus próximos viajes
              </div>
            </div>

            <IonIcon icon={chevronForwardOutline} className="referral-arrow" />
          </div>

          <IonCard className="join-card">
            <IonCardHeader>
              <IonCardTitle className="join-card-title">
                ¿Quieres unirte a Rapa Go?
              </IonCardTitle>
            </IonCardHeader>

            <IonCardContent>
              <IonButton expand="block" routerLink="/apply/driver" color="primary">
                Inscríbete como conductor
              </IonButton>

              <IonButton
                expand="block"
                routerLink="/apply/guide"
                color="secondary"
                className="join-card-button"
              >
                Inscríbete como guía
              </IonButton>

              <IonButton
                expand="block"
                fill="outline"
                routerLink="/apply/status"
                color="medium"
                className="join-card-button"
              >
                Estado de mi postulación
              </IonButton>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
}