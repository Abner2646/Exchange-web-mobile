// backend/scripts/seedLogosAndPaymentMethods.js
//
// Completa el catálogo visual/operativo (idempotente, sin custodia):
//   1. icon_url de cada cripto → logo desde un CDN. spothq/cryptocurrency-icons (SVG) donde existe;
//      coincap (PNG) para los que spothq no tiene (SHIB/PEPE/ARB/OP, verificados 200).
//   2. payment_methods (formas de pago P2P) → set internacional + LatAm.
//
// Uso:  doppler run -- node scripts/seedLogosAndPaymentMethods.js   (en el server; en local: node ... con .env)
require('dotenv').config();
const { sequelize, Crypto } = require('../models');

// spothq no tiene estos símbolos → coincap PNG.
const COINCAP_FALLBACK = new Set(['SHIB', 'PEPE', 'ARB', 'OP']);
function logoUrl(symbol) {
  const s = symbol.toLowerCase();
  return COINCAP_FALLBACK.has(symbol.toUpperCase())
    ? `https://assets.coincap.io/assets/icons/${s}@2x.png`
    : `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${s}.svg`;
}

// Formas de pago P2P (name único, description, active).
const PAYMENT_METHODS = [
  { name: 'Transferencia bancaria', description: 'Transferencia entre cuentas bancarias (SWIFT/ACH/local)' },
  { name: 'Zelle', description: 'Pago instantáneo Zelle (US)' },
  { name: 'PayPal', description: 'Pago vía PayPal' },
  { name: 'Wise', description: 'Transferencia internacional vía Wise (ex-TransferWise)' },
  { name: 'Revolut', description: 'Transferencia vía Revolut' },
  { name: 'Mercado Pago', description: 'Pago vía Mercado Pago (LatAm)' },
  { name: 'Binance Pay', description: 'Transferencia vía Binance Pay' },
  { name: 'Skrill', description: 'Pago vía Skrill' },
  { name: 'Efectivo', description: 'Depósito o entrega en efectivo' },
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la DB');

    // 1) Logos — solo donde falta (idempotente, no pisa uno ya seteado).
    const cryptos = await Crypto.findAll();
    let updated = 0;
    for (const c of cryptos) {
      if (!c.iconUrl) {
        await c.update({ iconUrl: logoUrl(c.symbol) });
        updated += 1;
      }
    }
    console.log(`✅ Logos: ${updated} actualizados (de ${cryptos.length} criptos)`);

    // 2) Payment methods — findOrCreate por name (idempotente).
    const PaymentMethod = sequelize.models.PaymentMethod;
    let pmCreated = 0;
    for (const pm of PAYMENT_METHODS) {
      const [, created] = await PaymentMethod.findOrCreate({
        where: { name: pm.name },
        defaults: { name: pm.name, description: pm.description, active: true },
      });
      if (created) pmCreated += 1;
    }
    console.log(`✅ Formas de pago: ${pmCreated} nuevas (de ${PAYMENT_METHODS.length})`);

    const [nIcons, nPm] = await Promise.all([
      Crypto.count({ where: { iconUrl: { [require('sequelize').Op.ne]: null } } }),
      PaymentMethod.count(),
    ]);
    console.log(`\n📊 Criptos con logo: ${nIcons}/${cryptos.length} | Formas de pago: ${nPm}`);
    console.log('🎉 Listo (logos + formas de pago).');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}

seed();
