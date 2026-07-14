import {
  IonBadge,
  IonButton,
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
  cardOutline,
  cashOutline,
  giftOutline,
  timeOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  logoWhatsapp,
} from "ionicons/icons";
import { SkeletonList } from "../../../components/SkeletonCard.js";
import { useAuth } from "../../../features/auth/index.js";
import type { TransactionData, WalletData } from "../../../features/wallet/wallet.service.js";
import { RAPAGO_CONTACT } from "@rapa-go/shared";

const RAPAGO_WALLET_BENEFITS_KEY = "rapago_wallet_benefits_v1";
const RAPAGO_WALLET_BENEFIT_EVENT = "rapago:wallet-benefit-updated";
const RAPAGO_SUPPORT_WHATSAPP_PHONE = "56947964171";

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
  refundWhatsappAvailable?: boolean | null;
  cardRefundRequested?: boolean | null;
  mercadoPagoRefundRequested?: boolean | null;
  mercadoPagoRefundStatus?: string | null;
  originText?: string | null;
  destinationText?: string | null;
  paymentId?: string | null;
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
        refundWhatsappAvailable: Boolean(item.refundWhatsappAvailable),
        cardRefundRequested: Boolean(item.cardRefundRequested || item.mercadoPagoRefundRequested),
        mercadoPagoRefundRequested: Boolean(item.mercadoPagoRefundRequested || item.cardRefundRequested),
        mercadoPagoRefundStatus: typeof item.mercadoPagoRefundStatus === "string" ? item.mercadoPagoRefundStatus : null,
        originText: typeof item.originText === "string" ? item.originText : null,
        destinationText: typeof item.destinationText === "string" ? item.destinationText : null,
        paymentId: typeof item.paymentId === "string" ? item.paymentId : null,
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
  return (
    status === "available" ||
    status === "approved" ||
    adminStatus === "admin_approved" ||
    adminStatus === "card_credit_available" ||
    adminStatus === "available"
  );
}

function isWalletBenefitPending(benefit: LocalWalletBenefit): boolean {
  const status = String(benefit.status ?? "").toLowerCase();
  const adminStatus = String(benefit.adminReviewStatus ?? "").toLowerCase();
  return status === "pending_admin" || adminStatus === "pending_admin";
}

function isWalletCardCancellationCredit(benefit: LocalWalletBenefit): boolean {
  const text = `${benefit.source ?? ""} ${benefit.title ?? ""} ${benefit.description ?? ""}`.toLowerCase();
  return (
    text.includes("card_cancellation_credit") ||
    text.includes("cancelación con tarjeta") ||
    text.includes("cancelacion con tarjeta") ||
    text.includes("mercadopago") ||
    benefit.refundWhatsappAvailable === true ||
    benefit.cardRefundRequested === true ||
    benefit.mercadoPagoRefundRequested === true
  );
}

function normalizeWalletSupportWhatsAppPhone(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : "56947964171";
}

function buildWalletSupportFolio(benefits: LocalWalletBenefit[]): string {
  const raw = benefits
    .map((benefit) => {
      const record = benefit as LocalWalletBenefit & Record<string, unknown>;
      return [record["id"], record["rideId"], record["paymentId"], record["createdAt"], record["source"]]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join("|");
    })
    .filter(Boolean)
    .join("||");

  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `RPG-${Math.abs(hash).toString(36).toUpperCase().padStart(6, "0").slice(0, 6)}`;
}

function buildWalletCreditRefundWhatsAppUrl(benefits: LocalWalletBenefit[]): string {
  const phone = normalizeWalletSupportWhatsAppPhone(RAPAGO_SUPPORT_WHATSAPP_PHONE);
  const folio = buildWalletSupportFolio(benefits);
  const count = benefits.length;

  const lines = [
    "Soporte RAPA GO: solicitud de revision de credito/devolucion.",
    `Folio: ${folio}`,
    count > 1 ? `Solicitudes: ${count}` : null,
    "Revisar detalle en panel admin autenticado.",
  ].filter(Boolean);

  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function openWalletCreditRefundWhatsApp(benefits: LocalWalletBenefit[]): void {
  const url = buildWalletCreditRefundWhatsAppUrl(benefits);

  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
}


function CreditSplitBox({
  title,
  description,
  approvedClp,
  pendingClp,
  tone,
  icon,
  children,
}: {
  title: string;
  description: string;
  approvedClp: number;
  pendingClp: number;
  tone: "cash" | "card";
  icon: string;
  children?: React.ReactNode;
}): JSX.Element {
  const isCash = tone === "cash";
  const mainColor = isCash ? "#166534" : "#7A4E10";
  const bg = isCash
    ? "linear-gradient(135deg,#ECFDF5,#DCFCE7)"
    : "linear-gradient(135deg,#FFF7D6,#F7E4BA)";
  const border = isCash ? "1px solid rgba(34,197,94,.28)" : "1px solid rgba(214,168,62,.35)";
  const iconBg = isCash ? "rgba(34,197,94,.16)" : "rgba(214,168,62,.22)";

  return (
    <div
      style={{
        padding: 13,
        borderRadius: 22,
        background: bg,
        border,
        color: "#111827",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 16,
            background: iconBg,
            color: mainColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IonIcon icon={icon} style={{ fontSize: 24 }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 950, fontSize: ".95rem", textTransform: "uppercase", letterSpacing: ".02em" }}>
            {title}
          </div>
          <div style={{ marginTop: 3, color: "#4B3B28", fontSize: ".76rem", fontWeight: 780, lineHeight: 1.32 }}>
            {description}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 9,
          marginTop: 12,
        }}
      >
        <div
          style={{
            padding: 10,
            borderRadius: 16,
            background: "rgba(255,255,255,.66)",
            border: "1px solid rgba(255,255,255,.58)",
          }}
        >
          <div style={{ color: mainColor, fontSize: ".66rem", fontWeight: 950, textTransform: "uppercase" }}>
            Disponible
          </div>
          <div style={{ marginTop: 4, color: mainColor, fontSize: "1rem", fontWeight: 950 }}>
            {formatWalletClp(approvedClp)}
          </div>
        </div>

        <div
          style={{
            padding: 10,
            borderRadius: 16,
            background: "rgba(255,255,255,.50)",
            border: "1px solid rgba(255,255,255,.48)",
          }}
        >
          <div style={{ color: "#7A4E10", fontSize: ".66rem", fontWeight: 950, textTransform: "uppercase" }}>
            Pendiente
          </div>
          <div style={{ marginTop: 4, color: "#7A4E10", fontSize: "1rem", fontWeight: 950 }}>
            {formatWalletClp(pendingClp)}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
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
  const [walletTransactions, setWalletTransactions] = useState<TransactionData[]>([]);
  const [localBenefits, setLocalBenefits] = useState<LocalWalletBenefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshLocalBenefits = useCallback(() => {
    setLocalBenefits(readLocalWalletBenefits(session?.user));
  }, [session?.user]);

  const load = useCallback(async () => {
    if (!session?.accessToken) {
      setWallet(null);
      setWalletTransactions([]);
      setLocalBenefits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const { walletService } = await import("../../../features/wallet/wallet.service.js");
      const [walletResponse, transactionsResponse] = await Promise.all([
        walletService.getMyWallet(session.accessToken),
        walletService.getMyTransactions(session.accessToken, 1, 50),
      ]);

      setWallet(walletResponse);
      setWalletTransactions(transactionsResponse.items);
      setLocalBenefits(readLocalWalletBenefits(session.user));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo sincronizar la billetera. Mostrando beneficios locales.");
      setWallet(null);
      setWalletTransactions([]);
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

  const cardCancellationCredits = localBenefits.filter(isWalletCardCancellationCredit);
  const cashCredits = localBenefits.filter((benefit) => !isWalletCardCancellationCredit(benefit));

  const localApprovedVisualCredits = localBenefits.filter(isWalletBenefitAvailable);
  const pendingCashCredits = cashCredits.filter(isWalletBenefitPending);
  const pendingCardCredits = cardCancellationCredits.filter(isWalletBenefitPending);

  const backendCompletedCredits = walletTransactions.filter((transaction) => {
    const type = String(transaction.type ?? "").toLowerCase();
    const status = String(transaction.status ?? "").toLowerCase();
    return type === "credit" && status === "completed";
  });

  const backendWalletBalanceClp = Math.max(0, Math.round(Number(wallet?.balance ?? 0)));
  const backendCreditHistoryClp = backendCompletedCredits.reduce(
    (sum, transaction) => sum + Math.max(0, Math.round(Number(transaction.amount ?? 0))),
    0,
  );
  const hasLocalApprovedVisualOnly = localApprovedVisualCredits.length > 0 && backendWalletBalanceClp <= 0;

  const cashCreditClp = backendWalletBalanceClp;
  const pendingCashCreditClp = pendingCashCredits.reduce((sum, benefit) => sum + benefit.amountClp, 0);
  const cardCreditClp = 0;
  const pendingCardCreditClp = pendingCardCredits.reduce((sum, benefit) => sum + benefit.amountClp, 0);

  const approvedBenefitClp = backendWalletBalanceClp;
  const pendingBenefitClp = pendingCashCreditClp + pendingCardCreditClp;

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
                      CRÉDITOS PARA PRÓXIMO VIAJE
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
                  <MiniStatCard icon={giftOutline} label="Crédito efectivo" value={formatWalletClp(cashCreditClp)} tone="green" />
                  <MiniStatCard icon={cardOutline} label="Crédito tarjeta" value={formatWalletClp(cardCreditClp)} tone="gold" />
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
                          CRÉDITOS SEPARADOS
                        </div>
                        <div style={{ marginTop: 4, color: "#4B3B28", fontSize: ".82rem", fontWeight: 760, lineHeight: 1.38 }}>
                          El saldo disponible viene del backend. Los registros locales se muestran solo como historial visual pendiente.
                        </div>
                      </div>

                      <IonBadge color={approvedBenefitClp > 0 ? "success" : pendingBenefitClp > 0 ? "warning" : "medium"} style={{ fontWeight: 950, flexShrink: 0 }}>
                        {backendCreditHistoryClp > 0 || approvedBenefitClp > 0 ? "Aprobado por admin" : hasLocalApprovedVisualOnly || pendingBenefitClp > 0 ? "Pendiente backend" : "Sin saldo"}
                      </IonBadge>
                    </div>

                    <div
                      style={{
                        marginTop: 13,
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: 12,
                      }}
                    >
                      <CreditSplitBox
                        title="Crédito efectivo"
                        description="Pago de más en efectivo aprobado por administración. Se descuenta en el próximo viaje."
                        approvedClp={cashCreditClp}
                        pendingClp={pendingCashCreditClp}
                        tone="cash"
                        icon={cashOutline}
                      />

                      <CreditSplitBox
                        title="Crédito tarjeta"
                        description="Saldo neto por cancelación con tarjeta/MercadoPago. Si quieres devolución, solicita soporte por WhatsApp."
                        approvedClp={cardCreditClp}
                        pendingClp={pendingCardCreditClp}
                        tone="card"
                        icon={cardOutline}
                      >
                        {cardCancellationCredits.length > 0 && (
                          <IonButton
                            expand="block"
                            color="success"
                            onClick={() => openWalletCreditRefundWhatsApp(cardCancellationCredits)}
                            style={{ marginTop: 12, "--border-radius": "16px", fontWeight: 950 } as CSSProperties}
                          >
                            <IonIcon icon={logoWhatsapp} slot="start" />
                            Solicitar devolución tarjeta por WhatsApp
                          </IonButton>
                        )}
                      </CreditSplitBox>
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
                        Tienes {formatWalletClp(pendingBenefitClp)} pendiente de revisión/soporte.
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
