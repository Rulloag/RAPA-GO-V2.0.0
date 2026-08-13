import {
  IonButton,
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSpinner,
  IonText,
  IonTextarea,
} from "@ionic/react";
import {
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

import { RAPAGO_CONTACT } from "@rapa-go/shared";
import {
  publicAccountDeletionService,
  type PublicAccountDeletionStatusData,
} from "../../features/accountDeletion/publicAccountDeletion.service.js";
import {
  PublicSiteShell,
  publicSiteStyles,
} from "./PublicSiteShell.js";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function dateLabel(value: string | null): string {
  if (!value) return "No informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("es-CL", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function statusLabel(status: PublicAccountDeletionStatusData["status"]): string {
  switch (status) {
    case "pending":
      return "Pendiente de revisión";
    case "deferred":
      return "Aplazada temporalmente";
    case "approved":
      return "Aprobada";
    case "processing":
      return "Procesando";
    case "completed":
      return "Completada";
    case "identity_not_verified":
      return "No procesada: identidad no verificada";
    case "failed":
      return "Fallida";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

const inputStyle = {
  "--background": "rgba(255,255,255,.055)",
  "--color": "#f6f2ec",
  "--border-color": "rgba(214,166,64,.28)",
  "--highlight-color-focused": "#f8d879",
  border: "1px solid rgba(214,166,64,.28)",
  borderRadius: 16,
  overflow: "hidden",
  marginBottom: 12,
} as CSSProperties;

const actionStyle = {
  "--border-radius": "16px",
  "--background":
    "linear-gradient(135deg,#f8d879 0%,#d6a640 48%,#b84f2e 100%)",
  "--color": "#111",
  fontWeight: 950,
  textTransform: "none",
  minHeight: 50,
} as CSSProperties;

export function PublicAccountDeletionPage(): JSX.Element {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [trackingCode, setTrackingCode] = useState("");

  const [statusEmail, setStatusEmail] = useState("");
  const [statusCode, setStatusCode] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [statusData, setStatusData] =
    useState<PublicAccountDeletionStatusData | null>(null);

  const canSubmit = useMemo(
    () =>
      validEmail(normalizeEmail(email)) &&
      /^\d{6}$/.test(code.trim()) &&
      accepted,
    [accepted, code, email],
  );

  async function requestCode(): Promise<void> {
    const normalized = normalizeEmail(email);
    setError("");
    setMessage("");

    if (!validEmail(normalized)) {
      setError("Ingresa el correo asociado a tu cuenta RAPA GO.");
      return;
    }

    setLoading(true);

    try {
      const result = await publicAccountDeletionService.requestCode(
        normalized,
      );
      setCodeRequested(true);
      setMessage(
        `${result.message} El código dura ${result.expiresMinutes} minutos.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo solicitar el código.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!canSubmit) {
      setError(
        "Completa el correo, el código y la confirmación.",
      );
      return;
    }

    setLoading(true);

    try {
      const cleanReason = reason.trim();
      const request = await publicAccountDeletionService.submit({
        email: normalizeEmail(email),
        code: code.trim(),
        reason: cleanReason,
        comment: comment.trim() || undefined,
        accepted: true,
      });

      setTrackingCode(request.trackingCode);
      setStatusEmail(normalizeEmail(email));
      setStatusCode(request.trackingCode);
      setMessage(
        "Solicitud enviada. La cuenta continúa activa durante la revisión. El plazo ordinario máximo es de 30 días.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo enviar la solicitud.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkStatus(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatusError("");
    setStatusData(null);

    const normalized = normalizeEmail(statusEmail);
    const normalizedCode = statusCode.trim().toUpperCase();

    if (!validEmail(normalized) || !normalizedCode) {
      setStatusError("Ingresa el correo y el número de seguimiento.");
      return;
    }

    setStatusLoading(true);

    try {
      const result = await publicAccountDeletionService.status(
        normalized,
        normalizedCode,
      );
      setStatusData(result);
    } catch (lookupError) {
      setStatusError(
        lookupError instanceof Error
          ? lookupError.message
          : "No se pudo consultar la solicitud.",
      );
    } finally {
      setStatusLoading(false);
    }
  }

  return (
    <PublicSiteShell
      title="Eliminar cuenta"
      subtitle="Solicita la eliminación de una cuenta de pasajero o conductor sin iniciar sesión."
    >
      <section style={publicSiteStyles.card}>
        <h2 style={{ margin: "0 0 10px", color: "#f8d879" }}>
          Cómo funciona
        </h2>
        <ol style={{ ...publicSiteStyles.muted, paddingLeft: 22 }}>
          <li>Verificamos el correo mediante un código de 6 números.</li>
          <li>El motivo es opcional; puedes indicar uno o elegir no informarlo.</li>
          <li>La solicitud llega al panel administrativo.</li>
          <li>La cuenta no se elimina automáticamente.</li>
          <li>Si se aprueba, se anonimizan los datos no necesarios y se cierran las sesiones.</li>
          <li>No existe rechazo discrecional. Solo puede aplazarse por una causa objetiva y temporal informada.</li>
          <li>El plazo ordinario máximo de procesamiento es de 30 días.</li>
        </ol>
      </section>

      <section style={publicSiteStyles.card}>
        <h2 style={{ margin: "0 0 14px", color: "#f8d879" }}>
          Solicitar eliminación
        </h2>

        {message && (
          <IonText color="success">
            <p style={{ fontWeight: 900 }}>{message}</p>
          </IonText>
        )}

        {error && (
          <IonText color="danger">
            <p style={{ fontWeight: 900 }}>{error}</p>
          </IonText>
        )}

        {trackingCode ? (
          <div
            style={{
              padding: 20,
              borderRadius: 18,
              background: "rgba(248,216,121,.10)",
              border: "1px solid rgba(248,216,121,.42)",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, color: "rgba(246,242,236,.76)" }}>
              Guarda este número de seguimiento
            </p>
            <div
              style={{
                marginTop: 8,
                fontSize: "clamp(1.25rem,5vw,2rem)",
                color: "#f8d879",
                fontWeight: 950,
                letterSpacing: ".05em",
              }}
            >
              {trackingCode}
            </div>
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)} noValidate>
            <IonItem style={inputStyle}>
              <IonLabel position="stacked">Correo de la cuenta</IonLabel>
              <IonInput
                type="email"
                autocomplete="email"
                value={email}
                disabled={loading || codeRequested}
                placeholder="nombre@correo.cl"
                onIonInput={(event) => {
                  setEmail(String(event.detail.value ?? ""));
                  setError("");
                }}
              />
            </IonItem>

            {!codeRequested ? (
              <IonButton
                expand="block"
                type="button"
                disabled={loading}
                style={actionStyle}
                onClick={() => void requestCode()}
              >
                {loading ? <IonSpinner name="crescent" /> : "Enviar código"}
              </IonButton>
            ) : (
              <>
                <IonItem style={inputStyle}>
                  <IonLabel position="stacked">Código de verificación</IonLabel>
                  <IonInput
                    inputmode="numeric"
                    maxlength={6}
                    value={code}
                    disabled={loading}
                    placeholder="000000"
                    onIonInput={(event) => {
                      setCode(
                        String(event.detail.value ?? "")
                          .replace(/\D/g, "")
                          .slice(0, 6),
                      );
                      setError("");
                    }}
                  />
                </IonItem>

                <IonItem style={inputStyle}>
                  <IonLabel position="stacked">Motivo (opcional)</IonLabel>
                  <IonTextarea
                    autoGrow
                    maxlength={500}
                    value={reason}
                    disabled={loading}
                    placeholder="Puedes indicar un motivo o dejar este campo en blanco"
                    onIonInput={(event) => {
                      setReason(String(event.detail.value ?? ""));
                      setError("");
                    }}
                  />
                  <IonNote slot="helper">
                    Opcional. Máximo 500 caracteres.
                  </IonNote>
                </IonItem>

                <IonButton
                  expand="block"
                  fill="clear"
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setReason("Prefiero no indicar");
                    setError("");
                  }}
                >
                  Prefiero no indicar el motivo
                </IonButton>

                <IonItem style={inputStyle}>
                  <IonLabel position="stacked">Observación opcional</IonLabel>
                  <IonTextarea
                    autoGrow
                    maxlength={1000}
                    value={comment}
                    disabled={loading}
                    placeholder="Agrega información adicional"
                    onIonInput={(event) => {
                      setComment(String(event.detail.value ?? ""));
                    }}
                  />
                </IonItem>

                <IonItem
                  lines="none"
                  style={{
                    "--background": "transparent",
                    "--color": "#f6f2ec",
                    marginBottom: 12,
                  } as CSSProperties}
                >
                  <IonCheckbox
                    slot="start"
                    checked={accepted}
                    disabled={loading}
                    onIonChange={(event) => {
                      setAccepted(event.detail.checked);
                      setError("");
                    }}
                  />
                  <IonLabel className="ion-text-wrap">
                    Confirmo que deseo solicitar la eliminación de esta cuenta
                    y entiendo que será revisada, con reautenticación y sin rechazo discrecional.
                  </IonLabel>
                </IonItem>

                <IonButton
                  expand="block"
                  type="submit"
                  disabled={loading || !canSubmit}
                  style={actionStyle}
                >
                  {loading ? (
                    <IonSpinner name="crescent" />
                  ) : (
                    "Enviar solicitud"
                  )}
                </IonButton>

                <IonButton
                  expand="block"
                  fill="clear"
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setCodeRequested(false);
                    setCode("");
                    setMessage("");
                  }}
                >
                  Cambiar correo
                </IonButton>
              </>
            )}
          </form>
        )}
      </section>

      <section style={publicSiteStyles.card}>
        <h2 style={{ margin: "0 0 14px", color: "#f8d879" }}>
          Consultar estado
        </h2>

        <form onSubmit={(event) => void checkStatus(event)} noValidate>
          <IonItem style={inputStyle}>
            <IonLabel position="stacked">Correo verificado</IonLabel>
            <IonInput
              type="email"
              value={statusEmail}
              disabled={statusLoading}
              onIonInput={(event) => {
                setStatusEmail(String(event.detail.value ?? ""));
                setStatusError("");
              }}
            />
          </IonItem>

          <IonItem style={inputStyle}>
            <IonLabel position="stacked">Número de seguimiento</IonLabel>
            <IonInput
              value={statusCode}
              disabled={statusLoading}
              placeholder="RAD-..."
              onIonInput={(event) => {
                setStatusCode(
                  String(event.detail.value ?? "").toUpperCase(),
                );
                setStatusError("");
              }}
            />
          </IonItem>

          {statusError && (
            <IonText color="danger">
              <p style={{ fontWeight: 900 }}>{statusError}</p>
            </IonText>
          )}

          <IonButton
            expand="block"
            fill="outline"
            type="submit"
            disabled={statusLoading}
            style={{ "--border-radius": "16px", fontWeight: 900 } as CSSProperties}
          >
            {statusLoading ? <IonSpinner name="crescent" /> : "Consultar"}
          </IonButton>
        </form>

        {statusData && (
          <div
            style={{
              marginTop: 16,
              padding: 18,
              borderRadius: 16,
              background: "rgba(255,255,255,.055)",
              border: "1px solid rgba(214,166,64,.28)",
            }}
          >
            <p><strong>Seguimiento:</strong> {statusData.trackingCode}</p>
            <p><strong>Estado:</strong> {statusLabel(statusData.status)}</p>
            <p><strong>Solicitud:</strong> {dateLabel(statusData.requestedAt)}</p>
            <p><strong>Plazo máximo:</strong> {dateLabel(statusData.deadlineAt)}</p>
            {statusData.deferredUntil && (
              <p><strong>Aplazada hasta:</strong> {dateLabel(statusData.deferredUntil)}</p>
            )}
            {statusData.reviewedAt && (
              <p><strong>Revisión:</strong> {dateLabel(statusData.reviewedAt)}</p>
            )}
            {statusData.completedAt && (
              <p><strong>Finalización:</strong> {dateLabel(statusData.completedAt)}</p>
            )}
            {statusData.adminNote && (
              <p><strong>Respuesta administrativa:</strong> {statusData.adminNote}</p>
            )}
            {statusData.failureReason && (
              <p><strong>Detalle:</strong> {statusData.failureReason}</p>
            )}
            {statusData.retentionSummary && (
              <p><strong>Datos conservados:</strong> {statusData.retentionSummary}</p>
            )}
          </div>
        )}
      </section>

      <section style={publicSiteStyles.card}>
        <h2 style={{ margin: "0 0 10px", color: "#f8d879" }}>
          Contacto de privacidad
        </h2>
        <p style={publicSiteStyles.muted}>
          Para consultas sobre identidad, conservación legal, saldos o el estado de una solicitud, escribe a{" "}
          <a href={`mailto:${RAPAGO_CONTACT.privacyEmail}`} style={{ color: "#f8d879", fontWeight: 900 }}>
            {RAPAGO_CONTACT.privacyEmail}
          </a>. La solicitud también puede realizarse desde el Perfil de la aplicación.
        </p>
      </section>
    </PublicSiteShell>
  );
}
