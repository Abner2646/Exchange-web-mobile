import { describe, it, expect } from 'vitest';
import { en } from '@/shared/i18n/catalogs/en';
import { es } from '@/shared/i18n/catalogs/es';

const UI_KEYS = [
  'wallet.title', 'wallet.tab.balances', 'wallet.tab.deposit', 'wallet.tab.withdraw', 'wallet.tab.history',
  'wallet.balances.crypto', 'wallet.balances.available', 'wallet.balances.blocked', 'wallet.balances.pending',
  'wallet.balances.funding', 'wallet.balances.spot', 'wallet.balances.empty', 'wallet.balances.pendingHint',
  'wallet.transfer.title', 'wallet.transfer.from', 'wallet.transfer.to', 'wallet.transfer.amount',
  'wallet.transfer.submit', 'wallet.transfer.success', 'wallet.transfer.sameCompartment', 'wallet.transfer.insufficient',
  'wallet.deposit.title', 'wallet.deposit.selectCrypto', 'wallet.deposit.address', 'wallet.deposit.copy',
  'wallet.deposit.copied', 'wallet.deposit.confirmations', 'wallet.deposit.network',
  'wallet.withdraw.title', 'wallet.withdraw.crypto', 'wallet.withdraw.amount', 'wallet.withdraw.address',
  'wallet.withdraw.submit', 'wallet.withdraw.fundingOnly', 'wallet.withdraw.queued',
  'wallet.history.title', 'wallet.history.empty', 'wallet.history.type', 'wallet.history.status',
  'wallet.history.amount', 'wallet.history.date', 'wallet.history.confirmations',
  'wallet.history.filterAll', 'wallet.history.filterDeposit', 'wallet.history.filterWithdrawal',
];
const ERROR_CODES = [
  'WITHDRAWAL_VALIDATION_FAILED', 'WITHDRAWAL_INVALID_ADDRESS',
  'DEPOSIT_CRYPTO_NOT_FOUND', 'DEPOSIT_ADDRESS_GENERATION_FAILED',
];

describe('wallet i18n coverage', () => {
  it.each(UI_KEYS)('en+es define ui key %s non-empty', (k) => {
    expect(en.ui[k]).toBeTruthy();
    expect(es.ui[k]).toBeTruthy();
  });
  it.each(ERROR_CODES)('en+es define error code %s non-empty', (c) => {
    expect(en.errors[c]).toBeTruthy();
    expect(es.errors[c]).toBeTruthy();
  });
  it('en and es ui key sets are identical', () => {
    expect(Object.keys(en.ui).sort()).toEqual(Object.keys(es.ui).sort());
  });
  it('en and es error code sets are identical', () => {
    expect(Object.keys(en.errors).sort()).toEqual(Object.keys(es.errors).sort());
  });
});
