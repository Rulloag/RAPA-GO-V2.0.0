import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonNote,
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
  shieldCheckmarkOutline,
  cashOutline,
  cardOutline,
  refreshOutline,
  timeOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
} from "ionicons/icons";
import { EmptyState } from "../../../components/EmptyState.js";
import { SkeletonList } from "../../../components/SkeletonCard.js";
import { useAuth } from "../../../features/auth/index.js";
import type {
  WalletData,
  TransactionData,
} from "../../../features/wallet/wallet.service.js";

const TX_TYPE_LABEL: Record<string, string> = {
  payment: "Pago de viaje",
  credit: "Crédito",
  refund: "Reembolso",
  topup: "Crédito",
};

const TX_STATUS_COLOR: Record<string, string> = {
  completed: "success",
  pending: "warning",
  failed: "danger",
  cancelled: "medium",
};

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
          new Date(String(b.createdAt ?? 0)).getTime() -
          new Date(String(a.createdAt ?? 0)).getTime(),
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

function walletBenefitStatusLabel(benefit: LocalWalletBenefit): string {
  if (isWalletBenefitAvailable(benefit)) return "Disponible";
  if (isWalletBenefitPending(benefit)) return "Pendiente admin";
  if (String(benefit.status).toLowerCase() === "used") return "Usado";
  if (String(benefit.status).toLowerCase() === "rejected") return "Rechazado";
  return benefit.status || "Pendiente";
}

function walletBenefitStatusColor(benefit: LocalWalletBenefit): string {
  if (isWalletBenefitAvailable(benefit)) return "success";
  if (isWalletBenefitPending(benefit)) return "warning";
  if (String(benefit.status).toLowerCase() === "used") return "medium";
  if (String(benefit.status).toLowerCase() === "rejected") return "danger";
  return "medium";
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
  tone: "green" | "gold" | "dark";
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
    dark: {
      bg: "linear-gradient(135deg,#2B2116,#4B2B1E)",
      iconBg: "rgba(255,255,255,.14)",
      iconColor: "#F8D78B",
      value: "#FFFFFF",
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
          color: tone === "dark" ? "rgba(255,255,255,.72)" : "#6B5A3E",
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
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
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
      const [walletResponse, transactionsResponse] = await Promise.all([
        walletService.getMyWallet(session.accessToken),
        walletService.getMyTransactions(session.accessToken, 1, 20),
      ]);

      setWallet(walletResponse);
      setTransactions(transactionsResponse.items);
      setLocalBenefits(readLocalWalletBenefits(session.user));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar la billetera.");
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

  const backendBalanceClp = wallet ? Math.round(Number(wallet.balance ?? 0) / 100) : 0;
  const availableBenefitClp = localBenefits
    .filter(isWalletBenefitAvailable)
    .reduce((sum, benefit) => sum + benefit.amountClp, 0);
  const pendingBenefitClp = localBenefits
    .filter(isWalletBenefitPending)
    .reduce((sum, benefit) => sum + benefit.amountClp, 0);
  const usedBenefitClp = localBenefits
    .filter((benefit) => String(benefit.status).toLowerCase() === "used")
    .reduce((sum, benefit) => sum + benefit.amountClp, 0);
  const displayBalanceClp = backendBalanceClp + availableBenefitClp;
  const hasMovements = transactions.length > 0 || localBenefits.length > 0;

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

        {loading && <SkeletonList count={4} height="74px" />}

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
                      Saldo disponible
                    </div>
                    <div style={{ marginTop: 8, fontSize: "2.55rem", fontWeight: 950, lineHeight: 1, letterSpacing: "-1.5px" }}>
                      {formatWalletClp(displayBalanceClp).replace(" CLP", "")}
                      <span style={{ fontSize: "1rem", marginLeft: 6, opacity: .86 }}>CLP</span>
                    </div>
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <IonBadge color={wallet?.status === "active" ? "success" : "medium"} style={{ fontSize: ".70rem", fontWeight: 950, padding: "7px 10px" }}>
                        {wallet?.status === "active" ? "✓ Billetera activa" : wallet?.status ?? "Billetera activa"}
                      </IonBadge>
                      <IonBadge color="warning" style={{ fontSize: ".70rem", fontWeight: 950, padding: "7px 10px" }}>
                        Uso automático
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
                  <MiniStatCard icon={giftOutline} label="Beneficios" value={formatWalletClp(availableBenefitClp)} tone="green" />
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
                      background: "rgba(34,197,94,.15)",
                      color: "#15803D",
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
                        <div style={{ fontWeight: 950, fontSize: "1rem" }}>Saldo a favor Rapa Go</div>
                        <div style={{ marginTop: 4, color: "#4B3B28", fontSize: ".82rem", fontWeight: 760, lineHeight: 1.38 }}>
                          El saldo aprobado se descuenta automáticamente en tus próximos viajes.
                        </div>
                      </div>
                      <IonBadge color={pendingBenefitClp > 0 ? "warning" : "success"} style={{ fontWeight: 950, flexShrink: 0 }}>
                        {pendingBenefitClp > 0 ? "En revisión" : "Al día"}
                      </IonBadge>
                    </div>

                    {pendingBenefitClp > 0 && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          borderRadius: 18,
                          background: "rgba(255,196,9,.16)",
                          border: "1px solid rgba(214,168,62,.26)",
                          color: "#5A3515",
                          fontSize: ".80rem",
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              <MiniStatCard icon={cashOutline} label="Cuenta" value={formatWalletClp(backendBalanceClp)} tone="dark" />
              <MiniStatCard icon={giftOutline} label="A favor" value={formatWalletClp(availableBenefitClp)} tone="green" />
              <MiniStatCard icon={shieldCheckmarkOutline} label="Usado" value={formatWalletClp(usedBenefitClp)} tone="gold" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              <IonButton
                expand="block"
                fill="outline"
                disabled
                style={
                  {
                    "--border-radius": "18px",
                    "--border-color": "rgba(214,168,62,.85)",
                    "--color": "#F8D78B",
                    height: "50px",
                    fontWeight: 950,
                    opacity: .78,
                  } as CSSProperties
                }
              >
                ↑ Recargar
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                disabled
                style={
                  {
                    "--border-radius": "18px",
                    "--border-color": "rgba(214,168,62,.85)",
                    "--color": "#F8D78B",
                    height: "50px",
                    fontWeight: 950,
                    opacity: .78,
                  } as CSSProperties
                }
              >
                ↓ Retirar
              </IonButton>
            </div>

            <IonNote
              style={{
                display: "block",
                color: "rgba(246,242,236,.72)",
                textAlign: "center",
                fontSize: ".74rem",
                fontWeight: 780,
                lineHeight: 1.35,
                marginBottom: 18,
              }}
            >
              Recarga y retiro estarán disponibles próximamente. Los saldos por pago de más se validan con administración.
            </IonNote>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ color: "#F6F2EC", fontWeight: 950, fontSize: "1.1rem" }}>Movimientos</div>
              <IonButton size="small" fill="clear" color="warning" onClick={() => void load()} style={{ fontWeight: 950 }}>
                <IonIcon icon={refreshOutline} slot="start" />
                Actualizar
              </IonButton>
            </div>

            {!hasMovements && (
              <IonCard style={walletCardStyle()}>
                <IonCardContent>
                  <EmptyState icon={walletOutline} title="Sin movimientos" subtitle="Tus transacciones y beneficios aparecerán aquí" />
                </IonCardContent>
              </IonCard>
            )}

            {localBenefits.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: transactions.length > 0 ? 14 : 0 }}>
                {localBenefits.slice(0, 8).map((benefit) => {
                  const available = isWalletBenefitAvailable(benefit);
                  const pending = isWalletBenefitPending(benefit);

                  return (
                    <IonCard key={benefit.id} style={walletCardStyle({ margin: 0 })}>
                      <IonCardContent style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 18,
                            background: available
                              ? "rgba(34,197,94,.15)"
                              : pending
                                ? "rgba(214,168,62,.18)"
                                : "rgba(120,120,120,.12)",
                            color: available ? "#15803D" : pending ? "#B7791F" : "#555",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IonIcon icon={benefit.source === "cash_overpayment" ? cashOutline : giftOutline} style={{ fontSize: 25 }} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 950, color: "#111", fontSize: ".91rem", lineHeight: 1.25 }}>
                            {benefit.title || "Saldo a favor"}
                          </div>
                          <div style={{ marginTop: 3, color: "#5D5143", fontSize: ".73rem", fontWeight: 760, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {benefit.description || "Beneficio para próximo viaje"}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                            <IonBadge color={walletBenefitStatusColor(benefit)} style={{ fontSize: ".62rem", fontWeight: 950 }}>
                              {walletBenefitStatusLabel(benefit)}
                            </IonBadge>
                            {benefit.createdAt && (
                              <span style={{ color: "#777", fontSize: ".66rem", fontWeight: 800 }}>
                                {new Date(benefit.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ fontWeight: 950, color: available ? "#16A34A" : "#B7791F", fontSize: ".95rem", whiteSpace: "nowrap" }}>
                          +{formatWalletClp(benefit.amountClp).replace(" CLP", "")}
                        </div>
                      </IonCardContent>
                    </IonCard>
                  );
                })}
              </div>
            )}

            {transactions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {transactions.map((tx) => {
                  const isDebit = tx.type === "payment";
                  const txIcon = tx.type === "payment" ? cardOutline : tx.type === "refund" ? refreshOutline : walletOutline;
                  const amount = Math.round(Number(tx.amount ?? 0) / 100);

                  return (
                    <IonCard key={tx.id} style={walletCardStyle({ margin: 0 })}>
                      <IonCardContent style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 18,
                            flexShrink: 0,
                            background: isDebit ? "rgba(239,68,68,.14)" : "rgba(34,197,94,.15)",
                            color: isDebit ? "#DC2626" : "#15803D",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <IonIcon icon={txIcon} style={{ fontSize: 25 }} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 950, fontSize: ".91rem", color: "#111" }}>
                            {TX_TYPE_LABEL[tx.type] ?? tx.type}
                          </div>
                          {tx.description && (
                            <div style={{ fontSize: ".73rem", color: "#5D5143", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 760 }}>
                              {tx.description}
                            </div>
                          )}
                          <div style={{ fontSize: ".68rem", color: "#777", marginTop: 7, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontWeight: 800 }}>
                            {new Date(tx.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                            <IonBadge color={TX_STATUS_COLOR[tx.status] ?? "medium"} style={{ fontSize: ".60rem", fontWeight: 950 }}>
                              {tx.status}
                            </IonBadge>
                          </div>
                        </div>

                        <div style={{ fontWeight: 950, fontSize: ".95rem", color: isDebit ? "#DC2626" : "#16A34A", flexShrink: 0 }}>
                          {isDebit ? "−" : "+"}{formatWalletClp(amount).replace(" CLP", "")}
                        </div>
                      </IonCardContent>
                    </IonCard>
                  );
                })}
              </div>
            )}
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
