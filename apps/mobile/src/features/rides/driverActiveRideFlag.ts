/**
 * SEÑAL DE "HAY UN VIAJE EN CURSO"
 * --------------------------------
 * Existe para una sola cosa: que la barra superior pueda deshabilitar "Cerrar
 * sesión" mientras el conductor lleva un pasajero. Un conductor sin sesión con
 * alguien a bordo no es un problema de interfaz, es un incidente operativo —
 * pierde la navegación, el contacto con el pasajero y el cierre de pago.
 *
 * Por qué un módulo con evento y no un Context: la barra se monta DENTRO de
 * cada IonPage (los tokens `--rp-*` se resuelven en el IonPage, así que subirla
 * al layout la dejaría sin tema). Envolver toda la app en otro Provider sólo
 * para un booleano obligaría a tocar el árbol de rutas entero. Aquí quien sabe
 * del viaje lo publica, quien lo necesita se suscribe, y nadie más se entera.
 *
 * La verdad sigue siendo el backend: esto es un espejo en memoria de lo que la
 * pantalla de solicitudes ya cargó. Si nunca se publica nada, el valor es
 * `false` y cerrar sesión funciona como siempre — degradar hacia "permitido" es
 * deliberado: un fallo de esta señal no puede dejar a nadie encerrado en su
 * propia sesión.
 */

const DRIVER_ACTIVE_RIDE_EVENT = "rapago:driver-active-ride-flag";

let activeRideId: string | null = null;

export function setDriverActiveRideFlag(rideId: string | null): void {
  const next = rideId ?? null;
  if (next === activeRideId) return;

  activeRideId = next;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DRIVER_ACTIVE_RIDE_EVENT));
  }
}

export function getDriverActiveRideFlag(): boolean {
  return activeRideId !== null;
}

export function subscribeDriverActiveRideFlag(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(DRIVER_ACTIVE_RIDE_EVENT, listener);
  return () => window.removeEventListener(DRIVER_ACTIVE_RIDE_EVENT, listener);
}
