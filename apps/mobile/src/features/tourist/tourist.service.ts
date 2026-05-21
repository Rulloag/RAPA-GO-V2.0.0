import { apiClient } from "../../services/api/index.js";

export interface TouristServiceData {
  id: string;
  guideId: string;
  title: string;
  description: string | null;
  type: string;
  durationMinutes: number | null;
  maxPeople: number | null;
  price: number | null;
  includes: string[] | null;
  languages: string[] | null;
  meetingPoint: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceBookingData {
  id: string;
  serviceId: string;
  passengerId: string;
  guideId: string;
  bookingDate: string;
  bookingTime: string | null;
  numberOfPeople: number;
  status: string;
  notes: string | null;
  totalPrice: number | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuidePublicData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  languages: string[] | null;
  profilePhotoUrl: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  services?: TouristServiceData[];
}

export interface CreateBookingInput {
  serviceId: string;
  bookingDate: string;
  bookingTime?: string;
  numberOfPeople: number;
  notes?: string;
}

export interface CreateServiceInput {
  title: string;
  description?: string;
  type: "tour" | "transfer" | "workshop" | "custom";
  durationMinutes?: number;
  maxPeople?: number;
  price?: number;
  includes?: string[];
  languages?: string[];
  meetingPoint?: string;
}

type GuidesEnvelope = { ok: true; data: { items: GuidePublicData[]; total: number; page: number }; statusCode: number };
type GuideEnvelope  = { ok: true; data: GuidePublicData; statusCode: number };
type ServicesEnvelope = { ok: true; data: { items: TouristServiceData[]; total: number; page: number }; statusCode: number };
type ServiceEnvelope  = { ok: true; data: TouristServiceData; statusCode: number };
type BookingEnvelope  = { ok: true; data: ServiceBookingData; statusCode: number };
type BookingsEnvelope = { ok: true; data: { items: ServiceBookingData[]; total: number; page: number }; statusCode: number };

export const touristService = {
  async listGuides(accessToken: string, filters: { name?: string; language?: string } = {}): Promise<GuidePublicData[]> {
    const params = new URLSearchParams();
    if (filters.name)     params.set("name",     filters.name);
    if (filters.language) params.set("language", filters.language);
    const qs = params.toString();
    const result = await apiClient.get<GuidesEnvelope>(`/guides${qs ? `?${qs}` : ""}`, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to load guides.");
    return (result.data as GuidesEnvelope).data.items;
  },

  async getGuide(accessToken: string, guideId: string): Promise<GuidePublicData> {
    const result = await apiClient.get<GuideEnvelope>(`/guides/${guideId}`, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to load guide.");
    return (result.data as GuideEnvelope).data;
  },

  async listGuideServices(accessToken: string, guideId: string): Promise<TouristServiceData[]> {
    const result = await apiClient.get<ServicesEnvelope>(`/guides/${guideId}/services`, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to load services.");
    return (result.data as ServicesEnvelope).data.items;
  },

  async getMyServices(accessToken: string): Promise<TouristServiceData[]> {
    const result = await apiClient.get<ServicesEnvelope>("/guides/me/services", { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to load my services.");
    return (result.data as ServicesEnvelope).data.items;
  },

  async createService(accessToken: string, input: CreateServiceInput): Promise<TouristServiceData> {
    const result = await apiClient.post<ServiceEnvelope>("/guides/me/services", input, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to create service.");
    return (result.data as ServiceEnvelope).data;
  },

  async updateService(accessToken: string, serviceId: string, input: Partial<CreateServiceInput>): Promise<TouristServiceData> {
    const result = await apiClient.patch<ServiceEnvelope>(`/guides/me/services/${serviceId}`, input, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to update service.");
    return (result.data as ServiceEnvelope).data;
  },

  async createBooking(accessToken: string, input: CreateBookingInput): Promise<ServiceBookingData> {
    const result = await apiClient.post<BookingEnvelope>("/service-bookings", input, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to create booking.");
    return (result.data as BookingEnvelope).data;
  },

  async getMyBookings(accessToken: string, page = 1, limit = 20): Promise<{ items: ServiceBookingData[]; total: number }> {
    const result = await apiClient.get<BookingsEnvelope>(`/service-bookings/me?page=${page}&limit=${limit}`, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to load bookings.");
    return (result.data as BookingsEnvelope).data;
  },

  async cancelBooking(accessToken: string, bookingId: string, reason?: string): Promise<ServiceBookingData> {
    const body: { reason?: string } = {};
    if (reason) body.reason = reason;
    const result = await apiClient.patch<BookingEnvelope>(`/service-bookings/${bookingId}/cancel`, body, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to cancel booking.");
    return (result.data as BookingEnvelope).data;
  },

  async getGuideBookings(accessToken: string, page = 1, limit = 20): Promise<{ items: ServiceBookingData[]; total: number }> {
    const result = await apiClient.get<BookingsEnvelope>(`/guides/me/bookings?page=${page}&limit=${limit}`, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to load guide bookings.");
    return (result.data as BookingsEnvelope).data;
  },

  async confirmBooking(accessToken: string, bookingId: string): Promise<ServiceBookingData> {
    const result = await apiClient.patch<BookingEnvelope>(`/guides/me/bookings/${bookingId}/confirm`, {}, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to confirm booking.");
    return (result.data as BookingEnvelope).data;
  },

  async completeBooking(accessToken: string, bookingId: string): Promise<ServiceBookingData> {
    const result = await apiClient.patch<BookingEnvelope>(`/guides/me/bookings/${bookingId}/complete`, {}, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to complete booking.");
    return (result.data as BookingEnvelope).data;
  },
};
