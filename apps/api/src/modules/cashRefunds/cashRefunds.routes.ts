import type { FastifyInstance } from "fastify";

import { cashRefundsController } from "./cashRefunds.controller.js";

export async function cashRefundsRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get(
    "/wallets/me/cash-overpayment-refunds",
    cashRefundsController.listMine,
  );
  fastify.post(
    "/wallets/me/cash-overpayment-refunds",
    cashRefundsController.request,
  );

  fastify.get(
    "/admin/wallet/cash-overpayment-refunds",
    cashRefundsController.listForAdmin,
  );
  fastify.get(
    "/admin/wallet/cash-overpayment-refunds/:id/transfer-details",
    cashRefundsController.transferDetails,
  );
  fastify.post(
    "/admin/wallet/cash-overpayment-refunds/:id/approve",
    cashRefundsController.approve,
  );
  fastify.post(
    "/admin/wallet/cash-overpayment-refunds/:id/reject",
    cashRefundsController.reject,
  );
  fastify.post(
    "/admin/wallet/cash-overpayment-refunds/:id/complete",
    cashRefundsController.complete,
  );
}
