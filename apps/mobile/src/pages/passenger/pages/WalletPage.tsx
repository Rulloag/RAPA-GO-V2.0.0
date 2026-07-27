import {
  IonBadge,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
} from "@ionic/react";
import {
  alertCircleOutline,
  cashOutline,
  checkmarkCircleOutline,
  giftOutline,
  timeOutline,
} from "ionicons/icons";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../../features/auth/index.js";
import {
  walletService,
  type CashOverpaymentBenefitData,
  type WalletData,
} from "../../../features/wallet/wallet.service.js";
import {
  cashRefundsService,
  type CashOverpaymentRefundData,
} from "../../../features/cashRefunds/cashRefunds.service.js";

import { RapagoSectionHeader } from "../../../components/RapagoSectionHeader.js";
import { useRapagoSectionTheme } from "../../../theme/rapagoTheme.js";


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

function refundStatusInfo(status: string): {
  label: string;
  color: "warning" | "success" | "danger" | "medium";
} {
  if (status === "completed") return { label: "Transferida", color: "success" };
  if (status === "approved_for_transfer") {
    return { label: "Aprobada para transferencia", color: "success" };
  }
  if (status === "rejected") return { label: "Rechazada", color: "danger" };
  return { label: "Pendiente de revisión", color: "warning" };
}


export default function WalletPage(): JSX.Element {
  const { session } = useAuth();
  // Solo se lee: el interruptor único vive en el encabezado de Inicio.
  const { theme } = useRapagoSectionTheme("wallet");
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [requests, setRequests] = useState<
    CashOverpaymentBenefitData[]
  >([]);
  const [refunds, setRefunds] = useState<CashOverpaymentRefundData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) {
      setWallet(null);
      setRequests([]);
      setRefunds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [walletData, requestData, refundData] = await Promise.all([
        walletService.getMyWallet(session.accessToken),
        walletService.listMyCashOverpaymentBenefits(
          session.accessToken,
        ),
        cashRefundsService.listMine(session.accessToken),
      ]);

      setWallet(walletData);
      setRequests(
        [...requestData].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        ),
      );
      setRefunds(
        [...refundData].sort(
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
    <IonPage
      className="rapago-section-page rapago-wallet-page"
      data-rapago-theme={theme}
    >
      <RapagoSectionHeader
        title="Beneficios"
      />

      <IonContent>
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => {
            void load().finally(() => event.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <div className="rp-shell">
          <section className="rp-hero" aria-label="Saldo a favor">
            <div className="rp-hero__top">
              <div className="rp-hero__icon" aria-hidden>
                <IonIcon icon={giftOutline} />
              </div>
              <div>
                <p className="rp-hero__kicker">Saldo a favor</p>
                <p className="rp-hero__amount">
                  {loading ? "Sincronizando…" : formatClp(availableClp)}
                </p>
              </div>
            </div>

            <p className="rp-hero__note">
              Nace únicamente cuando pagas de más en efectivo y el
              administrador lo aprueba. Se usa desde esta misma cuenta en un
              próximo viaje pagado en efectivo.
            </p>
          </section>

          {error && (
            <div className="rp-banner rp-banner--error" role="alert">
              <IonIcon icon={alertCircleOutline} />
              <span>{error}</span>
            </div>
          )}

          <div className="rp-tile-grid">
            <div className="rp-tile rp-tile--ok">
              <div className="rp-tile__icon" aria-hidden>
                <IonIcon icon={checkmarkCircleOutline} />
              </div>
              <span className="rp-tile__label">Aprobado</span>
              <span className="rp-tile__value">
                {formatClp(availableClp)}
              </span>
            </div>

            <div className="rp-tile rp-tile--warn">
              <div className="rp-tile__icon" aria-hidden>
                <IonIcon icon={timeOutline} />
              </div>
              <span className="rp-tile__label">Pendiente</span>
              <span className="rp-tile__value">
                {formatClp(pendingTotalClp)}
              </span>
            </div>
          </div>

          <h2 className="rapago-section-label">
            Solicitudes por pago de más
          </h2>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
              <IonSpinner color="warning" />
            </div>
          ) : requests.length === 0 ? (
            <div className="rp-empty">
              <div className="rp-empty__icon" aria-hidden>
                <IonIcon icon={cashOutline} />
              </div>
              <h3 className="rp-empty__title">Sin solicitudes</h3>
              <p className="rp-empty__body">
                Después de completar un viaje en efectivo podrás informar
                cuánto pagaste y solicitar conservar la diferencia.
              </p>
            </div>
          ) : (
            requests.map((request) => {
              const info = statusInfo(request.status);
              return (
                <article className="rp-card" key={request.id}>
                  <div className="rp-card__row">
                    <div className="rp-card__main">
                      <h3 className="rp-card__title">
                        <IonIcon icon={info.icon} aria-hidden />
                        Pago de más en efectivo
                      </h3>
                      <p className="rp-card__amount">
                        {formatClp(benefitAmount(request))}
                      </p>
                    </div>
                    <IonBadge color={info.color}>{info.label}</IonBadge>
                  </div>

                  <div className="rp-card__meta">
                    <div>
                      Tarifa: <strong>{formatClp(request.fareClp)}</strong>
                    </div>
                    <div>
                      Pagado: <strong>{formatClp(request.paidClp)}</strong>
                    </div>
                  </div>

                  <p className="rp-card__foot">
                    Solicitado: {formatDate(request.requestedAt)}
                  </p>

                  {request.adminDecisionReason && (
                    <p className="rp-card__quote">
                      <strong>Respuesta del administrador:</strong>{" "}
                      {request.adminDecisionReason}
                    </p>
                  )}
                </article>
              );
            })
          )}

          <h2 className="rapago-section-label">Devoluciones bancarias</h2>

          {refunds.length === 0 ? (
            <div className="rp-empty">
              <div className="rp-empty__icon" aria-hidden>
                <IonIcon icon={cashOutline} />
              </div>
              <p className="rp-empty__body">
                Las devoluciones de dinero pagado de más en efectivo
                aparecerán aquí.
              </p>
            </div>
          ) : (
            refunds.map((refund) => {
              const info = refundStatusInfo(refund.status);
              const amount = refund.approvedAmountClp ?? refund.requestedAmountClp;
              return (
                <article className="rp-card" key={refund.id}>
                  <div className="rp-card__row">
                    <div className="rp-card__main">
                      <h3 className="rp-card__title">
                        Devolución a cuenta bancaria
                      </h3>
                      <p className="rp-card__amount">{formatClp(amount)}</p>
                    </div>
                    <IonBadge color={info.color}>{info.label}</IonBadge>
                  </div>

                  <p className="rp-card__foot">
                    {refund.bankAccount.bankName} · ••••{" "}
                    {refund.bankAccount.accountNumberLast4}
                  </p>
                  <p className="rp-card__foot" style={{ marginTop: 4 }}>
                    Solicitada: {formatDate(refund.requestedAt)}
                  </p>

                  {refund.transferReference && (
                    <p className="rp-card__ok">
                      Comprobante: {refund.transferReference}
                    </p>
                  )}
                  {refund.adminDecisionReason && (
                    <p className="rp-card__quote">
                      <strong>Respuesta:</strong> {refund.adminDecisionReason}
                    </p>
                  )}
                </article>
              );
            })
          )}

          <h2
            style={{
              color: "#fff",
              fontSize: "1.05rem",
              fontWeight: 950,
              margin: "24px 4px 12px",
            }}
          >
            Devoluciones bancarias
          </h2>

          {refunds.length === 0 ? (
            <IonCard
              style={{
                margin: 0,
                borderRadius: 24,
                background: "rgba(255,255,255,.96)",
              }}
            >
              <IonCardContent style={{ textAlign: "center", padding: 22 }}>
                <IonIcon icon={cashOutline} style={{ fontSize: 34, color: "#B7791F" }} />
                <p style={{ margin: "8px 0 0", color: "#655B50", lineHeight: 1.45 }}>
                  Las devoluciones de dinero pagado de más en efectivo aparecerán aquí.
                </p>
              </IonCardContent>
            </IonCard>
          ) : (
            refunds.map((refund) => {
              const info = refundStatusInfo(refund.status);
              const amount = refund.approvedAmountClp ?? refund.requestedAmountClp;
              return (
                <IonCard
                  key={refund.id}
                  style={{
                    margin: "0 0 12px",
                    borderRadius: 24,
                    background: "rgba(255,255,255,.97)",
                  }}
                >
                  <IonCardContent>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 950 }}>Devolución a cuenta bancaria</div>
                        <div style={{ fontSize: "1.2rem", fontWeight: 950, marginTop: 7 }}>
                          {formatClp(amount)}
                        </div>
                      </div>
                      <IonBadge color={info.color}>{info.label}</IonBadge>
                    </div>
                    <p style={{ margin: "12px 0 0", color: "#5F564B", fontSize: ".8rem" }}>
                      {refund.bankAccount.bankName} · •••• {refund.bankAccount.accountNumberLast4}
                    </p>
                    <p style={{ margin: "6px 0 0", color: "#6B6257", fontSize: ".78rem" }}>
                      Solicitada: {formatDate(refund.requestedAt)}
                    </p>
                    {refund.transferReference && (
                      <p style={{ margin: "8px 0 0", color: "#14532D", fontSize: ".8rem", fontWeight: 850 }}>
                        Comprobante: {refund.transferReference}
                      </p>
                    )}
                    {refund.adminDecisionReason && (
                      <p style={{ margin: "9px 0 0", padding: "9px 11px", borderRadius: 14, background: "#F5F1EA", color: "#463D34", fontSize: ".8rem" }}>
                        <strong>Respuesta:</strong> {refund.adminDecisionReason}
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
