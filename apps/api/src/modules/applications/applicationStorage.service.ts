import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  ApplicationFileKind,
  UploadApplicationFileInput,
} from "./applications.schemas.js";

const PRIVATE_BUCKET = "driver-application-documents";
const PUBLIC_BUCKET = "driver-profile-assets";
const PRIVATE_REF_PREFIX = "supabase-private://";
const MAX_FILE_BYTES = 650_000;

let supabaseClient: SupabaseClient | null = null;
const bucketReady = new Map<string, Promise<void>>();

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const url = process.env["SUPABASE_URL"]?.trim();
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();

  if (!url || !serviceRoleKey) {
    throw AppError.internal(
      "SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias para guardar documentos de postulaciones.",
    );
  }

  supabaseClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

function isPublicKind(kind: ApplicationFileKind): boolean {
  return kind === "profile_photo" || kind === "vehicle_photo";
}

function extensionForMimeType(
  mimeType: UploadApplicationFileInput["mimeType"],
): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
  }
}

async function ensureBucket(
  bucket: string,
  isPublic: boolean,
): Promise<void> {
  const previous = bucketReady.get(bucket);

  if (previous) {
    await previous;
    return;
  }

  const promise = (async () => {
    const client = getSupabaseClient();
    const lookup = await client.storage.getBucket(bucket);

    if (lookup.data) return;

    const created = await client.storage.createBucket(bucket, {
      public: isPublic,
      fileSizeLimit: MAX_FILE_BYTES,
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ],
    });

    if (
      created.error &&
      !created.error.message.toLowerCase().includes("already exists")
    ) {
      throw AppError.internal(
        `No se pudo preparar el bucket ${bucket}: ${created.error.message}`,
      );
    }
  })();

  bucketReady.set(bucket, promise);

  try {
    await promise;
  } catch (error) {
    bucketReady.delete(bucket);
    throw error;
  }
}

export async function uploadApplicationAsset(
  applicationId: string,
  input: UploadApplicationFileInput,
  fileBuffer: Buffer,
): Promise<string> {
  if (fileBuffer.length === 0) {
    throw AppError.internal("El archivo está vacío.");
  }

  if (fileBuffer.length > MAX_FILE_BYTES) {
    throw AppError.internal(
      "El archivo supera 650 KB. Vuelve a seleccionar una imagen más liviana.",
    );
  }

  const publicAsset = isPublicKind(input.kind);
  const bucket = publicAsset ? PUBLIC_BUCKET : PRIVATE_BUCKET;
  const extension = extensionForMimeType(input.mimeType);
  const path = `${applicationId}/${input.kind}-${randomUUID()}.${extension}`;

  await ensureBucket(bucket, publicAsset);

  const client = getSupabaseClient();
  const uploaded = await client.storage.from(bucket).upload(
    path,
    fileBuffer,
    {
      contentType: input.mimeType,
      cacheControl: publicAsset ? "31536000" : "3600",
      upsert: false,
    },
  );

  if (uploaded.error) {
    throw AppError.internal(
      `No se pudo guardar ${input.kind}: ${uploaded.error.message}`,
    );
  }

  if (publicAsset) {
    return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  return `${PRIVATE_REF_PREFIX}${bucket}/${path}`;
}

export async function resolveApplicationAssetUrl(
  storedValue: string | null | undefined,
): Promise<string | null> {
  if (!storedValue) return null;
  if (!storedValue.startsWith(PRIVATE_REF_PREFIX)) return storedValue;

  const value = storedValue.slice(PRIVATE_REF_PREFIX.length);
  const separator = value.indexOf("/");

  if (separator <= 0) return null;

  const bucket = value.slice(0, separator);
  const path = value.slice(separator + 1);
  const signed = await getSupabaseClient()
    .storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  if (signed.error) {
    throw AppError.internal(
      `No se pudo abrir un documento de la postulación: ${signed.error.message}`,
    );
  }

  return signed.data.signedUrl;
}
