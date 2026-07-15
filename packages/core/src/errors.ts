export type IntakeErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_REF"
  | "NOT_FOUND"
  | "PRIVATE_OR_FORBIDDEN"
  | "RATE_LIMITED"
  | "EMPTY_REPOSITORY"
  | "OVERSIZED_REPOSITORY"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_ERROR"
  | "MALFORMED_RESPONSE";

export class PitchFlowError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400, options?: ErrorOptions) {
    super(message, options);
    this.name = "PitchFlowError";
    this.code = code;
    this.status = status;
  }
}

export class IntakeError extends PitchFlowError {
  override readonly code: IntakeErrorCode;

  constructor(code: IntakeErrorCode, message: string, status = 400, options?: ErrorOptions) {
    super(code, message, status, options);
    this.name = "IntakeError";
    this.code = code;
  }
}
