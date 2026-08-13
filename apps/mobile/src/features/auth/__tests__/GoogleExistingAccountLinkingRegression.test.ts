/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import authTypesSource from "../auth.types.ts?raw";
import hookSource from "../useGoogleSignIn.ts?raw";
import loginSource from "../LoginPage.tsx?raw";
import linkModalSource from "../GoogleExistingAccountLinkModal.tsx?raw";
import backupPasswordModalSource from "../GoogleBackupPasswordModal.tsx?raw";
import tripsSource from "../../../pages/passenger/pages/TripsPage.tsx?raw";

describe("Google existing-account linking and cancelled cleanup", () => {
  it("keeps the Google ID token in memory while asking once for the RAPA GO password", () => {
    expect(authTypesSource).toContain("linkPassword?: string");
    expect(hookSource).toContain("pendingTokenRef.current = idToken");
    expect(hookSource).toContain("linkPassword: cleanPassword");
    expect(hookSource).toContain("setLinkOpen(true)");
    expect(loginSource).toContain("<GoogleExistingAccountLinkModal");
    expect(linkModalSource).toContain("Vincular Google y entrar");
    expect(linkModalSource).toContain(
      "Encontramos una cuenta RAPA GO existente con este correo.",
    );
    expect(linkModalSource).toContain("Vincular Google y entrar");
  });


  it("prompts for a RAPA GO backup password after Google authenticates a passwordless account", () => {
    expect(hookSource).toContain('{ kind: "password_required", role }');
    expect(hookSource).toContain("response.session.user.hasPassword === false");
    expect(hookSource).toContain("authService.createPassword");
    expect(hookSource).toContain("await refreshSession()");
    expect(loginSource).toContain("<GoogleBackupPasswordModal");
    expect(backupPasswordModalSource).toContain("Google ya está conectado");
    expect(backupPasswordModalSource).toContain("Guardar contraseña y entrar");
    expect(backupPasswordModalSource).toContain("Perfil → Seguridad");
  });

  it("does not create a second client-side profile while linking", () => {
    expect(linkModalSource).toContain(
      "no cambia tu contraseña ni crea una segunda",
    );
    expect(hookSource).toContain("signInWithGoogle({");
    expect(hookSource).not.toContain("persistPassengerProfile");
  });

  it("shows cancelled rides for ten minutes and then removes them automatically from Mis Viajes counters", () => {
    expect(tripsSource).toContain(
      "PASSENGER_CANCELLED_VISIBILITY_MS = 10 * 60 * 1000",
    );
    expect(tripsSource).toContain(
      "PASSENGER_CANCELLED_VISIBILITY_TICK_MS = 15 * 1000",
    );
    expect(tripsSource).toContain(
      "isPassengerCancelledRideVisibleForTenMinutes",
    );
    expect(tripsSource).toContain(
      "const ridesVisibleInTrips = allRides.filter",
    );
    expect(tripsSource).toContain(
      "all:       ridesVisibleInTrips.length",
    );
    expect(tripsSource).toContain(
      "El historial permanente sigue guardado en backend/BD",
    );
  });
});
