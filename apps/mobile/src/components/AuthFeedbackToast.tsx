import { useEffect, useState } from "react";
import { IonToast } from "@ionic/react";
import { alertCircleOutline, checkmarkCircleOutline } from "ionicons/icons";

/**
 * Protocolo de sesión — feedback de login, registro y cierre de sesión.
 *
 * Escucha los eventos globales emitidos por AuthProvider y muestra el
 * mensaje correspondiente:
 *  - "auth:login-result"    → login exitoso
 *  - "auth:register-result" → registro exitoso
 *  - "auth:logout-result"   → cierre de sesión (éxito o error)
 */

export const LOGIN_SUCCESS_MESSAGE = "Has iniciado sesión correctamente";
export const REGISTER_SUCCESS_MESSAGE = "Tu cuenta se creó correctamente";
export const LOGOUT_SUCCESS_MESSAGE = "Haz cerrado sesión correctamente";
export const LOGOUT_ERROR_MESSAGE = "Ha Habido un problema para cerrar sesión";

const LOGIN_RESULT_EVENT = "auth:login-result";
const REGISTER_RESULT_EVENT = "auth:register-result";
const LOGOUT_RESULT_EVENT = "auth:logout-result";

type AuthResultDetail = { ok?: boolean };

export function AuthFeedbackToast(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [ok, setOk] = useState(true);
  const [message, setMessage] = useState(LOGIN_SUCCESS_MESSAGE);

  useEffect(() => {
    function showToast(msg: string, resultOk: boolean): void {
      setMessage(msg);
      setOk(resultOk);
      setIsOpen(true);
    }

    function handleLoginResult(): void {
      showToast(LOGIN_SUCCESS_MESSAGE, true);
    }

    function handleRegisterResult(): void {
      showToast(REGISTER_SUCCESS_MESSAGE, true);
    }

    function handleLogoutResult(event: Event): void {
      const detail = (event as CustomEvent<AuthResultDetail>).detail;
      const resultOk = detail?.ok !== false;
      showToast(resultOk ? LOGOUT_SUCCESS_MESSAGE : LOGOUT_ERROR_MESSAGE, resultOk);
    }

    window.addEventListener(LOGIN_RESULT_EVENT, handleLoginResult);
    window.addEventListener(REGISTER_RESULT_EVENT, handleRegisterResult);
    window.addEventListener(LOGOUT_RESULT_EVENT, handleLogoutResult);

    return () => {
      window.removeEventListener(LOGIN_RESULT_EVENT, handleLoginResult);
      window.removeEventListener(REGISTER_RESULT_EVENT, handleRegisterResult);
      window.removeEventListener(LOGOUT_RESULT_EVENT, handleLogoutResult);
    };
  }, []);

  return (
    <IonToast
      isOpen={isOpen}
      onDidDismiss={() => setIsOpen(false)}
      message={message}
      icon={ok ? checkmarkCircleOutline : alertCircleOutline}
      duration={2800}
      position="top"
      cssClass={[
        "rapago-session-toast",
        ok
          ? "rapago-session-toast--success"
          : "rapago-session-toast--error",
      ].join(" ")}
    />
  );
}
