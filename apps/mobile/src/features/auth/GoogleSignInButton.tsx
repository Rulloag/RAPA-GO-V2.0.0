import { Capacitor } from "@capacitor/core";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getGoogleIdentityServices,
  loadGoogleIdentityServices,
} from "./googleIdentityServices.js";
import { getRapaGoLanguage } from "../../i18n/rapagoI18n.js";
import "./GoogleSignInButton.css";

type MaybePromise = void | Promise<void>;
type CredentialHandler = (credential: string) => MaybePromise;
type PressHandler = () => MaybePromise;
type ErrorHandler = (message: string) => void;

export interface GoogleSignInButtonProps {
  clientId?: string;
  disabled?: boolean;
  loading?: boolean;
  isAvailable?: boolean;
  label?: string;
  className?: string;
  onWebCredential?: CredentialHandler;
  onNativePress?: PressHandler;
  onError?: ErrorHandler;
  onCredential?: CredentialHandler;
  onSuccess?: CredentialHandler;
  onToken?: CredentialHandler;
  onClick?: PressHandler;
  onPress?: PressHandler;
  onSignIn?: PressHandler;
}

/** Una sola initialize() por pestaña: GSI avisa y se rompe si se repite. */
let gisInitializedClientId: string | null = null;
let gisCredentialHandler: CredentialHandler | null = null;

function GoogleLogo(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="rapago-google-button__logo"
      viewBox="0 0 24 24"
    >
      <path
        fill="#4285F4"
        d="M21.35 12.22c0-.72-.06-1.25-.2-1.8H12v3.44h5.37a4.56 4.56 0 0 1-1.99 2.99v2.25h3.22c1.88-1.73 2.75-4.28 2.75-6.88Z"
      />
      <path
        fill="#34A853"
        d="M12 21.7c2.63 0 4.84-.87 6.45-2.36l-3.22-2.5c-.87.6-2.03 1.02-3.23 1.02-2.52 0-4.66-1.7-5.42-4.04H3.27v2.57A9.73 9.73 0 0 0 12 21.7Z"
      />
      <path
        fill="#FBBC05"
        d="M6.58 13.82A5.8 5.8 0 0 1 6.27 12c0-.63.11-1.24.31-1.82V7.61H3.27A9.67 9.67 0 0 0 2.3 12c0 1.58.38 3.08.97 4.39l3.31-2.57Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.14c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.83 3.2 14.63 2.3 12 2.3a9.73 9.73 0 0 0-8.73 5.31l3.31 2.57C7.34 7.84 9.48 6.14 12 6.14Z"
      />
    </svg>
  );
}

function ensureGisInitialized(
  clientId: string,
  onCredential: CredentialHandler,
  onInvalid: () => void,
): boolean {
  const googleApi = getGoogleIdentityServices()?.accounts?.id;
  if (!googleApi) return false;

  gisCredentialHandler = onCredential;

  if (gisInitializedClientId === clientId) return true;

  googleApi.initialize({
    client_id: clientId,
    auto_select: false,
    cancel_on_tap_outside: true,
    callback: (response) => {
      const credential = String(response.credential ?? "").trim();
      if (!credential) {
        onInvalid();
        return;
      }
      void gisCredentialHandler?.(credential);
    },
  });

  gisInitializedClientId = clientId;
  return true;
}

export function GoogleSignInButton({
  clientId: clientIdProp,
  disabled: disabledProp = false,
  loading = false,
  isAvailable = true,
  label,
  className = "",
  onWebCredential,
  onNativePress,
  onError,
  onCredential,
  onSuccess,
  onToken,
  onClick,
  onPress,
  onSignIn,
}: GoogleSignInButtonProps): JSX.Element {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const officialButtonRef = useRef<HTMLDivElement | null>(null);
  const lastRenderedWidthRef = useRef(0);
  const lastLocaleRef = useRef("");

  const [scriptReady, setScriptReady] = useState(false);
  const [renderError, setRenderError] = useState("");

  const isNative = Capacitor.isNativePlatform();

  const clientId = String(
    clientIdProp ?? import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ?? "",
  ).trim();

  const webCredentialHandler =
    onWebCredential ?? onCredential ?? onSuccess ?? onToken;

  const nativePressHandler =
    onNativePress ?? onClick ?? onPress ?? onSignIn;

  const availableForPlatform =
    isAvailable &&
    (isNative
      ? Boolean(nativePressHandler)
      : Boolean(clientId && webCredentialHandler));

  const disabled = disabledProp || loading || !availableForPlatform;

  const visibleLabel =
    label ??
    (loading ? "Conectando con Google..." : "Continuar con Google");

  const rootClassName = ["rapago-google-button", className]
    .filter(Boolean)
    .join(" ");

  const reportError = useCallback(
    (message: string): void => {
      setRenderError(message);
      onError?.(message);
    },
    [onError],
  );

  const webCredentialHandlerRef = useRef(webCredentialHandler);
  webCredentialHandlerRef.current = webCredentialHandler;

  useEffect(() => {
    if (isNative || !clientId || !webCredentialHandler) {
      setScriptReady(false);
      return;
    }

    let cancelled = false;

    void loadGoogleIdentityServices()
      .then(() => {
        if (cancelled) return;

        if (getGoogleIdentityServices()?.accounts?.id) {
          setRenderError("");
          setScriptReady(true);
          return;
        }

        reportError("Google Identity Services no quedo disponible.");
      })
      .catch(() => {
        if (cancelled) return;
        reportError(
          "No se pudo cargar Google. Revisa los bloqueadores del navegador.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, isNative, reportError, webCredentialHandler]);

  const renderOfficialButton = useCallback((): void => {
    if (isNative || !scriptReady || !clientId || !webCredentialHandlerRef.current) {
      return;
    }

    const shell = shellRef.current;
    const target = officialButtonRef.current;
    const googleApi = getGoogleIdentityServices()?.accounts?.id;
    if (!shell || !target || !googleApi) return;

    const locale = getRapaGoLanguage() === "en" ? "en" : "es";
    const measuredWidth = Math.floor(shell.getBoundingClientRect().width);
    const renderWidth = Math.max(180, Math.min(400, measuredWidth || 400));

    if (
      renderWidth === lastRenderedWidthRef.current &&
      locale === lastLocaleRef.current &&
      target.childElementCount > 0
    ) {
      return;
    }

    const ready = ensureGisInitialized(
      clientId,
      (credential) => {
        setRenderError("");
        void webCredentialHandlerRef.current?.(credential);
      },
      () => {
        reportError("Google no entrego una credencial valida.");
      },
    );

    if (!ready) return;

    lastRenderedWidthRef.current = renderWidth;
    lastLocaleRef.current = locale;
    target.innerHTML = "";

    googleApi.renderButton(target, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: renderWidth,
      locale,
    });
  }, [clientId, isNative, reportError, scriptReady]);

  useEffect(() => {
    if (isNative || !scriptReady) return;

    renderOfficialButton();

    const shell = shellRef.current;
    const rerender = (): void => {
      lastRenderedWidthRef.current = 0;
      renderOfficialButton();
    };

    window.addEventListener("rapago:language-changed", rerender);

    if (!shell || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", rerender);
      return () => {
        window.removeEventListener("resize", rerender);
        window.removeEventListener("rapago:language-changed", rerender);
      };
    }

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(rerender);
    });
    observer.observe(shell);

    return () => {
      observer.disconnect();
      window.removeEventListener("rapago:language-changed", rerender);
    };
  }, [isNative, renderOfficialButton, scriptReady]);

  async function handleNativePress(): Promise<void> {
    if (disabled || !nativePressHandler) return;
    setRenderError("");
    try {
      await nativePressHandler();
    } catch (error) {
      reportError(
        error instanceof Error
          ? error.message
          : "No se pudo continuar con Google.",
      );
    }
  }

  if (isNative) {
    return (
      <div className={rootClassName}>
        <button
          aria-busy={loading}
          className="rapago-google-button__custom"
          disabled={disabled}
          onClick={() => {
            void handleNativePress();
          }}
          type="button"
        >
          {loading ? (
            <span aria-hidden="true" className="rapago-google-button__spinner" />
          ) : (
            <GoogleLogo />
          )}
          <span className="rapago-google-button__label">{visibleLabel}</span>
        </button>
        {renderError ? (
          <small className="rapago-google-button__error" role="alert">
            {renderError}
          </small>
        ) : null}
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <div
        aria-busy={loading || !scriptReady}
        aria-disabled={disabled}
        className="rapago-google-button__shell"
        ref={shellRef}
      >
        {!scriptReady ? (
          <div className="rapago-google-button__placeholder">
            {loading ? (
              <span
                aria-hidden="true"
                className="rapago-google-button__spinner"
              />
            ) : (
              <GoogleLogo />
            )}
            <span className="rapago-google-button__label">
              {renderError ? "Google no pudo cargar" : visibleLabel}
            </span>
          </div>
        ) : null}

        <div
          className="rapago-google-button__official"
          ref={officialButtonRef}
        />

        {disabled ? (
          <div aria-hidden="true" className="rapago-google-button__blocker" />
        ) : null}
      </div>

      {renderError ? (
        <small className="rapago-google-button__error" role="alert">
          {renderError}
        </small>
      ) : null}
    </div>
  );
}
