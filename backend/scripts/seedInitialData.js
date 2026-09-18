// backend/scripts/seedInitialData.js
require('dotenv').config();
const { sequelize, Crypto, MasterWallet, SwapPair, User } = require('../models');
const setupController = require('../modules/wallets/setupWallets.controller');
const parExchangeController = require('../modules/swap/swapPair.controller');
const { inicializarUsuarioCompleto } = require('../modules/users/user.controller');

async function seed() {
  try {
    console.log('🌱 --- INICIANDO SEED DE DATOS INICIALES ---');
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    // 1. Setup completo de criptomonedas y wallets maestras
    console.log('\n--- PASO 1: Creando criptomonedas y wallets maestras ---');
    let setupResponseData = null;
    const reqSetup = { body: { force: false } };
    const resSetup = {
      status: (code) => ({
        json: (data) => {
          console.log(`[setupWallets] status ${code}:`, data?.error || data?.message || data);
          setupResponseData = data;
        }
      }),
      json: (data) => {
        console.log('[setupWallets] OK:', data?.message || 'Setup completado');
        setupResponseData = data;
      }
    };

    await setupController.executeCompleteSetup(reqSetup, resSetup);

    // 2. Generar pares de intercambio (SwapPair)
    console.log('\n--- PASO 2: Generando pares de intercambio ---');
    const reqPairs = {};
    const resPairs = {
      status: (code) => ({
        json: (data) => console.log(`[generateAllPairs] status ${code}:`, data?.error || data)
      }),
      json: (data) => console.log('[generateAllPairs] OK:', data?.message || data?.data || data)
    };

    await parExchangeController.generateAllPairs(reqPairs, resPairs);

    // 3. Inicializar usuarios verificados existentes que no tengan billeteras
    console.log('\n--- PASO 3: Inicializando billeteras de usuarios verificados ---');
    const verifiedUsers = await User.findAll({ where: { emailVerified: true } });
    console.log(`Encontrados ${verifiedUsers.length} usuarios verificados`);

    for (const u of verifiedUsers) {
      const transaction = await sequelize.transaction();
      try {
        const initResult = await inicializarUsuarioCompleto(u, transaction);
        await transaction.commit();
        console.log(`✅ Usuario ${u.username} (${u.email}) provisionado con éxito:`, {
          direccionesCreadas: initResult?.direccionesCreadas?.length || 0,
          balancesCreados: initResult?.balancesCreados?.length || 0
        });
      } catch (err) {
        await transaction.rollback();
        console.warn(`⚠️ Usuario ${u.username} ya estaba provisionado o falló: ${err.message}`);
      }
    }

    // Resumen final de la base de datos
    const totalCryptos = await Crypto.count();
    const totalWallets = await MasterWallet.count();
    const totalPairs = await SwapPair.count();
    console.log('\n========================================');
    console.log(`📊 Total Criptomonedas: ${totalCryptos}`);
    console.log(`📊 Total Wallets Maestras: ${totalWallets}`);
    console.log(`📊 Total Pares de Trading: ${totalPairs}`);
    console.log('========================================\n');
    console.log('🎉 --- SEED COMPLETADO CON ÉXITO ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  }
}

seed();
