import { createHash } from "node:crypto";

/**
 * Versión vigente de la política de cancelación/créditos/débitos de Wallet (Fase 4B).
 * Cada movimiento del ledger registra con qué versión de la política fue generado, para
 * poder auditar cambios de política sin perder trazabilidad de movimientos históricos.
 */
export const CURRENT_LEDGER_POLICY_VERSION = "2026-07-13-fase4b-v1";

/**
 * Clave de idempotencia CANÓNICA para créditos manuales de Wallet — compartida entre
 * POST /admin/wallet/credits (legacy) y POST /admin/wallet-transactions (ledger nativo), para
 * que ambos endpoints traten la misma operación financiera como el mismo movimiento,
 * independientemente de por cuál endpoint se haya creado.
 *
 * Se deriva EXCLUSIVAMENTE de campos de dominio — nunca de texto libre (motivo/descripción):
 * dos solicitudes con la misma identidad de negocio deben colisionar aunque su descripción
 * difiera (evita que cambiar el texto genere un crédito duplicado); dos solicitudes con la
 * misma tarifa/viaje pero un `externalReference`/`paymentId` distinto son operaciones legítimas
 * separadas (p. ej. dos compensaciones distintas sobre el mismo viaje) y NO deben colisionar.
 *
 * Si no se provee ningún token distintivo (externalReference/paymentId), se usa un centinela
 * fijo — NO aleatorio — para preservar la protección contra reintentos de red/doble clic sin
 * referencia explícita (mismos campos de dominio ⇒ misma clave).
 */
export function buildWalletCreditOperationKey(input: {
  operationType: string;
  userId: string;
  rideId?: string | null;
  paymentId?: string | null;
  source: string;
  amountClp: number;
  policyVersion?: string;
  externalReference?: string | null;
}): string {
  const seed = [
    input.operationType,
    input.userId,
    input.rideId ?? "no-ride",
    input.paymentId ?? "no-payment",
    input.source,
    String(Math.round(input.amountClp)),
    input.policyVersion ?? CURRENT_LEDGER_POLICY_VERSION,
    input.externalReference?.trim() || "no-reference",
  ].join("|");

  return `credit:${createHash("sha256").update(seed).digest("hex").slice(0, 40)}`;
}

/**
 * Umbral de aprobación de créditos manuales de administración (unificación de sistemas de
 * Wallet). SIN CONFIRMAR POR EL EQUIPO todavía — valor propuesto en
 * docs/security/LEANDRO_PHASE_4B_CANCELLATION_POLICY_PROPOSAL.md, dejado configurable aquí
 * hasta que exista una decisión de negocio formal.
 *
 *   amountClp <= este umbral → aprobación de un solo administrador (auto-aprobado al crear).
 *   amountClp >  este umbral → requiere un SEGUNDO administrador vía POST .../approve
 *                              (no puede ser el mismo que lo creó — imposibilidad de autoaprobar).
 */
export const ADMIN_WALLET_CREDIT_SINGLE_APPROVAL_MAX_CLP = 3000;

/** Decide si un crédito manual de administración se auto-aprueba o requiere segunda aprobación. */
export function decideAdminCreditApproval(amountClp: number): {
  status: "available" | "pending";
  approvalStatus: "admin_approved" | "pending_review";
} {
  if (amountClp <= ADMIN_WALLET_CREDIT_SINGLE_APPROVAL_MAX_CLP) {
    return { status: "available", approvalStatus: "admin_approved" };
  }
  return { status: "pending", approvalStatus: "pending_review" };
}
