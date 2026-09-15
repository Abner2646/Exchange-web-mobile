// S3 layering/velocity: a withdrawal that is ≥ ratio × a recent same-asset deposit —
// funds passing straight through. Pure: the evaluator supplies the recent deposits.
const money = require('../../../utils/money');

module.exports = function s3({ withdrawalAmount, deposits, ratio }) {
  for (const d of deposits) {
    const floor = money.multiply(String(d.amount), String(ratio));
    if (money.compare(String(withdrawalAmount), floor) >= 0) {
      return {
        signalId: 'S3',
        severity: 'high',
        evidence: { withdrawalAmount: String(withdrawalAmount), matchedDepositId: d.id, matchedDepositAmount: String(d.amount), ratio: String(ratio) },
      };
    }
  }
  return null;
};
