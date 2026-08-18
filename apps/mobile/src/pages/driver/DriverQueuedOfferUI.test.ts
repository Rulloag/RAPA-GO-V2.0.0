/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import driverSourceRaw from "./index.tsx?raw";

const driverSource = driverSourceRaw.replace(/\r\n/g, "\n");

// Fase 4 — "Próximo viaje disponible". Sigue el mismo patrón de los demás
// tests de esta página (aserciones sobre el código fuente vía `?raw`): el
// archivo es demasiado grande/entrelazado para montarlo completo con
// testing-library, así que se verifica la presencia y el orden correcto del
// contrato de la nueva funcionalidad en lugar de renderizarla.

describe("UI del conductor — oferta de preasignación encadenada (Fase 4)", () => {
  it("TEST_1/TEST_2: hace polling de la oferta real sólo mientras hay viaje A activo, y la tarjeta se muestra condicionalmente", () => {
    expect(driverSource).toContain("ridesService.getActiveDriverOffer(");
    expect(driverSource).toContain("if (!activeRide || !session?.accessToken) return;");
    expect(driverSource).toContain("window.setInterval(tick, 15_000);");
    expect(driverSource).toContain("!driverQueuedOfferReserved && driverQueuedOffer && (");
    expect(driverSource).toContain("<QueuedOfferModal");
  });

  it("TEST_3: aceptar llama al endpoint real y pasa a estado 'reservado' sin tocar current_ride_id", () => {
    const acceptQueuedSection = driverSource.slice(
      driverSource.indexOf("const handleAcceptDriverQueuedOffer = useCallback("),
      driverSource.indexOf("const handleRejectDriverQueuedOffer = useCallback("),
    );

    expect(acceptQueuedSection).toContain("ridesService.acceptDriverOffer(");
    expect(acceptQueuedSection).toContain("guardCategoryConfirmation(rideData,");
    expect(acceptQueuedSection).toContain("setDriverQueuedOfferReserved(true);");
    expect(acceptQueuedSection).not.toContain("saveDriverActiveRideLocalMirror(");
    expect(acceptQueuedSection).not.toContain("setDriverQueuedOffer(null);");
    expect(driverSource).toContain("Próximo viaje reservado");
    expect(driverSource).toContain("setDriverQueuedOfferReserved(status.queuedRideId != null);");
  });

  it("TEST_4: rechazar llama al endpoint real y la tarjeta desaparece", () => {
    expect(driverSource).toContain("ridesService.rejectDriverOffer(");
    expect(driverSource).toContain("handleRejectDriverQueuedOffer");
    expect(driverSource).toContain("setDriverQueuedOffer(null);");
  });

  it("TEST_5: la oferta expirada se limpia automáticamente vía onExpire", () => {
    expect(driverSource).toContain("onExpire={onDriverQueuedOfferExpire}");
    expect(driverSource).toContain("handleDriverQueuedOfferExpire = useCallback(() => {");
  });

  it("TEST_6: los botones de aceptar/rechazar quedan deshabilitados mientras la request está en curso (sin doble tap)", () => {
    expect(driverSource).toContain("driverQueuedOfferActionLoading) return;");
    expect(driverSource).toContain("disabled={loading}");
    expect(driverSource).toContain("disabled={loading || countdown === 0}");
  });

  it("TEST_7: aceptar B no reemplaza ni desmonta la pantalla de A (misma ActiveRideScreen, mismo ride)", () => {
    // ActiveRideScreen sigue recibiendo `ride: activeRide` (viaje A) sin
    // condicionarlo al estado de la oferta — aceptar B no cambia qué ride se
    // le pasa a la pantalla activa.
    expect(driverSource).toContain("ride: activeRide,");
    expect(driverSource).toContain("driverQueuedOfferReserved,");
  });

  it("TEST_8: B nunca se muestra como driver_en_route en la UI antes de completar A — no hay navegación propia para B en esta fase", () => {
    // La tarjeta sólo usa datos de solo lectura del payload de la oferta
    // (pickup/destino/tarifa/espera estimada) — nunca renderiza un mapa ni
    // inicia navegación hacia B.
    expect(driverSource).not.toContain("UberDriverNavigationMap ride={driverQueuedOffer");
    expect(driverSource).toContain("Este viaje comenzará cuando termines el actual.");
  });

  it("TEST_9: al completar A, el flujo normal existente decide la siguiente pantalla — no se agrega navegación paralela hacia B", () => {
    // Fase 4 no toca completeRide() ni el flujo de refresco de activeRide;
    // cuando el backend activa B (Fase 3), el próximo refresco de
    // `activeRide` ya trae B con su status normal y la MISMA ActiveRideScreen
    // lo renderiza — no existe una pantalla o ruta separada para B.
    expect(driverSource).not.toContain("ROUTES.DRIVER.QUEUED_RIDE");
    expect(driverSource).not.toContain("history.push(`/driver/next-ride");
  });

  it("el estado de la oferta se resetea cuando cambia el viaje activo", () => {
    expect(driverSource).toContain("}, [activeRide?.id]);");
    expect(driverSource).toContain("setDriverQueuedOffer(null);\n    setDriverQueuedOfferReserved(false);");
  });

  it("Fase 4.1: el estado 'reservado' se reconstruye desde backend (driver_statuses.queued_ride_id), no sólo de memoria", () => {
    expect(driverSource).toContain("driverStatusService.getMyStatus(");
    expect(driverSource).toContain("setDriverQueuedOfferReserved(status.queuedRideId != null);");
  });

  it("nunca muestra datos personales del pasajero de A en la tarjeta de B (sólo pickup/destino/tarifa/espera de B)", () => {
    expect(driverSource).not.toContain("driverQueuedOffer.ride.passengerName");
    expect(driverSource).not.toContain("driverQueuedOffer.ride.passengerPhone");
  });
});
