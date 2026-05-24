import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBadge,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { useAuth } from "../../../features/auth/index.js";
import { referralsService, type ReferralCodeData, type ReferralUseData } from "../../../features/referrals/referrals.service.js";

export function AdminReferralsPage(): JSX.Element {
  const { session } = useAuth();

  const [codes,    setCodes]    = useState<ReferralCodeData[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [selectedCode, setSelectedCode] = useState<ReferralCodeData | null>(null);
  const [uses,         setUses]         = useState<ReferralUseData[]>([]);
  const [loadingUses,  setLoadingUses]  = useState(false);
  const [showUses,     setShowUses]     = useState(false);

  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignCode,       setCampaignCode]       = useState("");
  const [campaignType,       setCampaignType]       = useState<"promo" | "partner">("promo");
  const [campaignDiscount,   setCampaignDiscount]   = useState("");
  const [campaignDiscountType, setCampaignDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
  const [campaignMaxUses,    setCampaignMaxUses]    = useState("");
  const [campaignExpires,    setCampaignExpires]    = useState("");
  const [campaignLoading,    setCampaignLoading]    = useState(false);
  const [campaignError,      setCampaignError]      = useState<string | null>(null);
  const [campaignSuccess,    setCampaignSuccess]    = useState<string | null>(null);

  useEffect(() => {
    void loadCodes();
  }, [session?.accessToken]);

  async function loadCodes() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await referralsService.adminListCodes(session.accessToken);
      setCodes(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar códigos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleViewUses(code: ReferralCodeData) {
    if (!session?.accessToken) return;
    setSelectedCode(code);
    setShowUses(true);
    setLoadingUses(true);
    try {
      const items = await referralsService.adminListUses(session.accessToken, code.id);
      setUses(items);
    } catch { setUses([]); } finally {
      setLoadingUses(false);
    }
  }

  async function handleCreateCampaign() {
    if (!session?.accessToken) return;
    setCampaignError(null);
    setCampaignSuccess(null);
    if (!campaignCode || !campaignDiscount) {
      setCampaignError("Completa código y descuento.");
      return;
    }
    setCampaignLoading(true);
    try {
      const result = await referralsService.adminCreateCampaignCode(session.accessToken, {
        code:           campaignCode,
        type:           campaignType,
        discountAmount: Number(campaignDiscount),
        discountType:   campaignDiscountType,
        maxUses:        campaignMaxUses ? Number(campaignMaxUses) : null,
        expiresAt:      campaignExpires || null,
      });
      setCampaignSuccess(`Código creado: ${result.code}`);
      void loadCodes();
    } catch (err) {
      setCampaignError(err instanceof Error ? err.message : "Error al crear campaña.");
    } finally {
      setCampaignLoading(false);
    }
  }

  const totalActive      = codes.filter(c => c.isActive).length;
  const totalConversions = codes.reduce((s, c) => s + (c.conversionCount ?? 0), 0);
  const totalRewards     = codes.reduce((s, c) => s + (c.totalReward ?? 0), 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Referidos</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowCampaignModal(true)}>+ Campaña</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          {[
            { label: "Códigos activos", value: totalActive },
            { label: "Conversiones",    value: totalConversions },
            { label: "Recompensas pagadas", value: `$${totalRewards.toLocaleString("es-CL")} CLP` },
            { label: "Total códigos",   value: total },
          ].map(card => (
            <IonCard key={card.label} style={{ margin: 0 }}>
              <IonCardContent style={{ textAlign: "center", padding: "12px 8px" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>{card.value}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)" }}>{card.label}</div>
              </IonCardContent>
            </IonCard>
          ))}
        </div>

        {loading && <div style={{ textAlign: "center", padding: "40px" }}><IonSpinner name="crescent" /></div>}
        {error && <IonText color="danger"><p>{error}</p></IonText>}

        {!loading && codes.map(code => (
          <IonCard key={code.id} style={{ marginBottom: "10px" }}>
            <IonCardContent>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "monospace", fontSize: "1rem", fontWeight: "bold" }}>{code.code}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>
                    {code.ownerName ?? "Campaña"} · {code.type}
                  </div>
                  <div style={{ fontSize: "0.75rem", marginTop: "4px" }}>
                    Usos: {code.usedCount}{code.maxUses ? `/${code.maxUses}` : ""} · Conv: {code.conversionCount ?? 0}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                  <IonBadge color={code.isActive ? "success" : "medium"}>
                    {code.isActive ? "Activo" : "Inactivo"}
                  </IonBadge>
                  <div style={{ fontSize: "0.75rem" }}>
                    Desc: {code.discountAmount ?? 0}{code.discountType === "percentage" ? "%" : " CLP"}
                  </div>
                </div>
              </div>
              <IonButton size="small" fill="outline" style={{ marginTop: "8px" }}
                onClick={() => void handleViewUses(code)}
              >
                Ver usos
              </IonButton>
            </IonCardContent>
          </IonCard>
        ))}

        {/* Uses modal */}
        <IonModal isOpen={showUses} onDidDismiss={() => setShowUses(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle style={{ fontSize: "0.95rem" }}>Usos — {selectedCode?.code}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowUses(false)}>Cerrar</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {loadingUses && <div style={{ textAlign: "center" }}><IonSpinner name="dots" /></div>}
            {!loadingUses && uses.length === 0 && (
              <IonText color="medium"><p>No hay usos registrados.</p></IonText>
            )}
            {!loadingUses && uses.map(use => (
              <IonCard key={use.id} style={{ marginBottom: "8px" }}>
                <IonCardContent style={{ fontSize: "0.82rem" }}>
                  <div><strong>{use.referredUserName ?? "Usuario desconocido"}</strong></div>
                  <div style={{ color: "var(--ion-color-medium)" }}>{use.referredUserEmail}</div>
                  <div>Referido: {new Date(use.referredAt).toLocaleDateString("es-CL")}</div>
                  {use.convertedAt && (
                    <div>Convertido: {new Date(use.convertedAt).toLocaleDateString("es-CL")} · ${(use.rewardAmount ?? 0).toLocaleString("es-CL")} CLP</div>
                  )}
                  {!use.convertedAt && <div style={{ color: "var(--ion-color-warning)" }}>Pendiente conversión</div>}
                </IonCardContent>
              </IonCard>
            ))}
          </IonContent>
        </IonModal>

        {/* Campaign modal */}
        <IonModal isOpen={showCampaignModal} onDidDismiss={() => { setShowCampaignModal(false); setCampaignSuccess(null); setCampaignError(null); }}>
          <IonHeader>
            <IonToolbar>
              <IonTitle style={{ fontSize: "0.95rem" }}>Crear campaña</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowCampaignModal(false)}>Cerrar</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">Código</IonLabel>
              <IonInput value={campaignCode} onIonInput={e => setCampaignCode(String(e.detail.value ?? ""))} placeholder="VERANO2024" maxlength={20} />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Tipo</IonLabel>
              <IonSelect interface="action-sheet" value={campaignType} onIonChange={e => setCampaignType(e.detail.value as "promo" | "partner")}>
                <IonSelectOption value="promo">Promocional</IonSelectOption>
                <IonSelectOption value="partner">Partner</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Tipo de descuento</IonLabel>
              <IonSelect interface="action-sheet" value={campaignDiscountType} onIonChange={e => setCampaignDiscountType(e.detail.value as "percentage" | "fixed_amount")}>
                <IonSelectOption value="percentage">Porcentaje (%)</IonSelectOption>
                <IonSelectOption value="fixed_amount">Monto fijo (CLP)</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Descuento</IonLabel>
              <IonInput type="number" value={campaignDiscount} onIonInput={e => setCampaignDiscount(String(e.detail.value ?? ""))} placeholder="10" />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Máximo usos (vacío = ilimitado)</IonLabel>
              <IonInput type="number" value={campaignMaxUses} onIonInput={e => setCampaignMaxUses(String(e.detail.value ?? ""))} placeholder="100" />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Fecha expiración (opcional)</IonLabel>
              <IonInput type="date" value={campaignExpires} onIonInput={e => setCampaignExpires(String(e.detail.value ?? ""))} />
            </IonItem>

            {campaignError && <IonText color="danger"><p style={{ margin: "8px 0 0" }}>{campaignError}</p></IonText>}
            {campaignSuccess && <IonText color="success"><p style={{ margin: "8px 0 0" }}>{campaignSuccess}</p></IonText>}

            <IonButton expand="block" style={{ marginTop: "16px" }}
              onClick={() => void handleCreateCampaign()}
              disabled={campaignLoading}
            >
              {campaignLoading ? <IonSpinner name="dots" /> : "Crear campaña"}
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
