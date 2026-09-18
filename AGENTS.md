# AGENTS.md — Protocolo de Inducción para Agentes de IA

> **ESTE ARCHIVO ES DE LECTURA OBLIGATORIA.**  
> Cualquier agente de IA (Antigravity, Claude Code, Cursor, Gemini CLI, etc.) **DEBE** leer este archivo y seguir su orden de lectura antes de proponer cambios, escribir código o responder consultas sobre el proyecto.

---

## 1. Misión Crítica: Sistema Productivo con Dinero Real

Este exchange **NO es un proyecto de portfolio ni una simulación**.  
Es una plataforma financiera que **se desplegará en producción y custodiará fondos y dinero real de usuarios**.

### Principios No Negociables
1. **Cero tolerancia a errores numéricos:** Nunca uses `parseFloat` o `Number` sobre dinero. Toda operación aritmética y persistencia monetaria se realiza exclusivamente mediante [`backend/utils/money.js`](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/backend/utils/money.js) (`decimal.js` con redondeo bancario half-even).
2. **Contabilidad de Partida Doble Inmutable:** Los balances nunca se mutan con `UPDATE` directo. Todo movimiento se registra en el ledger append-only (`ledger_postings`) y las transacciones deben sumar cero (`sum == 0`).
3. **Idempotencia Obligatoria:** Todo endpoint que mueva fondos exige el header `Idempotency-Key` y comitea la clave atómicamente dentro de la misma transacción DB que mueve los fondos (`finalizeInTransaction`).
4. **Sincronización Total Full-Stack:** Cualquier capacidad o cambio existente en el Backend **debe tener su correlato visible en el Frontend y Mobile** (por ejemplo: billeteras compartimentadas Funding/Spot, switch de redes, verificación de email, etc.).
5. **Envoltura Canónica de Errores:** Todos los endpoints devuelven `{ error: { code: "CODIGO_ESTABLE", message: "..." } }`. El cliente debe ramificar por `code`, nunca por el texto del mensaje.

---

## 2. Orden Obligatorio de Lectura para Agentes

Antes de comenzar cualquier tarea, leé los documentos en este orden exacto:

1. [**`PROJECT_VISION.md`**](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/PROJECT_VISION.md):  
   Filosofía de ingeniería, modelo de custodia, alcance de producción y reglas de negocio.
2. [**`ROADMAP.md`**](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/ROADMAP.md):  
   El Roadmap General Unificado. Muestra el estado actual y la correlación directa entre Backend, Frontend y Mobile por cada hito de producto.
3. **El README técnico del área donde vas a trabajar:**
   * Backend: [**`backend/README.md`**](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/backend/README.md)
   * Frontend Web: [**`frontend/README.md`**](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/frontend/README.md)
   * Mobile: [**`mobile/README.md`**](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/mobile/README.md)
4. **Contratos de API vigentes:**
   * Cambios de contrato y breaking changes: [**`docs/frontend-rebuild/backend-contract-changes.md`**](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/docs/frontend-rebuild/backend-contract-changes.md)
   * Especificación interactiva OpenAPI: `http://localhost:5000/api-docs` (o anotaciones `@openapi` en rutas).

---

## 3. Convenciones de Idioma y Git

* **Comunicación con el usuario:** Español fluido, técnico y directo.
* **Código e identificadores:** Estrictamente en **inglés** (variables, funciones, modelos, nombres de endpoints, commits).
* **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) en inglés: `type(scope): description`.
  * Tipos válidos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `security`, `perf`, `ci`.
  * Sin atribuciones automáticas de IA ni co-authors.
* **Verificación antes de finalizar:** Nunca asumas que algo funciona. Corre los tests (`npm test`, `npm run test:integration` o `npm run build`) y verifica el resultado antes de reportar tarea cumplida.
