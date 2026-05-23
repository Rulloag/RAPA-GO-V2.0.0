import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
  getTodayRideStats,
  getTodayRevenue,
  getTodayNewUsers,
  getWeekRideStats,
  getWeekRevenue,
  getTopDriversThisWeek,
  getOperationalStats,
  getRecentActivity,
  generateAlerts,
  type AlertItem,
  type ActivityItem,
} from "./dashboard.repository.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
    }
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }

  const hash  = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);
  if (!valid) {
    return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
  }

  const user = await usersRepo.findById(payload.sub);
  if (!user) {
    return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
  }

  return { ok: true, userId: user.id, role: user.role };
}

export interface DashboardResult {
  ok: true;
  data: {
    today: {
      rides: { total: number; completed: number; cancelled: number; pending: number; inProgress: number };
      revenue: number;
      newUsers: number;
    };
    thisWeek: {
      rides: { total: number; completed: number; cancelled: number };
      revenue: number;
      topDrivers: Array<{ driverId: string; name: string; trips: number; revenue: number }>;
    };
    operational: {
      activeDrivers: number;
      busyDrivers: number;
      unavailableDrivers: number;
      pendingDocuments: number;
      pendingOfflineBookings: number;
      pendingServiceBookings: number;
      pendingRentalBookings: number;
    };
    alerts: AlertItem[];
  };
}

export type DashboardServiceResult =
  | DashboardResult
  | { ok: false; code: string; message: string; statusCode: number };

export interface ActivityResult {
  ok: true;
  items: ActivityItem[];
}

export type ActivityServiceResult =
  | ActivityResult
  | { ok: false; code: string; message: string; statusCode: number };

export class DashboardService {
  async getDashboard(accessToken: string): Promise<DashboardServiceResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const [todayRides, todayRevenue, todayNewUsers, weekRides, weekRevenue, topDrivers, operational] =
      await Promise.all([
        getTodayRideStats(),
        getTodayRevenue(),
        getTodayNewUsers(),
        getWeekRideStats(),
        getWeekRevenue(),
        getTopDriversThisWeek(),
        getOperationalStats(),
      ]);

    const alerts = generateAlerts(operational);

    return {
      ok: true,
      data: {
        today: {
          rides: todayRides,
          revenue: todayRevenue,
          newUsers: todayNewUsers,
        },
        thisWeek: {
          rides: weekRides,
          revenue: weekRevenue,
          topDrivers,
        },
        operational,
        alerts,
      },
    };
  }

  async getActivity(accessToken: string, limit: number): Promise<ActivityServiceResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const items = await getRecentActivity(limit);
    return { ok: true, items };
  }
}
