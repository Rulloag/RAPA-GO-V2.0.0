import { useState, type FormEvent } from "react";
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
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

const API_URL = (
  import.meta.env.VITE_API_URL ??
  "https://api.rapago.cl"
).replace(/\/$/, "");

type FacebookPassengerCondition =
  | "chileno_no_residente"
  | "extranjero"
  | "residente"
  | "";

type RapaNuiEthnicity = "si" | "no" | "";
type PassengerFareType = "resident" | "chilean" | "foreigner";

function getPassengerFareType(
  condition: FacebookPassengerCondition,
  rapaNuiEthnicity: RapaNuiEthnicity,
): PassengerFareType {
  if (condition === "residente") return "resident";
  if (rapaNuiEthnicity === "si") return "resident";
  if (condition === "chileno_no_residente") return "chilean";
  return "foreigner";
}

function getConditionLabel(value: FacebookPassengerCondition): string {
  if (value === "residente") return "Residente";
  if (value === "chileno_no_residente") return "Chileno no residente";
  if (value === "extranjero") return "Extranjero";
  return "";
}

function getPassengerFareLabel(value: PassengerFareType): string {
  if (value === "resident") return "Residente Rapa Nui";
  if (value === "chilean") return "Chileno no residente";
  return "Extranjero";
}

export function LoginPage(): JSX.Element {
  const history = useHistory();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  const [showFacebookStep, setShowFacebookStep] = useState(false);
  const [facebookPassengerCondition, setFacebookPassengerCondition] =
    useState<FacebookPassengerCondition>("");
  const [rapaNuiEthnicity, setRapaNuiEthnicity] =
    useState<RapaNuiEthnicity>("");
  const [facebookStepError, setFacebookStepError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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
        setServerError(result.message ?? "Correo o contraseña incorrectos.");
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

  function openFacebookStep(): void {
    setFacebookStepError("");
    setShowFacebookStep(true);
  }

  function continueWithFacebook(): void {
    setFacebookStepError("");

    if (!facebookPassengerCondition) {
      setFacebookStepError("Selecciona si eres chileno no residente, extranjero o residente.");
      return;
    }

    if (!rapaNuiEthnicity) {
      setFacebookStepError("Indica si perteneces a la etnia Rapa Nui.");
      return;
    }

    const passengerFareType = getPassengerFareType(
      facebookPassengerCondition,
      rapaNuiEthnicity,
    );

    const conditionLabel = getConditionLabel(facebookPassengerCondition);
    const passengerFareLabel = getPassengerFareLabel(passengerFareType);

    try {
      const currentRaw = localStorage.getItem("rapago_registration_profile");
      const current = currentRaw ? JSON.parse(currentRaw) : {};

      const nextProfile = {
        ...current,
        nationality: conditionLabel,
        passengerFareLabel,
        passengerFareType,
        farePassengerType: passengerFareType,
        passengerType: passengerFareType,
        passengerCondition: facebookPassengerCondition,
        belongsToRapaNuiEthnicity: rapaNuiEthnicity === "si",
        facebookLoginPrecheck: true,
      };

      localStorage.setItem(
        "rapago_registration_profile",
        JSON.stringify(nextProfile),
      );

      localStorage.setItem("rapago_profile_nationality", conditionLabel);
      localStorage.setItem("rapago_nationality", conditionLabel);
      localStorage.setItem("rapago_passenger_condition", facebookPassengerCondition);
      localStorage.setItem("rapago_passenger_fare_type", passengerFareType);
      localStorage.setItem("rapago_fare_passenger_type", passengerFareType);
      localStorage.setItem("rapago_passenger_type", passengerFareType);
      localStorage.setItem(
        "rapago_belongs_to_rapa_nui_ethnicity",
        rapaNuiEthnicity,
      );
    } catch {
      // No bloquea el login si el navegador no permite localStorage.
    }

    const params = new URLSearchParams({
      condition: facebookPassengerCondition,
      rapaNuiEthnicity,
      passengerFareType,
    });

    window.location.href = `${API_URL}/api/auth/facebook?${params.toString()}`;
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
            onClick={openFacebookStep}
            type="button"
          >
            Continuar con Facebook
          </IonButton>

          <IonButton
            expand="block"
            fill="clear"
            disabled={loading}
            onClick={goToRegister}
            type="button"
          >
            ¿No tienes cuenta? Crear cuenta
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            disabled={loading}
            onClick={() => history.replace(ROUTES.WELCOME)}
            type="button"
          >
            Volver al inicio
          </IonButton>
        </form>

        <IonModal
          isOpen={showFacebookStep}
          onDidDismiss={() => setShowFacebookStep(false)}
        >
          <IonPage>
            <IonHeader>
              <IonToolbar color="primary">
                <IonTitle>Antes de continuar</IonTitle>
              </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding">
              <div className="auth-form">
                <IonText color="primary">
                  <h2 className="auth-title">Datos del pasajero</h2>
                </IonText>

                <IonText color="medium">
                  <p style={{ fontSize: "0.9rem", marginTop: 0 }}>
                    Completa estos datos antes de iniciar sesión con Facebook.
                  </p>
                </IonText>

                {facebookStepError && (
                  <IonText color="danger">
                    <p className="auth-error">{facebookStepError}</p>
                  </IonText>
                )}

                <IonItem>
                  <IonLabel position="stacked">
                    Tipo de pasajero *
                  </IonLabel>
                  <IonSelect
                    value={facebookPassengerCondition}
                    placeholder="Selecciona una opción"
                    interface="action-sheet"
                    onIonChange={(e) =>
                      setFacebookPassengerCondition(
                        String(e.detail.value ?? "") as FacebookPassengerCondition,
                      )
                    }
                  >
                    <IonSelectOption value="chileno_no_residente">
                      Chileno no residente
                    </IonSelectOption>
                    <IonSelectOption value="extranjero">
                      Extranjero
                    </IonSelectOption>
                    <IonSelectOption value="residente">
                      Residente
                    </IonSelectOption>
                  </IonSelect>
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">
                    ¿Perteneces a la etnia Rapa Nui? *
                  </IonLabel>
                  <IonSelect
                    value={rapaNuiEthnicity}
                    placeholder="Selecciona una opción"
                    interface="action-sheet"
                    onIonChange={(e) =>
                      setRapaNuiEthnicity(
                        String(e.detail.value ?? "") as RapaNuiEthnicity,
                      )
                    }
                  >
                    <IonSelectOption value="si">Sí</IonSelectOption>
                    <IonSelectOption value="no">No</IonSelectOption>
                  </IonSelect>
                </IonItem>

                <IonButton
                  expand="block"
                  color="primary"
                  style={{ marginTop: "18px" }}
                  onClick={continueWithFacebook}
                  type="button"
                >
                  Continuar con Facebook
                </IonButton>

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={() => setShowFacebookStep(false)}
                  type="button"
                >
                  Volver
                </IonButton>
              </div>
            </IonContent>
          </IonPage>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
