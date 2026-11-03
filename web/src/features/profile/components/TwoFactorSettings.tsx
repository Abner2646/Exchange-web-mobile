'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import type { ApiError } from '@/shared/api';
import { Badge, Button, Field, Input, Dialog, useSuccessFlash } from '@/shared/ui';
import { useCurrentUser } from '@/features/auth/queries';
import { useToggle2FA, useTotpSetup, useTotpEnable, useTotpDisable } from '../queries';
import styles from './profile.module.css';

/** Enrollment state: secret/qr live ONLY here — never written to storage. */
type EnrollState = { otpauthUri: string; secret: string; qr: string } | null;

export function TwoFactorSettings() {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const { flash } = useSuccessFlash();

  const { data: user } = useCurrentUser();

  const toggle2FA = useToggle2FA();
  const totpSetup = useTotpSetup();
  const totpEnable = useTotpEnable();
  const totpDisable = useTotpDisable();

  // SECURITY: secret/qr/codigo ONLY in component state.
  const [enrollState, setEnrollState] = useState<EnrollState>(null);
  const [enrollCodigo, setEnrollCodigo] = useState('');
  const [enrollComplete, setEnrollComplete] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disableCodigo, setDisableCodigo] = useState('');

  if (!user) return null;

  const anyPending = toggle2FA.isPending || totpSetup.isPending || totpEnable.isPending || totpDisable.isPending;

  // enrollComplete suppresses the QR after enable success (before the user cache flips totpEnabled).
  const setupData = enrollComplete ? null : (totpSetup.data ?? enrollState);

  function handleToggle2FA() {
    toggle2FA.mutate();
  }

  function handleEnroll() {
    setEnrollComplete(false);
    totpSetup.mutate(undefined, {
      onSuccess: (data) => {
        // Security: kept in component state only — never localStorage/sessionStorage.
        setEnrollState({ otpauthUri: data.otpauthUri, secret: data.secret, qr: data.qr });
        setEnrollCodigo('');
      },
    });
  }

  function handleEnableTotp() {
    totpEnable.mutate(
      { codigo: enrollCodigo },
      {
        onSuccess: () => {
          flash({ title: t('profile.twofa.enabledFlash') });
          // Security: clear enrollment secrets from state immediately on success.
          setEnrollState(null);
          setEnrollCodigo('');
          setEnrollComplete(true);
        },
      },
    );
  }

  function openDisableDialog() {
    setDisableCodigo('');
    setDisableDialogOpen(true);
  }
  function closeDisableDialog() {
    setDisableCodigo('');
    setDisableDialogOpen(false);
  }

  function handleDisableTotp() {
    totpDisable.mutate(
      { codigo: disableCodigo },
      {
        onSuccess: () => {
          flash({ title: t('profile.twofa.disabledFlash') });
          closeDisableDialog();
        },
      },
    );
  }

  const activeError: ApiError | null =
    toggle2FA.error ?? totpSetup.error ?? totpEnable.error ?? totpDisable.error ?? null;

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{t('profile.twofa.heading')}</h2>

      {activeError && (
        <p role="alert" className={styles.alert}>
          {tError(activeError.code ?? 'FALLBACK_UNKNOWN_ERROR', { requestId: activeError.requestId ?? '' })}
        </p>
      )}

      {/* ══ Email 2FA ══ */}
      <div className={styles.fieldBlock}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>{t('profile.twofa.emailLabel')}</span>
          <Badge tone={user.twoFactorEnabled ? 'success' : 'neutral'}>
            {user.twoFactorEnabled ? t('profile.twofa.emailOn') : t('profile.twofa.emailOff')}
          </Badge>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={handleToggle2FA} disabled={anyPending} loading={toggle2FA.isPending}>
            {user.twoFactorEnabled ? t('profile.twofa.emailDisable') : t('profile.twofa.emailEnable')}
          </Button>
        </div>
      </div>

      {/* ══ TOTP (authenticator app) ══ */}
      <div className={styles.fieldBlock}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>{t('profile.twofa.totpSection')}</span>
          <Badge tone={user.totpEnabled ? 'success' : 'neutral'}>
            {user.totpEnabled ? t('profile.twofa.totpEnabled') : t('profile.twofa.totpDisabled')}
          </Badge>
        </div>

        {!user.totpEnabled && (
          <>
            {setupData ? (
              <div className={styles.totpEnroll}>
                <p className={styles.note}>{t('profile.twofa.totpScanQr')}</p>
                {/* QR — security: PNG data URL, shown once, never persisted */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.totpQr} src={setupData.qr} alt={t('profile.twofa.totpScanQr')} />
                <p className={styles.totpSecret}>{t('profile.twofa.totpSecretInstructions', { secret: setupData.secret })}</p>

                <Field label={t('profile.twofa.totpCodeLabel')}>
                  <Input id="totp-enroll-codigo" type="text" inputMode="numeric" autoComplete="one-time-code" value={enrollCodigo} onChange={(e) => setEnrollCodigo(e.target.value)} />
                </Field>

                <div className={styles.actions}>
                  <Button onClick={handleEnableTotp} disabled={anyPending || enrollCodigo.length === 0} loading={totpEnable.isPending}>
                    {t('profile.twofa.totpEnableSubmit')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <Button onClick={handleEnroll} disabled={anyPending} loading={totpSetup.isPending}>
                  {t('profile.twofa.totpEnrollCta')}
                </Button>
              </div>
            )}
          </>
        )}

        {user.totpEnabled && (
          <>
            <div className={styles.actions}>
              <Button variant="danger" onClick={openDisableDialog} disabled={anyPending} loading={totpDisable.isPending}>
                {t('profile.twofa.totpDisableSubmit')}
              </Button>
            </div>

            <Dialog isOpen={disableDialogOpen} onClose={closeDisableDialog} title={t('profile.twofa.totpDisableSubmit')} closeOnClickOutside={false}>
              <Field label={t('profile.twofa.totpCodeLabel')}>
                <Input id="totp-disable-codigo" type="text" inputMode="numeric" autoComplete="one-time-code" value={disableCodigo} onChange={(e) => setDisableCodigo(e.target.value)} />
              </Field>
              <div className={styles.actions}>
                <Button onClick={handleDisableTotp} disabled={anyPending || disableCodigo.length === 0} loading={totpDisable.isPending}>
                  {t('profile.twofa.totpDisableSubmit')}
                </Button>
                <Button variant="secondary" onClick={closeDisableDialog} disabled={anyPending}>
                  {t('common.cancel')}
                </Button>
              </div>
            </Dialog>
          </>
        )}
      </div>
    </section>
  );
}
