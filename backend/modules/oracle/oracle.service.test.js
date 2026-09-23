const OracleService = require('./oracle.service');
const AppError = require('../../utils/AppError');

describe('OracleService', () => {
  let mockSources;

  beforeEach(() => {
    mockSources = {
      fetchBinance: jest.fn(),
      fetchCoinbase: jest.fn(),
      fetchCoinGecko: jest.fn()
    };
  });

  it('all three agree -> median returned, reliable: true', async () => {
    mockSources.fetchBinance.mockResolvedValue('60000.00');
    mockSources.fetchCoinbase.mockResolvedValue('60000.00');
    mockSources.fetchCoinGecko.mockResolvedValue('60000.00');

    const service = new OracleService(mockSources);
    const result = await service.getPrice('BTCUSDT');

    expect(result.reliable).toBe(true);
    expect(result.median).toBe('60000.00');
    expect(result.price).toBe('60000.00');
    expect(result.reason).toBeNull();
    expect(result.sources).toHaveLength(3);
    expect(result.sources.every(s => s.ok)).toBe(true);
  });

  it('one outlier within threshold -> median still reliable', async () => {
    // 60000, 60000, 60600. Max spread: (60600 - 60000)/60000 = 0.01 = 1%
    mockSources.fetchBinance.mockResolvedValue('60000');
    mockSources.fetchCoinbase.mockResolvedValue('60000');
    mockSources.fetchCoinGecko.mockResolvedValue('60600');

    const service = new OracleService(mockSources, '2'); // threshold 2%
    const result = await service.getPrice('BTCUSDT');

    expect(result.reliable).toBe(true);
    expect(result.median).toBe('60000'); // middle value
    expect(result.divergencePct).toBe('1'); 
  });

  it('divergence beyond threshold -> reliable: false with reason', async () => {
    // 60000, 60000, 61800. Max spread: (61800 - 60000)/60000 = 0.03 = 3%
    mockSources.fetchBinance.mockResolvedValue('60000');
    mockSources.fetchCoinbase.mockResolvedValue('60000');
    mockSources.fetchCoinGecko.mockResolvedValue('61800');

    const service = new OracleService(mockSources, '2');
    const result = await service.getPrice('BTCUSDT');

    expect(result.reliable).toBe(false);
    expect(result.reason).toContain('Divergence circuit breaker triggered');
    expect(result.reason).toContain('3%');
    expect(result.median).toBe('60000');
  });

  it('one source fails, two succeed -> median from the two, reliable', async () => {
    mockSources.fetchBinance.mockResolvedValue('60000');
    mockSources.fetchCoinbase.mockRejectedValue(new Error('Network error'));
    mockSources.fetchCoinGecko.mockResolvedValue('60600');

    const service = new OracleService(mockSources, '2');
    const result = await service.getPrice('BTCUSDT');

    expect(result.reliable).toBe(true);
    // Average of 60000 and 60600 is 60300
    expect(result.median).toBe('60300');
    expect(result.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Binance', ok: true, price: '60000' }),
      expect.objectContaining({ name: 'Coinbase', ok: false, price: null }),
      expect.objectContaining({ name: 'CoinGecko', ok: true, price: '60600' })
    ]));
  });

  it('rejects a NaN price from a source: excluded, median from the two valid, still reliable', async () => {
    mockSources.fetchBinance.mockResolvedValue('60000');
    mockSources.fetchCoinbase.mockResolvedValue('NaN');
    mockSources.fetchCoinGecko.mockResolvedValue('60600');

    const service = new OracleService(mockSources, '2');
    const result = await service.getPrice('BTCUSDT');

    expect(result.reliable).toBe(true);
    expect(result.median).toBe('60300');
    expect(result.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Coinbase', ok: false })
    ]));
  });

  it('rejects a zero price from a source (would corrupt median / divide-by-zero)', async () => {
    mockSources.fetchBinance.mockResolvedValue('60000');
    mockSources.fetchCoinbase.mockResolvedValue('0');
    mockSources.fetchCoinGecko.mockResolvedValue('60600');

    const service = new OracleService(mockSources, '2');
    const result = await service.getPrice('BTCUSDT');

    expect(result.reliable).toBe(true);
    expect(result.median).toBe('60300');
  });

  it('a bad price that drops valid sources below 2 -> throws ORACLE_UNAVAILABLE (never a garbage reliable price)', async () => {
    mockSources.fetchBinance.mockResolvedValue('60000');
    mockSources.fetchCoinbase.mockResolvedValue('NaN');
    mockSources.fetchCoinGecko.mockResolvedValue('0');

    const service = new OracleService(mockSources, '2');
    await expect(service.getPrice('BTCUSDT')).rejects.toMatchObject({ code: 'ORACLE_UNAVAILABLE' });
  });

  it('two sources fail -> throws typed error', async () => {
    mockSources.fetchBinance.mockResolvedValue('60000');
    mockSources.fetchCoinbase.mockRejectedValue(new Error('Network error'));
    mockSources.fetchCoinGecko.mockRejectedValue(new Error('Timeout'));

    const service = new OracleService(mockSources);

    await expect(service.getPrice('BTCUSDT')).rejects.toThrow(AppError);
    await expect(service.getPrice('BTCUSDT')).rejects.toMatchObject({
      statusCode: 503,
      code: 'ORACLE_UNAVAILABLE'
    });
  });
});
