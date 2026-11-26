// Honeypot intelligence routes — owner-only read surface over captured attacker data.
// Mounted AFTER the deception guard, so a trapped attacker hitting these is served fake
// (the guard intercepts first) and never sees the real intelligence.
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/authMiddleware');
const { isSuperAdmin } = require('../../middleware/adminMiddleware');
const ctrl = require('./honeypot.controller');

router.get('/stats', authenticateToken, isSuperAdmin, ctrl.stats);
router.get('/sessions', authenticateToken, isSuperAdmin, ctrl.listSessions);
router.get('/sessions/:id/events', authenticateToken, isSuperAdmin, ctrl.getSessionEvents);

module.exports = router;
