import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createClient } from "@supabase/supabase-js";

import { sendError, sendOk } from "../../shared/http/apiResponse.js";
import { SessionService } from "../auth/session.service.js";
import { TokenService } from "../auth/token.service.js";
import { UsersRepository } from "../users/users.repository.js";

const BUCKET = "driver-profile-assets";
const MAX_FILE_BYTES = 650_000;
const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepository = new UsersRepository();

type UploadBody = {
  dataUrl?: unknown;
  fileName?: unknown;
  vehicleId?: unknown;
  ownership?: unknown;
};

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

function getToken(request: FastifyRequest): string {
  return String(request.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
}

async function authenticate(accessToken: string): Promise<AuthResult> {
  if (!accessToken) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: "Debes iniciar sesión para subir la foto.",
      statusCode: 401,
    };
  }

  try {
    const payload = tokenService.verifyAccessToken(accessToken);
    const tokenHash = tokenService.hashToken(accessToken);
    const isValid = await sessionService.isSessionValid(tokenHash);

    if (!isValid) {
      return {
        ok: false,
        code: "AUTH_SESSION_REVOKED",
        message: "La sesión ya no es válida.",
        statusCode: 401,
      };
    }

    const user = await usersRepository.findById(payload.sub);
    if (!user) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "No se encontró la cuenta del conductor.",
        statusCode: 404,
      };
    }

    return { ok: true, userId: user.id, role: user.role };
  } catch {
    return {
      ok: false,
      code: "AUTH_INVALID_TOKEN",
      message: "La sesión no es válida.",
      statusCode: 401,
    };
  }
}

function safePathSegment(value: unknown, fallback: string): string {
  const clean = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return clean || fallback;
}

function parseImageDataUrl(dataUrl: unknown):
  | {
      ok: true;
      contentType: "image/jpeg" | "image/png" | "image/webp";
      extension: "jpg" | "png" | "webp";
      bytes: Uint8Array;
    }
  | { ok: false; message: string } {
  const text = String(dataUrl ?? "").trim();
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\r\n]+)$/i.exec(text);

  if (!match) {
    return {
      ok: false,
      message: "La foto debe ser JPG, PNG o WEBP.",
    };
  }

  const rawContentType = match[1];
  const rawBase64 = match[2];

  if (!rawContentType || !rawBase64) {
    return {
      ok: false,
      message: "La foto no contiene datos válidos.",
    };
  }

  const contentType = rawContentType.toLowerCase() as
    | "image/jpeg"
    | "image/png"
    | "image/webp";

  let buffer: Buffer;
  try {
    buffer = Buffer.from(rawBase64.replace(/\s+/g, ""), "base64");
  } catch {
    return { ok: false, message: "La foto no contiene datos válidos." };
  }

  if (buffer.length === 0) {
    return { ok: false, message: "La foto está vacía." };
  }

  if (buffer.length > MAX_FILE_BYTES) {
    return {
      ok: false,
      message: "La foto procesada supera el máximo de 650 KB.",
    };
  }

  const extension =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : "jpg";

  return {
    ok: true,
    contentType,
    extension,
    bytes: new Uint8Array(buffer),
  };
}

async function uploadVehiclePhoto(
  request: FastifyRequest<{ Body: UploadBody }>,
  reply: FastifyReply,
) {
  const auth = await authenticate(getToken(request));
  if (!auth.ok) {
    return sendError(reply, auth);
  }

  if (auth.role !== "driver") {
    return sendError(reply, {
      code: "AUTH_FORBIDDEN",
      message: "Solo un conductor puede subir fotos de sus vehículos.",
      statusCode: 403,
    });
  }

  const parsedImage = parseImageDataUrl(request.body?.dataUrl);
  if (!parsedImage.ok) {
    return sendError(reply, {
      code: "VALIDATION_ERROR",
      message: parsedImage.message,
      statusCode: 400,
    });
  }

  const supabaseUrl = String(process.env["SUPABASE_URL"] ?? "").trim();
  const serviceRoleKey = String(
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
  ).trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return sendError(reply, {
      code: "STORAGE_NOT_CONFIGURED",
      message: "El almacenamiento de fotos no está configurado en el backend.",
      statusCode: 503,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ownership = request.body?.ownership === "borrowed" ? "borrowed" : "own";
  const vehicleSegment = safePathSegment(
    request.body?.vehicleId,
    `draft-${ownership}`,
  );
  const storagePath = [
    auth.userId,
    "vehicles",
    vehicleSegment,
    `${Date.now()}-${randomUUID()}.${parsedImage.extension}`,
  ].join("/");

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, parsedImage.bytes, {
      contentType: parsedImage.contentType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    request.log.error(
      { err: uploadError, driverUserId: auth.userId, storagePath },
      "No se pudo subir la foto del vehículo a Supabase",
    );

    return sendError(reply, {
      code: "VEHICLE_PHOTO_UPLOAD_FAILED",
      message: "No se pudo subir la foto del vehículo. Intenta nuevamente.",
      statusCode: 502,
    });
  }

  const { data: publicData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const publicUrl = String(publicData.publicUrl ?? "").trim();
  if (!publicUrl) {
    return sendError(reply, {
      code: "VEHICLE_PHOTO_URL_FAILED",
      message: "La foto se subió, pero no se pudo obtener su URL pública.",
      statusCode: 502,
    });
  }

  return sendOk(reply, {
    publicUrl,
    storagePath,
    bucket: BUCKET,
    contentType: parsedImage.contentType,
    sizeBytes: parsedImage.bytes.byteLength,
  });
}

export async function driverVehiclePhotoRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.post<{ Body: UploadBody }>(
    "/drivers/me/vehicle-photo",
    {
      bodyLimit: 950_000,
      config: { rateLimit: { max: 15, timeWindow: 60_000 } },
    },
    uploadVehiclePhoto,
  );
}
