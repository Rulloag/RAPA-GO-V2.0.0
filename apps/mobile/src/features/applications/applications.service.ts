import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  apiClient,
  buildApiUrl,
} from "../../services/api/index.js";

interface RapaGoDocumentViewerPlugin {
  openAuthenticatedPdf(options: {
    url: string;
    token: string;
    fileName: string;
  }): Promise<void>;
}

const RapaGoDocumentViewer =
  registerPlugin<RapaGoDocumentViewerPlugin>("RapaGoDocumentViewer");

export interface ApplicationData {
  id: string; type: string; status: string;
  firstName: string; lastName: string; email: string; phone: string;
  rut: string | null; birthDate: string | null; city: string | null;
  emergencyContactName: string | null; emergencyContactPhone: string | null;
  vehicleBrand: string | null; vehicleModel: string | null; vehicleYear: number | null;
  vehiclePlate: string | null; vehicleColor: string | null;
  vehiclePhotoUrl: string | null;
  vehicles: Array<Record<string, unknown>>;
  licenseNumber: string | null; licenseExpiry: string | null;
  hasOwnVehicle: boolean;
  experienceYears: number | null; specialties: string[] | null;
  offeredTours: string[] | null; hasVehicle: boolean; vehicleDescription: string | null;
  languages: string[] | null; maxGroupSize: number | null;
  companyName: string | null; companyRut: string | null;
  idFrontUrl: string | null; idBackUrl: string | null;
  licenseFrontUrl: string | null; licenseBackUrl: string | null;
  certificateUrl: string | null; profilePhotoUrl: string | null;
  driverContractDocumentId: string | null;
  driverContractVersion: string | null;
  driverContractAcceptedAt: string | null;
  driverContractAcceptance: Record<string, unknown> | null;
  restWindowStart: string | null;
  restWindowEnd: string | null;
  documentReviewStatus: string;
  trainingStatus: string;
  reviewChecklist: Record<string, boolean>;
  contractDeliveryStatus: string;
  contractDeliveredAt: string | null;
  contractDeliveryError: string | null;
  reviewedBy: string | null; reviewedAt: string | null;
  rejectionReason: string | null; notes: string | null;
  createdAt: string; updatedAt: string;
}

export type ApplicationFileKind =
  | "id_front"
  | "id_back"
  | "license_front"
  | "license_back"
  | "profile_photo"
  | "vehicle_photo";

export interface UploadApplicationFilePayload {
  kind: ApplicationFileKind;
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  dataUrl: string;
}

type UploadEnvelope = {
  ok?: boolean;
  data?: ApplicationData;
  code?: string;
  message?: string;
};

const MAX_APPLICATION_FILE_BYTES = 650_000;
const APPLICATION_UPLOAD_TIMEOUT_MS = 45_000;

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);

  if (!match) {
    throw new Error("Uno de los archivos seleccionados no tiene un formato válido.");
  }

  const mimeType = match[1] ?? "application/octet-stream";
  const encoded = match[3] ?? "";

  try {
    if (match[2]) {
      const binary = window.atob(encoded);
      const bytes = new Uint8Array(binary.length);

      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      return new Blob([bytes], { type: mimeType });
    }

    return new Blob([decodeURIComponent(encoded)], { type: mimeType });
  } catch {
    throw new Error("No se pudo convertir uno de los archivos seleccionados.");
  }
}

/**
 * Códigos que obligan a cerrar sesión desde esta pantalla.
 *
 * `AUTH_TOKEN_EXPIRED` ya NO está en la lista, y esa es la corrección: un
 * access token caducado es el caso recuperable por excelencia. Antes provocaba
 * un cierre de sesión completo mientras `apiClient` emitía, para esa MISMA
 * respuesta, un `auth:token-expired` que disparaba la renovación. Las dos
 * cosas competían por el almacenamiento: si la renovación ganaba la escritura,
 * el cierre borraba justo después una sesión recién guardada y válida.
 *
 * Tampoco se dispara ya por un 401 "a secas": el código concreto manda, porque
 * un 401 sin código reconocido puede ser cualquier cosa.
 */
const FORCE_LOGOUT_CODES = [
  "AUTH_SESSION_REVOKED",
  "AUTH_ACCOUNT_DELETED",
  "AUTH_ACCOUNT_SUSPENDED",
  "UNAUTHORIZED",
];

function forceLogoutWhenNeeded(
  _statusCode: number,
  code: string | undefined,
): void {
  if (!FORCE_LOGOUT_CODES.includes(code ?? "")) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("auth:force-logout", {
      detail: { code: code ?? "UNAUTHORIZED" },
    }),
  );
}

export const applicationsService = {
  async createApplication(input: Record<string, unknown>, token?: string): Promise<{ id: string; status: string; message: string }> {
    const opts = token ? { token } : {};
    const result = await apiClient.post<{ data: { id: string; status: string; message: string } }>("/applications", input, opts);
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error al enviar postulación");
    return result.data.data;
  },

  async uploadApplicationFile(
    token: string,
    applicationId: string,
    input: UploadApplicationFilePayload,
  ): Promise<ApplicationData> {
    const blob = await dataUrlToBlob(input.dataUrl);

    if (blob.size === 0) {
      throw new Error(`El archivo ${input.fileName} está vacío.`);
    }

    if (blob.size > MAX_APPLICATION_FILE_BYTES) {
      throw new Error(
        `El archivo ${input.fileName} supera 650 KB. Selecciona una imagen más liviana.`,
      );
    }

    const query = new URLSearchParams({
      fileName: input.fileName,
    });
    const url = buildApiUrl(
      `/applications/${encodeURIComponent(applicationId)}/files/${encodeURIComponent(input.kind)}?${query.toString()}`,
    );
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      APPLICATION_UPLOAD_TIMEOUT_MS,
    );

    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": input.mimeType,
        },
        body: blob,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(
          `La carga de ${input.fileName} tardó demasiado. Revisa tu conexión y vuelve a intentar.`,
        );
      }

      throw new Error(
        error instanceof Error
          ? `No se pudo subir ${input.fileName}: ${error.message}`
          : `No se pudo subir ${input.fileName}.`,
      );
    } finally {
      window.clearTimeout(timeoutId);
    }

    let parsed: UploadEnvelope | null = null;

    try {
      parsed = await response.json() as UploadEnvelope;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      forceLogoutWhenNeeded(response.status, parsed?.code);

      throw new Error(
        parsed?.message ??
          `No se pudo guardar ${input.fileName} (HTTP ${response.status}).`,
      );
    }

    if (!parsed?.data) {
      throw new Error(
        `El servidor no confirmó la carga de ${input.fileName}.`,
      );
    }

    return parsed.data;
  },

  async getMyApplications(token: string): Promise<ApplicationData[]> {
    const result = await apiClient.get<{ data: { items: ApplicationData[] } }>("/applications/me", { token });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error");
    return result.data.data.items;
  },

  async listApplications(token: string, params?: { type?: string; status?: string; page?: number }): Promise<{ items: ApplicationData[]; total: number; page: number }> {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    const result = await apiClient.get<{ data: { items: ApplicationData[]; total: number; page: number } }>(`/admin/applications?${qs.toString()}`, { token });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error");
    return result.data.data;
  },

  async getApplication(token: string, id: string): Promise<ApplicationData> {
    const result = await apiClient.get<{ data: ApplicationData }>(`/admin/applications/${id}`, { token });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error");
    return result.data.data;
  },

  async reviewApplication(
    token: string,
    id: string,
    input: {
      status: string;
      rejectionReason?: string;
      notes?: string;
      documentReviewStatus?: "pending" | "approved" | "needs_information" | "rejected";
      trainingStatus?: "pending" | "approved" | "rejected";
      reviewChecklist?: Record<string, boolean>;
    },
  ): Promise<ApplicationData> {
    const result = await apiClient.patch<{ data: ApplicationData }>(`/admin/applications/${id}/review`, input, { token });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error");
    return result.data.data;
  },
  async downloadContract(
    token: string,
    applicationId: string,
  ): Promise<void> {
    const fileName = `Contrato-Rapa-Go-${applicationId}.pdf`;
    const contractUrl = buildApiUrl(
      `/applications/${encodeURIComponent(applicationId)}/contract`,
    );

    if (Capacitor.getPlatform() === "android") {
      await RapaGoDocumentViewer.openAuthenticatedPdf({
        url: contractUrl,
        token,
        fileName,
      });
      return;
    }

    const response = await fetch(
      contractUrl,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      let message = "No se pudo descargar el contrato.";

      try {
        const body = await response.json() as { message?: string };
        message = body.message ?? message;
      } catch {
        // Respuesta sin JSON.
      }

      throw new Error(message);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const disposition = response.headers.get("content-disposition") ?? "";
    const fileNameMatch = /filename="?([^";]+)"?/i.exec(disposition);
    const downloadedFileName =
      fileNameMatch?.[1] ??
      fileName;
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = downloadedFileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  async resendContract(
    token: string,
    applicationId: string,
  ): Promise<{ status: string; deliveredAt: string | null }> {
    const result = await apiClient.post<{
      data: { status: string; deliveredAt: string | null };
    }>(
      `/admin/applications/${applicationId}/contract/resend`,
      {},
      { token },
    );

    if (!result.ok) {
      throw new Error(
        (result as { message?: string }).message ??
          "No se pudo reenviar el contrato.",
      );
    }

    return result.data.data;
  },

};
