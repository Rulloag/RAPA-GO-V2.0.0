/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import loginSource from "../../../features/auth/LoginPage.tsx?raw";
import socialSetupSource from "../../../features/auth/PassengerSocialSetupForm.tsx?raw";
import googleSetupSource from "../../../features/auth/GoogleAccountSetupModal.tsx?raw";
import appleSetupSource from "../../../features/auth/AppleAccountSetupModal.tsx?raw";
import ridesServiceSource from "../../../features/rides/rides.service.ts?raw";
import tripsSource from "./TripsPage.tsx?raw";

describe("puntos 8, 10 y 11 solicitados para pasajero", () => {
  it("ordena Apple primero, Google segundo y crear cuenta por correo tercero", () => {
    expect(loginSource).toContain('data-auth-order="apple-google-email"');

    const authBlock = loginSource.slice(
      loginSource.indexOf('data-auth-order="apple-google-email"'),
    );
    const appleIndex = authBlock.indexOf("<AppleSignInButton");
    const googleIndex = authBlock.indexOf("<GoogleSignInButton");
    const emailCreateIndex = authBlock.indexOf("rapago-auth-create-email");
    const emailLoginIndex = authBlock.indexOf("rapago-auth-divider");

    expect(appleIndex).toBeGreaterThan(-1);
    expect(googleIndex).toBeGreaterThan(appleIndex);
    expect(emailCreateIndex).toBeGreaterThan(googleIndex);
    expect(emailLoginIndex).toBeGreaterThan(emailCreateIndex);
  });

  it("pide Nombre, Correo, Celular y RUT/Pasaporte en Apple y Google", () => {
    expect(socialSetupSource).toContain("Nombre *");
    expect(socialSetupSource).toContain("Correo electrónico *");
    expect(socialSetupSource).toContain("Celular *");
    expect(socialSetupSource).toContain("RUT *");
    expect(googleSetupSource).toContain("displayName: cleanDisplayName");
    expect(appleSetupSource).toContain("displayName: cleanDisplayName");
    expect(googleSetupSource).toContain("Ingresa tu nombre y apellido para continuar.");
    expect(appleSetupSource).toContain("Ingresa tu nombre y apellido para continuar.");
  });

  it("muestra viajes finalizados con la ruta GPS histórica real y conserva cancelados", () => {
    expect(ridesServiceSource).toContain("/rides/${rideId}/route-history");
    expect(tripsSource).toContain("PassengerHistoricalRouteMap");
    expect(tripsSource).toContain("Ruta GPS real registrada");
    expect(tripsSource).toContain("No hay suficientes puntos GPS para reconstruir completamente este recorrido.");
    expect(tripsSource).toContain("Sin trazado GPS guardado");
    expect(tripsSource).toContain('data-final-trip-record="true"');
    expect(tripsSource).toContain("NO SHOW");
    expect(tripsSource).toContain("historial permanente");
    expect(tripsSource).not.toContain("CANCELLED_RIDE_EXPIRATION_MS");
  });
});
