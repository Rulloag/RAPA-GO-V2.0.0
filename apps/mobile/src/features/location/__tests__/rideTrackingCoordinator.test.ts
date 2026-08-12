import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El dueño único del seguimiento GPS.
 *
 * El caso que más importa de este archivo es "getState() dice running:false
 * con viaje activo → reintenta startTracking": es la regresión exacta del bug
 * que motivó toda la Fase 1. Antes, el estado se deducía de un `useRef` en
 * memoria; ahora se pregunta al nativo en cada reconciliación, así que si algo
 * externo mató el servicio, la siguiente pasada lo detecta y lo revive.
 *
 * También cubre la Fase 4: el coordinador empuja el token nuevo al nativo
 * cuando cambia, y refleja `authPaused` (token vencido, pero el GPS sigue
 * capturando y encolando) en su estado público.
 */

const platform = vi.hoisted(() => ({ isNative: true }));

const {
  mockGetState,
  mockUpdateAccessToken,
  mockWatch,
  mockCurrent,
  mockPublish,
  mockStartNativeBackground,
  mockStopNativeBackground,
  mockEnqueue,
  mockFlush,
  mockAppAddListener,
  mockNetworkAddListener,
} = vi.hoisted(() => ({
  mockGetState: vi.fn(),
  mockUpdateAccessToken: vi.fn().mockResolvedValue(undefined),
  mockWatch: vi.fn(),
  mockCurrent: vi.fn(),
  mockPublish: vi.fn().mockResolvedValue({}),
  mockStartNativeBackground: vi.fn().mockResolvedValue(undefined),
  mockStopNativeBackground: vi.fn().mockResolvedValue(undefined),
  mockEnqueue: vi.fn().mockResolvedValue(undefined),
  mockFlush: vi.fn().mockResolvedValue(true),
  mockAppAddListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  mockNetworkAddListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => platform.isNative },
}));

vi.mock("@capacitor/app", () => ({
  App: { addListener: mockAppAddListener },
}));

vi.mock("@capacitor/network", () => ({
  Network: { addListener: mockNetworkAddListener },
}));

vi.mock("../nativeBackgroundLocation.plugin.js", () => ({
  NativeBackgroundLocation: {
    getState: mockGetState,
    updateAccessToken: mockUpdateAccessToken,
  },
}));

vi.mock("../rideLocation.service.js", () => ({
  rideLocationService: {
    watch: mockWatch,
    current: mockCurrent,
    publish: mockPublish,
    startNativeBackground: mockStartNativeBackground,
    stopNativeBackground: mockStopNativeBackground,
  },
}));

vi.mock("../locationQueue.js", () => ({
  locationQueue: { enqueue: mockEnqueue, flush: mockFlush },
}));

const { rideTrackingCoordinator } = await import("../rideTrackingCoordinator.js");

const RIDE_ID = "44444444-4444-4444-8444-444444444444";
const TOKEN_A = "token-a";
const TOKEN_B = "token-b";

const grantedPermissions = {
  platform: "android" as const,
  foreground: "granted" as const,
  coarse: "granted" as const,
  background: "granted" as const,
  notifications: "granted" as const,
  locationServicesEnabled: true,
};

function desired(overrides: Record<string, unknown> = {}) {
  return {
    rideId: RIDE_ID,
    accessToken: TOKEN_A,
    permissions: grantedPermissions,
    ride: { status: "in_progress" },
    ...overrides,
  };
}

function nativeState(overrides: Record<string, unknown> = {}) {
  return {
    running: false,
    rideId: null,
    lastSentAt: null,
    lastError: null,
    authPaused: false,
    ...overrides,
  };
}

async function settle(): Promise<void> {
  // La reconciliación encadena varias promesas resueltas (getState,
  // startNativeBackground, otro getState...): unas pocas vueltas de
  // microtareas bastan para dejarla terminar sin recurrir a temporizadores.
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

describe("rideTrackingCoordinator", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    platform.isNative = true;
    mockAppAddListener.mockResolvedValue({ remove: vi.fn() });
    mockNetworkAddListener.mockResolvedValue({ remove: vi.fn() });
    mockUpdateAccessToken.mockResolvedValue(undefined);
    mockStartNativeBackground.mockResolvedValue(undefined);
    mockStopNativeBackground.mockResolvedValue(undefined);
    mockWatch.mockResolvedValue(vi.fn().mockResolvedValue(undefined));
    mockCurrent.mockResolvedValue({
      lat: 0,
      lng: 0,
      accuracyMeters: 5,
      headingDegrees: null,
      speedMetersPerSecond: null,
      altitudeMeters: null,
      capturedAt: new Date().toISOString(),
      source: "foreground_native",
      appState: "foreground",
      sequenceNumber: null,
      isMocked: false,
    });
    mockGetState.mockResolvedValue(nativeState());
    await rideTrackingCoordinator.__resetForTests();
  });

  afterEach(async () => {
    rideTrackingCoordinator.setDesired(null);
    await settle();
  });

  it("arranca el servicio nativo cuando hay viaje y permisos", async () => {
    mockGetState.mockResolvedValue(nativeState());
    mockStartNativeBackground.mockImplementation(async () => {
      mockGetState.mockResolvedValue(
        nativeState({ running: true, rideId: RIDE_ID }),
      );
    });

    rideTrackingCoordinator.setDesired(desired());
    await settle();

    expect(mockStartNativeBackground).toHaveBeenCalledWith(TOKEN_A, RIDE_ID);
    expect(rideTrackingCoordinator.getStatus().publisher).toBe("native");
  });

  it("REGRESIÓN DEL BUG 1: si getState() dice running:false con viaje activo, reintenta startTracking", async () => {
    /** Debe coincidir con RECONCILE_INTERVAL_MS del módulo. */
    const RECONCILE_INTERVAL_MS = 15_000;

    vi.useFakeTimers();
    try {
      // El nativo confirma que arrancó...
      mockStartNativeBackground.mockImplementation(async () => {
        mockGetState.mockResolvedValue(
          nativeState({ running: true, rideId: RIDE_ID }),
        );
      });

      rideTrackingCoordinator.setDesired(desired());
      await settle();
      expect(rideTrackingCoordinator.getStatus().publisher).toBe("native");

      // ...pero algo externo lo mató: la próxima consulta real dice que no
      // corre. Antes esto era invisible porque el estado se deducía de un
      // useRef en memoria; ahora se pregunta al nativo y se detecta.
      mockGetState.mockResolvedValue(nativeState({ running: false, rideId: null }));
      mockStartNativeBackground.mockClear();
      mockStartNativeBackground.mockImplementation(async () => {
        mockGetState.mockResolvedValue(
          nativeState({ running: true, rideId: RIDE_ID }),
        );
      });

      // Nadie vuelve a llamar setDesired: es el intervalo periódico —sin
      // ningún gatillo externo— el que detecta la caída y revive el servicio.
      vi.advanceTimersByTime(RECONCILE_INTERVAL_MS);
      await settle();

      expect(mockStartNativeBackground).toHaveBeenCalledWith(TOKEN_A, RIDE_ID);
      expect(rideTrackingCoordinator.getStatus().publisher).toBe("native");
    } finally {
      vi.useRealTimers();
    }
  });

  it("no toca el plugin nativo en web", async () => {
    platform.isNative = false;

    rideTrackingCoordinator.setDesired(desired());
    await settle();

    expect(mockStartNativeBackground).not.toHaveBeenCalled();
    expect(mockGetState).not.toHaveBeenCalled();
    expect(rideTrackingCoordinator.getStatus().publisher).toBe("js");
  });

  it("empuja el token nuevo al nativo cuando cambia", async () => {
    mockStartNativeBackground.mockImplementation(async () => {
      mockGetState.mockResolvedValue(
        nativeState({ running: true, rideId: RIDE_ID }),
      );
    });

    rideTrackingCoordinator.setDesired(desired({ accessToken: TOKEN_A }));
    await settle();
    expect(mockUpdateAccessToken).not.toHaveBeenCalled();

    rideTrackingCoordinator.setDesired(desired({ accessToken: TOKEN_B }));
    await settle();

    expect(mockUpdateAccessToken).toHaveBeenCalledWith({ accessToken: TOKEN_B });
  });

  it("no reenvía el mismo token en reconciliaciones repetidas", async () => {
    mockStartNativeBackground.mockImplementation(async () => {
      mockGetState.mockResolvedValue(
        nativeState({ running: true, rideId: RIDE_ID }),
      );
    });

    rideTrackingCoordinator.setDesired(desired({ accessToken: TOKEN_A }));
    await settle();

    // Cambia algo que no es el token: no debería volver a empujarlo.
    rideTrackingCoordinator.setDesired(
      desired({ accessToken: TOKEN_A, ride: { status: "driver_arrived" } }),
    );
    await settle();

    expect(mockUpdateAccessToken).not.toHaveBeenCalled();
  });

  it("refleja authPaused cuando el nativo pausó la entrega por token vencido", async () => {
    mockStartNativeBackground.mockImplementation(async () => {
      mockGetState.mockResolvedValue(
        nativeState({ running: true, rideId: RIDE_ID, authPaused: true }),
      );
    });

    rideTrackingCoordinator.setDesired(desired());
    await settle();

    const status = rideTrackingCoordinator.getStatus();
    expect(status.authPaused).toBe(true);
    expect(status.message).toMatch(/renovando sesión/i);
  });

  it("limpia authPaused cuando el nativo ya no lo reporta", async () => {
    mockStartNativeBackground.mockImplementation(async () => {
      mockGetState.mockResolvedValue(
        nativeState({ running: true, rideId: RIDE_ID, authPaused: true }),
      );
    });
    rideTrackingCoordinator.setDesired(desired());
    await settle();
    expect(rideTrackingCoordinator.getStatus().authPaused).toBe(true);

    mockGetState.mockResolvedValue(
      nativeState({ running: true, rideId: RIDE_ID, authPaused: false }),
    );
    rideTrackingCoordinator.setDesired(
      desired({ ride: { status: "driver_arrived" } }),
    );
    await settle();

    expect(rideTrackingCoordinator.getStatus().authPaused).toBe(false);
    expect(rideTrackingCoordinator.getStatus().message).toBeNull();
  });

  it("desmontar un componente no llama a stop: solo setDesired(null) lo hace", async () => {
    mockStartNativeBackground.mockImplementation(async () => {
      mockGetState.mockResolvedValue(
        nativeState({ running: true, rideId: RIDE_ID }),
      );
    });
    rideTrackingCoordinator.setDesired(desired());
    await settle();

    // Suscribirse y desuscribirse simula un componente que se monta y
    // desmonta: el coordinador es un módulo, no un hook, y esto no debe
    // afectar el seguimiento.
    const unsubscribe = rideTrackingCoordinator.subscribe(() => {});
    unsubscribe();
    await settle();

    expect(mockStopNativeBackground).not.toHaveBeenCalled();
    expect(rideTrackingCoordinator.getStatus().publisher).toBe("native");
  });

  it("para y drena la cola cuando el viaje termina", async () => {
    mockStartNativeBackground.mockImplementation(async () => {
      mockGetState.mockResolvedValue(
        nativeState({ running: true, rideId: RIDE_ID }),
      );
    });
    rideTrackingCoordinator.setDesired(desired());
    await settle();

    rideTrackingCoordinator.setDesired(null);
    await settle();

    expect(mockStopNativeBackground).toHaveBeenCalledTimes(1);
    expect(mockFlush).toHaveBeenCalledWith(TOKEN_A);
    expect(rideTrackingCoordinator.getStatus().publisher).toBe("none");
  });

  it("encola el punto cuando falla la publicación por JS", async () => {
    let onPoint: ((point: unknown) => void) | null = null;
    mockWatch.mockImplementation(async (cb: (point: unknown) => void) => {
      onPoint = cb;
      return vi.fn().mockResolvedValue(undefined);
    });
    mockPublish.mockRejectedValue(new Error("network down"));

    // Sin permiso de background: el publicador queda en JS.
    rideTrackingCoordinator.setDesired(
      desired({ permissions: { ...grantedPermissions, background: "denied" } }),
    );
    await settle();

    expect(rideTrackingCoordinator.getStatus().publisher).toBe("js");
    expect(onPoint).not.toBeNull();

    onPoint?.({
      lat: -27.15,
      lng: -109.43,
      accuracyMeters: 5,
      headingDegrees: null,
      speedMetersPerSecond: null,
      altitudeMeters: null,
      capturedAt: new Date().toISOString(),
      source: "web",
      appState: "foreground",
      sequenceNumber: null,
      isMocked: false,
    });
    await settle();

    expect(mockEnqueue).toHaveBeenCalledWith(RIDE_ID, expect.objectContaining({ lat: -27.15 }));
  });
});
