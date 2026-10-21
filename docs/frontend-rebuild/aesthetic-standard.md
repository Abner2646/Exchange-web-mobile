# Estándar de estética — rehacer el frontend

> **Qué es esto.** La *estética* (lenguaje visual) que deben compartir todas las
> páginas que vamos a rehacer, derivada del Home ya reconstruido (`/`), que a su
> vez está basado en la estética original del CRA viejo (tema "legacy dark").
>
> **Estética ≠ diseño.** Acá documentamos lo visual: paleta, tipografía, escala
> de espaciado/radios/sombras, patrones de componentes, movimiento, piso de
> accesibilidad y el tratamiento de estados (loading / empty / error). **No**
> documentamos el "diseño" técnico (fetching, caché, React Query, validación de
> formularios, guards, contrato de API): eso aparece recién cuando conectemos el
> backend y se resuelve por página.
>
> Fuente de verdad del look actual: `web/app/page.tsx` (tokens scoped del tema) y
> `web/app/marketing.module.css` (patrones de componentes). Componentes de
> contenido reutilizables: `web/app/_home/`.

---

## 0. Estado actual vs. objetivo (importante)

- **A1 hecho.** La estética legacy-dark ya está promovida a la capa global
  `web/src/shared/styles/tokens.css` (nombres de token del Home: `--bg-*`,
  `--brand-*`, `--text-*`, `--border-*`, `--spacing-xs…xxl`, `--radius-sm…xl`,
  sombras). Manrope + Inter se cargan vía `next/font` en `app/layout.tsx` y se
  exponen como `--font-sans` / `--font-num` en `<html>`.
- El Home (`/`) **ya no** define tokens inline: es un *dark island* que consume
  los globales vía `data-theme="dark"` en su wrapper `.page`.
- **Primitivos pendientes (A2):** `src/shared/ui/{Button,Field,Dialog}` todavía
  usan alias de compatibilidad (`--color-*`, `--spacing-1..7`) que `tokens.css`
  mantiene temporalmente. Se migran a los tokens §1 y se borran los alias en A2.

### Temas (dark + light) — decisión y mecanismo

- El app soporta **dark + light** (decisión de producto). **Light es el default**;
  el tema sigue el SO vía `prefers-color-scheme`, y un `data-theme` explícito en
  `<html>` lo fuerza (base para un toggle futuro, sin tocar componentes).
- **No** usamos `light-dark()`: su resolución dentro de custom properties es
  ambigua para *islas* de tema por subárbol. En su lugar los valores viven en
  bloques por tema (`:root`/`[data-theme="light"]` y `@media prefers dark` +
  `[data-theme="dark"]`); como los custom properties heredan de forma
  determinista, `data-theme="dark"` sobre **cualquier** subárbol lo fuerza a dark
  en todo navegador (así el Home es un dark island aunque el SO esté en light).
- `color-scheme` se setea por tema para que controles nativos y scrollbars
  acompañen.

**Objetivo restante:** reestilar los primitivos (A2) y sumar los primitivos de
estado (A3) e iconografía (A4) para que todo el app hable el mismo idioma visual.

---

## 1. Fundaciones (tokens)

Son los valores del tema legacy-dark. Nombres de token en inglés; usarlos como
variables CSS, no hardcodear hex en componentes.

### Color
| Rol | Token | Valor |
|---|---|---|
| Fondo base | `--bg-primary` | `#0A0E13` |
| Fondo secundario | `--bg-secondary` | `#141A20` |
| Fondo terciario | `--bg-tertiary` | `#1E2329` |
| Superficie elevada (cards) | `--bg-elevated` | `#1E2329` |
| Texto principal | `--text-primary` | `#EAECEF` |
| Texto secundario | `--text-secondary` | `#B7BDC6` |
| Texto terciario / muted | `--text-tertiary` | `#848E9C` |
| Texto sobre acento | `--text-inverse` | `#0A0E13` |
| Acento de marca | `--brand-primary` | `#3B82F6` |
| Acento hover/activo | `--brand-secondary` | `#2563EB` |
| Acento tenue (fondos de ícono) | `--brand-tertiary` | `#1E3A8A` |
| Positivo / éxito | `--success` | `#10B981` |
| Negativo / error | `--error` | `#EF4444` |
| Advertencia | `--warning` | `#F59E0B` |
| Borde principal | `--border-primary` | `rgba(43,49,57,0.6)` |
| Borde secundario | `--border-secondary` | `rgba(30,35,41,0.5)` |
| Borde de foco | `--border-focus` | `#3B82F6` |
| Hover interactivo (fondo) | `--interactive-hover` | `#1E2329` |

Washes (fondos tintados para badges/íconos): ya son tokens — `--wash-brand`,
`--wash-success`, `--wash-error`, `--wash-warning` (alpha por tema).

Los valores de arriba son el tema **dark**. El tema **light** (default) deriva
los mismos roles manteniendo el azul de marca y contraste AA:

| Rol | Token | Light |
|---|---|---|
| Fondo base | `--bg-primary` | `#F7F8FA` |
| Fondo secundario / elevado | `--bg-secondary` · `--bg-elevated` | `#FFFFFF` |
| Fondo terciario | `--bg-tertiary` | `#EDEFF3` |
| Texto principal | `--text-primary` | `#0D1117` |
| Texto secundario | `--text-secondary` | `#3A4454` |
| Texto terciario / muted | `--text-tertiary` | `#5B6676` (≈4.8:1 AA) |
| Texto sobre acento | `--text-inverse` | `#FFFFFF` |
| Acento de marca | `--brand-primary` | `#2563EB` |
| Acento hover/activo | `--brand-secondary` | `#1D4ED8` |
| Acento tenue | `--brand-tertiary` | `#DBEAFE` |
| Positivo / Negativo / Advertencia | `--success`·`--error`·`--warning` | `#059669`·`#DC2626`·`#D97706` |
| Borde principal / secundario | `--border-primary`·`--border-secondary` | `#DCE0E7`·`#EAEDF2` |
| Hover interactivo | `--interactive-hover` | `#F1F3F7` |

Regla: en light los deltas usan los mismos tokens `--success`/`--error`/
`--text-tertiary`, así la regla verde/rojo/neutro vale en ambos temas.

### Espaciado
`--spacing-xs .375rem` · `sm .75rem` · `md 1.25rem` · `lg 2rem` · `xl 2.5rem` ·
`xxl 4rem`. El padding de sección es `xxl` vertical / `xl` horizontal.

### Radios
`--radius-sm .375rem` · `md .625rem` · `lg 1rem` · `xl 1.25rem` · `full 9999px`.
Cards con `lg`; botones/inputs con `md`; pills con `full`.

### Sombras (suaves, para dark)
`--shadow-sm 0 1px 2px rgba(0,0,0,.3)` · `md …,.4` · `lg …,.5`. Usar sombra solo
para elevar lo que flota (cards destacadas, menús); el resto se separa con borde.

---

## 2. Tipografía

- **Manrope** → UI, títulos y texto. Pesos 400/500/600/700(/800 para displays).
- **Inter (tabular)** → **solo cifras financieras** (precios, %, volúmenes, caps),
  expuesta como `--font-num`; `font-variant-numeric: tabular-nums` y
  `letter-spacing: -0.01em`. Que las columnas numéricas alineen.
- Escala de referencia (del Home): h1 `~4.1rem`/1.12/`-0.02em`; subtítulo
  `1.25rem`; título de sección `2rem`/700; h3 `1.0625–1.125rem`; cuerpo
  `.9375rem`; chico `.8125rem`; micro-label `.75rem` en MAYÚSCULAS con
  `letter-spacing .05em`.
- Títulos con `letter-spacing` negativo leve; labels/overlines con tracking
  positivo. La tipografía es parte de la personalidad, no un vehículo neutro.

### Cifras y deltas (regla fija)
- Variación positiva → `--success`; negativa → `--error`; **cero/neutral
  (ej. stablecoins 0.00%) → `--text-tertiary`** (gris), nunca rojo/verde.
- Signo explícito `+`/`−`. Siempre tabular.

---

## 3. Iconografía

- **Íconos de UI:** SVG inline, línea, `stroke-width: 1.6`, `currentColor`
  (heredan el color del contexto). Nada de librerías pesadas de íconos.
- **Logos de monedas:** imágenes reales vía `iconUrl()` (mapa CoinGecko +
  fallback jsdelivr `cryptocurrency-icons`); redondos (`radius-full`), con
  `--bg-tertiary` como placeholder mientras cargan. Centralizado en
  `_home/data.ts`.

---

## 4. Patrones de componente (lenguaje visual)

> Reglas de **apariencia y comportamiento visible**. La lógica (estado, datos)
> se define al construir cada primitivo.

- **Botones.** Primario = relleno `--brand-primary`, texto `--text-inverse`,
  `radius-md`, peso 600; hover → `--brand-secondary` + `translateY(-1px)` +
  `shadow-md`. Secundario = `--bg-secondary` + `1px --border-primary`; hover →
  borde `--border-focus`. Variantes a tener: `ghost` (solo texto/acento) y
  `danger` (sobre `--error`). Tamaños sm/md.
- **Cards.** `--bg-elevated` + `1px --border-primary` (o `--border-secondary`
  para cards tranquilas) + `radius-lg`. Hover de card interactiva = lift
  `translateY(-3/-4px)` + sombra. Padding interno `md`/`lg`.
- **Tablas (data).** Header `--bg-secondary`, `th` en MAYÚSCULAS `.8125rem`
  tracking `.05em` color `--text-secondary`; filas separadas por hairline
  `--border-secondary`; hover de fila = fondo `--interactive-hover` **solo como
  ayuda de lectura** (ver §6: sin `cursor:pointer` salvo que la fila navegue de
  verdad). Celdas numéricas con `--font-num` tabular.
- **Acordeón.** Ítem = card; pregunta peso 600; chevron que rota; respuesta con
  transición de `max-height`; estado activo/hover en `--brand-primary`.
  **Arranca cerrado** (sin ítem abierto por defecto).
- **Badges / pills.** Chicos, `radius-full`, fondo wash tintado + texto del color
  del rol (éxito/acento), `.75rem` peso 600.
- **Inputs / Field.** Superficie `.control`: `--bg-secondary` + `1px
  --border-primary` + `radius-md`; foco = `--border-focus` + anillo
  `--wash-brand`; label `--text-secondary`; ayuda `.8125rem`; error en `--error`
  con mensaje accionable (§7). `Input`/`Textarea` la comparten. El **textarea no
  es redimensionable** (`resize:none`, alto predefinido); si el texto excede,
  scrollea dentro con scrollbar temático.
- **Select / desplegables (regla fija).** **TODO desplegable usa el `Select`
  custom** (patrón listbox accesible); **nunca** el `<select>` nativo — su panel
  no es estilizable ni puede mostrar imágenes, así que rompería la consistencia.
  Trigger = look `.control`; panel = superficie elevada + sombra `lg`, opción
  activa `--interactive-hover`, seleccionada en `--brand-primary` con check.
  Las opciones pueden llevar ícono/logo (ej. logos reales de monedas).
- **Diálogos/menús.** Superficie elevada + sombra `lg`; overlay oscurecido;
  respetan z-index tokens; foco atrapado (lo da el primitivo).
- **Scrollbars.** Temáticos globalmente (thin, thumb `--bg-tertiary` → hover
  `--text-tertiary`), consistentes en página, textareas, diálogos, tablas y el
  panel del Select.

---

## 5. Layout y movimiento

- **Contenedores:** `max-width` 1440px (chrome del app), 1200px (contenido:
  features, download, grids), 820–900px (lectura: FAQ, texto largo). Centrados,
  gutters simétricos.
- **Responsive:** el hero apila en < ~1040px; en móvil se ocultan columnas de
  baja prioridad de la tabla (volumen/cap) y baja la escala tipográfica. Todo
  debe funcionar hasta ~360px de ancho.
- **Movimiento:** transiciones `0.18–0.3s ease`; micro-lifts de 1–4px en hover;
  una sola cosa "con carácter" por pantalla, el resto callado. Nada de animación
  decorativa que grite "AI-generated".

---

## 6. Piso de accesibilidad (obligatorio en cada página)

- **Foco visible:** `:focus-visible` con `outline: 2px solid --border-focus;
  outline-offset: 2px` en todo interactivo.
- **Honestidad de affordance:** `cursor: pointer` y estilos de "clic" **solo** en
  elementos realmente interactivos (`a`/`button`). Hover de fondo en filas de
  tabla es ayuda de lectura, no promesa de clic.
- **Contraste:** AA (≥ 4.5:1 texto normal). El gris `--text-tertiary` está
  verificado (~5.8:1 sobre fondo base, ~4.76:1 sobre superficies elevadas).
- **Teclado:** todo operable; orden de tabulación lógico; diálogos atrapan foco.
- **`prefers-reduced-motion`:** neutralizar transiciones/animaciones (patrón ya
  aplicado en el Home, scoped al subárbol de la página).
- **Imágenes:** `alt` real o `alt=""` si son decorativas; `width/height` para
  evitar CLS.

---

## 7. Estados (loading / empty / error) — su estética

Cada página que toque datos **debe** definir y estilar su matriz de estados. La
lógica se cablea con el backend; la *apariencia* sigue estas reglas:

- **Loading.** Skeletons con bloques en `--bg-secondary`→`--bg-tertiary` (shimmer
  sutil), con el mismo tamaño/`radius` que el contenido real para no mover el
  layout (cero CLS). Acciones en curso → spinner en `--brand-primary`; botón en
  loading queda deshabilitado + spinner inline, **el label no desaparece**.
- **Empty.** Centrado: ícono muted + mensaje en `--text-secondary` + **una** acción
  primaria. El copy es una invitación a actuar, nunca un callejón sin salida
  (ej.: "Todavía no tenés movimientos. Hacé tu primer depósito."). Sin drama.
- **Error.** Acento `--error`; mensaje conciso en la voz de la interfaz que diga
  **qué pasó y cómo recuperarse**, con acción de reintento. Inline para campos,
  banner/card para secciones. Los errores no piden disculpas ni son vagos.
- **Cero/neutral.** Valores en cero van en gris neutro, no en rojo/verde.
- **Disabled.** Opacidad reducida + `cursor: not-allowed`, manteniendo legible el
  label.

---

## 8. Voz y copy (material de diseño)

- Español para el usuario; identificadores/código en inglés.
- Voz activa, *sentence case*, verbos planos, sin relleno. El botón dice lo que
  pasa ("Guardar cambios", no "Enviar") y mantiene el mismo nombre en todo el
  flujo (si dice "Publicar", el toast dice "Publicado").
- **Sin jerga interna** en superficies de usuario (nada de "ledger de partida
  doble", "Maker-Checker", "hash-chained"). Nombrar por lo que la persona
  controla y reconoce.
- Cada elemento hace un solo trabajo: un label etiqueta, un ejemplo demuestra.

---

## 9. Checklist por página (definition of done estético)

- [ ] Usa tokens globales (sin hex hardcodeado).
- [ ] Manrope en UI, `--font-num` tabular en cifras; deltas verde/rojo/neutro.
- [ ] Estados loading / empty / error diseñados (no solo el happy path).
- [ ] Foco visible, contraste AA, teclado, `prefers-reduced-motion`.
- [ ] Affordance honesto (pointer solo en interactivos reales).
- [ ] Responsive hasta móvil.
- [ ] Copy en voz de usuario, sin jerga, consistente.
- [ ] Una sola apuesta visual con carácter; el resto, disciplinado.

---

## 10. Micro-roadmap del rehacer (con la nueva estética)

> Orden por dependencia: primero las fundaciones que habilitan todo lo demás,
> después páginas de menor a mayor dependencia de datos. Cada página define su
> matriz de estados (§7) como parte del trabajo.

### Fase A — Fundaciones de estética *(habilita el resto)*
- [x] **A1. Promover tokens legacy-dark a global.** `tokens.css` con la
  paleta/espaciado/radios/sombras de §1 en **dark + light** (ver §0), Manrope+Inter
  vía `next/font` en `app/layout.tsx` (`--font-sans`/`--font-num`), Home migrado a
  *dark island* (`data-theme="dark"`). Alias de compat para primitivos hasta A2.
- [x] **A2. Reestilar primitivos** a la estética: `Button` (primary/secondary/
  ghost/danger + sizes + loading), `Field`/`Input`/`Select`/`Textarea`, `Card`,
  `Table`, `Badge/Pill`, `Tabs`, `Dialog`, `Tooltip`, `Toast`. En `src/shared/ui`.
- [x] **A3. Primitivos de estado:** `Skeleton`, `Spinner`, `EmptyState`,
  `ErrorState`/`InlineError` (reutilizables por todas las páginas).
- [x] **A4. Iconografía:** set de line-icons (stroke 1.6) en `ui/icons/Icon.tsx`
  + `CoinLogo` con fallback a monograma (`iconUrl` en `shared/lib/coinIcon.ts`).

> **Showcase (dev):** `GET /showcase` (solo dev, `notFound()` en prod, noindex)
> muestra cada primitivo en sus estados con toggle dark/light. Quitar al cerrar
> la revisión de fundaciones. *(En App Router `_showcase` sería carpeta privada
> sin ruta; por eso la URL es `/showcase`.)*

### Fase B — Páginas públicas de auth *(poca dependencia de datos)* ✅
- [x] `login`, `register`, `verify-email`, `forgot-password`. Shell *dark island*
  branded (card centrada + glow de marca) en el layout de `(auth)`; formas
  restiladas (título, error banner, notice, divider, links, submit full-width).
  Inputs crudos → primitivo `Input`. Wiring/i18n/tests intactos.
- [x] Estados: submit (loading en botón), error de credenciales/token (banner
  `role=alert`), notice de reenvío (`role=status`). (Empty no aplica.)

### Fase C — Core money pages *(acá pesan los estados)*
- [ ] `wallet` (balances, depósito, retiro), `swap`, `trading` (order book,
  mercados).
- [ ] Estados: skeletons de tablas/balances; empty (sin balances, sin órdenes,
  sin historial); error (red/precio); confirmaciones de operación.

### Fase D — Resto autenticado
- [ ] `dashboard`, `profile`, `p2p`, `admin`.

### Fase E — Pase transversal
- [ ] Auditoría responsive, auditoría a11y (foco/reduced-motion/contraste),
  consistencia de copy/voz, QA visual contra este estándar.

---

*Doc vivo: actualizar cuando la estética evolucione. El Home (`/`) es la
referencia viva — si algo acá y el Home difieren, gana el Home o se actualiza
este doc en el mismo commit.*
