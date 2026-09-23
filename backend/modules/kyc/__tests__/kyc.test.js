const crypto = require('crypto');
const kycService = require('../kyc.service');
const { User } = require('../../../models');
const KycWebhookEvent = require('../kyc.model');
const AppError = require('../../../utils/AppError');

jest.mock('../../../models', () => {
  return {
    User: {
      findByPk: jest.fn()
    },
    sequelize: {
      transaction: jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }))
    }
  };
});

jest.mock('../kyc.model', () => {
  return {
    findOne: jest.fn(),
    create: jest.fn()
  };
});

describe('KYC Webhook Service', () => {
  const secret = 'test-secret';
  const rawBody = JSON.stringify({
    data: {
      id: 'event-123',
      attributes: {
        name: 'inquiry.approved',
        payload: {
          data: {
            attributes: {
              referenceId: 'user-1'
            }
          }
        }
      }
    }
  });

  const generateSignature = (body, sec) => {
    return crypto.createHmac('sha256', sec).update(body).digest('hex');
  };

  beforeEach(() => {
    process.env.PERSONA_WEBHOOK_SECRET = secret;
    jest.clearAllMocks();
    
    // Spying on timingSafeEqual to ensure it's called
    jest.spyOn(crypto, 'timingSafeEqual');
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects if secret is missing', async () => {
    delete process.env.PERSONA_WEBHOOK_SECRET;
    await expect(kycService.handlePersonaEvent({}, 'sig', 'body')).rejects.toThrow(AppError);
    await expect(kycService.handlePersonaEvent({}, 'sig', 'body')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('rejects INVALID signature and user NOT changed', async () => {
    // A signature of the correct length but incorrect bytes
    const badSigHex = crypto.createHmac('sha256', 'wrong-secret').update(rawBody).digest('hex');
    const badSig = `v1=${badSigHex}`;
    
    await expect(kycService.handlePersonaEvent(JSON.parse(rawBody), badSig, rawBody)).rejects.toThrow(AppError);
    await expect(kycService.handlePersonaEvent(JSON.parse(rawBody), badSig, rawBody)).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
    
    expect(User.findByPk).not.toHaveBeenCalled();
    expect(crypto.timingSafeEqual).toHaveBeenCalled();
  });

  it('rejects if signature length is different', async () => {
    const badSig = 'v1=short';
    await expect(kycService.handlePersonaEvent(JSON.parse(rawBody), badSig, rawBody)).rejects.toThrow(AppError);
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it('processes valid signature + inquiry.approved -> user upgraded', async () => {
    const sig = `v1=${generateSignature(rawBody, secret)}`;
    const mockUpdate = jest.fn();
    User.findByPk.mockResolvedValue({ id: 'user-1', update: mockUpdate });
    KycWebhookEvent.findOne.mockResolvedValue(null);

    const result = await kycService.handlePersonaEvent(JSON.parse(rawBody), sig, rawBody);
    
    expect(result.success).toBe(true);
    expect(crypto.timingSafeEqual).toHaveBeenCalled();
    expect(User.findByPk).toHaveBeenCalledWith('user-1', expect.objectContaining({ transaction: expect.anything() }));
    expect(mockUpdate).toHaveBeenCalledWith(
      { kycVerified: true, kycLevel: 'full' },
      expect.objectContaining({ transaction: expect.anything() })
    );
    expect(KycWebhookEvent.create).toHaveBeenCalledWith(
      {
        eventId: 'event-123',
        eventType: 'inquiry.approved',
        referenceId: 'user-1'
      },
      expect.objectContaining({ transaction: expect.anything() })
    );
  });

  it('fails closed if rawBody is missing (no JSON.stringify fallback)', async () => {
    const sig = `v1=${generateSignature(rawBody, secret)}`;
    await expect(kycService.handlePersonaEvent(JSON.parse(rawBody), sig, undefined))
      .rejects.toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it('propagates an upgrade failure so the event is not left marked processed (retryable)', async () => {
    const sig = `v1=${generateSignature(rawBody, secret)}`;
    KycWebhookEvent.findOne.mockResolvedValue(null);
    const mockUpdate = jest.fn().mockRejectedValue(new Error('DB down'));
    User.findByPk.mockResolvedValue({ id: 'user-1', update: mockUpdate });

    await expect(kycService.handlePersonaEvent(JSON.parse(rawBody), sig, rawBody))
      .rejects.toThrow('DB down');
  });

  it('treats a concurrent duplicate (unique event_id violation) as idempotent success, not a 500', async () => {
    const sig = `v1=${generateSignature(rawBody, secret)}`;
    KycWebhookEvent.findOne.mockResolvedValue(null); // lost the race: winner not visible yet
    const uniqueErr = new Error('duplicate key'); uniqueErr.name = 'SequelizeUniqueConstraintError';
    KycWebhookEvent.create.mockRejectedValue(uniqueErr);

    const result = await kycService.handlePersonaEvent(JSON.parse(rawBody), sig, rawBody);
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/idempotent/i);
  });

  it('handles duplicate event -> no-op', async () => {
    const sig = `v1=${generateSignature(rawBody, secret)}`;
    KycWebhookEvent.findOne.mockResolvedValue({ id: 'existing' });

    const result = await kycService.handlePersonaEvent(JSON.parse(rawBody), sig, rawBody);
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Event already processed (idempotent)');
    expect(crypto.timingSafeEqual).toHaveBeenCalled();
    expect(User.findByPk).not.toHaveBeenCalled();
    expect(KycWebhookEvent.create).not.toHaveBeenCalled();
  });
});
