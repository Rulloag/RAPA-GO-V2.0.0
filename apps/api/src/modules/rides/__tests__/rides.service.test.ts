import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyAccessToken = vi.fn();
const mockHashToken = vi.fn();
const mockIsSessionValid = vi.fn();
const mockFindUserById = vi.fn();

const mockCreateWithApprovedPolicyCharges = vi.fn();
const mockFindById = vi.fn();
const mockFindByIdAndPassenger = vi.fn();
const mockFindByPassengerIdWithDriver = vi.fn();
const mockFindByDriverId = vi.fn();
const mockFindAvailable = vi.fn();
const mockAccept = vi.fn();
const mockComplete = vi.fn();
const mockStart = vi.fn();
const mockCancel = vi.fn();
const mockCancelAccepted = vi.fn();
const mockMarkEnRoute = vi.fn();
const mockMarkArrived = vi.fn();
const mockMarkNoShow = vi.fn();
const mockCreatePolicyCharge = vi.fn();
const mockMarkPolicyChargePaidByCardCapture = vi.fn();

const mockReleaseDriverAfterRide = vi.fn();
const mockAssertDriverCanAcceptRide = vi.fn();

const mockFindSuccessfulPaymentByRideId = vi.fn();
const mockFindApprovedByRideId = vi.fn();
const mockFindPaymentByRideId = vi.fn();
const mockCaptureAuthorizedKlapPayment = vi.fn();
const mockRefundCardPaymentForCancelledRide = vi.fn();
const mockFareFindByType = vi.fn();
const mockFareFindZoneByRoute = vi.fn();
const mockFindReferralUse = vi.fn();

const mockAuditRecordSafe = vi.fn();
const mockNotifyAssigned = vi.fn();
const mockNotifyEnRoute = vi.fn();
const mockNotifyArrived = vi.fn();
const mockNotifyCompleted = vi.fn();

vi.mock("../../auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken: mockVerifyAccessToken,
    hashToken: mockHashToken,
  })),
}));

vi.mock("../../auth/session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    isSessionValid: mockIsSessionValid,
  })),
}));

vi.mock("../../users/users.repository.js", () => ({
  UsersRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindUserById,
  })),
}));

vi.mock("../rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    createWithApprovedPolicyCharges: mockCreateWithApprovedPolicyCharges,
    findById: mockFindById,
    findByIdAndPassenger: mockFindByIdAndPassenger,
    findByPassengerIdWithDriver: mockFindByPassengerIdWithDriver,
    findByDriverId: mockFindByDriverId,
    findAvailable: mockFindAvailable,
    accept: mockAccept,
    complete: mockComplete,
    start: mockStart,
    cancel: mockCancel,
    cancelAccepted: mockCancelAccepted,
    markEnRoute: mockMarkEnRoute,
    markArrived: mockMarkArrived,
    markNoShow: mockMarkNoShow,
    createPolicyCharge: mockCreatePolicyCharge,
    markPolicyChargePaidByCardCapture:
      mockMarkPolicyChargePaidByCardCapture,
  })),
}));

vi.mock("../../drivers/driverCompliance.service.js", () => ({
  DriverComplianceService: vi.fn().mockImplementation(() => ({
    releaseDriverAfterRide: mockReleaseDriverAfterRide,
    assertDriverCanAcceptRide: mockAssertDriverCanAcceptRide,
  })),
}));

vi.mock("../../drivers/driverStatus.repository.js", () => ({
  DriverStatusRepository: vi.fn().mockImplementation(() => ({
    setBusy: vi.fn(),
    setAvailable: vi.fn(),
  })),
}));

vi.mock("../rideStops.repository.js", () => ({
  RideStopsRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../rideAssignmentOffers.repository.js", () => ({
  RideAssignmentOffersRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../wallet/wallet.repository.js", () => ({
  WalletRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../fareSettings/fareSettings.repository.js", () => ({
  FareSettingsRepository: vi.fn().mockImplementation(() => ({
    findByType: mockFareFindByType,
    findZoneFareByRoute: mockFareFindZoneByRoute,
  })),
}));

vi.mock("../../payments/payments.repository.js", () => ({
  PaymentsRepository: vi.fn().mockImplementation(() => ({
    findSuccessfulByRideId: mockFindSuccessfulPaymentByRideId,
    findApprovedByRideId: mockFindApprovedByRideId,
    findByRideId: mockFindPaymentByRideId,
  })),
}));

vi.mock("../../payments/payments.service.js", () => ({
  PaymentsService: vi.fn().mockImplementation(() => ({
    captureAuthorizedKlapPayment: mockCaptureAuthorizedKlapPayment,
    refundCardPaymentForCancelledRide: mockRefundCardPaymentForCancelledRide,
  })),
}));

vi.mock("../../referrals/referrals.repository.js", () => ({
  ReferralsRepository: vi.fn().mockImplementation(() => ({
    findUseByReferredUserId: mockFindReferralUse,
  })),
}));

vi.mock("../../audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({
    recordSafe: mockAuditRecordSafe,
  })),
}));

vi.mock("../../notifications/notifications.helpers.js", () => ({
  notifyPassengerDriverAssigned: mockNotifyAssigned,
  notifyPassengerDriverEnRoute: mockNotifyEnRoute,
  notifyPassengerDriverArrived: mockNotifyArrived,
  notifyPassengerRideCompleted: mockNotifyCompleted,
}));

vi.mock("../../rideReceipts/rideReceipts.service.js", () => ({
  rideReceiptsService: {
    queueCancelledRide: vi.fn().mockResolvedValue(null),
    queueCompletedRide: vi.fn().mockResolvedValue(null),
    queuePolicyCharge: vi.fn().mockResolvedValue(null),
    queueNoShowRide: vi.fn().mockResolvedValue(null),
  },
}));

const { RidesService } = await import("../rides.service.js");

const NOW = new Date("2026-07-23T12:00:00.000Z");

function makeRide(overrides: Record<string, unknown> = {}) {
  return {
    id: "ride-1",
    passengerUserId: "user-123",
    driverUserId: null,
    originText: "Hanga Roa",
    destinationText: "Aeropuerto Mataveri",
    notes: "PaymentMethod: cash",
    estimatedFareClp: 5000,
    paymentMethod: "cash",
    paymentProvider: null,
    walletBenefitRequested: false,
    walletBenefitAppliedClp: 0,
    walletBenefitReversedClp: 0,
    walletBenefitReversedAt: null,
    fareBeforeWalletBenefitClp: 5000,
    originLat: null,
    originLng: null,
    destinationLat: null,
    destinationLng: null,
    distanceMeters: null,
    durationSeconds: null,
    fareCalculationSource: "server_estimate",
    status: "requested",
    requestedAt: NOW,
    acceptedAt: null,
    enRouteAt: null,
    arrivedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    cancelledByUserId: null,
    cancelledByRole: null,
    isOfflineBooking: null,
    offlinePassengerName: null,
    offlinePassengerPhone: null,
    offlinePassengerEmail: null,
    rideType: "immediate",
    scheduledPickupAt: null,
    priorityFeeClp: null,
    flightNumber: null,
    preferredDriverGender: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeNoShowCharge(overrides: Record<string, unknown> = {}) {
  return {
    id: "charge-1",
    sourceRideId: "ride-1",
    ownerUserId: "user-123",
    type: "no_show",
    status: "pending_admin_review",
    paymentMethod: "cash",
    applicableFareClp: 12000,
    feePercent: 50,
    feeCapClp: 5000,
    calculatedAmountClp: 5000,
    approvedAmountClp: null,
    reason: "Pasajero no se presentó después de 5 minutos.",
    adminDecisionReason: null,
    reviewedByUserId: null,
    reviewedAt: null,
    appliedToRideId: null,
    appliedAt: null,
    settledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const IMMEDIATE_CASH_INPUT = {
  originText: "Hanga Roa",
  destinationText: "Aeropuerto Mataveri",
  paymentMethod: "cash" as const,
};

describe("RidesService - contrato actual", () => {
  let service: InstanceType<typeof RidesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["KLAP_DEFERRED_CAPTURE_ENABLED"] = "true";
    process.env["KLAP_CAPTURE_CONTRACT_CONFIRMED"] = "true";

    mockVerifyAccessToken.mockReturnValue({ sub: "user-123" });
    mockHashToken.mockReturnValue("token-hash");
    mockIsSessionValid.mockResolvedValue(true);
    mockFindUserById.mockResolvedValue({
      id: "user-123",
      role: "passenger",
    });

    mockFareFindByType.mockResolvedValue(null);
    mockFareFindZoneByRoute.mockResolvedValue(null);
    mockFindReferralUse.mockResolvedValue(null);
    mockFindSuccessfulPaymentByRideId.mockResolvedValue(null);
    mockFindApprovedByRideId.mockResolvedValue(null);
    mockFindPaymentByRideId.mockResolvedValue(null);
    mockCaptureAuthorizedKlapPayment.mockResolvedValue({ ok: true, status: "success" });
    mockMarkPolicyChargePaidByCardCapture.mockImplementation(
      async ({ capturedAmountClp }: { capturedAmountClp: number }) =>
        makeNoShowCharge({
          status: "paid",
          paymentMethod: "card",
          approvedAmountClp: capturedAmountClp,
          settledAt: NOW,
        }),
    );
    mockRefundCardPaymentForCancelledRide.mockResolvedValue({
      ok: true,
      processed: false,
      refunded: false,
    });
    mockFindByPassengerIdWithDriver.mockResolvedValue([]);
    mockFindByDriverId.mockResolvedValue([]);
    mockFindAvailable.mockResolvedValue([]);
    mockReleaseDriverAfterRide.mockResolvedValue(undefined);
    mockAssertDriverCanAcceptRide.mockResolvedValue(undefined);

    mockCreateWithApprovedPolicyCharges.mockImplementation(
      async (
        passengerUserId: string,
        originText: string,
        destinationText: string,
        notes: string | null,
        baseEstimatedFareClp: number,
        initialStatus: "requested" | "pending_payment",
        options: {
          paymentMethod?: "cash" | "card";
          paymentProvider?: string | null;
          useWalletBenefit?: boolean;
        },
      ) => ({
        ride: makeRide({
          passengerUserId,
          originText,
          destinationText,
          notes,
          estimatedFareClp: baseEstimatedFareClp,
          fareBeforeWalletBenefitClp: baseEstimatedFareClp,
          status: initialStatus,
          paymentMethod: options.paymentMethod ?? null,
          paymentProvider: options.paymentProvider ?? null,
          walletBenefitRequested: options.useWalletBenefit === true,
        }),
        appliedChargesTotalClp: 0,
        appliedCharges: [],
        fareBeforeWalletBenefitClp: baseEstimatedFareClp,
        walletBenefitRequested: options.useWalletBenefit === true,
        walletBenefitAppliedClp: 0,
        walletBenefitRemainingClp: 0,
      }),
    );

    service = new RidesService();
  });

  describe("autenticacion", () => {
    it("rechaza una sesion revocada", async () => {
      mockIsSessionValid.mockResolvedValue(false);

      const result = await service.createRideRequest(
        "token",
        IMMEDIATE_CASH_INPUT,
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("AUTH_SESSION_REVOKED");
      expect(result.statusCode).toBe(401);
    });

    it("rechaza un rol administrativo al crear un viaje", async () => {
      mockFindUserById.mockResolvedValue({
        id: "admin-1",
        role: "admin",
      });

      const result = await service.createRideRequest(
        "token",
        IMMEDIATE_CASH_INPUT,
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("AUTH_FORBIDDEN");
      expect(result.statusCode).toBe(403);
      expect(mockCreateWithApprovedPolicyCharges).not.toHaveBeenCalled();
    });

    it("permite que un conductor utilice la aplicacion como usuario", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      const result = await service.createRideRequest(
        "token",
        IMMEDIATE_CASH_INPUT,
      );

      expect(result.ok).toBe(true);
      expect(mockCreateWithApprovedPolicyCharges).toHaveBeenCalledWith(
        "driver-1",
        "Hanga Roa",
        "Aeropuerto Mataveri",
        expect.anything(),
        expect.any(Number),
        "requested",
        expect.objectContaining({ paymentMethod: "cash" }),
      );
    });
  });

  describe("creacion de viajes", () => {
    it("crea un viaje inmediato en efectivo como requested", async () => {
      const result = await service.createRideRequest(
        "token",
        IMMEDIATE_CASH_INPUT,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.ride.status).toBe("requested");
      expect(result.ride.paymentMethod).toBe("cash");
      expect(result.ride.estimatedFareClp).toBeGreaterThan(0);

      expect(mockCreateWithApprovedPolicyCharges).toHaveBeenCalledWith(
        "user-123",
        "Hanga Roa",
        "Aeropuerto Mataveri",
        expect.stringContaining("PaymentMethod: cash"),
        expect.any(Number),
        "requested",
        {
          paymentMethod: "cash",
          paymentProvider: null,
          useWalletBenefit: false,
        },
      );
    });

    it("crea un viaje con tarjeta como pending_payment", async () => {
      const result = await service.createRideRequest("token", {
        originText: "Hanga Roa",
        destinationText: "Anakena",
        paymentMethod: "card",
        paymentProvider: "mercadopago",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.ride.status).toBe("pending_payment");
      expect(result.ride.paymentMethod).toBe("card");
      expect(result.ride.paymentProvider).toBe("mercadopago");

      expect(mockCreateWithApprovedPolicyCharges).toHaveBeenCalledWith(
        "user-123",
        "Hanga Roa",
        "Anakena",
        expect.stringContaining("PaymentProvider: mercadopago"),
        expect.any(Number),
        "pending_payment",
        {
          paymentMethod: "card",
          paymentProvider: "mercadopago",
          useWalletBenefit: false,
        },
      );
    });

    it("permite usar Beneficio en un viaje con tarjeta", async () => {
      const result = await service.createRideRequest("token", {
        originText: "Hanga Roa",
        destinationText: "Anakena",
        paymentMethod: "card",
        paymentProvider: "klap",
        useWalletBenefit: true,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.ride.walletBenefitRequested).toBe(true);
      expect(mockCreateWithApprovedPolicyCharges).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.anything(),
        expect.any(Number),
        "pending_payment",
        expect.objectContaining({
          paymentMethod: "card",
          paymentProvider: "klap",
          useWalletBenefit: true,
        }),
      );
    });

    it("permite solicitar Beneficio con efectivo", async () => {
      const result = await service.createRideRequest("token", {
        ...IMMEDIATE_CASH_INPUT,
        useWalletBenefit: true,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.ride.walletBenefitRequested).toBe(true);

      expect(mockCreateWithApprovedPolicyCharges).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.anything(),
        expect.any(Number),
        "requested",
        expect.objectContaining({
          paymentMethod: "cash",
          useWalletBenefit: true,
        }),
      );
    });

    it("rechaza un viaje agendado sin tarjeta", async () => {
      const pickup = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const result = await service.createRideRequest("token", {
        originText: "Hotel",
        destinationText: "Aeropuerto",
        rideMode: "scheduled",
        scheduledPickupAt: pickup,
        paymentMethod: "cash",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("SCHEDULED_RIDE_REQUIRES_CARD");
      expect(result.statusCode).toBe(400);
    });

    it("guarda la metadata de una reserva con tarjeta", async () => {
      const pickup = new Date(Date.now() + 90 * 60 * 1000).toISOString();

      const result = await service.createRideRequest("token", {
        originText: "Hotel",
        destinationText: "Aeropuerto",
        rideMode: "scheduled",
        tripFareMode: "one_way",
        scheduledPickupAt: pickup,
        paymentMethod: "card",
        paymentProvider: "mercadopago",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.ride.status).toBe("pending_payment");
      expect((result.ride as Record<string, unknown>)["isScheduled"]).toBe(
        true,
      );
      expect((result.ride as Record<string, unknown>)["rideMode"]).toBe(
        "scheduled",
      );
      expect(
        (result.ride as Record<string, unknown>)["scheduledPickupAt"],
      ).toBe(pickup);

      const notes =
        mockCreateWithApprovedPolicyCharges.mock.calls[0]?.[3];

      expect(notes).toContain("Tipo de solicitud: viaje agendado.");
      expect(notes).toContain(
        `Fecha y hora de recogida agendada: ${pickup}`,
      );
      expect(notes).toContain("PaymentMethod: card");
    });

    it("rechaza un proveedor no permitido para una reserva", async () => {
      const pickup = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const result = await service.createRideRequest("token", {
        originText: "Hotel",
        destinationText: "Aeropuerto",
        rideMode: "scheduled",
        scheduledPickupAt: pickup,
        paymentMethod: "card",
        paymentProvider: "proveedor-falso",
      } as never);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("INVALID_PAYMENT_PROVIDER");
      expect(result.statusCode).toBe(400);
    });
  });

  describe("seguimiento del estado del viaje", () => {
    it("permite al conductor marcar en camino", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      mockFindById.mockResolvedValue(
        makeRide({
          status: "accepted",
          driverUserId: "driver-1",
          notes: "PaymentMethod: cash",
        }),
      );

      mockMarkEnRoute.mockResolvedValue(
        makeRide({
          status: "driver_en_route",
          driverUserId: "driver-1",
          enRouteAt: NOW,
        }),
      );

      const result = await service.markEnRoute("token", "ride-1");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.ride.status).toBe("driver_en_route");
      expect(mockMarkEnRoute).toHaveBeenCalledWith(
        "ride-1",
        "driver-1",
      );
      expect(mockAuditRecordSafe).toHaveBeenCalled();
    });

    it("bloquea en camino si la tarjeta no tiene pago aprobado", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      mockFindById.mockResolvedValue(
        makeRide({
          status: "accepted",
          driverUserId: "driver-1",
          notes:
            "PaymentMethod: card\nPaymentProvider: mercadopago",
          paymentMethod: "card",
        }),
      );

      mockFindSuccessfulPaymentByRideId.mockResolvedValue(null);
    mockFindApprovedByRideId.mockResolvedValue(null);
    mockFindPaymentByRideId.mockResolvedValue(null);
    mockCaptureAuthorizedKlapPayment.mockResolvedValue({ ok: true, status: "success" });

      const result = await service.markEnRoute("token", "ride-1");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("PAYMENT_NOT_APPROVED");
      expect(result.statusCode).toBe(409);
      expect(mockMarkEnRoute).not.toHaveBeenCalled();
    });

    it("permite al conductor marcar que llego al origen", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      mockFindById.mockResolvedValue(
        makeRide({
          status: "driver_en_route",
          driverUserId: "driver-1",
          notes: "PaymentMethod: cash",
        }),
      );

      mockMarkArrived.mockResolvedValue(
        makeRide({
          status: "driver_arrived",
          driverUserId: "driver-1",
          arrivedAt: NOW,
        }),
      );

      const result = await service.markArrived("token", "ride-1");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.ride.status).toBe("driver_arrived");
      expect(mockMarkArrived).toHaveBeenCalledWith(
        "ride-1",
        "driver-1",
      );
    });

    it("permite completar el viaje y libera al conductor", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      mockFindById.mockResolvedValue(
        makeRide({
          status: "in_progress",
          driverUserId: "driver-1",
          notes: "PaymentMethod: cash",
        }),
      );

      mockComplete.mockResolvedValue(
        makeRide({
          status: "completed",
          driverUserId: "driver-1",
          completedAt: NOW,
        }),
      );

      const result = await service.completeRide("token", "ride-1");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.ride.status).toBe("completed");
      expect(mockReleaseDriverAfterRide).toHaveBeenCalledWith(
        "driver-1",
      );
      expect(mockCaptureAuthorizedKlapPayment).not.toHaveBeenCalled();
    });

    it("al completar un viaje Klap autorizado, dispara la captura diferida", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      mockFindById.mockResolvedValue(
        makeRide({
          status: "in_progress",
          driverUserId: "driver-1",
          notes: "PaymentMethod: card\nPaymentProvider: klap",
          paymentMethod: "card",
        }),
      );
      mockFindApprovedByRideId.mockResolvedValue({ id: "payment-1", status: "authorized" });

      mockComplete.mockResolvedValue(
        makeRide({
          status: "completed",
          driverUserId: "driver-1",
          completedAt: NOW,
        }),
      );

      mockFindPaymentByRideId.mockResolvedValue({
        id: "payment-1",
        provider: "klap",
        status: "authorized",
      });

      const result = await service.completeRide("token", "ride-1");

      expect(result.ok).toBe(true);
      expect(mockCaptureAuthorizedKlapPayment).toHaveBeenCalledWith(
        "payment-1",
        {
          outcome: "completed",
          finalRideAmountClp: 5000,
          authorizationExpired: false,
        },
      );
    });

    it("nunca dispara la captura Klap al completar un viaje en efectivo", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      mockFindById.mockResolvedValue(
        makeRide({
          status: "in_progress",
          driverUserId: "driver-1",
          notes: "PaymentMethod: cash",
        }),
      );

      mockComplete.mockResolvedValue(
        makeRide({
          status: "completed",
          driverUserId: "driver-1",
          completedAt: NOW,
        }),
      );

      mockFindPaymentByRideId.mockResolvedValue(null);

      const result = await service.completeRide("token", "ride-1");

      expect(result.ok).toBe(true);
      expect(mockCaptureAuthorizedKlapPayment).not.toHaveBeenCalled();
    });

    it("nunca dispara la captura Klap al completar un viaje pagado con Mercado Pago (success, no authorized)", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      mockFindById.mockResolvedValue(
        makeRide({
          status: "in_progress",
          driverUserId: "driver-1",
          notes: "PaymentMethod: card\nPaymentProvider: mercadopago",
          paymentMethod: "card",
        }),
      );
      mockFindApprovedByRideId.mockResolvedValue({ id: "payment-2", status: "success" });

      mockComplete.mockResolvedValue(
        makeRide({
          status: "completed",
          driverUserId: "driver-1",
          completedAt: NOW,
        }),
      );

      mockFindPaymentByRideId.mockResolvedValue({
        id: "payment-2",
        provider: "mercadopago",
        status: "success",
      });

      const result = await service.completeRide("token", "ride-1");

      expect(result.ok).toBe(true);
      expect(mockCaptureAuthorizedKlapPayment).not.toHaveBeenCalled();
    });

    it("un pago Klap ya success al completar el viaje no repite la captura", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      mockFindById.mockResolvedValue(
        makeRide({
          status: "in_progress",
          driverUserId: "driver-1",
          notes: "PaymentMethod: card\nPaymentProvider: klap",
          paymentMethod: "card",
        }),
      );
      mockFindApprovedByRideId.mockResolvedValue({ id: "payment-3", status: "success" });

      mockComplete.mockResolvedValue(
        makeRide({
          status: "completed",
          driverUserId: "driver-1",
          completedAt: NOW,
        }),
      );

      mockFindPaymentByRideId.mockResolvedValue({
        id: "payment-3",
        provider: "klap",
        status: "success",
      });

      const result = await service.completeRide("token", "ride-1");

      expect(result.ok).toBe(true);
      expect(mockCaptureAuthorizedKlapPayment).not.toHaveBeenCalled();
    });

    it("un error de captura Klap nunca deshace ni reabre el viaje ya completado", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      mockFindById.mockResolvedValue(
        makeRide({
          status: "in_progress",
          driverUserId: "driver-1",
          notes: "PaymentMethod: card\nPaymentProvider: klap",
          paymentMethod: "card",
        }),
      );
      mockFindApprovedByRideId.mockResolvedValue({ id: "payment-4", status: "authorized" });

      mockComplete.mockResolvedValue(
        makeRide({
          status: "completed",
          driverUserId: "driver-1",
          completedAt: NOW,
        }),
      );

      mockFindPaymentByRideId.mockResolvedValue({
        id: "payment-4",
        provider: "klap",
        status: "authorized",
      });
      mockCaptureAuthorizedKlapPayment.mockRejectedValue(new Error("capture blew up"));

      const result = await service.completeRide("token", "ride-1");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.ride.status).toBe("completed");
    });
  });

  describe("Klap cancellation settlement", () => {
    it("marks a captured late-cancellation charge as paid", async () => {
      const existing = makeRide({
        status: "accepted",
        driverUserId: "driver-1",
        acceptedAt: new Date(Date.now() - 2 * 60 * 1000),
        estimatedFareClp: 500,
        notes: "PaymentMethod: card\nPaymentProvider: klap",
        paymentMethod: "card",
        paymentProvider: "klap",
      });

      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue(
        makeRide({
          ...existing,
          status: "cancelled",
          cancelledAt: NOW,
          cancelledByUserId: "user-123",
          cancelledByRole: "passenger",
        }),
      );
      mockCreatePolicyCharge.mockResolvedValue(
        makeNoShowCharge({
          type: "late_cancellation",
          paymentMethod: "card",
          applicableFareClp: 500,
          feePercent: 30,
          feeCapClp: 3000,
          calculatedAmountClp: 150,
        }),
      );
      mockRefundCardPaymentForCancelledRide.mockResolvedValue({
        ok: true,
        processed: true,
        refunded: false,
        paymentId: "payment-cancel",
        capturedCancellationFeeClp: 150,
        remainderReleaseRequired: false,
      });
      mockMarkPolicyChargePaidByCardCapture.mockResolvedValue(
        makeNoShowCharge({
          type: "late_cancellation",
          status: "paid",
          paymentMethod: "card",
          applicableFareClp: 500,
          feePercent: 30,
          feeCapClp: 3000,
          calculatedAmountClp: 150,
          approvedAmountClp: 150,
          settledAt: NOW,
        }),
      );

      const result = await service.cancelAcceptedRide(
        "token",
        "ride-1",
        { reason: "test cancellation" },
      );

      expect(result.ok).toBe(true);
      expect(mockRefundCardPaymentForCancelledRide).toHaveBeenCalledWith(
        expect.objectContaining({ cancellationFeeClp: 150 }),
      );
      expect(mockMarkPolicyChargePaidByCardCapture).toHaveBeenCalledWith({
        id: "charge-1",
        capturedAmountClp: 150,
      });
      if (!result.ok) return;
      expect(
        (result.ride as Record<string, any>)["policyCharge"]?.status,
      ).toBe("paid");
    });
  });

  describe("no show", () => {
    it("rechaza no show antes de marcar llegada", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      mockFindById.mockResolvedValue(
        makeRide({
          status: "driver_en_route",
          driverUserId: "driver-1",
          arrivedAt: null,
        }),
      );

      const result = await service.declareNoShow(
        "token",
        "ride-1",
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("RIDE_NO_SHOW_NOT_ALLOWED");
      expect(result.statusCode).toBe(409);
    });

    it("exige esperar cinco minutos desde la llegada", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      mockFindById.mockResolvedValue(
        makeRide({
          status: "driver_arrived",
          driverUserId: "driver-1",
          arrivedAt: new Date(Date.now() - 2 * 60 * 1000),
        }),
      );

      const result = await service.declareNoShow(
        "token",
        "ride-1",
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("RIDE_NO_SHOW_WAIT_REQUIRED");
      expect(result.statusCode).toBe(409);
      expect(mockMarkNoShow).not.toHaveBeenCalled();
    });

    it("calcula 50 por ciento con tope de 5000 CLP", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      const existing = makeRide({
        status: "driver_arrived",
        driverUserId: "driver-1",
        arrivedAt: new Date(Date.now() - 6 * 60 * 1000),
        estimatedFareClp: 12000,
        notes: "PaymentMethod: cash",
      });

      mockFindById.mockResolvedValue(existing);
      mockMarkNoShow.mockResolvedValue(
        makeRide({
          ...existing,
          status: "no_show",
          cancelledAt: NOW,
        }),
      );
      mockCreatePolicyCharge.mockResolvedValue(
        makeNoShowCharge(),
      );

      const result = await service.declareNoShow(
        "token",
        "ride-1",
      );

      expect(result.ok).toBe(true);
      expect(mockMarkNoShow).toHaveBeenCalledWith(
        "ride-1",
        "driver-1",
      );
      expect(mockReleaseDriverAfterRide).toHaveBeenCalledWith(
        "driver-1",
      );
      expect(mockCreatePolicyCharge).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceRideId: "ride-1",
          ownerUserId: "user-123",
          type: "no_show",
          feePercent: 50,
          feeCapClp: 5000,
          calculatedAmountClp: 5000,
        }),
      );
    });

    it("NO SHOW con Klap autorizado captura solo 50% con tope 5000", async () => {
      mockFindUserById.mockResolvedValue({
        id: "driver-1",
        role: "driver",
      });

      const existing = makeRide({
        status: "driver_arrived",
        driverUserId: "driver-1",
        arrivedAt: new Date(Date.now() - 6 * 60 * 1000),
        estimatedFareClp: 12000,
        notes: "PaymentMethod: card\nPaymentProvider: klap",
        paymentMethod: "card",
        paymentProvider: "klap",
      });

      mockFindById.mockResolvedValue(existing);
      mockMarkNoShow.mockResolvedValue(
        makeRide({
          ...existing,
          status: "no_show",
          cancelledAt: NOW,
        }),
      );
      mockCreatePolicyCharge.mockResolvedValue(
        makeNoShowCharge({ paymentMethod: "card" }),
      );
      mockFindPaymentByRideId.mockResolvedValue({
        id: "payment-no-show",
        provider: "klap",
        status: "authorized",
        authorizedAmountClp: 12000,
        amountClp: 12000,
      });
      mockCaptureAuthorizedKlapPayment.mockResolvedValue({
        ok: true,
        status: "success",
      });

      const result = await service.declareNoShow("token", "ride-1");

      expect(result.ok).toBe(true);
      expect(mockCaptureAuthorizedKlapPayment).toHaveBeenCalledWith(
        "payment-no-show",
        {
          outcome: "no_show",
          noShowFeeClp: 5000,
          authorizationExpired: false,
        },
      );
      expect(mockMarkPolicyChargePaidByCardCapture).toHaveBeenCalledWith({
        id: "charge-1",
        capturedAmountClp: 5000,
      });
      if (!result.ok) return;
      expect(
        (result.ride as Record<string, any>)["policyCharge"]?.status,
      ).toBe("paid");
    });
  });

  describe("listado del pasajero", () => {
    it("lista los viajes del usuario autenticado", async () => {
      mockFindByPassengerIdWithDriver.mockResolvedValue([
        makeRide(),
      ]);

      const result = await service.listMyRides("token");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.rides).toHaveLength(1);
      expect(result.rides[0]?.id).toBe("ride-1");
      expect(mockFindByPassengerIdWithDriver).toHaveBeenCalledWith(
        "user-123",
      );
    });

    it("oculta como pending_payment un viaje antiguo con tarjeta sin pago", async () => {
      mockFindByPassengerIdWithDriver.mockResolvedValue([
        makeRide({
          status: "requested",
          notes:
            "PaymentMethod: card\nPaymentProvider: mercadopago",
          paymentMethod: "card",
        }),
      ]);
      mockFindSuccessfulPaymentByRideId.mockResolvedValue(null);
    mockFindApprovedByRideId.mockResolvedValue(null);
    mockFindPaymentByRideId.mockResolvedValue(null);
    mockCaptureAuthorizedKlapPayment.mockResolvedValue({ ok: true, status: "success" });

      const result = await service.listMyRides("token");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.rides[0]?.status).toBe("pending_payment");
    });
  });
});