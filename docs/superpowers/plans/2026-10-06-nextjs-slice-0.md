# Next.js Migration — Slice 0 (scaffold + shared port + public home SSG) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new Next.js App Router app in `web/`, port the `shared/*` layer from the CRA rebuild with tests, and ship a server-rendered (SSG) public home with per-route metadata + robots/sitemap — proving the SSR/SEO pipeline end-to-end.

**Architecture:** New `web/` Next 14 App Router (TypeScript, `output: 'standalone'`) lives beside the CRA `frontend/` (which stays the deployed app until parity). Public surface is SSG; the authenticated app (later slices) is client-rendered. `shared/*` (money/api/i18n/ui) ports almost intact — the only adaptations are Next-isms: `'use client'` on interactive/context modules, SSR guards for `navigator`/`window`, and the API base URL env var rename. Tests move from jest (react-scripts) to **Vitest**.

**Tech Stack:** Next.js 14 (App Router), React 18.3, TypeScript 5, Vitest + @testing-library/react + jsdom, decimal.js, CSS Modules.

## Global Constraints

- Next.js `14.2.x`; React `18.3.x`; TypeScript `^5`. Pin Next 14 (React 18) to match the existing React-18 components — do NOT introduce React 19 in this slice.
- API money is a canonical decimal **string**; never `Number`/`parseFloat`/unary `+`/native arithmetic for money (decimal.js only). Slice 0 touches no money mutations.
- HTTP access goes only through `shared/api`; no direct `fetch`/axios/`window.location` in components.
- API base URL is **same-origin relative `/api`** (self-host). Env override: `NEXT_PUBLIC_API_URL` (default `/api`).
- Every interactive component or React-context/hook module that uses browser APIs starts with the `'use client'` directive. Public pages stay server components (no `'use client'`).
- `shared/styles/{tokens,reset,a11y}.css` are the only global CSS; everything else is CSS Modules. No generic global class names.
- Non-production/preview hosts must emit `noindex`; canonical host is `bitflow.community`.
- Source of truth for ports is `frontend/src/shared/*` — copy those files, then apply only the adaptations each task lists. Do not rewrite logic.
- Work happens in `web/`. The CRA `frontend/` is not modified in this slice.

---

### Task 1: Scaffold the `web/` Next App Router app

**Files:**
- Create: `web/package.json`, `web/next.config.mjs`, `web/tsconfig.json`, `web/next-env.d.ts` (auto), `web/.gitignore`
- Create: `web/app/layout.tsx`, `web/app/page.tsx` (temporary placeholder, replaced in Task 8)

**Interfaces:**
- Produces: a buildable Next app rooted at `web/`; `web/app/layout.tsx` exports the root `RootLayout` + a base `metadata`.

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "bitflow-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "14.2.33",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "decimal.js": "10.6.0"
  },
  "devDependencies": {
    "@types/node": "20.19.43",
    "@types/react": "18.3.31",
    "@types/react-dom": "18.3.7",
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 2: Create `web/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // lean Node bundle for self-hosting behind nginx on the EC2 box
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 3: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2020",
    "lib": ["dom", "dom.iterable", "es2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `web/.gitignore`**

```
/node_modules
/.next
/out
next-env.d.ts
*.tsbuildinfo
```

- [ ] **Step 5: Create `web/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://bitflow.community'),
  title: { default: 'BitFlow', template: '%s · BitFlow' },
  description: 'BitFlow — custodial crypto exchange.',
  robots: process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Create `web/app/page.tsx` (temporary placeholder)**

```tsx
export default function Home() {
  return <main>BitFlow — scaffold OK</main>;
}
```

- [ ] **Step 7: Install and build**

Run: `cd web && npm install && npm run build`
Expected: `✓ Compiled successfully`, a route `/` listed as static (`○`), exit 0.

- [ ] **Step 8: Commit**

```bash
git add web/package.json web/next.config.mjs web/tsconfig.json web/.gitignore web/app
git commit -m "feat(web): scaffold Next.js App Router app (standalone output)"
```

---

### Task 2: Vitest test harness

**Files:**
- Create: `web/vitest.config.ts`, `web/vitest.setup.ts`, `web/src/shared/_smoke.test.ts`

**Interfaces:**
- Produces: `npm test` (→ `vitest run`) runs `.test.ts`/`.test.tsx` under `web/` with a jsdom environment and `@testing-library/jest-dom` matchers.

- [ ] **Step 1: Add dev dependencies**

Run:
```bash
cd web && npm install -D vitest@2 @vitejs/plugin-react@4 jsdom@25 @testing-library/react@16 @testing-library/jest-dom@6 @testing-library/user-event@14
```
Expected: installs, exit 0.

- [ ] **Step 2: Create `web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

- [ ] **Step 3: Create `web/vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Write a smoke test — `web/src/shared/_smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('vitest harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `cd web && npm test`
Expected: 1 passed, exit 0.

- [ ] **Step 6: Commit**

```bash
git add web/vitest.config.ts web/vitest.setup.ts web/src/shared/_smoke.test.ts web/package.json web/package-lock.json
git commit -m "test(web): add vitest + testing-library harness"
```

---

### Task 3: Port `shared/money` (pure, decimal.js)

**Files:**
- Create: `web/src/shared/money/money.ts`, `web/src/shared/money/index.ts`, `web/src/shared/money/money.test.ts`
- Source: `frontend/src/shared/money/{money.ts,index.ts,money.test.ts}`

**Interfaces:**
- Produces: `shared/money` exports (same public API as the CRA version — e.g. `parseInput`, `formatDisplay`, compare/add/subtract helpers). Consumers import from `@/shared/money`.

- [ ] **Step 1: Copy the three files verbatim**

Copy `frontend/src/shared/money/money.ts` → `web/src/shared/money/money.ts`, `…/index.ts` → `web/src/shared/money/index.ts`, `…/money.test.ts` → `web/src/shared/money/money.test.ts`.
No code changes: `money.ts` is pure decimal.js with no React/DOM/node dependency.

- [ ] **Step 2: Adapt the test imports to Vitest**

In `web/src/shared/money/money.test.ts`, ensure the test API is Vitest. If the file uses bare `describe/it/expect` (jest globals), add at the top:

```ts
import { describe, it, expect } from 'vitest';
```
Replace any `jest.fn(`→`vi.fn(` and add `vi` to the import if present. (money tests are pure assertions; typically only the import line is needed.)

- [ ] **Step 3: Run the money tests**

Run: `cd web && npm test -- money`
Expected: all money tests pass (same count as the CRA suite), exit 0.

- [ ] **Step 4: Typecheck**

Run: `cd web && npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add web/src/shared/money
git commit -m "feat(web): port shared/money (decimal.js canonical amounts)"
```

---

### Task 4: Port `shared/api` (transport, same-origin base URL)

**Files:**
- Create: `web/src/shared/api/{client.ts,errors.ts,idempotency.ts,session.ts,index.ts,client.test.ts}`
- Source: `frontend/src/shared/api/*`

**Interfaces:**
- Consumes: `shared/money` is not required here.
- Produces: `apiClient` (`get/post/put/patch/delete`), `apiFetch<T>`, `ApiError`, `session` (`getToken/setToken/clearToken/hasToken/onUnauthorized/notifyUnauthorized`), `generateIdempotencyKey`, `isMoneyEndpoint`. Consumers import from `@/shared/api`.

- [ ] **Step 1: Copy all `shared/api` files verbatim**

Copy every file from `frontend/src/shared/api/` to `web/src/shared/api/` (`client.ts`, `errors.ts`, `idempotency.ts`, `session.ts`, `index.ts`, `client.test.ts`). `session.ts` is already SSR-safe (`typeof window !== 'undefined'` guard + in-memory fallback) — no change.

- [ ] **Step 2: Rename the base-URL env var in `web/src/shared/api/client.ts`**

Replace the `DEFAULT_BASE_URL` line:

```ts
const DEFAULT_BASE_URL =
  (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) || '/api';
```

(Was `REACT_APP_API_URL`. Same-origin self-host → `/api` default is correct; the env var only exists as an escape hatch.)

- [ ] **Step 3: Adapt `client.test.ts` to Vitest**

At the top of `web/src/shared/api/client.test.ts` add/ensure:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```
Replace every `jest.fn(`→`vi.fn(`, `jest.spyOn(`→`vi.spyOn(`, `jest.mock(`→`vi.mock(`, `jest.clearAllMocks()`→`vi.clearAllMocks()`. If the test stubs `global.fetch`, keep it (`vi.fn()` works the same). If it sets `process.env.REACT_APP_API_URL`, rename to `NEXT_PUBLIC_API_URL`.

- [ ] **Step 4: Run the api tests**

Run: `cd web && npm test -- api`
Expected: all `shared/api` tests pass, exit 0. If a test asserted the old `REACT_APP_API_URL`, it now asserts `NEXT_PUBLIC_API_URL`/`/api`.

- [ ] **Step 5: Typecheck**

Run: `cd web && npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add web/src/shared/api
git commit -m "feat(web): port shared/api transport (same-origin /api base, NEXT_PUBLIC_API_URL)"
```

---

### Task 5: Port `shared/i18n` (client context + SSR-safe locale)

**Files:**
- Create: `web/src/shared/i18n/{index.ts,types.ts,useTranslation.ts,errorCatalog.ts,LocaleContext.tsx,i18n.test.tsx}` and `web/src/shared/i18n/catalogs/{en.ts,es.ts}`
- Source: `frontend/src/shared/i18n/*`

**Interfaces:**
- Produces: `LocaleProvider` (client), `useLocale()`, `useTranslation()`, error-code catalog lookup, locale catalogs. Consumers import from `@/shared/i18n`.

- [ ] **Step 1: Copy all `shared/i18n` files verbatim (including `catalogs/`)**

Copy the whole `frontend/src/shared/i18n/` tree to `web/src/shared/i18n/`.

- [ ] **Step 2: Make `LocaleContext.tsx` a client component with an SSR-safe initializer**

At the very top of `web/src/shared/i18n/LocaleContext.tsx` add the directive, and guard `navigator` (undefined during SSR):

```tsx
'use client';
import React, { createContext, useState, useEffect, useContext } from 'react';

type Locale = string;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof navigator !== 'undefined' ? navigator.language : 'en-US'
  );

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (newLocale: Locale) => setLocaleState(newLocale);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within a LocaleProvider');
  return context;
};
```

- [ ] **Step 3: Add `'use client'` to `useTranslation.ts`**

If `web/src/shared/i18n/useTranslation.ts` calls `useLocale()`/React hooks, add `'use client';` as its first line. (Hook modules consumed by client components must be client modules.) `errorCatalog.ts`, `types.ts`, and `catalogs/*.ts` are pure data/types — leave them as plain modules (no directive).

- [ ] **Step 4: Adapt `i18n.test.tsx` to Vitest**

At the top of `web/src/shared/i18n/i18n.test.tsx` ensure:

```tsx
import { describe, it, expect, vi } from 'vitest';
```
Replace `jest.*`→`vi.*`. Keep `@testing-library/react` imports. If the test reads `navigator.language`, it still works under jsdom.

- [ ] **Step 5: Run the i18n tests**

Run: `cd web && npm test -- i18n`
Expected: all i18n tests pass, exit 0.

- [ ] **Step 6: Typecheck**

Run: `cd web && npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add web/src/shared/i18n
git commit -m "feat(web): port shared/i18n (client LocaleProvider, SSR-safe locale init)"
```

---

### Task 6: Port `shared/ui` primitives (client components, CSS Modules)

**Files:**
- Create: `web/src/shared/ui/{index.ts}` and `web/src/shared/ui/{Button,Field,Dialog}/*` (`.tsx`, `.module.css`, `.test.tsx` each)
- Source: `frontend/src/shared/ui/*`

**Interfaces:**
- Produces: `Button`, `Field`, `Dialog` (accessible primitives) exported from `@/shared/ui`. CSS Modules resolve natively in Next.

- [ ] **Step 1: Copy the whole `shared/ui` tree verbatim**

Copy `frontend/src/shared/ui/` → `web/src/shared/ui/` (all three component folders + `index.ts`). CSS Modules (`*.module.css`) are supported by Next with no config.

- [ ] **Step 2: Add `'use client'` to each interactive component**

Add `'use client';` as the first line of `web/src/shared/ui/Button/Button.tsx`, `web/src/shared/ui/Field/Field.tsx`, and `web/src/shared/ui/Dialog/Dialog.tsx` (they render interactive elements / manage focus → client components). Leave `index.ts` and `*.module.css` unchanged.

- [ ] **Step 3: Adapt the three test files to Vitest**

In each of `Button.test.tsx`, `Field.test.tsx`, `Dialog.test.tsx`, ensure the top imports:

```tsx
import { describe, it, expect, vi } from 'vitest';
```
Replace `jest.fn(`→`vi.fn(`, `jest.spyOn(`→`vi.spyOn(`. Keep `render`, `screen`, `userEvent` imports from `@testing-library/*`.

- [ ] **Step 4: Run the ui tests**

Run: `cd web && npm test -- ui`
Expected: all Button/Field/Dialog tests pass, exit 0.

- [ ] **Step 5: Typecheck**

Run: `cd web && npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add web/src/shared/ui
git commit -m "feat(web): port shared/ui primitives (Button/Field/Dialog, 'use client' + CSS Modules)"
```

---

### Task 7: Global styles (tokens / reset / a11y) wired into the root layout

**Files:**
- Create: `web/src/shared/styles/{tokens.css,reset.css,a11y.css}`
- Modify: `web/app/layout.tsx`
- Source: `frontend/src/shared/styles/*`

**Interfaces:**
- Produces: global tokens + reset + a11y loaded exactly once, at the app root.

- [ ] **Step 1: Copy the three stylesheets verbatim**

Copy `frontend/src/shared/styles/{tokens.css,reset.css,a11y.css}` → `web/src/shared/styles/`.

- [ ] **Step 2: Import them in `web/app/layout.tsx`**

Add these imports at the top of `web/app/layout.tsx` (above the `metadata` export). Global CSS can only be imported in `app/` in the App Router — the root layout is the correct single owner:

```tsx
import '@/shared/styles/reset.css';
import '@/shared/styles/tokens.css';
import '@/shared/styles/a11y.css';
```

- [ ] **Step 3: Build to confirm global CSS is accepted**

Run: `cd web && npm run build`
Expected: compiles successfully, exit 0 (Next errors if global CSS is imported outside `app/` — this placement is valid).

- [ ] **Step 4: Commit**

```bash
git add web/src/shared/styles web/app/layout.tsx
git commit -m "feat(web): wire global tokens/reset/a11y styles into root layout"
```

---

### Task 8: Public home — server component (SSG) with per-route metadata

**Files:**
- Modify: `web/app/page.tsx` (replace the placeholder)
- Create: `web/app/page.test.tsx`

**Interfaces:**
- Consumes: nothing (pure server component; no `shared/api` call — the public home is static marketing content).
- Produces: a statically-generated `/` route exporting a route-level `metadata` (title/description/canonical/OpenGraph).

- [ ] **Step 1: Write the failing test — `web/app/page.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home, { metadata } from './page';

describe('public home', () => {
  it('renders the marketing headline', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/BitFlow/i);
  });

  it('declares SEO metadata (title, description, canonical, openGraph)', () => {
    expect(metadata.title).toBeDefined();
    expect(metadata.description).toBeTruthy();
    expect(metadata.alternates?.canonical).toBe('/');
    expect(metadata.openGraph?.title).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npm test -- page`
Expected: FAIL (placeholder `page.tsx` has no `metadata` export and no `<h1>`).

- [ ] **Step 3: Replace `web/app/page.tsx` with the real home**

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BitFlow — Custodial crypto exchange',
  description:
    'Buy, swap, and trade crypto on BitFlow — a custodial exchange with audit-grade controls.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'BitFlow — Custodial crypto exchange',
    description: 'Buy, swap, and trade crypto on BitFlow.',
    url: 'https://bitflow.community/',
    siteName: 'BitFlow',
    type: 'website',
  },
};

export default function Home() {
  return (
    <main>
      <h1>BitFlow</h1>
      <p>A custodial crypto exchange with audit-grade controls.</p>
    </main>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npm test -- page`
Expected: PASS (both tests), exit 0.

- [ ] **Step 5: Build and confirm `/` is static-rendered (SSG)**

Run: `cd web && npm run build`
Expected: the route table marks `/` as `○ (Static)` — prerendered as static HTML, exit 0.

- [ ] **Step 6: Commit**

```bash
git add web/app/page.tsx web/app/page.test.tsx
git commit -m "feat(web): public home as SSG server component with per-route SEO metadata"
```

---

### Task 9: `robots.txt` and `sitemap.xml` as generated Next outputs

**Files:**
- Create: `web/app/robots.ts`, `web/app/sitemap.ts`, `web/app/sitemap.test.ts`

**Interfaces:**
- Produces: `/robots.txt` and `/sitemap.xml` served by Next. `sitemap()` returns the public, indexable URLs (home + public content routes that exist); the authenticated app is not listed.

- [ ] **Step 1: Write the failing test — `web/app/sitemap.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import sitemap from './sitemap';

describe('sitemap', () => {
  it('lists the public home on the canonical host and no private routes', () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://bitflow.community/');
    expect(urls.some((u) => u.includes('/wallet') || u.includes('/admin'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npm test -- sitemap`
Expected: FAIL ("Cannot find module './sitemap'").

- [ ] **Step 3: Create `web/app/sitemap.ts`**

```ts
import type { MetadataRoute } from 'next';

const BASE = 'https://bitflow.community';

export default function sitemap(): MetadataRoute.Sitemap {
  // Only public, indexable routes. The authenticated app (wallet/swap/trading/
  // admin/…) is deliberately excluded. Add public content pages (fees/FAQ/per-asset)
  // here as they are built in later slices.
  return [
    { url: `${BASE}/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
  ];
}
```

- [ ] **Step 4: Create `web/app/robots.ts`**

```ts
import type { MetadataRoute } from 'next';

const isProd = process.env.NODE_ENV === 'production';

export default function robots(): MetadataRoute.Robots {
  // Non-production/preview hosts must not be indexed.
  if (!isProd) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/wallet', '/swap', '/trading', '/p2p', '/profile', '/admin', '/referrals'] },
    sitemap: 'https://bitflow.community/sitemap.xml',
    host: 'https://bitflow.community',
  };
}
```

- [ ] **Step 5: Run the sitemap test**

Run: `cd web && npm test -- sitemap`
Expected: PASS, exit 0.

- [ ] **Step 6: Build and confirm the routes exist**

Run: `cd web && npm run build`
Expected: route table lists `/robots.txt` and `/sitemap.xml`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add web/app/robots.ts web/app/sitemap.ts web/app/sitemap.test.ts
git commit -m "feat(web): generated robots.txt + sitemap.xml (noindex non-prod, public-only)"
```

---

### Task 10: Slice 0 acceptance — full gate

**Files:** none (verification only)

- [ ] **Step 1: Typecheck, tests, build all green**

Run:
```bash
cd web && npm run typecheck && npm test && npm run build
```
Expected: typecheck exit 0; all vitest suites pass; `next build` exit 0 with `/` static (`○`) and `/robots.txt` + `/sitemap.xml` present.

- [ ] **Step 2: Manual SSG/SEO check (no-JS crawler view)**

Run:
```bash
cd web && npm run build && (npm start &) && sleep 4 && curl -s http://localhost:3000/ | grep -iE '<h1|<title|og:title' && curl -s http://localhost:3000/robots.txt | head && curl -s http://localhost:3000/sitemap.xml | head; kill %1 2>/dev/null
```
Expected: the served HTML already contains the `<h1>BitFlow`, `<title>`, and `og:title` **without** executing JS (proves SSG/SEO); `robots.txt` shows the disallow rules; `sitemap.xml` shows the home URL.

- [ ] **Step 3: Confirm no CRA regression**

The CRA `frontend/` was not touched this slice; prod still serves it. No deploy happens in Slice 0.

- [ ] **Step 4: Final commit (if any uncommitted verification artifacts)**

```bash
git status --porcelain   # expect clean; nothing to commit if all tasks committed
```

---

## Self-Review

**Spec coverage (against `2026-10-06-nextjs-migration-design.md`):**
- §1 repo structure `web/` + App Router → Task 1. ✓
- §1 render split (public SSG) → Task 8 (static `/`). Client-app split is later slices (out of Slice 0 scope). ✓
- §2 reuse shared/* (money/api/i18n/ui) + Next adaptations (`'use client'`, env rename) → Tasks 3–6. ✓
- §2 TanStack Query v5 upgrade → deferred to S1/S2 (no data fetching in Slice 0; not needed). Noted, not a gap.
- §3 auth under SSR → later slices (Slice 0 ships no auth). Not in scope. ✓
- §4 SEO: Metadata API → Tasks 1 (base) + 8 (route); robots/sitemap → Task 9; noindex non-prod → Tasks 1 + 9. ✓
- §5 deployment: `output: 'standalone'` → Task 1. nginx flip / pm2 process → later (no deploy in Slice 0). ✓
- §7 testing: Vitest + Testing Library → Task 2; per-file tests → Tasks 3–9; build gate → Task 10. ✓

**Placeholder scan:** no TBD/TODO; every code step shows real content; test code is concrete. ✓

**Type consistency:** `apiClient`/`apiFetch`/`ApiError`/`session`/`generateIdempotencyKey`/`isMoneyEndpoint` (Task 4) match the CRA source signatures; `LocaleProvider`/`useLocale`/`useTranslation` (Task 5) match; `metadata`/`sitemap`/`robots` default exports match Next's `MetadataRoute` types (Tasks 8–9). ✓

**Note:** Port tasks say "copy verbatim then apply these adaptations" rather than reproducing hundreds of unchanged lines — the source files under `frontend/src/shared/*` are the authoritative content; only the listed Next adaptations are new. If a ported test references jest APIs beyond the documented `jest.*`→`vi.*` swaps, fix it to the Vitest equivalent during that task's test step.
