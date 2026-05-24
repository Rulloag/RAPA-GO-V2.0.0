import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { EventTicketsRepository } from "./eventTickets.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { EventTicket } from "../../db/schema/index.js";
import type {
  EventTicketResponse, EventTicketResult, EventTicketsResult, ValidateTicketResult,
} from "./eventTickets.types.js";
import type { CreateTicketInput, ValidateTicketInput } from "./eventTickets.schemas.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const repo           = new EventTicketsRepository();

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

function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "RAPA-";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function toResponse(t: EventTicket): EventTicketResponse {
  return {
    id: t.id, userId: t.userId, externalEventId: t.externalEventId,
    externalBookingId: t.externalBookingId, eventName: t.eventName,
    eventDate: t.eventDate ?? null, eventLocation: t.eventLocation ?? null,
    ticketCode: t.ticketCode, qrData: t.qrData, status: t.status,
    validatedAt: t.validatedAt?.toISOString() ?? null,
    validatedBy: t.validatedBy ?? null,
    createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
  };
}

export class EventTicketsService {
  async createTicket(accessToken: string, input: CreateTicketInput): Promise<EventTicketResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "passenger") {
      return { ok: false, code: "FORBIDDEN", message: "Solo pasajeros pueden registrar entradas.", statusCode: 403 };
    }
    const ticketCode = generateTicketCode();
    const qrData = JSON.stringify({
      ticketCode,
      eventId: input.externalEventId,
      userId: auth.userId,
      timestamp: Date.now(),
    });
    const ticket = await repo.create({
      userId: auth.userId,
      externalEventId: input.externalEventId,
      externalBookingId: input.externalBookingId,
      eventName: input.eventName,
      ticketCode,
      qrData,
      ...(input.eventDate     ? { eventDate:     input.eventDate }     : {}),
      ...(input.eventLocation ? { eventLocation: input.eventLocation } : {}),
    });
    return { ok: true, ticket: toResponse(ticket) };
  }

  async getMyTickets(accessToken: string): Promise<EventTicketsResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "passenger") {
      return { ok: false, code: "FORBIDDEN", message: "Solo pasajeros pueden ver sus entradas.", statusCode: 403 };
    }
    const items = await repo.findByUser(auth.userId);
    return { ok: true, items: items.map(toResponse), total: items.length };
  }

  async getTicketQr(accessToken: string, ticketId: string): Promise<EventTicketResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    const ticket = await repo.findById(ticketId);
    if (!ticket) {
      return { ok: false, code: "NOT_FOUND", message: "Entrada no encontrada.", statusCode: 404 };
    }
    if (auth.role !== "admin" && ticket.userId !== auth.userId) {
      return { ok: false, code: "FORBIDDEN", message: "No tienes permiso para ver este QR.", statusCode: 403 };
    }
    return { ok: true, ticket: toResponse(ticket) };
  }

  async validateTicket(accessToken: string, ticketId: string, _input: ValidateTicketInput): Promise<ValidateTicketResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "FORBIDDEN", message: "Solo administradores pueden validar entradas.", statusCode: 403 };
    }
    const existing = await repo.findById(ticketId);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "Entrada no encontrada.", statusCode: 404 };
    }
    if (existing.status !== "active") {
      return { ok: false, code: "TICKET_ALREADY_USED", message: "Esta entrada ya fue utilizada.", statusCode: 409 };
    }
    const validated = await repo.validate(ticketId, auth.userId);
    if (!validated) {
      return { ok: false, code: "TICKET_VALIDATION_FAILED", message: "No se pudo validar la entrada.", statusCode: 500 };
    }
    return {
      ok: true,
      id: validated.id,
      status: "used",
      validatedAt: validated.validatedAt!.toISOString(),
      message: "Entrada validada correctamente",
    };
  }

  async validateByCode(accessToken: string, code: string): Promise<ValidateTicketResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "FORBIDDEN", message: "Solo administradores pueden validar entradas.", statusCode: 403 };
    }
    const ticket = await repo.findByCode(code);
    if (!ticket) {
      return { ok: false, code: "NOT_FOUND", message: "Código no encontrado.", statusCode: 404 };
    }
    if (ticket.status !== "active") {
      return { ok: false, code: "TICKET_ALREADY_USED", message: "Esta entrada ya fue utilizada.", statusCode: 409 };
    }
    const validated = await repo.validate(ticket.id, auth.userId);
    if (!validated) {
      return { ok: false, code: "TICKET_VALIDATION_FAILED", message: "No se pudo validar la entrada.", statusCode: 500 };
    }
    return {
      ok: true,
      id: validated.id,
      status: "used",
      validatedAt: validated.validatedAt!.toISOString(),
      message: "Entrada validada correctamente",
    };
  }

  async getRecentValidations(accessToken: string): Promise<EventTicketsResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "FORBIDDEN", message: "Solo administradores.", statusCode: 403 };
    }
    const items = await repo.findRecentValidations();
    return { ok: true, items: items.map(toResponse), total: items.length };
  }
}
