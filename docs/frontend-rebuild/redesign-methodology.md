# Metodología del rediseño del frontend

> Cómo trabajamos el rehacer del frontend. Esto es el **proceso y las reglas**;
> la *estética* (tokens, componentes, estados) vive en
> [`aesthetic-standard.md`](./aesthetic-standard.md). Leé los dos antes de tocar.

---

## 1. Las dos bases de código (y de qué es fuente de verdad cada una)

| | Qué es | Fuente de verdad de |
|---|---|---|
| **V1** | El CRA original en `design-reference/legacy-cra/` (`src/pages/*.jsx` + `src/styles/*.css`) | **Lo VISUAL**: layout, copy, orden de elementos, qué features ve/usa la persona |
| **V2** | El app Next actual (`web/`), ya en producción | **Lo TÉCNICO**: cómo conecta al backend, contratos de API, sesión/tokens, flujos de auth, seguridad |

La V2 está bien construida y es segura; la V1 es la referencia de *look & feel*.

---

## 2. Regla de oro (no negociable)

0. **El backend es la fuente de verdad última.** El backend NO se toca en estas
   sesiones. Si el front (V1 **o** V2) no habla bien con el contrato real del
   backend, **se adapta el front** — aunque el cambio vaya más allá de lo
   estético (ej.: la V2 mandaba `{ email }` y el backend espera
   `emailOrUsername` → se arregla el front). "Mantener la tech de la V2" significa
   mantener su stack seguro, no perpetuar un front que contradice al backend.
1. **La tech de la V2 se mantiene SIEMPRE.** No copiar la tech de la V1 ni
   "arreglar" contratos/flujos del backend para que calcen con la V1. (Ajustar el
   **front** para cumplir el contrato del backend sí está permitido — ver punto 0.)
2. **El visual de la V1 se reproduce siempre que se pueda.** Tocar la estética lo
   menos posible fuera de igualar la V1.
3. **Divergencias** → ver §2.1 (tres casos). No todas se resuelven igual.
4. **Si el visual de la V1 choca con la tech segura de la V2**, por defecto gana
   la tech V2 — pero **es decisión del dueño (Abner)**. Preguntar con el
   trade-off explícito, no asumir.

> **Excepción vigente decidida por Abner:** el **botón de Google** usa el flujo
> **redirect** (`/auth/google`, OAuth server-side), no el widget idToken, porque
> el widget oficial es un iframe cuadrado no estilable. Es la excepción al punto
> 4. **No revertir.** (Caveat: el token viaja en la URL del callback.)

---

## 2.1 Los tres casos de divergencia (V1 ≠ V2)

Cuando la V1 y la V2 no coinciden, **no es siempre el mismo problema**. Antes de
decidir, clasificar en cuál de los tres casos cae — se resuelven distinto:

- **Caso A — mismo feature, cambió el mecanismo interno.** La persona ve y usa lo
  mismo; solo cambió cómo se ejecuta por detrás. *Ej.: login con Google* (idToken
  widget en V1 → redirect OAuth en V2). → **Calcar el visual de la V1, mantener el
  mecanismo de la V2.** El split V1-visual / V2-tech funciona limpio. Es la mayoría
  de los casos.
- **Caso B — cambió el feature / el dominio.** La V1 *tenía* una pantalla para
  esto, pero el producto cambió de forma, así que copiarla mostraría algo que ya
  no existe. *Ej.: wallet* — la V1 tenía **una sola** billetera; la V2 tiene
  **Funding + Spot**, con disponible/bloqueado/pendiente, transferencia entre
  compartimentos y retiros solo desde Funding. → La V1 **deja de ser referencia de
  layout** (a lo sumo inspira el lenguaje visual); el layout se **rediseña
  alrededor del modelo nuevo** con los tokens del estándar. La trampa es dejarse
  llevar por la pantalla vieja y mentir sobre el producto actual.
- **Caso C — feature nuevo que la V1 nunca tuvo.** *Ej.: Maker-Checker, audit
  trail, 2FA TOTP.* No hay V1 que copiar → **diseño nuevo** con el estándar.

Regla práctica: ante una divergencia, preguntar **"¿la persona ve/usa lo mismo?"**
Sí → Caso A (calcar). No, porque el producto cambió → Caso B (rediseñar). No
existía → Caso C (diseñar).

---

## 3. Proceso por página (Fases B–E)

Para CADA página, en este orden:

1. **Leer la V1** correspondiente (`design-reference/legacy-cra/src/pages/…` +
   su `.css`). Listar features + layout + copy.
2. **Diffear contra la V2**: qué tiene la V2, qué le falta vs V1, qué es nuevo.
3. **Aplicar SOLO lo visual** sobre los componentes/tech de la V2: layout, copy,
   orden, placeholders, estados, usando primitivos (`@/shared/ui`) y tokens.
   - Inputs crudos → primitivo `Input`. Nada de hex hardcodeado.
4. **Features nuevos de la V2** → diseñarlos con el estándar.
5. **Si algo exige tocar tech** (contrato, wiring, flujo) → **parar y preguntar**;
   si parece un bug de la V2, **reportarlo, no arreglarlo** como parte del visual.
6. **Verificar** (sección 4) y recién ahí dar por hecha la página — con una
   **lista de gaps** explícita, no un "listo" a secas.

---

## 4. Disciplina de verificación (gates por chunk)

Desde `web/`:
- `npm run typecheck` limpio.
- `npx vitest run --pool=forks <ruta>` verde (y la suite completa antes de
  commitear algo transversal). Mantener/actualizar tests; no romper selectores
  (`getByLabelText`, roles).
- Render real: la página responde 200 y se ve bien. **Comparar elemento por
  elemento contra la V1** antes de decir que está.
- Commits Conventional en inglés, `git add` explícito por archivo (nunca `-A`),
  sin atribución a Claude.

**No sobre-afirmar.** "Listo" solo tras comparar contra V1 y, si el dueño la
revisa, con su OK. Siempre dar la lista de lo que falta/difiere.

---

## 5. Disciplina de entorno / ops (Windows)

- **Un solo dev server, en el puerto 3000.** No levantar dev servers en puertos
  random para "probar".
- **NUNCA `rm -rf .next` con un dev server corriendo** — le corrompe el build al
  server vivo (da 404 en home y páginas viejas). Si hay que limpiar `.next`,
  frenar el dev primero.
- **Matar procesos con PowerShell, no `pkill`** — `pkill` en Git Bash NO mata los
  procesos node de Windows (deja zombies). Usar `Get-CimInstance Win32_Process` +
  `Stop-Process`, y verificar el puerto con `Get-NetTCPConnection -LocalPort`.
- **No `cd` dentro de comandos** — el cwd del shell persiste entre llamadas. Un
  `cd` a la raíz deja comandos posteriores corriendo desde el lugar equivocado
  (ej. vitest escaneando `design-reference/`). Usar rutas absolutas o `git -C`.
- **`.next/types` stale**: al borrar una ruta, tsc puede fallar por tipos viejos
  en `.next/types/...`; `rm -rf web/.next/types` y re-chequear.
- **vitest + next/font**: importar `next/font/google` cuelga vitest; ya hay alias
  a `web/test/next-font-google.stub.ts`. Fuente nueva → agregar export al stub.
  Correr con `--pool=forks`.
- **Local no proxya `/api`**: `next.config.mjs` no tiene rewrites. En `npm run
  dev` las llamadas a `/api` pegan al 3000, no al backend (3001). Para que
  funcione el backend en local hay que setear `NEXT_PUBLIC_API_URL` al backend
  (y, para Google, el `FRONTEND_URL` del backend → `http://localhost:3000`). En
  prod (nginx, mismo origen) funciona solo. **El look se puede revisar sin esto;
  la funcionalidad no.**

---

## 6. Decisiones tomadas (log)

- **Tema: dark + light.** Light por defecto; sigue el SO vía `prefers-color-scheme`;
  `data-theme` en `<html>` lo fuerza. Auth y Home son *dark island*
  (`data-theme="dark"`). Mecanismo: valores por tema (no `light-dark()`).
- **Un solo desplegable:** el `Select` custom (listbox accesible). Nunca
  `<select>` nativo (panel no estilable). `NativeSelect` fue eliminado.
- **Scrollbars temáticos** globales (en `reset.css`).
- **Google = flujo redirect** (ver excepción §2).
- **Textarea** no redimensionable (alto fijo).
- **Modelo de divergencias A/B/C** (§2.1): clasificar toda V1≠V2 antes de resolver.
- **Backend = fuente de verdad última** (§2.0): nunca se toca; el front se adapta
  al contrato aunque no sea estético.
- **Copy casing = Title Case (V1)** en superficies con equivalente V1 (auth, app).
  Se calca el casing de la V1 ("Iniciar Sesión", "Crear Cuenta"). El estándar §8
  se actualizó. El **Home de marketing** no tiene equivalente V1 → queda como está.
- **Login field:** la V2 manda `emailOrUsername` (no `{ email }`) para cumplir el
  contrato del backend `loginStep1` (Caso del §2.0: adaptar el front).

## 7. Pendientes / a decidir

- **Google loop en local:** requiere el wiring de env de §5.

---

## 8. Lecciones de las primeras sesiones (errores a NO repetir)

Esto pasó y costó retrabajo y confianza. Está acá para que no vuelva a pasar:

1. **No mirar la V1.** Se restiló la V2 asumiendo que su Home/estándar reflejaba
   la V1 — y ya había divergido (se inventó un punto azul, se perdió el botón de
   Google y el login con email-o-usuario). → **Siempre leer la V1 primero
   (§3.1).**
2. **Cruzar de lo visual a lo técnico.** Para calcar la V1 se cambió el mecanismo
   de Google y el contrato de login. Hubo que revertir. → **El visual no toca
   tech (§2, §3.5).**
3. **Sobre-afirmar "listo".** Se marcó el login como terminado con gaps visibles
   (sin placeholders, sin asteriscos, Google oculto en local). El dueño lo
   detectó dos veces. → **Lista de gaps + comparación contra V1 antes de decir
   hecho (§4).**
4. **Romper el dev del dueño.** Se corrió `rm -rf .next` con el server del dueño
   vivo en 3000 y se dejaron ~30 procesos zombie (los `pkill` no mataban nada en
   Windows). → **Disciplina de ops (§5).**
5. **Simplificar mal un trade-off de seguridad.** Se le dijo al dueño que el
   botón custom de Google era "menos seguro", cuando el flujo redirect también
   es seguro (con un caveat menor). Eso sesgó una decisión. → **Presentar
   trade-offs reales y completos, no versiones simplificadas.**

---

## 9. Estado actual (snapshot)

En `dev` (local, sin pushear). Fase A (fundaciones) ✅. Páginas:
- `/` (Home) ✅ · `/login` ✅ (visual V1 sobre tech V2).
- `/register`, `/verify-email`, `/forgot-password`: restiladas en Fase B pero
  **sin** el pase de paridad V1 → **pendientes**.
- `/wallet`, `/swap`, `/trading`, `/dashboard`, `/profile`, `/p2p`, `/admin`:
  sin tocar (Fases C/D).
- `/showcase`: galería de primitivos, **solo dev** (404 en prod).

Memoria viva relacionada: `frontend-v1-parity`, `frontend-aesthetic-standard`,
`frontend-nextjs-migration`.
