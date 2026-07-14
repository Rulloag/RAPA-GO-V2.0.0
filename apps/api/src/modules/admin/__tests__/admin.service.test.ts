import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockListUsers,
  mockAdminFindById,
  mockUpdateStatus,
  mockListDocuments,
  mockFindDocumentById,
  mockReviewDocument,
  mockListRides,
  mockListActiveDrivers,
  mockAssignDriver,
  mockCancelRide,
  mockRecordSafe,
  mockFindDriverStatusByDriverId,
  mockSetBusy,
  mockSetAvailable,
  mockFindOfflineBookingById,
  mockSyncOfflineBooking,
  mockCreateOfflineRide,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockHashToken: vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid: vi.fn().mockResolvedValue(true),
  mockFindUserById: vi.fn(),
  mockListUsers: vi.fn(),
  mockAdminFindById: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockListDocuments: vi.fn(),
  mockFindDocumentById: vi.fn(),
  mockReviewDocument: vi.fn(),
  mockListRides: vi.fn(),
  mockListActiveDrivers: vi.fn(),
  mockAssignDriver: vi.fn(),
  mockCancelRide: vi.fn(),
  mockRecordSafe: vi.fn(),
  mockFindDriverStatusByDriverId: vi.fn(),
  mockSetBusy: vi.fn(),
  mockSetAvailable: vi.fn(),
  mockFindOfflineBookingById: vi.fn(),
  mockSyncOfflineBooking: vi.fn(),
  mockCreateOfflineRide: vi.fn(),
}));

vi.mock("../../../modules/auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken: mockVerifyAccessToken,
    hashToken: mockHashToken,
  })),
}));

vi.mock("../../../modules/auth/session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    isSessionValid: mockIsSessionValid,
  })),
}));

vi.mock("../../../modules/users/users.repository.js", () => ({
  UsersRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindUserById,
  })),
}));

vi.mock("../admin.repository.js", () => ({
  AdminRepository: vi.fn().mockImplementation(() => ({
    listUsers: mockListUsers,
    findById: mockAdminFindById,
    updateStatus: mockUpdateStatus,
    listDocuments: mockListDocuments,
    findDocumentById: mockFindDocumentById,
    reviewDocument: mockReviewDocument,
    listRides: mockListRides,
    listActiveDrivers: mockListActiveDrivers,
    assignDriver: mockAssignDriver,
    cancelRide: mockCancelRide,
  })),
}));

vi.mock("../../../modules/audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({
    recordSafe: mockRecordSafe,
  })),
}));

vi.mock("../../../modules/drivers/driverStatus.repository.js", () => ({
  DriverStatusRepository: vi.fn().mockImplementation(() => ({
    findByDriverId: mockFindDriverStatusByDriverId,
    setBusy: mockSetBusy,
    setAvailable: mockSetAvailable,
  })),
}));

vi.mock("../../../modules/offline/offline.repository.js", () => ({
  OfflineRepository: vi.fn().mockImplementation(() => ({
    findOfflineBookingById: mockFindOfflineBookingById,
    syncOfflineBooking: mockSyncOfflineBooking,
  })),
}));

vi.mock("../../../modules/rides/rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    createOfflineRide: mockCreateOfflineRide,
  })),
}));

import { AdminService } from "../admin.service.js";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const PASSENGER_ID = "22222222-2222-4222-8222-222222222222";

const adminUser = {
  id: ADMIN_ID,
  email: "admin@test.com",
  name: "Admin",
  role: "admin",
  status: "active",
  isVerified: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const passengerUser = {
  id: PASSENGER_ID,
  email: "passenger@test.com",
  name: "Passenger",
  role: "passenger",
  status: "active",
  isVerified: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("AdminService authorization", () => {
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminService();
    mockHashToken.mockReturnValue("hashed-token");
    mockIsSessionValid.mockResolvedValue(true);
  });

  it("blocks passenger from listing users", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    mockFindUserById.mockResolvedValue(passengerUser);

    const result = await service.listUsers("tok-passenger", {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_FORBIDDEN");
      expect(result.statusCode).toBe(403);
    }
    expect(mockListUsers).not.toHaveBeenCalled();
  });

  it("returns 401 when admin session is revoked", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: ADMIN_ID });
    mockIsSessionValid.mockResolvedValue(false);

    const result = await service.listUsers("tok-admin", {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_SESSION_REVOKED");
      expect(result.statusCode).toBe(401);
    }
    expect(mockFindUserById).not.toHaveBeenCalled();
    expect(mockListUsers).not.toHaveBeenCalled();
  });

  it("allows admin to list users", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: ADMIN_ID });
    mockFindUserById.mockResolvedValue(adminUser);
    mockListUsers.mockResolvedValue([passengerUser]);

    const result = await service.listUsers("tok-admin", {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.users).toHaveLength(1);
      expect(result.users[0]?.id).toBe(PASSENGER_ID);
      expect(result.users[0]?.email).toBe("passenger@test.com");
    }
    expect(mockListUsers).toHaveBeenCalledWith({
      role: undefined,
      status: undefined,
      search: undefined,
    });
  });
});
