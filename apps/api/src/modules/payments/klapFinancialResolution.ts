import crypto from "node:crypto";

/**
 * Motor puro de decisión financiera para una autorización Klap.
 *
 * IMPORTANTE:
 * - No llama a Klap.
 * - No lee montos desde el frontend.
 * - Solo decide qué operación financiera DEBERÍA ejecutar el backend.
 * - Las operaciones remotas siguen sujetas a los contratos confirmados de Klap.
 */
export type KlapTripFinancialOutcome = "completed" | "cancelled" | "no_show";

export type KlapFinancialAction =
  | "capture"
  | "capture_partial"
  | "void"
  | "expired"
  | "manual_review";

export type KlapFinancialResolutionReason =
  | "ride_completed"
  | "cancelled_without_charge"
  | "cancelled_with_fee"
  | "no_show_fee"
  | "authorization_expired"
  | "final_amount_exceeds_authorization"
  | "cancellation_fee_exceeds_authorization"
  | "no_show_fee_exceeds_authorization"
  | "invalid_backend_amount";

export interface ResolveKlapFinancialOutcomeInput {
  paymentId: string;
  tripId: string;
  outcome: KlapTripFinancialOutcome;

  /** Monto que Klap autorizó previamente. Nunca proviene del request móvil. */
  authorizedAmountClp: number;

  /**
   * Monto final autoritativo calculado por backend para un viaje completado.
   * Si todavía no existe un motor de tarifa final distinto, debe enviarse el
   * mismo monto autoritativo que originó la autorización.
   */
  finalRideAmountClp?: number | null;

  /** Multa calculada exclusivamente por backend para una cancelación. */
  cancellationFeeClp?: number | null;

  /** Cargo NO SHOW calculado exclusivamente por backend. */
  noShowFeeClp?: number | null;

  /** Resultado de la verificación autoritativa de vigencia de autorización. */
  authorizationExpired: boolean;
}

export interface KlapFinancialResolution {
  action: KlapFinancialAction;
  reason: KlapFinancialResolutionReason;
  amountClp: number;
  authorizedAmountClp: number;
  remainingAuthorizedAmountClp: number;
  /**
   * true significa que, tras una captura parcial, el saldo restante debe
   * liberarse según el contrato oficial de Klap. No se asume que Klap lo haga
   * automáticamente hasta tener confirmación.
   */
  requiresRemainderRelease: boolean;
  /** Clave estable de idempotencia interna de RAPA GO. */
  resolutionKey: string;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function normalizeRequiredId(value: string, field: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

export function buildKlapFinancialResolutionKey(input: {
  paymentId: string;
  tripId: string;
  action: KlapFinancialAction;
  amountClp: number;
}): string {
  const paymentId = normalizeRequiredId(input.paymentId, "paymentId");
  const tripId = normalizeRequiredId(input.tripId, "tripId");

  if (!isNonNegativeInteger(input.amountClp)) {
    throw new Error("amountClp must be a non-negative integer.");
  }

  return crypto
    .createHash("sha256")
    .update(
      `klap-financial-resolution:${paymentId}:${tripId}:${input.action}:${input.amountClp}`,
      "utf8",
    )
    .digest("hex");
}

function resolution(
  input: ResolveKlapFinancialOutcomeInput,
  values: Omit<KlapFinancialResolution, "authorizedAmountClp" | "resolutionKey">,
): KlapFinancialResolution {
  return {
    ...values,
    authorizedAmountClp: input.authorizedAmountClp,
    resolutionKey: buildKlapFinancialResolutionKey({
      paymentId: input.paymentId,
      tripId: input.tripId,
      action: values.action,
      amountClp: values.amountClp,
    }),
  };
}

/**
 * Decide la operación financiera sin ejecutar side-effects.
 * Fail-closed: ante cualquier monto imposible o superior a la autorización,
 * devuelve manual_review y nunca una captura.
 */
export function resolveKlapFinancialOutcome(
  rawInput: ResolveKlapFinancialOutcomeInput,
): KlapFinancialResolution {
  const input: ResolveKlapFinancialOutcomeInput = {
    ...rawInput,
    paymentId: normalizeRequiredId(rawInput.paymentId, "paymentId"),
    tripId: normalizeRequiredId(rawInput.tripId, "tripId"),
  };

  if (
    !Number.isSafeInteger(input.authorizedAmountClp) ||
    input.authorizedAmountClp <= 0
  ) {
    return resolution(input, {
      action: "manual_review",
      reason: "invalid_backend_amount",
      amountClp: 0,
      remainingAuthorizedAmountClp: 0,
      requiresRemainderRelease: false,
    });
  }

  if (input.authorizationExpired) {
    return resolution(input, {
      action: "expired",
      reason: "authorization_expired",
      amountClp: 0,
      remainingAuthorizedAmountClp: 0,
      requiresRemainderRelease: false,
    });
  }

  if (input.outcome === "completed") {
    const finalAmount =
      input.finalRideAmountClp == null
        ? input.authorizedAmountClp
        : input.finalRideAmountClp;

    if (!Number.isSafeInteger(finalAmount) || finalAmount <= 0) {
      return resolution(input, {
        action: "manual_review",
        reason: "invalid_backend_amount",
        amountClp: 0,
        remainingAuthorizedAmountClp: input.authorizedAmountClp,
        requiresRemainderRelease: false,
      });
    }

    if (finalAmount > input.authorizedAmountClp) {
      return resolution(input, {
        action: "manual_review",
        reason: "final_amount_exceeds_authorization",
        amountClp: 0,
        remainingAuthorizedAmountClp: input.authorizedAmountClp,
        requiresRemainderRelease: false,
      });
    }

    return resolution(input, {
      action:
        finalAmount === input.authorizedAmountClp
          ? "capture"
          : "capture_partial",
      reason: "ride_completed",
      amountClp: finalAmount,
      remainingAuthorizedAmountClp:
        input.authorizedAmountClp - finalAmount,
      requiresRemainderRelease:
        finalAmount < input.authorizedAmountClp,
    });
  }

  if (input.outcome === "no_show") {
    const noShowFee = input.noShowFeeClp ?? 0;

    if (!Number.isSafeInteger(noShowFee) || noShowFee <= 0) {
      return resolution(input, {
        action: "manual_review",
        reason: "invalid_backend_amount",
        amountClp: 0,
        remainingAuthorizedAmountClp: input.authorizedAmountClp,
        requiresRemainderRelease: false,
      });
    }

    if (noShowFee > input.authorizedAmountClp) {
      return resolution(input, {
        action: "manual_review",
        reason: "no_show_fee_exceeds_authorization",
        amountClp: 0,
        remainingAuthorizedAmountClp: input.authorizedAmountClp,
        requiresRemainderRelease: false,
      });
    }

    return resolution(input, {
      action:
        noShowFee === input.authorizedAmountClp
          ? "capture"
          : "capture_partial",
      reason: "no_show_fee",
      amountClp: noShowFee,
      remainingAuthorizedAmountClp:
        input.authorizedAmountClp - noShowFee,
      requiresRemainderRelease:
        noShowFee < input.authorizedAmountClp,
    });
  }

  const cancellationFee = input.cancellationFeeClp ?? 0;

  if (!isNonNegativeInteger(cancellationFee)) {
    return resolution(input, {
      action: "manual_review",
      reason: "invalid_backend_amount",
      amountClp: 0,
      remainingAuthorizedAmountClp: input.authorizedAmountClp,
      requiresRemainderRelease: false,
    });
  }

  if (cancellationFee === 0) {
    return resolution(input, {
      action: "void",
      reason: "cancelled_without_charge",
      amountClp: 0,
      remainingAuthorizedAmountClp: input.authorizedAmountClp,
      requiresRemainderRelease: true,
    });
  }

  if (cancellationFee > input.authorizedAmountClp) {
    return resolution(input, {
      action: "manual_review",
      reason: "cancellation_fee_exceeds_authorization",
      amountClp: 0,
      remainingAuthorizedAmountClp: input.authorizedAmountClp,
      requiresRemainderRelease: false,
    });
  }

  return resolution(input, {
    action: "capture_partial",
    reason: "cancelled_with_fee",
    amountClp: cancellationFee,
    remainingAuthorizedAmountClp:
      input.authorizedAmountClp - cancellationFee,
    requiresRemainderRelease:
      cancellationFee < input.authorizedAmountClp,
  });
}
