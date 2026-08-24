module.exports = async () => {
  await require('./db').globalSetup();
};
