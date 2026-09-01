// scripts/cleanup-stuck-transactions.js - Eliminar transacciones problemáticas de balance check
require('dotenv').config();
const { TransaccionBlockchain } = require('../models');
const { Op } = require('sequelize');

class BalanceCheckCleanup {
  constructor() {
    this.dryRun = process.argv.includes('--dry-run');
    this.verbose = process.argv.includes('--verbose');
  }

  async run() {
    console.log('🧹 =================== LIMPIEZA DE BALANCE CHECKS ===================');
    console.log(`📋 Modo: ${this.dryRun ? 'SIMULACIÓN (--dry-run)' : 'EJECUCIÓN REAL'}`);
    console.log(`📋 Verbose: ${this.verbose ? 'SÍ' : 'NO'}`);
    console.log('');

    try {
      const results = await this.findProblematicTransactions();
      
      if (results.total === 0) {
        console.log('✅ No se encontraron transacciones problemáticas de balance check');
        return;
      }

      console.log(`🔍 ENCONTRADAS ${results.total} transacciones problemáticas:`);
      console.log(`   - ETH balance checks: ${results.eth.length}`);
      console.log(`   - BSC balance checks: ${results.bsc.length}`);
      console.log(`   - BTC balance checks: ${results.btc.length}`);
      console.log('');

      if (this.verbose) {
        this.logTransactionDetails(results);
      }

      if (!this.dryRun) {
        await this.cleanupTransactions(results);
      } else {
        console.log('🚧 SIMULACIÓN - No se realizaron cambios reales');
      }

    } catch (error) {
      console.error('❌ Error durante la limpieza:', error.message);
      process.exit(1);
    }
  }

  async findProblematicTransactions() {
    const ethBalanceChecks = await TransaccionBlockchain.findAll({
      where: {
        txHash: {
          [Op.like]: 'eth_balance_%'
        }
      },
      include: [
        {
          model: require('../models').Usuario,
          as: 'usuario',
          attributes: ['id', 'email']
        },
        {
          model: require('../models').Criptomoneda,
          as: 'criptomoneda',
          attributes: ['id', 'symbol', 'red']
        }
      ]
    });

    const bscBalanceChecks = await TransaccionBlockchain.findAll({
      where: {
        txHash: {
          [Op.like]: 'bsc_balance_%'
        }
      },
      include: [
        {
          model: require('../models').Usuario,
          as: 'usuario',
          attributes: ['id', 'email']
        },
        {
          model: require('../models').Criptomoneda,
          as: 'criptomoneda',
          attributes: ['id', 'symbol', 'red']
        }
      ]
    });

    const btcBalanceChecks = await TransaccionBlockchain.findAll({
      where: {
        txHash: {
          [Op.like]: 'balance_%'
        }
      },
      include: [
        {
          model: require('../models').Usuario,
          as: 'usuario',
          attributes: ['id', 'email']
        },
        {
          model: require('../models').Criptomoneda,
          as: 'criptomoneda',
          attributes: ['id', 'symbol', 'red']
        }
      ]
    });

    return {
      eth: ethBalanceChecks,
      bsc: bscBalanceChecks,
      btc: btcBalanceChecks,
      total: ethBalanceChecks.length + bscBalanceChecks.length + btcBalanceChecks.length
    };
  }

  logTransactionDetails(results) {
    console.log('📋 DETALLES DE TRANSACCIONES PROBLEMÁTICAS:');
    console.log('');

    if (results.eth.length > 0) {
      console.log('🔍 ETH Balance Checks:');
      results.eth.forEach(tx => {
        console.log(`   ID: ${tx.id} | User: ${tx.usuario?.email || 'N/A'} | Cantidad: ${tx.cantidad} | Estado: ${tx.estado}`);
        console.log(`   Hash: ${tx.txHash}`);
        console.log('   ---');
      });
    }

    if (results.bsc.length > 0) {
      console.log('🔍 BSC Balance Checks:');
      results.bsc.forEach(tx => {
        console.log(`   ID: ${tx.id} | User: ${tx.usuario?.email || 'N/A'} | Cantidad: ${tx.cantidad} | Estado: ${tx.estado}`);
        console.log(`   Hash: ${tx.txHash}`);
        console.log('   ---');
      });
    }

    if (results.btc.length > 0) {
      console.log('🔍 BTC Balance Checks:');
      results.btc.forEach(tx => {
        console.log(`   ID: ${tx.id} | User: ${tx.usuario?.email || 'N/A'} | Cantidad: ${tx.cantidad} | Estado: ${tx.estado}`);
        console.log(`   Hash: ${tx.txHash}`);
        console.log('   ---');
      });
    }

    console.log('');
  }

  async cleanupTransactions(results) {
    console.log('🗑️ INICIANDO LIMPIEZA REAL...');
    
    const transaction = await require('../models').sequelize.transaction();
    
    try {
      const allTransactions = [...results.eth, ...results.bsc, ...results.btc];
      const affectedUsers = new Set();
      
      // Recopilar información antes de eliminar
      for (const tx of allTransactions) {
        affectedUsers.add({
          userId: tx.userId,
          criptomonedaId: tx.criptomonedaId,
          email: tx.usuario?.email,
          symbol: tx.criptomoneda?.symbol
        });
      }

      // 1. Eliminar transacciones problemáticas
      const deletedCount = await TransaccionBlockchain.destroy({
        where: {
          id: {
            [Op.in]: allTransactions.map(tx => tx.id)
          }
        },
        transaction
      });

      console.log(`✅ ${deletedCount} transacciones eliminadas`);

      // Write-flip (Paso B/C): el viejo "recalcular balances afectados" recomputaba
      // balances_users sumando tx (con Number, saltándose money.js) — obsoleto: el
      // saldo es el ledger de partida doble, no una fila mutable derivada de tx. Las
      // tx problemáticas eran balance-checks fantasma que nunca postearon dinero, así
      // que borrarlas no afecta el ledger. La verificación de saldos es la
      // reconciliación del ledger (reconciliarInterno/Externo).

      await transaction.commit();
      
      console.log('');
      console.log('✅ =================== LIMPIEZA COMPLETADA ===================');
      console.log(`✅ Transacciones eliminadas: ${deletedCount}`);
      console.log(`✅ Usuarios afectados: ${affectedUsers.size}`);
      console.log('');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error durante la limpieza:', error.message);
      throw error;
    }
  }

}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const cleanup = new BalanceCheckCleanup();
  cleanup.run()
    .then(() => {
      console.log('🏁 Script finalizado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script falló:', error.message);
      process.exit(1);
    });
}

module.exports = BalanceCheckCleanup;