import {
  IonBadge, IonButton, IonChip, IonContent, IonHeader,
  IonIcon, IonInput, IonItem, IonLabel, IonModal, IonPage, IonRefresher, IonRefresherContent,
  IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonTextarea, IonTitle, IonToast, IonToolbar,
} from "@ionic/react";
import { useState, useCallback, useEffect } from "react";
import {
  alertCircleOutline,
  carOutline,
  checkmarkOutline,
  chevronForwardOutline,
  compassOutline,
  locationOutline,
  peopleOutline,
  timeOutline,
} from "ionicons/icons";
import { SkeletonList } from "../../../components/SkeletonCard.js";
import { RapagoSectionHeader } from "../../../components/RapagoSectionHeader.js";
import { useRapagoSectionTheme } from "../../../theme/rapagoTheme.js";
import { useAuth } from "../../../features/auth/index.js";
import { touristService, type GuidePublicData, type TouristServiceData } from "../../../features/tourist/tourist.service.js";
import { useIonViewWillEnter } from "@ionic/react";
import { LANG_LABEL, SERVICE_TYPE_LABEL } from "../shared.js";

/* Guías todavía no tiene id propio en `RapagoSection`, y añadirlo es tocar
   rapagoTheme.ts. Se reutiliza "trips" porque lo que decide el tema es el
   ÁMBITO (`passenger`), compartido por todas las pantallas del pasajero: con
   cualquier id de ese grupo la pantalla lee y escribe la misma preferencia. */
const SECCION_TEMA = "trips" as const;

/* Iconografía de la ficha de servicio. Antes eran emojis (⏱ 👥 📍 🚗), que el
   SO pinta con su propia paleta: no heredaban el color del tema y en modo día
   quedaban como manchas de color ajenas a la marca. */
const META_ICON_STYLE = { fontSize: "1em", flexShrink: 0 } as const;

export default function GuidesPage(): JSX.Element {
  const { session } = useAuth();
  // Solo se lee: el interruptor único vive en el encabezado de Inicio.
  const { theme } = useRapagoSectionTheme(SECCION_TEMA);
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
    <IonPage className="rapago-section-page rapago-guides-page" data-rapago-theme={theme}>
      <RapagoSectionHeader title="Guías locales" />
      {/* Buscador y filtros en la cabecera secundaria, igual que Mis viajes:
          así el toolbar deja de pintar su propio dorado y se ve el fondo. */}
      <IonHeader className="rapago-section-subheader">
        <IonToolbar>
          <div style={{ padding: "0 12px 10px" }}>
            <IonSearchbar value={searchName} onIonInput={(e) => setSearchName(String(e.detail.value ?? ""))}
              onIonChange={() => void load()} placeholder="Buscar guía..." debounce={400}
              style={{ padding: 0 }}
            />
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "2px" }}>
              {(["", "es", "en", "rapa_nui"] as const).map((lang) => (
                <IonChip key={lang}
                  aria-label={`Filtrar por idioma: ${lang === "" ? "Todos" : LANG_LABEL[lang] ?? lang}`}
                  className={filterLang === lang ? "rapago-filter-chip is-active" : "rapago-filter-chip"}
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

        <div className="rp-shell">
          {loading && <SkeletonList count={4} height="120px" />}
          {loadError && (
            <div className="rp-banner rp-banner--error" role="alert">
              <IonIcon icon={alertCircleOutline} />
              <span>{loadError}</span>
            </div>
          )}

          {!loading && guides.length === 0 && (
            <div className="rp-empty">
              <div className="rp-empty__icon" aria-hidden>
                <IonIcon icon={compassOutline} />
              </div>
              <h3 className="rp-empty__title">Sin guías disponibles</h3>
              <p className="rp-empty__body">Vuelve a intentarlo más tarde</p>
            </div>
          )}

          {!loading && guides.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--rp-gap-sm)" }}>
              {guides.map((guide) => {
                const initials = guide.name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase();
                const rating   = guide.ratingAverage ?? 0;
                return (
                  /* Deja de ser IonCard: sections.css mantiene a propósito las
                     ion-card sobre superficie clara en ambos temas (deuda de las
                     pantallas con texto oscuro inline). Con .rp-card la ficha
                     adopta la superficie del tema activo. */
                  <button key={guide.id} type="button" className="rp-card rp-card--tap"
                    aria-label={`Guía ${guide.name}, ${rating > 0 ? rating.toFixed(1) : "sin calificaciones"} estrellas, idiomas: ${(guide.languages ?? []).join(", ")}`}
                    onClick={() => setSelectedGuide(guide)}
                  >
                    <div style={{ display: "flex", gap: "var(--rp-gap-sm)", alignItems: "flex-start" }}>
                      <div style={{
                        width: "60px", height: "60px", borderRadius: "50%", flexShrink: 0,
                        background: "var(--rp-icon-bg)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: "var(--rp-border-w) solid var(--rp-icon-bd)",
                      }}>
                        <span style={{ fontWeight: 850, fontSize: "var(--rp-fs-stat)", color: "var(--rp-icon-fg)" }}>
                          {initials || "G"}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span className="rp-card__title">{guide.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                          {/* La estrella sigue siendo un glifo de texto: es la
                              convención de calificación de toda la app (el mismo
                              criterio que el rediseño del conductor). Lo que
                              cambia es el color, que era #f4c430 a mano. */}
                          {[1,2,3,4,5].map((n) => (
                            <span key={n} style={{ fontSize: "var(--rp-fs-body)", color: n <= Math.round(rating) ? "var(--rp-gold)" : "var(--rp-divider)" }}>★</span>
                          ))}
                          <span style={{ fontSize: "var(--rp-fs-sub)", color: "var(--rp-muted)", marginLeft: "4px" }}>
                            {rating > 0 ? rating.toFixed(1) : "Sin calificaciones"}{guide.ratingCount ? ` (${guide.ratingCount})` : ""}
                          </span>
                        </div>
                        {guide.bio && (
                          <div style={{ fontSize: "var(--rp-fs-sub)", color: "var(--rp-muted)", marginTop: "4px", lineHeight: 1.45 }}>
                            {guide.bio.slice(0, 90)}{guide.bio.length > 90 ? "…" : ""}
                          </div>
                        )}
                        {(guide.languages ?? []).length > 0 && (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                            {(guide.languages ?? []).map((lang) => (
                              <IonChip key={lang} style={{
                                fontSize: "var(--rp-fs-micro)", height: "22px", margin: 0,
                                "--background": "var(--rp-icon-bg)", "--color": "var(--rp-icon-fg)",
                                border: "1px solid var(--rp-icon-bd)",
                              }}>
                                <IonLabel>{LANG_LABEL[lang] ?? lang.toUpperCase()}</IonLabel>
                              </IonChip>
                            ))}
                          </div>
                        )}
                      </div>
                      <IonIcon icon={chevronForwardOutline} style={{ color: "var(--rp-icon-fg)", fontSize: "1.1rem", flexShrink: 0, marginTop: "4px" }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

function GuideDetailPage({ guide, onBack }: { guide: GuidePublicData; onBack: () => void }): JSX.Element {
  const { session } = useAuth();
  const { theme } = useRapagoSectionTheme(SECCION_TEMA);
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
    <IonPage className="rapago-section-page rapago-guides-page" data-rapago-theme={theme}>
      <RapagoSectionHeader title="Perfil del guía" onBack={onBack} />
      <IonContent>
        <div className="rp-shell">
          {/* El degradado ámbar inline se sustituye por el héroe de marca: es el
              mismo oro en día y en noche, con la tinta volcánica que ya cumple
              contraste sobre él (ver .rp-hero en sections.css). */}
          <section className="rp-hero">
            <div className="rp-hero__top" style={{ flexDirection: "column", textAlign: "center" }}>
              <div className="rp-hero__icon" style={{
                width: "var(--rp-avatar)", height: "var(--rp-avatar)", borderRadius: "50%",
                border: "3px solid var(--rp-hero-inset-bd)",
                fontWeight: 850, fontSize: "var(--rp-fs-hero)",
              }}>
                {initials || "G"}
              </div>
              <div>
                <div className="rp-hero__amount">{guide.name}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {[1,2,3,4,5].map((n) => <span key={n} style={{ fontSize: "1rem", color: n <= stars ? "var(--rp-btn-primary-fg)" : "var(--rp-hero-inset-bd)" }}>★</span>)}
                <span style={{ color: "var(--rp-hero-muted)", fontSize: "var(--rp-fs-sub)", marginLeft: "4px" }}>
                  {guide.ratingAverage ? guide.ratingAverage.toFixed(1) : "Sin calificaciones"}
                  {guide.ratingCount ? ` · ${guide.ratingCount} valoraciones` : ""}
                </span>
              </div>
              {(guide.languages ?? []).length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
                  {(guide.languages ?? []).map((lang) => (
                    <span key={lang} style={{
                      background: "var(--rp-hero-inset)", color: "var(--rp-btn-primary-fg)",
                      border: "1px solid var(--rp-hero-inset-bd)",
                      borderRadius: "999px", padding: "3px 10px",
                      fontSize: "var(--rp-fs-micro)", fontWeight: 700,
                    }}>
                      {LANG_LABEL_DETAIL[lang] ?? lang.toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {guide.bio && (
            <article className="rp-card">
              <div style={{
                fontSize: "var(--rp-fs-label)", fontWeight: 800, textTransform: "uppercase",
                letterSpacing: "0.08em", color: "var(--rp-muted)", marginBottom: "6px",
              }}>Sobre mí</div>
              <div style={{ fontSize: "var(--rp-fs-body)", lineHeight: 1.6 }}>{guide.bio}</div>
            </article>
          )}

          <h2 className="rapago-section-label">Servicios disponibles</h2>

          {loading && <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}><IonSpinner name="crescent" /></div>}

          {!loading && services.length === 0 && (
            <div className="rp-empty">
              <div className="rp-empty__icon" aria-hidden>
                <IonIcon icon={compassOutline} />
              </div>
              <h3 className="rp-empty__title">Sin servicios activos</h3>
              <p className="rp-empty__body">Este guía no tiene servicios publicados aún</p>
            </div>
          )}

          {!loading && services.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--rp-gap-sm)" }}>
              {services.map((svc) => {
                const priceDisplay = svc.price !== null ? `$${(svc.price / 100).toLocaleString("es-CL")} CLP/persona` : "Consultar precio";
                return (
                  <article key={svc.id} className="rp-card">
                    <div className="rp-card__row">
                      <h3 className="rp-card__title" style={{ flex: 1 }}>{svc.title}</h3>
                      {/* El tipo de servicio no es un estado: no le corresponde
                          un color semántico de Ionic. Va con el cromo dorado. */}
                      <IonBadge className="rp-badge" style={{
                        marginLeft: "8px",
                        "--background": "var(--rp-icon-bg)", "--color": "var(--rp-icon-fg)",
                        border: "1px solid var(--rp-icon-bd)",
                      }}>
                        {SERVICE_TYPE_LABEL[svc.type] ?? svc.type}
                      </IonBadge>
                    </div>
                    {svc.description && <div style={{ fontSize: "var(--rp-fs-sub)", color: "var(--rp-muted)", margin: "8px 0 10px", lineHeight: 1.45 }}>{svc.description}</div>}
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", fontSize: "var(--rp-fs-sub)", color: "var(--rp-muted)", marginBottom: "8px" }}>
                      {svc.durationMinutes && <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><IonIcon icon={timeOutline} style={META_ICON_STYLE} /> {svc.durationMinutes} min</span>}
                      {svc.maxPeople && <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><IonIcon icon={peopleOutline} style={META_ICON_STYLE} /> Máx {svc.maxPeople}</span>}
                      {svc.meetingPoint && <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><IonIcon icon={locationOutline} style={META_ICON_STYLE} /> {svc.meetingPoint}</span>}
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: svc.includesVehicle ? "var(--rp-accent)" : "var(--rp-muted)" }}>
                        <IonIcon icon={carOutline} style={META_ICON_STYLE} /> {svc.includesVehicle ? "Incluye vehículo" : "Sin vehículo"}
                      </span>
                    </div>
                    {(svc.includes ?? []).length > 0 && (
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
                        {(svc.includes ?? []).map((inc) => (
                          <span key={inc} style={{
                            display: "inline-flex", alignItems: "center", gap: "4px",
                            background: "var(--rp-ok-bg)", color: "var(--rp-ok-fg)",
                            border: "1px solid var(--rp-ok-bd)",
                            borderRadius: "999px", padding: "3px 9px", fontSize: "var(--rp-fs-micro)",
                          }}><IonIcon icon={checkmarkOutline} style={META_ICON_STYLE} /> {inc}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--rp-gap-sm)", marginTop: "4px" }}>
                      <div className="rp-card__amount" style={{ margin: 0 }}>{priceDisplay}</div>
                      <IonButton size="small"
                        onClick={() => { setBookingService(svc); setBookingDate(new Date().toISOString().slice(0, 10)); }}>
                        Reservar
                      </IonButton>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <IonModal isOpen={bookingService !== null} onDidDismiss={() => setBookingService(null)}>
          <IonHeader className="rapago-section-header">
            <IonToolbar className="rapago-modal-toolbar">
              <IonTitle>Reservar servicio</IonTitle>
              <IonButton slot="end" fill="clear" className="rapago-modal-close" onClick={() => setBookingService(null)}>Cerrar</IonButton>
            </IonToolbar>
          </IonHeader>
          {/* El IonModal se monta FUERA del IonPage, así que no hereda ni el
              scope ni el tema: se los damos aquí (ver .rapago-modal-body). */}
          <IonContent className="rapago-modal-content">
            <div className="rapago-section-page rapago-modal-body" data-rapago-theme={theme}>
              {bookingService && (
                <div className="rp-modal-inner">
                  <div style={{ fontSize: "var(--rp-fs-h2)", fontWeight: 800, color: "var(--rp-text)" }}>{bookingService.title}</div>
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
                      <div style={{ fontWeight: 800, fontSize: "var(--rp-fs-body)", color: pr.valid ? "var(--rp-text)" : "var(--rp-warn-fg)" }}>
                        {pr.valid ? `Total estimado: ${pr.display}` : pr.display}
                      </div>
                    ) : null;
                  })()}
                  {pricingData?.conditions && <div style={{ fontSize: "var(--rp-fs-sub)", color: "var(--rp-muted)" }}><strong>Condiciones:</strong> {pricingData.conditions}</div>}
                  {pricingData?.cancellationPolicy && <div style={{ fontSize: "var(--rp-fs-sub)", color: "var(--rp-muted)" }}><strong>Cancelación:</strong> {pricingData.cancellationPolicy}</div>}
                  <IonButton className="rp-cta" expand="block" onClick={() => void handleBook()}
                    disabled={submitting || (pricingData !== null && pricingData.tiers.length > 0 && !pricingData.tiers.find((t) => t.minPeople <= numPeople && t.maxPeople >= numPeople))}>
                    {submitting ? <IonSpinner name="dots" /> : "Confirmar reserva"}
                  </IonButton>
                </div>
              )}
            </div>
          </IonContent>
        </IonModal>

        <IonToast isOpen={toastMsg !== null} message={toastMsg ?? ""} duration={3000}
          onDidDismiss={() => setToastMsg(null)}
          color={toastMsg?.includes("Error") ? "danger" : "success"} />
      </IonContent>
    </IonPage>
  );
}
