import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import Providers from './providers';
import { useTranslation } from '@/shared/i18n';

function Probe() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return <div>{qc ? 'has-qc' : 'no-qc'}:{t('common.submit')}</div>;
}

describe('Providers', () => {
  it('provides a QueryClient and the i18n locale to children', () => {
    render(
      <Providers>
        <Probe />
      </Providers>
    );
    expect(screen.getByText('has-qc:Submit')).toBeInTheDocument();
  });
});
