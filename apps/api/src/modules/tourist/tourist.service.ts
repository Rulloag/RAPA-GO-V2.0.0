import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { TouristRepository } from "./tourist.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  TouristServiceResponse, ServiceBookingResponse, GuidePublicProfile,
  TouristServiceResult, TouristServicesResult,
  ServiceBookingResult, ServiceBookingsResult,
  GuidesResult, GuideResult, ServicePricingResult,
} from "./tourist.types.js";
import { NotificationsRepository } from "../notifications/notifications.repository.js";
import type { TouristService as TouristServiceRow, ServiceBooking } from "../../db/schema/index.js";
import type { CreateServiceInput, UpdateServiceInput, CreateBookingInput, CancelBookingInput } from "./tourist.schemas.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const repo           = new TouristRepository();

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

function toServiceResponse(s: TouristServiceRow): TouristServiceResponse {
  return {
    id:                 s.id,
    guideId:            s.guideId,
    title:              s.title,
    description:        s.description ?? null,
    type:               s.type,
    durationMinutes:    s.durationMinutes ?? null,
    maxPeople:          s.maxPeople ?? null,
    price:              s.price ?? null,
    includes:           s.includes ?? null,
    languages:          s.languages ?? null,
    meetingPoint:       s.meetingPoint ?? null,
    includesVehicle:    s.includesVehicle,
    conditions:         s.conditions ?? null,
    cancellationPolicy: s.cancellationPolicy ?? null,
    status:             s.status,
    createdAt:          s.createdAt.toISOString(),
    updatedAt:          s.updatedAt.toISOString(),
  };
}

function toBookingResponse(b: ServiceBooking): ServiceBookingResponse {  // ServiceBooking from schema
  return {
    id:                 b.id,
    serviceId:          b.serviceId,
    passengerId:        b.passengerId,
    guideId:            b.guideId,
    bookingDate:        b.bookingDate,
    bookingTime:        b.bookingTime ?? null,
    numberOfPeople:     b.numberOfPeople,
    status:             b.status,
    notes:              b.notes ?? null,
    totalPrice:         b.totalPrice ?? null,
    cancellationReason: b.cancellationReason ?? null,
    createdAt:          b.createdAt.toISOString(),
    updatedAt:          b.updatedAt.toISOString(),
  };
}

export class TouristService {
  async listGuides(accessToken: string, filters: { name?: string; language?: string } = {}): Promise<GuidesResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const { items, total } = await repo.findGuides(filters);
    const guides: GuidePublicProfile[] = items.map((g) => ({
      id:              g.id,
      name:            g.name,
      email:           g.email,
      phone:           g.phone,
      bio:             g.bio,
      languages:       g.languages,
      profilePhotoUrl: g.profilePhotoUrl,
      ratingAverage:   g.ratingAverage,
      ratingCount:     g.ratingCount,
    }));
    return { ok: true, items: guides, total, page: 1 };
  }

  async getGuide(accessToken: string, guideId: string): Promise<GuideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const g = await repo.findGuideById(guideId);
    if (!g) return { ok: false, code: "NOT_FOUND", message: "Guide not found.", statusCode: 404 };

    const services = await repo.findServicesByGuide(guideId, true);
    const guide: GuidePublicProfile = {
      id:              g.id,
      name:            g.name,
      email:           g.email,
      phone:           g.phone,
      bio:             g.bio,
      languages:       g.languages,
      profilePhotoUrl: g.profilePhotoUrl,
      ratingAverage:   g.ratingAverage,
      ratingCount:     g.ratingCount,
      services:        services.map(toServiceResponse),
    };
    return { ok: true, guide };
  }

  async listGuideServices(accessToken: string, guideId: string): Promise<TouristServicesResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const rows = await repo.findServicesByGuide(guideId, true);
    return { ok: true, items: rows.map(toServiceResponse), total: rows.length, page: 1 };
  }

  async createService(accessToken: string, input: CreateServiceInput): Promise<TouristServiceResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "guide") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only guides can create services.", statusCode: 403 };
    }

    const service = await repo.createService(auth.userId, input);
    if (input.pricingTiers && input.pricingTiers.length > 0) {
      await repo.setPricingTiers(service.id, input.pricingTiers);
    }
    return { ok: true, service: toServiceResponse(service) };
  }

  async updateService(accessToken: string, serviceId: string, input: UpdateServiceInput): Promise<TouristServiceResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "guide") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only guides can update services.", statusCode: 403 };
    }

    const updated = await repo.updateService(serviceId, auth.userId, input);
    if (!updated) return { ok: false, code: "NOT_FOUND", message: "Service not found or not yours.", statusCode: 404 };
    if (input.pricingTiers !== undefined) {
      await repo.setPricingTiers(serviceId, input.pricingTiers);
    }
    return { ok: true, service: toServiceResponse(updated) };
  }

  async setServiceStatus(accessToken: string, serviceId: string, status: string): Promise<TouristServiceResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "guide") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only guides can change service status.", statusCode: 403 };
    }

    const updated = await repo.setServiceStatus(serviceId, auth.userId, status);
    if (!updated) return { ok: false, code: "NOT_FOUND", message: "Service not found or not yours.", statusCode: 404 };
    return { ok: true, service: toServiceResponse(updated) };
  }

  async getMyServices(accessToken: string): Promise<TouristServicesResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "guide") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only guides can access their services.", statusCode: 403 };
    }

    const rows = await repo.findServicesByGuide(auth.userId);
    return { ok: true, items: rows.map(toServiceResponse), total: rows.length, page: 1 };
  }

  async createBooking(accessToken: string, input: CreateBookingInput): Promise<ServiceBookingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers can create bookings.", statusCode: 403 };
    }

    const today = new Date().toISOString().slice(0, 10);
    if (input.bookingDate < today) {
      return { ok: false, code: "BOOKING_PAST_DATE", message: "Booking date must be today or in the future.", statusCode: 400 };
    }

    const service = await repo.findServiceById(input.serviceId);
    if (!service) return { ok: false, code: "NOT_FOUND", message: "Service not found.", statusCode: 404 };
    if (service.status !== "active") return { ok: false, code: "SERVICE_NOT_ACTIVE", message: "This service is not available.", statusCode: 409 };

    const tiers = await repo.findPricingTiersByService(input.serviceId);
    let totalPrice: number | null;
    if (tiers.length > 0) {
      const tier = await repo.findMatchingPricingTier(input.serviceId, input.numberOfPeople);
      if (!tier) {
        return { ok: false, code: "PRICING_TIER_NOT_FOUND", message: `No hay precio para ${input.numberOfPeople} personas. Contacta al operador.`, statusCode: 422 };
      }
      totalPrice = tier.price;
    } else {
      totalPrice = service.price !== null ? service.price * input.numberOfPeople : null;
    }

    const booking = await repo.createBooking({
      serviceId:      input.serviceId,
      passengerId:    auth.userId,
      guideId:        service.guideId,
      bookingDate:    input.bookingDate,
      numberOfPeople: input.numberOfPeople,
      totalPrice,
      ...(input.bookingTime !== undefined ? { bookingTime: input.bookingTime } : {}),
      ...(input.notes       !== undefined ? { notes:       input.notes       } : {}),
    });
    const notifRepo = new NotificationsRepository();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    notifRepo.create({
      userId: booking.guideId,
      type: "service_booking",
      title: "Nueva reserva recibida",
      message: `Tienes una nueva reserva para ${service.title}. Confirma antes de ${expiresAt.toLocaleTimeString("es-CL")}`,
      entityType: "service_booking",
      entityId: booking.id,
      expiresAt,
    }).catch(() => {});

    return { ok: true, booking: toBookingResponse(booking) };
  }

  async cancelBooking(accessToken: string, bookingId: string, input: CancelBookingInput): Promise<ServiceBookingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const existing = await repo.findBookingById(bookingId);
    if (!existing) return { ok: false, code: "NOT_FOUND", message: "Booking not found.", statusCode: 404 };

    const isOwner = existing.passengerId === auth.userId;
    const isAdmin = auth.role === "admin";
    if (!isOwner && !isAdmin) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only cancel your own bookings.", statusCode: 403 };
    }

    if (existing.status === "cancelled" || existing.status === "completed") {
      return { ok: false, code: "BOOKING_CANNOT_CANCEL", message: `Booking cannot be cancelled — status is '${existing.status}'.`, statusCode: 409 };
    }

    const cancelled = await repo.cancelBooking(bookingId, input.reason ?? null);
    if (!cancelled) return { ok: false, code: "NOT_FOUND", message: "Booking not found.", statusCode: 404 };
    return { ok: true, booking: toBookingResponse(cancelled) };
  }

  async getMyBookings(accessToken: string, page: number, limit: number): Promise<ServiceBookingsResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers can access their bookings.", statusCode: 403 };
    }

    const { items, total } = await repo.findBookingsByPassenger(auth.userId, page, limit);
    return { ok: true, items: items.map(toBookingResponse), total, page };
  }

  async getServicePricing(accessToken: string, serviceId: string): Promise<ServicePricingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const service = await repo.findServiceById(serviceId);
    if (!service) return { ok: false, code: "NOT_FOUND", message: "Service not found.", statusCode: 404 };

    const tiers = await repo.findPricingTiersByService(serviceId);
    return {
      ok: true,
      pricing: {
        tiers: tiers.map((t) => ({
          id:        t.id,
          serviceId: t.serviceId,
          minPeople: t.minPeople,
          maxPeople: t.maxPeople,
          price:     t.price,
        })),
        includesVehicle:    service.includesVehicle,
        conditions:         service.conditions ?? null,
        cancellationPolicy: service.cancellationPolicy ?? null,
      },
    };
  }

  async getMyGuideBookings(accessToken: string, page: number, limit: number): Promise<ServiceBookingsResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "guide") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only guides can access their bookings.", statusCode: 403 };
    }

    const { items, total } = await repo.findBookingsByGuide(auth.userId, page, limit);

    const now = Date.now();
    const notifRepo = new NotificationsRepository();
    for (const b of items) {
      if (b.status === "pending") {
        const expiresAt = new Date(b.createdAt).getTime() + 4 * 60 * 60 * 1000;
        if (expiresAt <= now) {
          repo.cancelBooking(b.id, "expired").then((cancelled) => {
            if (cancelled) {
              notifRepo.create({
                userId: b.passengerId,
                type: "booking_expired",
                title: "Reserva expirada",
                message: "Tu reserva expiró porque el guía no la confirmó a tiempo.",
                entityType: "service_booking",
                entityId: b.id,
              }).catch(() => {});
            }
          }).catch(() => {});
        }
      }
    }

    return { ok: true, items: items.map(toBookingResponse), total, page };
  }

  async confirmBooking(accessToken: string, bookingId: string): Promise<ServiceBookingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "guide") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only guides can confirm bookings.", statusCode: 403 };
    }

    const confirmed = await repo.confirmBooking(bookingId, auth.userId);
    if (!confirmed) {
      const existing = await repo.findBookingById(bookingId);
      if (!existing) return { ok: false, code: "NOT_FOUND", message: "Booking not found.", statusCode: 404 };
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only confirm bookings for your services.", statusCode: 403 };
    }
    return { ok: true, booking: toBookingResponse(confirmed) };
  }

  async completeBooking(accessToken: string, bookingId: string): Promise<ServiceBookingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "guide") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only guides can complete bookings.", statusCode: 403 };
    }

    const completed = await repo.completeBooking(bookingId, auth.userId);
    if (!completed) {
      const existing = await repo.findBookingById(bookingId);
      if (!existing) return { ok: false, code: "NOT_FOUND", message: "Booking not found.", statusCode: 404 };
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only complete bookings for your services.", statusCode: 403 };
    }
    return { ok: true, booking: toBookingResponse(completed) };
  }
}
