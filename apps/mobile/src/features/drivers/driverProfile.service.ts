import { apiClient } from "../../services/api/index.js";

export interface DriverProfileData {
  id:              string;
  userId:          string;
  phone:           string | null;
  vehicleBrand:    string | null;
  vehicleModel:    string | null;
  vehicleYear:     number | null;
  vehiclePlate:    string | null;
  vehicleColor:    string | null;
  /** Categoría registrada: standard | xl | extra_luggage */
  vehicleCategory?: string | null;
  licenseNumber:   string | null;
  licenseExpiry:   string | null;
  profilePhotoUrl: string | null;
  vehiclePhotoUrl: string | null;
  bio:             string | null;
  languages:       string[];
  createdAt:       string;
  updatedAt:       string;
}


export interface DriverRestScheduleData {
  id: string;
  driverUserId: string;
  /** Compatibilidad: corresponde a la hora de término del servicio. */
  startTime: string;
  serviceStartTime: string;
  serviceEndTime: string;
  serviceStartMinuteLocal: number;
  startMinuteLocal: number;
  durationMinutes: number;
  durationHours: number;
  timezone: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriverRestPeriodData {
  id: string;
  driverUserId: string;
  scheduleId: string;
  scheduledStartAt: string;
  actualStartAt: string | null;
  requiredEndAt: string | null;
  completedAt: string | null;
  status: string;
  decision: "rest" | "work" | null;
  decisionAt: string | null;
  delayedByRideId: string | null;
  durationMinutes: number;
  durationHours: number;
}

export type DriverRestStateStatus =
  | "not_configured"
  | "scheduled"
  | "reminder_due"
  | "working"
  | "active"
  | "completed";

export interface DriverRestComplianceData {
  effectiveSchedule: DriverRestScheduleData | null;
  latestSchedule: DriverRestScheduleData | null;
  state: {
    blockedForNewOffers: boolean;
    status: DriverRestStateStatus;
    message: string;
    activePeriod: DriverRestPeriodData | null;
    nextScheduledStartAt: string | null;
    reminderDue: boolean;
    workingSelected: boolean;
    canStartRest: boolean;
    canContinueWorking: boolean;
    hasActiveRide: boolean;
  };
}

export interface UpsertDriverProfilePayload {
  vehicleBrand?:    string;
  vehicleModel?:    string;
  vehicleYear?:     number;
  vehiclePlate?:    string;
  vehicleColor?:    string;
  profilePhotoUrl?: string;
  vehiclePhotoUrl?: string;
  bio?:             string;
  languages?:       string[];
}

type Envelope<T> = { ok: true; data: T; statusCode: number };

export const driverProfileService = {
  async getMyProfile(accessToken: string): Promise<DriverProfileData | null> {
    const result = await apiClient.get<Envelope<DriverProfileData | null>>("/drivers/me/profile", { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error loading driver profile.");
    return (result.data as Envelope<DriverProfileData | null>).data;
  },

  async upsertMyProfile(accessToken: string, payload: UpsertDriverProfilePayload): Promise<DriverProfileData> {
    const result = await apiClient.patch<Envelope<DriverProfileData>>("/drivers/me/profile", payload, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error saving driver profile.");
    return (result.data as Envelope<DriverProfileData>).data;
  },

  async getMyRestSchedule(accessToken: string): Promise<DriverRestComplianceData> {
    const result = await apiClient.get<Envelope<DriverRestComplianceData>>(
      "/drivers/me/rest-schedule",
      { token: accessToken },
    );
    if (!result.ok) {
      throw new Error(
        (result as { message?: string }).message ??
          "No se pudo cargar tu horario de servicios.",
      );
    }
    return (result.data as Envelope<DriverRestComplianceData>).data;
  },

  async updateMyRestSchedule(
    accessToken: string,
    serviceStartTime: string,
    serviceEndTime: string,
  ): Promise<DriverRestComplianceData> {
    const result = await apiClient.patch<Envelope<DriverRestComplianceData>>(
      "/drivers/me/rest-schedule",
      {
        serviceStartTime,
        serviceEndTime,
      },
      { token: accessToken },
    );
    if (!result.ok) {
      throw new Error(
        (result as { message?: string }).message ??
          "No se pudo guardar tu horario de servicios.",
      );
    }
    return (result.data as Envelope<DriverRestComplianceData>).data;
  },

  async startMyRest(accessToken: string): Promise<DriverRestComplianceData> {
    const result = await apiClient.post<Envelope<DriverRestComplianceData>>(
      "/drivers/me/rest/start",
      {},
      { token: accessToken },
    );
    if (!result.ok) {
      throw new Error(
        (result as { message?: string }).message ??
          "No se pudo comenzar el descanso.",
      );
    }
    return (result.data as Envelope<DriverRestComplianceData>).data;
  },

  async continueWorking(accessToken: string): Promise<DriverRestComplianceData> {
    const result = await apiClient.post<Envelope<DriverRestComplianceData>>(
      "/drivers/me/rest/work",
      {},
      { token: accessToken },
    );
    if (!result.ok) {
      throw new Error(
        (result as { message?: string }).message ??
          "No se pudo confirmar que continuarás trabajando.",
      );
    }
    return (result.data as Envelope<DriverRestComplianceData>).data;
  },
};
