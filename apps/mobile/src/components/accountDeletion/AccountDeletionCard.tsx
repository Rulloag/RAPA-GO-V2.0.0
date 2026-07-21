import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSpinner,
  IonText,
  IonTextarea,
} from "@ionic/react";
import { trashOutline } from "ionicons/icons";
import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";

import { useAuth } from "../../features/auth/useAuth.js";
import {
  accountDeletionService,
  type AccountDeletionClientSnapshot,
  type AccountDeletionRequestData,
  type AccountDeletionRequestStatus,
} from "../../features/accountDeletion/accountDeletion.service.js";

interface AccountDeletionCardProps {
  requesterSnapshot?: AccountDeletionClientSnapshot;
}

const OPEN_STATUSES = new Set<AccountDeletionRequestStatus>([
  "pending",
  "deferred",
  "approved",
  "processing",
]);

function statusLabel(status: AccountDeletionRequestStatus): string {
  switch (status) {
    case "pending":
      return "Pendiente de revisión";
    case "deferred":
      return "Aplazada temporalmente";
    case "approved":
      return "Aprobada";
    case "processing":
      return "Procesando eliminación";
    case "completed":
      return "Cuenta eliminada";
    case "rejected":
      return "Rechazada";
    case "failed":
      return "Error de procesamiento";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

function statusColor(status: AccountDeletionRequestStatus): string {
  switch (status) {
    case "completed":
    case "approved":
      return "success";
    case "failed":
      return "danger";
    case "cancelled":
      return "medium";
    default:
      return "warning";
  }
}

function readableDate(value: string | null): string {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AccountDeletionCard({
  requesterSnapshot,
}: AccountDeletionCardProps): JSX.Element {
  const { session } = useAuth();

  const [request, setRequest] =
    useState<AccountDeletionRequestData | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRequest = useCallback(async () => {
    if (!session?.accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const current = await accountDeletionService.getMine(
        session.accessToken,
      );

      setRequest(current);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo consultar la solicitud.",
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  async function sendVerificationCode(): Promise<void> {
    if (!session?.accessToken) {
      setError("Debes iniciar sesión nuevamente.");
      return;
    }

    setSendingCode(true);
    setError("");
    setSuccess("");

    try {
      const result = await accountDeletionService.requestVerificationCode(
        session.accessToken,
      );
      setCodeSent(true);
      setSuccess(result.message);
    } catch (codeError) {
      setError(
        codeError instanceof Error
          ? codeError.message
          : "No se pudo enviar el código.",
      );
    } finally {
      setSendingCode(false);
    }
  }

  async function submit(): Promise<void> {
    if (!session?.accessToken) {
      setError("Debes iniciar sesión nuevamente.");
      return;
    }

    const cleanReason = reason.trim();
    const cleanComment = comment.trim();
    const cleanVerificationCode = verificationCode.trim();

    if (cleanReason.length < 10) {
      setError(
        "Escribe el motivo con al menos 10 caracteres.",
      );
      return;
    }

    if (!/^\d{6}$/.test(cleanVerificationCode)) {
      setError("Solicita e ingresa el código de 6 números enviado a tu correo.");
      return;
    }

    if (!confirmed) {
      setError(
        "Debes confirmar que la solicitud será revisada por el administrador.",
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const payload: {
        verificationCode: string;
        reason: string;
        comment?: string;
        requesterSnapshot?: AccountDeletionClientSnapshot;
      } = {
        verificationCode: cleanVerificationCode,
        reason: cleanReason,
      };

      if (cleanComment) payload.comment = cleanComment;

      if (requesterSnapshot) {
        payload.requesterSnapshot = requesterSnapshot;
      }

      const created = await accountDeletionService.create(
        session.accessToken,
        payload,
      );

      setRequest(created);
      setReason("");
      setComment("");
      setConfirmed(false);
      setVerificationCode("");
      setCodeSent(false);
      setShowForm(false);
      setSuccess(
        "Solicitud enviada. Tu cuenta continuará activa durante la revisión y el plazo ordinario máximo es de 30 días.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo enviar la solicitud.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const hasOpenRequest =
    request != null && OPEN_STATUSES.has(request.status);

  const cardStyle = {
    margin: "14px 0",
    borderRadius: 22,
    border: "1.5px solid rgba(220, 38, 38, 0.28)",
    boxShadow: "0 14px 34px rgba(65, 34, 20, .10)",
    overflow: "hidden",
  } as CSSProperties;

  return (
    <IonCard style={cardStyle}>
      <IonCardHeader>
        <IonCardTitle
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#111",
            fontWeight: 950,
          }}
        >
          <IonIcon icon={trashOutline} />
          Eliminar mi cuenta
        </IonCardTitle>
      </IonCardHeader>

      <IonCardContent style={{ paddingTop: 0 }}>
        <p
          style={{
            margin: "0 0 12px",
            color: "#5b4632",
            fontWeight: 800,
            lineHeight: 1.45,
          }}
        >
          La cuenta no se elimina automáticamente. Tu solicitud
          llegará al administrador, quien revisará el motivo, los
          viajes, pagos, beneficios y documentos pendientes.
        </p>

        {loading && (
          <div style={{ textAlign: "center", padding: 12 }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && request && (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 14px",
              borderRadius: 16,
              background: "#fff7ed",
              border: "1px solid rgba(210, 164, 58, 0.34)",
              color: "#1f1711",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <strong>Estado de la solicitud</strong>

              <IonBadge color={statusColor(request.status)}>
                {statusLabel(request.status)}
              </IonBadge>
            </div>

            <p style={{ margin: "8px 0 0", fontWeight: 800 }}>
              <strong>Motivo:</strong> {request.reason}
            </p>

            <p
              style={{
                margin: "6px 0 0",
                color: "#6b5a45",
                fontSize: ".82rem",
                fontWeight: 750,
              }}
            >
              Enviada: {readableDate(request.requestedAt)}
            </p>

            <p
              style={{
                margin: "6px 0 0",
                color: "#5b4632",
                fontSize: ".82rem",
                fontWeight: 900,
              }}
            >
              Seguimiento: {request.trackingCode}
            </p>

            {request.adminNote && (
              <p
                style={{
                  margin: "8px 0 0",
                  padding: "9px 10px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,.72)",
                  fontWeight: 850,
                }}
              >
                <strong>Respuesta del administrador:</strong>{" "}
                {request.adminNote}
              </p>
            )}

            {request.failureReason && (
              <p
                style={{
                  margin: "8px 0 0",
                  color: "#b42318",
                  fontWeight: 850,
                }}
              >
                {request.failureReason}
              </p>
            )}
          </div>
        )}

        {success && (
          <IonText color="success">
            <p style={{ fontWeight: 900 }}>{success}</p>
          </IonText>
        )}

        {error && (
          <IonText color="danger">
            <p style={{ fontWeight: 900 }}>{error}</p>
          </IonText>
        )}

        {!loading && !hasOpenRequest && (
          <>
            <IonButton
              expand="block"
              color="danger"
              fill={showForm ? "solid" : "outline"}
              onClick={() => {
                setShowForm((current) => !current);
                setError("");
                setSuccess("");
              }}
              disabled={submitting}
              style={
                {
                  "--border-radius": "16px",
                  height: "50px",
                  fontWeight: 950,
                } as CSSProperties
              }
            >
              {showForm
                ? "Cerrar formulario"
                : "Solicitar eliminación"}
            </IonButton>

            {showForm && (
              <div style={{ marginTop: 12 }}>
                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={() => void sendVerificationCode()}
                  disabled={sendingCode}
                  style={{ fontWeight: 900, marginBottom: 10 }}
                >
                  {sendingCode ? <IonSpinner name="dots" /> : "Enviar código a mi correo"}
                </IonButton>

                <IonItem
                  lines="none"
                  style={{
                    "--background": "#fffaf0",
                    borderRadius: 16,
                    marginBottom: 10,
                  } as CSSProperties}
                >
                  <IonLabel position="stacked">Código de verificación</IonLabel>
                  <IonInput
                    value={verificationCode}
                    inputMode="numeric"
                    maxlength={6}
                    placeholder="000000"
                    onIonInput={(event) => {
                      setVerificationCode(
                        String(event.detail.value ?? "")
                          .replace(/\D/g, "")
                          .slice(0, 6),
                      );
                      setError("");
                    }}
                  />
                  <IonNote slot="helper">
                    {codeSent
                      ? "Código enviado. Vence en 10 minutos."
                      : "Reautenticación obligatoria antes de enviar la solicitud."}
                  </IonNote>
                </IonItem>

                <IonItem
                  lines="none"
                  style={{
                    "--background": "#fffaf0",
                    borderRadius: 16,
                    marginBottom: 10,
                  } as CSSProperties}
                >
                  <IonLabel position="stacked">
                    Motivo obligatorio
                  </IonLabel>

                  <IonTextarea
                    value={reason}
                    onIonInput={(event) => {
                      setReason(String(event.detail.value ?? ""));
                      setError("");
                    }}
                    placeholder="Explica por qué quieres eliminar la cuenta"
                    maxlength={500}
                    counter
                    autoGrow
                    rows={4}
                  />

                  <IonNote slot="helper">
                    Mínimo 10 caracteres.
                  </IonNote>
                </IonItem>

                <IonItem
                  lines="none"
                  style={{
                    "--background": "#fffaf0",
                    borderRadius: 16,
                    marginBottom: 10,
                  } as CSSProperties}
                >
                  <IonLabel position="stacked">
                    Observación adicional
                  </IonLabel>

                  <IonTextarea
                    value={comment}
                    onIonInput={(event) => {
                      setComment(String(event.detail.value ?? ""));
                      setError("");
                    }}
                    placeholder="Opcional"
                    maxlength={1000}
                    counter
                    autoGrow
                    rows={3}
                  />
                </IonItem>

                <IonItem
                  lines="none"
                  style={{
                    "--background": "#fffaf0",
                    borderRadius: 16,
                  } as CSSProperties}
                >
                  <IonCheckbox
                    slot="start"
                    checked={confirmed}
                    onIonChange={(event) => {
                      setConfirmed(Boolean(event.detail.checked));
                      setError("");
                    }}
                  />

                  <IonLabel
                    style={{
                      whiteSpace: "normal",
                      fontWeight: 800,
                      lineHeight: 1.35,
                    }}
                  >
                    Entiendo que la solicitud será revisada, que no puede
                    rechazarse discrecionalmente y que solo puede aplazarse
                    por una causa objetiva y temporal informada.
                  </IonLabel>
                </IonItem>

                <IonButton
                  expand="block"
                  color="danger"
                  onClick={() => void submit()}
                  disabled={submitting}
                  style={
                    {
                      "--border-radius": "16px",
                      height: "52px",
                      marginTop: 12,
                      fontWeight: 950,
                    } as CSSProperties
                  }
                >
                  {submitting
                    ? <IonSpinner name="dots" />
                    : "Enviar solicitud al administrador"}
                </IonButton>
              </div>
            )}
          </>
        )}
      </IonCardContent>
    </IonCard>
  );
}
