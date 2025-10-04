const { Usuario } = require('../models');

class UserService {
  async findOrCreateGoogleUser(profile) {
    // Buscar por googleId
    let existingUser = await Usuario.findOne({ 
      where: { googleId: profile.id } 
    });
    
    if (existingUser) {
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
      await userByEmail.update({ googleId: profile.id });
      return { 
        ...userByEmail.dataValues, 
        isNewUser: false 
      };
    }
    
    // Crear nuevo usuario
    const newUser = await Usuario.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      username: profile.displayName || profile.emails[0].value.split('@')[0],
      pais: 'AR',
      rol: 'normal',
      passwordHash: null
    });
    
    return { 
      ...newUser.dataValues, 
      isNewUser: true 
    };
  }
}

module.exports = new UserService();