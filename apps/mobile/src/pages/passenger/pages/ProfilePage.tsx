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
  IonIcon,
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
import { carOutline, checkmarkCircleOutline } from "ionicons/icons";
import { ModulePlaceholderPage } from "../../../components/ModulePlaceholderPage";
import { ROUTE_METADATA } from "../../../navigation/routeConfig";
import { ROUTES } from "../../../navigation/routes";
import { useAuth } from "../../../features/auth";
import { profileService, type ProfileData } from "../../../features/profile/profile.service";
import { ROLE_HOME } from "../../../navigation/RouteGuard";
import { documentsService } from "../../../features/documents/documents.service";
import { bankAccountService, type BankAccountData } from "../../../features/bankAccount/bankAccount.service";
import {
  ROLE_REQUIRED_DOCS,
  DOCUMENT_LABEL,
  STATUS_COLOR as DOC_STATUS_COLOR,
  STATUS_LABEL as DOC_STATUS_LABEL,
} from "../../../features/documents/documents.constants";
import { referralsService, type ReferralSummary } from "../../../features/referrals/referrals.service.js";

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
  resident: "Residente Rapa Nui",
  chilean: "Turista chileno",
  foreigner: "Turista extranjero",
};

const PASSENGER_FARE_DESCRIPTION: Record<PassengerFareType, string> = {
  resident: "Tarifa residente validada con documentación.",
  chilean: "Persona chilena que visita la isla y no acredita residencia.",
  foreigner: "Persona extranjera visitante.",
};

function normalizeTextForFare(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizePassengerFareType(...values: unknown[]): PassengerFareType | null {
  const normalizedValues = values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => normalizeTextForFare(value));

  for (const text of normalizedValues) {
    if (!text) continue;

    // Turista chileno debe detectarse antes que la palabra genérica "turista",
    // para evitar que se tome como extranjero.
    if (
      text.includes("turista chileno") ||
      text.includes("turista_chileno") ||
      text.includes("visitor_chilean") ||
      text.includes("chilean_tourist") ||
      text.includes("chilean_non_resident") ||
      text.includes("chileno_no_residente") ||
      text.includes("chilean no resident") ||
      text.includes("chileno no residente") ||
      text.includes("chilean-non-resident") ||
      text.includes("chileno-no-residente") ||
      text.includes("no residente") ||
      text.includes("no_residente") ||
      text.includes("non resident") ||
      text.includes("non_resident") ||
      text.includes("nonresident") ||
      text.includes("visitante_chileno") ||
      text.includes("chilena") ||
      text.includes("chileno") ||
      text.includes("chilean")
    ) {
      return "chilean";
    }

    if (
      text.includes("turista extranjero") ||
      text.includes("turista_extranjero") ||
      text.includes("foreign_tourist") ||
      text.includes("visitor_foreign") ||
      text.includes("foreigner") ||
      text.includes("foreign") ||
      text.includes("extranjera") ||
      text.includes("extranjero")
    ) {
      return "foreigner";
    }

    if (
      text.includes("residente rapa nui") ||
      text.includes("residente_rapa_nui") ||
      text.includes("resident_rapa_nui") ||
      text.includes("rapa nui") ||
      text.includes("rapanui") ||
      text.includes("local") ||
      text === "resident" ||
      text === "residente" ||
      text === "true" ||
      text === "1"
    ) {
      return "resident";
    }

    // Solo si no dice chileno ni extranjero, "turista" queda como extranjero por seguridad tarifaria.
    if (text.includes("turista") || text.includes("tourist") || text.includes("visitor")) {
      return "foreigner";
    }
  }

  return null;
}

function getPassengerFareTypeLabel(value: PassengerFareType | null | undefined): string {
  return value ? PASSENGER_FARE_LABEL[value] : "No informada";
}

function getPassengerFareTypeDescription(value: PassengerFareType | null | undefined): string {
  return value ? PASSENGER_FARE_DESCRIPTION[value] : "Este dato se tomará desde el registro.";
}

type NormalizedRole = "passenger" | "driver" | "guide" | "rental_operator" | "admin";

function normalizeRoleValue(value: unknown): NormalizedRole | null {
  const text = normalizeTextForFare(value);

  if (!text) return null;
  if (text.includes("admin") || text.includes("administrador")) return "admin";
  if (text.includes("driver") || text.includes("conductor")) return "driver";
  if (text.includes("guide") || text.includes("guia")) return "guide";
  if (
    text.includes("rental_operator") ||
    text.includes("rent_a_car") ||
    text.includes("rentacar") ||
    text.includes("arriendo")
  ) {
    return "rental_operator";
  }
  if (text.includes("passenger") || text.includes("pasajero")) return "passenger";

  return null;
}

function collectRoleValues(source: unknown): unknown[] {
  if (!source || typeof source !== "object") return [];

  const record = source as Record<string, unknown>;
  const values: unknown[] = [
    record.role,
    record.activeRole,
    record.currentRole,
    record.selectedRole,
    record.viewMode,
    record.mode,
  ];

  for (const key of ["roles", "availableRoles", "userRoles", "permissions"]) {
    const value = record[key];

    if (Array.isArray(value)) {
      values.push(...value);
    }
  }

  return values;
}

function getAutoRoleLabel(profileCandidate: unknown, userCandidate: unknown, canOpenDriverMode: boolean): string {
  const roles = new Set<NormalizedRole>();

  for (const value of [
    ...collectRoleValues(profileCandidate),
    ...collectRoleValues(userCandidate),
    localStorage.getItem("rapago_active_role"),
    localStorage.getItem("rapago_selected_role"),
    localStorage.getItem("rapago_view_mode"),
  ]) {
    const normalized = normalizeRoleValue(value);
    if (normalized) roles.add(normalized);
  }

  const profileRole =
    profileCandidate && typeof profileCandidate === "object"
      ? normalizeRoleValue((profileCandidate as Record<string, unknown>).role)
      : null;

  if (profileRole) roles.add(profileRole);
  if (canOpenDriverMode) roles.add("driver");
  if (roles.size === 0) roles.add("passenger");

  const ordered: NormalizedRole[] = ["passenger", "driver", "guide", "rental_operator", "admin"];

  return ordered
    .filter((role) => roles.has(role))
    .map((role) => ROLE_LABEL[role] ?? role)
    .join(" / ");
}

function sameEmail(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function readTextField(source: unknown, keys: string[]): string {
  if (!source || typeof source !== "object") return "";

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }

  return "";
}

function readBooleanField(source: unknown, keys: string[]): boolean {
  if (!source || typeof source !== "object") return false;

  const record = source as Record<string, unknown>;

  return keys.some((key) => record[key] === true);
}

function readArrayTextField(source: unknown, keys: string[]): string[] {
  if (!source || typeof source !== "object") return [];

  const record = source as Record<string, unknown>;
  const values: string[] = [];

  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      values.push(
        ...value
          .map((item) => String(item ?? "").trim().toLowerCase())
          .filter(Boolean),
      );
    }
  }

  return values;
}

function hasApprovedDriverAccess(profile: unknown, user: unknown): boolean {
  const roleText = [
    readTextField(profile, ["role", "activeRole", "currentRole"]),
    readTextField(user, ["role", "activeRole", "currentRole"]),
    ...readArrayTextField(profile, ["roles", "availableRoles"]),
    ...readArrayTextField(user, ["roles", "availableRoles"]),
  ].join(" ");

  const hasDriverRole =
    roleText.includes("driver") ||
    roleText.includes("conductor");

  if (!hasDriverRole) {
    return false;
  }

  const driverStatusText = [
    readTextField(profile, [
      "driverStatus",
      "driverProfileStatus",
      "driverApplicationStatus",
      "applicationStatus",
      "approvalStatus",
      "driverApprovalStatus",
    ]),
    readTextField(user, [
      "driverStatus",
      "driverProfileStatus",
      "driverApplicationStatus",
      "applicationStatus",
      "approvalStatus",
      "driverApprovalStatus",
    ]),
  ].join(" ");

  const generalStatusText = [
    readTextField(profile, ["status"]),
    readTextField(user, ["status"]),
  ].join(" ");

  const hasExplicitApproval =
    driverStatusText.includes("approved") ||
    driverStatusText.includes("aprobado") ||
    driverStatusText.includes("active") ||
    driverStatusText.includes("activo") ||
    generalStatusText.includes("approved") ||
    generalStatusText.includes("aprobado") ||
    generalStatusText.includes("active") ||
    generalStatusText.includes("activo") ||
    readBooleanField(profile, ["isDriverApproved", "driverApproved", "isApprovedDriver"]) ||
    readBooleanField(user, ["isDriverApproved", "driverApproved", "isApprovedDriver"]);

  // El botón solo debe aparecer para usuarios que ya son conductores
  // y cuya cuenta/postulación de conductor está aprobada o activa.
  return hasExplicitApproval;
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
    passengerCondition?: string | null;
    condition?: string | null;
    nationality?: string | null;
    isResident?: boolean | string | null;
    rapaNuiEthnicity?: string | boolean | null;
    role?: string | null;
    activeRole?: string | null;
    currentRole?: string | null;
    roles?: string[] | null;
  };
  function readStoredRegistrationProfile(): StoredRegistrationProfile {
    try {
      const raw = localStorage.getItem("rapago_registration_profile");
      const parsed = raw ? (JSON.parse(raw) as StoredRegistrationProfile) : {};
      const directFareType =
        localStorage.getItem("rapago_passenger_fare_type") ??
        localStorage.getItem("rapago_passenger_condition") ??
        localStorage.getItem("rapago_profile_passenger_type") ??
        localStorage.getItem("rapago_fare_passenger_type") ??
        localStorage.getItem("farePassengerType") ??
        localStorage.getItem("passengerType") ??
        localStorage.getItem("condition");
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
        passengerCondition:
          parsed.passengerCondition ??
          parsed.condition ??
          localStorage.getItem("rapago_passenger_condition") ??
          localStorage.getItem("condition") ??
          null,
        condition:
          parsed.condition ??
          localStorage.getItem("rapago_passenger_condition") ??
          localStorage.getItem("condition") ??
          null,
        rapaNuiEthnicity:
          parsed.rapaNuiEthnicity ??
          localStorage.getItem("rapago_belongs_to_rapa_nui_ethnicity") ??
          null,
        role:
          parsed.role ??
          localStorage.getItem("rapago_active_role") ??
          localStorage.getItem("rapago_selected_role") ??
          null,
        activeRole:
          parsed.activeRole ??
          localStorage.getItem("rapago_active_role") ??
          null,
        currentRole:
          parsed.currentRole ??
          localStorage.getItem("rapago_view_mode") ??
          null,
        roles: Array.isArray(parsed.roles) ? parsed.roles : null,
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
        localStorage.setItem("rapago_passenger_condition", normalizedFareType);
        localStorage.setItem("rapago_profile_passenger_type", normalizedFareType);
        localStorage.setItem("rapago_profile_nationality", getPassengerFareTypeLabel(normalizedFareType));
        localStorage.setItem("rapago_nationality", getPassengerFareTypeLabel(normalizedFareType));
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
      profileObject.passengerCondition,
      profileObject.condition,
      profileObject.nationality,
      profileObject.isResident,

      sessionUser.passengerFareType,
      sessionUser.farePassengerType,
      sessionUser.passengerType,
      sessionUser.passengerCondition,
      sessionUser.condition,
      sessionUser.nationality,
      sessionUser.isResident,
    );

    if (fromProfileOrSession) return fromProfileOrSession;

    const storedBelongsToThisUser = !stored.email || !profileEmail || sameEmail(stored.email, profileEmail);

    if (storedBelongsToThisUser) {
      const fromStored =
        normalizePassengerFareType(
          stored.nationality,
          stored.passengerFareLabel,
          stored.farePassengerType,
          stored.passengerFareType,
          stored.passengerType,
          stored.passengerCondition,
          stored.condition,
          stored.isResident,
        ) ??
        normalizePassengerFareType(
          stored.directNationality,
          stored.directPassengerFareType,
          localStorage.getItem("rapago_passenger_condition"),
          localStorage.getItem("rapago_passenger_fare_type"),
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
        role: data.role,
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
          role: session.user?.role ?? null,
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
        role: updated.role,
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
  const canOpenDriverMode = hasApprovedDriverAccess(profile, session?.user);
  const accountRoleLabel = getAutoRoleLabel(profile, session?.user, canOpenDriverMode);

  function handleGoToDriverMode(): void {
    try {
      localStorage.setItem("rapago_active_mode", "driver");
      localStorage.setItem("rapago_active_role", "driver");
      localStorage.setItem("rapago_selected_role", "driver");
      localStorage.setItem("rapago_view_mode", "driver");

      const currentRaw = localStorage.getItem("rapago_registration_profile");
      const current = currentRaw ? JSON.parse(currentRaw) as Record<string, unknown> : {};
      const currentRoles = Array.isArray(current.roles)
        ? current.roles.map((item) => String(item))
        : [];
      localStorage.setItem("rapago_registration_profile", JSON.stringify({
        ...current,
        activeRole: "driver",
        currentRole: "driver",
        roles: Array.from(new Set(["passenger", "driver", ...currentRoles])),
      }));
    } catch {
      // No bloquea navegación si el navegador no permite localStorage.
    }

    history.push(ROUTES.DRIVER.HOME);
  }

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
                  <div><strong>Nacionalidad:</strong> {getPassengerFareTypeLabel(passengerFareType)}</div>
                  <div style={{ color: "var(--ion-color-medium)", fontSize: "0.78rem", marginTop: "-2px" }}>
                    {getPassengerFareTypeDescription(passengerFareType)}
                  </div>
                  <div><strong>Rol:</strong> {accountRoleLabel}</div>
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

            {canOpenDriverMode && (
              <IonCard
                style={{
                  margin: "0 0 14px",
                  borderRadius: "18px",
                  overflow: "hidden",
                  background:
                    "linear-gradient(135deg, rgba(17,17,17,.98), rgba(58,45,27,.97) 58%, rgba(210,164,58,.90))",
                  color: "#ffffff",
                  border: "1px solid rgba(210,164,58,.42)",
                  boxShadow: "0 12px 28px rgba(0,0,0,.22)",
                }}
              >
                <IonCardContent
                  style={{
                    padding: "12px",
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      background: "rgba(255,255,255,.14)",
                      border: "1px solid rgba(255,255,255,.18)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IonIcon icon={carOutline} style={{ fontSize: 24, color: "#F8D879" }} />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        color: "#BBF7D0",
                        fontSize: ".66rem",
                        fontWeight: 950,
                        letterSpacing: ".03em",
                        textTransform: "uppercase",
                        marginBottom: 2,
                      }}
                    >
                      <IonIcon icon={checkmarkCircleOutline} />
                      Conductor aprobado
                    </div>

                    <div style={{ fontWeight: 950, fontSize: ".92rem", lineHeight: 1.15 }}>
                      Modo conductor
                    </div>

                    <div
                      style={{
                        marginTop: 2,
                        color: "rgba(255,255,255,.74)",
                        fontSize: ".70rem",
                        fontWeight: 700,
                        lineHeight: 1.25,
                      }}
                    >
                      Ver solicitudes y aceptar viajes.
                    </div>
                  </div>

                  <IonButton
                    size="small"
                    onClick={handleGoToDriverMode}
                    style={
                      {
                        "--border-radius": "999px",
                        "--background": "linear-gradient(135deg, #D8A83E 0%, #F0D9AA 100%)",
                        "--background-activated": "#d2a43a",
                        "--color": "#111111",
                        height: "34px",
                        minHeight: "34px",
                        fontWeight: 950,
                        fontSize: ".72rem",
                        margin: 0,
                        flexShrink: 0,
                      } as React.CSSProperties
                    }
                  >
                    Entrar
                  </IonButton>
                </IonCardContent>
              </IonCard>
            )}


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
                  <IonLabel position="stacked">Nacionalidad</IonLabel>
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

type DocumentRecord = import("../../../features/documents/documents.service").DocumentRecord;

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

export default ProfileIndexPage;
