# Prompt — próxima sesión (rediseño frontend, Fase B cont.)

> Pegá esto al arrancar. Supersede a `next-session-design-prompt.md` y
> `next-session-redesign-prompt.md` (viejos, untracked).

## Rol y contexto

Sos Claude Code en `crypto_exchange` (exchange custodial, audit-grade, EE.UU.;
dueño: Abner). **Chat en español; código/commits/PRs en inglés**, Conventional
Commits, **sin** atribución a Claude. Trabajás en la rama **`dev`** (local, el
rediseño vive sin pushear). No tocar money-path ni backend.

Estás rehaciendo el frontend. Hay dos bases: **V1** = CRA original en
`design-reference/legacy-cra/` (fuente de verdad **visual**), y **V2** = el Next
actual en `web/` (en prod; fuente de verdad **técnica/segura**).

## Lectura obligatoria antes de tocar nada

1. `docs/frontend-rebuild/redesign-methodology.md` — **el proceso y las reglas**
   (incluye la disciplina de ops de Windows y los errores a no repetir).
2. `docs/frontend-rebuild/aesthetic-standard.md` — la estética (tokens,
   componentes, estados, a11y).
3. Memorias: `frontend-v1-parity`, `frontend-aesthetic-standard`.

## Regla de oro (resumen)

- **Tech de la V2 SIEMPRE** (segura). **Visual de la V1 siempre que se pueda.**
- **Features nuevos de la V2** = decisión de diseño con tokens.
- **Conflicto visual-vs-tech** = lo decide Abner, con el trade-off explícito. No
  asumir, no cruzar a lo técnico para calcar la V1.
- **Excepción vigente (no revertir):** Google usa el flujo **redirect**
  (`/auth/google`) con botón custom, no el widget idToken.

## Proceso por página

Leer la V1 → diffear vs V2 → aplicar SOLO lo visual sobre los componentes/tech de
la V2 (primitivos `@/shared/ui`, tokens; inputs → `Input`) → features nuevos se
diseñan → si algo exige tocar tech, **parar y preguntar / reportar bug** →
verificar → dar la **lista de gaps** (no "listo" a secas).

## Estado al cerrar la sesión anterior

Fase A ✅. `/` (Home) ✅. `/login` ✅ (visual V1 sobre tech V2: botón Google
redirect idéntico a V1, placeholders, asteriscos de requerido, 2FA 6 dígitos,
volver-al-login, sin punto azul).

**Pendiente (tu tarea):** aplicar paridad V1 a las otras 3 de auth, que hoy están
restiladas genéricas pero sin mirar la V1:
- `/register` → V1 `src/pages/Register.jsx` + `styles/Register.css`. Trae: botón
  Google (el mismo `GoogleSignInButton`) + divisor, **confirmar contraseña**
  (validación de coincidencia en cliente, SIN tocar el contrato de registro),
  validación por campo, mensaje de términos, footer de login, descripciones,
  placeholders, asteriscos.
- `/verify-email` → repasar contra la V1.
- `/forgot-password` → la V1 lo parte en 2 rutas (`/forgot-password` →
  `/reset-password?email=`); revisar layout/copy (pero la tech de reset de la V2
  es multi-step: **mantener la tech V2**, igualar solo el look).

Después: Fase C (wallet/swap/trading), Fase D (dashboard/profile/p2p/admin),
Fase E (pase transversal a11y/responsive/copy).

## Decisiones abiertas (preguntar si aplica)

- **Copy casing**: V1 Title Case vs V2 sentence case (estándar §8). Sin decidir.
- **Posible bug V2**: backend `loginStep1` lee `emailOrUsername` pero la V2 manda
  `{ email }`. Reportado, no corregido. Decisión de Abner.

## Gotchas de ops (Windows) — críticos

- **Un solo dev server en :3000.** NUNCA `rm -rf .next` con el dev corriendo.
- Matar procesos con **PowerShell** (`Stop-Process`), no `pkill` (no funciona).
  Verificar con `Get-NetTCPConnection -LocalPort 3000`.
- **No `cd` dentro de comandos** (el cwd persiste; corré desde `web/` con rutas
  relativas o `git -C`).
- `.next/types` stale tras borrar rutas → `rm -rf web/.next/types`.
- vitest con `--pool=forks`; `next/font` ya tiene stub.
- Local no proxya `/api` (sin rewrites): el backend en local necesita
  `NEXT_PUBLIC_API_URL`; el look se revisa igual sin eso.

## Primer paso sugerido

`git fetch origin` y confirmar rama/freshness. Levantar `cd web && npm run dev`
(:3000). Arrancar por `/register` siguiendo el proceso por página. Verificar
(typecheck + vitest + render + diff contra V1) y commitear por chunk.
