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
import {
  alertCircleOutline,
  cashOutline,
  checkmarkCircleOutline,
  giftOutline,
  timeOutline,
} from "ionicons/icons";
import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";

import { useAuth } from "../../../features/auth/index.js";
import {
  walletService,
  type CashOverpaymentBenefitData,
  type WalletData,
} from "../../../features/wallet/wallet.service.js";

const WALLET_BG =
  "linear-gradient(180deg, rgba(14,12,10,.92), rgba(14,12,10,.96)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat";
const GOLD_GRADIENT =
  "linear-gradient(135deg,#D6A83E 0%,#B7791F 45%,#7A351F 100%)";

function formatClp(value: number | null | undefined): string {
  const amount = Math.max(0, Math.round(Number(value ?? 0)));
  return `$${amount.toLocaleString("es-CL")} CLP`;
}

function formatDate(value: string | null | undefined): string {
  const date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusInfo(status: string): {
  label: string;
  color: "warning" | "success" | "danger" | "medium";
  icon: string;
} {
  if (status === "approved") {
    return {
      label: "Aprobado por el administrador",
      color: "success",
      icon: checkmarkCircleOutline,
    };
  }

  if (status === "rejected") {
    return {
      label: "Rechazado",
      color: "danger",
      icon: alertCircleOutline,
    };
  }

  return {
    label: "Pendiente de revisión",
    color: "warning",
    icon: timeOutline,
  };
}

function benefitAmount(benefit: CashOverpaymentBenefitData): number {
  if (benefit.status === "approved") {
    return Math.max(
      0,
      Math.round(
        benefit.approvedAmountClp ?? benefit.requestedAmountClp,
      ),
    );
  }

  return Math.max(0, Math.round(benefit.requestedAmountClp));
}

export default function WalletPage(): JSX.Element {
  const { session } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [requests, setRequests] = useState<
    CashOverpaymentBenefitData[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) {
      setWallet(null);
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [walletData, requestData] = await Promise.all([
        walletService.getMyWallet(session.accessToken),
        walletService.listMyCashOverpaymentBenefits(
          session.accessToken,
        ),
      ]);

      setWallet(walletData);
      setRequests(
        [...requestData].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo sincronizar Beneficios con el servidor.",
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("rapago:wallet-benefit-updated", refresh);
    window.addEventListener("rapago:wallet-updated", refresh);

    return () => {
      window.removeEventListener(
        "rapago:wallet-benefit-updated",
        refresh,
      );
      window.removeEventListener("rapago:wallet-updated", refresh);
    };
  }, [load]);

  const availableClp = Math.max(
    0,
    Math.round(
      Number(wallet?.availableBenefitClp ?? wallet?.balance ?? 0),
    ),
  );

  const pendingTotalClp = requests
    .filter((request) => request.status === "pending_admin_review")
    .reduce(
      (sum, request) => sum + benefitAmount(request),
      0,
    );

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
          <IonTitle style={{ fontWeight: 950 }}>Beneficios</IonTitle>
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

        <div
          style={{
            maxWidth: 620,
            margin: "0 auto",
            paddingBottom: 90,
          }}
        >
          <section
            style={{
              borderRadius: 32,
              padding: "24px 20px",
              background: GOLD_GRADIENT,
              color: "#fff",
              boxShadow: "0 24px 70px rgba(0,0,0,.42)",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 18,
                  background: "rgba(255,255,255,.17)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <IonIcon icon={giftOutline} style={{ fontSize: 27 }} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: ".75rem",
                    fontWeight: 900,
                    opacity: 0.84,
                    textTransform: "uppercase",
                  }}
                >
                  Saldo a favor
                </div>
                <div
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: 950,
                    marginTop: 2,
                  }}
                >
                  {loading ? "Sincronizando…" : formatClp(availableClp)}
                </div>
              </div>
            </div>

            <p
              style={{
                margin: "17px 0 0",
                fontWeight: 750,
                lineHeight: 1.45,
                opacity: 0.94,
              }}
            >
              Nace únicamente cuando pagas de más en efectivo y el
              administrador lo aprueba. No se recarga, no se transfiere y
              solo puede usarse por esta misma cuenta en un próximo viaje
              pagado en efectivo.
            </p>
          </section>

          {error && (
            <IonCard
              style={{
                margin: "0 0 14px",
                borderRadius: 22,
                background: "#FFF3CD",
              }}
            >
              <IonCardContent
                style={{ display: "flex", gap: 10, alignItems: "center" }}
              >
                <IonIcon
                  icon={alertCircleOutline}
                  style={{ fontSize: 24, color: "#9A6700" }}
                />
                <IonText color="dark">
                  <strong>{error}</strong>
                </IonText>
              </IonCardContent>
            </IonCard>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <IonCard
              style={{ margin: 0, borderRadius: 22, background: "#EAFBF0" }}
            >
              <IonCardContent>
                <IonIcon
                  icon={checkmarkCircleOutline}
                  style={{ fontSize: 24, color: "#15803D" }}
                />
                <div style={{ marginTop: 7, fontWeight: 900 }}>
                  Aprobado
                </div>
                <div style={{ fontWeight: 950, fontSize: "1.05rem" }}>
                  {formatClp(availableClp)}
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard
              style={{ margin: 0, borderRadius: 22, background: "#FFF7D6" }}
            >
              <IonCardContent>
                <IonIcon
                  icon={timeOutline}
                  style={{ fontSize: 24, color: "#9A6700" }}
                />
                <div style={{ marginTop: 7, fontWeight: 900 }}>
                  Pendiente
                </div>
                <div style={{ fontWeight: 950, fontSize: "1.05rem" }}>
                  {formatClp(pendingTotalClp)}
                </div>
              </IonCardContent>
            </IonCard>
          </div>

          <h2
            style={{
              color: "#fff",
              fontSize: "1.05rem",
              fontWeight: 950,
              margin: "8px 4px 12px",
            }}
          >
            Solicitudes por pago de más
          </h2>

          {loading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: 32,
              }}
            >
              <IonSpinner color="warning" />
            </div>
          ) : requests.length === 0 ? (
            <IonCard
              style={{
                margin: 0,
                borderRadius: 24,
                background: "rgba(255,255,255,.96)",
              }}
            >
              <IonCardContent style={{ textAlign: "center", padding: 25 }}>
                <IonIcon
                  icon={cashOutline}
                  style={{ fontSize: 38, color: "#B7791F" }}
                />
                <h3 style={{ margin: "10px 0 5px", fontWeight: 950 }}>
                  Sin solicitudes
                </h3>
                <p style={{ margin: 0, color: "#655B50", lineHeight: 1.45 }}>
                  Después de completar un viaje en efectivo podrás informar
                  cuánto pagaste y solicitar conservar la diferencia.
                </p>
              </IonCardContent>
            </IonCard>
          ) : (
            requests.map((request) => {
              const info = statusInfo(request.status);
              return (
                <IonCard
                  key={request.id}
                  style={{
                    margin: "0 0 12px",
                    borderRadius: 24,
                    background: "rgba(255,255,255,.97)",
                  }}
                >
                  <IonCardContent>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            fontWeight: 950,
                          }}
                        >
                          <IonIcon icon={info.icon} />
                          Pago de más en efectivo
                        </div>
                        <div
                          style={{
                            fontSize: "1.25rem",
                            fontWeight: 950,
                            marginTop: 8,
                          }}
                        >
                          {formatClp(benefitAmount(request))}
                        </div>
                      </div>
                      <IonBadge color={info.color}>{info.label}</IonBadge>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        marginTop: 14,
                        fontSize: ".79rem",
                        color: "#5F564B",
                      }}
                    >
                      <div>
                        Tarifa: <strong>{formatClp(request.fareClp)}</strong>
                      </div>
                      <div>
                        Pagado: <strong>{formatClp(request.paidClp)}</strong>
                      </div>
                    </div>

                    <p
                      style={{
                        margin: "12px 0 0",
                        color: "#6B6257",
                        fontSize: ".78rem",
                      }}
                    >
                      Solicitado: {formatDate(request.requestedAt)}
                    </p>

                    {request.adminDecisionReason && (
                      <p
                        style={{
                          margin: "9px 0 0",
                          padding: "9px 11px",
                          borderRadius: 14,
                          background: "#F5F1EA",
                          color: "#463D34",
                          fontSize: ".8rem",
                          lineHeight: 1.4,
                        }}
                      >
                        <strong>Respuesta del administrador:</strong>{" "}
                        {request.adminDecisionReason}
                      </p>
                    )}
                  </IonCardContent>
                </IonCard>
              );
            })
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
