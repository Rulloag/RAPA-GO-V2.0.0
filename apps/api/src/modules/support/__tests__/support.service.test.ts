import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyAccessToken,
  hashToken,
  isSessionValid,
  findUserById,
  findRideById,
  createCase,
  findByIdWithRequester,
  listByRequester,
  listForAdmin,
  listEvents,
  addRequesterMessage,
  updateByAdmin,
  findActiveAdminIds,
  createNotification,
} = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  hashToken: vi.fn().mockReturnValue("hash"),
  isSessionValid: vi.fn().mockResolvedValue(true),
  findUserById: vi.fn(),
  findRideById: vi.fn(),
  createCase: vi.fn(),
  findByIdWithRequester: vi.fn(),
  listByRequester: vi.fn(),
  listForAdmin: vi.fn(),
  listEvents: vi.fn(),
  addRequesterMessage: vi.fn(),
  updateByAdmin: vi.fn(),
  findActiveAdminIds: vi.fn().mockResolvedValue([]),
  createNotification: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken,
    hashToken,
  })),
}));
vi.mock("../../auth/session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({ isSessionValid })),
}));
vi.mock("../../users/users.repository.js", () => ({
  UsersRepository: vi.fn().mockImplementation(() => ({ findById: findUserById })),
}));
vi.mock("../../rides/rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({ findById: findRideById })),
}));
vi.mock("../support.repository.js", () => ({
  SupportRepository: vi.fn().mockImplementation(() => ({
    createCase,
    findByIdWithRequester,
    listByRequester,
    listForAdmin,
    listEvents,
    addRequesterMessage,
    updateByAdmin,
    findActiveAdminIds,
  })),
}));
vi.mock("../../notifications/notifications.repository.js", () => ({
  NotificationsRepository: vi.fn().mockImplementation(() => ({ create: createNotification })),
}));

const { SupportService } = await import("../support.service.js");

const PASSENGER_ID = "11111111-1111-4111-8111-111111111111";
const DRIVER_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const RIDE_ID = "44444444-4444-4444-8444-444444444444";
const CASE_ID = "55555555-5555-4555-8555-555555555555";

const passenger = { id: PASSENGER_ID, role: "passenger", status: "active", name: "Pasajero", email: "p@test.cl" };
const driver = { id: DRIVER_ID, role: "driver", status: "active", name: "Conductor", email: "d@test.cl" };
const admin = { id: ADMIN_ID, role: "admin", status: "active", name: "Admin", email: "a@test.cl" };
const now = new Date("2026-07-19T16:00:00.000Z");
const supportCase = {
  id: CASE_ID,
  trackingCode: "RGS-20260719-ABCDEF1234",
  requesterUserId: PASSENGER_ID,
  requesterRole: "passenger",
  rideRequestId: RIDE_ID,
  category: "complaint",
  subject: "Problema durante el viaje",
  description: "El servicio no se realizó como correspondía.",
  priority: "normal",
  status: "open",
  contactPhone: null,
  contactEmail: "p@test.cl",
  lostItemDescription: null,
  lostItemLastSeenAt: null,
  assignedAdminUserId: null,
  adminResolution: null,
  firstResponseAt: null,
  resolvedAt: null,
  closedAt: null,
  createdAt: now,
  updatedAt: now,
};
const caseWithRequester = {
  ...supportCase,
  requesterName: "Pasajero",
  requesterEmail: "p@test.cl",
  assignedAdminName: null,
};

function authenticateAs(user: typeof passenger | typeof driver | typeof admin) {
  verifyAccessToken.mockReturnValue({ sub: user.id });
  findUserById.mockResolvedValue(user);
}

describe("SupportService", () => {
  let service: InstanceType<typeof SupportService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SupportService();
    isSessionValid.mockResolvedValue(true);
    findActiveAdminIds.mockResolvedValue([]);
    listEvents.mockResolvedValue([]);
  });

  it("permite al pasajero crear un reclamo asociado a su viaje", async () => {
    authenticateAs(passenger);
    findRideById.mockResolvedValue({ id: RIDE_ID, passengerUserId: PASSENGER_ID, driverUserId: DRIVER_ID, status: "completed" });
    createCase.mockResolvedValue(supportCase);

    const result = await service.createCase("token", {
      category: "complaint",
      subject: "Problema durante el viaje",
      description: "El servicio no se realizó como correspondía.",
      priority: "normal",
      rideRequestId: RIDE_ID,
    });

    expect(result.ok).toBe(true);
    expect(createCase).toHaveBeenCalledWith(expect.objectContaining({ requesterUserId: PASSENGER_ID, rideRequestId: RIDE_ID }), "passenger");
  });

  it("permite al conductor reportar un objeto perdido en un viaje completado asignado", async () => {
    authenticateAs(driver);
    findRideById.mockResolvedValue({ id: RIDE_ID, passengerUserId: PASSENGER_ID, driverUserId: DRIVER_ID, status: "completed" });
    createCase.mockResolvedValue({ ...supportCase, requesterUserId: DRIVER_ID, requesterRole: "driver", category: "lost_item", lostItemDescription: "Mochila negra" });

    const result = await service.createCase("token", {
      category: "lost_item",
      subject: "Objeto encontrado en el vehículo",
      description: "Encontré una mochila después de finalizar el viaje.",
      priority: "normal",
      rideRequestId: RIDE_ID,
      lostItemDescription: "Mochila negra",
    });

    expect(result.ok).toBe(true);
  });

  it("rechaza objeto perdido cuando el viaje no está completado", async () => {
    authenticateAs(passenger);
    findRideById.mockResolvedValue({ id: RIDE_ID, passengerUserId: PASSENGER_ID, driverUserId: DRIVER_ID, status: "in_progress" });

    const result = await service.createCase("token", {
      category: "lost_item",
      subject: "Perdí una mochila negra",
      description: "Creo que quedó dentro del vehículo durante el viaje.",
      priority: "normal",
      rideRequestId: RIDE_ID,
      lostItemDescription: "Mochila negra",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("LOST_ITEM_RIDE_NOT_COMPLETED");
    expect(createCase).not.toHaveBeenCalled();
  });

  it("impide asociar un caso al viaje de otra cuenta", async () => {
    authenticateAs(passenger);
    findRideById.mockResolvedValue({ id: RIDE_ID, passengerUserId: "other", driverUserId: DRIVER_ID, status: "completed" });

    const result = await service.createCase("token", {
      category: "complaint",
      subject: "Reclamo de un viaje ajeno",
      description: "Estoy intentando asociar un viaje que no pertenece a mi cuenta.",
      priority: "normal",
      rideRequestId: RIDE_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
  });

  it("impide consultar el caso de otra cuenta", async () => {
    authenticateAs(driver);
    findByIdWithRequester.mockResolvedValue(caseWithRequester);

    const result = await service.getMine("token", CASE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
  });

  it("impide a un pasajero listar los casos administrativos", async () => {
    authenticateAs(passenger);
    const result = await service.listForAdmin("token", { limit: 50 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
    expect(listForAdmin).not.toHaveBeenCalled();
  });

  it("permite al admin actualizar y notifica al solicitante", async () => {
    authenticateAs(admin);
    findByIdWithRequester.mockResolvedValueOnce(caseWithRequester).mockResolvedValueOnce({ ...caseWithRequester, status: "in_review", assignedAdminUserId: ADMIN_ID, assignedAdminName: "Admin" });
    updateByAdmin.mockResolvedValue({ ...supportCase, status: "in_review", assignedAdminUserId: ADMIN_ID });

    const result = await service.updateForAdmin("token", CASE_ID, {
      status: "in_review",
      publicMessage: "Estamos revisando tu caso.",
      assignToMe: true,
    });

    expect(result.ok).toBe(true);
    expect(updateByAdmin).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: ADMIN_ID, supportCaseId: CASE_ID }));
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: PASSENGER_ID, type: "support_case_updated" }));
  });

  it("bloquea una sesión revocada", async () => {
    verifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    isSessionValid.mockResolvedValue(false);
    const result = await service.listMine("token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_SESSION_REVOKED");
  });
});
