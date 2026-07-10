import {
  IonBadge,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useState, useCallback, useEffect, type CSSProperties } from "react";
import {
  walletOutline,
  giftOutline,
  timeOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
} from "ionicons/icons";
import { SkeletonList } from "../../../components/SkeletonCard.js";
import { useAuth } from "../../../features/auth/index.js";
import type { WalletData } from "../../../features/wallet/wallet.service.js";

const RAPAGO_WALLET_BENEFITS_KEY = "rapago_wallet_benefits_v1";
const RAPAGO_WALLET_BENEFIT_EVENT = "rapago:wallet-benefit-updated";

const WALLET_BG =
  "linear-gradient(180deg, rgba(14,12,10,.92), rgba(14,12,10,.96)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat";

const GOLD_GRADIENT = "linear-gradient(135deg,#D6A83E 0%,#B7791F 45%,#7A351F 100%)";
const SAND_GRADIENT = "linear-gradient(135deg,#FFF7E6 0%,#F7E4BA 100%)";

type LocalWalletBenefit = {
  id: string;
  rideId?: string | null;
  passengerEmail?: string | null;
  ownerKey?: string | null;
  amountClp: number;
  status: "pending_admin" | "available" | "used" | "rejected" | string;
  source?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  adminReviewStatus?: string | null;
  fareClp?: number | null;
  paidClp?: number | null;
};

function formatWalletClp(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "$0 CLP";
  return `$${Math.max(0, Math.round(amount)).toLocaleString("es-CL")} CLP`;
}

function normalizeWalletEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function getWalletSessionEmail(user: unknown): string {
  if (!user || typeof user !== "object") return "";
  return normalizeWalletEmail((user as Record<string, unknown>).email);
}

function readLocalWalletBenefits(user: unknown): LocalWalletBenefit[] {
  try {
    const sessionEmail = getWalletSessionEmail(user);
    const raw = localStorage.getItem(RAPAGO_WALLET_BENEFITS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index): LocalWalletBenefit => ({
        id: String(item.id ?? `wallet-benefit-${index}`),
        rideId: typeof item.rideId === "string" ? item.rideId : null,
        passengerEmail: typeof item.passengerEmail === "string" ? item.passengerEmail : null,
        ownerKey: typeof item.ownerKey === "string" ? item.ownerKey : null,
        amountClp: Math.max(0, Math.round(Number(item.amountClp ?? item.amount ?? 0))),
        status: String(item.status ?? "pending_admin"),
        source: typeof item.source === "string" ? item.source : null,
        title: typeof item.title === "string" ? item.title : null,
        description: typeof item.description === "string" ? item.description : null,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
        approvedAt: typeof item.approvedAt === "string" ? item.approvedAt : null,
        approvedBy: typeof item.approvedBy === "string" ? item.approvedBy : null,
        adminReviewStatus: typeof item.adminReviewStatus === "string" ? item.adminReviewStatus : null,
        fareClp: Number.isFinite(Number(item.fareClp)) ? Math.round(Number(item.fareClp)) : null,
        paidClp: Number.isFinite(Number(item.paidClp)) ? Math.round(Number(item.paidClp)) : null,
      }))
      .filter((benefit) => {
        if (benefit.amountClp <= 0) return false;
        const owner = normalizeWalletEmail(benefit.passengerEmail || benefit.ownerKey);
        return !sessionEmail || !owner || owner === sessionEmail;
      })
      .sort(
        (a, b) =>
          new Date(String(b.createdAt ?? b.approvedAt ?? 0)).getTime() -
          new Date(String(a.createdAt ?? a.approvedAt ?? 0)).getTime(),
      );
  } catch {
    return [];
  }
}

function isWalletBenefitAvailable(benefit: LocalWalletBenefit): boolean {
  const status = String(benefit.status ?? "").toLowerCase();
  const adminStatus = String(benefit.adminReviewStatus ?? "").toLowerCase();
  return status === "available" || status === "approved" || adminStatus === "admin_approved";
}

function isWalletBenefitPending(benefit: LocalWalletBenefit): boolean {
  const status = String(benefit.status ?? "").toLowerCase();
  const adminStatus = String(benefit.adminReviewStatus ?? "").toLowerCase();
  return status === "pending_admin" || adminStatus === "pending_admin";
}

function walletCardStyle(extra?: CSSProperties): CSSProperties {
  return {
    margin: "0 0 14px",
    borderRadius: 26,
    overflow: "hidden",
    background: "rgba(246,242,236,.98)",
    color: "#111",
    border: "1px solid rgba(214,168,62,.26)",
    boxShadow: "0 18px 42px rgba(0,0,0,.26)",
    ...extra,
  };
}

function MiniStatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: "green" | "gold";
}): JSX.Element {
  const colors = {
    green: {
      bg: "linear-gradient(135deg,#EAFBF0,#D8F7E2)",
      iconBg: "rgba(34,197,94,.16)",
      iconColor: "#15803D",
      value: "#166534",
    },
    gold: {
      bg: "linear-gradient(135deg,#FFF7D6,#F7E4BA)",
      iconBg: "rgba(214,168,62,.22)",
      iconColor: "#8A5A12",
      value: "#7A4E10",
    },
  }[tone];

  return (
    <div
      style={{
        padding: "14px 13px",
        borderRadius: 22,
        background: colors.bg,
        border: "1px solid rgba(214,168,62,.22)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 15,
          background: colors.iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.iconColor,
          marginBottom: 10,
        }}
      >
        <IonIcon icon={icon} style={{ fontSize: 22 }} />
      </div>

      <div
        style={{
          fontSize: ".68rem",
          fontWeight: 950,
          textTransform: "uppercase",
          letterSpacing: ".035em",
          color: "#6B5A3E",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: ".98rem",
          fontWeight: 950,
          color: colors.value,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function WalletPage(): JSX.Element {
  const { session } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [localBenefits, setLocalBenefits] = useState<LocalWalletBenefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshLocalBenefits = useCallback(() => {
    setLocalBenefits(readLocalWalletBenefits(session?.user));
  }, [session?.user]);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setLoadError(null);

    try {
      const { walletService } = await import("../../../features/wallet/wallet.service.js");
      const walletResponse = await walletService.getMyWallet(session.accessToken);

      setWallet(walletResponse);
      setLocalBenefits(readLocalWalletBenefits(session.user));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo sincronizar la billetera. Mostrando beneficios locales.");
      setLocalBenefits(readLocalWalletBenefits(session.user));
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, session?.user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    refreshLocalBenefits();

    const refresh = () => refreshLocalBenefits();
    window.addEventListener("storage", refresh);
    window.addEventListener("rapago:wallet-updated", refresh as EventListener);
    window.addEventListener(RAPAGO_WALLET_BENEFIT_EVENT, refresh as EventListener);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("rapago:wallet-updated", refresh as EventListener);
      window.removeEventListener(RAPAGO_WALLET_BENEFIT_EVENT, refresh as EventListener);
    };
  }, [refreshLocalBenefits]);

  const approvedBenefits = localBenefits.filter(isWalletBenefitAvailable);
  const pendingBenefits = localBenefits.filter(isWalletBenefitPending);

  const approvedBenefitClp = approvedBenefits.reduce((sum, benefit) => sum + benefit.amountClp, 0);
  const pendingBenefitClp = pendingBenefits.reduce((sum, benefit) => sum + benefit.amountClp, 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar
          style={
            {
              "--background": GOLD_GRADIENT,
              "--color": "#fff",
              "--min-height": "72px",
              "--border-width": "0",
            } as CSSProperties
          }
        >
          <IonTitle style={{ fontWeight: 950 }}>Mi Billetera</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ "--background": WALLET_BG } as CSSProperties}>
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => {
            void load().then(() => event.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        {loading && <SkeletonList count={3} height="74px" />}

        {!loading && (
          <div style={{ maxWidth: 620, margin: "0 auto", paddingBottom: 96 }}>
            {loadError && (
              <IonCard
                style={walletCardStyle({
                  background: "#FFF7D6",
                  border: "1px solid rgba(214,168,62,.55)",
                })}
              >
                <IonCardContent style={{ padding: "12px 14px", display: "flex", gap: 10 }}>
                  <IonIcon icon={alertCircleOutline} style={{ fontSize: 22, color: "#B7791F", flexShrink: 0 }} />
                  <IonText>
                    <p style={{ margin: 0, color: "#5A3515", fontWeight: 850, fontSize: ".82rem", lineHeight: 1.35 }}>
                      {loadError}
                    </p>
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

            <section
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 34,
                padding: "24px 20px 22px",
                marginBottom: 14,
                background: GOLD_GRADIENT,
                color: "#fff",
                boxShadow: "0 24px 70px rgba(0,0,0,.42)",
                border: "1px solid rgba(255,255,255,.14)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: -58,
                  top: -70,
                  width: 190,
                  height: 190,
                  borderRadius: 999,
                  background: "rgba(255,255,255,.16)",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  left: -45,
                  bottom: -65,
                  width: 150,
                  height: 150,
                  borderRadius: 999,
                  background: "rgba(0,0,0,.13)",
                }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: ".78rem", fontWeight: 900, color: "rgba(255,255,255,.78)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                      Beneficio aprobado por admin
                    </div>

                    <div style={{ marginTop: 8, fontSize: "2.55rem", fontWeight: 950, lineHeight: 1, letterSpacing: "-1.5px" }}>
                      {formatWalletClp(approvedBenefitClp).replace(" CLP", "")}
                      <span style={{ fontSize: "1rem", marginLeft: 6, opacity: .86 }}>CLP</span>
                    </div>

                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <IonBadge color={wallet?.status === "active" ? "success" : "medium"} style={{ fontSize: ".70rem", fontWeight: 950, padding: "7px 10px" }}>
                        {wallet?.status === "active" ? "✓ Billetera activa" : wallet?.status ?? "Billetera activa"}
                      </IonBadge>

                      <IonBadge color="success" style={{ fontSize: ".70rem", fontWeight: 950, padding: "7px 10px" }}>
                        Descuento automático
                      </IonBadge>
                    </div>
                  </div>

                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 24,
                      background: "rgba(255,255,255,.18)",
                      border: "1px solid rgba(255,255,255,.28)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backdropFilter: "blur(8px)",
                      flexShrink: 0,
                    }}
                  >
                    <IonIcon icon={walletOutline} style={{ fontSize: 36 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 22 }}>
                  <MiniStatCard icon={giftOutline} label="Beneficios" value={formatWalletClp(approvedBenefitClp)} tone="green" />
                  <MiniStatCard icon={timeOutline} label="Pendiente admin" value={formatWalletClp(pendingBenefitClp)} tone="gold" />
                </div>
              </div>
            </section>

            <IonCard style={walletCardStyle({ background: SAND_GRADIENT })}>
              <IonCardContent style={{ padding: 16 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 19,
                      background: approvedBenefitClp > 0 ? "rgba(34,197,94,.15)" : "rgba(214,168,62,.18)",
                      color: approvedBenefitClp > 0 ? "#15803D" : "#B7791F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: 29 }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 950, fontSize: "1rem" }}>
                          A favor para próximo viaje
                        </div>
                        <div style={{ marginTop: 4, color: "#4B3B28", fontSize: ".82rem", fontWeight: 760, lineHeight: 1.38 }}>
                          El monto aprobado por administración se descontará automáticamente en tu próximo viaje Rapa Go.
                        </div>
                      </div>

                      <IonBadge color={approvedBenefitClp > 0 ? "success" : pendingBenefitClp > 0 ? "warning" : "medium"} style={{ fontWeight: 950, flexShrink: 0 }}>
                        {approvedBenefitClp > 0 ? "Aprobado admin" : pendingBenefitClp > 0 ? "Pendiente admin" : "Sin saldo"}
                      </IonBadge>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 18,
                          background: "rgba(34,197,94,.12)",
                          border: "1px solid rgba(34,197,94,.22)",
                        }}
                      >
                        <div style={{ color: "#166534", fontSize: ".70rem", fontWeight: 950, textTransform: "uppercase" }}>
                          A favor
                        </div>
                        <div style={{ marginTop: 4, color: "#166534", fontSize: "1.05rem", fontWeight: 950 }}>
                          {formatWalletClp(approvedBenefitClp)}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: 12,
                          borderRadius: 18,
                          background: "rgba(255,196,9,.16)",
                          border: "1px solid rgba(214,168,62,.26)",
                        }}
                      >
                        <div style={{ color: "#7A4E10", fontSize: ".70rem", fontWeight: 950, textTransform: "uppercase" }}>
                          Pendiente
                        </div>
                        <div style={{ marginTop: 4, color: "#7A4E10", fontSize: "1.05rem", fontWeight: 950 }}>
                          {formatWalletClp(pendingBenefitClp)}
                        </div>
                      </div>
                    </div>

                    {pendingBenefitClp > 0 && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 11,
                          borderRadius: 16,
                          background: "rgba(255,196,9,.16)",
                          border: "1px solid rgba(214,168,62,.26)",
                          color: "#5A3515",
                          fontSize: ".78rem",
                          fontWeight: 850,
                          lineHeight: 1.35,
                        }}
                      >
                        Tienes {formatWalletClp(pendingBenefitClp)} esperando aprobación del administrador.
                      </div>
                    )}
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <IonSpinner name="crescent" />
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
