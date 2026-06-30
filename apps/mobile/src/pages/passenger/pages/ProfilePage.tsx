import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useState, useCallback, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../../../features/auth/index.js";
import { ROUTES } from "../../../navigation/routes.js";
import type { PassengerProfileData } from "../../../features/passengers/passengerProfile.service.js";

type PassengerFareType = "resident" | "chilean" | "foreigner";

type StoredRegistrationProfile = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  rut?: string | null;
  birthDate?: string | null;

  // Se guarda desde el registro para aplicar reglas tarifarias sin mostrar porcentajes.
  passengerFareType?: string | null;
  passengerFareLabel?: string | null;
  directPassengerFareType?: string | null;
  directNationality?: string | null;
  passengerType?: string | null;
  farePassengerType?: string | null;
  nationality?: string | null;
  isResident?: boolean | string | null;
};

const PASSENGER_FARE_LABEL: Record<PassengerFareType, string> = {
  resident: "Residente",
  chilean: "Chileno no residente",
  foreigner: "Extranjero / turista",
};

const PASSENGER_FARE_SHORT_LABEL: Record<PassengerFareType, string> = {
  resident: "Residente",
  chilean: "Chileno",
  foreigner: "Extranjero",
};

function sameEmail(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function getUserStringField(user: unknown, key: string): string | null {
  if (!user || typeof user !== "object") return null;

  const value = (user as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getUserBooleanField(user: unknown, key: string): boolean | null {
  if (!user || typeof user !== "object") return null;

  const value = (user as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

function readStoredRegistrationProfile(): StoredRegistrationProfile {
  try {
    const raw = localStorage.getItem("rapago_registration_profile");
    const parsed = raw ? (JSON.parse(raw) as StoredRegistrationProfile) : {};

    const directFareType =
      localStorage.getItem("rapago_passenger_fare_type") ??
      localStorage.getItem("rapago_profile_passenger_type") ??
      localStorage.getItem("rapago_fare_passenger_type") ??
      localStorage.getItem("rapago_passenger_type") ??
      localStorage.getItem("farePassengerType") ??
      localStorage.getItem("passengerType");

    const directNationality =
      localStorage.getItem("rapago_profile_nationality") ??
      localStorage.getItem("rapago_nationality") ??
      localStorage.getItem("rapago_user_nationality") ??
      localStorage.getItem("nationality");

    const storedResident = localStorage.getItem("rapago_is_resident");

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
        parsed.passengerFareLabel ??
        parsed.nationality ??
        null,
      directPassengerFareType: directFareType,
      directNationality,
      passengerType:
        parsed.passengerType ??
        parsed.farePassengerType ??
        parsed.passengerFareType ??
        null,
      farePassengerType:
        parsed.farePassengerType ??
        parsed.passengerFareType ??
        parsed.passengerType ??
        null,
      nationality:
        parsed.nationality ??
        parsed.passengerFareLabel ??
        null,
      isResident:
        typeof parsed.isResident === "boolean" || typeof parsed.isResident === "string"
          ? parsed.isResident
          : storedResident === "true"
            ? true
            : storedResident === "false"
              ? false
              : null,
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
      const label = getPassengerFareTypeLabel(normalizedFareType);

      localStorage.setItem("rapago_passenger_fare_type", normalizedFareType);
      localStorage.setItem("rapago_profile_passenger_type", normalizedFareType);
      localStorage.setItem("rapago_fare_passenger_type", normalizedFareType);
      localStorage.setItem("rapago_profile_nationality", label);
      localStorage.setItem("rapago_nationality", label);
      localStorage.setItem("rapago_is_resident", normalizedFareType === "resident" ? "true" : "false");
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

function getAutoPhone(sessionUser: unknown): string {
  const stored = readStoredRegistrationProfile();

  return (
    getSessionPhone(sessionUser) ||
    stored.phone?.trim() ||
    localStorage.getItem("rapago_profile_phone")?.trim() ||
    ""
  );
}

function getStoredLanguage(): "es" | "en" {
  try {
    const stored = localStorage.getItem("rapago_preferred_language");
    return stored === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

function getLanguageLabel(language: string): string {
  return language === "en" ? "English" : "Español";
}

function normalizeTextForFare(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizePassengerFareType(...values: unknown[]): PassengerFareType | null {
  const raw = normalizeTextForFare(
    values.filter((value) => value !== null && value !== undefined && value !== "").join(" "),
  );

  if (!raw) return null;

  // Orden importante:
  // "Chileno no residente" contiene "residente". Por eso extranjero primero,
  // después chileno no residente y al final residente.
  if (
    raw.includes("foreigner") ||
    raw.includes("foreign") ||
    raw.includes("extranjero") ||
    raw.includes("extranjera") ||
    raw.includes("turista") ||
    raw.includes("tourist") ||
    raw.includes("visitor_foreign")
  ) {
    return "foreigner";
  }

  if (
    raw.includes("chileno no residente") ||
    raw.includes("chilena no residente") ||
    raw.includes("no residente") ||
    raw.includes("no_residente") ||
    raw.includes("non resident") ||
    raw.includes("non_resident") ||
    raw.includes("chilean") ||
    raw.includes("chileno") ||
    raw.includes("chilena") ||
    raw === "cl" ||
    raw === "chile"
  ) {
    return "chilean";
  }

  if (
    raw.includes("resident") ||
    raw.includes("residente") ||
    raw.includes("rapa_nui_resident") ||
    raw.includes("rapanui_resident") ||
    raw.includes("local") ||
    raw === "true" ||
    raw === "1"
  ) {
    return "resident";
  }

  return null;
}

function getPassengerFareTypeFromStored(
  stored: StoredRegistrationProfile,
  sessionUser: unknown,
): PassengerFareType | null {
  const sessionEmail = getUserStringField(sessionUser, "email");
  const storedBelongsToThisUser = !stored.email || !sessionEmail || sameEmail(stored.email, sessionEmail);

  const fromSession =
    normalizePassengerFareType(
      getUserStringField(sessionUser, "passengerFareType"),
      getUserStringField(sessionUser, "farePassengerType"),
      getUserStringField(sessionUser, "passengerType"),
      getUserStringField(sessionUser, "nationality"),
    ) ??
    (getUserBooleanField(sessionUser, "isResident") === true ? "resident" : null);

  if (fromSession) return fromSession;

  if (storedBelongsToThisUser) {
    const fromStored =
      normalizePassengerFareType(
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
      ) ??
      (stored.isResident === true || stored.isResident === "true" ? "resident" : null);

    if (fromStored) return fromStored;
  }

  return null;
}

function getPassengerFareTypeLabel(type: PassengerFareType | null): string {
  return type ? PASSENGER_FARE_LABEL[type] : "No informada";
}

function getPassengerFareTypeShortLabel(type: PassengerFareType | null): string {
  return type ? PASSENGER_FARE_SHORT_LABEL[type] : "No informada";
}

function getPassengerFareTypeHelper(type: PassengerFareType | null): string {
  if (type === "resident") return "Registrado como residente.";
  if (type === "foreigner") return "Registrado como visitante extranjero.";
  if (type === "chilean") return "Registrado como chileno no residente.";
  return "Este dato se toma desde el registro.";
}

function cleanPhone(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "").slice(0, 15);

  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

function profileCardStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    margin: "0 0 16px",
    borderRadius: "22px",
    background: "#F6F2EC",
    color: "#111",
    border: "1px solid rgba(200,155,60,.28)",
    boxShadow: "0 14px 34px rgba(0,0,0,.20)",
    overflow: "hidden",
    ...extra,
  };
}

function profileItemStyle(): React.CSSProperties {
  return {
    "--background": "#ffffff",
    "--color": "#111111",
    "--placeholder-color": "#6b6b6b",
    "--placeholder-opacity": "1",
    "--highlight-color-focused": "#C89B3C",
    border: "1.5px solid rgba(200,155,60,.55)",
    borderRadius: "16px",
    overflow: "hidden",
    marginTop: "10px",
    fontWeight: 900,
  } as React.CSSProperties;
}

function profileInputStyle(): React.CSSProperties {
  return {
    color: "#111111",
    fontWeight: 950,
    fontSize: "1rem",
    opacity: 1,
    "--color": "#111111",
    "--placeholder-color": "#6b6b6b",
    "--placeholder-opacity": "1",
  } as React.CSSProperties;
}

function profileLabelStyle(): React.CSSProperties {
  return {
    color: "#111111",
    fontWeight: 950,
    fontSize: ".78rem",
    opacity: 1,
  };
}

function languageButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    minHeight: 58,
    border: active ? "3px solid #111111" : "2px solid rgba(200,155,60,.45)",
    borderRadius: 18,
    background: active
      ? "linear-gradient(135deg,#D4A62A 0%,#F7D774 100%)"
      : "linear-gradient(135deg,#FFFFFF 0%,#F7F1E7 100%)",
    color: "#111111",
    boxShadow: active ? "0 12px 28px rgba(212,166,42,.35)" : "0 8px 18px rgba(0,0,0,.08)",
    fontWeight: 950,
    fontSize: ".93rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transform: active ? "scale(1.02)" : "scale(1)",
    transition: "all .18s ease",
  };
}

function hasStoredDriverAccess(): boolean {
  try {
    return (
      localStorage.getItem("driverApproved") === "true" ||
      localStorage.getItem("rapago_driver_approved") === "true" ||
      localStorage.getItem("rapago_driver_status") === "approved" ||
      localStorage.getItem("driver_status") === "approved"
    );
  } catch {
    return false;
  }
}

function isApprovedDriverUser(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;

  const value = user as Record<string, unknown>;

  return (
    value.role === "driver" ||
    value.driverApproved === true ||
    value.isDriverApproved === true ||
    value.driverStatus === "approved" ||
    value.driverApplicationStatus === "approved" ||
    value.applicationStatus === "approved"
  );
}

export default function ProfilePage(): JSX.Element {
  const auth = useAuth() as ReturnType<typeof useAuth> & {
    logout?: () => void | Promise<void>;
    signOut?: () => void | Promise<void>;
  };

  const { session } = auth;
  const history = useHistory();

  const [profile, setProfile] = useState<PassengerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const [phone, setPhone] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<"es" | "en">("es");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const stored = readStoredRegistrationProfile();
      const autoPhone = getAutoPhone(session?.user);
      const language = getStoredLanguage();

      setPhone(autoPhone);
      setPreferredLanguage(language);

      setProfile({
        phone: autoPhone,
        preferredLanguage: language,
      } as PassengerProfileData);

      if (autoPhone) {
        persistStoredRegistrationProfile({
          phone: autoPhone,
          email: session?.user?.email ?? stored.email ?? null,
          name: session?.user?.name ?? stored.name ?? null,
        });
      }
    } catch {
      setLoadError(null);
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);

    try {
      const trimPhone = cleanPhone(phone);

      if (trimPhone) {
        localStorage.setItem("rapago_profile_phone", trimPhone);
      }

      localStorage.setItem("rapago_preferred_language", preferredLanguage);

      persistStoredRegistrationProfile({
        phone: trimPhone,
        email: session?.user?.email ?? null,
        name: session?.user?.name ?? null,
      });

      setPhone(trimPhone);
      setProfile({
        phone: trimPhone,
        preferredLanguage,
      } as PassengerProfileData);

      setSaveOk(true);
    } catch {
      setSaveError("Error al guardar el perfil.");
    } finally {
      setSaving(false);
    }
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

  const userName = session?.user?.name ?? readStoredRegistrationProfile().name ?? "";
  const userEmail = session?.user?.email ?? readStoredRegistrationProfile().email ?? "";
  const initials =
    userName
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0] ?? "")
      .join("")
      .toUpperCase() || "?";

  const showPhoneWarning = !phone.trim();
  const canSwitchToDriver = isApprovedDriverUser(session?.user) || hasStoredDriverAccess();
  const storedProfile = readStoredRegistrationProfile();
  const passengerFareType = getPassengerFareTypeFromStored(storedProfile, session?.user);
  const passengerFareTypeLabel = getPassengerFareTypeLabel(passengerFareType);
  const passengerFareTypeShortLabel = getPassengerFareTypeShortLabel(passengerFareType);
  const passengerFareTypeHelper = getPassengerFareTypeHelper(passengerFareType);

  function handleSwitchToDriver(): void {
    try {
      localStorage.setItem("rapago_active_mode", "driver");
      localStorage.setItem("rapago_active_role", "driver");
      localStorage.setItem("active_role", "driver");
    } catch {
      // Si localStorage falla, igual intenta navegar.
    }

    const driverHome = ROUTES.DRIVER.HOME;
    history.replace(driverHome);
    window.setTimeout(() => {
      window.location.assign(driverHome);
    }, 80);
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mi Perfil</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent
        className="ion-padding"
        style={{
          "--background":
            "linear-gradient(180deg, rgba(15,15,15,.78), rgba(15,15,15,.96)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
        } as React.CSSProperties}
      >
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => {
            void loadProfile().then(() => event.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && (
          <div style={{ maxWidth: 560, margin: "0 auto", paddingBottom: 96 }}>
            <section
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "26px",
                padding: "20px",
                marginBottom: 14,
                background: "linear-gradient(135deg, rgba(200,155,60,.95), rgba(217,195,160,.92))",
                color: "#111",
                boxShadow: "0 18px 44px rgba(0,0,0,.30)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: -42,
                  top: -48,
                  width: 145,
                  height: 145,
                  borderRadius: 999,
                  background: "rgba(255,255,255,.18)",
                }}
              />

              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "22px",
                    background: "rgba(17,17,17,.20)",
                    border: "1px solid rgba(255,255,255,.38)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.55rem",
                    fontWeight: 950,
                    color: "#fff",
                  }}
                >
                  {initials}
                </div>

                <div>
                  <div style={{ fontSize: "1.28rem", fontWeight: 950, lineHeight: 1.1, color: "#111" }}>
                    {userName || "Pasajero"}
                  </div>
                  <div style={{ marginTop: 4, fontSize: ".83rem", fontWeight: 850, color: "rgba(17,17,17,.78)" }}>
                    Perfil de pasajero Rapa Go
                  </div>
                  <div style={{ marginTop: 8, fontSize: ".78rem", fontWeight: 900, color: "rgba(17,17,17,.84)" }}>
                    {phone.trim() ? phone : "Teléfono pendiente"}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,.34)",
                      border: "1px solid rgba(255,255,255,.45)",
                      color: "#111",
                      fontSize: ".72rem",
                      fontWeight: 950,
                    }}
                  >
                    <span>Nacionalidad:</span>
                    <span>{passengerFareTypeShortLabel}</span>
                  </div>
                </div>
              </div>
            </section>

            {showPhoneWarning && (
              <IonCard style={profileCardStyle({ background: "#fff3cd", border: "1px solid #ffc107" })}>
                <IonCardContent style={{ padding: "10px 14px" }}>
                  <IonText>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b4700", fontWeight: 850 }}>
                      Completa tu teléfono para solicitar viajes.
                    </p>
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

            {loadError && (
              <IonCard style={profileCardStyle({ background: "#fff3cd", border: "1px solid #ffc107" })}>
                <IonCardContent style={{ padding: "10px 14px" }}>
                  <IonText>
                    <p style={{ margin: 0, color: "#6b4700", fontWeight: 850 }}>
                      {loadError}
                    </p>
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

            <IonCard style={profileCardStyle()}>
              <IonCardContent>
                <IonList style={{ background: "transparent", padding: 0 }}>
                  <IonListHeader style={{ paddingLeft: 0 }}>
                    <IonLabel>
                      <strong style={{ color: "#111", fontWeight: 950 }}>Datos personales</strong>
                    </IonLabel>
                  </IonListHeader>

                  <IonItem lines="none" style={profileItemStyle()}>
                    <IonLabel position="stacked" style={profileLabelStyle()}>
                      Nombre
                    </IonLabel>
                    <IonInput style={profileInputStyle()} value={userName} readonly />
                  </IonItem>

                  <IonItem lines="none" style={profileItemStyle()}>
                    <IonLabel position="stacked" style={profileLabelStyle()}>
                      Email
                    </IonLabel>
                    <IonInput style={profileInputStyle()} value={userEmail} readonly />
                  </IonItem>

                  <IonItem lines="none" style={profileItemStyle()}>
                    <IonLabel position="stacked" style={profileLabelStyle()}>
                      Nacionalidad / residencia
                    </IonLabel>
                    <IonInput style={profileInputStyle()} value={passengerFareTypeLabel} readonly />
                    <IonNote slot="helper" style={{ color: "#5f4a16", fontWeight: 850 }}>
                      {passengerFareTypeHelper}
                    </IonNote>
                  </IonItem>

                  <IonItem lines="none" style={profileItemStyle()}>
                    <IonLabel position="stacked" style={profileLabelStyle()}>
                      Teléfono
                    </IonLabel>
                    <IonInput
                      style={profileInputStyle()}
                      value={phone}
                      onIonInput={(event) => setPhone(cleanPhone(String(event.detail.value ?? "")))}
                      placeholder="+56 9 1234 5678"
                      type="tel"
                      inputmode="tel"
                      maxlength={16}
                      clearInput
                    />
                  </IonItem>
                </IonList>
              </IonCardContent>
            </IonCard>

            <IonCard style={profileCardStyle()}>
              <IonCardContent>
                <IonList style={{ background: "transparent", padding: 0 }}>
                  <IonListHeader style={{ paddingLeft: 0 }}>
                    <IonLabel>
                      <strong style={{ color: "#111", fontWeight: 950 }}>Idioma preferido</strong>
                    </IonLabel>
                  </IonListHeader>

                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: 20,
                      background: "linear-gradient(135deg,#FFFFFF 0%,#F7F1E7 100%)",
                      border: "1.5px solid rgba(200,155,60,.38)",
                    }}
                  >
                    <div style={{ color: "#111", fontWeight: 950, fontSize: ".82rem", marginBottom: 10 }}>
                      Selecciona tu idioma
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <button
                        type="button"
                        style={languageButtonStyle(preferredLanguage === "es")}
                        onClick={() => {
                          setPreferredLanguage("es");
                          try {
                            localStorage.setItem("rapago_preferred_language", "es");
                          } catch {
                            // No bloquea el cambio visual.
                          }
                        }}
                      >
                        <span aria-hidden="true">🇨🇱</span>
                        <span>Español</span>
                      </button>

                      <button
                        type="button"
                        style={languageButtonStyle(preferredLanguage === "en")}
                        onClick={() => {
                          setPreferredLanguage("en");
                          try {
                            localStorage.setItem("rapago_preferred_language", "en");
                          } catch {
                            // No bloquea el cambio visual.
                          }
                        }}
                      >
                        <span aria-hidden="true">🇺🇸</span>
                        <span>English</span>
                      </button>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        padding: "12px 14px",
                        borderRadius: 16,
                        background: preferredLanguage === "es" ? "rgba(212,166,42,.18)" : "rgba(36,105,201,.12)",
                        color: "#111",
                        fontWeight: 950,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <span>Idioma actual</span>
                      <span>{getLanguageLabel(preferredLanguage)}</span>
                    </div>
                  </div>
                </IonList>
              </IonCardContent>
            </IonCard>

            {saveOk && (
              <IonText color="success">
                <p style={{ margin: "12px 0 0", fontSize: "0.85rem", fontWeight: 850 }}>
                  Perfil guardado correctamente.
                </p>
              </IonText>
            )}

            {saveError && (
              <IonText color="danger">
                <p style={{ margin: "12px 0 0", fontSize: "0.85rem", fontWeight: 850 }}>
                  {saveError}
                </p>
              </IonText>
            )}

            {canSwitchToDriver && (
              <IonButton
                expand="block"
                color="success"
                style={{
                  marginTop: "20px",
                  "--border-radius": "18px",
                  height: "56px",
                  fontWeight: 950,
                  fontSize: "1rem",
                  boxShadow: "0 14px 28px rgba(34,197,94,.28)",
                } as React.CSSProperties}
                onClick={handleSwitchToDriver}
                disabled={saving}
              >
                🚖 Cambiar a modo Conductor
              </IonButton>
            )}

            <IonButton
              expand="block"
              color="primary"
              style={{ marginTop: canSwitchToDriver ? "12px" : "20px", "--border-radius": "16px", height: "52px", fontWeight: 950 } as React.CSSProperties}
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? <IonSpinner name="dots" /> : "Guardar cambios"}
            </IonButton>

            <IonButton
              expand="block"
              fill="outline"
              color="danger"
              style={{ marginTop: "12px", marginBottom: "24px", "--border-radius": "16px", height: "52px", fontWeight: 950 } as React.CSSProperties}
              onClick={() => void handleLogout()}
              disabled={saving}
            >
              Cerrar sesión
            </IonButton>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
