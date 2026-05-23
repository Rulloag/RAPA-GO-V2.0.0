import { apiClient } from "../../services/api/index.js";

export interface NotificationData {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  actionUrl: string | null;
  waMeUrl: string | null;
  createdAt: string;
  expiresAt: string | null;
}

type NotificationsEnvelope = { ok: true; data: { items: NotificationData[]; unreadCount: number }; statusCode: number };

export const notificationsService = {
  async getMyNotifications(token: string): Promise<{ items: NotificationData[]; unreadCount: number }> {
    const result = await apiClient.get<NotificationsEnvelope>("/notifications/me", { token });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error al cargar notificaciones");
    return (result.data as NotificationsEnvelope).data;
  },

  async markRead(token: string, id: string): Promise<void> {
    await apiClient.patch<unknown>(`/notifications/${id}/read`, {}, { token });
  },

  async dismiss(token: string, id: string): Promise<void> {
    await apiClient.patch<unknown>(`/notifications/${id}/dismiss`, {}, { token });
  },

  async markAllRead(token: string): Promise<void> {
    await apiClient.post<unknown>("/notifications/mark-all-read", {}, { token });
  },
};
