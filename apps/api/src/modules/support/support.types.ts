import type {
  SupportCase,
  SupportCaseEvent,
} from "../../db/schema/supportCases.schema.js";

export interface SupportCaseWithRequester extends SupportCase {
  requesterName: string | null;
  requesterEmail: string | null;
  assignedAdminName: string | null;
}

export interface SupportCaseResponse {
  id: string;
  trackingCode: string;
  requesterUserId: string;
  requesterRole: string;
  requesterName: string | null;
  requesterEmail: string | null;
  rideRequestId: string | null;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  contactPhone: string | null;
  contactEmail: string | null;
  lostItemDescription: string | null;
  lostItemLastSeenAt: string | null;
  assignedAdminUserId: string | null;
  assignedAdminName: string | null;
  adminResolution: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportCaseEventResponse {
  id: string;
  supportCaseId: string;
  actorUserId: string | null;
  actorRole: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  publicMessage: string | null;
  internalNote: string | null;
  createdAt: string;
}


export interface SupportRequesterIdentityResponse {
  userId: string;
  role: string;
  name: string;
  email: string;
  phone: string | null;
  rut: string | null;
  birthDate: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
}

export interface SupportCaseDetailResponse {
  supportCase: SupportCaseResponse;
  events: SupportCaseEventResponse[];
  requesterIdentity: SupportRequesterIdentityResponse | null;
}

export type SupportErrorResult = {
  ok: false;
  code: string;
  message: string;
  statusCode: number;
};

export type SupportCaseResult =
  | { ok: true; supportCase: SupportCaseResponse }
  | SupportErrorResult;

export type SupportCaseDetailResult =
  | { ok: true; detail: SupportCaseDetailResponse }
  | SupportErrorResult;

export type SupportCasesListResult =
  | { ok: true; items: SupportCaseResponse[] }
  | SupportErrorResult;

export type SupportCaseUpdateResult =
  | { ok: true; detail: SupportCaseDetailResponse }
  | SupportErrorResult;

export type { SupportCase, SupportCaseEvent };
