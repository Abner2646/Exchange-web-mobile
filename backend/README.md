# Backend — Arquitectura Técnica y Guía de Desarrollo

> **Ubicación:** `backend/`  
> **Stack:** Node.js (Express), PostgreSQL (Sequelize), Redis, Jest, Supertest, Stryker.  
> **API Docs en vivo:** `http://localhost:5000/api-docs` (OpenAPI 3 / Swagger).

---

## 1. Arquitectura del Sistema (Monolito Modular)

El backend está organizado en dominios de negocio desacoplados dentro de [`backend/modules/`](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/backend/modules/):

```
backend/modules/
├── users/             # Autenticación (5 etapas), perfiles, 2FA, reseteo de clave, Google OAuth (id_token)
├── balances/          # Motor de Double-Entry Ledger, transferencias Funding↔Spot y saldos proyectados
│   └── ledger/        # Cuentas, transacciones contables, postings y reconciliador
├── wallets/           # Custodia, derivación HD (BTC, ETH, BSC, Tron TRC20), depósitos, retiros y master wallets
│   ├── evm/           # Adapters Ethereum y Binance Smart Chain
│   ├── bitcoin/       # Adapter Bitcoin Native SegWit
│   └── tron/          # Adapter TronGrid y tokens TRC20 (USDT)
├── crypto/            # Catálogo de activos, feeds de precio y Oráculo Multi-Fuente Medianizador
├── swap/              # Motor de conversión instantánea (380 pares, oráculo medianizador, fee 0.1%)
├── trading/           # Motor de Trading Spot (Libro de órdenes, matching engine, Stop-Limit, OCO, 85 pares)
├── p2p/               # Mercado P2P internacional (USD/EUR, sin ARS), escrow y resolución de disputas
├── launchpad/         # Preventas directas administradas por exchange (Hard/Soft cap, auto-reembolso)
├── referrals/         # Programa de referidos de 1 nivel, acumulación en USDT y reclamo manual a Fondos
├── notifications/     # Notificaciones por usuario (in-app, email) y comunicados masivos
├── aml/               # Motor de monitoreo AML (S1–S6), screening S5 pre-retiro y cola de casos
├── audit/             # Log de auditoría inmutable encadenado por SHA-256 (Audit Trail)
├── config/            # BusinessConfig en BBDD, switches Testnet/Mainnet y Gobernanza Maker-Checker
└── alerting/          # Centro de Alertas e Incidentes en tiempo real (Bot de Telegram sanitizado + email)
```

---

## 2. Componentes y Patrones de Seguridad Enterprise

### A. Motor Contable de Partida Doble (Double-Entry Ledger)
* **Tablas:** `ledger_accounts`, `ledger_transactions`, `ledger_postings` y la tabla de proyección rápida `ledger_balances`.
* **Invariante:** Cada movimiento genera al menos dos postings cuyos débitos y créditos suman exactamente cero (`sum == 0`).
* **Compartimentos de saldo:** Separa estrictamente fondos en `funding:disponible`, `funding:bloqueado`, `funding:pendiente`, `spot:disponible` y `spot:bloqueado`.
* **Reconciliador:** [`reconciliation.job.js`](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/backend/jobs/reconciliation.job.js) verifica periódicamente la integridad interna del libro contable.

### B. Precisión Numérica Absoluta
* Centralizado en [`backend/utils/money.js`](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/backend/utils/money.js).
* Todo monto en base de datos se almacena en columnas `DECIMAL(28, 8)`.
* Toda salida y entrada por API viaja como **string canónico** (`"123.45000000"`). Prohibido `parseFloat`.

### C. Idempotencia y Transacciones Atómicas
* Middleware [`idempotency.middleware.js`](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/backend/middleware/idempotency.middleware.js).
* Endpoints que mueven fondos exigen `Idempotency-Key: <UUID>`.
* Primitiva `finalizeInTransaction`: comitea la clave en la misma transacción SQL que el dinero, eliminando riesgos de doble ejecución por reintentos de red.

### D. Doble Control Institucional (Maker-Checker / 4-Eyes Principle)
* Ubicado en `modules/config/makerChecker.service.js`.
* Regla estricta: `maker_user_id !== checker_user_id` a nivel base de datos.
* Techo duro inviolable por código (`HARD_MAX_CEILING = $20,000 USD`): ningún retiro de más de $20k puede salir automático.
* TTL de 24 horas: si la solicitud expira sin la firma del Checker, se cancela y se liberan los fondos a la Billetera Fondos.
* MFA al confirmar: el Checker debe ingresar su código TOTP de 6 dígitos para ejecutar la acción aprobada.

### E. Oráculo Multi-Fuente Medianizador
* Ubicado en `modules/crypto/priceMedianizer.service.js`.
* Consume en paralelo de **Binance**, **Coinbase** y **CoinGecko**.
* Calcula la mediana del precio para filtrar anomalías y flash crashes.
* **Circuit Breaker:** Si la divergencia supera el **1.5%** o cae el quórum de APIs, pausa el Swap y emite alerta crítica a Telegram.

### F. Red Tron (TRC20 - USDT)
* Conector `modules/wallets/tron/tron.service.js` vía TronGrid.
* Derivación BIP44 coin type `195'` (`m/44'/195'/0'/0/index`).
* Quema controlada de TRX líquido desde la Hot Wallet para gas.
* Confirmaciones requeridas: 19 bloques o estado `SOLIDIFIED`.

### G. Transactional Outbox y Event Bus
* Las mutaciones de dinero emiten eventos de dominio (`DepositConfirmed`, `WithdrawalBroadcast`, `TradeExecuted`, `SwapExecuted`) a la tabla `outbox_events` dentro de la misma transacción DB.
* Un worker despacha los eventos hacia el `eventBus` interno (*at-least-once*), alimentando notificaciones, referidos y el motor AML.

### H. Audit Trail Criptográfico
* Cada acción administrativa o evento de dinero genera una fila en `audit_log`.
* Hash **SHA-256 encadenado** al hash del registro anterior (`parentHash`), formando una cadena verificable mediante [`verifyAuditChain`](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/backend/modules/audit/auditChain.service.js).

---

## 3. Comandos de Desarrollo y Testing

```bash
# Instalar dependencias
npm install

# Correr en desarrollo (requiere Docker con PostgreSQL y Redis)
npm run dev

# Tests unitarios (rápidos, sin base de datos)
npm test

# Tests de integración (con contenedor Postgres efímero en puerto 55432)
npm run test:integration

# Cobertura de tests
npm run test:coverage

# Pruebas de mutación con Stryker (módulos de dinero)
npm run test:mutation
```

---

## 4. Documentación de API y Contratos

* **OpenAPI / Swagger:** Cada endpoint se anota con JSDoc `@openapi` sobre su ruta en `backend/modules/**/*.routes.js`.
* **Referencia de Cambios de Contrato para Clientes:** Consulta [**`docs/frontend-rebuild/backend-contract-changes.md`**](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/docs/frontend-rebuild/backend-contract-changes.md).
