export interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

interface GoogleAccountsIdApi {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
      locale?: string;
    },
  ): void;
  disableAutoSelect(): void;
}

export interface GoogleIdentityServicesGlobal {
  accounts: {
    id: GoogleAccountsIdApi;
  };
}

export function getGoogleIdentityServices():
  | GoogleIdentityServicesGlobal
  | undefined {
  if (typeof window === "undefined") return undefined;

  return (
    window as unknown as {
      google?: GoogleIdentityServicesGlobal;
    }
  ).google;
}

export function disableGoogleAutoSelect(): void {
  getGoogleIdentityServices()?.accounts.id.disableAutoSelect();
}

const SCRIPT_ID = "rapago-google-identity-services";
const SCRIPT_URL = "https://accounts.google.com/gsi/client";
let scriptPromise: Promise<void> | null = null;

export function loadGoogleIdentityServices(): Promise<void> {
  if (getGoogleIdentityServices()?.accounts.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("No se pudo cargar Google Identity Services.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("No se pudo cargar Google Identity Services."));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

export function readDisplayEmailFromGoogleToken(idToken: string): string {
  try {
    const payloadPart = idToken.split(".")[1];
    if (!payloadPart) return "";
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(atob(padded)) as { email?: unknown };
    const email = String(payload.email ?? "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
  } catch {
    return "";
  }
}
