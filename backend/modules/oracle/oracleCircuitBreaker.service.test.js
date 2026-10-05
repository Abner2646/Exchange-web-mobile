// Unit tests for the oracle circuit breaker that gates the swap price feed.
// No DB / no network: the pair, oracle, event emitter, alert sender and the
// transaction runner are all injected fakes. This pins the money-path policy:
//   - divergent (or unavailable) oracle  -> pause the pair, DO NOT touch price,
//     emit PRICE_ORACLE_DIVERGENCE (atomically) + fire a Telegram alert.
//   - reliable oracle                    -> update currentPrice to the median,
//     unpause, no divergence event/alert.
const { refreshPairFromOracle } = require('./oracleCircuitBreaker.service');

// A fake SwapPair row: records the last update() payload and reflects it back on
// the instance so assertions can read post-update field values.
function makePair(overrides = {}) {
  const pair = {
    id: 'pair-1',
    externalSymbol: 'BTCUSDT',
    currentPrice: '100',
    previousPrice: '90',
    oraclePaused: false,
    // The oracle prices the base in USD, so the breaker only overwrites the price of
    // USD(T)-quoted pairs. Default the fixture to a stable quote.
    quoteCrypto: { symbol: 'USDT' },
    _updates: [],
    async update(fields) {
      this._updates.push(fields);
      Object.assign(this, fields);
      return this;
    },
    ...overrides,
  };
  return pair;
}

// A transaction runner that just invokes the callback with a sentinel tx, so the
// service's atomic update+emit block runs inline.
function makeDeps() {
  const emitted = [];
  const alerts = [];
  return {
    emitted,
    alerts,
    deps: {
      sequelize: { transaction: (cb) => cb('TX') },
      emitEvent: async (type, payload, opts) => { emitted.push({ type, payload, opts }); },
      sendAlert: async (a) => { alerts.push(a); },
    },
  };
}

describe('oracleCircuitBreaker.refreshPairFromOracle', () => {
  it('pauses the pair and leaves the price untouched when the oracle is divergent', async () => {
    const pair = makePair({ currentPrice: '100' });
    const { deps, emitted, alerts } = makeDeps();
    const oracleService = {
      getPrice: async () => ({
        symbol: 'BTCUSDT', price: '101', median: '101',
        divergencePct: '3.2', reliable: false, reason: 'divergence > 1.5%',
      }),
    };

    const outcome = await refreshPairFromOracle(pair, { ...deps, oracleService });

    expect(outcome.action).toBe('paused');
    expect(pair.oraclePaused).toBe(true);
    // Price must NOT move while divergent — that is the whole point of the breaker.
    expect(pair.currentPrice).toBe('100');
    expect(emitted).toHaveLength(1);
    expect(emitted[0].type).toBe('PRICE_ORACLE_DIVERGENCE');
    expect(emitted[0].opts.transaction).toBe('TX'); // emitted inside the tx
    expect(alerts).toHaveLength(1);
    expect(alerts[0].code).toBe('PRICE_ORACLE_DIVERGENCE');
    expect(alerts[0].severity).toBe('critical');
  });

  it('updates currentPrice to the median and unpauses when the oracle is reliable', async () => {
    const pair = makePair({ currentPrice: '100', oraclePaused: false });
    const { deps, emitted, alerts } = makeDeps();
    const oracleService = {
      getPrice: async () => ({
        symbol: 'BTCUSDT', price: '105.5', median: '105.5',
        divergencePct: '0.3', reliable: true, reason: null,
      }),
    };

    const outcome = await refreshPairFromOracle(pair, { ...deps, oracleService });

    expect(outcome.action).toBe('updated');
    expect(pair.oraclePaused).toBe(false);
    expect(pair.currentPrice).toBe('105.5');
    expect(pair.previousPrice).toBe('100'); // old price rolled into previous
    expect(emitted).toHaveLength(0);
    expect(alerts).toHaveLength(0);
  });

  it('fails safe: pauses when the oracle throws (insufficient sources)', async () => {
    const pair = makePair({ currentPrice: '100' });
    const { deps, emitted, alerts } = makeDeps();
    const oracleService = {
      getPrice: async () => { throw new Error('Insufficient oracle sources available'); },
    };

    const outcome = await refreshPairFromOracle(pair, { ...deps, oracleService });

    expect(outcome.action).toBe('paused');
    expect(pair.oraclePaused).toBe(true);
    expect(pair.currentPrice).toBe('100');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].code).toBe('PRICE_ORACLE_DIVERGENCE');
  });

  it('skips a pair with no externalSymbol (manual-priced pairs are untouched)', async () => {
    const pair = makePair({ externalSymbol: null });
    const { deps, emitted, alerts } = makeDeps();
    const oracleService = { getPrice: jest.fn() };

    const outcome = await refreshPairFromOracle(pair, { ...deps, oracleService });

    expect(outcome.action).toBe('skipped');
    expect(oracleService.getPrice).not.toHaveBeenCalled();
    expect(pair._updates).toHaveLength(0);
    expect(emitted).toHaveLength(0);
  });

  it('skips a pair whose quote is NOT a USD-stable (oracle median is USD, would corrupt the price)', async () => {
    const pair = makePair({ quoteCrypto: { symbol: 'BTC' } });
    const { deps, emitted, alerts } = makeDeps();
    const oracleService = { getPrice: jest.fn() };

    const outcome = await refreshPairFromOracle(pair, { ...deps, oracleService });

    expect(outcome.action).toBe('skipped');
    expect(oracleService.getPrice).not.toHaveBeenCalled();
    expect(pair._updates).toHaveLength(0);
  });

  it('alerts (info) when a previously-paused pair recovers', async () => {
    const pair = makePair({ oraclePaused: true, currentPrice: '100' });
    const { deps, emitted, alerts } = makeDeps();
    const oracleService = {
      getPrice: async () => ({
        symbol: 'BTCUSDT', price: '105', median: '105',
        divergencePct: '0.2', reliable: true, reason: null,
      }),
    };

    const outcome = await refreshPairFromOracle(pair, { ...deps, oracleService });

    expect(outcome.action).toBe('updated');
    expect(outcome.recovered).toBe(true);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('info');
  });

  it('does not re-emit/re-alert when an already-paused pair stays divergent (no alert storm)', async () => {
    const pair = makePair({ oraclePaused: true, currentPrice: '100' });
    const { deps, emitted, alerts } = makeDeps();
    const oracleService = {
      getPrice: async () => ({
        symbol: 'BTCUSDT', price: '101', median: '101',
        divergencePct: '3.2', reliable: false, reason: 'divergence > 1.5%',
      }),
    };

    const outcome = await refreshPairFromOracle(pair, { ...deps, oracleService });

    expect(outcome.action).toBe('already_paused');
    expect(pair.oraclePaused).toBe(true);
    expect(emitted).toHaveLength(0);
    expect(alerts).toHaveLength(0);
  });
});
