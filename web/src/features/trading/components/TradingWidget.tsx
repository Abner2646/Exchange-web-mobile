'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { TradingPairSelect } from './TradingPairSelect';
import { OrderBookView } from './OrderBookView';
import { RecentTradesView } from './RecentTradesView';
import OrderForm from './OrderForm';
import MyOrdersView from './MyOrdersView';

export default function TradingWidget() {
  const { t } = useTranslation();
  const [marketPairId, setMarketPairId] = useState('');
  return (
    <section>
      <h1>{t('trading.title')}</h1>
      <TradingPairSelect value={marketPairId} onChange={setMarketPairId} />
      <OrderBookView tradingPairId={marketPairId} />
      <RecentTradesView tradingPairId={marketPairId} />
      <OrderForm />
      <MyOrdersView />
    </section>
  );
}
