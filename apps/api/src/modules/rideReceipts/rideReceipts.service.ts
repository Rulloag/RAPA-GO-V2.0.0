import { createHash } from "node:crypto";

import type {
  RideLocationUpdate,
  RidePolicyCharge,
  RideReceipt,
  RideRequest,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import { MailService } from "../auth/mail.service.js";
import { SessionService } from "../auth/session.service.js";
import { TokenService } from "../auth/token.service.js";
import { UsersRepository } from "../users/users.repository.js";
import {
  RideReceiptMapService,
  type ReceiptRoutePoint,
} from "./rideReceiptMap.service.js";
import { generateRideReceiptPdf } from "./rideReceiptPdf.service.js";
import {
  RideReceiptsRepository,
  type ReceiptLegalAcceptance,
} from "./rideReceipts.repository.js";
import { RideReceiptStorageService } from "./rideReceiptStorage.service.js";
import type {
  RideReceiptActionResult,
  RideReceiptDownloadResult,
  RideReceiptListResult,
  RideReceiptResponse,
  RideReceiptType,
} from "./rideReceipts.types.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepository = new UsersRepository();
const receiptsRepository = new RideReceiptsRepository();
const mapService = new RideReceiptMapService();
const storageService = new RideReceiptStorageService();
const mailService = new MailService();

const SUPPORT_EMAIL =
  process.env["RIDE_RECEIPTS_SUPPORT_EMAIL"]?.trim() ||
  "soporte@rapago.cl";
const SUPPORT_PHONE =
  process.env["RIDE_RECEIPTS_SUPPORT_PHONE"]?.trim() ||
  "+56 9 4796 4171";

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload: { sub: string };

  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (error) {
    if (error instanceof AppError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      };
    }

    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid access token.",
      statusCode: 401,
    };
  }

  const tokenHash = tokenService.hashToken(accessToken);
  if (!(await sessionService.isSessionValid(tokenHash))) {
    return {
      ok: false,
      code: "AUTH_SESSION_REVOKED",
      message: "Session has been revoked.",
      statusCode: 401,
    };
  }

  const user = await usersRepository.findById(payload.sub);
  if (!user) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "User not found.",
      statusCode: 404,
    };
  }

  return { ok: true, userId: user.id, role: user.role };
}

function featureEnabled(): boolean {
  const configured = process.env["RIDE_RECEIPTS_ENABLED"]
    ?.trim()
    .toLowerCase();

  if (configured === "true") return true;
  if (configured === "false") return false;

  // Las pruebas unitarias de otros módulos no deben abrir conexiones
  // adicionales ni generar documentos por efectos secundarios.
  return process.env["NODE_ENV"] !== "test";
}

function emailEnabled(): boolean {
  const configured = process.env["RIDE_RECEIPTS_EMAIL_ENABLED"]
    ?.trim()
    .toLowerCase();

  if (configured === "true") return true;
  if (configured === "false") return false;

  return process.env["NODE_ENV"] !== "test";
}

function toResponse(receipt: RideReceipt): RideReceiptResponse {
  return {
    id: receipt.id,
    rideId: receipt.rideId,
    policyChargeId: receipt.policyChargeId ?? null,
    type: receipt.type as RideReceiptType,
    status: receipt.status as RideReceiptResponse["status"],
    documentNumber: receipt.documentNumber,
    emailTo: receipt.emailTo,
    mapProvider: receipt.mapProvider ?? null,
    routePointCount: receipt.routePointCount,
    legalDocumentType: receipt.legalDocumentType ?? null,
    legalDocumentVersion: receipt.legalDocumentVersion ?? null,
    legalAcceptedAt: receipt.legalAcceptedAt?.toISOString() ?? null,
    deliveryAttempts: receipt.deliveryAttempts,
    generatedAt: receipt.generatedAt?.toISOString() ?? null,
    sentAt: receipt.sentAt?.toISOString() ?? null,
    failureReason: receipt.failureReason ?? null,
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString(),
  };
}

function receiptCode(type: RideReceiptType): string {
  switch (type) {
    case "completed_ride":
      return "VIAJE";
    case "late_cancellation":
      return "CANCEL";
    case "no_show":
      return "NOSHOW";
  }
}

function documentNumber(
  type: RideReceiptType,
  rideId: string,
  createdAt: Date,
): string {
  const date = createdAt.toISOString().slice(0, 10).replace(/-/g, "");
  return `RG-${receiptCode(type)}-${date}-${rideId.slice(0, 8).toUpperCase()}`;
}

function receiptFileName(receipt: RideReceipt): string {
  return `${receipt.documentNumber}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function routePoint(point: RideLocationUpdate): ReceiptRoutePoint {
  return { lat: point.latitude, lng: point.longitude };
}

function optionalPoint(
  lat: number | null,
  lng: number | null,
): ReceiptRoutePoint | null {
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function distanceMeters(
  first: ReceiptRoutePoint,
  second: ReceiptRoutePoint,
): number {
  const radius = 6_371_000;
  const toRad = (value: number): number => (value * Math.PI) / 180;
  const dLat = toRad(second.lat - first.lat);
  const dLng = toRad(second.lng - first.lng);
  const lat1 = toRad(first.lat);
  const lat2 = toRad(second.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateRouteDistance(points: ReceiptRoutePoint[]): number | null {
  if (points.length < 2) return null;

  return Math.round(
    points.reduce((total, point, index) => {
      const previous = points[index - 1];
      return previous ? total + distanceMeters(previous, point) : total;
    }, 0),
  );
}

function calculateRideDuration(ride: RideRequest): number | null {
  if (ride.startedAt && ride.completedAt) {
    return Math.max(
      0,
      Math.round((ride.completedAt.getTime() - ride.startedAt.getTime()) / 1000),
    );
  }

  return ride.durationSeconds ?? null;
}

function noShowWaitMinutes(ride: RideRequest): number | null {
  if (!ride.arrivedAt || !ride.cancelledAt) return null;
  return Math.max(
    0,
    Math.round((ride.cancelledAt.getTime() - ride.arrivedAt.getTime()) / 60_000),
  );
}

function receiptAmount(
  type: RideReceiptType,
  ride: RideRequest,
  policyCharge: RidePolicyCharge | null,
  paymentAmount: number | null,
): number {
  if (type === "completed_ride") {
    if (ride.paymentMethod === "card" && paymentAmount != null) {
      return Math.max(0, paymentAmount);
    }

    return Math.max(0, ride.estimatedFareClp ?? 0);
  }

  return Math.max(
    0,
    policyCharge?.approvedAmountClp ??
      policyCharge?.calculatedAmountClp ??
      0,
  );
}

function paymentStatus(
  type: RideReceiptType,
  ride: RideRequest,
  paymentStatusValue: string | null,
): string {
  if (type !== "completed_ride") {
    return "Cargo aprobado por administración para su regularización.";
  }

  if (ride.paymentMethod === "cash") {
    return "Pago en efectivo registrado al completar el viaje.";
  }

  if (ride.paymentMethod === "card") {
    return paymentStatusValue === "success"
      ? "Pago con tarjeta confirmado."
      : `Pago con tarjeta: ${paymentStatusValue ?? "sin estado"}.`;
  }

  return "Forma de pago registrada por RAPA GO.";
}

function legalType(
  legalAcceptance: ReceiptLegalAcceptance | null,
): string | null {
  return legalAcceptance?.documentTypeResolved ?? null;
}

function legalVersion(
  legalAcceptance: ReceiptLegalAcceptance | null,
): string | null {
  return legalAcceptance?.versionAccepted ?? null;
}

function legalAcceptedAt(
  legalAcceptance: ReceiptLegalAcceptance | null,
): Date | null {
  return legalAcceptance?.acceptedAt ?? null;
}

function emailCopy(type: RideReceiptType): {
  subject: string;
  heading: string;
  summary: string;
} {
  switch (type) {
    case "completed_ride":
      return {
        subject: "Tu comprobante de viaje RAPA GO",
        heading: "Viaje completado",
        summary:
          "Tu viaje fue completado. Adjuntamos un comprobante simple con la ruta registrada, el conductor, el vehículo y el monto final.",
      };
    case "late_cancellation":
      return {
        subject: "Comprobante de cargo por cancelación RAPA GO",
        heading: "Cancelación confirmada",
        summary:
          "El cargo de cancelación fue revisado y aprobado. El comprobante adjunto indica el monto, el motivo y la aceptación legal registrada.",
      };
    case "no_show":
      return {
        subject: "Comprobante de no-show RAPA GO",
        heading: "No-show confirmado",
        summary:
          "El no-show fue confirmado y el cargo fue revisado. El comprobante adjunto incluye el punto de recogida, la espera registrada y la aceptación legal.",
      };
  }
}

function buildSnapshot(input: {
  receipt: RideReceipt;
  ride: RideRequest;
  passengerName: string;
  passengerEmail: string;
  driverName: string | null;
  vehicle: string;
  amountClp: number;
  paymentStatusValue: string;
  routePointCount: number;
  mapProvider: string;
  policyCharge: RidePolicyCharge | null;
  legalAcceptance: ReceiptLegalAcceptance | null;
}): Record<string, unknown> {
  return {
    documentNumber: input.receipt.documentNumber,
    receiptType: input.receipt.type,
    rideId: input.ride.id,
    rideStatus: input.ride.status,
    passengerName: input.passengerName,
    passengerEmail: input.passengerEmail,
    driverName: input.driverName,
    vehicle: input.vehicle,
    originText: input.ride.originText,
    destinationText: input.ride.destinationText,
    amountClp: input.amountClp,
    paymentMethod: input.ride.paymentMethod,
    paymentStatus: input.paymentStatusValue,
    routePointCount: input.routePointCount,
    mapProvider: input.mapProvider,
    policyChargeId: input.policyCharge?.id ?? null,
    policyType: input.policyCharge?.type ?? null,
    policyPercent: input.policyCharge?.feePercent ?? null,
    policyCapClp: input.policyCharge?.feeCapClp ?? null,
    legalDocumentType:
      input.legalAcceptance?.documentTypeResolved ?? null,
    legalDocumentVersion:
      input.legalAcceptance?.versionAccepted ?? null,
    legalAcceptedAt:
      input.legalAcceptance?.acceptedAt.toISOString() ?? null,
    generatedAt: new Date().toISOString(),
  };
}

function vehicleDescription(input: {
  brand: string | null;
  model: string | null;
  color: string | null;
  plate: string | null;
}): string {
  return [input.brand, input.model, input.color, input.plate]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" · ") || "Vehículo no informado";
}

export class RideReceiptsService {
  async queueCompletedRide(rideId: string): Promise<RideReceipt | null> {
    if (!featureEnabled()) return null;

    const ride = await receiptsRepository.findRide(rideId);
    if (!ride || ride.status !== "completed") return null;

    return this.queueReceipt({
      ride,
      type: "completed_ride",
      policyChargeId: null,
    });
  }

  async queuePolicyCharge(
    policyChargeId: string,
  ): Promise<RideReceipt | null> {
    if (!featureEnabled()) return null;

    const charge = await receiptsRepository.findPolicyCharge(policyChargeId);
    if (!charge || charge.status !== "approved_pending_next_ride") {
      return null;
    }

    const type: RideReceiptType =
      charge.type === "no_show" ? "no_show" : "late_cancellation";
    const ride = await receiptsRepository.findRide(charge.sourceRideId);
    if (!ride) return null;

    return this.queueReceipt({
      ride,
      type,
      policyChargeId: charge.id,
    });
  }

  private async queueReceipt(input: {
    ride: RideRequest;
    type: RideReceiptType;
    policyChargeId: string | null;
  }): Promise<RideReceipt> {
    const passenger = await receiptsRepository.findUser(
      input.ride.passengerUserId,
    );

    if (!passenger) {
      throw AppError.internal(
        `No se encontró el pasajero del viaje ${input.ride.id}.`,
      );
    }

    const emailTo =
      input.ride.offlinePassengerEmail?.trim() || passenger.email;
    const createdAt =
      input.ride.completedAt ??
      input.ride.cancelledAt ??
      input.ride.updatedAt;

    const receipt = await receiptsRepository.createPending({
      rideId: input.ride.id,
      ownerUserId: input.ride.passengerUserId,
      policyChargeId: input.policyChargeId,
      type: input.type,
      status: "pending",
      documentNumber: documentNumber(input.type, input.ride.id, createdAt),
      emailTo,
      snapshot: {},
      updatedAt: new Date(),
    });

    if (receipt.status !== "sent") {
      void this.processReceipt(receipt.id).catch(async (error: unknown) => {
        const reason =
          error instanceof Error ? error.message : String(error);
        await receiptsRepository.markFailed(receipt.id, reason).catch(() => {});
      });
    }

    return receipt;
  }

  async processReceipt(receiptId: string): Promise<RideReceipt> {
    const current = await receiptsRepository.findById(receiptId);

    if (!current) {
      throw AppError.notFound("Receipt not found.");
    }

    if (current.status === "sent") return current;

    const receipt = await receiptsRepository.markGenerating(receiptId);
    if (!receipt) {
      return (await receiptsRepository.findById(receiptId)) ?? current;
    }

    try {
      const type = receipt.type as RideReceiptType;
      const ride = await receiptsRepository.findRide(receipt.rideId);

      if (!ride) {
        throw new Error(`Ride ${receipt.rideId} not found.`);
      }

      const [passenger, driver, driverProfile, payment, routeRows] =
        await Promise.all([
          receiptsRepository.findUser(ride.passengerUserId),
          ride.driverUserId
            ? receiptsRepository.findUser(ride.driverUserId)
            : Promise.resolve(null),
          ride.driverUserId
            ? receiptsRepository.findDriverProfile(ride.driverUserId)
            : Promise.resolve(null),
          receiptsRepository.findLatestPayment(ride.id),
          receiptsRepository.listRoutePoints(
            ride.id,
            type === "completed_ride"
              ? ride.startedAt ?? ride.acceptedAt ?? ride.requestedAt
              : ride.acceptedAt ?? ride.requestedAt,
            ride.completedAt ?? ride.cancelledAt ?? new Date(),
          ),
        ]);

      if (!passenger) {
        throw new Error(`Passenger ${ride.passengerUserId} not found.`);
      }

      const policyCharge = receipt.policyChargeId
        ? await receiptsRepository.findPolicyCharge(receipt.policyChargeId)
        : null;
      const legalAcceptance =
        type === "completed_ride"
          ? null
          : await receiptsRepository.findLatestTermsAcceptance(
              ride.passengerUserId,
              ride.requestedAt,
            );

      if (
        type !== "completed_ride" &&
        (!policyCharge || policyCharge.status !== "approved_pending_next_ride")
      ) {
        throw new Error("The policy charge is not approved for receipt delivery.");
      }

      const points = routeRows.map(routePoint);
      const origin = optionalPoint(ride.originLat, ride.originLng);
      const destination = optionalPoint(
        ride.destinationLat,
        ride.destinationLng,
      );
      const map = await mapService.render({
        points,
        origin,
        destination,
      });

      const actualDistance = calculateRouteDistance(points);
      const amountClp = receiptAmount(
        type,
        ride,
        policyCharge,
        payment?.amountClp ?? null,
      );
      const paymentStatusValue = paymentStatus(
        type,
        ride,
        payment?.status ?? null,
      );
      const passengerName =
        ride.offlinePassengerName?.trim() || passenger.name;
      const passengerEmail = receipt.emailTo;
      const vehicle = vehicleDescription({
        brand: driverProfile?.vehicleBrand ?? null,
        model: driverProfile?.vehicleModel ?? null,
        color: driverProfile?.vehicleColor ?? null,
        plate: driverProfile?.vehiclePlate ?? null,
      });

      const pdf = generateRideReceiptPdf({
        type,
        documentNumber: receipt.documentNumber,
        generatedAt: new Date(),
        rideId: ride.id,
        passengerName,
        passengerEmail,
        driverName: driver?.name ?? null,
        vehicleBrand: driverProfile?.vehicleBrand ?? null,
        vehicleModel: driverProfile?.vehicleModel ?? null,
        vehicleColor: driverProfile?.vehicleColor ?? null,
        vehiclePlate: driverProfile?.vehiclePlate ?? null,
        originText: ride.originText,
        destinationText: ride.destinationText,
        requestedAt: ride.requestedAt,
        completedAt: ride.completedAt ?? null,
        cancelledAt: ride.cancelledAt ?? null,
        arrivedAt: ride.arrivedAt ?? null,
        distanceMeters: actualDistance ?? ride.distanceMeters ?? null,
        durationSeconds: calculateRideDuration(ride),
        amountClp,
        paymentMethod:
          type === "completed_ride"
            ? ride.paymentMethod ?? null
            : policyCharge?.paymentMethod ?? ride.paymentMethod ?? null,
        paymentStatus: paymentStatusValue,
        walletBenefitAppliedClp: Math.max(
          0,
          ride.walletBenefitAppliedClp ?? 0,
        ),
        priorityFeeClp: Math.max(0, ride.priorityFeeClp ?? 0),
        cancellationReason:
          policyCharge?.reason ?? ride.cancellationReason ?? null,
        noShowWaitMinutes: type === "no_show" ? noShowWaitMinutes(ride) : null,
        policyPercent: policyCharge?.feePercent ?? null,
        policyCapClp: policyCharge?.feeCapClp ?? null,
        legalDocumentTitle:
          legalAcceptance?.documentTitleResolved ?? null,
        legalDocumentVersion: legalVersion(legalAcceptance),
        legalAcceptedAt: legalAcceptedAt(legalAcceptance),
        map,
        supportEmail: SUPPORT_EMAIL,
        supportPhone: SUPPORT_PHONE,
      });

      const stored = await storageService.upload({
        ownerUserId: ride.passengerUserId,
        rideId: ride.id,
        receiptId: receipt.id,
        type,
        pdf,
      });
      const pdfSha256 = createHash("sha256").update(pdf).digest("hex");
      const snapshot = buildSnapshot({
        receipt,
        ride,
        passengerName,
        passengerEmail,
        driverName: driver?.name ?? null,
        vehicle,
        amountClp,
        paymentStatusValue,
        routePointCount: map.routePointCount,
        mapProvider: map.provider,
        policyCharge,
        legalAcceptance,
      });

      const generated = await receiptsRepository.markGenerated({
        id: receipt.id,
        storageBucket: stored.bucket,
        storagePath: stored.path,
        pdfSha256,
        mapProvider: map.provider,
        routePointCount: map.routePointCount,
        legalDocumentType: legalType(legalAcceptance),
        legalDocumentVersion: legalVersion(legalAcceptance),
        legalAcceptedAt: legalAcceptedAt(legalAcceptance),
        snapshot,
      });

      if (!generated) {
        throw new Error("Receipt could not be marked as generated.");
      }

      if (emailEnabled()) {
        const copy = emailCopy(type);
        await mailService.sendRideReceiptEmail({
          to: receipt.emailTo,
          passengerName,
          subject: copy.subject,
          heading: copy.heading,
          summary: copy.summary,
          documentNumber: receipt.documentNumber,
          fileName: receiptFileName(receipt),
          pdfBuffer: pdf,
        });
      }

      const sent = await receiptsRepository.markSent(receipt.id);
      if (!sent) {
        throw new Error("Receipt could not be marked as sent.");
      }

      return sent;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await receiptsRepository.markFailed(receipt.id, reason);
      throw error;
    }
  }

  async processRetryable(limit = 10): Promise<number> {
    if (!featureEnabled()) return 0;

    const receipts = await receiptsRepository.listRetryable(limit);
    let processed = 0;

    for (const receipt of receipts) {
      try {
        await this.processReceipt(receipt.id);
        processed += 1;
      } catch {
        // El estado failed queda registrado y el siguiente ciclo puede reintentar.
      }
    }

    return processed;
  }

  async listMine(accessToken: string): Promise<RideReceiptListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const receipts = await receiptsRepository.listForOwner(auth.userId);
    return { ok: true, receipts: receipts.map(toResponse) };
  }

  async listAdmin(accessToken: string): Promise<RideReceiptListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can list all ride receipts.",
        statusCode: 403,
      };
    }

    const receipts = await receiptsRepository.listAll();
    return { ok: true, receipts: receipts.map(toResponse) };
  }

  async download(
    accessToken: string,
    receiptId: string,
  ): Promise<RideReceiptDownloadResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const receipt = await receiptsRepository.findById(receiptId);
    if (!receipt) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Receipt not found.",
        statusCode: 404,
      };
    }

    if (auth.role !== "admin" && receipt.ownerUserId !== auth.userId) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "You cannot download this receipt.",
        statusCode: 403,
      };
    }

    if (!receipt.storageBucket || !receipt.storagePath) {
      return {
        ok: false,
        code: "RECEIPT_NOT_READY",
        message: "The receipt PDF is not ready yet.",
        statusCode: 409,
      };
    }

    const buffer = await storageService.download(
      receipt.storageBucket,
      receipt.storagePath,
    );

    return {
      ok: true,
      fileName: receiptFileName(receipt),
      contentType: "application/pdf",
      buffer,
    };
  }

  async resendAdmin(
    accessToken: string,
    receiptId: string,
  ): Promise<RideReceiptActionResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can resend receipts.",
        statusCode: 403,
      };
    }

    const existing = await receiptsRepository.findById(receiptId);
    if (!existing) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Receipt not found.",
        statusCode: 404,
      };
    }

    await receiptsRepository.markFailed(
      existing.id,
      "Reenvío solicitado por administración.",
    );

    try {
      const processed = await this.processReceipt(existing.id);
      return { ok: true, receipt: toResponse(processed) };
    } catch (error) {
      return {
        ok: false,
        code: "RECEIPT_DELIVERY_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Receipt delivery failed.",
        statusCode: 502,
      };
    }
  }
}

export const rideReceiptsService = new RideReceiptsService();
