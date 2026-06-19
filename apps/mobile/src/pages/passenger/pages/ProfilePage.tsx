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
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
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

type StoredRegistrationProfile = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  rut?: string | null;
  birthDate?: string | null;
};

function readStoredRegistrationProfile(): StoredRegistrationProfile {
  try {
    const raw = localStorage.getItem("rapago_registration_profile");
    const parsed = raw ? (JSON.parse(raw) as StoredRegistrationProfile) : {};

    return {
      ...parsed,
      phone: parsed.phone ?? localStorage.getItem("rapago_profile_phone"),
      rut: parsed.rut ?? localStorage.getItem("rapago_profile_rut"),
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

function getStoredLanguage(): string {
  try {
    return localStorage.getItem("rapago_preferred_language") || "es";
  } catch {
    return "es";
  }
}

function getLanguageLabel(language: string): string {
  if (language === "en") return "English";
  if (language === "rapa_nui") return "Rapa Nui";
  return "Español";
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
  const [preferredLanguage, setPreferredLanguage] = useState("es");

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

                  <IonItem lines="none" style={profileItemStyle()}>
                    <IonLabel style={profileLabelStyle()}>Idioma</IonLabel>
                    <IonSelect
                      interface="action-sheet"
                      value={preferredLanguage}
                      onIonChange={(event) => {
                        const nextLanguage = String(event.detail.value ?? "es");
                        setPreferredLanguage(nextLanguage);

                        try {
                          localStorage.setItem("rapago_preferred_language", nextLanguage);
                        } catch {
                          // No bloquea el cambio visual.
                        }
                      }}
                    >
                      <IonSelectOption value="es">Español</IonSelectOption>
                      <IonSelectOption value="en">English</IonSelectOption>
                      <IonSelectOption value="rapa_nui">Rapa Nui</IonSelectOption>
                    </IonSelect>
                  </IonItem>

                  <IonItem lines="none" style={profileItemStyle()}>
                    <IonLabel style={profileLabelStyle()}>Idioma actual</IonLabel>
                    <IonText style={{ fontWeight: 950, color: "#111" }}>
                      {getLanguageLabel(preferredLanguage)}
                    </IonText>
                  </IonItem>
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

            <IonButton
              expand="block"
              color="primary"
              style={{ marginTop: "20px", "--border-radius": "16px", height: "52px", fontWeight: 950 } as React.CSSProperties}
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
