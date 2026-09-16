# AML Perf Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the performance-debt items deferred from AML Slices B and C — fewer DB round-trips per evaluation and per sweep, N+1 in valuation, duplicate User query for S1+S6, redundant sweep queries, and structural duplication across the four periodic jobs.

**Architecture:** Six self-contained tasks, each with its own test cycle. Tasks 1–5 touch the AML module; Task 6 is a behavior-preserving structural refactor of the job infrastructure. No behavior changes to signals, cases, or compliance logic — only how facts are fetched.

**Tech Stack:** Node.js / Sequelize / Jest (unit + integration), existing `backend/tests/helpers/{db,factories,testEnv}` harness.

## Global Constraints

- All existing tests must stay green after every task. Run `npm test` (unit) and `npm run test:integration` (integration) before each commit.
- No changes to signal logic (S1–S6), case opening, riskFlag, or the monitoring-off gate.
- No new dependencies.
- Conventional Commits in English (`perf(aml):`, `refactor(jobs):`).
- Coverage gate: `npm run test:coverage` + `npm run test:integration:coverage` must both exit 0.

---

### Task 1: Merge sweep's two BlockchainTransaction queries into one + Promise.all

Two separate finder calls (`recentWithdrawals`, `recentConfirmedDeposits`) hit the same table with almost identical filters. Replace them with a single `recentMoneyTransactions` query using `Op.or`, then load money-rows and P2P rows in parallel.

**Files:**
- Modify: `backend/modules/aml/amlDataAccess.js`
- Modify: `backend/modules/aml/amlSweep.js`
- Modify: `backend/tests/integration/amlSweepFinders.integration.test.js`
- Modify: `backend/tests/amlSweep.test.js`

**Interfaces:**
- Removes: `recentWithdrawals(since)`, `recentConfirmedDeposits(since)` (only used by sweep)
- Produces: `recentMoneyTransactions(since)` → `Array<{ id, userId, cryptoId, amount: String, eventType: 'WithdrawalTransmitted'|'DepositConfirmed' }>`

- [ ] **Step 1: Write the failing integration test for `recentMoneyTransactions`**

In `backend/tests/integration/amlSweepFinders.integration.test.js`, add a new `describe` block (keep the existing tests for backward-compat verification — we'll remove them in the last step of this task):

```js
describe('recentMoneyTransactions', () => {
  test('returns confirmed withdrawals and deposits with correct eventType, excludes failed/pending/old', async () => {
    const u1 = await f.seedUser(); const u2 = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    const now = Date.now();
    // included: confirmed withdrawal
    const w = await tx({ userId: u1.id, cryptoId: c.id, type: 'withdrawal', amount: '1', status: 'confirmed', created_at: new Date(now - HOUR) });
    // excluded: failed
    await tx({ userId: u2.id, cryptoId: c.id, type: 'withdrawal', amount: '2', status: 'failed', created_at: new Date(now - HOUR) });
    // excluded: processing (not yet transmitted)
    await tx({ userId: u1.id, cryptoId: c.id, type: 'withdrawal', amount: '4', status: 'processing', created_at: new Date(now - HOUR) });
    // excluded: too old
    await tx({ userId: u1.id, cryptoId: c.id, type: 'withdrawal', amount: '3', status: 'completed', created_at: new Date(now - 72 * HOUR) });
    // included: confirmed deposit
    const d = await tx({ userId: u2.id, cryptoId: c.id, type: 'deposit', amount: '5', status: 'confirmed', created_at: new Date(now - HOUR) });
    // excluded: pending deposit
    await tx({ userId: u2.id, cryptoId: c.id, type: 'deposit', amount: '9', status: 'pending', created_at: new Date(now - HOUR) });

    const rows = await da.recentMoneyTransactions(new Date(now - 48 * HOUR));
    const byId = Object.fromEntries(rows.map(r => [r.id, r]));
    expect(rows).toHaveLength(2);
    expect(byId[w.id]).toMatchObject({ userId: u1.id, eventType: 'WithdrawalTransmitted', amount: '1.00000000' });
    expect(byId[d.id]).toMatchObject({ userId: u2.id, eventType: 'DepositConfirmed', amount: '5.00000000' });
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```
npm run test:integration -- --testPathPattern=amlSweepFinders
```
Expected: FAIL — `recentMoneyTransactions is not a function`

- [ ] **Step 3: Add `recentMoneyTransactions` to `amlDataAccess.js`**

After `recentCompletedP2P`, add:

```js
async function recentMoneyTransactions(since, transaction = null) {
  const { BlockchainTransaction } = require('../../models');
  const rows = await BlockchainTransaction.findAll({
    where: {
      status: { [Op.in]: ['confirmed', 'completed'] },
      created_at: { [Op.gte]: since },
      [Op.or]: [
        { type: 'withdrawal' },
        { type: 'deposit' },
      ],
    },
    transaction,
  });
  return rows.map(r => ({
    id: r.id,
    userId: r.userId,
    cryptoId: r.cryptoId,
    amount: String(r.amount),
    eventType: r.type === 'withdrawal' ? 'WithdrawalTransmitted' : 'DepositConfirmed',
  }));
}
```

Add to `module.exports`: `recentMoneyTransactions`.

- [ ] **Step 4: Run integration test — should pass**

```
npm run test:integration -- --testPathPattern=amlSweepFinders
```
Expected: PASS

- [ ] **Step 5: Update `amlSweep.js` to use the new function + Promise.all**

Replace the whole `runSweep` body (everything after the monitoring check):

```js
async function runSweep() {
  const counters = { byType: { WithdrawalTransmitted: 0, DepositConfirmed: 0, P2PTransactionCompleted: 0 }, errors: 0 };
  if (!(await amlConfig.isMonitoringEnabled())) return { scanned: 0, byType: counters.byType, errors: 0 };

  const lookbackHours = await amlConfig.getThreshold('aml.sweep.lookbackHours', 48);
  const since = new Date(Date.now() - lookbackHours * 3600000);

  const [moneyRows, p2pRows] = await Promise.all([
    da.recentMoneyTransactions(since),
    da.recentCompletedP2P(since),
  ]);

  for (const r of moneyRows) {
    const payload = r.eventType === 'WithdrawalTransmitted'
      ? { blockchainTransactionId: r.id, userId: r.userId, cryptoId: r.cryptoId, amount: r.amount }
      : { blockchainTransactionId: r.id, userId: r.userId, cryptoId: r.cryptoId, amount: r.amount };
    await replay(r.id, r.eventType, payload, counters);
  }
  for (const r of p2pRows) {
    await replay(r.id, 'P2PTransactionCompleted', { buyerId: r.buyerId, sellerId: r.sellerId, transaction: { id: r.id } }, counters);
  }

  const { byType, errors } = counters;
  const scanned = byType.WithdrawalTransmitted + byType.DepositConfirmed + byType.P2PTransactionCompleted;
  return { scanned, byType, errors };
}
```

- [ ] **Step 6: Update `amlSweep.test.js` unit tests to mock `recentMoneyTransactions` instead of the old two functions**

Replace the mock at the top:

```js
jest.mock('../modules/aml/amlDataAccess', () => ({
  recentMoneyTransactions: jest.fn(),
  recentCompletedP2P: jest.fn(),
}));
```

In `beforeEach`:
```js
da.recentMoneyTransactions.mockResolvedValue([]);
da.recentCompletedP2P.mockResolvedValue([]);
```

Update the `'monitoring OFF'` test (just change `da.recentWithdrawals` → `da.recentMoneyTransactions`):
```js
expect(da.recentMoneyTransactions).not.toHaveBeenCalled();
```

Update the `'replays each recent row'` test:
```js
da.recentMoneyTransactions.mockResolvedValue([
  { id: 'w1', userId: 'u1', cryptoId: 'c1', amount: '2.5', eventType: 'WithdrawalTransmitted' },
  { id: 'd1', userId: 'u2', cryptoId: 'c1', amount: '1',   eventType: 'DepositConfirmed' },
]);
da.recentCompletedP2P.mockResolvedValue([{ id: 'p1', buyerId: 'a', sellerId: 'b' }]);
const res = await sweep.runSweep();

expect(res.scanned).toBe(3);
expect(res.byType).toEqual({ WithdrawalTransmitted: 1, DepositConfirmed: 1, P2PTransactionCompleted: 1 });
expect(consumer.handleEvent).toHaveBeenCalledWith({ id: 'w1', type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: 'w1', userId: 'u1', cryptoId: 'c1', amount: '2.5' } });
expect(consumer.handleEvent).toHaveBeenCalledWith({ id: 'd1', type: 'DepositConfirmed',      payload: { blockchainTransactionId: 'd1', userId: 'u2', cryptoId: 'c1', amount: '1' } });
expect(consumer.handleEvent).toHaveBeenCalledWith({ id: 'p1', type: 'P2PTransactionCompleted', payload: { buyerId: 'a', sellerId: 'b', transaction: { id: 'p1' } } });
```

Update the `'throwing handleEvent'` test: use `recentMoneyTransactions` returning 2 rows:
```js
da.recentMoneyTransactions.mockResolvedValue([
  { id: 'w1', userId: 'u1', cryptoId: 'c1', amount: '1', eventType: 'WithdrawalTransmitted' },
  { id: 'w2', userId: 'u1', cryptoId: 'c1', amount: '1', eventType: 'WithdrawalTransmitted' },
]);
```

- [ ] **Step 7: Remove `recentWithdrawals` and `recentConfirmedDeposits` from `amlDataAccess.js`** (they are now unused — remove from the function bodies and from `module.exports`)

Also remove the old `describe('amlDataAccess recent (cross-user) finders'` test block in `amlSweepFinders.integration.test.js` that tests the removed functions. Keep the new `recentMoneyTransactions` block.

- [ ] **Step 8: Run full test suite to verify nothing broke**

```
npm test && npm run test:integration
```
Expected: all green

- [ ] **Step 9: Commit**

```
git add backend/modules/aml/amlDataAccess.js backend/modules/aml/amlSweep.js backend/tests/integration/amlSweepFinders.integration.test.js backend/tests/amlSweep.test.js
git commit -m "perf(aml): merge withdrawal+deposit sweep queries + Promise.all finders"
```

---

### Task 2: Eliminate N+1 quote-crypto lookup in `getUsdValue` + stale-price alarm

Currently `getUsdValue` calls `Crypto.findByPk(pair.quoteCryptoId)` in a loop — one DB query per active pair for the asset. Replace with a single `Crypto.findAll` for all quote IDs in the pairs set. Also add a `console.warn` when the best price is older than a configurable threshold (default 1 hour), so a stale feed is visible in logs without silently producing an AML miss.

**Files:**
- Modify: `backend/modules/aml/amlValuation.js`
- Modify: `backend/tests/integration/amlValuation.integration.test.js`

**Interfaces:**
- `getUsdValue(cryptoId, amount, transaction?)` — same signature and return type as before.
- New internal behavior: one `Crypto.findAll` instead of N findByPk; logs warn if `priceAsOf` is older than `STALE_PRICE_THRESHOLD_MS`.

- [ ] **Step 1: Write the failing unit test for the stale-price alarm**

In `amlValuation.integration.test.js`, add:

```js
test('a price older than the stale threshold emits a warning (but still returns a value)', async () => {
  const btc = await Crypto.create({ symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8 });
  const usdt = await Crypto.create({ symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 });
  // lastUpdated set to 2 hours ago
  const staleDate = new Date(Date.now() - 2 * 3600 * 1000);
  await SwapPair.create({ baseCryptoId: btc.id, quoteCryptoId: usdt.id, currentPrice: '40000', feePercent: '0.1', active: true, lastUpdated: staleDate });

  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const r = await valuation.getUsdValue(btc.id, '1');
  expect(r.source).toBe('pair');
  expect(Number(r.usd)).toBe(40000);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[amlValuation] stale price'));
  warnSpy.mockRestore();
});
```

- [ ] **Step 2: Run to confirm it fails**

```
npm run test:integration -- --testPathPattern=amlValuation
```
Expected: FAIL — no warning emitted

- [ ] **Step 3: Rewrite `getUsdValue` in `amlValuation.js`**

Replace the entire function body:

```js
const STALE_PRICE_THRESHOLD_MS = 3600 * 1000; // 1 hour

async function getUsdValue(cryptoId, amount, transaction = null) {
  const { Crypto, SwapPair } = require('../../models');
  const crypto = await Crypto.findByPk(cryptoId, { transaction });
  if (!crypto) return { usd: null, priceAsOf: null, source: 'unknown' };

  if (STABLE_SYMBOLS.includes(crypto.symbol)) {
    return { usd: String(amount), priceAsOf: new Date(), source: 'stable' };
  }

  const pairs = await SwapPair.findAll({ where: { baseCryptoId: cryptoId, active: true }, transaction });
  if (pairs.length === 0) return { usd: null, priceAsOf: null, source: 'unknown' };

  // Batch-load all quote cryptos in one query instead of N findByPk calls.
  const quoteIds = [...new Set(pairs.map(p => p.quoteCryptoId))];
  const quoteRows = await Crypto.findAll({ where: { id: quoteIds }, transaction });
  const quoteById = Object.fromEntries(quoteRows.map(c => [c.id, c]));

  for (const pair of pairs) {
    if (money.compare(String(pair.currentPrice), '0') <= 0) continue;
    const quote = quoteById[pair.quoteCryptoId];
    if (quote && STABLE_SYMBOLS.includes(quote.symbol)) {
      const priceAsOf = pair.lastUpdated || null;
      if (priceAsOf && Date.now() - new Date(priceAsOf).getTime() > STALE_PRICE_THRESHOLD_MS) {
        console.warn(`[amlValuation] stale price for cryptoId=${cryptoId} (last updated ${priceAsOf.toISOString()}) — AML valuation may undercount`);
      }
      return {
        usd: money.multiply(String(amount), String(pair.currentPrice)),
        priceAsOf,
        source: 'pair',
      };
    }
  }
  return { usd: null, priceAsOf: null, source: 'unknown' };
}
```

- [ ] **Step 4: Run integration tests — should pass**

```
npm run test:integration -- --testPathPattern=amlValuation
```
Expected: all 5 tests PASS

- [ ] **Step 5: Run the full suite to make sure nothing regressed**

```
npm test && npm run test:integration
```
Expected: all green

- [ ] **Step 6: Commit**

```
git add backend/modules/aml/amlValuation.js backend/tests/integration/amlValuation.integration.test.js
git commit -m "perf(aml): batch quote-crypto lookup in getUsdValue + stale-price alarm"
```

---

### Task 3: Merge `userCreatedAt` + `userDailyLimit` into one `userProfile` query

The S1+S6 evaluator block calls both `da.userCreatedAt(userId)` and `da.userDailyLimit(userId)` — two separate `User.findByPk` calls for the same row. Replace with `da.userProfile(userId)` that returns both fields in one query.

**Files:**
- Modify: `backend/modules/aml/amlDataAccess.js`
- Modify: `backend/modules/aml/amlEvaluator.js`
- Modify: `backend/tests/integration/amlDataAccess.integration.test.js`

**Interfaces:**
- `userProfile(userId, transaction?)` → `{ createdAt: Date|null, dailyLimitUsd: String|null }`
  - `dailyLimitUsd` follows the same null-not-zero contract as the old `userDailyLimit`.
- `userCreatedAt` and `userDailyLimit` are kept (they're tested + may be used elsewhere outside the evaluator) — no removal.

- [ ] **Step 1: Write the failing integration test for `userProfile`**

In `amlDataAccess.integration.test.js`, add inside the existing `describe`:

```js
test('userProfile returns both createdAt and dailyLimitUsd in one call', async () => {
  const u = await f.seedUser();
  // f.seedUser creates a User; set a known dailyLimitUsd
  await u.update({ dailyLimitUsd: '5000' });
  const p = await da.userProfile(u.id);
  expect(p.createdAt).toBeInstanceOf(Date);
  expect(p.dailyLimitUsd).toBe('5000.00'); // canonical decimal string
});

test('userProfile returns nulls for a missing user', async () => {
  const p = await da.userProfile(999999);
  expect(p).toEqual({ createdAt: null, dailyLimitUsd: null });
});

test('userProfile returns null dailyLimitUsd when the field is null', async () => {
  const u = await f.seedUser();
  await u.update({ dailyLimitUsd: null });
  const p = await da.userProfile(u.id);
  expect(p.dailyLimitUsd).toBeNull();
});
```

- [ ] **Step 2: Run to confirm they fail**

```
npm run test:integration -- --testPathPattern=amlDataAccess
```
Expected: FAIL — `userProfile is not a function`

- [ ] **Step 3: Add `userProfile` to `amlDataAccess.js`**

After the existing `userDailyLimit` function, add:

```js
async function userProfile(userId, transaction = null) {
  const { User } = require('../../models');
  const u = await User.findByPk(userId, { transaction });
  if (!u) return { createdAt: null, dailyLimitUsd: null };
  return {
    createdAt: u.created_at,
    dailyLimitUsd: u.dailyLimitUsd != null ? String(u.dailyLimitUsd) : null,
  };
}
```

Add `userProfile` to `module.exports`.

- [ ] **Step 4: Run integration test — should pass**

```
npm run test:integration -- --testPathPattern=amlDataAccess
```
Expected: all tests PASS

- [ ] **Step 5: Update `amlEvaluator.js` to use `userProfile` for the S1+S6 block**

Replace the entire `if (event.type === 'DepositConfirmed' || event.type === 'WithdrawalTransmitted')` block:

```js
if (event.type === 'DepositConfirmed' || event.type === 'WithdrawalTransmitted') {
  const userId = p.userId;
  // One query for both S1 (dailyLimitUsd) and S6 (createdAt).
  const { createdAt, dailyLimitUsd: limitUsd } = await da.userProfile(userId);

  // S1 volume over the rolling window vs the user's daily limit
  const s1Hours = await amlConfig.getThreshold('aml.s1.windowHours', 24);
  const s1Mult  = await amlConfig.getThreshold('aml.s1.multiplier', 3);
  if (limitUsd !== null && money.compare(limitUsd, '0') > 0) {
    const moves1 = await da.onchainMovementsInWindow(userId, new Date(Date.now() - s1Hours * 3600000));
    const { sumUsd: vol1, unvaluable: unv1, unvaluableCryptoIds: unvIds1 } = await valueItems(moves1);
    const f1 = s1({ totalUsd: vol1, limitUsd, multiplier: s1Mult });
    if (f1) {
      f1.evidence.unvaluable = unv1;
      f1.evidence.unvaluableCryptoIds = unvIds1;
      results.push({ userId, finding: f1, dedupeKey: `${userId}:S1:${utcDay()}` });
    }
  }

  // S6 new-account volume since signup
  const maxAgeDays = await amlConfig.getThreshold('aml.s6.accountAgeDays', 7);
  const volumeUsd  = await amlConfig.getThreshold('aml.s6.volumeUsd', 50000);
  if (createdAt) {
    const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000;
    if (ageDays < maxAgeDays) {
      const movesAll = await da.onchainMovementsInWindow(userId, new Date(createdAt));
      const { sumUsd: vol6, unvaluable: unv6, unvaluableCryptoIds: unvIds6 } = await valueItems(movesAll);
      const f6 = s6({ accountAgeDays: ageDays, maxAgeDays, totalUsd: vol6, volumeUsd });
      if (f6) {
        f6.evidence.unvaluable = unv6;
        f6.evidence.unvaluableCryptoIds = unvIds6;
        results.push({ userId, finding: f6, dedupeKey: `${userId}:S6:${utcDay()}` });
      }
    }
  }
}
```

- [ ] **Step 6: Run the full test suite**

```
npm test && npm run test:integration
```
Expected: all green

- [ ] **Step 7: Commit**

```
git add backend/modules/aml/amlDataAccess.js backend/modules/aml/amlEvaluator.js backend/tests/integration/amlDataAccess.integration.test.js
git commit -m "perf(aml): merge userCreatedAt+userDailyLimit into single userProfile query"
```

---

### Task 4: Memoize `getUsdValue` per `cryptoId` inside `valueItems`

When `valueItems` processes a list of transactions that share the same `cryptoId` (common in S2: several BTC withdrawals), `getUsdValue` fires a fresh DB lookup for each row. A simple `Map` keyed on `cryptoId` eliminates the duplicates within one `valueItems` call.

**Files:**
- Modify: `backend/modules/aml/amlEvaluator.js`
- Modify: `backend/tests/amlSignalsS1S2S6.test.js` (or add a new unit test file if cleaner)

**Interfaces:**
- `valueItems` behavior is unchanged: same inputs, same outputs. Observable only through number of `getUsdValue` calls.

- [ ] **Step 1: Write the failing unit test**

Create `backend/tests/amlValueItems.test.js`:

```js
// amlValueItems.test.js — verifies that valueItems memoizes getUsdValue per cryptoId.
jest.mock('../modules/aml/amlValuation', () => ({ getUsdValue: jest.fn() }));
const valuation = require('../modules/aml/amlValuation');
const { valueItems } = require('../modules/aml/amlEvaluator');

describe('valueItems memoization', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls getUsdValue once per unique cryptoId, not once per item', async () => {
    valuation.getUsdValue.mockResolvedValue({ usd: '100', priceAsOf: new Date(), source: 'pair' });
    const items = [
      { cryptoId: 'btc', amount: '1' },
      { cryptoId: 'btc', amount: '2' }, // same cryptoId → should reuse cached result
      { cryptoId: 'eth', amount: '0.5' },
    ];
    const result = await valueItems(items);
    expect(valuation.getUsdValue).toHaveBeenCalledTimes(2); // btc + eth, not 3
    expect(result.valuedUsds).toHaveLength(3); // all 3 items valued
    expect(result.unvaluable).toBe(0);
  });

  test('a null usd result is cached too (no retry for unvaluable assets)', async () => {
    valuation.getUsdValue.mockResolvedValue({ usd: null, priceAsOf: null, source: 'unknown' });
    const items = [{ cryptoId: 'doge', amount: '1000' }, { cryptoId: 'doge', amount: '500' }];
    const result = await valueItems(items);
    expect(valuation.getUsdValue).toHaveBeenCalledTimes(1);
    expect(result.unvaluable).toBe(2);
  });
});
```

- [ ] **Step 2: Export `valueItems` from `amlEvaluator.js` (needed for the test)**

In `module.exports`:
```js
module.exports = { evaluate, utcDay, valueItems };
```

- [ ] **Step 3: Run the test to confirm it fails**

```
npm test -- --testPathPattern=amlValueItems
```
Expected: FAIL — `getUsdValue` called 3 times, not 2

- [ ] **Step 4: Add memoization to `valueItems` in `amlEvaluator.js`**

Replace the `valueItems` function body:

```js
async function valueItems(items) {
  let sumUsd = '0';
  const valuedUsds = [];
  const unvaluableCryptoIds = [];
  const cache = new Map(); // memoize per cryptoId within this call
  for (const it of items) {
    if (!cache.has(it.cryptoId)) {
      cache.set(it.cryptoId, await valuation.getUsdValue(it.cryptoId, '1'));
    }
    const { usd: unitUsd } = cache.get(it.cryptoId);
    if (unitUsd === null) { unvaluableCryptoIds.push(it.cryptoId); continue; }
    // Scale the unit price by the actual amount.
    const usd = money.multiply(unitUsd, String(it.amount));
    valuedUsds.push(usd);
    sumUsd = money.add(sumUsd, usd);
  }
  return { sumUsd, valuedUsds, unvaluable: unvaluableCryptoIds.length, unvaluableCryptoIds };
}
```

> **Important:** The cache now stores the *unit* price (`amount='1'`) and scales per item. This avoids calling `getUsdValue(cryptoId, amount)` with each item's specific amount — price lookup is independent of amount.

- [ ] **Step 5: Run the new test + the full suite**

```
npm test && npm run test:integration
```
Expected: all green, including the new memoization test.

- [ ] **Step 6: Commit**

```
git add backend/modules/aml/amlEvaluator.js backend/tests/amlValueItems.test.js
git commit -m "perf(aml): memoize getUsdValue per cryptoId inside valueItems"
```

---

### Task 5: Correctness fixes — S2 `count` floor + payload validation guard

Two small correctness items: (a) S2's `count` parameter should be treated as an integer (a non-integer threshold config value would produce incorrect structuring detection); (b) missing payload fields in an event can propagate as `undefined` into signal logic — guard at the evaluator entry point.

**Files:**
- Modify: `backend/modules/aml/signals/s2.js`
- Modify: `backend/modules/aml/amlEvaluator.js`
- Modify: `backend/tests/amlSignalsS3S4.test.js` → add S2 floor test to `amlSignalsS1S2S6.test.js`
- Modify: `backend/tests/amlSignalsS1S2S6.test.js`

**Interfaces:** No change to existing exported signatures.

- [ ] **Step 1: Add S2 floor test**

In `backend/tests/amlSignalsS1S2S6.test.js`, inside the existing S2 describe block, add:

```js
test('a non-integer count config is floored (3.9 → 3, not 4)', () => {
  // Three matched withdrawals with count=3.9 — should still fire (floor → 3 required).
  const result = s2({ withdrawalUsds: ['9000', '9000', '9000'], thresholdUsd: 10000, count: 3.9 });
  expect(result).not.toBeNull();
  expect(result.evidence.matched).toBe(3);
});
```

- [ ] **Step 2: Run to confirm it fails (3 < 3.9 so matched < count → null)**

```
npm test -- --testPathPattern=amlSignalsS1S2S6
```
Expected: FAIL

- [ ] **Step 3: Add `Math.floor` to S2**

In `backend/modules/aml/signals/s2.js`, change:

```js
// before:
if (matched.length < count) return null;

// after:
if (matched.length < Math.floor(count)) return null;
```

- [ ] **Step 4: Run S2 tests — should pass**

```
npm test -- --testPathPattern=amlSignalsS1S2S6
```
Expected: PASS

- [ ] **Step 5: Write failing test for payload validation guard**

In `backend/tests/amlSignalsS1S2S6.test.js` (or a new `amlEvaluatorGuard.test.js`), add:

```js
// amlEvaluatorGuard.test.js
jest.mock('../modules/aml/amlConfig', () => ({ isMonitoringEnabled: jest.fn(), getThreshold: jest.fn() }));
jest.mock('../modules/aml/amlDataAccess', () => ({
  confirmedDepositsInWindow: jest.fn(), withdrawalsInWindow: jest.fn(),
  p2pCompletedCountBetween: jest.fn(), onchainMovementsInWindow: jest.fn(),
  userProfile: jest.fn(),
}));
jest.mock('../modules/aml/amlValuation', () => ({ getUsdValue: jest.fn() }));
const evaluator = require('../modules/aml/amlEvaluator');

describe('amlEvaluator payload validation', () => {
  test('WithdrawalTransmitted with missing userId returns empty results (no crash)', async () => {
    // No mocking needed — guard fires before any DA call
    const results = await evaluator.evaluate({ type: 'WithdrawalTransmitted', payload: { cryptoId: 'c1', amount: '1' } });
    expect(results).toEqual([]);
  });

  test('P2PTransactionCompleted with missing buyerId returns empty results', async () => {
    const results = await evaluator.evaluate({ type: 'P2PTransactionCompleted', payload: { sellerId: 's1', transaction: { id: 't1' } } });
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 6: Run to confirm it fails (currently crashes or calls DA with undefined)**

```
npm test -- --testPathPattern=amlEvaluatorGuard
```
Expected: FAIL (likely a TypeError or unexpected DA call)

- [ ] **Step 7: Add guard at the top of `evaluate` in `amlEvaluator.js`**

Right after `const p = event.payload || {};`, add:

```js
// Guard: a malformed event (missing key fields) must not crash signal logic or
// produce false cases. Return empty rather than propagating undefined through
// money.multiply / dedupeKey string interpolation.
if (event.type === 'WithdrawalTransmitted' || event.type === 'DepositConfirmed') {
  if (!p.userId || !p.cryptoId || p.amount == null) return results;
}
if (event.type === 'P2PTransactionCompleted') {
  if (!p.buyerId || !p.sellerId) return results;
}
```

- [ ] **Step 8: Run the guard tests + full suite**

```
npm test && npm run test:integration
```
Expected: all green

- [ ] **Step 9: Commit**

```
git add backend/modules/aml/signals/s2.js backend/modules/aml/amlEvaluator.js backend/tests/amlSignalsS1S2S6.test.js backend/tests/amlEvaluatorGuard.test.js
git commit -m "fix(aml): S2 count floor + payload validation guard in evaluator"
```

---

### Task 6: Extract `PeriodicJob` base class from the four periodic jobs

`reconciliation.job.js`, `amlSweep.job.js`, `outboxPublisher.job.js`, and `idempotencyCleanup.job.js` are structurally identical: `{ interval, isRunning, running-guard, start/stop/run/getStatus }`. Extract the shared skeleton into `backend/jobs/periodicJob.js`. Each subclass overrides `doWork()` and extends `getStatus()`.

**Files:**
- Create: `backend/jobs/periodicJob.js`
- Modify: `backend/jobs/reconciliation.job.js`
- Modify: `backend/jobs/amlSweep.job.js`
- Modify: `backend/jobs/outboxPublisher.job.js`
- Modify: `backend/jobs/idempotencyCleanup.job.js`
- Modify: `backend/tests/amlSweepJob.test.js` (should pass unchanged — verify)

**Interfaces:**
- `PeriodicJob(frequencyMs, name)` — base constructor
- `doWork()` — abstract; subclasses override; must return a Promise
- `start()`, `stop()`, `run()` — implemented in base
- `getStatus()` → `{ isRunning, frequencyMs, lastRunAt, lastError }` — base; subclasses spread-extend

- [ ] **Step 1: Write the failing unit test for `PeriodicJob`**

Create `backend/tests/periodicJob.test.js`:

```js
const PeriodicJob = require('../jobs/periodicJob');

describe('PeriodicJob base class', () => {
  let job;
  beforeEach(() => {
    job = new PeriodicJob(1000, 'test');
    job.doWork = jest.fn().mockResolvedValue('ok');
  });
  afterEach(() => job.stop());

  test('not running before start', () => {
    expect(job.getStatus().isRunning).toBe(false);
    expect(job.getStatus().lastRunAt).toBeNull();
  });

  test('run() calls doWork and records lastRunAt', async () => {
    await job.run();
    expect(job.doWork).toHaveBeenCalledTimes(1);
    expect(job.getStatus().lastRunAt).toBeInstanceOf(Date);
    expect(job.getStatus().lastError).toBeNull();
  });

  test('re-entrancy guard: concurrent run() is skipped', async () => {
    let release;
    job.doWork.mockImplementation(() => new Promise(res => { release = res; }));
    const first = job.run();
    await job.run(); // skipped
    expect(job.doWork).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  test('a doWork throw is caught and recorded in lastError', async () => {
    job.doWork.mockRejectedValue(new Error('boom'));
    await expect(job.run()).resolves.toBeUndefined();
    expect(job.getStatus().lastError).toBe('boom');
  });

  test('start() → stop() lifecycle works', () => {
    jest.useFakeTimers();
    job.start();
    expect(job.getStatus().isRunning).toBe(true);
    job.stop();
    expect(job.getStatus().isRunning).toBe(false);
    jest.useRealTimers();
  });

  test('start() is idempotent (double start does not double-schedule)', () => {
    jest.useFakeTimers();
    job.start(); job.start();
    expect(job.doWork).toHaveBeenCalledTimes(1); // only one eager run
    job.stop();
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```
npm test -- --testPathPattern=periodicJob
```
Expected: FAIL — `PeriodicJob` not found

- [ ] **Step 3: Create `backend/jobs/periodicJob.js`**

```js
// jobs/periodicJob.js
// Base class for periodic jobs: handles the interval/re-entrancy-guard/lifecycle
// skeleton. Subclasses override doWork() and may extend getStatus().
class PeriodicJob {
  constructor(frequencyMs, name) {
    this.frequencyMs = frequencyMs;
    this.name = name;
    this.interval = null;
    this.isRunning = false;
    this._running = false; // re-entrancy guard
    this.lastRunAt = null;
    this.lastError = null;
  }

  // Subclasses must override this. Must return a Promise.
  async doWork() {
    throw new Error(`${this.name}: doWork() not implemented`);
  }

  start() {
    if (this.isRunning) return;
    this.run();
    this.interval = setInterval(() => this.run(), this.frequencyMs);
    this.isRunning = true;
    console.log(`✅ ${this.name} started`);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
  }

  async run() {
    if (this._running) {
      console.warn(`[${this.name}] previous pass still running, skipping this tick`);
      return;
    }
    this._running = true;
    this.lastRunAt = new Date();
    try {
      await this.doWork();
      this.lastError = null;
    } catch (err) {
      this.lastError = err.message;
      console.error(`❌ ${this.name} error:`, err.message);
    } finally {
      this._running = false;
    }
  }

  getStatus() {
    return { isRunning: this.isRunning, frequencyMs: this.frequencyMs, lastRunAt: this.lastRunAt, lastError: this.lastError };
  }
}

module.exports = PeriodicJob;
```

- [ ] **Step 4: Run the PeriodicJob unit test — should pass**

```
npm test -- --testPathPattern=periodicJob
```
Expected: PASS

- [ ] **Step 5: Refactor `amlSweep.job.js` to extend `PeriodicJob`**

```js
const PeriodicJob = require('./periodicJob');
const amlSweep = require('../modules/aml/amlSweep');

const n = v => (Number(v) > 0 ? Number(v) : 30 * 60 * 1000);
const FREQUENCY_MS = n(process.env.AML_SWEEP_INTERVAL_MS);

class AmlSweepJob extends PeriodicJob {
  constructor() {
    super(FREQUENCY_MS, 'AML Sweep Job');
    this.lastResult = null;
  }

  async doWork() {
    this.lastResult = await amlSweep.runSweep();
  }

  getStatus() {
    return { ...super.getStatus(), lastResult: this.lastResult };
  }
}

module.exports = new AmlSweepJob();
```

- [ ] **Step 6: Run `amlSweepJob.test.js` — must pass unchanged**

```
npm test -- --testPathPattern=amlSweepJob
```
Expected: all 4 tests PASS (behavior-preserving)

- [ ] **Step 7: Refactor `reconciliation.job.js` to extend `PeriodicJob`**

```js
const PeriodicJob = require('./periodicJob');
const recon = require('../modules/balances/ledger/reconciliation');
const { runReconciliationCheck } = require('../modules/balances/ledger/reconciliationAlarm');

const n = v => (Number(v) > 0 ? Number(v) : 15 * 60 * 1000);
const FREQUENCY_MS = n(process.env.RECONCILIATION_INTERVAL_MS);

class ReconciliationJob extends PeriodicJob {
  constructor() {
    super(FREQUENCY_MS, 'Reconciliation Job');
    this.lastOk = null;
  }

  async doWork() {
    const res = await runReconciliationCheck({
      reconcileInternal: recon.reconcileInternal,
      reconcileExternal: recon.reconcileExternal,
    });
    this.lastOk = res.ok;
  }

  getStatus() {
    return { ...super.getStatus(), lastOk: this.lastOk };
  }
}

module.exports = new ReconciliationJob();
```

- [ ] **Step 8: Refactor `outboxPublisher.job.js` to extend `PeriodicJob`**

```js
const PeriodicJob = require('./periodicJob');
const { Op } = require('sequelize');
const { OutboxEvent } = require('../models');
const eventBus = require('../modules/events/eventBus');
const { computeRetry, publishBatch } = require('../modules/events/outboxPublisher');

const n = (v, d) => (Number(v) > 0 ? Number(v) : d);
const FREQUENCY_MS    = n(process.env.OUTBOX_PUBLISHER_INTERVAL_MS, 2000);
const MAX_ATTEMPTS    = n(process.env.OUTBOX_MAX_ATTEMPTS, 10);
const BATCH_SIZE      = n(process.env.OUTBOX_BATCH_SIZE, 100);
const BASE_BACKOFF_MS = n(process.env.OUTBOX_BASE_BACKOFF_MS, 5000);
const MAX_BACKOFF_MS  = n(process.env.OUTBOX_MAX_BACKOFF_MS, 300000);

class OutboxPublisherJob extends PeriodicJob {
  constructor() { super(FREQUENCY_MS, 'Outbox Publisher Job'); }

  async doWork() {
    const events = await OutboxEvent.findAll({
      where: { status: 'pending', availableAt: { [Op.lte]: new Date() } },
      order: [['created_at', 'ASC']],
      limit: BATCH_SIZE,
    });
    await publishBatch({
      events,
      dispatch: (ev) => eventBus.dispatch(ev),
      markDispatched: (ev) => ev.update({ status: 'dispatched', dispatchedAt: new Date() }),
      markFailed: (ev, next) => {
        if (next.status === 'failed') {
          console.error(`❌ Outbox event ${ev.id} (${ev.type}) dead-lettered after ${next.attempts} attempts: ${next.lastError}`);
        }
        return ev.update(next);
      },
      computeRetryState: (ev, err) => computeRetry(ev, err, { maxAttempts: MAX_ATTEMPTS, baseBackoffMs: BASE_BACKOFF_MS, maxBackoffMs: MAX_BACKOFF_MS, now: Date.now() }),
    });
  }
}

module.exports = new OutboxPublisherJob();
```

- [ ] **Step 9: Refactor `idempotencyCleanup.job.js` to extend `PeriodicJob`**

```js
const PeriodicJob = require('./periodicJob');
const { IdempotencyKey, Sequelize } = require('../models');
const { Op } = Sequelize;

const TTL_MS       = 24 * 60 * 60 * 1000;
const FREQUENCY_MS = 60 * 60 * 1000;

class IdempotencyCleanupJob extends PeriodicJob {
  constructor() { super(FREQUENCY_MS, 'Idempotency Cleanup Job'); }

  async doWork() {
    const cutoff  = new Date(Date.now() - TTL_MS);
    const deleted = await IdempotencyKey.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
    if (deleted > 0) console.log(`🧹 Idempotency cleanup: removed ${deleted} expired keys`);
  }

  getStatus() { return { ...super.getStatus(), ttlMs: TTL_MS }; }
}

module.exports = new IdempotencyCleanupJob();
```

- [ ] **Step 10: Run the full test suite**

```
npm test && npm run test:integration
```
Expected: all green

- [ ] **Step 11: Commit**

```
git add backend/jobs/periodicJob.js backend/jobs/amlSweep.job.js backend/jobs/reconciliation.job.js backend/jobs/outboxPublisher.job.js backend/jobs/idempotencyCleanup.job.js backend/tests/periodicJob.test.js
git commit -m "refactor(jobs): extract PeriodicJob base class (reconciliation, amlSweep, outbox, idempotency)"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Promise.all 3 finders → Task 1 (merged to 2 parallel calls)
- ✅ Merge withdrawal+deposit en Op.or → Task 1 (`recentMoneyTransactions`)
- ✅ N+1 quote lookup en valuación → Task 2
- ✅ Alarma de precio viejo → Task 2
- ✅ Merge userCreatedAt+userDailyLimit → Task 3
- ✅ Memoizar getUsdValue por cryptoId → Task 4
- ✅ S2 count no-entero (Math.floor) → Task 5
- ✅ Validación de payload de eventos → Task 5
- ✅ Base PeriodicJob (4 jobs) → Task 6
- ⚠️ STABLE_SYMBOLS compartido → already exported from `amlValuation.js`, no other consumer found; no change needed
- ⚠️ S1/S6 onchain queries solapadas → windows differ (S1=24h, S6=since-account-creation); requires a rewrite with conditional logic; deferred (marginal gain, high complexity)
- ⚠️ Dedupe por día reabre casos cruzando medianoche → advisory note in memory, not a code bug; deferred

**Placeholder scan:** No TBDs, no "similar to Task N" shortcuts — every task has complete code blocks.

**Type consistency:**
- `recentMoneyTransactions` returns `eventType` string: sweep loops match `'WithdrawalTransmitted'` and `'DepositConfirmed'` — consistent.
- `userProfile` returns `{ createdAt, dailyLimitUsd }`: evaluator destructures exactly those keys — consistent.
- `valueItems` exported in Task 4 `module.exports` is the same function tested — consistent.
- `PeriodicJob.doWork()` is overridden in all 4 subclasses — consistent.
