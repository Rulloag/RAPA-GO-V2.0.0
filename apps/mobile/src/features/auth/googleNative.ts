import { registerPlugin } from "@capacitor/core";

export interface GoogleNativeSignInResult {
  idToken: string;
  email?: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  imageUrl?: string;
}

interface GoogleNativeAuthPlugin {
  signIn(options: {
    serverClientId: string;
  }): Promise<GoogleNativeSignInResult>;
  signOut(): Promise<void>;
}

export const GoogleNativeAuth = registerPlugin<GoogleNativeAuthPlugin>(
  "RapaGoGoogleAuth",
);
