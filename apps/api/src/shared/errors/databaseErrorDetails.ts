export interface DatabaseErrorDetails {
  code: string | null;
  message: string | null;
  detail: string | null;
  table: string | null;
  column: string | null;
  constraint: string | null;
}

function readString(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : null;
}

/** Extracts safe PostgreSQL metadata without SQL params or credentials. */
export function getDatabaseErrorDetails(
  error: unknown,
): DatabaseErrorDetails {
  const result: DatabaseErrorDetails = {
    code: null,
    message: null,
    detail: null,
    table: null,
    column: null,
    constraint: null,
  };

  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") break;
    const record = current as Record<string, unknown>;
    result.code ??= readString(record, "code");
    result.message ??= readString(record, "message");
    result.detail ??= readString(record, "detail");
    result.table ??= readString(record, "table");
    result.column ??= readString(record, "column");
    result.constraint ??= readString(record, "constraint");
    current = record["cause"];
  }
  return result;
}

export function formatDatabaseErrorDetails(error: unknown): string {
  const details = getDatabaseErrorDetails(error);
  const values = [
    details.code ? `code=${details.code}` : null,
    details.table ? `table=${details.table}` : null,
    details.column ? `column=${details.column}` : null,
    details.constraint ? `constraint=${details.constraint}` : null,
    details.detail ? `detail=${details.detail}` : null,
    details.message ? `message=${details.message}` : null,
  ].filter((value): value is string => Boolean(value));
  return values.length > 0 ? values.join(" | ") : String(error);
}
