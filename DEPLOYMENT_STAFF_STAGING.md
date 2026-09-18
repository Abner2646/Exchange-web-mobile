# DEPLOYMENT_STAFF_STAGING.md — Guía de Despliegue para Staging / Alpha Empleados

> **Objetivo:** Desplegar el Exchange en un servidor VPS accesible por internet en menos de 30 minutos, con todas las funciones de registro, fondos de prueba, billeteras Funding ↔ Spot, trading spot y swap 100% operativas para pruebas de empleados.

---

## 1. Requisitos del Servidor (VPS)

Cualquier proveedor estándar (DigitalOcean, Hetzner, AWS Lightsail, Linode, Contabo):
* **Sistema Operativo:** Ubuntu 22.04 LTS o 24.04 LTS
* **Recursos mínimos recomendados:** 2 vCPU, 4 GB RAM, 40 GB SSD
* **Puertos de red abiertos (Firewall/Security Group):**
  * `22` (SSH para administración)
  * `80` (HTTP web y reverse proxy Nginx)
  * `443` (HTTPS SSL opcional / Let's Encrypt)

---

## 2. Pasos de Instalación en el Servidor

### Paso 2.1: Conectar por SSH e instalar Docker y Docker Compose
```bash
# Actualizar repositorios
sudo apt-get update && sudo apt-get upgrade -y

# Instalar utilidades y Docker
sudo apt-get install -y ca-certificates curl git gnupg lsb-release

# Instalar Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Instalar Docker Compose plugin
sudo apt-get install -y docker-compose-plugin
```
*(Cierra la sesión SSH y vuelve a entrar para aplicar los permisos del grupo `docker`)*.

---

### Paso 2.2: Clonar el Repositorio
```bash
git clone https://github.com/Abner2646/Exchange-web-mobile.git exchange
cd exchange
git checkout dev
```

---

### Paso 2.3: Configurar el Archivo de Entorno (`.env`)
Copia la plantilla o crea el archivo `.env` en la raíz del proyecto:
```bash
nano .env
```

Contenido recomendado para Staging / Empleados:
```ini
# Configuración General
NODE_ENV=development
PORT=3001
REACT_APP_API_URL=/api

# Base de Datos PostgreSQL (Contenedor Docker)
DB_HOST=database
DB_PORT=5432
DB_NAME=app_database
DB_USER=app_user
DB_PASSWORD=SuperSecretStagingPassword123!

# Seguridad JWT y Sesión
JWT_SECRET=StagingExchangeJwtSecretKey2026!StaffAlpha
JWT_EXPIRES_IN=24h
SESSION_SECRET=StagingSessionSecretStaff2026!

# Email (Opcional en Staging - El exchange permite auto-verificación en dev)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_app_password
DISABLE_RATE_LIMIT=true

# Redes Blockchain (Testnet)
BLOCKCHAIN_NETWORK=testnet
```

---

### Paso 2.4: Levantar los Contenedores
```bash
# Construir y levantar servicios en segundo plano
docker compose up -d --build
```

Verifica que todos los contenedores estén corriendo saludables:
```bash
docker compose ps
```
Deberás ver activos:
* `app_database` (PostgreSQL)
* `app_backend` (API Node.js)
* `app_frontend` (React Web)
* `app_nginx` (Reverse Proxy en puerto 80)
* `app_redis` (Cache & Queue)

---

### Paso 2.5: Poblar Catálogo Inicial (Tokens, Pares de Trading y Swap)
Ejecuta el seeder dentro del contenedor del backend para inicializar las 20 criptomonedas, los 85 pares spot y los 380 pares de swap:
```bash
docker compose exec backend node scripts/seedInitialData.js
```
*(Si no se ejecuta el script, el backend inicializa automáticamente el catálogo en su primer arranque)*.

---

## 3. Protección de Acceso para Empleados (Opcional pero Recomendado)

Para evitar que curiosos o bots accedan al staging antes del lanzamiento oficial, puedes habilitar una autenticación básica rápida en Nginx:

```bash
# Instalar herramienta de contraseñas apache
sudo apt-get install -y apache2-utils

# Crear usuario y contraseña para empleados (ej: staff / crypto2026)
sudo htpasswd -c ./nginx/.htpasswd staff
```

En `nginx/nginx.conf`, añade dentro de `server {`:
```nginx
auth_basic "Acceso Restringido - Empleados";
auth_basic_user_file /etc/nginx/.htpasswd;
```

Y en `docker-compose.yml`, mapea el archivo en el servicio `nginx`:
```yaml
volumes:
  - ./nginx/nginx.conf:/etc/nginx/nginx.conf
  - ./nginx/.htpasswd:/etc/nginx/.htpasswd
```
Luego reinicia Nginx: `docker compose restart nginx`.

---

## 4. El "Golden Path": Flujo de Prueba de los Empleados

Cualquier empleado que reciba la URL del staging (`http://<IP_DEL_VPS>/`) podrá seguir esta secuencia sin atascos ni bloqueos:

```
1. Registro
   └── /register -> Ingresa usuario, email y password.

2. Acreditación de Fondos de Prueba (1 Clic)
   ├── Clic en "🎁 Fondos de Prueba" (en /activos)
   └── O clic en "Reclamar regalo" (en el Navbar)
       └── Acredita al instante: 10,000 USDT + 1.00 BTC en Billetera Funding.

3. Transferencia entre Billeteras (Funding ↔ Spot)
   ├── Clic en "⇄ Entre Billeteras" o "⇄ Transferir" en /activos
   ├── Selecciona USDT -> Monto: 5,000 -> Confirmar
   ├── Selecciona BTC -> Monto: 0.5 -> Confirmar
   └── Ambos saldos se reflejan en tiempo real en la Billetera Spot.

4. Trading Spot en Tiempo Real
   ├── Dirigirse a /trading (BTC/USDT)
   ├── El formulario muestra de inmediato: Spot Disp: 5,000.0000 USDT
   ├── Si falta saldo, el botón "⇄ Transferir" en el formulario permite recargar sin salir
   └── Colocar Orden de Compra Limit o Market -> Se ejecuta o se coloca en el Order Book.

5. Conversión Instantánea (Swap)
   ├── Dirigirse a /swap
   ├── Seleccionar USDT a ETH o BTC a USDT
   ├── Ver cotización en tiempo real y comisiones
   └── Confirmar intercambio -> Acreditación inmediata.

6. Resumen de Activos
   └── En /activos se observa el desglose transparente: Total, Funding disponible y Spot disponible.
```

---

## 5. Comandos Útiles para el Operador

* **Ver logs del backend en tiempo real:**
  ```bash
  docker compose logs -f backend
  ```
* **Ver logs de Nginx:**
  ```bash
  docker compose logs -f nginx
  ```
* **Reiniciar servicios tras una actualización de código:**
  ```bash
  git pull origin dev
  docker compose up -d --build
  ```
* **Acceder a la consola de la base de datos PostgreSQL:**
  ```bash
  docker compose exec database psql -U app_user -d app_database
  ```
