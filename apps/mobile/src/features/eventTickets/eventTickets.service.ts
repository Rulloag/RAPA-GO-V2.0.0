import { apiClient } from "../../services/api/index.js";

export interface EventTicketData {
  id: string; userId: string; externalEventId: string; externalBookingId: string;
  eventName: string; eventDate: string | null; eventLocation: string | null;
  ticketCode: string; qrData: string; status: string;
  validatedAt: string | null; createdAt: string;
}

export const eventTicketsService = {
  async createTicket(token: string, input: {
    externalEventId: string; externalBookingId: string; eventName: string;
    eventDate?: string; eventLocation?: string;
  }): Promise<EventTicketData> {
    const result = await apiClient.post<any>("/event-tickets", input, { token });
    if (!result.ok) throw new Error((result as any).message ?? "Error al crear ticket");
    return (result.data as any).data.ticket;
  },
  async getMyTickets(token: string): Promise<EventTicketData[]> {
    const result = await apiClient.get<any>("/event-tickets/me", { token });
    if (!result.ok) throw new Error((result as any).message ?? "Error");
    return (result.data as any).data.items;
  },
  async getTicketQr(token: string, id: string): Promise<EventTicketData> {
    const result = await apiClient.get<any>(`/event-tickets/${id}/qr`, { token });
    if (!result.ok) throw new Error((result as any).message ?? "Error");
    return (result.data as any).data.ticket;
  },
  async validateByCode(token: string, code: string): Promise<{ id: string; status: string; validatedAt: string; message: string }> {
    const result = await apiClient.post<any>("/event-tickets/validate-by-code", { code }, { token });
    if (!result.ok) throw new Error((result as any).message ?? "Error al validar");
    return (result.data as any).data;
  },
  async getRecentValidations(token: string): Promise<EventTicketData[]> {
    const result = await apiClient.get<any>("/admin/event-tickets/validations", { token });
    if (!result.ok) throw new Error((result as any).message ?? "Error");
    return (result.data as any).data.items;
  },
};
