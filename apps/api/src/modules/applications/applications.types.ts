export interface ApplicationResponse {
  id: string;
  userId: string | null;
  type: string;
  status: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rut: string | null;
  birthDate: string | null;
  city: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehiclePlate: string | null;
  vehicleColor: string | null;
  vehiclePhotoUrl: string | null;
  vehicles: Array<Record<string, unknown>>;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  hasOwnVehicle: boolean;
  experienceYears: number | null;
  specialties: string[] | null;
  offeredTours: string[] | null;
  hasVehicle: boolean;
  vehicleDescription: string | null;
  maxGroupSize: number | null;
  languages: string[] | null;
  companyName: string | null;
  companyRut: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  licenseFrontUrl: string | null;
  licenseBackUrl: string | null;
  certificateUrl: string | null;
  profilePhotoUrl: string | null;
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
  approvalDeliveryStatus: string;
  approvalDeliveredAt: string | null;
  approvalDeliveryError: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationResult =
  | { ok: true; application: ApplicationResponse }
  | { ok: false; code: string; message: string; statusCode: number };

export type ApplicationsListResult =
  | { ok: true; items: ApplicationResponse[]; total: number; page: number }
  | { ok: false; code: string; message: string; statusCode: number };

export type CreateApplicationResult =
  | { ok: true; id: string; status: string; message: string }
  | { ok: false; code: string; message: string; statusCode: number };

export type ApplicationContractResult =
  | {
      ok: true;
      fileName: string;
      contentType: "application/pdf";
      buffer: Buffer;
    }
  | { ok: false; code: string; message: string; statusCode: number };

export type ContractDeliveryResult =
  | { ok: true; status: string; deliveredAt: string | null }
  | { ok: false; code: string; message: string; statusCode: number };
