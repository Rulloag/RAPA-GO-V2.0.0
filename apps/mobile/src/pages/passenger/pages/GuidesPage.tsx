import {
  IonBadge, IonButton, IonCard, IonCardContent, IonChip, IonContent, IonHeader,
  IonIcon, IonInput, IonItem, IonLabel, IonModal, IonPage, IonRefresher, IonRefresherContent,
  IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonText, IonTextarea, IonTitle, IonToast, IonToolbar,
} from "@ionic/react";
import { useState, useCallback, useEffect } from "react";
import { chevronForwardOutline } from "ionicons/icons";
import { compassOutline } from "ionicons/icons";
import { EmptyState } from "../../../components/EmptyState.js";
import { SkeletonList } from "../../../components/SkeletonCard.js";
import { useAuth } from "../../../features/auth/index.js";
import { touristService, type GuidePublicData, type TouristServiceData } from "../../../features/tourist/tourist.service.js";
import { useIonViewWillEnter } from "@ionic/react";
import { LANG_LABEL, SERVICE_TYPE_LABEL } from "../shared.js";

export default function GuidesPage(): JSX.Element {
  const { session } = useAuth();
  const [guides,        setGuides]        = useState<GuidePublicData[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState<string | null>(null);
  const [searchName,    setSearchName]    = useState("");
  const [filterLang,    setFilterLang]    = useState("");
  const [selectedGuide, setSelectedGuide] = useState<GuidePublicData | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const filters: { name?: string; language?: string } = {};
      if (searchName.trim()) filters.name = searchName.trim();
      if (filterLang) filters.language = filterLang;
      const data = await touristService.listGuides(session.accessToken, filters);
      setGuides(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar guías.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, searchName, filterLang]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  if (selectedGuide) {
    return <GuideDetailPage guide={selectedGuide} onBack={() => setSelectedGuide(null)} />;
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Guías locales</IonTitle>
        </IonToolbar>
        <IonToolbar style={{ "--background": "var(--ion-color-primary)", "--border-width": "0" }}>
          <div style={{ padding: "0 12px 10px" }}>
            <IonSearchbar value={searchName} onIonInput={(e) => setSearchName(String(e.detail.value ?? ""))}
              onIonChange={() => void load()} placeholder="Buscar guía..." debounce={400}
              style={{ "--background": "rgba(255,255,255,0.15)", "--color": "#fff", "--placeholder-color": "rgba(255,255,255,0.7)", "--icon-color": "rgba(255,255,255,0.8)", padding: 0 }}
            />
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "2px" }}>
              {(["", "es", "en", "rapa_nui"] as const).map((lang) => (
                <IonChip key={lang}
                  aria-label={`Filtrar por idioma: ${lang === "" ? "Todos" : LANG_LABEL[lang] ?? lang}`}
                  style={{
                    flexShrink: 0,
                    "--background": filterLang === lang ? "#fff" : "rgba(255,255,255,0.2)",
                    "--color": filterLang === lang ? "var(--ion-color-primary)" : "#fff",
                    fontSize: "0.76rem", height: "36px",
                    fontWeight: filterLang === lang ? 700 : 400,
                  }}
                  onClick={() => setFilterLang(lang)}
                >
                  {lang === "" ? "Todos" : LANG_LABEL[lang] ?? lang}
                </IonChip>
              ))}
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && <SkeletonList count={4} height="120px" />}
        {loadError && <div style={{ padding: "16px" }}><IonText color="danger"><p>{loadError}</p></IonText></div>}

        {!loading && guides.length === 0 && (
          <EmptyState icon={compassOutline} title="Sin guías disponibles" subtitle="Vuelve a intentarlo más tarde" />
        )}

        {!loading && guides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px 16px 80px" }}>
            {guides.map((guide) => {
              const initials = guide.name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase();
              const rating   = guide.ratingAverage ?? 0;
              return (
                <IonCard key={guide.id} className="ion-activatable"
                  aria-label={`Guía ${guide.name}, ${rating > 0 ? rating.toFixed(1) : "sin calificaciones"} estrellas, idiomas: ${(guide.languages ?? []).join(", ")}`}
                  style={{ margin: 0, borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", cursor: "pointer", overflow: "hidden" }}
                  onClick={() => setSelectedGuide(guide)}
                >
                  <IonCardContent style={{ padding: "16px" }}>
                    <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                      <div style={{
                        width: "60px", height: "60px", borderRadius: "50%", flexShrink: 0,
                        background: "var(--ion-color-warning-tint)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: "2px solid var(--ion-color-warning)",
                      }}>
                        <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--ion-color-warning-shade)" }}>
                          {initials || "G"}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: "1rem" }}>{guide.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                          {[1,2,3,4,5].map((n) => (
                            <span key={n} style={{ fontSize: "0.85rem", color: n <= Math.round(rating) ? "#f4c430" : "var(--ion-color-light-shade)" }}>★</span>
                          ))}
                          <span style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginLeft: "4px" }}>
                            {rating > 0 ? rating.toFixed(1) : "Sin calificaciones"}{guide.ratingCount ? ` (${guide.ratingCount})` : ""}
                          </span>
                        </div>
                        {guide.bio && (
                          <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginTop: "4px", lineHeight: 1.4 }}>
                            {guide.bio.slice(0, 90)}{guide.bio.length > 90 ? "…" : ""}
                          </div>
                        )}
                        {(guide.languages ?? []).length > 0 && (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                            {(guide.languages ?? []).map((lang) => (
                              <IonChip key={lang} color="warning" style={{ fontSize: "0.68rem", height: "20px", margin: 0 }}>
                                <IonLabel>{LANG_LABEL[lang] ?? lang.toUpperCase()}</IonLabel>
                              </IonChip>
                            ))}
                          </div>
                        )}
                      </div>
                      <IonIcon icon={chevronForwardOutline} style={{ color: "var(--ion-color-medium)", fontSize: "1.1rem", flexShrink: 0, marginTop: "4px" }} />
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

function GuideDetailPage({ guide, onBack }: { guide: GuidePublicData; onBack: () => void }): JSX.Element {
  const { session } = useAuth();
  const [services,      setServices]      = useState<TouristServiceData[]>(guide.services ?? []);
  const [loading,       setLoading]       = useState(!guide.services);
  const [bookingService, setBookingService] = useState<TouristServiceData | null>(null);
  const [bookingDate,   setBookingDate]   = useState(new Date().toISOString().slice(0, 10));
  const [bookingTime,   setBookingTime]   = useState("");
  const [numPeople,     setNumPeople]     = useState(1);
  const [notes,         setNotes]         = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [toastMsg,      setToastMsg]      = useState<string | null>(null);
  const [pricingData,   setPricingData]   = useState<import("../../../features/tourist/tourist.service.js").ServicePricingData | null>(null);

  useEffect(() => {
    if (guide.services) return;
    if (!session?.accessToken) return;
    setLoading(true);
    touristService.listGuideServices(session.accessToken, guide.id)
      .then(setServices).catch(() => setServices([])).finally(() => setLoading(false));
  }, [guide.id, guide.services, session?.accessToken]);

  useEffect(() => {
    if (!bookingService || !session?.accessToken) return;
    touristService.getServicePricing(session.accessToken, bookingService.id)
      .then(setPricingData).catch(() => setPricingData(null));
  }, [bookingService?.id, session?.accessToken]);

  const initials = guide.name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase();
  const stars    = guide.ratingAverage ? Math.round(guide.ratingAverage) : 0;

  const LANG_LABEL_DETAIL: Record<string, string> = { es: "🇨🇱 Español", en: "🇺🇸 English", rapa_nui: "🗿 Rapa Nui" };

  function computePrice(): { display: string; valid: boolean } {
    if (!bookingService) return { display: "", valid: false };
    if (pricingData && pricingData.tiers.length > 0) {
      const tier = pricingData.tiers.find((t) => t.minPeople <= numPeople && t.maxPeople >= numPeople);
      if (tier) return { display: `$${(tier.price / 100).toLocaleString("es-CL")} CLP`, valid: true };
      return { display: `Contactar operador para grupos de ${numPeople} personas`, valid: false };
    }
    if (bookingService.price !== null) return { display: `$${((bookingService.price * numPeople) / 100).toLocaleString("es-CL")} CLP`, valid: true };
    return { display: "", valid: true };
  }

  async function handleBook() {
    if (!session?.accessToken || !bookingService) return;
    setSubmitting(true);
    try {
      const input: import("../../../features/tourist/tourist.service.js").CreateBookingInput = {
        serviceId: bookingService.id, bookingDate, numberOfPeople: numPeople,
      };
      if (bookingTime)    input.bookingTime = bookingTime;
      if (notes.trim())   input.notes = notes.trim();
      await touristService.createBooking(session.accessToken, input);
      setToastMsg("Reserva creada correctamente.");
      setBookingService(null); setNotes(""); setNumPeople(1); setPricingData(null);
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "Error al reservar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButton slot="start" fill="clear" color="light" onClick={onBack}>
            <IonIcon slot="icon-only" icon={chevronForwardOutline} style={{ transform: "rotate(180deg)" }} />
          </IonButton>
          <IonTitle>Perfil del guía</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{
          background: "linear-gradient(145deg, var(--ion-color-warning-shade) 0%, var(--ion-color-warning) 100%)",
          padding: "28px 20px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
        }}>
          <div style={{ width: "84px", height: "84px", borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "3px solid rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "1.8rem" }}>
            {initials || "G"}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: "1.15rem" }}>{guide.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {[1,2,3,4,5].map((n) => <span key={n} style={{ fontSize: "1rem", color: n <= stars ? "#fff" : "rgba(255,255,255,0.4)" }}>★</span>)}
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.8rem", marginLeft: "4px" }}>
              {guide.ratingAverage ? guide.ratingAverage.toFixed(1) : "Sin calificaciones"}
              {guide.ratingCount ? ` · ${guide.ratingCount} valoraciones` : ""}
            </span>
          </div>
          {(guide.languages ?? []).length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
              {(guide.languages ?? []).map((lang) => (
                <span key={lang} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", borderRadius: "12px", padding: "2px 10px", fontSize: "0.72rem", fontWeight: 600 }}>
                  {LANG_LABEL_DETAIL[lang] ?? lang.toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 16px 80px" }}>
          {guide.bio && (
            <IonCard style={{ margin: "0 0 16px", borderRadius: "14px" }}>
              <IonCardContent style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--ion-color-medium)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sobre mí</div>
                <div style={{ fontSize: "0.88rem", lineHeight: 1.6 }}>{guide.bio}</div>
              </IonCardContent>
            </IonCard>
          )}

          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "12px" }}>Servicios disponibles</div>

          {loading && <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}><IonSpinner name="crescent" /></div>}

          {!loading && services.length === 0 && (
            <EmptyState icon={compassOutline} title="Sin servicios activos" subtitle="Este guía no tiene servicios publicados aún" />
          )}

          {!loading && services.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {services.map((svc) => {
                const priceDisplay = svc.price !== null ? `$${(svc.price / 100).toLocaleString("es-CL")} CLP/persona` : "Consultar precio";
                return (
                  <IonCard key={svc.id} style={{ margin: 0, borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                    <IonCardContent style={{ padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", flex: 1 }}>{svc.title}</div>
                        <IonBadge color="tertiary" style={{ fontSize: "0.65rem", marginLeft: "8px", flexShrink: 0 }}>
                          {SERVICE_TYPE_LABEL[svc.type] ?? svc.type}
                        </IonBadge>
                      </div>
                      {svc.description && <div style={{ fontSize: "0.8rem", color: "var(--ion-color-medium)", marginBottom: "10px", lineHeight: 1.4 }}>{svc.description}</div>}
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "0.78rem", color: "var(--ion-color-medium)", marginBottom: "8px" }}>
                        {svc.durationMinutes && <span>⏱ {svc.durationMinutes} min</span>}
                        {svc.maxPeople && <span>👥 Máx {svc.maxPeople}</span>}
                        {svc.meetingPoint && <span>📍 {svc.meetingPoint}</span>}
                        <span style={{ color: svc.includesVehicle ? "var(--ion-color-primary)" : "var(--ion-color-medium)" }}>
                          🚗 {svc.includesVehicle ? "Incluye vehículo" : "Sin vehículo"}
                        </span>
                      </div>
                      {(svc.includes ?? []).length > 0 && (
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
                          {(svc.includes ?? []).map((inc) => (
                            <span key={inc} style={{ background: "var(--ion-color-success-tint)", color: "var(--ion-color-success-shade)", borderRadius: "10px", padding: "2px 8px", fontSize: "0.7rem" }}>✓ {inc}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                        <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--ion-color-success)" }}>{priceDisplay}</div>
                        <IonButton size="small" style={{ "--border-radius": "10px" }}
                          onClick={() => { setBookingService(svc); setBookingDate(new Date().toISOString().slice(0, 10)); }}>
                          Reservar
                        </IonButton>
                      </div>
                    </IonCardContent>
                  </IonCard>
                );
              })}
            </div>
          )}
        </div>

        <IonModal isOpen={bookingService !== null} onDidDismiss={() => setBookingService(null)}>
          <IonHeader>
            <IonToolbar color="primary">
              <IonTitle>Reservar servicio</IonTitle>
              <IonButton slot="end" fill="clear" color="light" onClick={() => setBookingService(null)}>Cerrar</IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {bookingService && (
              <>
                <div style={{ fontWeight: 600, marginBottom: "12px" }}>{bookingService.title}</div>
                <IonItem lines="full">
                  <IonLabel position="stacked">Fecha</IonLabel>
                  <IonInput type="date" value={bookingDate} min={new Date().toISOString().slice(0, 10)} onIonInput={(e) => setBookingDate(String(e.detail.value ?? ""))} />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Hora (opcional)</IonLabel>
                  <IonSelect interface="action-sheet" value={bookingTime} onIonChange={(e) => setBookingTime(String(e.detail.value ?? ""))} placeholder="Sin hora específica">
                    <IonSelectOption value="">Sin hora</IonSelectOption>
                    {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"].map((t) => <IonSelectOption key={t} value={t}>{t}</IonSelectOption>)}
                  </IonSelect>
                </IonItem>
                <IonItem lines="full">
                  <IonLabel position="stacked">Número de personas</IonLabel>
                  <IonInput type="number" value={numPeople} min={1} max={bookingService.maxPeople ?? 20}
                    onIonInput={(e) => setNumPeople(Math.max(1, parseInt(String(e.detail.value ?? "1"), 10)))} />
                </IonItem>
                <IonItem lines="none">
                  <IonLabel position="stacked">Notas (opcional)</IonLabel>
                  <IonTextarea value={notes} onIonInput={(e) => setNotes(String(e.detail.value ?? ""))} placeholder="Indicaciones especiales..." rows={3} maxlength={500} />
                </IonItem>
                {(() => {
                  const pr = computePrice();
                  return pr.display ? (
                    <div style={{ padding: "12px 0", fontWeight: 600, color: pr.valid ? "inherit" : "var(--ion-color-warning)" }}>
                      {pr.valid ? `Total estimado: ${pr.display}` : pr.display}
                    </div>
                  ) : null;
                })()}
                {pricingData?.conditions && <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginBottom: "6px" }}><strong>Condiciones:</strong> {pricingData.conditions}</div>}
                {pricingData?.cancellationPolicy && <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginBottom: "8px" }}><strong>Cancelación:</strong> {pricingData.cancellationPolicy}</div>}
                <IonButton expand="block" onClick={() => void handleBook()}
                  disabled={submitting || (pricingData !== null && pricingData.tiers.length > 0 && !pricingData.tiers.find((t) => t.minPeople <= numPeople && t.maxPeople >= numPeople))}
                  style={{ marginTop: "8px" }}>
                  {submitting ? <IonSpinner name="dots" /> : "Confirmar reserva"}
                </IonButton>
              </>
            )}
          </IonContent>
        </IonModal>

        <IonToast isOpen={toastMsg !== null} message={toastMsg ?? ""} duration={3000}
          onDidDismiss={() => setToastMsg(null)}
          color={toastMsg?.includes("Error") ? "danger" : "success"} />
      </IonContent>
    </IonPage>
  );
}
