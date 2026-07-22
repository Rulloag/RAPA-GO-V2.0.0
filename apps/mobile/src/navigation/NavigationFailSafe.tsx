import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ROUTES } from "./routes.js";

const CHECK_DELAY_MS = 1800;

function hasVisibleApplicationView(): boolean {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      "ion-page:not(.ion-page-hidden), .ion-page:not(.ion-page-hidden)",
    ),
  );

  return candidates.some((element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || "1") > 0 &&
      rect.width > 4 &&
      rect.height > 4
    );
  });
}

/**
 * Última barrera contra la pantalla negra.
 *
 * Si Ionic no monta ninguna vista visible después de un cambio de URL, se
 * muestra un panel navegable en vez de dejar al usuario frente a un fondo
 * vacío. No reemplaza la página cuando el router funciona correctamente.
 */
export function NavigationFailSafe(): JSX.Element | null {
  const location = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(false);

    const verify = () => {
      setShow(!hasVisibleApplicationView());
    };

    const timeoutId = window.setTimeout(verify, CHECK_DELAY_MS);
    const observer = new MutationObserver(() => {
      if (hasVisibleApplicationView()) setShow(false);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => {
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [location.pathname, location.search]);

  if (!show) return null;

  const go = (path: string) => {
    window.location.assign(path);
  };

  return (
    <div className="rapago-navigation-failsafe" role="alert">
      <div className="rapago-navigation-failsafe__card">
        <strong>RAPA GO no pudo mostrar esta vista</strong>
        <span>Ruta actual: {location.pathname}</span>
        <p>
          Puedes entrar directamente a otra sección. La aplicación ya no se
          quedará mostrando solamente una pantalla negra.
        </p>
        <div className="rapago-navigation-failsafe__actions">
          <button type="button" onClick={() => go(ROUTES.ROOT)}>
            Iniciar sesión
          </button>
          <button type="button" onClick={() => go(ROUTES.AUTH.REGISTER)}>
            Crear cuenta
          </button>
          <button type="button" onClick={() => go(ROUTES.PASSENGER.HOME)}>
            Pasajero
          </button>
          <button type="button" onClick={() => go(ROUTES.DRIVER.HOME)}>
            Conductor
          </button>
          <button type="button" onClick={() => go(ROUTES.ADMIN.HOME)}>
            Administrador
          </button>
        </div>
      </div>
    </div>
  );
}
