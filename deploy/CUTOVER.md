# Go-live cutover — CRA → Next.js (Slice 8)

> ✅ **EXECUTED 2026-10-14** — production (`https://bitflow.community`) now serves the Next.js
> app (pm2 `bitflow-web` :3000 behind nginx). This runbook is kept for re-deploys and rollback.
> Rollback is live-ready: `/etc/nginx/sites-available/bitflow.cra.bak` + the CRA build under
> `/var/www/bitflow` are intact.

Flip production from the static CRA SPA to the self-hosted Next.js app. The Next
process runs as a 2nd pm2 app (`bitflow-web`, port 3000, bound to 127.0.0.1) behind
nginx, same-origin with the backend (`/api` + `/health` → 3001). **Reversible.**

Prereq (the go-live gate, known-issues §B): idempotency-by-intent ✅, backend P2P-accept
idempotency ✅, reactive `(app)` guard + emailVerified redirect ✅, Playwright money-flow
E2E ✅, Next 16/React 19 evaluated (launching on 14.2.35) ✅. On deploy day: run
`check:operator-mfa` green (§B.6) and set `external_symbol` on USD(T) pairs if the swap
oracle breaker is enabled.

## 1. Build the Next bundle OFF the box (1 GB EC2 cannot build)

```bash
cd web
npm ci
npm run build          # output:'standalone' → web/.next/standalone/server.js
```

## 2. Ship the standalone bundle to the box

`next build` leaves `web/.next/standalone/{server.js,node_modules,package.json,.next/…}`
but does **not** copy the hashed static assets — copy `web/.next/static` INTO the bundle
at `.next/static` (beside `server.js`; `server.js` resolves `.next/static` from its own
dir). This app has no `web/public/`, so there is nothing else to copy. Verified layout
(2026-10-14 go-live): bundle is FLAT — static lives at `standalone/.next/static`, NOT
`standalone/web/.next/static`.

```bash
# from your build machine, repo root — assemble + ship as a tarball (rsync not needed):
cp -r web/.next/static web/.next/standalone/.next/static
tar czf /tmp/bundle.tgz -C web/.next/standalone .
scp -i <key.pem> /tmp/bundle.tgz ubuntu@BOX:/tmp/bundle.tgz
ssh -i <key.pem> ubuntu@BOX 'mkdir -p ~/Exchange-web-mobile/web/.next/standalone \
  && tar xzf /tmp/bundle.tgz -C ~/Exchange-web-mobile/web/.next/standalone'
```

SSH key for the prod box: `bitflow-key-2.pem` (user `ubuntu`, host `54.146.193.5` /
`bitflow.community`). On Windows, native `ssh.exe` rejects the key as "bad permissions" —
use it from Git Bash (`chmod 600` a copy) or fix the file ACL.

## 3. Start the Next pm2 process

```bash
cd ~/Exchange-web-mobile
pm2 start deploy/ecosystem.config.js --only bitflow-web   # or restart if already defined
pm2 save
curl -s http://127.0.0.1:3000/ | head         # should return the marketing HTML
```

## 4. Flip nginx

```bash
sudo cp deploy/nginx/bitflow-next.conf /etc/nginx/sites-available/bitflow
sudo nginx -t && sudo systemctl reload nginx
```

Smoke test from outside: `https://bitflow.community/` (marketing), `/login`, a money flow,
and `https://bitflow.community/api/health`.

## 5. Rollback (if needed)

Restore the previous CRA config and reload — the CRA static build under `/var/www/bitflow`
is untouched by this cutover:

```bash
sudo cp /etc/nginx/sites-available/bitflow.bak /etc/nginx/sites-available/bitflow  # if you kept a backup
# or re-deploy the old static config, then:
sudo nginx -t && sudo systemctl reload nginx
```

Keep a backup first: `sudo cp /etc/nginx/sites-available/bitflow /etc/nginx/sites-available/bitflow.bak`.

## Notes

- The CRA `frontend/` tree was deleted from the repo in the same slice. The last
  deployed CRA build still lives under `/var/www/bitflow` on the box for emergency
  rollback until you're confident in the Next cutover.
- Memory on the 1 GB box: the Next process mostly serves SSG/static → light. Monitor
  `pm2 monit` against swap; `max_memory_restart: 400M` guards it.
