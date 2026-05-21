export interface TouristServiceResponse {
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

export interface ServiceBookingResponse {
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

export interface GuidePublicProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  languages: string[] | null;
  profilePhotoUrl: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  services?: TouristServiceResponse[];
}

export type TouristServiceResult =
  | { ok: true; service: TouristServiceResponse }
  | { ok: false; code: string; message: string; statusCode: number };

export type TouristServicesResult =
  | { ok: true; items: TouristServiceResponse[]; total: number; page: number }
  | { ok: false; code: string; message: string; statusCode: number };

export type ServiceBookingResult =
  | { ok: true; booking: ServiceBookingResponse }
  | { ok: false; code: string; message: string; statusCode: number };

export type ServiceBookingsResult =
  | { ok: true; items: ServiceBookingResponse[]; total: number; page: number }
  | { ok: false; code: string; message: string; statusCode: number };

export type GuidesResult =
  | { ok: true; items: GuidePublicProfile[]; total: number; page: number }
  | { ok: false; code: string; message: string; statusCode: number };

export type GuideResult =
  | { ok: true; guide: GuidePublicProfile }
  | { ok: false; code: string; message: string; statusCode: number };
