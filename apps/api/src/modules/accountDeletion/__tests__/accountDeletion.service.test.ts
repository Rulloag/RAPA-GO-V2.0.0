import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockFindLatestByUserId,
  mockFindPendingByUserId,
  mockCreate,
  mockNotifyAdmins,
  mockList,
  mockFindAdminById,
  mockReject,
  mockNotifyUserOfRejection,
  mockApproveAndAnonymize,
  mockRecordSafe,
  mockSendReceived,
  mockSendRejected,
  mockSendCompleted,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockHashToken: vi.fn().mockReturnValue("access-hash"),
  mockIsSessionValid: vi.fn().mockResolvedValue(true),
  mockFindUserById: vi.fn(),
  mockFindLatestByUserId: vi.fn(),
  mockFindPendingByUserId: vi.fn(),
  mockCreate: vi.fn(),
  mockNotifyAdmins: vi.fn(),
  mockList: vi.fn(),
  mockFindAdminById: vi.fn(),
  mockReject: vi.fn(),
  mockNotifyUserOfRejection: vi.fn(),
  mockApproveAndAnonymize: vi.fn(),
  mockRecordSafe: vi.fn(),
  mockSendReceived: vi.fn().mockResolvedValue(undefined),
  mockSendRejected: vi.fn().mockResolvedValue(undefined),
  mockSendCompleted: vi.fn().mockResolvedValue(undefined),
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
    reject: mockReject,
    notifyUserOfRejection: mockNotifyUserOfRejection,
    approveAndAnonymize: mockApproveAndAnonymize,
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
    sendAccountDeletionRejected: mockSendRejected,
    sendAccountDeletionCompleted: mockSendCompleted,
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
  requesterRole: "passenger",
  reason: "Ya no utilizaré la aplicación.",
  comment: null,
  status: "pending" as const,
  adminNote: null,
  requestedAt: "2026-07-19T00:00:00.000Z",
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

  it("rechaza una solicitud y mantiene la cuenta activa", async () => {
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
        totalRides: 0,
        activeRides: 0,
        pendingPayments: 0,
        walletBalanceClp: 0,
        activeServiceBookings: 0,
        activeRentalBookings: 0,
        activeEventTickets: 0,
      },
      blockers: [],
      canApprove: true,
    });
    mockReject.mockResolvedValue({
      ...pendingRequest,
      status: "rejected",
      adminNote: "Tiene un viaje que debe aclarar con soporte.",
    });

    const result = await service.reject("admin-token", REQUEST_ID, {
      note: "Tiene un viaje que debe aclarar con soporte.",
    });

    expect(result.ok).toBe(true);
    expect(mockReject).toHaveBeenCalledWith(
      REQUEST_ID,
      ADMIN_ID,
      "Tiene un viaje que debe aclarar con soporte.",
    );
    expect(mockNotifyUserOfRejection).toHaveBeenCalledOnce();
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
});
