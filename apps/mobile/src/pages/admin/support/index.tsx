import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  alertCircleOutline,
  helpBuoyOutline,
  refreshOutline,
} from "ionicons/icons";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../features/auth/index.js";
import { RapagoAppBar } from "../../../components/RapagoAppBar.js";
import { ROUTES } from "../../../navigation/routes.js";
import { useRapagoSectionTheme } from "../../../theme/rapagoTheme.js";
import {
  supportService,
  type AdminIdentityCorrectionPayload,
  type SupportCaseData,
  type SupportCaseDetailData,
  type SupportPriority,
  type SupportStatus,
} from "../../../features/support/support.service.js";

const STATUS_LABEL: Record<string, string> = {
  open: "Recibido",
  in_review: "En revisión",
  waiting_user: "Esperando usuario",
  resolved: "Resuelto",
  closed: "Cerrado",
  rejected: "Rechazado",
};
const STATUS_COLOR: Record<string, string> = {
  open: "warning",
  in_review: "primary",
  waiting_user: "tertiary",
  resolved: "success",
  closed: "medium",
  rejected: "danger",
};
const CATEGORY_LABEL: Record<string, string> = {
  support: "Ayuda",
  complaint: "Reclamo",
  lost_item: "Objeto perdido",
  safety: "Seguridad",
  payment: "Pago",
  identity_correction: "Corrección de identidad",
  other: "Otro",
};

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString("es-CL") : "—";
}

function normalized(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export function AdminSupportPage(): JSX.Element {
  const { session } = useAuth();
  const { theme } = useRapagoSectionTheme("admin");
  const [items, setItems] = useState<SupportCaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<SupportCaseDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [status, setStatus] = useState<SupportStatus>("in_review");
  const [priority, setPriority] = useState<SupportPriority>("normal");
  const [publicMessage, setPublicMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [identityName, setIdentityName] = useState("");
  const [identityEmail, setIdentityEmail] = useState("");
  const [identityPhone, setIdentityPhone] = useState("");
  const [identityRut, setIdentityRut] = useState("");
  const [identityLicenseNumber, setIdentityLicenseNumber] = useState("");
  const [identityLicenseExpiry, setIdentityLicenseExpiry] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setItems(
        await supportService.listAdmin(session.accessToken, {
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
          search: search.trim() || undefined,
        }),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los casos.",
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, statusFilter, categoryFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  function loadIdentityFields(next: SupportCaseDetailData): void {
    const identity = next.requesterIdentity;
    setIdentityName(identity?.name ?? "");
    setIdentityEmail(identity?.email ?? "");
    setIdentityPhone(identity?.phone ?? "");
    setIdentityRut(identity?.rut ?? "");
    setIdentityLicenseNumber(identity?.licenseNumber ?? "");
    setIdentityLicenseExpiry(identity?.licenseExpiry ?? "");
  }

  async function openCase(id: string): Promise<void> {
    if (!session?.accessToken) return;
    setDetailLoading(true);
    setError(null);
    try {
      const next = await supportService.getAdmin(session.accessToken, id);
      setDetail(next);
      setStatus(next.supportCase.status);
      setPriority(next.supportCase.priority);
      setResolution(next.supportCase.adminResolution ?? "");
      setPublicMessage("");
      setInternalNote("");
      loadIdentityFields(next);
    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : "No se pudo abrir el caso.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function buildIdentityCorrection(): AdminIdentityCorrectionPayload | null {
    if (
      !detail ||
      detail.supportCase.category !== "identity_correction" ||
      !detail.requesterIdentity
    ) {
      return null;
    }

    const current = detail.requesterIdentity;
    const correction: AdminIdentityCorrectionPayload = {};

    if (normalized(identityName) && normalized(identityName) !== normalized(current.name)) {
      correction.name = normalized(identityName);
    }
    if (
      normalized(identityEmail) &&
      normalized(identityEmail).toLowerCase() !== normalized(current.email).toLowerCase()
    ) {
      correction.email = normalized(identityEmail).toLowerCase();
    }
    if (
      normalized(identityPhone) &&
      normalized(identityPhone) !== normalized(current.phone)
    ) {
      correction.phone = normalized(identityPhone);
    }
    if (normalized(identityRut) && normalized(identityRut) !== normalized(current.rut)) {
      correction.rut = normalized(identityRut);
    }

    if (current.role === "driver") {
      if (
        normalized(identityLicenseNumber) &&
        normalized(identityLicenseNumber) !== normalized(current.licenseNumber)
      ) {
        correction.licenseNumber = normalized(identityLicenseNumber);
      }
      if (
        normalized(identityLicenseExpiry) &&
        normalized(identityLicenseExpiry) !== normalized(current.licenseExpiry)
      ) {
        correction.licenseExpiry = normalized(identityLicenseExpiry);
      }
    }

    return Object.keys(correction).length > 0 ? correction : null;
  }

  async function save(): Promise<void> {
    if (!session?.accessToken || !detail) return;
    setSaving(true);
    setError(null);
    try {
      const identityCorrection = buildIdentityCorrection();
      const updated = await supportService.updateAdmin(
        session.accessToken,
        detail.supportCase.id,
        {
          status,
          priority,
          assignToMe: true,
          ...(publicMessage.trim()
            ? { publicMessage: publicMessage.trim() }
            : {}),
          ...(internalNote.trim()
            ? { internalNote: internalNote.trim() }
            : {}),
          ...(resolution.trim() ? { resolution: resolution.trim() } : {}),
          ...(identityCorrection ? { identityCorrection } : {}),
        },
      );
      setDetail(updated);
      setPublicMessage("");
      setInternalNote("");
      loadIdentityFields(updated);
      setItems((current) =>
        current.map((item) =>
          item.id === updated.supportCase.id ? updated.supportCase : item,
        ),
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo actualizar el caso.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonPage className="rapago-admin-page" data-rapago-theme={theme}>
      <RapagoAppBar
        sectionId="admin"
        title="Soporte y reclamos"
        roleLabel="Administrador"
        backHref={ROUTES.ADMIN.MORE}
        backLabel="Volver a Más secciones"
        actionIcon={refreshOutline}
        actionLabel="Actualizar casos"
        actionLoading={loading}
        onAction={() => void load()}
      />
      <IonContent>
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) =>
            void load().finally(() => event.detail.complete())
          }
        >
          <IonRefresherContent />
        </IonRefresher>

        <div className="rp-admin-shell">
          <IonCard>
            <IonCardContent>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
                  gap: 10,
                }}
              >
                <IonItem>
                  <IonLabel position="stacked">Estado</IonLabel>
                  <IonSelect
                    value={statusFilter}
                    onIonChange={(event) =>
                      setStatusFilter(String(event.detail.value ?? ""))
                    }
                  >
                    <IonSelectOption value="">Todos</IonSelectOption>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <IonSelectOption key={value} value={value}>
                        {label}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Categoría</IonLabel>
                  <IonSelect
                    value={categoryFilter}
                    onIonChange={(event) =>
                      setCategoryFilter(String(event.detail.value ?? ""))
                    }
                  >
                    <IonSelectOption value="">Todas</IonSelectOption>
                    {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                      <IonSelectOption key={value} value={value}>
                        {label}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">
                    Buscar folio, usuario o asunto
                  </IonLabel>
                  <IonInput
                    value={search}
                    onIonInput={(event) =>
                      setSearch(String(event.detail.value ?? ""))
                    }
                  />
                </IonItem>
              </div>
              <IonButton expand="block" onClick={() => void load()}>
                Actualizar
              </IonButton>
            </IonCardContent>
          </IonCard>

          {error && (
            <div className="rp-banner rp-banner--error" role="alert">
              <IonIcon icon={alertCircleOutline} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="rp-empty">
              <IonSpinner name="crescent" />
              <p className="rp-empty__body" style={{ marginTop: 10 }}>
                Cargando casos…
              </p>
            </div>
          ) : items.length === 0 ? (
            /* Faltaba: con los filtros puestos y sin resultados la lista
               quedaba vacía sin decir si no había casos o si el filtro no
               devolvía nada. */
            <div className="rp-empty">
              <div className="rp-empty__icon">
                <IonIcon icon={helpBuoyOutline} aria-hidden="true" />
              </div>
              <h2 className="rp-empty__title">
                {statusFilter || categoryFilter || search
                  ? "Ningún caso coincide"
                  : "No hay casos abiertos"}
              </h2>
              <p className="rp-empty__body">
                {statusFilter || categoryFilter || search
                  ? "Prueba con otro estado, otra categoría o limpia la búsqueda."
                  : "Cuando alguien abra un reclamo desde el Centro de ayuda, aparecerá aquí."}
              </p>
            </div>
          ) : (
            <IonList>
              {items.map((item) => (
                <IonCard
                  key={item.id}
                  button
                  onClick={() => void openCase(item.id)}
                >
                  <IonCardContent>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div>
                        <strong>
                          {item.trackingCode} · {item.subject}
                        </strong>
                        <div
                          style={{
                            marginTop: 4,
                            color: "#6b7280",
                            fontSize: ".78rem",
                          }}
                        >
                          {item.requesterName ?? item.requesterEmail} ·{" "}
                          {CATEGORY_LABEL[item.category] ?? item.category} ·{" "}
                          {formatDate(item.updatedAt)}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <IonBadge color={STATUS_COLOR[item.status] ?? "medium"}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </IonBadge>
                        <IonBadge
                          color={
                            item.priority === "urgent"
                              ? "danger"
                              : item.priority === "high"
                                ? "warning"
                                : "medium"
                          }
                        >
                          {item.priority}
                        </IonBadge>
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </IonList>
          )}
        </div>

        <IonModal
          isOpen={detail !== null || detailLoading}
          className="rapago-admin-modal"
          onDidDismiss={() => setDetail(null)}
        >
          <IonHeader>
            <IonToolbar className="rapago-modal-toolbar">
              <IonTitle>
                {detail?.supportCase.trackingCode ?? "Cargando"}
              </IonTitle>
              <IonButton
                slot="end"
                fill="clear"
                className="rapago-modal-close"
                onClick={() => setDetail(null)}
              >
                Cerrar
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="rapago-modal-content">
            <div className="rapago-modal-body" data-rapago-theme={theme}>
            {detailLoading && !detail ? (
              <div className="rp-empty">
                <IonSpinner name="crescent" />
                <p className="rp-empty__body" style={{ marginTop: 10 }}>
                  Cargando el caso…
                </p>
              </div>
            ) : (
              detail && (
                <div className="rp-admin-modal-inner">
                  <IonCard>
                    <IonCardContent>
                      <h2>{detail.supportCase.subject}</h2>
                      <p>{detail.supportCase.description}</p>
                      <div>
                        <strong>Solicitante:</strong>{" "}
                        {detail.supportCase.requesterName} ·{" "}
                        {detail.supportCase.requesterEmail}
                      </div>
                      <div>
                        <strong>Viaje:</strong>{" "}
                        {detail.supportCase.rideRequestId ?? "No asociado"}
                      </div>
                      {detail.supportCase.lostItemDescription && (
                        <div>
                          <strong>Objeto:</strong>{" "}
                          {detail.supportCase.lostItemDescription}
                        </div>
                      )}
                    </IonCardContent>
                  </IonCard>

                  {detail.supportCase.category === "identity_correction" && (
                    <IonCard>
                      <IonCardContent>
                        <h3>Corrección administrativa de identidad</h3>
                        <IonNote>
                          Verifica los antecedentes enviados por el usuario antes
                          de guardar. Los cambios quedan registrados en el historial
                          del caso.
                        </IonNote>
                        {!detail.requesterIdentity ? (
                          <IonText color="danger">
                            <p>No fue posible cargar la identidad de la cuenta.</p>
                          </IonText>
                        ) : (
                          <>
                            <IonItem>
                              <IonLabel position="stacked">Nombre completo</IonLabel>
                              <IonInput
                                value={identityName}
                                maxlength={100}
                                onIonInput={(event) =>
                                  setIdentityName(String(event.detail.value ?? ""))
                                }
                              />
                            </IonItem>
                            <IonItem>
                              <IonLabel position="stacked">Correo</IonLabel>
                              <IonInput
                                type="email"
                                value={identityEmail}
                                maxlength={255}
                                onIonInput={(event) =>
                                  setIdentityEmail(String(event.detail.value ?? ""))
                                }
                              />
                            </IonItem>
                            <IonItem>
                              <IonLabel position="stacked">Teléfono</IonLabel>
                              <IonInput
                                type="tel"
                                value={identityPhone}
                                maxlength={30}
                                onIonInput={(event) =>
                                  setIdentityPhone(String(event.detail.value ?? ""))
                                }
                              />
                            </IonItem>
                            <IonItem>
                              <IonLabel position="stacked">RUT</IonLabel>
                              <IonInput
                                value={identityRut}
                                maxlength={20}
                                onIonInput={(event) =>
                                  setIdentityRut(String(event.detail.value ?? ""))
                                }
                              />
                            </IonItem>
                            {detail.requesterIdentity.role === "driver" && (
                              <>
                                <IonItem>
                                  <IonLabel position="stacked">
                                    Número de licencia
                                  </IonLabel>
                                  <IonInput
                                    value={identityLicenseNumber}
                                    maxlength={30}
                                    onIonInput={(event) =>
                                      setIdentityLicenseNumber(
                                        String(event.detail.value ?? ""),
                                      )
                                    }
                                  />
                                </IonItem>
                                <IonItem>
                                  <IonLabel position="stacked">
                                    Vencimiento de licencia
                                  </IonLabel>
                                  <IonInput
                                    type="date"
                                    value={identityLicenseExpiry}
                                    onIonInput={(event) =>
                                      setIdentityLicenseExpiry(
                                        String(event.detail.value ?? ""),
                                      )
                                    }
                                  />
                                </IonItem>
                              </>
                            )}
                          </>
                        )}
                      </IonCardContent>
                    </IonCard>
                  )}

                  <IonCard>
                    <IonCardContent>
                      <h3>Gestión administrativa</h3>
                      <IonItem>
                        <IonLabel position="stacked">Estado</IonLabel>
                        <IonSelect
                          value={status}
                          onIonChange={(event) =>
                            setStatus(event.detail.value as SupportStatus)
                          }
                        >
                          {Object.entries(STATUS_LABEL).map(([value, label]) => (
                            <IonSelectOption key={value} value={value}>
                              {label}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Prioridad</IonLabel>
                        <IonSelect
                          value={priority}
                          onIonChange={(event) =>
                            setPriority(event.detail.value as SupportPriority)
                          }
                        >
                          <IonSelectOption value="low">Baja</IonSelectOption>
                          <IonSelectOption value="normal">Normal</IonSelectOption>
                          <IonSelectOption value="high">Alta</IonSelectOption>
                          <IonSelectOption value="urgent">Urgente</IonSelectOption>
                        </IonSelect>
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">
                          Mensaje visible para el usuario
                        </IonLabel>
                        <IonTextarea
                          rows={3}
                          value={publicMessage}
                          onIonInput={(event) =>
                            setPublicMessage(String(event.detail.value ?? ""))
                          }
                        />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Nota interna</IonLabel>
                        <IonTextarea
                          rows={3}
                          value={internalNote}
                          onIonInput={(event) =>
                            setInternalNote(String(event.detail.value ?? ""))
                          }
                        />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Resolución</IonLabel>
                        <IonTextarea
                          rows={3}
                          value={resolution}
                          onIonInput={(event) =>
                            setResolution(String(event.detail.value ?? ""))
                          }
                        />
                      </IonItem>
                      <IonButton
                        expand="block"
                        className="rp-cta"
                        disabled={saving}
                        onClick={() => void save()}
                      >
                        {saving ? (
                          <IonSpinner name="dots" />
                        ) : detail.supportCase.category === "identity_correction" ? (
                          "Guardar corrección y seguimiento"
                        ) : (
                          "Guardar seguimiento"
                        )}
                      </IonButton>
                    </IonCardContent>
                  </IonCard>

                  {/* El <h3> suelto heredaba el color del tema sobre el fondo
                      del modal: en modo día quedaba ivory sobre arena. */}
                  <h2 className="rapago-section-label">Historial completo</h2>
                  {detail.events.map((event) => (
                    <IonCard key={event.id}>
                      <IonCardContent>
                        <div style={{ color: "#6b7280", fontSize: ".76rem" }}>
                          {formatDate(event.createdAt)} · {event.actorRole} ·{" "}
                          {event.eventType}
                        </div>
                        {event.publicMessage && (
                          <p>
                            <strong>Usuario:</strong> {event.publicMessage}
                          </p>
                        )}
                        {event.internalNote && (
                          /* La nota interna no es un párrafo más: sólo la ve
                             el equipo, nunca el usuario, y confundirlas al
                             responder es un incidente. El amarillo suelto
                             (#fff3cd) no lo decía; el bloque etiquetado sí. */
                          <p className="rp-card__quote" style={{ marginTop: 8 }}>
                            <strong>Nota interna · no visible para el usuario</strong>
                            <br />
                            {event.internalNote}
                          </p>
                        )}
                      </IonCardContent>
                    </IonCard>
                  ))}
                </div>
              )
            )}
            </div>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}

export default AdminSupportPage;
