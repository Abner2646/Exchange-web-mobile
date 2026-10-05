// The job is a thin PeriodicJob wrapper; verify doWork delegates to the breaker
// sweep and surfaces its result in getStatus. The breaker policy itself is covered
// by oracleCircuitBreaker.service.test.js.
jest.mock('../modules/oracle/oracleCircuitBreaker.service', () => ({
  sweep: jest.fn(),
}));

const oracleCircuitBreaker = require('../modules/oracle/oracleCircuitBreaker.service');
const job = require('./oracleBreaker.job');

describe('OracleBreakerJob', () => {
  afterEach(() => jest.clearAllMocks());

  it('doWork runs the breaker sweep and stores the result', async () => {
    const result = { total: 2, updated: 1, paused: 1, alreadyPaused: 0, skipped: 0, errors: 0 };
    oracleCircuitBreaker.sweep.mockResolvedValue(result);

    await job.doWork();

    expect(oracleCircuitBreaker.sweep).toHaveBeenCalledTimes(1);
    expect(job.getStatus().lastResult).toEqual(result);
  });
});
