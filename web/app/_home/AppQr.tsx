'use client';

import QRCode from 'react-qr-code';

/** QR for the mobile-app block. Encodes a plain message so that scanning it
 *  shows the same "not available in your region" notice. Colors default to the
 *  baseline (near-black on white) but variants can theme the foreground. */
export default function AppQr({
  value,
  size = 116,
  fgColor = '#0A0E13',
  bgColor = '#FFFFFF',
}: {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
}) {
  return (
    <QRCode
      value={value}
      size={size}
      level="M"
      bgColor={bgColor}
      fgColor={fgColor}
      style={{ height: size, width: size, display: 'block' }}
    />
  );
}
