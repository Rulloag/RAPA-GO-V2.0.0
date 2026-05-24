import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { FareSettingsRepository } from "./fareSettings.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  FareSettingsResult, FareSettingResult, ZoneFaresResult, ZoneFareResult,
  FareSettingResponse, ZoneFareResponse,
} from "./fareSettings.types.js";
import type { FareSetting, ZoneFare } from "../../db/schema/index.js";
import type { CreateFareSettingInput, UpdateFareSettingInput, CreateZoneFareInput, UpdateZoneFareInput } from "./fareSettings.schemas.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const fareRepo       = new FareSettingsRepository();

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

function toFareResponse(f: FareSetting): FareSettingResponse {
  return {
    id: f.id, type: f.type, name: f.name, value: f.value, currency: f.currency,
    description: f.description ?? null, isActive: f.isActive,
    effectiveFrom: f.effectiveFrom, effectiveUntil: f.effectiveUntil ?? null,
    createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString(),
  };
}

function toZoneFareResponse(z: ZoneFare): ZoneFareResponse {
  return {
    id: z.id, zoneFrom: z.zoneFrom, zoneTo: z.zoneTo, fare: z.fare,
    isActive: z.isActive,
    createdAt: z.createdAt.toISOString(), updatedAt: z.updatedAt.toISOString(),
  };
}

export class FareSettingsService {
  async getActive(): Promise<FareSettingsResult> {
    const items = await fareRepo.findActive();
    return { ok: true, items: items.map(toFareResponse) };
  }

  async getByType(type: string): Promise<FareSettingResult> {
    const setting = await fareRepo.findByType(type);
    if (!setting) {
      return { ok: false, code: "NOT_FOUND", message: "Fare setting not found.", statusCode: 404 };
    }
    return { ok: true, setting: toFareResponse(setting) };
  }

  async getZoneFares(filters: { zoneFrom?: string; zoneTo?: string }): Promise<ZoneFaresResult> {
    const items = await fareRepo.findZoneFares(filters);
    return { ok: true, items: items.map(toZoneFareResponse), total: items.length };
  }

  async listAll(accessToken: string): Promise<FareSettingsResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only admins can access fare settings history.", statusCode: 403 };
    }
    const items = await fareRepo.findAll();
    return { ok: true, items: items.map(toFareResponse) };
  }

  async createFareSetting(accessToken: string, input: CreateFareSettingInput): Promise<FareSettingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only admins can create fare settings.", statusCode: 403 };
    }

    const effectiveFrom = input.effectiveFrom ?? new Date().toISOString().split("T")[0]!;
    await fareRepo.closeActiveByType(input.type);

    const setting = await fareRepo.create({
      type: input.type, name: input.name, value: input.value,
      ...(input.currency      ? { currency:       input.currency }      : {}),
      ...(input.description   ? { description:    input.description }   : {}),
      ...(input.effectiveUntil ? { effectiveUntil: input.effectiveUntil } : {}),
      effectiveFrom,
      createdBy: auth.userId,
    });
    return { ok: true, setting: toFareResponse(setting) };
  }

  async updateFareSetting(accessToken: string, id: string, input: UpdateFareSettingInput): Promise<FareSettingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only admins can update fare settings.", statusCode: 403 };
    }

    const existing = await fareRepo.findById(id);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "Fare setting not found.", statusCode: 404 };
    }

    const updateData: { name?: string; value?: number; isActive?: boolean; effectiveUntil?: string; description?: string } = {};
    if (input.name           !== undefined) updateData.name           = input.name;
    if (input.value          !== undefined) updateData.value          = input.value;
    if (input.isActive       !== undefined) updateData.isActive       = input.isActive;
    if (input.effectiveUntil !== undefined) updateData.effectiveUntil = input.effectiveUntil;
    if (input.description    !== undefined) updateData.description    = input.description;
    const updated = await fareRepo.update(id, updateData);
    if (!updated) {
      return { ok: false, code: "NOT_FOUND", message: "Fare setting not found.", statusCode: 404 };
    }
    return { ok: true, setting: toFareResponse(updated) };
  }

  async createZoneFare(accessToken: string, input: CreateZoneFareInput): Promise<ZoneFareResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only admins can create zone fares.", statusCode: 403 };
    }
    const zoneFare = await fareRepo.upsertZoneFare(input);
    return { ok: true, zoneFare: toZoneFareResponse(zoneFare) };
  }

  async updateZoneFare(accessToken: string, id: string, input: UpdateZoneFareInput): Promise<ZoneFareResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only admins can update zone fares.", statusCode: 403 };
    }
    const zoneUpdateData: { fare?: number; isActive?: boolean } = {};
    if (input.fare     !== undefined) zoneUpdateData.fare     = input.fare;
    if (input.isActive !== undefined) zoneUpdateData.isActive = input.isActive;
    const updated = await fareRepo.updateZoneFare(id, zoneUpdateData);
    if (!updated) {
      return { ok: false, code: "NOT_FOUND", message: "Zone fare not found.", statusCode: 404 };
    }
    return { ok: true, zoneFare: toZoneFareResponse(updated) };
  }
}
