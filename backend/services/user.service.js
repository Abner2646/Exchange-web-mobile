const { Usuario } = require('../models');

class UserService {
  async findOrCreateGoogleUser(profile) {
    // Buscar por googleId
    let existingUser = await Usuario.findOne({ 
      where: { googleId: profile.id } 
    });
    
    if (existingUser) {
      // ⭐ ASEGURAR que el email esté verificado
      if (!existingUser.emailVerificado) {
        await existingUser.update({ emailVerificado: true });
        console.log('✅ emailVerificado actualizado a true para usuario existente de Google');
      }
      
      return { 
        ...existingUser.dataValues, 
        isNewUser: false 
      };
    }
    
    // Buscar por email
    let userByEmail = await Usuario.findOne({ 
      where: { email: profile.emails[0].value } 
    });
    
    if (userByEmail) {
      // ⭐ Vincular cuenta con Google y verificar email
      await userByEmail.update({ 
        googleId: profile.id,
        emailVerificado: true // ⭐ CRÍTICO: Verificar email al vincular con Google
      });
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
    });
    
    console.log('✅ Nuevo usuario de Google creado con email verificado');
    
    return { 
      ...newUser.dataValues, 
      isNewUser: true 
    };
  }
}

module.exports = new UserService();