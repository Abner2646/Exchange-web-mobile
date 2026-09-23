const crypto = require('crypto');
const { User } = require('../../models');
const KycWebhookEvent = require('./kyc.model');
const AppError = require('../../utils/AppError');

class KycService {
  verifySignature(signatureHeader, rawBody) {
    const secret = process.env.PERSONA_WEBHOOK_SECRET;
    if (!secret) {
      console.error('CRITICAL: PERSONA_WEBHOOK_SECRET is not set.');
      throw new AppError(500, 'INTERNAL_ERROR', 'Webhook secret is not configured.');
    }

    if (!signatureHeader || typeof signatureHeader !== 'string') {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid signature header.');
    }

    // Parse the header defensively. It might be a direct hash or a key=value pairs like t=...,v1=...
    let signature = signatureHeader;
    const match = signatureHeader.match(/t=[^,]+,v1=([^,]+)/);
    if (match && match[1]) {
      signature = match[1];
    } else if (signatureHeader.startsWith('v1=')) {
      signature = signatureHeader.substring(3);
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const actualBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== actualBuffer.length) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid signature length.');
    }

    if (!crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid signature.');
    }
  }

  async handlePersonaEvent(payload, signatureHeader, rawBody) {
    // Verify signature first
    this.verifySignature(signatureHeader, rawBody);

    if (!payload || !payload.data) {
      throw new AppError(400, 'BAD_REQUEST', 'Malformed webhook payload.');
    }

    const eventName = payload.data.attributes && payload.data.attributes.name;
    const eventId = payload.data.id;
    
    // REVIEW: Mapping assumption. Assuming the webhook payload contains the userId in the referenceId field.
    // Standard Persona webhooks for inquiries often place it inside payload.data.attributes.payload.data.attributes.referenceId
    const innerData = payload.data.attributes && payload.data.attributes.payload && 
                      payload.data.attributes.payload.data && payload.data.attributes.payload.data.attributes 
                      ? payload.data.attributes.payload.data.attributes 
                      : {};
    
    const referenceId = innerData.referenceId || innerData.reference_id || payload.data.attributes.referenceId;

    if (!eventId) {
      throw new AppError(400, 'BAD_REQUEST', 'Missing event ID in payload.');
    }

    // Check idempotency
    const existingEvent = await KycWebhookEvent.findOne({ where: { eventId } });
    if (existingEvent) {
      console.log(`Event ${eventId} already processed, skipping.`);
      return { success: true, message: 'Event already processed (idempotent)' };
    }

    // Register event to avoid duplicates
    await KycWebhookEvent.create({
      eventId,
      eventType: eventName || 'unknown',
      referenceId: referenceId || null
    });

    if (eventName === 'inquiry.approved' || eventName === 'inquiry.completed') {
      if (!referenceId) {
        throw new AppError(400, 'BAD_REQUEST', 'Missing referenceId for user mapping.');
      }

      // Upgrade user
      const user = await User.findByPk(referenceId);
      if (!user) {
        // If user is not found, we still return 200 so the webhook isn't redelivered, but we log the error.
        console.error(`User not found for referenceId: ${referenceId}`);
        return { success: true, message: 'User not found, ignoring event.' };
      }

      await user.update({
        kycVerified: true,
        kycLevel: 'full'
      });
      // REVIEW: kyc_required_for_withdrawals controls the withdrawal-enforcement toggle.
      // Do not implement withdrawal enforcement here, it is a separate money-path step.
      console.log(`User ${referenceId} upgraded to KYC Tier 1.`);
    } else {
      console.log(`Event ${eventName} ignored.`);
    }

    return { success: true };
  }

  async getStatus(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found.');
    }
    return {
      kycVerified: user.kycVerified,
      kycLevel: user.kycLevel
    };
  }
}

module.exports = new KycService();
