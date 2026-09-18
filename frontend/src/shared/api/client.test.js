const { ApiError } = require('./errors');
const session = require('./session');
const { generateIdempotencyKey, isMoneyEndpoint } = require('./idempotency');
const { createApiClient } = require('./client');

describe('shared/api/errors.js (ApiError)', () => {
  test('decodifica el sobre canónico de backend con código, mensaje y requestId', () => {
    const backendPayload = {
      error: {
        code: 'WITHDRAWAL_COOLDOWN',
        message: 'Los retiros están temporalmente pausados tras el cambio de correo.',
        requestId: 'req-89fa2',
      },
    };

    const err = ApiError.fromResponse(backendPayload, 403);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('WITHDRAWAL_COOLDOWN');
    expect(err.message).toBe('Los retiros están temporalmente pausados tras el cambio de correo.');
    expect(err.status).toBe(403);
    expect(err.requestId).toBe('req-89fa2');
    expect(err.is('WITHDRAWAL_COOLDOWN')).toBe(true);
    expect(err.isForbidden()).toBe(true);
    expect(err.isWithdrawalCooldown()).toBe(true);
    expect(err.isUnauthorized()).toBe(false);
  });

  test('identifica estado 409 IDEMPOTENCY_REQUEST_IN_PROGRESS', () => {
    const payload = {
      error: {
        code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        message: 'La operación anterior sigue en proceso de ejecución.',
      },
    };

    const err = ApiError.fromResponse(payload, 409);
    expect(err.isIdempotencyInProgress()).toBe(true);
    expect(err.is('IDEMPOTENCY_REQUEST_IN_PROGRESS')).toBe(true);
  });

  test('identifica estado 422 IDEMPOTENCY_KEY_REUSED', () => {
    const payload = {
      error: {
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'Se reutilizó la misma clave de idempotencia con parámetros distintos.',
      },
    };

    const err = ApiError.fromResponse(payload, 422);
    expect(err.isIdempotencyKeyReused()).toBe(true);
  });

  test('identifica requerimiento de verificación de email en 403', () => {
    const payload = {
      error: {
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Debe verificar su correo para continuar.',
      },
      requiresEmailVerification: true,
    };

    const err = ApiError.fromResponse(payload, 403);
    expect(err.requiresEmailVerification()).toBe(true);
  });

  test('decodifica error de red cuando no hay respuesta HTTP', () => {
    const netErr = ApiError.fromNetworkError(new Error('Network Timeout'));
    expect(netErr.isNetworkError).toBe(true);
    expect(netErr.code).toBe('NETWORK_ERROR');
    expect(netErr.status).toBe(0);
  });

  test('maneja respuestas legacy con texto plano o formato simple', () => {
    const errString = ApiError.fromResponse({ error: 'Credenciales inválidas' }, 401);
    expect(errString.code).toBe('UNAUTHORIZED');
    expect(errString.message).toBe('Credenciales inválidas');
    expect(errString.isUnauthorized()).toBe(true);
  });
});

describe('shared/api/session.js (Session Seam)', () => {
  beforeEach(() => {
    session.clearToken();
  });

  test('guarda, recupera y elimina tokens de autenticación', () => {
    expect(session.hasToken()).toBe(false);
    expect(session.getToken()).toBeNull();

    session.setToken('test-jwt-token-123');
    expect(session.hasToken()).toBe(true);
    expect(session.getToken()).toBe('test-jwt-token-123');

    session.clearToken();
    expect(session.hasToken()).toBe(false);
    expect(session.getToken()).toBeNull();
  });

  test('notifica a los listeners suscritos cuando ocurre un 401', () => {
    const listener = jest.fn();
    const unsubscribe = session.onUnauthorized(listener);

    session.setToken('token-activo');
    session.notifyUnauthorized();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.hasToken()).toBe(false); // se limpia automáticamente

    unsubscribe();
    session.notifyUnauthorized();
    expect(listener).toHaveBeenCalledTimes(1); // no vuelve a llamar tras desuscribir
  });
});

describe('shared/api/idempotency.js', () => {
  test('generateIdempotencyKey produce un UUID v4 válido', () => {
    const key = generateIdempotencyKey();
    expect(typeof key).toBe('string');
    // Regex estándar UUID v4
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(key).toMatch(uuidV4Regex);
  });

  test('isMoneyEndpoint detecta los 5 endpoints canónicos que mueven dinero', () => {
    expect(isMoneyEndpoint('/api/trading/order', 'POST')).toBe(true);
    expect(isMoneyEndpoint('/api/transaccionBlockchain/withdraw', 'POST')).toBe(true);
    expect(isMoneyEndpoint('/api/transfer', 'POST')).toBe(true);
    expect(isMoneyEndpoint('/api/intercambioExchange', 'POST')).toBe(true);
    expect(isMoneyEndpoint('/api/balances/my/transfer', 'POST')).toBe(true);
  });

  test('isMoneyEndpoint rechaza métodos que no sean POST o rutas no monetarias', () => {
    expect(isMoneyEndpoint('/api/trading/order', 'GET')).toBe(false);
    expect(isMoneyEndpoint('/api/user/login', 'POST')).toBe(false);
    expect(isMoneyEndpoint('/api/user/register', 'POST')).toBe(false);
    expect(isMoneyEndpoint('/api/balances/my/balances', 'GET')).toBe(false);
  });
});

describe('shared/api/client.js (HTTP Interceptors)', () => {
  beforeEach(() => {
    session.clearToken();
  });

  test('inyecta la cabecera Authorization cuando existe token de sesión', async () => {
    session.setToken('jwt-bearer-xyz');
    const client = createApiClient({ baseURL: 'http://test.local' });

    // Mock del adapter interno de axios para inspeccionar la config de la request
    client.defaults.adapter = async (config) => {
      expect(config.headers.Authorization).toBe('Bearer jwt-bearer-xyz');
      return { data: { success: true }, status: 200, headers: {}, config };
    };

    const res = await client.get('/test');
    expect(res).toEqual({ success: true });
  });

  test('inyecta Idempotency-Key automáticamente en peticiones de dinero POST', async () => {
    const client = createApiClient({ baseURL: 'http://test.local' });

    client.defaults.adapter = async (config) => {
      expect(config.headers['Idempotency-Key']).toBeDefined();
      expect(config.headers['Idempotency-Key']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      return { data: { orderId: 'ord-123' }, status: 200, headers: {}, config };
    };

    const res = await client.post('/api/trading/order', { side: 'buy', amount: '1.0' });
    expect(res).toEqual({ orderId: 'ord-123' });
  });

  test('reutiliza la misma Idempotency-Key explícita en un reintento', async () => {
    const client = createApiClient({ baseURL: 'http://test.local' });
    const retryKey = '99999999-9999-4999-a999-999999999999';

    client.defaults.adapter = async (config) => {
      expect(config.headers['Idempotency-Key']).toBe(retryKey);
      return { data: { replayed: true }, status: 200, headers: {}, config };
    };

    const res = await client.post(
      '/api/balances/my/transfer',
      { from: 'funding', to: 'spot', amount: '10' },
      { idempotencyKey: retryKey }
    );
    expect(res).toEqual({ replayed: true });
  });

  test('convierte errores de respuesta en instancias de ApiError y notifica en 401', async () => {
    const client = createApiClient({ baseURL: 'http://test.local' });
    const unauthorizedListener = jest.fn();
    session.onUnauthorized(unauthorizedListener);

    client.defaults.adapter = async () => {
      const error = new Error('Request failed with status code 401');
      error.response = {
        status: 401,
        data: { error: { code: 'TOKEN_EXPIRED', message: 'El token ha expirado.' } },
      };
      throw error;
    };

    await expect(client.get('/protected')).rejects.toThrow(ApiError);
    expect(unauthorizedListener).toHaveBeenCalledTimes(1);
  });
});
