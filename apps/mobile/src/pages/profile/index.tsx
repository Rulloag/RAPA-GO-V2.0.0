import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useState, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { useAuth } from "../../features/auth";
import { profileService, type ProfileData } from "../../features/profile/profile.service";
import { ROLE_HOME } from "../../navigation/RouteGuard";
import { documentsService } from "../../features/documents/documents.service";
import { bankAccountService, type BankAccountData } from "../../features/bankAccount/bankAccount.service";
import {
  ROLE_REQUIRED_DOCS,
  DOCUMENT_LABEL,
  STATUS_COLOR as DOC_STATUS_COLOR,
  STATUS_LABEL as DOC_STATUS_LABEL,
} from "../../features/documents/documents.constants";

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

const ROLE_LABEL: Record<string, string> = {
  passenger:       "Pasajero",
  driver:          "Conductor",
  guide:           "Guía Turístico",
  rental_operator: "Operador de Arriendo",
  admin:           "Administrador",
};

const STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente de verificación",
  active:    "Activa",
  suspended: "Suspendida",
  banned:    "Bloqueada",
};

export function ProfileIndexPage(): JSX.Element {
  const { session } = useAuth();
  const history = useHistory();

  const [profile,    setProfile]    = useState<ProfileData | null>(null);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);

  const [nameInput,      setNameInput]      = useState("");
  const [avatarInput,    setAvatarInput]    = useState("");
  const [saving,         setSaving]         = useState(false);
  const [saveError,      setSaveError]      = useState<string | null>(null);
  const [saveSuccess,    setSaveSuccess]    = useState(false);

  const loadProfile = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await profileService.getProfile(session.accessToken);
      setProfile(data);
      setNameInput(data.name);
      setAvatarInput(data.avatarUrl ?? "");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar el perfil.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  async function handleSave() {
    if (!session?.accessToken || !profile) return;

    // Build payload before entering loading state to avoid a flash of spinner
    // when there's nothing to save.
    const payload: { name?: string; avatarUrl?: string | null } = {};
    const trimmedName = nameInput.trim();
    if (trimmedName && trimmedName !== profile.name) {
      payload.name = trimmedName;
    }
    const trimmedAvatar = avatarInput.trim();
    const avatarChanged = trimmedAvatar !== (profile.avatarUrl ?? "");
    if (avatarChanged) {
      payload.avatarUrl = trimmedAvatar === "" ? null : trimmedAvatar;
    }
    if (Object.keys(payload).length === 0) {
      setSaveError("No hay cambios para guardar.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await profileService.updateProfile(session.accessToken, payload);
      setProfile(updated);
      setNameInput(updated.name);
      setAvatarInput(updated.avatarUrl ?? "");
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  const roleHome = profile?.role ? ROLE_HOME[profile.role as keyof typeof ROLE_HOME] : undefined;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mi Perfil</IonTitle>
          {roleHome && (
            <IonButtons slot="start">
              <IonButton onClick={() => history.push(roleHome)}>Inicio</IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && (
          <IonText color="danger">
            <p>{loadError}</p>
          </IonText>
        )}

        {!loading && profile && (
          <>
            {/* Account info */}
            <IonCard style={{ marginBottom: "16px" }}>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: "1rem" }}>Datos de la cuenta</IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ paddingTop: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem" }}>
                  <div><strong>Email:</strong> {profile.email}</div>
                  <div><strong>Rol:</strong> {ROLE_LABEL[profile.role] ?? profile.role}</div>
                  <div>
                    <strong>Estado:</strong>{" "}
                    <span style={{ color: profile.status === "active" ? "var(--ion-color-success)" : "var(--ion-color-warning)" }}>
                      {STATUS_LABEL[profile.status] ?? profile.status}
                    </span>
                  </div>
                  <div>
                    <strong>Verificado:</strong>{" "}
                    <span style={{ color: profile.isVerified ? "var(--ion-color-success)" : "var(--ion-color-medium)" }}>
                      {profile.isVerified ? "Sí" : "No"}
                    </span>
                  </div>
                  <div style={{ color: "var(--ion-color-medium)", fontSize: "0.75rem" }}>
                    Miembro desde {new Date(profile.createdAt).toLocaleDateString("es-CL")}
                  </div>
                </div>
              </IonCardContent>
            </IonCard>

            {/* Edit form */}
            <IonCard>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: "1rem" }}>Editar perfil</IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ paddingTop: 0 }}>
                <IonItem lines="full">
                  <IonLabel position="stacked">Nombre</IonLabel>
                  <IonInput
                    value={nameInput}
                    onIonInput={(e) => setNameInput(String(e.detail.value ?? ""))}
                    placeholder="Tu nombre completo"
                    maxlength={100}
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" style={{ marginTop: "8px" }}>
                  <IonLabel position="stacked">URL de avatar (opcional)</IonLabel>
                  <IonInput
                    value={avatarInput}
                    onIonInput={(e) => setAvatarInput(String(e.detail.value ?? ""))}
                    placeholder="https://..."
                    type="url"
                    clearInput
                  />
                  <IonNote slot="helper" style={{ fontSize: "0.7rem" }}>
                    Carga de imágenes disponible en una versión futura.
                  </IonNote>
                </IonItem>

                {saveSuccess && (
                  <IonText color="success">
                    <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>✓ Cambios guardados correctamente.</p>
                  </IonText>
                )}
                {saveError && (
                  <IonText color="danger">
                    <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>{saveError}</p>
                  </IonText>
                )}

                <IonButton
                  expand="block"
                  style={{ marginTop: "16px" }}
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? <IonSpinner name="dots" /> : "Guardar cambios"}
                </IonButton>
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}

export function ProfileDocumentsPage(): JSX.Element {
  return <DocumentsPage />;
}

function DocumentsPage(): JSX.Element {
  const { session, user } = useAuth();

  const [docs,       setDocs]       = useState<import("../../features/documents/documents.service").DocumentRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [creating,   setCreating]   = useState<string | null>(null); // documentType being prepared
  const [createErr,  setCreateErr]  = useState<string | null>(null);

  const role = user?.role ?? "";

  const requiredTypes: readonly string[] = (
    (role in ROLE_REQUIRED_DOCS) ? ROLE_REQUIRED_DOCS[role] : []
  ) as readonly string[];

  useEffect(() => {
    if (!session?.accessToken) return;
    setLoading(true);
    documentsService
      .listDocuments(session.accessToken)
      .then(setDocs)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Error al cargar documentos."))
      .finally(() => setLoading(false));
  }, [session?.accessToken]);

  async function handlePrepare(documentType: string) {
    if (!session?.accessToken) return;
    setCreating(documentType);
    setCreateErr(null);
    try {
      const doc = await documentsService.createDocument(session.accessToken, documentType);
      setDocs((prev) => [...prev, doc]);
    } catch (e: unknown) {
      setCreateErr(e instanceof Error ? e.message : "Error al preparar el documento.");
    } finally {
      setCreating(null);
    }
  }

  const docByType = Object.fromEntries(docs.map((d) => [d.documentType, d]));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Documentos</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Notice */}
        <div style={{
          background: "var(--ion-color-warning-tint)",
          border: "1px solid var(--ion-color-warning)",
          borderRadius: "8px",
          padding: "10px 14px",
          marginBottom: "16px",
          fontSize: "0.82rem",
          color: "var(--ion-color-warning-shade)",
        }}>
          <strong>Carga de archivos pendiente para fase futura.</strong><br />
          Puedes preparar el registro de cada documento ahora. La subida real de archivos estará disponible próximamente.
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && requiredTypes.length === 0 && (
          <IonText color="medium"><p>Este rol no requiere documentos.</p></IonText>
        )}

        {!loading && requiredTypes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {requiredTypes.map((docType) => {
              const existing = docByType[docType];
              const label = DOCUMENT_LABEL[docType] ?? docType;
              const status = existing?.status ?? null;
              const statusColor = status ? DOC_STATUS_COLOR[status] ?? "medium" : "medium";
              const statusText  = status ? DOC_STATUS_LABEL[status]  ?? status  : "No registrado";

              return (
                <IonCard key={docType} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px" }}>{label}</div>
                        <IonBadge color={statusColor} style={{ fontSize: "0.7rem" }}>{statusText}</IonBadge>
                        {existing?.rejectionReason && (
                          <IonText color="danger">
                            <p style={{ margin: "6px 0 0", fontSize: "0.78rem" }}>
                              Motivo: {existing.rejectionReason}
                            </p>
                          </IonText>
                        )}
                      </div>
                      {!existing && (
                        <IonButton
                          size="small"
                          fill="outline"
                          disabled={creating === docType}
                          onClick={() => void handlePrepare(docType)}
                          style={{ flexShrink: 0 }}
                        >
                          {creating === docType ? <IonSpinner name="dots" /> : "Preparar"}
                        </IonButton>
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        {createErr && (
          <IonText color="danger">
            <p style={{ marginTop: "12px", fontSize: "0.85rem" }}>{createErr}</p>
          </IonText>
        )}
      </IonContent>
    </IonPage>
  );
}

export function ProfileBankAccountPage(): JSX.Element {
  return <BankAccountPage />;
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: "Cuenta corriente",
  savings:  "Cuenta de ahorro",
  vista:    "Cuenta vista",
};

const BANK_OPTIONS = [
  "Banco de Chile", "BancoEstado", "Santander", "BCI", "Scotiabank",
  "Itaú", "BICE", "Security", "Falabella", "Ripley", "Coopeuch", "Otro",
];

function BankAccountPage(): JSX.Element {
  const { session } = useAuth();

  const [account,     setAccount]     = useState<BankAccountData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);

  const [holderInput, setHolderInput] = useState("");
  const [bankInput,   setBankInput]   = useState("");
  const [typeInput,   setTypeInput]   = useState<"checking" | "savings" | "vista">("checking");
  const [numInput,    setNumInput]    = useState("");

  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadAccount = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await bankAccountService.getBankAccount(session.accessToken);
      setAccount(data);
      if (data) {
        setHolderInput(data.accountHolderName);
        setBankInput(data.bankName);
        setTypeInput(data.accountType as "checking" | "savings" | "vista");
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar la cuenta bancaria.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadAccount(); }, [loadAccount]);

  async function handleSave() {
    if (!session?.accessToken) return;
    const trimHolder = holderInput.trim();
    const trimBank   = bankInput.trim();
    const trimNum    = numInput.trim();

    if (!trimHolder || !trimBank || !trimNum) {
      setSaveError("Completa todos los campos requeridos.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await bankAccountService.upsertBankAccount(session.accessToken, {
        accountHolderName: trimHolder,
        bankName:          trimBank,
        accountType:       typeInput,
        accountNumber:     trimNum,
      });
      setAccount(updated);
      setHolderInput(updated.accountHolderName);
      setBankInput(updated.bankName);
      setTypeInput(updated.accountType as "checking" | "savings" | "vista");
      setNumInput("");
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar la cuenta bancaria.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Cuenta Bancaria</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Notice — pagos futuros */}
        <div style={{
          background:    "var(--ion-color-warning-tint)",
          border:        "1px solid var(--ion-color-warning)",
          borderRadius:  "8px",
          padding:       "10px 14px",
          marginBottom:  "16px",
          fontSize:      "0.82rem",
          color:         "var(--ion-color-warning-shade)",
        }}>
          <strong>Los pagos reales se implementarán en una fase futura.</strong><br />
          Puedes registrar tu cuenta bancaria ahora. El procesamiento de pagos estará disponible próximamente.
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && (
          <>
            {/* Current account info */}
            {account && (
              <IonCard style={{ marginBottom: "16px" }}>
                <IonCardHeader>
                  <IonCardTitle style={{ fontSize: "1rem" }}>Cuenta registrada</IonCardTitle>
                </IonCardHeader>
                <IonCardContent style={{ paddingTop: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem" }}>
                    <div><strong>Titular:</strong> {account.accountHolderName}</div>
                    <div><strong>Banco:</strong> {account.bankName}</div>
                    <div><strong>Tipo:</strong> {ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType}</div>
                    <div><strong>Número:</strong> •••• {account.accountNumberLast4}</div>
                    <div>
                      <strong>Estado:</strong>{" "}
                      <IonBadge color={account.status === "active" ? "success" : "warning"} style={{ fontSize: "0.7rem" }}>
                        {account.status === "active" ? "Activa" : "Pendiente"}
                      </IonBadge>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            )}

            {/* Form */}
            <IonCard>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: "1rem" }}>
                  {account ? "Actualizar cuenta bancaria" : "Registrar cuenta bancaria"}
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ paddingTop: 0 }}>

                <IonItem lines="full">
                  <IonLabel position="stacked">Nombre del titular</IonLabel>
                  <IonInput
                    value={holderInput}
                    onIonInput={(e) => setHolderInput(String(e.detail.value ?? ""))}
                    placeholder="Nombre completo del titular"
                    maxlength={150}
                    clearInput
                  />
                </IonItem>

                <IonItem lines="full" style={{ marginTop: "8px" }}>
                  <IonLabel position="stacked">Banco</IonLabel>
                  <IonInput
                    value={bankInput}
                    onIonInput={(e) => setBankInput(String(e.detail.value ?? ""))}
                    placeholder={BANK_OPTIONS.slice(0, 3).join(", ") + "..."}
                    maxlength={100}
                    clearInput
                  />
                </IonItem>

                <IonItem lines="full" style={{ marginTop: "8px" }}>
                  <IonLabel position="stacked">Tipo de cuenta</IonLabel>
                  <select
                    value={typeInput}
                    onChange={(e) => setTypeInput(e.target.value as "checking" | "savings" | "vista")}
                    style={{
                      width: "100%", padding: "10px 0", background: "transparent",
                      border: "none", fontSize: "1rem", color: "var(--ion-text-color)",
                    }}
                  >
                    <option value="checking">Cuenta corriente</option>
                    <option value="savings">Cuenta de ahorro</option>
                    <option value="vista">Cuenta vista</option>
                  </select>
                </IonItem>

                <IonItem lines="none" style={{ marginTop: "8px" }}>
                  <IonLabel position="stacked">Número de cuenta</IonLabel>
                  <IonInput
                    value={numInput}
                    onIonInput={(e) => setNumInput(String(e.detail.value ?? ""))}
                    placeholder="Solo dígitos"
                    type="tel"
                    maxlength={20}
                    clearInput
                  />
                  <IonNote slot="helper" style={{ fontSize: "0.7rem" }}>
                    Solo se guardarán los últimos 4 dígitos.
                  </IonNote>
                </IonItem>

                {saveSuccess && (
                  <IonText color="success">
                    <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>✓ Cuenta bancaria guardada correctamente.</p>
                  </IonText>
                )}
                {saveError && (
                  <IonText color="danger">
                    <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>{saveError}</p>
                  </IonText>
                )}

                <IonButton
                  expand="block"
                  style={{ marginTop: "16px" }}
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? <IonSpinner name="dots" /> : (account ? "Actualizar cuenta" : "Guardar cuenta")}
                </IonButton>
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}

export function ProfileSecurityPage(): JSX.Element {
  const m = meta("/profile/security");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function ProfileNotificationsPage(): JSX.Element {
  const m = meta("/profile/notifications");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}
