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
import { useEffect, useState, type CSSProperties } from "react";
import { useHistory } from "react-router-dom";
import {
  carOutline,
  carSportOutline,
  chevronForwardOutline,
  giftOutline,
  mapOutline,
  logoWhatsapp,
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
    <IonPage>
      <div className="passenger-home-header">
        <div className="passenger-home-header-row">
          <div className="passenger-home-user">
            {/* width/height HTML evitan el salto de layout (FOUC) antes de que cargue el CSS */}
            <img
              src={logoRapago}
              alt="Rapa Go"
              className="passenger-home-logo"
              width={56}
              height={56}
            />

            <div className="passenger-home-user-text">
              <div className="passenger-home-greeting">Hola, {firstName}</div>
              <div className="passenger-home-question">¿A dónde quieres ir?</div>
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

              <IonButton
                expand="block"
                className="rapago-hero-cta"
                onClick={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
              >
                Solicitar Viaje
              </IonButton>
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
            <div className="passenger-home-section-eyebrow">Servicios</div>
            <h2 className="passenger-home-section-title">¿Qué necesitas?</h2>

            <div className="services-grid">
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

          <section className="passenger-home-section">
            <div className="passenger-home-section-eyebrow">Módulos</div>
            <h2 className="passenger-home-section-title">Próximamente</h2>

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
                  aria-disabled="true"
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

            <IonCard
              className="quick-access-card ion-activatable"
              button
              onClick={openWallet}
              style={{
                background: walletBalanceClp > 0
                  ? "linear-gradient(135deg,#fff7dc,#e8fff1)"
                  : undefined,
              }}
            >
              <IonCardContent className="quick-access-content">
                <IonIcon icon={walletOutline} className="quick-access-icon wallet" />
                <div>
                  <div className="quick-access-title">Wallet</div>
                  <div className="quick-access-subtitle">
                    {walletBalanceClp > 0
                      ? `Saldo a favor: ${formatWalletClp(walletBalanceClp)}`
                      : "Saldo y beneficios"}
                  </div>
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

      <a
        href={supportWhatsAppUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir Mesa de Ayuda de RAPA GO en WhatsApp"
        title="Mesa de Ayuda"
        style={{
          position: "fixed",
          right: "18px",
          bottom: "88px",
          zIndex: 1200,
          width: "62px",
          height: "62px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg,#25D366,#128C7E)",
          color: "#fff",
          border: "3px solid rgba(255,255,255,.92)",
          boxShadow: "0 14px 32px rgba(0,0,0,.32)",
          textDecoration: "none",
        }}
      >
        <IonIcon icon={logoWhatsapp} style={{ fontSize: "2rem" }} />
        <span
          style={{
            position: "absolute",
            right: 54,
            whiteSpace: "nowrap",
            padding: "7px 10px",
            borderRadius: 999,
            background: "rgba(17,17,17,.92)",
            color: "#fff",
            fontSize: ".68rem",
            fontWeight: 950,
            boxShadow: "0 8px 20px rgba(0,0,0,.22)",
          }}
        >
          Mesa de Ayuda
        </span>
      </a>
    </IonPage>
  );
}