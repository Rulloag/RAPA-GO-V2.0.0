import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonText,
} from "@ionic/react";
import {
  checkmarkCircleOutline,
  closeCircleOutline,
  eyeOutline,
  refreshOutline,
} from "ionicons/icons";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../features/auth/index.js";
import {
  cashRefundsService,
  type CashOverpaymentRefundData,
  type CashRefundTransferDetails,
} from "../../features/cashRefunds/cashRefunds.service.js";

function formatClp(value: number | null | undefined): string {
  return `$${Math.max(0, Math.round(Number(value ?? 0))).toLocaleString("es-CL")} CLP`;
}

function statusLabel(status: string): string {
  if (status === "approved_for_transfer") return "Aprobada para transferir";
  if (status === "completed") return "Transferida";
  if (status === "rejected") return "Rechazada";
  return "Pendiente de revisión";
}

function statusColor(status: string): "warning" | "success" | "danger" | "medium" {
  if (status === "approved_for_transfer" || status === "completed") return "success";
  if (status === "rejected") return "danger";
  if (status === "pending_admin_review") return "warning";
  return "medium";
}

export function CashOverpaymentRefundAdminPanel(): JSX.Element {
  const { session } = useAuth();
  const [items, setItems] = useState<CashOverpaymentRefundData[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<CashRefundTransferDetails | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await cashRefundsService.listForAdmin(session.accessToken);
      setItems(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar las devoluciones.",
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function showTransferDetails(item: CashOverpaymentRefundData): Promise<void> {
    if (!session?.accessToken) return;
    setBusyId(item.id);
    setError(null);
    try {
      const details = await cashRefundsService.getTransferDetails(
        session.accessToken,
        item.id,
      );
      setTransfer(details);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No se pudieron abrir los datos bancarios.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function approve(item: CashOverpaymentRefundData): Promise<void> {
    if (!session?.accessToken) return;
    const amountText = window.prompt(
      "Monto que se aprobará para devolución (CLP):",
      String(item.requestedAmountClp),
    );
    if (amountText === null) return;
    const amount = Math.round(Number(amountText.replace(/[^\d]/g, "")));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ingresa un monto válido.");
      return;
    }
    const reason = window.prompt("Observación administrativa opcional:", "") ?? "";

    setBusyId(item.id);
    setError(null);
    try {
      await cashRefundsService.approve(session.accessToken, item.id, {
        approvedAmountClp: amount,
        adminDecisionReason: reason.trim() || undefined,
      });
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo aprobar la devolución.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reject(item: CashOverpaymentRefundData): Promise<void> {
    if (!session?.accessToken) return;
    const reason = window.prompt("Motivo obligatorio del rechazo:", "");
    if (!reason?.trim()) return;

    setBusyId(item.id);
    setError(null);
    try {
      await cashRefundsService.reject(session.accessToken, item.id, reason.trim());
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo rechazar la devolución.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function complete(item: CashOverpaymentRefundData): Promise<void> {
    if (!session?.accessToken) return;
    const reference = window.prompt(
      "Referencia o número de comprobante de la transferencia:",
      "",
    );
    if (!reference?.trim()) return;
    const proofUrl = window.prompt("URL del comprobante (opcional):", "") ?? "";

    setBusyId(item.id);
    setError(null);
    try {
      await cashRefundsService.complete(session.accessToken, item.id, {
        transferReference: reference.trim(),
        transferProofUrl: proofUrl.trim() || undefined,
      });
      setTransfer(null);
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo cerrar la devolución.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ maxWidth: 850, margin: "0 auto", paddingBottom: 80 }}>
      <IonRefresher
        slot="fixed"
        onIonRefresh={(event) => {
          void load().finally(() => event.detail.complete());
        }}
      >
        <IonRefresherContent />
      </IonRefresher>

      <IonCard style={{ borderRadius: 22, margin: "0 0 14px" }}>
        <IonCardContent>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Devoluciones por pago de más</h2>
              <p style={{ margin: "6px 0 0", color: "var(--ion-color-medium)", fontSize: ".82rem" }}>
                Revisa, aprueba y registra la transferencia bancaria. El número completo solo se descifra al abrir el detalle y nunca se guarda en el navegador.
              </p>
            </div>
            <IonButton fill="clear" onClick={() => void load()} disabled={loading}>
              <IonIcon slot="icon-only" icon={refreshOutline} />
            </IonButton>
          </div>
        </IonCardContent>
      </IonCard>

      {error && (
        <IonCard color="danger" style={{ borderRadius: 18 }}>
          <IonCardContent><strong>{error}</strong></IonCardContent>
        </IonCard>
      )}

      {transfer && (
        <IonCard style={{ borderRadius: 22, border: "2px solid var(--ion-color-warning)" }}>
          <IonCardContent>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <strong>Datos bancarios para transferencia</strong>
                <div style={{ marginTop: 10, lineHeight: 1.55 }}>
                  Titular: <strong>{transfer.holderName}</strong><br />
                  Banco: <strong>{transfer.bankName}</strong><br />
                  Tipo: <strong>{transfer.accountType}</strong><br />
                  Número: <strong>{transfer.accountNumber}</strong><br />
                  Monto: <strong>{formatClp(transfer.amountClp)}</strong>
                </div>
              </div>
              <IonButton fill="clear" color="medium" onClick={() => setTransfer(null)}>
                Ocultar
              </IonButton>
            </div>
          </IonCardContent>
        </IonCard>
      )}

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: 40 }}>
          <IonSpinner />
        </div>
      ) : items.length === 0 ? (
        <IonCard style={{ borderRadius: 22 }}>
          <IonCardContent style={{ textAlign: "center", padding: 30 }}>
            <IonText color="medium">No existen solicitudes de devolución bancaria.</IonText>
          </IonCardContent>
        </IonCard>
      ) : (
        items.map((item) => (
          <IonCard key={item.id} style={{ borderRadius: 22, margin: "0 0 12px" }}>
            <IonCardContent>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{item.ownerName ?? item.ownerEmail ?? item.ownerUserId}</div>
                  <div style={{ marginTop: 5, fontSize: "1.2rem", fontWeight: 950 }}>
                    {formatClp(item.approvedAmountClp ?? item.requestedAmountClp)}
                  </div>
                </div>
                <IonBadge color={statusColor(item.status)}>{statusLabel(item.status)}</IonBadge>
              </div>

              <div style={{ marginTop: 12, fontSize: ".82rem", lineHeight: 1.55 }}>
                Viaje: <strong>{item.sourceRideId}</strong><br />
                Tarifa: <strong>{formatClp(item.fareClp)}</strong> · Pagado: <strong>{formatClp(item.paidClp)}</strong><br />
                Cuenta: <strong>{item.bankAccount.bankName} · •••• {item.bankAccount.accountNumberLast4}</strong>
              </div>

              {item.requestReason && (
                <p style={{ margin: "10px 0 0", padding: 10, background: "#F5F1EA", borderRadius: 12 }}>
                  <strong>Motivo:</strong> {item.requestReason}
                </p>
              )}

              {item.transferReference && (
                <p style={{ margin: "10px 0 0", color: "var(--ion-color-success-shade)" }}>
                  <strong>Comprobante:</strong> {item.transferReference}
                </p>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                <IonButton
                  size="small"
                  fill="outline"
                  disabled={busyId === item.id}
                  onClick={() => void showTransferDetails(item)}
                >
                  <IonIcon slot="start" icon={eyeOutline} />
                  Ver cuenta
                </IonButton>

                {item.status === "pending_admin_review" && (
                  <>
                    <IonButton
                      size="small"
                      color="success"
                      disabled={busyId === item.id}
                      onClick={() => void approve(item)}
                    >
                      <IonIcon slot="start" icon={checkmarkCircleOutline} />
                      Aprobar
                    </IonButton>
                    <IonButton
                      size="small"
                      color="danger"
                      fill="outline"
                      disabled={busyId === item.id}
                      onClick={() => void reject(item)}
                    >
                      <IonIcon slot="start" icon={closeCircleOutline} />
                      Rechazar
                    </IonButton>
                  </>
                )}

                {item.status === "approved_for_transfer" && (
                  <IonButton
                    size="small"
                    color="success"
                    disabled={busyId === item.id}
                    onClick={() => void complete(item)}
                  >
                    Registrar transferencia
                  </IonButton>
                )}
              </div>
            </IonCardContent>
          </IonCard>
        ))
      )}
    </div>
  );
}
