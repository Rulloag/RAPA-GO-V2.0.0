import { apiClient } from "../../services/api/index.js";

export interface RentalVehicleData {
  id: string; operatorId: string; brand: string; model: string; year: number | null;
  plate: string; color: string | null; type: string; seats: number | null;
  transmission: string | null; fuelType: string | null; dailyPrice: number;
  description: string | null; features: string[] | null; photos: string[] | null;
  status: string; createdAt: string; updatedAt: string;
  operatorName?: string | null; operatorPhone?: string | null;
}

export interface RentalBookingData {
  id: string; vehicleId: string; passengerId: string; operatorId: string;
  startDate: string; endDate: string; pickupTime: string | null; returnTime: string | null;
  pickupLocation: string | null; returnLocation: string | null; status: string;
  totalPrice: number | null; notes: string | null; cancellationReason: string | null;
  createdAt: string; updatedAt: string;
  vehicleBrand?: string; vehicleModel?: string; vehiclePlate?: string; vehicleType?: string;
  passengerName?: string | null;
}

export interface CreateVehicleInput {
  brand: string; model: string; year?: number; plate: string; color?: string;
  type: "car" | "suv" | "van" | "motorcycle" | "bicycle" | "quad";
  seats?: number; transmission?: "manual" | "automatic";
  fuelType?: "gasoline" | "diesel" | "electric" | "hybrid";
  dailyPrice: number; description?: string; features?: string[]; photos?: string[];
}

export interface CreateBookingInput {
  vehicleId: string; startDate: string; endDate: string;
  pickupTime?: string; returnTime?: string;
  pickupLocation?: string; returnLocation?: string; notes?: string;
}

type VehiclesEnvelope  = { ok: true; data: { items: RentalVehicleData[]; total: number; page: number }; statusCode: number };
type VehicleEnvelope   = { ok: true; data: RentalVehicleData; statusCode: number };
type BookingEnvelope   = { ok: true; data: RentalBookingData; statusCode: number };
type BookingsEnvelope  = { ok: true; data: { items: RentalBookingData[]; total: number; page: number }; statusCode: number };

export const rentalService = {
  async listAvailableVehicles(accessToken: string, filters: { type?: string; dateFrom?: string; dateTo?: string; page?: number } = {}): Promise<{ items: RentalVehicleData[]; total: number }> {
    const params = new URLSearchParams();
    if (filters.type)     params.set("type",     filters.type);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo)   params.set("dateTo",   filters.dateTo);
    if (filters.page)     params.set("page",     String(filters.page));
    const qs = params.toString();
    const result = await apiClient.get<VehiclesEnvelope>(`/rental-vehicles${qs ? `?${qs}` : ""}`, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to load vehicles.");
    return (result.data as VehiclesEnvelope).data;
  },

  async getVehicle(accessToken: string, vehicleId: string): Promise<RentalVehicleData> {
    const result = await apiClient.get<VehicleEnvelope>(`/rental-vehicles/${vehicleId}`, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to load vehicle.");
    return (result.data as VehicleEnvelope).data;
  },

  async createRentalBooking(accessToken: string, input: CreateBookingInput): Promise<RentalBookingData> {
    const result = await apiClient.post<BookingEnvelope>("/rental-bookings", input, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to create booking.");
    return (result.data as BookingEnvelope).data;
  },

  async getMyRentalBookings(accessToken: string, page = 1, limit = 20): Promise<{ items: RentalBookingData[]; total: number }> {
    const result = await apiClient.get<BookingsEnvelope>(`/rental-bookings/me?page=${page}&limit=${limit}`, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to load bookings.");
    return (result.data as BookingsEnvelope).data;
  },

  async cancelRentalBooking(accessToken: string, bookingId: string, reason?: string): Promise<RentalBookingData> {
    const body: { reason?: string } = {};
    if (reason) body.reason = reason;
    const result = await apiClient.patch<BookingEnvelope>(`/rental-bookings/${bookingId}/cancel`, body, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to cancel booking.");
    return (result.data as BookingEnvelope).data;
  },

  async getMyVehicles(accessToken: string): Promise<RentalVehicleData[]> {
    const result = await apiClient.get<VehiclesEnvelope>("/rental-operator/me/vehicles", { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to load vehicles.");
    return (result.data as VehiclesEnvelope).data.items;
  },

  async createVehicle(accessToken: string, input: CreateVehicleInput): Promise<RentalVehicleData> {
    const result = await apiClient.post<VehicleEnvelope>("/rental-operator/me/vehicles", input, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to create vehicle.");
    return (result.data as VehicleEnvelope).data;
  },

  async updateVehicle(accessToken: string, vehicleId: string, input: Partial<CreateVehicleInput>): Promise<RentalVehicleData> {
    const result = await apiClient.patch<VehicleEnvelope>(`/rental-operator/me/vehicles/${vehicleId}`, input, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to update vehicle.");
    return (result.data as VehicleEnvelope).data;
  },

  async updateVehicleStatus(accessToken: string, vehicleId: string, status: string): Promise<RentalVehicleData> {
    const result = await apiClient.patch<VehicleEnvelope>(`/rental-operator/me/vehicles/${vehicleId}/status`, { status }, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to update vehicle status.");
    return (result.data as VehicleEnvelope).data;
  },

  async getMyOperatorBookings(accessToken: string, page = 1, limit = 20): Promise<{ items: RentalBookingData[]; total: number }> {
    const result = await apiClient.get<BookingsEnvelope>(`/rental-operator/me/bookings?page=${page}&limit=${limit}`, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to load operator bookings.");
    return (result.data as BookingsEnvelope).data;
  },

  async confirmBooking(accessToken: string, bookingId: string): Promise<RentalBookingData> {
    const result = await apiClient.patch<BookingEnvelope>(`/rental-operator/me/bookings/${bookingId}/confirm`, {}, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to confirm booking.");
    return (result.data as BookingEnvelope).data;
  },

  async completeBooking(accessToken: string, bookingId: string): Promise<RentalBookingData> {
    const result = await apiClient.patch<BookingEnvelope>(`/rental-operator/me/bookings/${bookingId}/complete`, {}, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to complete booking.");
    return (result.data as BookingEnvelope).data;
  },

  async cancelOperatorBooking(accessToken: string, bookingId: string, reason?: string): Promise<RentalBookingData> {
    const body: { reason?: string } = {};
    if (reason) body.reason = reason;
    const result = await apiClient.patch<BookingEnvelope>(`/rental-operator/me/bookings/${bookingId}/cancel`, body, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Failed to cancel booking.");
    return (result.data as BookingEnvelope).data;
  },
};
