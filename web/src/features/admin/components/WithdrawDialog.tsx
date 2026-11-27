'use client';

// Withdrawal dialog for the (honeypot-only) Treasury surface. Used both for a treasury send and
// for a per-user "force withdrawal". Every submission comes back as PENDING — nothing ever
// moves; the whole point is to capture the attacker's destination wallet. Only ever rendered in
// the fake panel (gated upstream by the backend `treasuryEnabled` flag).
import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { Button, Input, Dialog } from '@/shared/ui';
import { useSubmitWithdrawal, useForceUserWithdrawal } from '../queries';
import type { WithdrawResult } from '../types';
import styles from './admin.module.css';

export function WithdrawDialog({ isOpen, onClose, userId, title }: { isOpen: boolean; onClose: () => void; userId?: string; title?: string }) {
  const { t } = useTranslation();
  const [crypto, setCrypto] = useState('BTC');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const treasuryMut = useSubmitWithdrawal();
  const userMut = useForceUserWithdrawal();
  const isPending = treasuryMut.isPending || userMut.isPending;

  const reset = () => { setCrypto('BTC'); setDestinationAddress(''); setAmount(''); setPending(null); };
  const close = () => { reset(); onClose(); };

  const submit = () => {
    const body = { crypto, destinationAddress, amount };
    const opts = { onSuccess: (r: WithdrawResult) => setPending(r?.message || t('admin.treasury.pending')) };
    if (userId) userMut.mutate({ userId, body }, opts);
    else treasuryMut.mutate(body, opts);
  };

  return (
    <Dialog isOpen={isOpen} onClose={close} title={title || t('admin.treasury.newWithdrawal')} closeOnClickOutside={!isPending}>
      {pending ? (
        <div className={styles.treasuryPending} role="status">
          <strong>⏳ {t('admin.treasury.pendingTitle')}</strong>
          <p>{pending}</p>
          <div className={styles.dialogActions}>
            <Button variant="secondary" onClick={close}>{t('admin.treasury.closeCta')}</Button>
          </div>
        </div>
      ) : (
        <div className={styles.treasuryForm}>
          <label className={styles.treasuryField}>
            <span>{t('admin.treasury.crypto')}</span>
            <select value={crypto} onChange={(e) => setCrypto(e.target.value)} className={styles.treasurySelect} aria-label={t('admin.treasury.crypto')}>
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
              <option value="USDT">USDT</option>
            </select>
          </label>
          <label className={styles.treasuryField}>
            <span>{t('admin.treasury.destination')}</span>
            <Input type="text" value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} placeholder="bc1q… / 0x…" aria-label={t('admin.treasury.destination')} />
          </label>
          <label className={styles.treasuryField}>
            <span>{t('admin.treasury.amount')}</span>
            <Input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-label={t('admin.treasury.amount')} />
          </label>
          <div className={styles.dialogActions}>
            <Button variant="secondary" onClick={close} disabled={isPending}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={submit} disabled={isPending || !destinationAddress || !amount} loading={isPending}>{t('admin.treasury.submit')}</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
