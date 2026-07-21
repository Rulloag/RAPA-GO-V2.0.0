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
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useState, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
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
import { referralsService, type ReferralSummary } from "../../features/referrals/referrals.service.js";
import { RapaGoLanguageRuntime, RapaGoLanguageCard } from "../../i18n/rapagoI18n";

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

type PassengerFareType = "resident" | "chilean" | "foreigner";

const PASSENGER_FARE_LABEL: Record<PassengerFareType, string> = {
  resident: "Residente",
  chilean: "Chileno no residente",
  foreigner: "Extranjero / turista",
};

function normalizeTextForFare(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizePassengerFareType(...values: unknown[]): PassengerFareType | null {
  const text = normalizeTextForFare(values.filter((value) => value !== null && value !== undefined && value !== "").join(" "));

  if (!text) return null;

  // Orden importante: "chileno no residente" contiene la palabra "residente".
  // Por eso primero detectamos extranjero, después chileno no residente y al final residente.
  if (
    text.includes("foreigner") ||
    text.includes("foreign") ||
    text.includes("extranjero") ||
    text.includes("turista") ||
    text.includes("tourist") ||
    text.includes("visitor_foreign")
  ) {
    return "foreigner";
  }

  if (
    text.includes("chilean") ||
    text.includes("chileno") ||
    text.includes("no residente") ||
    text.includes("no_residente") ||
    text.includes("non resident") ||
    text.includes("non_resident") ||
    text.includes("visitante_chileno")
  ) {
    return "chilean";
  }

  if (
    text.includes("resident") ||
    text.includes("residente") ||
    text.includes("local") ||
    text === "true" ||
    text === "1"
  ) {
    return "resident";
  }

  return null;
}

function getPassengerFareTypeLabel(value: PassengerFareType | null | undefined): string {
  return value ? PASSENGER_FARE_LABEL[value] : "No informada";
}

function sameEmail(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function ProfileIndexPage(): JSX.Element {
  const auth = useAuth() as ReturnType<typeof useAuth> & {
    logout?: () => void | Promise<void>;
    signOut?: () => void | Promise<void>;
  };

  const { session } = auth;
  const history = useHistory();

  type StoredRegistrationProfile = {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    rut?: string | null;
    birthDate?: string | null;
    passengerFareType?: PassengerFareType | string | null;
    passengerFareLabel?: string | null;
    directPassengerFareType?: string | null;
    directNationality?: string | null;
    passengerType?: PassengerFareType | string | null;
    farePassengerType?: PassengerFareType | string | null;
    nationality?: string | null;
    isResident?: boolean | string | null;
  };

  function readStoredRegistrationProfile(): StoredRegistrationProfile {
    try {
      const raw = localStorage.getItem("rapago_registration_profile");
      const parsed = raw ? (JSON.parse(raw) as StoredRegistrationProfile) : {};
      const directFareType =
        localStorage.getItem("rapago_passenger_fare_type") ??
        localStorage.getItem("rapago_profile_passenger_type") ??
        localStorage.getItem("rapago_fare_passenger_type") ??
        localStorage.getItem("farePassengerType") ??
        localStorage.getItem("passengerType");
      const directNationality =
        localStorage.getItem("rapago_profile_nationality") ??
        localStorage.getItem("rapago_nationality") ??
        localStorage.getItem("nationality");

      return {
        ...parsed,
        phone: parsed.phone ?? localStorage.getItem("rapago_profile_phone"),
        rut: parsed.rut ?? localStorage.getItem("rapago_profile_rut"),
        passengerFareType:
          parsed.passengerFareType ??
          parsed.farePassengerType ??
          parsed.passengerType ??
          null,
        passengerFareLabel:
          parsed.passengerFareLabel ?? parsed.nationality ?? null,
        directPassengerFareType: directFareType,
        directNationality,
        nationality: parsed.nationality ?? parsed.passengerFareLabel ?? null,
      };
    } catch {
      return {};
    }
  }

  function persistStoredRegistrationProfile(data: Partial<StoredRegistrationProfile>): void {
    try {
      const current = readStoredRegistrationProfile();
      const next = { ...current, ...data };

      localStorage.setItem("rapago_registration_profile", JSON.stringify(next));

      if (next.phone) localStorage.setItem("rapago_profile_phone", next.phone);
      if (next.rut) localStorage.setItem("rapago_profile_rut", next.rut);

      const normalizedFareType = normalizePassengerFareType(
        next.passengerFareType,
        next.farePassengerType,
        next.passengerType,
        next.nationality,
        next.passengerFareLabel,
        next.isResident,
      );

      if (normalizedFareType) {
        localStorage.setItem("rapago_passenger_fare_type", normalizedFareType);
        localStorage.setItem("rapago_profile_passenger_type", normalizedFareType);
        localStorage.setItem("rapago_profile_nationality", getPassengerFareTypeLabel(normalizedFareType));
      }
    } catch {
      // No bloquea el perfil si localStorage no está disponible.
    }
  }

  function getSessionPhone(user: unknown): string {
    if (!user || typeof user !== "object") return "";

    const value = (user as { phone?: string | null }).phone;
    return typeof value === "string" ? value.trim() : "";
  }

  function getAutoPhone(profilePhone?: string | null): string {
    const stored = readStoredRegistrationProfile();

    return (
      profilePhone?.trim() ||
      getSessionPhone(session?.user) ||
      stored.phone?.trim() ||
      ""
    );
  }

  function getAutoPassengerFareType(profileCandidate?: unknown): PassengerFareType | null {
    const stored = readStoredRegistrationProfile();
    const profileObject = profileCandidate && typeof profileCandidate === "object"
      ? (profileCandidate as Record<string, unknown>)
      : {};
    const sessionUser = session?.user && typeof session.user === "object"
      ? (session.user as Record<string, unknown>)
      : {};

    const profileEmail = String(profileObject.email ?? sessionUser.email ?? stored.email ?? "").trim();

    const fromProfileOrSession = normalizePassengerFareType(
      profileObject.passengerFareType,
      profileObject.farePassengerType,
      profileObject.passengerType,
      profileObject.nationality,
      profileObject.isResident,
      sessionUser.passengerFareType,
      sessionUser.farePassengerType,
      sessionUser.passengerType,
      sessionUser.nationality,
      sessionUser.isResident,
    );

    if (fromProfileOrSession) return fromProfileOrSession;

    const storedBelongsToThisUser = !stored.email || !profileEmail || sameEmail(stored.email, profileEmail);

    if (storedBelongsToThisUser) {
      const fromStored = normalizePassengerFareType(
        stored.nationality,
        stored.passengerFareLabel,
        stored.farePassengerType,
        stored.passengerFareType,
        stored.passengerType,
        stored.isResident,
      ) ??
      normalizePassengerFareType(
        stored.directNationality,
        stored.directPassengerFareType,
      );

      if (fromStored) return fromStored;
    }

    return null;
  }

  const [profile,    setProfile]    = useState<ProfileData | null>(null);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);

  const [nameInput,      setNameInput]      = useState("");
  const [avatarInput,    setAvatarInput]    = useState("");
  const [phoneInput,     setPhoneInput]     = useState("");
  const [passengerFareType, setPassengerFareType] = useState<PassengerFareType | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [saveError,      setSaveError]      = useState<string | null>(null);
  const [saveSuccess,    setSaveSuccess]    = useState(false);

  const [referral,       setReferral]       = useState<ReferralSummary | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode,     setCopiedCode]     = useState(false);

  const loadProfile = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setLoadError(null);

    try {
      const data = await profileService.getProfile(session.accessToken);
      const autoPhone = getAutoPhone((data as ProfileData & { phone?: string | null }).phone);
      const autoPassengerFareType = getAutoPassengerFareType(data);

      setProfile(data);
      setNameInput(data.name);
      setAvatarInput(data.avatarUrl ?? "");
      setPhoneInput(autoPhone);
      setPassengerFareType(autoPassengerFareType);

      persistStoredRegistrationProfile({
        ...(autoPhone ? { phone: autoPhone } : {}),
        email: data.email,
        name: data.name,
        ...(autoPassengerFareType
          ? {
              passengerFareType: autoPassengerFareType,
              passengerFareLabel: getPassengerFareTypeLabel(autoPassengerFareType),
              nationality: getPassengerFareTypeLabel(autoPassengerFareType),
              isResident: autoPassengerFareType === "resident",
            }
          : {}),
      });

      referralsService.getMyReferral(session.accessToken).then(setReferral).catch(() => {});
    } catch (err) {
      const fallbackPhone = getAutoPhone(null);
      const fallbackPassengerFareType = getAutoPassengerFareType(session.user);

      setPassengerFareType(fallbackPassengerFareType);

      if (fallbackPhone || fallbackPassengerFareType) {
        setPhoneInput(fallbackPhone);
        persistStoredRegistrationProfile({
          ...(fallbackPhone ? { phone: fallbackPhone } : {}),
          email: session.user?.email ?? null,
          name: session.user?.name ?? null,
          ...(fallbackPassengerFareType
            ? {
                passengerFareType: fallbackPassengerFareType,
                passengerFareLabel: getPassengerFareTypeLabel(fallbackPassengerFareType),
                nationality: getPassengerFareTypeLabel(fallbackPassengerFareType),
                isResident: fallbackPassengerFareType === "resident",
              }
            : {}),
        });
      }

      setLoadError(err instanceof Error ? err.message : "Error al cargar el perfil.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, session?.user]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  async function handleSave() {
    if (!session?.accessToken || !profile) return;

    const payload: { name?: string; avatarUrl?: string | null; phone?: string } = {};
    const trimmedName = nameInput.trim();
    const trimmedPhone = phoneInput.trim();

    if (trimmedName && trimmedName !== profile.name) {
      payload.name = trimmedName;
    }

    const trimmedAvatar = avatarInput.trim();
    const avatarChanged = trimmedAvatar !== (profile.avatarUrl ?? "");
    if (avatarChanged) {
      payload.avatarUrl = trimmedAvatar === "" ? null : trimmedAvatar;
    }

    if (trimmedPhone) {
      payload.phone = trimmedPhone;
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
      const savedPhone = getAutoPhone((updated as ProfileData & { phone?: string | null }).phone ?? trimmedPhone);

      setProfile(updated);
      setNameInput(updated.name);
      setAvatarInput(updated.avatarUrl ?? "");
      setPhoneInput(savedPhone);

      persistStoredRegistrationProfile({
        ...(savedPhone ? { phone: savedPhone } : {}),
        email: updated.email,
        name: updated.name,
        ...(passengerFareType
          ? {
              passengerFareType,
              passengerFareLabel: getPassengerFareTypeLabel(passengerFareType),
              nationality: getPassengerFareTypeLabel(passengerFareType),
              isResident: passengerFareType === "resident",
            }
          : {}),
      });

      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateCode() {
    if (!session?.accessToken) return;
    setGeneratingCode(true);
    try {
      const result = await referralsService.generateCode(session.accessToken);
      setReferral(prev => prev
        ? { ...prev, code: result.code, link: result.link }
        : { code: result.code, link: result.link, usedCount: 0, totalReward: 0, pendingReward: 0 }
      );
    } catch { } finally {
      setGeneratingCode(false);
    }
  }

  async function handleCopyCode(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch { }
  }

  async function handleLogout() {
    try {
      if (typeof auth.logout === "function") {
        await auth.logout();
      } else if (typeof auth.signOut === "function") {
        await auth.signOut();
      } else {
        localStorage.removeItem("rapago_session");
        localStorage.removeItem("rapago_auth_session");
        localStorage.removeItem("auth_session");
        sessionStorage.clear();
      }
    } finally {
      history.replace(ROUTES.AUTH.LOGIN);
    }
  }

  const roleHome = profile?.role ? ROLE_HOME[profile.role as keyof typeof ROLE_HOME] : undefined;

  return (
    <IonPage>
      <RapaGoLanguageRuntime />
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
            <RapaGoLanguageCard />

            {!phoneInput.trim() && (
              <IonCard style={{ margin: "0 0 12px", background: "#fff3cd", border: "1px solid #ffc107" }}>
                <IonCardContent style={{ padding: "8px 14px" }}>
                  <IonText>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b4700" }}>
                      Completa tu teléfono para solicitar viajes.
                    </p>
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

            {/* Account info */}
            <IonCard style={{ marginBottom: "16px" }}>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: "1rem" }}>Datos de la cuenta</IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ paddingTop: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem" }}>
                  <div><strong>Email:</strong> {profile.email}</div>
                  <div><strong>Nacionalidad / residencia:</strong> {getPassengerFareTypeLabel(passengerFareType)}</div>
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

                <IonItem lines="full" style={{ marginTop: "8px" }}>
                  <IonLabel position="stacked">Teléfono</IonLabel>
                  <IonInput
                    value={phoneInput}
                    onIonInput={(e) => setPhoneInput(String(e.detail.value ?? ""))}
                    placeholder="+56 9 1234 5678"
                    type="tel"
                    maxlength={20}
                    clearInput
                  />
                </IonItem>

                <IonItem lines="full" style={{ marginTop: "8px" }}>
                  <IonLabel position="stacked">Nacionalidad / residencia</IonLabel>
                  <IonInput
                    value={getPassengerFareTypeLabel(passengerFareType)}
                    readonly
                  />
                  <IonNote slot="helper" style={{ fontSize: "0.7rem" }}>
                    Este dato se toma automáticamente desde el registro y se usa para calcular tarifas.
                  </IonNote>
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

            {/* Invita y Gana */}
            <IonCard style={{ marginTop: "16px" }}>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: "1rem" }}>Invita y Gana</IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ paddingTop: 0 }}>
                {referral && referral.code ? (
                  <>
                    <div style={{ fontSize: "0.85rem", marginBottom: "8px" }}>
                      <strong>Tu código:</strong>{" "}
                      <span style={{ fontFamily: "monospace", fontSize: "1rem" }}>{referral.code}</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginBottom: "12px" }}>
                      Has invitado a <strong>{referral.usedCount}</strong> persona{referral.usedCount !== 1 ? "s" : ""}{" "}
                      · Has ganado <strong>${referral.totalReward.toLocaleString("es-CL")} CLP</strong>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <IonButton size="small" onClick={() => void handleCopyCode(referral.code)}>
                        {copiedCode ? "¡Copiado!" : "Copiar código"}
                      </IonButton>
                      <IonButton size="small" fill="outline" onClick={() => {
                        const shareData = { title: "RAPA GO", text: "Usa mi código para tu primer viaje", url: referral.link };
                        if (navigator.share) {
                          void navigator.share(shareData);
                        } else {
                          void handleCopyCode(referral.link);
                        }
                      }}>
                        Compartir link
                      </IonButton>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: "0.85rem", color: "var(--ion-color-medium)", margin: "0 0 12px" }}>
                      Genera tu código único y compártelo. Cuando alguien complete su primer viaje usando tu código, recibirás un beneficio en tu billetera.
                    </p>
                    <IonButton
                      expand="block"
                      onClick={() => void handleGenerateCode()}
                      disabled={generatingCode}
                    >
                      {generatingCode ? <IonSpinner name="dots" /> : "Generar mi código"}
                    </IonButton>
                  </>
                )}
              </IonCardContent>
            </IonCard>

            <IonCard style={{ marginTop: "16px", marginBottom: "20px" }}>
              <IonCardContent>
                <IonButton
                  expand="block"
                  color="danger"
                  fill="outline"
                  onClick={() => void handleLogout()}
                  disabled={saving}
                  style={{ fontWeight: 800 }}
                >
                  Cerrar sesión
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

type DocumentRecord = import("../../features/documents/documents.service").DocumentRecord;

function DocumentsPage(): JSX.Element {
  const { session, user } = useAuth();

  const [docs,       setDocs]       = useState<DocumentRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [creating,   setCreating]   = useState<string | null>(null);
  const [createErr,  setCreateErr]  = useState<string | null>(null);

  // Upload metadata form state
  const [uploadDocId,   setUploadDocId]   = useState<string | null>(null);
  const [fileName,      setFileName]      = useState("");
  const [fileMimeType,  setFileMimeType]  = useState("image/jpeg");
  const [fileSizeMB,    setFileSizeMB]    = useState("");
  const [uploading,     setUploading]     = useState(false);
  const [uploadErr,     setUploadErr]     = useState<string | null>(null);

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

  async function handleUploadMetadata() {
    if (!session?.accessToken || !uploadDocId) return;
    const sizeBytes = Math.round(parseFloat(fileSizeMB) * 1024 * 1024);
    if (!fileName.trim() || fileName.trim().length < 3) {
      setUploadErr("El nombre de archivo debe tener al menos 3 caracteres.");
      return;
    }
    if (!fileSizeMB || isNaN(sizeBytes) || sizeBytes <= 0) {
      setUploadErr("El tamaño debe ser mayor a 0.");
      return;
    }
    if (sizeBytes > 10 * 1024 * 1024) {
      setUploadErr("El tamaño no puede superar 10 MB.");
      return;
    }
    setUploading(true);
    setUploadErr(null);
    try {
      const updated = await documentsService.uploadMetadata(session.accessToken, uploadDocId, {
        fileName:      fileName.trim(),
        fileMimeType,
        fileSizeBytes: sizeBytes,
      });
      setDocs((prev) => prev.map((d) => (d.id === uploadDocId ? updated : d)));
      setUploadDocId(null);
      setFileName("");
      setFileSizeMB("");
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : "Error al registrar metadata.");
    } finally {
      setUploading(false);
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
          <strong>Carga real de archivos se implementará en fase futura.</strong><br />
          Esta fase solo registra metadata del documento. No se sube ningún archivo al servidor.
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
              const canUpload   = existing && (existing.status === "pending" || existing.status === "rejected");
              const isExpanded  = uploadDocId === existing?.id;

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
                        {existing?.fileUrl && (
                          <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--ion-color-medium)", wordBreak: "break-all" }}>
                            {existing.fileUrl}
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                        {!existing && (
                          <IonButton
                            size="small"
                            fill="outline"
                            disabled={creating === docType}
                            onClick={() => void handlePrepare(docType)}
                          >
                            {creating === docType ? <IonSpinner name="dots" /> : "Preparar"}
                          </IonButton>
                        )}
                        {canUpload && (
                          <IonButton
                            size="small"
                            fill="outline"
                            color="primary"
                            onClick={() => {
                              if (isExpanded) {
                                setUploadDocId(null);
                              } else {
                                setUploadDocId(existing.id);
                                setFileName("");
                                setFileMimeType("image/jpeg");
                                setFileSizeMB("");
                                setUploadErr(null);
                              }
                            }}
                          >
                            {isExpanded ? "Cancelar" : "Marcar subido"}
                          </IonButton>
                        )}
                      </div>
                    </div>

                    {/* Upload metadata form */}
                    {isExpanded && (
                      <div style={{ marginTop: "12px", borderTop: "1px solid var(--ion-color-light-shade)", paddingTop: "10px" }}>
                        <IonItem lines="full">
                          <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Nombre del archivo</IonLabel>
                          <IonInput
                            value={fileName}
                            onIonInput={(e) => setFileName(String(e.detail.value ?? ""))}
                            placeholder="ej: cedula_frente.jpg"
                          />
                        </IonItem>
                        <IonItem lines="full">
                          <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Tipo de archivo</IonLabel>
                          <IonSelect
                            value={fileMimeType}
                            onIonChange={(e) => setFileMimeType(String(e.detail.value ?? "image/jpeg"))}
                            interface="popover"
                          >
                            <IonSelectOption value="image/jpeg">JPEG (imagen)</IonSelectOption>
                            <IonSelectOption value="image/png">PNG (imagen)</IonSelectOption>
                            <IonSelectOption value="application/pdf">PDF</IonSelectOption>
                          </IonSelect>
                        </IonItem>
                        <IonItem lines="none">
                          <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Tamaño en MB (máx 10)</IonLabel>
                          <IonInput
                            type="number"
                            value={fileSizeMB}
                            onIonInput={(e) => setFileSizeMB(String(e.detail.value ?? ""))}
                            placeholder="ej: 1.5"
                            min="0.001"
                            max="10"
                          />
                        </IonItem>
                        {uploadErr && (
                          <IonText color="danger">
                            <p style={{ fontSize: "0.78rem", margin: "6px 0" }}>{uploadErr}</p>
                          </IonText>
                        )}
                        <IonButton
                          expand="block"
                          size="small"
                          style={{ marginTop: "8px" }}
                          onClick={() => void handleUploadMetadata()}
                          disabled={uploading}
                        >
                          {uploading ? <IonSpinner name="dots" /> : "Registrar metadata"}
                        </IonButton>
                      </div>
                    )}
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
          Registra una cuenta bancaria solo para devoluciones aprobadas. RAPA GO no utiliza estos datos para realizar cobros.
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
                  <IonLabel position="stacked">
                    Número de cuenta{account ? ` (actual: •••• ${account.accountNumberLast4})` : ""}
                  </IonLabel>
                  <IonInput
                    value={numInput}
                    onIonInput={(e) => setNumInput(String(e.detail.value ?? ""))}
                    placeholder={account ? "Ingresa el número para confirmar cambios" : "Solo dígitos"}
                    type="tel"
                    maxlength={20}
                    clearInput
                  />
                  <IonNote slot="helper" style={{ fontSize: "0.7rem" }}>
                    Solo se guardarán los últimos 4 dígitos. Requerido para guardar.
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
