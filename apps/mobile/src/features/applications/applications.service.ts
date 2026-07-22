import { apiClient } from "../../services/api/index.js";

export interface ApplicationData {
  id: string; type: string; status: string;
  firstName: string; lastName: string; email: string; phone: string;
  rut: string | null; birthDate: string | null; city: string | null;
  emergencyContactName: string | null; emergencyContactPhone: string | null;
  vehicleBrand: string | null; vehicleModel: string | null; vehicleYear: number | null;
  vehiclePlate: string | null; vehicleColor: string | null;
  licenseNumber: string | null; licenseExpiry: string | null;
  hasOwnVehicle: boolean;
  experienceYears: number | null; specialties: string[] | null;
  offeredTours: string[] | null; hasVehicle: boolean; vehicleDescription: string | null;
  languages: string[] | null; maxGroupSize: number | null;
  companyName: string | null; companyRut: string | null;
  idFrontUrl: string | null; idBackUrl: string | null;
  licenseFrontUrl: string | null; licenseBackUrl: string | null;
  certificateUrl: string | null; profilePhotoUrl: string | null;
  reviewedBy: string | null; reviewedAt: string | null;
  rejectionReason: string | null; notes: string | null;
  createdAt: string; updatedAt: string;
}

export const applicationsService = {
  async createApplication(input: Record<string, unknown>, token?: string): Promise<{ id: string; status: string; message: string }> {
    const opts = token ? { token } : {};
    const result = await apiClient.post<{ data: { id: string; status: string; message: string } }>("/applications", input, opts);
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error al enviar postulación");
    return result.data.data;
  },
  async getMyApplications(token: string): Promise<ApplicationData[]> {
    const result = await apiClient.get<{ data: { items: ApplicationData[] } }>("/applications/me", { token });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error");
    return result.data.data.items;
  },
  async listApplications(token: string, params?: { type?: string; status?: string; page?: number }): Promise<{ items: ApplicationData[]; total: number; page: number }> {
    const qs = new URLSearchParams();
    if (params?.type)   qs.set("type", params.type);
    if (params?.status) qs.set("status", params.status);
    if (params?.page)   qs.set("page", String(params.page));
    const result = await apiClient.get<{ data: { items: ApplicationData[]; total: number; page: number } }>(`/admin/applications?${qs.toString()}`, { token });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error");
    return result.data.data;
  },
  async getApplication(token: string, id: string): Promise<ApplicationData> {
    const result = await apiClient.get<{ data: ApplicationData }>(`/admin/applications/${id}`, { token });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error");
    return result.data.data;
  },
  async reviewApplication(token: string, id: string, input: { status: string; rejectionReason?: string; notes?: string }): Promise<ApplicationData> {
    const result = await apiClient.patch<{ data: ApplicationData }>(`/admin/applications/${id}/review`, input, { token });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error");
    return result.data.data;
  },
};
