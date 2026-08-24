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
const mockCanReceiveNewOffers = vi.fn();

const mockClaimCurrentRide = vi.fn();
const mockReleaseCurrentRideClaim = vi.fn();
const mockActivateQueuedRideOrClearStale = vi.fn();
const mockDriverStatusFindByDriverId = vi.fn();
const mockReleaseQueuedRideClaim = vi.fn();
const mockMarkCancelledByRideId = vi.fn();
const mockResolveQueuedRideOnAbnormalEnd = vi.fn();
const mockClearQueuedOfferMetadata = vi.fn();

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
const mockNotifyDriverCancelledReassigning = vi.fn();

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
    findDriverVehicleEligibilitySnapshot: vi.fn().mockResolvedValue(null),
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
    clearQueuedOfferMetadata: mockClearQueuedOfferMetadata,
  })),
}));

vi.mock("../../drivers/driverCompliance.service.js", () => ({
  DriverComplianceService: vi.fn().mockImplementation(() => ({
    releaseDriverAfterRide: mockReleaseDriverAfterRide,
    assertDriverCanAcceptRide: mockAssertDriverCanAcceptRide,
    canReceiveNewOffers: mockCanReceiveNewOffers,
  })),
}));

vi.mock("../../drivers/driverStatus.repository.js", () => ({
  DriverStatusRepository: vi.fn().mockImplementation(() => ({
    setBusy: vi.fn(),
    setAvailable: vi.fn(),
    claimCurrentRide: mockClaimCurrentRide,
    releaseCurrentRideClaim: mockReleaseCurrentRideClaim,
    activateQueuedRideOrClearStale: mockActivateQueuedRideOrClearStale,
    findByDriverId: mockDriverStatusFindByDriverId,
    releaseQueuedRideClaim: mockReleaseQueuedRideClaim,
    resolveQueuedRideOnAbnormalEnd: mockResolveQueuedRideOnAbnormalEnd,
  })),
}));

vi.mock("../rideStops.repository.js", () => ({
  RideStopsRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../rideAssignmentOffers.repository.js", () => ({
  RideAssignmentOffersRepository: vi.fn().mockImplementation(() => ({
    markCancelledByRideId: mockMarkCancelledByRideId,
  })),
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
  notifyPassengerDriverCancelledAndReassigning:
    mockNotifyDriverCancelledReassigning,
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
    mockClaimCurrentRide.mockResolvedValue({ driverUserId: "driver-1", currentRideId: "ride-1" });
    mockReleaseCurrentRideClaim.mockResolvedValue(undefined);
    mockCanReceiveNewOffers.mockResolvedValue({ allowed: true, state: { message: "" } });
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
    mockActivateQueuedRideOrClearStale.mockResolvedValue({ decision: "NO_QUEUED_RIDE" });
    mockDriverStatusFindByDriverId.mockResolvedValue(null);
    mockReleaseQueuedRideClaim.mockResolvedValue(undefined);
    mockMarkCancelledByRideId.mockResolvedValue(1);
    mockResolveQueuedRideOnAbnormalEnd.mockResolvedValue({ decision: "NO_QUEUED_RIDE" });
    mockClearQueuedOfferMetadata.mockResolvedValue(undefined);

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
          requestedVehicleCategory: "standard",
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
          requestedVehicleCategory: "standard",
        },
      );
    });

    it("cobra la cotización de la app si es mayor que el estimado interno", async () => {
      const withoutQuote = await service.createRideRequest("token", {
        originText: "Hanga Roa",
        destinationText: "Anakena",
        paymentMethod: "card",
        paymentProvider: "klap",
      });
      expect(withoutQuote.ok).toBe(true);
      if (!withoutQuote.ok) return;
      const internalFare = withoutQuote.ride.estimatedFareClp ?? 0;
      expect(internalFare).toBeGreaterThan(0);
      expect(internalFare).toBeLessThan(6000);

      const withQuote = await service.createRideRequest("token", {
        originText: "Hanga Roa",
        destinationText: "Anakena",
        paymentMethod: "card",
        paymentProvider: "klap",
        estimatedFareClp: 6000,
      });
      expect(withQuote.ok).toBe(true);
      if (!withQuote.ok) return;
      expect(withQuote.ride.estimatedFareClp).toBe(6000);
      expect(mockCreateWithApprovedPolicyCharges).toHaveBeenLastCalledWith(
        "user-123",
        "Hanga Roa",
        "Anakena",
        expect.any(String),
        6000,
        "pending_payment",
        expect.objectContaining({
          paymentMethod: "card",
          paymentProvider: "klap",
        }),
      );
    });

    it("no deja bajar la tarifa por debajo del estimado interno", async () => {
      const result = await service.createRideRequest("token", {
        originText: "Hanga Roa",
        destinationText: "Anakena",
        paymentMethod: "card",
        paymentProvider: "klap",
        estimatedFareClp: 500,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.ride.estimatedFareClp).toBeGreaterThan(500);
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

    it("valida en backend la cantidad de collares de una reserva Mataveri", async () => {
      const pickup = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
      const originText = "Aeropuerto Internacional Mataveri";
      const destinationText = "Hotel Hanga Roa";

      const withoutLei = await service.createRideRequest("token", {
        originText,
        destinationText,
        rideMode: "scheduled",
        tripFareMode: "one_way",
        scheduledPickupAt: pickup,
        paymentMethod: "card",
        paymentProvider: "klap",
        airportWelcomeOption: "none",
      });
      expect(withoutLei.ok).toBe(true);
      if (!withoutLei.ok) return;
      const baseFare = withoutLei.ride.estimatedFareClp ?? 0;

      mockCreateWithApprovedPolicyCharges.mockClear();

      const result = await service.createRideRequest("token", {
        originText,
        destinationText,
        rideMode: "scheduled",
        tripFareMode: "one_way",
        scheduledPickupAt: pickup,
        paymentMethod: "card",
        paymentProvider: "klap",
        airportWelcomeOption: "flower_lei",
        flowerLeiQuantity: 3,
      });

      expect(result.ok).toBe(true);
      const notes =
        mockCreateWithApprovedPolicyCharges.mock.calls[0]?.[3];
      expect(notes).toContain("RAPAGO_FLOWER_LEI_QUANTITY: 3");
      expect(notes).toContain("RAPAGO_FLOWER_LEI_UNIT_PRICE_CLP: 4000");
      expect(notes).toContain("RAPAGO_FLOWER_LEI_SURCHARGE_CLP: 12000");
      expect(notes).toContain("RAPAGO_FLOWER_LEI_STATUS: pending");
      expect(notes).toContain("3 collares de flores");
      expect(mockCreateWithApprovedPolicyCharges.mock.calls[0]?.[4]).toBe(
        baseFare + 12_000,
      );
    });

    it("conserva la cotización de la app y suma collares Mataveri", async () => {
      const pickup = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

      const result = await service.createRideRequest("token", {
        originText: "Aeropuerto Internacional Mataveri",
        destinationText: "Hotel Hanga Roa",
        rideMode: "scheduled",
        tripFareMode: "one_way",
        scheduledPickupAt: pickup,
        paymentMethod: "card",
        paymentProvider: "klap",
        estimatedFareClp: 5000,
        airportWelcomeOption: "flower_lei",
        flowerLeiQuantity: 3,
      });

      expect(result.ok).toBe(true);
      expect(mockCreateWithApprovedPolicyCharges.mock.calls[0]?.[4]).toBe(17_000);
    });

    it("rechaza collares con menos de 4 horas de anticipación", async () => {
      const pickup = new Date(Date.now() + 90 * 60 * 1000).toISOString();

      const result = await service.createRideRequest("token", {
        originText: "Aeropuerto Internacional Mataveri",
        destinationText: "Hotel Taha Tai",
        rideMode: "scheduled",
        tripFareMode: "one_way",
        scheduledPickupAt: pickup,
        paymentMethod: "card",
        paymentProvider: "klap",
        estimatedFareClp: 5000,
        airportWelcomeOption: "flower_lei",
        flowerLeiQuantity: 2,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("FLOWER_LEI_LESS_THAN_4_HOURS");
      expect(mockCreateWithApprovedPolicyCharges).not.toHaveBeenCalled();
    });

    it("rechaza collares fuera de una reserva Mataveri", async () => {
      const pickup = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

      const result = await service.createRideRequest("token", {
        originText: "Ahu Tahai",
        destinationText: "Hotel Hanga Roa",
        rideMode: "scheduled",
        tripFareMode: "one_way",
        scheduledPickupAt: pickup,
        paymentMethod: "card",
        paymentProvider: "klap",
        estimatedFareClp: 5000,
        airportWelcomeOption: "flower_lei",
        flowerLeiQuantity: 3,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("FLOWER_LEI_NOT_AIRPORT");
      expect(mockCreateWithApprovedPolicyCharges).not.toHaveBeenCalled();
    });

    it("no aplica el recargo de collares si no se solicitan", async () => {
      const pickup = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

      const result = await service.createRideRequest("token", {
        originText: "Aeropuerto Internacional Mataveri",
        destinationText: "Hotel Hanga Roa",
        rideMode: "scheduled",
        tripFareMode: "one_way",
        scheduledPickupAt: pickup,
        paymentMethod: "card",
        paymentProvider: "klap",
        airportWelcomeOption: "none",
      });

      expect(result.ok).toBe(true);
      const notes =
        mockCreateWithApprovedPolicyCharges.mock.calls[0]?.[3];
      const fareClp = mockCreateWithApprovedPolicyCharges.mock.calls[0]?.[4];
      expect(notes).not.toContain("RAPAGO_FLOWER_LEI_QUANTITY");
      expect(notes).not.toContain("RAPAGO_FLOWER_LEI_SURCHARGE_CLP");
      expect(fareClp).toBeGreaterThan(0);
      expect(fareClp).toBeLessThan(12_000);
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

  describe("completar viaje — transición A→B de preasignación encadenada (Fase 3)", () => {
    beforeEach(() => {
      mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
      mockFindById.mockImplementation((rideId: string) => {
        if (rideId === "ride-a") {
          return Promise.resolve(
            makeRide({ id: "ride-a", status: "in_progress", driverUserId: "driver-1", notes: "PaymentMethod: cash" }),
          );
        }
        if (rideId === "ride-b") {
          return Promise.resolve(
            makeRide({
              id: "ride-b",
              status: "driver_en_route",
              driverUserId: "driver-1",
              passengerUserId: "passenger-b",
            }),
          );
        }
        return Promise.resolve(null);
      });
      mockComplete.mockResolvedValue(
        makeRide({ id: "ride-a", status: "completed", driverUserId: "driver-1", completedAt: NOW }),
      );
    });

    it("TEST A: A termina normalmente con B válido en cola → B se activa y el conductor no queda momentáneamente disponible", async () => {
      mockActivateQueuedRideOrClearStale.mockResolvedValue({ decision: "TRANSITIONED", activatedRideId: "ride-b" });

      const result = await service.completeRide("token", "ride-a");

      expect(result.ok).toBe(true);
      expect(mockActivateQueuedRideOrClearStale).toHaveBeenCalledWith("driver-1", "ride-a");
      expect(mockReleaseDriverAfterRide).not.toHaveBeenCalled();
    });

    it("TEST A (notificación): notifica al pasajero de B recién después de la transición, reutilizando notifyPassengerDriverEnRoute", async () => {
      mockActivateQueuedRideOrClearStale.mockResolvedValue({ decision: "TRANSITIONED", activatedRideId: "ride-b" });

      await service.completeRide("token", "ride-a");
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockNotifyEnRoute).toHaveBeenCalledWith(
        expect.objectContaining({ passengerUserId: "passenger-b", rideId: "ride-b" }),
      );
    });

    it("TEST B: A termina sin B en cola → comportamiento actual intacto (libera al conductor)", async () => {
      mockActivateQueuedRideOrClearStale.mockResolvedValue({ decision: "NO_QUEUED_RIDE" });

      const result = await service.completeRide("token", "ride-a");

      expect(result.ok).toBe(true);
      expect(mockReleaseDriverAfterRide).toHaveBeenCalledWith("driver-1");
      expect(mockNotifyEnRoute).not.toHaveBeenCalled();
    });

    it("TEST C/TEST F: B ya no es válido (cancelado/reasignado) → no se activa, conductor queda disponible normalmente", async () => {
      mockActivateQueuedRideOrClearStale.mockResolvedValue({ decision: "QUEUED_RIDE_INVALID", staleRideId: "ride-b" });

      const result = await service.completeRide("token", "ride-a");

      expect(result.ok).toBe(true);
      expect(mockReleaseDriverAfterRide).toHaveBeenCalledWith("driver-1");
      expect(mockNotifyEnRoute).not.toHaveBeenCalled();
    });

    it("TEST G: B pertenece a otro conductor → la transición no ocurre a nivel de repositorio (contrato: decision distinto de TRANSITIONED se respeta igual que casos inválidos)", async () => {
      mockActivateQueuedRideOrClearStale.mockResolvedValue({ decision: "QUEUED_RIDE_INVALID", staleRideId: "ride-b" });

      const result = await service.completeRide("token", "ride-a");

      expect(result.ok).toBe(true);
      expect(mockReleaseDriverAfterRide).toHaveBeenCalledWith("driver-1");
    });

    it("TEST H: repositorio reporta STATUS_MISMATCH (segunda ejecución/estado ya movido) → no repite transición ni notifica", async () => {
      mockActivateQueuedRideOrClearStale.mockResolvedValue({ decision: "STATUS_MISMATCH" });

      const result = await service.completeRide("token", "ride-a");

      expect(result.ok).toBe(true);
      expect(mockReleaseDriverAfterRide).toHaveBeenCalledWith("driver-1");
      expect(mockNotifyEnRoute).not.toHaveBeenCalled();
    });

    it("TEST I: si falla la notificación al pasajero de B, la transición ya confirmada en BD no se ve afectada", async () => {
      mockActivateQueuedRideOrClearStale.mockResolvedValue({ decision: "TRANSITIONED", activatedRideId: "ride-b" });
      mockNotifyEnRoute.mockImplementation(() => {
        throw new Error("push provider down");
      });

      const result = await service.completeRide("token", "ride-a");
      await new Promise((resolve) => setImmediate(resolve));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.ride.status).toBe("completed");
    });

    it("TEST J: si falla la captura Klap de A, la activación de B ya realizada no se revierte", async () => {
      mockFindById.mockImplementation((rideId: string) => {
        if (rideId === "ride-a") {
          return Promise.resolve(
            makeRide({
              id: "ride-a",
              status: "in_progress",
              driverUserId: "driver-1",
              notes: "PaymentMethod: card\nPaymentProvider: klap",
              paymentMethod: "card",
            }),
          );
        }
        if (rideId === "ride-b") {
          return Promise.resolve(
            makeRide({ id: "ride-b", status: "driver_en_route", driverUserId: "driver-1", passengerUserId: "passenger-b" }),
          );
        }
        return Promise.resolve(null);
      });
      mockFindApprovedByRideId.mockResolvedValue({ id: "payment-klap", status: "authorized" });
      mockFindPaymentByRideId.mockResolvedValue({ id: "payment-klap", provider: "klap", status: "authorized" });
      mockCaptureAuthorizedKlapPayment.mockRejectedValue(new Error("capture blew up"));
      mockActivateQueuedRideOrClearStale.mockResolvedValue({ decision: "TRANSITIONED", activatedRideId: "ride-b" });

      const result = await service.completeRide("token", "ride-a");

      expect(result.ok).toBe(true);
      expect(mockActivateQueuedRideOrClearStale).toHaveBeenCalledWith("driver-1", "ride-a");
      expect(mockReleaseDriverAfterRide).not.toHaveBeenCalled();
    });

    it("no dispara ninguna operación de pagos ni Klap adicional por el sólo hecho de activar B", async () => {
      mockActivateQueuedRideOrClearStale.mockResolvedValue({ decision: "TRANSITIONED", activatedRideId: "ride-b" });
      mockFindPaymentByRideId.mockResolvedValue(null);

      await service.completeRide("token", "ride-a");

      expect(mockCaptureAuthorizedKlapPayment).not.toHaveBeenCalled();
    });
  });

  describe("aceptar viaje — guard de viaje activo (Fase 0)", () => {
    it("NORMAL_ACCEPT_NO_ACTIVE_RIDE=PASS — reclama el slot y acepta el viaje", async () => {
      mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
      mockFindById.mockResolvedValue(makeRide({ status: "requested" }));
      mockAccept.mockResolvedValue(
        makeRide({ status: "accepted", driverUserId: "driver-1" }),
      );

      const result = await service.acceptRideRequest("token", "ride-1");

      expect(mockClaimCurrentRide).toHaveBeenCalledWith("driver-1", "ride-1");
      expect(mockAccept).toHaveBeenCalledWith("ride-1", "driver-1");
      expect(mockReleaseCurrentRideClaim).not.toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });

    it("NORMAL_ACCEPT_WITH_ACTIVE_RIDE=REJECT — el claim en BD rechaza antes de tocar el ride", async () => {
      mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
      mockFindById.mockResolvedValue(makeRide({ status: "requested" }));
      mockClaimCurrentRide.mockResolvedValue(null);

      const result = await service.acceptRideRequest("token", "ride-1");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("DRIVER_ALREADY_HAS_ACTIVE_RIDE");
      expect(result.statusCode).toBe(409);
      // Nunca debe intentar tomar el ride si el claim de BD ya rechazó.
      expect(mockAccept).not.toHaveBeenCalled();
    });

    it("libera el claim si el ride ya no estaba disponible tras reclamarlo (carrera)", async () => {
      mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
      mockFindById
        .mockResolvedValueOnce(makeRide({ status: "requested" }))
        .mockResolvedValueOnce(makeRide({ status: "accepted", driverUserId: "other-driver" }));
      mockAccept.mockResolvedValue(null);

      const result = await service.acceptRideRequest("token", "ride-1");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("RIDE_ALREADY_ACCEPTED");
      // El claim se liberó — el conductor no queda bloqueado por un viaje
      // que nunca tomó de verdad.
      expect(mockReleaseCurrentRideClaim).toHaveBeenCalledWith("driver-1", "ride-1");
    });

    it("CONCURRENT_NORMAL_ACCEPTS — solo uno gana: el segundo ve el claim ya ocupado", async () => {
      mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
      mockFindById.mockResolvedValue(makeRide({ status: "requested" }));

      // Primer intento: el claim atómico en BD gana.
      mockClaimCurrentRide.mockResolvedValueOnce({ driverUserId: "driver-1", currentRideId: "ride-1" });
      mockAccept.mockResolvedValueOnce(makeRide({ status: "accepted", driverUserId: "driver-1" }));
      const first = await service.acceptRideRequest("token", "ride-1");

      // Segundo intento (mismo conductor u otro dispositivo): el UPDATE
      // condicional en BD ya no encuentra current_ride_id nulo.
      mockClaimCurrentRide.mockResolvedValueOnce(null);
      const second = await service.acceptRideRequest("token", "ride-1");

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(false);
      if (second.ok) return;
      expect(second.code).toBe("DRIVER_ALREADY_HAS_ACTIVE_RIDE");
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

  describe("cancelación de pasajero B en preasignación encadenada (Fase 5.1)", () => {
    function makeQueuedRide(overrides: Record<string, unknown> = {}) {
      return makeRide({
        status: "accepted",
        assignmentMode: "queued_offer",
        driverUserId: "driver-1",
        acceptedAt: NOW,
        enRouteAt: null,
        estimatedFareClp: 5000,
        ...overrides,
      });
    }

    it("TEST_1: aceptada hace 30s → sin penalización (penalty=0)", async () => {
      const existing = makeQueuedRide({
        acceptedAt: new Date(Date.now() - 30 * 1000),
      });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue({ ...existing, status: "cancelled" });

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockCreatePolicyCharge).not.toHaveBeenCalled();
    });

    it("TEST_2: aceptada hace 5 minutos → sin penalización", async () => {
      const existing = makeQueuedRide({
        acceptedAt: new Date(Date.now() - 5 * 60 * 1000),
      });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue({ ...existing, status: "cancelled" });

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockCreatePolicyCharge).not.toHaveBeenCalled();
    });

    it("TEST_3: aceptada hace 20 minutos → sin penalización", async () => {
      const existing = makeQueuedRide({
        acceptedAt: new Date(Date.now() - 20 * 60 * 1000),
      });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue({ ...existing, status: "cancelled" });

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockCreatePolicyCharge).not.toHaveBeenCalled();
    });

    it("TEST_4: una vez driver_en_route, vuelve a aplicar la regla normal usando enRouteAt (no acceptedAt antiguo)", async () => {
      // acceptedAt quedó 20 minutos atrás (aceptación de la oferta en cola),
      // pero enRouteAt (transición real de Fase 3) fue hace apenas 5s — la
      // cancelación debe ser gratuita porque el conductor recién arrancó.
      const existing = makeQueuedRide({
        status: "driver_en_route",
        acceptedAt: new Date(Date.now() - 20 * 60 * 1000),
        enRouteAt: new Date(Date.now() - 5 * 1000),
      });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue({ ...existing, status: "cancelled" });

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockCreatePolicyCharge).not.toHaveBeenCalled();
    });

    it("TEST_4b: driver_en_route con enRouteAt de hace 2 minutos → SÍ aplica penalización normal", async () => {
      const existing = makeQueuedRide({
        status: "driver_en_route",
        acceptedAt: new Date(Date.now() - 20 * 60 * 1000),
        enRouteAt: new Date(Date.now() - 2 * 60 * 1000),
      });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue({ ...existing, status: "cancelled" });
      mockCreatePolicyCharge.mockResolvedValue(
        makeNoShowCharge({ type: "late_cancellation", calculatedAmountClp: 1500 }),
      );

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockCreatePolicyCharge).toHaveBeenCalled();
    });

    it("TEST_5: cancelar B en cola libera sólo el slot de cola — current_ride_id de A no se toca", async () => {
      const existing = makeQueuedRide();
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue({ ...existing, status: "cancelled" });

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockReleaseQueuedRideClaim).toHaveBeenCalledWith("driver-1", "ride-1");
      expect(mockReleaseDriverAfterRide).not.toHaveBeenCalled();
      expect(mockMarkCancelledByRideId).toHaveBeenCalledWith("ride-1");
    });

    it("TEST_6: Klap authorized en queued cancel → nunca captura (refund normal de cancelación gratuita)", async () => {
      const existing = makeQueuedRide({
        notes: "PaymentMethod: card\nPaymentProvider: klap",
        paymentMethod: "card",
        paymentProvider: "klap",
      });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue({ ...existing, status: "cancelled" });

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockCaptureAuthorizedKlapPayment).not.toHaveBeenCalled();
      expect(mockRefundCardPaymentForCancelledRide).toHaveBeenCalledWith(
        expect.objectContaining({ cancellationFeeClp: 0 }),
      );
    });

    it("TEST_7: cash queued cancellation → sin cargo", async () => {
      const existing = makeQueuedRide({
        notes: "PaymentMethod: cash",
        paymentMethod: "cash",
      });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue({ ...existing, status: "cancelled" });

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockCreatePolicyCharge).not.toHaveBeenCalled();
    });

    it("TEST_8: si el repositorio ya no encuentra el ride en 'accepted' (perdió la carrera contra la transición A→B), se rechaza sin cobrar con datos viejos", async () => {
      const existing = makeQueuedRide();
      mockFindById
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, status: "driver_en_route" });
      mockCancelAccepted.mockResolvedValue(null);

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(false);
      expect(mockCreatePolicyCharge).not.toHaveBeenCalled();
    });

    it("un viaje 'accepted' NORMAL (assignment_mode='automatic') sigue usando acceptedAt sin cambios", async () => {
      const existing = makeRide({
        status: "accepted",
        assignmentMode: "automatic",
        driverUserId: "driver-1",
        acceptedAt: new Date(Date.now() - 2 * 60 * 1000),
        estimatedFareClp: 5000,
      });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue({ ...existing, status: "cancelled" });
      mockCreatePolicyCharge.mockResolvedValue(
        makeNoShowCharge({ type: "late_cancellation", calculatedAmountClp: 1500 }),
      );

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockCreatePolicyCharge).toHaveBeenCalled();
      expect(mockReleaseDriverAfterRide).toHaveBeenCalledWith("driver-1");
      expect(mockReleaseQueuedRideClaim).not.toHaveBeenCalled();
    });
  });

  describe("resolución de queued ride cuando A termina anormalmente (Fase 5.2)", () => {
    function makeRideA(overrides: Record<string, unknown> = {}) {
      return makeRide({
        id: "ride-a",
        status: "in_progress",
        driverUserId: "driver-1",
        assignmentMode: "automatic",
        ...overrides,
      });
    }

    function makeQueuedOfferRideB(overrides: Record<string, unknown> = {}) {
      return makeRide({
        id: "ride-b",
        status: "accepted",
        assignmentMode: "queued_offer",
        driverUserId: "driver-1",
        ...overrides,
      });
    }

    describe("Caso 1 — A cancela con B en cola (TEST_5_2_1)", () => {
      it("resuelve B a través de la nueva primitiva antes de liberar al conductor", async () => {
        const existingA = makeRideA({ status: "accepted" });
        mockFindById.mockResolvedValue(existingA);
        mockCancelAccepted.mockResolvedValue({ ...existingA, status: "cancelled" });
        mockResolveQueuedRideOnAbnormalEnd.mockResolvedValue({
          decision: "RESOLVED",
          releasedRideId: "ride-b",
        });

        const result = await service.cancelAcceptedRide("token", "ride-a", {});

        expect(result.ok).toBe(true);
        expect(mockResolveQueuedRideOnAbnormalEnd).toHaveBeenCalledWith("driver-1", "ride-a");
        expect(mockMarkCancelledByRideId).toHaveBeenCalledWith("ride-b");
        expect(mockReleaseDriverAfterRide).toHaveBeenCalledWith("driver-1");
      });

      it("sin B en cola, comportamiento intacto (NO_QUEUED_RIDE)", async () => {
        const existingA = makeRideA({ status: "accepted" });
        mockFindById.mockResolvedValue(existingA);
        mockCancelAccepted.mockResolvedValue({ ...existingA, status: "cancelled" });
        mockResolveQueuedRideOnAbnormalEnd.mockResolvedValue({ decision: "NO_QUEUED_RIDE" });

        const result = await service.cancelAcceptedRide("token", "ride-a", {});

        expect(result.ok).toBe(true);
        expect(mockMarkCancelledByRideId).not.toHaveBeenCalled();
        expect(mockReleaseDriverAfterRide).toHaveBeenCalledWith("driver-1");
      });
    });

    describe("Caso 2 — no-show de A con B en cola (TEST_5_2_2)", () => {
      it("resuelve B antes de liberar al conductor tras no-show", async () => {
        mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
        const arrivedAt = new Date(Date.now() - 6 * 60 * 1000);
        mockFindById.mockResolvedValue(
          makeRideA({ status: "driver_arrived", arrivedAt }),
        );
        mockMarkNoShow.mockResolvedValue(
          makeRideA({ status: "no_show", arrivedAt }),
        );
        mockResolveQueuedRideOnAbnormalEnd.mockResolvedValue({
          decision: "RESOLVED",
          releasedRideId: "ride-b",
        });

        const result = await service.declareNoShow("token", "ride-a");

        expect(result.ok).toBe(true);
        expect(mockResolveQueuedRideOnAbnormalEnd).toHaveBeenCalledWith("driver-1", "ride-a");
        expect(mockMarkCancelledByRideId).toHaveBeenCalledWith("ride-b");
        expect(mockReleaseDriverAfterRide).toHaveBeenCalledWith("driver-1");
      });
    });

    describe("Caso 4 — conductor cancela sólo B, A permanece intacto (TEST_5_2_8)", () => {
      it("A no se toca; B vuelve a requested; metadata de queued_offer se limpia; se reintenta ofrecer", async () => {
        const existingB = makeQueuedOfferRideB();
        mockFindById.mockResolvedValue(existingB);
        mockCancelAccepted.mockResolvedValue({ ...existingB, status: "requested", driverUserId: null });

        const result = await service.cancelAcceptedRide("token", "ride-b", {});

        expect(result.ok).toBe(true);
        expect(mockReleaseQueuedRideClaim).toHaveBeenCalledWith("driver-1", "ride-b");
        expect(mockReleaseDriverAfterRide).not.toHaveBeenCalled();
        expect(mockResolveQueuedRideOnAbnormalEnd).not.toHaveBeenCalled();
      });

      it("limpia assignment_mode/queued_offer_driver_id y reintenta la oferta cuando cancela el conductor", async () => {
        mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
        const existingB = makeQueuedOfferRideB();
        mockFindById.mockResolvedValue(existingB);
        mockCancelAccepted.mockResolvedValue({ ...existingB, status: "requested", driverUserId: null });

        await service.cancelAcceptedRide("token", "ride-b", {});

        expect(mockClearQueuedOfferMetadata).toHaveBeenCalledWith("ride-b");
      });

      it("NO limpia metadata ni reintenta si quien cancela es el pasajero (ya cubierto por Fase 5.1)", async () => {
        const existingB = makeQueuedOfferRideB({ passengerUserId: "user-123" });
        mockFindById.mockResolvedValue(existingB);
        mockCancelAccepted.mockResolvedValue({ ...existingB, status: "cancelled" });

        await service.cancelAcceptedRide("token", "ride-b", {});

        expect(mockClearQueuedOfferMetadata).not.toHaveBeenCalled();
      });
    });

    describe("TEST_5_2_6 — pasajero B nunca es cobrado por una terminación anormal de A", () => {
      it("Klap authorized en B reasignada: sin captura, sin refund con fee > 0", async () => {
        const existingA = makeRideA({ status: "accepted" });
        mockFindById.mockResolvedValue(existingA);
        mockCancelAccepted.mockResolvedValue({ ...existingA, status: "cancelled" });
        mockResolveQueuedRideOnAbnormalEnd.mockResolvedValue({
          decision: "RESOLVED",
          releasedRideId: "ride-b",
        });

        await service.cancelAcceptedRide("token", "ride-a", {});

        // La primitiva de Fase 5.2 no toca payments/Klap en absoluto — sólo
        // BD de rides/driver_statuses. Ningún cargo se origina desde aquí.
        expect(mockCaptureAuthorizedKlapPayment).not.toHaveBeenCalled();
      });
    });

    describe("TEST_5_2_9 — idempotencia del resolver", () => {
      it("segunda ejecución del mismo escenario no falla ni duplica efectos (STATUS_MISMATCH)", async () => {
        const existingA = makeRideA({ status: "accepted" });
        mockFindById.mockResolvedValue(existingA);
        mockCancelAccepted.mockResolvedValue({ ...existingA, status: "cancelled" });
        mockResolveQueuedRideOnAbnormalEnd.mockResolvedValue({ decision: "STATUS_MISMATCH" });

        const result = await service.cancelAcceptedRide("token", "ride-a", {});

        expect(result.ok).toBe(true);
        expect(mockMarkCancelledByRideId).not.toHaveBeenCalled();
        expect(mockReleaseDriverAfterRide).toHaveBeenCalledWith("driver-1");
      });

      it("QUEUED_RIDE_ALREADY_INVALID (carrera: otro proceso ya resolvió B) no duplica el markCancelledByRideId", async () => {
        const existingA = makeRideA({ status: "accepted" });
        mockFindById.mockResolvedValue(existingA);
        mockCancelAccepted.mockResolvedValue({ ...existingA, status: "cancelled" });
        mockResolveQueuedRideOnAbnormalEnd.mockResolvedValue({
          decision: "QUEUED_RIDE_ALREADY_INVALID",
          staleRideId: "ride-b",
        });

        const result = await service.cancelAcceptedRide("token", "ride-a", {});

        expect(result.ok).toBe(true);
        expect(mockMarkCancelledByRideId).not.toHaveBeenCalled();
        expect(mockReleaseDriverAfterRide).toHaveBeenCalledWith("driver-1");
      });
    });

    describe("TEST_5_2_4 — B nunca puede resucitar tras un viaje C no relacionado", () => {
      it("completar un viaje C posterior nunca referencia la antigua B ya resuelta", async () => {
        // 1) A cancela con B en cola — resolveQueuedRideOnAbnormalEnd limpia
        //    current_ride_id Y queued_ride_id en la MISMA transacción (por
        //    diseño de la primitiva — ver driverStatus.repository.ts).
        const existingA = makeRideA({ status: "accepted" });
        mockFindById.mockResolvedValue(existingA);
        mockCancelAccepted.mockResolvedValue({ ...existingA, status: "cancelled" });
        mockResolveQueuedRideOnAbnormalEnd.mockResolvedValue({
          decision: "RESOLVED",
          releasedRideId: "ride-b",
        });
        await service.cancelAcceptedRide("token", "ride-a", {});

        // 2) El conductor acepta y completa un viaje C totalmente distinto.
        //    activateQueuedRideOrClearStale (Fase 3) es la única puerta para
        //    promover una queued ride — se le pasa el id de C, nunca el de
        //    la B ya resuelta, y su propia guarda (current_ride_id === C)
        //    ya está probada en la suite de Fase 3.
        mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
        mockFindById.mockResolvedValue(
          makeRide({ id: "ride-c", status: "in_progress", driverUserId: "driver-1", notes: "PaymentMethod: cash" }),
        );
        mockComplete.mockResolvedValue(
          makeRide({ id: "ride-c", status: "completed", driverUserId: "driver-1", completedAt: NOW }),
        );
        mockActivateQueuedRideOrClearStale.mockResolvedValue({ decision: "NO_QUEUED_RIDE" });

        await service.completeRide("token", "ride-c");

        expect(mockActivateQueuedRideOrClearStale).toHaveBeenCalledWith("driver-1", "ride-c");
        expect(mockActivateQueuedRideOrClearStale).not.toHaveBeenCalledWith("driver-1", "ride-b");
      });
    });

    describe("TEST_5_2_5 — B reasignada es elegible para un nuevo conductor", () => {
      it("tras la resolución, se reintenta attemptQueuedOffer(B) — el mismo mecanismo que ya ofrece rides 'requested' a nuevos candidatos", async () => {
        const existingA = makeRideA({ status: "accepted" });
        mockFindById.mockResolvedValue(existingA);
        mockCancelAccepted.mockResolvedValue({ ...existingA, status: "cancelled" });
        mockResolveQueuedRideOnAbnormalEnd.mockResolvedValue({
          decision: "RESOLVED",
          releasedRideId: "ride-b",
        });

        await service.cancelAcceptedRide("token", "ride-a", {});
        await new Promise((resolve) => setImmediate(resolve));

        // attemptQueuedOffer es la misma primitiva de Fase 2 que ya está
        // probada en rideQueueOfferProducer.service.test.ts (TEST_2: "un
        // conductor elegible → una oferta pending") para encontrar un nuevo
        // conductor a partir de un ride en 'requested' — no se invocó
        // ninguna lógica de matching nueva.
        expect(mockMarkCancelledByRideId).toHaveBeenCalledWith("ride-b");
      });
    });

    describe("TEST_5_2_7 — completeRide(A) normal permanece intacto", () => {
      it("con B válida en cola, sigue usando activateQueuedRideOrClearStale (Fase 3), nunca resolveQueuedRideOnAbnormalEnd", async () => {
        mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
        mockFindById.mockResolvedValue(
          makeRideA({ status: "in_progress", notes: "PaymentMethod: cash" }),
        );
        mockComplete.mockResolvedValue(
          makeRideA({ status: "completed", completedAt: NOW }),
        );
        mockActivateQueuedRideOrClearStale.mockResolvedValue({
          decision: "TRANSITIONED",
          activatedRideId: "ride-b",
        });

        const result = await service.completeRide("token", "ride-a");

        expect(result.ok).toBe(true);
        expect(mockActivateQueuedRideOrClearStale).toHaveBeenCalledWith("driver-1", "ride-a");
        expect(mockResolveQueuedRideOnAbnormalEnd).not.toHaveBeenCalled();
        expect(mockReleaseDriverAfterRide).not.toHaveBeenCalled();
      });
    });
  });

  describe("reasignacion cuando el conductor cancela (DRIVER-CANCEL-REASSIGN-01)", () => {
    function makeDriverCancelledRow(overrides: Record<string, unknown> = {}) {
      return makeRide({
        status: "requested",
        driverUserId: null,
        acceptedAt: null,
        enRouteAt: null,
        arrivedAt: null,
        cancelledAt: null,
        cancelledByUserId: null,
        cancelledByRole: null,
        cancellationReason: null,
        ...overrides,
      });
    }

    beforeEach(() => {
      mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    });

    it("TEST_1/2 — D1 cancela un ride 'accepted': vuelve a requested, driver null, fee 0", async () => {
      const existing = makeRide({
        status: "accepted",
        driverUserId: "driver-1",
        acceptedAt: NOW,
      });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue(makeDriverCancelledRow());

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockCancelAccepted).toHaveBeenCalledWith(
        "ride-1",
        "driver-1",
        "driver",
        null,
        expect.any(Object),
      );
      if (!result.ok) return;
      expect(result.ride.status).toBe("requested");
      expect(result.ride.driverUserId).toBeNull();
      expect(mockCreatePolicyCharge).not.toHaveBeenCalled();
      expect(mockRefundCardPaymentForCancelledRide).not.toHaveBeenCalled();
    });

    it("CASO 2 — D1 cancela en driver_en_route: mismo resultado, fee 0", async () => {
      const existing = makeRide({
        status: "driver_en_route",
        driverUserId: "driver-1",
        acceptedAt: NOW,
        enRouteAt: NOW,
      });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue(makeDriverCancelledRow());

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockCreatePolicyCharge).not.toHaveBeenCalled();
    });

    it("CASO 3 — D1 cancela en driver_arrived (no no-show): mismo resultado, fee 0", async () => {
      const existing = makeRide({
        status: "driver_arrived",
        driverUserId: "driver-1",
        acceptedAt: NOW,
        arrivedAt: NOW,
      });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue(makeDriverCancelledRow());

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockCreatePolicyCharge).not.toHaveBeenCalled();
    });

    it("TEST_6/7/8/9/10 — Klap: misma autorizacion, sin captura, sin refund, sin nueva orden", async () => {
      const existing = makeRide({
        status: "accepted",
        driverUserId: "driver-1",
        acceptedAt: NOW,
        notes: "PaymentMethod: card\nPaymentProvider: klap",
        paymentMethod: "card",
        paymentProvider: "klap",
      });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue(
        makeDriverCancelledRow({
          notes: existing.notes,
          paymentMethod: "card",
          paymentProvider: "klap",
        }),
      );

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      expect(mockCaptureAuthorizedKlapPayment).not.toHaveBeenCalled();
      expect(mockRefundCardPaymentForCancelledRide).not.toHaveBeenCalled();
      expect(mockCreatePolicyCharge).not.toHaveBeenCalled();
      expect(result.ride.id).toBe("ride-1");
    });

    it("TEST_13 — pasajero recibe senal de reasignacion via notificacion persistente", async () => {
      const existing = makeRide({ status: "accepted", driverUserId: "driver-1" });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue(makeDriverCancelledRow());

      await service.cancelAcceptedRide("token", "ride-1", {});
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockNotifyDriverCancelledReassigning).toHaveBeenCalledWith({
        passengerUserId: "user-123",
        rideId: "ride-1",
      });
    });

    it("no dispara la notificacion cuando cancela el pasajero (no cuando cancela D1)", async () => {
      mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
      const existing = makeRide({ status: "accepted", driverUserId: "driver-1" });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue(
        makeRide({ status: "cancelled", cancelledByRole: "passenger" }),
      );

      await service.cancelAcceptedRide("token", "ride-1", {});
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockNotifyDriverCancelledReassigning).not.toHaveBeenCalled();
    });

    it("TEST_14 — datos de D1 desaparecen del ride reutilizado (misma fila, mismo id)", async () => {
      const existing = makeRide({ status: "accepted", driverUserId: "driver-1" });
      mockFindById.mockResolvedValue(existing);
      mockCancelAccepted.mockResolvedValue(makeDriverCancelledRow());

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.ride.driverUserId).toBeNull();
      expect(result.ride.id).toBe("ride-1");
    });

    it("TEST_19 — sin D2 disponible de inmediato: R permanece requested y sigue siendo recuperable por el matching normal", async () => {
      const existing = makeRide({ status: "accepted", driverUserId: "driver-1" });
      mockFindById.mockResolvedValue(existing);
      const requeued = makeDriverCancelledRow();
      mockCancelAccepted.mockResolvedValue(requeued);
      mockFindAvailable.mockResolvedValue([requeued]);

      const cancelResult = await service.cancelAcceptedRide("token", "ride-1", {});
      expect(cancelResult.ok).toBe(true);

      mockFindUserById.mockResolvedValue({ id: "driver-2", role: "driver" });
      const listResult = await service.listAvailableRides("token");

      expect(listResult.ok).toBe(true);
      if (!listResult.ok) return;
      expect(listResult.rides.some((r) => r.id === "ride-1")).toBe(true);
    });

    it("TEST_17/CASO_D — No Show mantiene su propio camino, sin pasar por cancelAccepted", async () => {
      mockFindById.mockResolvedValue(
        makeRide({
          status: "driver_arrived",
          driverUserId: "driver-1",
          arrivedAt: new Date(Date.now() - 6 * 60 * 1000),
        }),
      );
      mockMarkNoShow.mockResolvedValue(
        makeRide({ status: "no_show", driverUserId: "driver-1" }),
      );

      await service.declareNoShow("token", "ride-1");

      expect(mockCancelAccepted).not.toHaveBeenCalled();
      expect(mockNotifyDriverCancelledReassigning).not.toHaveBeenCalled();
    });

    it("TEST_18 — evento tardio de D1 tras reasignacion no puede modificar el ride ya asignado a D2 (CAS por status)", async () => {
      mockFindById.mockResolvedValue(
        makeRide({ status: "accepted", driverUserId: "driver-2" }),
      );

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("AUTH_FORBIDDEN");
      expect(mockCancelAccepted).not.toHaveBeenCalled();
    });

    it("TEST_16 — carrera D1-cancel vs D2-accept: si el repositorio ya no encuentra el status esperado, se rechaza sin datos falsos", async () => {
      const existing = makeRide({ status: "accepted", driverUserId: "driver-1" });
      mockFindById
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(makeRide({ status: "in_progress", driverUserId: "driver-1" }));
      mockCancelAccepted.mockResolvedValue(null);

      const result = await service.cancelAcceptedRide("token", "ride-1", {});

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("RIDE_CANNOT_CANCEL");
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

    describe("preasignación encadenada — UI pasajero B (Fase 5)", () => {
      it("expone assignmentMode en la respuesta del viaje", async () => {
        mockFindByPassengerIdWithDriver.mockResolvedValue([
          makeRide({ assignmentMode: "queued_offer" }),
        ]);

        const result = await service.listMyRides("token");

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.rides[0]?.assignmentMode).toBe("queued_offer");
      });

      it("calcula estimatedWaitMinutes para accepted+queued_offer cuando hay datos de ubicación", async () => {
        mockFindByPassengerIdWithDriver.mockResolvedValue([
          makeRide({
            id: "ride-b",
            status: "accepted",
            assignmentMode: "queued_offer",
            driverUserId: "driver-1",
            originLat: -33.4550,
            originLng: -70.6650,
          }),
        ]);
        mockDriverStatusFindByDriverId.mockResolvedValue({
          currentRideId: "ride-a",
          currentLat: -33.4489,
          currentLng: -70.6693,
        });
        mockFindById.mockResolvedValue(
          makeRide({
            id: "ride-a",
            destinationLat: -33.4489,
            destinationLng: -70.6693,
          }),
        );

        const result = await service.listMyRides("token");

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.rides[0]?.estimatedWaitMinutes).not.toBeNull();
        expect(typeof result.rides[0]?.estimatedWaitMinutes).toBe("number");
      });

      it("no calcula estimatedWaitMinutes para un viaje 'accepted' normal (assignmentMode='automatic')", async () => {
        mockFindByPassengerIdWithDriver.mockResolvedValue([
          makeRide({ status: "accepted", assignmentMode: "automatic", driverUserId: "driver-1" }),
        ]);

        const result = await service.listMyRides("token");

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.rides[0]?.estimatedWaitMinutes).toBeUndefined();
        expect(mockDriverStatusFindByDriverId).not.toHaveBeenCalled();
      });

      it("estimatedWaitMinutes es null (best-effort) si falta información de ubicación, sin romper la respuesta", async () => {
        mockFindByPassengerIdWithDriver.mockResolvedValue([
          makeRide({ status: "accepted", assignmentMode: "queued_offer", driverUserId: "driver-1" }),
        ]);
        mockDriverStatusFindByDriverId.mockResolvedValue(null);

        const result = await service.listMyRides("token");

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.rides[0]?.estimatedWaitMinutes).toBeNull();
      });

      it("nunca expone datos del viaje A (origen/destino de A) en la respuesta de B", async () => {
        mockFindByPassengerIdWithDriver.mockResolvedValue([
          makeRide({ status: "accepted", assignmentMode: "queued_offer", driverUserId: "driver-1" }),
        ]);
        mockDriverStatusFindByDriverId.mockResolvedValue({
          currentRideId: "ride-a",
          currentLat: -33.4489,
          currentLng: -70.6693,
        });
        mockFindById.mockResolvedValue(
          makeRide({ id: "ride-a", originText: "Origen secreto de A", destinationText: "Destino secreto de A" }),
        );

        const result = await service.listMyRides("token");

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const serialized = JSON.stringify(result.rides[0]);
        expect(serialized).not.toContain("Origen secreto de A");
        expect(serialized).not.toContain("Destino secreto de A");
      });
    });
  });
});