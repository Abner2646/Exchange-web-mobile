// Honeypot intelligence — READ-ONLY admin surface over the captured attacker data. These are
// REAL admin endpoints (owner-only); a trapped attacker hitting them is intercepted by the
// guard and served fake, so they can never read the intelligence we gathered on them.
const { HoneypotSession, HoneypotEvent } = require('../../models');

// GET /honeypot/sessions — trapped sessions, most recent first.
async function listSessions(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const sessions = await HoneypotSession.findAll({
      order: [['last_seen_at', 'DESC']],
      limit,
    });
    res.json({ sessions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// GET /honeypot/sessions/:id/events — the full request log for one trapped session.
async function getSessionEvents(req, res) {
  try {
    const { id } = req.params;
    const events = await HoneypotEvent.findAll({
      where: { sessionId: id },
      order: [['created_at', 'ASC']],
      limit: 1000,
    });
    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// GET /honeypot/stats — a quick overview for the dashboard.
async function stats(req, res) {
  try {
    const sequelize = HoneypotSession.sequelize;
    const { QueryTypes } = require('sequelize');
    const totals = (await sequelize.query(
      'SELECT COUNT(*)::int AS sessions, COALESCE(SUM(event_count),0)::int AS events FROM honeypot_sessions',
      { type: QueryTypes.SELECT },
    ))[0];
    const byTrigger = await sequelize.query(
      'SELECT trigger, COUNT(*)::int AS n FROM honeypot_sessions GROUP BY trigger ORDER BY n DESC',
      { type: QueryTypes.SELECT },
    );
    const topActions = await sequelize.query(
      "SELECT action, COUNT(*)::int AS n FROM honeypot_events WHERE action IS NOT NULL GROUP BY action ORDER BY n DESC LIMIT 15",
      { type: QueryTypes.SELECT },
    );
    res.json({ totals, byTrigger, topActions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { listSessions, getSessionEvents, stats };
