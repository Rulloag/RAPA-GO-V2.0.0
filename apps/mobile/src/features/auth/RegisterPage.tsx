import { useState, type CSSProperties, type FormEvent } from "react";
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import { registerRequestSchema, type UserRole } from "@rapa-go/shared";
import { useAuth } from "./useAuth.js";
import { ROUTES } from "../../navigation/routes.js";
import { legalService } from "../../features/legal/legal.service.js";
import { referralsService } from "../../features/referrals/referrals.service.js";

const ROLE_HOME: Record<UserRole, string> = {
  passenger: ROUTES.PASSENGER.HOME,
  driver: ROUTES.PASSENGER.HOME,
  guide: ROUTES.PASSENGER.HOME,
  rental_operator: ROUTES.PASSENGER.HOME,
  admin: ROUTES.ADMIN.HOME,
};

type RegisterField =
  | "name"
  | "lastName"
  | "rut"
  | "phone"
  | "email"
  | "passengerType"
  | "password"
  | "confirmPassword"
  | "terms";


type PassengerFareType = "resident" | "chilean" | "foreigner";

const PASSENGER_FARE_TYPES: Array<{
  value: PassengerFareType;
  label: string;
  helper: string;
  multiplier: string;
}> = [
  {
    value: "resident",
    label: "Residente",
    helper: "Perfil residente.",
    multiplier: "1,00",
  },
  {
    value: "chilean",
    label: "Chileno no residente",
    helper: "Perfil chileno no residente.",
    multiplier: "1,13",
  },
  {
    value: "foreigner",
    label: "Extranjero / turista",
    helper: "Perfil extranjero.",
    multiplier: "1,20",
  },
];

function getPassengerFareTypeLabel(value: PassengerFareType): string {
  return PASSENGER_FARE_TYPES.find((item) => item.value === value)?.label ?? value;
}

function isPassengerFareType(value: string): value is PassengerFareType {
  return value === "resident" || value === "chilean" || value === "foreigner";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function cleanPersonName(value: string): string {
  return value
    .replace(/[^A-Za-zÁÉÍÓÚÜáéíóúüÑñ' -]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 60);
}

function onlyNumbers(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
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

function normalizeRut(value: string): string {
  return formatRut(value);
}

function cleanPhone(value: string): string {
  return onlyNumbers(value, 11);
}

function normalizePhone(value: string): string {
  return cleanPhone(value);
}

function cleanReferralCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function persistRegistrationProfile(data: {
  name: string;
  firstName: string;
  lastName: string;
  rut: string;
  phone: string;
  email: string;
  passengerFareType: PassengerFareType;
  passengerFareLabel: string;
}): void {
  try {
    localStorage.setItem("rapago_registration_profile", JSON.stringify(data));
    localStorage.setItem("rapago_profile_phone", data.phone);
    localStorage.setItem("rapago_profile_rut", data.rut);
    localStorage.setItem("rapago_passenger_fare_type", data.passengerFareType);
    localStorage.setItem("rapago_profile_passenger_type", data.passengerFareType);
    localStorage.setItem("rapago_profile_nationality", data.passengerFareLabel);
  } catch {
    // No bloquea el registro si localStorage no está disponible.
  }
}

function validateRut(value: string): boolean {
  const digits = cleanRut(value);

  // Para no bloquear registros válidos con DV K, aquí solo exigimos números y largo correcto.
  // Si después quieres validar DV exacto, se puede agregar en backend.
  return digits.length >= 8 && digits.length <= 9;
}

function validatePhone(value: string): boolean {
  const digits = cleanPhone(value);

  // Chile móvil: 9XXXXXXXX o 569XXXXXXXX.
  return /^9\d{8}$/.test(digits) || /^569\d{8}$/.test(digits);
}

function getFirstFieldError(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

const pageContentStyle = {
  "--background":
    "linear-gradient(180deg, #fff7e8 0%, #f9ead0 48%, #edd2a0 100%)",
} as CSSProperties;

const formShellStyle: CSSProperties = {
  maxWidth: 540,
  margin: "1.25rem auto 2rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "20px 16px 22px",
  borderRadius: 26,
  background: "rgba(255, 252, 244, 0.96)",
  border: "1px solid rgba(205, 157, 60, 0.36)",
  boxShadow: "0 18px 44px rgba(66, 43, 16, 0.18)",
};

const registerItemStyle = {
  "--background": "#fffaf0",
  "--color": "#1f1711",
  "--border-color": "transparent",
  "--highlight-color-focused": "#c99a32",
  "--highlight-color-valid": "#c99a32",
  "--highlight-color-invalid": "#d33b32",
  "--padding-start": "16px",
  "--inner-padding-end": "12px",
  "--min-height": "64px",
  border: "1px solid rgba(198, 151, 54, 0.42)",
  borderRadius: 18,
  boxShadow: "0 8px 20px rgba(78, 52, 18, 0.06)",
  overflow: "hidden",
} as CSSProperties;

const labelStyle: CSSProperties = {
  color: "#3a2a1b",
  fontWeight: 900,
};

const inputStyle = {
  "--color": "#1f1711",
  "--placeholder-color": "#8a765e",
  "--placeholder-opacity": "1",
  fontWeight: 850,
} as CSSProperties;

const softNoteStyle: CSSProperties = {
  display: "block",
  padding: "10px 12px",
  borderRadius: 14,
  background: "#fff3dc",
  border: "1px solid rgba(198, 151, 54, 0.25)",
  color: "#5a4528",
  lineHeight: 1.35,
  fontWeight: 750,
};

export function RegisterPage(): JSX.Element {
  const history = useHistory();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [rut, setRut] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passengerFareType, setPassengerFareType] = useState<PassengerFareType | "">("");

  const [referralCode, setReferralCode] = useState("");
  const [referralMsg, setReferralMsg] = useState<string | null>(null);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptUserConditions, setAcceptUserConditions] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<RegisterField | string, string>>({});
  const [serverError, setServerError] = useState("");

  const canSubmit =
    acceptTerms &&
    acceptPrivacy &&
    acceptUserConditions &&
    passengerFareType !== "" &&
    !loading;

  function clearFieldError(field: RegisterField): void {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;

      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function acceptLegalDocuments(accessToken: string): Promise<void> {
    const typesToAccept = ["terms_and_conditions", "privacy_policy", "user_conditions"];

    try {
      const docs = await legalService.getActive();

      await Promise.all(
        typesToAccept.map(async (type) => {
          const doc = docs.find((item) => item.type === type && item.isActive);

          if (!doc) return;

          await legalService.accept(accessToken, doc.id, doc.version);
        }),
      );
    } catch {
      // No bloqueamos el registro si la aceptación legal falla.
    }
  }

  async function applyReferralCode(userId: string): Promise<void> {
    const code = referralCode.trim();

    if (!code) return;

    try {
      const result = await referralsService.applyCode(code, userId);
      setReferralMsg(result.message);
    } catch {
      // El referido es opcional: no bloquea la creación de cuenta.
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();

    setFieldErrors({});
    setServerError("");
    setReferralMsg(null);

    const cleanName = cleanPersonName(name).trim();
    const cleanLastName = cleanPersonName(lastName).trim();
    const cleanRutValue = normalizeRut(rut);
    const cleanPhoneValue = normalizePhone(phone);
    const cleanEmailValue = normalizeEmail(email);
    const cleanPassengerFareType = isPassengerFareType(passengerFareType)
      ? passengerFareType
      : "";
    const fullName = `${cleanName} ${cleanLastName}`.trim();

    const nextErrors: Record<string, string> = {};

    if (!cleanName) {
      nextErrors.name = "Ingresa tu nombre.";
    }

    if (!cleanLastName) {
      nextErrors.lastName = "Ingresa tu apellido.";
    }

    if (!cleanRutValue) {
      nextErrors.rut = "Ingresa tu RUT.";
    } else if (!validateRut(cleanRutValue)) {
      nextErrors.rut = "El RUT debe tener 8 o 9 números.";
    }

    if (!cleanPhoneValue) {
      nextErrors.phone = "Ingresa tu teléfono.";
    } else if (!validatePhone(cleanPhoneValue)) {
      nextErrors.phone = "Teléfono inválido. Usa 912345678 o 56912345678.";
    }

    if (!cleanPassengerFareType) {
      nextErrors.passengerType = "Selecciona tu nacionalidad o residencia.";
    }

    if (!cleanEmailValue) {
      nextErrors.email = "Ingresa tu correo electrónico.";
    }

    if (password.length < 8) {
      nextErrors.password = "La contraseña debe tener mínimo 8 caracteres.";
    }

    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Las contraseñas no coinciden.";
    }

    if (!acceptTerms || !acceptPrivacy || !acceptUserConditions) {
      nextErrors.terms = "Debes aceptar los términos, privacidad y condiciones de usuario.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    const payload = {
      name: fullName,
      email: cleanEmailValue,
      password,
      role: "passenger" as const,
    };

    const parsed = registerRequestSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(getFirstFieldError(parsed.error.issues));
      return;
    }

    const selectedPassengerFareType = cleanPassengerFareType as PassengerFareType;

    setLoading(true);

    try {
      const result = await register({
        ...parsed.data,
        firstName: cleanName,
        lastName: cleanLastName,
        rut: cleanRutValue,
        phone: cleanPhoneValue,
        passengerType: selectedPassengerFareType,
        farePassengerType: selectedPassengerFareType,
        nationality: getPassengerFareTypeLabel(selectedPassengerFareType),
        isResident: selectedPassengerFareType === "resident",
      } as typeof parsed.data & {
        firstName: string;
        lastName: string;
        rut: string;
        phone: string;
        passengerType: PassengerFareType;
        farePassengerType: PassengerFareType;
        nationality: string;
        isResident: boolean;
      });

      if (!result.ok) {
        if (result.code === "AUTH_EMAIL_TAKEN") {
          setFieldErrors({ email: "Este correo ya está registrado." });
          return;
        }

        setServerError(result.message ?? "No se pudo crear la cuenta. Inténtalo de nuevo.");
        return;
      }

      const accessToken = result.session.accessToken;
      const userId = result.session.user.id;
      const registeredRole = result.session.user.role;

      persistRegistrationProfile({
        name: fullName,
        firstName: cleanName,
        lastName: cleanLastName,
        rut: cleanRutValue,
        phone: cleanPhoneValue,
        email: cleanEmailValue,
        passengerFareType: selectedPassengerFareType,
        passengerFareLabel: getPassengerFareTypeLabel(selectedPassengerFareType),
      });

      await Promise.all([
        applyReferralCode(userId),
        acceptLegalDocuments(accessToken),
      ]);

      history.replace(ROLE_HOME[registeredRole] ?? ROUTES.PASSENGER.HOME);
    } catch {
      setServerError("Error de conexión. Verifica tu red e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="warning">
          <IonTitle style={{ color: "#111", fontWeight: 950 }}>Crear cuenta</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={pageContentStyle}>
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          style={formShellStyle}
          noValidate
        >
          <IonText>
            <h2 style={{ margin: "0 0 0.25rem", fontWeight: 950, color: "#1f1711" }}>
              Crea tu cuenta Rapa Go
            </h2>
          </IonText>

          <IonText>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", lineHeight: 1.45, color: "#5a4528", fontWeight: 700 }}>
              La cuenta se crea como pasajero. Selecciona tu nacionalidad o residencia para completar tu perfil.
            </p>
          </IonText>

          {serverError && (
            <IonText color="danger">
              <p
                style={{
                  margin: "0 0 0.75rem",
                  padding: "0.75rem",
                  background: "var(--ion-color-danger-tint)",
                  borderRadius: 10,
                  fontWeight: 700,
                }}
              >
                {serverError}
              </p>
            </IonText>
          )}

          <IonItem className={fieldErrors.name ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Nombre *</IonLabel>
            <IonInput
              type="text"
              value={name}
              onIonInput={(event) => {
                setName(cleanPersonName(String(event.detail.value ?? "")));
                clearFieldError("name");
              }}
              placeholder="Ej: Leandro"
              style={inputStyle}
              autocomplete="given-name"
              disabled={loading}
              required
            />
            {fieldErrors.name && <IonNote slot="error">{fieldErrors.name}</IonNote>}
          </IonItem>

          <IonItem className={fieldErrors.lastName ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Apellido *</IonLabel>
            <IonInput
              type="text"
              value={lastName}
              onIonInput={(event) => {
                setLastName(cleanPersonName(String(event.detail.value ?? "")));
                clearFieldError("lastName");
              }}
              placeholder="Ej: Favio"
              style={inputStyle}
              autocomplete="family-name"
              disabled={loading}
              required
            />
            {fieldErrors.lastName && <IonNote slot="error">{fieldErrors.lastName}</IonNote>}
          </IonItem>

          <IonItem className={fieldErrors.rut ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>RUT *</IonLabel>
            <IonInput
              type="tel"
              value={rut}
              onIonInput={(event) => {
                setRut(formatRut(String(event.detail.value ?? "")));
                clearFieldError("rut");
              }}
              placeholder="123456789"
              style={inputStyle}
              autocomplete="off"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength={12}
              disabled={loading}
              required
            />
            {fieldErrors.rut && <IonNote slot="error">{fieldErrors.rut}</IonNote>}
          </IonItem>

          <IonItem className={fieldErrors.passengerType ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Nacionalidad / residencia *</IonLabel>
            <IonSelect
              value={passengerFareType}
              placeholder="Seleccionar"
              interface="action-sheet"
              style={inputStyle}
              disabled={loading}
              onIonChange={(event) => {
                const value = String(event.detail.value ?? "");
                setPassengerFareType(isPassengerFareType(value) ? value : "");
                clearFieldError("passengerType");
              }}
            >
              {PASSENGER_FARE_TYPES.map((item) => (
                <IonSelectOption key={item.value} value={item.value}>
                  {item.label}
                </IonSelectOption>
              ))}
            </IonSelect>
            {fieldErrors.passengerType && (
              <IonNote slot="error">{fieldErrors.passengerType}</IonNote>
            )}
          </IonItem>

<IonItem className={fieldErrors.phone ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Teléfono *</IonLabel>
            <IonInput
              type="tel"
              value={phone}
              onIonInput={(event) => {
                setPhone(cleanPhone(String(event.detail.value ?? "")));
                clearFieldError("phone");
              }}
              placeholder="56912345678"
              style={inputStyle}
              autocomplete="tel"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength={11}
              disabled={loading}
              required
            />
            {fieldErrors.phone && <IonNote slot="error">{fieldErrors.phone}</IonNote>}
          </IonItem>

          <IonItem className={fieldErrors.email ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Correo electrónico *</IonLabel>
            <IonInput
              type="email"
              value={email}
              onIonInput={(event) => {
                setEmail(String(event.detail.value ?? "").trim().toLowerCase());
                clearFieldError("email");
              }}
              placeholder="tu@correo.com"
              style={inputStyle}
              autocomplete="email"
              inputmode="email"
              disabled={loading}
              required
            />
            {fieldErrors.email && <IonNote slot="error">{fieldErrors.email}</IonNote>}
          </IonItem>

          <IonItem className={fieldErrors.password ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Contraseña *</IonLabel>
            <IonInput
              type="password"
              value={password}
              onIonInput={(event) => {
                setPassword(String(event.detail.value ?? ""));
                clearFieldError("password");
              }}
              placeholder="Mínimo 8 caracteres"
              style={inputStyle}
              autocomplete="new-password"
              disabled={loading}
              required
            />
            {fieldErrors.password && <IonNote slot="error">{fieldErrors.password}</IonNote>}
          </IonItem>

          <IonItem className={fieldErrors.confirmPassword ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Confirmar contraseña *</IonLabel>
            <IonInput
              type="password"
              value={confirmPassword}
              onIonInput={(event) => {
                setConfirmPassword(String(event.detail.value ?? ""));
                clearFieldError("confirmPassword");
              }}
              placeholder="Repite tu contraseña"
              style={inputStyle}
              autocomplete="new-password"
              disabled={loading}
              required
            />
            {fieldErrors.confirmPassword && (
              <IonNote slot="error">{fieldErrors.confirmPassword}</IonNote>
            )}
          </IonItem>

         

          <IonItem style={{ ...registerItemStyle, marginTop: "0.5rem" } as CSSProperties}>
            <IonLabel position="stacked" style={labelStyle}>Código de referido (opcional)</IonLabel>
            <IonInput
              value={referralCode}
              onIonInput={(event) => setReferralCode(cleanReferralCode(String(event.detail.value ?? "")))}
              placeholder="Ej: RODRIGO2024"
              style={inputStyle}
              maxlength={20}
              clearInput
              disabled={loading}
            />
          </IonItem>

          {referralMsg && (
            <IonText color="success">
              <p style={{ margin: "4px 12px", fontSize: "0.8rem" }}>{referralMsg}</p>
            </IonText>
          )}

          <IonList style={{ marginTop: "0.75rem", borderRadius: 18, overflow: "hidden", background: "transparent", border: "1px solid rgba(198,151,54,.30)" }}>
            <IonItem style={{ ...registerItemStyle, borderRadius: 0, boxShadow: "none", borderLeft: 0, borderRight: 0, borderTop: 0 } as CSSProperties}>
              <IonCheckbox
                checked={acceptTerms}
                onIonChange={(event) => {
                  setAcceptTerms(event.detail.checked);
                  clearFieldError("terms");
                }}
                slot="start"
                disabled={loading}
              />
              <IonLabel style={{ whiteSpace: "normal", color: "#2f2217", fontWeight: 750, lineHeight: 1.35 }}>
                He leído y acepto los{" "}
                <a href="/legal/terms-and-conditions" target="_blank" rel="noopener noreferrer">
                  Términos y Condiciones
                </a>
              </IonLabel>
            </IonItem>

            <IonItem style={{ ...registerItemStyle, borderRadius: 0, boxShadow: "none", borderLeft: 0, borderRight: 0, borderTop: 0 } as CSSProperties}>
              <IonCheckbox
                checked={acceptPrivacy}
                onIonChange={(event) => {
                  setAcceptPrivacy(event.detail.checked);
                  clearFieldError("terms");
                }}
                slot="start"
                disabled={loading}
              />
              <IonLabel style={{ whiteSpace: "normal", color: "#2f2217", fontWeight: 750, lineHeight: 1.35 }}>
                He leído y acepto la{" "}
                <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                  Política de Privacidad
                </a>
              </IonLabel>
            </IonItem>

            <IonItem style={{ ...registerItemStyle, borderRadius: 0, boxShadow: "none", borderLeft: 0, borderRight: 0, borderTop: 0 } as CSSProperties}>
              <IonCheckbox
                checked={acceptUserConditions}
                onIonChange={(event) => {
                  setAcceptUserConditions(event.detail.checked);
                  clearFieldError("terms");
                }}
                slot="start"
                disabled={loading}
              />
              <IonLabel style={{ whiteSpace: "normal", color: "#2f2217", fontWeight: 750, lineHeight: 1.35 }}>
                Acepto las{" "}
                <a href="/legal/user-conditions" target="_blank" rel="noopener noreferrer">
                  Condiciones para Usuarios
                </a>
              </IonLabel>
            </IonItem>
          </IonList>

          {fieldErrors.terms && (
            <IonText color="danger">
              <p style={{ margin: "4px 12px", fontSize: "0.82rem", fontWeight: 700 }}>
                {fieldErrors.terms}
              </p>
            </IonText>
          )}

          <IonButton
            expand="block"
            type="submit"
            disabled={!canSubmit}
            style={{ marginTop: "1rem", height: "52px", fontWeight: 950, "--border-radius": "18px", "--background": "linear-gradient(135deg, #d2a43a, #f4d782)", "--color": "#111" } as CSSProperties}
          >
            {loading ? <IonSpinner name="crescent" /> : "Crear cuenta"}
          </IonButton>

          <IonButton
            expand="block"
            fill="clear"
            disabled={loading}
            onClick={() => history.push(ROUTES.AUTH.LOGIN)}
          >
            ¿Ya tienes cuenta? Iniciar sesión
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            color="warning"
            disabled={loading}
            onClick={() => history.replace(ROUTES.WELCOME)}
          >
            Volver al inicio
          </IonButton>
        </form>
      </IonContent>
    </IonPage>
  );
}
