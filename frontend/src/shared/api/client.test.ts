import { ApiError } from './errors';
import { session } from './session';
import { generateIdempotencyKey, isMoneyEndpoint } from './idempotency';
import { apiClient } from './client';

// Mock fetch globally
global.fetch = jest.fn();

describe('shared/api/errors.ts (ApiError)', () => {
  test('decodes the canonical backend envelope with code, message and requestId', () => {
    const backendPayload = {
      error: {
        code: 'WITHDRAWAL_COOLDOWN',
        message: 'Withdrawals are temporarily paused after an email change.',
        requestId: 'req-89fa2',
      },
    };

    const err = ApiError.fromResponse(backendPayload, 403);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('WITHDRAWAL_COOLDOWN');
    expect(err.message).toBe('Withdrawals are temporarily paused after an email change.');
    expect(err.status).toBe(403);
    expect(err.requestId).toBe('req-89fa2');
    expect(err.is('WITHDRAWAL_COOLDOWN')).toBe(true);
    expect(err.isForbidden()).toBe(true);
    expect(err.isWithdrawalCooldown()).toBe(true);
    expect(err.isUnauthorized()).toBe(false);
  });

  test('identifies status 409 IDEMPOTENCY_REQUEST_IN_PROGRESS', () => {
    const payload = {
      error: {
        code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        message: 'The previous operation is still executing.',
      },
    };

    const err = ApiError.fromResponse(payload, 409);
    expect(err.isIdempotencyInProgress()).toBe(true);
    expect(err.is('IDEMPOTENCY_REQUEST_IN_PROGRESS')).toBe(true);
  });

  test('identifies status 422 IDEMPOTENCY_KEY_REUSED', () => {
    const payload = {
      error: {
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'The same idempotency key was reused with different parameters.',
      },
    };

    const err = ApiError.fromResponse(payload, 422);
    expect(err.isIdempotencyKeyReused()).toBe(true);
  });

  test('identifies requirement for email verification in 403', () => {
    const payload = {
      error: {
        code: 'EMAIL_NOT_VERIFIED',
        message: 'You must verify your email to continue.',
      },
      requiresEmailVerification: true,
    };

    const err = ApiError.fromResponse(payload, 403);
    expect(err.requiresEmailVerification()).toBe(true);
  });

  test('decodes network error when there is no HTTP response', () => {
    const netErr = ApiError.fromNetworkError(new Error('Network Timeout'));
    expect(netErr.isNetworkError).toBe(true);
    expect(netErr.code).toBe('NETWORK_ERROR');
    expect(netErr.status).toBe(0);
  });

  test('handles legacy responses with plain text or simple format', () => {
    const errString = ApiError.fromResponse({ error: 'Invalid credentials' }, 401);
    expect(errString.code).toBe('UNAUTHORIZED');
    expect(errString.message).toBe('Invalid credentials');
    expect(errString.isUnauthorized()).toBe(true);
  });
});

describe('shared/api/session.ts (Session Seam)', () => {
  beforeEach(() => {
    session.clearToken();
  });

  test('saves, retrieves, and deletes auth tokens', () => {
    expect(session.hasToken()).toBe(false);
    expect(session.getToken()).toBeNull();

    session.setToken('test-jwt-token-123');
    expect(session.hasToken()).toBe(true);
    expect(session.getToken()).toBe('test-jwt-token-123');

    session.clearToken();
    expect(session.hasToken()).toBe(false);
    expect(session.getToken()).toBeNull();
  });

  test('notifies subscribed listeners when 401 occurs', () => {
    const listener = jest.fn();
    const unsubscribe = session.onUnauthorized(listener);

    session.setToken('active-token');
    session.notifyUnauthorized();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.hasToken()).toBe(false);

    unsubscribe();
    session.notifyUnauthorized();
    expect(listener).toHaveBeenCalledTimes(1); // not called again after unsubscribe
  });
});

describe('shared/api/idempotency.ts', () => {
  test('generateIdempotencyKey produces a valid UUID v4', () => {
    const key = generateIdempotencyKey();
    expect(typeof key).toBe('string');
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(key).toMatch(uuidV4Regex);
  });

  test('isMoneyEndpoint detects the canonical endpoints that move money', () => {
    expect(isMoneyEndpoint('/api/trading/order', 'POST')).toBe(true);
    expect(isMoneyEndpoint('/api/transaccionBlockchain/withdraw', 'POST')).toBe(true);
    expect(isMoneyEndpoint('/api/transfer', 'POST')).toBe(true);
    expect(isMoneyEndpoint('/api/intercambioExchange', 'POST')).toBe(true);
    expect(isMoneyEndpoint('/api/balances/my/transfer', 'POST')).toBe(true);
  });

  test('isMoneyEndpoint rejects methods that are not POST or non-monetary routes', () => {
    expect(isMoneyEndpoint('/api/trading/order', 'GET')).toBe(false);
    expect(isMoneyEndpoint('/api/user/login', 'POST')).toBe(false);
    expect(isMoneyEndpoint('/api/user/register', 'POST')).toBe(false);
    expect(isMoneyEndpoint('/api/balances/my/balances', 'GET')).toBe(false);
  });
});

describe('shared/api/client.ts (HTTP Fetch Transport)', () => {
  beforeEach(() => {
    session.clearToken();
    jest.clearAllMocks();
  });

  function mockFetchResponse(data: unknown, status = 200, contentType = 'application/json') {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'content-type': contentType }),
      json: async () => data,
    });
  }

  test('injects the Authorization header when a session token exists', async () => {
    session.setToken('jwt-bearer-xyz');
    mockFetchResponse({ success: true });

    const res = await apiClient.get('/test');
    expect(res).toEqual({ success: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const fetchOptions = callArgs[1] as RequestInit;
    
    // Headers can be accessed via get if it's a Headers object
    const headers = fetchOptions.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer jwt-bearer-xyz');
  });

  test('automatically injects Idempotency-Key on POST money requests', async () => {
    mockFetchResponse({ orderId: 'ord-123' });

    const res = await apiClient.post('/api/trading/order', { side: 'buy', amount: '1.0' });
    expect(res).toEqual({ orderId: 'ord-123' });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const fetchOptions = callArgs[1] as RequestInit;
    const headers = fetchOptions.headers as Headers;
    
    expect(headers.get('Idempotency-Key')).toBeDefined();
    expect(headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  test('does not inject Idempotency-Key on GET requests even for money endpoints', async () => {
    mockFetchResponse({ success: true });

    await apiClient.get('/api/trading/order');

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const fetchOptions = callArgs[1] as RequestInit;
    const headers = fetchOptions.headers as Headers;
    
    expect(headers.get('Idempotency-Key')).toBeNull();
  });

  test('reuses explicit Idempotency-Key in a retry', async () => {
    const retryKey = '99999999-9999-4999-a999-999999999999';
    mockFetchResponse({ replayed: true });

    const res = await apiClient.post(
      '/api/balances/my/transfer',
      { from: 'funding', to: 'spot', amount: '10' },
      { idempotencyKey: retryKey }
    );
    expect(res).toEqual({ replayed: true });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const fetchOptions = callArgs[1] as RequestInit;
    const headers = fetchOptions.headers as Headers;
    
    expect(headers.get('Idempotency-Key')).toBe(retryKey);
  });

  test('converts response errors into ApiError instances and notifies on 401', async () => {
    const unauthorizedListener = jest.fn();
    session.onUnauthorized(unauthorizedListener);

    mockFetchResponse({ error: { code: 'TOKEN_EXPIRED', message: 'The token expired.' } }, 401);
    
    let caughtErr: any;
    try {
        await apiClient.get('/protected');
    } catch (err) {
        caughtErr = err;
    }
    
    expect(caughtErr).toBeInstanceOf(ApiError);
    expect(caughtErr.code).toBe('TOKEN_EXPIRED');
    expect(unauthorizedListener).toHaveBeenCalledTimes(1);
  });

  test('surfaces a typed error on a network/5xx failure', async () => {
    mockFetchResponse({ error: { code: 'INTERNAL_ERROR', message: 'Server crash' } }, 500);

    try {
        await apiClient.get('/crash');
        fail('Should have thrown ApiError');
    } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.code).toBe('INTERNAL_ERROR');
        expect(err.status).toBe(500);
    }
  });
});
