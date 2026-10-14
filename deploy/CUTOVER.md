# Go-live cutover — CRA → Next.js (Slice 8)

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

`server.js` needs the static assets and public/ copied beside the standalone output
(Next does not copy them automatically):

```bash
# from your build machine, repo root:
rsync -a --delete web/.next/standalone/   ubuntu@BOX:~/Exchange-web-mobile/web/.next/standalone/
rsync -a --delete web/.next/static/       ubuntu@BOX:~/Exchange-web-mobile/web/.next/standalone/web/.next/static/
rsync -a --delete web/public/             ubuntu@BOX:~/Exchange-web-mobile/web/public/
```

(The standalone server resolves static from `web/.next/static` and public from `web/public`
relative to the app dir; adjust the target to your layout and verify once with step 3.)

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
