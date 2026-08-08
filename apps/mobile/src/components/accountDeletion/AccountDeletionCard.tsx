import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
  IonSpinner,
  IonTextarea,
} from "@ionic/react";
import { trashOutline } from "ionicons/icons";
import { useCallback, useEffect, useState } from "react";

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
  "failed",
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
    case "identity_not_verified":
      return "No procesada: identidad no verificada";
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
  const [preferNotToSay, setPreferNotToSay] = useState(false);
  const [comment, setComment] = useState("");
  const [confirmed, setConfirmed] = useState(false);
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

  async function submit(): Promise<void> {
    if (!session?.accessToken) {
      setError("Debes iniciar sesión nuevamente.");
      return;
    }

    const cleanReason = preferNotToSay
      ? "Prefiero no indicar"
      : reason.trim();
    const cleanComment = comment.trim();

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
        reason?: string;
        comment?: string;
        requesterSnapshot?: AccountDeletionClientSnapshot;
      } = {};

      if (cleanReason) payload.reason = cleanReason;
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
      setPreferNotToSay(false);
      setComment("");
      setConfirmed(false);
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

  const canSubmit = confirmed && !submitting;

  return (
    <IonCard>
      <IonCardHeader>
        <IonCardTitle className="rp-card__title">
          <IonIcon icon={trashOutline} />
          Eliminar mi cuenta
        </IonCardTitle>
      </IonCardHeader>

      <IonCardContent>
        <p>
          La cuenta no se elimina automáticamente. Tu solicitud
          llegará al administrador, quien verificará tu identidad y
          revisará únicamente viajes, pagos, beneficios o casos pendientes.
          Informar un motivo es voluntario.
        </p>

        {loading && (
          <div style={{ textAlign: "center", padding: 12 }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && request && (
          <div className="rp-card__quote">
            <div className="rp-card__row">
              <strong>Estado de la solicitud</strong>

              <IonBadge color={statusColor(request.status)}>
                {statusLabel(request.status)}
              </IonBadge>
            </div>

            {request.reason && (
              <p className="rp-card__foot">
                <strong>Motivo informado:</strong> {request.reason}
              </p>
            )}

            <p className="rp-card__foot">
              Enviada: {readableDate(request.requestedAt)}
            </p>

            <p className="rp-card__foot">
              Seguimiento: {request.trackingCode}
            </p>

            {request.adminNote && (
              <p className="rp-card__quote">
                <strong>Respuesta del administrador:</strong>{" "}
                {request.adminNote}
              </p>
            )}

            {request.failureReason && (
              <p className="rp-card__danger">{request.failureReason}</p>
            )}
          </div>
        )}

        {success && (
          <div className="rp-banner rp-banner--success">{success}</div>
        )}

        {error && <div className="rp-banner rp-banner--error">{error}</div>}

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
            >
              {showForm
                ? "Cerrar formulario"
                : "Solicitar eliminación"}
            </IonButton>

            {showForm && (
              <div style={{ marginTop: 12 }}>
                <IonItem lines="none" className="rapago-profile-field">
                  <IonLabel position="stacked">
                    Motivo (opcional)
                  </IonLabel>

                  <IonTextarea
                    value={reason}
                    disabled={preferNotToSay}
                    onIonInput={(event) => {
                      setReason(String(event.detail.value ?? ""));
                      setError("");
                    }}
                    placeholder={
                      preferNotToSay
                        ? "Prefiero no indicar"
                        : "Puedes explicar por qué quieres eliminar la cuenta"
                    }
                    maxlength={500}
                    counter
                    autoGrow
                    rows={4}
                  />

                  <IonNote slot="helper">
                    Opcional. Máximo 500 caracteres.
                  </IonNote>
                </IonItem>

                <IonItem lines="none" className="rapago-profile-field">
                  <IonCheckbox
                    slot="start"
                    checked={preferNotToSay}
                    onIonChange={(event) => {
                      const checked = Boolean(event.detail.checked);
                      setPreferNotToSay(checked);
                      if (checked) setReason("");
                      setError("");
                    }}
                  />
                  <IonLabel style={{ whiteSpace: "normal" }}>
                    Prefiero no indicar el motivo.
                  </IonLabel>
                </IonItem>

                <IonItem lines="none" className="rapago-profile-field">
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

                <IonItem lines="none" className="rapago-profile-field">
                  <IonCheckbox
                    slot="start"
                    checked={confirmed}
                    onIonChange={(event) => {
                      setConfirmed(Boolean(event.detail.checked));
                      setError("");
                    }}
                  />

                  <IonLabel style={{ whiteSpace: "normal" }}>
                    Entiendo que la solicitud será revisada, que no puede
                    rechazarse discrecionalmente y que solo puede aplazarse
                    por una causa objetiva y temporal informada.
                  </IonLabel>
                </IonItem>

                <IonButton
                  expand="block"
                  color="danger"
                  onClick={() => void submit()}
                  disabled={!canSubmit}
                  style={{ marginTop: 12 }}
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
