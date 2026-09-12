#!/usr/bin/env node
/**
 * Dependency-audit gate (Fase 4.6).
 *
 * Wraps `npm audit --json` and fails CI on any HIGH/CRITICAL advisory EXCEPT the
 * ones explicitly allowlisted below. Plain `npm audit --audit-level=high` has no
 * way to accept a single unfixable transitive advisory, so an ecosystem-wide
 * finding with no patch (e.g. a `elliptic *` advisory reachable only through a
 * pinned wallet lib) would block every unrelated PR. This keeps the gate strict
 * for everything else while documenting each accepted risk in the audit binder.
 *
 * Rules:
 *  - An allowlist entry is a specific GHSA id + a written reason + a review date.
 *  - Anything high/critical NOT on the allowlist fails the build.
 *  - Allowlisting a LOW/MODERATE has no effect (the gate only blocks high+).
 */

const { execSync } = require('child_process');

// Accepted, documented risks. Keep this list short and revisit each `review` date.
const ALLOWLIST = [
  {
    id: 'GHSA-848j-6mx2-7j84',
    package: 'elliptic',
    reason:
      "Transitive via @ethersproject/hdnode (ethers v5) used for ETH/BSC HD " +
      "derivation. No patched elliptic version exists (advisory is `elliptic *`); " +
      "`npm audit fix --force` does not resolve it and would pull sequelize@3 " +
      "(breaking). Accepted until the planned ethers v6 evaluation (BTC derivation " +
      "is frozen; ETH/BSC is not, so an ethers upgrade is a viable future fix).",
    review: '2026-12-01',
  },
];

const allowIds = new Set(ALLOWLIST.map((e) => e.id));
const BLOCKING = new Set(['high', 'critical']);

// `npm audit --json` exits non-zero when vulns exist; capture stdout regardless.
let raw;
try {
  raw = execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (err) {
  raw = err.stdout ? err.stdout.toString() : '';
}

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error('audit-gate: could not parse `npm audit --json` output');
  process.exit(2);
}

const vulns = report.vulnerabilities || {};
const blocking = []; // {ghsa, title, severity, package}
const usedAllow = new Set();

for (const node of Object.values(vulns)) {
  for (const via of node.via || []) {
    if (typeof via !== 'object' || !via.url) continue; // string `via` = transitive link, skip
    const sev = String(via.severity || '').toLowerCase();
    if (!BLOCKING.has(sev)) continue;
    const ghsa = (via.url.match(/GHSA-[0-9a-z-]+/i) || [via.url])[0];
    if (allowIds.has(ghsa)) {
      usedAllow.add(ghsa);
      continue;
    }
    blocking.push({ ghsa, title: via.title, severity: sev, package: via.name || node.name });
  }
}

// Report allowlisted advisories that fired (audit trail), and prune stale entries.
for (const entry of ALLOWLIST) {
  if (usedAllow.has(entry.id)) {
    console.log(`audit-gate: ALLOWED ${entry.id} (${entry.package}) — review by ${entry.review}`);
  } else {
    console.log(`audit-gate: NOTE allowlist entry ${entry.id} no longer fires; consider removing it.`);
  }
}

if (blocking.length) {
  console.error(`\naudit-gate: ${blocking.length} un-allowlisted high/critical advisory(ies):`);
  for (const b of blocking) {
    console.error(`  [${b.severity}] ${b.ghsa} — ${b.package}: ${b.title}`);
  }
  console.error('\nFix them, or add a documented allowlist entry in backend/scripts/audit-gate.js.');
  process.exit(1);
}

console.log('audit-gate: no un-allowlisted high/critical advisories. OK');
