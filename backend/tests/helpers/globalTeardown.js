module.exports = async () => {
  await require('./db').globalTeardown();
};
