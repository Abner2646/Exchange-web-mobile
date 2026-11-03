'use client';

import { useMemo, useState } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Badge, Button, CoinLogo, Dialog, EmptyState, ErrorState, Skeleton } from '@/shared/ui';
import { useMyOffers, useToggleOffer, useDeleteOffer, useCryptoCatalog } from '../queries';
import type { Offer } from '../types';
import styles from './p2p.module.css';

export function MyOffersView() {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();

  const { data: offers, isLoading, isError, refetch } = useMyOffers();
  const { data: cryptos } = useCryptoCatalog();

  const toggleOffer = useToggleOffer();
  const deleteOffer = useDeleteOffer();

  // Any mutation in-flight → lock all buttons (no double-fire).
  const anyPending = toggleOffer.isPending || deleteOffer.isPending;

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function handleConfirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    deleteOffer.mutate(id);
  }

  const symbolMap = useMemo(() => {
    const map = new Map<string, string>();
    (cryptos ?? []).forEach((c) => map.set(c.id, c.symbol));
    return map;
  }, [cryptos]);
  const resolveSymbol = (cryptoId: string): string => symbolMap.get(cryptoId) ?? cryptoId.slice(0, 8);

  const activeError = toggleOffer.error ?? deleteOffer.error ?? null;
  const fmt = (v: string) => formatDisplay(v, { locale, maxDecimals: 8, stripTrailingZeros: true });

  // ─── Render states ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div role="status" aria-label={t('common.loading')}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skelRow}>
            <Skeleton variant="circle" width={22} height={22} />
            <Skeleton variant="text" width="25%" />
            <Skeleton variant="text" width={90} />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState title={t('p2p.myOffers.error')} onRetry={() => refetch()} retryLabel={t('common.retry')} />;
  }

  const allOffers: Offer[] = offers ?? [];

  if (allOffers.length === 0) {
    return <EmptyState title={t('p2p.myOffers.empty')} message={t('p2p.myOffers.emptyHint')} />;
  }

  return (
    <section>
      {activeError && (
        <p role="alert" className={styles.alert}>
          {tError(activeError.code ?? 'FALLBACK_UNKNOWN_ERROR', { requestId: activeError.requestId ?? '' })}
        </p>
      )}

      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('p2p.offers.type')}</th>
            <th>{t('p2p.offers.asset')}</th>
            <th>{t('p2p.offers.price')}</th>
            <th>{t('p2p.offers.range')}</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {allOffers.map((offer) => {
            const symbol = resolveSymbol(offer.cryptoId);
            return (
              <tr key={offer.id} data-offer-id={offer.id}>
                <td>
                  <Badge tone={offer.type === 'buy' ? 'success' : 'error'}>
                    {t(offer.type === 'buy' ? 'p2p.offers.typeBuy' : 'p2p.offers.typeSell')}
                  </Badge>
                </td>
                <td>
                  <span className={styles.coinCell}>
                    <CoinLogo symbol={symbol} size={22} />
                    <span className={styles.coinSym}>{symbol}</span>
                  </span>
                </td>
                <td className={styles.num}>{fmt(offer.unitPrice)} {offer.fiatCurrency}</td>
                <td className={styles.range}>{fmt(offer.minAmount)}–{fmt(offer.maxAmount)}</td>
                <td>
                  <Button
                    type="button"
                    variant={offer.active ? 'primary' : 'secondary'}
                    size="small"
                    onClick={() => toggleOffer.mutate({ id: offer.id, active: !offer.active })}
                    disabled={anyPending}
                    loading={toggleOffer.isPending}
                  >
                    {t(offer.active ? 'p2p.myOffers.toggleActive' : 'p2p.myOffers.toggleInactive')}
                  </Button>
                </td>
                <td>
                  <Button
                    type="button"
                    variant="danger"
                    size="small"
                    onClick={() => setPendingDeleteId(offer.id)}
                    disabled={anyPending}
                    loading={deleteOffer.isPending && pendingDeleteId === offer.id}
                  >
                    {t('p2p.myOffers.deactivate')}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Dialog
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        title={t('p2p.myOffers.deactivateTitle')}
        closeOnClickOutside={false}
      >
        <p>{t('p2p.myOffers.deactivateConfirm')}</p>
        <div className={styles.actions}>
          <Button onClick={handleConfirmDelete} loading={deleteOffer.isPending} disabled={anyPending}>
            {t('common.submit')}
          </Button>
          <Button variant="secondary" onClick={() => setPendingDeleteId(null)} disabled={anyPending}>
            {t('common.cancel')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
