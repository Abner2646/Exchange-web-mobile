// Records email sends instead of delivering them. Implements the subset of the
// real services/email.service.js interface that the auth flows call. Never
// touches SMTP. Reused across all auth etapas.
function createFakeEmailService() {
  const sent = [];
  const recordCode = (type) => async (email, codigo, username) => {
    sent.push({ type, email, codigo, username });
  };
  return {
    sent,
    enviarCodigoVerificacionEmail: recordCode('verificacion'),
    enviarCodigo2FA: recordCode('2fa'),
    enviarCodigoRecuperacion: recordCode('recuperacion'),
    notificarCambioPassword: async (email, username) => {
      sent.push({ type: 'cambioPassword', email, username });
    },
    notificar2FAChange: async (email, username, activado) => {
      sent.push({ type: '2faChange', email, username, activado });
    },
    lastCodeFor(email) {
      const hits = sent.filter((s) => s.email === email && s.codigo);
      return hits.length ? hits[hits.length - 1].codigo : undefined;
    },
    countFor(email, type) {
      return sent.filter((s) => s.email === email && (!type || s.type === type)).length;
    },
  };
}

module.exports = { createFakeEmailService };
