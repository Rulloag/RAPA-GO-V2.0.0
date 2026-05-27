import { IonBadge, IonButton, IonContent, IonHeader, IonNote, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonText, IonTitle, IonToolbar } from "@ionic/react";
import { useState, useCallback, useEffect } from "react";
import { walletOutline } from "ionicons/icons";
import { EmptyState } from "../../../components/EmptyState.js";
import { SkeletonList } from "../../../components/SkeletonCard.js";
import { useAuth } from "../../../features/auth/index.js";
import type { WalletData, TransactionData } from "../../../features/wallet/wallet.service.js";

const TX_TYPE_LABEL: Record<string, string> = { payment: "Débito", credit: "Crédito", refund: "Reembolso", topup: "Crédito" };
const TX_STATUS_COLOR: Record<string, string> = { completed: "success", pending: "warning", failed: "danger", cancelled: "medium" };

export default function WalletPage(): JSX.Element {
  const { session } = useAuth();
  const [wallet,       setWallet]       = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true); setLoadError(null);
    try {
      const { walletService } = await import("../../../features/wallet/wallet.service.js");
      const [w, tx] = await Promise.all([
        walletService.getMyWallet(session.accessToken),
        walletService.getMyTransactions(session.accessToken, 1, 20),
      ]);
      setWallet(w);
      setTransactions(tx.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar la billetera.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void load(); }, [load]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary"><IonTitle>Mi Billetera</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && <SkeletonList count={4} height="64px" />}
        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && wallet && (
          <div style={{ paddingBottom: "80px" }}>
            <div style={{ background: "linear-gradient(145deg, var(--ion-color-primary) 0%, var(--ion-color-primary-shade) 100%)", padding: "32px 24px 28px", textAlign: "center" }}>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.82rem", marginBottom: "6px" }}>Saldo disponible</div>
              <div style={{ color: "#fff", fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-1px" }}>
                ${(wallet.balance / 100).toLocaleString("es-CL")}
                <span style={{ fontSize: "1rem", fontWeight: 400, marginLeft: "6px", opacity: 0.8 }}>{wallet.currency}</span>
              </div>
              <div style={{ marginTop: "10px" }}>
                <IonBadge color={wallet.status === "active" ? "success" : "medium"} style={{ fontSize: "0.72rem" }}>
                  {wallet.status === "active" ? "✓ Billetera activa" : wallet.status}
                </IonBadge>
              </div>
            </div>

            <div style={{ padding: "16px 16px 0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "6px" }}>
                <IonButton expand="block" fill="outline" disabled style={{ "--border-radius": "12px" }}>↑ Recargar</IonButton>
                <IonButton expand="block" fill="outline" disabled style={{ "--border-radius": "12px" }}>↓ Retirar</IonButton>
              </div>
              <IonNote style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", display: "block", marginBottom: "20px", textAlign: "center" }}>
                Recarga y retiro disponibles próximamente
              </IonNote>

              <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "12px" }}>Movimientos</div>

              {transactions.length === 0 && <EmptyState icon={walletOutline} title="Sin movimientos" subtitle="Tus transacciones aparecerán aquí" />}

              {transactions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--ion-color-light-shade)", borderRadius: "14px", overflow: "hidden" }}>
                  {transactions.map((tx, idx) => {
                    const isDebit = tx.type === "payment";
                    const txIcon  = tx.type === "payment" ? "🚗" : tx.type === "refund" ? "↩️" : "💰";
                    return (
                      <div key={tx.id} style={{ background: "var(--ion-card-background, #fff)", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", borderBottom: idx < transactions.length - 1 ? "1px solid var(--ion-color-light-shade)" : "none" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0, background: isDebit ? "var(--ion-color-danger-tint)" : "var(--ion-color-success-tint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                          {txIcon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{TX_TYPE_LABEL[tx.type] ?? tx.type}</div>
                          {tx.description && <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</div>}
                          <div style={{ fontSize: "0.68rem", color: "var(--ion-color-medium)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                            {new Date(tx.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                            <IonBadge color={TX_STATUS_COLOR[tx.status] ?? "medium"} style={{ fontSize: "0.6rem" }}>{tx.status}</IonBadge>
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: "0.95rem", color: isDebit ? "var(--ion-color-danger)" : "var(--ion-color-success)", flexShrink: 0 }}>
                          {isDebit ? "−" : "+"}${(tx.amount / 100).toLocaleString("es-CL")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
