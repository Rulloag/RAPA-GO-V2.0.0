import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { ReferralsRepository } from "./referrals.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { ReferralCode, ReferralUse } from "../../db/schema/index.js";
import type { ReferralCodeWithStats, ReferralUseDetail } from "./referrals.repository.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const referralsRepo  = new ReferralsRepository();

const PUBLIC_WEB_BASE_URL = String(
  process.env["PUBLIC_WEB_BASE_URL"] ??
    process.env["FRONTEND_URL"] ??
    "https://api.rapago.cl",
)
  .trim()
  .replace(/\/+$/, "");

function referralLink(code: string): string {
  return `${PUBLIC_WEB_BASE_URL}/ref/${encodeURIComponent(code)}`;
}

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;
  try { payload = tokenService.verifyAccessToken(accessToken); }
  catch (err) {
    if (err instanceof AppError) return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }
  const hash  = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);
  if (!valid) return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
  const user = await usersRepo.findById(payload.sub);
  if (!user) return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
  return { ok: true, userId: user.id, role: user.role };
}

function generateCode(name: string): string {
  const base   = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "USER";
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  return `${base}${suffix}`;
}

function serializeCode(code: ReferralCode) {
  return {
    id:             code.id,
    userId:         code.userId,
    code:           code.code,
    type:           code.type,
    discountAmount: code.discountAmount,
    discountType:   code.discountType,
    maxUses:        code.maxUses,
    usedCount:      code.usedCount,
    expiresAt:      code.expiresAt?.toISOString() ?? null,
    isActive:       code.isActive,
    createdAt:      code.createdAt.toISOString(),
    link:           referralLink(code.code),
  };
}

function serializeUse(use: ReferralUse) {
  return {
    id:              use.id,
    referralCodeId:  use.referralCodeId,
    referredUserId:  use.referredUserId,
    referredAt:      use.referredAt.toISOString(),
    convertedAt:     use.convertedAt?.toISOString() ?? null,
    conversionValue: use.conversionValue,
    rewardApplied:   use.rewardApplied,
    rewardAmount:    use.rewardAmount,
    createdAt:       use.createdAt.toISOString(),
  };
}

export type GetMyReferralResult =
  | { ok: true; data: { code: string; link: string; usedCount: number; totalReward: number; pendingReward: number } }
  | { ok: false; code: string; message: string; statusCode: number };

export type GenerateCodeResult =
  | { ok: true; data: { code: string; link: string } }
  | { ok: false; code: string; message: string; statusCode: number };

export type ApplyCodeResult =
  | { ok: true; data: { success: boolean; message: string } }
  | { ok: false; code: string; message: string; statusCode: number };

export type ConvertResult =
  | { ok: true; data: { success: boolean; rewardAmount: number } }
  | { ok: false; code: string; message: string; statusCode: number };

export type AdminListResult =
  | { ok: true; data: { items: ReturnType<typeof serializeAdminCode>[]; total: number } }
  | { ok: false; code: string; message: string; statusCode: number };

export type AdminUsesResult =
  | { ok: true; data: { items: object[] } }
  | { ok: false; code: string; message: string; statusCode: number };

function serializeAdminCode(c: ReferralCodeWithStats) {
  return {
    ...serializeCode(c),
    ownerName:       c.ownerName,
    ownerEmail:      c.ownerEmail,
    conversionCount: c.conversionCount,
    totalReward:     c.totalReward,
  };
}

function serializeAdminUse(u: ReferralUseDetail) {
  return {
    ...serializeUse(u),
    referredUserName:  u.referredUserName,
    referredUserEmail: u.referredUserEmail,
  };
}

export const referralsService = {
  async getMyReferral(accessToken: string): Promise<GetMyReferralResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const existing = await referralsRepo.findCodeByUserId(auth.userId);
    if (!existing) {
      return { ok: true, data: { code: "", link: "", usedCount: 0, totalReward: 0, pendingReward: 0 } };
    }

    const summary = await referralsRepo.getSummaryForUser(auth.userId);
    return {
      ok: true,
      data: {
        code:          existing.code,
        link:          referralLink(existing.code),
        usedCount:     summary.usedCount,
        totalReward:   summary.totalReward,
        pendingReward: summary.pendingReward,
      },
    };
  },

  async generateCode(accessToken: string, customCode?: string): Promise<GenerateCodeResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const existing = await referralsRepo.findCodeByUserId(auth.userId);
    if (existing) {
      return { ok: true, data: { code: existing.code, link: referralLink(existing.code) } };
    }

    let code: string;
    if (customCode) {
      if (!/^[A-Z0-9]{4,20}$/i.test(customCode)) {
        return { ok: false, code: "VALIDATION_ERROR", message: "El código debe ser alfanumérico, entre 4 y 20 caracteres.", statusCode: 400 };
      }
      code = customCode.toUpperCase();
      const conflict = await referralsRepo.findCodeByCode(code);
      if (conflict) {
        return { ok: false, code: "CODE_TAKEN", message: "Ese código ya está en uso.", statusCode: 409 };
      }
    } else {
      const user = await usersRepo.findById(auth.userId);
      let candidate = generateCode(user?.name ?? "USER");
      let attempts  = 0;
      while (await referralsRepo.findCodeByCode(candidate) && attempts < 5) {
        candidate = generateCode(user?.name ?? "USER");
        attempts++;
      }
      code = candidate;
    }

    const created = await referralsRepo.createCode({
      userId:         auth.userId,
      code,
      type:           "user",
      discountAmount: 10,
      discountType:   "percentage",
      maxUses:        null,
      expiresAt:      null,
    });

    return { ok: true, data: { code: created.code, link: referralLink(created.code) } };
  },

  async applyCode(code: string, userId?: string): Promise<ApplyCodeResult> {
    const referral = await referralsRepo.findCodeByCode(code.toUpperCase());
    if (!referral || !referral.isActive) {
      return { ok: false, code: "REFERRAL_INVALID", message: "Código de referido no válido.", statusCode: 400 };
    }
    if (referral.expiresAt && referral.expiresAt < new Date()) {
      return { ok: false, code: "REFERRAL_EXPIRED", message: "Código de referido expirado.", statusCode: 400 };
    }
    if (referral.maxUses !== null && referral.usedCount >= referral.maxUses) {
      return { ok: false, code: "REFERRAL_MAX_USES", message: "Este código ya alcanzó su límite de usos.", statusCode: 400 };
    }

    if (userId) {
      if (referral.userId === userId) {
        return { ok: false, code: "REFERRAL_SELF", message: "No puedes usar tu propio código.", statusCode: 400 };
      }
      const alreadyUsed = await referralsRepo.findUseByReferredUserId(userId);
      if (alreadyUsed) {
        return { ok: false, code: "REFERRAL_ALREADY_USED", message: "Ya usaste un código de referido.", statusCode: 409 };
      }
      await referralsRepo.createUse(referral.id, userId);
    }

    await referralsRepo.incrementUsedCount(referral.id);
    return { ok: true, data: { success: true, message: "¡Código aplicado! Tu referidor recibirá un beneficio cuando completes tu primer viaje." } };
  },

  async convertReferral(accessToken: string, referralUseId: string, conversionValue: number): Promise<ConvertResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const use = await referralsRepo.findUseById(referralUseId);
    if (!use) return { ok: false, code: "NOT_FOUND", message: "Referral use not found.", statusCode: 404 };
    if (use.rewardApplied) {
      return { ok: false, code: "ALREADY_CONVERTED", message: "Esta referencia ya fue convertida.", statusCode: 409 };
    }

    const referral = await referralsRepo.findCodeByCode(
      (await db_findCodeById(use.referralCodeId))?.code ?? ""
    );

    let rewardAmount = 0;
    if (referral) {
      if (referral.discountType === "percentage" && referral.discountAmount) {
        rewardAmount = Math.round(conversionValue * referral.discountAmount / 100);
      } else if (referral.discountType === "fixed_amount" && referral.discountAmount) {
        rewardAmount = referral.discountAmount;
      }
    }

    await referralsRepo.markConverted(referralUseId, conversionValue, rewardAmount);

    if (referral?.userId && rewardAmount > 0) {
      try {
        const walletRepo = new (await import("../wallet/wallet.repository.js")).WalletRepository();
        const wallet     = await walletRepo.getOrCreate(referral.userId);
        const newBalance = wallet.balance + rewardAmount;
        await walletRepo.updateBalance(wallet.id, newBalance);
        await walletRepo.createTransaction({
          walletId:    wallet.id,
          userId:      referral.userId,
          type:        "credit",
          amount:      rewardAmount,
          currency:    "CLP",
          status:      "completed",
          description: "Recompensa por referido",
        });
      } catch { }
    }

    return { ok: true, data: { success: true, rewardAmount } };
  },

  async adminListCodes(accessToken: string, page: number, limit: number): Promise<AdminListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") return { ok: false, code: "AUTH_FORBIDDEN", message: "Forbidden.", statusCode: 403 };

    const offset = (page - 1) * limit;
    const { items, total } = await referralsRepo.listAllCodes(offset, limit);
    return { ok: true, data: { items: items.map(serializeAdminCode), total } };
  },

  async adminListUses(accessToken: string, codeId: string): Promise<AdminUsesResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") return { ok: false, code: "AUTH_FORBIDDEN", message: "Forbidden.", statusCode: 403 };

    const uses = await referralsRepo.listUsesByCodeId(codeId);
    return { ok: true, data: { items: uses.map(serializeAdminUse) } };
  },

  async adminCreateCampaignCode(accessToken: string, data: {
    code: string;
    type: "promo" | "partner";
    discountAmount: number;
    discountType: "percentage" | "fixed_amount";
    maxUses: number | null;
    expiresAt: string | null;
  }): Promise<GenerateCodeResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") return { ok: false, code: "AUTH_FORBIDDEN", message: "Forbidden.", statusCode: 403 };

    if (!/^[A-Z0-9]{4,20}$/i.test(data.code)) {
      return { ok: false, code: "VALIDATION_ERROR", message: "El código debe ser alfanumérico, entre 4 y 20 caracteres.", statusCode: 400 };
    }
    const code = data.code.toUpperCase();
    const conflict = await referralsRepo.findCodeByCode(code);
    if (conflict) {
      return { ok: false, code: "CODE_TAKEN", message: "Ese código ya está en uso.", statusCode: 409 };
    }

    const created = await referralsRepo.createCode({
      userId:         null,
      code,
      type:           data.type,
      discountAmount: data.discountAmount,
      discountType:   data.discountType,
      maxUses:        data.maxUses,
      expiresAt:      data.expiresAt ? new Date(data.expiresAt) : null,
    });

    return { ok: true, data: { code: created.code, link: referralLink(created.code) } };
  },
};

async function db_findCodeById(id: string) {
  const { referralCodes } = await import("../../db/schema/index.js");
  const { db } = await import("../../db/client.js");
  const { eq } = await import("drizzle-orm");
  const rows = await db.select().from(referralCodes).where(eq(referralCodes.id, id)).limit(1);
  return rows[0] ?? null;
}
