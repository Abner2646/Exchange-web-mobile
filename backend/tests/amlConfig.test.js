jest.mock('../modules/config/businessConfig', () => ({
  getBoolean: jest.fn(),
  getNumber: jest.fn(),
}));
const businessConfig = require('../modules/config/businessConfig');
const amlConfig = require('../modules/aml/amlConfig');

describe('amlConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  test('monitoring + hold enforcement default to false when unseeded', async () => {
    businessConfig.getBoolean.mockImplementation(async (_k, fallback) => fallback);
    expect(await amlConfig.isMonitoringEnabled()).toBe(false);
    expect(await amlConfig.isHoldEnforcementEnabled()).toBe(false);
    expect(businessConfig.getBoolean).toHaveBeenCalledWith('aml.monitoring.enabled', false);
    expect(businessConfig.getBoolean).toHaveBeenCalledWith('aml.holdEnforcement.enabled', false);
  });

  test('reflects a seeded true value', async () => {
    businessConfig.getBoolean.mockResolvedValue(true);
    expect(await amlConfig.isMonitoringEnabled()).toBe(true);
  });

  test('getThreshold passes the provided fallback through to getNumber', async () => {
    businessConfig.getNumber.mockImplementation(async (_k, fallback) => fallback);
    expect(await amlConfig.getThreshold('aml.s2.count', 5)).toBe(5);
    expect(businessConfig.getNumber).toHaveBeenCalledWith('aml.s2.count', 5);
  });
});
