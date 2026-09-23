const kycService = require('./kyc.service');

class KycController {
  async handlePersonaWebhook(req, res) {
    const signatureHeader = req.headers['persona-signature'] || req.headers['x-persona-signature'];
    // Pass the captured raw bytes as-is. Do NOT fall back to JSON.stringify(req.body):
    // the service fails closed if rawBody is absent so the HMAC is never checked against
    // a re-serialized body whose byte layout differs from what Persona signed.
    const result = await kycService.handlePersonaEvent(req.body, signatureHeader, req.rawBody);
    res.status(200).json(result);
  }

  async getStatus(req, res) {
    const userId = req.user.id;
    const status = await kycService.getStatus(userId);
    res.status(200).json(status);
  }
}

module.exports = new KycController();
