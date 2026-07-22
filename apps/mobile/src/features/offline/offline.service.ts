import { apiClient } from "../../services/api/index.js";

export type OfflineBookingStatus =
  | "pending_sync"
  | "synced"
  | "cancelled"
  | "failed";

export type RapaGoConnectivityStatus =
  | "online"
  | "offline"
  | "poor"
  | "checking";

export interface OfflineBooking {
  id: string;
  adminId: string | null;
  passengerName: string;
  passengerPhone: string;
  originText: string;
  destinationText: string;
  assignedDriverId: string | null;
  status: OfflineBookingStatus;
  notes: string | null;
  createdAt: string;
  updatedAt?: string | null;
  syncedToRideId: string | null;
  source?: "server" | "local";
  localOnly?: boolean;
  lastSyncError?: string | null;
}

export interface CreateOfflineBookingInput {
  passengerName: string;
  passengerPhone: string;
  originText: string;
  destinationText: string;
  assignedDriverId?: string | null;
  notes?: string | null;
}

type BookingEnvelope = {
  ok: true;
  data: OfflineBooking;
  statusCode: number;
};

type BookingsEnvelope = {
  ok: true;
  data: OfflineBooking[];
  statusCode: number;
};

type ApiErrorLike = {
  ok?: false;
  message?: string;
  error?: string;
  statusCode?: number;
};

export interface OfflineSyncSummary {
  synced: number;
  failed: number;
  remaining: number;
  bookings: OfflineBooking[];
}

const OFFLINE_BOOKINGS_PATH = "/api/admin/offline-bookings";
const CONNECTIVITY_CHECK_PATH = "/api/connectivity-check";

const LOCAL_OFFLINE_BOOKINGS_KEY = "rapago_offline_bookings_queue_v1";
const LOCAL_CONNECTIVITY_STATUS_KEY = "rapago_connection_status_v1";
const LOCAL_CONNECTIVITY_EVENT = "rapago:connection-status-changed";

function cleanText(value: unknown, maxLength = 120): string {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanPhone(value: unknown): string {
  return String(value ?? "")
    .replace(/[^\d+\s()-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const data = error as ApiErrorLike;

    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }

    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }

    if (typeof data.statusCode === "number") {
      return `${fallback} Código ${data.statusCode}.`;
    }
  }

  return fallback;
}

function assertApiOk<T>(
  result: { ok: boolean; data?: T; message?: string; error?: string; statusCode?: number },
  fallback: string,
): T {
  if (!result.ok) {
    throw new Error(getErrorMessage(result, fallback));
  }

  return result.data as T;
}

function isNetworkError(error: unknown): boolean {
  const text = getErrorMessage(error, "").toLowerCase();

  return (
    !navigator.onLine ||
    text.includes("failed to fetch") ||
    text.includes("network") ||
    text.includes("load failed") ||
    text.includes("timeout") ||
    text.includes("aborted") ||
    text.includes("internet") ||
    text.includes("connection")
  );
}

function getProductionApiProbeUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = String(env.VITE_API_BASE_URL || env.VITE_API_URL || "/api").trim();

  if (!raw || raw === "/") return "/api/health";

  if (/^https?:\/\//i.test(raw)) {
    const base = raw.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
    return `${base}/api/health`;
  }

  const clean = raw.replace(/\/+$/, "");
  return clean.endsWith("/api") ? `${clean}/health` : `${clean}/api/health`;
}

function createLocalOfflineBooking(input: CreateOfflineBookingInput): OfflineBooking {
  const now = new Date().toISOString();

  return {
    id: `local-offline-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    adminId: null,
    passengerName: cleanText(input.passengerName, 80),
    passengerPhone: cleanPhone(input.passengerPhone),
    originText: cleanText(input.originText, 160),
    destinationText: cleanText(input.destinationText, 160),
    assignedDriverId: input.assignedDriverId ? cleanText(input.assignedDriverId, 80) : null,
    status: "pending_sync",
    notes: input.notes ? cleanText(input.notes, 500) : null,
    createdAt: now,
    updatedAt: now,
    syncedToRideId: null,
    source: "local",
    localOnly: true,
    lastSyncError: null,
  };
}

function normalizeBooking(value: OfflineBooking): OfflineBooking {
  return {
    ...value,
    assignedDriverId: value.assignedDriverId ?? null,
    adminId: value.adminId ?? null,
    notes: value.notes ?? null,
    syncedToRideId: value.syncedToRideId ?? null,
    source: value.source ?? "server",
    localOnly: value.localOnly ?? false,
    lastSyncError: value.lastSyncError ?? null,
  };
}

function readLocalOfflineBookings(): OfflineBooking[] {
  try {
    const raw = localStorage.getItem(LOCAL_OFFLINE_BOOKINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as OfflineBooking[]) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeBooking)
      .filter((booking) => booking.status !== "synced")
      .slice(0, 150);
  } catch {
    return [];
  }
}

function saveLocalOfflineBookings(bookings: OfflineBooking[]): void {
  try {
    const byId = new Map<string, OfflineBooking>();

    for (const booking of bookings) {
      byId.set(booking.id, normalizeBooking(booking));
    }

    const next = Array.from(byId.values()).slice(0, 150);

    localStorage.setItem(LOCAL_OFFLINE_BOOKINGS_KEY, JSON.stringify(next));

    window.dispatchEvent(
      new CustomEvent("rapago:offline-bookings-updated", {
        detail: {
          count: next.length,
          bookings: next,
        },
      }),
    );
  } catch {
    // No bloquea el flujo offline.
  }
}

function queueLocalOfflineBooking(input: CreateOfflineBookingInput): OfflineBooking {
  const booking = createLocalOfflineBooking(input);
  saveLocalOfflineBookings([booking, ...readLocalOfflineBookings()]);
  return booking;
}

function updateLocalOfflineBooking(
  bookingId: string,
  patch: Partial<OfflineBooking>,
): OfflineBooking | null {
  const current = readLocalOfflineBookings();
  let updated: OfflineBooking | null = null;

  const next = current.map((booking) => {
    if (booking.id !== bookingId) return booking;

    updated = normalizeBooking({
      ...booking,
      ...patch,
      updatedAt: new Date().toISOString(),
    });

    return updated;
  });

  saveLocalOfflineBookings(next);
  return updated;
}

function removeLocalOfflineBooking(bookingId: string): void {
  saveLocalOfflineBookings(
    readLocalOfflineBookings().filter((booking) => booking.id !== bookingId),
  );
}

function isBadConnectionByBrowserInfo(): boolean {
  try {
    const nav = navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
      };
    };

    const effectiveType = String(nav.connection?.effectiveType ?? "")
      .toLowerCase()
      .trim();

    const downlink = Number(nav.connection?.downlink ?? NaN);
    const rtt = Number(nav.connection?.rtt ?? NaN);

    return (
      effectiveType === "slow-2g" ||
      effectiveType === "2g" ||
      (Number.isFinite(downlink) && downlink > 0 && downlink < 0.45) ||
      (Number.isFinite(rtt) && rtt > 1800)
    );
  } catch {
    return false;
  }
}

async function checkConnectivityStatus(): Promise<RapaGoConnectivityStatus> {
  try {
    if (navigator.onLine === false) return "offline";

    const browserPoor = isBadConnectionByBrowserInfo();

    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // No bloquea.
      }
    }, browserPoor ? 4500 : 7000);

    try {
      await fetch(getProductionApiProbeUrl(), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }

    return browserPoor ? "poor" : "online";
  } catch {
    if (navigator.onLine === false) return "offline";
    return "poor";
  }
}

function publishConnectivityStatus(status: RapaGoConnectivityStatus): void {
  try {
    localStorage.setItem(LOCAL_CONNECTIVITY_STATUS_KEY, status);
  } catch {
    // No bloquea.
  }

  window.dispatchEvent(
    new CustomEvent(LOCAL_CONNECTIVITY_EVENT, {
      detail: {
        status,
        blocked: status === "offline" || status === "poor",
      },
    }),
  );
}

export const offlineService = {
  async createOfflineBooking(
    accessToken: string,
    input: CreateOfflineBookingInput,
  ): Promise<OfflineBooking> {
    const cleanInput: CreateOfflineBookingInput = {
      passengerName: cleanText(input.passengerName, 80),
      passengerPhone: cleanPhone(input.passengerPhone),
      originText: cleanText(input.originText, 160),
      destinationText: cleanText(input.destinationText, 160),
      assignedDriverId: input.assignedDriverId
        ? cleanText(input.assignedDriverId, 80)
        : null,
      notes: input.notes ? cleanText(input.notes, 500) : null,
    };

    if (!cleanInput.passengerName) {
      throw new Error("Debes indicar el nombre del pasajero.");
    }

    if (!cleanInput.passengerPhone) {
      throw new Error("Debes indicar el teléfono del pasajero.");
    }

    if (!cleanInput.originText || !cleanInput.destinationText) {
      throw new Error("Debes indicar origen y destino.");
    }

    try {
      const result = await apiClient.post<BookingEnvelope>(
        OFFLINE_BOOKINGS_PATH,
        cleanInput,
        { token: accessToken },
      );

      const envelope = assertApiOk<BookingEnvelope>(
        result,
        "No se pudo crear la reserva offline.",
      );

      return normalizeBooking(envelope.data);
    } catch (error) {
      if (isNetworkError(error)) {
        return queueLocalOfflineBooking(cleanInput);
      }

      throw error;
    }
  },

  async listOfflineBookings(
    accessToken: string,
    status?: OfflineBookingStatus | string,
  ): Promise<OfflineBooking[]> {
    const localBookings = readLocalOfflineBookings();

    try {
      const cleanStatus = cleanText(status, 40);
      const url = cleanStatus
        ? `${OFFLINE_BOOKINGS_PATH}?status=${encodeURIComponent(cleanStatus)}`
        : OFFLINE_BOOKINGS_PATH;

      const result = await apiClient.get<BookingsEnvelope>(
        url,
        { token: accessToken },
      );

      const envelope = assertApiOk<BookingsEnvelope>(
        result,
        "No se pudieron cargar las reservas offline.",
      );

      const serverBookings = envelope.data.map(normalizeBooking);

      const byId = new Map<string, OfflineBooking>();

      for (const booking of localBookings) {
        if (!status || booking.status === status) {
          byId.set(booking.id, booking);
        }
      }

      for (const booking of serverBookings) {
        byId.set(booking.id, booking);
      }

      return Array.from(byId.values()).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } catch (error) {
      if (isNetworkError(error)) {
        return localBookings.filter((booking) => !status || booking.status === status);
      }

      throw error;
    }
  },

  async syncOfflineBooking(
    accessToken: string,
    id: string,
    rideRequestId: string,
  ): Promise<OfflineBooking> {
    const cleanId = cleanText(id, 120);
    const cleanRideRequestId = cleanText(rideRequestId, 120);

    if (!cleanId || !cleanRideRequestId) {
      throw new Error("Falta el ID de la reserva o del viaje.");
    }

    if (cleanId.startsWith("local-offline-")) {
      const local = updateLocalOfflineBooking(cleanId, {
        status: "synced",
        syncedToRideId: cleanRideRequestId,
        localOnly: true,
        lastSyncError: null,
      });

      if (!local) {
        throw new Error("No se encontró la reserva local offline.");
      }

      removeLocalOfflineBooking(cleanId);
      return local;
    }

    const result = await apiClient.patch<BookingEnvelope>(
      `${OFFLINE_BOOKINGS_PATH}/${encodeURIComponent(cleanId)}/sync`,
      { rideRequestId: cleanRideRequestId },
      { token: accessToken },
    );

    const envelope = assertApiOk<BookingEnvelope>(
      result,
      "No se pudo sincronizar la reserva offline.",
    );

    return normalizeBooking(envelope.data);
  },

  async cancelOfflineBooking(
    accessToken: string,
    id: string,
  ): Promise<OfflineBooking> {
    const cleanId = cleanText(id, 120);

    if (!cleanId) {
      throw new Error("Falta el ID de la reserva offline.");
    }

    if (cleanId.startsWith("local-offline-")) {
      const local = updateLocalOfflineBooking(cleanId, {
        status: "cancelled",
        lastSyncError: null,
      });

      if (!local) {
        throw new Error("No se encontró la reserva local offline.");
      }

      return local;
    }

    try {
      const result = await apiClient.patch<BookingEnvelope>(
        `${OFFLINE_BOOKINGS_PATH}/${encodeURIComponent(cleanId)}/cancel`,
        {},
        { token: accessToken },
      );

      const envelope = assertApiOk<BookingEnvelope>(
        result,
        "No se pudo cancelar la reserva offline.",
      );

      return normalizeBooking(envelope.data);
    } catch (error) {
      if (isNetworkError(error)) {
        const local = updateLocalOfflineBooking(cleanId, {
          status: "cancelled",
          lastSyncError: "Cancelación pendiente por falta de conexión.",
        });

        if (local) return local;
      }

      throw error;
    }
  },

  async flushLocalOfflineBookings(accessToken: string): Promise<OfflineSyncSummary> {
    const localBookings = readLocalOfflineBookings().filter(
      (booking) => booking.status === "pending_sync" || booking.status === "failed",
    );

    let synced = 0;
    let failed = 0;
    const remaining: OfflineBooking[] = [];

    for (const booking of localBookings) {
      try {
        const result = await apiClient.post<BookingEnvelope>(
          OFFLINE_BOOKINGS_PATH,
          {
            passengerName: booking.passengerName,
            passengerPhone: booking.passengerPhone,
            originText: booking.originText,
            destinationText: booking.destinationText,
            assignedDriverId: booking.assignedDriverId,
            notes: booking.notes,
          },
          { token: accessToken },
        );

        const envelope = assertApiOk<BookingEnvelope>(
          result,
          "No se pudo sincronizar una reserva local.",
        );

        synced += 1;

        window.dispatchEvent(
          new CustomEvent("rapago:offline-booking-synced", {
            detail: {
              localId: booking.id,
              serverBooking: envelope.data,
            },
          }),
        );
      } catch (error) {
        failed += 1;

        remaining.push({
          ...booking,
          status: "failed",
          updatedAt: new Date().toISOString(),
          lastSyncError: getErrorMessage(
            error,
            "No se pudo sincronizar. Se reintentará cuando vuelva internet.",
          ),
        });
      }
    }

    saveLocalOfflineBookings(remaining);

    return {
      synced,
      failed,
      remaining: remaining.length,
      bookings: remaining,
    };
  },

  getLocalOfflineBookings(): OfflineBooking[] {
    return readLocalOfflineBookings();
  },

  clearLocalOfflineBookings(): void {
    saveLocalOfflineBookings([]);
  },

  async getConnectivityStatus(): Promise<RapaGoConnectivityStatus> {
    const status = await checkConnectivityStatus();
    publishConnectivityStatus(status);
    return status;
  },

  getLastConnectivityStatus(): RapaGoConnectivityStatus {
    try {
      const status = localStorage.getItem(LOCAL_CONNECTIVITY_STATUS_KEY);

      if (
        status === "online" ||
        status === "offline" ||
        status === "poor" ||
        status === "checking"
      ) {
        return status;
      }
    } catch {
      // No bloquea.
    }

    return "checking";
  },

  isConnectionBlocked(status?: RapaGoConnectivityStatus): boolean {
    const current = status ?? offlineService.getLastConnectivityStatus();
    return current === "offline" || current === "poor";
  },

  getConnectionMessage(
    role: "driver" | "passenger" | "admin" = "passenger",
    status?: RapaGoConnectivityStatus,
  ): string {
    const current = status ?? offlineService.getLastConnectivityStatus();

    if (current === "checking") return "Revisando conexión...";

    if (role === "driver") {
      if (current === "offline") {
        return "Sin internet: quedaste No disponible. Busca una zona con conexión para volver a recibir viajes reales.";
      }

      if (current === "poor") {
        return "Conexión baja: quedaste No disponible para evitar viajes fallidos. Busca una zona con mejor internet para volver a estar disponible.";
      }

      return "Conexión estable. Puedes recibir viajes.";
    }

    if (role === "admin") {
      if (current === "offline") {
        return "Modo sin conexión: las acciones se guardarán localmente y se podrán sincronizar al volver internet.";
      }

      if (current === "poor") {
        return "Modo conexión baja: algunas acciones pueden tardar. Se recomienda confirmar la sincronización.";
      }

      return "Conexión estable.";
    }

    if (current === "offline") {
      return "Sin internet: puedes revisar lo último cargado. Para solicitar, pagar o cancelar viajes necesitas conexión.";
    }

    if (current === "poor") {
      return "Modo conexión baja: algunas acciones pueden tardar. Para solicitar viajes usa una zona con mejor señal.";
    }

    return "Conexión estable.";
  },

  subscribeConnectivity(
    callback: (status: RapaGoConnectivityStatus) => void,
  ): () => void {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: RapaGoConnectivityStatus }>).detail;

      if (detail?.status) {
        callback(detail.status);
      }
    };

    window.addEventListener(LOCAL_CONNECTIVITY_EVENT, handler as EventListener);

    return () => {
      window.removeEventListener(LOCAL_CONNECTIVITY_EVENT, handler as EventListener);
    };
  },

  async logConnectivity(
    accessToken: string,
    hadConnectivity: boolean,
    locationZone?: string,
  ): Promise<void> {
    try {
      await apiClient.post(
        CONNECTIVITY_CHECK_PATH,
        {
          hadConnectivity,
          locationZone: locationZone ? cleanText(locationZone, 80) : undefined,
          checkedAt: new Date().toISOString(),
          lastStatus: offlineService.getLastConnectivityStatus(),
        },
        { token: accessToken },
      );
    } catch {
      // No bloquea la app. Este log es informativo.
    }
  },
};
