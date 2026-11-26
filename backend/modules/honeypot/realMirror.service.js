// Real-time mirror of the ATTACKER'S OWN accounts into the fake panel. Reads ONLY the users
// that registered from the attacker's own IP (joined via user_signup_info.signup_ip) — their
// own data, which they already know — never other customers' PII, and always excluding the
// owner. Queried live, so an account the attacker just created shows up immediately.
//
// This is a read-only, IP-scoped query. It does NOT touch the money-path (ledger/balances) —
// the deception can still never move or read real funds.
const OWNER_EMAIL = 'grgurichabner@gmail.com';

async function ownAccountsByIp(ip) {
  try {
    if (!ip) return [];
    const { sequelize } = require('../../models');
    const { QueryTypes } = require('sequelize');
    const rows = await sequelize.query(
      `SELECT u.id,
              u.username,
              u.email,
              u.role,
              u.active,
              u.kyc_verified      AS "kycVerified",
              u.daily_limit_usd   AS "dailyLimitUsd",
              u.average_rating    AS "averageRating",
              u.total_ratings     AS "totalRatings",
              u.country,
              u.google_id         AS "googleId"
         FROM users u
         JOIN user_signup_info s ON s.user_id = u.id
        WHERE s.signup_ip = :ip
          AND u.email <> :owner
        ORDER BY u.created_at DESC
        LIMIT 25`,
      { replacements: { ip, owner: OWNER_EMAIL }, type: QueryTypes.SELECT },
    );
    return rows;
  } catch (e) {
    console.error('[honeypot] ownAccountsByIp failed: ' + e.message);
    return [];
  }
}

module.exports = { ownAccountsByIp, OWNER_EMAIL };
