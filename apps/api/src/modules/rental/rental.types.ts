export interface RentalVehicleResponse {
  id: string; operatorId: string; brand: string; model: string; year: number | null;
  plate: string; color: string | null; type: string; seats: number | null;
  transmission: string | null; fuelType: string | null; dailyPrice: number;
  description: string | null; features: string[] | null; photos: string[] | null;
  status: string; createdAt: string; updatedAt: string;
  operatorName?: string | null; operatorPhone?: string | null;
}

export interface RentalBookingResponse {
  id: string; vehicleId: string; passengerId: string; operatorId: string;
  startDate: string; endDate: string; pickupTime: string | null; returnTime: string | null;
  pickupLocation: string | null; returnLocation: string | null; status: string;
  totalPrice: number | null; notes: string | null; cancellationReason: string | null;
  createdAt: string; updatedAt: string;
  vehicleBrand?: string; vehicleModel?: string; vehiclePlate?: string; vehicleType?: string;
  passengerName?: string | null;
}

export type RentalVehicleResult =
  | { ok: true; vehicle: RentalVehicleResponse }
  | { ok: false; code: string; message: string; statusCode: number };

export type RentalVehiclesResult =
  | { ok: true; items: RentalVehicleResponse[]; total: number; page: number }
  | { ok: false; code: string; message: string; statusCode: number };

export type RentalBookingResult =
  | { ok: true; booking: RentalBookingResponse }
  | { ok: false; code: string; message: string; statusCode: number };

export type RentalBookingsResult =
  | { ok: true; items: RentalBookingResponse[]; total: number; page: number }
  | { ok: false; code: string; message: string; statusCode: number };
