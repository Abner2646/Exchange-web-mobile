#!/usr/bin/env bash
# =============================================================================
# bootstrap.sh — deploy MVP de BitFlow en una caja Ubuntu 24.04 (t3.micro, 1GB).
#
# IDEMPOTENTE y DEFENSIVO: se puede correr más de una vez; no pisa un .env ya
# existente ni recrea la DB si ya está. Pensado para 1GB RAM (crea swap primero).
#
# USO (en el server, parado en la raíz del repo clonado/rsync'd):
#   cd ~/Exchange-web-mobile
#   DOMAIN=tu-dominio.com CERT_EMAIL=vos@mail.com bash deploy/bootstrap.sh
#
# Variables (todas opcionales salvo donde se indica):
#   DOMAIN       dominio con A → IP del server. Sin él: cert self-signed (stopgap, el browser avisa).
#   CERT_EMAIL   email para Let's Encrypt (requerido si hay DOMAIN).
#   DB_NAME/DB_USER   defaults bitflow_prod / bitflow. La password se GENERA y se guarda en el .env.
#   PROCESS_MGR  pm2 (default) | systemd
#   El backend queda en TESTNET y SIN claves de custodia mainnet (MVP seguro).
# =============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
DB_NAME="${DB_NAME:-bitflow_prod}"
DB_USER="${DB_USER:-bitflow}"
PROCESS_MGR="${PROCESS_MGR:-pm2}"
WEBROOT="/var/www/bitflow"
log(){ echo -e "\n\033[1;36m==> $*\033[0m"; }

# --- 0. Swap (no opcional en 1GB) ---------------------------------------------
if ! swapon --show | grep -q '/swapfile'; then
  log "Creando swap de 2GB"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
  log "Swap ya presente, ok"
fi

# --- 1. Runtime + servicios ---------------------------------------------------
if ! command -v node >/dev/null || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 18 ]; then
  log "Instalando Node 20 LTS"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
log "Instalando postgresql, nginx, certbot"
sudo apt-get update -y
sudo apt-get install -y postgresql nginx certbot python3-certbot-nginx openssl rsync

# --- 2. Base de datos (SOLO localhost) ----------------------------------------
log "Configurando Postgres (localhost)"
sudo systemctl enable --now postgresql
# Fuerza listen_addresses=localhost (default en Ubuntu, pero lo aseguramos).
PGCONF="$(sudo -u postgres psql -tAc 'SHOW config_file;')"
sudo sed -i "s/^#\?listen_addresses.*/listen_addresses = 'localhost'/" "$PGCONF"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -hex 24)}"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
else
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo systemctl restart postgresql

# --- 3. .env de producción (NO se pisa si ya existe) --------------------------
ENV_FILE="$BACKEND_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  log ".env ya existe — NO se toca (revisalo a mano si hace falta)"
else
  log "Generando $BACKEND_DIR/.env (secretos nuevos, TESTNET, sin custodia mainnet)"
  JWT_SECRET="$(openssl rand -hex 48)"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3001
BIND_HOST=127.0.0.1
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=1h
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_SSL=false
DB_POOL_MAX=5
DB_POOL_MIN=0
# Cadencias lentas para 5 usuarios
ORDER_MATCH_INTERVAL_MS=3000
PRICE_UPDATE_INTERVAL_MS=60000
OUTBOX_PUBLISHER_INTERVAL_MS=15000
CONFIRMATION_UPDATE_INTERVAL_MS=120000
DEPOSIT_SCAN_INTERVAL_MS=300000
WITHDRAWAL_PROCESS_INTERVAL_MS=300000
REAPER_SWEEP_INTERVAL_MS=900000
RECONCILIATION_INTERVAL_MS=3600000
AML_SWEEP_INTERVAL_MS=3600000
# Blockchain: TESTNET, sin claves de custodia mainnet (completá desde .env.template si hace falta).
# Email: completá con SES si querés verificación por mail.
EOF
  chmod 600 "$ENV_FILE"
fi

# --- 4. Deps + migraciones + seeds -------------------------------------------
log "Instalando deps del backend"
cd "$BACKEND_DIR" && npm ci --omit=dev
log "Migraciones + seeds"
npm run migrate
npm run seed || log "seed falló/vacío — revisá (el exchange necesita catálogo de criptos)"

# --- 5. Frontend estático (NO se buildea en la caja de 1GB) -------------------
sudo mkdir -p "$WEBROOT"
if [ -d "$REPO_DIR/frontend/build" ]; then
  log "Copiando frontend/build → $WEBROOT"
  sudo rsync -a --delete "$REPO_DIR/frontend/build/" "$WEBROOT/"
else
  log "⚠️  No hay frontend/build (buildealo FUERA de la caja y rsync a $WEBROOT). Sigo con el backend."
  [ -f "$WEBROOT/index.html" ] || echo '<h1>BitFlow API up — frontend build pendiente</h1>' | sudo tee "$WEBROOT/index.html" >/dev/null
fi

# --- 6. Process manager (una sola instancia; los jobs son singleton) ----------
if [ "$PROCESS_MGR" = "systemd" ]; then
  log "Instalando servicio systemd"
  sudo mkdir -p /var/log/bitflow
  sudo sed "s#/home/ubuntu/Exchange-web-mobile#$REPO_DIR#g" "$REPO_DIR/deploy/systemd/bitflow-backend.service" | sudo tee /etc/systemd/system/bitflow-backend.service >/dev/null
  sudo systemctl daemon-reload && sudo systemctl enable --now bitflow-backend
else
  log "Levantando backend con pm2 (instances:1, fork)"
  command -v pm2 >/dev/null || sudo npm i -g pm2
  sudo mkdir -p /var/log/bitflow
  (cd "$REPO_DIR" && pm2 start deploy/ecosystem.config.js && pm2 save)
  sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" || true
fi

# --- 7. nginx + TLS -----------------------------------------------------------
log "Configurando nginx"
SITE=/etc/nginx/sites-available/bitflow
sudo cp "$REPO_DIR/deploy/nginx/bitflow.conf" "$SITE"
if [ -n "${DOMAIN:-}" ]; then
  sudo sed -i "s/TU_DOMINIO/$DOMAIN/g" "$SITE"
else
  log "⚠️  Sin DOMAIN: nginx servirá con cert SELF-SIGNED (el browser avisa). Pasá DOMAIN=... para Let's Encrypt."
  sudo sed -i "s/TU_DOMINIO/_/g" "$SITE"
  sudo mkdir -p /etc/ssl/bitflow
  [ -f /etc/ssl/bitflow/selfsigned.crt ] || sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/bitflow/selfsigned.key -out /etc/ssl/bitflow/selfsigned.crt -subj "/CN=54.146.193.5"
  sudo sed -i "s## ssl_certificate .*#ssl_certificate /etc/ssl/bitflow/selfsigned.crt;#" "$SITE"
  sudo sed -i "s## ssl_certificate_key .*#ssl_certificate_key /etc/ssl/bitflow/selfsigned.key;#" "$SITE"
fi
sudo ln -sf "$SITE" /etc/nginx/sites-enabled/bitflow
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
if [ -n "${DOMAIN:-}" ]; then
  log "Emitiendo cert Let's Encrypt para $DOMAIN"
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "${CERT_EMAIL:?CERT_EMAIL requerido con DOMAIN}" --redirect
fi

# --- 8. Verificación ----------------------------------------------------------
log "Deploy terminado. Verificación local:"
sleep 2
curl -ks https://localhost/health && echo || echo "(health no respondió aún — revisá: pm2 logs / journalctl -u bitflow-backend)"
echo "Desde AFUERA solo deben responder 80/443. 3001 y 5432 deben quedar internos."
