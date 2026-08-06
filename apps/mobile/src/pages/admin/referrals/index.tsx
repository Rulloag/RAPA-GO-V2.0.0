import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  addOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  giftOutline,
} from "ionicons/icons";
import { useEffect, useState } from "react";
import { useAuth } from "../../../features/auth/index.js";
import { referralsService, type ReferralCodeData, type ReferralUseData } from "../../../features/referrals/referrals.service.js";
import { RapagoAppBar } from "../../../components/RapagoAppBar.js";
import { ROUTES } from "../../../navigation/routes.js";
import { useRapagoSectionTheme } from "../../../theme/rapagoTheme.js";

export function AdminReferralsPage(): JSX.Element {
  const { session } = useAuth();
  const { theme } = useRapagoSectionTheme("admin");

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
    <IonPage className="rapago-admin-page" data-rapago-theme={theme}>
      <RapagoAppBar
        sectionId="admin"
        title="Referidos"
        roleLabel="Administrador"
        backHref={ROUTES.ADMIN.MORE}
        backLabel="Volver a Más secciones"
        actionIcon={addOutline}
        actionLabel="Crear campaña de referidos"
        onAction={() => setShowCampaignModal(true)}
      />

      <IonContent>
        <div className="rp-admin-shell">
          {/* Resumen. Las cuatro cifras dejan de ser ion-card —que en este
              módulo va sobre superficie clara fija— y pasan a los tiles del
              sistema, así que siguen el tema como Beneficios y el Centro de
              ayuda. La rejilla es la del kit: se reacomoda sola. */}
          <div className="rp-tile-grid">
            {[
              { label: "Códigos activos", value: totalActive },
              { label: "Conversiones",    value: totalConversions },
              { label: "Recompensas pagadas", value: `$${totalRewards.toLocaleString("es-CL")} CLP` },
              { label: "Total códigos",   value: total },
            ].map(card => (
              <div key={card.label} className="rp-tile">
                <span className="rp-tile__label">{card.label}</span>
                <span className="rp-tile__value">{card.value}</span>
              </div>
            ))}
          </div>

          {loading && (
            <div className="rp-empty">
              <IonSpinner name="crescent" />
              <p className="rp-empty__body" style={{ marginTop: 10 }}>
                Cargando códigos…
              </p>
            </div>
          )}

          {error && (
            <div className="rp-banner rp-banner--error" role="alert">
              <IonIcon icon={alertCircleOutline} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Faltaba el estado vacío: sin códigos la pantalla mostraba cuatro
              ceros y nada más, sin decir qué hacer a continuación. */}
          {!loading && !error && codes.length === 0 && (
            <div className="rp-empty">
              <div className="rp-empty__icon">
                <IonIcon icon={giftOutline} aria-hidden="true" />
              </div>
              <h2 className="rp-empty__title">Aún no hay códigos</h2>
              <p className="rp-empty__body">
                Crea una campaña para empezar a repartir descuentos y medir
                cuántas invitaciones se convierten en viajes.
              </p>
              <IonButton
                className="rp-cta"
                style={{ marginTop: 14 }}
                onClick={() => setShowCampaignModal(true)}
              >
                <IonIcon icon={addOutline} slot="start" aria-hidden="true" />
                Crear campaña
              </IonButton>
            </div>
          )}

          {!loading && codes.map(code => (
            <article key={code.id} className="rp-card">
              <div className="rp-card__row">
                <div className="rp-card__main">
                  {/* El código va en monoespaciada porque se lee carácter a
                      carácter para dictarlo o compararlo. */}
                  <h3 className="rp-card__title" style={{ fontFamily: "monospace" }}>
                    {code.code}
                  </h3>
                  <p className="rp-card__foot" style={{ marginTop: 4 }}>
                    {code.ownerName ?? "Campaña"} · {code.type}
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <IonBadge color={code.isActive ? "success" : "medium"}>
                    {code.isActive ? "Activo" : "Inactivo"}
                  </IonBadge>
                </div>
              </div>

              <div className="rp-card__meta">
                <span>
                  Usos <strong>{code.usedCount}{code.maxUses ? `/${code.maxUses}` : ""}</strong>
                </span>
                <span>
                  Conversiones <strong>{code.conversionCount ?? 0}</strong>
                </span>
                <span>
                  Descuento{" "}
                  <strong>
                    {code.discountAmount ?? 0}
                    {code.discountType === "percentage" ? "%" : " CLP"}
                  </strong>
                </span>
              </div>

              <IonButton
                size="small"
                fill="outline"
                style={{ marginTop: 12 }}
                aria-label={`Ver usos del código ${code.code}`}
                onClick={() => void handleViewUses(code)}
              >
                Ver usos
              </IonButton>
            </article>
          ))}
        </div>

        {/* Uses modal */}
        <IonModal
          isOpen={showUses}
          className="rapago-admin-modal"
          onDidDismiss={() => setShowUses(false)}
        >
          <IonHeader>
            <IonToolbar className="rapago-modal-toolbar">
              <IonTitle>Usos — {selectedCode?.code}</IonTitle>
              <IonButtons slot="end">
                <IonButton className="rapago-modal-close" onClick={() => setShowUses(false)}>Cerrar</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="rapago-modal-content">
            <div className="rapago-modal-body" data-rapago-theme={theme}>
              <div className="rp-admin-modal-inner">
                {loadingUses && (
                  <div className="rp-empty">
                    <IonSpinner name="crescent" />
                    <p className="rp-empty__body" style={{ marginTop: 10 }}>
                      Cargando usos…
                    </p>
                  </div>
                )}

                {!loadingUses && uses.length === 0 && (
                  <div className="rp-empty">
                    <div className="rp-empty__icon">
                      <IonIcon icon={giftOutline} aria-hidden="true" />
                    </div>
                    <h2 className="rp-empty__title">Sin usos registrados</h2>
                    <p className="rp-empty__body">
                      Nadie ha canjeado este código todavía.
                    </p>
                  </div>
                )}

                {!loadingUses && uses.map(use => (
                  <article key={use.id} className="rp-card">
                    <h3 className="rp-card__title">
                      {use.referredUserName ?? "Usuario desconocido"}
                    </h3>
                    <p className="rp-card__foot" style={{ marginTop: 4 }}>
                      {use.referredUserEmail}
                    </p>

                    <div className="rp-card__meta">
                      <span>
                        Referido{" "}
                        <strong>
                          {new Date(use.referredAt).toLocaleDateString("es-CL")}
                        </strong>
                      </span>
                      {use.convertedAt && (
                        <span>
                          Convertido{" "}
                          <strong>
                            {new Date(use.convertedAt).toLocaleDateString("es-CL")}
                          </strong>
                        </span>
                      )}
                    </div>

                    {use.convertedAt ? (
                      <p className="rp-card__ok">
                        <IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />{" "}
                        Recompensa ${(use.rewardAmount ?? 0).toLocaleString("es-CL")} CLP
                      </p>
                    ) : (
                      /* Era `color: var(--ion-color-warning)` sobre la tarjeta
                         ivory: amarillo sobre crema, ~1,8:1. El token de aviso
                         tiene contraparte legible en los dos temas. */
                      <p
                        className="rp-card__ok"
                        style={{ color: "var(--rp-warn-fg)" }}
                      >
                        Pendiente de conversión
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </IonContent>
        </IonModal>

        {/* Campaign modal */}
        <IonModal
          isOpen={showCampaignModal}
          className="rapago-admin-modal"
          onDidDismiss={() => { setShowCampaignModal(false); setCampaignSuccess(null); setCampaignError(null); }}
        >
          <IonHeader>
            <IonToolbar className="rapago-modal-toolbar">
              <IonTitle>Crear campaña</IonTitle>
              <IonButtons slot="end">
                <IonButton className="rapago-modal-close" onClick={() => setShowCampaignModal(false)}>Cerrar</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="rapago-modal-content">
            <div className="rapago-modal-body" data-rapago-theme={theme}>
              <div className="rp-admin-modal-inner">
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

            {campaignError && (
              <div className="rp-banner rp-banner--error" role="alert">
                <IonIcon icon={alertCircleOutline} aria-hidden="true" />
                <span>{campaignError}</span>
              </div>
            )}

            {/* role="status" y no "alert": es una confirmación, no un fallo, y
                no debe interrumpir lo que el lector esté anunciando. */}
            {campaignSuccess && (
              <div className="rp-banner rp-banner--success" role="status">
                <IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />
                <span>{campaignSuccess}</span>
              </div>
            )}

            <IonButton
              expand="block"
              className="rp-cta"
              onClick={() => void handleCreateCampaign()}
              disabled={campaignLoading}
            >
              {campaignLoading ? <IonSpinner name="dots" /> : "Crear campaña"}
            </IonButton>
              </div>
            </div>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
