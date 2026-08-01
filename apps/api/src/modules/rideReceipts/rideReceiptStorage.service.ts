import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "../../shared/errors/AppError.js";

const DEFAULT_BUCKET = "ride-receipts";
const MAX_PDF_BYTES = 5 * 1024 * 1024;

let supabaseClient: SupabaseClient | null = null;
let bucketReady: Promise<void> | null = null;

function getClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const url = process.env["SUPABASE_URL"]?.trim();
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();

  if (!url || !serviceRoleKey) {
    throw AppError.internal(
      "SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias para guardar comprobantes PDF.",
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

function bucketName(): string {
  return (
    process.env["RIDE_RECEIPTS_BUCKET"]?.trim() || DEFAULT_BUCKET
  );
}

async function ensureBucket(): Promise<void> {
  if (bucketReady) {
    await bucketReady;
    return;
  }

  bucketReady = (async () => {
    const client = getClient();
    const bucket = bucketName();
    const lookup = await client.storage.getBucket(bucket);

    if (lookup.data) return;

    const created = await client.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: MAX_PDF_BYTES,
      allowedMimeTypes: ["application/pdf"],
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

  try {
    await bucketReady;
  } catch (error) {
    bucketReady = null;
    throw error;
  }
}

export class RideReceiptStorageService {
  async upload(input: {
    ownerUserId: string;
    rideId: string;
    receiptId: string;
    type: string;
    pdf: Buffer;
  }): Promise<{ bucket: string; path: string }> {
    if (input.pdf.length === 0) {
      throw AppError.internal("El comprobante PDF está vacío.");
    }

    if (input.pdf.length > MAX_PDF_BYTES) {
      throw AppError.internal("El comprobante PDF supera 5 MB.");
    }

    await ensureBucket();

    const bucket = bucketName();
    const safeType = input.type.replace(/[^a-z0-9_-]/gi, "-");
    const path = [
      input.ownerUserId,
      input.rideId,
      `${safeType}-${input.receiptId}.pdf`,
    ].join("/");

    const uploaded = await getClient().storage.from(bucket).upload(
      path,
      input.pdf,
      {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: true,
      },
    );

    if (uploaded.error) {
      throw AppError.internal(
        `No se pudo guardar el comprobante PDF: ${uploaded.error.message}`,
      );
    }

    return { bucket, path };
  }

  async download(bucket: string, path: string): Promise<Buffer> {
    const downloaded = await getClient().storage.from(bucket).download(path);

    if (downloaded.error || !downloaded.data) {
      throw AppError.internal(
        `No se pudo descargar el comprobante PDF: ${downloaded.error?.message ?? "archivo no disponible"}`,
      );
    }

    return Buffer.from(await downloaded.data.arrayBuffer());
  }

  async createSignedUrl(
    bucket: string,
    path: string,
    expiresSeconds = 15 * 60,
  ): Promise<string> {
    const signed = await getClient()
      .storage
      .from(bucket)
      .createSignedUrl(path, expiresSeconds);

    if (signed.error) {
      throw AppError.internal(
        `No se pudo crear la URL del comprobante: ${signed.error.message}`,
      );
    }

    return signed.data.signedUrl;
  }
}
