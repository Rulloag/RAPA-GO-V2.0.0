import { useEffect, useState } from "react";
import { IonToast } from "@ionic/react";
import { alertCircleOutline, checkmarkCircleOutline } from "ionicons/icons";

/**
 * Protocolo de sesión — feedback de cierre de sesión.
 *
 * Escucha el evento global "auth:logout-result" (emitido por AuthProvider)
 * y muestra el mensaje correspondiente:
 *  - Éxito: "Haz cerrado sesión correctamente"
 *  - Error: "Ha Habido un problema para cerrar sesión"
 */

export const LOGOUT_SUCCESS_MESSAGE = "Haz cerrado sesión correctamente";
export const LOGOUT_ERROR_MESSAGE = "Ha Habido un problema para cerrar sesión";

const LOGOUT_RESULT_EVENT = "auth:logout-result";

type LogoutResultDetail = { ok?: boolean };

export function SessionLogoutToast(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    function handleLogoutResult(event: Event): void {
      const detail = (event as CustomEvent<LogoutResultDetail>).detail;
      setOk(detail?.ok !== false);
      setIsOpen(true);
    }

    window.addEventListener(LOGOUT_RESULT_EVENT, handleLogoutResult);

    return () => {
      window.removeEventListener(LOGOUT_RESULT_EVENT, handleLogoutResult);
    };
  }, []);

  return (
    <IonToast
      isOpen={isOpen}
      onDidDismiss={() => setIsOpen(false)}
      message={ok ? LOGOUT_SUCCESS_MESSAGE : LOGOUT_ERROR_MESSAGE}
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
