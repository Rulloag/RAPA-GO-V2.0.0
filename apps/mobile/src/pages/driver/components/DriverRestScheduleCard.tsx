import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { moonOutline, saveOutline, timeOutline } from "ionicons/icons";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

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
      style={{
        margin: "12px 0",
        padding: 16,
        borderRadius: 22,
        border: blocked
          ? "1px solid rgba(99,102,241,.46)"
          : "1px solid rgba(200,155,60,.38)",
        background: blocked
          ? "linear-gradient(145deg,#111827,#312e81)"
          : "linear-gradient(145deg,#fffaf0,#fff3cf)",
        color: blocked ? "#fff" : "#111827",
        boxShadow: blocked
          ? "0 18px 38px rgba(49,46,129,.28)"
          : "0 14px 32px rgba(112,78,16,.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: blocked
                ? "rgba(255,255,255,.12)"
                : "rgba(200,155,60,.16)",
              flex: "0 0 auto",
            }}
          >
            <IonIcon icon={moonOutline} style={{ fontSize: 22 }} />
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
              Desconexión verificable
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 950, marginTop: 2 }}>
              Descanso continuo de 12 horas
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "6px 9px",
            borderRadius: 999,
            background: blocked
              ? "rgba(129,140,248,.22)"
              : "rgba(34,197,94,.14)",
            border: blocked
              ? "1px solid rgba(165,180,252,.34)"
              : "1px solid rgba(34,197,94,.28)",
            fontSize: ".7rem",
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          {blocked ? "Descanso activo" : "Programado"}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "18px 0 4px", textAlign: "center" }}>
          <IonSpinner name="dots" />
        </div>
      ) : (
        <>
          <p
            style={{
              margin: "12px 0",
              fontSize: ".8rem",
              lineHeight: 1.45,
              fontWeight: 760,
              opacity: 0.9,
            }}
          >
            {state?.message ??
              "Elige una hora diaria. Durante esa franja el backend no enviará nuevas ofertas."}
          </p>

          {blocked && state?.activePeriod && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 11px",
                borderRadius: 14,
                background: "rgba(255,255,255,.10)",
                border: "1px solid rgba(255,255,255,.14)",
                fontSize: ".76rem",
                fontWeight: 850,
                lineHeight: 1.45,
              }}
            >
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

          <label
            style={{
              display: "block",
              fontSize: ".74rem",
              fontWeight: 950,
              marginBottom: 6,
            }}
          >
            Hora diaria de inicio
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gap: 9,
              alignItems: "center",
            }}
          >
            <div style={{ position: "relative" }}>
              <IonIcon
                icon={timeOutline}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "#8a6418",
                }}
              />
              <input
                type="time"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  setSuccess(null);
                }}
                disabled={saving}
                style={{
                  width: "100%",
                  minHeight: 46,
                  boxSizing: "border-box",
                  borderRadius: 14,
                  border: "1px solid rgba(200,155,60,.40)",
                  background: "#fff",
                  color: "#111827",
                  padding: "10px 12px 10px 38px",
                  fontSize: ".95rem",
                  fontWeight: 900,
                }}
              />
            </div>

            <IonButton
              onClick={() => void save()}
              disabled={saving || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)}
              style={
                {
                  "--border-radius": "14px",
                  "--background": blocked ? "#818cf8" : "#111827",
                  "--color": "#ffffff",
                  minHeight: 46,
                  fontWeight: 950,
                  margin: 0,
                } as CSSProperties
              }
            >
              {saving ? <IonSpinner name="dots" /> : <IonIcon icon={saveOutline} />}
            </IonButton>
          </div>

          <div
            style={{
              marginTop: 9,
              fontSize: ".7rem",
              lineHeight: 1.4,
              fontWeight: 780,
              opacity: 0.78,
            }}
          >
            Zona horaria: Rapa Nui · Duración fija: 12 horas. Los cambios de una
            franja vigente comienzan el día siguiente.
            {schedule?.effectiveFrom
              ? ` Vigente desde: ${schedule.effectiveFrom}.`
              : ""}
          </div>

          {error && (
            <div
              role="alert"
              style={{
                marginTop: 10,
                padding: "9px 10px",
                borderRadius: 12,
                background: "rgba(239,68,68,.13)",
                border: "1px solid rgba(239,68,68,.26)",
                color: blocked ? "#fecaca" : "#991b1b",
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
                background: "rgba(34,197,94,.13)",
                border: "1px solid rgba(34,197,94,.26)",
                color: blocked ? "#bbf7d0" : "#166534",
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
