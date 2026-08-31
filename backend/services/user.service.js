const { Usuario } = require('../models');

class UserService {
  // `transaction` is optional so both callers work: the REST endpoint
  // (loginWithGoogle) passes its transaction so the user row is created in the
  // SAME transaction as provisioning — a failed inicializarUsuarioCompleto then
  // rolls back the user too, instead of leaving an orphaned, half-provisioned
  // account. The passport callback passes nothing → autocommit (unchanged).
  async findOrCreateGoogleUser(profile, transaction = null) {
    // Buscar por googleId
    let existingUser = await Usuario.findOne({
      where: { googleId: profile.id },
      transaction,
    });

    if (existingUser) {
      // ⭐ ASEGURAR que el email esté verificado
      if (!existingUser.emailVerificado) {
        await existingUser.update({ emailVerificado: true }, { transaction });
        console.log('✅ emailVerificado actualizado a true para usuario existente de Google');
      }

      return {
        ...existingUser.dataValues,
        isNewUser: false
      };
    }

    // Buscar por email
    let userByEmail = await Usuario.findOne({
      where: { email: profile.emails[0].value },
      transaction,
    });

    if (userByEmail) {
      // ⭐ Vincular cuenta con Google y verificar email
      await userByEmail.update({
        googleId: profile.id,
        emailVerificado: true // ⭐ CRÍTICO: Verificar email al vincular con Google
      }, { transaction });
      console.log('✅ Usuario existente vinculado con Google y email verificado');

      return {
        ...userByEmail.dataValues,
        googleId: profile.id, // Asegurar que el objeto retornado tenga googleId actualizado
        emailVerificado: true,
        isNewUser: false
      };
    }

    // Crear nuevo usuario de Google
    const newUser = await Usuario.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      username: profile.displayName || profile.emails[0].value.split('@')[0],
      pais: 'AR',
      rol: 'normal',
      passwordHash: null,
      emailVerificado: true, // ⭐ CRÍTICO: Google ya verificó el email
      activo: true,
    }, { transaction });

    console.log('✅ Nuevo usuario de Google creado con email verificado');

    return {
      ...newUser.dataValues,
      isNewUser: true
    };
  }
}

module.exports = new UserService();