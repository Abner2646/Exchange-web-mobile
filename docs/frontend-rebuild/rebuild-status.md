# Estado del rehacer del frontend + roadmap de páginas

> Vivo. Qué páginas están rehechas al **estándar nuevo** (el de swap) y cuáles
> faltan. Leé junto a [`redesign-methodology.md`](./redesign-methodology.md)
> (proceso) y [`aesthetic-standard.md`](./aesthetic-standard.md) (estética).
> Lecciones y gotchas de la sesión de swap:
> [`lessons-swap-session.md`](./lessons-swap-session.md).

Última actualización: **2026-10-31** (fin de la sesión de swap).

---

## El "estándar nuevo" (lo que define una página terminada)

Swap es la **implementación de referencia**. Una página se considera rehecha
cuando cumple, además de la paridad V1 / tech V2:

- **Tokens de estética** (`src/shared/styles/tokens.css`): `--bg-*`, `--brand-*`,
  `--text-*`, `--radius-*`, `--font-num` para cifras; dark por defecto + toggle.
- **Primitivo `Select`** (nunca `<select>` nativo): soporta `searchable` y slot
  `meta` (ej. saldo); íconos con `CoinLogo` (monograma siempre + imagen CDN).
- **Money-path**: `@/shared/money` string-math; **redondear a la precisión que
  acepta el backend antes de mandar** (swap: 8 decimales). Nunca `Number()` salvo
  estimaciones de display sancionadas.
- **`SuccessFlash`** (`useSuccessFlash().flash()`): **todo botón que finaliza una
  transacción** dispara el flash azul full-screen en `onSuccess`. No reinventar.
- **Paneles nunca vacíos** (mostrar estructura/tasas aunque los montos sean 0),
  **copy honesta** (no filtrar códigos de error, no prometer lo que el backend no
  hace), `:focus-visible` + `prefers-reduced-motion` en todo movimiento.
- **Verificación en vivo** (Playwright + screenshots) antes de decir "terminada".
- **e2e route-stubbed**: stubear **todo** GET autenticado que la página dispara
  (si no, el 401 real desmonta `(app)`); `gotoApp` scopeado a la navbar primaria.

---

## Roadmap de páginas

| # | Página | Ruta | Caso | Estado |
|---|--------|------|------|--------|
| — | Home | `/` | — | ✅ hecho (referencia estética inicial) |
| — | Auth (login/register/verify-email/forgot-password/auth-success) | `/(auth)/*` | A | ✅ hecho (paridad visual V1) |
| — | Navbar + Footer (todas las páginas) | layout | — | ✅ hecho |
| — | Tema dark + toggle | global | — | ✅ hecho |
| — | **Swap** | `/swap` | C→nuevo | ✅ **hecho a fondo** (referencia del estándar) |
| 1 | **Wallet** (balances, transfer, retiro, **depósito**, historial) | `/wallet` | **B** | ⬜ **PRÓXIMA** |
| 2 | Trading (order book, order form, trades) | `/trading` | B/C | ⬜ pendiente |
| 3 | P2P (ofertas, crear oferta, transacciones) | `/p2p` | B | ⬜ pendiente |
| 4 | Profile (cuenta, seguridad/2FA, KYC, notificaciones) | `/profile` | B | ⬜ pendiente |
| 5 | Admin (panel super_admin) | `/admin` | C | ⬜ pendiente (menor prioridad) |

Todas las páginas de la 1 a la 5 ya tienen **feature V2 funcional** (componentes +
queries + tests); lo que falta es **rediseñarlas** al estándar de arriba, no
construirlas de cero.

### Orden sugerido
**Wallet → Trading → P2P → Profile → Admin.** Wallet primero porque es el core de
dinero (y donde viven depósitos/retiros).

---

## Decisiones de producto fijadas

- **Depósitos: deshabilitados por ahora.** La pantalla de depósito (dentro de
  Wallet) muestra un **cartel de "servicio no disponible en tu región"** y no
  habilita el flujo real. Decisión de Abner (2026-10-31). No cablear depósito on-chain
  todavía.
- **Precio de swap**: NO está garantizado; se calcula en vivo al ejecutar (no hay
  quote-lock). El botón dice "Swap" (el recibo en vivo ES el review). Ver lecciones.
- **Límite diario de swap**: es un control **AML** (`users.daily_limit_usd`,
  default $1000). No se elimina del backend; para testear se sube el límite del
  usuario de prueba por DB. La UI no muestra el límite (sólo el error si se excede).
