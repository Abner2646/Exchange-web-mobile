// tests/withdrawalProcessReentrancy.test.js
//
// Regresión del doble-gasto encontrado en la review del PR dev->main (2026-08-21):
// runWithdrawalProcessJob corre tanto por setInterval como por el endpoint manual
// /system/process-withdrawals, ambos sobre el MISMO singleton BlockchainJobManager,
// sin ningún guard de reentrancia. Dos corridas solapadas (overlap del intervalo, o
// manual + automático a la vez) seleccionaban las mismas filas 'pendiente' y
// transmitían el retiro on-chain dos veces = doble salida de la wallet maestra.
//
// Este test fuerza el solape y exige que el procesamiento por red ocurra una sola
// vez aunque se disparen dos corridas concurrentes.

// El job requiere ../models al tope; sin mock intenta conectar a Postgres.
jest.mock('../models', () => ({
  TransaccionBlockchain: {},
  DireccionDeposito: {},
  Criptomoneda: {},
  BlockchainState: {},
}));

// Servicio blockchain fake: processPendingWithdrawals es lento (para garantizar
// que las dos corridas se solapen) y contamos cada invocación real.
const mockProcessPending = jest.fn(async () => {
  await new Promise((resolve) => setTimeout(resolve, 25));
  return []; // sin retiros pendientes reales; solo importa la cuenta de llamadas
});
jest.mock('../services/blockchain', () => ({
  getService: () => ({ processPendingWithdrawals: mockProcessPending }),
}));

const jobManager = require('../jobs/blockchain.jobs');

describe('runWithdrawalProcessJob — guard de reentrancia (anti doble-gasto)', () => {
  const NETWORKS = 3; // ethereum, bsc, bitcoin

  beforeEach(() => {
    mockProcessPending.mockClear();
  });

  test('dos corridas concurrentes procesan cada red una sola vez, no dos', async () => {
    const run1 = jobManager.runWithdrawalProcessJob();
    const run2 = jobManager.runWithdrawalProcessJob(); // solapada: debe cortarse

    await Promise.all([run1, run2]);

    // Sin guard: 3 redes x 2 corridas = 6 broadcasts. Con guard: 3 (una corrida
    // procesa, la otra se saltea antes de tocar ninguna red).
    expect(mockProcessPending).toHaveBeenCalledTimes(NETWORKS);
  });

  test('una corrida posterior (no solapada) sí procesa: el flag se resetea al terminar', async () => {
    await jobManager.runWithdrawalProcessJob(); // primera corrida, completa
    mockProcessPending.mockClear();

    await jobManager.runWithdrawalProcessJob(); // segunda, secuencial: no debe quedar bloqueada

    expect(mockProcessPending).toHaveBeenCalledTimes(NETWORKS);
  });
});
