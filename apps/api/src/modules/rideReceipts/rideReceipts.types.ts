export type RideReceiptType =
  | "completed_ride"
  | "cancelled_ride"
  | "no_show_closure"
  | "late_cancellation"
  | "no_show";

export type RideReceiptStatus =
  | "pending"
  | "generating"
  | "generated"
  | "sent"
  | "failed";

export interface RideReceiptResponse {
  id: string;
  rideId: string;
  policyChargeId: string | null;
  type: RideReceiptType;
  status: RideReceiptStatus;
  documentNumber: string;
  emailTo: string;
  mapProvider: string | null;
  routePointCount: number;
  legalDocumentType: string | null;
  legalDocumentVersion: string | null;
  legalAcceptedAt: string | null;
  deliveryAttempts: number;
  generatedAt: string | null;
  sentAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RideReceiptListResult =
  | { ok: true; receipts: RideReceiptResponse[] }
  | { ok: false; code: string; message: string; statusCode: number };

export type RideReceiptDownloadResult =
  | {
      ok: true;
      fileName: string;
      contentType: "application/pdf";
      buffer: Buffer;
    }
  | { ok: false; code: string; message: string; statusCode: number };

export type RideReceiptActionResult =
  | { ok: true; receipt: RideReceiptResponse }
  | { ok: false; code: string; message: string; statusCode: number };
