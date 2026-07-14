/**
 * Versión vigente de la política de cancelación/créditos/débitos de Wallet (Fase 4B).
 * Cada movimiento del ledger registra con qué versión de la política fue generado, para
 * poder auditar cambios de política sin perder trazabilidad de movimientos históricos.
 */
export const CURRENT_LEDGER_POLICY_VERSION = "2026-07-13-fase4b-v1";

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
