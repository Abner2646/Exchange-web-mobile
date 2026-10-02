#!/usr/bin/env bash
# Arranque del backend en producción con secretos inyectados por Doppler.
# pm2 ejecuta este wrapper (ver deploy/ecosystem.config.js). NO contiene secretos:
# solo lee el service token read-only desde un archivo fuera del repo (owner ubuntu, chmod 600)
# y delega a `doppler run`, que inyecta las env vars de bitflow/prd en el proceso de node.
#
# El token NUNCA se versiona ni se imprime. Ruta configurable por DOPPLER_TOKEN_FILE.
set -euo pipefail

TOKEN_FILE="${DOPPLER_TOKEN_FILE:-/home/ubuntu/.config/doppler/prd.token}"
if [[ ! -r "$TOKEN_FILE" ]]; then
  echo "FATAL: no puedo leer el Doppler token en $TOKEN_FILE" >&2
  exit 1
fi
export DOPPLER_TOKEN
DOPPLER_TOKEN="$(cat "$TOKEN_FILE")"

# Correr desde el dir del backend (donde está server.js), sin importar desde dónde se invoque.
cd "$(dirname "$0")/../backend"

# --silent: no banner; --fallback cache local → sobrevive un corte breve de la API de Doppler.
exec doppler run --silent -- node server.js
