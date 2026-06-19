import { useState } from "react";
import {
  IonButton,
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
import { useHistory } from "react-router-dom";
import { loginRequestSchema, type UserRole } from "@rapa-go/shared";
import { useAuth } from "./useAuth.js";
import { ROUTES } from "../../navigation/routes.js";

const ROLE_HOME: Record<UserRole, string> = {
  passenger: ROUTES.PASSENGER.HOME,
  driver: ROUTES.DRIVER.HOME,
  guide: ROUTES.GUIDE.HOME,
  rental_operator: ROUTES.RENTAL.HOME,
  admin: ROUTES.ADMIN.HOME,
};

const API_URL =
  import.meta.env.VITE_API_URL ??
  "https://consortium-medication-desktops-brisbane.trycloudflare.com";

export function LoginPage(): JSX.Element {
  const history = useHistory();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setFieldErrors({});
    setServerError("");

    const parsed = loginRequestSchema.safeParse({
      email: email.trim().toLowerCase(),
      password,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          errors[field] = issue.message;
        }
      }

      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const result = await login(parsed.data);

      if (!result.ok) {
        setServerError(
          result.message ?? "Correo o contraseña incorrectos.",
        );
        return;
      }

      const role = result.session.user.role;
      const home = ROLE_HOME[role] ?? ROUTES.WELCOME;

      history.replace(home);
    } catch {
      setServerError("Error de conexión. Verifica tu internet e inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  function handleFacebookLogin(): void {
    window.location.href = `${API_URL}/api/auth/facebook`;
  }

  function goToRegister(): void {
    history.push(ROUTES.AUTH.REGISTER);
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Iniciar sesión</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="auth-form"
          noValidate
        >
          <IonText color="primary">
            <h2 className="auth-title">Bienvenido a Rapa Go</h2>
          </IonText>

          {serverError && (
            <IonText color="danger">
              <p className="auth-error">{serverError}</p>
            </IonText>
          )}

          <IonItem className={fieldErrors.email ? "ion-invalid" : ""}>
            <IonLabel position="stacked">Correo electrónico</IonLabel>
            <IonInput
              type="email"
              value={email}
              onIonInput={(e) => {
                setEmail(String(e.detail.value ?? ""));
              }}
              placeholder="tu@correo.com"
              autocomplete="email"
              inputmode="email"
              disabled={loading}
              required
            />
            {fieldErrors.email && (
              <IonNote slot="error">{fieldErrors.email}</IonNote>
            )}
          </IonItem>

          <IonItem className={fieldErrors.password ? "ion-invalid" : ""}>
            <IonLabel position="stacked">Contraseña</IonLabel>
            <IonInput
              type="password"
              value={password}
              onIonInput={(e) => {
                setPassword(String(e.detail.value ?? ""));
              }}
              placeholder="Mínimo 8 caracteres"
              autocomplete="current-password"
              disabled={loading}
              required
            />
            {fieldErrors.password && (
              <IonNote slot="error">{fieldErrors.password}</IonNote>
            )}
          </IonItem>

          <IonButton
            expand="block"
            type="submit"
            disabled={loading}
            style={{ marginTop: "18px" }}
          >
            {loading ? <IonSpinner name="crescent" /> : "Iniciar sesión"}
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            color="primary"
            disabled={loading}
            onClick={handleFacebookLogin}
          >
            Continuar con Facebook
          </IonButton>

          <IonButton
            expand="block"
            fill="clear"
            disabled={loading}
            onClick={goToRegister}
          >
            ¿No tienes cuenta? Crear cuenta
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
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