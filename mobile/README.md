# Mobile App — Arquitectura Técnica y Guía de Desarrollo

> **Ubicación:** `mobile/`  
> **Stack:** React Native / Expo, TypeScript, Axios, React Navigation.  
> **Referencia de Contratos:** [**`docs/frontend-rebuild/backend-contract-changes.md`**](file:///C:/Users/Abner/Desktop/Exchange-web-mobile/docs/frontend-rebuild/backend-contract-changes.md).

---

## 1. Misión de la Aplicación Mobile

La aplicación móvil proporciona a los usuarios una experiencia ágil, segura y optimizada para operar en el exchange desde cualquier dispositivo iOS o Android.

Comparte exactamente los mismos contratos, reglas de seguridad y modelos contables que la aplicación web:
* Múltiples billeteras (Billetera Fondos y Billetera Spot).
* Soporte para `Idempotency-Key` en transferencias, retiros, compras y swaps.
* Consumo canónico de montos en strings exactos de 8 decimales.
* Envoltura canónica de errores `{ error: { code, message } }`.

---

## 2. Pantallas Principales

1. **Autenticación y Seguridad:** Login con 2FA, registro con verificación de email por código, recuperación de contraseña y cambio de email con cooldown de retiros.
2. **Billeteras y Fondos:** Vista consolidada de balance con desglose en pestañas:
   * **Fondos:** Generación de código QR para depósito on-chain, formulario de retiro con advertencias de confirmaciones y saldo disponible.
   * **Spot:** Consulta de saldo disponible y bloqueado en órdenes abiertas.
   * **Transferir:** Modal intuitivo para transferir saldo entre Fondos y Spot al instante.
3. **Swap (Conversión):** Widget de intercambio rápido con cotización en tiempo real.
4. **Trading Spot:** Gráfico simplificado, libro de órdenes compacto y formulario de órdenes Limit/Market.
5. **Mercado P2P:** Explorador de anuncios con filtros por método de pago fiat local y flujo guiado de custodia temporal (escrow).

---

## 3. Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor Expo
npx expo start

# Ejecutar en emulador Android
npx expo run:android

# Ejecutar en simulador iOS
npx expo run:ios
```
