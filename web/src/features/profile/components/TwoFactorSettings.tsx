'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Dialog } from '@/shared/ui';
import { useCurrentUser } from '@/features/auth/queries';
import { useToggle2FA, useTotpSetup, useTotpEnable, useTotpDisable } from '../queries';
import styles from './profile.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Enrollment state: secret/qr live ONLY here — never written to storage. */
type EnrollState = {
  otpauthUri: string;
  secret: string;
  qr: string;
} | null;

// ── Component ─────────────────────────────────────────────────────────────────

export function TwoFactorSettings() {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();

  const { data: user } = useCurrentUser();

  // ── Mutation hooks ────────────────────────────────────────────────────────
  const toggle2FA = useToggle2FA();
  const totpSetup = useTotpSetup();
  const totpEnable = useTotpEnable();
  const totpDisable = useTotpDisable();

  // ── Local state (SECURITY: secret/qr/codigo ONLY in component state) ─────
  // Enrollment data: populated after setup resolves; cleared on enable success.
  const [enrollState, setEnrollState] = useState<EnrollState>(null);
  // Enrollment code input
  const [enrollCodigo, setEnrollCodigo] = useState('');
  // Tracks whether enrollment was completed this render cycle; suppresses QR
  // display after enable success (before the user cache invalidates totpEnabled).
  const [enrollComplete, setEnrollComplete] = useState(false);
  // Disable-dialog visibility + its code input
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disableCodigo, setDisableCodigo] = useState('');

  // When the user is still loading, render nothing
  if (!user) return null;

  // ── Derived ───────────────────────────────────────────────────────────────
  const anyPending =
    toggle2FA.isPending ||
    totpSetup.isPending ||
    totpEnable.isPending ||
    totpDisable.isPending;

  // After useTotpSetup succeeds, use its data (or local enrollState after
  // the mutation data is superseded).  We update enrollState in the onSuccess
  // path via the mutate callback, but the mutation's own `.data` field is the
  // canonical source during the same render cycle.
  // enrollComplete suppresses the QR after enable success (before user cache
  // invalidation flips totpEnabled).  Security: this also ensures secret/qr
  // are no longer displayed once the user successfully enrolled.
  const setupData = enrollComplete ? null : (totpSetup.data ?? enrollState);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleToggle2FA() {
    toggle2FA.mutate();
  }

  function handleEnroll() {
    setEnrollComplete(false);
    totpSetup.mutate(undefined, {
      onSuccess: (data) => {
        // Store in component state so it persists if the mutation resets.
        // Security: never written to localStorage/sessionStorage.
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
          // Security: clear enrollment secrets from state immediately on success.
          setEnrollState(null);
          setEnrollCodigo('');
          // Suppress QR display before user cache invalidation arrives.
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
          closeDisableDialog();
        },
      },
    );
  }

  // ── Active error (first non-null) ─────────────────────────────────────────
  const activeError =
    (toggle2FA.isError && toggle2FA.error) ||
    (totpSetup.isError && totpSetup.error) ||
    (totpEnable.isError && totpEnable.error) ||
    (totpDisable.isError && totpDisable.error) ||
    null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <section className={styles.form}>
      {/* ── Shared error banner ── */}
      {activeError && (
        <p role="alert" className={styles.error}>
          {tError(
            (activeError as { code?: string }).code ?? 'FALLBACK_UNKNOWN_ERROR',
            { requestId: (activeError as { requestId?: string }).requestId ?? '' },
          )}
        </p>
      )}

      {/* ══ Email 2FA section ════════════════════════════════════════════════ */}
      <div className={styles.section}>
        <p className={styles.label}>
          {t('profile.twofa.emailLabel')}
          {': '}
          <strong>
            {user.twoFactorEnabled
              ? t('profile.twofa.emailOn')
              : t('profile.twofa.emailOff')}
          </strong>
        </p>

        <Button
          onClick={handleToggle2FA}
          disabled={anyPending}
          loading={toggle2FA.isPending}
        >
          {user.twoFactorEnabled
            ? t('profile.twofa.emailDisable')
            : t('profile.twofa.emailEnable')}
        </Button>
      </div>

      {/* ══ TOTP (authenticator app) section ═════════════════════════════════ */}
      <div className={styles.section}>
        <p className={styles.label}>
          {t('profile.twofa.totpSection')}
          {': '}
          <strong>
            {user.totpEnabled
              ? t('profile.twofa.totpEnabled')
              : t('profile.twofa.totpDisabled')}
          </strong>
        </p>

        {/* ── Not enrolled: show Enroll flow ── */}
        {!user.totpEnabled && (
          <>
            {/* Show QR + secret only after setup resolves */}
            {setupData ? (
              <div>
                {/* QR code — security: PNG data URL, shown once */}
                <p>{t('profile.twofa.totpScanQr')}</p>
                <img src={setupData.qr} alt={t('profile.twofa.totpScanQr')} />

                {/* Secret — shown once for manual entry; never persisted */}
                <p>
                  {t('profile.twofa.totpSecretInstructions', {
                    secret: setupData.secret,
                  })}
                </p>

                {/* Verification code input */}
                <Field label={t('profile.twofa.totpCodeLabel')}>
                  <input
                    id="totp-enroll-codigo"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={enrollCodigo}
                    onChange={(e) => setEnrollCodigo(e.target.value)}
                  />
                </Field>

                <Button
                  onClick={handleEnableTotp}
                  disabled={anyPending || enrollCodigo.length === 0}
                  loading={totpEnable.isPending}
                >
                  {t('profile.twofa.totpEnableSubmit')}
                </Button>
              </div>
            ) : (
              /* No setup data yet — show Enroll CTA */
              <Button
                onClick={handleEnroll}
                disabled={anyPending}
                loading={totpSetup.isPending}
              >
                {t('profile.twofa.totpEnrollCta')}
              </Button>
            )}
          </>
        )}

        {/* ── Enrolled: show Disable button + confirm Dialog ── */}
        {user.totpEnabled && (
          <>
            <Button
              variant="danger"
              onClick={openDisableDialog}
              disabled={anyPending}
              loading={totpDisable.isPending}
            >
              {t('profile.twofa.totpDisableSubmit')}
            </Button>

            <Dialog
              isOpen={disableDialogOpen}
              onClose={closeDisableDialog}
              title={t('profile.twofa.totpDisableSubmit')}
              closeOnClickOutside={false}
            >
              {/* Verification code input inside Dialog */}
              <Field label={t('profile.twofa.totpCodeLabel')}>
                <input
                  id="totp-disable-codigo"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={disableCodigo}
                  onChange={(e) => setDisableCodigo(e.target.value)}
                />
              </Field>

              <div className={styles.actions}>
                <Button
                  onClick={handleDisableTotp}
                  disabled={anyPending || disableCodigo.length === 0}
                  loading={totpDisable.isPending}
                >
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
