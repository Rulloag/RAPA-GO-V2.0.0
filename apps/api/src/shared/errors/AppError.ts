/**
 * AppError — typed application error that maps cleanly to HTTP responses.
 * Throw this instead of generic Error when you need a specific HTTP status and code.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(opts: { code: string; message: string; statusCode: number }) {
    super(opts.message);
    this.name = "AppError";
    this.code = opts.code;
    this.statusCode = opts.statusCode;
  }

  static notFound(message = "Resource not found."): AppError {
    return new AppError({ code: "NOT_FOUND", message, statusCode: 404 });
  }

  static unauthorized(message = "Authentication required."): AppError {
    return new AppError({ code: "UNAUTHORIZED", message, statusCode: 401 });
  }

  static forbidden(message = "Insufficient permissions."): AppError {
    return new AppError({ code: "FORBIDDEN", message, statusCode: 403 });
  }

  static validationError(message: string): AppError {
    return new AppError({ code: "VALIDATION_ERROR", message, statusCode: 400 });
  }

  static internal(message = "Internal server error."): AppError {
    return new AppError({ code: "INTERNAL_SERVER_ERROR", message, statusCode: 500 });
  }
}
