jest.mock('../modules/aml/denylist.model', () => ({ isDenylisted: jest.fn() }));
const denylist = require('../modules/aml/denylist.model');
const screening = require('../modules/aml/amlScreening');

describe('amlScreening.checkWithdrawal', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns denylisted:false when no match', async () => {
    denylist.isDenylisted.mockResolvedValue(null);
    const r = await screening.checkWithdrawal({ address: '0xabc', network: 'ethereum' });
    expect(r).toEqual({ denylisted: false, match: null });
  });

  test('returns denylisted:true + the match row', async () => {
    const row = { id: 'x', source: 'OFAC' };
    denylist.isDenylisted.mockResolvedValue(row);
    const r = await screening.checkWithdrawal({ address: '0xabc', network: 'ethereum' }, 'TX');
    expect(r).toEqual({ denylisted: true, match: row });
    expect(denylist.isDenylisted).toHaveBeenCalledWith('0xabc', 'ethereum', 'TX');
  });
});
