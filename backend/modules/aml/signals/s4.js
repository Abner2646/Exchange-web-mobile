// S4: the same two parties trading P2P repeatedly (wash/collusion). Pure: the
// evaluator supplies the completed-count for the pair over the window.
module.exports = function s4({ count, threshold }) {
  if (count >= threshold) {
    return { signalId: 'S4', severity: 'medium', evidence: { count, threshold } };
  }
  return null;
};
