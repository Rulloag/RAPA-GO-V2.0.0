export { AuthProvider, AuthContext } from "./AuthProvider.js";
export { useAuth } from "./useAuth.js";
export { LoginPage } from "./LoginPage.js";
export { RegisterPage } from "./RegisterPage.js";
export type { AuthContextValue, AuthUser, AuthSession, AuthStatus, LoginRequest, RegisterRequest, AuthResponse } from "./auth.types.js";

export { authService } from "./auth.service.js";

export { AppleSignInButton } from "./AppleSignInButton.js";
export { AppleAccountSetupModal } from "./AppleAccountSetupModal.js";
export { useAppleSignIn } from "./useAppleSignIn.js";
export type { AppleSignInOutcome } from "./useAppleSignIn.js";
export { AppleLinkButton } from "./AppleLinkButton.js";
