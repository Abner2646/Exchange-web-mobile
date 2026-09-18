/**
 * shared/api/errors.js
 *
 * Decodificador y representación canónica de errores de la API.
 * El backend expone de forma uniforme:
 * { "error": { "code": "CODIGO_ESTABLE", "message": "Texto descriptivo", "requestId": "hex" } }
 *
 * Esta clase normaliza cualquier error HTTP, red o de negocio en una estructura consistente
 * para que la UI pueda ramificar sobre `error.code` de forma confiable.
 */

class ApiError extends Error {
  /**
   * @param {Object} params
   * @param {string} params.code Código máquina canónico (ej. 'WITHDRAWAL_COOLDOWN', 'UNAUTHORIZED')
   * @param {string} params.message Mensaje legible
   * @param {number} [params.status=0] Código de estado HTTP
   * @param {string} [params.requestId] ID de traza del backend para soporte
   * @param {any} [params.data] Datos adicionales enviados en la respuesta
   * @param {boolean} [params.isNetworkError=false] Si el error fue por pérdida de conectividad/timeout
   * @param {any} [params.raw] Error o respuesta cruda original
   */
  constructor({
    code = 'UNKNOWN_ERROR',
    message = 'Ha ocurrido un error inesperado.',
    status = 0,
    requestId,
    data,
    isNetworkError = false,
    raw,
  }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.data = data;
    this.isNetworkError = isNetworkError;
    this.raw = raw;
  }

  /**
   * Comprueba si el error coincide con un código específico.
   * @param {string} targetCode
   * @returns {boolean}
   */
  is(targetCode) {
    return this.code === targetCode;
  }

  /** Comprueba si el error indica que la petición idempotente sigue en proceso (409) */
  isIdempotencyInProgress() {
    return this.code === 'IDEMPOTENCY_REQUEST_IN_PROGRESS' || this.status === 409;
  }

  /** Comprueba si hubo reutilización indebida de key de idempotencia con payload distinto (422) */
  isIdempotencyKeyReused() {
    return this.code === 'IDEMPOTENCY_KEY_REUSED' || this.status === 422;
  }

  /** Comprueba si el error es de autenticación (401) */
  isUnauthorized() {
    return this.status === 401 || this.code === 'UNAUTHORIZED';
  }

  /** Comprueba si el error es de permisos o cooldown (403) */
  isForbidden() {
    return this.status === 403;
  }

  /** Comprueba si la cuenta requiere verificación previa de email */
  requiresEmailVerification() {
    return (
      this.status === 403 &&
      (this.code === 'EMAIL_NOT_VERIFIED' || this.data?.requiresEmailVerification === true)
    );
  }

  /** Comprueba si el retiro está bloqueado por periodo de enfriamiento tras cambio de email */
  isWithdrawalCooldown() {
    return this.status === 403 && this.code === 'WITHDRAWAL_COOLDOWN';
  }

  /** Comprueba si el endpoint fue rate-limited (429) */
  isRateLimited() {
    return this.status === 429;
  }

  /**
   * Decodifica una respuesta HTTP (Axios o fetch) a una instancia de ApiError.
   * Maneja tanto el sobre canónico `{ error: { code, message, requestId } }`
   * como posibles formatos legacy `{ message }` o `{ error: "texto" }`.
   *
   * @param {Object} responseBody Cuerpo de la respuesta (res.data o JSON)
   * @param {number} status Código de estado HTTP
   * @param {any} [rawError] Error original
   * @returns {ApiError}
   */
  static fromResponse(responseBody, status, rawError) {
    let code = 'API_ERROR';
    let message = 'Error en la solicitud.';
    let requestId;
    let data;

    if (responseBody && typeof responseBody === 'object') {
      data = responseBody;

      // 1. Sobre canónico backend: { error: { code, message, requestId } }
      if (responseBody.error && typeof responseBody.error === 'object') {
        code = responseBody.error.code || code;
        message = responseBody.error.message || message;
        requestId = responseBody.error.requestId;
      }
      // 2. Formato legacy con error string: { error: "mensaje" }
      else if (typeof responseBody.error === 'string') {
        message = responseBody.error;
      }
      // 3. Formato alternativo { message: "texto" }
      else if (typeof responseBody.message === 'string') {
        message = responseBody.message;
      }

      // Si el código no vino explícito, asignamos códigos estándar por status HTTP
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
   * Crea un ApiError para fallas de red, timeout o desconexión.
   * @param {any} error
   * @returns {ApiError}
   */
  static fromNetworkError(error) {
    return new ApiError({
      code: 'NETWORK_ERROR',
      message: 'No se pudo conectar con el servidor. Revisa tu conexión a internet.',
      status: 0,
      isNetworkError: true,
      raw: error,
    });
  }
}

module.exports = {
  ApiError,
};
