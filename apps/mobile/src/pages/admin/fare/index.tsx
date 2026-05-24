import React, { useState, useCallback } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonBadge, IonButton, IonButtons,
  IonModal, IonInput, IonSelect, IonSelectOption,
  IonSpinner, IonText, IonSegment, IonSegmentButton,
  IonRefresher, IonRefresherContent, IonFab, IonFabButton, IonIcon,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonNote,
  useIonViewWillEnter,
} from "@ionic/react";
import { add } from "ionicons/icons";
import { fareSettingsService, type FareSettingData, type ZoneFareData } from "../../../features/fareSettings/fareSettings.service.js";
import { useAuth } from "../../../features/auth/index.js";

const FARE_TYPES = [
  { value: "mobility_base",       label: "Tarifa base movilidad" },
  { value: "mobility_per_km",     label: "Tarifa por kilómetro" },
  { value: "minimum_fare",        label: "Tarifa mínima" },
  { value: "tour_base",           label: "Fee base tours" },
  { value: "rental_base",         label: "Fee base arriendo" },
  { value: "discount_percentage", label: "Descuento general" },
];

const SUMMARY_TYPES = ["mobility_base", "mobility_per_km", "minimum_fare", "discount_percentage"];

function formatFare(value: number): string {
  return (value / 100).toLocaleString("es-CL", { style: "currency", currency: "CLP" });
}

export function AdminFareSettingsPage(): React.ReactElement {
  const { session } = useAuth();
  const token = session?.accessToken ?? null;

  const [tab, setTab] = useState<"tarifas" | "zonas">("tarifas");
  const [settings, setSettings] = useState<FareSettingData[]>([]);
  const [zoneFares, setZoneFares] = useState<ZoneFareData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showFareModal, setShowFareModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [formType, setFormType] = useState<string>("");
  const [formName, setFormName] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEffectiveFrom, setFormEffectiveFrom] = useState(() => new Date().toISOString().split("T")[0]!);
  const [formEffectiveUntil, setFormEffectiveUntil] = useState("");

  const [zoneFrom, setZoneFrom] = useState("");
  const [zoneTo, setZoneTo] = useState("");
  const [zoneFare, setZoneFare] = useState("");

  const [editingZone, setEditingZone] = useState<ZoneFareData | null>(null);
  const [editZoneFare, setEditZoneFare] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [s, z] = await Promise.all([
        fareSettingsService.listAll(token),
        fareSettingsService.getZoneFares(),
      ]);
      setSettings(s);
      setZoneFares(z);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tarifas.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useIonViewWillEnter(() => { void load(); });

  function resetFareForm() {
    setFormType(""); setFormName(""); setFormValue(""); setFormDescription("");
    setFormEffectiveFrom(new Date().toISOString().split("T")[0]!); setFormEffectiveUntil("");
    setFormError("");
  }

  async function handleSaveFare() {
    if (!token) return;
    const val = parseInt(formValue, 10);
    if (!formType || !formName || isNaN(val)) {
      setFormError("Tipo, nombre y valor son obligatorios.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await fareSettingsService.createFareSetting(token, {
        type: formType, name: formName, value: val,
        ...(formDescription ? { description: formDescription } : {}),
        effectiveFrom: formEffectiveFrom,
        ...(formEffectiveUntil ? { effectiveUntil: formEffectiveUntil } : {}),
      });
      setShowFareModal(false);
      resetFareForm();
      void load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleFare(s: FareSettingData) {
    if (!token) return;
    try {
      await fareSettingsService.updateFareSetting(token, s.id, { isActive: !s.isActive });
      void load();
    } catch { }
  }

  async function handleSaveZone() {
    if (!token) return;
    const val = parseInt(zoneFare, 10);
    if (!zoneFrom || !zoneTo || isNaN(val) || val <= 0) {
      setFormError("Zona origen, zona destino y tarifa son obligatorios.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await fareSettingsService.createZoneFare(token, { zoneFrom, zoneTo, fare: val });
      setShowZoneModal(false);
      setZoneFrom(""); setZoneTo(""); setZoneFare(""); setFormError("");
      void load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateZone() {
    if (!token || !editingZone) return;
    const val = parseInt(editZoneFare, 10);
    if (isNaN(val) || val <= 0) { setFormError("Tarifa inválida."); return; }
    setSaving(true);
    setFormError("");
    try {
      await fareSettingsService.updateZoneFare(token, editingZone.id, { fare: val });
      setEditingZone(null); setEditZoneFare(""); setFormError("");
      void load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al actualizar.");
    } finally {
      setSaving(false);
    }
  }

  const summaryItems = SUMMARY_TYPES.map(t => settings.find(s => s.type === t && s.isActive)).filter(Boolean) as FareSettingData[];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Tarifas</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={tab} onIonChange={e => setTab(e.detail.value as "tarifas" | "zonas")}>
            <IonSegmentButton value="tarifas"><IonLabel>Tarifas</IonLabel></IonSegmentButton>
            <IonSegmentButton value="zonas"><IonLabel>Zonas</IonLabel></IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={e => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
            <IonSpinner />
          </div>
        )}

        {error && (
          <IonText color="danger" style={{ padding: "1rem", display: "block" }}>{error}</IonText>
        )}

        {!loading && tab === "tarifas" && (
          <>
            {summaryItems.length > 0 && (
              <div style={{ padding: "0.5rem" }}>
                {summaryItems.map(s => (
                  <IonCard key={s.id}>
                    <IonCardHeader>
                      <IonCardTitle style={{ fontSize: "1rem" }}>{s.name}</IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>{formatFare(s.value)}</div>
                      <IonNote>Vigente desde {s.effectiveFrom}{s.effectiveUntil ? ` hasta ${s.effectiveUntil}` : ""}</IonNote>
                    </IonCardContent>
                  </IonCard>
                ))}
              </div>
            )}

            <IonList>
              {settings.map(s => (
                <IonItem key={s.id}>
                  <IonLabel>
                    <h3>{s.name}</h3>
                    <p>{formatFare(s.value)} · desde {s.effectiveFrom}</p>
                    {s.description && <p style={{ fontSize: "0.8rem" }}>{s.description}</p>}
                  </IonLabel>
                  <IonBadge color={s.isActive ? "success" : "medium"} slot="end">
                    {s.isActive ? "Activa" : "Inactiva"}
                  </IonBadge>
                  <IonButton fill="clear" size="small" slot="end" onClick={() => handleToggleFare(s)}>
                    {s.isActive ? "Desactivar" : "Activar"}
                  </IonButton>
                </IonItem>
              ))}
              {settings.length === 0 && (
                <IonItem><IonLabel><IonText color="medium">Sin tarifas configuradas.</IonText></IonLabel></IonItem>
              )}
            </IonList>
          </>
        )}

        {!loading && tab === "zonas" && (
          <>
            <IonList>
              {zoneFares.map(z => (
                <IonItem key={z.id}>
                  <IonLabel>
                    <h3>{z.zoneFrom} → {z.zoneTo}</h3>
                    <p>{formatFare(z.fare)}</p>
                  </IonLabel>
                  <IonBadge color={z.isActive ? "success" : "medium"} slot="end">
                    {z.isActive ? "Activa" : "Inactiva"}
                  </IonBadge>
                  <IonButton fill="clear" size="small" slot="end" onClick={() => { setEditingZone(z); setEditZoneFare(String(z.fare)); setFormError(""); }}>
                    Editar
                  </IonButton>
                </IonItem>
              ))}
              {zoneFares.length === 0 && (
                <IonItem><IonLabel><IonText color="medium">Sin rutas fijas configuradas.</IonText></IonLabel></IonItem>
              )}
            </IonList>
          </>
        )}

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => { if (tab === "tarifas") { resetFareForm(); setShowFareModal(true); } else { setZoneFrom(""); setZoneTo(""); setZoneFare(""); setFormError(""); setShowZoneModal(true); } }}>
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        <IonModal isOpen={showFareModal} onDidDismiss={() => setShowFareModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Nueva Tarifa</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowFareModal(false)}>Cerrar</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">Tipo</IonLabel>
              <IonSelect interface="action-sheet" value={formType} onIonChange={e => setFormType(e.detail.value as string)} placeholder="Seleccionar tipo">
                {FARE_TYPES.map(t => (
                  <IonSelectOption key={t.value} value={t.value}>{t.label}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Nombre</IonLabel>
              <IonInput value={formName} onIonInput={e => setFormName((e.detail.value ?? ""))} placeholder="Nombre descriptivo" />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Valor (centavos CLP)</IonLabel>
              <IonInput type="number" value={formValue} onIonInput={e => setFormValue((e.detail.value ?? ""))} placeholder="ej. 230000 = $2.300/km" />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Descripción</IonLabel>
              <IonInput value={formDescription} onIonInput={e => setFormDescription((e.detail.value ?? ""))} placeholder="Opcional" />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Vigente desde (YYYY-MM-DD)</IonLabel>
              <IonInput value={formEffectiveFrom} onIonInput={e => setFormEffectiveFrom((e.detail.value ?? ""))} placeholder="2025-01-01" />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Vigente hasta (YYYY-MM-DD, opcional)</IonLabel>
              <IonInput value={formEffectiveUntil} onIonInput={e => setFormEffectiveUntil((e.detail.value ?? ""))} placeholder="Opcional" />
            </IonItem>
            {formError && <IonText color="danger" style={{ padding: "0.5rem", display: "block" }}>{formError}</IonText>}
            <div style={{ padding: "1rem" }}>
              <IonButton expand="block" onClick={() => { void handleSaveFare(); }} disabled={saving}>
                {saving ? <IonSpinner name="crescent" /> : "Guardar"}
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        <IonModal isOpen={showZoneModal} onDidDismiss={() => setShowZoneModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Agregar Ruta Fija</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowZoneModal(false)}>Cerrar</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">Zona origen</IonLabel>
              <IonInput value={zoneFrom} onIonInput={e => setZoneFrom((e.detail.value ?? ""))} placeholder="ej. hanga_roa" />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Zona destino</IonLabel>
              <IonInput value={zoneTo} onIonInput={e => setZoneTo((e.detail.value ?? ""))} placeholder="ej. anakena" />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Tarifa (centavos CLP)</IonLabel>
              <IonInput type="number" value={zoneFare} onIonInput={e => setZoneFare((e.detail.value ?? ""))} placeholder="ej. 500000 = $5.000" />
            </IonItem>
            {formError && <IonText color="danger" style={{ padding: "0.5rem", display: "block" }}>{formError}</IonText>}
            <div style={{ padding: "1rem" }}>
              <IonButton expand="block" onClick={() => { void handleSaveZone(); }} disabled={saving}>
                {saving ? <IonSpinner name="crescent" /> : "Guardar"}
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        <IonModal isOpen={editingZone !== null} onDidDismiss={() => { setEditingZone(null); setEditZoneFare(""); setFormError(""); }}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Editar Tarifa de Zona</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => { setEditingZone(null); setEditZoneFare(""); setFormError(""); }}>Cerrar</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {editingZone && (
              <>
                <IonItem>
                  <IonLabel><strong>{editingZone.zoneFrom} → {editingZone.zoneTo}</strong></IonLabel>
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Tarifa (centavos CLP)</IonLabel>
                  <IonInput type="number" value={editZoneFare} onIonInput={e => setEditZoneFare((e.detail.value ?? ""))} />
                </IonItem>
                {formError && <IonText color="danger" style={{ padding: "0.5rem", display: "block" }}>{formError}</IonText>}
                <div style={{ padding: "1rem" }}>
                  <IonButton expand="block" onClick={() => { void handleUpdateZone(); }} disabled={saving}>
                    {saving ? <IonSpinner name="crescent" /> : "Actualizar"}
                  </IonButton>
                </div>
              </>
            )}
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
