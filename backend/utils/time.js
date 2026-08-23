// utils/time.js
//
// Day boundaries computed in UTC. Timestamps are stored in UTC (Postgres
// TIMESTAMPTZ), so any "daily" window — e.g. the daily exchange volume limit —
// must be anchored to the UTC calendar day. Using setHours() instead anchors it
// to the SERVER's local day, which shifts between environments and is a real bug
// for money limits (the limit would reset at a different wall-clock time
// depending on where the process runs).

function startOfUtcDay(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfUtcDay(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

module.exports = { startOfUtcDay, endOfUtcDay };
