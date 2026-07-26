import type {
  ResidenceAccreditationInput,
  UserRole,
} from "@rapa-go/shared";
import type { AuthServiceResult } from "./auth.types.js";

export type ApplePassengerFareType =
  | "resident"
  | "chilean"
  | "foreigner";

export interface AppleLegalAcceptanceInput {
  legalDocumentId: string;
  version: string;
}

export interface AppleAuthName {
  givenName?: string | undefined;
  familyName?: string | undefined;
}

/**
 * Request body for POST /api/auth/apple.
 *
 * SECURITY: email, sub and private-email status are deliberately not accepted
 * from the client. They are obtained exclusively from Apple's verified token.
 */
export interface AppleAuthRequest {
  identityToken: string;
  authorizationCode: string;
  nonce?: string | undefined;
  name?: AppleAuthName | undefined;
  /** Required only when creating a new account. */
  role?: UserRole | undefined;
  /** Passenger setup fields, ignored for an existing Apple identity. */
  phone?: string | undefined;
  passengerFareType?: ApplePassengerFareType | undefined;
  legalAcceptances?: AppleLegalAcceptanceInput[] | undefined;
  residenceAccreditation?: ResidenceAccreditationInput | undefined;
}

export type AppleAuthResult = AuthServiceResult;

export type AppleLinkResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code: string;
      message: string;
      statusCode: number;
    };
