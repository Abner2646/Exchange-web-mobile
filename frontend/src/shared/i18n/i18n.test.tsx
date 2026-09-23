import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { LocaleProvider, useLocale } from './LocaleContext';
import { useTranslation } from './useTranslation';
import { useErrorTranslation } from './errorCatalog';

describe('i18n layer', () => {
  it('should set document.documentElement.lang on locale change', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <LocaleProvider>{children}</LocaleProvider>;
    const { result } = renderHook(() => useLocale(), { wrapper });

    act(() => {
      result.current.setLocale('es');
    });

    expect(document.documentElement.lang).toBe('es');
  });

  it('should fallback to key if missing', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <LocaleProvider>{children}</LocaleProvider>;
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.t('missing.key')).toBe('missing.key');
  });

  it('should interpolate params', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <LocaleProvider>{children}</LocaleProvider>;
    const { result } = renderHook(() => {
      const { t } = useTranslation();
      const { setLocale } = useLocale();
      return { t, setLocale };
    }, { wrapper });

    act(() => {
      result.current.setLocale('en');
    });

    expect(result.current.t('greeting', { name: 'Alice' })).toBe('Hello, Alice!');
  });

  it('should map known error code', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <LocaleProvider>{children}</LocaleProvider>;
    const { result } = renderHook(() => {
      const { tError } = useErrorTranslation();
      const { setLocale } = useLocale();
      return { tError, setLocale };
    }, { wrapper });
    
    act(() => {
        result.current.setLocale('en');
    });

    expect(result.current.tError('P2P_TX_OWN_OFFER')).toBe('You cannot transact with your own offer.');
  });

  it('should map unknown error code to fallback', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <LocaleProvider>{children}</LocaleProvider>;
    const { result } = renderHook(() => useErrorTranslation(), { wrapper });

    expect(result.current.tError('UNKNOWN_CODE_123')).toContain('Code: UNKNOWN_CODE_123');
  });
});
