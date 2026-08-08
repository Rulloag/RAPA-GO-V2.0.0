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
  /**
   * Se envía únicamente cuando Google encuentra una cuenta RAPA GO existente
   * con el mismo correo verificado. El backend valida la contraseña antes de
   * asociar el Google sub al user.id existente.
   */
  linkPassword?: string | undefined;
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
