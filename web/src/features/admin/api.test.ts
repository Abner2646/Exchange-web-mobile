import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/shared/api';
import { adminApi } from './api';

vi.mock('@/shared/api', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
const m = apiClient as unknown as Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => vi.clearAllMocks());

describe('adminApi', () => {
  it('governance: pending/readiness/approve(codigo)/reject(reason)', async () => {
    m.get.mockResolvedValue({ pending: [] });
    await adminApi.getPending();
    expect(m.get).toHaveBeenCalledWith('/governance/pending');
    await adminApi.getReadiness();
    expect(m.get).toHaveBeenCalledWith('/governance/readiness');
    m.post.mockResolvedValue({});
    await adminApi.approveAction('id1', { codigo: '123456' });
    expect(m.post).toHaveBeenCalledWith('/governance/id1/approve', { codigo: '123456' });
    await adminApi.rejectAction('id1', { reason: 'nope' });
    expect(m.post).toHaveBeenCalledWith('/governance/id1/reject', { reason: 'nope' });
  });
  it('config: list / upsert', async () => {
    m.get.mockResolvedValue({ data: [] });
    await adminApi.getConfig('fees');
    expect(m.get).toHaveBeenCalledWith('/config?category=fees');
    m.put.mockResolvedValue({ data: {} });
    await adminApi.upsertConfig('swap.fee_bps', { value: '30', type: 'number' });
    expect(m.put).toHaveBeenCalledWith('/config/swap.fee_bps', { value: '30', type: 'number' });
  });
  it('aml: config/denylist/cases', async () => {
    m.get.mockResolvedValue({});
    await adminApi.getAmlConfig();
    expect(m.get).toHaveBeenCalledWith('/aml/config');
    m.put.mockResolvedValue({});
    await adminApi.setAmlConfig('aml.monitoring_enabled', 'true');
    expect(m.put).toHaveBeenCalledWith('/aml/config/aml.monitoring_enabled', { value: 'true' });
    m.post.mockResolvedValue({});
    await adminApi.addDenylist({ address: '0xabc', network: 'ETH' });
    expect(m.post).toHaveBeenCalledWith('/aml/denylist', { address: '0xabc', network: 'ETH' });
    m.delete.mockResolvedValue({});
    await adminApi.removeDenylist('d1');
    expect(m.delete).toHaveBeenCalledWith('/aml/denylist/d1');
    m.get.mockResolvedValue([]);
    await adminApi.getCases('open');
    expect(m.get).toHaveBeenCalledWith('/aml/cases?status=open');
    m.put.mockResolvedValue({});
    await adminApi.resolveCase('c1', { decision: 'approve' });
    expect(m.put).toHaveBeenCalledWith('/aml/cases/c1/resolve', { decision: 'approve' });
  });
  it('users: list/search + privileged mutations route to exact paths', async () => {
    m.get.mockResolvedValue([]);
    await adminApi.listUsers();
    expect(m.get).toHaveBeenCalledWith('/user');
    await adminApi.searchUsers('a@b.co');
    expect(m.get).toHaveBeenCalledWith('/user/search?q=a%40b.co');
  });
  it('audit: list with query + verify', async () => {
    m.get.mockResolvedValue({ rows: [], nextBeforeId: null });
    await adminApi.getAudit({ eventType: 'x', limit: 25 });
    expect(m.get).toHaveBeenCalledWith('/audit?eventType=x&limit=25');
    m.get.mockResolvedValue({ ok: true });
    await adminApi.verifyAudit();
    expect(m.get).toHaveBeenCalledWith('/audit/verify');
  });
});
