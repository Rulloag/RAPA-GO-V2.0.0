import { z } from "zod";

/**
 * SEGURIDAD (Fase 4B): el cliente NUNCA envía como autoritativo el monto, porcentaje, tarifa
 * mínima, minutos de espera ni el estado del débito de Wallet — todo eso se calcula en el
 * servidor a partir de ride.estimatedFareClp y ride.arrivedAt. Este DTO solo acepta evidencia
 * descriptiva no financiera opcional.
 */
export const confirmNoShowSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export type ConfirmNoShowInput = z.infer<typeof confirmNoShowSchema>;
