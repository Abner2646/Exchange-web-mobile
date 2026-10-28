'use client';
import React, { SVGProps } from 'react';

/* Line-icon set for the app UI (standard §3): stroke 1.6, currentColor, 24
   viewBox. Color and size come from context; pass `size` to override (default
   20). Decorative by default (aria-hidden); pass `aria-label` + role="img" to
   make an icon meaningful on its own. */

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string;
}

const Svg: React.FC<IconProps & { children: React.ReactNode }> = ({ size = 20, children, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={props['aria-label'] ? undefined : true}
    {...props}
  >
    {children}
  </svg>
);

export const WalletIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H5a2 2 0 0 0-2-2z" /><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5" /><path d="M16 12h.01" /></Svg>
);
export const SwapIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M7 7h11l-3-3M17 17H6l3 3" /></Svg>
);
export const ChartIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>
);
export const TrendUpIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M3 17l6-6 4 4 7-7M17 8h4v4" /></Svg>
);
export const TrendDownIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M3 7l6 6 4-4 7 7M17 16h4v-4" /></Svg>
);
export const ArrowUpIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M12 19V5M5 12l7-7 7 7" /></Svg>
);
export const ArrowDownIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M12 5v14M19 12l-7 7-7-7" /></Svg>
);
export const ChevronDownIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
);
export const ChevronRightIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>
);
export const CheckIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M5 12l5 5 9-9" /></Svg>
);
export const CloseIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);
export const PlusIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const MinusIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M5 12h14" /></Svg>
);
export const AlertIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></Svg>
);
export const InfoIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></Svg>
);
export const ShieldIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></Svg>
);
export const ClockIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);
export const CopyIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></Svg>
);
export const ExternalLinkIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M14 5h5v5M19 5l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></Svg>
);
export const SearchIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>
);
export const UserIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></Svg>
);
export const SettingsIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 2H9.8l-.4 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.5h4.4l.4-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12Z" /></Svg>
);
export const RefreshIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M20 11a8 8 0 0 0-14-4.5L4 8M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14 4.5L20 16M20 20v-4h-4" /></Svg>
);
export const LockIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
);
export const MailIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 7l8 6 8-6" /></Svg>
);
export const LogoutIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" /></Svg>
);
export const EyeIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Svg>
);
export const EyeOffIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.9M6.3 6.3A16 16 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3-.5" /></Svg>
);
export const MenuIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
);
export const BellIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Svg>
);
export const UsersIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6" /><path d="M17 14.3A6 6 0 0 1 21 20" /></Svg>
);
export const GridIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Svg>
);
export const SunIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></Svg>
);
export const MoonIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Svg>
);
