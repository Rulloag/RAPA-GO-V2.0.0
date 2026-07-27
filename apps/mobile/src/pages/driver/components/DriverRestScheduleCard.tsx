import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { moonOutline, saveOutline, timeOutline } from "ionicons/icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../features/auth";
import {
  driverProfileService,
  type DriverRestComplianceData,
} from "../../../features/drivers/driverProfile.service";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatRemaining(value: string | null | undefined, nowMs: number): string {
  if (!value) return "";
  const endMs = new Date(value).getTime();
  if (!Number.isFinite(endMs)) return "";
  const remaining = Math.max(0, endMs - nowMs);
  const totalMinutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

export function DriverRestScheduleCard({
  onBlockedChange,
}: {
  onBlockedChange?: (blocked: boolean) => void;
}): JSX.Element {
  const { session } = useAuth();
  const [compliance, setCompliance] =
    useState<DriverRestComplianceData | null>(null);
  const [startTime, setStartTime] = useState("22:00");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const publish = useCallback(
    (data: DriverRestComplianceData) => {
      setCompliance(data);
      const schedule = data.latestSchedule ?? data.effectiveSchedule;
      if (schedule?.startTime) setStartTime(schedule.startTime);
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
        // El evento local solo mejora la presentación de la app.
      }
    },
    [onBlockedChange],
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
            : "No se pudo cargar el horario de descanso.",
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
      void load(true);
    }, 60_000);
    return () => window.clearInterval(timerId);
  }, [load]);

  async function save(): Promise<void> {
    if (!session?.accessToken || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await driverProfileService.updateMyRestSchedule(
        session.accessToken,
        startTime,
      );
      publish(data);
      const effectiveFrom = data.latestSchedule?.effectiveFrom;
      setSuccess(
        effectiveFrom
          ? `Horario guardado. Comienza a regir el ${effectiveFrom}.`
          : "Horario guardado correctamente.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el horario de descanso.",
      );
    } finally {
      setSaving(false);
    }
  }

  const state = compliance?.state ?? null;
  const schedule = compliance?.latestSchedule ?? compliance?.effectiveSchedule;
  const blocked = Boolean(state?.blockedForNewOffers);
  const remaining = useMemo(
    () => formatRemaining(state?.activePeriod?.requiredEndAt, nowMs),
    [nowMs, state?.activePeriod?.requiredEndAt],
  );

  return (
    <section
      aria-label="Horario diario de desconexión"
      /* Antes la tarjeta cambiaba de piel según `blocked`: índigo oscuro con
         texto blanco cuando el descanso estaba activo, crema con texto casi
         negro cuando no. Eran dos estéticas distintas y ninguna respondía al
         tema. Ahora es una .rp-card del kit y el estado se comunica en la
         píldora y en los avisos, que es donde corresponde. */
      className={`rp-card rapago-driver-rest${blocked ? " rp-card--accent" : ""}`}
    >
      <div className="rp-card__row">
        <div className="rapago-driver-rest__head">
          <div className="rapago-driver-rest__icon" aria-hidden="true">
            <IonIcon icon={moonOutline} />
          </div>
          <div className="rapago-driver-rest__heading">
            <div className="rapago-driver-rest__eyebrow">
              Desconexión verificable
            </div>
            <div className="rapago-driver-rest__title">
              Descanso continuo de 12 horas
            </div>
          </div>
        </div>

        <div
          className={`rapago-driver-rest__pill${
            blocked ? " is-blocked" : " is-scheduled"
          }`}
        >
          {blocked ? "Descanso activo" : "Programado"}
        </div>
      </div>

      {loading ? (
        <div className="rapago-driver-rest__loading">
          <IonSpinner name="dots" />
        </div>
      ) : (
        <>
          <p className="rapago-driver-rest__copy">
            {state?.message ??
              "Elige una hora diaria. Durante esa franja el backend no enviará nuevas ofertas."}
          </p>

          {blocked && state?.activePeriod && (
            <div className="rp-card__quote">
              {state.status === "pending_trip_completion" ? (
                <>
                  El viaje actual puede finalizar. Al cerrarlo comenzarán las
                  doce horas completas.
                </>
              ) : (
                <>
                  Fin exigido: {formatDateTime(state.activePeriod.requiredEndAt)}
                  {remaining ? ` · Restan ${remaining}` : ""}
                </>
              )}
            </div>
          )}

          <label className="rapago-driver-rest__label">
            Hora diaria de inicio
          </label>

          <div className="rapago-driver-rest__row">
            <div className="rapago-driver-rest__field">
              <IonIcon
                icon={timeOutline}
                className="rapago-driver-rest__field-icon"
              />
              <input
                type="time"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  setSuccess(null);
                }}
                disabled={saving}
                className="rapago-driver-rest__input"
              />
            </div>

            <IonButton
              onClick={() => void save()}
              disabled={saving || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)}
              className="rp-cta rapago-driver-rest__save"
            >
              {saving ? <IonSpinner name="dots" /> : <IonIcon icon={saveOutline} />}
            </IonButton>
          </div>

          <div className="rp-card__foot">
            Zona horaria: Rapa Nui · Duración fija: 12 horas. Los cambios de una
            franja vigente comienzan el día siguiente.
            {schedule?.effectiveFrom
              ? ` Vigente desde: ${schedule.effectiveFrom}.`
              : ""}
          </div>

          {error && (
            <div role="alert" className="rp-banner rp-banner--error rapago-driver-rest__alert">
              {error}
            </div>
          )}

          {success && (
            <div role="status" className="rp-banner rp-banner--success rapago-driver-rest__alert">
              {success}
            </div>
          )}
        </>
      )}
    </section>
  );
}
