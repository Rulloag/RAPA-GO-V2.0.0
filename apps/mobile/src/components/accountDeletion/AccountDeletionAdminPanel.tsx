import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonIcon,
  IonNote,
  IonSpinner,
  IonText,
  useIonAlert,
} from "@ionic/react";
import {
  checkmarkCircleOutline,
  closeCircleOutline,
  documentTextOutline,
  refreshOutline,
  warningOutline,
} from "ionicons/icons";
import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";

import { useAuth } from "../../features/auth/useAuth.js";
import {
  accountDeletionService,
  type AdminAccountDeletionRequestData,
  type AccountDeletionRequestStatus,
} from "../../features/accountDeletion/accountDeletion.service.js";

function statusLabel(status: AccountDeletionRequestStatus): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "approved":
      return "Aprobada";
    case "processing":
      return "Procesando";
    case "completed":
      return "Completada";
    case "rejected":
      return "Rechazada";
    case "failed":
      return "Fallida";
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
    case "rejected":
    case "failed":
      return "danger";
    case "cancelled":
      return "medium";
    default:
      return "warning";
  }
}

function dateLabel(value: string | null): string {
  if (!value) return "No informada";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function money(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function valueOrDash(value: unknown): string {
  const text = String(value ?? "").trim();
  return text || "No informado";
}

function detailRow(
  label: string,
  value: unknown,
): JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(110px, .8fr) minmax(0, 1.2fr)",
        gap: 8,
        padding: "5px 0",
        borderBottom: "1px solid rgba(148,163,184,.18)",
        fontSize: ".82rem",
      }}
    >
      <strong style={{ color: "#334155" }}>{label}</strong>
      <span
        style={{
          color: "#111827",
          fontWeight: 750,
          overflowWrap: "anywhere",
        }}
      >
        {valueOrDash(value)}
      </span>
    </div>
  );
}

export function AccountDeletionAdminPanel(): JSX.Element {
  const { session } = useAuth();
  const [presentAlert] = useIonAlert();

  const [requests, setRequests] =
    useState<AdminAccountDeletionRequestData[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!session?.accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await accountDeletionService.listForAdmin(
        session.accessToken,
      );

      setRequests(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar las solicitudes.",
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(
    request: AdminAccountDeletionRequestData,
    note: string,
  ): Promise<void> {
    if (!session?.accessToken) return;

    setActionId(request.id);
    setError("");
    setMessage("");

    try {
      await accountDeletionService.approve(
        session.accessToken,
        request.id,
        note,
      );

      setMessage(
        "La cuenta fue anonimizada, las sesiones fueron cerradas y el acceso quedó bloqueado.",
      );

      await load();
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "No se pudo aprobar la eliminación.",
      );
    } finally {
      setActionId(null);
    }
  }

  async function reject(
    request: AdminAccountDeletionRequestData,
    note: string,
  ): Promise<void> {
    if (!session?.accessToken) return;

    setActionId(request.id);
    setError("");
    setMessage("");

    try {
      await accountDeletionService.reject(
        session.accessToken,
        request.id,
        note,
      );

      setMessage(
        "La solicitud fue rechazada. La cuenta continúa activa y el usuario podrá ver el motivo.",
      );

      await load();
    } catch (rejectError) {
      setError(
        rejectError instanceof Error
          ? rejectError.message
          : "No se pudo rechazar la solicitud.",
      );
    } finally {
      setActionId(null);
    }
  }

  function askApprove(
    request: AdminAccountDeletionRequestData,
  ): void {
    void presentAlert({
      header: "Aprobar eliminación",
      subHeader:
        "Esta acción anonimizará la cuenta y cerrará todas las sesiones.",
      message:
        "Escribe una observación administrativa para dejar evidencia de la decisión.",
      inputs: [
        {
          name: "note",
          type: "textarea",
          placeholder:
            "Ejemplo: Operaciones revisadas y sin saldos pendientes.",
          attributes: {
            maxlength: 1000,
          },
        },
      ],
      buttons: [
        {
          text: "Cancelar",
          role: "cancel",
        },
        {
          text: "Aprobar y eliminar",
          role: "destructive",
          handler: (data) => {
            const note = String(data?.note ?? "").trim();

            if (note.length < 3) {
              setError(
                "Debes escribir una observación administrativa.",
              );
              return false;
            }

            void approve(request, note);
            return true;
          },
        },
      ],
    });
  }

  function askReject(
    request: AdminAccountDeletionRequestData,
  ): void {
    void presentAlert({
      header: "Rechazar solicitud",
      message:
        "El motivo es obligatorio y será visible para el pasajero o conductor.",
      inputs: [
        {
          name: "note",
          type: "textarea",
          placeholder: "Escribe el motivo del rechazo",
          attributes: {
            maxlength: 1000,
          },
        },
      ],
      buttons: [
        {
          text: "Cancelar",
          role: "cancel",
        },
        {
          text: "Rechazar",
          role: "destructive",
          handler: (data) => {
            const note = String(data?.note ?? "").trim();

            if (note.length < 3) {
              setError(
                "Debes escribir el motivo del rechazo.",
              );
              return false;
            }

            void reject(request, note);
            return true;
          },
        },
      ],
    });
  }

  const pendingCount = requests.filter(
    (request) => request.status === "pending",
  ).length;

  return (
    <div>
      <IonCard style={{ margin: "0 0 12px" }}>
        <IonCardHeader>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <div>
              <IonCardTitle>
                Solicitudes de eliminación
              </IonCardTitle>

              <IonCardSubtitle>
                Pasajeros y conductores. La cuenta nunca se elimina
                automáticamente.
              </IonCardSubtitle>
            </div>

            <IonBadge
              color={pendingCount > 0 ? "warning" : "medium"}
            >
              {pendingCount} pendiente
              {pendingCount === 1 ? "" : "s"}
            </IonBadge>
          </div>
        </IonCardHeader>

        <IonCardContent>
          <IonButton
            size="small"
            fill="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            <IonIcon icon={refreshOutline} slot="start" />
            Actualizar
          </IonButton>

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
        </IonCardContent>
      </IonCard>

      {loading && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <IonSpinner name="crescent" />
        </div>
      )}

      {!loading && requests.length === 0 && (
        <IonCard>
          <IonCardContent>
            <IonText color="medium">
              <p style={{ margin: 0, fontWeight: 850 }}>
                No hay solicitudes de eliminación de cuenta.
              </p>
            </IonText>
          </IonCardContent>
        </IonCard>
      )}

      {!loading &&
        requests.map((request) => {
          const snapshot = request.clientSnapshot;
          const passenger = request.passengerProfile;
          const driver = request.driverProfile;
          const application = request.application;
          const busy = actionId === request.id;

          const phone =
            passenger?.phone ??
            driver?.phone ??
            application?.phone ??
            snapshot?.phone;

          const rut =
            application?.rut ??
            snapshot?.rut;

          const vehicleBrand =
            driver?.vehicleBrand ??
            application?.vehicleBrand ??
            snapshot?.vehicleBrand;

          const vehicleModel =
            driver?.vehicleModel ??
            application?.vehicleModel ??
            snapshot?.vehicleModel;

          const vehiclePlate =
            driver?.vehiclePlate ??
            application?.vehiclePlate ??
            snapshot?.vehiclePlate;

          return (
            <IonCard
              key={request.id}
              style={{
                margin: "0 0 14px",
                borderRadius: 18,
                border:
                  request.status === "pending"
                    ? "1.5px solid rgba(245,158,11,.42)"
                    : "1px solid rgba(148,163,184,.30)",
              }}
            >
              <IonCardHeader>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div>
                    <IonCardTitle
                      style={{ fontSize: "1.05rem" }}
                    >
                      {request.requester?.name ??
                        (application
                          ? `${application.firstName} ${application.lastName}`.trim()
                          : "Cuenta no disponible")}
                    </IonCardTitle>

                    <IonCardSubtitle>
                      {request.requester?.email ??
                        application?.email ??
                        "Correo anonimizado"}
                    </IonCardSubtitle>
                  </div>

                  <IonBadge color={statusColor(request.status)}>
                    {statusLabel(request.status)}
                  </IonBadge>
                </div>
              </IonCardHeader>

              <IonCardContent>
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "#fff7ed",
                    border: "1px solid rgba(245,158,11,.28)",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontWeight: 950,
                    }}
                  >
                    <IonIcon icon={documentTextOutline} />
                    Motivo entregado por el usuario
                  </div>

                  <p
                    style={{
                      margin: "8px 0 0",
                      whiteSpace: "pre-wrap",
                      fontWeight: 800,
                      lineHeight: 1.4,
                    }}
                  >
                    {request.reason}
                  </p>

                  {request.comment && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        color: "#5b4632",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      <strong>Observación:</strong>{" "}
                      {request.comment}
                    </p>
                  )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(230px, 1fr))",
                    gap: 12,
                  }}
                >
                  <section>
                    <h3
                      style={{
                        margin: "0 0 6px",
                        fontSize: ".92rem",
                      }}
                    >
                      Cuenta
                    </h3>

                    {detailRow(
                      "ID",
                      request.userId,
                    )}

                    {detailRow(
                      "Rol",
                      request.requester?.role ??
                        request.requesterRole,
                    )}

                    {detailRow(
                      "Estado",
                      request.requester?.status,
                    )}

                    {detailRow(
                      "Teléfono",
                      phone,
                    )}

                    {detailRow(
                      "RUT",
                      rut,
                    )}

                    {detailRow(
                      "Tipo pasajero",
                      snapshot?.passengerType,
                    )}

                    {detailRow(
                      "Registrada",
                      request.requester?.createdAt
                        ? dateLabel(request.requester.createdAt)
                        : null,
                    )}

                    {detailRow(
                      "Solicitud",
                      dateLabel(request.requestedAt),
                    )}
                  </section>

                  <section>
                    <h3
                      style={{
                        margin: "0 0 6px",
                        fontSize: ".92rem",
                      }}
                    >
                      Conductor y vehículo
                    </h3>

                    {detailRow(
                      "Marca",
                      vehicleBrand,
                    )}

                    {detailRow(
                      "Modelo",
                      vehicleModel,
                    )}

                    {detailRow(
                      "Año",
                      driver?.vehicleYear ??
                        application?.vehicleYear ??
                        snapshot?.vehicleYear,
                    )}

                    {detailRow(
                      "Patente",
                      vehiclePlate,
                    )}

                    {detailRow(
                      "Color",
                      driver?.vehicleColor ??
                        application?.vehicleColor ??
                        snapshot?.vehicleColor,
                    )}

                    {detailRow(
                      "Licencia",
                      driver?.licenseNumber ??
                        application?.licenseNumber ??
                        snapshot?.licenseNumber,
                    )}

                    {detailRow(
                      "Vencimiento",
                      driver?.licenseExpiry ??
                        application?.licenseExpiry,
                    )}
                  </section>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: "#f8fafc",
                    border: "1px solid rgba(148,163,184,.30)",
                  }}
                >
                  <strong>Resumen operacional</strong>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(145px, 1fr))",
                      gap: 8,
                      marginTop: 8,
                      fontSize: ".8rem",
                      fontWeight: 800,
                    }}
                  >
                    <span>
                      Viajes: {request.accountSummary.totalRides}
                    </span>
                    <span>
                      Viajes activos:{" "}
                      {request.accountSummary.activeRides}
                    </span>
                    <span>
                      Pagos pendientes:{" "}
                      {request.accountSummary.pendingPayments}
                    </span>
                    <span>
                      Saldo/beneficio:{" "}
                      {money(
                        request.accountSummary.walletBalanceClp,
                      )}
                    </span>
                    <span>
                      Reservas turísticas:{" "}
                      {
                        request.accountSummary
                          .activeServiceBookings
                      }
                    </span>
                    <span>
                      Arriendos activos:{" "}
                      {
                        request.accountSummary
                          .activeRentalBookings
                      }
                    </span>
                    <span>
                      Tickets activos:{" "}
                      {
                        request.accountSummary
                          .activeEventTickets
                      }
                    </span>
                    <span>
                      Documentos: {request.documents.length}
                    </span>
                  </div>
                </div>

                {request.documents.length > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {request.documents.map((document) => (
                      <IonBadge
                        key={document.id}
                        color={
                          document.status === "approved"
                            ? "success"
                            : document.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {document.documentType}: {document.status}
                      </IonBadge>
                    ))}
                  </div>
                )}

                {request.blockers.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "11px 12px",
                      borderRadius: 14,
                      background: "#fff1f2",
                      border: "1px solid rgba(225,29,72,.26)",
                      color: "#9f1239",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        fontWeight: 950,
                      }}
                    >
                      <IonIcon icon={warningOutline} />
                      No puede aprobarse todavía
                    </div>

                    <ul
                      style={{
                        margin: "8px 0 0",
                        paddingLeft: 20,
                        fontWeight: 800,
                      }}
                    >
                      {request.blockers.map((blocker) => (
                        <li key={blocker}>{blocker}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {request.adminNote && (
                  <IonNote
                    style={{
                      display: "block",
                      marginTop: 10,
                      fontWeight: 800,
                    }}
                  >
                    Respuesta administrativa: {request.adminNote}
                  </IonNote>
                )}

                {request.status === "pending" && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 14,
                    }}
                  >
                    <IonButton
                      color="success"
                      size="small"
                      onClick={() => askApprove(request)}
                      disabled={!request.canApprove || busy}
                    >
                      {busy
                        ? <IonSpinner name="dots" />
                        : (
                          <>
                            <IonIcon
                              icon={checkmarkCircleOutline}
                              slot="start"
                            />
                            Aprobar eliminación
                          </>
                        )}
                    </IonButton>

                    <IonButton
                      color="danger"
                      fill="outline"
                      size="small"
                      onClick={() => askReject(request)}
                      disabled={busy}
                    >
                      <IonIcon
                        icon={closeCircleOutline}
                        slot="start"
                      />
                      Rechazar con motivo
                    </IonButton>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          );
        })}
    </div>
  );
}
