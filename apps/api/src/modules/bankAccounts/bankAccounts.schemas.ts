import { z } from "zod";

export const upsertBankAccountSchema = z.object({
  accountHolderName: z.string().trim().min(2, "Account holder name must be at least 2 characters.").max(150),
  bankName:          z.string().trim().min(2, "Bank name must be at least 2 characters.").max(100),
  accountType:       z.enum(["checking", "savings", "vista"], {
    errorMap: () => ({ message: "accountType must be 'checking', 'savings', or 'vista'." }),
  }),
  accountNumber: z
    .string()
    .trim()
    .min(4,  "Account number must be at least 4 digits.")
    .max(20, "Account number must not exceed 20 digits.")
    .regex(/^\d+$/, "Account number must contain only digits."),
});

export type UpsertBankAccountInput = z.infer<typeof upsertBankAccountSchema>;
