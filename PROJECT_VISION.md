# Visión del Proyecto y Filosofía de Ingeniería

> **Documento Estratégico Maestro (Enterprise Production Grade)**  
> Aplica transversalmente a todo el repositorio (`backend/`, `frontend/`, `mobile/`, `infra/`).

---

## 1. Misión

Construir y desplegar en producción un **exchange custodial de criptomonedas de grado institucional**, capaz de custodiar y liquidar **dinero real** con los más altos estándares de seguridad, consistencia contable y cumplimiento normativo.

El sistema soportará de lanzamiento las redes de **Bitcoin (BTC)**, **Ethereum (ETH)**, **Binance Smart Chain (BSC)** y **Tron (TRC20 - USDT)**, permitiendo a los usuarios intercambiar, tradear, depositar, retirar y comerciar mediante P2P internacional en USD y EUR.

---

## 2. Alcance del Producto en Producción (MVP Completo)

El sistema saldrá a producción con los siguientes pilares de negocio activos:

1. **Conversión Instantánea (Swap Cripto-Cripto):**
   * Cotización cruzada en vivo con 380 pares activos.
   * **Oráculo Multi-Fuente Medianizador:** Precios calculados por la mediana de Binance, Coinbase y CoinGecko.
   * **Disyuntor de Emergencia:** Pausa automática del swap si las fuentes divergen más de un 1.5% o si cae el quórum de APIs.
   * Soporte para operar desde la Billetera de Fondos o la Billetera Spot con fee configurable (default 0.1%).
2. **Trading Spot (Libro de Órdenes Centralizado):**
   * Motor de matching para órdenes **Limit**, **Market**, **Stop-Limit** y **OCO** contra pares en USDT, USDC, BTC, ETH y DAI.
   * Reserva estricta y liquidación exclusiva en la **Billetera Spot** (los stops bloquean saldo inmediatamente al programarse).
   * Cobro de comisiones Maker/Taker sobre el activo recibido (Binance-style).
3. **Depósitos y Retiros On-Chain Multi-Cadena:**
   * **4 Redes:** Bitcoin (Native SegWit Bech32), Ethereum (EVM/ERC20), BSC (EVM/BEP20) y Tron (TRC20 con quema de TRX líquido para gas).
   * **Gas Station Interna:** Barrido automatizado de tokens depositados hacia la Hot Wallet maestra fondeando gas nativo automáticamente.
   * **Consolidación de UTXOs:** Worker programado para madrugadas de baja congestión en Bitcoin.
   * Retiros con claim atómico anti-doble gasto, reaper job y screening AML S5.
4. **Mercado P2P (Peer-to-Peer) Internacional:**
   * Comercio directo entre usuarios en monedas fiat internacionales (**USD, EUR**, etc., sin ARS).
   * Custodia temporal (*Escrow*) de fondos bloqueados en la Billetera Fondos hasta confirmación del vendedor.
5. **Programa de Referidos de 1 Nivel:**
   * Comisiones acumuladas en USDT por trades de invitados.
   * Reclamo manual desde la interfaz con botón directo a la Billetera Fondos.
6. **Pasarela de Tarjeta (On-Ramp):**
   * Integración embebida de proveedor licenciado (**Transak / MoonPay**) para comprar cripto con tarjeta de crédito/débito o Apple Pay, transfiriendo directamente a la Billetera Fondos del usuario y absorbiendo el riesgo de fraude.
7. **Launchpad (Preventa Directa en MVP):**
   * Preventas administradas por el exchange con Hard Cap, Soft Cap y precio fijo en USDT.
   * Acreditación 100% inmediata si la venta tiene éxito o reembolso automático 100% de USDT si no alcanza el Soft Cap.

---

## 3. Principios de Ingeniería y Gobernanza No Negociables

### A. Dinero Real: Cero Margen de Error
* **Aritmética Exacta:** Todo cálculo monetario utiliza [`backend/utils/money.js`](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/backend/utils/money.js) (`decimal.js`) con redondeo bancario half-even. Prohibido `parseFloat` o `Number` sobre dinero.
* **Contabilidad de Partida Doble (Double-Entry Ledger):** Cero mutación directa con `UPDATE`. Todo movimiento se registra en `ledger_postings` y debe sumar cero (`sum == 0`).
* **Idempotencia Transaccional:** Cada operación que mueve fondos exige `Idempotency-Key` comiteado atómicamente dentro de la misma transacción DB (`finalizeInTransaction`).

### B. Arquitectura de Múltiples Billeteras
* **Billetera de Fondos (Funding Wallet):** Entrada y salida (depósitos, retiros on-chain, P2P, on-ramp y transferencias entre usuarios).
* **Billetera Spot (Spot Wallet):** Dedicada exclusivamente al libro de órdenes de trading.
* **Transferencias Internas:** `POST /api/balances/my/transfer` inmediata, gratuita y segura.

### C. Doble Control Institucional (Maker-Checker / 4-Eyes Principle)
* Las acciones críticas (retiros grandes, cambio de wallets maestras, comisiones, ajustes manuales, confirmaciones de red, límites y casos AML) exigen que un operador proponga (*Maker*) y un segundo administrador distinto autorice (*Checker*) con 2FA.
* **Incompatibilidad estricta:** `maker_user_id !== checker_user_id` forzado por base de datos.
* **Techo Duro Inviolable (`HARD_MAX_CEILING`):** Ningún retiro superior a **$20,000 USD** puede configurarse para salir automático; siempre exige doble firma.
* **TTL de 24h:** Solicitudes no aprobadas en 24 horas expiran automáticamente y liberan fondos.

### D. Switch Dinámico Testnet ↔ Mainnet por Red
* Control independiente por cada blockchain en el panel de administración.
* Segregación absoluta de datos con columna `ambiente: 'testnet' | 'mainnet'` en direcciones, transacciones y balances.

### E. Centro de Alertas e Incidentes en Tiempo Real
* Monitoreo continuo de salud de jobs contables, estado de nodos RPC, balances de gas en Hot Wallets y quórum de oráculos.
* Notificación crítica inmediata al celular del administrador vía **Bot Privado de Telegram** (telemetría sanitizada, cero PII) y correo electrónico configurable.
* Live Chat con **Crisp** integrado en la web.

### F. Compliance y KYC Progresivo
* **Tier 0:** Acceso visual y de consulta total al exchange. Gating amigable al intentar operar.
* **Tier 1 (Persona KYC):** Verificación automatizada con SDK oficial para habilitar trading y límites altos.
* **Toggle de KYC en Retiros:** Switch en panel admin (`kyc_required_for_withdrawals`) para activar o desactivar la obligatoriedad según la política operativa y regulatoria.
* **Monitoreo AML:** Motor de detección de señales S1–S6 y screening pre-retiro.
