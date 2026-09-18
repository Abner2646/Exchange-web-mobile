# Frontend Web — Arquitectura Técnica y Guía de Reconstrucción

> **Ubicación:** `frontend/`  
> **Stack Objetivo:** React 18+, TypeScript, Tailwind CSS, TanStack Query (React Query), Zustand / Context, Axios, TradingView Lightweight Charts.  
> **Referencia de Contratos:** [**`docs/frontend-rebuild/backend-contract-changes.md`**](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/docs/frontend-rebuild/backend-contract-changes.md) y [**`docs/frontend-rebuild/backend-breaking-changes-for-frontend.md`**](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/docs/frontend-rebuild/backend-breaking-changes-for-frontend.md).

---

## 1. Misión de la Reconstrucción del Frontend

El frontend web está siendo reconstruido en **TypeScript** para alinearse con el backend institucional y productivo. Toda la lógica del cliente refleja las capacidades operativas del sistema:
* Soporte para **múltiples billeteras** (Billetera Fondos y Billetera Spot).
* Gestión canónica de **montos exactos como strings** (sin imprecisiones de `parseFloat`).
* Envoltura canónica de errores `{ error: { code, message } }` con traducción de interfaz desacoplada.
* Envío obligatorio de **`Idempotency-Key`** en acciones monetarias para proteger al usuario contra dobles clics o caídas de conexión.
* **Gating visual para Tier 0:** Los usuarios no verificados pueden ver el mercado y explorar libremente, pero al intentar operar se les muestra un modal amigable para verificar su identidad.
* **Soporte de Tron (TRC20):** Direcciones `T...` y selector de red en depósitos/retiros de USDT.
* **On-Ramp con Tarjeta:** Modal embebido de Transak / MoonPay que transfiere directo a la Billetera Fondos.
* **Launchpad:** Pantalla de preventas directas con Soft/Hard cap y compra en USDT.
* **Referidos:** Dashboard con tarjeta de comisiones acumuladas y botón *"Reclamar Comisiones"*.
* **Live Chat:** Widget de **Crisp** integrado en la app pública.

---

## 2. Principios de Integración con el Backend

### A. Manejo de Errores Tipados
* El backend nunca devuelve errores como strings planos en rutas de dinero.
* Toda llamada a la API debe capturar `{ error: { code: "CODIGO_ESTABLE", message: "..." } }`.
* La interfaz **debe condicionar la lógica sobre `error.code`** (ej. `INSUFFICIENT_FUNDS`, `WITHDRAWAL_COOLDOWN`, `PRICE_ORACLE_DIVERGENCE`), nunca sobre el texto de `message`.

### B. Precisión Numérica (Strings, no Floats)
* Los saldos, montos y fees recibidos de la API son strings de 8 decimales (`"123.45000000"`).
* **Prohibido:** `parseFloat(res.data.balanceDisponible) + 10`.
* **Correcto:** Mantener el valor como string o usar `decimal.js` / `big.js` para sumas visuales de portafolio.
* El formateo visual (comas, puntos, moneda) se realiza en el renderizado mediante `Intl.NumberFormat`.

### C. Idempotencia en el Cliente
* Al enviar cualquier orden de compra/venta, retiro, transferencia interna, swap o compra en launchpad:
  1. Generar un UUIDv4 (`Idempotency-Key`).
  2. Deshabilitar el botón de envío y mostrar estado de carga (*"Procesando..."*).
  3. En caso de timeout de red o reintento de Axios, **reutilizar exactamente la misma clave**.

### D. Billeteras Compartimentadas (Funding / Spot)
* La interfaz presenta con claridad ambas billeteras:
  * **Billetera Fondos:** Para ver direcciones de depósito (QR), solicitar retiros y operar en P2P.
  * **Billetera Spot:** Para fondear el formulario del libro de órdenes de trading.
* Componente interactivo de **Transferencia Interna Inmediata** (`POST /api/balances/my/transfer`). Si el usuario no tiene saldo en Spot al intentar tradear, el formulario le ofrece un botón directo: *"Transferir desde Fondos a Spot"*.

---

## 3. Estructura de Módulos del Frontend

```
frontend/src/
├── api/                   # Cliente Axios centralizado, interceptores de auth y headers de idempotencia
├── components/            # Componentes reutilizables UI (Modales, Navbar, Tablas, Inputs de dinero)
├── features/
│   ├── auth/              # Login, registro, 2FA por email, Google GIS id_token, recuperación de clave
│   ├── wallets/           # Vista de Billetera Fondos y Spot, depósitos (QR BTC/ETH/BSC/TRX), retiros y transferencias
│   ├── swap/              # Widget de conversión, preview debounce con /calculate, modal confirm y fallback por divergencia
│   ├── trading/           # Terminal spot: TV chart, libro de órdenes, trades, panel de órdenes Limit, Market, Stop-Limit, OCO
│   ├── p2p/               # Marketplace de ofertas USD/EUR (sin ARS), chat de orden y flujo guiado de escrow
│   ├── launchpad/         # Preventas directas: vista de proyectos, Soft/Hard cap, cuenta regresiva y compra con USDT
│   ├── referrals/         # Dashboard de referidos: enlace personal, comisiones acumuladas en USDT y botón "Reclamar"
│   ├── onramp/            # Modal embebido de compra con tarjeta de crédito/débito (Transak / MoonPay)
│   ├── profile/           # Perfil (displayName editable, username fijo, solicitud cambio email con aviso cooldown)
│   ├── kyc/               # Integración de Persona KYC SDK (Persona.Inquiry.init) para verificación voluntaria
│   └── admin/             # Panel de administración:
│       ├── MakerChecker/  # Bandeja de entrada de aprobaciones duales (Maker propone / Checker autoriza con 2FA)
│       ├── Switches/      # Switches independientes Testnet ↔ Mainnet por cada blockchain
│       ├── Alerts/        # Campana de incidentes del sistema, estado de salud y configuración de alertas Telegram/Email
│       ├── Config/        # Editor de comisiones, umbrales de retiros y toggle de KYC obligatorio para retiros
│       └── AML/           # Cola de casos AML y transacciones P2P en disputa
└── types/                 # Tipos TypeScript alineados con OpenAPI
```

---

## 4. Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Correr servidor de desarrollo local
npm start

# Compilar para producción
npm run build

# Ejecutar tests
npm test
```
