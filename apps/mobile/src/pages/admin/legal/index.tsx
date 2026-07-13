import React, { useEffect, useState, useCallback } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonNote, IonBadge, IonButton,
  IonModal, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonSpinner, IonText, IonButtons, IonToggle,
} from "@ionic/react";
import { apiClient } from "../../../services/api/index.js";
import { useAuth } from "../../../features/auth/index.js";
import type { LegalDocumentData } from "../../../features/legal/legal.service.js";

const DOC_TYPES = [
  { value: "terms_and_conditions",  label: "Términos y Condiciones" },
  { value: "privacy_policy",        label: "Política de Privacidad" },
  { value: "intellectual_property", label: "Propiedad Intelectual" },
  { value: "software_license",      label: "Licencia de Software" },
  { value: "data_providers",        label: "Proveedores de Datos" },
  { value: "user_conditions",       label: "Condiciones para Usuarios" },
  { value: "driver_conditions",     label: "Condiciones para Conductores" },
  { value: "guide_conditions",      label: "Condiciones para Guías" },
  { value: "event_conditions",      label: "Condiciones para Eventos" },
];

export function AdminLegalDocumentsPage(): React.ReactElement {
  const { session } = useAuth();
  const token = session?.accessToken ?? null;
  const [docs, setDocs] = useState<LegalDocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formType, setFormType]              = useState("");
  const [formVersion, setFormVersion]        = useState("");
  const [formTitle, setFormTitle]            = useState("");
  const [formContent, setFormContent]        = useState("");
  const [formEffectiveDate, setFormEffectiveDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const opts = token ? { token } : {};
    const result = await apiClient.get<any>("/legal-documents", opts);
    if (result.ok) setDocs(result.data.data.items ?? []);
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setError("");
    const result = await apiClient.post<any>("/legal-documents", {
      type: formType, version: formVersion, title: formTitle,
      content: formContent, effectiveDate: formEffectiveDate,
    }, { token });
    if (result.ok === false) {
      setError(result.message ?? "Error al guardar.");
    } else {
      setShowModal(false);
      setFormType(""); setFormVersion(""); setFormTitle(""); setFormContent(""); setFormEffectiveDate("");
      void load();
    }
    setSaving(false);
  }

  async function handleToggleActive(doc: LegalDocumentData) {
    if (!token) return;
    await apiClient.patch<any>(`/legal-documents/${doc.id}`, { isActive: !doc.isActive }, { token });
    void load();
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Documentos Legales</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowModal(true)}>Nueva versión</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {loading ? (
          <div style={{ textAlign: "center", paddingTop: "2rem" }}><IonSpinner /></div>
        ) : (
          <IonList>
            {docs.map(doc => (
              <IonItem key={doc.id}>
                <IonLabel>
                  <h2>{doc.title}</h2>
                  <p>{doc.type} — v{doc.version} — {doc.effectiveDate}</p>
                  <IonNote>{new Date(doc.updatedAt ?? doc.createdAt).toLocaleDateString("es-CL")}</IonNote>
                </IonLabel>
                <IonBadge color={doc.isActive ? "success" : "medium"} slot="end">
                  {doc.isActive ? "Activo" : "Inactivo"}
                </IonBadge>
                <IonToggle
                  checked={doc.isActive}
                  onIonChange={() => { void handleToggleActive(doc); }}
                  slot="end"
                />
              </IonItem>
            ))}
          </IonList>
        )}

        <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Nueva versión de documento</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowModal(false)}>Cerrar</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {error && <IonText color="danger"><p>{error}</p></IonText>}

            <IonItem>
              <IonLabel position="stacked">Tipo de documento</IonLabel>
              <IonSelect
                interface="action-sheet"
                value={formType}
                onIonChange={e => setFormType(String(e.detail.value ?? ""))}
                placeholder="Selecciona tipo"
              >
                {DOC_TYPES.map(t => (
                  <IonSelectOption key={t.value} value={t.value}>{t.label}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Versión</IonLabel>
              <IonInput
                value={formVersion}
                onIonInput={e => setFormVersion(String(e.detail.value ?? ""))}
                placeholder="Ej: 1.1"
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Título</IonLabel>
              <IonInput
                value={formTitle}
                onIonInput={e => setFormTitle(String(e.detail.value ?? ""))}
                placeholder="Título del documento"
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Fecha de vigencia</IonLabel>
              <IonInput
                type="date"
                value={formEffectiveDate}
                onIonInput={e => setFormEffectiveDate(String(e.detail.value ?? ""))}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Contenido</IonLabel>
              <IonTextarea
                rows={10}
                value={formContent}
                onIonInput={e => setFormContent(String(e.detail.value ?? ""))}
                placeholder="Texto completo del documento legal..."
              />
            </IonItem>

            <IonButton
              expand="block"
              style={{ margin: "1rem 0" }}
              disabled={saving || !formType || !formVersion || !formTitle || !formContent || !formEffectiveDate}
              onClick={() => { void handleSave(); }}
            >
              {saving ? <IonSpinner name="crescent" /> : "Guardar documento"}
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
