import type { AuthServiceResult } from "./auth.types.js";

export type ApplePassengerFareType = "resident" | "chilean" | "foreigner";

export interface AppleLegalAcceptanceInput {
  legalDocumentId: string;
  version: string;
}

export interface AppleAuthName {
  givenName?: string | undefined;
  familyName?: string | undefined;
}

export interface AppleAuthRequest {
  identityToken: string;
  authorizationCode: string;
  nonce: string;
  name?: AppleAuthName | undefined;
  phone?: string | undefined;
  passengerFareType?: ApplePassengerFareType | undefined;
  legalAcceptances?: AppleLegalAcceptanceInput[] | undefined;
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
