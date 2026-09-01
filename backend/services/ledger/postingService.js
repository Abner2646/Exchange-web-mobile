const money = require('../../utils/money');

// Invariante de partida doble: dentro de un asiento, la suma con signo de los
// montos debe dar 0 POR CADA cripto (un swap cruza dos criptos y cada una
// cuadra sola).
function validarSumaCero(lineas) {
  const porCripto = {};
  for (const l of lineas) {
    porCripto[l.criptomonedaId] = money.add(porCripto[l.criptomonedaId] || '0', String(l.monto));
  }
  for (const [criptomonedaId, suma] of Object.entries(porCripto)) {
    if (money.compare(suma, '0') !== 0) {
      throw new Error(`Asiento desbalanceado en cripto ${criptomonedaId}: suma ${suma}`);
    }
  }
}

module.exports = { validarSumaCero };
