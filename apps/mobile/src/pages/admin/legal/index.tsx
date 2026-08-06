import React, { useEffect, useState, useCallback } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonNote, IonBadge, IonButton,
  IonModal, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonSpinner, IonIcon, IonButtons, IonToggle,
} from "@ionic/react";
import {
  addOutline,
  alertCircleOutline,
  documentTextOutline,
} from "ionicons/icons";
import { apiClient } from "../../../services/api/index.js";
import { useAuth } from "../../../features/auth/index.js";
import type { LegalDocumentData } from "../../../features/legal/legal.service.js";
import { RapagoAppBar } from "../../../components/RapagoAppBar.js";
import { ROUTES } from "../../../navigation/routes.js";
import { useRapagoSectionTheme } from "../../../theme/rapagoTheme.js";

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
  const { theme } = useRapagoSectionTheme("admin");
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
    <IonPage className="rapago-admin-page" data-rapago-theme={theme}>
      <RapagoAppBar
        sectionId="admin"
        title="Documentos legales"
        roleLabel="Administrador"
        backHref={ROUTES.ADMIN.MORE}
        backLabel="Volver a Más secciones"
        actionIcon={addOutline}
        actionLabel="Crear nueva versión de documento"
        onAction={() => setShowModal(true)}
      />

      <IonContent>
        <div className="rp-admin-shell">
          {loading ? (
            /* Antes era un spinner suelto sin texto: en una lista que puede
               tardar, un aspa girando no dice si está cargando o si falló. */
            <div className="rp-empty">
              <IonSpinner name="crescent" />
              <p className="rp-empty__body" style={{ marginTop: 10 }}>
                Cargando documentos…
              </p>
            </div>
          ) : docs.length === 0 ? (
            /* No había estado vacío: sin documentos la pantalla quedaba en
               blanco y no ofrecía la única acción posible. */
            <div className="rp-empty">
              <div className="rp-empty__icon">
                <IonIcon icon={documentTextOutline} aria-hidden="true" />
              </div>
              <h2 className="rp-empty__title">Sin documentos publicados</h2>
              <p className="rp-empty__body">
                Publica la primera versión de los términos, la política de
                privacidad o cualquier otro documento legal.
              </p>
              <IonButton
                className="rp-cta"
                style={{ marginTop: 14 }}
                onClick={() => setShowModal(true)}
              >
                <IonIcon icon={addOutline} slot="start" aria-hidden="true" />
                Nueva versión
              </IonButton>
            </div>
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
                  {/* El interruptor no decía qué documento activaba: en una
                      lista de nueve, el lector de pantalla anunciaba nueve
                      "conmutador" idénticos. */}
                  <IonToggle
                    checked={doc.isActive}
                    aria-label={`${doc.isActive ? "Desactivar" : "Activar"} ${doc.title} versión ${doc.version}`}
                    onIonChange={() => { void handleToggleActive(doc); }}
                    slot="end"
                  />
                </IonItem>
              ))}
            </IonList>
          )}
        </div>

        <IonModal
          isOpen={showModal}
          className="rapago-admin-modal"
          onDidDismiss={() => setShowModal(false)}
        >
          <IonHeader>
            <IonToolbar className="rapago-modal-toolbar">
              <IonTitle>Nueva versión de documento</IonTitle>
              <IonButtons slot="end">
                <IonButton className="rapago-modal-close" onClick={() => setShowModal(false)}>Cerrar</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          {/* El IonModal se monta FUERA del IonPage, así que no hereda el
              atributo de tema de la pantalla: hay que repetirlo aquí o sus
              campos resuelven contra :root y quedan a dos luces. */}
          <IonContent className="rapago-modal-content">
            <div className="rapago-modal-body" data-rapago-theme={theme}>
              <div className="rp-admin-modal-inner">
            {error && (
              <div className="rp-banner rp-banner--error" role="alert">
                <IonIcon icon={alertCircleOutline} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

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
              className="rp-cta"
              disabled={saving || !formType || !formVersion || !formTitle || !formContent || !formEffectiveDate}
              onClick={() => { void handleSave(); }}
            >
              {saving ? <IonSpinner name="crescent" /> : "Guardar documento"}
            </IonButton>
              </div>
            </div>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
