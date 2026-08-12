import { describe, expect, it } from "vitest";
import coordinatorSource from "../rideTrackingCoordinator.ts?raw";
import runtimeSource from "../DriverLocationRuntime.tsx?raw";
import driverPageSource from "../../../pages/driver/index.tsx?raw";

/**
 * Cerca arquitectónica: UN SOLO dueño del seguimiento GPS.
 *
 * El bug que motiva este archivo: `driver/index.tsx` montaba su propio
 * `rideLocationService.watch()` y su propio `startNativeBackground()`, en
 * paralelo con `DriverLocationRuntime` (que vive en el layout y sobrevive al
 * cambio de pestaña). Al navegar fuera de la página del conductor, el efecto
 * de la página se desmontaba y ejecutaba `stopNativeBackground()` sin
 * condición, matando el servicio nativo; `DriverLocationRuntime` creía que
 * seguía vivo —lo deducía de un `useRef`— y nunca lo reiniciaba. El
 * seguimiento en segundo plano quedaba muerto el resto del viaje.
 *
 * Como `driver/index.tsx` tiene ~22.000 líneas, una regresión aquí es
 * invisible en revisión. Este test es la única defensa real: falla en CI si
 * alguien vuelve a meter el ciclo de vida del GPS dentro de la página.
 *
 * El dueño único es `rideTrackingCoordinator`, un módulo (no un hook): al no
 * tener `unmount`, ningún componente puede pararlo por accidente.
 *
 * Se lee el fuente con `?raw` (de Vite) en vez de `node:fs` porque el tsconfig
 * de la app no expone los tipos de Node, y añadirlos filtraría globales de
 * Node al código de aplicación.
 */

describe("un solo dueño del seguimiento de ubicación", () => {
  it("la página del conductor no controla el ciclo de vida del seguimiento nativo", () => {
    expect(driverPageSource).not.toContain("startNativeBackground");
    expect(driverPageSource).not.toContain("stopNativeBackground");
  });

  it("la página del conductor no abre su propio watch de GPS", () => {
    // Consume la ubicación por el evento `rapago:driver-native-location`,
    // nunca suscribiéndose al GPS por su cuenta.
    expect(driverPageSource).not.toContain("rideLocationService.watch(");
    expect(driverPageSource).not.toContain("rideLocationService.current(");
  });

  it("el coordinador es el único que arranca y para el seguimiento nativo", () => {
    expect(coordinatorSource).toContain("startNativeBackground");
    expect(coordinatorSource).toContain("stopNativeBackground");
  });

  it("DriverLocationRuntime delega en el coordinador y no publica por su cuenta", () => {
    // Publicar desde el componente reintroduce un segundo publicador.
    expect(runtimeSource).not.toContain("rideLocationService.publish(");
    expect(runtimeSource).not.toContain("rideLocationService.watch(");
    expect(runtimeSource).toContain("rideTrackingCoordinator");
  });

  it("el coordinador decide por getState(), no por un ref en memoria", () => {
    // La causa raíz del bug era comparar contra un useRef en vez de
    // preguntarle al nativo cuál es su estado real.
    expect(coordinatorSource).toContain("getState");
  });
});
