// Honeypot ("Mirage") persistence — FULLY ISOLATED from the real domain.
//
// Two tables, both additive and self-contained: a session per trapped attacker and a
// full event log of everything they do inside the fake admin. Nothing here references
// the real ledger, users, or money-path (a CI guard enforces that — see the module's
// README/test). This file only defines storage for captured attacker intelligence.
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // One row per trapped attacker (keyed by IP and/or the subject of their fake session).
  const HoneypotSession = sequelize.define(
    'HoneypotSession',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      ip: { type: DataTypes.STRING(45), allowNull: true },
      // If they came in authenticated (real or fake-admin token), the subject we matched on.
      markedUserId: { type: DataTypes.STRING, allowNull: true },
      // What put them in the trap: 'honeytoken' | 'risk_score' | 'fake_exploit'.
      trigger: { type: DataTypes.STRING(32), allowNull: false },
      riskScore: { type: DataTypes.INTEGER, allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: true },
      userAgent: { type: DataTypes.TEXT, allowNull: true },
      // The attacker's OWN registration identity (captured from their register/login body) so
      // the fake panel can mirror their account back to them — never a real user's data.
      capturedEmail: { type: DataTypes.STRING, allowNull: true },
      capturedUsername: { type: DataTypes.STRING, allowNull: true },
      // Enriched geolocation of the attacker IP (reuses the signup-intel style; filled best-effort).
      ipCountry: { type: DataTypes.STRING, allowNull: true },
      ipIsp: { type: DataTypes.STRING, allowNull: true },
      eventCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      firstSeenAt: { type: DataTypes.DATE, allowNull: true },
      lastSeenAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'honeypot_sessions', underscored: true, timestamps: true },
  );

  // Every request a trapped attacker makes inside the fake admin — the raw intelligence.
  const HoneypotEvent = sequelize.define(
    'HoneypotEvent',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      sessionId: { type: DataTypes.UUID, allowNull: true },
      ip: { type: DataTypes.STRING(45), allowNull: true },
      userAgent: { type: DataTypes.TEXT, allowNull: true },
      method: { type: DataTypes.STRING(8), allowNull: true },
      path: { type: DataTypes.TEXT, allowNull: true },
      query: { type: DataTypes.JSONB, allowNull: true },
      // The attacker-controlled payload (capped + stored verbatim — it IS the exploit).
      body: { type: DataTypes.JSONB, allowNull: true },
      headers: { type: DataTypes.JSONB, allowNull: true },
      // Classified intent: 'view_users'|'approve_withdrawal'|'edit_balance'|'export'|'register_exploit'|...
      action: { type: DataTypes.STRING, allowNull: true },
      statusServed: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: 'honeypot_events', underscored: true, timestamps: true },
  );

  HoneypotSession.hasMany(HoneypotEvent, { foreignKey: 'sessionId', as: 'events' });
  HoneypotEvent.belongsTo(HoneypotSession, { foreignKey: 'sessionId', as: 'session' });

  return { HoneypotSession, HoneypotEvent };
};
