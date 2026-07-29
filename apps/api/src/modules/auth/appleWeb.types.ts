import type { ResidenceAccreditationInput } from "@rapa-go/shared";
import type {
  AppleAuthName,
  AppleLegalAcceptanceInput,
  ApplePassengerFareType,
} from "./appleAuth.types.js";

export interface ApplePreparedWebIdentity {
  sub: string;
  aud: string;
  email?: string;
  emailVerified: boolean;
  isPrivateEmail: boolean;
  name?: AppleAuthName;
  encryptedRefreshToken?: string;
}

export interface AppleWebCompleteInput {
  flowToken: string;
  phone?: string;
  contactEmail?: string;
  rut?: string;
  passport?: string;
  passengerFareType?: ApplePassengerFareType;
  legalAcceptances?: AppleLegalAcceptanceInput[];
  residenceAccreditation?: ResidenceAccreditationInput;
}
