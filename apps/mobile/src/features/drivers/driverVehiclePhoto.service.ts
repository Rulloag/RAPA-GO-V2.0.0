import { apiClient } from "../../services/api/index.js";

export interface UploadDriverVehiclePhotoPayload {
  dataUrl: string;
  fileName: string;
  vehicleId?: string;
  ownership?: "own" | "borrowed";
}

export interface DriverVehiclePhotoUploadData {
  publicUrl: string;
  storagePath: string;
  bucket: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
}

type Envelope<T> = {
  ok: true;
  data: T;
  statusCode: number;
};

export const driverVehiclePhotoService = {
  async uploadMyVehiclePhoto(
    accessToken: string,
    payload: UploadDriverVehiclePhotoPayload,
  ): Promise<DriverVehiclePhotoUploadData> {
    const result = await apiClient.post<Envelope<DriverVehiclePhotoUploadData>>(
      "/drivers/me/vehicle-photo",
      payload,
      { token: accessToken },
    );

    if (!result.ok) {
      throw new Error(
        (result as { message?: string }).message ??
          "No se pudo subir la foto del vehículo.",
      );
    }

    return (result.data as Envelope<DriverVehiclePhotoUploadData>).data;
  },
};
