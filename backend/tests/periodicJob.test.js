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
