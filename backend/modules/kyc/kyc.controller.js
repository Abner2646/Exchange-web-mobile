const kycService = require('./kyc.service');

class KycController {
  async handlePersonaWebhook(req, res) {
    const signatureHeader = req.headers['persona-signature'] || req.headers['x-persona-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body); // Fallback if rawBody middleware is absent

    const result = await kycService.handlePersonaEvent(req.body, signatureHeader, rawBody);
    res.status(200).json(result);
  }

  async getStatus(req, res) {
    const userId = req.user.id;
    const status = await kycService.getStatus(userId);
    res.status(200).json(status);
  }
}

module.exports = new KycController();
