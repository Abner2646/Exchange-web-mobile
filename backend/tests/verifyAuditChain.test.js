const { GENESIS, computeHash } = require('../modules/audit/auditHash');
const { verifyRows } = require('../modules/audit/verifyAuditChain');

function chained(events) {
  let prevHash = GENESIS;
  return events.map((e, i) => {
    const fields = { eventId: e.eventId, eventType: e.eventType, payload: e.payload, aggregateId: e.aggregateId ?? null, occurredAt: e.occurredAt };
    const hash = computeHash(fields, prevHash);
    const row = { id: i + 1, ...fields, prevHash, hash };
    prevHash = hash;
    return row;
  });
}

const base = [
  { eventId: 'e1', eventType: 'T', payload: { n: 1 }, occurredAt: '2026-01-01T00:00:00.000Z' },
  { eventId: 'e2', eventType: 'T', payload: { n: 2 }, occurredAt: '2026-01-02T00:00:00.000Z' },
  { eventId: 'e3', eventType: 'T', payload: { n: 3 }, occurredAt: '2026-01-03T00:00:00.000Z' },
];

describe('verifyRows', () => {
  test('a valid chain verifies', () => {
    expect(verifyRows(chained(base))).toEqual({ ok: true, brokenAtSeq: null, checked: 3 });
  });
  test('an altered payload is detected at that row', () => {
    const rows = chained(base);
    rows[1].payload = { n: 999 }; // tamper: hash no longer matches content
    expect(verifyRows(rows)).toEqual({ ok: false, brokenAtSeq: 2, checked: 3 });
  });
  test('a deleted middle row breaks the prevHash link', () => {
    const rows = chained(base);
    rows.splice(1, 1); // remove row 2 → row 3's prevHash no longer matches row 1's hash
    expect(verifyRows(rows)).toEqual({ ok: false, brokenAtSeq: 3, checked: 2 });
  });
  test('an empty chain verifies', () => {
    expect(verifyRows([])).toEqual({ ok: true, brokenAtSeq: null, checked: 0 });
  });
});
