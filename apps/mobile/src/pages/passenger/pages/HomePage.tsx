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
  newspaperOutline,
  peopleOutline,
  sparklesOutline,
  sunnyOutline,
  ticketOutline,
  walletOutline,
} from "ionicons/icons";

import { useRapagoSectionTheme } from "../../../theme/rapagoTheme.js";
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
    subtitle: "Viajes seguros y servicios locales",
  },
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
];

const RAPA_NUI_NEWS = [
  {
    title: "Noticias y avisos locales",
    subtitle: "Próximamente: avisos oficiales, horarios y recomendaciones para moverte mejor en Rapa Nui.",
    tag: "Próximamente",
    icon: newspaperOutline,
  },
  {
    title: "Actividades culturales",
    subtitle: "Próximamente: eventos, panoramas y experiencias culturales dentro de Rapa Go.",
    tag: "Próximamente",
    icon: ticketOutline,
  },
  {
    title: "Turismo local",
    subtitle: "Próximamente: guías locales, rutas turísticas y experiencias protegidas por la plataforma.",
    tag: "Próximamente",
    icon: mapOutline,
  },
];

const RAPAGO_WALLET_BALANCE_KEY = "rapago_wallet_balance_clp_v1";
const RAPAGO_WALLET_APPLIED_BENEFITS_KEY = "rapago_wallet_applied_benefits_v1";
const RAPAGO_WALLET_EVENT = "rapago:wallet-balance-updated";

const RAPAGO_WALLET_BENEFIT_SOURCE_KEYS = [
  "rapago_admin_wallet_benefit_requests_v1",
  "rapago_admin_wallet_credits_v1",
  "rapago_wallet_pending_benefits_v1",
  "rapago_passenger_wallet_benefits_v1",
  "rapago_admin_passenger_credit_adjustments_v1",
] as const;

type WalletBenefitRecord = Record<string, unknown>;

function getHomeUserStringField(user: unknown, key: string): string {
  if (!user || typeof user !== "object") return "";
  const value = (user as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWalletIdentity(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function getPassengerWalletIdentityKeys(user: unknown): string[] {
  const keys = [
    getHomeUserStringField(user, "id"),
    getHomeUserStringField(user, "userId"),
    getHomeUserStringField(user, "email"),
    getHomeUserStringField(user, "phone"),
    getHomeUserStringField(user, "phoneNumber"),
  ]
    .map(normalizeWalletIdentity)
    .filter(Boolean);

  try {
    const stored = localStorage.getItem("rapago_registration_profile");
    const parsed = stored ? (JSON.parse(stored) as Record<string, unknown>) : {};
    keys.push(
      normalizeWalletIdentity(parsed.id),
      normalizeWalletIdentity(parsed.userId),
      normalizeWalletIdentity(parsed.email),
      normalizeWalletIdentity(parsed.phone),
      normalizeWalletIdentity(localStorage.getItem("rapago_profile_phone")),
      normalizeWalletIdentity(localStorage.getItem("rapago_passenger_email")),
    );
  } catch {
    // No bloquea el saldo local.
  }

  return Array.from(new Set(keys.filter(Boolean)));
}

function walletBenefitMatchesPassenger(
  record: WalletBenefitRecord,
  user: unknown,
): boolean {
  const userKeys = getPassengerWalletIdentityKeys(user);
  if (userKeys.length === 0) return true;

  const recordKeys = [
    record.passengerId,
    record.passengerUserId,
    record.userId,
    record.user_id,
    record.email,
    record.passengerEmail,
    record.passengerPhone,
    record.phone,
    record.phoneNumber,
  ]
    .map(normalizeWalletIdentity)
    .filter(Boolean);

  if (recordKeys.length === 0) return true;

  return recordKeys.some((key) => userKeys.includes(key));
}

function readWalletAppliedBenefitIds(): Set<string> {
  try {
    const raw = localStorage.getItem(RAPAGO_WALLET_APPLIED_BENEFITS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveWalletAppliedBenefitIds(ids: Set<string>): void {
  try {
    localStorage.setItem(
      RAPAGO_WALLET_APPLIED_BENEFITS_KEY,
      JSON.stringify(Array.from(ids).slice(-500)),
    );
  } catch {
    // No bloquea.
  }
}

function readPassengerWalletBalance(): number {
  try {
    const value = Number(localStorage.getItem(RAPAGO_WALLET_BALANCE_KEY));
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  } catch {
    return 0;
  }
}

function writePassengerWalletBalance(value: number): void {
  try {
    const safeValue = Math.max(0, Math.round(value));
    localStorage.setItem(RAPAGO_WALLET_BALANCE_KEY, String(safeValue));
    localStorage.setItem("rapago_passenger_wallet_balance_clp", String(safeValue));
    localStorage.setItem("rapago_wallet_available_balance_clp", String(safeValue));

    window.dispatchEvent(
      new CustomEvent(RAPAGO_WALLET_EVENT, {
        detail: { balanceClp: safeValue },
      }),
    );
  } catch {
    // No bloquea la app.
  }
}

function normalizeWalletBenefitStatus(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function walletBenefitIsApproved(record: WalletBenefitRecord): boolean {
  const status = normalizeWalletBenefitStatus(
    record.status ??
      record.adminStatus ??
      record.approvalStatus ??
      record.walletStatus,
  );

  return (
    status === "approved" ||
    status === "aprobado" ||
    status === "approved_by_admin" ||
    status === "wallet_approved" ||
    status === "credit_approved" ||
    status === "ready_to_credit"
  );
}

function readWalletBenefitAmount(record: WalletBenefitRecord): number {
  const candidates = [
    record.amountClp,
    record.creditClp,
    record.benefitClp,
    record.refundClp,
    record.balanceClp,
    record.walletCreditClp,
    record.extraPaidClp,
  ];

  for (const value of candidates) {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount > 0) return Math.round(amount);
  }

  return 0;
}

function readWalletBenefitId(record: WalletBenefitRecord, fallbackIndex: number): string {
  const raw = String(
    record.id ??
      record.benefitId ??
      record.creditId ??
      record.rideId ??
      record.paymentId ??
      "",
  ).trim();

  if (raw) return raw;

  return [
    normalizeWalletIdentity(record.passengerEmail),
    normalizeWalletIdentity(record.passengerPhone),
    readWalletBenefitAmount(record),
    normalizeWalletIdentity(record.reason),
    fallbackIndex,
  ].join("|");
}

function readWalletBenefitRecordsFromStorage(): WalletBenefitRecord[] {
  const records: WalletBenefitRecord[] = [];

  for (const key of RAPAGO_WALLET_BENEFIT_SOURCE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;

      if (Array.isArray(parsed)) {
        records.push(...parsed.filter((item): item is WalletBenefitRecord => Boolean(item && typeof item === "object")));
        continue;
      }

      if (parsed && typeof parsed === "object") {
        for (const value of Object.values(parsed as Record<string, unknown>)) {
          if (Array.isArray(value)) {
            records.push(
              ...value.filter((item): item is WalletBenefitRecord => Boolean(item && typeof item === "object")),
            );
          } else if (value && typeof value === "object") {
            records.push(value as WalletBenefitRecord);
          }
        }
      }
    } catch {
      // Ignora datos locales dañados.
    }
  }

  return records;
}

function syncApprovedWalletBenefits(user: unknown): number {
  const appliedIds = readWalletAppliedBenefitIds();
  const records = readWalletBenefitRecordsFromStorage();
  let balance = readPassengerWalletBalance();
  let changed = false;

  records.forEach((record, index) => {
    if (!walletBenefitIsApproved(record)) return;
    if (!walletBenefitMatchesPassenger(record, user)) return;

    const amount = readWalletBenefitAmount(record);
    if (amount <= 0) return;

    const id = readWalletBenefitId(record, index);
    if (appliedIds.has(id)) return;

    balance += amount;
    appliedIds.add(id);
    changed = true;
  });

  if (changed) {
    writePassengerWalletBalance(balance);
    saveWalletAppliedBenefitIds(appliedIds);
  }

  return balance;
}

function formatWalletClp(value: number): string {
  return `$${Math.max(0, Math.round(value)).toLocaleString("es-CL")} CLP`;
}

export default function HomePage(): JSX.Element {
  const history = useHistory();
  const isOnline = useConnectivity();
  const { session } = useAuth();
  /* Tema propio de la Home: independiente del resto de pantallas. */
  const { theme, isDark, toggleTheme } = useRapagoSectionTheme("home");

  const [profile, setProfile] = useState<PassengerProfileData | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [walletBalanceClp, setWalletBalanceClp] = useState(() =>
    syncApprovedWalletBenefits(session?.user),
  );

  useEffect(() => {
    if (!session?.accessToken) return;

    void passengerProfileService
      .getMyProfile(session.accessToken)
      .then(setProfile)
      .catch(() => {});
  }, [session?.accessToken]);

  useEffect(() => {
    const refreshWalletBalance = () => {
      setWalletBalanceClp(syncApprovedWalletBenefits(session?.user));
    };

    refreshWalletBalance();

    window.addEventListener("storage", refreshWalletBalance);
    window.addEventListener("focus", refreshWalletBalance);
    window.addEventListener(RAPAGO_WALLET_EVENT, refreshWalletBalance as EventListener);
    window.addEventListener("rapago:admin-wallet-benefit-approved", refreshWalletBalance as EventListener);
    window.addEventListener("rapago:wallet-benefit-approved", refreshWalletBalance as EventListener);

    return () => {
      window.removeEventListener("storage", refreshWalletBalance);
      window.removeEventListener("focus", refreshWalletBalance);
      window.removeEventListener(RAPAGO_WALLET_EVENT, refreshWalletBalance as EventListener);
      window.removeEventListener("rapago:admin-wallet-benefit-approved", refreshWalletBalance as EventListener);
      window.removeEventListener("rapago:wallet-benefit-approved", refreshWalletBalance as EventListener);
    };
  }, [session?.user]);

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

  const openWallet = () => {
    setWalletBalanceClp(syncApprovedWalletBenefits(session?.user));
    history.push(ROUTES.PASSENGER.WALLET);
  };

  const supportPhone = String(RAPAGO_CONTACT.adminPhone || "56947964171").replace(/\D/g, "");
  const supportWhatsAppUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(
    `Hola, soy ${firstName}. Necesito ayuda con la aplicación RAPA GO.`,
  )}`;

  return (
    <IonPage className="rapago-home-page" data-rapago-theme={theme}>
      {/* Header transparente sobre el fondo, igual que el Login y el perfil.
          No usa ion-header para evitar la barra volcánica sólida que
          global.css impone a ese elemento. */}
      <div className="rapago-home-header">
        <div className="rapago-home-brand">
          {/* width/height HTML evitan el salto de layout (FOUC) antes de que cargue el CSS */}
          <img
            src={logoRapago}
            alt="Rapa Go"
            className="rapago-home-logo"
            width={50}
            height={50}
          />

          <div style={{ minWidth: 0 }}>
            <div className="rapago-home-greeting">Hola, {firstName}</div>
            <div className="rapago-home-question">¿A dónde quieres ir?</div>
          </div>
        </div>

        <div className="rapago-home-header-actions">
          <button
            type="button"
            className="rapago-home-theme-btn"
            onClick={toggleTheme}
            aria-label={isDark ? "Activar modo día" : "Activar modo nocturno"}
            title={isDark ? "Modo día" : "Modo nocturno"}
          >
            <IonIcon icon={isDark ? sunnyOutline : moonOutline} />
          </button>

          <button
            type="button"
            className="rapago-home-avatar-btn"
            onClick={goToProfile}
            aria-label="Ir al perfil"
          >
            <span className="rapago-home-avatar">{initials}</span>
            <span className="rapago-home-avatar-text">Perfil</span>
          </button>
        </div>
      </div>

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
                title="Viaje"
                subtitle="Solicitar ahora"
                color="primary"
                featured
                onClick={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
              />

              <ServiceCard
                icon={mapOutline}
                title="Turismo local"
                subtitle="Guías y tours"
                color="medium"
                disabled
                badge="Pronto"
                onClick={() => {}}
              />

              <ServiceCard
                icon={carSportOutline}
                title="Reserva vehículo"
                subtitle="Arriendos"
                color="medium"
                disabled
                badge="Pronto"
                onClick={() => {}}
              />

              <ServiceCard
                icon={ticketOutline}
                title="Eventos"
                subtitle="Cultura"
                color="medium"
                disabled
                badge="Pronto"
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
                className={
                  walletBalanceClp > 0
                    ? "rapago-home-quick-card rapago-home-quick-card--highlight"
                    : "rapago-home-quick-card"
                }
                onClick={openWallet}
              >
                <span className="rapago-home-quick-icon">
                  <IonIcon icon={walletOutline} />
                </span>
                <span>
                  <span className="rapago-home-quick-title">Wallet</span>
                  <span className="rapago-home-quick-sub">
                    {walletBalanceClp > 0
                      ? `Saldo a favor: ${formatWalletClp(walletBalanceClp)}`
                      : "Saldo y beneficios"}
                  </span>
                </span>
              </button>
            </div>
          </section>

          {/* ── Próximamente ───────────────────────────────────────────── */}
          <section className="rapago-home-section">
            <div className="rapago-home-section-label">Próximamente</div>

            <div className="rapago-home-news">
              {RAPA_NUI_NEWS.map((news) => (
                <article
                  key={news.title}
                  className="rapago-home-news-card"
                  aria-disabled="true"
                >
                  <span className="rapago-home-news-icon">
                    <IonIcon icon={news.icon} />
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <div className="rapago-home-news-tag">{news.tag}</div>
                    <div className="rapago-home-news-title">{news.title}</div>
                    <div className="rapago-home-news-sub">{news.subtitle}</div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ── Referidos ──────────────────────────────────────────────── */}
          <button
            type="button"
            className="rapago-home-referral"
            aria-label="Invita amigos y gana crédito"
            onClick={() => history.push(ROUTES.PROFILE.INDEX)}
          >
            <span className="rapago-home-referral-icon">
              <IonIcon icon={giftOutline} />
            </span>

            <span className="rapago-home-referral-body">
              <span className="rapago-home-referral-title">
                Invita amigos y gana
              </span>
              <span className="rapago-home-referral-sub">
                Comparte tu código y obtén descuentos en tus próximos viajes
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

              <IonButton
                expand="block"
                className="rapago-home-btn-outline"
                routerLink="/apply/guide"
              >
                <IonIcon icon={mapOutline} slot="start" />
                Inscríbete como guía
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
