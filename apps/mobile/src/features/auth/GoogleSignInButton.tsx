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

  /**
   * Propiedades reales usadas por LoginPage.
   */
  onWebCredential?: CredentialHandler;
  onNativePress?: PressHandler;
  onError?: ErrorHandler;

  /**
   * Alias mantenidos por compatibilidad.
   */
  onCredential?: CredentialHandler;
  onSuccess?: CredentialHandler;
  onToken?: CredentialHandler;
  onClick?: PressHandler;
  onPress?: PressHandler;
  onSignIn?: PressHandler;
}

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

  const [scriptReady, setScriptReady] = useState(false);
  const [renderError, setRenderError] = useState("");

  const isNative = Capacitor.isNativePlatform();

  const clientId = String(
    clientIdProp ??
      import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ??
      "",
  ).trim();

  const webCredentialHandler =
    onWebCredential ??
    onCredential ??
    onSuccess ??
    onToken;

  const nativePressHandler =
    onNativePress ??
    onClick ??
    onPress ??
    onSignIn;

  const availableForPlatform =
    isAvailable &&
    (isNative
      ? Boolean(nativePressHandler)
      : Boolean(clientId && webCredentialHandler));

  const disabled =
    disabledProp ||
    loading ||
    !availableForPlatform;

  const visibleLabel =
    label ??
    (loading
      ? "Conectando con Google..."
      : "Continuar con Google");

  const rootClassName = [
    "rapago-google-button",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const reportError = useCallback(
    (message: string): void => {
      setRenderError(message);
      onError?.(message);
    },
    [onError],
  );

  /**
   * WEB:
   * Carga Google Identity Services y renderiza el boton oficial.
   *
   * IMPORTANTE:
   * LoginPage tambien entrega onNativePress, pero en web NO debemos
   * tratarlo como boton nativo. Ese era el error que dejaba el boton
   * visual sin ninguna accion.
   */
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

        reportError(
          "Google Identity Services no quedo disponible.",
        );
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
  }, [
    clientId,
    isNative,
    reportError,
    webCredentialHandler,
  ]);

  /**
   * Renderiza (o vuelve a renderizar) el boton oficial de Google
   * al ancho disponible del shell.
   *
   * IMPORTANTE — por que se saco el hack anterior de
   * left/top/transform: translateX(-50%) scale(...):
   *
   * 1. .rapago-google-button__official tiene `position: relative`
   *    en el CSS y vive dentro de un shell con `display: flex;
   *    justify-content: center; align-items: center`. Eso ya lo
   *    centra en los dos ejes SOLO. Aplicarle ademas
   *    `translateX(-50%)` lo corria un ancho extra hacia la
   *    izquierda (por eso se veia "Continuar con Google" cortado
   *    y corrido a la izquierda en el screenshot).
   *
   * 2. Escalar el iframe de Google con `transform: scale()` para
   *    que la altura coincida con la del shell (48/52/54/56px)
   *    lo deja borroso, ya que Google solo soporta una altura fija
   *    real (~40px con size="large"). Ahora dejamos que el boton
   *    de Google se vea a su tamano nativo, centrado verticalmente
   *    por el flex del shell — sin escalar.
   *
   * El JS sigue siendo quien decide el ANCHO (Google no acepta
   * "%", solo px fijos), pero ya no toca left/top/transform.
   */
  const renderOfficialButton = useCallback((): void => {
    if (
      isNative ||
      !scriptReady ||
      !clientId ||
      !webCredentialHandler
    ) {
      return;
    }

    const shell = shellRef.current;
    const target = officialButtonRef.current;
    const googleApi = getGoogleIdentityServices()?.accounts?.id;

    if (!shell || !target || !googleApi) return;

    const measuredWidth = Math.floor(
      shell.getBoundingClientRect().width,
    );

    // Google acepta un ancho fijo entre ~160 y 400px.
    const renderWidth = Math.max(
      180,
      Math.min(400, measuredWidth),
    );

    if (
      renderWidth === lastRenderedWidthRef.current &&
      target.childElementCount > 0
    ) {
      return;
    }

    lastRenderedWidthRef.current = renderWidth;
    target.innerHTML = "";

    googleApi.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        const credential = String(
          response.credential ?? "",
        ).trim();

        if (!credential) {
          reportError(
            "Google no entrego una credencial valida.",
          );
          return;
        }

        setRenderError("");
        void webCredentialHandler(credential);
      },
    });

    googleApi.renderButton(target, {
      type: "standard",
      /* "filled_black" (#202124) queda a un tono del negro del botón de Apple
         (#222428), en vez del blanco de "outline", que era el único elemento
         claro de toda la tarjeta. Los tres temas de Google son igual de
         válidos, así que se elige el que encaja en las dos paletas: de día
         empareja con Apple sobre la crema, y de noche el borde dorado lo pone
         nuestro CSS, que sí alcanza a este nodo (ver GoogleSignInButton.css). */
      theme: "filled_black",
      size: "large",
      text: "continue_with",
      /* Rectangular, no "pill": el radio real lo fija el CSS en 16px para que
         coincida con "Crear cuenta" e "Iniciar sesión". Con "pill" Google
         escribe 20px, que sobre 52px de alto ya no es un óvalo. */
      shape: "rectangular",
      logo_alignment: "left",
      width: renderWidth,
      locale: "es",
    });
  }, [
    clientId,
    isNative,
    reportError,
    scriptReady,
    webCredentialHandler,
  ]);

  useEffect(() => {
    if (isNative || !scriptReady) return;

    renderOfficialButton();

    const shell = shellRef.current;

    if (!shell || typeof ResizeObserver === "undefined") {
      const handleResize = (): void => {
        lastRenderedWidthRef.current = 0;
        renderOfficialButton();
      };

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }

    const observer = new ResizeObserver(() => {
      lastRenderedWidthRef.current = 0;

      window.requestAnimationFrame(() => {
        renderOfficialButton();
      });
    });

    observer.observe(shell);

    return () => {
      observer.disconnect();
    };
  }, [
    isNative,
    renderOfficialButton,
    scriptReady,
  ]);

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
            <span
              aria-hidden="true"
              className="rapago-google-button__spinner"
            />
          ) : (
            <GoogleLogo />
          )}

          <span className="rapago-google-button__label">
            {visibleLabel}
          </span>
        </button>

        {renderError && (
          <small
            className="rapago-google-button__error"
            role="alert"
          >
            {renderError}
          </small>
        )}
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
        {!scriptReady && (
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
              {renderError
                ? "Google no pudo cargar"
                : visibleLabel}
            </span>
          </div>
        )}

        <div
          className="rapago-google-button__official"
          ref={officialButtonRef}
        />

        {disabled && (
          <div
            aria-hidden="true"
            className="rapago-google-button__blocker"
          />
        )}
      </div>

      {renderError && (
        <small
          className="rapago-google-button__error"
          role="alert"
        >
          {renderError}
        </small>
      )}
    </div>
  );
}
