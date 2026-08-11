import type { FastifyInstance } from "fastify";

import { walletController } from "./wallet.controller.js";

export async function walletRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get("/wallets/me", walletController.getMyWallet);
  fastify.get(
    "/wallets/me/transactions",
    walletController.getMyTransactions,
  );

  fastify.get(
    "/wallets/me/cash-overpayment-benefits",
    walletController.listMyCashOverpaymentBenefits,
  );
  fastify.post(
    "/wallets/me/cash-overpayment-benefits",
    walletController.requestCashOverpaymentBenefit,
  );

  fastify.get(
    "/admin/wallet/cash-overpayment-benefits",
    walletController.adminListCashOverpaymentBenefits,
  );
  fastify.post(
    "/admin/wallet/cash-overpayment-benefits/:id/approve",
    walletController.adminApproveCashOverpaymentBenefit,
  );
  fastify.post(
    "/admin/wallet/cash-overpayment-benefits/:id/reject",
    walletController.adminRejectCashOverpaymentBenefit,
  );
  fastify.post(
    "/admin/wallet/cash-overpayment-benefits/by-ride/:rideId/approve",
    walletController.adminApproveCashOverpaymentBenefitByRide,
  );
  fastify.post(
    "/admin/wallet/cash-overpayment-benefits/by-ride/:rideId/reject",
    walletController.adminRejectCashOverpaymentBenefitByRide,
  );

  // Compatibilidad temporal con el botón antiguo del panel Admin.
  fastify.post(
    "/admin/wallet/credits",
    walletController.adminCreateWalletCredit,
  );

  fastify.post(
    "/admin/wallet/manual-benefits",
    walletController.adminCreateManualWalletBenefit,
  );

  fastify.post(
    "/payments/create-order",
    walletController.createPaymentOrder,
  );
  fastify.post("/payments/webhook", walletController.handleWebhook);
}
