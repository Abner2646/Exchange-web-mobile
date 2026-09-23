/**
 * shared/api/errors.ts
 *
 * Canonical error decoding and representation for the API.
 * The backend uniformly exposes errors as:
 * { "error": { "code": "STABLE_CODE", "message": "Descriptive text", "requestId": "hex" } }
 */

export interface ApiErrorParams {
  code?: string;
  message?: string;
  status?: number;
  requestId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any; // The raw data response could be of any shape at this boundary
  isNetworkError?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any; // The original error object could be of any type
}

export class ApiError extends Error {
  public code: string;
  public status: number;
  public requestId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public data?: any; // Exposing the underlying generic data blob
  public isNetworkError: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public raw?: any;

  constructor({
    code = 'UNKNOWN_ERROR',
    message = 'An unexpected error occurred.',
    status = 0,
    requestId,
    data,
    isNetworkError = false,
    raw,
  }: ApiErrorParams = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.data = data;
    this.isNetworkError = isNetworkError;
    this.raw = raw;
  }

  is(targetCode: string): boolean {
    return this.code === targetCode;
  }

  isIdempotencyInProgress(): boolean {
    return this.code === 'IDEMPOTENCY_REQUEST_IN_PROGRESS' || this.status === 409;
  }

  isIdempotencyKeyReused(): boolean {
    return this.code === 'IDEMPOTENCY_KEY_REUSED' || this.status === 422;
  }

  isUnauthorized(): boolean {
    return this.status === 401 || this.code === 'UNAUTHORIZED';
  }

  isForbidden(): boolean {
    return this.status === 403;
  }

  requiresEmailVerification(): boolean {
    return (
      this.status === 403 &&
      (this.code === 'EMAIL_NOT_VERIFIED' || this.data?.requiresEmailVerification === true)
    );
  }

  isWithdrawalCooldown(): boolean {
    return this.status === 403 && this.code === 'WITHDRAWAL_COOLDOWN';
  }

  isRateLimited(): boolean {
    return this.status === 429;
  }

  /**
   * Decodes an HTTP response payload to an ApiError instance.
   * Handles canonical envelopes and legacy formats.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromResponse(responseBody: any, status: number, rawError?: any): ApiError {
    let code = 'API_ERROR';
    let message = 'Request error.';
    let requestId: string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;

    if (responseBody && typeof responseBody === 'object') {
      data = responseBody;

      // 1. Canonical backend envelope
      if (responseBody.error && typeof responseBody.error === 'object') {
        code = responseBody.error.code || code;
        message = responseBody.error.message || message;
        requestId = responseBody.error.requestId;
      }
      // 2. Legacy format with string error
      else if (typeof responseBody.error === 'string') {
        message = responseBody.error;
      }
      // 3. Alternative legacy format
      else if (typeof responseBody.message === 'string') {
        message = responseBody.message;
      }

      // Default codes based on HTTP status if no code was explicitly provided
      if (code === 'API_ERROR') {
        if (status === 400) code = 'BAD_REQUEST';
        else if (status === 401) code = 'UNAUTHORIZED';
        else if (status === 403) code = 'FORBIDDEN';
        else if (status === 404) code = 'NOT_FOUND';
        else if (status === 409) code = 'CONFLICT';
        else if (status === 422) code = 'UNPROCESSABLE_ENTITY';
        else if (status === 429) code = 'TOO_MANY_REQUESTS';
        else if (status >= 500) code = 'INTERNAL_ERROR';
      }
    } else if (typeof responseBody === 'string' && responseBody.trim() !== '') {
      message = responseBody;
    }

    return new ApiError({
      code,
      message,
      status,
      requestId,
      data,
      isNetworkError: false,
      raw: rawError,
    });
  }

  /**
   * Creates an ApiError for network failures, timeouts, or disconnections.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromNetworkError(error: any): ApiError {
    return new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Could not connect to the server. Check your internet connection.',
      status: 0,
      isNetworkError: true,
      raw: error,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isApiError(err: any): err is ApiError {
  return err instanceof ApiError;
}
