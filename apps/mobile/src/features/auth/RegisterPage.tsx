import { useState } from "react";
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
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import { registerRequestSchema } from "@rapa-go/shared";
import { useAuth } from "./useAuth.js";
import { ROUTES } from "../../navigation/routes.js";
import { legalService } from "../../features/legal/legal.service.js";
import type { UserRole } from "@rapa-go/shared";

const ROLE_HOME: Record<UserRole, string> = {
  passenger:       ROUTES.PASSENGER.HOME,
  driver:          ROUTES.DRIVER.HOME,
  guide:           ROUTES.GUIDE.HOME,
  rental_operator: ROUTES.RENTAL.HOME,
  admin:           ROUTES.ADMIN.HOME,
};

const ROLE_LABELS: Record<Exclude<UserRole, "admin">, string> = {
  passenger:       "Pasajero",
  driver:          "Conductor",
  guide:           "Guía turístico",
  rental_operator: "Arriendo de vehículos",
};

type PublicRole = Exclude<UserRole, "admin">;

export function RegisterPage(): JSX.Element {
  const history = useHistory();
  const { register } = useAuth();

  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole]               = useState<PublicRole | "">("");
  const [loading, setLoading]         = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  const [acceptTerms, setAcceptTerms]               = useState(false);
  const [acceptPrivacy, setAcceptPrivacy]             = useState(false);
  const [acceptUserConditions, setAcceptUserConditions] = useState(false);
  const [acceptDriverConditions, setAcceptDriverConditions] = useState(false);
  const [acceptGuideConditions, setAcceptGuideConditions]   = useState(false);

  const baseAccepted = acceptTerms && acceptPrivacy && acceptUserConditions;
  const roleAccepted =
    role === "driver" ? acceptDriverConditions :
    role === "guide"  ? acceptGuideConditions  : true;
  const canSubmit = baseAccepted && roleAccepted;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setServerError("");

    const errors: Record<string, string> = {};

    if (password !== confirmPassword) {
      errors["confirmPassword"] = "Las contraseñas no coinciden.";
    }

    if (!role) {
      errors["role"] = "Selecciona un tipo de cuenta.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const parsed = registerRequestSchema.safeParse({ email, password, name, role });
    if (!parsed.success) {
      const zodErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") zodErrors[field] = issue.message;
      }
      setFieldErrors(zodErrors);
      return;
    }

    setLoading(true);
    try {
      const result = await register(parsed.data);
      if (result.ok) {
        const tok = result.session.accessToken;
        const typesToAccept = ["terms_and_conditions", "privacy_policy", "user_conditions"];
        if (role === "driver") typesToAccept.push("driver_conditions");
        if (role === "guide")  typesToAccept.push("guide_conditions");

        legalService.getActive().then(docs => {
          typesToAccept.forEach(type => {
            const doc = docs.find(d => d.type === type && d.isActive);
            if (doc) {
              legalService.accept(tok, doc.id, doc.version).catch(() => {});
            }
          });
        }).catch(() => {});

        const home = ROLE_HOME[result.session.user.role] ?? ROUTES.WELCOME;
        history.replace(home);
      } else {
        if (result.code === "AUTH_EMAIL_TAKEN") {
          setFieldErrors({ email: "Este correo ya está registrado." });
        } else {
          setServerError(result.message ?? "No se pudo crear la cuenta. Inténtalo de nuevo.");
        }
      }
    } catch {
      setServerError("Error de conexión. Verifica tu red e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Crear Cuenta</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          style={{ maxWidth: 480, margin: "2rem auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}
          noValidate
        >
          <IonText color="primary">
            <h2 style={{ margin: "0 0 1rem" }}>Crea tu cuenta</h2>
          </IonText>

          {serverError && (
            <IonText color="danger">
              <p style={{ margin: "0 0 0.75rem", padding: "0.75rem", background: "var(--ion-color-danger-tint)", borderRadius: 8 }}>
                {serverError}
              </p>
            </IonText>
          )}

          <IonItem className={fieldErrors["name"] ? "ion-invalid" : ""}>
            <IonLabel position="stacked">Nombre completo</IonLabel>
            <IonInput
              type="text"
              value={name}
              onIonInput={(e) => { setName(String(e.detail.value ?? "")); }}
              placeholder="Tu nombre"
              autocomplete="name"
              disabled={loading}
              required
            />
            {fieldErrors["name"] && (
              <IonNote slot="error">{fieldErrors["name"]}</IonNote>
            )}
          </IonItem>

          <IonItem className={fieldErrors["email"] ? "ion-invalid" : ""}>
            <IonLabel position="stacked">Correo electrónico</IonLabel>
            <IonInput
              type="email"
              value={email}
              onIonInput={(e) => { setEmail(String(e.detail.value ?? "")); }}
              placeholder="tu@correo.com"
              autocomplete="email"
              disabled={loading}
              required
            />
            {fieldErrors["email"] && (
              <IonNote slot="error">{fieldErrors["email"]}</IonNote>
            )}
          </IonItem>

          <IonItem className={fieldErrors["password"] ? "ion-invalid" : ""}>
            <IonLabel position="stacked">Contraseña</IonLabel>
            <IonInput
              type="password"
              value={password}
              onIonInput={(e) => { setPassword(String(e.detail.value ?? "")); }}
              placeholder="Mínimo 8 caracteres"
              autocomplete="new-password"
              disabled={loading}
              required
            />
            {fieldErrors["password"] && (
              <IonNote slot="error">{fieldErrors["password"]}</IonNote>
            )}
          </IonItem>

          <IonItem className={fieldErrors["confirmPassword"] ? "ion-invalid" : ""}>
            <IonLabel position="stacked">Confirmar contraseña</IonLabel>
            <IonInput
              type="password"
              value={confirmPassword}
              onIonInput={(e) => { setConfirmPassword(String(e.detail.value ?? "")); }}
              placeholder="Repite tu contraseña"
              autocomplete="new-password"
              disabled={loading}
              required
            />
            {fieldErrors["confirmPassword"] && (
              <IonNote slot="error">{fieldErrors["confirmPassword"]}</IonNote>
            )}
          </IonItem>

          <IonItem className={fieldErrors["role"] ? "ion-invalid" : ""}>
            <IonLabel position="stacked">Tipo de cuenta</IonLabel>
            <IonSelect
              interface="action-sheet"
              value={role}
              placeholder="Selecciona un tipo"
              onIonChange={(e) => { setRole(e.detail.value as PublicRole); }}
              disabled={loading}
            >
              {(Object.entries(ROLE_LABELS) as [PublicRole, string][]).map(([value, label]) => (
                <IonSelectOption key={value} value={value}>
                  {label}
                </IonSelectOption>
              ))}
            </IonSelect>
            {fieldErrors["role"] && (
              <IonNote slot="error">{fieldErrors["role"]}</IonNote>
            )}
          </IonItem>

          <IonList style={{ marginTop: "1rem" }}>
            <IonItem>
              <IonCheckbox
                checked={acceptTerms}
                onIonChange={e => setAcceptTerms(e.detail.checked)}
                slot="start"
                disabled={loading}
              />
              <IonLabel style={{ whiteSpace: "normal" }}>
                He leído y acepto los{" "}
                <a href="/legal/terms-and-conditions" target="_blank" rel="noopener noreferrer">
                  Términos y Condiciones
                </a>
              </IonLabel>
            </IonItem>
            <IonItem>
              <IonCheckbox
                checked={acceptPrivacy}
                onIonChange={e => setAcceptPrivacy(e.detail.checked)}
                slot="start"
                disabled={loading}
              />
              <IonLabel style={{ whiteSpace: "normal" }}>
                He leído y acepto la{" "}
                <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                  Política de Privacidad
                </a>
              </IonLabel>
            </IonItem>
            <IonItem>
              <IonCheckbox
                checked={acceptUserConditions}
                onIonChange={e => setAcceptUserConditions(e.detail.checked)}
                slot="start"
                disabled={loading}
              />
              <IonLabel style={{ whiteSpace: "normal" }}>
                Acepto las{" "}
                <a href="/legal/user-conditions" target="_blank" rel="noopener noreferrer">
                  Condiciones para Usuarios
                </a>
              </IonLabel>
            </IonItem>
            {role === "driver" && (
              <IonItem>
                <IonCheckbox
                  checked={acceptDriverConditions}
                  onIonChange={e => setAcceptDriverConditions(e.detail.checked)}
                  slot="start"
                  disabled={loading}
                />
                <IonLabel style={{ whiteSpace: "normal" }}>
                  Acepto las{" "}
                  <a href="/legal/driver-conditions" target="_blank" rel="noopener noreferrer">
                    Condiciones para Conductores
                  </a>
                </IonLabel>
              </IonItem>
            )}
            {role === "guide" && (
              <IonItem>
                <IonCheckbox
                  checked={acceptGuideConditions}
                  onIonChange={e => setAcceptGuideConditions(e.detail.checked)}
                  slot="start"
                  disabled={loading}
                />
                <IonLabel style={{ whiteSpace: "normal" }}>
                  Acepto las{" "}
                  <a href="/legal/guide-conditions" target="_blank" rel="noopener noreferrer">
                    Condiciones para Guías
                  </a>
                </IonLabel>
              </IonItem>
            )}
          </IonList>

          <IonButton
            expand="block"
            type="submit"
            disabled={loading || !canSubmit}
            style={{ marginTop: "1rem" }}
          >
            {loading ? <IonSpinner name="crescent" /> : "Crear cuenta"}
          </IonButton>

          <IonButton
            expand="block"
            fill="clear"
            disabled={loading}
            onClick={() => { history.push(ROUTES.AUTH.LOGIN); }}
          >
            ¿Ya tienes cuenta? Iniciar sesión
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            disabled={loading}
            onClick={() => { history.replace(ROUTES.WELCOME); }}
          >
            Volver al inicio
          </IonButton>
        </form>
      </IonContent>
    </IonPage>
  );
}
