/**
 * Canonical Chilean RUT helpers.
 *
 * API persistence format: `12345678-5` / `12345678-K`
 * Display may include thousand separators: `12.345.678-5`
 *
 * Never strips the check digit K. Never accepts arbitrary A–Z in the body.
 * Module-11 validation is required for `validateRut` / `normalizeRut`.
 */

const MAX_BODY_LENGTH = 8;
const MIN_BODY_LENGTH = 7;

export type ParsedRut = {
  body: string;
  dv: string;
};

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function digitsAndOptionalK(value: string): { body: string; dv: string } {
  let body = "";
  let dv = "";

  for (const char of value) {
    if (isDigit(char)) {
      if (dv) continue;
      if (body.length < MAX_BODY_LENGTH) {
        body += char;
      } else {
        dv = char;
      }
      continue;
    }

    if (char === "k" || char === "K") {
      if (body.length === 0) continue;
      dv = "K";
    }
  }

  return { body, dv };
}

/** Digits plus optional DV (`12345678K`). Never drops K. */
export function compactRut(value: unknown): string {
  const { body, dv } = digitsAndOptionalK(String(value ?? ""));
  return `${body}${dv}`;
}

export function computeRutDv(body: string): string {
  if (!/^\d{7,8}$/.test(body)) {
    return "";
  }

  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return "0";
  if (remainder === 10) return "K";
  return String(remainder);
}

function parseBodyDv(bodyRaw: string, dvRaw: string): ParsedRut | null {
  const body = bodyRaw.replace(/\D/g, "");
  const dv = dvRaw.trim().toUpperCase().replace(/[^0-9K]/g, "");

  if (!/^\d{7,8}$/.test(body)) return null;
  if (!/^[0-9K]$/.test(dv)) return null;

  return { body, dv };
}

export function parseRut(value: unknown): ParsedRut | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const hyphenIndex = raw.lastIndexOf("-");
  if (hyphenIndex >= 0) {
    return parseBodyDv(raw.slice(0, hyphenIndex), raw.slice(hyphenIndex + 1));
  }

  const { body, dv } = digitsAndOptionalK(raw);
  if (!dv) {
    return null;
  }

  return parseBodyDv(body, dv);
}

function groupThousands(body: string): string {
  return (
    body
      .split("")
      .reverse()
      .join("")
      .match(/.{1,3}/g)
      ?.map((part) => part.split("").reverse().join(""))
      .reverse()
      .join(".") ?? body
  );
}

/**
 * Mid-edit display formatter. Preserves K, ignores A–Z (except K as DV),
 * and does not invent a check digit. An 8-digit body without DV stays
 * without a hyphen so typing the 9th character (or K) is not broken.
 */
export function formatRut(value: unknown): string {
  const raw = String(value ?? "");
  const hyphenIndex = raw.lastIndexOf("-");

  if (hyphenIndex >= 0) {
    const parsed = parseBodyDv(raw.slice(0, hyphenIndex), raw.slice(hyphenIndex + 1));
    if (parsed) {
      return `${groupThousands(parsed.body)}-${parsed.dv}`;
    }
  }

  const { body, dv } = digitsAndOptionalK(raw);
  if (!body) return "";
  if (!dv) return groupThousands(body);
  return `${groupThousands(body)}-${dv}`;
}

/** Canonical API form `12345678-5`. Empty string if the value is not a valid RUT. */
export function normalizeRut(value: unknown): string {
  const parsed = parseRut(value);
  if (!parsed) {
    return "";
  }

  if (computeRutDv(parsed.body) !== parsed.dv) {
    return "";
  }

  return `${parsed.body}-${parsed.dv}`;
}

export function validateRut(value: unknown): boolean {
  return normalizeRut(value).length > 0;
}

export const isRutValid = validateRut;

export function rutIdentityKey(value: unknown): string {
  const canonical = normalizeRut(value);
  return canonical ? canonical.replace("-", "") : "";
}
