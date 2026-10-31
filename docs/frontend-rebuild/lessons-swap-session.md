# Lecciones de la sesión de swap (errores conceptuales y técnicos)

> Qué se rompió y por qué, para no repetirlo. Reforzá estas reglas en cada página.
> Fecha: sesión 2026-10-24 → 2026-10-31.

---

## Errores conceptuales (de criterio)

1. **Decir "terminada" sin correr la app.** Varias veces di algo por hecho sin
   abrir el navegador. Regla: **verificar en vivo** (Playwright + screenshots +
   consola) antes de afirmar. Ver memoria `verify-by-running-the-app`.

2. **Diseñar UX de dinero sin mirar el backend primero.** El "review con precio
   garantizado", el límite y los decimales dependían de hechos del backend que no
   verifiqué al principio. Regla: **investigar el controller/endpoint ANTES de
   decidir el flujo** (precio en vivo vs lock, validaciones, límites, defaults).

3. **Over-engineering que mete regresiones.** Para "nunca vacío" até la imagen a
   `opacity:0` hasta `onLoad` → rompió la carga de íconos en el primer render. El
   monograma de abajo ya cubría el hueco; la complejidad extra fue el bug. Regla:
   **la solución más simple que cumple, gana.**

4. **Copy que miente o filtra.** "Guaranteed price" (no lo está), "no quote lock
   yet" (nunca lo habrá), y antes `(Code: API_ERROR)`. Regla: **nunca filtrar
   códigos** y **no prometer lo que el backend no hace**. Copy honesta.

5. **Defaults sin mirar los datos reales.** El "De" arrancaba en PEPE porque el
   catálogo lista `BTC/PEPE` primero. Regla: **elegir defaults con los datos
   reales** (acá: preferir USDT como moneda de pago), no `array[0]`.

6. **Side-effects de helpers/providers compartidos.** Agregar el Footer duplicó
   los nombres de link y rompió `gotoApp` en **todos** los specs de navegación; y
   un 401 de cualquier GET autenticado sin stub desmonta el subtree `(app)` vía
   `notifyUnauthorized`. Regla: **al tocar algo compartido, pensar en todos sus
   consumidores** (y re-correr su suite).

---

## Aprendizajes técnicos (reusables)

- **`<img onLoad>` se pierde el evento de imágenes cacheadas** (el handler se
  engancha después de que la imagen ya cargó) → **no gatear visibilidad por
  `onLoad`**; pintar la imagen sobre un fallback siempre presente, `onError` la
  saca. (`CoinLogo`.)
- **`money.divide` devuelve ~18 decimales** (Decimal.js). El backend de swap
  **rechaza `baseAmount` con >8 decimales** (`EXCHANGE_INVALID_INPUT`). →
  `round(x, 8)` antes de mandar a `/calculate` y `/intercambioExchange`.
- **Swap backend** (`backend/modules/swap/swap.controller.js`): el precio se lee
  **en vivo** de `par.currentPrice` tanto al cotizar como al ejecutar (no hay
  quote-lock); `baseAmount` entra por `parseFloat` server-side (mandá canónico
  limpio ≤8 dec); **límite diario AML** = `users.daily_limit_usd` (default $1000,
  `DECIMAL(10,2)` → máx `99999999.99`).
- **`Select` extendido**: prop `searchable` + slot `meta` por opción; el dropdown
  se dimensiona al contenido (`width:max-content; min-width:100%; max-width`).
- **`SuccessFlash`** (`src/shared/ui/feedback/`): estándar compartido montado
  app-wide en `providers.tsx`. `flash({title, detail, duration})`. No-op sin
  provider (tests no crashean). Azul de marca, confeti + check spring + ondas,
  ~3,4s, `prefers-reduced-motion`-aware.
- **Íconos de monedas** (`src/shared/lib/coinIcon.ts`): catálogo completo (20)
  pineado a CoinGecko; el fallback jsdelivr/spothq 404ea para ARB/PEPE/SHIB.
  `iconUrl` upper-casea la key; símbolo desconocido → monograma.

### e2e (Playwright, route-stubbed contra `next dev`)
- **Compilación on-demand de `next dev`**: el primer hit a una página puede tardar
  >5s y vencer el timeout de `expect(toHaveURL)` de `gotoApp`. En frío falla, tibia
  pasa. (CI usa retries.) No es regresión de código.
- **`gotoApp` scopeado** a `navigation[name=Primary]` (el Footer repite nombres).
- **Stubear TODO GET autenticado** que la página dispara (ej. swap:
  `/intercambioExchange/me`), si no el 401 real desmonta `(app)`.
- `loginViaUI` usa un **token fake `e2e-jwt`** y stubea `/api/user/me`.

### Dev / datos
- **Fondear otra cuenta**: el faucet credita al usuario autenticado. Para fondear a
  otro, **firmar un JWT** con `JWT_SECRET` (payload `{ id, email, username, role }`)
  y pegarle a `POST /api/balances/testnet-faucet {symbol, amount}`. Correr el script
  **desde `backend/`** para que `dotenv` cargue `backend/.env` (localhost), no el
  `.env` de la raíz (apunta a la DB de la nube).
- **Subir límite AML para testear**: `UPDATE users SET daily_limit_usd=99999999.99`.
- Stack local: Postgres del compose (`app_database`:5432) + backend desde el código
  (`node server.js`:3001) + `next dev`:3000 con rewrite `/api`→:3001; faucet; oracle
  con dev-bypass. Ver memorias `local-dev-stack-setup`, `verify-by-running-the-app`.
