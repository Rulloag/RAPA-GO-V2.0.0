import type {
  AuthSession,
  ResidenceAccreditationInput,
} from "@rapa-go/shared";

export type GooglePassengerFareType =
  | "resident"
  | "chilean"
  | "foreigner";

export interface GoogleLegalAcceptance {
  legalDocumentId: string;
  version: string;
}

/**
 * El correo, foto y subject nunca vienen del cliente como fuente de verdad.
 * El nombre visible sí puede ser confirmado por la persona durante el alta,
 * pero nunca se usa como identificador OAuth.
 */
export interface GoogleAuthRequest {
  idToken: string;
  displayName?: string | undefined;
  phone?: string | undefined;
  rut?: string | undefined;
  passport?: string | undefined;
  passengerFareType?: GooglePassengerFareType | undefined;
  legalAcceptances?: GoogleLegalAcceptance[] | undefined;
  residenceAccreditation?: ResidenceAccreditationInput | undefined;
}

export type GoogleAuthResult =
  | {
      ok: true;
      session: AuthSession;
      refreshToken?: string | undefined;
    }
  | {
      ok: false;
      code: string;
      message: string;
      statusCode: number;
      displayEmail?: string | undefined;
    };
