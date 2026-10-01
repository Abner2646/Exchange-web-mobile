// backend/scripts/seedCatalogNoCustody.js
//
// Siembra el CATÁLOGO (criptos + pares de trading spot + pares de swap) SIN crear wallets maestras —
// es decir, SIN claves de custodia. Pensado para un MVP/beta donde los fondos se acreditan por el panel
// admin (no por depósitos on-chain). Los depósitos/retiros on-chain quedan deshabilitados hasta que se
// configure la custodia (KMS); crear una Crypto acá NO genera su MasterWallet.
//
// Es lo que hace seedInitialData.js PASO 1 (crear las Crypto) + PASO 2 (generar pares), pero saltándose
// el setup de wallets maestras que exige BTC_MNEMONIC/PRIVATE_KEY/XPUB (custodia real). Idempotente.
//
// Uso:  node scripts/seedCatalogNoCustody.js
require('dotenv').config();
const { sequelize, Crypto } = require('../models');
const { CRIPTOMONEDAS_BASICAS } = require('../modules/wallets/setupWallets.controller');
const swapPairController = require('../modules/swap/swapPair.controller');
const tradingPairsController = require('../modules/trading/tradingPairs.controller');

// res falso: captura status/json de los controllers (que esperan (req,res) de Express).
const makeRes = (label) => ({
  status: (code) => ({ json: (d) => console.log(`[${label}] status ${code}:`, d?.error || d?.message || '') }),
  json: (d) => console.log(`[${label}] OK:`, d?.message || (d?.data ? JSON.stringify(d.data).slice(0, 120) : 'done')),
});

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    // PASO 1 — crear las Crypto (sin wallets). findOrCreate = idempotente.
    console.log('\n--- PASO 1: Criptomonedas (sin wallets maestras) ---');
    let created = 0;
    for (const c of CRIPTOMONEDAS_BASICAS) {
      const [, wasCreated] = await Crypto.findOrCreate({
        where: { symbol: c.symbol },
        defaults: {
          symbol: c.symbol,
          name: c.name,
          network: c.network,
          decimals: c.decimals,
          contractAddress: c.contractAddress,
          active: true,
        },
      });
      if (wasCreated) created += 1;
    }
    console.log(`✅ Criptomonedas: ${created} nuevas (de ${CRIPTOMONEDAS_BASICAS.length})`);

    // PASO 2 — pares de swap (requiere ≥2 cryptos activas).
    console.log('\n--- PASO 2: Pares de swap ---');
    await swapPairController.generateAllPairs({}, makeRes('swap'));

    // PASO 3 — pares de trading spot (quote assets por defecto: USDT/USDC/BTC/ETH, fees 0.1/0.15).
    console.log('\n--- PASO 3: Pares de trading spot ---');
    await tradingPairsController.autoCreatePairs({ body: {} }, makeRes('trading'));

    // Resumen
    const { SwapPair, TradingPair } = require('../models');
    const [nc, ns, nt] = await Promise.all([Crypto.count(), SwapPair.count(), TradingPair.count()]);
    console.log('\n========================================');
    console.log(`📊 Criptomonedas: ${nc} | Pares swap: ${ns} | Pares trading: ${nt}`);
    console.log('========================================');
    console.log('🎉 Catálogo sembrado (sin custodia). Depósitos/retiros on-chain OFF hasta configurar KMS.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error sembrando catálogo:', error);
    process.exit(1);
  }
}

seed();
