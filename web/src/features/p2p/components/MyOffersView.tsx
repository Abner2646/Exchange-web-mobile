'use client';

import { useMemo, useState } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Dialog } from '@/shared/ui';
import { useMyOffers, useToggleOffer, useDeleteOffer, useCryptoCatalog } from '../queries';
import type { Offer } from '../types';
import styles from './p2p.module.css';

// ─── Component ────────────────────────────────────────────────────────────────

export function MyOffersView() {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();

  // ── Data hooks ────────────────────────────────────────────────────────────
  const { data: offers, isLoading, isError } = useMyOffers();
  const { data: cryptos } = useCryptoCatalog();

  // ── Mutation hooks ────────────────────────────────────────────────────────
  const toggleOffer = useToggleOffer();
  const deleteOffer = useDeleteOffer();

  // Any mutation in-flight → lock all buttons (no double-fire).
  const anyPending = toggleOffer.isPending || deleteOffer.isPending;

  // ── Dialog state (which offer is pending deactivation) ────────────────────
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function openDeleteDialog(id: string) {
    setPendingDeleteId(id);
  }

  function closeDeleteDialog() {
    setPendingDeleteId(null);
  }

  function handleConfirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    closeDeleteDialog();
    deleteOffer.mutate(id);
  }

  // ── Crypto symbol resolution ──────────────────────────────────────────────
  const symbolMap = useMemo(() => {
    const map = new Map<string, string>();
    (cryptos ?? []).forEach((c) => map.set(c.id, c.symbol));
    return map;
  }, [cryptos]);

  const resolveSymbol = (cryptoId: string): string =>
    symbolMap.get(cryptoId) ?? cryptoId.slice(0, 8);

  // ── Active error (first non-null from any mutation) ───────────────────────
  const activeError =
    (toggleOffer.isError && toggleOffer.error) ||
    (deleteOffer.isError && deleteOffer.error) ||
    null;

  // ─── Render states ────────────────────────────────────────────────────────

  if (isLoading) return <p className={styles.label}>{t('common.loading')}</p>;

  if (isError) {
    return (
      <p role="alert" className={styles.error}>
        {t('p2p.myOffers.error')}
      </p>
    );
  }

  const allOffers: Offer[] = offers ?? [];

  return (
    <section className={styles.panel}>
      <h2 className={styles.label}>{t('p2p.myOffers.title')}</h2>

      {/* ── Mutation error ── */}
      {activeError && (
        <p role="alert" className={styles.error}>
          {tError(
            (activeError as { code?: string }).code ?? 'FALLBACK_UNKNOWN_ERROR',
            { requestId: (activeError as { requestId?: string }).requestId ?? '' },
          )}
        </p>
      )}

      {/* ── Content ── */}
      {allOffers.length === 0 ? (
        <p className={styles.empty}>{t('p2p.myOffers.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('p2p.offers.typeBuy')}/{t('p2p.offers.typeSell')}</th>
              <th>{t('p2p.offers.asset')}</th>
              <th>{t('p2p.offers.price')}</th>
              <th>{t('p2p.offers.range')}</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allOffers.map((offer) => (
              <tr key={offer.id} data-offer-id={offer.id}>
                <td>
                  <span className={offer.type === 'buy' ? styles.typeBuy : styles.typeSell}>
                    {t(offer.type === 'buy' ? 'p2p.offers.typeBuy' : 'p2p.offers.typeSell')}
                  </span>
                </td>
                <td>{resolveSymbol(offer.cryptoId)}</td>
                <td className={styles.price}>
                  {formatDisplay(offer.unitPrice, { locale, maxDecimals: 8, stripTrailingZeros: true })}{' '}
                  {offer.fiatCurrency}
                </td>
                <td className={styles.range}>
                  {formatDisplay(offer.minAmount, { locale, maxDecimals: 8, stripTrailingZeros: true })}
                  {'–'}
                  {formatDisplay(offer.maxAmount, { locale, maxDecimals: 8, stripTrailingZeros: true })}
                </td>
                {/* Toggle active/inactive */}
                <td>
                  <Button
                    type="button"
                    variant={offer.active ? 'primary' : 'secondary'}
                    size="small"
                    onClick={() =>
                      toggleOffer.mutate({ id: offer.id, active: !offer.active })
                    }
                    disabled={anyPending}
                    loading={toggleOffer.isPending}
                  >
                    {t(offer.active ? 'p2p.myOffers.toggleActive' : 'p2p.myOffers.toggleInactive')}
                  </Button>
                </td>
                {/* Deactivate / delete */}
                <td>
                  <Button
                    type="button"
                    variant="danger"
                    size="small"
                    onClick={() => openDeleteDialog(offer.id)}
                    disabled={anyPending}
                    loading={deleteOffer.isPending && pendingDeleteId === offer.id}
                  >
                    {t('p2p.myOffers.deactivate')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Confirm deactivate Dialog ── */}
      <Dialog
        isOpen={pendingDeleteId !== null}
        onClose={closeDeleteDialog}
        title={t('p2p.myOffers.deactivateTitle')}
        closeOnClickOutside={false}
      >
        <p>{t('p2p.myOffers.deactivateConfirm')}</p>
        <div className={styles.actions}>
          <Button
            onClick={handleConfirmDelete}
            loading={deleteOffer.isPending}
            disabled={anyPending}
          >
            {t('common.submit')}
          </Button>
          <Button variant="secondary" onClick={closeDeleteDialog} disabled={anyPending}>
            {t('common.cancel')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
