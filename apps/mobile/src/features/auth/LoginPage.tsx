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
import { loginRequestSchema } from "@rapa-go/shared";
import { useAuth } from "./useAuth.js";
import { AppleSignInButton } from "./AppleSignInButton.js";
import { AppleRoleSelectionModal } from "./AppleRoleSelectionModal.js";
import { useAppleSignIn } from "./useAppleSignIn.js";
import type { AppleSignInOutcome } from "./useAppleSignIn.js";
import type { PublicRole } from "./roles.js";
import { ROUTES } from "../../navigation/routes.js";
import type { UserRole } from "@rapa-go/shared";

const ROLE_HOME: Record<UserRole, string> = {
  passenger:       ROUTES.PASSENGER.HOME,
  driver:          ROUTES.DRIVER.HOME,
  guide:           ROUTES.GUIDE.HOME,
  rental_operator: ROUTES.RENTAL.HOME,
  admin:           ROUTES.ADMIN.HOME,
};

export function LoginPage(): JSX.Element {
  const history = useHistory();
  const { login } = useAuth();
  const apple = useAppleSignIn();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  function handleAppleOutcome(outcome: AppleSignInOutcome): void {
    switch (outcome.kind) {
      case "success": {
        const home = ROLE_HOME[outcome.role] ?? ROUTES.WELCOME;
        history.replace(home);
        return;
      }
      case "cancelled":
        // Voluntary cancellation is not an error — no message shown.
        setServerError("");
        return;
      case "role_required":
        // Modal opens via apple.awaitingRole; nothing else to do here.
        setServerError("");
        return;
      case "linking_required":
        setServerError("Ya existe una cuenta con este correo. Inicia sesión con tu método habitual para vincular Apple.");
        return;
      case "suspended":
        setServerError("Tu cuenta está suspendida. Contacta a soporte.");
        return;
      case "invalid_credential":
        setServerError("No se pudo verificar tu identidad de Apple. Inténtalo de nuevo.");
        return;
      case "network_error":
        setServerError("Error de conexión. Verifica tu red e inténtalo de nuevo.");
        return;
      case "unavailable":
        // Button is hidden when unavailable — this shouldn't be reachable from the UI.
        return;
      case "internal_error":
        setServerError("No se pudo iniciar sesión con Apple. Inténtalo de nuevo.");
        return;
    }
  }

  async function handleAppleRoleSubmit(role: PublicRole): Promise<void> {
    const outcome = await apple.submitRole(role);
    handleAppleOutcome(outcome);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setServerError("");

    const parsed = loginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const result = await login(parsed.data);
      if (result.ok) {
        const home = ROLE_HOME[result.session.user.role] ?? ROUTES.WELCOME;
        history.replace(home);
      } else {
        setServerError(result.message ?? "No se pudo iniciar sesión. Inténtalo de nuevo.");
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
          <IonTitle>Iniciar Sesión</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          style={{ maxWidth: 480, margin: "2rem auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}
          noValidate
        >
          <IonText color="primary">
            <h2 style={{ margin: "0 0 1rem" }}>Bienvenido</h2>
          </IonText>

          {serverError && (
            <IonText color="danger">
              <p style={{ margin: "0 0 0.75rem", padding: "0.75rem", background: "var(--ion-color-danger-tint)", borderRadius: 8 }}>
                {serverError}
              </p>
            </IonText>
          )}

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
              autocomplete="current-password"
              disabled={loading}
              required
            />
            {fieldErrors["password"] && (
              <IonNote slot="error">{fieldErrors["password"]}</IonNote>
            )}
          </IonItem>

          <IonButton
            expand="block"
            type="submit"
            disabled={loading}
            style={{ marginTop: "1rem" }}
          >
            {loading ? <IonSpinner name="crescent" /> : "Iniciar sesión"}
          </IonButton>

          <AppleSignInButton
            isAvailable={apple.isAvailable}
            loading={apple.loading}
            disabled={loading}
            onPress={() => { void apple.signIn().then(handleAppleOutcome); }}
          />

          <IonButton
            expand="block"
            fill="clear"
            disabled={loading}
            onClick={() => { history.push(ROUTES.AUTH.REGISTER); }}
          >
            ¿No tienes cuenta? Crear cuenta
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

      <AppleRoleSelectionModal
        isOpen={apple.awaitingRole}
        loading={apple.loading}
        onCancel={apple.cancelRoleSelection}
        onConfirm={(role) => { void handleAppleRoleSubmit(role); }}
      />
    </IonPage>
  );
}
