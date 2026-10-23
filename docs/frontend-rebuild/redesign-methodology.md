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

1. **La tech de la V2 se mantiene SIEMPRE.** No copiar la tech de la V1 ni
   "arreglar" contratos/flujos para que calcen con la V1.
2. **El visual de la V1 se reproduce siempre que se pueda.** Tocar la estética lo
   menos posible fuera de igualar la V1.
3. **Incongruencias / features nuevos de la V2** (cosas que la V1 no tenía — ej.
   wallets Funding/Spot, Maker-Checker, audit trail) → **decisión de diseño
   nueva** con los tokens del estándar. No hay V1 que copiar.
4. **Si el visual de la V1 choca con la tech segura de la V2**, por defecto gana
   la tech V2 — pero **es decisión del dueño (Abner)**. Preguntar con el
   trade-off explícito, no asumir.

> **Excepción vigente decidida por Abner:** el **botón de Google** usa el flujo
> **redirect** (`/auth/google`, OAuth server-side), no el widget idToken, porque
> el widget oficial es un iframe cuadrado no estilable. Es la excepción al punto
> 4. **No revertir.** (Caveat: el token viaja en la URL del callback.)

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

## 7. Pendientes / a decidir

- **Copy casing:** la V1 usa Title Case ("Iniciar Sesión"); la V2 usa sentence
  case por el estándar §8 ("Iniciar sesión"). **Sin decidir.** Si se quiere
  calcar la V1, es un cambio de copy transversal.
- **Posible bug de la V2 (no tocado):** el backend `loginStep1` lee
  `req.body.emailOrUsername` pero la V2 manda `{ email }` → entrar con usuario
  (y quizás el login normal) podría no andar. Reportado; decisión del dueño.
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
