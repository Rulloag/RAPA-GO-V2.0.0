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
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  alertCircleOutline,
  cashOutline,
  checkmarkCircleOutline,
  giftOutline,
  timeOutline,
  walletOutline,
} from "ionicons/icons";

import { SkeletonList } from "../../../components/SkeletonCard.js";
import { useAuth } from "../../../features/auth/index.js";
import type {
  TransactionData,
  WalletData,
} from "../../../features/wallet/wallet.service.js";

const RAPAGO_WALLET_BENEFITS_KEY = "rapago_wallet_benefits_v1";
const RAPAGO_WALLET_BENEFIT_EVENT = "rapago:wallet-benefit-updated";
const RAPAGO_WALLET_UPDATED_EVENT = "rapago:wallet-updated";

const WALLET_BG =
  "linear-gradient(180deg, rgba(14,12,10,.92), rgba(14,12,10,.96)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat";

const GOLD_GRADIENT =
  "linear-gradient(135deg,#D6A83E 0%,#B7791F 45%,#7A351F 100%)";
const SAND_GRADIENT = "linear-gradient(135deg,#FFF7E6 0%,#F7E4BA 100%)";

/**
 * Registro visual local creado cuando el usuario pide guardar como beneficio
 * el dinero pagado de más en efectivo.
 *
 * El saldo aprobado real siempre se obtiene desde el backend mediante
 * GET /wallets/me. LocalStorage solo se utiliza para mostrar solicitudes
 * pendientes mientras Admin todavía no las aprueba.
 */
type LocalWalletBenefit = {
  id: string;
  rideId?: string | null;

  ownerUserId?: string | null;
  userId?: string | null;
  passengerUserId?: string | null;

  passengerEmail?: string | null;
  ownerKey?: string | null;

  amountClp: number;
  status: "pending_admin" | "available" | "used" | "rejected" | string;
  source?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt?: string | null;
  approvedAt?: string | null;
  adminReviewStatus?: string | null;
  originText?: string | null;
  destinationText?: string | null;
};

type WalletSessionIdentity = {
  userId: string;
  email: string;
};

function formatWalletClp(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "$0 CLP";

  return `$${Math.max(0, Math.round(amount)).toLocaleString("es-CL")} CLP`;
}

function formatWalletDate(value: string | null | undefined): string {
  const date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) return "Sin fecha";

  return date.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function normalizeWalletEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeWalletUserId(value: unknown): string {
  return String(value ?? "").trim();
}

function getWalletSessionIdentity(user: unknown): WalletSessionIdentity {
  if (!user || typeof user !== "object") {
    return { userId: "", email: "" };
  }

  const record = user as Record<string, unknown>;

  return {
    userId: normalizeWalletUserId(
      record["id"] ?? record["userId"] ?? record["sub"],
    ),
    email: normalizeWalletEmail(record["email"]),
  };
}

function isCashOverpaymentBenefit(benefit: LocalWalletBenefit): boolean {
  const text = [benefit.source, benefit.title, benefit.description]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  const looksLikeCardRecord =
    text.includes("card_cancellation_credit") ||
    text.includes("cancelación con tarjeta") ||
    text.includes("cancelacion con tarjeta") ||
    text.includes("mercadopago") ||
    text.includes("crédito tarjeta") ||
    text.includes("credito tarjeta");

  if (looksLikeCardRecord) return false;

  return (
    text.includes("cash_overpayment") ||
    text.includes("cash overpayment") ||
    text.includes("pago de más") ||
    text.includes("pago de mas") ||
    text.includes("saldo a favor") ||
    text.includes("beneficio") ||
    !text
  );
}

function isWalletBenefitPending(benefit: LocalWalletBenefit): boolean {
  const status = String(benefit.status ?? "").toLowerCase();
  const adminStatus = String(benefit.adminReviewStatus ?? "").toLowerCase();

  return (
    status === "pending_admin" ||
    status === "pending" ||
    adminStatus === "pending_admin" ||
    adminStatus === "pending_backend"
  );
}

function benefitBelongsToSession(
  benefit: LocalWalletBenefit,
  identity: WalletSessionIdentity,
): boolean {
  const ownerUserId = normalizeWalletUserId(
    benefit.ownerUserId ?? benefit.userId ?? benefit.passengerUserId,
  );

  if (identity.userId && ownerUserId) {
    return identity.userId === ownerUserId;
  }

  const ownerEmail = normalizeWalletEmail(
    benefit.passengerEmail ?? benefit.ownerKey,
  );

  return Boolean(identity.email && ownerEmail && identity.email === ownerEmail);
}

function readLocalPendingWalletBenefits(user: unknown): LocalWalletBenefit[] {
  if (typeof window === "undefined") return [];

  try {
    const identity = getWalletSessionIdentity(user);
    const raw = window.localStorage.getItem(RAPAGO_WALLET_BENEFITS_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Array<Record<string, unknown>>)
      : [];

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index): LocalWalletBenefit => ({
        id: String(item["id"] ?? `wallet-benefit-${index}`),
        rideId:
          typeof item["rideId"] === "string" ? item["rideId"] : null,

        ownerUserId:
          typeof item["ownerUserId"] === "string"
            ? item["ownerUserId"]
            : null,
        userId:
          typeof item["userId"] === "string" ? item["userId"] : null,
        passengerUserId:
          typeof item["passengerUserId"] === "string"
            ? item["passengerUserId"]
            : null,

        passengerEmail:
          typeof item["passengerEmail"] === "string"
            ? item["passengerEmail"]
            : null,
        ownerKey:
          typeof item["ownerKey"] === "string" ? item["ownerKey"] : null,

        amountClp: Math.max(
          0,
          Math.round(Number(item["amountClp"] ?? item["amount"] ?? 0)),
        ),
        status: String(item["status"] ?? "pending_admin"),
        source:
          typeof item["source"] === "string" ? item["source"] : null,
        title: typeof item["title"] === "string" ? item["title"] : null,
        description:
          typeof item["description"] === "string"
            ? item["description"]
            : null,
        createdAt:
          typeof item["createdAt"] === "string" ? item["createdAt"] : null,
        approvedAt:
          typeof item["approvedAt"] === "string"
            ? item["approvedAt"]
            : null,
        adminReviewStatus:
          typeof item["adminReviewStatus"] === "string"
            ? item["adminReviewStatus"]
            : null,
        originText:
          typeof item["originText"] === "string"
            ? item["originText"]
            : null,
        destinationText:
          typeof item["destinationText"] === "string"
            ? item["destinationText"]
            : null,
      }))
      .filter((benefit) => benefit.amountClp > 0)
      .filter(isCashOverpaymentBenefit)
      .filter(isWalletBenefitPending)
      .filter((benefit) => benefitBelongsToSession(benefit, identity))
      .sort(
        (a, b) =>
          new Date(String(b.createdAt ?? 0)).getTime() -
          new Date(String(a.createdAt ?? 0)).getTime(),
      );
  } catch {
    return [];
  }
}

function isBackendBenefitTransaction(transaction: TransactionData): boolean {
  const type = String(transaction.type ?? "").toLowerCase();

  return (
    type === "benefit_credit" ||
    type === "benefit_use" ||
    type === "benefit_debit" ||
    type === "benefit_reversal" ||
    type === "admin_adjustment" ||
    type === "credit" ||
    type.includes("benefit")
  );
}

function isBackendApprovedBenefitCredit(
  transaction: TransactionData,
): boolean {
  const type = String(transaction.type ?? "").toLowerCase();
  const status = String(transaction.status ?? "").toLowerCase();

  return (
    ["benefit_credit", "credit", "admin_adjustment"].includes(type) &&
    ["completed", "approved", "success"].includes(status)
  );
}

function transactionIsDebit(transaction: TransactionData): boolean {
  const type = String(transaction.type ?? "").toLowerCase();

  return (
    type.includes("use") ||
    type.includes("debit") ||
    type.includes("payment")
  );
}

function transactionTitle(transaction: TransactionData): string {
  const type = String(transaction.type ?? "").toLowerCase();

  if (type === "benefit_credit" || type === "credit") {
    return "Beneficio aprobado por Admin";
  }

  if (type === "benefit_use" || type === "benefit_debit") {
    return "Beneficio usado en viaje";
  }

  if (type === "benefit_reversal") {
    return "Beneficio devuelto a tu saldo";
  }

  if (type === "admin_adjustment") {
    return "Ajuste administrativo";
  }

  return transaction.description || "Movimiento de beneficio";
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

function SummaryBox({
  icon,
  label,
  amountClp,
  tone,
}: {
  icon: string;
  label: string;
  amountClp: number;
  tone: "approved" | "pending";
}): JSX.Element {
  const approved = tone === "approved";

  return (
    <div
      style={{
        padding: "14px 13px",
        borderRadius: 22,
        background: approved
          ? "linear-gradient(135deg,#EAFBF0,#D8F7E2)"
          : "linear-gradient(135deg,#FFF7D6,#F7E4BA)",
        border: approved
          ? "1px solid rgba(34,197,94,.25)"
          : "1px solid rgba(214,168,62,.28)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 15,
          background: approved
            ? "rgba(34,197,94,.16)"
            : "rgba(214,168,62,.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: approved ? "#15803D" : "#8A5A12",
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
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: "1rem",
          fontWeight: 950,
          color: approved ? "#166534" : "#7A4E10",
        }}
      >
        {formatWalletClp(amountClp)}
      </div>
    </div>
  );
}

export default function WalletPage(): JSX.Element {
  const { session } = useAuth();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<
    TransactionData[]
  >([]);
  const [pendingBenefits, setPendingBenefits] = useState<LocalWalletBenefit[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshPendingBenefits = useCallback(() => {
    setPendingBenefits(readLocalPendingWalletBenefits(session?.user));
  }, [session?.user]);

  const load = useCallback(async () => {
    if (!session?.accessToken) {
      setWallet(null);
      setWalletTransactions([]);
      setPendingBenefits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const { walletService } = await import(
        "../../../features/wallet/wallet.service.js"
      );

      const [walletResponse, transactionsResponse] = await Promise.all([
        walletService.getMyWallet(session.accessToken),
        walletService.getMyTransactions(session.accessToken, 1, 50),
      ]);

      setWallet(walletResponse);
      setWalletTransactions(transactionsResponse.items);
      setPendingBenefits(readLocalPendingWalletBenefits(session.user));
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "No se pudo sincronizar tus beneficios con el servidor.",
      );
      setWallet(null);
      setWalletTransactions([]);
      setPendingBenefits(readLocalPendingWalletBenefits(session.user));
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, session?.user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refreshFromAdminOrStorage = () => {
      refreshPendingBenefits();
      void load();
    };

    window.addEventListener("storage", refreshFromAdminOrStorage);
    window.addEventListener(
      RAPAGO_WALLET_UPDATED_EVENT,
      refreshFromAdminOrStorage as EventListener,
    );
    window.addEventListener(
      RAPAGO_WALLET_BENEFIT_EVENT,
      refreshFromAdminOrStorage as EventListener,
    );

    return () => {
      window.removeEventListener("storage", refreshFromAdminOrStorage);
      window.removeEventListener(
        RAPAGO_WALLET_UPDATED_EVENT,
        refreshFromAdminOrStorage as EventListener,
      );
      window.removeEventListener(
        RAPAGO_WALLET_BENEFIT_EVENT,
        refreshFromAdminOrStorage as EventListener,
      );
    };
  }, [load, refreshPendingBenefits]);

  const approvedBalanceClp = Math.max(
    0,
    Math.round(Number(wallet?.balance ?? 0)),
  );

  const pendingBalanceClp = pendingBenefits.reduce(
    (sum, benefit) => sum + benefit.amountClp,
    0,
  );

  const benefitTransactions = walletTransactions
    .filter(isBackendBenefitTransaction)
    .sort(
      (a, b) =>
        new Date(String(b.createdAt ?? 0)).getTime() -
        new Date(String(a.createdAt ?? 0)).getTime(),
    );

  const approvedCredits = benefitTransactions.filter(
    isBackendApprovedBenefitCredit,
  );

  const hasApprovedBackendBenefit =
    approvedBalanceClp > 0 || approvedCredits.length > 0;

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
          <IonTitle style={{ fontWeight: 950 }}>Mis beneficios</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent
        className="ion-padding"
        style={{ "--background": WALLET_BG } as CSSProperties}
      >
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => {
            void load().finally(() => event.detail.complete());
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
                <IonCardContent
                  style={{ padding: "12px 14px", display: "flex", gap: 10 }}
                >
                  <IonIcon
                    icon={alertCircleOutline}
                    style={{
                      fontSize: 22,
                      color: "#B7791F",
                      flexShrink: 0,
                    }}
                  />
                  <IonText>
                    <p
                      style={{
                        margin: 0,
                        color: "#5A3515",
                        fontWeight: 850,
                        fontSize: ".82rem",
                        lineHeight: 1.35,
                      }}
                    >
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

              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 14,
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: ".78rem",
                        fontWeight: 900,
                        color: "rgba(255,255,255,.80)",
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                      }}
                    >
                      Saldo a favor aprobado
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: "2.55rem",
                        fontWeight: 950,
                        lineHeight: 1,
                        letterSpacing: "-1.5px",
                      }}
                    >
                      {formatWalletClp(approvedBalanceClp).replace(" CLP", "")}
                      <span
                        style={{
                          fontSize: "1rem",
                          marginLeft: 6,
                          opacity: 0.86,
                        }}
                      >
                        CLP
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <IonBadge
                        color={hasApprovedBackendBenefit ? "success" : "medium"}
                        style={{
                          fontSize: ".70rem",
                          fontWeight: 950,
                          padding: "7px 10px",
                        }}
                      >
                        {hasApprovedBackendBenefit
                          ? "✓ Aprobado por Admin"
                          : "Sin beneficio aprobado"}
                      </IonBadge>

                      <IonBadge
                        color="light"
                        style={{
                          fontSize: ".70rem",
                          fontWeight: 950,
                          padding: "7px 10px",
                          color: "#5A3515",
                        }}
                      >
                        Exclusivo de tu cuenta
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

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginTop: 22,
                  }}
                >
                  <SummaryBox
                    icon={giftOutline}
                    label="Disponible"
                    amountClp={approvedBalanceClp}
                    tone="approved"
                  />
                  <SummaryBox
                    icon={timeOutline}
                    label="Pendiente Admin"
                    amountClp={pendingBalanceClp}
                    tone="pending"
                  />
                </div>
              </div>
            </section>

            <IonCard style={walletCardStyle({ background: SAND_GRADIENT })}>
              <IonCardContent style={{ padding: 16 }}>
                <div style={{ display: "flex", gap: 12 }}>
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
                    <IonIcon
                      icon={checkmarkCircleOutline}
                      style={{ fontSize: 29 }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 950, fontSize: "1rem" }}>
                      BENEFICIO POR PAGO DE MÁS EN EFECTIVO
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        color: "#4B3B28",
                        fontSize: ".82rem",
                        fontWeight: 760,
                        lineHeight: 1.42,
                      }}
                    >
                      Cuando pagas de más en efectivo y eliges guardar la
                      diferencia, Admin revisa la solicitud. Al aprobarla, el
                      monto queda disponible únicamente en esta cuenta, sea una
                      cuenta pasajero o conductor usando la app como usuario.
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 17,
                        background: "rgba(255,255,255,.66)",
                        border: "1px solid rgba(214,168,62,.22)",
                        color: "#4B3B28",
                        fontSize: ".80rem",
                        fontWeight: 800,
                        lineHeight: 1.4,
                      }}
                    >
                      En el próximo viaje la aplicación te preguntará si deseas
                      usar tu saldo a favor. No se comparte ni se transfiere a
                      otra cuenta.
                    </div>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>

            {pendingBenefits.length > 0 && (
              <IonCard style={walletCardStyle()}>
                <IonCardContent style={{ padding: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 950, fontSize: "1rem" }}>
                        Solicitudes pendientes
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          color: "#6B5A3E",
                          fontSize: ".76rem",
                          fontWeight: 760,
                        }}
                      >
                        Aún no aumentan tu saldo hasta que Admin las apruebe.
                      </div>
                    </div>

                    <IonBadge color="warning" style={{ fontWeight: 950 }}>
                      {pendingBenefits.length}
                    </IonBadge>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {pendingBenefits.map((benefit) => (
                      <div
                        key={benefit.id}
                        style={{
                          padding: 12,
                          borderRadius: 18,
                          background: "#FFF7D6",
                          border: "1px solid rgba(214,168,62,.32)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                color: "#5A3515",
                                fontWeight: 950,
                                fontSize: ".88rem",
                              }}
                            >
                              {benefit.originText && benefit.destinationText
                                ? `${benefit.originText} → ${benefit.destinationText}`
                                : "Pago de más en efectivo"}
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                color: "#7A4E10",
                                fontWeight: 760,
                                fontSize: ".72rem",
                              }}
                            >
                              Solicitado: {formatWalletDate(benefit.createdAt)}
                            </div>
                          </div>

                          <IonBadge color="warning">Pendiente</IonBadge>
                        </div>

                        <div
                          style={{
                            marginTop: 10,
                            color: "#7A4E10",
                            fontWeight: 950,
                            fontSize: "1.05rem",
                          }}
                        >
                          {formatWalletClp(benefit.amountClp)}
                        </div>
                      </div>
                    ))}
                  </div>
                </IonCardContent>
              </IonCard>
            )}

            <IonCard style={walletCardStyle()}>
              <IonCardContent style={{ padding: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 950, fontSize: "1rem" }}>
                      Movimientos aprobados
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        color: "#6B5A3E",
                        fontSize: ".76rem",
                        fontWeight: 760,
                      }}
                    >
                      Información sincronizada directamente desde el backend.
                    </div>
                  </div>

                  <IonIcon
                    icon={cashOutline}
                    style={{ fontSize: 25, color: "#15803D" }}
                  />
                </div>

                {benefitTransactions.length === 0 ? (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 18,
                      background: "#F7F2EA",
                      color: "#6B5A3E",
                      fontSize: ".80rem",
                      fontWeight: 800,
                      textAlign: "center",
                    }}
                  >
                    Todavía no tienes movimientos de beneficios aprobados.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 9 }}>
                    {benefitTransactions.slice(0, 12).map((transaction) => {
                      const isDebit = transactionIsDebit(transaction);
                      const amount = Math.abs(
                        Math.round(Number(transaction.amount ?? 0)),
                      );

                      return (
                        <div
                          key={transaction.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            padding: 12,
                            borderRadius: 18,
                            background: "#FAF7F2",
                            border: "1px solid rgba(214,168,62,.18)",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 930,
                                color: "#2D241B",
                                fontSize: ".84rem",
                              }}
                            >
                              {transactionTitle(transaction)}
                            </div>
                            <div
                              style={{
                                marginTop: 3,
                                color: "#7A6A56",
                                fontSize: ".70rem",
                                fontWeight: 730,
                              }}
                            >
                              {formatWalletDate(transaction.createdAt)}
                            </div>
                            {transaction.description && (
                              <div
                                style={{
                                  marginTop: 4,
                                  color: "#6B5A3E",
                                  fontSize: ".70rem",
                                  lineHeight: 1.3,
                                }}
                              >
                                {transaction.description}
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              color: isDebit ? "#B42318" : "#15803D",
                              fontWeight: 950,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isDebit ? "−" : "+"}
                            {formatWalletClp(amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </div>
        )}

        {loading && (
          <div
            style={{ display: "flex", justifyContent: "center", marginTop: 12 }}
          >
            <IonSpinner name="crescent" />
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}