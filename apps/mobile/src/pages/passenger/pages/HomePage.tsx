import { IonButton, IonContent, IonIcon, IonPage } from "@ionic/react";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  alertCircleOutline,
  carOutline,
  carSportOutline,
  cellularOutline,
  chevronForwardOutline,
  giftOutline,
  mapOutline,
  logoWhatsapp,
  moonOutline,
  peopleOutline,
  sparklesOutline,
  sunnyOutline,
  ticketOutline,
  walletOutline,
} from "ionicons/icons";

import { useRapagoSectionTheme } from "../../../theme/rapagoTheme.js";
import { RapagoAppBar } from "../../../components/RapagoAppBar.js";
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

/* rapanui.jpg es EL MISMO ARCHIVO que public/assets/rapa-go-bg.jpg (mismo md5),
   que es el fondo de página. Cuando abría el carrusel, la primera diapositiva
   era el mismo fotograma que el papel tapiz de detrás: se leía como un fallo de
   carga, no como una decisión. Va al final para que la entrada del Home muestre
   una imagen distinta del fondo. */
const HOME_CAROUSEL_IMAGES = [
  {
    src: rapaNuiOne,
    title: "Explora la isla",
    subtitle: "Muévete seguro por Rapa Nui",
  },
  {
    src: rapaNuiTwo,
    title: "Cultura y aventura",
    subtitle: "Conecta con la cultura y el transporte local",
  },
  {
    src: rapaNuiMain,
    title: "Rapa Nui",
    subtitle: "Viajes seguros y servicios locales",
  },
];

export default function HomePage(): JSX.Element {
  const history = useHistory();
  const isOnline = useConnectivity();
  const { session } = useAuth();
  /* Tema propio de la Home: independiente del resto de pantallas. */
  const { theme, isDark, toggleTheme } = useRapagoSectionTheme("home");

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
    /* home.css ya declara prefers-reduced-motion, pero el CSS no puede parar un
       setInterval: el carrusel seguía rotando solo cada 3,8s para quien pide
       movimiento reducido. Hay que consultarlo desde JS (WCAG 2.2.2). */
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

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

  const openWallet = () => {
    history.push(ROUTES.PASSENGER.WALLET);
  };

  const supportPhone = String(RAPAGO_CONTACT.adminPhone || "56947964171").replace(/\D/g, "");
  const supportWhatsAppUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(
    `Hola, soy ${firstName}. Necesito ayuda con la aplicación RAPA GO.`,
  )}`;

  return (
    <IonPage className="rapago-home-page" data-rapago-theme={theme}>
      {/* Barra única de la app, variante "root". Sustituye al bloque de marca
          hecho a mano que había aquí: el mismo saludo y el mismo avatar, pero
          compartidos con el Inicio del conductor y con las otras nueve
          pantallas, en vez de ser un diseño propio de esta.
          El interruptor de tema y el botón de perfil se fueron al menú de
          cuenta — un único punto de control, alcanzable desde toda la app y no
          sólo desde Inicio. */}
      <RapagoAppBar
        sectionId="home"
        variant="root"
        subtitle="¿A dónde quieres ir?"
        roleLabel="Pasajero"
        showNotifications
      />

      <IonContent className="rapago-home-content">
        <div className="rapago-home-shell">

          {/* ── Hero / carrusel ────────────────────────────────────────── */}
          <section
            className="rapago-home-hero"
            aria-roledescription="carrusel"
            aria-label="Destinos de Rapa Nui"
          >
            <img
              src={activeImage.src}
              alt={activeImage.title}
              className="rapago-home-hero-img"
            />

            <div className="rapago-home-hero-veil" />

            <div className="rapago-home-hero-dots">
              {HOME_CAROUSEL_IMAGES.map((img, index) => (
                <button
                  key={img.src}
                  type="button"
                  aria-label={`Ver imagen ${index + 1} de ${HOME_CAROUSEL_IMAGES.length}`}
                  aria-current={carouselIndex === index}
                  className={
                    carouselIndex === index
                      ? "rapago-home-hero-dot active"
                      : "rapago-home-hero-dot"
                  }
                  onClick={() => setCarouselIndex(index)}
                />
              ))}
            </div>

            <div className="rapago-home-hero-body">
              <span className="rapago-home-hero-eyebrow">
                <IonIcon icon={sparklesOutline} />
                Rapa Nui
              </span>

              <div className="rapago-home-hero-title">{activeImage.title}</div>
              <div className="rapago-home-hero-sub">{activeImage.subtitle}</div>

              <IonButton
                expand="block"
                className="rapago-home-hero-cta"
                onClick={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
              >
                <IonIcon icon={carOutline} slot="start" />
                Solicitar Viaje
              </IonButton>
            </div>
          </section>

          {/* ── Aviso: falta teléfono ──────────────────────────────────── */}
          {/* Antes este bloque se renderizaba vacío: mostraba una caja amarilla
              sin texto. Ahora dice qué falta y lleva al perfil a completarlo. */}
          {profile !== null && !hasPhone && (
            <button
              type="button"
              className="rapago-home-alert"
              onClick={goToProfile}
            >
              <IonIcon icon={alertCircleOutline} />
              <span>
                Completa tu teléfono para solicitar viajes.
                <br />
                <strong>Ir a mi perfil</strong>
              </span>
              <IonIcon
                icon={chevronForwardOutline}
                className="rapago-home-alert-arrow"
              />
            </button>
          )}

          {/* ── Aviso: sin conexión ────────────────────────────────────── */}
          {!isOnline && (
            <div className="rapago-home-alert rapago-home-alert--offline" role="alert">
              <div className="rapago-home-alert-head">
                <IonIcon icon={cellularOutline} />
                <span>
                  Modo offline — tus viajes se sincronizarán cuando recuperes conexión.
                </span>
              </div>

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
                style={{ marginTop: "10px", width: "100%" }}
              />
            </div>
          )}

          {/* ── Servicios ──────────────────────────────────────────────── */}
          <section className="rapago-home-section">
            <div className="rapago-home-section-label">Servicios</div>

            <div className="rapago-home-services">
              <ServiceCard
                icon={carOutline}
                title="VIAJES"
                subtitle="Solicita tu viaje y muévete por Rapa Nui."
                color="primary"
                featured
                onClick={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
              />

              <ServiceCard
                icon={mapOutline}
                title="TOURS EN RAPA NUI"
                subtitle="Descubre la isla junto a guías rapanui."
                color="medium"
                disabled
                badge="PRÓXIMAMENTE"
                onClick={() => {}}
              />

              <ServiceCard
                icon={carSportOutline}
                title="RENT A CAR"
                subtitle="Reserva un vehículo y recorre Rapa Nui a tu ritmo."
                color="medium"
                disabled
                badge="PRÓXIMAMENTE"
                onClick={() => {}}
              />

              <ServiceCard
                icon={ticketOutline}
                title="EVENTOS Y SERVICIOS"
                subtitle="Conecta con experiencias y servicios de Rapa Nui."
                color="medium"
                disabled
                badge="PRÓXIMAMENTE"
                onClick={() => {}}
              />
            </div>
          </section>

          {/* ── Accesos rápidos ────────────────────────────────────────── */}
          <section className="rapago-home-section">
            <div className="rapago-home-section-label">Accesos rápidos</div>

            <div className="rapago-home-quick">
              <button
                type="button"
                className="rapago-home-quick-card"
                onClick={() => history.push(ROUTES.PASSENGER.TRIPS)}
              >
                <span className="rapago-home-quick-icon">
                  <IonIcon icon={carOutline} />
                </span>
                <span>
                  <span className="rapago-home-quick-title">Mis Viajes</span>
                  <span className="rapago-home-quick-sub">Historial</span>
                </span>
              </button>

              <button
                type="button"
                className="rapago-home-quick-card"
                onClick={openWallet}
              >
                <span className="rapago-home-quick-icon">
                  <IonIcon icon={walletOutline} />
                </span>
                <span>
                  <span className="rapago-home-quick-title">Billetera</span>
                  <span className="rapago-home-quick-sub">Saldo y beneficios</span>
                </span>
              </button>
            </div>
          </section>

          {/* ── Referidos ──────────────────────────────────────────────── */}
          <button
            type="button"
            className="rapago-home-referral"
            aria-label="Ingresa tu código promocional"
            onClick={() => history.push(ROUTES.PROFILE.INDEX)}
          >
            <span className="rapago-home-referral-icon">
              <IonIcon icon={giftOutline} />
            </span>

            <span className="rapago-home-referral-body">
              <span className="rapago-home-referral-title">
                Ingresa tu código promocional
              </span>
              <span className="rapago-home-referral-sub">
                Accede a tarifas y descuentos especiales
              </span>
            </span>

            <IonIcon
              icon={chevronForwardOutline}
              className="rapago-home-referral-arrow"
            />
          </button>

          {/* ── Únete a Rapa Go ────────────────────────────────────────── */}
          <section className="rapago-home-join">
            <div className="rapago-home-join-head">
              <span className="rapago-home-join-icon">
                <IonIcon icon={peopleOutline} />
              </span>
              <div>
                <h2 className="rapago-home-join-title">
                  ¿Quieres unirte a Rapa Go?
                </h2>
                <p className="rapago-home-join-sub">
                  Postula como conductor o guía turístico de la isla.
                </p>
              </div>
            </div>

            <div className="rapago-home-join-actions">
              <IonButton
                expand="block"
                className="rapago-home-btn-primary"
                routerLink="/apply/driver"
              >
                <IonIcon icon={carOutline} slot="start" />
                Inscríbete como conductor
              </IonButton>

              {/* Deshabilitado a propósito: las postulaciones de guía todavía
                  no están abiertas. Sin routerLink no navega a ningún lado, y
                  el estilo ámbar-transparente (en vez del gris genérico que
                  usa el resto de la app para "deshabilitado") deja claro que
                  es un "todavía no", no un error. */}
              <IonButton
                expand="block"
                className="rapago-home-btn-disabled"
                disabled
                aria-label="Inscríbete como guía — Próximamente"
              >
                <IonIcon icon={mapOutline} slot="start" />
                Inscríbete como guía · Próximamente
              </IonButton>

              <IonButton
                expand="block"
                className="rapago-home-btn-outline"
                routerLink="/apply/status"
              >
                Estado de mi postulación
              </IonButton>
            </div>
          </section>
        </div>
      </IonContent>

      <a
        href={supportWhatsAppUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir Mesa de Ayuda de RAPA GO en WhatsApp"
        title="Mesa de Ayuda"
        className="rapago-home-wa"
      >
        <IonIcon icon={logoWhatsapp} />
        <span className="rapago-home-wa-label">Mesa de Ayuda</span>
      </a>
    </IonPage>
  );
}
