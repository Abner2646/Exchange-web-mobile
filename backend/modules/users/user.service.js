const { User } = require('../../models');

class UserService {
  // `transaction` is optional so both callers work: the REST endpoint
  // (loginWithGoogle) passes its transaction so the user row is created in the
  // SAME transaction as provisioning — a failed inicializarUsuarioCompleto then
  // rolls back the user too, instead of leaving an orphaned, half-provisioned
  // account. The passport callback passes nothing → autocommit (unchanged).
  async findOrCreateGoogleUser(profile, transaction = null) {
    // Security gate: Google must have verified this email. Without it, a validly
    // handed profile for an unverified/alias email could link to (and take over)
    // a pre-existing password account via the link-by-email branch below. This is
    // the single choke point BOTH the REST endpoint (loginWithGoogle) and the
    // passport callback funnel through, so the check lives here once — closing the
    // passport path too. Legit Gmail logins always carry email_verified:true
    // (passport-google-oauth20 exposes it as emails[0].verified).
    if (!profile.emails?.[0]?.verified) {
      throw new Error('El email de la cuenta de Google no está verificado');
    }

    // Buscar por googleId
    let existingUser = await User.findOne({
      where: { googleId: profile.id },
      transaction,
    });

    if (existingUser) {
      // ⭐ ASEGURAR que el email esté verificado
      if (!existingUser.emailVerified) {
        await existingUser.update({ emailVerified: true }, { transaction });
        console.log('✅ emailVerified actualizado a true para usuario existente de Google');
      }

      return {
        ...existingUser.dataValues,
        isNewUser: false
      };
    }

    // Buscar por email
    let userByEmail = await User.findOne({
      where: { email: profile.emails[0].value },
      transaction,
    });

    if (userByEmail) {
      // ⭐ Vincular cuenta con Google y verificar email
      await userByEmail.update({
        googleId: profile.id,
        emailVerified: true // ⭐ CRÍTICO: Verificar email al vincular con Google
      }, { transaction });
      console.log('✅ User existente vinculado con Google y email verificado');

      return {
        ...userByEmail.dataValues,
        googleId: profile.id, // Asegurar que el objeto retornado tenga googleId actualizado
        emailVerified: true,
        isNewUser: false
      };
    }

    // Crear nuevo usuario de Google
    const newUser = await User.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      username: profile.displayName || profile.emails[0].value.split('@')[0],
      country: 'AR',
      role: 'normal',
      passwordHash: null,
      emailVerified: true, // ⭐ CRÍTICO: Google ya verificó el email
      active: true,
    }, { transaction });

    console.log('✅ Nuevo usuario de Google creado con email verificado');

    return {
      ...newUser.dataValues,
      isNewUser: true
    };
  }
}

module.exports = new UserService();