# Deploy MVP — BitFlow (t3.micro, Ubuntu 24.04, ~5 usuarios)

Runbook específico de este stack. Complementa las instrucciones genéricas del server.
Orden pensado para 1GB RAM. Host: `ubuntu@54.146.193.5`. Solo 80/443/22 públicos.

## 0. Swap (NO opcional en 1GB)
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 1. Runtime + servicios
```bash
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql nginx
# (opcional) pm2:  sudo npm i -g pm2
```

## 2. Base de datos (SOLO localhost)
Postgres de Ubuntu ya escucha en localhost por default (verificá `listen_addresses='localhost'`
en `/etc/postgresql/16/main/postgresql.conf`). Creá DB + usuario:
```bash
sudo -u postgres psql -c "CREATE USER bitflow WITH PASSWORD 'xxxx';"
sudo -u postgres psql -c "CREATE DATABASE bitflow_prod OWNER bitflow;"
```
> El `.env` de prod usa `DB_SSL=false` para el Postgres local (sin SSL). Si usaras una DB
> gestionada con SSL, poné `DB_SSL=true`.

## 3. Código + env de producción
```bash
git clone <repo> && cd Exchange-web-mobile/backend
npm ci --omit=dev
cp .env.production.example .env   # y COMPLETÁ los <...> (JWT_SECRET nuevo, DB_PASSWORD, etc.)
```

## 4. Migraciones + seeds (¡NO alcanza con sequelize.sync()!)
```bash
npm run migrate    # crea el esquema real (dual-control, outbox, audit_log, ...)
npm run seed       # catálogo de criptos, pares, business config — sin esto el exchange arranca vacío
```

## 5. Frontend: buildear FUERA de la caja
El build de CRA puede superar 1GB → **no lo corras en el t3.micro**. En tu máquina/CI:
```bash
cd frontend && REACT_APP_API_URL=/api npm ci && npm run build
```
Subí `frontend/build/` al server a `/var/www/bitflow`:
```bash
rsync -avz frontend/build/ ubuntu@54.146.193.5:/var/www/bitflow/
```

## 6. Backend bajo process manager (una sola instancia)
```bash
# pm2:
pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup
# o systemd (más liviano): copiar deploy/systemd/bitflow-backend.service a /etc/systemd/system/
sudo systemctl enable --now bitflow-backend
```
> Nunca en modo cluster: los jobs in-process son singleton (matching/pollers/outbox).

## 7. nginx + TLS
```bash
sudo cp deploy/nginx/bitflow.conf /etc/nginx/sites-available/bitflow
sudo ln -s /etc/nginx/sites-available/bitflow /etc/nginx/sites-enabled/
# Reemplazá TU_DOMINIO. Necesitás un dominio con A → 54.146.193.5 (Let's Encrypt no anda con IP sola).
sudo certbot --nginx -d TU_DOMINIO
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Backups (desde el día 1, aunque sea testnet)
```bash
# cron diario: pg_dump → archivo con fecha → copiar fuera del box (S3/otro host).
echo '0 3 * * * pg_dump -U bitflow bitflow_prod | gzip > /var/backups/bitflow_$(date +\%F).sql.gz' | crontab -
```

## 9. Verificación final
```bash
curl -I https://TU_DOMINIO                 # 200 (frontend)
curl https://TU_DOMINIO/api/health         # OK
# Desde AFUERA: solo 80/443 deben responder. 3001 y 5432 NO alcanzables.
nmap -Pn 54.146.193.5                      # solo 22 (tu IP), 80, 443
```

## Hardening barato
```bash
sudo apt-get install -y fail2ban unattended-upgrades
```
