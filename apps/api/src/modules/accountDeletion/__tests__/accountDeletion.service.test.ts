import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockFindUserByEmail,
  mockFindLatestByUserId,
  mockFindPendingByUserId,
  mockCreate,
  mockNotifyAdmins,
  mockList,
  mockFindAdminById,
  mockDefer,
  mockNotifyUserOfDeferral,
  mockApproveAndAnonymize,
  mockHasRecentPublicVerification,
  mockCreatePublicVerification,
  mockRevokePublicVerification,
  mockVerifyAndConsumePublicCode,
  mockCreatePublicRequest,
  mockAttachPublicContact,
  mockFindPublicStatus,
  mockRecordSafe,
  mockSendReceived,
  mockSendDeferred,
  mockSendCompleted,
  mockSendVerificationCode,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockHashToken: vi.fn().mockReturnValue("access-hash"),
  mockIsSessionValid: vi.fn().mockResolvedValue(true),
  mockFindUserById: vi.fn(),
  mockFindUserByEmail: vi.fn(),
  mockFindLatestByUserId: vi.fn(),
  mockFindPendingByUserId: vi.fn(),
  mockCreate: vi.fn(),
  mockNotifyAdmins: vi.fn(),
  mockList: vi.fn(),
  mockFindAdminById: vi.fn(),
  mockDefer: vi.fn(),
  mockNotifyUserOfDeferral: vi.fn(),
  mockApproveAndAnonymize: vi.fn(),
  mockHasRecentPublicVerification: vi.fn(),
  mockCreatePublicVerification: vi.fn(),
  mockRevokePublicVerification: vi.fn(),
  mockVerifyAndConsumePublicCode: vi.fn(),
  mockCreatePublicRequest: vi.fn(),
  mockAttachPublicContact: vi.fn(),
  mockFindPublicStatus: vi.fn(),
  mockRecordSafe: vi.fn(),
  mockSendReceived: vi.fn().mockResolvedValue(undefined),
  mockSendDeferred: vi.fn().mockResolvedValue(undefined),
  mockSendCompleted: vi.fn().mockResolvedValue(undefined),
  mockSendVerificationCode: vi.fn().mockResolvedValue(undefined),
}));

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
    findByEmail: mockFindUserByEmail,
  })),
}));

vi.mock("../accountDeletion.repository.js", () => ({
  AccountDeletionRepository: vi.fn().mockImplementation(() => ({
    findLatestByUserId: mockFindLatestByUserId,
    findPendingByUserId: mockFindPendingByUserId,
    create: mockCreate,
    notifyAdminsOfNewRequest: mockNotifyAdmins,
    list: mockList,
    findAdminById: mockFindAdminById,
    defer: mockDefer,
    notifyUserOfDeferral: mockNotifyUserOfDeferral,
    approveAndAnonymize: mockApproveAndAnonymize,
    hasRecentPublicVerification: mockHasRecentPublicVerification,
    createPublicVerification: mockCreatePublicVerification,
    revokePublicVerification: mockRevokePublicVerification,
    verifyAndConsumePublicCode: mockVerifyAndConsumePublicCode,
    createPublicRequest: mockCreatePublicRequest,
    attachPublicContact: mockAttachPublicContact,
    findPublicStatus: mockFindPublicStatus,
  })),
}));

vi.mock("../../audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({
    recordSafe: mockRecordSafe,
  })),
}));

vi.mock("../../auth/mail.service.js", () => ({
  MailService: vi.fn().mockImplementation(() => ({
    sendAccountDeletionRequestReceived: mockSendReceived,
    sendAccountDeletionDeferred: mockSendDeferred,
    sendAccountDeletionCompleted: mockSendCompleted,
    sendAccountDeletionVerificationCode: mockSendVerificationCode,
  })),
}));

const { AccountDeletionService } = await import(
  "../accountDeletion.service.js"
);

const PASSENGER_ID = "11111111-1111-4111-8111-111111111111";
const DRIVER_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_ID = "44444444-4444-4444-8444-444444444444";

const passenger = {
  id: PASSENGER_ID,
  email: "passenger@test.cl",
  name: "Pasajero",
  role: "passenger",
  status: "active",
};

const driver = {
  id: DRIVER_ID,
  email: "driver@test.cl",
  name: "Conductor",
  role: "driver",
  status: "active",
};

const admin = {
  id: ADMIN_ID,
  email: "admin@test.cl",
  name: "Admin",
  role: "admin",
  status: "active",
};

const pendingRequest = {
  id: REQUEST_ID,
  userId: PASSENGER_ID,
  trackingCode: "RAD-ABCDEF1234567890",
  requestChannel: "app" as const,
  requesterRole: "passenger",
  reason: "Ya no utilizaré la aplicación.",
  comment: null,
  status: "pending" as const,
  adminNote: null,
  requestedAt: "2026-07-19T00:00:00.000Z",
  deadlineAt: "2026-08-18T00:00:00.000Z",
  deferredUntil: null,
  decisionReasonCode: null,
  retentionSummary: null,
  reviewedAt: null,
  processingAt: null,
  completedAt: null,
  failedAt: null,
  failureReason: null,
};

describe("AccountDeletionService", () => {
  let service: InstanceType<typeof AccountDeletionService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountDeletionService();
    mockHashToken.mockReturnValue("access-hash");
    mockIsSessionValid.mockResolvedValue(true);
    mockHasRecentPublicVerification.mockResolvedValue(false);
    mockCreatePublicVerification.mockResolvedValue(
      "55555555-5555-4555-8555-555555555555",
    );
  });

  it.each([
    ["passenger", passenger],
    ["driver", driver],
  ])("permite crear una solicitud para %s", async (_role, user) => {
    mockVerifyAccessToken.mockReturnValue({ sub: user.id });
    mockFindUserById.mockResolvedValue(user);
    mockFindPendingByUserId.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      ...pendingRequest,
      userId: user.id,
      requesterRole: user.role,
    });

    const result = await service.createRequest("access-token", {
      reason: "Ya no utilizaré la aplicación.",
      requesterSnapshot: {
        sourceView: user.role as "passenger" | "driver",
      },
    });

    expect(result.ok).toBe(true);
    expect(mockVerifyAndConsumePublicCode).not.toHaveBeenCalled();
    expect(mockSendVerificationCode).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      user.id,
      user.role,
      expect.objectContaining({
        reason: "Ya no utilizaré la aplicación.",
      }),
    );
    expect(mockNotifyAdmins).toHaveBeenCalledOnce();
  });

  it("impide dos solicitudes abiertas para la misma cuenta", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    mockFindUserById.mockResolvedValue(passenger);
    mockFindPendingByUserId.mockResolvedValue(pendingRequest);

    const result = await service.createRequest("access-token", {
      reason: "Quiero cerrar definitivamente mi cuenta.",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ACCOUNT_DELETION_ALREADY_PENDING");
      expect(result.statusCode).toBe(409);
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("bloquea la operación cuando la sesión fue revocada", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    mockIsSessionValid.mockResolvedValue(false);

    const result = await service.getMyLatestRequest("revoked-token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_SESSION_REVOKED");
      expect(result.statusCode).toBe(401);
    }
    expect(mockFindLatestByUserId).not.toHaveBeenCalled();
  });

  it("bloquea una cuenta ya eliminada", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    mockFindUserById.mockResolvedValue({
      ...passenger,
      status: "deleted",
    });

    const result = await service.getMyLatestRequest("access-token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_ACCOUNT_DELETED");
      expect(result.statusCode).toBe(401);
    }
  });

  it("solo permite al administrador listar solicitudes", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    mockFindUserById.mockResolvedValue(passenger);

    const result = await service.listForAdmin("access-token", {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FORBIDDEN");
      expect(result.statusCode).toBe(403);
    }
    expect(mockList).not.toHaveBeenCalled();
  });

  it("aplaza una solicitud por una causa objetiva y mantiene la cuenta activa", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: ADMIN_ID });
    mockFindUserById.mockResolvedValue(admin);
    mockFindAdminById.mockResolvedValue({
      ...pendingRequest,
      requester: passenger,
      clientSnapshot: null,
      passengerProfile: null,
      driverProfile: null,
      application: null,
      documents: [],
      accountSummary: {
        totalRides: 1,
        activeRides: 1,
        pendingPayments: 0,
        walletBalanceClp: 0,
        activeServiceBookings: 0,
        activeRentalBookings: 0,
        activeEventTickets: 0,
        openSupportCases: 0,
      },
      blockers: ["La cuenta tiene 1 viaje activo."],
      canApprove: false,
    });
    mockDefer.mockResolvedValue({
      ...pendingRequest,
      status: "deferred",
      adminNote: "Tiene un viaje activo que debe finalizar.",
      deferredUntil: pendingRequest.deadlineAt,
      decisionReasonCode: "active_ride",
    });

    const result = await service.defer("admin-token", REQUEST_ID, {
      reasonCode: "active_ride",
      note: "Tiene un viaje activo que debe finalizar.",
      deferUntil: pendingRequest.deadlineAt,
    });

    expect(result.ok).toBe(true);
    expect(mockDefer).toHaveBeenCalledWith(
      REQUEST_ID,
      ADMIN_ID,
      expect.objectContaining({
        reasonCode: "active_ride",
        note: "Tiene un viaje activo que debe finalizar.",
      }),
    );
    expect(mockNotifyUserOfDeferral).toHaveBeenCalledOnce();
    expect(mockApproveAndAnonymize).not.toHaveBeenCalled();
  });

  it("no aprueba mientras existan operaciones pendientes", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: ADMIN_ID });
    mockFindUserById.mockResolvedValue(admin);
    mockFindAdminById.mockResolvedValue({
      ...pendingRequest,
      requester: passenger,
      clientSnapshot: null,
      passengerProfile: null,
      driverProfile: null,
      application: null,
      documents: [],
      accountSummary: {
        totalRides: 1,
        activeRides: 1,
        pendingPayments: 0,
        walletBalanceClp: 0,
        activeServiceBookings: 0,
        activeRentalBookings: 0,
        activeEventTickets: 0,
        openSupportCases: 0,
      },
      blockers: ["La cuenta tiene 1 viaje activo."],
      canApprove: false,
    });

    const result = await service.approve("admin-token", REQUEST_ID, {
      note: "Revisión administrativa realizada.",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ACCOUNT_DELETION_HAS_BLOCKERS");
      expect(result.statusCode).toBe(409);
    }
    expect(mockApproveAndAnonymize).not.toHaveBeenCalled();
  });

  it("aprueba, anonimiza y conserva la auditoría", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: ADMIN_ID });
    mockFindUserById.mockResolvedValue(admin);
    mockFindAdminById.mockResolvedValue({
      ...pendingRequest,
      requester: passenger,
      clientSnapshot: null,
      passengerProfile: null,
      driverProfile: null,
      application: null,
      documents: [],
      accountSummary: {
        totalRides: 2,
        activeRides: 0,
        pendingPayments: 0,
        walletBalanceClp: 0,
        activeServiceBookings: 0,
        activeRentalBookings: 0,
        activeEventTickets: 0,
        openSupportCases: 0,
      },
      blockers: [],
      canApprove: true,
    });
    mockApproveAndAnonymize.mockResolvedValue({
      ...pendingRequest,
      status: "completed",
      adminNote: "Cuenta revisada y aprobada para eliminación.",
      completedAt: "2026-07-19T01:00:00.000Z",
    });

    const result = await service.approve("admin-token", REQUEST_ID, {
      note: "Cuenta revisada y aprobada para eliminación.",
    });

    expect(result.ok).toBe(true);
    expect(mockApproveAndAnonymize).toHaveBeenCalledWith(
      REQUEST_ID,
      ADMIN_ID,
      "Cuenta revisada y aprobada para eliminación.",
      PASSENGER_ID,
    );
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "account_deletion.completed",
        entityId: REQUEST_ID,
      }),
    );
  });

  it("mantiene una respuesta genérica para un correo desconocido", async () => {
    mockFindUserByEmail.mockResolvedValue(null);

    const result = await service.requestPublicVerification(
      { email: "unknown@test.cl" },
      {},
    );

    expect(result.ok).toBe(true);
    expect(mockCreatePublicVerification).not.toHaveBeenCalled();
    expect(mockSendVerificationCode).not.toHaveBeenCalled();
  });

  it("envía un código para una cuenta de pasajero", async () => {
    mockFindUserByEmail.mockResolvedValue(passenger);

    const result = await service.requestPublicVerification(
      { email: passenger.email },
      { requestIp: "127.0.0.1", requestUserAgent: "vitest" },
    );

    expect(result.ok).toBe(true);
    expect(mockCreatePublicVerification).toHaveBeenCalledOnce();
    expect(mockSendVerificationCode).toHaveBeenCalledWith(
      passenger.email,
      expect.stringMatching(/^\d{6}$/),
      10,
    );
  });

  it("rechaza un código público inválido", async () => {
    mockFindUserByEmail.mockResolvedValue(passenger);
    mockVerifyAndConsumePublicCode.mockResolvedValue(null);

    const result = await service.submitPublicRequest({
      email: passenger.email,
      code: "123456",
      reason: "Ya no utilizaré la aplicación.",
      accepted: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(
        "ACCOUNT_DELETION_PUBLIC_CODE_INVALID",
      );
    }
    expect(mockCreatePublicRequest).not.toHaveBeenCalled();
  });

  it("crea una solicitud web verificada con seguimiento", async () => {
    mockFindUserByEmail.mockResolvedValue(passenger);
    mockVerifyAndConsumePublicCode.mockResolvedValue(PASSENGER_ID);
    mockFindPendingByUserId.mockResolvedValue(null);
    mockCreatePublicRequest.mockResolvedValue({
      ...pendingRequest,
      requestChannel: "web",
    });

    const result = await service.submitPublicRequest({
      email: passenger.email,
      code: "123456",
      reason: "Ya no utilizaré la aplicación.",
      comment: "Solicitud realizada desde el sitio público.",
      accepted: true,
    });

    expect(result.ok).toBe(true);
    expect(mockCreatePublicRequest).toHaveBeenCalledOnce();
    expect(mockNotifyAdmins).toHaveBeenCalledOnce();
  });

  it("consulta el estado público con correo y seguimiento", async () => {
    mockFindPublicStatus.mockResolvedValue({
      trackingCode: pendingRequest.trackingCode,
      status: "pending",
      requestedAt: pendingRequest.requestedAt,
      reviewedAt: null,
      completedAt: null,
      adminNote: null,
      failureReason: null,
    });

    const result = await service.getPublicStatus({
      email: passenger.email,
      trackingCode: pendingRequest.trackingCode,
    });

    expect(result.ok).toBe(true);
    expect(mockFindPublicStatus).toHaveBeenCalledOnce();
  });

});
