import {
  IonAlert,
  IonButton,
  IonIcon,
  IonSpinner,
} from "@ionic/react";
import {
  briefcaseOutline,
  moonOutline,
  saveOutline,
  timeOutline,
} from "ionicons/icons";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import { useAuth } from "../../../features/auth";
import {
  driverProfileService,
  type DriverRestComplianceData,
} from "../../../features/drivers/driverProfile.service";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type ConfirmationAction = "rest" | "work";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Pacific/Easter",
  });
}

function formatRemaining(
  value: string | null | undefined,
  nowMs: number,
): string {
  if (!value) return "";
  const endMs = new Date(value).getTime();
  if (!Number.isFinite(endMs)) return "";
  const remaining = Math.max(0, endMs - nowMs);
  const totalMinutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

function statusLabel(
  state: DriverRestComplianceData["state"] | null,
): string {
  switch (state?.status) {
    case "active":
      return "Descanso activo";
    case "reminder_due":
      return "Decisión pendiente";
    case "working":
      return "Trabajando";
    case "completed":
      return "Completado";
    case "scheduled":
      return "Programado";
    default:
      return "Sin iniciar";
  }
}

export function DriverRestScheduleCard({
  onBlockedChange,
}: {
  onBlockedChange?: (blocked: boolean) => void;
}): JSX.Element {
  const { session } = useAuth();
  const [compliance, setCompliance] =
    useState<DriverRestComplianceData | null>(null);
  const [serviceStartTime, setServiceStartTime] = useState("10:00");
  const [serviceEndTime, setServiceEndTime] = useState("22:00");
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [performingAction, setPerformingAction] = useState<
    "rest" | "work" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const publish = useCallback(
    (
      data: DriverRestComplianceData,
      options?: { forceSchedule?: boolean },
    ) => {
      setCompliance(data);
      const schedule = data.latestSchedule ?? data.effectiveSchedule;

      if (schedule && (options?.forceSchedule || !scheduleDirty)) {
        setServiceStartTime(schedule.serviceStartTime || "10:00");
        setServiceEndTime(
          schedule.serviceEndTime || schedule.startTime || "22:00",
        );
      }

      // Solo un descanso confirmado manualmente bloquea al conductor.
      onBlockedChange?.(data.state.blockedForNewOffers);

      try {
        window.dispatchEvent(
          new CustomEvent("rapago:driver-rest-state-changed", {
            detail: {
              blocked: data.state.blockedForNewOffers,
              state: data.state,
              schedule,
            },
          }),
        );
      } catch {
        // El evento local solo sincroniza la presentación de la aplicación.
      }
    },
    [onBlockedChange, scheduleDirty],
  );

  const load = useCallback(
    async (silent = false) => {
      if (!session?.accessToken) {
        if (!silent) setLoading(false);
        return;
      }

      if (!silent) setLoading(true);

      try {
        const data = await driverProfileService.getMyRestSchedule(
          session.accessToken,
        );
        publish(data);
        setError(null);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudo cargar el horario de servicios.",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [publish, session?.accessToken],
  );

  useEffect(() => {
    void load();

    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
      if (document.visibilityState === "visible") void load(true);
    }, 30_000);

    return () => window.clearInterval(timerId);
  }, [load]);

  async function saveSchedule(): Promise<void> {
    if (!session?.accessToken || savingSchedule) return;

    setSavingSchedule(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await driverProfileService.updateMyRestSchedule(
        session.accessToken,
        serviceStartTime,
        serviceEndTime,
      );
      setScheduleDirty(false);
      publish(data, { forceSchedule: true });
      setSuccess(
        "Horario de servicios guardado. Solo organiza tu jornada y no cambia Disponible/No disponible.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el horario de servicios.",
      );
    } finally {
      setSavingSchedule(false);
    }
  }

  function startRest(): void {
    if (!session?.accessToken || performingAction) return;
    setConfirmationAction("rest");
  }

  async function confirmStartRest(): Promise<void> {
    if (!session?.accessToken || performingAction) return;

    setPerformingAction("rest");
    setError(null);
    setSuccess(null);

    try {
      const data = await driverProfileService.startMyRest(
        session.accessToken,
      );
      publish(data);
      setSuccess(
        "Descanso iniciado. Debes completar las 12 horas continuas.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo comenzar el descanso.",
      );
    } finally {
      setPerformingAction(null);
    }
  }

  function continueWorking(): void {
    if (!session?.accessToken || performingAction) return;
    setConfirmationAction("work");
  }

  async function confirmContinueWorking(): Promise<void> {
    if (!session?.accessToken || performingAction) return;

    setPerformingAction("work");
    setError(null);
    setSuccess(null);

    try {
      const data = await driverProfileService.continueWorking(
        session.accessToken,
      );
      publish(data);
      setSuccess(
        "Elegiste Trabajar. Tomar descanso quedó deshabilitado para este ciclo.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo confirmar que continuarás trabajando.",
      );
    } finally {
      setPerformingAction(null);
    }
  }

  const state = compliance?.state ?? null;
  const schedule = compliance?.latestSchedule ?? compliance?.effectiveSchedule;
  const blocked = Boolean(state?.blockedForNewOffers);
  const activeRest = state?.status === "active";
  const restDisabledForCycle =
    state?.status === "working" || state?.status === "completed";
  const remaining = useMemo(
    () => formatRemaining(state?.activePeriod?.requiredEndAt, nowMs),
    [nowMs, state?.activePeriod?.requiredEndAt],
  );

  const scheduleValid =
    TIME_PATTERN.test(serviceStartTime) &&
    TIME_PATTERN.test(serviceEndTime);
  const actionBusy = performingAction !== null;

  const panelStyle: CSSProperties = {
    borderRadius: 18,
    padding: 14,
    border: blocked
      ? "1px solid var(--rp-info-bd)"
      : "1px solid var(--rp-border-c)",
    background: "var(--rp-surface-soft)",
  };

  return (
    <section
      aria-label="Horario de servicios y descanso continuo"
      style={{
        margin: "12px 0",
        padding: 16,
        borderRadius: 22,
        border: blocked
          ? "var(--rp-border-w) solid var(--rp-info-bd)"
          : "var(--rp-border-w) solid var(--rp-border-c)",
        background: "var(--rp-surface)",
        color: "var(--rp-text)",
        boxShadow: "var(--rp-shadow)",
      }}
    >
      {loading ? (
        <div style={{ padding: "18px 0", textAlign: "center" }}>
          <IonSpinner name="dots" />
        </div>
      ) : (
        <>
          <div style={panelStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  display: "grid",
                  placeItems: "center",
                  background: "var(--rp-icon-bg)",
                  flex: "0 0 auto",
                }}
              >
                <IonIcon
                  icon={briefcaseOutline}
                  style={{ fontSize: 22, color: "var(--rp-icon-fg)" }}
                />
              </div>

              <div>
                <div
                  style={{
                    fontSize: ".68rem",
                    fontWeight: 950,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    opacity: 0.72,
                  }}
                >
                  Planificación personal
                </div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 950,
                    marginTop: 2,
                  }}
                >
                  Horario de servicios
                </div>
              </div>
            </div>

            <p
              style={{
                margin: "10px 0 12px",
                fontSize: ".78rem",
                lineHeight: 1.45,
                fontWeight: 760,
              }}
            >
              Configura el inicio y término de tu jornada. Este horario solo
              genera un aviso y nunca cambia automáticamente tu disponibilidad.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
                gap: 9,
              }}
            >
              <label style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: ".7rem",
                    fontWeight: 950,
                    marginBottom: 5,
                  }}
                >
                  Inicio
                </span>
                <div style={{ position: "relative" }}>
                  <IonIcon
                    icon={timeOutline}
                    style={{
                      position: "absolute",
                      left: 11,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "var(--rp-accent)",
                    }}
                  />
                  <input
                    type="time"
                    value={serviceStartTime}
                    onChange={(event) => {
                      setServiceStartTime(event.target.value);
                      setScheduleDirty(true);
                      setSuccess(null);
                    }}
                    disabled={savingSchedule}
                    style={{
                      width: "100%",
                      minHeight: 46,
                      boxSizing: "border-box",
                      borderRadius: 14,
                      border: "1px solid var(--rp-border-c)",
                      background: "var(--rp-field-bg)",
                      color: "var(--rp-field-fg)",
                      padding: "10px 8px 10px 36px",
                      fontSize: ".9rem",
                      fontWeight: 900,
                    }}
                  />
                </div>
              </label>

              <label style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: ".7rem",
                    fontWeight: 950,
                    marginBottom: 5,
                  }}
                >
                  Término
                </span>
                <div style={{ position: "relative" }}>
                  <IonIcon
                    icon={timeOutline}
                    style={{
                      position: "absolute",
                      left: 11,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "var(--rp-accent)",
                    }}
                  />
                  <input
                    type="time"
                    value={serviceEndTime}
                    onChange={(event) => {
                      setServiceEndTime(event.target.value);
                      setScheduleDirty(true);
                      setSuccess(null);
                    }}
                    disabled={savingSchedule}
                    style={{
                      width: "100%",
                      minHeight: 46,
                      boxSizing: "border-box",
                      borderRadius: 14,
                      border: "1px solid var(--rp-border-c)",
                      background: "var(--rp-field-bg)",
                      color: "var(--rp-field-fg)",
                      padding: "10px 8px 10px 36px",
                      fontSize: ".9rem",
                      fontWeight: 900,
                    }}
                  />
                </div>
              </label>
            </div>

            <IonButton
              expand="block"
              onClick={() => void saveSchedule()}
              disabled={savingSchedule || !scheduleValid}
              style={
                {
                  "--border-radius": "14px",
                  "--background": "var(--rp-btn-primary)",
                  "--color": "var(--rp-btn-primary-fg)",
                  minHeight: 46,
                  fontWeight: 950,
                  margin: "10px 0 0",
                } as CSSProperties
              }
            >
              {savingSchedule ? (
                <IonSpinner name="dots" />
              ) : (
                <>
                  <IonIcon icon={saveOutline} slot="start" />
                  Guardar horario
                </>
              )}
            </IonButton>

            <div
              style={{
                marginTop: 8,
                fontSize: ".69rem",
                lineHeight: 1.4,
                fontWeight: 780,
                opacity: 0.76,
              }}
            >
              Zona horaria: Rapa Nui
              {schedule?.effectiveFrom
                ? ` · Vigente desde ${schedule.effectiveFrom}`
                : ""}
            </div>
          </div>

          <div style={{ ...panelStyle, marginTop: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    background: "var(--rp-icon-bg)",
                    flex: "0 0 auto",
                  }}
                >
                  <IonIcon
                    icon={moonOutline}
                    style={{ fontSize: 22, color: "var(--rp-icon-fg)" }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: ".68rem",
                      fontWeight: 950,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      opacity: 0.72,
                    }}
                  >
                    Decisión manual
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 950,
                      marginTop: 2,
                    }}
                  >
                    Descanso continuo
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "6px 9px",
                  borderRadius: 999,
                  background: blocked
                    ? "var(--rp-info-bg)"
                    : state?.status === "reminder_due"
                      ? "var(--rp-warn-bg)"
                      : "var(--rp-ok-bg)",
                  border: blocked
                    ? "1px solid var(--rp-info-bd)"
                    : state?.status === "reminder_due"
                      ? "1px solid var(--rp-warn-bd)"
                      : "1px solid var(--rp-ok-bd)",
                  color: blocked
                    ? "var(--rp-info-fg)"
                    : state?.status === "reminder_due"
                      ? "var(--rp-warn-fg)"
                      : "var(--rp-ok-fg)",
                  fontSize: ".68rem",
                  fontWeight: 950,
                  whiteSpace: "nowrap",
                }}
              >
                {statusLabel(state)}
              </div>
            </div>

            <p
              style={{
                margin: "11px 0",
                fontSize: ".8rem",
                lineHeight: 1.45,
                fontWeight: 780,
              }}
            >
              {state?.message ??
                "Todavía no has comenzado tu descanso."}
            </p>

            {activeRest && state?.activePeriod && (
              <div
                style={{
                  marginBottom: 11,
                  padding: "10px 11px",
                  borderRadius: 14,
                  background: "var(--rp-surface-soft)",
                  border: "1px solid var(--rp-border-c)",
                  fontSize: ".75rem",
                  fontWeight: 850,
                  lineHeight: 1.45,
                }}
              >
                Inicio:{" "}
                {formatDateTime(state.activePeriod.actualStartAt)}
                <br />
                Término:{" "}
                {formatDateTime(state.activePeriod.requiredEndAt)}
                {remaining ? ` · Restan ${remaining}` : ""}
              </div>
            )}

            {state?.nextScheduledStartAt && !activeRest && (
              <div
                style={{
                  marginBottom: 11,
                  fontSize: ".72rem",
                  fontWeight: 820,
                  opacity: 0.78,
                }}
              >
                Próximo aviso:{" "}
                {formatDateTime(state.nextScheduledStartAt)}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
                gap: 9,
              }}
            >
              <IonButton
                expand="block"
                onClick={startRest}
                disabled={
                  actionBusy ||
                  activeRest ||
                  restDisabledForCycle ||
                  state?.canStartRest === false
                }
                style={
                  {
                    "--border-radius": "14px",
                    "--background": "var(--rp-btn-primary)",
                    "--color": "var(--rp-btn-primary-fg)",
                    minHeight: 48,
                    fontWeight: 950,
                    margin: 0,
                  } as CSSProperties
                }
              >
                {performingAction === "rest" ? (
                  <IonSpinner name="dots" />
                ) : restDisabledForCycle ? (
                  "Descanso deshabilitado"
                ) : activeRest ? (
                  "Descansando"
                ) : (
                  "Tomar descanso"
                )}
              </IonButton>

              <IonButton
                expand="block"
                onClick={continueWorking}
                disabled={
                  actionBusy ||
                  activeRest ||
                  state?.canContinueWorking === false ||
                  state?.status === "working"
                }
                style={
                  {
                    "--border-radius": "14px",
                    "--background": "var(--rp-icon-bg)",
                    "--color": "var(--rp-text)",
                    minHeight: 48,
                    fontWeight: 950,
                    margin: 0,
                  } as CSSProperties
                }
              >
                {performingAction === "work" ? (
                  <IonSpinner name="dots" />
                ) : state?.status === "working" ? (
                  "Trabajando"
                ) : (
                  "Trabajar"
                )}
              </IonButton>
            </div>

            {state?.hasActiveRide && (
              <div
                style={{
                  marginTop: 9,
                  fontSize: ".72rem",
                  lineHeight: 1.4,
                  fontWeight: 850,
                  color: "var(--rp-warn-fg)",
                }}
              >
                Tienes un viaje activo. La aplicación no lo interrumpirá;
                podrás tomar el descanso cuando finalice.
              </div>
            )}
          </div>

          <IonAlert
            isOpen={confirmationAction !== null}
            onDidDismiss={() => setConfirmationAction(null)}
            backdropDismiss={!actionBusy}
            keyboardClose
            cssClass="rapago-driver-rest-confirm-alert"
            header={
              confirmationAction === "rest"
                ? "Iniciar descanso"
                : "Continuar trabajando"
            }
            message={
              confirmationAction === "rest"
                ? "Comenzarás ahora un descanso continuo de 12 horas. Quedarás No disponible y no podrás volver a Trabajar hasta completar el período."
                : "Se descartará el descanso de este ciclo y podrás administrar normalmente tu estado Disponible o No disponible."
            }
            buttons={[
              {
                text: "Cancelar",
                role: "cancel",
              },
              {
                text:
                  confirmationAction === "rest"
                    ? "Iniciar descanso"
                    : "Continuar trabajando",
                role: "confirm",
                handler: () => {
                  const action = confirmationAction;
                  setConfirmationAction(null);

                  if (action === "rest") {
                    void confirmStartRest();
                  } else if (action === "work") {
                    void confirmContinueWorking();
                  }
                },
              },
            ]}
          />

          {error && (
            <div
              role="alert"
              style={{
                marginTop: 10,
                padding: "9px 10px",
                borderRadius: 12,
                background: "var(--rp-err-bg)",
                border: "1px solid var(--rp-err-bd)",
                color: "var(--rp-err-fg)",
                fontSize: ".74rem",
                fontWeight: 850,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              style={{
                marginTop: 10,
                padding: "9px 10px",
                borderRadius: 12,
                background: "var(--rp-ok-bg)",
                border: "1px solid var(--rp-ok-bd)",
                color: "var(--rp-ok-fg)",
                fontSize: ".74rem",
                fontWeight: 850,
              }}
            >
              {success}
            </div>
          )}
        </>
      )}
    </section>
  );
}

