import type {
  AuthUser,
  AuthSession,
  AuthStatus,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  ResidenceAccreditationInput,
  UserRole,
} from "@rapa-go/shared";

export type {
  AuthUser,
  AuthSession,
  AuthStatus,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
};

export type ApplePassengerFareType =
  | "resident"
  | "chilean"
  | "foreigner";

export interface AppleLegalAcceptance {
  legalDocumentId: string;
  version: string;
}

/**
 * Payload sent to POST /api/auth/apple.
 *
 * SECURITY: email, Apple subject and private-email status are intentionally
 * absent. The backend takes them only from the verified Apple identity token.
 */
export interface AppleSignInRequest {
  identityToken: string;
  authorizationCode: string;
  /** Raw nonce; the backend hashes it once when verifying Apple's token. */
  nonce: string;
  name?: {
    givenName?: string;
    familyName?: string;
  };
  /** Required only for creation of a new account. */
  role?: UserRole;
  phone?: string;
  /**
   * Contact email typed by the user, only when Apple's identity token did
   * not include a verified email. Never used to identify the account — the
   * Apple subject remains the sole identity key.
   */
  contactEmail?: string;
  /** Required for chilean and resident passenger fare types. */
  rut?: string;
  /** Required for foreigner passenger fare type. */
  passport?: string;
  passengerFareType?: ApplePassengerFareType;
  legalAcceptances?: AppleLegalAcceptance[];
  residenceAccreditation?: ResidenceAccreditationInput;
}

/** Shape exposed by AuthContext. */
export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Session is persisted through SessionStorageService. */
  session: AuthSession | null;
  login: (payload: LoginRequest) => Promise<AuthResponse>;
  register: (payload: RegisterRequest) => Promise<AuthResponse>;
  signInWithApple: (payload: AppleSignInRequest) => Promise<AuthResponse>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}
