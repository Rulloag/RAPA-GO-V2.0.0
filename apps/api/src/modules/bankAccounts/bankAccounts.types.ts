export interface BankAccountResponse {
  id:                 string;
  userId:             string;
  accountHolderName:  string;
  bankName:           string;
  accountType:        string;
  accountNumberLast4: string;
  status:             string;
  createdAt:          string;
  updatedAt:          string;
}

export type BankAccountResult =
  | { ok: true;  account: BankAccountResponse }
  | { ok: false; code: string; message: string; statusCode: number };

export type BankAccountGetResult =
  | { ok: true;  account: BankAccountResponse | null }
  | { ok: false; code: string; message: string; statusCode: number };
