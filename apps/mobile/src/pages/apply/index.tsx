  import {
    IonAlert,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCheckbox,
    IonChip,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonItemDivider,
    IonLabel,
    IonList,
    IonNote,
    IonPage,
    IonSpinner,
    IonText,
    IonTextarea,
    IonTitle,
    IonToggle,
    IonToolbar,
    useIonViewWillEnter,
  } from "@ionic/react";
  import { useEffect, useState, type CSSProperties } from "react";
  import { useHistory } from "react-router-dom";
  import { useAuth } from "../../features/auth/index.js";
  import { applicationsService, type ApplicationData } from "../../features/applications/applications.service.js";

  const SPECIALTIES = ["Arqueología", "Botánica", "Astronomía", "Historia", "Cultura Rapa Nui", "Senderismo"];
  const OFFERED_TOURS = ["Ahu Tongariki", "Rano Raraku", "Anakena", "Orongo", "Tahai", "Custom"];
  const LANGUAGES = ["Español", "Inglés", "Rapa Nui", "Francés", "Alemán", "Portugués"];

  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  type SessionUserForApplication = {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    rut?: string | null;
    birthDate?: string | null;
  };

  function splitName(user?: SessionUserForApplication): { firstName: string; lastName: string } {
    const fullName = user?.name?.trim() ?? "";
    const parts = fullName.split(/\s+/).filter(Boolean);

    const firstName = user?.firstName?.trim() || parts[0] || "";
    const lastName =
      user?.lastName?.trim() ||
      (parts.length > 1 ? parts.slice(1).join(" ") : "");

    return { firstName, lastName };
  }

  function fileLabel(file: File | null): string {
    return file ? `✓ ${file.name}` : "Sin archivo seleccionado";
  }

  function getSelectedFile(event: Event): File | null {
    const input = event.target as HTMLInputElement;
    return input.files?.[0] ?? null;
  }

  function normalizeRut(value: string): string {
    return formatRut(value);
  }

  function isEmailValid(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

function readStoredRegistrationProfile(): SessionUserForApplication {
  try {
    const raw = localStorage.getItem("rapago_registration_profile");
    const parsed = raw ? (JSON.parse(raw) as SessionUserForApplication) : {};

    return {
      ...parsed,
      phone:
        parsed.phone ??
        localStorage.getItem("rapago_profile_phone") ??
        localStorage.getItem("rapago_driver_phone") ??
        "",
      rut:
        parsed.rut ??
        localStorage.getItem("rapago_profile_rut") ??
        localStorage.getItem("rapago_driver_rut") ??
        "",
    };
  } catch {
    return {};
  }
}

function getAutoAccountData(user?: SessionUserForApplication): {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rut: string;
  birthDate: string;
} {
  const stored = readStoredRegistrationProfile();
  const names = splitName({
    ...stored,
    ...user,
    name: user?.name || stored.name,
    firstName: user?.firstName || stored.firstName,
    lastName: user?.lastName || stored.lastName,
  });

  return {
    firstName: names.firstName,
    lastName: names.lastName,
    email: user?.email?.trim() || stored.email?.trim() || "",
    phone: user?.phone?.trim() || stored.phone?.trim() || "",
    rut: user?.rut?.trim() || stored.rut?.trim() || "",
    birthDate: user?.birthDate?.trim() || stored.birthDate?.trim() || "",
  };
}

function onlyNumbers(value: string, maxLength = 12): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function cleanPhone(value: string): string {
  const digits = onlyNumbers(value, 11);
  return digits;
}

function cleanRut(value: string): string {
  return onlyNumbers(value, 9);
}

function formatRut(value: string): string {
  const clean = cleanRut(value);
  if (clean.length <= 1) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  const grouped =
    body
      .split("")
      .reverse()
      .join("")
      .match(/.{1,3}/g)
      ?.map((part) => part.split("").reverse().join(""))
      .reverse()
      .join(".") ?? body;

  return `${grouped}-${dv}`;
}

function cleanNumber(value: string, maxLength = 3): string {
  return onlyNumbers(value, maxLength);
}

function persistApplicationAutofill(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rut: string;
  birthDate?: string;
}): void {
  try {
    const current = readStoredRegistrationProfile();
    const next = {
      ...current,
      name: `${data.firstName} ${data.lastName}`.trim(),
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      rut: data.rut,
      birthDate: data.birthDate ?? current.birthDate ?? "",
    };

    localStorage.setItem("rapago_registration_profile", JSON.stringify(next));
    if (data.phone) {
      localStorage.setItem("rapago_profile_phone", data.phone);
      localStorage.setItem("rapago_driver_phone", data.phone);
    }
    if (data.rut) {
      localStorage.setItem("rapago_profile_rut", data.rut);
      localStorage.setItem("rapago_driver_rut", data.rut);
    }
  } catch {
    // No bloquea la inscripción.
  }
}

function isPhoneValid(value: string): boolean {
  const digits = cleanPhone(value);
  return /^9\d{8}$/.test(digits) || /^569\d{8}$/.test(digits);
}

function isRutValid(value: string): boolean {
  const digits = cleanRut(value);
  return digits.length >= 8 && digits.length <= 9;
}


  function makeApplicationStyles() {
    const cardStyle: CSSProperties = {
      margin: "0 0 14px",
      borderRadius: "22px",
      background: "#F6F2EC",
      color: "#111111",
      border: "2px solid rgba(200,155,60,.26)",
      boxShadow: "0 14px 34px rgba(0,0,0,.26)",
    };

    const cardTitleStyle: CSSProperties = {
      color: "#111111",
      fontSize: "1rem",
      fontWeight: 950,
    };

    const noteStyle: CSSProperties = {
      color: "#404040",
      display: "block",
      marginTop: "4px",
      fontWeight: 650,
      lineHeight: 1.45,
    };

    const itemStyle: CSSProperties = {
      "--background": "#ffffff",
      "--color": "#111111",
      "--border-color": "transparent",
      "--highlight-color-focused": "#C89B3C",
      "--padding-start": "14px",
      "--inner-padding-end": "14px",
      border: "2px solid #E6D4B4",
      borderRadius: "18px",
      marginBottom: "12px",
      color: "#111111",
    } as CSSProperties;

    const labelStyle: CSSProperties = {
      color: "#111111",
      fontWeight: 950,
      fontSize: ".9rem",
    };

    const inputStyle: CSSProperties = {
      "--color": "#111111",
      "--placeholder-color": "#777777",
      "--placeholder-opacity": "1",
      color: "#111111",
      fontWeight: 800,
    } as CSSProperties;

    const fileButtonStyle: CSSProperties = {
      width: "100%",
      display: "block",
      border: "2px dashed rgba(200,155,60,.85)",
      background: "#ffffff",
      color: "#111111",
      borderRadius: "18px",
      padding: "14px",
      textAlign: "left",
      fontWeight: 950,
      cursor: "pointer",
    };

    const sectionTextStyle: CSSProperties = {
      color: "#404040",
      fontWeight: 650,
      lineHeight: 1.45,
    };

    return {
      cardStyle,
      cardTitleStyle,
      noteStyle,
      itemStyle,
      labelStyle,
      inputStyle,
      fileButtonStyle,
      sectionTextStyle,
    };
  }

  export function ApplicationDriverPage(): JSX.Element {
    const { session } = useAuth();
    const history = useHistory();
    const styles = makeApplicationStyles();

    const sessionUser = session?.user as SessionUserForApplication | undefined;

    const [firstName, setFirstName] = useState("");
    const [lastName,  setLastName]  = useState("");
    const [email,     setEmail]     = useState("");
    const [phone,     setPhone]     = useState("");
    const [rut,       setRut]       = useState("");
    const [birthDate, setBirthDate] = useState("");

    const [belongsToRapaNuiEthnicity, setBelongsToRapaNuiEthnicity] = useState<"yes" | "no" | "">("");

    const [identityFrontFile, setIdentityFrontFile] = useState<File | null>(null);
    const [identityBackFile,  setIdentityBackFile]  = useState<File | null>(null);
    const [driverLicenseFile, setDriverLicenseFile] = useState<File | null>(null);

    const [acceptDataTreatment, setAcceptDataTreatment] = useState(false);
    const [acceptDeclaration,   setAcceptDeclaration]   = useState(false);

    const [loading,        setLoading]        = useState(false);
    const [showSuccess,    setShowSuccess]    = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [error,          setError]          = useState<string | null>(null);

    useEffect(() => {
      const auto = getAutoAccountData(sessionUser);

      setFirstName((current) => current || auto.firstName);
      setLastName((current) => current || auto.lastName);
      setEmail((current) => current || auto.email);
      setPhone((current) => current || cleanPhone(auto.phone));
      setRut((current) => current || formatRut(auto.rut));
      setBirthDate((current) => current || auto.birthDate);
    }, [
      sessionUser?.name,
      sessionUser?.firstName,
      sessionUser?.lastName,
      sessionUser?.email,
      sessionUser?.phone,
      sessionUser?.rut,
      sessionUser?.birthDate,
    ]);

    const canSubmit =
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      isEmailValid(email) &&
      isPhoneValid(phone) &&
      isRutValid(rut) &&
      belongsToRapaNuiEthnicity !== "" &&
      identityFrontFile != null &&
      identityBackFile != null &&
      driverLicenseFile != null &&
      acceptDataTreatment &&
      acceptDeclaration &&
      !loading;

    async function handleSubmit() {
      if (!canSubmit) {
        setError("Completa los datos requeridos. Teléfono y RUT se toman automáticamente desde el registro, pero deben ser válidos.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        persistApplicationAutofill({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanPhone(phone),
          rut: formatRut(rut),
          birthDate,
        });

        const input: Record<string, unknown> = {
          type: "driver",
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanPhone(phone),
          rut: normalizeRut(rut),
          ...(birthDate ? { birthDate } : {}),

          belongsToRapaNuiEthnicity: belongsToRapaNuiEthnicity === "yes",
          ethnicityDeclaration: belongsToRapaNuiEthnicity,

          documents: {
            identityCardFront: {
              provided: true,
              fileName: identityFrontFile?.name,
              fileType: identityFrontFile?.type,
              fileSize: identityFrontFile?.size,
            },
            identityCardBack: {
              provided: true,
              fileName: identityBackFile?.name,
              fileType: identityBackFile?.type,
              fileSize: identityBackFile?.size,
            },
            driverLicense: {
              provided: true,
              fileName: driverLicenseFile?.name,
              fileType: driverLicenseFile?.type,
              fileSize: driverLicenseFile?.size,
            },
          },

          legalAcceptance: {
            acceptedDataTreatment: acceptDataTreatment,
            acceptedTruthDeclaration: acceptDeclaration,
            acceptedAt: new Date().toISOString(),
            text: "Autorizo a Rapa Go a revisar mi cédula de identidad y licencia de conducir únicamente para validar mi inscripción como conductor.",
          },
        };

        const result = await applicationsService.createApplication(input, session?.accessToken);
        setSuccessMessage(result.message || "Tu solicitud fue enviada correctamente.");
        setShowSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado al enviar la postulación.");
      } finally {
        setLoading(false);
      }
    }

    return (
      <IonPage className="driver-registration-page">
        <IonHeader>
          <IonToolbar style={{ "--background": "linear-gradient(135deg,#C89B3C,#8f3c24)", "--color": "#fff" } as CSSProperties}>
            <IonTitle>Inscripción como Conductor</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding driver-registration-page">
          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Datos de tu cuenta</IonCardTitle>
              <IonNote style={styles.noteStyle}>
                Estos datos se completan automáticamente desde tu perfil. Revisa que estén correctos.
              </IonNote>
            </IonCardHeader>

            <IonCardContent>
              <IonItem lines="full" style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Nombre *</IonLabel>
                <IonInput
                  style={styles.inputStyle}
                  value={firstName}
                  onIonInput={(e) => setFirstName(String(e.detail.value ?? ""))}
                  placeholder="Tu nombre"
                />
              </IonItem>

              <IonItem lines="full" style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Apellido *</IonLabel>
                <IonInput
                  style={styles.inputStyle}
                  value={lastName}
                  onIonInput={(e) => setLastName(String(e.detail.value ?? ""))}
                  placeholder="Tu apellido"
                />
              </IonItem>

              <IonItem lines="full" style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Email *</IonLabel>
                <IonInput
                  style={styles.inputStyle}
                  type="email"
                  value={email}
                  onIonInput={(e) => setEmail(String(e.detail.value ?? ""))}
                  placeholder="correo@ejemplo.com"
                />
              </IonItem>

              <IonItem lines="full" style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Teléfono *</IonLabel>
                <IonInput
                  style={styles.inputStyle}
                  type="tel"
                  value={phone}
                  onIonInput={(e) => setPhone(cleanPhone(String(e.detail.value ?? "")))}
                  placeholder="56912345678"
                  inputmode="numeric"
                  maxlength={11}
                />
              </IonItem>

              <IonItem lines="full" style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>RUT *</IonLabel>
                <IonInput
                  style={styles.inputStyle}
                  value={rut}
                  onIonInput={(e) => setRut(formatRut(String(e.detail.value ?? "")))}
                  placeholder="12.345.678-9"
                  inputmode="numeric"
                  maxlength={12}
                />
              </IonItem>

              <IonItem lines="none" style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Fecha de nacimiento</IonLabel>
                <IonInput
                  style={styles.inputStyle}
                  type="date"
                  value={birthDate}
                  onIonInput={(e) => setBirthDate(String(e.detail.value ?? ""))}
                />
              </IonItem>
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Validación Rapa Nui</IonCardTitle>
            </IonCardHeader>

            <IonCardContent>
              <IonLabel style={{ ...styles.labelStyle, display: "block", marginBottom: "10px" }}>
                ¿Perteneces a la etnia Rapa Nui? *
              </IonLabel>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <IonButton
                  expand="block"
                  color={belongsToRapaNuiEthnicity === "yes" ? "warning" : "medium"}
                  fill={belongsToRapaNuiEthnicity === "yes" ? "solid" : "outline"}
                  onClick={() => setBelongsToRapaNuiEthnicity("yes")}
                >
                  Sí
                </IonButton>

                <IonButton
                  expand="block"
                  color={belongsToRapaNuiEthnicity === "no" ? "warning" : "medium"}
                  fill={belongsToRapaNuiEthnicity === "no" ? "solid" : "outline"}
                  onClick={() => setBelongsToRapaNuiEthnicity("no")}
                >
                  No
                </IonButton>
              </div>

              <IonNote style={styles.noteStyle}>
                Esta información ayuda a priorizar conductores locales y validar antecedentes de forma responsable.
              </IonNote>
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Documentación requerida</IonCardTitle>
              <IonNote style={styles.noteStyle}>
                Adjunta documentos claros. Se usarán solo para validar tu inscripción.
              </IonNote>
            </IonCardHeader>

            <IonCardContent>
              <label className="upload-box" style={styles.fileButtonStyle}>
                Cédula de identidad — Frente *
                <input
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => setIdentityFrontFile(getSelectedFile(e.nativeEvent))}
                />
                <div className="selected-file" style={{ color: "#4A4A4A", marginTop: "6px", fontSize: ".78rem", fontWeight: 800 }}>
                  {fileLabel(identityFrontFile)}
                </div>
              </label>

              <div style={{ height: "10px" }} />

              <label className="upload-box" style={styles.fileButtonStyle}>
                Cédula de identidad — Reverso *
                <input
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => setIdentityBackFile(getSelectedFile(e.nativeEvent))}
                />
                <div className="selected-file" style={{ color: "#4A4A4A", marginTop: "6px", fontSize: ".78rem", fontWeight: 800 }}>
                  {fileLabel(identityBackFile)}
                </div>
              </label>

              <div style={{ height: "10px" }} />

              <label className="upload-box" style={styles.fileButtonStyle}>
                Licencia de conducir *
                <input
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => setDriverLicenseFile(getSelectedFile(e.nativeEvent))}
                />
                <div className="selected-file" style={{ color: "#4A4A4A", marginTop: "6px", fontSize: ".78rem", fontWeight: 800 }}>
                  {fileLabel(driverLicenseFile)}
                </div>
              </label>
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Términos y autorización</IonCardTitle>
            </IonCardHeader>

            <IonCardContent>
              <IonItem lines="none" style={{ ...styles.itemStyle, alignItems: "flex-start" }}>
                <IonCheckbox
                  checked={acceptDataTreatment}
                  onIonChange={(e) => setAcceptDataTreatment(e.detail.checked)}
                  slot="start"
                />
                <IonLabel style={{ ...styles.labelStyle, marginLeft: "12px", whiteSpace: "normal", lineHeight: 1.35 }}>
                  Autorizo a Rapa Go a revisar mi cédula de identidad y licencia de conducir únicamente para validar mi inscripción como conductor.
                </IonLabel>
              </IonItem>

              <IonItem lines="none" style={{ ...styles.itemStyle, alignItems: "flex-start" }}>
                <IonCheckbox
                  checked={acceptDeclaration}
                  onIonChange={(e) => setAcceptDeclaration(e.detail.checked)}
                  slot="start"
                />
                <IonLabel style={{ ...styles.labelStyle, marginLeft: "12px", whiteSpace: "normal", lineHeight: 1.35 }}>
                  Declaro que la información y documentación enviada es verdadera y corresponde a mi identidad.
                </IonLabel>
              </IonItem>
            </IonCardContent>
          </IonCard>

          {error && (
            <IonText color="danger">
              <p style={{ padding: "0 4px", fontWeight: 900, color: "#B84F2E" }}>{error}</p>
            </IonText>
          )}

          <div style={{ padding: "8px 0 18px" }}>
            <IonButton
              expand="block"
              color="warning"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
              style={{ "--border-radius": "16px", height: "52px", fontWeight: 950 } as CSSProperties}
            >
              {loading ? <IonSpinner name="crescent" /> : "Enviar solicitud"}
            </IonButton>

            <IonButton
              expand="block"
              fill="outline"
              color="medium"
              onClick={() => history.goBack()}
              style={{ marginTop: "8px", "--border-radius": "16px" } as CSSProperties}
            >
              Cancelar
            </IonButton>
          </div>

          <IonAlert
            isOpen={showSuccess}
            header="Solicitud enviada"
            message={successMessage}
            buttons={[{
              text: "OK",
              handler: () => {
                setShowSuccess(false);
                history.push("/passenger/home");
              },
            }]}
            onDidDismiss={() => setShowSuccess(false)}
          />
        </IonContent>
      </IonPage>
    );
  }

  export function ApplicationGuidePage(): JSX.Element {
    const { session } = useAuth();
    const history = useHistory();
    const styles = makeApplicationStyles();

    const sessionUser = session?.user as SessionUserForApplication | undefined;

    const [firstName, setFirstName] = useState("");
    const [lastName,  setLastName]  = useState("");
    const [email,     setEmail]     = useState("");
    const [phone,     setPhone]     = useState("");
    const [rut,       setRut]       = useState("");
    const [birthDate, setBirthDate] = useState("");

    const [experienceYears, setExperienceYears] = useState("");
    const [specialties, setSpecialties] = useState<string[]>([]);
    const [offeredTours, setOfferedTours] = useState<string[]>([]);
    const [hasVehicle, setHasVehicle] = useState(false);
    const [vehicleDescription, setVehicleDescription] = useState("");
    const [maxGroupSize, setMaxGroupSize] = useState("");
    const [languages, setLanguages] = useState<string[]>([]);

    const [identityFrontFile, setIdentityFrontFile] = useState<File | null>(null);
    const [identityBackFile,  setIdentityBackFile]  = useState<File | null>(null);
    const [profilePhotoFile,  setProfilePhotoFile]  = useState<File | null>(null);
    const [guideCertFile,     setGuideCertFile]     = useState<File | null>(null);

    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptDeclaration, setAcceptDeclaration] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const auto = getAutoAccountData(sessionUser);

      setFirstName((current) => current || auto.firstName);
      setLastName((current) => current || auto.lastName);
      setEmail((current) => current || auto.email);
      setPhone((current) => current || cleanPhone(auto.phone));
      setRut((current) => current || formatRut(auto.rut));
      setBirthDate((current) => current || auto.birthDate);
    }, [
      sessionUser?.name,
      sessionUser?.firstName,
      sessionUser?.lastName,
      sessionUser?.email,
      sessionUser?.phone,
      sessionUser?.rut,
      sessionUser?.birthDate,
    ]);

    const canSubmitGuide =
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      isEmailValid(email) &&
      isPhoneValid(phone) &&
      isRutValid(rut) &&
      identityFrontFile != null &&
      identityBackFile != null &&
      profilePhotoFile != null &&
      guideCertFile != null &&
      acceptTerms &&
      acceptDeclaration &&
      !loading;

    async function handleSubmit() {
      if (!canSubmitGuide) {
        setError("Completa los datos requeridos. Teléfono y RUT se toman automáticamente desde el registro, pero deben ser válidos.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        persistApplicationAutofill({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanPhone(phone),
          rut: formatRut(rut),
          birthDate,
        });

        const input: Record<string, unknown> = {
          type: "guide",
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanPhone(phone),
          rut: normalizeRut(rut),
          ...(birthDate ? { birthDate } : {}),
          ...(experienceYears ? { experienceYears: Number(experienceYears) } : {}),
          ...(specialties.length > 0 ? { specialties } : {}),
          ...(offeredTours.length > 0 ? { offeredTours } : {}),
          hasVehicle,
          ...(hasVehicle && vehicleDescription ? { vehicleDescription } : {}),
          ...(maxGroupSize ? { maxGroupSize: Number(maxGroupSize) } : {}),
          ...(languages.length > 0 ? { languages } : {}),

          documents: {
            identityCardFront: {
              provided: true,
              fileName: identityFrontFile?.name,
              fileType: identityFrontFile?.type,
              fileSize: identityFrontFile?.size,
            },
            identityCardBack: {
              provided: true,
              fileName: identityBackFile?.name,
              fileType: identityBackFile?.type,
              fileSize: identityBackFile?.size,
            },
            profilePhoto: {
              provided: true,
              fileName: profilePhotoFile?.name,
              fileType: profilePhotoFile?.type,
              fileSize: profilePhotoFile?.size,
            },
            guideCertification: {
              provided: true,
              fileName: guideCertFile?.name,
              fileType: guideCertFile?.type,
              fileSize: guideCertFile?.size,
            },
          },

          legalAcceptance: {
            acceptedDataTreatment: acceptTerms,
            acceptedTruthDeclaration: acceptDeclaration,
            acceptedAt: new Date().toISOString(),
            text: "Autorizo a Rapa Go a revisar mi documentación únicamente para validar mi inscripción como guía.",
          },
        };

        const result = await applicationsService.createApplication(input, session?.accessToken);
        setSuccessMessage(result.message || "Tu postulación fue enviada correctamente.");
        setShowSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado al enviar la postulación.");
      } finally {
        setLoading(false);
      }
    }

    return (
      <IonPage className="driver-registration-page">
        <IonHeader>
          <IonToolbar style={{ "--background": "linear-gradient(135deg,#C89B3C,#8f3c24)", "--color": "#fff" } as CSSProperties}>
            <IonTitle>Inscripción como Guía</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding driver-registration-page">
          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Datos de tu cuenta</IonCardTitle>
              <IonNote style={styles.noteStyle}>
                Estos datos se completan automáticamente desde tu perfil.
              </IonNote>
            </IonCardHeader>

            <IonCardContent>
              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Nombre *</IonLabel>
                <IonInput style={styles.inputStyle} value={firstName} onIonInput={(e) => setFirstName(String(e.detail.value ?? ""))} placeholder="Tu nombre" />
              </IonItem>

              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Apellido *</IonLabel>
                <IonInput style={styles.inputStyle} value={lastName} onIonInput={(e) => setLastName(String(e.detail.value ?? ""))} placeholder="Tu apellido" />
              </IonItem>

              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Email *</IonLabel>
                <IonInput style={styles.inputStyle} type="email" value={email} onIonInput={(e) => setEmail(String(e.detail.value ?? ""))} placeholder="correo@ejemplo.com" />
              </IonItem>

              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Teléfono *</IonLabel>
                <IonInput style={styles.inputStyle} type="tel" value={phone} onIonInput={(e) => setPhone(String(e.detail.value ?? ""))} placeholder="+56912345678" />
              </IonItem>

              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>RUT *</IonLabel>
                <IonInput style={styles.inputStyle} value={rut} onIonInput={(e) => setRut(String(e.detail.value ?? "").toUpperCase())} placeholder="12.345.678-9" />
              </IonItem>

              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Fecha de nacimiento</IonLabel>
                <IonInput style={styles.inputStyle} type="date" value={birthDate} onIonInput={(e) => setBirthDate(String(e.detail.value ?? ""))} />
              </IonItem>
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Experiencia</IonCardTitle>
            </IonCardHeader>

            <IonCardContent>
              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Años de experiencia</IonLabel>
                <IonInput style={styles.inputStyle} type="tel" inputmode="numeric" value={experienceYears} onIonInput={(e) => setExperienceYears(cleanNumber(String(e.detail.value ?? ""), 2))} placeholder="0" maxlength={2} />
              </IonItem>

              <IonLabel style={{ ...styles.labelStyle, display: "block", margin: "12px 0 8px" }}>
                Especialidades
              </IonLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {SPECIALTIES.map((s) => (
                  <IonChip key={s} color={specialties.includes(s) ? "primary" : "medium"} onClick={() => setSpecialties(toggleArrayItem(specialties, s))}>
                    <IonLabel>{s}</IonLabel>
                  </IonChip>
                ))}
              </div>

              <IonLabel style={{ ...styles.labelStyle, display: "block", margin: "14px 0 8px" }}>
                Tipos de tours
              </IonLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {OFFERED_TOURS.map((t) => (
                  <IonChip key={t} color={offeredTours.includes(t) ? "secondary" : "medium"} onClick={() => setOfferedTours(toggleArrayItem(offeredTours, t))}>
                    <IonLabel>{t}</IonLabel>
                  </IonChip>
                ))}
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Vehículo y capacidad</IonCardTitle>
            </IonCardHeader>

            <IonCardContent>
              <IonItem style={styles.itemStyle}>
                <IonLabel style={styles.labelStyle}>¿Cuentas con vehículo?</IonLabel>
                <IonToggle checked={hasVehicle} onIonChange={(e) => setHasVehicle(e.detail.checked)} />
              </IonItem>

              {hasVehicle && (
                <IonItem style={styles.itemStyle}>
                  <IonLabel position="stacked" style={styles.labelStyle}>Descripción del vehículo</IonLabel>
                  <IonTextarea style={styles.inputStyle} value={vehicleDescription} onIonInput={(e) => setVehicleDescription(String(e.detail.value ?? ""))} placeholder="Marca, modelo, color, año..." rows={3} />
                </IonItem>
              )}

              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Tamaño máximo de grupo</IonLabel>
                <IonInput style={styles.inputStyle} type="tel" inputmode="numeric" value={maxGroupSize} onIonInput={(e) => setMaxGroupSize(cleanNumber(String(e.detail.value ?? ""), 3))} placeholder="10" maxlength={3} />
              </IonItem>

              <IonLabel style={{ ...styles.labelStyle, display: "block", margin: "14px 0 8px" }}>
                Idiomas
              </IonLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {LANGUAGES.map((l) => (
                  <IonChip key={l} color={languages.includes(l) ? "success" : "medium"} onClick={() => setLanguages(toggleArrayItem(languages, l))}>
                    <IonLabel>{l}</IonLabel>
                  </IonChip>
                ))}
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Documentación requerida</IonCardTitle>
              <IonNote style={styles.noteStyle}>
                Adjunta documentos claros. Se usarán solo para validar tu inscripción.
              </IonNote>
            </IonCardHeader>

            <IonCardContent>
              {[
                ["Cédula de identidad — Frente *", identityFrontFile, setIdentityFrontFile],
                ["Cédula de identidad — Reverso *", identityBackFile, setIdentityBackFile],
                ["Foto de perfil *", profilePhotoFile, setProfilePhotoFile],
                ["Certificación de guía *", guideCertFile, setGuideCertFile],
              ].map(([label, file, setter]) => (
                <label key={String(label)} className="upload-box" style={{ ...styles.fileButtonStyle, marginBottom: 10 }}>
                  {String(label)}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    style={{ display: "none" }}
                    onChange={(e) => (setter as React.Dispatch<React.SetStateAction<File | null>>)(getSelectedFile(e.nativeEvent))}
                  />
                  <div className="selected-file" style={{ color: "#4A4A4A", marginTop: "6px", fontSize: ".78rem", fontWeight: 800 }}>
                    {fileLabel(file as File | null)}
                  </div>
                </label>
              ))}
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Declaración</IonCardTitle>
            </IonCardHeader>

            <IonCardContent>
              <IonItem style={{ ...styles.itemStyle, alignItems: "flex-start" }}>
                <IonCheckbox checked={acceptTerms} onIonChange={(e) => setAcceptTerms(e.detail.checked)} slot="start" />
                <IonLabel style={{ ...styles.labelStyle, marginLeft: "12px", whiteSpace: "normal", lineHeight: 1.35 }}>
                  Acepto que mis datos y documentos serán verificados únicamente para validar mi postulación como guía.
                </IonLabel>
              </IonItem>

              <IonItem style={{ ...styles.itemStyle, alignItems: "flex-start" }}>
                <IonCheckbox checked={acceptDeclaration} onIonChange={(e) => setAcceptDeclaration(e.detail.checked)} slot="start" />
                <IonLabel style={{ ...styles.labelStyle, marginLeft: "12px", whiteSpace: "normal", lineHeight: 1.35 }}>
                  Declaro que la información enviada es verdadera y corresponde a mi identidad.
                </IonLabel>
              </IonItem>
            </IonCardContent>
          </IonCard>

          {error && (
            <IonText color="danger">
              <p style={{ padding: "0 4px", fontWeight: 900, color: "#B84F2E" }}>{error}</p>
            </IonText>
          )}

          <div style={{ padding: "8px 0 18px" }}>
            <IonButton
              expand="block"
              color="warning"
              disabled={!canSubmitGuide}
              onClick={() => void handleSubmit()}
              style={{ "--border-radius": "16px", height: "52px", fontWeight: 950 } as CSSProperties}
            >
              {loading ? <IonSpinner name="crescent" /> : "Enviar postulación"}
            </IonButton>

            <IonButton expand="block" fill="outline" color="medium" onClick={() => history.goBack()} style={{ marginTop: "8px", "--border-radius": "16px" } as CSSProperties}>
              Cancelar
            </IonButton>
          </div>

          <IonAlert
            isOpen={showSuccess}
            header="¡Postulación enviada!"
            message={successMessage}
            buttons={[{ text: "OK", handler: () => { setShowSuccess(false); history.push("/passenger/home"); } }]}
            onDidDismiss={() => setShowSuccess(false)}
          />
        </IonContent>
      </IonPage>
    );
  }

  const STATUS_LABEL: Record<string, string> = {
    pending: "Pendiente",
    under_review: "En revisión",
    approved: "Aprobada",
    rejected: "Rechazada",
    on_hold: "En espera",
  };

  const STATUS_COLOR: Record<string, string> = {
    pending: "warning",
    under_review: "tertiary",
    approved: "success",
    rejected: "danger",
    on_hold: "medium",
  };

  const TYPE_LABEL: Record<string, string> = {
    driver: "Conductor",
    guide: "Guía",
    rental_operator: "Operador de arriendo",
  };

  export function ApplicationStatusPage(): JSX.Element {
    const { session } = useAuth();
    const history = useHistory();
    const [items, setItems] = useState<ApplicationData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useIonViewWillEnter(() => {
      if (!session?.accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      void applicationsService.getMyApplications(session.accessToken)
        .then(setItems)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"))
        .finally(() => setLoading(false));
    });

    return (
      <IonPage className="driver-registration-page">
        <IonHeader>
          <IonToolbar style={{ "--background": "linear-gradient(135deg,#C89B3C,#8f3c24)", "--color": "#fff" } as CSSProperties}>
            <IonTitle>Estado de mi postulación</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding driver-registration-page">
          {loading && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>
              <IonSpinner name="crescent" />
            </div>
          )}

          {error && <IonText color="danger"><p>{error}</p></IonText>}

          {!loading && items.length === 0 && (
            <IonCard>
              <IonCardContent style={{ textAlign: "center", padding: 18 }}>
                <p style={{ color: "#111", fontWeight: 800 }}>No tienes postulaciones activas.</p>
                <IonButton routerLink="/apply/driver" color="primary" style={{ marginTop: "16px" }}>
                  Inscríbete como conductor
                </IonButton>
                <IonButton routerLink="/apply/guide" color="secondary" style={{ marginTop: "8px" }}>
                  Inscríbete como guía
                </IonButton>
              </IonCardContent>
            </IonCard>
          )}

          {items.map((item) => (
            <IonCard key={item.id} style={item.status === "approved" ? { border: "2px solid var(--ion-color-success)" } : {}}>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: "1rem", color: "#111", fontWeight: 950 }}>
                  {TYPE_LABEL[item.type] ?? item.type}
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span
                    style={{
                      background: `var(--ion-color-${STATUS_COLOR[item.status] ?? "medium"})`,
                      color: "#fff",
                      borderRadius: "12px",
                      padding: "2px 10px",
                      fontSize: "0.8rem",
                      fontWeight: 800,
                    }}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: "0.82rem", color: "#444", fontWeight: 700 }}>
                  Última actualización: {new Date(item.updatedAt).toLocaleDateString("es-CL")}
                </p>

                {item.status === "rejected" && item.rejectionReason && (
                  <IonNote color="danger" style={{ display: "block", marginTop: "8px", fontWeight: 900 }}>
                    Motivo de rechazo: {item.rejectionReason}
                  </IonNote>
                )}

                {item.status === "approved" && (
                  <IonText color="success">
                    <p style={{ fontWeight: 900, marginTop: "8px" }}>
                      ¡Tu postulación fue aprobada! Ya puedes usar tu cuenta con el rol aprobado.
                    </p>
                  </IonText>
                )}
              </IonCardContent>
            </IonCard>
          ))}

          <IonButton expand="block" fill="outline" onClick={() => history.goBack()} style={{ marginTop: "16px" }}>
            Volver
          </IonButton>
        </IonContent>
      </IonPage>
    );
  }
