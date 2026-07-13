import { apiClient } from "../../services/api/index.js";

export interface DashboardData {
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
  alerts: Array<{ type: "warning" | "critical"; message: string; action?: string }>;
}

export interface ActivityItem {
  type: "ride" | "booking" | "document";
  description: string;
  userName: string;
  timestamp: string;
  status?: string;
}

export const dashboardService = {
  async getDashboard(accessToken: string): Promise<DashboardData> {
    const res = await apiClient.get<DashboardData>("/api/admin/dashboard", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok === false) throw new Error(res.message ?? "Error al cargar el dashboard.");
    return res.data;
  },

  async getActivity(accessToken: string, limit = 20): Promise<ActivityItem[]> {
    const res = await apiClient.get<ActivityItem[]>(`/api/admin/dashboard/activity?limit=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok === false) throw new Error(res.message ?? "Error al cargar actividad.");
    return res.data;
  },
};
