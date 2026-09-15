jest.mock('../modules/aml/amlSweep', () => ({ runSweep: jest.fn() }));
const amlSweep = require('../modules/aml/amlSweep');
const job = require('../jobs/amlSweep.job');

describe('amlSweep.job', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => job.stop());

  test('getStatus reports not-running before start', () => {
    expect(job.getStatus().isRunning).toBe(false);
  });

  test('run() invokes runSweep and records the last run', async () => {
    amlSweep.runSweep.mockResolvedValue({ scanned: 2, byType: {} });
    await job.run();
    expect(amlSweep.runSweep).toHaveBeenCalledTimes(1);
    expect(job.getStatus().lastRunAt).toBeInstanceOf(Date);
  });

  test('run() re-entrancy guard: a second run while one is in flight is skipped', async () => {
    let release;
    amlSweep.runSweep.mockImplementation(() => new Promise((res) => { release = res; }));
    const first = job.run();       // starts, holds
    await job.run();               // should skip (guard)
    expect(amlSweep.runSweep).toHaveBeenCalledTimes(1);
    release({ scanned: 0, byType: {} });
    await first;
  });

  test('a runSweep throw is caught (run does not reject)', async () => {
    amlSweep.runSweep.mockRejectedValue(new Error('boom'));
    await expect(job.run()).resolves.toBeUndefined();
  });
});
